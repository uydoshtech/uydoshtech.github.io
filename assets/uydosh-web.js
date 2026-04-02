// UyDosh Web — shared helpers for listings.html, listing.html, and the Telegram Mini App.
// GitHub Pages serves this as a plain static asset. Firebase Analytics loads on demand
// inside Telegram only (dynamic import — no bundler required).

// NOTE on API base URL:
// Default to the canonical HTTPS API host. Override via ?api=..., localStorage,
// or <meta name="uydosh-api-base"> when testing another environment.
const API_BASE = (() => {
  const isTelegramMiniAppPath = (() => {
    try {
      const path = location.pathname || '';
      return /\/telegram(\/|$)/i.test(path) || /\/telegram\.html$/i.test(path);
    } catch {
      return false;
    }
  })();

  // Mini App pages always hit production API (meta/default). A stale ?api= localStorage
  // override from browser testing breaks Telegram initData verification (401).
  if (isTelegramMiniAppPath) {
    try {
      const qs = new URLSearchParams(location.search);
      const api = qs.get('api');
      if (api && /^https?:\/\//i.test(api)) return api.replace(/\/$/, '');
    } catch { /* ignore */ }
    const meta = document.querySelector('meta[name="uydosh-api-base"]');
    if (meta && meta.content) return meta.content.replace(/\/$/, '');
    return 'https://api.uydosh.com';
  }

  // 1) Fast override via query param:
  //    /listings.html?api=https://xxxxx.trycloudflare.com
  //    Useful for quick testing before you have a real api.<domain>.
  try {
    const qs = new URLSearchParams(location.search);
    const api = qs.get('api');
    if (api && /^https?:\/\//i.test(api)) {
      const clean = api.replace(/\/$/, '');
      try { localStorage.setItem('uydosh_api_base', clean); } catch { /* ignore */ }
      return clean;
    }
  } catch { /* ignore */ }

  // 2) Sticky override from localStorage (set by ?api=... above).
  try {
    const saved = localStorage.getItem('uydosh_api_base');
    if (saved && /^https?:\/\//i.test(saved)) return saved.replace(/\/$/, '');
  } catch { /* storage blocked */ }

  // Allow overriding via <meta name="uydosh-api-base" content="https://..."> for
  // quick environment switching without editing this file.
  const meta = document.querySelector('meta[name="uydosh-api-base"]');
  if (meta && meta.content) return meta.content.replace(/\/$/, '');
  return 'https://api.uydosh.com';
})();

const LANGS = ['uz', 'ru', 'en'];
const MINI_APP_DEFAULT_LANG = 'ru';
const LANG_META = {
  uz: { flag: '🇺🇿', label: "O'zbekcha" },
  ru: { flag: '🇷🇺', label: 'Русский' },
  en: { flag: '🇬🇧', label: 'English' },
};
const LANG_SWITCHER_STYLE_ID = 'uydosh-lang-switcher-styles';

/** True on /telegram/, telegram.html redirect, or `?mini=1` listing pages. */
function isMiniAppPage() {
  try {
    if (new URLSearchParams(location.search).get('mini') === '1') return true;
  } catch { /* ignore */ }
  try {
    const path = location.pathname || '';
    if (/\/telegram\.html$/i.test(path)) return true;
    if (/\/telegram\/?$/i.test(path)) return true;
    if (/\/telegram\/index\.html$/i.test(path)) return true;
    if (/\/telegram\/create\.html$/i.test(path)) return true;
    if (/\/telegram\/create\/?$/i.test(path)) return true;
  } catch { /* ignore */ }
  return false;
}

function getLang() {
  try {
    const saved = localStorage.getItem('uydosh_lang');
    if (saved && LANGS.includes(saved)) return saved;
  } catch { /* storage blocked */ }
  try {
    const urlLang = new URLSearchParams(location.search).get('lang');
    if (urlLang && LANGS.includes(urlLang)) return urlLang;
  } catch { /* ignore */ }
  if (isMiniAppPage()) return MINI_APP_DEFAULT_LANG;
  const nav = (navigator.language || 'uz').slice(0, 2);
  return LANGS.includes(nav) ? nav : 'uz';
}

function setLang(lang) {
  if (!LANGS.includes(lang)) return;
  try { localStorage.setItem('uydosh_lang', lang); } catch { /* ignore */ }
  document.documentElement.lang = lang;
  document.dispatchEvent(new CustomEvent('uydosh:langchange', { detail: { lang } }));
}

function localized(obj, lang, fallback = '') {
  if (!obj) return fallback;
  // /locations returns a single localized `name`; listings embed `name_ru` etc.
  return (
    obj[`name_${lang}`] ||
    obj.name ||
    obj.name_uz ||
    obj.name_en ||
    obj.name_ru ||
    fallback
  );
}

function localizedShort(obj, lang, fallback = '') {
  if (!obj) return fallback;
  // /locations returns a single localized `short_name`; listings embed `short_name_ru` etc.
  return (
    obj[`short_name_${lang}`] ||
    obj.short_name ||
    obj[`name_${lang}`] ||
    obj.name ||
    obj.short_name_uz ||
    obj.short_name_en ||
    obj.short_name_ru ||
    obj.name_uz ||
    obj.name_en ||
    obj.name_ru ||
    fallback
  );
}

function listingTypeIdFromListing(listing) {
  return Number(listing?.listing_type_id ?? listing?.listing_type?.id) || 0;
}

function listingTypeCodeFromListing(listing) {
  const code = listing?.listing_type?.code ?? listing?.listing_type_code;
  return String(code || '').trim().toLowerCase();
}

function isRoommateNeededListing(listing) {
  return listingTypeIdFromListing(listing) === 2
    || listingTypeCodeFromListing(listing) === 'roommate_needed';
}

/** Card/detail badge label; roommate_needed is gendered (ru: «Нужен сосед» / «Нужна соседка»). */
function listingTypeBadgeLabel(listing, lang = getLang()) {
  if (!listing) return '';
  if (isRoommateNeededListing(listing)) {
    const gender = Number(listing.gender);
    return gender === 2
      ? t('card.type.roommateNeededFemale', lang)
      : t('card.type.roommateNeededMale', lang);
  }
  return localized(listing.listing_type, lang);
}

function localizedDescription(listing, lang) {
  if (!listing) return '';
  return (
    listing[`description_${lang}`] ||
    listing.description ||
    listing.description_uz ||
    listing.description_ru ||
    listing.description_en ||
    ''
  );
}

// Photo URLs in the DB can be either a full URL from an external source or a
// relative path like "/images/listings/foo.jpg" served by the API. Prepend
// API_BASE for relatives.
function photoUrl(photo) {
  const u = typeof photo === 'string' ? photo : photo?.photo_url;
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  return `${API_BASE}${u.startsWith('/') ? '' : '/'}${u}`;
}

function listingPhotos(listing) {
  return Array.isArray(listing?.photos) ? listing.photos : [];
}

function primaryPhoto(listing) {
  const photos = listingPhotos(listing);
  if (photos.length === 0) return null;
  const sorted = [...photos].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return (a.photo_order ?? 0) - (b.photo_order ?? 0);
  });
  return sorted[0];
}

/** Decorative pagination dots for feed cards when a listing has multiple photos. */
function cardPhotoDotsHtml(listing, { activeIndex = 0, maxDots = 5 } = {}) {
  const count = listingPhotos(listing).length;
  if (count <= 1) return '';
  const dotCount = Math.min(count, maxDots);
  const dots = Array.from({ length: dotCount }, (_, index) =>
    `<span class="card-photo-dot"${index === activeIndex ? ' aria-current="true"' : ''}></span>`,
  ).join('');
  return `<div class="card-photo-dots" aria-hidden="true">${dots}</div>`;
}

function formatPrice(listing, lang) {
  const n = Number(listing?.price);
  if (!Number.isFinite(n) || n <= 0) return '';
  const nf = new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'ru-RU');
  return `$${nf.format(n)}`;
}

function listingTypeUsesPriceRange(listingTypeCode) {
  const code = String(listingTypeCode ?? '').trim().toLowerCase();
  return code === 'room_needed' || code === 'group_forming';
}

function resolveMapPinDisplayPriceBounds(pin) {
  const stored = Number(pin?.price);
  const minPrice = Number(pin?.min_price);
  const maxPrice = Number(pin?.max_price);
  const listingTypeCode = pin?.listing_type_code;
  if (
    Number.isFinite(minPrice) &&
    Number.isFinite(maxPrice) &&
    minPrice > 0 &&
    maxPrice >= minPrice
  ) {
    return { min: minPrice, max: maxPrice };
  }
  if (!listingTypeUsesPriceRange(listingTypeCode)) {
    return { min: stored, max: stored };
  }
  const midpoint = Number.isFinite(stored) && stored > 0 ? stored : 0;
  if (midpoint <= 0) return { min: 0, max: 0 };
  const spread = Math.max(10, Math.round(midpoint * 0.2));
  return {
    min: Math.max(10, midpoint - spread),
    max: midpoint + spread,
  };
}

function formatMapPinPrice(pin, lang = getLang()) {
  const { min, max } = resolveMapPinDisplayPriceBounds(pin);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0) return '';
  const nf = new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'ru-RU');
  if (min === max) return `$${nf.format(min)}`;
  return `$${nf.format(min)}–$${nf.format(max)}`;
}

/** Strip locale-specific year suffixes (e.g. Russian « г. »). */
function stripLocaleYearSuffix(text) {
  return String(text)
    .replace(/\s+г\.?\s*$/u, '')
    .replace(/\s+y\.?\s*$/iu, '')
    .trim();
}

