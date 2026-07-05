UyDosh.initTelegramMiniApp();

// LISTING_TYPE_ROOM_NEEDED / LISTING_TYPE_ROOMMATE_NEEDED are already global consts
// declared by uydosh-icons.js (loaded before this file) — do not redeclare them here,
// classic <script> top-level `const` lives in a shared lexical scope and a second
// `const` with the same name throws a SyntaxError that aborts this entire script.
const LOCATION_MODE_METRO = 'metro';
const LOCATION_MODE_DISTRICT = 'district';
const TITLE_MAX = 50;
const DESCRIPTION_MAX = 1000;
const PRICE_MIN = 10;
const PRICE_MAX = 1000;
const STEP_COUNT = 4;
// Keep in sync with the backend's per-listing photo cap (listingPhotoService.ts).
const MAX_PHOTOS = 5;

/**
 * Static metro station + district data, transcribed from the Flutter app's
 * `MetroCache`/`LocationCache` (lib/base/cache/metro_cache.dart,
 * lib/base/cache/location_cache.dart). The mobile app reads this data
 * straight out of the compiled binary instead of calling the API ("Use
 * cache instead of API call for better performance" — see
 * SubwayStationsBloc); this mirrors that here so the create-listing wizard
 * doesn't need `/subway-stations` or `/locations` round trips either, and
 * so switching the UI language doesn't require a refetch (every station and
 * district carries all three languages up front, unlike the API's
 * per-request-language response shape).
 *
 * These almost never change (Tashkent doesn't add metro stations often) — if
 * they ever do, update both this list and the Flutter cache together.
 */
const STATIC_METRO_STATIONS = [
  // Line 1 — Chilanzar
  { id: 1, line: 1, ordinal: 1, name_uz: 'Chinor', name_ru: 'Чинор', name_en: 'Chinor', latitude: 41.20669650, longitude: 69.21895750, location_id: 12 },
  { id: 2, line: 1, ordinal: 2, name_uz: 'Yangikhayot', name_ru: 'Янгихаёт', name_en: 'Yangikhayot', latitude: 41.21350990, longitude: 69.21401500, location_id: 12 },
  { id: 3, line: 1, ordinal: 3, name_uz: 'Sergeli', name_ru: 'Сергели', name_en: 'Sergeli', latitude: 41.22064000, longitude: 69.20884500, location_id: 12 },
  { id: 4, line: 1, ordinal: 4, name_uz: 'Uzgarish', name_ru: 'Узгариш', name_en: 'Uzgarish', latitude: 41.22733640, longitude: 69.20397140, location_id: 12 },
  { id: 5, line: 1, ordinal: 5, name_uz: 'Chashtepa', name_ru: 'Чаштепа', name_en: 'Chashtepa', latitude: 41.23824960, longitude: 69.19603450, location_id: 12 },
  { id: 6, line: 1, ordinal: 6, name_uz: 'Almazar', name_ru: 'Алмазар', name_en: 'Almazar', latitude: 41.25667240, longitude: 69.19610450, location_id: 7 },
  { id: 7, line: 1, ordinal: 7, name_uz: 'Chilanzar', name_ru: 'Чиланзар', name_en: 'Chilanzar', latitude: 41.27435900, longitude: 69.20497350, location_id: 7 },
  { id: 8, line: 1, ordinal: 8, name_uz: 'Mirzo Ulugbek', name_ru: 'Мирзо Улугбек', name_en: 'Mirzo Ulugbek', latitude: 41.28203420, longitude: 69.21258340, location_id: 7 },
  { id: 9, line: 1, ordinal: 9, name_uz: 'Novza', name_ru: 'Новза', name_en: 'Novza', latitude: 41.29187220, longitude: 69.22361650, location_id: 7 },
  { id: 10, line: 1, ordinal: 10, name_uz: 'Milliy bog', name_ru: 'Нац. Парк', name_en: 'National Park', latitude: 41.30339440, longitude: 69.23566630, location_id: 7 },
  { id: 11, line: 1, ordinal: 11, name_uz: 'Xalqlar doʻstligi', name_ru: 'Дружба народов', name_en: 'Friendship of Nations', latitude: 41.31189870, longitude: 69.24309590, location_id: 8 },
  { id: 12, line: 1, ordinal: 12, name_uz: 'Paxtakor', name_ru: 'Пахтакор', name_en: 'Pakhtakor', latitude: 41.31779140, longitude: 69.25508820, location_id: 8 },
  { id: 13, line: 1, ordinal: 13, name_uz: 'Mustaqil. Maydoni', name_ru: 'Пл. Независимости', name_en: 'Indep. Square', latitude: 41.31494530, longitude: 69.27106460, location_id: 9 },
  { id: 14, line: 1, ordinal: 14, name_uz: 'A. Temur Xiyoboni', name_ru: 'Сквер Амира Темура', name_en: 'A. Temur Square', latitude: 41.31267380, longitude: 69.28326910, location_id: 3 },
  { id: 15, line: 1, ordinal: 15, name_uz: 'Hamid Olimjon', name_ru: 'Хамид Алимджан', name_en: 'Hamid Olimjon', latitude: 41.31816440, longitude: 69.29574190, location_id: 3 },
  { id: 16, line: 1, ordinal: 16, name_uz: 'Pushkin', name_ru: 'Пушкин', name_en: 'Pushkin', latitude: 41.32194810, longitude: 69.31110200, location_id: 3 },
  { id: 17, line: 1, ordinal: 17, name_uz: 'Buyuk Ipak Yoli', name_ru: 'Вел. Шелковый Путь', name_en: 'Great Silk Road', latitude: 41.32610540, longitude: 69.32855980, location_id: 3 },
  // Line 2 — Oʻzbekiston
  { id: 18, line: 2, ordinal: 18, name_uz: 'Beruniy', name_ru: 'Беруни', name_en: 'Beruniy', latitude: 41.34461520, longitude: 69.20620460, location_id: 8 },
  { id: 19, line: 2, ordinal: 19, name_uz: 'Tinchlik', name_ru: 'Тинчлик', name_en: 'Tinchlik', latitude: 41.33230140, longitude: 69.21911550, location_id: 8 },
  { id: 20, line: 2, ordinal: 20, name_uz: 'Chorsu', name_ru: 'Чорсу', name_en: 'Chorsu', latitude: 41.32586490, longitude: 69.23681520, location_id: 8 },
  { id: 21, line: 2, ordinal: 21, name_uz: 'Gafur Gulom', name_ru: 'Гафур Гулям', name_en: 'Gafur Gulom', latitude: 41.32788280, longitude: 69.24583420, location_id: 6 },
  { id: 22, line: 2, ordinal: 22, name_uz: 'Alisher Navoiy', name_ru: 'Алишер Навои', name_en: 'Alisher Navoi', latitude: 41.31892180, longitude: 69.25429730, location_id: 8 },
  { id: 23, line: 2, ordinal: 23, name_uz: 'Oʻzbekiston', name_ru: 'Узбекистан', name_en: 'Uzbekistan', latitude: 41.31194370, longitude: 69.25340570, location_id: 8 },
  { id: 24, line: 2, ordinal: 24, name_uz: 'Kosmonavtlar', name_ru: 'Космонавты', name_en: 'Cosmonauts', latitude: 41.30516180, longitude: 69.26472070, location_id: 10 },
  { id: 25, line: 2, ordinal: 25, name_uz: 'Oybek', name_ru: 'Ойбек', name_en: 'Oybek', latitude: 41.29801280, longitude: 69.27405010, location_id: 4 },
  { id: 26, line: 2, ordinal: 26, name_uz: 'Toshkent', name_ru: 'Ташкент', name_en: 'Tashkent', latitude: 41.29328860, longitude: 69.28772120, location_id: 4 },
  { id: 27, line: 2, ordinal: 27, name_uz: 'Mashinasozlar', name_ru: 'Машиностроители', name_en: 'Machine Builders', latitude: 41.29898470, longitude: 69.30512760, location_id: 11 },
  { id: 28, line: 2, ordinal: 28, name_uz: 'Doʻstlik', name_ru: 'Дустлик', name_en: 'Dustlik', latitude: 41.29364010, longitude: 69.32224450, location_id: 11 },
  // Line 3 — Yunusobod
  { id: 29, line: 3, ordinal: 29, name_uz: 'Mingurik', name_ru: 'Мингурик', name_en: 'Mingurik', latitude: 41.29966100, longitude: 69.27441020, location_id: 4 },
  { id: 30, line: 3, ordinal: 30, name_uz: 'Yunus Rajabiy', name_ru: 'Юнус Раджаби', name_en: 'Yunus Rajabiy', latitude: 41.31388710, longitude: 69.28350770, location_id: 3 },
  { id: 31, line: 3, ordinal: 31, name_uz: 'Abdulla Qodiriy', name_ru: 'Абдулла Кадыри', name_en: 'Abdulla Qodiriy', latitude: 41.32019240, longitude: 69.28175900, location_id: 9 },
  { id: 32, line: 3, ordinal: 32, name_uz: 'Minor', name_ru: 'Минор', name_en: 'Minor', latitude: 41.32689230, longitude: 69.28341630, location_id: 9 },
  { id: 33, line: 3, ordinal: 33, name_uz: 'Bodomzor', name_ru: 'Бодомзор', name_en: 'Bodomzor', latitude: 41.33717010, longitude: 69.28456970, location_id: 9 },
  { id: 34, line: 3, ordinal: 34, name_uz: 'Shahriston', name_ru: 'Шахристан', name_en: 'Shahriston', latitude: 41.35311850, longitude: 69.28810690, location_id: 9 },
  { id: 35, line: 3, ordinal: 35, name_uz: 'Yunusobod', name_ru: 'Юнусабад', name_en: 'Yunusabad', latitude: 41.36684110, longitude: 69.29230030, location_id: 9 },
  { id: 36, line: 3, ordinal: 36, name_uz: 'Turkiston', name_ru: 'Туркистан', name_en: 'Turkiston', latitude: 41.37752170, longitude: 69.29601510, location_id: 9 },
  // Line 4 — Halqa (Circle)
  { id: 37, line: 4, ordinal: 37, name_uz: 'Texnopark', name_ru: 'Технопарк', name_en: 'Technopark', latitude: 41.29462800, longitude: 69.32318670, location_id: 11 },
  { id: 38, line: 4, ordinal: 38, name_uz: 'Yashnobod', name_ru: 'Яшнабад', name_en: 'Yashnobod', latitude: 41.29758590, longitude: 69.34978310, location_id: 11 },
  { id: 39, line: 4, ordinal: 39, name_uz: 'Tuzel', name_ru: 'Тузель', name_en: 'Tuzel', latitude: 41.29201250, longitude: 69.35618440, location_id: 11 },
  { id: 40, line: 4, ordinal: 40, name_uz: 'Olmos', name_ru: 'Алмаз', name_en: 'Olmos', latitude: 41.28170500, longitude: 69.36033380, location_id: 11 },
  { id: 41, line: 4, ordinal: 41, name_uz: 'Rohat', name_ru: 'Рохат', name_en: 'Rohat', latitude: 41.26529070, longitude: 69.36475170, location_id: 11 },
  { id: 42, line: 4, ordinal: 42, name_uz: 'Yangiobod', name_ru: 'Янгиабад', name_en: 'Yangiobod', latitude: 41.25650750, longitude: 69.35872420, location_id: 11 },
  { id: 43, line: 4, ordinal: 43, name_uz: 'Quyliuq', name_ru: 'Куйлюк', name_en: 'Quyliuq', latitude: 41.23745790, longitude: 69.32700010, location_id: 2 },
  { id: 44, line: 4, ordinal: 44, name_uz: 'Matonat', name_ru: 'Матонат', name_en: 'Matonat', latitude: 41.24447130, longitude: 69.30832290, location_id: 4 },
  { id: 45, line: 4, ordinal: 45, name_uz: 'Qiyot', name_ru: 'Киёт', name_en: 'Qiyot', latitude: 41.24447960, longitude: 69.29972800, location_id: 5 },
  { id: 46, line: 4, ordinal: 46, name_uz: 'Tolarik', name_ru: 'Толарик', name_en: 'Tolarik', latitude: 41.24451390, longitude: 69.28495680, location_id: 5 },
  { id: 47, line: 4, ordinal: 47, name_uz: 'Xonabod', name_ru: 'Ханабад', name_en: 'Xonabod', latitude: 41.23001030, longitude: 69.27043530, location_id: 5 },
  { id: 48, line: 4, ordinal: 48, name_uz: 'Quruvchilar', name_ru: 'Курувчилар', name_en: 'Quruvchilar', latitude: 41.22163670, longitude: 69.26050330, location_id: 5 },
  { id: 49, line: 4, ordinal: 49, name_uz: 'Turon', name_ru: 'Турон', name_en: 'Turon', latitude: 41.21068130, longitude: 69.23415400, location_id: 12 },
  { id: 50, line: 4, ordinal: 50, name_uz: 'Qipchoq', name_ru: 'Кипчок', name_en: 'Qipchoq', latitude: 41.20542290, longitude: 69.22141120, location_id: 12 },
];

