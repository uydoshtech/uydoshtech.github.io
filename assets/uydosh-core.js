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
  const isLockedApiBasePath = (() => {
    try {
      const path = location.pathname || '';
      // Telegram + Makon3D mini-app paths ignore sticky localStorage API overrides
      // (a stale ?api= from browser testing can break prod auth / empty galleries).
      return (
        /\/telegram(\/|$)/i.test(path) ||
        /\/telegram\.html$/i.test(path) ||
        /\/makon3d(\/|$)/i.test(path)
      );
    } catch {
      return false;
    }
  })();

  // Mini App pages always hit production API (meta/default). A stale ?api= localStorage
  // override from browser testing breaks Telegram initData verification (401).
  if (isLockedApiBasePath) {
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

/**
 * Centralized Telegram Mini App haptic feedback helpers. Wraps every profile
 * exposed by `Telegram.WebApp.HapticFeedback` — the five `impactOccurred`
 * styles, the three `notificationOccurred` types, and `selectionChanged` —
 * behind one small API so every page/module triggers feedback the same way
 * instead of scattering raw `window.Telegram?.WebApp?.HapticFeedback?...`
 * one-liners everywhere. No-ops outside Telegram (or on older clients that
 * don't support a given style/type) since the underlying SDK calls are
 * themselves best-effort/no-ops there — see
 * https://core.telegram.org/bots/webapps#hapticfeedback.
 */
const HAPTIC_IMPACT_STYLES = ['light', 'medium', 'heavy', 'rigid', 'soft'];
const HAPTIC_NOTIFICATION_TYPES = ['success', 'warning', 'error'];

/** @param {'light'|'medium'|'heavy'|'rigid'|'soft'} [style] */
function hapticImpact(style = 'light') {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(
      HAPTIC_IMPACT_STYLES.includes(style) ? style : 'light',
    );
  } catch { /* ignore */ }
}

/** @param {'success'|'warning'|'error'} [type] */
function hapticNotification(type = 'success') {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred(
      HAPTIC_NOTIFICATION_TYPES.includes(type) ? type : 'success',
    );
  } catch { /* ignore */ }
}

function hapticSelection() {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.selectionChanged();
  } catch { /* ignore */ }
}

/**
 * Short "nothing here" haptic burst — two quick, evenly-spaced light impacts, distinct
 * from every other single-pulse profile above so an empty search/filter result reads as
 * a deliberate signal rather than an ordinary tap. Telegram's `HapticFeedback` API has no
 * concept of a custom vibration pattern (unlike the raw Web Vibration API), so this fakes
 * one by firing `impactOccurred` twice a beat apart — 90ms mirrors the gap iOS's own
 * "no match" haptic uses and is comfortably above the ~50ms floor some devices need
 * between pulses to register each one separately instead of coalescing them into one.
 * Callers are responsible for firing this at most once per empty result (e.g. when a
 * search/filter freshly settles on zero matches), not on every re-render of an
 * already-empty state — see call sites for the guard each one uses.
 */
const HAPTIC_NOT_FOUND_PULSE_GAP_MS = 90;
function hapticNotFound() {
  hapticImpact('light');
  setTimeout(() => hapticImpact('light'), HAPTIC_NOT_FOUND_PULSE_GAP_MS);
}

/**
 * `UyDosh.haptic.<profile>()` for every Telegram haptic profile, plus the
 * raw `impact`/`notification` escape hatches for dynamic style/type values.
 * See `bindMiniAppHapticFeedback` (uydosh-mini-app.js) for the delegated
 * click listener that fires `light` on every button/link tap automatically —
 * these are for feedback tied to a specific outcome (success/error) or a
 * non-default tap profile (medium/heavy/selection) instead.
 *
 * Named `hapticProfiles` (not `haptic`) at the top level and exposed as
 * `UyDosh.haptic` only below — classic <script> top-level `const` bindings
 * are shared across every script on the page, and `telegram-create.js`
 * already declares its own top-level `function haptic(...)` compat shim, so
 * a same-named `const` here would throw "Identifier 'haptic' has already
 * been declared" and break that page's script entirely.
 */
