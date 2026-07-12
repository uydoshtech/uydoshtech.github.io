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

/**
 * `--range-progress` custom property consumed by the `input[type="range"]`
 * rules in telegram-create.css to paint the filled (left of the thumb)
 * portion of the price sliders blue (`var(--brand2)`, same as a selected
 * amenity chip) instead of relying on `accent-color`, which doesn't render a
 * filled track at all in every webview the mini app runs in.
 */
function rangeProgressStyle(value, min, max) {
  const pct = max > min ? ((Number(value) - min) / (max - min)) * 100 : 0;
  return `style="--range-progress: ${Math.min(100, Math.max(0, pct)).toFixed(2)}%"`;
}
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
const successViewLabelEl = document.getElementById('success-view-label');
const successFeedLabelEl = document.getElementById('success-feed-label');
const successViewIconEl = document.getElementById('success-view-icon');
const successFeedIconEl = document.getElementById('success-feed-icon');
const successPhotoWarningEl = document.getElementById('success-photo-warning');
const stepPanelsEl = document.getElementById('step-panels');
const stepTitleEl = document.getElementById('step-title');
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
  /// True while the description field's "Improve with AI" button (Gemini-backed, see
  /// `improveDescriptionWithAi`) has a request in flight.
  aiImproveLoading: false,
  /// Server-side kill switch for the Gemini description actions (admin toggle) — mirrors
  /// the mobile app's `ClientGeminiListingUiConfig`. Fetched once at wizard init (see
  /// `loadGeminiListingUiVisibility`); defaults to visible (false) until that resolves.
  geminiListingUiHidden: false,
  /// 'idle' | 'recording' | 'uploading' — the description field's "Dictate" button (see
  /// `toggleDescriptionDictation`), mirrors the mobile app's `ListingDescriptionDictateButton`.
  dictationState: 'idle',
  /// Set when editing an existing listing (from `?id=` on the URL). Only the
  /// listing's own owner (or an admin, see `isAdminEditing` below) can load/save
  /// it — enforced server-side via initData.
  editingListingId: null,
  /// True when `loadListingForEdit` had to fall back to the admin-only
  /// fetch/update endpoints because `editingListingId` isn't one of the
  /// caller's own listings (see `mountAdminOwnerPanel`) — never trusted for
  /// authorization, just gates the "reassign owner" panel's visibility.
  isAdminEditing: false,
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
  /// `{ station, minutes }[]`, nearest-first, populated by `findNearbyStations`
  /// after a successful "Find nearby metro stations" lookup — lets step 0
  /// suggest metro stations within `nearbyStationsRadiusMinutes` of the
  /// author's location.
  nearbyStations: [],
  /// True when `nearbyStations` holds a single entry that's actually outside
  /// `nearbyStationsRadiusMinutes` — the closest station overall, shown as a
  /// fallback so the panel isn't just empty (see `findNearbyStations`).
  nearbyStationsIsFallback: false,
  /// True when the closest station overall is farther than the largest
  /// `NEARBY_STATION_RADIUS_OPTIONS` entry — every radius chip would then
  /// produce the exact same fallback result, so `nearbyStationsHtml` hides
  /// the toggle instead of showing chips that visibly do nothing when
  /// tapped (see `findNearbyStations`).
  nearbyStationsBeyondMaxRadius: false,
  /// True once "Find nearby metro stations" has actually searched, so the
  /// metro panel can tell "never asked" apart from "asked, found nothing
  /// within range" (see renderStep0).
  nearbyStationsChecked: false,
  /// Selected walk-time radius (minutes) for "Find nearby metro stations" —
  /// one of `NEARBY_STATION_RADIUS_OPTIONS` (10 by default).
  nearbyStationsRadiusMinutes: 10,
  /// Station ids the author explicitly unchecked from the nearby-stations
  /// panel (see `bindNearbyMetroEvents`) — `preselectNearbyStations`/
  /// `applyNearbyStations`'s fallback-select must not re-add these on a
  /// later recompute (radius chip, pin drag, re-geocode), or a removed
  /// suggestion silently reappears and gets submitted with the listing
  /// (mirrors the mobile app's `_dismissedNearbyStationIds`).
  dismissedNearbyStationIds: [],
  /// Yandex Geosuggest session token for the address field's autocomplete
  /// (see `addressSuggestSessionToken()`) — one random id per "typing
  /// session", reset after a suggestion is picked or the field is cleared,
  /// per Yandex's billing guidance (groups a session's requests into one
  /// billed unit instead of charging per keystroke).
  addressSuggestSessionToken: null,
  /// `{ displayText, subtitle }[]` from the last successful address
  /// autocomplete fetch — see `fetchAddressSuggestions` (step 0).
  addressSuggestions: [],
  addressSuggestLoading: false,
  /// True once the *current* search has confirmed there are zero matches
  /// (a real "nothing found" response, not just "haven't searched yet" or a
  /// failed fetch) — see `renderAddressSuggestionsPanel`.
  addressSuggestNoMatches: false,
  /// Guards the empty-result haptic burst so it fires once per distinct
  /// no-match query instead of again on every keystroke while it stays
  /// empty — reset whenever a new debounced search starts.
  addressSuggestNoMatchesHapticFired: false,
  /// True while `resolveAddressLocation` (roommate-needed's merged
  /// address+nearby-metro step) is forward-geocoding the typed/picked
  /// address into `{ latitude, longitude }` — lets the nearby-stations panel
  /// show a spinner instead of the "type an address" hint while that's in
  /// flight.
  addressGeocoding: false,
  /// The address text `resolveAddressLocation` last successfully geocoded —
  /// lets the textarea's blur handler skip re-geocoding when the text hasn't
  /// actually changed since (e.g. tabbing away without editing).
  addressGeocodedText: null,
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