const STATIC_LOCATIONS = [
  { id: 1, name_uz: 'Uchtepa Tumani', name_ru: 'Учтепинский район', name_en: 'Uchtepa District', short_name_uz: 'Uchtepa', short_name_ru: 'Учтепа', short_name_en: 'Uchtepa', latitude: 41.296048, longitude: 69.175168 },
  { id: 2, name_uz: 'Bektemir Tumani', name_ru: 'Бектемирский район', name_en: 'Bektemir District', short_name_uz: 'Bektemir', short_name_ru: 'Бектемир', short_name_en: 'Bektemir', latitude: 41.2333, longitude: 69.3344 },
  { id: 3, name_uz: 'Mirzo Ulugbek Tumani', name_ru: 'Мирзо‑Улугбекский район', name_en: 'Mirzo Ulugbek District', short_name_uz: 'Mirzo Ulugbek', short_name_ru: 'Мирзо‑Улугбек', short_name_en: 'Mirzo Ulugbek', latitude: 41.3257, longitude: 69.3257 },
  { id: 4, name_uz: 'Mirobod Tumani', name_ru: 'Мирабадский район', name_en: 'Mirabad District', short_name_uz: 'Mirobod', short_name_ru: 'Мирабад', short_name_en: 'Mirabad', latitude: 41.2774, longitude: 69.2972 },
  { id: 5, name_uz: 'Sergeli Tumani', name_ru: 'Сергелийский район', name_en: 'Sergeli District', short_name_uz: 'Sergeli', short_name_ru: 'Сергели', short_name_en: 'Sergeli', latitude: 41.2100, longitude: 69.2317 },
  { id: 6, name_uz: 'Olmazor Tumani', name_ru: 'Алмазарский район', name_en: 'Almazar District', short_name_uz: 'Olmazor', short_name_ru: 'Алмазар', short_name_en: 'Almazar', latitude: 41.3614, longitude: 69.2254 },
  { id: 7, name_uz: 'Chilanzar Tumani', name_ru: 'Чиланзарский район', name_en: 'Chilanzar District', short_name_uz: 'Chilanzar', short_name_ru: 'Чиланзар', short_name_en: 'Chilanzar', latitude: 41.2743, longitude: 69.2049 },
  { id: 8, name_uz: 'Shayxontohur Tumani', name_ru: 'Шайхантаурский район', name_en: 'Shaykhantahur District', short_name_uz: 'Shayxontohur', short_name_ru: 'Шайхантаур', short_name_en: 'Shaykhantahur', latitude: 41.3223, longitude: 69.2101 },
  { id: 9, name_uz: 'Yunusobod Tumani', name_ru: 'Юнусабадский район', name_en: 'Yunusabad District', short_name_uz: 'Yunusobod', short_name_ru: 'Юнусабад', short_name_en: 'Yunusabad', latitude: 41.3666, longitude: 69.2922 },
  { id: 10, name_uz: 'Yakkasaroy Tumani', name_ru: 'Яккасарайский район', name_en: 'Yakkasaray District', short_name_uz: 'Yakkasaroy', short_name_ru: 'Яккасарай', short_name_en: 'Yakkasaray', latitude: 41.2807, longitude: 69.2557 },
  { id: 11, name_uz: 'Yashnobod Tumani', name_ru: 'Яшнабадский район', name_en: 'Yashnabad District', short_name_uz: 'Yashnobod', short_name_ru: 'Яшнабад', short_name_en: 'Yashnabad', latitude: 41.2832, longitude: 69.3339 },
  { id: 12, name_uz: 'Yangi Hayot Tumani', name_ru: 'Янгихаётский район', name_en: 'Yangihayot District', short_name_uz: 'Yangi Hayot', short_name_ru: 'Янгихаёт', short_name_en: 'Yangihayot', latitude: 41.0655, longitude: 69.4457 },
];

const loadingEl = document.getElementById('loading');
const formRoot = document.getElementById('form-root');
const successRoot = document.getElementById('success-root');
const successTitleEl = document.getElementById('success-title');
const successHintEl = document.getElementById('success-hint');
const successViewBtn = document.getElementById('success-view');
const successFeedBtn = document.getElementById('success-feed');
const successPhotoWarningEl = document.getElementById('success-photo-warning');
const stepPanelsEl = document.getElementById('step-panels');
const stepTitleEl = document.getElementById('step-title');
const stepCounterEl = document.getElementById('step-counter');
const progressEl = document.getElementById('progress');
const formErrorEl = document.getElementById('form-error');
const wizardFooterEl = document.getElementById('wizard-footer');
const wizardBackBtn = document.getElementById('wizard-back');
const wizardNextBtn = document.getElementById('wizard-next');
const wizardNextLabelEl = document.getElementById('wizard-next-label');
const wizardNextIconEl = document.getElementById('wizard-next-icon');
const wizardNextSpinnerEl = document.getElementById('wizard-next-spinner');
const photoInput = document.getElementById('photo-input');

const state = {
  step: 0,
  auth: null,
  amenities: [],
  locations: [],
  stations: [],
  stationsLoading: false,
  submitting: false,
  validationError: '',
  validationAnchor: '',
  lastGeneratedTitle: '',
  /// Set when editing an existing listing (from `?id=` on the URL). Only the
  /// listing's own owner can load/save it — enforced server-side via initData.
  editingListingId: null,
  /// Photos already saved on the server for the listing being edited. Shown
  /// read-only alongside newly picked `form.photos`, removable via the
  /// dedicated delete-photo endpoint (see removeExistingPhoto).
  existingPhotos: [],
  /// Every station object seen across every line the author has browsed,
  /// keyed by id. Lets multi-station selections survive switching lines
  /// (mirrors the mobile app's `_stationCache` in MultiStationPicker) and
  /// lets the review step resolve names for stations picked on a line
  /// that isn't currently displayed.
  stationCache: {},
  /// True while `requestUserLocation()` + reverse-geocoding are in flight for
  /// the "Use current location" address button (step 0), so the button can
  /// show a spinner and ignore repeat taps.
  locatingAddress: false,
  /// True while the dedicated "Find nearby metro stations" button (step 0,
  /// below "Use current location") is fetching a location — separate from
  /// `locatingAddress` since either button can trigger a geolocation lookup
  /// independently of the other.
  findingNearbyStations: false,
  /// `{ station, minutes }[]`, nearest-first, populated by `findNearbyStations`
  /// after a successful "Find nearby metro stations" lookup — lets step 0
  /// suggest metro stations within `nearbyStationsRadiusMinutes` of the
  /// author's location.
  nearbyStations: [],
  /// True once "Find nearby metro stations" has actually searched, so the
  /// metro panel can tell "never asked" apart from "asked, found nothing
  /// within range" (see renderStep0).
  nearbyStationsChecked: false,
  /// Selected walk-time radius (minutes) for "Find nearby metro stations" —
  /// one of `NEARBY_STATION_RADIUS_OPTIONS` (10 by default).
  nearbyStationsRadiusMinutes: 10,
  form: {
    listingTypeId: LISTING_TYPE_ROOMMATE_NEEDED,
    locationMode: LOCATION_MODE_METRO,
    subwayLineId: 1,
    selectedStationIds: [],
    selectedLocationIds: [],
    // Free-text street address — roommate-needed listings only (mirrors the
    // backend's `shouldPersistAddress` gating in listingService). Lat/lon are
    // only set when populated via "Use current location", not manual typing.
    addressText: '',
    addressLatitude: null,
    addressLongitude: null,
    price: 100,
    priceMin: 50,
    priceMax: 150,
    gender: 1,
    amenityIds: new Set(),
    moveInDate: '',
    privateRoom: false,
    title: '',
    description: '',
    photos: [],
    phone: '',
  },
};

function tg() { return window.Telegram?.WebApp; }

/** Thin wrapper kept so every existing `haptic('heavy')`/`haptic()` call site below stays unchanged. */
function haptic(type = 'light') {
  UyDosh.haptic.impact(type);
}

function stepTitles(lang) {
  return [
    UyDosh.t('create.step.typeLocation', lang),
    UyDosh.t('create.step.details', lang),
    UyDosh.t('create.step.description', lang),
    UyDosh.t('create.step.review', lang),
  ];
}

function isRoomNeeded() {
  return state.form.listingTypeId === LISTING_TYPE_ROOM_NEEDED;
}

/// Only demand-side (room-needed) listings can be tagged with several metro
/// stations; roommate-needed listings describe one apartment near one
/// station, so metro selection stays singular (mirrors `_supportsMultiLocation`
/// below).
function supportsMultiStation() {
  return isRoomNeeded();
}

/// Only demand-side (room-needed) listings can span several districts;
/// roommate-needed listings describe one apartment (mirrors mobile's
/// `_supportsMultiLocation`).
function supportsMultiLocation() {
  return isRoomNeeded();
}

function priceForRequest() {
  if (isRoomNeeded()) {
    return Math.round((state.form.priceMin + state.form.priceMax) / 2);
  }
  return Math.round(state.form.price);
}

function priceBoundsForRequest() {
  if (isRoomNeeded()) {
    return {
      min: Math.round(Math.min(state.form.priceMin, state.form.priceMax)),
      max: Math.round(Math.max(state.form.priceMin, state.form.priceMax)),
    };
  }
  const p = Math.round(state.form.price);
  return { min: p, max: p };
}

function formatPriceReviewHtml(lang) {
  const bounds = priceBoundsForRequest();
  const nf = new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'ru-RU');
  const perMonth = `<small>${UyDosh.escapeHtml(UyDosh.t('create.perMonth', lang))}</small>`;
  if (bounds.min === bounds.max) {
    return `$${nf.format(bounds.min)}${perMonth}`;
  }
  return `$${nf.format(bounds.min)}–$${nf.format(bounds.max)}${perMonth}`;
}

function listingTypeLabel(typeId, lang) {
  if (typeId === LISTING_TYPE_ROOM_NEEDED) return UyDosh.t('filter.type.roomNeeded', lang);
  return UyDosh.t('filter.type.roommateNeeded', lang);
}

function genderLabel(gender, lang) {
  return gender === 2
    ? UyDosh.t('filter.gender.female', lang)
    : UyDosh.t('filter.gender.male', lang);
}

/** Pre-fill title with preset hashtag; preserves manual edits like mobile create flow. */
function updateDefaultTitle(lang = UyDosh.getLang()) {
  const generated = UyDosh.presetListingTitleText(
    state.form.listingTypeId,
    state.form.gender,
    lang,
  );
  const current = state.form.title;
  const shouldOverwrite = !current || current === state.lastGeneratedTitle;
  if (shouldOverwrite) {
    state.form.title = generated;
  }
  state.lastGeneratedTitle = generated;
}