const hapticProfiles = {
  light: () => hapticImpact('light'),
  medium: () => hapticImpact('medium'),
  heavy: () => hapticImpact('heavy'),
  rigid: () => hapticImpact('rigid'),
  soft: () => hapticImpact('soft'),
  success: () => hapticNotification('success'),
  warning: () => hapticNotification('warning'),
  error: () => hapticNotification('error'),
  selection: hapticSelection,
  impact: hapticImpact,
  notification: hapticNotification,
  notFound: hapticNotFound,
};

const LANGS = ['uz', 'ru', 'en'];
const MINI_APP_DEFAULT_LANG = 'ru';
const LANG_META = {
  uz: { flag: '🇺🇿', label: "O'zbekcha" },
  ru: { flag: '🇷🇺', label: 'Русский' },
  en: { flag: '🇬🇧', label: 'English' },
};

/** Flag + native name for a known language code (`uz`/`ru`/`en`), or '' when
 *  the value is missing/unknown — callers keep their own "not specified" copy. */
function languageLabelWithFlag(code) {
  const meta = LANG_META[String(code || '').trim().toLowerCase()];
  return meta ? `${meta.flag} ${meta.label}` : '';
}
const LANG_SWITCHER_STYLE_ID = 'uydosh-lang-switcher-styles';

