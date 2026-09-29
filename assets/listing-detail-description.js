// Description language selection survives detail re-renders without repeating AI calls.
const listingDescriptionStates = new WeakMap();
let listingTranslationVisibility;

function listingDescriptionState(listing, fallback) {
  if (!listingDescriptionStates.has(listing)) {
    const original = String(listing.description || fallback || '').trim();
    const cache = { original };
    for (const code of ['uz', 'ru', 'en']) {
      const text = listing[`description_${code}`];
      if (typeof text === 'string' && text.trim()) cache[code] = text.trim();
    }
    const lang = UyDosh.getLang();
    listingDescriptionStates.set(listing, {
      cache, selected: cache[lang] ? lang : 'original', pending: false,
      error: '', hidden: true, paint: () => {},
    });
  }
  return listingDescriptionStates.get(listing);
}

function listingDescriptionHtml(listing, fallback) {
  const model = listingDescriptionState(listing, fallback);
  return `<div class="map-section-extra map-section-description" data-description-section>
    <div class="description-header">
    <div class="description-languages" role="group" aria-label="${UyDosh.escapeHtml(UyDosh.t('detail.translation.label'))}" hidden>
      ${['original', 'uz', 'ru', 'en'].map(code => `<button type="button" data-description-language="${code}" aria-pressed="false">${code === 'original' ? UyDosh.escapeHtml(UyDosh.t('detail.translation.original')) : code.toUpperCase()}</button>`).join('')}
    </div>
    </div>
    <div class="description">${UyDosh.escapeHtml(model.cache[model.selected])}</div>
    <p class="description-translation-status" role="status" aria-live="polite" hidden></p>
  </div>`;
}

function bindListingDescription(listing) {
  const section = rootEl.querySelector('[data-description-section]');
  if (!section) return;
  const model = listingDescriptionStates.get(listing);
  const controls = section.querySelector('.description-languages');
  const description = section.querySelector('.description');
  const status = section.querySelector('[role="status"]');
  model.paint = () => {
    if (!section.isConnected) return;
    controls.hidden = model.hidden;
    description.textContent = model.cache[model.selected];
    if (model.selected === 'original') description.removeAttribute('lang');
    else description.lang = model.selected;
    description.setAttribute('aria-busy', String(model.pending));
    for (const button of controls.querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(button.dataset.descriptionLanguage === model.selected));
      button.disabled = model.pending && button.dataset.descriptionLanguage !== 'original';
    }
    const key = model.pending ? 'loading' : model.error;
    status.hidden = !key;
    status.textContent = key ? UyDosh.t(`detail.translation.${key}`) : '';
  };
  model.paint();
  listingTranslationVisibility ||= UyDosh.fetchGeminiListingUiHidden();
  listingTranslationVisibility.then(hidden => { model.hidden = hidden; model.paint(); });
  controls.addEventListener('click', async event => {
    const button = event.target.closest('[data-description-language]');
    if (!button) return;
    const code = button.dataset.descriptionLanguage;
    if (code === 'original') {
      model.selected = code;
      model.error = '';
      // A pending result may be cached, but must not replace the requested original.
      model.requested = code;
      model.paint();
      return;
    }
    if (model.pending || model.hidden) return;
    model.error = '';
    if (model.cache[code]) {
      model.selected = code;
      model.paint();
      return;
    }
    model.pending = true;
    model.requested = code;
    model.paint();
    try {
      if (!await UyDosh.ensureTelegramMiniAppSession()) {
        model.error = 'auth';
        return;
      }
      const result = await UyDosh.translateListingDescription(model.cache.original, code);
      const text = result?.translatedText;
      if (typeof text !== 'string' || !text.trim()) throw new Error('Empty translation');
      model.cache[code] = text.trim();
      if (model.requested === code) model.selected = code;
      // Saving the shared cache is best-effort; a failure must not discard the translation.
      UyDosh.saveDescriptionTranslation(listing.id, code, model.cache[code]).catch(() => {});
    } catch (error) {
      const reason = error.payload?.code;
      model.error = error.status === 401 ? 'auth'
        : reason === 'gemini_quota_exceeded' ? 'quota'
        : reason === 'gemini_listing_ui_disabled' ? 'unavailable' : 'error';
      if (reason === 'gemini_listing_ui_disabled') model.hidden = true;
    } finally {
      model.pending = false;
      model.paint();
    }
  });
}