/** Populate `state.form` from an existing listing (edit mode). */
function hydrateFormFromListing(listing) {
  const typeId = Number(listing.listing_type_id);
  state.form.listingTypeId =
    typeId === LISTING_TYPE_ROOM_NEEDED ? LISTING_TYPE_ROOM_NEEDED : LISTING_TYPE_ROOMMATE_NEEDED;

  const searchStations = Array.isArray(listing.search_subway_stations)
    ? listing.search_subway_stations
    : [];
  const searchLocations = Array.isArray(listing.search_locations)
    ? listing.search_locations
    : [];

  if (searchLocations.length > 0 || (listing.location_id != null && searchStations.length === 0)) {
    state.form.locationMode = LOCATION_MODE_DISTRICT;
    state.form.selectedLocationIds = searchLocations.length > 0
      ? searchLocations.map((l) => Number(l.id))
      : [Number(listing.location_id)];
  } else if (searchStations.length > 0 || listing.subway_station_id != null) {
    state.form.locationMode = LOCATION_MODE_METRO;
    const stations = searchStations.length > 0
      ? searchStations
      : (listing.subway_station ? [listing.subway_station] : []);
    for (const st of stations) state.stationCache[Number(st.id)] = st;
    state.form.selectedStationIds = stations.length > 0
      ? stations.map((s) => Number(s.id))
      : (listing.subway_station_id != null ? [Number(listing.subway_station_id)] : []);
    const primaryLine = stations[0]?.line ?? listing.subway_station?.line ?? listing.subway_line_id;
    state.form.subwayLineId = Number(primaryLine) || 1;
  }

  const minP = Number(listing.min_price);
  const maxP = Number(listing.max_price);
  if (Number.isFinite(minP) && Number.isFinite(maxP) && minP > 0 && maxP > 0) {
    state.form.priceMin = minP;
    state.form.priceMax = maxP;
  }
  const p = Number(listing.price);
  if (Number.isFinite(p) && p > 0) state.form.price = p;

  state.form.gender = Number(listing.gender) || 1;
  state.form.amenityIds = new Set(
    (Array.isArray(listing.amenities) ? listing.amenities : []).map((a) => Number(a.id)),
  );
  state.form.moveInDate = listing.move_in_date ? String(listing.move_in_date).slice(0, 10) : '';
  state.form.privateRoom = Boolean(listing.private_room);
  state.form.addressText = listing.address_text || '';
  const addressLat = Number(listing.address_latitude);
  const addressLon = Number(listing.address_longitude);
  state.form.addressLatitude = Number.isFinite(addressLat) ? addressLat : null;
  state.form.addressLongitude = Number.isFinite(addressLon) ? addressLon : null;
  // Deliberately leave `state.lastGeneratedTitle` at its initial '' value (not
  // synced to the loaded title) — updateDefaultTitle() only overwrites the
  // title when it's empty or matches the last auto-generated text, so this
  // keeps the listing's real (possibly hand-edited) title from ever being
  // silently replaced by the auto-generated preset as the user tweaks other
  // fields or switches language while editing.
  state.form.title = listing.title || '';
  state.form.description = listing.description || '';
  state.existingPhotos = Array.isArray(listing.photos) ? listing.photos.slice() : [];
}

/** Fetch the caller's own listings and find the one being edited (ownership is enforced this way — no separate authenticated single-listing fetch needed). */
async function loadListingForEdit(id) {
  const data = await UyDosh.fetchMyTelegramMiniAppListings();
  const listings = Array.isArray(data?.listings) ? data.listings : [];
  const listing = listings.find((l) => Number(l.id) === Number(id));
  if (!listing) {
    const err = new Error('Listing not found or not yours');
    err.status = 404;
    throw err;
  }
  hydrateFormFromListing(listing);
}

/** Swap the browser/tab title to edit-mode wording (the wizard header carries no title text). */
function applyEditModeChrome() {
  if (!state.editingListingId) return;
  document.title = `UyDosh — ${UyDosh.t('create.editTitle', UyDosh.getLang())}`;
}

function reviewListingForBadges() {
  const typeId = state.form.listingTypeId;
  const listing = {
    listing_type_id: typeId,
    gender: state.form.gender,
  };
  if (typeId === LISTING_TYPE_ROOM_NEEDED) {
    listing.listing_type = {
      name_uz: UyDosh.t('filter.type.roomNeeded', 'uz'),
      name_ru: UyDosh.t('filter.type.roomNeeded', 'ru'),
      name_en: UyDosh.t('filter.type.roomNeeded', 'en'),
    };
  }
  return listing;
}

function listingTypeReviewBadgeHtml(lang) {
  const listing = reviewListingForBadges();
  const label = UyDosh.listingTypeBadgeLabel(listing, lang)
    || listingTypeLabel(state.form.listingTypeId, lang);
  const typeColor = UyDosh.listingTypeColor(state.form.listingTypeId);
  const icon = UyDosh.listingTypeBadgeIcon(listing, { pressed: false });
  const typeStyle = typeColor ? ` style="--badge-type-color:${typeColor}"` : '';
  return `<span class="badge badge-type"${typeStyle}>${icon}${UyDosh.escapeHtml(label)}</span>`;
}

function genderReviewBadgeHtml(lang) {
  return UyDosh.genderBadgeHtml({ gender: state.form.gender }, lang);
}

function selectedLocationSummary(lang) {
  if (state.form.locationMode === LOCATION_MODE_METRO) {
    // Use the cross-line cache, not `state.stations` (only the currently
    // displayed line), so stations picked on a different line still show
    // up here.
    const names = state.form.selectedStationIds
      .map((id) => state.stationCache[id])
      .filter(Boolean)
      .map((s) => UyDosh.localized(s, lang));
    return names.join(', ');
  }
  const names = state.locations
    .filter((l) => state.form.selectedLocationIds.includes(Number(l.id)))
    .map((l) => UyDosh.localizedShort(l, lang));
  return names.join(', ');
}

function selectedLocationReviewHtml(lang) {
  const summary = selectedLocationSummary(lang);
  if (!summary) {
    return UyDosh.escapeHtml(UyDosh.t('create.reviewNotSet', lang));
  }
  if (state.form.locationMode === LOCATION_MODE_DISTRICT) {
    return `${UyDosh.iconPin()}<span>${UyDosh.escapeHtml(summary)}</span>`;
  }
  return UyDosh.escapeHtml(summary);
}

function fieldInlineErrorHtml(message) {
  if (!message) return '';
  return `<div class="field-inline-error" role="alert">${UyDosh.escapeHtml(message)}</div>`;
}

function fieldErrorAttrs(anchor) {
  const active = state.validationError && state.validationAnchor === anchor;
  return {
    className: active ? ' has-error' : '',
    inline: active ? fieldInlineErrorHtml(state.validationError) : '',
  };
}

function showFormError(message, anchor = '') {
  state.validationError = message || '';
  state.validationAnchor = message ? anchor : '';
  if (!message) {
    formErrorEl.hidden = true;
    formErrorEl.textContent = '';
    return;
  }
  formErrorEl.hidden = false;
  formErrorEl.textContent = message;
}