/** True on every Telegram Mini App route or a `?mini=1` embedded listing page. */
function isMiniAppPage() {
  try {
    if (new URLSearchParams(location.search).get('mini') === '1') return true;
  } catch { /* ignore */ }
  try {
    const path = location.pathname || '';
    if (/\/telegram\.html$/i.test(path)) return true;
    if (/\/telegram(?:\/|$)/i.test(path)) return true;
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

/**
 * Displays a name in "Title Case" (every word capitalized) instead of
 * whatever raw casing the source data uses — the university list, for one,
 * is stored/returned in ALL CAPS (e.g. "WEBSTER UNIVERSITY IN TASHKENT") but
 * reads much better as "Webster University In Tashkent" in the UI.
 * Unicode-aware (`\p{L}`) so Cyrillic/Uzbek names capitalize correctly too.
 */
function titleCaseWords(str) {
  return String(str ?? '')
    .toLowerCase()
    .replace(/(^|[\s\-'"(])\p{L}/gu, (m) => m.toUpperCase());
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

function isGroupFormingListing(listing) {
  return listingTypeIdFromListing(listing) === 3
    || listingTypeCodeFromListing(listing) === 'group_forming';
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
  group_forming: {
    1: '/images/no-photo-group-forming-male.jpg',
    2: '/images/no-photo-group-forming-female.jpg',
  },
};

/** Works with both full listing objects and map pin objects (both expose gender + listing type). */
function noPhotoPlaceholderImageUrl(listingOrPin) {
  if (!listingOrPin) return '';
  const typeCode = isRoomNeededListing(listingOrPin)
    ? 'room_needed'
    : isRoommateNeededListing(listingOrPin)
      ? 'roommate_needed'
      : isGroupFormingListing(listingOrPin)
        ? 'group_forming'
        : '';
  if (!typeCode) return '';
  const gender = Number(listingOrPin.gender);
  return NO_PHOTO_PLACEHOLDER_IMAGES[typeCode]?.[gender] ?? '';
}

/** Card/detail badge label; roommate_needed is gendered (ru: «Ищем соседа» / «Ищем соседку»).
 *  Group-forming uses "Group n/m" when occupancy counts are on the listing. */
function listingTypeBadgeLabel(listing, lang = getLang()) {
  if (!listing) return '';
  if (isRoommateNeededListing(listing)) {
    const gender = Number(listing.gender);
    return gender === 2
      ? t('card.type.roommateNeededFemale', lang)
      : t('card.type.roommateNeededMale', lang);
  }
  if (isGroupFormingListing(listing)) {
    const occupancy = groupFormingOccupancyLabel(listing);
    if (occupancy) {
      return t('card.type.groupOccupancy', lang)
        .replace('{n}', occupancy.n)
        .replace('{m}', occupancy.m);
    }
    return t('filter.type.groupForming', lang);
  }
  return localized(listing.listing_type, lang);
}

/** Occupancy numbers for group-forming pills: filled members / target size. */
function groupFormingOccupancyLabel(listing) {
  const target = Number(
    listing?.group_context?.group_size_target ?? listing?.group_size_target,
  );
  if (!Number.isFinite(target) || target < 1) return null;
  let filled = Number(
    listing?.group_context?.group_member_count ?? listing?.group_member_count,
  );
  if (!Number.isFinite(filled) || filled < 1) filled = 1;
  if (filled > target) filled = target;
  return { n: String(filled), m: String(target) };
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

// Backend resolves the actual Telegram profile photo on demand (server-side
// cached, see `GET /telegram/avatar/:username`). Returns '' for an empty/invalid
// handle so callers can skip rendering an <img> entirely.
function telegramAvatarUrl(username) {
  const handle = typeof username === 'string' ? username.trim().replace(/^@+/, '') : '';
  if (!handle) return '';
  return `${API_BASE}/telegram/avatar/${encodeURIComponent(handle)}`;
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

/**
 * "N complaint(s)" label for the listing detail page's complaints warning button,
 * matching the mobile app's `complaints_count_short` wording per language.
 */
function listingComplaintsCountText(count, lang = getLang()) {
  const n = Math.max(0, Math.trunc(Number(count) || 0));
  if (lang === 'ru') return `${n} жалоб`;
  if (lang === 'uz') return `${n} ta shikoyat`;
  return n === 1 ? `${n} complaint` : `${n} complaints`;
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
    // `pressed: true` forces the icon glyph itself to white (see filterListingTypeIcon/
    // filterGenderIcon) — paired with the type/gender color as the circle's own background
    // (below) instead of the icon's color, so both badges read as small solid, colored dots
    // (like the map pins themselves) rather than a bare colored glyph.
    const icon = filterListingTypeIcon(typeId, { pressed: true });
    const color = listingTypeColor(typeId);
    if (icon) parts.push(`<span class="map-pin-badge" style="--map-pin-badge-color:${escapeHtml(color || '')}">${icon}</span>`);
  }
  const gender = Number(pin?.gender);
  if (gender > 0) {
    const icon = filterGenderIcon(gender, { pressed: true });
    const color = genderColor(gender);
    if (icon) parts.push(`<span class="map-pin-badge" style="--map-pin-badge-color:${escapeHtml(color || '')}">${icon}</span>`);
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

function mapPinTooltipCardHtml(pin, { listing = null, lang = getLang(), showClose = false, counterLabel = '' } = {}) {
  if (!pin) return '';
  const title = escapeHtml(pin.title || '');
  const price = formatMapPinPrice(pin, lang);
  const badges = mapPinBadgesHtml(pin);
  const photoSrc = pin.photo_url ? photoUrl(pin.photo_url) : '';
  const listingUrl = listingPageUrl(pin.id);
  // Full listing detail (fetched async, see enrichMapPinTooltipListings) wins once it lands —
  // until then, fall back to the district/subway-station lookups cached by
  // warmLocationSubwayCaches() so the pin's own location_id/subway_station_id (already present
  // on the lightweight /listings/map payload) can resolve a name immediately instead of the
  // tooltip's location/metro line staying blank until that fetch completes.
  const cachedLocation = !listing ? getCachedLocationById?.(pin.location_id, lang) : null;
  const cachedSubwayStation = !listing ? getCachedSubwayStationById?.(pin.subway_station_id, lang) : null;
  const locName = listing ? localizedShort(listing.location, lang) : localizedShort(cachedLocation, lang);
  const metro = listing ? localized(listing.subway_station, lang) : localized(cachedSubwayStation, lang);
  const metroLine = listing
    ? resolveMetroLine(listing)
    : Number(cachedSubwayStation?.line) || Number(pin.subway_line_id) || null;
  const posted = listing?.created_at ? formatPublicationDate(listing.created_at, lang) : '';

  const metaParts = [];
  if (locName) {
    metaParts.push(`<span>${iconPin()}${escapeHtml(locName)}</span>`);
  }
  if (metro) {
    metaParts.push(`<span>${iconMetro(metroLine)}${escapeHtml(metro)}</span>`);
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
  // Sits just left of the close button (mirrors the mobile app's
  // `_PinCarouselCounterBadge` pill, positioned the same way relative to
  // its own close button's tap target) — kept as part of each card rather
  // than a single shared element below the carousel, so it scrolls with
  // its own slide and never needs a scroll-listener text update.
  const counterBadge = counterLabel
    ? `<span class="map-pin-tooltip-counter" aria-hidden="true">${escapeHtml(counterLabel)}</span>`
    : '';

  return `
    <div class="map-pin-tooltip-card" aria-label="${title}">
      ${closeBtn}${counterBadge}
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

// Above this many cards, a full dot-per-card row would overflow/clutter the
// tooltip (the carousel now spans every listing on the map, not just a small
// composite-pin group), so a compact "3 / 128" counter is shown instead.
const MAP_CAROUSEL_DOT_LIMIT = 8;

function mapPinCarouselHtml(pins, { listingsById = null, lang = getLang(), activeIndex = 0 } = {}) {
  const items = Array.isArray(pins) ? pins.filter(Boolean) : [];
  if (items.length === 0) return '';
  const listings = listingsById && typeof listingsById === 'object' ? listingsById : {};
  const showDots = items.length > 1 && items.length <= MAP_CAROUSEL_DOT_LIMIT;
  // Above the dot limit, each card gets its own "N / total" pill next to its
  // close button (see `mapPinTooltipCardHtml`) instead of dots — already
  // correct for whichever slide is scrolled into view, no scroll-listener
  // text update needed.
  const showCounter = items.length > 1 && !showDots;
  const slides = items.map((pin, index) => `
    <div class="map-pin-carousel-slide" data-carousel-index="${index}" aria-hidden="${index === activeIndex ? 'false' : 'true'}">
      ${mapPinTooltipCardHtml(pin, {
        listing: listings[pin.id] ?? null,
        lang,
        showClose: true,
        counterLabel: showCounter ? `${index + 1} / ${items.length}` : '',
      })}
    </div>
  `).join('');
  const dots = showDots
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

const ADDRESS_COUNTRY_SEGMENTS = new Set([
  'узбекистан', 'uzbekistan', "o'zbekiston", 'oʻzbekiston', 'ozbekiston', 'ўзбекистон',
]);
const ADDRESS_HOUSE_NUMBER_RE = /^\d+[a-zA-Zа-яА-ЯёЁ]?$/;
const ADDRESS_DISTRICT_SUFFIX_RE = /\sрайон$/i;

/**
 * How a raw Yandex address (Geosuggest's `formatted_address`/`title.text`,
 * the reverse-geocoder's `meta.text`, or whatever's already saved on a
 * listing) is presented on the create-listing address preview/picker.
 * Yandex's text reads broad → narrow and includes the country when present,
 * e.g. "Узбекистан, Ташкент, Учтепинский район, массив Чиланзар, 26-й
 * квартал, 8". The app only ever serves Tashkent, so both the country and
 * the (redundant) city are dropped entirely, a trailing house number is
 * split out and labelled, and the rest reads narrow → broad the way people
 * actually write addresses: "26-й квартал, дом 8, Учтепинский р-н, массив
 * Чиланзар".
 *
 * Applying this at display time (rather than only when the address is first
 * resolved) means old listings saved before this formatting existed render
 * identically to new ones.
 *
 * NOTE: the listing detail page uses `formatListingDetailAddressText`
 * instead (keeps the city, doesn't label the house number) — see that
 * function for why the two intentionally differ.
 */
function formatAddressText(address) {
  const text = typeof address === 'string' ? address.trim() : '';
  if (!text) return text;

  let segments = text.split(',').map((segment) => segment.trim()).filter(Boolean);
  if (segments.length === 0) return text;

  if (ADDRESS_COUNTRY_SEGMENTS.has(segments[0].toLowerCase())) {
    segments = segments.slice(1);
  }
  if (segments.length === 0) return text;

  // The city is redundant once other segments are present — drop it
  // entirely instead of just moving it, unlike everything else below.
  const rest = segments.length > 1 ? segments.slice(1) : segments;
  if (rest.length === 0) return text;

  let house = null;
  if (rest.length > 1 && ADDRESS_HOUSE_NUMBER_RE.test(rest[rest.length - 1])) {
    house = rest.pop();
  }

  const street = rest.pop();
  const parts = [street, ...rest].map((segment) => segment.replace(ADDRESS_DISTRICT_SUFFIX_RE, ' р-н'));
  if (house) parts.splice(1, 0, `дом ${house}`);

  return parts.join(', ');
}

const ADDRESS_STREET_TYPE_PREFIX_RE = /^(массив|мкр\.?|жилой массив|квартал)\s+/i;

/**
 * Listing detail page's own address format — "Street, District, City", e.g.
 * "массив Чиланзар, Учтепинский р-н, Ташкент" — as opposed to
 * `formatAddressText`'s "Street, House, District" (used on the
 * create-listing preview), which drops the city entirely. Operates on the
 * same raw broad → narrow Yandex text, dropping only the leading country
 * segment, merging a trailing house number into the street/massif segment,
 * and reversing what's left so the city stays as the last (most general)
 * segment.
 */
function formatListingDetailAddressText(address) {
  const text = typeof address === 'string' ? address.trim() : '';
  if (!text) return text;

  let segments = text.split(',').map((segment) => segment.trim()).filter(Boolean);
  if (segments.length === 0) return text;

  if (ADDRESS_COUNTRY_SEGMENTS.has(segments[0].toLowerCase())) {
    segments = segments.slice(1);
  }
  if (segments.length === 0) return text;
  if (segments.length < 2) return segments.join(', ');

  const rest = [...segments];
  let house = null;
  if (rest.length > 2 && ADDRESS_HOUSE_NUMBER_RE.test(rest[rest.length - 1])) {
    house = rest.pop();
  }

  if (rest.length < 2) {
    return [...rest, house].filter(Boolean).join(', ');
  }

  const streetLike = rest.pop().replace(ADDRESS_STREET_TYPE_PREFIX_RE, '').trim();
  const firstSegment = house ? `${streetLike} ${house}` : streetLike;
  const broaderSegments = rest
    .reverse()
    .map((segment) => segment.replace(ADDRESS_DISTRICT_SUFFIX_RE, ' р-н'));

  return [firstSegment, ...broaderSegments].join(', ');
}

// Walk-time estimate constants + straight-line distance math shared by the
// create-listing wizard's "find nearby metro stations" suggestions
// (telegram-create.js) and the listing detail page's per-station walk info
// (listing.html) — kept here (not in the lazily-loaded yandex-map.js) so
// either page can use it without pulling in the full Maps module.
const EARTH_RADIUS_METERS = 6371000;
const WALK_METERS_PER_MINUTE = 80; // ~4.8 km/h
const WALK_DETOUR_FACTOR = 1.3; // streets/blocks vs. straight-line distance

// Mirrors `UZBEKISTAN_BOUNDS` in yandex-map.js and the backend's
// `uzbekistanBounds.ts`/`resolveListingMapCoordinates` — guards against a
// corrupt/stray `address_latitude`/`address_longitude` (e.g. 0,0, or some
// other country entirely) producing a nonsense multi-thousand-km "walk"
// distance below. Loose on purpose (a simple rectangle covering all of
// Uzbekistan, not the real border) so it never rejects a genuine listing.
const UZBEKISTAN_BOUNDS = {
  minLatitude: 37,
  maxLatitude: 46,
  minLongitude: 55,
  maxLongitude: 74,
};

function isValidUzbekistanCoordinate(latitude, longitude) {
  return (
    latitude >= UZBEKISTAN_BOUNDS.minLatitude
    && latitude <= UZBEKISTAN_BOUNDS.maxLatitude
    && longitude >= UZBEKISTAN_BOUNDS.minLongitude
    && longitude <= UZBEKISTAN_BOUNDS.maxLongitude
  );
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, a)));
}

function estimatedWalkMinutes(meters) {
  return (meters * WALK_DETOUR_FACTOR) / WALK_METERS_PER_MINUTE;
}

/** Inverse of estimatedWalkMinutes() — approx. straight-line radius reachable within
 * `minutes` of walking, e.g. for the metro station "N min walk area" map circle. */
function estimatedWalkRadiusMeters(minutes) {
  return (minutes * WALK_METERS_PER_MINUTE) / WALK_DETOUR_FACTOR;
}

/**
 * Best-known reference point for "where the listing actually is", used to
 * measure walking distance to the metro stations it names. Mirrors
 * `resolveListingMapCoordinates` in yandex-map.js (kept independent so this
 * doesn't force-load the lazy Maps module just to compute a distance):
 * `display_lat`/`display_lng` first (the jittered pin for approximate
 * listings, or the real address for exact ones), then address, subway
 * station, district centroid. `location_precision === 'unknown'` has no pin.
 */
function listingReferenceCoordinates(listing) {
  if (!listing) return null;
  if (listing.location_precision === 'unknown') return null;
  const candidates = [
    [listing.display_lat, listing.display_lng],
    [listing.address_latitude, listing.address_longitude],
    [listing.subway_station?.latitude, listing.subway_station?.longitude],
    [listing.location?.latitude, listing.location?.longitude],
  ];
  for (const [lat, lon] of candidates) {
    const latitude = Number(lat);
    const longitude = Number(lon);
    if (
      Number.isFinite(latitude)
      && Number.isFinite(longitude)
      && isValidUzbekistanCoordinate(latitude, longitude)
    ) {
      return { latitude, longitude };
    }
  }
  return null;
}

/**
 * Walking distance (km) + time (minutes) from `from` to `station`'s own
 * coordinates, or null when either point is missing/invalid, or the two
 * points are effectively the same spot (e.g. `from` fell back to this very
 * station's coordinates — see `listingReferenceCoordinates` — showing
 * "0 min" there isn't useful signal).
 */
function stationWalkInfo(from, station) {
  const lat = Number(station?.latitude);
  const lon = Number(station?.longitude);
  if (!from || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (!isValidUzbekistanCoordinate(lat, lon)) return null;
  const meters = haversineMeters(from.latitude, from.longitude, lat, lon);
  if (meters < 50) return null;
  return { km: meters / 1000, minutes: estimatedWalkMinutes(meters) };
}

window.UyDosh = window.UyDosh || {};
Object.assign(window.UyDosh, {
  API_BASE,
  haptic: hapticProfiles,
  getLang,
  setLang,
  localized,
  localizedShort,
  titleCaseWords,
  localizedDescription,
  photoUrl,
  telegramAvatarUrl,
  primaryPhoto,
  noPhotoPlaceholderImageUrl,
  cardPhotoDotsHtml,
  formatPrice,
  listingViewsCountText,
  listingComplaintsCountText,
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
  languageLabelWithFlag,
  formatAddressText,
  formatListingDetailAddressText,
  haversineMeters,
  estimatedWalkMinutes,
  estimatedWalkRadiusMeters,
  listingReferenceCoordinates,
  stationWalkInfo,
});
