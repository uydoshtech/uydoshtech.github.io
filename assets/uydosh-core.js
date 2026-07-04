// UyDosh Web — core config, language detection, and listing formatting/HTML
// helpers shared by the feed, detail page, and map tooltips.
// Loaded first (before uydosh-api.js) by listings.html, listing.html, and the
// Telegram Mini App pages.

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
    if (/\/telegram\/account\.html$/i.test(path)) return true;
    if (/\/telegram\/account\/?$/i.test(path)) return true;
    if (/\/telegram\/profile\.html$/i.test(path)) return true;
    if (/\/telegram\/profile\/?$/i.test(path)) return true;
  } catch { /* ignore */ }
  return false;
}

function getLang() {
  // Mini App: the UyDosh bot always attaches `?lang=` for the language the
  // user picked in the bot's language picker — it must win over a stale
  // localStorage value from a previous session (e.g. the user picked a
  // different language in the bot since last opening the mini app).
  if (isMiniAppPage()) {
    try {
      const urlLang = new URLSearchParams(location.search).get('lang');
      if (urlLang && LANGS.includes(urlLang)) return urlLang;
    } catch { /* ignore */ }
  }
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

function isRoomNeededListing(listing) {
  return listingTypeIdFromListing(listing) === 1
    || listingTypeCodeFromListing(listing) === 'room_needed';
}

// Branded artwork shown instead of the plain "UyDosh" placeholder for listings
// with no photo (Telegram Mini App only), keyed by listing type + gender.
// Add an entry here whenever a new type/gender illustration is provided; any
// combination missing from this map just falls back to the plain "UyDosh" text.
const NO_PHOTO_PLACEHOLDER_IMAGES = {
  room_needed: {
    1: '/images/no-photo-room-needed-male.jpg',
    2: '/images/no-photo-room-needed-female.jpg',
  },
  roommate_needed: {
    1: '/images/no-photo-roommate-needed-male.jpg',
    2: '/images/no-photo-roommate-needed-female.jpg',
  },
};

/** Works with both full listing objects and map pin objects (both expose gender + listing type). */
function noPhotoPlaceholderImageUrl(listingOrPin) {
  if (!listingOrPin) return '';
  const typeCode = isRoomNeededListing(listingOrPin)
    ? 'room_needed'
    : isRoommateNeededListing(listingOrPin)
      ? 'roommate_needed'
      : '';
  if (!typeCode) return '';
  const gender = Number(listingOrPin.gender);
  return NO_PHOTO_PLACEHOLDER_IMAGES[typeCode]?.[gender] ?? '';
}

/** Card/detail badge label; roommate_needed is gendered (ru: «Ищем соседа» / «Ищем соседку»). */
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

/**
 * "N view(s)" label for the owner-only view count toolbar, matching the mobile
 * app's `listing_views_count` plural strings (RU needs proper one/few/many forms;
 * `account.renewInDays`-style single templates would read wrong for 2–4 views).
 */
function listingViewsCountText(count, lang = getLang()) {
  const n = Math.max(0, Math.trunc(Number(count) || 0));
  if (lang === 'ru') {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return `${n} просмотр`;
    if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return `${n} просмотра`;
    return `${n} просмотров`;
  }
  if (lang === 'uz') return `${n} ko'rilgan`;
  return n === 1 ? `${n} view` : `${n} views`;
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

  const placeholderSrc = !photoSrc ? noPhotoPlaceholderImageUrl(pin) : '';
  const thumb = photoSrc
    ? `<div class="map-pin-tooltip-photo"><img loading="lazy" decoding="async" src="${escapeHtml(photoSrc)}" alt="" onerror="this.parentElement.classList.add('empty'); this.remove();" /></div>`
    : placeholderSrc
      ? `<div class="map-pin-tooltip-photo placeholder"><img loading="lazy" decoding="async" src="${escapeHtml(placeholderSrc)}" alt="" /></div>`
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

window.UyDosh = window.UyDosh || {};
Object.assign(window.UyDosh, {
  API_BASE,
  getLang,
  setLang,
  localized,
  localizedShort,
  localizedDescription,
  photoUrl,
  primaryPhoto,
  noPhotoPlaceholderImageUrl,
  cardPhotoDotsHtml,
  formatPrice,
  listingViewsCountText,
  formatMapPinPrice,
  formatPublicationDate,
  formatListingCardPublicationDate,
  mapPinTooltipHtml,
  mapPinCarouselHtml,
  mapPinTooltipCardHtml,
  groupPinsByCoordinate,
  listingPinCoordinateKey,
  isFeatured,
  listingTypeBadgeLabel,
});