function scrollToValidationAnchor() {
  if (!state.validationAnchor) return;
  requestAnimationFrame(() => {
    stepPanelsEl.querySelector(`[data-validation-anchor="${state.validationAnchor}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

function hideTelegramMainButton() {
  tg()?.MainButton?.hide();
}

function updateTelegramBackButton() {
  const webApp = tg();
  if (!webApp?.BackButton) return;
  if (successRoot.hidden === false || formRoot.hidden) {
    webApp.BackButton.hide();
    return;
  }
  if (state.step <= 0) webApp.BackButton.show();
  else webApp.BackButton.hide();
}

function updateWizardFooter() {
  hideTelegramMainButton();
  updateTelegramBackButton();

  if (formRoot.hidden || successRoot.hidden === false) {
    wizardFooterEl.hidden = true;
    return;
  }

  wizardFooterEl.hidden = false;
  const lang = UyDosh.getLang();
  const isFirst = state.step <= 0;
  const isLast = state.step >= STEP_COUNT - 1;

  wizardBackBtn.hidden = isFirst;
  wizardNextBtn.classList.toggle('full', isFirst);

  const isEdit = Boolean(state.editingListingId);
  const nextKey = state.submitting
    ? (isEdit ? 'create.saving' : 'create.publishing')
    : isLast
      ? (isEdit ? 'create.save' : 'create.publish')
      : 'create.next';
  wizardNextLabelEl.textContent = UyDosh.t(nextKey, lang);
  wizardNextLabelEl.removeAttribute('data-i18n');

  wizardBackBtn.disabled = state.submitting;
  wizardNextBtn.disabled = state.submitting;
  wizardNextSpinnerEl.hidden = !state.submitting;
  wizardNextIconEl.hidden = state.submitting || isLast;
}

function renderProgress() {
  progressEl.innerHTML = Array.from({ length: STEP_COUNT }, (_, i) => {
    const cls = i < state.step ? 'done' : i === state.step ? 'active' : '';
    return `<div class="progress-seg ${cls}"><span></span></div>`;
  }).join('');
}

function stationListHtml(lang) {
  if (state.stationsLoading) {
    return `
      <div class="station-list-loading" aria-busy="true" aria-live="polite">
        <span class="station-list-spinner" aria-hidden="true"></span>
      </div>`;
  }
  const multi = supportsMultiStation();
  const lineStationIds = state.stations.map((st) => Number(st.id));
  const allOnLineSelected =
    multi &&
    lineStationIds.length > 0 &&
    lineStationIds.every((id) => state.form.selectedStationIds.includes(id));
  const selectAllRow =
    multi && lineStationIds.length > 0
      ? `
      <button type="button" class="station-item station-item-select-all" data-select-all-stations data-haptic="selection" aria-pressed="${allOnLineSelected ? 'true' : 'false'}">
        ${UyDosh.iconCheckboxPair()}
        ${UyDosh.iconMetro(state.form.subwayLineId)}
        <span>${UyDosh.escapeHtml(UyDosh.t('create.selectAllStations', lang).replace('{count}', String(state.stations.length)))}</span>
      </button>`
      : '';
  const stationItems = state.stations.map((st) => {
    const id = Number(st.id);
    const pressed = state.form.selectedStationIds.includes(id);
    const lineId = Number(st.line) || state.form.subwayLineId;
    return `
      <button type="button" class="station-item" data-station-id="${id}" data-haptic="selection" aria-pressed="${pressed ? 'true' : 'false'}">
        ${multi ? UyDosh.iconCheckboxPair() : ''}
        ${UyDosh.iconMetro(lineId)}
        <span class="station-item-label">${UyDosh.escapeHtml(UyDosh.localized(st, lang))}</span>
        ${UyDosh.metroTransferSuffixHtml(id, lang)}
      </button>`;
  }).join('');
  return (selectAllRow + stationItems) || `<div class="status">…</div>`;
}

/**
 * Walk-time radius toggle (10 / 20 / 30 min) for "Find nearby metro
 * stations" — reselecting a radius re-filters `state.nearbyStations` from
 * the already-known location without another geolocation lookup (see the
 * `data-nearby-radius` handler in bindStepEvents).
 */
function nearbyRadiusChipsHtml(lang) {
  const chips = NEARBY_STATION_RADIUS_OPTIONS.map((minutes) => UyDosh.chipButtonHtml({
    className: 'chip nearby-radius-chip',
    attrs: { 'data-nearby-radius': minutes },
    pressed: state.nearbyStationsRadiusMinutes === minutes,
    label: UyDosh.t('create.walkRadiusOption', lang).replace('{count}', String(minutes)),
  })).join('');
  return `<div class="chips nearby-radius-chips">${chips}</div>`;
}

/**
 * "Stations near you" panel shown under the "Find nearby metro stations"
 * button once `findNearbyStations` has run (see `data-find-nearby-metro` in
 * bindStepEvents): a radius toggle plus the matching station chips. Only
 * relevant for metro mode — district mode has its own auto-select (see
 * `findLocationIdByDistrictName`).
 */
function nearbyStationsHtml(lang) {
  if (state.form.locationMode !== LOCATION_MODE_METRO) return '';
  if (!state.nearbyStationsChecked) return '';
  const radiusChips = nearbyRadiusChipsHtml(lang);
  if (state.nearbyStations.length === 0) {
    const emptyText = UyDosh.t('create.nearbyStationsEmpty', lang)
      .replace('{minutes}', String(state.nearbyStationsRadiusMinutes));
    return `
      <div class="nearby-stations">
        ${radiusChips}
        <div class="nearby-stations-empty">${UyDosh.escapeHtml(emptyText)}</div>
      </div>`;
  }
  const chips = state.nearbyStations.map(({ station, minutes }) => {
    const id = Number(station.id);
    const lineId = Number(station.line) || state.form.subwayLineId;
    const pressed = state.form.selectedStationIds.includes(id);
    const minutesLabel = UyDosh.t('create.walkMinutes', lang)
      .replace('{count}', String(Math.max(1, Math.round(minutes))));
    return `
      <button type="button" class="nearby-station-chip" data-nearby-station-id="${id}" data-nearby-station-line="${lineId}" data-haptic="selection" aria-pressed="${pressed ? 'true' : 'false'}">
        ${UyDosh.iconMetro(lineId)}
        <span class="nearby-station-name">${UyDosh.escapeHtml(UyDosh.localized(station, lang))}</span>
        <span class="nearby-station-time">${UyDosh.iconClock()}${UyDosh.escapeHtml(minutesLabel)}</span>
      </button>`;
  }).join('');
  return `
    <div class="nearby-stations">
      ${radiusChips}
      <div class="nearby-stations-label">${UyDosh.escapeHtml(UyDosh.t('create.nearbyStations', lang))}</div>
      <div class="nearby-stations-list">${chips}</div>
    </div>`;
}

function renderStep0(lang) {
  const typeOptions = [
    { id: LISTING_TYPE_ROOMMATE_NEEDED, label: UyDosh.t('filter.type.roommateNeeded', lang) },
    { id: LISTING_TYPE_ROOM_NEEDED, label: UyDosh.t('filter.type.roomNeeded', lang) },
  ];
  const typeChips = typeOptions.map((opt) => UyDosh.chipButtonHtml({
    attrs: { 'data-listing-type': opt.id },
    pressed: state.form.listingTypeId === opt.id,
    icon: UyDosh.filterListingTypeIcon(opt.id, { pressed: false }),
    label: opt.label,
  })).join('');

  const modeChips = [
    { mode: LOCATION_MODE_METRO, label: UyDosh.t('create.locationMetro', lang), icon: UyDosh.iconMetro() },
    { mode: LOCATION_MODE_DISTRICT, label: UyDosh.t('create.locationDistrict', lang), icon: UyDosh.iconPin() },
  ].map((opt) => {
    return UyDosh.chipButtonHtml({
      attrs: { 'data-location-mode': opt.mode },
      pressed: state.form.locationMode === opt.mode,
      icon: opt.icon,
      label: opt.label,
    });
  }).join('');

  // Shared metro ribbon (see `metroLineChipsHtml` in uydosh-icons.js):
  // icon-only until selected, matching the feed filter ribbon — only the
  // currently selected line reveals its name (slide + fade, see
  // `.chip-label-collapse` in telegram-shared.css).
  const lineChips = UyDosh.metroLineChipsHtml(state.form.subwayLineId, lang);

  let locationBody = '';
  if (state.form.locationMode === LOCATION_MODE_METRO) {
    const stationLabel = supportsMultiStation()
      ? UyDosh.t('create.metroStations', lang)
      : UyDosh.t('create.metroStation', lang);
    const stationField = fieldErrorAttrs('location');
    locationBody = `
      <div class="field">
        <div class="field-label">${UyDosh.escapeHtml(UyDosh.t('create.metroLine', lang))}</div>
        <div class="chips">${lineChips}</div>
      </div>
      <div class="field${stationField.className}" data-validation-anchor="location">
        <div class="field-label">${UyDosh.escapeHtml(stationLabel)}</div>
        ${stationField.inline}
        <div class="station-list">${stationListHtml(lang)}</div>
      </div>`;
  } else {
    const multiLocation = supportsMultiLocation();
    const districtLabel = multiLocation
      ? UyDosh.t('create.districts', lang)
      : UyDosh.t('create.district', lang);
    const districtField = fieldErrorAttrs('location');
    const allLocationIds = state.locations.map((loc) => Number(loc.id));
    const allLocationsSelected =
      multiLocation &&
      allLocationIds.length > 0 &&
      allLocationIds.every((id) => state.form.selectedLocationIds.includes(id));
    const selectAllLocationsRow =
      multiLocation && allLocationIds.length > 0
        ? `
        <button type="button" class="station-item station-item-select-all" data-select-all-locations data-haptic="selection" aria-pressed="${allLocationsSelected ? 'true' : 'false'}">
          ${UyDosh.iconCheckboxPair()}
          ${UyDosh.iconPin()}
          <span>${UyDosh.escapeHtml(UyDosh.t('create.selectAllDistricts', lang).replace('{count}', String(state.locations.length)))}</span>
        </button>`
        : '';
    // Sorted A→Z (by the currently displayed name) and laid out in two
    // columns (see `.station-list-grid` in create.html) so the full district
    // list fits on screen without excessive scrolling.
    const sortedLocations = [...state.locations].sort((a, b) =>
      UyDosh.localizedShort(a, lang).localeCompare(UyDosh.localizedShort(b, lang), lang));
    const districtItems = sortedLocations.map((loc) => {
      const id = Number(loc.id);
      const pressed = state.form.selectedLocationIds.includes(id);
      return `
        <button type="button" class="station-item" data-location-id="${id}" data-haptic="selection" aria-pressed="${pressed ? 'true' : 'false'}">
          ${multiLocation ? UyDosh.iconCheckboxPair() : ''}
          ${UyDosh.iconPin()}
          <span class="station-item-label">${UyDosh.escapeHtml(UyDosh.localizedShort(loc, lang))}</span>
        </button>`;
    }).join('');
    locationBody = `
      <div class="field${districtField.className}" data-validation-anchor="location">
        <div class="field-label">${UyDosh.escapeHtml(districtLabel)}</div>
        ${districtField.inline}
        <div class="station-list station-list-grid">${(selectAllLocationsRow + districtItems) || `<div class="status">…</div>`}</div>
      </div>`;
  }

  // Address is only ever persisted for roommate-needed (apartment) listings —
  // mirrors the backend's `shouldPersistAddress` gating — so it's hidden for
  // room-needed (demand-side) listings, which have no specific address to give.
  const addressBody = !isRoomNeeded() ? `
    <div class="field">
      <label for="listing-address">${UyDosh.escapeHtml(UyDosh.t('create.addressOptional', lang))}</label>
      <textarea
        id="listing-address"
        class="address-textarea"
        rows="2"
        maxlength="500"
        placeholder="${UyDosh.escapeHtml(UyDosh.t('create.addressPlaceholder', lang))}"
      >${UyDosh.escapeHtml(state.form.addressText)}</textarea>
      <button
        type="button"
        class="use-location-btn"
        data-use-current-location
        ${state.locatingAddress ? 'disabled' : ''}
        aria-label="${UyDosh.escapeHtml(UyDosh.t('create.useCurrentLocation', lang))}"
      >
        ${state.locatingAddress
          ? '<span class="use-location-spinner" aria-hidden="true"></span>'
          : UyDosh.iconLocateMe()}
        <span>${UyDosh.escapeHtml(state.locatingAddress ? UyDosh.t('create.locatingAddress', lang) : UyDosh.t('create.useCurrentLocation', lang))}</span>
      </button>
      ${state.form.locationMode === LOCATION_MODE_METRO ? `
      <button
        type="button"
        class="use-location-btn"
        data-find-nearby-metro
        ${state.findingNearbyStations ? 'disabled' : ''}
        aria-label="${UyDosh.escapeHtml(UyDosh.t('create.findNearbyMetro', lang))}"
      >
        ${state.findingNearbyStations
          ? '<span class="use-location-spinner" aria-hidden="true"></span>'
          : UyDosh.iconMetro()}
        <span>${UyDosh.escapeHtml(state.findingNearbyStations ? UyDosh.t('create.locatingAddress', lang) : UyDosh.t('create.findNearbyMetro', lang))}</span>
      </button>` : ''}
      ${nearbyStationsHtml(lang)}
    </div>` : '';

  return `
    <section class="panel active" data-step="0">
      <div class="field">
        <div class="field-label">${UyDosh.escapeHtml(UyDosh.t('create.listingType', lang))}</div>
        <div class="chips">${typeChips}</div>
      </div>
      <div class="field">
        <div class="field-label">${UyDosh.escapeHtml(UyDosh.t('create.locationMode', lang))}</div>
        <div class="chips">${modeChips}</div>
      </div>
      ${locationBody}
      ${addressBody}
    </section>`;
}

function renderStep1(lang) {
  const singlePrice = !isRoomNeeded();
  const priceField = fieldErrorAttrs('price');
  const priceBlock = singlePrice
    ? `
      <div class="field${priceField.className}" data-validation-anchor="price">
        <div class="field-label">${UyDosh.escapeHtml(UyDosh.t('create.price', lang))}</div>
        ${priceField.inline}
        <div class="price-value">$${state.form.price}</div>
        <input type="range" min="${PRICE_MIN}" max="${PRICE_MAX}" step="5" value="${state.form.price}" data-price-single />
      </div>`
    : `
      <div class="field${priceField.className}" data-validation-anchor="price">
        <div class="field-label">${UyDosh.escapeHtml(UyDosh.t('create.priceRange', lang))}</div>
        ${priceField.inline}
        <div class="price-value">$${state.form.priceMin} – $${state.form.priceMax}</div>
        <div class="price-row">
          <div>
            <label>${UyDosh.escapeHtml(UyDosh.t('create.priceMin', lang))}</label>
            <input type="range" min="${PRICE_MIN}" max="${PRICE_MAX}" step="5" value="${state.form.priceMin}" data-price-min />
          </div>
          <div>
            <label>${UyDosh.escapeHtml(UyDosh.t('create.priceMax', lang))}</label>
            <input type="range" min="${PRICE_MIN}" max="${PRICE_MAX}" step="5" value="${state.form.priceMax}" data-price-max />
          </div>
        </div>
      </div>`;

  const genderField = fieldErrorAttrs('gender');
  const genderChips = [1, 2].map((g) => UyDosh.chipButtonHtml({
    attrs: { 'data-gender': g },
    pressed: state.form.gender === g,
    icon: UyDosh.filterGenderIcon(g, { pressed: false }),
    label: genderLabel(g, lang),
  })).join('');

  const amenityChips = state.amenities.map((a) => {
    const id = Number(a.id);
    return UyDosh.chipButtonHtml({
      className: 'amenity-chip',
      attrs: { 'data-amenity-id': id },
      pressed: state.form.amenityIds.has(id),
      icon: UyDosh.amenityIconHtml(UyDosh.getAmenityCode(a), { size: 16 }),
      label: UyDosh.localized(a, lang),
    });
  }).join('');

  return `
    <section class="panel active" data-step="1">
      ${priceBlock}
      <div class="field${genderField.className}" data-validation-anchor="gender">
        <div class="field-label">${UyDosh.escapeHtml(UyDosh.t('create.gender', lang))}</div>
        ${genderField.inline}
        <div class="chips">${genderChips}</div>
      </div>
      <div class="field">
        <div class="field-label">${UyDosh.escapeHtml(UyDosh.t('create.amenities', lang))}</div>
        <div class="amenity-grid">${amenityChips}</div>
      </div>
      <div class="field">
        <label for="move-in-date">${UyDosh.escapeHtml(UyDosh.t('create.moveInDate', lang))}</label>
        <input id="move-in-date" type="date" value="${UyDosh.escapeHtml(state.form.moveInDate)}" />
      </div>
      ${!isRoomNeeded() ? `
      <div class="toggle-row">
        <span class="toggle-row-label">${UyDosh.escapeHtml(UyDosh.t('create.privateRoom', lang))}</span>
        <button
          type="button"
          class="switch"
          role="switch"
          data-private-room
          data-haptic="selection"
          aria-checked="${state.form.privateRoom ? 'true' : 'false'}"
          aria-label="${UyDosh.escapeHtml(UyDosh.t('create.privateRoom', lang))}"
        >
          <span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
        </button>
      </div>` : ''}
    </section>`;
}

function renderStep2(lang) {
  const titleField = fieldErrorAttrs('title');
  const descriptionField = fieldErrorAttrs('description');
  const existingPhotoSlots = state.existingPhotos.map((photo) => `
    <div class="photo-slot">
      <img src="${UyDosh.escapeHtml(UyDosh.photoUrl(photo))}" alt="" />
      <button type="button" data-remove-existing-photo="${photo.id}" aria-label="Remove">×</button>
    </div>
  `).join('');
  const photoSlots = state.form.photos.map((photo, index) => `
    <div class="photo-slot">
      <img src="${UyDosh.escapeHtml(photo.previewUrl)}" alt="" />
      <button type="button" data-remove-photo="${index}" aria-label="Remove">×</button>
    </div>
  `).join('');
  const totalPhotoCount = state.existingPhotos.length + state.form.photos.length;

  return `
    <section class="panel active" data-step="2">
      <div class="field${titleField.className}" data-validation-anchor="title">
        <label for="listing-title">${UyDosh.escapeHtml(UyDosh.t('create.titleLabel', lang))}</label>
        ${titleField.inline}
        <input id="listing-title" type="text" maxlength="${TITLE_MAX}" value="${UyDosh.escapeHtml(state.form.title)}" placeholder="${UyDosh.escapeHtml(UyDosh.t('create.titlePlaceholder', lang))}" />
        <div class="char-count ${state.form.title.length > TITLE_MAX ? 'over' : ''}">${state.form.title.length}/${TITLE_MAX}</div>
      </div>
      <div class="field${descriptionField.className}" data-validation-anchor="description">
        <label for="listing-description">${UyDosh.escapeHtml(UyDosh.t('create.descriptionLabel', lang))}</label>
        ${descriptionField.inline}
        <textarea id="listing-description" maxlength="${DESCRIPTION_MAX}" placeholder="${UyDosh.escapeHtml(UyDosh.t('create.descriptionPlaceholder', lang))}">${UyDosh.escapeHtml(state.form.description)}</textarea>
        <div class="description-footer">
          <button
            type="button"
            class="description-template-btn"
            data-description-template
            aria-label="${UyDosh.escapeHtml(UyDosh.t('create.descriptionTemplateLabel', lang))}"
          >
            ${UyDosh.iconArticle(null)}
            <span>${UyDosh.escapeHtml(UyDosh.t('create.descriptionTemplateLabel', lang))}</span>
          </button>
          <div class="char-count description-char-count ${state.form.description.length > DESCRIPTION_MAX ? 'over' : ''}">${state.form.description.length}/${DESCRIPTION_MAX}</div>
        </div>
      </div>
      <div class="field">
        <div class="field-label">${UyDosh.escapeHtml(UyDosh.t('create.photos', lang))}</div>
        <div class="photo-grid">${existingPhotoSlots}${photoSlots}</div>
        ${totalPhotoCount < MAX_PHOTOS ? `
        <button
          type="button"
          class="photo-add"
          data-add-photo
          aria-label="${UyDosh.escapeHtml(UyDosh.t('create.addPhoto', lang))}"
        >${UyDosh.iconCamera(null)}</button>` : ''}
      </div>
    </section>`;
}

function renderStep3(lang) {
  const selectedAmenities = state.amenities.filter((a) =>
    state.form.amenityIds.has(Number(a.id)),
  );
  const amenityValueHtml = selectedAmenities.length
    ? UyDosh.amenityIconsRowHtml(selectedAmenities, lang, { showAll: true, variant: 'form' })
    : UyDosh.escapeHtml(UyDosh.t('create.reviewNotSet', lang));

  const moveIn = state.form.moveInDate
    ? UyDosh.formatDate(state.form.moveInDate, lang)
    : UyDosh.t('create.moveInAny', lang);

  const rows = [
    {
      label: UyDosh.t('create.reviewType', lang),
      valueHtml: listingTypeReviewBadgeHtml(lang),
      badges: true,
    },
    {
      label: UyDosh.t('create.reviewGender', lang),
      valueHtml: genderReviewBadgeHtml(lang),
      badges: true,
    },
    { label: UyDosh.t('create.titleLabel', lang), value: state.form.title, clip: true },
    { label: UyDosh.t('create.descriptionLabel', lang), value: state.form.description, clip: true },
    {
      label: UyDosh.t('create.reviewLocation', lang),
      valueHtml: selectedLocationReviewHtml(lang),
      location: true,
    },
    {
      label: UyDosh.t('create.reviewPrice', lang),
      valueHtml: formatPriceReviewHtml(lang),
      price: true,
    },
    ...(!isRoomNeeded() && state.form.addressText.trim()
      ? [{ label: UyDosh.t('create.address', lang), value: state.form.addressText.trim(), clip: true }]
      : []),
    {
      label: UyDosh.t('create.reviewAmenities', lang),
      valueHtml: amenityValueHtml,
      amenitiesIcons: true,
    },
    { label: UyDosh.t('create.reviewMoveIn', lang), value: moveIn },
  ];

  if (!isRoomNeeded()) {
    rows.push({
      label: UyDosh.t('create.reviewPrivateRoom', lang),
      value: state.form.privateRoom ? UyDosh.t('create.reviewYes', lang) : UyDosh.t('create.reviewNo', lang),
    });
  }

  const reviewRows = rows.map(({ label, value, valueHtml, clip, amenitiesIcons, badges, location, price }) => {
    const ddClass = [
      clip ? 'review-value-clip' : '',
      amenitiesIcons ? 'review-amenities-icons' : '',
      badges ? 'review-badges' : '',
      location ? 'review-location' : '',
      price ? 'review-price' : '',
    ].filter(Boolean).join(' ');
    const ddContent = valueHtml ?? UyDosh.escapeHtml(String(value ?? ''));
    return `
    <div class="review-row">
      <dt>${UyDosh.escapeHtml(label)}</dt>
      <dd${ddClass ? ` class="${ddClass}"` : ''}>${ddContent}</dd>
    </div>`;
  }).join('');

  const phoneShareBtn = `
    <button type="button" class="phone-share-btn" data-share-phone${state.form.phone ? ' hidden' : ''}>
      ${UyDosh.iconPhone()}
      <span>${UyDosh.escapeHtml(UyDosh.t('create.sharePhoneCta', lang))}</span>
    </button>`;

  const reviewPhotoUrls = [
    ...state.existingPhotos.map((photo) => UyDosh.photoUrl(photo)),
    ...state.form.photos.map((photo) => photo.previewUrl),
  ];
  const reviewPhotosBlock = reviewPhotoUrls.length > 0 ? `
      <div class="field">
        <div class="field-label">${UyDosh.escapeHtml(UyDosh.t('create.photos', lang))}</div>
        <div class="photo-grid">${reviewPhotoUrls.map((url) => `
          <div class="photo-slot">
            <img src="${UyDosh.escapeHtml(url)}" alt="" />
          </div>
        `).join('')}</div>
      </div>` : '';

  return `
    <section class="panel active" data-step="3">
      <div class="review-card">${reviewRows}</div>
      ${reviewPhotosBlock}
      <div class="field">
        <div class="field-label">${UyDosh.escapeHtml(UyDosh.t('create.reviewPhone', lang))}</div>
        <div class="phone-share-row">
          <div class="phone-input-wrap">
            ${UyDosh.iconPhone()}
            <input
              id="listing-phone"
              type="text"
              readonly
              placeholder="${UyDosh.escapeHtml(UyDosh.t('create.reviewNotSet', lang))}"
              value="${UyDosh.escapeHtml(state.form.phone)}"
            />
          </div>
          ${phoneShareBtn}
        </div>
      </div>
    </section>`;
}

/** Mirrors `.panel { gap: … }` in create.html — see the trailing-siblings loop below. */
const STEP_PANEL_GAP_PX = 14;

/**
 * The metro-station list's CSS height is a fixed guess (see `.station-list`
 * in create.html), which leaves a large empty gap above the fixed wizard
 * footer on tall screens. Measure the real remaining space and stretch the
 * list to fill it down to the footer, leaving a fixed 10px gap (mirrors
 * syncFeedMapPanelHeight in telegram-feed-map.js).
 *
 * The district grid (`.station-list-grid`) is short (two columns of ~12
 * items), so stretching it the same way just leaves empty space below the
 * last row. Size it to its content instead, capping at the same available
 * space so it still scrolls rather than overlapping the footer.
 *
 * Step 0 (roommate-needed listings) also renders an address field + "use my
 * location" button *after* this list — without reserving room for those, the
 * list would grow to fill all the way down to the footer and push that whole
 * block underneath it, clipped and barely reachable by scrolling. Measure and
 * reserve whatever height the list's trailing siblings (within the same
 * step) actually need first.
 */
function sizeLocationList() {
  const list = stepPanelsEl.querySelector('.station-list');
  if (!list) return;
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return;
  const top = list.getBoundingClientRect().top;
  if (!Number.isFinite(top)) return;
  const footerHeight = wizardFooterEl.hidden ? 0 : wizardFooterEl.getBoundingClientRect().height;
  let trailingHeight = 0;
  for (let sib = list.closest('.field')?.nextElementSibling; sib; sib = sib.nextElementSibling) {
    trailingHeight += sib.getBoundingClientRect().height + STEP_PANEL_GAP_PX;
  }
  const available = Math.max(160, Math.round(viewportHeight - top - footerHeight - trailingHeight - 10));
  if (list.classList.contains('station-list-grid')) {
    list.style.height = 'auto';
    list.style.maxHeight = `${available}px`;
  } else {
    list.style.height = `${available}px`;
    list.style.maxHeight = '';
  }
}

let sizeLocationListRaf = 0;
function scheduleSizeLocationList() {
  if (sizeLocationListRaf) cancelAnimationFrame(sizeLocationListRaf);
  sizeLocationListRaf = requestAnimationFrame(() => {
    sizeLocationListRaf = 0;
    sizeLocationList();
  });
}

window.addEventListener('resize', scheduleSizeLocationList, { passive: true });
window.visualViewport?.addEventListener('resize', scheduleSizeLocationList, { passive: true });

function renderStep() {
  const lang = UyDosh.getLang();
  const titles = stepTitles(lang);
  stepTitleEl.textContent = titles[state.step] || '';
  stepCounterEl.textContent = UyDosh.t('create.stepCounter', lang)
    .replace('{current}', String(state.step + 1))
    .replace('{total}', String(STEP_COUNT));

  renderProgress();

  let html = '';
  if (state.step === 0) html = renderStep0(lang);
  else if (state.step === 1) html = renderStep1(lang);
  else if (state.step === 2) html = renderStep2(lang);
  else html = renderStep3(lang);

  stepPanelsEl.innerHTML = html;
  bindStepEvents();
  updateWizardFooter();
  sizeLocationList();
}

/**
 * Kept `async` even though `STATIC_METRO_STATIONS` resolves synchronously —
 * call sites (`selectSubwayLine`, `loadReferenceData`) still `await` this,
 * and switching back to a live API fetch later (if the static list ever
 * falls out of sync) wouldn't need to touch any caller.
 */
async function loadStationsForLine(lineId) {
  state.stations = STATIC_METRO_STATIONS.filter((st) => Number(st.line) === Number(lineId));
  // Cache every station seen so far (across every line browsed) so a
  // multi-select made on one line survives switching to another line, and
  // so the review step can resolve names for off-line selections.
  for (const st of state.stations) {
    state.stationCache[Number(st.id)] = st;
  }
}

async function loadLocations() {
  state.locations = STATIC_LOCATIONS;
}

/**
 * Switches the active metro line and (re)loads its stations. Shared by the
 * line-chip click handler and the "nearby stations" suggestion chips (see
 * bindStepEvents) — selections survive the switch via `state.stationCache`,
 * same as manual line browsing.
 */
async function selectSubwayLine(lineId) {
  state.form.subwayLineId = lineId;
  state.stationsLoading = true;
  renderStationList();
  try {
    await loadStationsForLine(lineId);
  } catch (err) {
    console.error(err);
    if (lineId === state.form.subwayLineId) state.stations = [];
  } finally {
    if (lineId === state.form.subwayLineId) {
      state.stationsLoading = false;
      renderStationList();
    }
  }
}

async function loadReferenceData() {
  const amenitiesData = await UyDosh.fetchAmenitiesOrdered();
  state.amenities = UyDosh.sortAmenitiesForForm(
    Array.isArray(amenitiesData?.amenities) ? amenitiesData.amenities : [],
  );
  await Promise.all([loadStationsForLine(state.form.subwayLineId), loadLocations()]);
}

/**
 * Best-effort district auto-select for "Use current location" (see the
 * `data-use-current-location` handler in bindStepEvents): reverse-geocoding
 * only ever returns free-text, so this pulls the `kind: "district"` entry out
 * of Yandex's own address hierarchy (https://yandex.com/dev/geocode/doc/en/response)
 * and fuzzy-matches it against our `locations` list — Yandex's official
 * district names ("Шайхантахурский район") don't always match our DB's
 * spelling/short form ("Шайхантаур") character-for-character.
 */
function extractDistrictNameFromGeocode(upstream) {
  try {
    const members = upstream?.response?.GeoObjectCollection?.featureMember;
    const geoObject = Array.isArray(members) ? members[0]?.GeoObject : null;
    const components = geoObject?.metaDataProperty?.GeocoderMetaData?.Address?.Components;
    if (!Array.isArray(components)) return null;
    const district = components.find((c) => c?.kind === 'district');
    return typeof district?.name === 'string' ? district.name : null;
  } catch {
    return null;
  }
}

// `\bword\b`-style regexes don't work for stripping these — JS's `\b` is
// based on the ASCII-only `\w`, which never matches Cyrillic letters, so it
// can't find a boundary next to them. Split on non-letter runs and drop
// stopword tokens by exact match instead.
const DISTRICT_NAME_STOPWORDS = new Set(['район', 'тумани', 'туман', 'shahri', 'shahar', 'district']);
function normalizeDistrictName(s) {
  return String(s || '')
    .toLowerCase()
    .split(/[^a-zа-яёʻʼ']+/i)
    .filter((word) => word && !DISTRICT_NAME_STOPWORDS.has(word))
    .join('');
}

function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prevRow = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const currRow = [i + 1];
    for (let j = 0; j < b.length; j++) {
      currRow.push(a[i] === b[j]
        ? prevRow[j]
        : 1 + Math.min(prevRow[j], prevRow[j + 1], currRow[j]));
    }
    prevRow = currRow;
  }
  return prevRow[b.length];
}

/** 1 = identical, 0 = completely different (normalized by the longer string's length). */
function nameSimilarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

const DISTRICT_MATCH_THRESHOLD = 0.75;

function findLocationIdByDistrictName(districtName, locations, lang) {
  const target = normalizeDistrictName(districtName);
  if (!target) return null;
  let bestId = null;
  let bestScore = 0;
  for (const loc of locations) {
    const candidates = [UyDosh.localized(loc, lang), UyDosh.localizedShort(loc, lang)];
    for (const candidate of candidates) {
      const score = nameSimilarity(target, normalizeDistrictName(candidate));
      if (score > bestScore) {
        bestScore = score;
        bestId = Number(loc.id);
      }
    }
  }
  return bestScore >= DISTRICT_MATCH_THRESHOLD ? bestId : null;
}

/**
 * Metro station suggestions for "Use current location" (see the
 * `data-use-current-location` handler in bindStepEvents): straight-line
 * distance is a poor stand-in for actual walking distance, so this pads it
 * with a fixed detour factor before converting to minutes at a comfortable
 * urban walking pace — good enough for a "stations near you" shortlist, not
 * meant to match a real routing engine.
 */
const EARTH_RADIUS_METERS = 6371000;
const WALK_METERS_PER_MINUTE = 80; // ~4.8 km/h
const WALK_DETOUR_FACTOR = 1.3; // streets/blocks vs. straight-line distance
// Selectable walk-time radii for the "Find nearby metro stations" button
// (see `nearbyRadiusChipsHtml`) — the author picks how far they're willing
// to walk instead of being stuck with one fixed cutoff.
const NEARBY_STATION_RADIUS_OPTIONS = [10, 20, 30];
const DEFAULT_NEARBY_STATION_RADIUS_MINUTES = NEARBY_STATION_RADIUS_OPTIONS[0];
const MAX_SUGGESTED_STATIONS = 12;

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

/**
 * Stations within `maxMinutes` of `(latitude, longitude)`, nearest first,
 * capped to `MAX_SUGGESTED_STATIONS`. Also merges every candidate into
 * `state.stationCache` so the review step and cross-line multi-select keep
 * working if the author picks a suggestion whose line they haven't opened
 * yet.
 */
function findNearbyStations(latitude, longitude, maxMinutes = DEFAULT_NEARBY_STATION_RADIUS_MINUTES) {
  const nearby = STATIC_METRO_STATIONS
    .filter((st) => st.latitude != null && st.longitude != null)
    .map((st) => ({
      station: st,
      minutes: estimatedWalkMinutes(
        haversineMeters(latitude, longitude, Number(st.latitude), Number(st.longitude)),
      ),
    }))
    .filter((entry) => entry.minutes <= maxMinutes)
    .sort((a, b) => a.minutes - b.minutes)
    .slice(0, MAX_SUGGESTED_STATIONS);
  for (const { station } of nearby) {
    state.stationCache[Number(station.id)] = station;
  }
  return nearby;
}

function toggleSelection(list, id, multi) {
  const n = Number(id);
  if (!multi) return [n];
  if (list.includes(n)) return list.filter((x) => x !== n);
  return [...list, n];
}

function sameIdSet(a, b) {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((id) => setA.has(id));
}

/** Clears the free-text address + coordinates captured via "Use current
 * location" (see the `data-use-current-location` handler below). Those
 * values describe a point inside whichever district was selected at the
 * time, so once the user picks a different district by hand — overriding
 * the auto-detected one, or just changing their mind — the old address no
 * longer matches and must not be submitted alongside the new district. */
function clearCurrentLocationAddress() {
  state.form.addressText = '';
  state.form.addressLatitude = null;
  state.form.addressLongitude = null;
}

/** Toggle pressed state without re-rendering scrollable station/location lists. */
function updateStationSelectionUi() {
  const selected = new Set(state.form.selectedStationIds.map(Number));
  let allOnLineSelected = state.stations.length > 0;
  stepPanelsEl.querySelectorAll('[data-station-id]').forEach((btn) => {
    const id = Number(btn.getAttribute('data-station-id'));
    const pressed = selected.has(id);
    btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    if (!pressed) allOnLineSelected = false;
  });
  const selectAllBtn = stepPanelsEl.querySelector('[data-select-all-stations]');
  selectAllBtn?.setAttribute('aria-pressed', allOnLineSelected ? 'true' : 'false');
}

function updateLocationSelectionUi() {
  const selected = new Set(state.form.selectedLocationIds.map(Number));
  let allSelected = state.locations.length > 0;
  stepPanelsEl.querySelectorAll('[data-location-id]').forEach((btn) => {
    const id = Number(btn.getAttribute('data-location-id'));
    const pressed = selected.has(id);
    btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    if (!pressed) allSelected = false;
  });
  const selectAllBtn = stepPanelsEl.querySelector('[data-select-all-locations]');
  selectAllBtn?.setAttribute('aria-pressed', allSelected ? 'true' : 'false');
}

/** Updates aria-pressed on the already-rendered metro line chips without
 * touching the rest of the DOM, so the `[aria-pressed]`-driven CSS
 * transition (name reveal, border/badge pop) animates instead of snapping —
 * mirrors `syncMetroLineChipPressedState` in telegram-feed.js. A full
 * `renderStep()` would recreate the chip buttons from scratch already in
 * their final state, so the transition would never get a chance to play. */
function syncSubwayLineChipPressedState() {
  const selected = state.form.subwayLineId;
  stepPanelsEl.querySelectorAll('[data-subway-line]').forEach((btn) => {
    const lineId = Number(btn.getAttribute('data-subway-line'));
    btn.setAttribute('aria-pressed', lineId === selected ? 'true' : 'false');
  });
}

/** Re-renders only the station list (loading spinner / station items) for
 * a metro line switch, leaving the line chips and the rest of step 0 intact
 * so `syncSubwayLineChipPressedState` above keeps working. */
function renderStationList() {
  const lang = UyDosh.getLang();
  const listEl = stepPanelsEl.querySelector('.station-list');
  if (!listEl) return;
  listEl.innerHTML = stationListHtml(lang);
  bindStationListEvents();
  sizeLocationList();
}

function bindStationListEvents() {
  stepPanelsEl.querySelectorAll('[data-station-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.getAttribute('data-station-id'));
      state.form.selectedStationIds = toggleSelection(
        state.form.selectedStationIds,
        id,
        supportsMultiStation(),
      );
      if (state.form.selectedStationIds.length > 0 && state.validationError) {
        showFormError('');
        renderStep();
        return;
      }
      updateStationSelectionUi();
    });
  });

  stepPanelsEl.querySelector('[data-select-all-stations]')?.addEventListener('click', () => {
    const lineIds = state.stations.map((s) => Number(s.id));
    const allSelected =
      lineIds.length > 0 && lineIds.every((id) => state.form.selectedStationIds.includes(id));
    const otherLineIds = state.form.selectedStationIds.filter((id) => !lineIds.includes(id));
    state.form.selectedStationIds = allSelected ? otherLineIds : [...otherLineIds, ...lineIds];
    if (state.form.selectedStationIds.length > 0 && state.validationError) {
      showFormError('');
    }
    renderStep();
  });
}

function bindStepEvents() {
  stepPanelsEl.querySelectorAll('[data-listing-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.form.listingTypeId = Number(btn.getAttribute('data-listing-type'));
      if (!supportsMultiStation()) {
        state.form.selectedStationIds = state.form.selectedStationIds.slice(0, 1);
      }
      if (!supportsMultiLocation()) {
        state.form.selectedLocationIds = state.form.selectedLocationIds.slice(0, 1);
      }
      updateDefaultTitle();
      renderStep();
    });
  });

  stepPanelsEl.querySelectorAll('[data-location-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.form.locationMode = btn.getAttribute('data-location-mode');
      renderStep();
    });
  });

  stepPanelsEl.querySelector('#listing-address')?.addEventListener('input', (e) => {
    state.form.addressText = e.target.value;
  });

  stepPanelsEl.querySelector('[data-use-current-location]')?.addEventListener('click', async () => {
    if (state.locatingAddress) return;
    state.locatingAddress = true;
    renderStep();
    try {
      const { latitude, longitude } = await UyDosh.requestUserLocation();
      state.form.addressLatitude = latitude;
      state.form.addressLongitude = longitude;
      const result = await UyDosh.fetchReverseGeocodeAddress(latitude, longitude, UyDosh.getLang());
      if (result?.addressText) {
        state.form.addressText = result.addressText;
      }
      if (state.form.locationMode === LOCATION_MODE_DISTRICT) {
        const districtName = extractDistrictNameFromGeocode(result?.upstream);
        const matchedId = districtName
          ? findLocationIdByDistrictName(districtName, state.locations, UyDosh.getLang())
          : null;
        // "Use current location" only ever shows for roommate-needed listings
        // (see `addressBody` above), which only ever allow a single district —
        // safe to just replace the selection outright.
        if (matchedId != null) state.form.selectedLocationIds = [matchedId];
      }
      state.nearbyStations = findNearbyStations(latitude, longitude, state.nearbyStationsRadiusMinutes);
      state.nearbyStationsChecked = true;
      showFormError('');
    } catch (err) {
      console.error('Use current location failed', err);
      haptic('heavy');
      if (UyDosh.isMiniApp()) UyDosh.openTelegramLocationSettings();
      showFormError(UyDosh.t('create.errorLocationFailed', UyDosh.getLang()));
    } finally {
      state.locatingAddress = false;
      renderStep();
    }
  });

  // Dedicated "Find nearby metro stations" button (step 0, under "Use
  // current location"): reuses the address location if already known
  // (e.g. from "Use current location") instead of asking twice, otherwise
  // requests it fresh — then lists stations within the selected walk-time
  // radius (see nearbyRadiusChipsHtml).
  stepPanelsEl.querySelector('[data-find-nearby-metro]')?.addEventListener('click', async () => {
    if (state.findingNearbyStations) return;
    state.findingNearbyStations = true;
    renderStep();
    try {
      let { addressLatitude: latitude, addressLongitude: longitude } = state.form;
      if (latitude == null || longitude == null) {
        const position = await UyDosh.requestUserLocation();
        latitude = position.latitude;
        longitude = position.longitude;
        state.form.addressLatitude = latitude;
        state.form.addressLongitude = longitude;
      }
      state.nearbyStations = findNearbyStations(latitude, longitude, state.nearbyStationsRadiusMinutes);
      state.nearbyStationsChecked = true;
      showFormError('');
    } catch (err) {
      console.error('Find nearby metro stations failed', err);
      haptic('heavy');
      if (UyDosh.isMiniApp()) UyDosh.openTelegramLocationSettings();
      showFormError(UyDosh.t('create.errorLocationFailed', UyDosh.getLang()));
    } finally {
      state.findingNearbyStations = false;
      renderStep();
    }
  });

  // Walk-time radius toggle (10 / 20 / 30 min) — re-filters the already
  // fetched location without another geolocation lookup.
  stepPanelsEl.querySelectorAll('[data-nearby-radius]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const minutes = Number(btn.getAttribute('data-nearby-radius'));
      if (!Number.isFinite(minutes) || minutes === state.nearbyStationsRadiusMinutes) return;
      state.nearbyStationsRadiusMinutes = minutes;
      const { addressLatitude: latitude, addressLongitude: longitude } = state.form;
      if (latitude != null && longitude != null) {
        state.nearbyStations = findNearbyStations(latitude, longitude, minutes);
      }
      renderStep();
    });
  });

  stepPanelsEl.querySelectorAll('[data-subway-line]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const nextLineId = Number(btn.getAttribute('data-subway-line'));
      if (nextLineId === state.form.subwayLineId && !state.stationsLoading) return;
      // Flip aria-pressed on the existing chip buttons (instead of letting a
      // full renderStep() replace them) so the CSS transition that expands
      // the tapped chip into its name actually gets to play, matching the
      // feed filter ribbon (see syncMetroLineChipPressedState there).
      syncSubwayLineChipPressedState();
      await selectSubwayLine(nextLineId);
    });
  });

  bindStationListEvents();

  stepPanelsEl.querySelectorAll('[data-nearby-station-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-nearby-station-id'));
      const lineId = Number(btn.getAttribute('data-nearby-station-line'));
      if (lineId && lineId !== state.form.subwayLineId) {
        await selectSubwayLine(lineId);
      }
      state.form.selectedStationIds = toggleSelection(
        state.form.selectedStationIds,
        id,
        supportsMultiStation(),
      );
      if (state.form.selectedStationIds.length > 0 && state.validationError) {
        showFormError('');
      }
      renderStep();
    });
  });

  stepPanelsEl.querySelector('[data-select-all-locations]')?.addEventListener('click', () => {
    const allIds = state.locations.map((l) => Number(l.id));
    const allSelected =
      allIds.length > 0 && allIds.every((id) => state.form.selectedLocationIds.includes(id));
    state.form.selectedLocationIds = allSelected ? [] : [...allIds];
    if (state.form.selectedLocationIds.length > 0 && state.validationError) {
      showFormError('');
    }
    renderStep();
  });

  stepPanelsEl.querySelectorAll('[data-location-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.getAttribute('data-location-id'));
      const previousLocationIds = state.form.selectedLocationIds;
      state.form.selectedLocationIds = toggleSelection(
        previousLocationIds,
        id,
        supportsMultiLocation(),
      );
      const districtChanged = !sameIdSet(previousLocationIds, state.form.selectedLocationIds);
      const hadCurrentLocationAddress =
        state.form.addressText || state.form.addressLatitude != null;
      if (districtChanged && hadCurrentLocationAddress) clearCurrentLocationAddress();
      if (state.form.selectedLocationIds.length > 0 && state.validationError) {
        showFormError('');
        renderStep();
        return;
      }
      // Re-render (instead of just updating pressed states) when the address
      // was just cleared, so the textarea reflects the reset value.
      if (districtChanged && hadCurrentLocationAddress) {
        renderStep();
        return;
      }
      updateLocationSelectionUi();
    });
  });

  // Price sliders are updated in place (text + the other slider's `.value`
  // only) instead of calling renderStep() on every 'input' tick. Replacing
  // the <input type="range"> DOM node mid-drag kills the browser's native
  // pointer-capture/drag session on it, which is what made the handle jump
  // around erratically while dragging with a finger or mouse.
  function clearPriceFieldError(fieldEl) {
    if (!fieldEl?.classList.contains('has-error')) return;
    fieldEl.classList.remove('has-error');
    fieldEl.querySelector('.field-inline-error')?.remove();
  }

  const priceSingleInput = stepPanelsEl.querySelector('[data-price-single]');
  priceSingleInput?.addEventListener('input', (e) => {
    state.form.price = Number(e.target.value);
    const field = priceSingleInput.closest('.field');
    const valueEl = field?.querySelector('.price-value');
    if (valueEl) valueEl.textContent = `$${state.form.price}`;
    if (state.form.price >= PRICE_MIN) {
      showFormError('');
      clearPriceFieldError(field);
    }
  });

  const priceMinInput = stepPanelsEl.querySelector('[data-price-min]');
  const priceMaxInput = stepPanelsEl.querySelector('[data-price-max]');
  function syncPriceRangeDisplay() {
    const field = priceMinInput?.closest('.field');
    const valueEl = field?.querySelector('.price-value');
    if (valueEl) valueEl.textContent = `$${state.form.priceMin} – $${state.form.priceMax}`;
    return field;
  }
  priceMinInput?.addEventListener('input', (e) => {
    state.form.priceMin = Number(e.target.value);
    if (state.form.priceMin > state.form.priceMax) {
      state.form.priceMax = state.form.priceMin;
      if (priceMaxInput) priceMaxInput.value = String(state.form.priceMax);
    }
    const field = syncPriceRangeDisplay();
    if (priceBoundsForRequest().min >= PRICE_MIN) {
      showFormError('');
      clearPriceFieldError(field);
    }
  });
  priceMaxInput?.addEventListener('input', (e) => {
    state.form.priceMax = Number(e.target.value);
    if (state.form.priceMax < state.form.priceMin) {
      state.form.priceMin = state.form.priceMax;
      if (priceMinInput) priceMinInput.value = String(state.form.priceMin);
    }
    const field = syncPriceRangeDisplay();
    if (priceBoundsForRequest().min >= PRICE_MIN) {
      showFormError('');
      clearPriceFieldError(field);
    }
  });

  stepPanelsEl.querySelectorAll('[data-gender]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.form.gender = Number(btn.getAttribute('data-gender'));
      if (state.form.gender) showFormError('');
      updateDefaultTitle();
      renderStep();
    });
  });

  stepPanelsEl.querySelectorAll('[data-amenity-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.getAttribute('data-amenity-id'));
      if (state.form.amenityIds.has(id)) state.form.amenityIds.delete(id);
      else state.form.amenityIds.add(id);
      renderStep();
    });
  });

  stepPanelsEl.querySelector('#move-in-date')?.addEventListener('change', (e) => {
    state.form.moveInDate = e.target.value || '';
  });

  stepPanelsEl.querySelector('[data-private-room]')?.addEventListener('click', (e) => {
    state.form.privateRoom = !state.form.privateRoom;
    e.currentTarget.setAttribute(
      'aria-checked',
      state.form.privateRoom ? 'true' : 'false',
    );
  });

  stepPanelsEl.querySelector('#listing-title')?.addEventListener('input', (e) => {
    state.form.title = e.target.value;
    if (state.form.title.trim() && state.validationError) {
      showFormError('');
      renderStep();
      return;
    }
    const counter = stepPanelsEl.querySelector('.char-count');
    if (counter) {
      counter.textContent = `${state.form.title.length}/${TITLE_MAX}`;
      counter.classList.toggle('over', state.form.title.length > TITLE_MAX);
    }
  });

  stepPanelsEl.querySelector('#listing-description')?.addEventListener('input', (e) => {
    state.form.description = e.target.value;
    if (state.form.description.trim() && state.validationError) {
      showFormError('');
      renderStep();
      return;
    }
    const counter = stepPanelsEl.querySelector('.description-char-count');
    if (counter) {
      counter.textContent = `${state.form.description.length}/${DESCRIPTION_MAX}`;
      counter.classList.toggle('over', state.form.description.length > DESCRIPTION_MAX);
    }
  });

  stepPanelsEl.querySelector('[data-description-template]')?.addEventListener('click', () => {
    const lang = UyDosh.getLang();
    const text = UyDosh.descriptionTemplateText(
      state.form.listingTypeId,
      state.form.gender,
      lang,
    );
    state.form.description = text;
    const textarea = stepPanelsEl.querySelector('#listing-description');
    if (textarea) {
      textarea.value = text;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (state.form.description.trim() && state.validationError) {
      showFormError('');
      renderStep();
    }
  });

  stepPanelsEl.querySelector('[data-add-photo]')?.addEventListener('click', () => {
    photoInput.click();
  });

  stepPanelsEl.querySelectorAll('[data-remove-photo]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = Number(btn.getAttribute('data-remove-photo'));
      const removed = state.form.photos[index];
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      state.form.photos.splice(index, 1);
      renderStep();
    });
  });

  stepPanelsEl.querySelector('[data-share-phone]')?.addEventListener('click', async () => {
    UyDosh.logMiniAppEvent('create_share_phone_tap');
    const contactRaw = await UyDosh.requestTelegramContactShare();
    const phoneNumber = UyDosh.phoneNumberFromContactShareResponse(contactRaw);
    UyDosh.logMiniAppEvent(phoneNumber ? 'create_share_phone_sent' : 'create_share_phone_cancelled');
    if (!phoneNumber) return;
    state.form.phone = phoneNumber;
    renderStep();
    // Best-effort: persist to the account so it's remembered for next time. Never
    // blocks the review UI, which already reflects the shared number either way.
    try {
      await UyDosh.updateMyPhoneNumber(phoneNumber);
      UyDosh.logMiniAppEvent('create_share_phone_saved');
    } catch (err) {
      UyDosh.logMiniAppEvent('create_share_phone_save_failed', { status: err?.status });
    }
  });
}

function validateStep(step) {
  const lang = UyDosh.getLang();
  if (step === 0) {
    if (state.form.locationMode === LOCATION_MODE_METRO && state.form.selectedStationIds.length === 0) {
      return {
        message: UyDosh.t('create.errorLocationRequired', lang),
        anchor: 'location',
      };
    }
    if (state.form.locationMode === LOCATION_MODE_DISTRICT && state.form.selectedLocationIds.length === 0) {
      return {
        message: UyDosh.t('create.errorLocationRequired', lang),
        anchor: 'location',
      };
    }
  }
  if (step === 1) {
    if (!state.form.gender) {
      return {
        message: UyDosh.t('create.errorGenderRequired', lang),
        anchor: 'gender',
      };
    }
    const bounds = priceBoundsForRequest();
    if (bounds.min < PRICE_MIN) {
      return {
        message: UyDosh.t('create.errorPriceRequired', lang),
        anchor: 'price',
      };
    }
  }
  if (step === 2) {
    const title = state.form.title.trim();
    const description = state.form.description.trim();
    if (!title) {
      return {
        message: UyDosh.t('create.errorTitleRequired', lang),
        anchor: 'title',
      };
    }
    if (title.length > TITLE_MAX) {
      return {
        message: UyDosh.t('create.errorTitleTooLong', lang),
        anchor: 'title',
      };
    }
    if (!description) {
      return {
        message: UyDosh.t('create.errorDescriptionRequired', lang),
        anchor: 'description',
      };
    }
    if (description.length > DESCRIPTION_MAX) {
      return {
        message: UyDosh.t('create.errorDescriptionTooLong', lang),
        anchor: 'description',
      };
    }
  }
  return null;
}

async function submitListing() {
  if (state.submitting) return;
  const isEdit = Boolean(state.editingListingId);
  UyDosh.logMiniAppEvent(isEdit ? 'listing_edit_save_tapped' : 'listing_publish_tapped', {
    flow: 'telegram_create',
    listing_type_id: state.form.listingTypeId,
    photo_count: state.form.photos.length,
  });
  state.submitting = true;
  showFormError('');
  updateWizardFooter();
  haptic('medium');

  try {
    const bounds = priceBoundsForRequest();
    const body = {
      title: state.form.title.trim(),
      listingTypeId: state.form.listingTypeId,
      price: priceForRequest(),
      minPrice: isRoomNeeded() ? bounds.min : undefined,
      maxPrice: isRoomNeeded() ? bounds.max : undefined,
      description: state.form.description.trim(),
      gender: state.form.gender,
      amenityIds: [...state.form.amenityIds],
      moveInDate: state.form.moveInDate || undefined,
      privateRoom: !isRoomNeeded() ? state.form.privateRoom : undefined,
      // Omitted entirely for room-needed listings (no address concept there).
      // For roommate-needed listings, sent even when empty so clearing the
      // field during an edit actually clears the saved address — the backend
      // only ever persists it for roommate-needed listings anyway (see
      // `shouldPersistAddress` in listingService).
      addressText: !isRoomNeeded() ? state.form.addressText.trim() : undefined,
      addressLatitude: !isRoomNeeded() && state.form.addressLatitude != null
        ? state.form.addressLatitude
        : undefined,
      addressLongitude: !isRoomNeeded() && state.form.addressLongitude != null
        ? state.form.addressLongitude
        : undefined,
    };

    if (state.form.locationMode === LOCATION_MODE_METRO) {
      if (supportsMultiStation() && state.form.selectedStationIds.length > 0) {
        // The first pick is persisted as the primary station; its own line
        // (not necessarily the line currently shown in the UI) travels with
        // it, matching the mobile app's `effectiveSubwayLineId`.
        const primaryStation = state.stationCache[state.form.selectedStationIds[0]];
        body.subwayLineId = primaryStation
          ? Number(primaryStation.line)
          : state.form.subwayLineId;
        body.subwayStationIds = state.form.selectedStationIds;
      } else {
        body.subwayLineId = state.form.subwayLineId;
        body.subwayStationId = state.form.selectedStationIds[0];
      }
    } else if (supportsMultiLocation()) {
      body.locationIds = state.form.selectedLocationIds;
    } else {
      body.locationId = state.form.selectedLocationIds[0];
    }

    let listingId;
    if (isEdit) {
      listingId = state.editingListingId;
      await UyDosh.updateListingFromTelegramMiniApp(listingId, body);
      UyDosh.logMiniAppEvent('listing_edit_saved', {
        listing_id: listingId,
        listing_type_id: state.form.listingTypeId,
      });
    } else {
      const result = await UyDosh.createListingFromTelegramMiniApp(body);
      listingId = result?.listing?.id;
      UyDosh.logMiniAppEvent('listing_created', {
        listing_type_id: state.form.listingTypeId,
        photo_count: state.form.photos.length,
      });
      if (listingId) {
        UyDosh.logMiniAppEvent('listing_published', {
          listing_id: listingId,
          source: 'telegram_create',
          listing_type_id: state.form.listingTypeId,
        });
      }
    }

    let failedPhotoCount = 0;
    if (listingId && state.form.photos.length > 0) {
      const isPrimaryStart = state.existingPhotos.length === 0;
      for (let i = 0; i < state.form.photos.length; i += 1) {
        const photo = state.form.photos[i];
        try {
          await UyDosh.uploadListingPhoto(listingId, photo.dataUrl, { isPrimary: isPrimaryStart && i === 0 });
        } catch (photoErr) {
          console.error('Photo upload failed', photoErr);
          failedPhotoCount += 1;
        }
      }
    }

    formRoot.hidden = true;
    showFormError('');
    wizardFooterEl.hidden = true;
    hideTelegramMainButton();
    tg()?.BackButton?.hide();
    if (failedPhotoCount > 0 && successPhotoWarningEl) {
      successPhotoWarningEl.hidden = false;
      successPhotoWarningEl.textContent = UyDosh.t('create.successPhotoWarning', UyDosh.getLang());
    } else if (successPhotoWarningEl) {
      successPhotoWarningEl.hidden = true;
    }
    const lang = UyDosh.getLang();
    if (isEdit) {
      if (successTitleEl) {
        successTitleEl.textContent = UyDosh.t('create.editSuccess', lang);
        successTitleEl.removeAttribute('data-i18n');
      }
      if (successHintEl) {
        successHintEl.textContent = UyDosh.t('create.editSuccessHint', lang);
        successHintEl.removeAttribute('data-i18n');
      }
      // Edit mode: primary action returns to the "my listings" page the user
      // came from (not the feed) — the secondary feed link stays available too.
      if (successFeedBtn) {
        successFeedBtn.href = UyDosh.MINI_APP_ACCOUNT_PATH;
        successFeedBtn.textContent = UyDosh.t('create.backToAccount', lang);
        successFeedBtn.removeAttribute('data-i18n');
      }
      if (successViewBtn) {
        successViewBtn.href = UyDosh.MINI_APP_FEED_PATH;
        successViewBtn.textContent = UyDosh.t('create.backToFeed', lang);
        successViewBtn.removeAttribute('data-i18n');
      }
    }
    successRoot.hidden = false;
    successRoot.classList.add('active');
  } catch (err) {
    console.error(isEdit ? 'Update listing failed' : 'Create listing failed', err, err.payload);
    if (err.status === 401) UyDosh.clearTelegramInitData();
    haptic('heavy');
    showFormError(
      err.status === 401
        ? UyDosh.t('create.errorAuth', UyDosh.getLang())
        : err.status === 403
          ? UyDosh.t('create.errorNotOwner', UyDosh.getLang())
          : err.message || UyDosh.t('create.errorGeneric', UyDosh.getLang()),
    );
  } finally {
    state.submitting = false;
    updateWizardFooter();
  }
}

function goNext() {
  const validation = validateStep(state.step);
  if (validation) {
    haptic('heavy');
    showFormError(validation.message, validation.anchor);
    renderStep();
    scrollToValidationAnchor();
    return;
  }
  showFormError('');
  if (state.step >= STEP_COUNT - 1) {
    submitListing();
    return;
  }
  state.step += 1;
  renderStep();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Shared by the DOM "Back" button (which opts out of the auto tap-feedback
// binder via data-haptic="none" to avoid a double buzz) and Telegram's native
// BackButton (not a DOM element, so it needs this explicit call).
function goBack() {
  haptic();
  if (state.step <= 0) {
    location.href = UyDosh.MINI_APP_FEED_PATH;
    return;
  }
  state.step -= 1;
  showFormError('');
  renderStep();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

photoInput.addEventListener('change', async () => {
  const files = [...(photoInput.files || [])];
  photoInput.value = '';
  const remainingSlots = MAX_PHOTOS - state.existingPhotos.length - state.form.photos.length;
  for (const file of files.slice(0, Math.max(0, remainingSlots))) {
    try {
      const dataUrl = await UyDosh.resizeImageFileForUpload(file);
      state.form.photos.push({
        file,
        dataUrl,
        previewUrl: URL.createObjectURL(file),
      });
    } catch (err) {
      console.error('Photo resize failed', err);
      haptic('heavy');
      showFormError(UyDosh.t('create.errorPhotoProcess', UyDosh.getLang()));
    }
  }
  renderStep();
});

async function boot() {
  UyDosh.initLangSwitcher();
  UyDosh.applyI18n();

  document.addEventListener('uydosh:langchange', async () => {
    UyDosh.applyI18n();
    try {
      await loadReferenceData();
    } catch { /* ignore */ }
    updateDefaultTitle();
    renderStep();
    updateWizardFooter();
  });

  wizardBackBtn.addEventListener('click', () => {
    if (state.submitting || state.step <= 0) return;
    goBack();
  });
  wizardNextBtn.addEventListener('click', () => {
    if (state.submitting) return;
    goNext();
  });

  const webApp = tg();
  hideTelegramMainButton();
  webApp?.BackButton?.onClick(() => {
    if (state.step <= 0) goBack();
  });

  const initData = UyDosh.getTelegramInitData();
  if (!initData) {
    loadingEl.classList.add('error');
    loadingEl.textContent = UyDosh.t('create.errorAuth', UyDosh.getLang());
    return;
  }

  const params = new URLSearchParams(location.search);
  const editId = Number(params.get('id'));
  if (Number.isFinite(editId) && editId > 0) state.editingListingId = editId;

  try {
    state.auth = await UyDosh.authenticateTelegramMiniApp();
    const accountPhone = state.auth?.user?.phone_number;
    if (typeof accountPhone === 'string' && accountPhone.trim()) {
      state.form.phone = accountPhone.trim();
    }
    await loadReferenceData();
    if (state.editingListingId) {
      await loadListingForEdit(state.editingListingId);
    } else {
      updateDefaultTitle();
    }
    applyEditModeChrome();
    loadingEl.hidden = true;
    formRoot.hidden = false;
    renderStep();
  } catch (err) {
    console.error(err);
    if (err.status === 401) UyDosh.clearTelegramInitData();
    loadingEl.classList.add('error');
    loadingEl.textContent = err.status === 401
      ? UyDosh.t('create.errorAuth', UyDosh.getLang())
      : err.status === 404
        ? UyDosh.t('create.errorNotOwner', UyDosh.getLang())
        : UyDosh.t('create.errorGeneric', UyDosh.getLang());
  }
}

boot();
