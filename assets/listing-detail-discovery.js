// Similar searches, geographic price benchmarks, and shared group shortlists.
(function () {
  const D = window.UyDoshDiscovery;
  const e = value => UyDosh.escapeHtml(String(value ?? ''));
  const t = (key, values = {}) => {
    let text = UyDosh.t(`discovery.${key}`);
    for (const [name, value] of Object.entries(values)) text = text.replaceAll(`{${name}}`, String(value));
    return text;
  };
  const money = value => UyDosh.formatPrice({ price: Math.round(value) }, UyDosh.getLang());
  const range = value => value.min === value.max ? money(value.max) : `${money(value.min)}–${money(value.max)}`;
  const detailUrl = (id, group, back) => {
    const params = new URLSearchParams({ id: String(id), mini: '1' });
    if (group) params.set('group', group);
    if (back) params.set('back', back);
    return `/listing.html?${params}`;
  };
  function budgetHtml(group, housing) {
    const result = D.budget(group, housing);
    if (!result) return `<p class="discovery-note">${e(t('budgetUnknown'))}</p>`;
    return `<div class="discovery-budget">
      <strong class="budget-${result.fit}">${e(t(result.fit))}</strong>
      <span>${e(t('share', { amount: range(result.share), count: result.size }))}</span>
      <span>${e(t('combined', { amount: range(result.total) }))}</span>
    </div>`;
  }
  function areaPricesHtml(listing) {
    if (D.typeCode(listing) === 'group_forming') return '';
    const stats = listing.area_price_stats;
    const rows = [];
    for (const key of ['subway_station', 'location']) {
      const value = stats?.[key];
      if (!(Number(value?.median) > 0 && Number(value.sample_count) >= 3)) continue;
      // Older servers don't expose the fallback scope. Label those conservatively.
      const scope = value.scope_type;
      const label = scope === 'subway_station' ? t('station')
        : scope === 'subway_line' ? t('metroLine')
        : scope === 'location' || key === 'location' ? t('district') : t('metroArea');
      const name = scope === 'subway_station' && Number(value.scope_id) === Number(listing.subway_station?.id)
        ? UyDosh.localized(listing.subway_station, UyDosh.getLang())
        : scope === 'location' && Number(value.scope_id) === Number(listing.location?.id)
          ? UyDosh.localized(listing.location, UyDosh.getLang()) : '';
      const price = Number(listing.price);
      const difference = price > 0 ? Math.round((price / Number(value.median) - 1) * 100) : null;
      const comparison = difference == null ? '' : difference === 0 ? t('atMedian')
        : t(difference > 0 ? 'aboveMedian' : 'belowMedian', { percent: Math.abs(difference) });
      rows.push(`<div class="discovery-price-row">
        <strong>${e(label)}${name ? ` · ${e(name)}` : ''}</strong>
        <span>${e(t('median', { amount: money(Number(value.median)) }))}</span>
        <small>${e(t('sample', { count: value.sample_count }))}${value.listing_type_id === 0 ? ` · ${e(t('allTypes'))}` : ''}</small>
        ${comparison ? `<span>${e(comparison)}</span>` : ''}
      </div>`);
    }
    return `<section class="map-section map-section-static discovery-section">
      <h2>${e(t('areaPrices'))}</h2>
      ${rows.length ? rows.join('') : `<p class="discovery-note">${e(t('noStats'))}</p>`}
    </section>`;
  }
  function html(listing) {
    const group = D.positiveId(new URLSearchParams(location.search).get('group'));
    const isGroup = D.typeCode(listing) === 'group_forming' || listing.group_context?.is_group_forming;
    const isHousing = D.typeCode(listing) === 'roommate_needed' || Number(listing.listing_type_id) === 2;
    return `<section class="map-section map-section-static discovery-section">
      <a class="btn discovery-similar" href="${e(D.searchUrl(listing, { group }))}">${e(t('similar'))} →</a>
    </section>${areaPricesHtml(listing)}
    ${isGroup && D.canShortlist(listing) ? `<section class="map-section map-section-static discovery-section" id="group-shortlist">
      <h2>${e(t('shortlist'))}</h2>
      <p class="discovery-note">${e(t('shared'))}</p>
      <a class="btn primary" href="${e(D.searchUrl(listing, { group: listing.id, housing: true }))}">${e(t('findHousing'))}</a>
      <details data-shortlist-details><summary>${e(t('viewShortlist'))}</summary><div data-shortlist-body></div></details>
    </section>` : ''}
    ${group && isHousing ? `<section class="map-section map-section-static discovery-section" data-group-save>
      <h2>${e(t('saveForGroup'))}</h2><div data-group-save-body role="status">${e(t('loading'))}</div>
    </section>` : ''}`;
  }
  function errorText(error) {
    return t(error?.status === 401 ? 'auth' : error?.status === 403 ? 'forbidden' : 'error');
  }
  async function bindSave(listing, section) {
    const body = section.querySelector('[data-group-save-body]');
    const groupId = D.positiveId(new URLSearchParams(location.search).get('group'));
    let busy = false, group, saved;
    function paint(message = '') {
      if (!section.isConnected) return;
      body.innerHTML = `${budgetHtml(group, listing)}
        <button type="button" class="btn primary" data-save-toggle ${busy ? 'disabled' : ''} aria-pressed="${Boolean(saved)}">${e(t(saved ? 'remove' : 'saveForGroup'))}</button>
        <a class="btn" href="${e(detailUrl(groupId))}#group-shortlist">${e(t('viewShortlist'))}</a>
        <p role="status">${e(message)}</p>`;
      body.querySelector('[data-save-toggle]').addEventListener('click', async () => {
        if (busy) return;
        busy = true;
        paint();
        try {
          const result = await UyDosh.toggleGroupShortlist(groupId, listing.id);
          saved = result.isShortlisted === true;
          busy = false;
          paint(t(saved ? 'saved' : 'removed'));
        } catch (error) {
          busy = false;
          // A toggle can succeed even when its response is lost. Re-read before
          // offering another toggle, so a retry cannot silently undo a save.
          body.innerHTML = `<p role="status">${e(errorText(error))}</p><button class="btn" data-save-retry>${e(t('retry'))}</button>`;
          body.querySelector('[data-save-retry]').onclick = () => bindSave(listing, section);
        }
      });
    }
    try {
      if (!await UyDosh.ensureTelegramMiniAppSession()) throw { status: 401 };
      group = await UyDosh.fetchListing(groupId);
      if (!D.canShortlist(group)) throw { status: 403 };
      const result = await UyDosh.checkGroupShortlist(groupId, listing.id);
      saved = result.isShortlisted === true;
      paint();
    } catch (error) {
      if (!section.isConnected) return;
      body.innerHTML = `<p>${e(errorText(error))}</p><button class="btn" data-save-retry>${e(t('retry'))}</button>`;
      body.querySelector('[data-save-retry]').onclick = () => bindSave(listing, section);
    }
  }
  function bindShortlist(group, details) {
    const body = details.querySelector('[data-shortlist-body]');
    let loaded = false, busy = false, page = 0, pages = 1, items = [];
    const back = detailUrl(group.id) + '#group-shortlist';
    function paint(message = '') {
      if (!details.isConnected) return;
      body.innerHTML = `<p role="status">${e(message)}</p>${items.map(item => {
        const listing = item.listing;
        const title = listing ? (listing.title || `#${listing.id}`) : t('unavailable');
        return `<article class="discovery-shortlist-item">
          ${listing ? `<a href="${e(detailUrl(listing.id, group.id, back))}"><strong>${e(title)}</strong></a>
            <p>${e(range(D.bounds(listing) || { min: 0, max: 0 }))} ${e(UyDosh.t('card.perMonth'))}</p>
            ${budgetHtml(group, listing)}` : `<strong>${e(title)}</strong>`}
          ${item.saved_by?.name ? `<small>${e(t('savedBy', { name: item.saved_by.name }))}</small>` : ''}
          <button class="btn" type="button" data-shortlist-remove="${Number(item.listing_id)}" ${busy ? 'disabled' : ''}>${e(t('remove'))}</button>
        </article>`;
      }).join('')}
      ${loaded && !items.length ? `<p>${e(t('empty'))}</p>` : ''}
      ${!loaded || page < pages ? `<button class="btn" type="button" data-shortlist-more ${busy ? 'disabled' : ''}>${e(t(loaded ? 'more' : 'retry'))}</button>` : ''}`;
      body.querySelector('[data-shortlist-more]')?.addEventListener('click', loadMore);
      for (const button of body.querySelectorAll('[data-shortlist-remove]')) {
        button.addEventListener('click', async () => {
          if (busy) return;
          const id = Number(button.dataset.shortlistRemove);
          busy = true; paint();
          try {
            await UyDosh.removeGroupShortlist(group.id, id);
            // Refetch page one after deletion: offset pagination shifts.
            page = 0; pages = 1; items = []; loaded = false; busy = false;
            await loadMore();
          } catch (error) { busy = false; paint(errorText(error)); }
        });
      }
    }
    async function loadMore() {
      if (busy) return;
      busy = true; paint(t('loading'));
      try {
        if (!await UyDosh.ensureTelegramMiniAppSession()) throw { status: 401 };
        const result = await UyDosh.fetchGroupShortlist(group.id, page + 1);
        const fresh = Array.isArray(result.data) ? result.data : [];
        const existing = new Set(items.map(item => item.listing_id));
        items.push(...fresh.filter(item => !existing.has(item.listing_id)));
        page++; pages = Number(result.totalPages) || 0; loaded = true;
        busy = false; paint();
      } catch (error) { busy = false; paint(errorText(error)); }
    }
    details.addEventListener('toggle', () => { if (details.open && !loaded) loadMore(); });
    if (location.hash === '#group-shortlist') {
      details.open = true;
      details.closest('section').scrollIntoView({ block: 'start' });
      loadMore();
    }
  }
  function bind(listing) {
    const details = rootEl.querySelector('[data-shortlist-details]');
    if (details) bindShortlist(listing, details);
    const save = rootEl.querySelector('[data-group-save]');
    if (save) bindSave(listing, save);
  }
  window.UyDoshListingDiscovery = { html, bind, areaPricesHtml, budgetHtml };
})();
