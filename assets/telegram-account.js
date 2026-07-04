UyDosh.initTelegramMiniApp();

const loadingEl = document.getElementById('loading');
const emptyEl = document.getElementById('account-empty');
const emptyTextEl = document.getElementById('account-empty-text');
const emptyCtaEl = document.getElementById('account-empty-cta');
const listEl = document.getElementById('account-list');
const tabButtons = Array.from(document.querySelectorAll('[data-account-tab]'));

const TAB_MINE = 'mine';
const TAB_FAVORITES = 'favorites';

const state = {
  activeTab: TAB_MINE,
  authError: false,
  myListings: [],
  myListingsError: false,
  favorites: [],
  favoritesError: false,
  // No usable session for the Bearer-token-based favorites API (distinct from
  // `authError`, which means there's no Telegram identity at all).
  favoritesUnavailable: false,
};

function statusBadgeHtml(listing, lang) {
  if (listing.moderation_status === 'pending_review') {
    return `<span class="account-status account-status-pending">${UyDosh.escapeHtml(UyDosh.t('account.statusPending', lang))}</span>`;
  }
  if (!listing.is_active) {
    return `<span class="account-status account-status-inactive">${UyDosh.escapeHtml(UyDosh.t('account.statusInactive', lang))}</span>`;
  }
  return '';
}

function accountThumbHtml(listing) {
  const photo = UyDosh.primaryPhoto(listing);
  const photoSrc = photo ? UyDosh.photoUrl(photo) : '';
  const placeholderSrc = !photoSrc ? UyDosh.noPhotoPlaceholderImageUrl(listing) : '';
  if (photoSrc) {
    return `<div class="account-thumb"><img loading="lazy" decoding="async" src="${UyDosh.escapeHtml(photoSrc)}" alt="" onerror="this.parentElement.classList.add('empty'); this.remove();" /></div>`;
  }
  if (placeholderSrc) {
    return `<div class="account-thumb"><img loading="lazy" decoding="async" src="${UyDosh.escapeHtml(placeholderSrc)}" alt="" /></div>`;
  }
  return `<div class="account-thumb empty"></div>`;
}