/// Both listing types can be tagged with several metro stations: a
/// roommate-needed apartment is one fixed place, but it can genuinely sit
/// within walking distance of more than one station (this is exactly what
/// the "find nearby metro stations" suggestions surface), and a room-needed
/// search is inherently flexible about which stations are acceptable.
function supportsMultiStation() {
  return true;
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

/**
 * Labels for the "Для кого" gender picker (step 1). Deliberately its own
 * `create.gender*` keys rather than the shared `filter.gender.*` ones (which
 * stay short — "М"/"Ж" — for the feed's compact filter chips): here the
 * buttons are large and standalone, so the full "Парень"/"Девушка" wording
 * reads better than a bare letter.
 */
function genderLabel(gender, lang) {
  return gender === 2
    ? UyDosh.t('create.genderFemale', lang)
    : UyDosh.t('create.genderMale', lang);
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
  // Reformatted (not just copied) so listings saved before this formatting
  // existed show up identically to freshly-resolved ones — see
  // `UyDosh.formatAddressText`.
  state.form.addressText = UyDosh.formatAddressText(listing.address_text || '');
  const addressLat = Number(listing.address_latitude);
  const addressLon = Number(listing.address_longitude);
  state.form.addressLatitude = Number.isFinite(addressLat) ? addressLat : null;
  state.form.addressLongitude = Number.isFinite(addressLon) ? addressLon : null;
  if (state.form.addressText.trim() && state.form.addressLatitude != null) {
    // Matches what a fresh forward-geocode of this exact text would resolve
    // to, so `resolveAddressLocation` doesn't re-hit the geocoder the first
    // time the author merely taps into and out of the field without editing
    // it (see the comparison there).
    state.addressGeocodedText = state.form.addressText.trim();
  }

  // Roommate-needed always uses the merged address+nearby-metro step now
  // (see roommateLocationSectionHtml) — district mode only ever applied to
  // it historically. Force metro mode so editing such a listing doesn't
  // resurrect the retired district picker, and best-effort seed the nearby
  // stations panel so the author sees their already-saved station(s)
  // highlighted instead of a blank "type an address" hint: prefer the
  // listing's own saved coordinates, falling back to its district's
  // centroid for the (legacy, district-mode) listings that never had one.
  if (typeId !== LISTING_TYPE_ROOM_NEEDED) {
    const wasDistrictMode = state.form.locationMode === LOCATION_MODE_DISTRICT;
    state.form.locationMode = LOCATION_MODE_METRO;
    let seedLat = state.form.addressLatitude;
    let seedLon = state.form.addressLongitude;
    if ((seedLat == null || seedLon == null) && wasDistrictMode) {
      const district = state.locations.find((loc) => Number(loc.id) === state.form.selectedLocationIds[0]);
      seedLat = district ? Number(district.latitude) : null;
      seedLon = district ? Number(district.longitude) : null;
    }
    if (Number.isFinite(seedLat) && Number.isFinite(seedLon)) {
      applyNearbyStations(seedLat, seedLon, state.nearbyStationsRadiusMinutes, { preselect: false });
    }
  }
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

/**
 * Fetch the caller's own listings and find the one being edited (ownership is enforced
 * this way — no separate authenticated single-listing fetch needed). Falls back to the
 * admin-only single-listing fetch (`fetchListingForAdminEditFromTelegramMiniApp`) when
 * the listing isn't among the caller's own *and* the caller is an admin (see
 * `UyDosh.isAdmin`) — lets an admin open someone else's listing from the "Edit (admin)"
 * button on the detail page (`detailContactBarHtml`) without a separate admin UI.
 */
async function loadListingForEdit(id) {
  const data = await UyDosh.fetchMyTelegramMiniAppListings();
  const listings = Array.isArray(data?.listings) ? data.listings : [];
  const listing = listings.find((l) => Number(l.id) === Number(id));
  if (listing) {
    hydrateFormFromListing(listing);
    return;
  }

  if (UyDosh.isAdmin?.()) {
    const adminData = await UyDosh.fetchListingForAdminEditFromTelegramMiniApp(id).catch(() => null);
    if (adminData?.listing) {
      state.isAdminEditing = true;
      hydrateFormFromListing(adminData.listing);
      return;
    }
  }

  const err = new Error('Listing not found or not yours');
  err.status = 404;
  throw err;
}

/** Swap the browser/tab title to edit-mode wording (the wizard header carries no title text),
 * and — when editing as an admin (see `loadListingForEdit`) — mount the "reassign owner" panel. */
function applyEditModeChrome() {
  if (!state.editingListingId) return;
  document.title = `UyDosh — ${UyDosh.t('create.editTitle', UyDosh.getLang())}`;
  mountAdminOwnerPanel();
}

/**
 * Admin-only panel, mounted once right under the wizard's progress header (so it stays
 * visible across every step, unlike `#step-panels`' own per-step content) — lets an admin
 * type the corrected owner's Telegram @username or phone number and repoint the listing,
 * completely independent from the regular field edits/submit below it (see
 * `reassignListingOwnerFromTelegramMiniApp` on the backend for why this never touches the
 * fields the main form submits).
 */
function adminOwnerPanelHtml() {
  return `
    <div class="admin-owner-panel" id="admin-owner-panel">
      <div class="admin-owner-panel-label">${UyDosh.escapeHtml(UyDosh.t('create.adminReassignOwnerTitle'))}</div>
      <div class="admin-owner-panel-row">
        <input
          type="text"
          id="admin-owner-input"
          class="admin-owner-input"
          placeholder="${UyDosh.escapeHtml(UyDosh.t('create.adminReassignOwnerPlaceholder'))}"
          autocomplete="off"
          autocapitalize="off"
        />
        <button type="button" class="admin-owner-btn" id="admin-owner-submit">
          ${UyDosh.escapeHtml(UyDosh.t('create.adminReassignOwnerButton'))}
        </button>
      </div>
      <div class="admin-owner-panel-status" id="admin-owner-status" hidden></div>
    </div>
  `;
}

function mountAdminOwnerPanel() {
  if (!state.isAdminEditing || document.getElementById('admin-owner-panel')) return;
  const header = document.querySelector('.wizard-header');
  if (!header) return;
  header.insertAdjacentHTML('afterend', adminOwnerPanelHtml());
  bindAdminOwnerPanel();
}

function bindAdminOwnerPanel() {
  const panel = document.getElementById('admin-owner-panel');
  const input = document.getElementById('admin-owner-input');
  const btn = document.getElementById('admin-owner-submit');
  const statusEl = document.getElementById('admin-owner-status');
  if (!panel || !input || !btn || !statusEl) return;

  const setStatus = (kind, message) => {
    statusEl.hidden = false;
    statusEl.className = `admin-owner-panel-status admin-owner-panel-status-${kind}`;
    statusEl.textContent = message;
  };

  btn.addEventListener('click', async () => {
    const raw = input.value.trim();
    if (!raw) return;
    // A phone-like input is digits/spaces/+/-/() only; anything with letters is treated
    // as a Telegram username (with or without the leading @) instead.
    const looksLikePhone = /^[+0-9][0-9\s()-]{4,}$/.test(raw);
    btn.disabled = true;
    try {
      UyDosh.haptic?.light?.();
      await UyDosh.reassignListingOwnerFromTelegramMiniApp(
        state.editingListingId,
        looksLikePhone ? { ownerPhoneNumber: raw } : { ownerTelegramUsername: raw },
      );
      input.value = '';
      setStatus('success', UyDosh.t('create.adminReassignOwnerSuccess'));
    } catch (err) {
      setStatus('error', err?.payload?.error || err?.message || UyDosh.t('create.adminReassignOwnerError'));
    } finally {
      btn.disabled = false;
    }
  });
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

/**
 * Truncates a review-step "clip" value (title/description) to a fixed
 * character count with a trailing ellipsis, instead of relying purely on the
 * `.review-value-clip` CSS (overflow/text-overflow), which cuts off wherever
 * the row's available width happens to run out — that made the shown amount
 * vary with screen width/font instead of being predictable, and could reveal
 * much more of a long value than intended on a wide screen.
 */
const REVIEW_VALUE_CLIP_LENGTH = 15;

function truncateReviewValue(text, maxLength = REVIEW_VALUE_CLIP_LENGTH) {
  const trimmed = text.trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}…` : trimmed;
}

/**
 * Review-step metro stations get their own line-colored train icon each
 * (via `UyDosh.iconMetro`, same icon/coloring as the transfer-station
 * suffix in `nearbyMetroSectionHtml`) instead of one plain comma-joined
 * string, so multi-station listings read like the rest of the app's metro
 * chrome instead of bare text.
 */
function selectedLocationReviewHtml(lang) {
  if (state.form.locationMode === LOCATION_MODE_METRO) {
    const stations = state.form.selectedStationIds
      .map((id) => state.stationCache[id])
      .filter(Boolean);
    if (!stations.length) return UyDosh.escapeHtml(UyDosh.t('create.reviewNotSet', lang));
    return stations.map((st) => `
      <span class="review-location-item">${UyDosh.iconMetro(st.line)}<span>${UyDosh.escapeHtml(UyDosh.localized(st, lang))}</span></span>
    `).join('');
  }
  const summary = selectedLocationSummary(lang);
  if (!summary) {
    return UyDosh.escapeHtml(UyDosh.t('create.reviewNotSet', lang));
  }
  return `<span class="review-location-item">${UyDosh.iconPin()}<span>${UyDosh.escapeHtml(summary)}</span></span>`;
}

/**
 * Calling codes we know how to split off a shared/typed phone number, longest
 * match first so e.g. "998..." isn't mistaken for a generic 1-digit code.
 * Mirrors the CIS-heavy set the mobile app offers at sign-in (see
 * `_allowedPhoneDialCodes` in `phone_sign_in_sheet.dart`), since the same
 * pool of Telegram users applies here.
 */
const PHONE_DIAL_CODES = [
  '998', '996', '995', '994', '993', '992', '380', '375', '374', '373', '372', '371', '370', '7', '1',
].sort((a, b) => b.length - a.length);

/** Default calling code shown before the user has any phone number yet — UZ is this app's primary market. */
const DEFAULT_PHONE_DIAL_CODE = '998';

/**
 * Representative ISO-3166 country for each calling code above, purely for the flag emoji
 * next to the field (see `phoneDialCodeFlagEmoji`) — mirrors the mobile app's phone
 * sign-in picker (`_allowedPhoneDialCodes` in `phone_sign_in_sheet.dart`), including its
 * choice of RU/US for the ambiguous shared codes "7"/"1" (also used by KZ and CA/etc.).
 */
const PHONE_DIAL_CODE_ISO = {
  998: 'UZ', 996: 'KG', 995: 'GE', 994: 'AZ', 993: 'TM', 992: 'TJ',
  380: 'UA', 375: 'BY', 374: 'AM', 373: 'MD', 372: 'EE', 371: 'LV', 370: 'LT',
  7: 'RU', 1: 'US',
};

/**
 * National significant-number length per calling code — caps how many digits the field
 * will accept/format. Getting this wrong used to silently truncate valid numbers (a
 * hardcoded 9-digit Uzbek cap chopped the last digit off any 10-digit number, e.g. US).
 * Approximate for the less common codes; good enough to stop typing at a sane length
 * without misrepresenting the number.
 */
const PHONE_NATIONAL_DIGIT_COUNT = {
  998: 9, 996: 9, 995: 9, 994: 9, 993: 8, 992: 9,
  380: 9, 375: 9, 374: 8, 373: 8, 372: 8, 371: 8, 370: 8,
  7: 10, 1: 10,
};

/** Digit-group sizes for calling codes with a well-known local format, first group parenthesized. */
const PHONE_GROUP_SIZES = {
  998: [2, 3, 2, 2], // UZ: (90)-123-45-67
  7: [3, 3, 2, 2], // RU/KZ: (912)-345-67-89
  1: [3, 3, 4], // US/CA (NANP): (650)-669-0800
};

/**
 * Splits a raw phone number (E.164-ish, with or without "+") into its calling
 * code and the remaining national digits, so the review step can render the
 * code as a fixed prefix and the rest as an editable, formatted field.
 */
function splitPhoneForDisplay(rawPhone) {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  if (!digits) return { code: DEFAULT_PHONE_DIAL_CODE, national: '' };
  const code = PHONE_DIAL_CODES.find((c) => digits.startsWith(c)) || digits.slice(0, 3);
  return { code, national: digits.slice(code.length) };
}

function phoneNationalMaxLength(code) {
  return PHONE_NATIONAL_DIGIT_COUNT[code] || 10;
}

/** "(65)-123-45-67" — progressively parenthesizes/dashes `sizes`-shaped digit groups, rendering naturally on partial input while the user is still typing. */
function groupPhoneDigitsWithParens(digits, sizes) {
  const groups = [];
  let idx = 0;
  for (const size of sizes) {
    if (idx >= digits.length) break;
    groups.push(digits.slice(idx, idx + size));
    idx += size;
  }
  if (!groups.length) return '';
  let out = `(${groups[0]}`;
  if (groups[0].length === sizes[0]) out += ')';
  for (let i = 1; i < groups.length; i++) out += `-${groups[i]}`;
  return out;
}

/** Plain dash-separated groups (no parens) — fallback shape for calling codes without a known local format. */
function groupPhoneDigitsPlain(digits, sizes) {
  const groups = [];
  let idx = 0;
  for (const size of sizes) {
    if (idx >= digits.length) break;
    groups.push(digits.slice(idx, idx + size));
    idx += size;
  }
  return groups.join('-');
}

/**
 * Formats national-number digits per calling `code` — e.g. "(90)-123-45-67" for UZ,
 * "(650)-669-0800" for US/CA. Works incrementally on partial input too, so it can be
 * reused as an input formatter while the user is still typing. Codes without a curated
 * `PHONE_GROUP_SIZES` entry fall back to plain 3-digit grouping instead of borrowing
 * another country's shape (and digit cap) like this used to unconditionally do.
 */
function formatNationalPhoneNumber(code, rawDigits) {
  const digits = String(rawDigits || '').replace(/\D/g, '').slice(0, phoneNationalMaxLength(code));
  if (!digits) return '';
  const sizes = PHONE_GROUP_SIZES[code];
  return sizes ? groupPhoneDigitsWithParens(digits, sizes) : groupPhoneDigitsPlain(digits, [3, 3, 3, 3]);
}

/** Regional-indicator flag emoji for a 2-letter ISO country code, e.g. "UZ" -> "🇺🇿". */
function isoCountryFlagEmoji(iso2) {
  if (!iso2 || iso2.length !== 2) return '';
  const points = [...iso2.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65);
  return String.fromCodePoint(...points);
}

/** Flag shown in the phone field in place of a generic phone icon (see phoneFieldHtml) — reflects the number actually entered/shared, not a static icon. */
function phoneDialCodeFlagEmoji(code) {
  return isoCountryFlagEmoji(PHONE_DIAL_CODE_ISO[code]) || '🌐';
}

/** "Any date" once formatted, or the localized move-in date otherwise — shared between the step-1 field's inline display and the step-3 review row. */
function moveInValueText(lang) {
  return state.form.moveInDate
    ? UyDosh.formatDate(state.form.moveInDate, lang)
    : UyDosh.t('create.moveInAny', lang);
}

/**
 * Only the field outline/label turn red (see `.has-error` in
 * telegram-create.css) — the actual message shows once, in the fixed
 * `formErrorEl` banner (see `showFormError`), instead of being duplicated
 * inline next to the field too.
 */
function fieldErrorAttrs(anchor) {
  const active = state.validationError && state.validationAnchor === anchor;
  return {
    className: active ? ' has-error' : '',
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
  const chips = NEARBY_STATION_RADIUS_OPTIONS.map((minutes) => {
    const pressed = state.nearbyStationsRadiusMinutes === minutes;
    const labelKey = pressed ? 'create.walkRadiusOptionSelected' : 'create.walkRadiusOption';
    return UyDosh.chipButtonHtml({
      className: 'chip nearby-radius-chip',
      attrs: { 'data-nearby-radius': minutes },
      pressed,
      label: UyDosh.t(labelKey, lang).replace('{count}', String(minutes)),
    });
  }).join('');
  return `<div class="chips nearby-radius-chips">${chips}</div>`;
}

/**
 * "Stations near you" panel: a radius toggle plus the matching station
 * chips, populated once `findNearbyStations` has run. Used by
 * roommate-needed's merged address step (`nearbyMetroSectionHtml`), where it
 * shows automatically once the address resolves to coordinates. Room-needed's
 * legacy metro/district tabs (`legacyLocationTabsHtml`) don't show this
 * panel — pickers there already list every line/station/district directly,
 * so a "find via current location" shortcut plus a walk-radius/nearest-
 * station readout was redundant on top of that manual picker.
 */
function nearbyStationsHtml(lang) {
  if (!state.nearbyStationsChecked) return '';
  // Hidden once the closest station overall is farther than every chip's
  // radius — all three would filter to the identical fallback result, so
  // showing them as if switching mattered would just be misleading (see
  // `NEARBY_STATION_MAX_RADIUS_MINUTES` / `isBeyondMaxRadius`).
  const radiusChips = state.nearbyStationsBeyondMaxRadius ? '' : nearbyRadiusChipsHtml(lang);
  if (state.nearbyStations.length === 0) {
    // With the chips hidden there's no selected radius on screen to refer
    // to, so fall back to the largest option (30 min) — the radius that's
    // actually true in this state, since even it found nothing.
    const emptyMinutes = state.nearbyStationsBeyondMaxRadius
      ? NEARBY_STATION_MAX_RADIUS_MINUTES
      : state.nearbyStationsRadiusMinutes;
    const emptyText = UyDosh.t('create.nearbyStationsEmpty', lang)
      .replace('{minutes}', String(emptyMinutes));
    return `
      <div class="nearby-stations">
        ${radiusChips}
        <div class="nearby-stations-empty">${UyDosh.escapeHtml(emptyText)}</div>
      </div>`;
  }
  // Each row gets its own "Добавить"/"Убрать" toggle (rather than a single
  // add-only link tied to just the nearest station) so both adding and
  // removing any given station is as explicit as a dedicated button — the
  // chip itself stays clickable too (toggles the same selection), this is
  // just a clearer visual affordance of what tapping it does either way.
  const addToggleHtml = (pressed) => `
    <span class="nearby-station-add-toggle" aria-hidden="true">
      <span class="nearby-station-add-toggle-idle">${UyDosh.iconPlus()}<span>${UyDosh.escapeHtml(UyDosh.t('create.nearbyStationAdd', lang))}</span></span>
      <span class="nearby-station-add-toggle-active">${UyDosh.iconMinus()}<span>${UyDosh.escapeHtml(UyDosh.t('create.nearbyStationRemove', lang))}</span></span>
    </span>`;
  const chips = state.nearbyStations.map(({ station, minutes }) => {
    const id = Number(station.id);
    const lineId = Number(station.line) || state.form.subwayLineId;
    const pressed = state.form.selectedStationIds.includes(id);
    const minutesLabel = UyDosh.t('create.walkMinutes', lang)
      .replace('{count}', String(Math.max(1, Math.round(minutes))));
    return `
      <button type="button" class="nearby-station-chip" data-nearby-station-id="${id}" data-nearby-station-line="${lineId}" data-haptic="selection" aria-pressed="${pressed ? 'true' : 'false'}">
        <span class="nearby-station-info">
          ${UyDosh.iconMetro(lineId)}
          <span class="nearby-station-name">${UyDosh.escapeHtml(UyDosh.localized(station, lang))}</span>
          <span class="nearby-station-time">${UyDosh.iconClock()}${UyDosh.escapeHtml(minutesLabel)}</span>
        </span>
        ${addToggleHtml(pressed)}
      </button>`;
  }).join('');
  // Fallback ("closest station overall" — see `findNearbyStations`) gets its
  // own label instead of "Stations near you", since it's explicitly outside
  // the radius the author picked.
  const labelKey = state.nearbyStationsIsFallback
    ? 'create.nearbyStationsFallback'
    : 'create.nearbyStations';
  return `
    <div class="nearby-stations">
      ${radiusChips}
      <div class="nearby-stations-label">${UyDosh.escapeHtml(UyDosh.t(labelKey, lang))}</div>
      <div class="nearby-stations-list">${chips}</div>
    </div>`;
}

/**
 * Metro-line/station multi-select + district grid, gated behind the
 * Метро/Район tabs — still used by room-needed listings (a "search" listing
 * that can genuinely span several districts or several stations across
 * lines, see `supportsMultiLocation`). Roommate-needed listings no longer
 * use any of this; see `roommateLocationSectionHtml` for their single
 * merged address + auto-detected-nearest-metro step instead.
 */
function legacyLocationTabsHtml(lang) {
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
        <div class="station-list station-list-metro">${stationListHtml(lang)}</div>
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
        <div class="station-list station-list-grid">${(selectAllLocationsRow + districtItems) || `<div class="status">…</div>`}</div>
      </div>`;
  }

  return `
    <div class="field">
      <div class="field-label">${UyDosh.escapeHtml(UyDosh.t('create.locationMode', lang))}</div>
      <div class="chips">${modeChips}</div>
    </div>
    ${locationBody}`;
}

function hasAddressCoords() {
  return state.form.addressLatitude != null && state.form.addressLongitude != null;
}

/**
 * Monotonic guard for `updateAddressMapPreview`'s async module load — a
 * later call (address changed again, or the field was cleared) invalidates
 * any in-flight load so it can't clobber a newer result once it resolves.
 */
let addressMapPreviewLoadToken = 0;

/**
 * Drops/(re)paints the small "pin preview" map under the address field once
 * `state.form.addressLatitude/Longitude` resolve (see `resolveAddressLocation`
 * and the `data-use-current-location` handler) — the same Yandex Maps module
 * used for the listing detail page's single-pin map (`renderSinglePinMap`),
 * lazy-loaded here for the first time so pages/steps that never show this
 * field never pay for it. Keyed off `container.dataset.mapKey` (not a
 * module-level cache) since `renderStep()` rebuilds `#address-map-preview`
 * as a brand-new DOM node on every full re-render — comparing against the
 * *new* node's (empty) dataset naturally forces a fresh render there, while
 * `handleAddressInputChange`'s targeted clear reuses the existing node and
 * skips redundant work if coordinates haven't actually changed.
 */
async function updateAddressMapPreview() {
  const container = stepPanelsEl.querySelector('#address-map-preview');
  if (!container) return;
  const latitude = state.form.addressLatitude;
  const longitude = state.form.addressLongitude;

  if (latitude == null || longitude == null) {
    container.hidden = true;
    if (container.dataset.mapKey) {
      delete container.dataset.mapKey;
      UyDosh.loadYandexMapModule()
        .then((mapModule) => mapModule.destroyMap(container))
        .catch(() => { /* module never loaded — nothing to tear down */ });
    }
    return;
  }

  container.hidden = false;
  const key = `${Number(latitude).toFixed(6)}_${Number(longitude).toFixed(6)}`;
  if (container.dataset.mapKey === key) return;
  container.dataset.mapKey = key;

  const token = ++addressMapPreviewLoadToken;
  try {
    const mapModule = await UyDosh.loadYandexMapModule();
    if (token !== addressMapPreviewLoadToken || container.dataset.mapKey !== key) return;
    await UyDosh.waitForElementLayout(container);
    await mapModule.renderSinglePinMap(container, {
      latitude,
      longitude,
      lang: UyDosh.getLang(),
      listingTypeId: state.form.listingTypeId,
      draggable: true,
      onPinDragEnd: handleAddressPinDragEnd,
      dragHintText: UyDosh.t('create.addressMapDragHint', UyDosh.getLang()),
      zoomControl: true,
      // Plain Yandex red pin for now instead of the app's custom listing-type icon —
      // set to `false` (or drop this line) to switch back once we want this widget to
      // reuse the custom icon again.
      standardIcon: true,
    });
    UyDosh.reflowActiveMaps();
    updateAddressMapGuideLines();
  } catch (err) {
    console.error('[Create] Address map preview failed', err);
  }
}

/**
 * Pedestrian-routed guide path from the address-map-preview pin to the
 * *closest* of the metro station(s) the author has tagged the listing with
 * (`selectedStationIds`) — a listing can be tagged with several stations
 * (`supportsMultiStation()`), but drawing a route for every single one
 * turned the small preview into unreadable clutter (a route + distance
 * pill per station). Just the nearest keeps the preview readable while
 * still answering "how far is the metro from here?". See
 * `setPinGuideLines` in yandex-map.js for how the route itself is built as
 * a one-shot `multiRouter.MultiRoute` walking route (free under Yandex's
 * combined Geocoder+Router daily allowance, not a live-tracked/re-routed
 * navigation session). Colored per metro line, same palette used for the
 * line chips/icons elsewhere. Reads coordinates from `state.stationCache`,
 * which accumulates every station ever seen across line switches and
 * nearby-station suggestions (see `loadStationsForLine`/
 * `findNearbyStations`), so a selection made from any line/suggestion list
 * resolves here regardless of which one is currently displayed. Safe to
 * call whenever the pin or the selection changes — it's a no-op if the map
 * hasn't been mounted (module not loaded yet, or address cleared).
 */
function updateAddressMapGuideLines() {
  const container = stepPanelsEl.querySelector('#address-map-preview');
  if (!container) return;
  const stations = state.form.selectedStationIds
    .map((id) => state.stationCache[Number(id)])
    .filter((station) => station?.latitude != null && station?.longitude != null);

  const latitude = state.form.addressLatitude;
  const longitude = state.form.addressLongitude;
  let nearest = stations[0] || null;
  if (stations.length > 1 && latitude != null && longitude != null) {
    let nearestMeters = Infinity;
    for (const station of stations) {
      const meters = haversineMeters(latitude, longitude, Number(station.latitude), Number(station.longitude));
      if (meters < nearestMeters) {
        nearestMeters = meters;
        nearest = station;
      }
    }
  }

  const lines = nearest ? [{
    latitude: nearest.latitude,
    longitude: nearest.longitude,
    color: UyDosh.metroLineColor?.(nearest.line) || undefined,
  }] : [];
  UyDosh.loadYandexMapModule()
    .then((mapModule) => mapModule.setPinGuideLines(container, lines))
    .catch(() => { /* map module not loaded — nothing to draw onto yet */ });
}

/**
 * Fired when the author drags the address-map-preview pin to correct its
 * position (see `draggable`/`onPinDragEnd` above) — free-form finger drag,
 * no Yandex request involved. Mirrors "Моя локация"'s reverse-geocode step
 * so the address text stays in sync with wherever the pin actually ends up,
 * instead of silently drifting from what's displayed in the textarea.
 * Deliberately does *not* go through `updateAddressMapPreview()` /
 * `renderStep()` — the map already shows the pin exactly where the author
 * dropped it, so re-rendering the whole step (or recreating the map) here
 * would just be wasted work and a jarring flash mid-gesture.
 */
async function handleAddressPinDragEnd({ latitude, longitude }) {
  state.form.addressLatitude = latitude;
  state.form.addressLongitude = longitude;
  haptic('selection');
  showFormError('');

  // Keep the preview's dedupe key in sync with the drag so a later full
  // `renderStep()` (e.g. moving to the next step and back) doesn't treat
  // the dragged position as "stale" and pointlessly recreate the map.
  const container = stepPanelsEl.querySelector('#address-map-preview');
  if (container) {
    container.dataset.mapKey = `${latitude.toFixed(6)}_${longitude.toFixed(6)}`;
  }
  updateAddressMapGuideLines();

  applyNearbyStations(latitude, longitude, state.nearbyStationsRadiusMinutes);
  renderNearbyMetroPanel();

  try {
    const result = await UyDosh.fetchReverseGeocodeAddress(latitude, longitude, UyDosh.getLang());
    if (result?.addressText) {
      state.form.addressText = result.addressText;
      state.addressGeocodedText = result.addressText.trim();
      const input = stepPanelsEl.querySelector('#listing-address');
      if (input) input.value = result.addressText;
    }
  } catch (err) {
    console.error('[Create] Reverse geocode after pin drag failed', err);
  }
}

/**
 * Nearby-metro panel for `roommateLocationSectionHtml`: the same selectable
 * chips as `nearbyStationsHtml` once an address has resolved to
 * coordinates (see `resolveAddressLocation`), a spinner while that resolve
 * is in flight, or a hint prompting the author to type an address /
 * use their location before either has happened yet. Tagging a station here
 * is optional (see `validateStep`), so this panel never shows an error
 * state itself — the address field above is what's required.
 */
function nearbyMetroSectionHtml(lang) {
  let body;
  if (state.nearbyStationsChecked) {
    body = nearbyStationsHtml(lang);
  } else if (state.addressGeocoding) {
    body = `<div class="nearby-stations-loading" aria-busy="true" aria-live="polite"><span class="use-location-spinner" aria-hidden="true"></span></div>`;
  } else {
    body = `<div class="nearby-stations-hint">${UyDosh.escapeHtml(UyDosh.t('create.nearbyStationsHint', lang))}</div>`;
  }
  return `
    <div class="field nearby-metro-field">
      ${body}
    </div>`;
}

/**
 * Roommate-needed's merged location step: replaces the old Метро/Район tabs
 * and their manual station/district pickers with a single free-text address
 * field (autosuggest via `bindAddressAutocomplete`, same as before). Picking
 * a suggestion or leaving the field resolves `{ latitude, longitude }` via
 * forward geocoding (`resolveAddressLocation`) — which drives the
 * `nearbyMetroSectionHtml` chips below, kept in sync every time the address
 * changes instead of requiring a manual station multi-select.
 */
function roommateLocationSectionHtml(lang) {
  const field = fieldErrorAttrs('location');
  return `
    <div class="field${field.className}" data-validation-anchor="location">
      <label for="listing-address">${UyDosh.escapeHtml(UyDosh.t('create.address', lang))}</label>
      <div class="address-input-wrap">
        <textarea
          id="listing-address"
          class="address-textarea"
          rows="2"
          maxlength="500"
          autocomplete="off"
          placeholder="${UyDosh.escapeHtml(UyDosh.t('create.addressPlaceholder', lang))}"
        >${UyDosh.escapeHtml(state.form.addressText)}</textarea>
        <div class="address-suggestions" id="address-suggestions" hidden></div>
      </div>
      <div class="use-location-actions">
        <button
          type="button"
          class="btn-ghost use-location-btn"
          data-use-current-location
          ${state.locatingAddress ? 'disabled' : ''}
          aria-label="${UyDosh.escapeHtml(UyDosh.t('create.useCurrentLocation', lang))}"
        >
          ${state.locatingAddress
            ? '<span class="use-location-spinner" aria-hidden="true"></span>'
            : UyDosh.iconLocateMe()}
          <span>${UyDosh.escapeHtml(state.locatingAddress ? UyDosh.t('create.locatingAddress', lang) : UyDosh.t('create.useCurrentLocation', lang))}</span>
        </button>
      </div>
      <div class="address-map-preview map-container" id="address-map-preview" aria-label="${UyDosh.escapeHtml(UyDosh.t('detail.map', lang))}" ${hasAddressCoords() ? '' : 'hidden'}></div>
    </div>
    ${nearbyMetroSectionHtml(lang)}`;
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

  const locationSection = isRoomNeeded()
    ? legacyLocationTabsHtml(lang)
    : roommateLocationSectionHtml(lang);

  return `
    <section class="panel active" data-step="0">
      <div class="field listing-type-field">
        <div class="field-label">${UyDosh.escapeHtml(UyDosh.t('create.listingType', lang))}</div>
        <div class="chips">${typeChips}</div>
      </div>
      ${locationSection}
    </section>`;
}

const ADDRESS_SUGGEST_MIN_LENGTH = 2;
const ADDRESS_SUGGEST_DEBOUNCE_MS = 350;
const ADDRESS_SUGGEST_BLUR_HIDE_DELAY_MS = 180;

/// Debounce timer + monotonically increasing request id for the address
/// autocomplete fetch — not part of `state` since they're plumbing for
/// `fetchAddressSuggestions` below, not anything a re-render needs to read.
let addressSuggestDebounceTimer = null;
let addressSuggestRequestId = 0;

/// Monotonically increasing request id for `resolveAddressLocation`'s
/// forward-geocode fetch — same "ignore stale responses" pattern as
/// `addressSuggestRequestId` above, needed since the textarea's blur handler
/// and picking a suggestion can both trigger a geocode in quick succession.
let addressGeocodeRequestId = 0;

/** Random per-session id for Yandex Geosuggest billing (groups one typing session's requests together instead of billing per keystroke). */
function newGeosuggestSessionToken() {
  const bytes = new Uint8Array(16);
  (window.crypto || window.msCrypto).getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function addressSuggestSessionToken() {
  if (!state.addressSuggestSessionToken) {
    state.addressSuggestSessionToken = newGeosuggestSessionToken();
  }
  return state.addressSuggestSessionToken;
}

/** Mirrors the Flutter app's `YandexGeosuggestService._parseSuggestion` — same upstream Yandex Geosuggest response shape. */
function parseGeosuggestResults(data) {
  const rawResults = Array.isArray(data?.results) ? data.results : [];
  const parsed = [];
  for (const item of rawResults) {
    const formatted = item?.address?.formatted_address;
    const titleText = item?.title?.text;
    const displayText =
      (typeof formatted === 'string' && formatted.trim()) ||
      (typeof titleText === 'string' && titleText.trim()) ||
      '';
    if (!displayText) continue;
    const subtitleText = typeof item?.subtitle?.text === 'string' ? item.subtitle.text.trim() : '';
    parsed.push({ displayText, subtitle: subtitleText || null });
  }
  return parsed;
}

/**
 * Repaints only the `#address-suggestions` dropdown — deliberately not a
 * full `renderStep()` (which recreates the whole panel's DOM, including the
 * `<textarea>` itself, dropping focus and any in-progress IME composition on
 * every keystroke).
 */
function renderAddressSuggestionsPanel() {
  const panel = stepPanelsEl.querySelector('#address-suggestions');
  const input = stepPanelsEl.querySelector('#listing-address');
  if (!panel || !input) return;

  const hasFocus = document.activeElement === input;
  const suggestions = state.addressSuggestions;
  const loading = state.addressSuggestLoading;
  const noMatches = !loading && suggestions.length === 0 && state.addressSuggestNoMatches;
  const shouldShow = hasFocus && (loading || suggestions.length > 0 || noMatches);

  if (!shouldShow) {
    panel.hidden = true;
    panel.innerHTML = '';
    return;
  }

  panel.hidden = false;
  if (loading && suggestions.length === 0) {
    panel.innerHTML = '<div class="address-suggestions-loading"><span class="use-location-spinner" aria-hidden="true"></span></div>';
    return;
  }
  if (noMatches) {
    panel.innerHTML = `<div class="address-suggestions-empty">${UyDosh.escapeHtml(UyDosh.t('create.addressNoMatches'))}</div>`;
    // Fires once per distinct no-match query (see the reset alongside
    // `addressSuggestLoading` in `handleAddressInputChange`), not on every
    // re-render of an already-confirmed-empty search.
    if (!state.addressSuggestNoMatchesHapticFired) {
      state.addressSuggestNoMatchesHapticFired = true;
      UyDosh.haptic.notFound();
    }
    return;
  }
  panel.innerHTML = suggestions.map((suggestion, index) => `
    <button type="button" class="address-suggestion-item" data-suggestion-index="${index}">
      ${UyDosh.iconPin()}
      <span class="address-suggestion-text">
        <span class="address-suggestion-title">${UyDosh.escapeHtml(suggestion.displayText)}</span>
        ${suggestion.subtitle ? `<span class="address-suggestion-subtitle">${UyDosh.escapeHtml(suggestion.subtitle)}</span>` : ''}
      </span>
    </button>`).join('');
}

async function fetchAddressSuggestions(query) {
  const requestId = ++addressSuggestRequestId;
  try {
    const data = await UyDosh.fetchGeosuggest({
      text: query,
      sessionToken: addressSuggestSessionToken(),
      lang: UyDosh.getLang(),
    });
    if (requestId !== addressSuggestRequestId) return;
    state.addressSuggestions = parseGeosuggestResults(data);
    // Only a real zero-results response counts as "confirmed no matches" —
    // a failed fetch (catch below) shouldn't claim that and trigger the
    // "nothing found" haptic/message for what's actually a network error.
    state.addressSuggestNoMatches = state.addressSuggestions.length === 0;
  } catch (err) {
    if (requestId !== addressSuggestRequestId) return;
    console.error('Address suggest failed', err);
    state.addressSuggestions = [];
    state.addressSuggestNoMatches = false;
  } finally {
    if (requestId === addressSuggestRequestId) {
      state.addressSuggestLoading = false;
      renderAddressSuggestionsPanel();
    }
  }
}

/** Repaints only the nearby-metro-stations field (`nearbyMetroSectionHtml`)
 * of roommate-needed's merged location step — mirrors `renderStationList` /
 * `renderAddressSuggestionsPanel` in touching just its own subtree instead
 * of a full `renderStep()`, so it can run while the address textarea still
 * has focus (e.g. the field being cleared mid-typing, see
 * `handleAddressInputChange`) without stealing that focus. No-op for
 * room-needed listings, which never render this field. */
function renderNearbyMetroPanel() {
  if (isRoomNeeded()) return;
  // `.nearby-metro-field` (not `[data-validation-anchor="location"]`, which
  // the address field above it now also carries) — see `fieldErrorAttrs`.
  const field = stepPanelsEl.querySelector('.nearby-metro-field');
  if (!field) return;
  field.outerHTML = nearbyMetroSectionHtml(UyDosh.getLang());
  bindNearbyMetroEvents();
}

function handleAddressInputChange(value) {
  state.form.addressText = value;
  clearTimeout(addressSuggestDebounceTimer);

  const query = value.trim();
  if (query && state.validationError && state.validationAnchor === 'location') {
    // Clear the error without a full `renderStep()` (which would blow away
    // the textarea's focus/cursor mid-keystroke) — just drop the banner and
    // this field's red outline directly.
    showFormError('');
    stepPanelsEl.querySelector('#listing-address')?.closest('.field')?.classList.remove('has-error');
  }
  if (query.length === 0 && (state.form.addressLatitude != null || state.nearbyStationsChecked)) {
    // Field fully cleared — drop the stale resolved location/nearby-metro
    // list instead of leaving it pointing at whatever address used to be
    // typed there.
    state.form.addressLatitude = null;
    state.form.addressLongitude = null;
    state.addressGeocodedText = null;
    state.nearbyStations = [];
    state.nearbyStationsChecked = false;
    state.nearbyStationsIsFallback = false;
    state.nearbyStationsBeyondMaxRadius = false;
    renderNearbyMetroPanel();
    updateAddressMapPreview();
  }

  if (query.length < ADDRESS_SUGGEST_MIN_LENGTH) {
    addressSuggestRequestId++;
    state.addressSuggestions = [];
    state.addressSuggestLoading = false;
    state.addressSuggestNoMatches = false;
    state.addressSuggestNoMatchesHapticFired = false;
    renderAddressSuggestionsPanel();
    return;
  }

  state.addressSuggestLoading = true;
  // A fresh search starting — un-guard the "nothing found" haptic so a new
  // query that also comes back empty gets its own buzz, not just the first one.
  state.addressSuggestNoMatchesHapticFired = false;
  renderAddressSuggestionsPanel();
  addressSuggestDebounceTimer = setTimeout(
    () => fetchAddressSuggestions(query),
    ADDRESS_SUGGEST_DEBOUNCE_MS,
  );
}

function selectAddressSuggestion(index) {
  const suggestion = state.addressSuggestions[index];
  if (!suggestion) return;
  state.form.addressText = suggestion.displayText;
  const input = stepPanelsEl.querySelector('#listing-address');
  if (input) input.value = suggestion.displayText;
  if (state.validationError && state.validationAnchor === 'location') {
    showFormError('');
    input?.closest('.field')?.classList.remove('has-error');
  }
  state.addressSuggestions = [];
  state.addressSuggestLoading = false;
  // A pick ends this Geosuggest "session" — the next keystroke starts a new
  // billed session, per Yandex's guidance.
  state.addressSuggestSessionToken = null;
  renderAddressSuggestionsPanel();
  haptic('selection');
  // The textarea's own `blur` handler (fired just before this click) already
  // schedules `resolveAddressLocation` with whatever text is in
  // `state.form.addressText` at that point — which is now this suggestion's
  // full address, set above — so no separate geocode call is needed here.
}

/**
 * Forward-geocodes `text` into `{ latitude, longitude }` and refreshes the
 * nearby-metro chips for it — roommate-needed's merged location step (see
 * `roommateLocationSectionHtml`) replacement for a manual metro station
 * picker. Triggered when the address field loses focus with new,
 * not-yet-resolved text (see `bindAddressAutocomplete`), whether that's from
 * picking an autosuggest entry or just typing a full address and tapping
 * away. A no-op for room-needed listings, which never show this field.
 */
async function resolveAddressLocation(text) {
  if (isRoomNeeded()) return;
  const query = text.trim();

  if (!query) {
    // Already handled live by `handleAddressInputChange` as the field is
    // cleared — nothing left to do once it loses focus.
    return;
  }
  if (query === state.addressGeocodedText) return;

  const requestId = ++addressGeocodeRequestId;
  state.addressGeocoding = true;
  renderStep();
  try {
    const result = await UyDosh.fetchGeocodeAddress({ text: query, lang: UyDosh.getLang() });
    if (requestId !== addressGeocodeRequestId) return;
    const latitude = Number(result?.latitude);
    const longitude = Number(result?.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      state.form.addressLatitude = latitude;
      state.form.addressLongitude = longitude;
      state.addressGeocodedText = query;
      applyNearbyStations(latitude, longitude, state.nearbyStationsRadiusMinutes);
      showFormError('');
    }
  } catch (err) {
    console.error('Address geocode failed', err);
  } finally {
    if (requestId === addressGeocodeRequestId) {
      state.addressGeocoding = false;
      renderStep();
    }
  }
}

/** Wires the address textarea + its suggestions dropdown; no-op when the field isn't in the DOM (room-needed listings hide it). */
function bindAddressAutocomplete() {
  const input = stepPanelsEl.querySelector('#listing-address');
  const panel = stepPanelsEl.querySelector('#address-suggestions');
  if (!input || !panel) return;

  input.addEventListener('input', (e) => handleAddressInputChange(e.target.value));
  input.addEventListener('focus', () => renderAddressSuggestionsPanel());
  input.addEventListener('blur', () => {
    // Delayed so a tap on a suggestion button — which blurs the textarea
    // first — still lands on that button before the dropdown disappears,
    // and so `state.form.addressText` already reflects a just-picked
    // suggestion by the time `resolveAddressLocation` reads it below.
    setTimeout(() => {
      state.addressSuggestions = [];
      state.addressSuggestLoading = false;
      renderAddressSuggestionsPanel();
      resolveAddressLocation(state.form.addressText);
    }, ADDRESS_SUGGEST_BLUR_HIDE_DELAY_MS);
  });

  panel.addEventListener('click', (e) => {
    const button = e.target.closest('[data-suggestion-index]');
    if (!button) return;
    selectAddressSuggestion(Number(button.getAttribute('data-suggestion-index')));
  });
}

function renderStep1(lang) {
  const singlePrice = !isRoomNeeded();
  const priceField = fieldErrorAttrs('price');
  const priceBlock = singlePrice
    ? `
      <div class="field${priceField.className}" data-validation-anchor="price">
        <div class="field-label">${UyDosh.escapeHtml(UyDosh.t('create.price', lang))}</div>
        <div class="price-value">$${state.form.price}</div>
        <input type="range" min="${PRICE_MIN}" max="${PRICE_MAX}" step="5" value="${state.form.price}" ${rangeProgressStyle(state.form.price, PRICE_MIN, PRICE_MAX)} data-price-single />
      </div>`
    : `
      <div class="field${priceField.className}" data-validation-anchor="price">
        <div class="field-label">${UyDosh.escapeHtml(UyDosh.t('create.priceRange', lang))}</div>
        <div class="price-value">$${state.form.priceMin} – $${state.form.priceMax}</div>
        <div class="price-row">
          <div>
            <label>${UyDosh.escapeHtml(UyDosh.t('create.priceMin', lang))}</label>
            <input type="range" min="${PRICE_MIN}" max="${PRICE_MAX}" step="5" value="${state.form.priceMin}" ${rangeProgressStyle(state.form.priceMin, PRICE_MIN, PRICE_MAX)} data-price-min />
          </div>
          <div>
            <label>${UyDosh.escapeHtml(UyDosh.t('create.priceMax', lang))}</label>
            <input type="range" min="${PRICE_MIN}" max="${PRICE_MAX}" step="5" value="${state.form.priceMax}" ${rangeProgressStyle(state.form.priceMax, PRICE_MIN, PRICE_MAX)} data-price-max />
          </div>
        </div>
      </div>`;

  const genderField = fieldErrorAttrs('gender');
  const genderChips = [1, 2].map((g) => UyDosh.chipButtonHtml({
    className: 'chip gender-chip',
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
        <div class="chips">${genderChips}</div>
      </div>
      <div class="field">
        <div class="field-label">${UyDosh.escapeHtml(UyDosh.t('create.amenities', lang))}</div>
        <div class="amenity-grid">${amenityChips}</div>
      </div>
      <div class="field">
        <div class="field-label">${UyDosh.escapeHtml(UyDosh.t('create.moveInDate', lang))}</div>
        <div class="date-field-wrap">
          <input
            id="move-in-date"
            type="date"
            aria-label="${UyDosh.escapeHtml(UyDosh.t('create.moveInDate', lang))}"
            value="${UyDosh.escapeHtml(state.form.moveInDate)}"
          />
          <span class="date-field-display" aria-hidden="true">
            ${UyDosh.iconCalendar()}
            <span class="date-field-text">${UyDosh.escapeHtml(moveInValueText(lang))}</span>
          </span>
        </div>
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
        <input id="listing-title" type="text" maxlength="${TITLE_MAX}" value="${UyDosh.escapeHtml(state.form.title)}" placeholder="${UyDosh.escapeHtml(UyDosh.t('create.titlePlaceholder', lang))}" />
        <div class="char-count ${state.form.title.length > TITLE_MAX ? 'over' : ''}">${state.form.title.length}/${TITLE_MAX}</div>
      </div>
      <div class="field field-description${descriptionField.className}" data-validation-anchor="description">
        <label for="listing-description">${UyDosh.escapeHtml(UyDosh.t('create.descriptionLabel', lang))}</label>
        <textarea id="listing-description" maxlength="${DESCRIPTION_MAX}" placeholder="${UyDosh.escapeHtml(UyDosh.t('create.descriptionPlaceholder', lang))}">${UyDosh.escapeHtml(state.form.description)}</textarea>
        <div class="description-footer">
          <div class="description-actions">
            <button
              type="button"
              class="description-template-btn"
              data-description-template
              aria-label="${UyDosh.escapeHtml(UyDosh.t('create.descriptionTemplateLabel', lang))}"
            >
              ${UyDosh.iconArticle(null)}
              <span>${UyDosh.escapeHtml(UyDosh.t('create.descriptionTemplateLabel', lang))}</span>
            </button>
            ${state.geminiListingUiHidden ? '' : `
            <button
              type="button"
              class="description-template-btn description-ai-btn${state.aiImproveLoading ? ' is-loading' : ''}"
              data-description-ai-improve
              ${state.aiImproveLoading ? 'disabled' : ''}
              aria-label="${UyDosh.escapeHtml(UyDosh.t('create.descriptionAiImproveLabel', lang))}"
            >
              ${state.aiImproveLoading ? '<span class="use-location-spinner" aria-hidden="true"></span>' : UyDosh.iconSparkles(null)}
              <span>${UyDosh.escapeHtml(UyDosh.t('create.descriptionAiImproveLabel', lang))}</span>
            </button>`}
            ${dictationSupported() ? descriptionDictateButtonHtml(lang) : ''}
          </div>
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

  const moveIn = moveInValueText(lang);

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
    ...(!isRoomNeeded() && state.form.addressText.trim()
      ? [{ label: UyDosh.t('create.address', lang), value: UyDosh.formatAddressText(state.form.addressText.trim()), clip: true }]
      : []),
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
    {
      label: UyDosh.t('create.reviewAmenities', lang),
      valueHtml: amenityValueHtml,
      amenitiesIcons: true,
    },
    { label: UyDosh.t('create.reviewMoveIn', lang), value: moveIn, labelIcon: UyDosh.iconCalendar() },
  ];

  if (!isRoomNeeded()) {
    rows.push({
      label: UyDosh.t('create.reviewPrivateRoom', lang),
      value: state.form.privateRoom ? UyDosh.t('create.reviewYes', lang) : UyDosh.t('create.reviewNo', lang),
      labelIcon: UyDosh.iconLock(),
    });
  }

  const reviewRows = rows.map(({ label, value, valueHtml, clip, amenitiesIcons, badges, location, price, labelIcon }) => {
    const ddClass = [
      clip ? 'review-value-clip' : '',
      amenitiesIcons ? 'review-amenities-icons' : '',
      badges ? 'review-badges' : '',
      location ? 'review-location' : '',
      price ? 'review-price' : '',
    ].filter(Boolean).join(' ');
    const rawValue = String(value ?? '');
    const ddContent = valueHtml ?? UyDosh.escapeHtml(clip ? truncateReviewValue(rawValue) : rawValue);
    return `
    <div class="review-row">
      <dt>${labelIcon || ''}${UyDosh.escapeHtml(label)}</dt>
      <dd${ddClass ? ` class="${ddClass}"` : ''}>${ddContent}</dd>
    </div>`;
  }).join('');

  // Always tappable — even once a number is already set/pre-filled from the
  // account — so the user can re-pull the latest number from Telegram at any
  // time and overwrite whatever's currently typed.
  const phoneShareBtn = `
    <button type="button" class="btn-ghost phone-share-btn" data-share-phone>
      ${UyDosh.iconPhone()}
      <span>${UyDosh.escapeHtml(UyDosh.t('create.sharePhoneCta', lang))}</span>
    </button>`;

  // Always a fixed "+998" calling-code prefix (see `splitPhoneForDisplay`,
  // defaults to UZ when nothing's set yet) plus an editable, formatted
  // national number the user can type directly — not only fillable via the
  // Telegram share button. Persisted to `users.phone_number` on blur/share,
  // see bindStepEvents below. The flag (`phoneDialCodeFlagEmoji`) reflects
  // whichever calling code is currently active instead of a static phone
  // icon, and the flag+code+input all live in one flex row (see
  // `.phone-input-wrap-split` in telegram-create.css) so a 1-digit code
  // ("+1") sits just as tight against the number as a 3-digit one ("+998")
  // instead of leaving a gap sized for the widest case.
  const { code: phoneCode, national: phoneNational } = splitPhoneForDisplay(state.form.phone);
  const phoneFieldHtml = `
          <div class="phone-input-wrap phone-input-wrap-split">
            <span class="phone-flag" aria-hidden="true">${UyDosh.escapeHtml(phoneDialCodeFlagEmoji(phoneCode))}</span>
            <span class="phone-code-prefix">+${UyDosh.escapeHtml(phoneCode)}</span>
            <input
              id="listing-phone"
              type="tel"
              inputmode="numeric"
              autocomplete="tel-national"
              data-phone-code="${UyDosh.escapeHtml(phoneCode)}"
              placeholder="${UyDosh.escapeHtml(UyDosh.t('create.reviewNotSet', lang))}"
              value="${UyDosh.escapeHtml(formatNationalPhoneNumber(phoneCode, phoneNational))}"
            />
          </div>`;

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
          ${phoneFieldHtml}
          ${phoneShareBtn}
        </div>
      </div>
    </section>`;
}

/** Mirrors `.panel { gap: … }` in create.html — see the trailing-siblings loop below. */
const STEP_PANEL_GAP_PX = 14;

/** How many metro station rows are visible at once before the list scrolls (see `sizeLocationList`). */
const STATION_LIST_VISIBLE_ROWS = 5;

/**
 * The district grid (`.station-list-grid`) is short (two columns of ~12
 * items). Size it to its content, capped by the real remaining space down
 * to the fixed wizard footer so it still scrolls rather than overlapping
 * it (mirrors syncFeedMapPanelHeight in telegram-feed-map.js).
 *
 * Step 0 (roommate-needed listings) also renders an address field + "use my
 * location" button *after* this list — without reserving room for those,
 * the list would grow to fill all the way down to the footer and push that
 * whole block underneath it, clipped and barely reachable by scrolling.
 * Measure and reserve whatever height the list's trailing siblings (within
 * the same step) actually need first.
 *
 * The metro station list is a single scrolling column that can hold 50+
 * stations, so instead of stretching to fill the viewport (which used to
 * leave a large empty box for short lines) it's capped to exactly
 * `STATION_LIST_VISIBLE_ROWS` full rows — the rest only appear once the user
 * scrolls the list itself. If a station on the current line is already
 * selected, the list scrolls so that row lands in the middle of the (now
 * compact) viewport.
 */
function sizeLocationList() {
  const list = stepPanelsEl.querySelector('.station-list');
  if (!list) return;

  if (list.classList.contains('station-list-grid')) {
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
    list.style.height = 'auto';
    list.style.maxHeight = `${available}px`;
    return;
  }

  const row = list.querySelector('.station-item');
  if (row) {
    const rowHeight = row.getBoundingClientRect().height;
    const styles = getComputedStyle(list);
    const gap = parseFloat(styles.rowGap || styles.gap) || 0;
    const paddingY = (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0);
    const maxHeight =
      paddingY + rowHeight * STATION_LIST_VISIBLE_ROWS + gap * (STATION_LIST_VISIBLE_ROWS - 1);
    list.style.height = 'auto';
    list.style.maxHeight = `${Math.round(maxHeight)}px`;
  } else {
    list.style.height = '';
    list.style.maxHeight = '';
  }
  scrollSelectedStationIntoView(list);
}

/** Centers an already-selected station row in the metro list's visible
 * viewport — e.g. when editing a listing, or switching back to a line with
 * a prior selection — so the compact 5-row list doesn't hide it off-screen. */
function scrollSelectedStationIntoView(list) {
  const selectedBtn = list.querySelector('[data-station-id][aria-pressed="true"]');
  if (!selectedBtn) return;
  const listRect = list.getBoundingClientRect();
  const btnRect = selectedBtn.getBoundingClientRect();
  const delta = (btnRect.top + btnRect.height / 2) - (listRect.top + listRect.height / 2);
  list.scrollTop = Math.max(0, Math.round(list.scrollTop + delta));
}

/**
 * Input `type`s that actually bring up the on-screen keyboard when focused.
 * Notably excludes `date` (and other picker-style types) — those open a
 * native overlay picker instead, which the keyboard-focused reveal/reflow
 * logic below would otherwise fight with (see `isEditingTextField` and the
 * `focusin` handler further down).
 */
const KEYBOARD_INPUT_TYPES = new Set(['text', 'search', 'tel', 'email', 'number', 'password', 'url', '']);

function opensOnScreenKeyboard(el) {
  if (!(el instanceof HTMLElement)) return false;
  if (el.tagName === 'TEXTAREA') return true;
  return el.tagName === 'INPUT' && KEYBOARD_INPUT_TYPES.has(el.type || '');
}

/**
 * True while a text field inside the wizard has focus — i.e. the on-screen
 * keyboard is (most likely) open. See `scheduleSizeLocationList` below for
 * why this matters.
 */
function isEditingTextField() {
  const active = document.activeElement;
  return !!active && opensOnScreenKeyboard(active) && stepPanelsEl.contains(active);
}

let sizeLocationListRaf = 0;
function scheduleSizeLocationList() {
  // Focusing a field opens the keyboard, which fires `resize`/visualViewport
  // `resize` while the browser is still mid-animation scrolling that field
  // into view. Recomputing the list's height at that exact moment reflows
  // the content sitting above the field (metro chips / station list) and can
  // strand that scroll-into-view partway, leaving the tapped field hidden
  // behind the keyboard once it settles — with the metro/district picker
  // visible instead (see the focusin/focusout handlers below). Nothing about
  // the list itself needs to change just because the keyboard opened, so
  // skip the recompute entirely while editing and catch up once the field
  // blurs.
  if (isEditingTextField()) return;
  if (sizeLocationListRaf) cancelAnimationFrame(sizeLocationListRaf);
  sizeLocationListRaf = requestAnimationFrame(() => {
    sizeLocationListRaf = 0;
    sizeLocationList();
  });
}

window.addEventListener('resize', scheduleSizeLocationList, { passive: true });
window.visualViewport?.addEventListener('resize', scheduleSizeLocationList, { passive: true });

/**
 * Belt-and-suspenders for the same keyboard-open race: even with the resize
 * recompute above skipped, the keyboard animation itself (or a Telegram
 * WebView `viewportChanged` side effect elsewhere) can still carry a
 * just-focused field out of view before the visual viewport finishes
 * resizing. Once it does, nudge the still-focused field back into view
 * rather than leaving the user staring at the picker above it with no
 * visible field to type into.
 */
stepPanelsEl.addEventListener('focusin', (e) => {
  const target = e.target;
  // Only fields that actually open the on-screen keyboard need this
  // scroll-into-view nudge — forcing it for e.g. the move-in `date` input
  // (which opens a native picker overlay, not a keyboard) instead fights
  // that overlay: the smooth-scroll moves the page out from under it,
  // which mobile browsers treat as a cue to dismiss the picker.
  if (!opensOnScreenKeyboard(target)) return;
  const reveal = () => {
    if (document.activeElement === target) {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  };
  window.visualViewport?.addEventListener('resize', reveal, { once: true });
  // Fallback for engines without visualViewport, or where it never fires.
  setTimeout(reveal, 350);
});
stepPanelsEl.addEventListener('focusout', () => {
  // The next focus target (if any) hasn't taken over `activeElement` yet
  // during the same tick focusout fires in.
  setTimeout(() => {
    if (!isEditingTextField()) scheduleSizeLocationList();
  }, 0);
});

function renderStep() {
  const lang = UyDosh.getLang();
  const titles = stepTitles(lang);
  stepTitleEl.textContent = titles[state.step] || '';

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
  updateAddressMapPreview();
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
 * Best-effort, fire-and-forget (not awaited by the caller) so a slow/failed request never
 * delays the wizard's first paint — the "Improve with AI" button simply shows by default
 * (see `state.geminiListingUiHidden`'s initial value) and disappears if this later resolves
 * true. Re-renders the description step if it's already showing so the button can appear/
 * disappear without waiting for some unrelated state change.
 */
async function loadGeminiListingUiVisibility() {
  try {
    state.geminiListingUiHidden = await UyDosh.fetchGeminiListingUiHidden();
  } catch {
    state.geminiListingUiHidden = false;
  }
  if (state.step === 2) renderStep();
}

/**
 * Pushes `text` into the description textarea + `state.form.description`, replaying the
 * same 'input' event the field's own listener reacts to (char counter, validation-clear) —
 * shared by the template, AI-improve, and dictate actions below.
 */
function setDescriptionText(text) {
  state.form.description = text;
  const textarea = stepPanelsEl.querySelector('#listing-description');
  if (textarea) {
    textarea.value = text;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

/**
 * "Improve with AI" for the description textarea (step 2) — same Gemini-backed, same-
 * language clarity/grammar pass as the mobile app's `ListingDescriptionAiEnhanceButton`
 * (`GeminiService.enhanceListingDescription` -> `POST /gemini/improve-listing`).
 */
async function improveDescriptionWithAi() {
  if (state.aiImproveLoading) return;
  const lang = UyDosh.getLang();
  const raw = state.form.description.trim();
  if (!raw) {
    showFormError(UyDosh.t('create.descriptionAiImproveEmpty', lang));
    return;
  }
  state.aiImproveLoading = true;
  renderStep();
  try {
    const result = await UyDosh.improveListingDescription(raw);
    const improved = typeof result?.improvedText === 'string' ? result.improvedText.trim() : '';
    if (!improved) {
      showFormError(UyDosh.t('create.descriptionAiImproveError', lang));
      return;
    }
    setDescriptionText(improved.length > DESCRIPTION_MAX ? improved.slice(0, DESCRIPTION_MAX) : improved);
    showFormError('');
  } catch (err) {
    console.error('AI improve description failed', err, err.payload);
    if (err.status === 401) UyDosh.clearTelegramInitData();
    const code = err.payload?.code;
    showFormError(
      err.status === 401
        ? UyDosh.t('create.errorAuth', lang)
        : code === 'gemini_quota_exceeded'
          ? UyDosh.t('create.descriptionAiImproveQuota', lang)
          : code === 'gemini_listing_ui_disabled'
            ? UyDosh.t('create.descriptionAiImproveUnavailable', lang)
            : UyDosh.t('create.descriptionAiImproveError', lang),
    );
  } finally {
    state.aiImproveLoading = false;
    renderStep();
  }
}

/**
 * Description "Dictate" button (step 2) — records the mic via `MediaRecorder`, uploads the
 * clip to Whisper via the same backend endpoint the mobile app's
 * `ListingDescriptionDictateButton`/`DescriptionDictationService` use
 * (`POST /openai/transcribe-description`), then appends the transcript. Module-level (not
 * `state`) handles for the in-flight recorder/stream/chunks/timer, same convention as
 * `addressSuggestDebounceTimer` above — these are imperative handles, not render inputs.
 */
let dictationRecorder = null;
let dictationStream = null;
let dictationChunks = [];
let dictationMaxDurationTimer = null;
const DICTATION_MAX_DURATION_MS = 60000;

function dictationSupported() {
  return !!(navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined');
}

/**
 * Explicit mimeType (never the `MediaRecorder` default) — Telegram's in-app WebViews have
 * been observed producing empty/corrupt blobs when the encoder is left unspecified, since
 * the implicit default differs by platform (e.g. `audio/mp4` on WebKit/iOS vs `audio/webm`
 * on Chromium/Android).
 */
function pickDictationMimeType() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  const candidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function dictationFileExtension(mimeType) {
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'webm';
}

/**
 * Mirrors the mobile app's `_appendTranscript` — appends with a single separating space
 * (skipped if the field is empty or already ends with one), then clamps to DESCRIPTION_MAX.
 */
function appendDescriptionTranscript(transcript) {
  const cur = state.form.description;
  const sep = !cur || cur.endsWith(' ') ? '' : ' ';
  let next = `${cur}${sep}${transcript}`.trim();
  if (next.length > DESCRIPTION_MAX) next = next.slice(0, DESCRIPTION_MAX);
  setDescriptionText(next);
}

function stopDictationTracks() {
  dictationStream?.getTracks().forEach((track) => track.stop());
  dictationStream = null;
}

/**
 * Best-effort cleanup when leaving step 2 mid-recording (see goNext/goBack) — discards the
 * in-progress clip instead of silently leaving the mic hot in the background. Detaches the
 * 'stop' listener first so this doesn't also kick off a transcribe upload.
 */
function cancelActiveDictation() {
  if (dictationMaxDurationTimer) {
    clearTimeout(dictationMaxDurationTimer);
    dictationMaxDurationTimer = null;
  }
  if (dictationRecorder && dictationRecorder.state !== 'inactive') {
    dictationRecorder.removeEventListener('stop', onDictationRecorderStop);
    try {
      dictationRecorder.stop();
    } catch { /* ignore */ }
  }
  dictationRecorder = null;
  dictationChunks = [];
  stopDictationTracks();
  state.dictationState = 'idle';
}

async function onDictationRecorderStop() {
  const chunks = dictationChunks;
  const mimeType = dictationRecorder?.mimeType || pickDictationMimeType() || 'audio/webm';
  dictationRecorder = null;
  dictationChunks = [];
  stopDictationTracks();

  const lang = UyDosh.getLang();
  const hasAudio = chunks.some((chunk) => chunk.size > 0);
  if (!hasAudio) {
    state.dictationState = 'idle';
    renderStep();
    showFormError(UyDosh.t('create.descriptionDictateFailed', lang));
    return;
  }

  try {
    const blob = new Blob(chunks, { type: mimeType });
    const result = await UyDosh.transcribeDescriptionAudio(
      blob,
      `recording.${dictationFileExtension(mimeType)}`,
      lang,
    );
    const transcript = typeof result?.text === 'string' ? result.text.trim() : '';
    if (!transcript) {
      showFormError(UyDosh.t('create.descriptionDictateFailed', lang));
      return;
    }
    appendDescriptionTranscript(transcript);
    showFormError('');
  } catch (err) {
    console.error('Dictation transcribe failed', err, err.payload);
    if (err.status === 401) UyDosh.clearTelegramInitData();
    showFormError(
      err.status === 401
        ? UyDosh.t('create.errorAuth', lang)
        : err.status === 503
          ? UyDosh.t('create.descriptionDictateNotConfigured', lang)
          : UyDosh.t('create.descriptionDictateFailed', lang),
    );
  } finally {
    state.dictationState = 'idle';
    renderStep();
  }
}

function stopDescriptionDictation() {
  if (dictationMaxDurationTimer) {
    clearTimeout(dictationMaxDurationTimer);
    dictationMaxDurationTimer = null;
  }
  if (!dictationRecorder || dictationRecorder.state === 'inactive') return;
  state.dictationState = 'uploading';
  renderStep();
  try {
    dictationRecorder.stop();
  } catch (err) {
    console.error('Dictation stop failed', err);
  }
}

async function toggleDescriptionDictation() {
  if (state.dictationState === 'uploading') return;
  if (state.dictationState === 'recording') {
    haptic('light');
    stopDescriptionDictation();
    return;
  }

  const lang = UyDosh.getLang();
  if (!dictationSupported()) {
    showFormError(UyDosh.t('create.descriptionDictateUnsupported', lang));
    return;
  }

  haptic('light');
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    console.error('Dictation mic permission failed', err);
    showFormError(UyDosh.t('create.descriptionDictateMicDenied', lang));
    return;
  }

  const mimeType = pickDictationMimeType();
  let recorder;
  try {
    recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  } catch (err) {
    console.error('Dictation recorder init failed', err);
    stream.getTracks().forEach((track) => track.stop());
    showFormError(UyDosh.t('create.descriptionDictateFailed', lang));
    return;
  }

  dictationStream = stream;
  dictationRecorder = recorder;
  dictationChunks = [];
  recorder.addEventListener('dataavailable', (e) => {
    if (e.data && e.data.size > 0) dictationChunks.push(e.data);
  });
  recorder.addEventListener('stop', onDictationRecorderStop);
  recorder.start();

  dictationMaxDurationTimer = setTimeout(() => {
    if (state.dictationState === 'recording') stopDescriptionDictation();
  }, DICTATION_MAX_DURATION_MS);

  state.dictationState = 'recording';
  renderStep();
}

function descriptionDictateButtonHtml(lang) {
  const recording = state.dictationState === 'recording';
  const uploading = state.dictationState === 'uploading';
  const label = UyDosh.t('create.descriptionDictateLabel', lang);
  const icon = uploading
    ? '<span class="use-location-spinner" aria-hidden="true"></span>'
    : recording
      ? UyDosh.iconStopCircle(null)
      : UyDosh.iconMic(null);
  return `
            <button
              type="button"
              class="description-template-btn description-dictate-btn${recording ? ' is-recording' : ''}${uploading ? ' is-loading' : ''}"
              data-description-dictate
              ${uploading ? 'disabled' : ''}
              aria-label="${UyDosh.escapeHtml(label)}"
            >
              ${icon}
              <span>${UyDosh.escapeHtml(label)}</span>
            </button>`;
}

/**
 * Metro station suggestions for "Use current location" (see the
 * `data-use-current-location` handler in bindStepEvents): straight-line
 * distance is a poor stand-in for actual walking distance, so this pads it
 * with a fixed detour factor before converting to minutes at a comfortable
 * urban walking pace — good enough for a "stations near you" shortlist, not
 * meant to match a real routing engine.
 */
// Selectable walk-time radii for the "stations near you" panel (see
// `nearbyRadiusChipsHtml`) — the author picks how far they're willing to
// walk instead of being stuck with one fixed cutoff.
const NEARBY_STATION_RADIUS_OPTIONS = [10, 20, 30];
const DEFAULT_NEARBY_STATION_RADIUS_MINUTES = NEARBY_STATION_RADIUS_OPTIONS[0];
const MAX_SUGGESTED_STATIONS = 12;
// When nothing falls within the selected radius, we still surface the single
// closest station as a fallback rather than leaving the panel empty — but
// only up to this cutoff. Beyond it the "closest" station is far enough
// (author is on the edge of the city or outside it entirely) that showing it
// stops being useful signal, so we fall back to the plain empty state
// instead. Twice the largest selectable radius (30 min) is a reasonable
// proxy for "still plausibly metro-adjacent, just not within the chosen
// walk time".
const NEARBY_STATION_FALLBACK_MAX_MINUTES = 60;

// Auto-checked whenever the "stations near you" panel refreshes for a new
// location/radius (see `preselectNearbyStations`), so authors see sensible
// defaults instead of an all-unchecked chip row. Deliberately independent
// of `NEARBY_STATION_RADIUS_OPTIONS` so switching the display radius chip
// doesn't change which stations count as "close enough" to auto-select —
// mirrors the mobile app's `_autoSelectStationWalkMinutes` in
// CreateListingScreen.
const AUTO_SELECT_STATION_WALK_MINUTES = 15;

// `haversineMeters`/`estimatedWalkMinutes` (+ their constants) live in
// uydosh-core.js, shared with listing.html — see the comment there.

// Largest selectable radius — once the closest station overall is farther
// than this, every chip in `NEARBY_STATION_RADIUS_OPTIONS` produces the
// exact same fallback result (see `isBeyondMaxRadius` below), so the toggle
// stops being a meaningful control and `nearbyStationsHtml` hides it instead
// of showing chips that visibly do nothing when tapped.
const NEARBY_STATION_MAX_RADIUS_MINUTES = Math.max(...NEARBY_STATION_RADIUS_OPTIONS);

/**
 * Stations within `maxMinutes` of `(latitude, longitude)`, nearest first,
 * capped to `MAX_SUGGESTED_STATIONS`. Also merges every candidate into
 * `state.stationCache` so the review step and cross-line multi-select keep
 * working if the author picks a suggestion whose line they haven't opened
 * yet.
 *
 * If nothing falls within `maxMinutes`, falls back to the single closest
 * station overall (as long as it's within `NEARBY_STATION_FALLBACK_MAX_MINUTES`)
 * instead of returning nothing — see the caller in `bindStepEvents` for how
 * `isFallback` drives the "outside your selected radius" messaging.
 */
function findNearbyStations(latitude, longitude, maxMinutes = DEFAULT_NEARBY_STATION_RADIUS_MINUTES) {
  const ranked = STATIC_METRO_STATIONS
    .filter((st) => st.latitude != null && st.longitude != null)
    .map((st) => ({
      station: st,
      minutes: estimatedWalkMinutes(
        haversineMeters(latitude, longitude, Number(st.latitude), Number(st.longitude)),
      ),
    }))
    .sort((a, b) => a.minutes - b.minutes);

  let nearby = ranked.filter((entry) => entry.minutes <= maxMinutes).slice(0, MAX_SUGGESTED_STATIONS);
  let isFallback = false;
  if (nearby.length === 0 && ranked.length > 0 && ranked[0].minutes <= NEARBY_STATION_FALLBACK_MAX_MINUTES) {
    nearby = [ranked[0]];
    isFallback = true;
  }

  for (const { station } of nearby) {
    state.stationCache[Number(station.id)] = station;
  }
  // Independent of `maxMinutes` — reflects the true closest station overall,
  // so it stays consistent no matter which radius chip is currently selected
  // (see `NEARBY_STATION_MAX_RADIUS_MINUTES`).
  const isBeyondMaxRadius = ranked.length === 0 || ranked[0].minutes > NEARBY_STATION_MAX_RADIUS_MINUTES;
  return { stations: nearby, isFallback, isBeyondMaxRadius };
}

/** Adds `station` to `state.form.selectedStationIds` if it isn't already
 * there and the author hasn't explicitly dismissed it (see
 * `state.dismissedNearbyStationIds`) — the shared "only ever add, never
 * resurrect a removal" primitive behind both auto-select paths below. */
function selectStationIfNotSelected(station) {
  if (!station) return;
  const id = Number(station.id);
  if (state.dismissedNearbyStationIds.includes(id)) return;
  if (!state.form.selectedStationIds.includes(id)) {
    state.form.selectedStationIds = [...state.form.selectedStationIds, id];
  }
}

/**
 * Auto-checks every station within `AUTO_SELECT_STATION_WALK_MINUTES` of
 * `(latitude, longitude)` that isn't already selected — called by
 * `applyNearbyStations` so authors see sensible defaults instead of an
 * all-unchecked chip row. Queried separately from `findNearbyStations`'s
 * own `maxMinutes` argument so the default selection doesn't depend on
 * whichever display radius chip (10/20/30 min) happens to be active. Only
 * ever adds — never removes a station the author deliberately unchecked —
 * and re-filters out `findNearbyStations`'s single-closest-station
 * fallback so we never force-select a station that isn't actually within
 * range (the fallback case is handled separately by `applyNearbyStations`
 * itself, since it has no other option to pick from anyway).
 */
function preselectNearbyStations(latitude, longitude) {
  const { stations } = findNearbyStations(latitude, longitude, AUTO_SELECT_STATION_WALK_MINUTES);
  const withinAutoSelectWalk = stations.filter((entry) => entry.minutes <= AUTO_SELECT_STATION_WALK_MINUTES);
  for (const { station } of withinAutoSelectWalk) {
    selectStationIfNotSelected(station);
  }
}

/** Runs `findNearbyStations` and spreads its result across the three
 * `state.nearbyStations*` fields the panel reads from (see call sites in
 * `bindStepEvents`), auto-selects nearby stations (skippable — see
 * `hydrateFormFromListing`, which only wants the panel seeded for display,
 * not to silently add stations to an existing listing on save), then kicks
 * off `refineNearbyStationWalkTimes` to upgrade the straight-line estimate
 * to real walking-nav minutes.
 *
 * The fallback case (nothing within the selected radius, so
 * `findNearbyStations` surfaces just the single closest station overall —
 * see there) always auto-selects that one station regardless of
 * `AUTO_SELECT_STATION_WALK_MINUTES`: it's the only option on screen, so
 * leaving it unchecked would just force a redundant tap. That cutoff only
 * matters for the ordinary case where several in-range stations are
 * listed and only the closest ones should default to checked.
 */
function applyNearbyStations(latitude, longitude, maxMinutes, { preselect = true } = {}) {
  const { stations, isFallback, isBeyondMaxRadius } = findNearbyStations(latitude, longitude, maxMinutes);
  state.nearbyStations = stations;
  state.nearbyStationsIsFallback = isFallback;
  state.nearbyStationsBeyondMaxRadius = isBeyondMaxRadius;
  state.nearbyStationsChecked = true;
  if (preselect) {
    if (isFallback) {
      selectStationIfNotSelected(stations[0]?.station);
    } else {
      preselectNearbyStations(latitude, longitude);
    }
  }
  refineNearbyStationWalkTimes(latitude, longitude, stations);
}

/**
 * Upgrades the straight-line walk-time estimate `applyNearbyStations` just
 * put in `state.nearbyStations` with real Yandex pedestrian-routing minutes
 * (`fetchPedestrianWalkTimes` in yandex-map.js, headless — no map needed,
 * so this also works for room-needed's legacy metro/district tabs which
 * don't show a map at all). One Router access per candidate station,
 * capped at `MAX_SUGGESTED_STATIONS` (12) by `findNearbyStations` already,
 * so a single lookup never spends more than that.
 *
 * Deliberately keeps the existing nearest-first ordering (based on the
 * straight-line estimate) even once real numbers come in — re-sorting a
 * chip list the author might already be tapping through would be jarring —
 * and patches only the `.nearby-station-time` text of each matching chip
 * directly in the DOM instead of a full re-render, so it works the same way
 * whether the panel currently has a dedicated partial-refresh path
 * (`renderNearbyMetroPanel`, roommate-needed) or not (room-needed's legacy
 * tabs, which only ever get a full `renderStep()`). Guarded by a token so a
 * stale in-flight refinement from a previous location/radius can't clobber
 * a newer one that resolved first, and silently keeps the straight-line
 * numbers already on screen if the Router call fails or times out.
 */
function refineNearbyStationWalkTimes(latitude, longitude, stations) {
  const token = (state.nearbyStationsRefineToken = (state.nearbyStationsRefineToken || 0) + 1);
  if (!stations.length) return;
  UyDosh.loadYandexMapModule()
    .then((mapModule) => mapModule.fetchPedestrianWalkTimes(
      UyDosh.getLang(),
      { latitude, longitude },
      stations.map(({ station }) => ({ latitude: station.latitude, longitude: station.longitude })),
    ))
    .then((results) => {
      if (state.nearbyStationsRefineToken !== token || results.size === 0) return;
      const lang = UyDosh.getLang();
      for (const [index, { minutes }] of results) {
        const entry = stations[index];
        if (!entry) continue;
        entry.minutes = minutes;
        const timeEl = stepPanelsEl.querySelector(
          `[data-nearby-station-id="${Number(entry.station.id)}"] .nearby-station-time`,
        );
        if (timeEl) {
          const label = UyDosh.t('create.walkMinutes', lang).replace('{count}', String(Math.max(1, Math.round(minutes))));
          timeEl.innerHTML = `${UyDosh.iconClock()}${UyDosh.escapeHtml(label)}`;
        }
      }
    })
    .catch(() => { /* keep the straight-line estimate already on screen */ });
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
  state.addressSuggestions = [];
  state.addressSuggestLoading = false;
  state.addressSuggestNoMatches = false;
  state.addressSuggestNoMatchesHapticFired = false;
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
 * mirrors the analogous sync helper in telegram-feed.js (the feed filter
 * ribbon now cycles through lines with a single button there — see
 * `syncMetroLineCycleChipState` — but this wizard step still shows all four
 * as separate buttons, so it keeps the plain aria-pressed-only version). A full
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
  // Scoped to `.station-list-metro` specifically (not the generic
  // `.station-list` class shared with the district grid): the "nearby
  // metro" control's station-chip picks (see `data-nearby-station-id` in
  // bindStepEvents) call this even while district mode is active, and it
  // must never overwrite the district grid with metro station markup.
  const listEl = stepPanelsEl.querySelector('.station-list-metro');
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

/**
 * Wires the "nearby stations" walk-radius toggle + station chips — shared by
 * the full `bindStepEvents()` pass and `renderNearbyMetroPanel()`'s partial
 * refresh (roommate-needed's merged location step repaints just that one
 * field in a couple of cases instead of the whole step; see there for why).
 */
function bindNearbyMetroEvents() {
  // Walk-time radius toggle (10 / 20 / 30 min) — re-filters the already
  // fetched location without another geolocation lookup.
  stepPanelsEl.querySelectorAll('[data-nearby-radius]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const minutes = Number(btn.getAttribute('data-nearby-radius'));
      if (!Number.isFinite(minutes) || minutes === state.nearbyStationsRadiusMinutes) return;
      state.nearbyStationsRadiusMinutes = minutes;
      const { addressLatitude: latitude, addressLongitude: longitude } = state.form;
      if (latitude != null && longitude != null) {
        applyNearbyStations(latitude, longitude, minutes);
      }
      renderStep();
    });
  });

  stepPanelsEl.querySelectorAll('[data-nearby-station-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-nearby-station-id'));
      const lineId = Number(btn.getAttribute('data-nearby-station-line'));
      if (lineId && lineId !== state.form.subwayLineId) {
        await selectSubwayLine(lineId);
      }
      const wasSelected = state.form.selectedStationIds.includes(id);
      state.form.selectedStationIds = toggleSelection(
        state.form.selectedStationIds,
        id,
        supportsMultiStation(),
      );
      // Remember an explicit removal so a later recompute (radius chip,
      // pin drag, re-geocode) doesn't silently resurrect it — see
      // `selectStationIfNotSelected`. Re-checking clears the memory.
      if (wasSelected) {
        state.dismissedNearbyStationIds = [...new Set([...state.dismissedNearbyStationIds, id])];
      } else {
        state.dismissedNearbyStationIds = state.dismissedNearbyStationIds.filter((sid) => sid !== id);
      }
      if (state.form.selectedStationIds.length > 0 && state.validationError) {
        showFormError('');
      }
      renderStep();
    });
  });
}

function bindStepEvents() {
  stepPanelsEl.querySelectorAll('[data-listing-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextTypeId = Number(btn.getAttribute('data-listing-type'));
      if (nextTypeId === state.form.listingTypeId) return;
      state.form.listingTypeId = nextTypeId;
      if (!supportsMultiLocation()) {
        state.form.selectedLocationIds = state.form.selectedLocationIds.slice(0, 1);
      }
      // Room-needed's metro step lets an author tag dozens of stations
      // across every line, while roommate-needed's merged step only ever
      // shows/preselects stations within walking distance of the typed
      // address. Carrying the former's picks into the latter (or vice
      // versa) silently attached every room-needed station to a
      // roommate-needed listing — clear them so each type starts its own
      // selection from scratch.
      state.form.selectedStationIds = [];
      state.nearbyStations = [];
      state.nearbyStationsChecked = false;
      state.nearbyStationsIsFallback = false;
      state.nearbyStationsBeyondMaxRadius = false;
      // Roommate-needed only ever uses the merged address+nearby-metro step
      // (see roommateLocationSectionHtml) — switching into it from
      // room-needed's district tab must not carry district mode along.
      if (!isRoomNeeded()) {
        state.form.locationMode = LOCATION_MODE_METRO;
      }
      updateDefaultTitle();
      // Roommate-needed's nearby stations depend on the address already
      // typed — recompute them fresh now that stale picks were cleared,
      // instead of leaving the panel empty until the address is re-edited.
      if (!isRoomNeeded() && state.form.addressLatitude != null && state.form.addressLongitude != null) {
        applyNearbyStations(
          state.form.addressLatitude,
          state.form.addressLongitude,
          state.nearbyStationsRadiusMinutes,
        );
      }
      renderStep();
    });
  });

  stepPanelsEl.querySelectorAll('[data-location-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.form.locationMode = btn.getAttribute('data-location-mode');
      renderStep();
    });
  });

  bindAddressAutocomplete();

  stepPanelsEl.querySelector('[data-use-current-location]')?.addEventListener('click', async () => {
    if (state.locatingAddress) return;
    state.locatingAddress = true;
    renderStep();
    try {
      const { latitude, longitude } = await UyDosh.requestUserLocation();
      state.form.addressLatitude = latitude;
      state.form.addressLongitude = longitude;
      const result = await UyDosh.fetchReverseGeocodeAddress(latitude, longitude, UyDosh.getLang());
      applyNearbyStations(latitude, longitude, state.nearbyStationsRadiusMinutes);
      if (result?.addressText) {
        state.form.addressText = result.addressText;
        state.addressGeocodedText = result.addressText.trim();
        // Drop any stale autocomplete dropdown from typing before this
        // overwrote the field — the next full renderStep() below rebuilds
        // #address-suggestions hidden, but the in-memory list would
        // otherwise still show once the field regains focus.
        state.addressSuggestions = [];
        state.addressSuggestLoading = false;
        state.addressSuggestNoMatches = false;
        state.addressSuggestNoMatchesHapticFired = false;
        showFormError('');
      } else {
        // Yandex resolved the coordinates but had no address to hand back —
        // e.g. the author is outside Tashkent (also why `applyNearbyStations`
        // just above found no nearby metro). Silently leaving the address
        // field empty here left the author stuck: nothing on screen said why,
        // and the *next* tap of "Next" surfaced the generic "enter an
        // address" validation error, which — right under the "no metro
        // nearby" empty state above — read as if a metro station were being
        // required. Mirrors the Flutter app's equivalent handler (see
        // `current_location_address_failed` in create_listing_screen.dart),
        // which already surfaces this instead of leaving the field empty.
        haptic('heavy');
        showFormError(UyDosh.t('create.errorAddressFromLocationFailed', UyDosh.getLang()), 'location');
      }
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

  bindNearbyMetroEvents();

  stepPanelsEl.querySelectorAll('[data-subway-line]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const nextLineId = Number(btn.getAttribute('data-subway-line'));
      if (nextLineId === state.form.subwayLineId && !state.stationsLoading) return;
      // Flip aria-pressed on the existing chip buttons (instead of letting a
      // full renderStep() replace them) so the CSS transition that expands
      // the tapped chip into its name actually gets to play, matching the
      // reveal animation the feed filter ribbon's cycling button uses too.
      syncSubwayLineChipPressedState();
      await selectSubwayLine(nextLineId);
    });
  });

  bindStationListEvents();

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
    fieldEl?.classList.remove('has-error');
  }

  const priceSingleInput = stepPanelsEl.querySelector('[data-price-single]');
  priceSingleInput?.addEventListener('input', (e) => {
    state.form.price = Number(e.target.value);
    const field = priceSingleInput.closest('.field');
    const valueEl = field?.querySelector('.price-value');
    if (valueEl) valueEl.textContent = `$${state.form.price}`;
    e.target.style.setProperty('--range-progress', `${((state.form.price - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100}%`);
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
  function setRangeProgress(input, value) {
    if (input) input.style.setProperty('--range-progress', `${((value - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100}%`);
  }
  priceMinInput?.addEventListener('input', (e) => {
    state.form.priceMin = Number(e.target.value);
    if (state.form.priceMin > state.form.priceMax) {
      state.form.priceMax = state.form.priceMin;
      if (priceMaxInput) priceMaxInput.value = String(state.form.priceMax);
      setRangeProgress(priceMaxInput, state.form.priceMax);
    }
    setRangeProgress(e.target, state.form.priceMin);
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
      setRangeProgress(priceMinInput, state.form.priceMin);
    }
    setRangeProgress(e.target, state.form.priceMax);
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
    const display = stepPanelsEl.querySelector('.date-field-text');
    if (display) display.textContent = moveInValueText(UyDosh.getLang());
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
    setDescriptionText(text);
    if (state.form.description.trim() && state.validationError) {
      showFormError('');
      renderStep();
    }
  });

  stepPanelsEl.querySelector('[data-description-ai-improve]')?.addEventListener('click', () => {
    improveDescriptionWithAi();
  });

  stepPanelsEl.querySelector('[data-description-dictate]')?.addEventListener('click', () => {
    toggleDescriptionDictation();
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

  // Editable national-number field (see `phoneFieldHtml` in renderStep3) —
  // the "+998" prefix next to it stays a plain, non-interactive span.
  // Reformats live as digits are typed (per the active calling code's own
  // group sizes/length, see formatNationalPhoneNumber), and best-effort
  // persists to `users.phone_number` on blur so manually-typed numbers are
  // saved just like ones pulled in via the share button above.
  const phoneInput = stepPanelsEl.querySelector('#listing-phone');
  phoneInput?.addEventListener('input', () => {
    const code = phoneInput.dataset.phoneCode || DEFAULT_PHONE_DIAL_CODE;
    const digits = phoneInput.value.replace(/\D/g, '').slice(0, phoneNationalMaxLength(code));
    const caretAtEnd = phoneInput.selectionEnd === phoneInput.value.length;
    phoneInput.value = formatNationalPhoneNumber(code, digits);
    if (caretAtEnd) phoneInput.setSelectionRange(phoneInput.value.length, phoneInput.value.length);
    state.form.phone = digits ? `+${code}${digits}` : '';
  });
  phoneInput?.addEventListener('blur', async () => {
    const digits = phoneInput.value.replace(/\D/g, '');
    if (digits.length < 7) return;
    try {
      await UyDosh.updateMyPhoneNumber(state.form.phone);
      UyDosh.logMiniAppEvent('create_phone_edit_saved');
    } catch (err) {
      UyDosh.logMiniAppEvent('create_phone_edit_save_failed', { status: err?.status });
    }
  });
}

function validateStep(step) {
  const lang = UyDosh.getLang();
  if (step === 0) {
    if (isRoomNeeded()) {
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
    } else if (!state.form.addressText.trim()) {
      // Roommate-needed's merged flow: the address is what drives the
      // nearby-metro suggestions, so it's the only required field here —
      // tagging a nearby station is just an optional refinement.
      return {
        message: UyDosh.t('create.errorAddressRequired', lang),
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
      } else if (!supportsMultiStation()) {
        body.subwayLineId = state.form.subwayLineId;
        body.subwayStationId = state.form.selectedStationIds[0];
      }
      // else: multi-station flow with no picks — omit both fields rather
      // than leaking the currently-shown-but-unselected line/station
      // (matches the mobile app's fix for the same leak).
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
      // Icons follow the swapped destination/label, not the fixed DOM element.
      if (successFeedBtn) {
        successFeedBtn.href = UyDosh.MINI_APP_ACCOUNT_PATH;
      }
      if (successFeedLabelEl) {
        successFeedLabelEl.textContent = UyDosh.t('create.backToAccount', lang);
        successFeedLabelEl.removeAttribute('data-i18n');
      }
      if (successFeedIconEl) successFeedIconEl.innerHTML = UyDosh.iconChrome('person');
      if (successViewBtn) {
        successViewBtn.href = UyDosh.MINI_APP_FEED_PATH;
      }
      if (successViewLabelEl) {
        successViewLabelEl.textContent = UyDosh.t('create.backToFeed', lang);
        successViewLabelEl.removeAttribute('data-i18n');
      }
      if (successViewIconEl) successViewIconEl.innerHTML = UyDosh.iconChrome('list');
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
  if (state.dictationState === 'recording') cancelActiveDictation();
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
  if (state.dictationState === 'recording') cancelActiveDictation();
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
    loadGeminiListingUiVisibility();
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
