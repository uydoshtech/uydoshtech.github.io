UyDosh.initTelegramMiniApp();

const loadingEl = document.getElementById('loading');
const emptyEl = document.getElementById('account-empty');
const listEl = document.getElementById('account-list');

let myListings = [];

function statusBadgeHtml(listing, lang) {
  if (listing.moderation_status === 'pending_review') {
    return `<span class="account-status account-status-pending">${UyDosh.escapeHtml(UyDosh.t('account.statusPending', lang))}</span>`;
  }
  if (!listing.is_active) {
    return `<span class="account-status account-status-inactive">${UyDosh.escapeHtml(UyDosh.t('account.statusInactive', lang))}</span>`;
  }
  return '';
}

function listingRowHtml(listing) {
  const lang = UyDosh.getLang();
  const photo = UyDosh.primaryPhoto(listing);
  const photoSrc = photo ? UyDosh.photoUrl(photo) : '';
  const title = UyDosh.escapeHtml(listing.title || '');
  const price = UyDosh.formatPrice(listing, lang);
  const thumb = photoSrc
    ? `<div class="account-thumb"><img loading="lazy" decoding="async" src="${UyDosh.escapeHtml(photoSrc)}" alt="" onerror="this.parentElement.classList.add('empty'); this.remove();" /></div>`
    : `<div class="account-thumb empty"></div>`;
  const editHref = `/telegram/create.html?id=${encodeURIComponent(listing.id)}`;
  return `
    <div class="account-row">
      ${thumb}
      <div class="account-row-body">
        <div class="account-row-title">${title}</div>
        <div class="account-row-meta">
          ${price ? `<span class="account-row-price">${price}<small>${UyDosh.escapeHtml(UyDosh.t('card.perMonth', lang))}</small></span>` : ''}
          ${statusBadgeHtml(listing, lang)}
        </div>
      </div>
      <a class="account-edit-btn" href="${editHref}" data-i18n="account.edit"></a>
    </div>`;
}

function render(listings) {
  if (!listings || listings.length === 0) {
    emptyEl.hidden = false;
    listEl.hidden = true;
    return;
  }
  emptyEl.hidden = true;
  listEl.hidden = false;
  listEl.innerHTML = listings.map(listingRowHtml).join('');
  UyDosh.applyI18n(listEl);
}

function showLoadError() {
  loadingEl.classList.add('error');
  loadingEl.innerHTML = '';
  loadingEl.textContent = UyDosh.t('feed.error', UyDosh.getLang());
}

async function loadMyListings() {
  const initData = UyDosh.getTelegramInitData();
  if (!initData) {
    loadingEl.hidden = true;
    emptyEl.hidden = false;
    listEl.hidden = true;
    emptyEl.querySelector('p').textContent = UyDosh.t('create.errorAuth', UyDosh.getLang());
    emptyEl.querySelector('a')?.remove();
    return;
  }

  try {
    const data = await UyDosh.fetchMyTelegramMiniAppListings();
    myListings = Array.isArray(data?.listings) ? data.listings : [];
    loadingEl.hidden = true;
    render(myListings);
  } catch (err) {
    console.error('Failed to load my listings', err);
    loadingEl.hidden = true;
    showLoadError();
  }
}

async function boot() {
  UyDosh.applyI18n();
  document.addEventListener('uydosh:langchange', () => {
    UyDosh.applyI18n();
    render(myListings);
  });
  await loadMyListings();
}

boot();