/** Days remaining until `nextRenewalAtIso` (ISO string) is reached; 0 or less means renewal is available now. */
function daysUntil(nextRenewalAtIso) {
  if (!nextRenewalAtIso) return 0;
  const diffMs = new Date(nextRenewalAtIso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

function renewLabelHtml(listing, lang) {
  const days = daysUntil(listing.next_renewal_at);
  if (days <= 0) return UyDosh.escapeHtml(UyDosh.t('account.renew', lang));
  const key = days === 1 ? 'account.renewInOneDay' : 'account.renewInDays';
  return UyDosh.escapeHtml(UyDosh.t(key, lang).replace('{days}', String(days)));
}

function listingRowHtml(listing) {
  const lang = UyDosh.getLang();
  const title = UyDosh.escapeHtml(listing.title || '');
  const price = UyDosh.formatPrice(listing, lang);
  const editHref = `/telegram/create.html?id=${encodeURIComponent(listing.id)}`;
  const visibilityLabelKey = listing.is_active ? 'account.deactivate' : 'account.activate';
  const canRenew = daysUntil(listing.next_renewal_at) <= 0;
  return `
    <div class="account-row" data-listing-row="${listing.id}">
      ${accountThumbHtml(listing)}
      <div class="account-row-body">
        <div class="account-row-title">${title}</div>
        <div class="account-row-meta">
          ${price ? `<span class="account-row-price">${price}<small>${UyDosh.escapeHtml(UyDosh.t('card.perMonth', lang))}</small></span>` : ''}
          ${statusBadgeHtml(listing, lang)}
        </div>
      </div>
      <div class="account-row-actions">
        <a class="account-edit-btn" href="${editHref}" data-i18n="account.edit"></a>
        <button
          type="button"
          class="account-visibility-btn"
          data-toggle-visibility="${listing.id}"
          aria-pressed="${listing.is_active ? 'true' : 'false'}"
          data-i18n="${visibilityLabelKey}"
        ></button>
        <button
          type="button"
          class="account-renew-btn"
          data-renew-listing="${listing.id}"
          ${canRenew ? '' : 'disabled'}
        >${renewLabelHtml(listing, lang)}</button>
        <button
          type="button"
          class="account-delete-btn"
          data-delete-listing="${listing.id}"
          data-i18n="account.delete"
        ></button>
      </div>
    </div>`;
}

/** Favorites rows link to the listing (not editable — it may not be the viewer's own) and offer a heart to unfavorite. */
function favoriteRowHtml(favorite) {
  const listing = favorite?.listing;
  if (!listing) return '';
  const lang = UyDosh.getLang();
  const title = UyDosh.escapeHtml(listing.title || '');
  const price = UyDosh.formatPrice(listing, lang);
  const href = UyDosh.escapeHtml(UyDosh.listingPageUrl(listing.id));
  return `
    <div class="account-row" data-favorite-row="${listing.id}">
      <a class="account-row-link" href="${href}">
        ${accountThumbHtml(listing)}
        <div class="account-row-body">
          <div class="account-row-title">${title}</div>
          <div class="account-row-meta">
            ${price ? `<span class="account-row-price">${price}<small>${UyDosh.escapeHtml(UyDosh.t('card.perMonth', lang))}</small></span>` : ''}
            ${statusBadgeHtml(listing, lang)}
          </div>
        </div>
      </a>
      <button type="button" class="account-favorite-btn" data-unfavorite-listing="${listing.id}" aria-label="${UyDosh.escapeHtml(UyDosh.t('detail.favorite.remove'))}">
        ${UyDosh.iconHeart(true)}
      </button>
    </div>`;
}

function showEmpty(text, { showCreateCta = false } = {}) {
  loadingEl.hidden = true;
  listEl.hidden = true;
  emptyEl.hidden = false;
  emptyTextEl.textContent = text;
  emptyCtaEl.hidden = !showCreateCta;
}

function showList(html) {
  loadingEl.hidden = true;
  emptyEl.hidden = true;
  listEl.hidden = false;
  listEl.innerHTML = html;
  UyDosh.applyI18n(listEl);
}

function bindVisibilityToggleButtons() {
  for (const btn of listEl.querySelectorAll('[data-toggle-visibility]')) {
    btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-toggle-visibility'));
      if (!Number.isFinite(id) || btn.disabled) return;
      const listing = state.myListings.find((l) => l?.id === id);
      if (!listing) return;
      btn.disabled = true;
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
      try {
        const data = await UyDosh.toggleListingActiveFromTelegramMiniApp(id);
        const updated = data?.listing;
        listing.is_active = updated ? !!updated.is_active : !listing.is_active;
        renderMine();
      } catch (err) {
        console.error('Failed to toggle listing visibility', err);
        btn.disabled = false;
      }
    });
  }
}

/** Telegram-native confirm dialog when available (Telegram.WebApp.showConfirm), else a plain browser confirm(). */
function confirmDestructiveAction(message) {
  return new Promise((resolve) => {
    const tg = window.Telegram?.WebApp;
    if (typeof tg?.showConfirm === 'function') {
      tg.showConfirm(message, (confirmed) => resolve(!!confirmed));
    } else {
      resolve(window.confirm(message));
    }
  });
}

/** Telegram-native alert when available (Telegram.WebApp.showAlert), else a plain browser alert(). */
function showTelegramAlert(message) {
  const tg = window.Telegram?.WebApp;
  if (typeof tg?.showAlert === 'function') {
    tg.showAlert(message);
  } else {
    window.alert(message);
  }
}

function bindRenewButtons() {
  for (const btn of listEl.querySelectorAll('[data-renew-listing]')) {
    btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-renew-listing'));
      if (!Number.isFinite(id) || btn.disabled) return;
      const listing = state.myListings.find((l) => l?.id === id);
      if (!listing) return;
      const lang = UyDosh.getLang();
      btn.disabled = true;
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
      try {
        const data = await UyDosh.renewListingFromTelegramMiniApp(id);
        if (data?.listing) Object.assign(listing, data.listing);
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('success');
        renderMine();
      } catch (err) {
        console.error('Failed to renew listing', err);
        const nextRenewalAt = err?.payload?.nextRenewalAt;
        if (nextRenewalAt) {
          // Cooldown still active (e.g. stale client state) — sync from the server's answer.
          listing.next_renewal_at = nextRenewalAt;
          renderMine();
        } else {
          btn.disabled = false;
        }
        showTelegramAlert(UyDosh.t('account.renewError', lang));
      }
    });
  }
}

