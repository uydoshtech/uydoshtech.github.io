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
  function budgetHtml(group, housing, { showStatus = true } = {}) {
    const result = D.budget(group, housing);
    if (!result) return `<p class="discovery-note">${e(t('budgetUnknown'))}</p>`;
    return `<div class="discovery-budget">
      ${showStatus ? `<strong class="budget-${result.fit}">${e(t(result.fit))}</strong>` : ''}
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
    const shortlistCount = listing.group_context?.group_shortlist_count;
    const group = D.positiveId(new URLSearchParams(location.search).get('group'));
    const isGroup = D.typeCode(listing) === 'group_forming' || Number(listing.listing_type_id) === 3 || listing.group_context?.is_group_forming;
    const isHousing = D.typeCode(listing) === 'roommate_needed' || Number(listing.listing_type_id) === 2;
    return `${isGroup ? '' : `<section class="map-section map-section-static discovery-section">
      <a class="btn discovery-similar" href="${e(D.searchUrl(listing, { group }))}">${e(t('similar'))} →</a>
    </section>`}${areaPricesHtml(listing)}
    ${isGroup && D.canShortlist(listing) ? `<section class="map-section map-section-static discovery-section" id="group-shortlist">
      <h2>${e(t('shortlist'))}<span data-shortlist-count>${Number.isInteger(shortlistCount) && shortlistCount >= 0 ? ` · ${shortlistCount}` : ''}</span></h2>
      <p class="discovery-note">${e(t('shared'))}</p>
      <a class="btn primary" data-group-housing-search href="${e(D.searchUrl(listing, { group: listing.id, housing: true }))}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false" style="flex-shrink:0"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>${e(t('findHousing'))}</a>
      <div data-shortlist-details><div data-shortlist-body></div></div>
    </section>` : ''}
    ${group && isHousing ? `<section class="map-section map-section-static discovery-section" data-group-save>
      <h2>${e(t('saveForGroup'))}</h2><div data-group-save-body role="status">${e(t('loading'))}</div>
    </section>` : ''}`;
  }
  function errorText(error) {
    return t(error?.status === 401 ? 'auth' : error?.status === 403 ? 'forbidden' : 'error');
  }
  function savedByHtml(user) {
    if (!user?.name) return '';
    const initials = String(user.name).trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0] || '').join('').toUpperCase();
    const avatar = `<span class="discovery-saver-avatar" aria-hidden="true"><span>${e(initials)}</span>${user.avatar_url ? `<img src="${e(UyDosh.photoUrl(user.avatar_url))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove();" />` : ''}</span>`;
    const person = `<span class="discovery-saver-person">${avatar}<span>${e(user.name)}</span></span>`;
    return `<small class="discovery-saved-by">${e(t('savedBy', { name: '{person}' })).replace('{person}', person)}</small>`;
  }
  async function bindSave(listing, section) {
    const body = section.querySelector('[data-group-save-body]');
    const groupId = D.positiveId(new URLSearchParams(location.search).get('group'));
    let busy = false, group, saved;
    function paint(message = '') {
      if (!section.isConnected) return;
      body.innerHTML = `${budgetHtml(group, listing)}
        <button type="button" class="btn ${saved ? 'discovery-shortlist-remove' : 'primary'}" data-save-toggle ${busy ? 'disabled' : ''} aria-pressed="${Boolean(saved)}">${saved ? `<span aria-hidden="true">${UyDosh.iconTrash()}</span>` : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" style="flex-shrink:0"><path d="M6 3h12v18l-6-4-6 4V3Z"/></svg>`}${e(t(saved ? 'remove' : 'saveForGroup'))}</button>
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
  let shortlistGroupId = 0;
  let refreshShortlist = () => {};
  const RATING_CATEGORIES = [
    ['price', '#34C759'],
    ['location', '#2F80ED'],
    ['condition', '#8E5CF7'],
    ['landlord', '#EB5757'],
  ];
  const RATING_REASONS = ['expensive', 'far', 'badCondition', 'owner', 'space', 'neighborhood'];
  const RATING_REASON_CODES = {
    expensive: 'too_expensive',
    far: 'too_far',
    badCondition: 'bad_condition',
    owner: 'owner_doubts',
    space: 'not_enough_space',
    neighborhood: 'bad_neighborhood',
  };
  function starSvg() {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6 14.7 9l6.7.6-5.1 4.4 1.6 6.6L12 17.2 6.1 20.6 7.7 14 2.6 9.6 9.3 9 12 2.6z"/></svg>`;
  }
  function starButtons(value, { interactive = false, listingId = 0 } = {}) {
    return `<span class="shortlist-stars">${[1, 2, 3, 4, 5].map(star => {
      const filled = Number(value) >= star;
      const label = t('rating.star', { n: star });
      return interactive
        ? `<button type="button" class="shortlist-star${filled ? ' is-on' : ''}" data-rate-open="${listingId}" data-stars="${star}" aria-label="${e(label)}">${starSvg()}</button>`
        : `<span class="shortlist-star${filled ? ' is-on' : ''}" aria-hidden="true">${starSvg()}</span>`;
    }).join('')}</span>`;
  }
  function ratingLabel(stars) {
    if (stars >= 5) return t('rating.excellent');
    if (stars >= 4) return t('rating.good');
    if (stars >= 3) return t('rating.normal');
    if (stars > 0) return t('rating.bad');
    return '';
  }
  function currentUserRating(item) {
    const me = Number(UyDosh.getSessionUserId());
    return (item.rating?.participants || []).find(person => Number(person.user_id) === me) || null;
  }
  function ratingHtml(item) {
    const rating = item.rating || {};
    const count = Number(rating.count) || 0;
    const average = Number(rating.average);
    const hasRating = count > 0 && Number.isFinite(average);
    const me = Number(UyDosh.getSessionUserId());
    const mine = currentUserRating(item);
    const others = (rating.participants || []).filter(person => Number(person.user_id) !== me);
    const ordered = mine ? [mine, ...others] : (rating.participants || []);
    const summary = typeof rating.summary === 'string' ? rating.summary.trim() : '';
    const chips = ordered.map(person => {
      const isMe = Number(person.user_id) === me;
      const name = isMe ? t('rating.you') : (person.name || '');
      const stars = person.stars == null ? '' : starButtons(person.stars);
      const editable = isMe && person.stars != null;
      const inner = `<span class="shortlist-rating-person">${e(name)}</span>${stars}`;
      return editable
        ? `<button type="button" class="shortlist-rating-chip" data-rate-open="${Number(item.listing_id)}" data-stars="${Number(person.stars)}">${inner}</button>`
        : `<span class="shortlist-rating-chip">${inner}</span>`;
    }).join('');
    return `<section class="shortlist-rating">
      <p class="shortlist-rating-head">${e(t('rating.group'))} · ${hasRating ? `<span class="shortlist-star is-on">${starSvg()}</span> ${e(average.toFixed(1))} · ${e(t('rating.count', { count }))}` : e(t('rating.none'))}</p>
      ${mine?.stars == null ? `<div class="shortlist-rating-prompt">${starButtons(0, { interactive: true, listingId: Number(item.listing_id) })}<span>${e(t('rating.cta'))}</span></div>` : ''}
      ${chips ? `<div class="shortlist-rating-chips">${chips}</div>` : ''}
      ${summary ? `<p class="shortlist-rating-summary"><strong>${e(t('rating.summary'))}</strong> ${e(summary)}</p>` : ''}
    </section>`;
  }
  function openRatingDialog(item, initialStars) {
    const mine = currentUserRating(item);
    const categories = Object.fromEntries(RATING_CATEGORIES.map(([code]) => {
      const saved = Number(mine?.category_ratings?.[code]);
      return [code, saved >= 1 && saved <= 5 ? saved : 0];
    }));
    const reasons = new Set(Array.isArray(mine?.reasons) ? mine.reasons : []);
    let selected = Math.min(5, Math.max(0, Number(initialStars) || Number(mine?.stars) || 0));
    const overlay = document.createElement('div');
    overlay.className = 'shortlist-rating-dialog';
    function average() {
      const picked = Object.values(categories).filter(value => value > 0);
      if (!picked.length) return null;
      return Math.min(5, Math.max(1, Math.round(picked.reduce((sum, value) => sum + value, 0) / picked.length)));
    }
    function paintStars(root, value) {
      for (const button of root.querySelectorAll('[data-star]')) {
        button.classList.toggle('is-on', Number(button.dataset.star) <= value);
      }
    }
    overlay.innerHTML = `<div class="shortlist-rating-sheet" role="dialog" aria-modal="true" aria-labelledby="shortlist-rating-title">
      <div class="shortlist-rating-sheet-head">
        <div>
          <h2 id="shortlist-rating-title">${e(t('rating.title'))}</h2>
          <p>${e(t('rating.subtitle'))}</p>
        </div>
        <button type="button" class="shortlist-rating-close" data-rating-close aria-label="${e(t('rating.close'))}">×</button>
      </div>
      ${RATING_CATEGORIES.map(([code, color]) => `<section class="shortlist-rating-category" style="--rating-accent:${color}">
        <div><strong>${e(t(`rating.${code}`))}</strong><span>${e(t(`rating.${code}Hint`))}</span></div>
        <div class="shortlist-rating-category-score">
          <span data-rating-label="${code}">${e(ratingLabel(categories[code]))}</span>
          <span class="shortlist-stars" data-category="${code}">${[1, 2, 3, 4, 5].map(star => `<button type="button" class="shortlist-star${categories[code] >= star ? ' is-on' : ''}" data-star="${star}" aria-label="${e(t('rating.star', { n: star }))}">${starSvg()}</button>`).join('')}</span>
        </div>
      </section>`).join('')}
      <p class="shortlist-rating-reasons-title">${e(t('rating.reasons'))} <span>(${e(t('rating.optional'))})</span></p>
      <div class="shortlist-rating-reasons">${RATING_REASONS.map(key => {
        const code = RATING_REASON_CODES[key];
        return `<button type="button" class="shortlist-rating-reason${reasons.has(code) ? ' is-on' : ''}" data-reason="${code}">${e(t(`rating.${key}`))}</button>`;
      }).join('')}</div>
      <p class="shortlist-rating-error" data-rating-error hidden></p>
      <button type="button" class="btn primary shortlist-rating-submit" data-rating-submit ${selected >= 1 ? '' : 'disabled'}>${e(t('rating.submit'))}</button>
    </div>`;
    function close() { overlay.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(event) { if (event.key === 'Escape') close(); }
    overlay.addEventListener('click', async event => {
      if (event.target === overlay || event.target.closest('[data-rating-close]')) { close(); return; }
      const star = event.target.closest('[data-star]');
      if (star) {
        const row = star.closest('[data-category]');
        const code = row?.dataset.category;
        if (!code) return;
        categories[code] = Number(star.dataset.star);
        paintStars(row, categories[code]);
        row.parentElement.querySelector(`[data-rating-label="${code}"]`).textContent = ratingLabel(categories[code]);
        const next = average();
        if (next != null) selected = next;
        overlay.querySelector('[data-rating-submit]').disabled = selected < 1;
        UyDosh.haptic?.selection?.();
        return;
      }
      const reason = event.target.closest('[data-reason]');
      if (reason) {
        const code = reason.dataset.reason;
        if (reasons.has(code)) reasons.delete(code); else reasons.add(code);
        reason.classList.toggle('is-on', reasons.has(code));
        UyDosh.haptic?.selection?.();
        return;
      }
      if (!event.target.closest('[data-rating-submit]') || selected < 1) return;
      const submit = overlay.querySelector('[data-rating-submit]');
      const error = overlay.querySelector('[data-rating-error]');
      submit.disabled = true;
      error.hidden = true;
      try {
        const categoryRatings = Object.fromEntries(Object.entries(categories).filter(([, value]) => value > 0));
        const result = await UyDosh.rateGroupShortlist(shortlistGroupId, item.listing_id, {
          stars: selected,
          reasons: [...reasons],
          categoryRatings,
          verdict: selected >= 5 ? 'yes' : selected >= 3 ? 'maybe' : 'no',
        });
        item.rating = result.rating || item.rating;
        close();
        refreshShortlist(t('rating.updated'));
      } catch (err) {
        submit.disabled = selected < 1;
        error.hidden = false;
        error.textContent = errorText(err);
      }
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
  }
  function bindShortlist(group, details) {
    shortlistGroupId = group.id;
    refreshShortlist = message => paint(message);
    const body = details.querySelector('[data-shortlist-body]');
    let loaded = false, busy = false, page = 0, pages = 1, items = [], activeIndex = 0;
    const back = detailUrl(group.id) + '#group-shortlist';
    function paint(message = '') {
      if (!details.isConnected) return;
      activeIndex = Math.min(activeIndex, Math.max(0, items.length - 1));
      body.innerHTML = `<p role="status">${e(message)}</p>
      ${items.length > 1 ? `<div class="shortlist-carousel-controls"><button type="button" class="btn" data-shortlist-prev aria-label="${e(t('previousOption'))}">‹</button><span data-shortlist-position aria-live="polite"></span><button type="button" class="btn" data-shortlist-next aria-label="${e(t('nextOption'))}">›</button></div>` : ''}
      <div class="shortlist-carousel" data-shortlist-carousel tabindex="0" aria-label="${e(t('shortlist'))}">${items.map(item => {
        const listing = item.listing;
        const title = listing ? (listing.title || `#${listing.id}`) : t('unavailable');
        const budget = listing ? D.budget(group, listing) : null;
        const photo = listing ? UyDosh.primaryPhoto(listing) : null;
        const url = listing ? detailUrl(listing.id, group.id, back) : '';
        const area = listing ? UyDosh.listingLocationLabel(listing, UyDosh.getLang()) : '';
        const price = listing ? D.bounds(listing) : null;
        return `<article class="discovery-shortlist-item">
          ${photo ? `<a class="discovery-shortlist-photo" href="${e(url)}" aria-label="${e(title)}"><img src="${e(UyDosh.photoUrl(photo))}" alt="" loading="lazy" decoding="async" onerror="this.parentElement.remove();" /></a>` : ''}
          <div class="discovery-shortlist-content">
            ${budget ? `<div class="discovery-shortlist-status"><span class="discovery-budget-pill budget-${e(budget.fit)}">${e(t(budget.fit))}</span></div>` : ''}
            ${listing ? `<div class="discovery-shortlist-title-row">
                <a class="discovery-shortlist-title" href="${e(url)}"><strong>${e(title)}</strong></a>
                ${price ? `<div class="discovery-shortlist-price">${e(range(price))}<small>${e(UyDosh.t('card.perMonth'))}</small></div>` : ''}
              </div>
              ${area ? `<div class="discovery-shortlist-area"><span aria-hidden="true">${UyDosh.iconPin()}</span>${e(area)}</div>` : ''}
              <div class="discovery-shortlist-budget">${budgetHtml(group, listing, { showStatus: false })}</div>` : `<strong>${e(title)}</strong>`}
            ${ratingHtml(item)}
            <div class="discovery-shortlist-footer">
              ${savedByHtml(item.saved_by)}
              <button class="btn discovery-shortlist-remove" type="button" data-shortlist-remove="${Number(item.listing_id)}" ${busy ? 'disabled' : ''}><span aria-hidden="true">${UyDosh.iconTrash()}</span>${e(t('removeShort'))}</button>
            </div>
          </div>
        </article>`;
      }).join('')}</div>
      ${loaded && !items.length ? `<p>${e(t('empty'))}</p>` : ''}
      ${!loaded || page < pages ? `<button class="btn" type="button" data-shortlist-more ${busy ? 'disabled' : ''}>${e(t(loaded ? 'more' : 'retry'))}</button>` : ''}`;
      const carousel = body.querySelector('[data-shortlist-carousel]');
      const prev = body.querySelector('[data-shortlist-prev]');
      const next = body.querySelector('[data-shortlist-next]');
      const position = body.querySelector('[data-shortlist-position]');
      const step = () => carousel.clientWidth + 12;
      function updateControls() {
        if (prev) prev.disabled = activeIndex === 0;
        if (next) next.disabled = activeIndex >= items.length - 1;
        if (position) position.textContent = `${activeIndex + 1} / ${items.length}`;
      }
      function move(delta) {
        const targetIndex = Math.max(0, Math.min(items.length - 1, activeIndex + delta));
        // The scroll handler owns the visible index. Setting it to the target
        // here made early animation frames switch the counter back again.
        carousel.scrollTo({ left: targetIndex * step(), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      }
      carousel.scrollLeft = activeIndex * step();
      updateControls();
      carousel.addEventListener('scroll', () => {
        const visibleIndex = Math.max(0, Math.min(items.length - 1, Math.round(carousel.scrollLeft / step())));
        if (visibleIndex === activeIndex) return;
        activeIndex = visibleIndex;
        updateControls();
      }, { passive: true });
      carousel.addEventListener('keydown', event => {
        if (event.target !== carousel) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1);
        }
      });
      prev?.addEventListener('click', () => move(-1));
      next?.addEventListener('click', () => move(1));
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
      for (const button of body.querySelectorAll('[data-rate-open]')) {
        button.addEventListener('click', () => {
          const id = Number(button.dataset.rateOpen);
          const row = items.find(candidate => Number(candidate.listing_id) === id);
          if (row) openRatingDialog(row, Number(button.dataset.stars) || 0);
        });
      }
    }
    async function loadMore() {
      if (busy) return;
      busy = true; paint(t('loading'));
      try {
        if (!await UyDosh.ensureTelegramMiniAppSession()) throw { status: 401 };
        const result = await UyDosh.fetchGroupShortlist(group.id, page + 1);
        const count = details.closest('section').querySelector('[data-shortlist-count]');
        if (count && Number.isInteger(result.total) && result.total >= 0) {
          count.textContent = ` · ${result.total}`;
        }
        const fresh = Array.isArray(result.data) ? result.data : [];
        const existing = new Set(items.map(item => item.listing_id));
        items.push(...fresh.filter(item => !existing.has(item.listing_id)));
        page++; pages = Number(result.totalPages) || 0; loaded = true;
        busy = false; paint();
      } catch (error) { busy = false; paint(errorText(error)); }
    }
    loadMore();
    if (location.hash === '#group-shortlist') {
      details.closest('section').scrollIntoView({ block: 'start' });
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