function formatPublicationDate(value, lang = getLang()) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const locale = lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'uz-UZ';
  const datePart = stripLocaleYearSuffix(d.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }));
  const timePart = d.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${datePart} • ${timePart}`;
}

/** Feed card publication date: "July 1, 2026" / "1 Июля 2026" / "1-iyul, 2026". */
function formatListingCardPublicationDate(value, lang = getLang()) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';

  if (lang === 'uz') {
    const months = [
      'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust',
      'sentabr', 'oktabr', 'noyabr', 'dekabr',
    ];
    return `${d.getDate()}-${months[d.getMonth()]}, ${d.getFullYear()}`;
  }

  if (lang === 'ru') {
    const text = stripLocaleYearSuffix(d.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }));
    const parts = text.split(' ');
    if (parts.length >= 2 && parts[1]) {
      parts[1] = `${parts[1].charAt(0).toUpperCase()}${parts[1].slice(1)}`;
    }
    return parts.join(' ');
  }

  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function mapPinBadgesHtml(pin) {
  const parts = [];
  const typeId = Number(pin?.listing_type_id);
  if (typeId > 0) {
    const icon = filterListingTypeIcon(typeId, { pressed: false });
    if (icon) parts.push(`<span class="map-pin-badge">${icon}</span>`);
  }
  const gender = Number(pin?.gender);
  if (gender > 0) {
    const icon = filterGenderIcon(gender, { pressed: false });
    if (icon) parts.push(`<span class="map-pin-badge">${icon}</span>`);
  }
  return parts.join('');
}

function listingPinCoordinateKey(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
  return `${lat.toFixed(6)}_${lon.toFixed(6)}`;
}

/** Group map pins that share the same resolved coordinates (mobile composite pins). */
function groupPinsByCoordinate(pins) {
  const groupsByKey = new Map();
  for (const pin of pins || []) {
    const key = listingPinCoordinateKey(pin.latitude, pin.longitude);
    if (!key) continue;
    let group = groupsByKey.get(key);
    if (!group) {
      group = {
        key,
        latitude: Number(pin.latitude),
        longitude: Number(pin.longitude),
        pins: [],
      };
      groupsByKey.set(key, group);
    }
    group.pins.push(pin);
  }
  return [...groupsByKey.values()];
}

function mapPinTooltipCardHtml(pin, { listing = null, lang = getLang(), showClose = false } = {}) {
  if (!pin) return '';
  const title = escapeHtml(pin.title || '');
  const price = formatMapPinPrice(pin, lang);
  const badges = mapPinBadgesHtml(pin);
  const photoSrc = pin.photo_url ? photoUrl(pin.photo_url) : '';
  const listingUrl = listingPageUrl(pin.id);
  const locName = listing ? localizedShort(listing.location, lang) : '';
  const metro = listing ? localized(listing.subway_station, lang) : '';
  const metroLine = listing ? resolveMetroLine(listing) : Number(pin.subway_line_id) || null;
  const posted = listing?.created_at ? formatPublicationDate(listing.created_at, lang) : '';

  const metaParts = [];
  if (locName) {
    metaParts.push(`<span>${iconPin()}${escapeHtml(locName)}</span>`);
  }
  if (metro) {
    metaParts.push(`<span class="dotsep">${iconMetro(metroLine)}${escapeHtml(metro)}</span>`);
  }
  if (posted) {
    metaParts.push(`<span class="map-pin-tooltip-date">${iconClock()}${escapeHtml(posted)}</span>`);
  }

  const badgesPriceRow = badges || price
    ? `<div class="map-pin-tooltip-badges-row">
        ${badges ? `<span class="map-pin-tooltip-badges">${badges}</span>` : ''}
        ${price ? `<span class="map-pin-tooltip-price">${price}</span>` : ''}
      </div>`
    : '';

  const thumb = photoSrc
    ? `<div class="map-pin-tooltip-photo"><img loading="lazy" decoding="async" src="${escapeHtml(photoSrc)}" alt="" onerror="this.parentElement.classList.add('empty'); this.remove();" /></div>`
    : `<div class="map-pin-tooltip-photo empty"></div>`;

  const closeBtn = showClose
    ? `<button type="button" class="map-pin-tooltip-close" data-map-tooltip-close aria-label="${escapeHtml(t('map.tooltip.close', lang))}">×</button>`
    : '';

  return `
    <div class="map-pin-tooltip-card" aria-label="${title}">
      ${closeBtn}
      <a class="map-pin-tooltip-link" href="${escapeHtml(listingUrl)}" data-map-tooltip-open data-listing-id="${Number(pin.id) || ''}">
        ${thumb}
        <div class="map-pin-tooltip-body">
          ${badgesPriceRow}
          <div class="map-pin-tooltip-title">${title}</div>
          ${metaParts.length ? `<div class="map-pin-tooltip-meta">${metaParts.join('')}</div>` : ''}
        </div>
      </a>
    </div>
  `;
}

function mapPinTooltipHtml(pin, { listing = null, lang = getLang() } = {}) {
  if (!pin) return '';
  return `
    <div class="map-pin-carousel map-pin-carousel--single" role="dialog">
      ${mapPinTooltipCardHtml(pin, { listing, lang, showClose: true })}
    </div>
  `;
}

function mapPinCarouselHtml(pins, { listingsById = null, lang = getLang(), activeIndex = 0 } = {}) {
  const items = Array.isArray(pins) ? pins.filter(Boolean) : [];
  if (items.length === 0) return '';
  const listings = listingsById && typeof listingsById === 'object' ? listingsById : {};
  const slides = items.map((pin, index) => `
    <div class="map-pin-carousel-slide" data-carousel-index="${index}" aria-hidden="${index === activeIndex ? 'false' : 'true'}">
      ${mapPinTooltipCardHtml(pin, { listing: listings[pin.id] ?? null, lang, showClose: true })}
    </div>
  `).join('');
  const dots = items.length > 1
    ? `<div class="map-pin-carousel-dots" role="tablist" aria-label="${escapeHtml(t('map.carousel.dots', lang))}">
        ${items.map((_, index) => `
          <span class="map-pin-carousel-dot" role="tab" aria-current="${index === activeIndex ? 'true' : 'false'}" data-carousel-dot="${index}"></span>
        `).join('')}
      </div>`
    : '';
  return `
    <div class="map-pin-carousel${items.length > 1 ? '' : ' map-pin-carousel--single'}" role="dialog">
      <div class="map-pin-carousel-track" data-map-carousel-track tabindex="0">
        ${slides}
      </div>
      ${dots}
    </div>
  `;
}

function isFeatured(listing) {
  // Server sets featured_at to null when window expired, so this is enough.
  return Boolean(listing?.featured_at);
}

async function fetchJson(path, params) {
  const url = new URL(`${API_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

const SESSION_STORAGE_KEY = 'uydosh_session_token';
const TG_INIT_DATA_KEY = 'uydosh_tg_init_data';
const TG_INIT_DATA_MAX_AGE_SEC = 86400;

function readPersistedTelegramInitData() {
  try {
    return String(sessionStorage.getItem(TG_INIT_DATA_KEY) ?? '').trim();
  } catch {
    return '';
  }
}

function persistTelegramInitData(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return;
  try {
    sessionStorage.setItem(TG_INIT_DATA_KEY, value);
  } catch { /* ignore */ }
}

function clearPersistedTelegramInitData() {
  try {
    sessionStorage.removeItem(TG_INIT_DATA_KEY);
  } catch { /* ignore */ }
}

/** Parse auth_date from initData; returns null when hash/auth_date are missing. */
function parseTelegramInitDataAuthDate(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  try {
    const params = new URLSearchParams(value);
    if (!params.get('hash')?.trim()) return null;
    const authDate = Number(params.get('auth_date'));
    if (!Number.isFinite(authDate) || authDate <= 0) return null;
    return authDate;
  } catch {
    return null;
  }
}

/** Client-side freshness check (matches backend maxAgeSec). */
function isTelegramInitDataUsable(raw, { nowSec = Math.floor(Date.now() / 1000) } = {}) {
  const value = String(raw ?? '').trim();
  if (!value || value.length < 20) return false;
  const authDate = parseTelegramInitDataAuthDate(value);
  if (authDate == null) return false;
  return nowSec - authDate <= TG_INIT_DATA_MAX_AGE_SEC;
}

/** initData from Telegram WebApp, persisted for multi-page in-app navigation. */
function getTelegramInitData() {
  const fresh = String(window.Telegram?.WebApp?.initData ?? '').trim();
  const cached = readPersistedTelegramInitData();
  const freshOk = isTelegramInitDataUsable(fresh);
  const cachedOk = isTelegramInitDataUsable(cached);

  if (freshOk) {
    persistTelegramInitData(fresh);
    return fresh;
  }
  if (cachedOk) return cached;
  if (cached && !cachedOk) clearPersistedTelegramInitData();
  return '';
}

function clearTelegramInitData() {
  clearPersistedTelegramInitData();
}

function getSessionToken() {
  try {
    return sessionStorage.getItem(SESSION_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function setSessionToken(token) {
  try {
    if (token) sessionStorage.setItem(SESSION_STORAGE_KEY, token);
    else sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch { /* ignore */ }
}

async function fetchJsonAuth(path, { method = 'GET', body, params } = {}) {
  const token = getSessionToken();
  if (!token) {
    const err = new Error('Not authenticated');
    err.status = 401;
    throw err;
  }
  const url = new URL(`${API_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };
  const init = { method, headers };
  if (body != null) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url.toString(), init);
  let payload = null;
  try {
    payload = await res.json();
  } catch { /* ignore */ }
  if (!res.ok) {
    const err = new Error(payload?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  return payload;
}

/** Authenticate via Telegram Mini App initData; stores session token on success. */
async function authenticateTelegramMiniApp() {
  const initData = getTelegramInitData();
  if (!initData) {
    const err = new Error('Telegram initData missing');
    err.status = 401;
    throw err;
  }
  const res = await fetch(`${API_BASE}/users/telegram-webapp-auth`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ init_data: initData }),
  });
  let payload = null;
  try {
    payload = await res.json();
  } catch { /* ignore */ }
  if (!res.ok) {
    if (res.status === 401) clearTelegramInitData();
    const err = new Error(payload?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  if (payload?.sessionToken) setSessionToken(payload.sessionToken);
  return payload;
}

function fetchSubwayStationsByLine(lineId, lang = getLang()) {
  return fetchJson(`/subway-stations/line/${encodeURIComponent(lineId)}`, { language: lang });
}

function fetchLocations({ page = 1, limit = 200, language = getLang() } = {}) {
  return fetchJson('/locations', { page, limit, language });
}

function fetchAmenitiesOrdered() {
  return fetchJson('/amenities/ordered');
}

function createListing(body) {
  return fetchJsonAuth('/listings', { method: 'POST', body });
}

/** Create a listing from the Telegram Mini App (verify initData on submit). */
async function createListingFromTelegramMiniApp(listing) {
  const initData = getTelegramInitData();
  if (!initData) {
    const err = new Error('Telegram initData missing');
    err.status = 401;
    throw err;
  }
  const res = await fetch(`${API_BASE}/listings/telegram-miniapp`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ init_data: initData, listing }),
  });
  let payload = null;
  try {
    payload = await res.json();
  } catch { /* ignore */ }
  if (!res.ok) {
    if (res.status === 401) clearTelegramInitData();
    const err = new Error(payload?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  if (payload?.sessionToken) setSessionToken(payload.sessionToken);
  return payload;
}

function createProfile(body) {
  return fetchJsonAuth('/profiles', { method: 'POST', body });
}

function uploadListingPhoto(listingId, imageData, { isPrimary = false } = {}) {
  return fetchJsonAuth(`/listings/${encodeURIComponent(listingId)}/photos`, {
    method: 'POST',
    body: { imageData, isPrimary },
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Loads an image file into a bitmap, respecting EXIF orientation where the
 * browser supports it (createImageBitmap with imageOrientation), falling
 * back to a plain <img> element otherwise.
 */
async function loadImageSource(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // fall through to <img> based loading below
    }
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Resizes/compresses a picked photo before it is base64-encoded for upload.
 * Full-resolution phone camera photos (often 3-8MB) blow past the backend's
 * 2MB JSON body limit once base64-encoded (~33% overhead) — this keeps the
 * mini app's uploads working the same way the native app's photo cropper
 * does (downscale + re-encode as JPEG).
 */
async function resizeImageFileForUpload(file, {
  maxDimension = 1600,
  quality = 0.85,
  minQuality = 0.5,
  targetBytes = 1.4 * 1024 * 1024,
} = {}) {
  const source = await loadImageSource(file);
  const sourceWidth = source.width || source.naturalWidth;
  const sourceHeight = source.height || source.naturalHeight;
  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if (typeof source.close === 'function') source.close();

  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  let currentQuality = quality;
  while (dataUrl.length > targetBytes * 1.37 && currentQuality > minQuality) {
    currentQuality = Math.max(minQuality, currentQuality - 0.15);
    dataUrl = canvas.toDataURL('image/jpeg', currentQuality);
  }
  return dataUrl;
}

const MINI_APP_CREATE_PATH = '/telegram/create.html';

function fetchListings({ page = 1, limit = 20, listingTypeId, gender, withPhoto, subwayLineId } = {}) {
  const params = { page, limit, isActive: 'true' };
  if (listingTypeId) params.listingTypeId = listingTypeId;
  if (gender) params.gender = gender;
  if (withPhoto != null) params.withPhoto = String(withPhoto);
  if (subwayLineId) params.subwayLineId = subwayLineId;
  return fetchJson('/listings', params);
}

function fetchListing(id) {
  return fetchJson(`/listings/${encodeURIComponent(id)}`);
}

function fetchListingsForMap({ page = 1, limit = 300, listingTypeId, gender, withPhoto, subwayLineId } = {}) {
  const params = { page, limit, isActive: 'true' };
  if (listingTypeId) params.listingTypeId = listingTypeId;
  if (gender) params.gender = gender;
  if (withPhoto != null) params.withPhoto = String(withPhoto);
  if (subwayLineId) params.subwayLineId = subwayLineId;
  return fetchJson('/listings/map', params);
}

const YANDEX_MAP_MODULE_PATH = '/assets/yandex-map.js';
let yandexMapModulePromise = null;

function resetYandexMaps({ hard = false } = {}) {
  yandexMapModulePromise = null;
  if (window.UyDoshMap?.resetYandexMapsLoader) {
    window.UyDoshMap.resetYandexMapsLoader();
  }
  if (!hard) return;
  for (const el of document.querySelectorAll('script[src*="yandex-map.js"]')) {
    el.remove();
  }
  try {
    delete window.UyDoshMap;
  } catch {
    window.UyDoshMap = undefined;
  }
}

function reflowActiveMaps() {
  if (!window.UyDoshMap?.reflowAllMaps) return;
  requestAnimationFrame(() => {
    window.UyDoshMap.reflowAllMaps();
    requestAnimationFrame(() => window.UyDoshMap.reflowAllMaps());
  });
}

function withTimeout(promise, ms, message = 'Timed out') {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function waitForElementLayout(el, { maxFrames = 24 } = {}) {
  if (!el) return;
  for (let i = 0; i < maxFrames; i += 1) {
    if (el.offsetWidth > 0 && el.offsetHeight > 0) return;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

/** Lazy-load /assets/yandex-map.js (Yandex Maps JS API helpers). */
function loadYandexMapModule() {
  if (window.UyDoshMap) return Promise.resolve(window.UyDoshMap);
  if (yandexMapModulePromise) return yandexMapModulePromise;
  yandexMapModulePromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${YANDEX_MAP_MODULE_PATH}?v=20260703-61`;
    script.async = true;
    script.onload = () => {
      if (window.UyDoshMap) resolve(window.UyDoshMap);
      else {
        yandexMapModulePromise = null;
        reject(new Error('UyDoshMap module missing'));
      }
    };
    script.onerror = () => {
      yandexMapModulePromise = null;
      reject(new Error('Failed to load UyDoshMap module'));
    };
    document.head.appendChild(script);
  });
  return yandexMapModulePromise;
}

const I18N = {
  uz: {
    'brand.tagline': 'Keling Birga Yashaymiz!',
    'nav.listings': 'E’lonlar',
    'nav.home': 'Asosiy',
    'nav.privacy': 'Maxfiylik',
    'nav.terms': 'Foydalanish shartlari',
    'nav.delete': 'Akkauntni o‘chirish',
    'nav.contact': 'Aloqa',
    'feed.title': 'Yangi e’lonlar',
    'feed.subtitle': 'Haqiqiy uy-joy va xonadoshlar — eng yangisi yuqorida.',
    'feed.loading': 'Yuklanmoqda…',
    'feed.empty': 'Hozircha e’lonlar yo‘q.',
    'feed.error': 'Ma’lumotlarni yuklab bo‘lmadi. Keyinroq qayta urinib ko‘ring.',
    'feed.retry': 'Qayta urinish',
    'feed.end': 'Hammasi shu. Yangilari uchun ilovamizni oching.',
    'feed.scrollToTop': 'Yuqoriga',
    'card.featured': 'Yuqoriga chiqarilgan',
    'card.privateRoom': 'Alohida xona',
    'card.rooms': 'xona',
    'card.perMonth': '/oy',
    'card.type.roommateNeededMale': 'Hamkor kerak',
    'card.type.roommateNeededFemale': 'Ayol hamkor kerak',
    'card.genderBadge.male': 'Yigit',
    'card.genderBadge.female': 'Qiz',
    'detail.back': '← E’lonlar',
    'detail.loading': 'Yuklanmoqda…',
    'detail.notFound': 'E’lon topilmadi yoki olib tashlangan.',
    'detail.description': 'Tavsif',
    'detail.amenities': 'Qulayliklar',
    'detail.openInApp': 'Ilovada ochish',
    'detail.downloadApk': 'APK yuklab olish',
    'detail.posted': 'Joylangan',
    'detail.moveIn': 'Ko‘chib o‘tish',
    'detail.type': 'Turi',
    'detail.location': 'Joylashuv',
    'detail.metro': 'Metro',
    'detail.map': 'Xarita',
    'detail.showMap': 'Xaritani ko‘rsatish',
    'detail.hideMap': 'Xaritani yashirish',
    'detail.openMapView': 'Xaritani ochish',
    'detail.mapUnavailable': 'Xarita uchun joylashuv aniqlanmadi.',
    'detail.mapLoadError': 'Xaritani yuklab bo‘lmadi.',
    'detail.gallery.dots': 'Rasmlar',
    'detail.gallery.photo': 'Rasm',
    'detail.contactTelegram': 'Telegram orqali bog‘lanish',
    'view.list': 'Ro‘yxat',
    'view.map': 'Xarita',
    'map.loading': 'Xarita yuklanmoqda…',
    'map.empty': 'Tanlangan filtrlarda xaritada ko‘rsatish uchun e’lon yo‘q.',
    'map.error': 'Xaritani yuklab bo‘lmadi.',
    'map.retry': 'Qayta urinish',
    'map.themeToggleLight': 'Yorug‘ mavzuga o‘tish',
    'map.themeToggleDark': 'Tungi mavzuga o‘tish',
    'map.tooltip.close': 'Yopish',
    'map.carousel.dots': 'E’lonlar',
    'cta.openListings': 'E’lonlarni ko‘rish',
    'filter.type.all': 'Hammasi',
    'filter.type.roomNeeded': 'Xona qidiryapman',
    'filter.type.roommateNeeded': 'Xonadosh qidiramiz',
    'filter.type.groupForming': 'Guruh yigamiz',
    'filter.type.aria': 'E’lon turi',
    'filter.type.label': 'Tur:',
    'filter.gender.label': 'Jins:',
    'filter.gender.any': 'Hammasi',
    'filter.gender.male': 'Erkak',
    'filter.gender.female': 'Ayol',
    'filter.gender.aria': 'Jins bo‘yicha filtr',
    'filter.photo.label': 'Surat:',
    'filter.photo.withPhoto': 'Suratli',
    'filter.photo.aria': 'Suratli e’lonlar',
    'filter.line.aria': 'Metro liniyasi',
    'filter.collapse.aria': 'Filtrlarni yig‘ish',
    'filter.expand.aria': 'Filtrlarni ochish',
    'create.title': 'E’lon joylash',
    'create.step.typeLocation': 'Tur va joy',
    'create.step.details': 'Tafsilotlar',
    'create.step.description': 'Matn va surat',
    'create.step.review': 'Tekshirish',
    'create.stepCounter': '{current} / {total}',
    'create.listingType': 'E’lon turi',
    'create.locationMode': 'Qidiruv hududi',
    'create.locationMetro': 'Metro',
    'create.locationDistrict': 'Tuman',
    'create.metroLine': 'Metro liniyasi',
    'create.metroStation': 'Bekat',
    'create.metroStations': 'Bekatlar',
    'create.district': 'Tuman',
    'create.districts': 'Tumanlar',
    'create.price': 'Narx',
    'create.priceRange': 'Byudjet',
    'create.gender': 'Kim uchun',
    'create.amenities': 'Qulayliklar',
    'create.moveInDate': 'Ko‘chib o‘tish',
    'create.moveInAny': 'Istalgan sana',
    'create.privateRoom': 'Alohida xona',
    'create.titleLabel': 'Sarlavha',
    'create.titlePlaceholder': 'Masalan: Yunusobod yaqinida xona',
    'create.descriptionLabel': 'Tavsif',
    'create.descriptionPlaceholder': 'Uy, qoidalar, qo‘shimcha shartlar…',
    'create.photos': 'Suratlar',
    'create.addPhoto': 'Surat qo‘shish',
    'create.next': 'Keyingi',
    'create.back': 'Orqaga',
    'create.publish': 'Joylash',
    'create.publishing': 'Joylanmoqda…',
    'create.success': 'E’lon yuborildi!',
    'create.successHint': 'Moderatsiyadan so‘ng e’lonlar ro‘yxatida paydo bo‘ladi.',
    'create.successPhotoWarning': 'Ba’zi suratlarni yuklab bo‘lmadi. Ularni e’lon sahifasidan qo‘shishga urinib ko‘ring.',
    'create.viewListing': 'E’longa o‘tish',
    'create.backToFeed': 'E’lonlarga qaytish',
    'create.errorAuth': 'Telegram orqali kirish amalga oshmadi. Mini ilovani qayta oching.',
    'create.errorGeneric': 'E’lonni joylab bo‘lmadi. Qayta urinib ko‘ring.',
    'create.errorPhotoProcess': 'Suratni qayta ishlab bo‘lmadi. Boshqa surat tanlang.',
    'create.errorTitleRequired': 'Sarlavha majburiy',
    'create.errorTitleTooLong': 'Sarlavha juda uzun (maks. 50 belgi)',
    'create.errorDescriptionRequired': 'Tavsif majburiy',
    'create.errorDescriptionTooLong': 'Tavsif juda uzun (maks. 1000 belgi)',
    'create.errorLocationRequired': 'Joylashuvni tanlang',
    'create.errorPriceRequired': 'Narxni ko‘rsating',
    'create.errorGenderRequired': 'Jinsni tanlang',
    'create.reviewType': 'Tur',
    'create.reviewLocation': 'Joy',
    'create.reviewPrice': 'Narx',
    'create.reviewGender': 'Jins',
    'create.reviewAmenities': 'Qulayliklar',
    'create.reviewMoveIn': 'Ko‘chib o‘tish',
    'create.reviewPrivateRoom': 'Alohida xona',
    'create.reviewYes': 'Ha',
    'create.reviewNo': 'Yo‘q',
    'create.reviewNotSet': 'Ko‘rsatilmagan',
    'create.perMonth': '/oy',
    'create.postListing': 'E’lon joylash',
    'create.priceMin': 'Min',
    'create.priceMax': 'Maks',
    'create.descriptionTemplateLabel': 'Shablon',
    'create.descriptionTemplate.roomNeeded': 'Xona/qo‘shilish qidiryapman.\nFormat: (alohida/qo‘shilish).\nMuddat: (kirish sanasi + qancha).\nMuhim: (tinchlik/mehmon/uy hayvoni).',
    'create.descriptionTemplate.roommateNeededMale': 'Qo‘shni yigit qidiryapman.\nFormat: (xonada 1–2).\nKim yashaydi: (necha kishi).\nSharoit: (xo‘jayinsiz/xo‘jayinli), (alohida/umumiy xona).\nMuddat: (kirish) + (qancha).',
    'create.descriptionTemplate.roommateNeededFemale': 'Qo‘shni qiz qidiryapman.\nFormat: (xonada 1–2).\nKim yashaydi: (necha kishi).\nSharoit: (xo‘jayinsiz/xo‘jayinli), (alohida/umumiy xona).\nMuddat: (kirish) + (qancha).',
    'create.descriptionTemplate.groupForming': 'Guruh bo‘lib ijara olish uchun odam yig‘yapmiz.\nKim kerak: (1–2 kishi, jins/yosh).\nHar kishi budjeti: (summa).\nHudud/metro: (qayerdan qidiramiz).\nFormat: (alohida/umumiy xonalar).\nKirish: (sana + muddat).\nMuhim: (tozalik/tinchlik/mehmon/uy hayvoni).',
    'create.presetTitle.maleRoommate': '#YigitXonadoshQidiramiz',
    'create.presetTitle.femaleRoommate': '#QizXonadoshQidiramiz',
    'create.presetTitle.maleRoom': '#YigitXonadonQidiramiz',
    'create.presetTitle.femaleRoom': '#QizXonadonQidiramiz',
    'create.presetTitle.groupForming': 'Guruh Yigamiz',
  },
  ru: {
    'brand.tagline': 'Давайте Жить Вместе!',
    'nav.listings': 'Объявления',
    'nav.home': 'Главная',
    'nav.privacy': 'Конфиденциальность',
    'nav.terms': 'Условия',
    'nav.delete': 'Удалить аккаунт',
    'nav.contact': 'Контакты',
    'feed.title': 'Свежие объявления',
    'feed.subtitle': 'Реальное жильё и соседи — самые новые сверху.',
    'feed.loading': 'Загрузка…',
    'feed.empty': 'Пока нет объявлений.',
    'feed.error': 'Не удалось загрузить данные. Попробуйте позже.',
    'feed.retry': 'Попробовать ещё раз',
    'feed.end': 'Это всё. За новыми — в приложение.',
    'feed.scrollToTop': 'Наверх',
    'card.featured': 'В топе',
    'card.privateRoom': 'Отдельная комната',
    'card.rooms': 'комн.',
    'card.perMonth': '/мес',
    'card.type.roommateNeededMale': 'Нужен сосед',
    'card.type.roommateNeededFemale': 'Нужна соседка',
    'card.genderBadge.male': 'Парня',
    'card.genderBadge.female': 'Девушка',
    'detail.back': '← Объявления',
    'detail.loading': 'Загрузка…',
    'detail.notFound': 'Объявление не найдено или удалено.',
    'detail.description': 'Описание',
    'detail.amenities': 'Удобства',
    'detail.openInApp': 'Открыть в приложении',
    'detail.downloadApk': 'Скачать APK',
    'detail.posted': 'Опубликовано',
    'detail.moveIn': 'Заселение',
    'detail.type': 'Тип',
    'detail.location': 'Район',
    'detail.metro': 'Метро',
    'detail.map': 'Карта',
    'detail.showMap': 'Показать карту',
    'detail.hideMap': 'Скрыть карту',
    'detail.openMapView': 'Открыть карту',
    'detail.mapUnavailable': 'Не удалось определить местоположение для карты.',
    'detail.mapLoadError': 'Не удалось загрузить карту.',
    'detail.gallery.dots': 'Фото',
    'detail.gallery.photo': 'Фото',
    'detail.contactTelegram': 'Связаться в Telegram',
    'view.list': 'Список',
    'view.map': 'Карта',
    'map.loading': 'Загрузка карты…',
    'map.empty': 'Нет объявлений для карты с выбранными фильтрами.',
    'map.error': 'Не удалось загрузить карту.',
    'map.retry': 'Попробовать ещё раз',
    'map.themeToggleLight': 'Включить светлую тему',
    'map.themeToggleDark': 'Включить тёмную тему',
    'map.tooltip.close': 'Закрыть',
    'map.carousel.dots': 'Объявления',
    'cta.openListings': 'Смотреть объявления',
    'filter.type.all': 'Все',
    'filter.type.roomNeeded': 'Ищу комнату',
    'filter.type.roommateNeeded': 'Ищем соседа',
    'filter.type.groupForming': 'Собираем группу',
    'filter.type.aria': 'Тип объявления',
    'filter.type.label': 'Тип:',
    'filter.gender.label': 'Пол:',
    'filter.gender.any': 'Любой',
    'filter.gender.male': 'М',
    'filter.gender.female': 'Ж',
    'filter.gender.aria': 'Фильтр по полу',
    'filter.photo.label': 'Фото:',
    'filter.photo.withPhoto': 'С фото',
    'filter.photo.aria': 'Только с фото',
    'filter.line.aria': 'Линия метро',
    'filter.collapse.aria': 'Свернуть фильтры',
    'filter.expand.aria': 'Развернуть фильтры',
    'create.title': 'Разместить объявление',
    'create.step.typeLocation': 'Тип и место',
    'create.step.details': 'Детали',
    'create.step.description': 'Текст и фото',
    'create.step.review': 'Проверка',
    'create.stepCounter': '{current} / {total}',
    'create.listingType': 'Тип объявления',
    'create.locationMode': 'Зона поиска',
    'create.locationMetro': 'Метро',
    'create.locationDistrict': 'Район',
    'create.metroLine': 'Линия метро',
    'create.metroStation': 'Станция',
    'create.metroStations': 'Станции',
    'create.district': 'Район',
    'create.districts': 'Районы',
    'create.price': 'Цена',
    'create.priceRange': 'Бюджет',
    'create.gender': 'Для кого',
    'create.amenities': 'Удобства',
    'create.moveInDate': 'Заселение',
    'create.moveInAny': 'Любая дата',
    'create.privateRoom': 'Отдельная комната',
    'create.titleLabel': 'Заголовок',
    'create.titlePlaceholder': 'Например: Комната у метро Юнусабад',
    'create.descriptionLabel': 'Описание',
    'create.descriptionPlaceholder': 'О квартире, правилах, условиях…',
    'create.photos': 'Фото',
    'create.addPhoto': 'Добавить фото',
    'create.next': 'Далее',
    'create.back': 'Назад',
    'create.publish': 'Опубликовать',
    'create.publishing': 'Публикация…',
    'create.success': 'Объявление отправлено!',
    'create.successHint': 'После модерации оно появится в ленте.',
    'create.successPhotoWarning': 'Не удалось загрузить некоторые фото. Попробуйте добавить их со страницы объявления.',
    'create.viewListing': 'Открыть объявление',
    'create.backToFeed': 'К объявлениям',
    'create.errorAuth': 'Не удалось войти через Telegram. Откройте мини-приложение заново.',
    'create.errorGeneric': 'Не удалось опубликовать. Попробуйте ещё раз.',
    'create.errorPhotoProcess': 'Не удалось обработать фото. Выберите другое изображение.',
    'create.errorTitleRequired': 'Укажите заголовок',
    'create.errorTitleTooLong': 'Заголовок слишком длинный (макс. 50 символов)',
    'create.errorDescriptionRequired': 'Укажите описание',
    'create.errorDescriptionTooLong': 'Описание слишком длинное (макс. 1000 символов)',
    'create.errorLocationRequired': 'Выберите местоположение',
    'create.errorPriceRequired': 'Укажите цену',
    'create.errorGenderRequired': 'Выберите пол',
    'create.reviewType': 'Тип',
    'create.reviewLocation': 'Место',
    'create.reviewPrice': 'Цена',
    'create.reviewGender': 'Пол',
    'create.reviewAmenities': 'Удобства',
    'create.reviewMoveIn': 'Заселение',
    'create.reviewPrivateRoom': 'Отдельная комната',
    'create.reviewYes': 'Да',
    'create.reviewNo': 'Нет',
    'create.reviewNotSet': 'Не указано',
    'create.perMonth': '/мес',
    'create.postListing': 'Разместить',
    'create.priceMin': 'Мин',
    'create.priceMax': 'Макс',
    'create.descriptionTemplateLabel': 'Шаблон',
    'create.descriptionTemplate.roomNeeded': 'Ищу комнату/подселение.\nФормат: (отдельная/подселение).\nСрок: (заезд + на сколько).\nВажно: (тихо/гости/животные).',
    'create.descriptionTemplate.roommateNeededMale': 'Ищу соседа.\nФормат: (1–2 в комнате).\nКто уже живёт: (сколько человек).\nУсловия: (с хозяйкой/без), (отдельная/общая комната).\nСрок: (заезд) + (на сколько).',
    'create.descriptionTemplate.roommateNeededFemale': 'Ищу соседку.\nФормат: (1–2 в комнате).\nКто уже живёт: (сколько человек).\nУсловия: (с хозяйкой/без), (отдельная/общая комната).\nСрок: (заезд) + (на сколько).',
    'create.descriptionTemplate.groupForming': 'Собираем группу для совместной аренды.\nКого ищем: (1–2 человека, пол/возраст).\nБюджет на человека: (сумма).\nРайон/метро: (где ищем).\nФормат: (отдельные/общие комнаты).\nЗаезд: (дата + срок).\nВажно: (чистота/тишина/гости/животные).',
    'create.presetTitle.maleRoommate': '#ИщемСоседа',
    'create.presetTitle.femaleRoommate': '#ИщемСоседку',
    'create.presetTitle.maleRoom': '#ИщуКомнату',
    'create.presetTitle.femaleRoom': '#ИщуКомнату',
    'create.presetTitle.groupForming': 'Собираем Группу',
  },
  en: {
    'brand.tagline': "Let's Live Together!",
    'nav.listings': 'Listings',
    'nav.home': 'Home',
    'nav.privacy': 'Privacy',
    'nav.terms': 'Terms',
    'nav.delete': 'Delete account',
    'nav.contact': 'Contact',
    'feed.title': 'Fresh listings',
    'feed.subtitle': 'Real rentals and roommates — newest first.',
    'feed.loading': 'Loading…',
    'feed.empty': 'No listings yet.',
    'feed.error': 'Could not load listings. Please try again later.',
    'feed.retry': 'Try again',
    'feed.end': 'That’s everything. Get the app for alerts on new ones.',
    'feed.scrollToTop': 'Scroll to top',
    'card.featured': 'Featured',
    'card.privateRoom': 'Private room',
    'card.rooms': 'rooms',
    'card.perMonth': '/mo',
    'card.type.roommateNeededMale': 'Roommate needed',
    'card.type.roommateNeededFemale': 'Female roommate needed',
    'card.genderBadge.male': 'Guy',
    'card.genderBadge.female': 'Girl',
    'detail.back': '← Listings',
    'detail.loading': 'Loading…',
    'detail.notFound': 'Listing not found or removed.',
    'detail.description': 'Description',
    'detail.amenities': 'Amenities',
    'detail.openInApp': 'Open in app',
    'detail.downloadApk': 'Download APK',
    'detail.posted': 'Posted',
    'detail.moveIn': 'Move-in',
    'detail.type': 'Type',
    'detail.location': 'Area',
    'detail.metro': 'Metro',
    'detail.map': 'Map',
    'detail.showMap': 'Show map',
    'detail.hideMap': 'Hide map',
    'detail.openMapView': 'Open map view',
    'detail.mapUnavailable': 'Could not determine a map location.',
    'detail.mapLoadError': 'Could not load the map.',
    'detail.gallery.dots': 'Photos',
    'detail.gallery.photo': 'Photo',
    'detail.contactTelegram': 'Contact on Telegram',
    'view.list': 'List',
    'view.map': 'Map',
    'map.loading': 'Loading map…',
    'map.empty': 'No listings to show on the map for these filters.',
    'map.error': 'Could not load the map.',
    'map.retry': 'Try again',
    'map.themeToggleLight': 'Switch to light theme',
    'map.themeToggleDark': 'Switch to dark theme',
    'map.tooltip.close': 'Close',
    'map.carousel.dots': 'Listings',
    'cta.openListings': 'Browse listings',
    'filter.type.all': 'All',
    'filter.type.roomNeeded': 'Need room',
    'filter.type.roommateNeeded': 'Need roommate',
    'filter.type.groupForming': 'Forming group',
    'filter.type.aria': 'Listing type',
    'filter.type.label': 'Type:',
    'filter.gender.label': 'Gender:',
    'filter.gender.any': 'Any',
    'filter.gender.male': 'M',
    'filter.gender.female': 'F',
    'filter.gender.aria': 'Gender filter',
    'filter.photo.label': 'Photo:',
    'filter.photo.withPhoto': 'Photos',
    'filter.photo.aria': 'Listings with photos',
    'filter.line.aria': 'Metro line',
    'filter.collapse.aria': 'Collapse filters',
    'filter.expand.aria': 'Expand filters',
    'create.title': 'Post a listing',
    'create.step.typeLocation': 'Type & area',
    'create.step.details': 'Details',
    'create.step.description': 'Text & photos',
    'create.step.review': 'Review',
    'create.stepCounter': '{current} / {total}',
    'create.listingType': 'Listing type',
    'create.locationMode': 'Search area',
    'create.locationMetro': 'Metro',
    'create.locationDistrict': 'District',
    'create.metroLine': 'Metro line',
    'create.metroStation': 'Station',
    'create.metroStations': 'Stations',
    'create.district': 'District',
    'create.districts': 'Districts',
    'create.price': 'Price',
    'create.priceRange': 'Budget',
    'create.gender': 'For',
    'create.amenities': 'Amenities',
    'create.moveInDate': 'Move-in',
    'create.moveInAny': 'Any date',
    'create.privateRoom': 'Private room',
    'create.titleLabel': 'Title',
    'create.titlePlaceholder': 'e.g. Room near Yunusabad metro',
    'create.descriptionLabel': 'Description',
    'create.descriptionPlaceholder': 'About the home, rules, conditions…',
    'create.photos': 'Photos',
    'create.addPhoto': 'Add photo',
    'create.next': 'Next',
    'create.back': 'Back',
    'create.publish': 'Publish',
    'create.publishing': 'Publishing…',
    'create.success': 'Listing submitted!',
    'create.successHint': 'It will appear in the feed after moderation.',
    'create.successPhotoWarning': 'Some photos could not be uploaded. Try adding them from the listing page.',
    'create.viewListing': 'View listing',
    'create.backToFeed': 'Back to feed',
    'create.errorAuth': 'Telegram sign-in failed. Reopen the mini app.',
    'create.errorGeneric': 'Could not publish. Please try again.',
    'create.errorPhotoProcess': 'Could not process the photo. Choose another image.',
    'create.errorTitleRequired': 'Title is required',
    'create.errorTitleTooLong': 'Title is too long (max 50 characters)',
    'create.errorDescriptionRequired': 'Description is required',
    'create.errorDescriptionTooLong': 'Description is too long (max 1000 characters)',
    'create.errorLocationRequired': 'Select a location',
    'create.errorPriceRequired': 'Set a price',
    'create.errorGenderRequired': 'Select gender',
    'create.reviewType': 'Type',
    'create.reviewLocation': 'Location',
    'create.reviewPrice': 'Price',
    'create.reviewGender': 'Gender',
    'create.reviewAmenities': 'Amenities',
    'create.reviewMoveIn': 'Move-in',
    'create.reviewPrivateRoom': 'Private room',
    'create.reviewYes': 'Yes',
    'create.reviewNo': 'No',
    'create.reviewNotSet': 'Not set',
    'create.perMonth': '/mo',
    'create.postListing': 'Post listing',
    'create.priceMin': 'Min',
    'create.priceMax': 'Max',
    'create.descriptionTemplateLabel': 'Template',
    'create.descriptionTemplate.roomNeeded': 'Looking for a room/flatshare.\nFormat: (private/shared).\nTimeline: (move-in + duration).\nMust-haves: (quiet/guests/pets).',
    'create.descriptionTemplate.roommateNeededMale': 'Looking for a male roommate.\nFormat: (1–2 per room).\nWho lives there: (how many people).\nConditions: (with/without landlord), (private/shared room).\nTimeline: (move-in + duration).',
    'create.descriptionTemplate.roommateNeededFemale': 'Looking for a female roommate.\nFormat: (1–2 per room).\nWho lives there: (how many people).\nConditions: (with/without landlord), (private/shared room).\nTimeline: (move-in + duration).',
    'create.descriptionTemplate.groupForming': 'Forming a group to rent together.\nLooking for: (1–2 people, gender/age).\nBudget per person: (amount).\nArea/metro: (where to search).\nFormat: (private/shared rooms).\nMove-in: (date + duration).\nImportant: (cleanliness/quiet/guests/pets).',
    'create.presetTitle.maleRoommate': '#NeedRoommate',
    'create.presetTitle.femaleRoommate': '#NeedRoommate',
    'create.presetTitle.maleRoom': '#NeedRoom',
    'create.presetTitle.femaleRoom': '#NeedRoom',
    'create.presetTitle.groupForming': 'Forming Group',
  },
};

function t(key, lang = getLang()) {
  return I18N[lang]?.[key] ?? I18N.uz[key] ?? key;
}

function ensureLangSwitcherStyles() {
  if (document.getElementById(LANG_SWITCHER_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = LANG_SWITCHER_STYLE_ID;
  style.textContent = `
    .lang.lang-dropdown {
      position: relative;
      display: inline-flex;
      padding: 4px;
      gap: 0;
      border-radius: 999px;
      border: 1px solid var(--stroke, rgba(127, 127, 127, 0.35));
      background: rgba(127, 127, 127, 0.08);
      flex-shrink: 0;
    }
    .lang.lang-dropdown > .lang-trigger {
      appearance: none;
      border: 0;
      background: transparent;
      color: var(--muted, rgba(255, 255, 255, 0.7));
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 9px 6px 8px;
      border-radius: 999px;
      font: inherit;
      font-weight: 700;
      line-height: 1;
    }
    .lang.lang-dropdown > .lang-trigger:hover {
      color: var(--fg, rgba(255, 255, 255, 0.92));
    }
    .lang.lang-dropdown > .lang-trigger .flag {
      font-size: 14px;
      line-height: 1;
    }
    .lang.lang-dropdown .lang-chevron {
      display: inline-flex;
      align-items: center;
      opacity: 0.65;
      transition: transform 0.15s ease;
    }
    .lang.lang-dropdown.lang-open .lang-chevron {
      transform: rotate(180deg);
    }
    .lang.lang-dropdown .lang-menu {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      min-width: 148px;
      padding: 4px;
      border-radius: 12px;
      border: 1px solid var(--stroke, rgba(127, 127, 127, 0.35));
      background: var(--card, rgba(15, 23, 42, 0.98));
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
      z-index: 100;
    }
    .lang.lang-dropdown .lang-menu button {
      appearance: none;
      border: 0;
      background: transparent;
      color: var(--muted, rgba(255, 255, 255, 0.7));
      width: 100%;
      text-align: left;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 8px;
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: normal;
    }
    .lang.lang-dropdown .lang-menu button:hover {
      background: rgba(127, 127, 127, 0.12);
      color: var(--fg, rgba(255, 255, 255, 0.92));
    }
    .lang.lang-dropdown .lang-menu button[aria-selected="true"] {
      color: var(--fg, rgba(255, 255, 255, 0.92));
      background: rgba(127, 127, 127, 0.16);
    }
    .lang.lang-dropdown .lang-menu .lang-label {
      flex: 1 1 auto;
      min-width: 0;
    }
  `;
  document.head.appendChild(style);
}

function buildLangDropdown(group) {
  if (group.querySelector('.lang-trigger')) return group;
  group.classList.add('lang-dropdown');

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'lang-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');

  const flagSpan = document.createElement('span');
  flagSpan.className = 'flag';
  flagSpan.setAttribute('aria-hidden', 'true');

  const chevron = document.createElement('span');
  chevron.className = 'lang-chevron';
  chevron.setAttribute('aria-hidden', 'true');
  chevron.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">' +
    '<path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>' +
    '</svg>';

  trigger.append(flagSpan, chevron);

  const menu = document.createElement('div');
  menu.className = 'lang-menu';
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;

  for (const lang of LANGS) {
    const meta = LANG_META[lang];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-lang', lang);
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-label', meta.label);
    btn.innerHTML =
      `<span class="flag" aria-hidden="true">${meta.flag}</span>` +
      `<span class="lang-label">${meta.label}</span>`;
    menu.appendChild(btn);
  }

  group.replaceChildren(trigger, menu);
  return group;
}

function syncLangDropdown(group, lang) {
  const meta = LANG_META[lang];
  if (!meta) return;
  const trigger = group.querySelector('.lang-trigger');
  if (!trigger) return;
  const flag = trigger.querySelector('.flag');
  if (flag) flag.textContent = meta.flag;
  trigger.setAttribute('aria-label', meta.label);
  for (const opt of group.querySelectorAll('.lang-menu button[data-lang]')) {
    opt.setAttribute(
      'aria-selected',
      opt.getAttribute('data-lang') === lang ? 'true' : 'false',
    );
  }
}

function closeLangDropdown(group) {
  const menu = group.querySelector('.lang-menu');
  const trigger = group.querySelector('.lang-trigger');
  if (!menu || !trigger) return;
  menu.hidden = true;
  trigger.setAttribute('aria-expanded', 'false');
  group.classList.remove('lang-open');
}

function applyI18n(root = document) {
  const lang = getLang();
  root.documentElement && (root.documentElement.lang = lang);
  for (const el of root.querySelectorAll('[data-i18n]')) {
    const key = el.getAttribute('data-i18n');
    const attr = el.getAttribute('data-i18n-attr');
    const value = t(key, lang);
    if (attr) el.setAttribute(attr, value);
    else el.textContent = value;
  }
  for (const group of root.querySelectorAll('.lang.lang-dropdown')) {
    syncLangDropdown(group, lang);
  }
}

function initLangSwitcher() {
  ensureLangSwitcherStyles();
  for (const group of document.querySelectorAll('.lang')) {
    buildLangDropdown(group);
  }

  if (!document.documentElement.dataset.uydoshLangBound) {
    document.documentElement.dataset.uydoshLangBound = '1';
    document.addEventListener('click', (e) => {
      for (const group of document.querySelectorAll('.lang.lang-open')) {
        if (!group.contains(e.target)) closeLangDropdown(group);
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      for (const group of document.querySelectorAll('.lang.lang-open')) {
        closeLangDropdown(group);
      }
    });
  }

  for (const group of document.querySelectorAll('.lang.lang-dropdown')) {
    const trigger = group.querySelector('.lang-trigger');
    const menu = group.querySelector('.lang-menu');
    if (!trigger || !menu || trigger.dataset.bound) continue;
    trigger.dataset.bound = '1';
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = group.classList.contains('lang-open');
      for (const other of document.querySelectorAll('.lang.lang-open')) {
        closeLangDropdown(other);
      }
      if (!open) {
        menu.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        group.classList.add('lang-open');
      }
    });
    for (const btn of group.querySelectorAll('.lang-menu button[data-lang]')) {
      if (btn.dataset.bound) continue;
      btn.dataset.bound = '1';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        setLang(btn.getAttribute('data-lang'));
        applyI18n();
        closeLangDropdown(group);
      });
    }
  }
  applyI18n();
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

let feedEmptyStateStylesInjected = false;

function ensureFeedEmptyStateStyles() {
  if (feedEmptyStateStylesInjected) return;
  feedEmptyStateStylesInjected = true;
  const style = document.createElement('style');
  style.id = 'uydosh-feed-empty-state';
  style.textContent = `
    .status.is-empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      min-height: min(52vh, 420px);
      padding: 24px 16px 40px;
      text-align: center;
    }
    .feed-empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      max-width: 280px;
    }
    .feed-empty-state-icon {
      width: 72px;
      height: 72px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      background: color-mix(in srgb, var(--accent, #60a5fa) 14%, transparent);
      color: color-mix(in srgb, var(--muted, #94a3b8) 88%, var(--fg, #fff));
    }
    .feed-empty-state-icon svg {
      width: 36px;
      height: 36px;
      display: block;
    }
    .feed-empty-state-icon svg * {
      stroke: currentColor;
      fill: none;
    }
    .feed-empty-state-title {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      line-height: 1.35;
      color: var(--fg);
    }
  `;
  document.head.appendChild(style);
}

/** Centered empty feed markup with a housing icon above the title. */
function feedEmptyStateHtml(lang = getLang()) {
  ensureFeedEmptyStateStyles();
  const title = escapeHtml(t('feed.empty', lang));
  return `
    <div class="feed-empty-state" role="status">
      <div class="feed-empty-state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M3 10.5 12 3l9 7.5" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"></path>
          <path d="M5 9.5V20h14V9.5" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"></path>
          <path d="M9 20v-6h6v6" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
      </div>
      <p class="feed-empty-state-title">${title}</p>
    </div>
  `;
}

/** Tashkent metro line colors (match mobile app). */
const METRO_LINE_COLORS = {
  1: '#E53E3E',
  2: '#3182CE',
  3: '#38A169',
  4: '#FF9800',
};

/** Tashkent metro line names (match mobile MetroCache). */
const METRO_LINE_NAMES = {
  1: { uz: 'Chilanzar', ru: 'Чиланзар', en: 'Chilanzar' },
  2: { uz: 'Oʻzbekiston', ru: 'Узбекистан', en: 'Uzbekistan' },
  3: { uz: 'Yunusobod', ru: 'Юнусабад', en: 'Yunusobod' },
  4: { uz: 'Circle', ru: 'Кольцевая', en: 'Circle' },
};

const METRO_LINE_IDS = [1, 2, 3, 4];

/** Listing type ids shared by the Telegram feed and create-listing wizard. */
const LISTING_TYPE_ALL = 0;
const LISTING_TYPE_ROOM_NEEDED = 1;
const LISTING_TYPE_ROOMMATE_NEEDED = 2;
const LISTING_TYPE_GROUP_FORMING = 3;

const GENDER_ANY = 0;
const GENDER_MALE = 1;
const GENDER_FEMALE = 2;

const METRO_LINE_ANY = 0;

function metroLineColor(line) {
  const n = Number(line);
  return METRO_LINE_COLORS[n] || null;
}

function metroLineLabel(line, lang = getLang()) {
  const names = METRO_LINE_NAMES[Number(line)];
  return names?.[lang] || names?.en || '';
}

/** Circular “M” badge matching mobile MLetterIcon. */
function metroLineBadgeHtml(line) {
  const color = metroLineColor(line) || 'currentColor';
  return `<span class="metro-m-badge" style="--line-color:${color}" aria-hidden="true">M</span>`;
}

function resolveMetroLine(listing) {
  const st = listing?.subway_station;
  if (st?.line != null) return Number(st.line);
  if (listing?.subway_line_id != null) return Number(listing.subway_line_id);
  return null;
}

function iconSvg(color, paths) {
  const colorStyle = color ? ` style="color:${color}"` : '';
  return `<span class="icon" aria-hidden="true"${colorStyle}><svg viewBox="0 0 24 24" fill="none">${paths}</svg></span>`;
}

/** Match mobile app listing tile location pin (AppColors.error). */
const LOCATION_PIN_COLOR = '#F44336';

function iconPin() {
  return iconSvg(LOCATION_PIN_COLOR, `
    <path d="M12 21s7-4.8 7-11a7 7 0 1 0-14 0c0 6.2 7 11 7 11Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
    <path d="M12 10.5a2.5 2.5 0 1 0 0.001-5.001A2.5 2.5 0 0 0 12 10.5Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
  `);
}

function iconMetro(line) {
  const color = metroLineColor(line) || 'currentColor';
  return iconSvg(color, `
    <path d="M7 3h10a3 3 0 0 1 3 3v10a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V6a3 3 0 0 1 3-3Z" stroke-width="2" stroke-linejoin="round"></path>
    <path d="M8 17h0.01M16 17h0.01" stroke-width="3" stroke-linecap="round"></path>
    <path d="M7 21l-2 2M17 21l2 2" stroke-width="2" stroke-linecap="round"></path>
    <path d="M7 8h10" stroke-width="2" stroke-linecap="round"></path>
  `);
}

function iconClock() {
  return iconSvg(null, `
    <circle cx="12" cy="12" r="9" stroke-width="2"></circle>
    <path d="M12 7v5l3 2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
  `);
}

function iconCalendar() {
  return iconSvg(null, `
    <rect x="4" y="5" width="16" height="16" rx="2" stroke-width="2" stroke-linejoin="round"></rect>
    <path d="M8 3v4M16 3v4M4 10h16" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
  `);
}

function iconLock() {
  return iconSvg(null, `
    <path d="M7 11V8a5 5 0 0 1 10 0v3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
    <rect x="5" y="11" width="14" height="10" rx="2" stroke-width="2" stroke-linejoin="round"></rect>
  `);
}

function iconCamera(color) {
  return chipIconFilled(
    color,
    'M9 2 7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.65 0-3 1.35-3 3s1.35 3 3 3 3-1.35 3-3-1.35-3-3-3z',
  );
}

/** Match mobile [Icons.article_outlined] for description templates. */
function iconArticle(color) {
  return iconSvg(color, `
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" stroke-width="2" stroke-linejoin="round"></path>
    <path d="M14 2v6h6" stroke-width="2" stroke-linejoin="round"></path>
    <path d="M16 13H8" stroke-width="2" stroke-linecap="round"></path>
    <path d="M16 17H8" stroke-width="2" stroke-linecap="round"></path>
    <path d="M10 9H8" stroke-width="2" stroke-linecap="round"></path>
  `);
}

/** Listing description starter text; mirrors mobile [ListingDescriptionTemplateButton]. */
function descriptionTemplateText(listingTypeId, gender, lang = getLang()) {
  const typeId = Number(listingTypeId);
  if (typeId === 1) return t('create.descriptionTemplate.roomNeeded', lang);
  if (typeId === 3) return t('create.descriptionTemplate.groupForming', lang);
  if (Number(gender) === 2) return t('create.descriptionTemplate.roommateNeededFemale', lang);
  return t('create.descriptionTemplate.roommateNeededMale', lang);
}

/** Default listing title hashtag; mirrors mobile [ListingUtils.presetListingTitleL10nKey]. */
function presetListingTitleText(listingTypeId, gender, lang = getLang()) {
  const typeId = Number(listingTypeId);
  const g = Number(gender) === 2 ? 2 : 1;
  if (typeId === 3) return t('create.presetTitle.groupForming', lang);
  if (typeId === 2) {
    return g === 2
      ? t('create.presetTitle.femaleRoommate', lang)
      : t('create.presetTitle.maleRoommate', lang);
  }
  return g === 2
    ? t('create.presetTitle.femaleRoom', lang)
    : t('create.presetTitle.maleRoom', lang);
}

function filterPhotoIcon({ pressed = false } = {}) {
  const color = pressed ? '#fff' : null;
  return iconCamera(color);
}

/** Match mobile app listing-type badge colors (dark theme). */
const LISTING_TYPE_COLORS = {
  1: '#64B5F6', // room_needed
  2: '#FF9800', // roommate_needed
  3: '#9B6DFF', // group_forming
};

/** Material-style SVG paths for listing-type map pin glyphs (viewBox 0 0 24 24). */
const LISTING_TYPE_MAP_PIN_ICON_PATHS = {
  1: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5z',
  2: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 2.05 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  '2_absent': 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  3: 'M12 12.75c1.63 0 3.07.39 4.24.9 1.08.48 1.76 1.56 1.76 2.73V18H6v-1.62c0-1.17.68-2.25 1.76-2.73 1.17-.52 2.61-.9 4.24-.9zM12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM18.59 15.41A5.978 5.978 0 0 0 18 15c-1.66 0-3 1.34-3 3 0 .35.06.68.16 1H18v-3.59zM6.16 16c.1-.32.16-.65.16-1 0-1.66-1.34-3-3-3-.59 0-1.14.17-1.59.41V18h4.43z',
  default: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5z',
};

// Yandex Maps JS 2.1 uses iconImageSize as on-screen CSS px (not Flutter bitmap px).
const MAP_PIN_ICON_SIZE = 24;
const MAP_PIN_ICON_SIZE_SELECTED = 28;
const mapPinIconCache = new Map();

/** Match Flutter map pin fills (yandex_map_widget_icons.dart). */
const MAP_PIN_FILL = {
  default: '#000000',
  dark: '#142A45',
  visited: '#9E9E9E',
  visitedDark: '#757575',
  selected: '#673AB7',
};

const VISITED_LISTINGS_STORAGE_KEY = 'uydosh_visited_listing_ids';

/** Manual light/dark override (mini app theme toggle) — beats Telegram theme + system preference. */
const MANUAL_THEME_STORAGE_KEY = 'uydosh_manual_theme';
const MANUAL_THEME_VARS = {
  dark: {
    '--bg': '#061525',
    '--fg': 'rgba(255, 255, 255, 0.92)',
    '--muted': 'rgba(255, 255, 255, 0.7)',
    '--card': 'rgba(255, 255, 255, 0.06)',
    '--stroke': 'rgba(255, 255, 255, 0.12)',
  },
  light: {
    '--bg': '#f6f7fb',
    '--fg': 'rgba(15, 23, 42, 0.92)',
    '--muted': 'rgba(15, 23, 42, 0.7)',
    '--card': 'rgba(15, 23, 42, 0.04)',
    '--stroke': 'rgba(15, 23, 42, 0.12)',
  },
};

function getManualTheme() {
  try {
    const saved = localStorage.getItem(MANUAL_THEME_STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : null;
  } catch {
    return null;
  }
}

function applyManualThemeVars(theme) {
  const vars = MANUAL_THEME_VARS[theme];
  if (!vars) return;
  const root = document.documentElement;
  for (const [prop, value] of Object.entries(vars)) {
    root.style.setProperty(prop, value);
  }
}

/** Re-apply a saved manual theme on load, before/after Telegram theme colors land. */
function applyStoredManualTheme() {
  const theme = getManualTheme();
  if (theme) applyManualThemeVars(theme);
}

function setManualTheme(theme) {
  if (theme !== 'light' && theme !== 'dark') return;
  try {
    localStorage.setItem(MANUAL_THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
  applyManualThemeVars(theme);
  document.dispatchEvent(new CustomEvent('uydosh:themechange', { detail: { theme } }));
}

function toggleManualTheme() {
  const next = prefersDarkMapPins() ? 'light' : 'dark';
  setManualTheme(next);
  return next;
}

function prefersDarkMapPins() {
  const manual = getManualTheme();
  if (manual) return manual === 'dark';
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
  } catch {
    return false;
  }
}

function loadVisitedListingIds() {
  if (typeof sessionStorage === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(VISITED_LISTINGS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map(Number).filter((id) => id > 0));
  } catch {
    return new Set();
  }
}

function markListingVisited(listingId) {
  const id = Number(listingId);
  if (!id) return false;
  const visited = loadVisitedListingIds();
  if (visited.has(id)) return false;
  visited.add(id);
  try {
    sessionStorage.setItem(
      VISITED_LISTINGS_STORAGE_KEY,
      JSON.stringify([...visited]),
    );
  } catch {
    /* ignore */
  }
  return true;
}

function resolveMapPinIconStyle(pin, {
  selectedListingId = null,
  visitedListingIds = null,
  darkMap = null,
  selected = false,
} = {}) {
  const listingId = Number(pin?.id);
  const isDark = darkMap ?? prefersDarkMapPins();
  const visited = visitedListingIds ?? loadVisitedListingIds();
  const isSelected =
    selected ||
    (selectedListingId != null && listingId > 0 && listingId === Number(selectedListingId));

  if (isSelected) {
    return { variant: 'selected', selected: true, visited: false, darkMap: isDark };
  }
  if (listingId > 0 && visited.has(listingId)) {
    return { variant: 'visited', selected: false, visited: true, darkMap: isDark };
  }
  if (isDark) {
    return { variant: 'dark', selected: false, visited: false, darkMap: true };
  }
  return { variant: 'default', selected: false, visited: false, darkMap: false };
}

function mapPinFillColor(style) {
  if (style.selected) return MAP_PIN_FILL.selected;
  if (style.visited) {
    return style.darkMap ? MAP_PIN_FILL.visitedDark : MAP_PIN_FILL.visited;
  }
  if (style.darkMap) return MAP_PIN_FILL.dark;
  return MAP_PIN_FILL.default;
}

function resolveListingTypeIdFromPin(pin) {
  const typeId = Number(pin?.listing_type_id);
  if (typeId > 0) return typeId;
  const code = String(pin?.listing_type_code ?? '').trim();
  if (code === 'room_needed') return 1;
  if (code === 'roommate_needed') return 2;
  if (code === 'group_forming') return 3;
  return 0;
}

function resolveMapPinIconKey(pin) {
  const typeId = resolveListingTypeIdFromPin(pin);
  if (typeId === 2) {
    const hostResident = pin?.host_resident;
    const absentHost =
      hostResident === false ||
      hostResident === 0 ||
      hostResident === 'false';
    if (absentHost) return '2_absent';
  }
  return typeId > 0 ? String(typeId) : 'default';
}

function drawMapPinIconPath(ctx, pathD, centerX, centerY, iconSize) {
  const path = new Path2D(pathD);
  const scale = iconSize / 24;
  ctx.save();
  ctx.translate(centerX - iconSize / 2, centerY - iconSize / 2);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff';
  ctx.fill(path);
  ctx.restore();
}

function drawRoundRect(ctx, x, y, width, height, radius) {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius);
    return;
  }
  const r = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

/**
 * Canvas bitmap for Yandex Maps placemarks (mobile parity):
 * black/blue/gray/purple fill + white listing-type glyph + white outline.
 */
function createMapPinIcon(pin, options = {}) {
  if (typeof document === 'undefined') return null;

  const style = resolveMapPinIconStyle(pin, options);
  const iconKey = resolveMapPinIconKey(pin);
  const fillColor = mapPinFillColor(style);
  const pinSize = style.selected ? MAP_PIN_ICON_SIZE_SELECTED : MAP_PIN_ICON_SIZE;
  const cacheKey = `${iconKey}:${style.variant}:${pinSize}`;
  const cached = mapPinIconCache.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  // Draw at 1× logical px — Yandex Maps + Telegram WebView treat data-URL bitmaps
  // as iconImageSize in CSS px; a retina canvas makes pins ~devicePixelRatio too large.
  canvas.width = pinSize;
  canvas.height = pinSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const center = pinSize / 2;
  const radius = pinSize * 0.39;
  const outlineWidth = style.selected ? 2 : 1.5;
  const shadowOffsetY = style.selected ? 2 : 1;
  const shadowAlpha = style.selected ? 0.35 : 0.18;

  ctx.beginPath();
  ctx.arc(center, center + shadowOffsetY, radius + outlineWidth, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(center, center, radius + outlineWidth, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fillStyle = fillColor;
  ctx.fill();

  const pathD =
    LISTING_TYPE_MAP_PIN_ICON_PATHS[iconKey] ||
    LISTING_TYPE_MAP_PIN_ICON_PATHS.default;
  drawMapPinIconPath(ctx, pathD, center, center, pinSize * (style.selected ? 0.54 : 0.52));

  const result = {
    href: canvas.toDataURL('image/png'),
    size: [pinSize, pinSize],
    offset: [-pinSize / 2, -pinSize / 2],
    zIndex: style.selected ? 1000 : 100,
  };
  mapPinIconCache.set(cacheKey, result);
  return result;
}

const MAP_GROUP_PIN_WIDTH = 54;
const MAP_GROUP_PIN_HEIGHT = 28;
const MAP_GROUP_PIN_WIDTH_SELECTED = 58;
const MAP_GROUP_PIN_HEIGHT_SELECTED = 30;
const mapGroupPinIconCache = new Map();

function resolveMapGroupPinStyle(group, {
  selectedListingId = null,
  selectedListingGroupIds = null,
  visitedListingIds = null,
  darkMap = null,
  selected = false,
} = {}) {
  const isDark = darkMap ?? prefersDarkMapPins();
  const visited = visitedListingIds ?? loadVisitedListingIds();
  const groupIds = new Set(
    (selectedListingGroupIds || [])
      .map(Number)
      .filter((id) => id > 0),
  );
  const selectedId = selectedListingId != null ? Number(selectedListingId) : null;
  const pins = Array.isArray(group?.pins) ? group.pins : [];
  const isSelected =
    selected ||
    pins.some((pin) => {
      const listingId = Number(pin?.id);
      if (listingId <= 0) return false;
      return listingId === selectedId || groupIds.has(listingId);
    });
  if (isSelected) {
    return { variant: 'selected', selected: true, visited: false, darkMap: isDark };
  }
  const allVisited = pins.length > 0 && pins.every((pin) => {
    const listingId = Number(pin?.id);
    return listingId > 0 && visited.has(listingId);
  });
  if (allVisited) {
    return { variant: 'visited', selected: false, visited: true, darkMap: isDark };
  }
  if (isDark) {
    return { variant: 'dark', selected: false, visited: false, darkMap: true };
  }
  return { variant: 'default', selected: false, visited: false, darkMap: false };
}

function mapGroupPinFillColor(style) {
  if (style.selected) return MAP_PIN_FILL.selected;
  if (style.visited) {
    return style.darkMap ? MAP_PIN_FILL.visitedDark : MAP_PIN_FILL.visited;
  }
  if (style.darkMap) return MAP_PIN_FILL.dark;
  return MAP_PIN_FILL.default;
}

/**
 * Pill-shaped composite pin icon with listing count (mobile parity).
 */
function createMapGroupPinIcon(group, options = {}) {
  if (typeof document === 'undefined') return null;
  const pins = Array.isArray(group?.pins) ? group.pins : [];
  const count = pins.length;
  if (count <= 1) return createMapPinIcon(pins[0], options);

  const style = resolveMapGroupPinStyle(group, options);
  const representativePin = pins[0];
  const iconKey = resolveMapPinIconKey(representativePin);
  const fillColor = mapGroupPinFillColor(style);
  const width = style.selected ? MAP_GROUP_PIN_WIDTH_SELECTED : MAP_GROUP_PIN_WIDTH;
  const height = style.selected ? MAP_GROUP_PIN_HEIGHT_SELECTED : MAP_GROUP_PIN_HEIGHT;
  const cacheKey = `group:${count}:${iconKey}:${style.variant}:${width}x${height}`;
  const cached = mapGroupPinIconCache.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const centerX = width / 2;
  const centerY = height / 2;
  const pillHeight = height;
  const pillWidth = width;
  const radius = pillHeight / 2;
  const outlineWidth = style.selected ? 2 : 1.5;

  ctx.beginPath();
  drawRoundRect(
    ctx,
    centerX - pillWidth / 2,
    centerY - pillHeight / 2 + 1,
    pillWidth,
    pillHeight,
    radius,
  );
  ctx.fillStyle = style.selected ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.24)';
  ctx.fill();

  ctx.beginPath();
  drawRoundRect(
    ctx,
    centerX - (pillWidth / 2) - outlineWidth,
    centerY - (pillHeight / 2) - outlineWidth,
    pillWidth + outlineWidth * 2,
    pillHeight + outlineWidth * 2,
    radius + outlineWidth,
  );
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.beginPath();
  drawRoundRect(
    ctx,
    centerX - pillWidth / 2,
    centerY - pillHeight / 2,
    pillWidth,
    pillHeight,
    radius,
  );
  ctx.fillStyle = fillColor;
  ctx.fill();

  const label = count > 99 ? '99+' : String(count);
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${label.length > 2 ? 10 : 12}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const labelWidth = ctx.measureText(label).width;
  const iconSize = style.selected ? 13 : 12;
  const gap = 3;
  const contentWidth = labelWidth + gap + iconSize;
  const contentLeft = centerX - contentWidth / 2;
  ctx.fillText(label, contentLeft, centerY + 0.5);

  const pathD =
    LISTING_TYPE_MAP_PIN_ICON_PATHS[iconKey] ||
    LISTING_TYPE_MAP_PIN_ICON_PATHS.default;
  drawMapPinIconPath(ctx, pathD, contentLeft + labelWidth + gap + iconSize / 2, centerY, iconSize);

  const result = {
    href: canvas.toDataURL('image/png'),
    size: [width, height],
    offset: [-width / 2, -height / 2],
    zIndex: style.selected ? 1000 : 100,
  };
  mapGroupPinIconCache.set(cacheKey, result);
  return result;
}

const USER_LOCATION_PIN_SIZE = 22;
const USER_LOCATION_PIN_FILL = '#F44336';
const MAP_CLUSTER_PIN_SIZE = 32;
let userLocationPinIconCache = null;
let mapClusterPinIconCache = null;

/** Compact violet cluster bubble (replaces oversized islands#violetClusterIcons preset). */
function createMapClusterPinIcon() {
  if (typeof document === 'undefined') return null;
  if (mapClusterPinIconCache) return mapClusterPinIconCache;

  const size = MAP_CLUSTER_PIN_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const center = size / 2;
  const radius = size * 0.34;
  const outlineWidth = 1.5;

  ctx.beginPath();
  ctx.arc(center, center + 1, radius + outlineWidth, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(center, center, radius + outlineWidth, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#673AB7';
  ctx.fill();

  mapClusterPinIconCache = {
    href: canvas.toDataURL('image/png'),
    size: [size, size],
    offset: [-size / 2, -size / 2],
  };
  return mapClusterPinIconCache;
}

/** Red dot with white ring — matches mobile user-location pin. */
function createUserLocationPinIcon() {
  if (typeof document === 'undefined') return null;
  if (userLocationPinIconCache) return userLocationPinIconCache;

  const pinSize = USER_LOCATION_PIN_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = pinSize;
  canvas.height = pinSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const center = pinSize / 2;
  const outerRadius = pinSize * 0.39;
  const innerRadius = outerRadius - 2;

  ctx.beginPath();
  ctx.arc(center, center + 2, outerRadius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(center, center, outerRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(center, center, innerRadius, 0, Math.PI * 2);
  ctx.fillStyle = USER_LOCATION_PIN_FILL;
  ctx.fill();

  userLocationPinIconCache = {
    href: canvas.toDataURL('image/png'),
    size: [pinSize, pinSize],
    offset: [-pinSize / 2, -pinSize / 2],
    zIndex: 2000,
  };
  return userLocationPinIconCache;
}

function initTelegramLocationManager() {
  const loc = window.Telegram?.WebApp?.LocationManager;
  if (!loc || typeof loc.init !== 'function') {
    return Promise.resolve(null);
  }
  if (loc.isInited) return Promise.resolve(loc);
  return new Promise((resolve) => {
    loc.init(() => resolve(loc));
  });
}

function requestUserLocationFromBrowser() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('browser_geolocation_unavailable'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = Number(position?.coords?.latitude);
        const longitude = Number(position?.coords?.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          reject(new Error('browser_geolocation_invalid'));
          return;
        }
        resolve({ latitude, longitude });
      },
      (err) => reject(err || new Error('browser_geolocation_denied')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  });
}

/** Telegram LocationManager first (Mini App), then browser Geolocation API. */
async function requestUserLocation() {
  if (isMiniApp()) {
    const loc = await initTelegramLocationManager();
    if (loc?.isLocationAvailable) {
      const telegramLocation = await new Promise((resolve, reject) => {
        loc.getLocation((data) => {
          const latitude = Number(data?.latitude);
          const longitude = Number(data?.longitude);
          if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
            resolve({ latitude, longitude });
            return;
          }
          reject(new Error('telegram_location_denied'));
        });
      });
      return telegramLocation;
    }
  }
  return requestUserLocationFromBrowser();
}

function openTelegramLocationSettings() {
  const loc = window.Telegram?.WebApp?.LocationManager;
  if (!loc || typeof loc.openSettings !== 'function') return false;
  loc.openSettings();
  return true;
}

/** Strip leading @ and normalize a Telegram username/handle. */
function normalizeTelegramUsername(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const withoutAt = raw.startsWith('@') ? raw.slice(1) : raw;
  return withoutAt.trim();
}

/** Resolve the listing owner's Telegram handle from a listing detail payload. */
function listingContactTelegram(listing) {
  return normalizeTelegramUsername(listing?.contact_telegram);
}

function telegramUserUrl(username) {
  const clean = normalizeTelegramUsername(username);
  return clean ? `https://t.me/${encodeURIComponent(clean)}` : '';
}

/** Open a Telegram user chat (Mini App uses openTelegramLink). */
function openTelegramContact(handle) {
  const url = telegramUserUrl(handle);
  if (!url) return false;
  const tg = window.Telegram?.WebApp;
  if (isMiniApp() && typeof tg?.openTelegramLink === 'function') {
    tg.openTelegramLink(url);
  } else if (typeof tg?.openLink === 'function') {
    tg.openLink(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  return true;
}

function iconTelegram(color = '#fff') {
  return iconSvg(color, `
    <path d="M21.5 4.5 2.8 11.2c-1.1.4-1.1 1.1-.2 1.4l4.8 1.5 1.8 5.6c.2.6.1.8.7.8.5 0 .7-.2 1-.5l2.4-2.3 5 3.7c.9.5 1.6.2 1.8-.9L22.8 6c.3-1.2-.5-1.7-1.3-1.5Z" fill="currentColor" stroke="none"></path>
    <path d="m8.6 13.8 9.7-6.1c.5-.3.9-.1.5.2l-7.9 7.2-.3 3.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"></path>
  `);
}

/** Sticky Mini App footer CTA to message the listing owner on Telegram. */
function detailContactBarHtml(username) {
  const clean = normalizeTelegramUsername(username);
  if (!clean) return '';
  return `
    <div class="detail-contact-bar-inner">
      <button type="button" class="detail-contact-btn" data-detail-contact-telegram data-telegram-username="${escapeHtml(clean)}">
        ${iconTelegram('#fff')}
        <span data-i18n="detail.contactTelegram">${escapeHtml(t('detail.contactTelegram'))}</span>
      </button>
    </div>
  `;
}

function bindDetailContactBar(container, { listingId, onOpen } = {}) {
  const btn = container?.querySelector('[data-detail-contact-telegram]');
  if (!btn) return;
  btn.addEventListener('click', () => {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
    const handle = btn.getAttribute('data-telegram-username');
    if (!openTelegramContact(handle)) return;
    if (typeof onOpen === 'function') onOpen(handle);
    else if (listingId != null) {
      logMiniAppEvent('telegram_contact_tapped', {
        listing_id: Number(listingId),
        source: 'telegram_mini_app',
      });
    }
  });
}

/** Pre-render all pin bitmap variants so the first map paint avoids canvas work. */
function warmMapPinIconCache({ darkMap = null } = {}) {
  if (typeof document === 'undefined') return;
  createUserLocationPinIcon();
  createMapClusterPinIcon();
  const isDark = darkMap ?? prefersDarkMapPins();
  const stubPins = [
    { id: 101, listing_type_id: 1 },
    { id: 102, listing_type_id: 2 },
    { id: 103, listing_type_id: 2, host_resident: false },
    { id: 104, listing_type_id: 3 },
    { id: 105, listing_type_id: 0 },
  ];
  const visited = new Set([101]);
  for (const pin of stubPins) {
    createMapPinIcon(pin, { darkMap: isDark });
    createMapPinIcon(pin, { darkMap: true });
    createMapPinIcon(pin, { visitedListingIds: visited, darkMap: isDark });
    createMapPinIcon(pin, { selectedListingId: pin.id, darkMap: isDark });
  }
  for (const count of [2, 3, 5, 12]) {
    createMapGroupPinIcon(
      { pins: stubPins.slice(0, Math.min(count, stubPins.length)) },
      { darkMap: isDark },
    );
    createMapGroupPinIcon(
      { pins: stubPins.slice(0, Math.min(count, stubPins.length)) },
      { selectedListingId: 101, darkMap: isDark },
    );
  }
}

/** Match mobile app gender badge colors. */
const GENDER_COLORS = {
  1: '#2196F3', // male
  2: '#C45A7C', // female
};

function listingTypeColor(listingTypeId) {
  return LISTING_TYPE_COLORS[Number(listingTypeId)] || null;
}

function genderColor(gender) {
  return GENDER_COLORS[Number(gender)] || null;
}

/** Short gender label for listing badges (matches mobile GenderBadge). */
function genderBadgeLabel(gender, lang = getLang()) {
  const g = Number(gender);
  if (g === 2) return t('card.genderBadge.female', lang);
  if (g === 1) return t('card.genderBadge.male', lang);
  return '';
}

/** Badge HTML with gender icon + label; empty when gender is unknown. */
function genderBadgeHtml(listing, lang = getLang()) {
  const g = Number(listing?.gender);
  if (g !== 1 && g !== 2) return '';
  const color = genderColor(g);
  const icon = g === 2 ? iconFemale(color) : iconMale(color);
  const label = genderBadgeLabel(g, lang);
  const style = color ? ` style="--badge-gender-color:${color}"` : '';
  return `<span class="badge badge-gender" data-gender="${g}"${style}>${icon}${escapeHtml(label)}</span>`;
}

function chipIconFilled(color, pathD) {
  const colorStyle = color ? ` style="color:${color}"` : '';
  return `<span class="chip-icon" aria-hidden="true"${colorStyle}><svg viewBox="0 0 24 24"><path d="${pathD}" fill="currentColor"/></svg></span>`;
}

function iconAll(color) {
  return chipIconFilled(
    color,
    'M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm0 6v4h4v-4h-4zm0 6v4h4v-4h-4z',
  );
}

function iconHome(color) {
  return chipIconFilled(color, 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5z');
}

function iconPeople(color) {
  return chipIconFilled(
    color,
    'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 2.05 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  );
}

function iconPerson(color) {
  return chipIconFilled(color, LISTING_TYPE_MAP_PIN_ICON_PATHS['2_absent']);
}

function isHostAbsent(listing) {
  const hostResident = listing?.host_resident;
  return hostResident === false || hostResident === 0 || hostResident === 'false';
}

function iconGroups(color) {
  return chipIconFilled(
    color,
    'M12 12.75c1.63 0 3.07.39 4.24.9 1.08.48 1.76 1.56 1.76 2.73V18H6v-1.62c0-1.17.68-2.25 1.76-2.73 1.17-.52 2.61-.9 4.24-.9zM12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM18.59 15.41A5.978 5.978 0 0 0 18 15c-1.66 0-3 1.34-3 3 0 .35.06.68.16 1H18v-3.59zM6.16 16c.1-.32.16-.65.16-1 0-1.66-1.34-3-3-3-.59 0-1.14.17-1.59.41V18h4.43z',
  );
}

function iconMale(color) {
  return chipIconFilled(
    color,
    'M20.5 4h-5v2h2.59l-3.13 3.13a6 6 0 1 0 1.42 1.42L19 7.41V10h2V4zM12 14a2 2 0 1 1 0-4 2 2 0 0 1 0 4z',
  );
}

function iconFemale(color) {
  return chipIconFilled(
    color,
    'M12 14a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0-2a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm-6 8v-2h2v-2.7a6.97 6.97 0 0 1-2-.32V18h2v2H6zm12 0v-2h-2v-2.7a6.97 6.97 0 0 0 2-.32V18h-2v2h2z',
  );
}

function filterListingTypeIcon(listingTypeId, { pressed = false } = {}) {
  const id = Number(listingTypeId);
  const color = pressed ? '#fff' : listingTypeColor(id);
  switch (id) {
    case 0:
      return iconAll(pressed ? '#fff' : null);
    case 1:
      return iconHome(color);
    case 2:
      return iconPeople(color);
    case 3:
      return iconGroups(color);
    default:
      return '';
  }
}

/** Listing-type glyph for card/detail badges (respects host_resident on roommate_needed). */
function listingTypeBadgeIcon(listing, { pressed = false } = {}) {
  const listingTypeId = listingTypeIdFromListing(listing);
  if (!listingTypeId) return '';
  const color = pressed ? '#fff' : listingTypeColor(listingTypeId);
  if (listingTypeId === 2 && isHostAbsent(listing)) {
    return iconPerson(color);
  }
  return filterListingTypeIcon(listingTypeId, { pressed });
}

function filterGenderIcon(gender, { pressed = false } = {}) {
  const value = Number(gender);
  if (!value) return '';
  const color = pressed ? '#fff' : genderColor(value);
  switch (value) {
    case 1:
      return iconMale(color);
    case 2:
      return iconFemale(color);
    default:
      return '';
  }
}

function formatDate(value, lang) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const locale = lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'uz-UZ';
  return stripLocaleYearSuffix(d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }));
}

/** Match mobile app AmenityIconHelper + listing tile/detail sort order. */
const AMENITY_TILE_PRIORITY = ['wifi', 'air_conditioning', 'bed', 'oven'];
const AMENITY_DETAIL_PRIORITY = ['wifi', 'air_conditioning'];

/** Match mobile AmenitiesCache.defaultOrderedCodes (create/edit listing form). */
const AMENITY_FORM_ORDER = [
  'wifi',
  'tv',
  'oven',
  'air_conditioning',
  'bed',
  'refrigerator',
  'washing_machine',
  'microwave',
  'pets',
];

/** Material-style icon paths (24×24 viewBox, filled). */
const AMENITY_ICON_PATHS = {
  wifi: 'M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z',
  internet: 'M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z',
  parking: 'M13 3H6v18h4v-6h3c3.31 0 6-2.69 6-6s-2.69-6-6-6zm0 10h-3V9h3c1.66 0 3 1.34 3 3s-1.34 3-3 3z',
  bed: 'M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z',
  air_conditioning: 'M22 11h-4.17l3.24-3.24-1.41-1.41L15 11h-2V9l4.66-4.66-1.41-1.41L13 6.17V2h-2v4.17L7.76 2.93 6.34 4.34 11 9v2H9L4.34 6.34 2.93 7.76 6.17 11H2v2h4.17l-3.24 3.24 1.41 1.41L9 13h2v2l-4.66 4.66 1.41 1.41L11 17.83V22h2v-4.17l3.24 3.24 1.41-1.41L13 15v-2h2l4.66 4.66 1.41-1.41L17.83 13H22z',
  tv: 'M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z',
  microwave: 'M20 8H4c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-8c0-1.1-.9-2-2-2zm-8 9c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm6-1H9v-2h9v2z',
  washing_machine: 'M18 2.01L6 2c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-1.99-2zM9 18c-1.65 0-3-1.35-3-3s1.35-3 3-3 3 1.35 3 3-1.35 3-3 3zm8-1H7v-2h10v2z',
  refrigerator: 'M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM9 4h2v5H9V4zm4 0h2v5h-2V4z',
  gas_stove: 'M13.5.67s.74 2.65.74 4.8c0 2.49-2.01 4.5-4.5 4.5S5.24 7.96 5.24 5.47c0-2.15.74-4.8.74-4.8C4.55 1.4 3 3.05 3 5.47 3 8.53 5.86 11 9.24 11c3.38 0 6.24-2.47 6.24-5.53 0-2.42-1.55-4.07-2.12-4.8z',
  stove: 'M13.5.67s.74 2.65.74 4.8c0 2.49-2.01 4.5-4.5 4.5S5.24 7.96 5.24 5.47c0-2.15.74-4.8.74-4.8C4.55 1.4 3 3.05 3 5.47 3 8.53 5.86 11 9.24 11c3.38 0 6.24-2.47 6.24-5.53 0-2.42-1.55-4.07-2.12-4.8z',
  oven: 'M6.5 10H4v7h2.5v-7zm4.5 7h2V10H11v7zm5-7H14v7h2.5v-7zM20 8H4c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-8c0-1.1-.9-2-2-2z',
  furniture: 'M20 9V7c0-1.1-.9-2-2-2h-3c-1.1 0-2 .9-2 2v2H9V7c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v2c-1.1 0-2 .9-2 2v5h1.33L4 19h1v.5c0 .83.67 1.5 1.5 1.5S7 20.33 7 19.5V19h2v.5c0 .83.67 1.5 1.5 1.5S12 20.33 12 19.5V19h2v.5c0 .83.67 1.5 1.5 1.5S16 20.33 16 19.5V19h1l.67-3H22v-5c0-1.1-.9-2-2-2z',
  kitchen_appliances: 'M8.1 13.34l2.83-2.83L3.91 3.5c-1.56 1.56-1.56 4.09 0 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z',
  shower: 'M9 5v2h10V5H9zm12 6v8h-4v-7c0-1.1-.9-2-2-2h-6c-1.1 0-2 .9-2 2v7H3v-8c0-1.66 1.34-3 3-3h12c1.66 0 3 1.34 3 3z',
  pets: 'M4.5 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zm4.5-4a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zm6 0a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zm4.5 4a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5M17.5 14.5c-1.5 3-4.5 4.5-6.5 4.5s-5-1.5-6.5-4.5c-.3-.6-.2-1.3.3-1.8.5-.5 1.2-.6 1.8-.3 1 .5 2.2.8 3.4.8s2.4-.3 3.4-.8c.6-.3 1.3-.2 1.8.3.5.5.6 1.2.3 1.8z',
  no_smoking: 'M2 19h18v-2H2v2zm12.57-9.67c-.23-.05-.46-.08-.69-.08-1.98 0-3.58 1.18-4.3 2.88H9.61V5.08C9.57 5.05 9.53 5 9.49 5c-.32 0-.57.26-.57.58v8.15c0 .32.25.57.57.57.3 0 .55-.23.57-.54v-1.28h.95c.36 1.98 2.06 3.47 4.07 3.47.23 0 .46-.03.69-.08l-2.22 2.22 1.41 1.41L19.41 11l-4.84-4.84-1.41 1.41 2.22 2.22z',
  default: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
};

function getAmenityCode(amenity) {
  const code = String(amenity?.code ?? '').trim().toLowerCase();
  return code || null;
}

function amenitySortRank(code, priorityList) {
  const normalized = String(code ?? '').trim().toLowerCase();
  const priorityIndex = priorityList.indexOf(normalized);
  if (priorityIndex !== -1) return priorityIndex;
  if (normalized === 'pets') return priorityList.length + 1;
  return priorityList.length;
}

function amenityFormSortRank(code) {
  const normalized = String(code ?? '').trim().toLowerCase();
  const priorityIndex = AMENITY_FORM_ORDER.indexOf(normalized);
  return priorityIndex !== -1 ? priorityIndex : AMENITY_FORM_ORDER.length;
}

function sortAmenities(amenities, variant = 'tile') {
  if (variant === 'form') {
    return sortAmenitiesForForm(amenities);
  }
  const priority = variant === 'detail' ? AMENITY_DETAIL_PRIORITY : AMENITY_TILE_PRIORITY;
  const list = Array.isArray(amenities) ? [...amenities] : [];
  list.sort((a, b) => {
    const rankCompare = amenitySortRank(getAmenityCode(a), priority)
      - amenitySortRank(getAmenityCode(b), priority);
    if (rankCompare !== 0) return rankCompare;
    return String(getAmenityCode(a) ?? '').localeCompare(String(getAmenityCode(b) ?? ''));
  });
  return list;
}

function sortAmenitiesForForm(amenities) {
  const list = Array.isArray(amenities) ? [...amenities] : [];
  list.sort((a, b) => {
    const rankCompare = amenityFormSortRank(getAmenityCode(a))
      - amenityFormSortRank(getAmenityCode(b));
    if (rankCompare !== 0) return rankCompare;
    return String(getAmenityCode(a) ?? '').localeCompare(String(getAmenityCode(b) ?? ''));
  });
  return list;
}

function amenityIconPath(code) {
  const normalized = String(code ?? '').trim().toLowerCase();
  return AMENITY_ICON_PATHS[normalized] || AMENITY_ICON_PATHS.default;
}

function amenityIconHtml(code, { size = 18, className = 'amenity-icon' } = {}) {
  const path = amenityIconPath(code);
  return `<span class="${className}" aria-hidden="true" style="width:${size}px;height:${size}px"><svg viewBox="0 0 24 24" width="${size}" height="${size}"><path d="${path}" fill="currentColor"/></svg></span>`;
}

function amenityChipHtml(amenity, lang) {
  const label = localized(amenity, lang);
  const code = getAmenityCode(amenity);
  return `<span class="amenity-chip" role="img" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${amenityIconHtml(code, { size: 18 })}</span>`;
}

function amenityIconsRowHtml(amenities, lang, { maxVisible = 5, showAll = false, variant = 'tile' } = {}) {
  const sorted = sortAmenities(amenities, variant);
  if (sorted.length === 0) return '';
  const limit = showAll ? sorted.length : maxVisible;
  const visible = sorted.slice(0, limit);
  const remaining = showAll ? 0 : sorted.length - visible.length;
  const icons = visible.map((amenity) => {
    const label = localized(amenity, lang);
    const code = getAmenityCode(amenity);
    return `<span class="amenity-inline" role="img" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${amenityIconHtml(code, { size: 16, className: 'amenity-icon amenity-icon-inline' })}</span>`;
  }).join('');
  const overflow = remaining > 0
    ? `<span class="amenity-more" aria-label="+${remaining}">+${remaining}</span>`
    : '';
  return `${icons}${overflow}`;
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** iOS fallback when Universal Links are not verified yet. */
function tryOpenListingInApp(listingId, onFallback) {
  const id = String(listingId ?? '').trim();
  if (!id || !/^\d+$/.test(id) || !isIOS() || isMiniApp()) {
    if (onFallback) onFallback();
    return false;
  }
  window.location.href = `uydosh://listing/${encodeURIComponent(id)}`;
  if (onFallback) setTimeout(onFallback, 1200);
  return true;
}

const MINI_APP_FEED_PATH = '/telegram/';

/** True inside Telegram Mini App or on `?mini=1` / /telegram/. */
function isMiniApp() {
  if (isMiniAppPage()) return true;
  try {
    const tg = window.Telegram?.WebApp;
    if (tg?.initData && String(tg.initData).length > 0) return true;
    if (tg?.platform && tg.platform !== 'unknown') return true;
  } catch { /* ignore */ }
  return false;
}

function listingPageUrl(id) {
  const lid = String(id ?? '').trim();
  if (!lid) return MINI_APP_FEED_PATH;
  if (isMiniApp()) {
    return `/listing.html?id=${encodeURIComponent(lid)}&mini=1`;
  }
  return `/listing/${encodeURIComponent(lid)}`;
}

function feedPageUrl() {
  return isMiniApp() ? MINI_APP_FEED_PATH : 'listings.html';
}

function createPageUrl() {
  return MINI_APP_CREATE_PATH;
}

function applyTelegramTheme(tg) {
  const p = tg?.themeParams;
  if (!p) return;
  const root = document.documentElement;
  if (p.bg_color) root.style.setProperty('--tg-bg', p.bg_color);
  if (p.text_color) root.style.setProperty('--tg-fg', p.text_color);
  if (p.hint_color) root.style.setProperty('--tg-muted', p.hint_color);
  if (p.button_color) root.style.setProperty('--tg-btn', p.button_color);
  if (p.secondary_bg_color) root.style.setProperty('--tg-card', p.secondary_bg_color);
}

const MINI_APP_SAFE_AREA_STYLE_ID = 'uydosh-mini-app-safe-area-v2';
const TELEGRAM_MOBILE_PLATFORMS = new Set(['ios', 'android', 'android_x']);
const TELEGRAM_DESKTOP_PLATFORMS = new Set(['tdesktop', 'macos', 'unigram', 'weba', 'webk']);
/** Minimum space below Telegram mobile header chrome (Close + title bar). */
const TELEGRAM_MOBILE_HEADER_MIN_TOP = 72;
/** Minimum left inset so brand/logo clears the floating Close control. */
const TELEGRAM_MOBILE_HEADER_MIN_LEFT = 100;
/** Minimum right inset so lang switcher clears Telegram menu controls. */
const TELEGRAM_MOBILE_HEADER_MIN_RIGHT = 60;

function normalizeTelegramPlatform(tg) {
  return String(tg?.platform || 'unknown').toLowerCase();
}

/** True when the Mini App runs inside Telegram iOS/Android. */
function isTelegramMobile(tg = window.Telegram?.WebApp) {
  return TELEGRAM_MOBILE_PLATFORMS.has(normalizeTelegramPlatform(tg));
}

/** True when the Mini App runs inside Telegram Desktop or Web. */
function isTelegramDesktop(tg = window.Telegram?.WebApp) {
  return TELEGRAM_DESKTOP_PLATFORMS.has(normalizeTelegramPlatform(tg));
}

function applyTelegramPlatformClass(tg) {
  const root = document.documentElement;
  root.classList.remove('mini-app-mobile', 'mini-app-desktop');
  if (!tg) return;
  if (isTelegramMobile(tg)) {
    root.classList.add('mini-app-mobile');
  } else if (isTelegramDesktop(tg)) {
    root.classList.add('mini-app-desktop');
  }
}

/** Sum device + Telegram UI insets (see core.telegram.org/bots/webapps). */
function sumTelegramInsets(device = {}, content = {}) {
  return {
    top: (Number(device.top) || 0) + (Number(content.top) || 0),
    right: (Number(device.right) || 0) + (Number(content.right) || 0),
    bottom: (Number(device.bottom) || 0) + (Number(content.bottom) || 0),
    left: (Number(device.left) || 0) + (Number(content.left) || 0),
  };
}

function applyTelegramSafeAreaInsets(tg) {
  const root = document.documentElement;
  const device = tg?.safeAreaInset ?? {};
  const content = tg?.contentSafeAreaInset ?? {};
  const insets = sumTelegramInsets(device, content);
  // Sum device + content insets (Telegram docs); content-only top under-reports on mobile.
  let top = insets.top || 0;
  let right = insets.right || 0;
  const bottom = insets.bottom || 0;
  let left = insets.left || 0;
  if (tg && isTelegramMobile(tg)) {
    top = Math.max(top, TELEGRAM_MOBILE_HEADER_MIN_TOP);
    left = Math.max(left, TELEGRAM_MOBILE_HEADER_MIN_LEFT);
    right = Math.max(right, TELEGRAM_MOBILE_HEADER_MIN_RIGHT);
  }
  applyTelegramPlatformClass(tg);
  root.style.setProperty('--uydosh-tg-inset-top', `${top}px`);
  root.style.setProperty('--uydosh-tg-sticky-top', `${top}px`);
  root.style.setProperty('--uydosh-tg-filters-sticky-top', `${top}px`);
  root.style.setProperty('--uydosh-tg-inset-right', `${right}px`);
  root.style.setProperty('--uydosh-tg-inset-bottom', `${bottom}px`);
  root.style.setProperty('--uydosh-tg-inset-left', `${left}px`);
}

function parseMiniAppHeaderOptions(el) {
  const options = {};
  const subtitle = el?.getAttribute('data-uydosh-header-subtitle');
  if (subtitle) options.subtitleKey = subtitle;
  if (el?.getAttribute('data-uydosh-header-brand-link') === 'false') {
    options.brandLink = false;
  }
  const iconSrc = el?.getAttribute('data-uydosh-header-icon');
  if (iconSrc) options.iconSrc = iconSrc;
  return options;
}

/** Shared Telegram mini-app header markup (brand + lang slot). */
function miniAppHeaderHtml(options = {}) {
  const {
    subtitleKey = 'brand.tagline',
    brandLink = true,
    iconSrc = '/apple-touch-icon.png',
  } = options;
  const brandContent =
    `<img src="${escapeHtml(iconSrc)}" width="44" height="44" alt="UyDosh" />` +
    `<div><strong>UyDosh</strong><span data-i18n="${escapeHtml(subtitleKey)}"></span></div>`;
  const brand = brandLink
    ? `<a class="brand" href="${MINI_APP_FEED_PATH}" data-mini-app-home>${brandContent}</a>`
    : `<div class="brand">${brandContent}</div>`;
  return `${brand}<div class="lang" role="group" aria-label="Language"></div>`;
}

/** Inject the shared mini-app header into a <header> or mount element. */
function mountMiniAppHeader(target, options = {}) {
  const header = target?.tagName === 'HEADER' ? target : target?.closest?.('header');
  if (!header) return null;
  header.innerHTML = miniAppHeaderHtml(options);
  header.classList.add('uydosh-mini-app-header');
  header.dataset.uydoshHeaderMounted = '1';
  applyI18n(header);
  syncMobileHeaderLayout();
  return header;
}

function mountAllMiniAppHeaders() {
  for (const el of document.querySelectorAll('[data-uydosh-mini-app-header]')) {
    if (el.dataset.uydoshHeaderMounted === '1') continue;
    mountMiniAppHeader(el, parseMiniAppHeaderOptions(el));
  }
}

/** Keep brand + lang in one header row on phone (undo legacy relocation). */
function syncMobileHeaderLayout() {
  if (!isTelegramMobile()) return;
  const header = document.querySelector('header');
  if (!header) return;
  header.removeAttribute('hidden');
  for (const row of document.querySelectorAll('.mobile-lang-row')) {
    const lang = row.querySelector('.lang');
    if (lang && !header.querySelector('.lang')) {
      const nav = header.querySelector('nav');
      (nav || header).appendChild(lang);
    }
    row.remove();
  }
  const orphanLang = document.querySelector('.feed-sticky > .lang, .wrap > .lang');
  if (orphanLang && !header.contains(orphanLang)) {
    const nav = header.querySelector('nav');
    (nav || header).appendChild(orphanLang);
  }
}

function ensureMiniAppSafeAreaStyles() {
  let style = document.getElementById(MINI_APP_SAFE_AREA_STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = MINI_APP_SAFE_AREA_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = `
    html.mini-app {
      --bg: var(--tg-bg, #061525);
      --fg: var(--tg-fg, rgba(255, 255, 255, 0.92));
      --muted: var(--tg-muted, rgba(255, 255, 255, 0.7));
      --card: var(--tg-card, rgba(255, 255, 255, 0.06));
    }
    html.mini-app .wrap {
      max-width: none;
      margin: 0;
      padding-top: 0;
      padding-bottom: 32px;
      --feed-wrap-gutter: max(5px, env(safe-area-inset-left, 0px));
      padding-left: var(--feed-wrap-gutter);
      padding-right: max(5px, env(safe-area-inset-right, 0px));
    }
    html.mini-app .grid {
      grid-template-columns: 1fr;
      gap: 20px;
    }
    html.mini-app body {
      background: var(--bg);
      padding-bottom: max(env(safe-area-inset-bottom, 0px), var(--uydosh-tg-inset-bottom, 0px));
    }
    html.mini-app header {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      flex-wrap: nowrap;
      gap: 12px;
      margin-top: 0;
      margin-left: calc(var(--feed-content-gutter, 25px) - var(--feed-wrap-gutter, max(5px, env(safe-area-inset-left, 0px))));
      margin-right: calc(var(--feed-content-gutter, 25px) - max(5px, env(safe-area-inset-right, 0px)));
      padding:
        calc(4px + var(--uydosh-tg-inset-top, var(--tg-content-safe-area-inset-top, 0px)))
        14px
        12px
        14px;
      min-height: 44px;
      box-sizing: border-box;
      border: 1px solid var(--stroke);
      border-radius: 18px;
    }
    html.mini-app-desktop header {
      padding-top: calc(4px + var(--uydosh-tg-inset-top, 0px));
    }
    html.mini-app .feed-sticky {
      margin-left: calc(-1 * var(--feed-wrap-gutter, max(5px, env(safe-area-inset-left, 0px))));
      margin-right: calc(-1 * max(5px, env(safe-area-inset-right, 0px)));
      padding-top: 8px;
      padding-bottom: 0;
      box-sizing: border-box;
    }
    html.mini-app-desktop .feed-sticky {
      padding-left: var(--feed-content-gutter, 25px);
      padding-right: var(--feed-content-gutter, 25px);
    }
    html.mini-app-mobile header {
      align-items: center;
      padding-top: calc(4px + var(--uydosh-tg-inset-top, ${TELEGRAM_MOBILE_HEADER_MIN_TOP}px));
    }
    html.mini-app-mobile .feed-sticky {
      top: var(--uydosh-tg-filters-sticky-top, var(--uydosh-tg-sticky-top, ${TELEGRAM_MOBILE_HEADER_MIN_TOP}px));
      padding-left: calc(var(--feed-content-gutter, 25px) + var(--feed-wrap-gutter, max(5px, env(safe-area-inset-left, 0px))));
      padding-right: calc(var(--feed-content-gutter, 25px) + max(5px, env(safe-area-inset-right, 0px)));
    }
    html.mini-app header nav {
      display: flex;
      align-items: center;
      flex: 1 1 auto;
      min-width: 0;
      gap: 10px;
    }
    html.mini-app .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      flex: 0 1 auto;
      text-decoration: none;
    }
    html.mini-app .brand:hover { text-decoration: none; }
    html.mini-app .brand img {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      box-shadow: none;
      background: transparent;
    }
    html.mini-app .brand strong {
      font-size: 15px;
      letter-spacing: 0.2px;
    }
    html.mini-app .brand span {
      color: var(--muted);
      font-size: 13px;
      display: block;
    }
    html.mini-app .lang.lang-dropdown {
      margin-left: auto;
    }
    html.mini-app .lang.lang-dropdown > .lang-trigger {
      font-size: 11px;
      letter-spacing: 0.06em;
    }
    html.mini-app [data-hide-in-mini-app] {
      display: none !important;
    }
    html.mini-app.has-detail-contact .wrap {
      padding-bottom: calc(88px + max(env(safe-area-inset-bottom, 0px), var(--uydosh-tg-inset-bottom, 0px)));
    }
    .detail-contact-bar {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 40;
      padding:
        10px max(16px, env(safe-area-inset-left, 0px))
        calc(10px + max(env(safe-area-inset-bottom, 0px), var(--uydosh-tg-inset-bottom, 0px)))
        max(16px, env(safe-area-inset-right, 0px));
      background: color-mix(in srgb, var(--bg) 90%, transparent);
      border-top: 1px solid var(--stroke);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
    }
    .detail-contact-bar[hidden] {
      display: none !important;
    }
    .detail-contact-bar-inner {
      max-width: 1000px;
      margin: 0 auto;
    }
    .detail-contact-btn {
      width: 100%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 14px 18px;
      border-radius: 14px;
      border: 0;
      background: linear-gradient(135deg, #229ED9, #2AABEE);
      box-shadow: 0 10px 28px rgba(34, 158, 217, 0.35);
      color: #fff;
      font: inherit;
      font-weight: 700;
      font-size: 16px;
      cursor: pointer;
    }
    .detail-contact-btn:active {
      opacity: 0.92;
    }
    .detail-contact-btn .icon svg {
      width: 22px;
      height: 22px;
      display: block;
    }
  `;
}

const FIREBASE_VERSION = '11.6.0';
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAv3KDcxTbeLCuyh7QVVk-MwxR4fnC96yM',
  authDomain: 'uydosh-cd0fe.firebaseapp.com',
  projectId: 'uydosh-cd0fe',
  storageBucket: 'uydosh-cd0fe.firebasestorage.app',
  messagingSenderId: '626930983094',
  appId: '1:626930983094:web:0e1a429bcdf9602f580617',
  measurementId: 'G-EH9C2VMSD8',
};

let _logEventFn = null;
let _analyticsInitPromise = null;

/** Telegram WebApp context attached to every Mini App analytics event. */
function getTelegramAnalyticsContext() {
  const tg = window.Telegram?.WebApp;
  const user = tg?.initDataUnsafe?.user;
  return {
    platform: tg?.platform || 'unknown',
    tg_version: tg?.version || '',
    user_language: user?.language_code || '',
    start_param: tg?.initDataUnsafe?.start_param || '',
    ...(user?.id != null ? { tg_user_id: user.id } : {}),
    ...(user?.is_premium != null
      ? { is_premium: user.is_premium ? 1 : 0 }
      : {}),
  };
}

/** Loads Firebase Analytics once; no-op outside Telegram Mini App. */
function initMiniAppAnalytics() {
  if (!isMiniApp()) return Promise.resolve(false);
  if (_analyticsInitPromise) return _analyticsInitPromise;

  _analyticsInitPromise = (async () => {
    try {
      const appMod = await import(
        `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`
      );
      const analyticsMod = await import(
        `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-analytics.js`
      );
      if (!(await analyticsMod.isSupported())) {
        console.warn('[UyDosh] Firebase Analytics not supported in this environment');
        return false;
      }
      const app = appMod.initializeApp(FIREBASE_CONFIG);
      const analytics = analyticsMod.getAnalytics(app);
      _logEventFn = (name, params) => analyticsMod.logEvent(analytics, name, params);

      const tgUserId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
      if (tgUserId != null) {
        analyticsMod.setUserId(analytics, String(tgUserId));
      }

      _logEventFn('app_opened', {
        source: 'telegram_mini_app',
        ...getTelegramAnalyticsContext(),
      });
      return true;
    } catch (err) {
      console.warn('[UyDosh] Firebase Analytics init failed', err);
      return false;
    }
  })();

  return _analyticsInitPromise;
}

/** Log a custom GA4/Firebase event (Telegram Mini App only). */
function logMiniAppEvent(name, params) {
  if (!isMiniApp()) return;
  const payload = {
    source: 'telegram_mini_app',
    ...getTelegramAnalyticsContext(),
    ...params,
  };
  initMiniAppAnalytics().then((ok) => {
    if (ok && _logEventFn) _logEventFn(name, payload);
  });
}

/** Log a screen view for the Mini App feed or listing detail. */
function logMiniAppScreen(screenName, params) {
  logMiniAppEvent('screen_view', {
    firebase_screen: screenName,
    firebase_screen_class: 'telegram_mini_app',
    screen_name: screenName,
    ...params,
  });
}

/** Call on mini-app pages after telegram-web-app.js is loaded. */
function initTelegramMiniApp() {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    getTelegramInitData();
    try { tg.ready(); } catch { /* ignore */ }
    try { tg.expand(); } catch { /* ignore */ }
    initTelegramLocationManager();
    applyTelegramTheme(tg);
    applyStoredManualTheme();
    applyTelegramSafeAreaInsets(tg);
    if (typeof tg.onEvent === 'function') {
      tg.onEvent('themeChanged', () => {
        applyTelegramTheme(tg);
        applyStoredManualTheme();
      });
      tg.onEvent('contentSafeAreaChanged', () => {
        applyTelegramSafeAreaInsets(tg);
        syncMobileHeaderLayout();
        reflowActiveMaps();
      });
      tg.onEvent('safeAreaChanged', () => {
        applyTelegramSafeAreaInsets(tg);
        syncMobileHeaderLayout();
        reflowActiveMaps();
      });
      tg.onEvent('viewportChanged', () => {
        applyTelegramSafeAreaInsets(tg);
        syncMobileHeaderLayout();
        reflowActiveMaps();
      });
    }
    requestAnimationFrame(() => {
      applyTelegramSafeAreaInsets(tg);
      syncMobileHeaderLayout();
    });
    setTimeout(() => {
      applyTelegramSafeAreaInsets(tg);
      syncMobileHeaderLayout();
    }, 150);
  }
  if (!isMiniApp()) return false;
  document.documentElement.classList.add('mini-app');
  applyStoredManualTheme();
  ensureMiniAppSafeAreaStyles();
  applyTelegramSafeAreaInsets(tg);
  mountAllMiniAppHeaders();
  syncMobileHeaderLayout();
  for (const el of document.querySelectorAll('[data-hide-in-mini-app]')) {
    el.setAttribute('hidden', '');
  }
  for (const el of document.querySelectorAll('[data-mini-app-home]')) {
    el.setAttribute('href', MINI_APP_FEED_PATH);
  }
  // Custom back links are hidden in Mini App — Telegram header BackButton handles navigation.
  // for (const el of document.querySelectorAll('[data-mini-app-back]')) {
  //   el.setAttribute('href', MINI_APP_FEED_PATH);
  // }
  initMiniAppAnalytics().then((ok) => {
    if (!ok) return;
    const path = location.pathname || '';
    if (/create\.html/i.test(path) || /\/telegram\/create\/?$/i.test(path)) {
      logMiniAppScreen('telegram_create_listing');
    } else if (!/listing\.html/i.test(path)) {
      logMiniAppScreen('telegram_feed');
    }
  });
  return true;
}

// Exports on window so plain <script> tags can reach them without modules.
window.UyDosh = {
  API_BASE,
  getLang,
  setLang,
  applyI18n,
  initLangSwitcher,
  localized,
  localizedShort,
  localizedDescription,
  photoUrl,
  primaryPhoto,
  cardPhotoDotsHtml,
  formatPrice,
  formatMapPinPrice,
  formatPublicationDate,
  formatListingCardPublicationDate,
  mapPinTooltipHtml,
  mapPinCarouselHtml,
  mapPinTooltipCardHtml,
  groupPinsByCoordinate,
  listingPinCoordinateKey,
  isFeatured,
  fetchListings,
  fetchListing,
  fetchListingsForMap,
  fetchSubwayStationsByLine,
  fetchLocations,
  fetchAmenitiesOrdered,
  createListing,
  createListingFromTelegramMiniApp,
  createProfile,
  uploadListingPhoto,
  readFileAsDataUrl,
  resizeImageFileForUpload,
  authenticateTelegramMiniApp,
  getTelegramInitData,
  clearTelegramInitData,
  isTelegramInitDataUsable,
  getSessionToken,
  setSessionToken,
  loadYandexMapModule,
  resetYandexMaps,
  reflowActiveMaps,
  withTimeout,
  waitForElementLayout,
  escapeHtml,
  feedEmptyStateHtml,
  metroLineColor,
  metroLineLabel,
  metroLineBadgeHtml,
  METRO_LINE_IDS,
  METRO_LINE_ANY,
  LISTING_TYPE_ALL,
  LISTING_TYPE_ROOM_NEEDED,
  LISTING_TYPE_ROOMMATE_NEEDED,
  LISTING_TYPE_GROUP_FORMING,
  GENDER_ANY,
  GENDER_MALE,
  GENDER_FEMALE,
  resolveMetroLine,
  iconPin,
  iconMetro,
  iconClock,
  iconCalendar,
  iconLock,
  iconCamera,
  listingTypeColor,
  createMapPinIcon,
  createMapGroupPinIcon,
  createMapClusterPinIcon,
  createUserLocationPinIcon,
  requestUserLocation,
  openTelegramLocationSettings,
  normalizeTelegramUsername,
  listingContactTelegram,
  telegramUserUrl,
  openTelegramContact,
  iconTelegram,
  detailContactBarHtml,
  bindDetailContactBar,
  warmMapPinIconCache,
  loadVisitedListingIds,
  markListingVisited,
  prefersDarkMapPins,
  getManualTheme,
  setManualTheme,
  toggleManualTheme,
  applyStoredManualTheme,
  genderColor,
  genderBadgeLabel,
  genderBadgeHtml,
  listingTypeBadgeLabel,
  listingTypeBadgeIcon,
  filterListingTypeIcon,
  filterGenderIcon,
  filterPhotoIcon,
  formatDate,
  getAmenityCode,
  sortAmenities,
  sortAmenitiesForForm,
  amenityIconHtml,
  amenityChipHtml,
  amenityIconsRowHtml,
  isIOS,
  tryOpenListingInApp,
  isMiniApp,
  isTelegramMobile,
  isTelegramDesktop,
  listingPageUrl,
  feedPageUrl,
  createPageUrl,
  initTelegramMiniApp,
  mountMiniAppHeader,
  mountAllMiniAppHeaders,
  miniAppHeaderHtml,
  initMiniAppAnalytics,
  logMiniAppEvent,
  logMiniAppScreen,
  MINI_APP_FEED_PATH,
  MINI_APP_CREATE_PATH,
  t,
  iconArticle,
  descriptionTemplateText,
  presetListingTitleText,
};