function bindDeleteButtons() {
  for (const btn of listEl.querySelectorAll('[data-delete-listing]')) {
    btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-delete-listing'));
      if (!Number.isFinite(id) || btn.disabled) return;
      const lang = UyDosh.getLang();
      const confirmed = await confirmDestructiveAction(UyDosh.t('account.deleteConfirm', lang));
      if (!confirmed) return;
      btn.disabled = true;
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
      try {
        await UyDosh.deleteListingFromTelegramMiniApp(id);
        state.myListings = state.myListings.filter((l) => l?.id !== id);
        renderMine();
      } catch (err) {
        console.error('Failed to delete listing', err);
        btn.disabled = false;
        showTelegramAlert(UyDosh.t('account.deleteError', lang));
      }
    });
  }
}

function bindFavoriteRemoveButtons() {
  for (const btn of listEl.querySelectorAll('[data-unfavorite-listing]')) {
    btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-unfavorite-listing'));
      if (!Number.isFinite(id) || btn.disabled) return;
      btn.disabled = true;
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
      try {
        await UyDosh.toggleListingFavorite(id);
        state.favorites = state.favorites.filter((f) => f?.listing?.id !== id);
        renderActiveTab();
      } catch (err) {
        console.error('Failed to remove favorite', err);
        btn.disabled = false;
      }
    });
  }
}

function renderMine() {
  const lang = UyDosh.getLang();
  if (state.authError) {
    showEmpty(UyDosh.t('create.errorAuth', lang));
    return;
  }
  if (state.myListingsError) {
    showEmpty(UyDosh.t('feed.error', lang));
    return;
  }
  if (!state.myListings.length) {
    showEmpty(UyDosh.t('account.empty', lang), { showCreateCta: true });
    return;
  }
  showList(state.myListings.map(listingRowHtml).join(''));
  bindVisibilityToggleButtons();
  bindRenewButtons();
  bindDeleteButtons();
}

function renderFavorites() {
  const lang = UyDosh.getLang();
  if (state.authError || state.favoritesUnavailable) {
    showEmpty(UyDosh.t('create.errorAuth', lang));
    return;
  }
  if (state.favoritesError) {
    showEmpty(UyDosh.t('feed.error', lang));
    return;
  }
  if (!state.favorites.length) {
    showEmpty(UyDosh.t('account.favoritesEmpty', lang));
    return;
  }
  showList(state.favorites.map(favoriteRowHtml).join(''));
  bindFavoriteRemoveButtons();
}

function renderActiveTab() {
  if (state.activeTab === TAB_FAVORITES) renderFavorites();
  else renderMine();
}

function setActiveTab(tab) {
  if (state.activeTab === tab) return;
  state.activeTab = tab;
  for (const btn of tabButtons) {
    btn.setAttribute('aria-selected', btn.getAttribute('data-account-tab') === tab ? 'true' : 'false');
  }
  renderActiveTab();
}

for (const btn of tabButtons) {
  btn.addEventListener('click', () => {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
    setActiveTab(btn.getAttribute('data-account-tab'));
  });
}

async function loadMyListings() {
  try {
    const data = await UyDosh.fetchMyTelegramMiniAppListings();
    state.myListings = Array.isArray(data?.listings) ? data.listings : [];
  } catch (err) {
    console.error('Failed to load my listings', err);
    state.myListingsError = true;
  }
}

/** Favorites reuse the shared `/favorites` API (Bearer-token auth, same as the mobile app). */
async function loadFavorites() {
  const sessionReady = await UyDosh.ensureTelegramMiniAppSession();
  if (!sessionReady) {
    state.favoritesUnavailable = true;
    return;
  }
  try {
    const data = await UyDosh.fetchFavoriteListings({ limit: 100 });
    const favorites = Array.isArray(data?.favorites) ? data.favorites : [];
    state.favorites = favorites.filter((f) => f?.listing);
  } catch (err) {
    console.error('Failed to load favorites', err);
    state.favoritesError = true;
  }
}

async function boot() {
  UyDosh.applyI18n();
  document.addEventListener('uydosh:langchange', () => {
    UyDosh.applyI18n();
    renderActiveTab();
  });

  if (!UyDosh.getTelegramInitData()) {
    state.authError = true;
    loadingEl.hidden = true;
    renderActiveTab();
    return;
  }

  await Promise.all([loadMyListings(), loadFavorites()]);
  loadingEl.hidden = true;
  renderActiveTab();
}

boot();
