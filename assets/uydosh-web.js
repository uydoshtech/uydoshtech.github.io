// UyDosh Web — shared helpers for listings.html and listing.html.
// Keep this file dependency-free and small; GitHub Pages serves it as a
// plain static asset.

// NOTE on API base URL:
// The production backend currently runs on http://3.140.249.173:3000 (plain HTTP).
// Modern browsers block HTTP requests from HTTPS pages (mixed content), so when
// this site is served from https://uydoshtech.github.io the API MUST be reachable
// over HTTPS. Put Cloudflare/ALB in front and point API_BASE at the HTTPS URL.
const API_BASE = (() => {
  // Allow overriding via <meta name="uydosh-api-base" content="https://..."> for
  // quick environment switching without editing this file.
  const meta = document.querySelector('meta[name="uydosh-api-base"]');
  if (meta && meta.content) return meta.content.replace(/\/$/, '');
  // When serving over http:// (local dev) default to the dev EC2 host.
  if (location.protocol === 'http:') return 'http://3.140.249.173:3000';
  // When serving over https:// we need an https origin. Override via <meta>.
  return 'https://api.uydosh.app';
})();

const LANGS = ['uz', 'ru', 'en'];

function getLang() {
  try {
    const saved = localStorage.getItem('uydosh_lang');
    if (saved && LANGS.includes(saved)) return saved;
  } catch { /* storage blocked */ }
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
  return obj[`name_${lang}`] || obj.name_uz || obj.name_en || obj.name_ru || fallback;
}

function localizedShort(obj, lang, fallback = '') {
  if (!obj) return fallback;
  return (
    obj[`short_name_${lang}`] ||
    obj.short_name_uz ||
    obj[`name_${lang}`] ||
    obj.name_uz ||
    fallback
  );
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

// Photo URLs in the DB can be either a full URL (e.g. Telegram ingest) or a
// relative path like "/images/listings/foo.jpg" served by the API. Prepend
// API_BASE for relatives.
function photoUrl(photo) {
  const u = typeof photo === 'string' ? photo : photo?.photo_url;
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  return `${API_BASE}${u.startsWith('/') ? '' : '/'}${u}`;
}

function primaryPhoto(listing) {
  const photos = Array.isArray(listing?.photos) ? listing.photos : [];
  if (photos.length === 0) return null;
  const sorted = [...photos].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return (a.photo_order ?? 0) - (b.photo_order ?? 0);
  });
  return sorted[0];
}

function formatPrice(listing, lang) {
  const n = Number(listing?.price);
  if (!Number.isFinite(n) || n <= 0) return '';
  const nf = new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'ru-RU');
  return `$${nf.format(n)}`;
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
  let res;
  try {
    res = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
  } catch (err) {
    // GitHub Pages is served over HTTPS. If the API is only reachable over HTTP
    // or a hostname is not configured in DNS yet, browsers will fail the request.
    // Fall back to a small, pre-generated dataset so the site still renders.
    if (path === '/listings') {
      const fallback = await fetch('/assets/top_listings.json', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (fallback.ok) return fallback.json();
    }
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function fetchListings({ page = 1, limit = 20 } = {}) {
  return fetchJson('/listings', { page, limit, isActive: 'true', withPhoto: 'true' });
}

function fetchListing(id) {
  return fetchJson(`/listings/${encodeURIComponent(id)}`);
}

const I18N = {
  uz: {
    'brand.tagline': 'Ijara & xonadoshlar',
    'nav.listings': 'E’lonlar',
    'nav.home': 'Asosiy',
    'nav.privacy': 'Maxfiylik',
    'nav.delete': 'Akkauntni o‘chirish',
    'nav.contact': 'Aloqa',
    'feed.title': 'Yangi e’lonlar',
    'feed.subtitle': 'Haqiqiy uy-joy va xonadoshlar — eng yangisi yuqorida.',
    'feed.loading': 'Yuklanmoqda…',
    'feed.empty': 'Hozircha e’lonlar yo‘q.',
    'feed.error': 'Ma’lumotlarni yuklab bo‘lmadi. Keyinroq qayta urinib ko‘ring.',
    'feed.retry': 'Qayta urinish',
    'feed.end': 'Hammasi shu. Yangilari uchun ilovamizni oching.',
    'card.featured': 'Yuqoriga chiqarilgan',
    'card.privateRoom': 'Alohida xona',
    'card.rooms': 'xona',
    'card.perMonth': '/oy',
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
    'cta.openListings': 'E’lonlarni ko‘rish',
  },
  ru: {
    'brand.tagline': 'Аренда и соседи',
    'nav.listings': 'Объявления',
    'nav.home': 'Главная',
    'nav.privacy': 'Конфиденциальность',
    'nav.delete': 'Удалить аккаунт',
    'nav.contact': 'Контакты',
    'feed.title': 'Свежие объявления',
    'feed.subtitle': 'Реальное жильё и соседи — самые новые сверху.',
    'feed.loading': 'Загрузка…',
    'feed.empty': 'Пока нет объявлений.',
    'feed.error': 'Не удалось загрузить данные. Попробуйте позже.',
    'feed.retry': 'Попробовать ещё раз',
    'feed.end': 'Это всё. За новыми — в приложение.',
    'card.featured': 'В топе',
    'card.privateRoom': 'Отдельная комната',
    'card.rooms': 'комн.',
    'card.perMonth': '/мес',
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
    'cta.openListings': 'Смотреть объявления',
  },
  en: {
    'brand.tagline': 'Rentals & roommates',
    'nav.listings': 'Listings',
    'nav.home': 'Home',
    'nav.privacy': 'Privacy',
    'nav.delete': 'Delete account',
    'nav.contact': 'Contact',
    'feed.title': 'Fresh listings',
    'feed.subtitle': 'Real rentals and roommates — newest first.',
    'feed.loading': 'Loading…',
    'feed.empty': 'No listings yet.',
    'feed.error': 'Could not load listings. Please try again later.',
    'feed.retry': 'Try again',
    'feed.end': 'That’s everything. Get the app for alerts on new ones.',
    'card.featured': 'Featured',
    'card.privateRoom': 'Private room',
    'card.rooms': 'rooms',
    'card.perMonth': '/mo',
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
    'cta.openListings': 'Browse listings',
  },
};

function t(key, lang = getLang()) {
  return I18N[lang]?.[key] ?? I18N.uz[key] ?? key;
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
  for (const btn of root.querySelectorAll('.lang button[data-lang]')) {
    btn.setAttribute('aria-pressed', btn.getAttribute('data-lang') === lang ? 'true' : 'false');
  }
}

function initLangSwitcher() {
  for (const btn of document.querySelectorAll('.lang button[data-lang]')) {
    btn.addEventListener('click', () => {
      setLang(btn.getAttribute('data-lang'));
      applyI18n();
    });
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

function formatDate(value, lang) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const locale = lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'uz-UZ';
  return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
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
  formatPrice,
  isFeatured,
  fetchListings,
  fetchListing,
  escapeHtml,
  formatDate,
  t,
};
