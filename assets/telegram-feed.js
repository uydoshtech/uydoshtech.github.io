UyDosh.initTelegramMiniApp();
window.Telegram?.WebApp?.MainButton?.hide();

const PAGE_SIZE = 10;
// LISTING_TYPE_*, GENDER_*, METRO_LINE_ANY are already global consts declared by
// uydosh-icons.js (loaded before this file) — do not redeclare them here, classic
// <script> top-level `const` lives in a shared lexical scope and a second `const`
// with the same name throws a SyntaxError that aborts this entire script.
const DEFAULT_WITH_PHOTO = false;
const DEFAULT_HAS_3D_TOUR = false;
// Default period filter value; kept in sync with uydosh_client's
// listingBrowseCreatedWithinDays so first-load behavior matches the app.
const PERIOD_DEFAULT_DAYS = 30;
const PERIOD_ALL_TIME = 0;
const PERIOD_OPTION_VALUES = [30, 90, PERIOD_ALL_TIME];
// "Sort by price" cycling chip (filter-row-metro, list view only — see
// PRICE_SORT_ORDER_VALUES/`renderFilters`): null (default order) -> 'asc'
// (cheapest first) -> 'desc' (priciest first) -> back to null.
const PRICE_SORT_ORDER_VALUES = [null, 'asc', 'desc'];
// localStorage (not sessionStorage): filters should still be there the next time the
// user opens the Mini App, not just for the rest of the current Telegram WebView launch.
const FILTER_STORAGE_KEY = 'uydosh_tg_feed_filters';
const FILTER_COLLAPSED_KEY = 'uydosh_tg_filters_collapsed';
// Feed scroll restoration: the Mini App's Telegram header BackButton always
// does a hard `location.href` navigation (no SPA history, no bfcache), so
// returning from a listing's detail page would otherwise cold-start the feed
// back at page 1 / scrollY 0 — see `saveFeedScrollState()` (set on card tap)
// and `restoreFeedScrollOrLoad()` (consumed once on the next feed load).
// Mirrors the equivalent fix in uydosh_client's ListingsBloc.
const FEED_SCROLL_STATE_KEY = 'uydosh_tg_feed_scroll_state';
const FEED_SCROLL_STATE_MAX_AGE_MS = 30 * 60 * 1000;
// Sanity cap on how many pages a single restore will re-fetch, in case of a
// pathologically long-lived session — 30 pages is far beyond any real scroll
// depth and keeps a worst case from firing dozens of requests.
const FEED_SCROLL_RESTORE_MAX_PAGES = 30;
// Scrolling down this far auto-collapses the filters — and skips straight
// to the folded, chevron-only state (see `.filters--folded`) instead of
// pausing at the compact icon ribbon in between, so listings underneath
// stop being covered as soon as possible. Once already collapsed — whether
// that was scroll-driven or a manual chevron tap — scrolling down this same
// distance folds the compact ribbon down to the bare chevron too; only a
// scroll-driven collapse also re-expands back to the full ribbon on the way
// back up (see `handleFeedScrollForFilters`/`expandFiltersFromScroll`).
const FILTER_SCROLL_COLLAPSE_PX = 120;
const FILTER_SCROLL_EXPAND_PX = 24;
const SCROLL_TOP_HIDE_PX = 72;

const gridEl = document.getElementById('grid');
const statusEl = document.getElementById('status');
const filtersEl = document.getElementById('filters');
const sentinelEl = document.getElementById('sentinel');
const feedListPanel = document.getElementById('feed-list-panel');
const feedMapPanel = document.getElementById('feed-map-panel');
const feedMapEl = document.getElementById('feed-map');
const feedMapTooltipEl = document.getElementById('feed-map-tooltip');
const feedMapStatusEl = document.getElementById('feed-map-status');
const feedMapLocateBannerEl = document.getElementById('feed-map-locate-banner');
const viewTabs = document.querySelectorAll('[data-view]');
const fabCreateEl = document.getElementById('fab-create');
const scrollTopBtnEl = document.getElementById('scroll-top-btn');
fabCreateEl?.addEventListener('click', () => {
  UyDosh.getTelegramInitData();
  UyDosh.logMiniAppEvent('create_listing_tap');
});
let filtersScrollAnchorY = 0;
let filtersScrollRaf = 0;
let filtersCollapsedByScroll = false;
let filtersFolded = false;
let showScrollTopButton = false;

function resetFiltersScrollAnchor(y = window.scrollY) {
  filtersScrollAnchorY = Number.isFinite(y) ? Math.max(0, y) : 0;
}

function setFiltersCollapsedVisual(collapsed = state.filtersCollapsed) {
  filtersEl.classList.toggle('filters--collapsed', collapsed);
  // Also drop the sticky wrapper's own opaque background once collapsed —
  // see `.feed-sticky--collapsed` in telegram-index.css — so only the
  // `.filters` card's own rounded grey border stays visible around the
  // compact ribbon, instead of a full-width rectangle behind it.
  filtersEl.parentElement?.classList.toggle('feed-sticky--collapsed', collapsed);
  const lang = UyDosh.getLang();
  const toggleLabel = collapsed
    ? UyDosh.t('filter.expand.aria', lang)
    : UyDosh.t('filter.collapse.aria', lang);
  for (const btn of filtersEl.querySelectorAll('[data-filters-toggle]')) {
    btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    btn.setAttribute('aria-label', toggleLabel);
  }
}

function collapseFiltersFromScroll() {
  if (state.filtersCollapsed || state.view !== 'list') return;
  state.filtersCollapsed = true;
  filtersCollapsedByScroll = true;
  persistFiltersCollapsed();
  setFiltersCollapsedVisual(true);
  foldFiltersFromScroll();
}

function expandFiltersFromScroll() {
  if (!state.filtersCollapsed || !filtersCollapsedByScroll || state.view !== 'list') return;
  state.filtersCollapsed = false;
  filtersCollapsedByScroll = false;
  persistFiltersCollapsed();
  setFiltersCollapsedVisual(false);
  unfoldFilters();
}

function setFiltersFoldedVisual(folded) {
  filtersEl.classList.toggle('filters--folded', folded);
}

function foldFiltersFromScroll() {
  if (filtersFolded || !state.filtersCollapsed || state.view !== 'list') return;
  filtersFolded = true;
  setFiltersFoldedVisual(true);
}

function unfoldFilters() {
  if (!filtersFolded) return;
  filtersFolded = false;
  setFiltersFoldedVisual(false);
}

function scrollTopShowThresholdPx() {
  return window.innerHeight;
}

function setScrollTopButtonVisible(visible) {
  if (!scrollTopBtnEl || showScrollTopButton === visible) return;
  showScrollTopButton = visible;
  scrollTopBtnEl.classList.toggle('visible', visible);
  scrollTopBtnEl.setAttribute('aria-hidden', visible ? 'false' : 'true');
}

function updateScrollTopButton() {
  if (state.view !== 'list') {
    setScrollTopButtonVisible(false);
    return;
  }
  const y = window.scrollY;
  const shouldShow = showScrollTopButton
    ? y > SCROLL_TOP_HIDE_PX
    : y >= scrollTopShowThresholdPx();
  setScrollTopButtonVisible(shouldShow);
}

function scrollToFeedTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  resetFiltersScrollAnchor(0);
}

function handleFeedScrollForFilters() {
  if (filtersScrollRaf) return;
  filtersScrollRaf = requestAnimationFrame(() => {
    filtersScrollRaf = 0;
    updateScrollTopButton();
    if (state.view !== 'list') return;
    const delta = window.scrollY - filtersScrollAnchorY;
    if (!state.filtersCollapsed) {
      if (delta >= FILTER_SCROLL_COLLAPSE_PX) collapseFiltersFromScroll();
      return;
    }
    // Already collapsed — whether that was scroll-driven or a manual chevron
    // tap, scrolling further down still folds the compact ribbon down to the
    // bare chevron (same threshold/hysteresis as the expanded->collapsed
    // case above), and scrolling back up near the anchor un-folds it. Only
    // a scroll-driven collapse also re-expands back to the full ribbon.
    if (delta >= FILTER_SCROLL_COLLAPSE_PX) {
      foldFiltersFromScroll();
      return;
    }
    if (delta <= FILTER_SCROLL_EXPAND_PX) {
      if (filtersFolded) {
        unfoldFilters();
      } else if (filtersCollapsedByScroll) {
        expandFiltersFromScroll();
      }
    }
  });
}

function readFiltersCollapsed() {
  try {
    return localStorage.getItem(FILTER_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function persistFiltersCollapsed() {
  try {
    localStorage.setItem(FILTER_COLLAPSED_KEY, state.filtersCollapsed ? 'true' : 'false');
  } catch {
    // ignore quota / private mode
  }
}

function filterChevronIcon() {
  return `
    <span class="filters-toggle-icon filters-toggle-icon-chevron" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M6 9l6 6 6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    </span>
  `;
}

// Shown instead of the chevron once the ribbon is folded down to a lone
// corner button (see `.filters--folded`): alone and out of context, a plain
// chevron reads as an ambiguous "expand" arrow, whereas a funnel glyph
// still reads as "filters" at a glance.
function filterFunnelIcon() {
  return `
    <span class="filters-toggle-icon filters-toggle-icon-filter" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    </span>
  `;
}

/** Deep-link support: bot buttons open the feed with ?listingTypeId=1|2 to pre-apply a filter. */
function readUrlListingTypeId() {
  try {
    const raw = new URLSearchParams(location.search).get('listingTypeId');
    if (raw == null) return null;
    const id = Number(raw);
    if (
      id === LISTING_TYPE_ROOM_NEEDED ||
      id === LISTING_TYPE_ROOMMATE_NEEDED ||
      id === LISTING_TYPE_GROUP_FORMING
    ) {
      return id;
    }
  } catch {
    // ignore
  }
  return null;
}

function readStoredFilters() {
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      listingTypeId: Number(parsed.listingTypeId) || LISTING_TYPE_ALL,
      gender: Number(parsed.gender) || GENDER_ANY,
      withPhoto:
        parsed.withPhotoExplicit === true
          ? parsed.withPhoto === true
          : DEFAULT_WITH_PHOTO,
      withPhotoExplicit: parsed.withPhotoExplicit === true,
      has3dTour: parsed.has3dTour === true,
      subwayLineId: Number(parsed.subwayLineId) || METRO_LINE_ANY,
      locationId: Number(parsed.locationId) || DISTRICT_ANY,
      createdWithinDays: PERIOD_OPTION_VALUES.includes(Number(parsed.createdWithinDays))
        ? Number(parsed.createdWithinDays)
        : PERIOD_DEFAULT_DAYS,
      priceSortOrder: PRICE_SORT_ORDER_VALUES.includes(parsed.priceSortOrder)
        ? parsed.priceSortOrder
        : null,
    };
  } catch {
    return null;
  }
}

function persistFilters() {
  try {
    localStorage.setItem(
      FILTER_STORAGE_KEY,
      JSON.stringify({
        listingTypeId: state.filters.listingTypeId,
        gender: state.filters.gender,
        withPhoto: state.filters.withPhoto,
        withPhotoExplicit: state.withPhotoExplicit,
        has3dTour: state.filters.has3dTour,
        subwayLineId: state.filters.subwayLineId,
        locationId: state.filters.locationId,
        createdWithinDays: state.filters.createdWithinDays,
        priceSortOrder: state.filters.priceSortOrder,
      }),
    );
  } catch {
    // ignore quota / private mode
  }
}

const storedFilters = readStoredFilters();
const urlListingTypeId = readUrlListingTypeId();
const state = {
  page: 0,
  totalPages: 1,
  loading: false,
  errored: false,
  reachedEnd: false,
  // Guards the empty-result haptic burst (see `showEnd`) so it fires once per
  // search/filter cycle instead of on every re-render of an already-empty state
  // (e.g. a language switch while zero listings match the current filters).
  emptyResultHapticFired: false,
  items: [],
  filters: {
    listingTypeId: urlListingTypeId ?? storedFilters?.listingTypeId ?? LISTING_TYPE_ALL,
    gender: storedFilters?.gender ?? GENDER_ANY,
    withPhoto: storedFilters?.withPhoto ?? DEFAULT_WITH_PHOTO,
    has3dTour: storedFilters?.has3dTour ?? DEFAULT_HAS_3D_TOUR,
    subwayLineId: storedFilters?.subwayLineId ?? METRO_LINE_ANY,
    locationId: storedFilters?.locationId ?? DISTRICT_ANY,
    createdWithinDays: storedFilters?.createdWithinDays ?? PERIOD_DEFAULT_DAYS,
    priceSortOrder: storedFilters?.priceSortOrder ?? null,
  },
  withPhotoExplicit: storedFilters?.withPhotoExplicit ?? false,
  filtersCollapsed: readFiltersCollapsed(),
  view: 'list',
  mapPins: [],
  mapResultTotal: 0,
  mapLoading: false,
  mapLoaded: false,
  mapModule: null,
  // All listings currently on the map, ordered so coordinate-mates (composite
  // pins) stay adjacent — lets the open tooltip swipe seamlessly from one
  // pin/group straight into the next rather than being capped at the tapped
  // pin's own group. See rebuildMapCarouselIndex() in telegram-feed-map.js.
  selectedMapPins: [],
  selectedMapPinIndex: 0,
  mapTooltipListings: {},
  mapTooltipRequestId: 0,
};

// A bot deep-link (Find housing / Find roommate button) always wins over a stale
// stored filter from a previous session, and the choice is persisted going forward.
if (urlListingTypeId != null) {
  persistFilters();
}

function feedFiltersSignature() {
  return JSON.stringify(state.filters);
}

/** True once any filter has moved off its default value — drives whether the
 * "reset filters" button (see renderFilters) is enabled. */
function hasActiveFilters() {
  const f = state.filters;
  return (
    f.listingTypeId !== LISTING_TYPE_ALL ||
    f.gender !== GENDER_ANY ||
    f.withPhoto !== DEFAULT_WITH_PHOTO ||
    f.has3dTour !== DEFAULT_HAS_3D_TOUR ||
    f.subwayLineId !== METRO_LINE_ANY ||
    f.locationId !== DISTRICT_ANY ||
    f.createdWithinDays !== PERIOD_DEFAULT_DAYS ||
    f.priceSortOrder != null
  );
}

/** Called right before navigating to a listing's detail page (see the `gridEl` click handler below). */
function saveFeedScrollState() {
  try {
    sessionStorage.setItem(
      FEED_SCROLL_STATE_KEY,
      JSON.stringify({
        page: state.page,
        scrollY: window.scrollY,
        filters: feedFiltersSignature(),
        ts: Date.now(),
      }),
    );
  } catch {
    // ignore quota / private mode
  }
}

/** Consumes (clears) any saved scroll state — one-shot, so a later unrelated feed visit doesn't reapply a stale position. */
function takeFeedScrollState() {
  let saved = null;
  try {
    const raw = sessionStorage.getItem(FEED_SCROLL_STATE_KEY);
    sessionStorage.removeItem(FEED_SCROLL_STATE_KEY);
    if (raw) saved = JSON.parse(raw);
  } catch {
    saved = null;
  }
  if (!saved || typeof saved.page !== 'number' || saved.page < 1) return null;
  if (Date.now() - Number(saved.ts) > FEED_SCROLL_STATE_MAX_AGE_MS) return null;
  // Filters changed since the tap (e.g. via a stale/shared link) — the saved
  // page depth no longer corresponds to what this filter set would return.
  if (saved.filters !== feedFiltersSignature()) return null;
  return saved;
}

function clearFeedScrollState() {
  try {
    sessionStorage.removeItem(FEED_SCROLL_STATE_KEY);
  } catch {
    // ignore
  }
}

/** Feedback for map interactions that aren't a plain DOM button/link tap (e.g. a native map-pin tap) — see `onHaptic` above. */
function filterTapHaptic() {
  UyDosh.haptic.light();
}

function listingTypeQueryParam() {
  const id = state.filters.listingTypeId;
  return id > 0 ? id : undefined;
}

function genderQueryParam() {
  const id = state.filters.gender;
  return id > 0 ? id : undefined;
}

function withPhotoQueryParam() {
  return state.filters.withPhoto ? true : undefined;
}

function has3dTourQueryParam() {
  return state.filters.has3dTour ? true : undefined;
}

function subwayLineQueryParam() {
  const id = state.filters.subwayLineId;
  return id > 0 ? id : undefined;
}

function locationQueryParam() {
  const id = state.filters.locationId;
  return id > 0 ? id : undefined;
}

function createdWithinDaysQueryParam() {
  const days = state.filters.createdWithinDays;
  return days > 0 ? days : undefined;
}

/** Price-sort query params for `UyDosh.fetchListings` (list view only — the
 * map view never sorts, see `filter-row-metro`'s `.filters--map-view` CSS). */
function sortByQueryParam() {
  return state.filters.priceSortOrder ? 'price' : undefined;
}

function sortOrderQueryParam() {
  return state.filters.priceSortOrder || undefined;
}

function logSearchEvent() {
  UyDosh.logMiniAppEvent('search', {
    listing_type_id: state.filters.listingTypeId,
    gender: state.filters.gender,
    with_photo: state.filters.withPhoto ? 'true' : 'false',
    has_3d_tour: state.filters.has3dTour ? 'true' : 'false',
    subway_line_id: state.filters.subwayLineId,
    location_id: state.filters.locationId,
    created_within_days: state.filters.createdWithinDays,
    price_sort_order: state.filters.priceSortOrder || 'none',
  });
}

const feedMap = UyDoshTelegramFeedMap.createFeedMapController({
  UyDosh,
  elements: {
    feedListPanel,
    feedMapPanel,
    feedMapEl,
    feedMapTooltipEl,
    feedMapStatusEl,
    feedMapLocateBannerEl,
    fabCreateEl,
  },
  state,
  onHaptic: filterTapHaptic,
  getFilterParams: () => ({
    listingTypeId: listingTypeQueryParam(),
    gender: genderQueryParam(),
    withPhoto: withPhotoQueryParam(),
    has3dTour: has3dTourQueryParam(),
    subwayLineId: subwayLineQueryParam(),
    locationId: locationQueryParam(),
    createdWithinDays: createdWithinDaysQueryParam(),
  }),
});
// Exposed so uydosh-mini-app.js can re-measure the map panel height on
// Telegram viewport/safe-area events (keyboard, orientation, expand()).
window.UyDoshFeedMap = feedMap;

function updateViewTabs() {
  for (const tab of viewTabs) {
    const selected = tab.getAttribute('data-view') === state.view;
    tab.setAttribute('aria-selected', selected ? 'true' : 'false');
  }
  feedMap.applyViewLayout(state.view === 'map');
  // Price sort only makes sense for the paginated list, not the map's pins —
  // see `.filters--map-view .chip-price-sort` in telegram-index.css.
  filtersEl.classList.toggle('filters--map-view', state.view === 'map');
}

function switchView(nextView) {
  if (state.view === nextView) return;
  state.view = nextView;
  updateViewTabs();
  updateScrollTopButton();
  unfoldFilters();
  if (nextView === 'map') {
    feedMap.onEnterMapView();
  } else {
    resetFiltersScrollAnchor();
    feedMap.onLeaveMapView();
    // A filter changed while the Map tab was active still clears the list's own
    // items/grid right away (see `resetAndLoad()`), but skips re-fetching them since
    // `loadMore()` is a no-op while `state.view !== 'list'` — so without this, tabbing
    // back to List could keep showing whatever was on screen before that filter change
    // (or nothing) instead of loading fresh results for the now-active filters.
    if (!state.loading && !state.reachedEnd && !state.errored && state.items.length === 0) {
      loadMore();
    }
  }
}

function renderFilters() {
  const lang = UyDosh.getLang();
  const typeOptions = [
    { value: LISTING_TYPE_ROOM_NEEDED, label: UyDosh.t('filter.type.roomNeeded', lang) },
    { value: LISTING_TYPE_ROOMMATE_NEEDED, label: UyDosh.t('filter.type.roommateNeeded', lang) },
    // { value: LISTING_TYPE_GROUP_FORMING, label: UyDosh.t('filter.type.groupForming', lang) },
  ];
  const genderOptions = [
    { value: GENDER_MALE, label: UyDosh.t('filter.gender.male', lang) },
    { value: GENDER_FEMALE, label: UyDosh.t('filter.gender.female', lang) },
  ];
  const periodOptions = [
    { value: 30, label: UyDosh.t('filter.period.30', lang) },
    { value: 90, label: UyDosh.t('filter.period.90', lang) },
    { value: PERIOD_ALL_TIME, label: UyDosh.t('filter.period.all', lang) },
  ];
  const collapsed = state.filtersCollapsed;
  const toggleLabel = collapsed
    ? UyDosh.t('filter.expand.aria', lang)
    : UyDosh.t('filter.collapse.aria', lang);

  const typeChips = typeOptions.map((opt) => UyDosh.chipButtonHtml({
    attrs: { 'data-listing-type': opt.value },
    pressed: state.filters.listingTypeId === opt.value,
    icon: UyDosh.filterListingTypeIcon(opt.value, { pressed: false }),
    label: opt.label,
  })).join('');

  const typeChipsCompact = typeOptions.map((opt) => UyDosh.chipButtonHtml({
    className: 'chip chip-icon-only',
    attrs: { 'data-listing-type': opt.value },
    pressed: state.filters.listingTypeId === opt.value,
    icon: UyDosh.filterListingTypeIcon(opt.value, { pressed: false }),
    ariaLabel: opt.label,
  })).join('');

  const selectedGender = state.filters.gender;
  const genderSegments = genderOptions.map((opt) => UyDosh.chipButtonHtml({
    className: 'gender-switch-segment',
    attrs: { 'data-gender': opt.value },
    pressed: selectedGender === opt.value,
    icon: UyDosh.filterGenderIcon(opt.value, { pressed: false }),
    label: opt.label,
    ariaLabel: opt.label,
  })).join('');
  const genderSwitch = `
    <div
      class="gender-switch"
      data-selected="${selectedGender}"
      role="group"
      aria-label="${UyDosh.escapeHtml(UyDosh.t('filter.gender.aria', lang))}"
    >
      <span class="gender-switch-thumb" aria-hidden="true"></span>
      ${genderSegments}
    </div>
  `;

  const genderChipsCompact = genderOptions.map((opt) => UyDosh.chipButtonHtml({
    className: 'chip chip-icon-only chip-gender',
    attrs: { 'data-gender': opt.value },
    pressed: selectedGender === opt.value,
    icon: UyDosh.filterGenderIcon(opt.value, { pressed: false }),
    ariaLabel: opt.label,
  })).join('');

  const photoPressed = state.filters.withPhoto;
  const photoChip = UyDosh.chipButtonHtml({
    className: 'chip chip-photo',
    attrs: { 'data-with-photo': true },
    pressed: photoPressed,
    icon: UyDosh.filterPhotoIcon({ pressed: false }),
    label: UyDosh.t('filter.photo.chipLabel', lang),
    ariaLabel: UyDosh.t('filter.photo.aria', lang),
  });

  // Compact-row twin (icon only, matching typeChipsCompact/genderChipsCompact):
  // the label stays in the DOM (via `.chip-icon-only .chip-label { display: none }`)
  // for consistency, but read via `ariaLabel` for assistive tech.
  const photoChipCompact = UyDosh.chipButtonHtml({
    className: 'chip chip-icon-only chip-photo',
    attrs: { 'data-with-photo': true },
    pressed: photoPressed,
    icon: UyDosh.filterPhotoIcon({ pressed: false }),
    ariaLabel: UyDosh.t('filter.photo.aria', lang),
  });

  // "3D View" mini filter — shown in both the expanded and collapsed
  // (compact) ribbons, matching the mobile app's 3D room-scan badge/icon
  // (see Room3dIconBadge, Icons.view_in_ar). In the compact row it trails
  // the district/metro chips.
  const threeDPressed = state.filters.has3dTour;
  const threeDChip = UyDosh.chipButtonHtml({
    className: 'chip chip-3d',
    attrs: { 'data-has-3d-tour': true },
    pressed: threeDPressed,
    icon: UyDosh.filterThreeDIcon(),
    label: UyDosh.t('filter.threeDTour.chipLabel', lang),
    ariaLabel: UyDosh.t('filter.threeDTour.aria', lang),
  });

  // Compact-row twin — same reasoning as photoChipCompact above.
  const threeDChipCompact = UyDosh.chipButtonHtml({
    className: 'chip chip-icon-only chip-3d',
    attrs: { 'data-has-3d-tour': true },
    pressed: threeDPressed,
    icon: UyDosh.filterThreeDIcon(),
    ariaLabel: UyDosh.t('filter.threeDTour.aria', lang),
  });

  const currentPeriod = periodOptions.find((opt) => opt.value === state.filters.createdWithinDays) ?? periodOptions[0];
  const periodChip = UyDosh.chipButtonHtml({
    className: 'chip chip-period',
    attrs: { 'data-period-cycle': true },
    icon: '',
    label: currentPeriod.label,
    ariaLabel: `${UyDosh.t('filter.period.aria', lang)}: ${currentPeriod.label}`,
  });

  // "Sort by price" cycling chip: same single-button cycle pattern as the
  // period/district/metro-line chips above, but list-view only — hidden on
  // the Map tab via `.filters--map-view` (see updateViewTabs) since map pins
  // aren't sorted — and never shown in the collapsed/compact ribbon (no room,
  // and it's reachable again by expanding).
  const priceSortOrder = state.filters.priceSortOrder;
  const priceSortAriaLabel = priceSortOrder
    ? UyDosh.t(priceSortOrder === 'asc' ? 'filter.priceSort.asc' : 'filter.priceSort.desc', lang)
    : UyDosh.t('filter.priceSort.aria', lang);
  const priceSortChip = UyDosh.chipButtonHtml({
    className: 'chip chip-price-sort',
    attrs: { 'data-price-sort-cycle': true },
    pressed: priceSortOrder != null,
    icon: UyDosh.filterPriceSortIcon(priceSortOrder),
    label: `${UyDosh.t('filter.priceSort.chipLabel', lang)} $`,
    iconAfterLabel: true,
    ariaLabel: priceSortAriaLabel,
  });

  // Single cycling metro-line button: bare grey "M" badge that steps to the
  // next line (Chilanzar -> Uzbekistan -> ...) on each tap instead of a row
  // of four separate line buttons, revealing the selected line's name via a
  // slide + fade animation (`.chip-label-collapse` in telegram-shared.css) —
  // see `metroLineChipHtml`/`nextMetroLineId` in uydosh-icons.js. The
  // create-listing wizard still uses the four-button `metroLineChipsHtml`
  // ribbon (there the line is a required field, not a togglable filter).
  const lineChip = UyDosh.metroLineChipHtml(state.filters.subwayLineId, lang);

  // Collapsed row uses the same single cycling button, just denser (see
  // `.chip-line-compact` in telegram-shared.css).
  const lineChipCompact = UyDosh.metroLineChipHtml(state.filters.subwayLineId, lang, { compact: true });

  // District filter button: a single pin badge (sits right before the metro
  // chip, mirroring its icon-reveals-name animation) that cycles through
  // districts alphabetically on each tap instead of picking from a row of
  // options — see `districtChipHtml`/`nextDistrictId` in uydosh-icons.js.
  const districtChip = UyDosh.districtChipHtml(state.filters.locationId, lang);
  const districtChipCompact = UyDosh.districtChipHtml(state.filters.locationId, lang, { compact: true });

  filtersEl.classList.toggle('filters--collapsed', collapsed);
  const filtersToggleHtml = `
      <button
        type="button"
        class="filters-toggle"
        data-filters-toggle
        aria-expanded="${collapsed ? 'false' : 'true'}"
        aria-label="${UyDosh.escapeHtml(toggleLabel)}"
      >${filterChevronIcon()}${filterFunnelIcon()}</button>
  `;

  // Sits right under the expand/collapse chevron above (same right-edge
  // column, see `.filters-reset` margin-left: auto) — only in the expanded
  // ribbon, since the compact/collapsed rows have no room for it and are
  // reachable again by expanding first. Disabled once no filter differs
  // from its default, which also hides it (see `.filters-reset:disabled`
  // in telegram-index.css).
  const filtersResetHtml = `
      <button
        type="button"
        class="filters-reset"
        data-filters-reset
        data-haptic="warning"
        aria-label="${UyDosh.escapeHtml(UyDosh.t('filter.reset.aria', lang))}"
        ${hasActiveFilters() ? '' : 'disabled'}
      >${UyDosh.iconTrash()}</button>
  `;

  filtersEl.innerHTML = `
    <div class="filters-main">
      <div class="filters-slide filters-slide-expanded">
        <div class="filters-slide-inner">
          <div class="filters-expanded">
            <div class="filter-row filter-row-type">
              <div class="chips chips-type" role="group" aria-label="${UyDosh.escapeHtml(UyDosh.t('filter.type.aria', lang))}">
                ${typeChips}
              </div>
              ${filtersToggleHtml}
            </div>
            <div class="filter-row filter-row-gender">
              <div class="filter-controls">
                ${genderSwitch}
                ${photoChip}
                ${threeDChip}
              </div>
              ${filtersResetHtml}
            </div>
            <div class="filter-row filter-row-metro">
              <div class="chips chips-metro" role="group" aria-label="${UyDosh.escapeHtml(UyDosh.t('filter.line.aria', lang))}">
                ${districtChip}
                ${lineChip}
                ${priceSortChip}
                ${periodChip}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="filters-slide filters-slide-compact">
        <div class="filters-slide-inner">
          <div class="filters-collapsed">
            <div class="filter-row filter-row-compact">
              <div class="chips chips-compact" role="group" aria-label="${UyDosh.escapeHtml(UyDosh.t('filter.type.aria', lang))}">
                ${typeChipsCompact}
                ${genderChipsCompact}
                ${photoChipCompact}
                ${districtChipCompact}
                ${lineChipCompact}
                ${threeDChipCompact}
              </div>
              ${filtersToggleHtml}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  setFiltersCollapsedVisual(collapsed);
  setFiltersFoldedVisual(filtersFolded);

  filtersEl.querySelectorAll('[data-filters-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextCollapsed = !state.filtersCollapsed;
      state.filtersCollapsed = nextCollapsed;
      filtersCollapsedByScroll = false;
      unfoldFilters();
      // Re-anchor scroll-driven fold/collapse tracking to "now" on every manual
      // toggle (not just expand) so a manual collapse only folds to the bare
      // chevron after the user scrolls another FILTER_SCROLL_COLLAPSE_PX from
      // here, instead of inheriting a stale anchor from earlier in the page.
      resetFiltersScrollAnchor();
      persistFiltersCollapsed();
      setFiltersCollapsedVisual(nextCollapsed);
      if (state.view === 'map') {
        // The collapse/expand row swap animates via CSS grid-template-rows
        // (see .filters-slide); re-measure once now and once after the
        // transition so the map panel height tracks the ribbon's final size.
        feedMap.scheduleSyncFeedMapPanelHeight();
        setTimeout(() => feedMap.scheduleSyncFeedMapPanelHeight(), 340);
      }
    });
  });

  filtersEl.querySelectorAll('[data-listing-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = Number(btn.getAttribute('data-listing-type'));
      const toggledOff = state.filters.listingTypeId === next;
      state.filters.listingTypeId = toggledOff ? LISTING_TYPE_ALL : next;
      persistFilters();
      logSearchEvent();
      resetAndLoad();
      if (state.view === 'map') feedMap.loadFeedMap();
    });
  });

  filtersEl.querySelectorAll('[data-subway-line-cycle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.filters.subwayLineId = UyDosh.nextMetroLineId(state.filters.subwayLineId);
      // Metro and district are mutually exclusive location filters: picking a
      // line clears any district selection so the two never combine.
      if (state.filters.subwayLineId !== METRO_LINE_ANY) state.filters.locationId = DISTRICT_ANY;
      // Update the button(s) in place (instead of a full re-render) so the
      // icon-reveals-name transition gets to play on every tap, like the
      // district chip's cycle does.
      syncMetroLineCycleChipState();
      syncDistrictChipState();
      syncFiltersResetButtonState();
      persistFilters();
      logSearchEvent();
      resetAndLoad({ skipFiltersRender: true });
      if (state.view === 'map') feedMap.loadFeedMap();
    });
  });

  filtersEl.querySelectorAll('[data-district-cycle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.filters.locationId = UyDosh.nextDistrictId(state.filters.locationId, lang);
      // Metro and district are mutually exclusive location filters: picking a
      // district clears any metro line selection so the two never combine.
      if (state.filters.locationId !== DISTRICT_ANY) state.filters.subwayLineId = METRO_LINE_ANY;
      // Update the button(s) in place (instead of a full re-render) so the same
      // icon-reveals-name transition the metro line chip uses gets to play here too.
      syncDistrictChipState();
      syncMetroLineCycleChipState();
      syncFiltersResetButtonState();
      persistFilters();
      logSearchEvent();
      resetAndLoad({ skipFiltersRender: true });
      if (state.view === 'map') feedMap.loadFeedMap();
    });
  });

  filtersEl.querySelectorAll('[data-gender]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = Number(btn.getAttribute('data-gender'));
      const toggledOff = state.filters.gender === next;
      state.filters.gender = toggledOff ? GENDER_ANY : next;
      persistFilters();
      logSearchEvent();
      resetAndLoad();
      if (state.view === 'map') feedMap.loadFeedMap();
    });
  });

  filtersEl.querySelectorAll('[data-with-photo]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.filters.withPhoto = !state.filters.withPhoto;
      state.withPhotoExplicit = true;
      persistFilters();
      logSearchEvent();
      resetAndLoad();
      if (state.view === 'map') feedMap.loadFeedMap();
    });
  });

  filtersEl.querySelectorAll('[data-has-3d-tour]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.filters.has3dTour = !state.filters.has3dTour;
      persistFilters();
      logSearchEvent();
      resetAndLoad();
      if (state.view === 'map') feedMap.loadFeedMap();
    });
  });

  filtersEl.querySelectorAll('[data-period-cycle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const currentIndex = PERIOD_OPTION_VALUES.indexOf(state.filters.createdWithinDays);
      const nextIndex = (currentIndex + 1) % PERIOD_OPTION_VALUES.length;
      state.filters.createdWithinDays = PERIOD_OPTION_VALUES[nextIndex];
      persistFilters();
      logSearchEvent();
      resetAndLoad();
      if (state.view === 'map') feedMap.loadFeedMap();
    });
  });

  filtersEl.querySelectorAll('[data-price-sort-cycle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const currentIndex = PRICE_SORT_ORDER_VALUES.indexOf(state.filters.priceSortOrder);
      const nextIndex = (currentIndex + 1) % PRICE_SORT_ORDER_VALUES.length;
      state.filters.priceSortOrder = PRICE_SORT_ORDER_VALUES[nextIndex];
      persistFilters();
      logSearchEvent();
      resetAndLoad();
    });
  });

  filtersEl.querySelectorAll('[data-filters-reset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!hasActiveFilters()) return;
      state.filters.listingTypeId = LISTING_TYPE_ALL;
      state.filters.gender = GENDER_ANY;
      state.filters.withPhoto = DEFAULT_WITH_PHOTO;
      state.withPhotoExplicit = false;
      state.filters.has3dTour = DEFAULT_HAS_3D_TOUR;
      state.filters.subwayLineId = METRO_LINE_ANY;
      state.filters.locationId = DISTRICT_ANY;
      state.filters.createdWithinDays = PERIOD_DEFAULT_DAYS;
      state.filters.priceSortOrder = null;
      persistFilters();
      logSearchEvent();
      resetAndLoad();
      if (state.view === 'map') feedMap.loadFeedMap();
    });
  });
}

/** Keeps the "reset filters" trash button's `disabled` state in sync with
 * `hasActiveFilters()` for handlers that pass `skipFiltersRender: true` to
 * `resetAndLoad()` (currently the district/metro-line cycle buttons — see
 * below) so it doesn't skip the full `renderFilters()` that would otherwise
 * update it. Without this, picking a district or metro line left the button
 * stuck disabled (and thus hidden, per `.filters-reset:disabled`) even
 * though a filter was now active. */
function syncFiltersResetButtonState() {
  const active = hasActiveFilters();
  filtersEl.querySelectorAll('[data-filters-reset]').forEach((btn) => {
    btn.disabled = !active;
  });
}

/** Updates the already-rendered metro-line cycle button(s) (expanded +
 * compact rows) in place: like the district chip below, this single button's
 * label/color changes on every tap (it cycles through lines), so this
 * rewrites `.chip-label` text and `--line-color` too — not just
 * `aria-pressed` — while still avoiding a full re-render, so the
 * reveal/collapse transition plays each time. */
function syncMetroLineCycleChipState() {
  const lang = UyDosh.getLang();
  const selected = state.filters.subwayLineId;
  const selectedLabel = selected > 0 ? UyDosh.metroLineLabel(selected, lang) : '';
  const ariaLabel = selected > 0 ? selectedLabel : UyDosh.t('filter.line.aria', lang);
  // Full row falls back to the "Метро" placeholder once cycled back to off (see
  // metroLineChipHtml's `compact` branch); the compact row stays icon-only, same as
  // its own initial render.
  const placeholderLabel = UyDosh.t('filter.line.placeholder', lang);
  filtersEl.querySelectorAll('[data-subway-line-cycle]').forEach((btn) => {
    btn.setAttribute('aria-pressed', selected > 0 ? 'true' : 'false');
    btn.setAttribute('aria-label', ariaLabel);
    if (selected > 0) {
      btn.style.setProperty('--line-color', UyDosh.metroLineColor(selected));
    } else {
      btn.style.removeProperty('--line-color');
    }
    const labelEl = btn.querySelector('.chip-label');
    if (labelEl) {
      labelEl.textContent =
        selectedLabel || (btn.classList.contains('chip-line-compact') ? '' : placeholderLabel);
    }
  });
}

/** Updates the already-rendered district button(s) (expanded + compact rows)
 * in place: unlike the fixed-label metro chips above, this single button's
 * label changes on every tap (it cycles through district names), so this also
 * rewrites `.chip-label` text — not just `aria-pressed` — while still avoiding
 * a full re-render, so the reveal/collapse transition plays each time. */
function syncDistrictChipState() {
  const lang = UyDosh.getLang();
  const selected = state.filters.locationId;
  const selectedLabel = selected > 0 ? UyDosh.districtLabel(selected, lang) : '';
  const ariaLabel = selected > 0 ? selectedLabel : UyDosh.t('filter.district.aria', lang);
  // Full row falls back to the "Район" placeholder once cycled back to off (see
  // districtChipHtml's `compact` branch); the compact row stays icon-only, same as
  // its own initial render.
  const placeholderLabel = UyDosh.t('filter.district.placeholder', lang);
  filtersEl.querySelectorAll('[data-district-cycle]').forEach((btn) => {
    btn.setAttribute('aria-pressed', selected > 0 ? 'true' : 'false');
    btn.setAttribute('aria-label', ariaLabel);
    // Each cycle can land on a different district, so its color (mirrors the
    // mobile map's per-district palette — see `UyDosh.districtColor`) has to
    // be re-applied here too, not just baked into the initial render.
    if (selected > 0) {
      btn.style.setProperty('--line-color', UyDosh.districtColor(selected));
    } else {
      btn.style.removeProperty('--line-color');
    }
    const labelEl = btn.querySelector('.chip-label');
    if (labelEl) {
      labelEl.textContent =
        selectedLabel || (btn.classList.contains('chip-line-compact') ? '' : placeholderLabel);
    }
  });
}

// Bumped on every filter change / reset so a slow, still-in-flight `loadMore()`
// request from a *previous* filter selection can recognize it's stale once it
// resolves and discard itself instead of appending its (now wrong) results —
// mirrors the `mapLoadGeneration` guard in telegram-feed-map.js. Without this,
// rapidly switching filters (e.g. tapping through metro lines) could let an
// older, slower response land after a newer one and clobber the grid with
// results for a filter that's no longer selected.
let loadGeneration = 0;

function resetAndLoad({ skipFiltersRender = false } = {}) {
  loadGeneration += 1;
  clearFeedScrollState();
  state.page = 0;
  state.totalPages = 1;
  state.items = [];
  state.reachedEnd = false;
  state.emptyResultHapticFired = false;
  state.errored = false;
  state.loading = false;
  gridEl.innerHTML = '';
  statusEl.innerHTML = '';
  if (!skipFiltersRender) renderFilters();
  if (state.view === 'list') loadMore();
}

function listingCardHtml(listing) {
  const lang = UyDosh.getLang();
  const photo = UyDosh.primaryPhoto(listing);
  const photoSrc = photo ? UyDosh.photoUrl(photo) : '';
  const title = UyDosh.escapeHtml(listing.title || '');
  const price = UyDosh.formatPrice(listing, lang);
  const typeName = UyDosh.listingTypeBadgeLabel(listing, lang);
  const listingTypeId = listing.listing_type_id ?? listing.listing_type?.id;
  const typeColor = UyDosh.listingTypeColor(listingTypeId);
  const locName = UyDosh.localizedShort(listing.location, lang);
  const metro = UyDosh.localized(listing.subway_station, lang);
  const rooms = Number(listing.rooms_number);
  const metaParts = [];
  if (locName) {
    metaParts.push(`<span>${UyDosh.iconPin()}${UyDosh.escapeHtml(locName)}</span>`);
  }
  if (metro) {
    const line = UyDosh.resolveMetroLine(listing);
    metaParts.push(`<span>${UyDosh.iconMetro(line)}${UyDosh.escapeHtml(metro)}</span>`);
  }
  if (Number.isFinite(rooms) && rooms > 0) {
    metaParts.push(`<span>${rooms} ${UyDosh.escapeHtml(UyDosh.t('card.rooms'))}</span>`);
  }
  const privateRoomHtml = listing.private_room
    ? `<div class="meta meta-private-room"><span>${UyDosh.iconLock()}${UyDosh.escapeHtml(UyDosh.t('card.privateRoom'))}</span></div>`
    : '';
  const priceHtml = price ? `<div class="price">${price}<small>${UyDosh.escapeHtml(UyDosh.t('card.perMonth'))}</small></div>` : '';
  const priceColHtml = (priceHtml || privateRoomHtml)
    ? `<div class="price-col">${priceHtml}${privateRoomHtml}</div>`
    : '';

  const featured = UyDosh.isFeatured(listing)
    ? `<div class="featured-badge">${UyDosh.escapeHtml(UyDosh.t('card.featured'))}</div>`
    : '';
  const typeStyle = typeColor ? ` style="--badge-type-color:${typeColor}"` : '';
  const typeBadge = typeName
    ? `<div class="type-badge"${typeStyle}>${UyDosh.escapeHtml(typeName)}</div>`
    : '';
  const amenityRow = UyDosh.amenityIconsRowHtml(listing.amenities, lang);
  const posted = listing.created_at
    ? UyDosh.formatListingCardPublicationDate(listing.created_at, lang)
    : '';
  const amenityHtml = (amenityRow || posted)
    ? `<div class="card-footer"><div class="amenity-row">
        ${amenityRow ? `<span class="amenity-row-icons">${amenityRow}</span>` : '<span class="amenity-row-icons"></span>'}
        ${posted ? `<span class="card-posted">${UyDosh.iconCalendar()}${UyDosh.escapeHtml(posted)}</span>` : ''}
      </div></div>`
    : '';
  const photoDots = UyDosh.cardPhotoDotsHtml(listing);
  // Top-right is the only unclaimed thumb corner: top-left already carries
  // featured/type badges and bottom-center carries the photo-count dots.
  const threeDBadge = UyDosh.threeDTourBadgeHtml(listing, lang);
  const placeholderSrc = !photoSrc ? UyDosh.noPhotoPlaceholderImageUrl(listing) : '';
  const thumb = photoSrc
    ? `<div class="thumb"><img loading="lazy" decoding="async" src="${UyDosh.escapeHtml(photoSrc)}" alt="${title}" onerror="this.parentElement.classList.add('empty'); this.remove();" />${featured}${typeBadge}${threeDBadge}${photoDots}</div>`
    : placeholderSrc
      ? `<div class="thumb thumb-placeholder"><img loading="lazy" decoding="async" src="${UyDosh.escapeHtml(placeholderSrc)}" alt="${title}" />${featured}${typeBadge}${threeDBadge}</div>`
      : `<div class="thumb empty">${featured}${typeBadge}${threeDBadge}</div>`;

  return `
    <a class="card" href="${UyDosh.escapeHtml(UyDosh.listingPageUrl(listing.id))}">
      ${thumb}
      <div class="body">
        <div class="title-row">
          <div class="title-col">
            <div class="title">${title}</div>
            ${metaParts.length ? `<div class="meta">${metaParts.join('')}</div>` : ''}
          </div>
          ${priceColHtml}
        </div>
        ${amenityHtml}
      </div>
    </a>
  `;
}

function renderAll() {
  gridEl.innerHTML = state.items.map(listingCardHtml).join('');
}

/**
 * Re-applies only the language-dependent bits of an already-rendered card
 * (labels, badges, translated meta text) without touching its `<thumb><img>` —
 * used on language change instead of `renderAll()` so previously loaded photos
 * aren't torn down/re-decoded and long, already-scrolled grids don't repaint
 * in one big expensive reflow. Falls back to `renderAll()` if anything about
 * the existing DOM doesn't look like what this function expects.
 */
function patchCardThumbBadges(oldThumb, newThumb) {
  const oldImg = oldThumb.querySelector(':scope > img');
  const newImg = newThumb.querySelector(':scope > img');
  for (const child of Array.from(oldThumb.children)) {
    if (child !== oldImg) child.remove();
  }
  for (const child of Array.from(newThumb.children)) {
    if (child !== newImg) oldThumb.appendChild(child);
  }
}

function patchCardLanguage(cardEl, listing) {
  const tmp = document.createElement('div');
  tmp.innerHTML = listingCardHtml(listing);
  const newCard = tmp.firstElementChild;
  if (!newCard) return false;
  const oldBody = cardEl.querySelector(':scope > .body');
  const newBody = newCard.querySelector(':scope > .body');
  if (!oldBody || !newBody) return false;
  oldBody.replaceWith(newBody);
  const oldThumb = cardEl.querySelector(':scope > .thumb');
  const newThumb = newCard.querySelector(':scope > .thumb');
  if (oldThumb && newThumb) patchCardThumbBadges(oldThumb, newThumb);
  return true;
}

function updateCardsLanguage() {
  const cards = gridEl.querySelectorAll(':scope > a.card');
  if (cards.length !== state.items.length) {
    // Structural mismatch (shouldn't normally happen) — fall back to a full rebuild.
    renderAll();
    return;
  }
  cards.forEach((cardEl, i) => {
    if (!patchCardLanguage(cardEl, state.items[i])) renderAll();
  });
}

function appendListings(list) {
  const frag = document.createElement('div');
  frag.innerHTML = list.map(listingCardHtml).join('');
  while (frag.firstChild) gridEl.appendChild(frag.firstChild);
}

function showSkeletons(n = 6) {
  const row = `
    <div class="skeleton">
      <div class="thumb"></div>
      <div class="body">
        <div class="line w60"></div>
        <div class="line w40"></div>
      </div>
    </div>`;
  statusEl.innerHTML = '';
  const holder = document.createElement('div');
  holder.className = 'grid';
  holder.style.gridColumn = '1 / -1';
  holder.innerHTML = row.repeat(n);
  statusEl.appendChild(holder);
}

function showError() {
  const retryButtonHtml = `
    <button class="btn" id="retry" type="button">${UyDosh.iconChrome('refresh')}<span>${UyDosh.escapeHtml(UyDosh.t('feed.retry'))}</span></button>
  `;
  // Only center the error in the middle of the (otherwise empty) screen when there's
  // nothing else on the page yet, i.e. the very first page failed to load — a
  // *pagination* failure (loading page 2+ while earlier pages' cards are still showing)
  // keeps the plain inline treatment below the existing grid instead, same as `showEnd()`
  // distinguishes an empty feed from an in-progress one.
  if (state.items.length === 0) {
    feedListPanel?.classList.add('is-empty');
    statusEl.className = 'status is-error-state';
    statusEl.innerHTML = `
      <div class="feed-error-state">
        <p class="feed-error-state-title">${UyDosh.escapeHtml(UyDosh.t('feed.error'))}</p>
        ${retryButtonHtml}
      </div>
    `;
  } else {
    feedListPanel?.classList.remove('is-empty');
    statusEl.className = 'status';
    statusEl.innerHTML = `
      <div>${UyDosh.escapeHtml(UyDosh.t('feed.error'))}</div>
      ${retryButtonHtml}
    `;
  }
  document.getElementById('retry')?.addEventListener('click', () => {
    state.errored = false;
    loadMore();
  });
}

function showEnd() {
  if (state.items.length === 0) {
    feedListPanel?.classList.add('is-empty');
    statusEl.className = 'status is-empty-state';
    statusEl.innerHTML = UyDosh.feedEmptyStateHtml();
    // Fires once per search/filter cycle (see `emptyResultHapticFired` reset in
    // `resetAndLoad`) — `showEnd()` also re-runs on e.g. a language switch while
    // already empty, which shouldn't buzz again.
    if (!state.emptyResultHapticFired) {
      state.emptyResultHapticFired = true;
      UyDosh.haptic.notFound();
    }
    return;
  }
  feedListPanel?.classList.remove('is-empty');
  statusEl.className = 'status';
  statusEl.textContent = UyDosh.t('feed.end');
}

function clearStatus() {
  feedListPanel?.classList.remove('is-empty');
  statusEl.className = 'status';
  statusEl.innerHTML = '';
  statusEl.textContent = '';
}

function showLoadingMore() {
  statusEl.textContent = UyDosh.t('feed.loading');
}

function updatePagination(data, listings, page) {
  const totalPages = Number(data?.totalPages);
  if (Number.isFinite(totalPages) && totalPages >= 0) {
    state.totalPages = totalPages;
    return;
  }
  if (listings.length < PAGE_SIZE) {
    state.totalPages = page;
  }
}

async function loadMore() {
  if (state.view === 'map') return;
  if (state.loading || state.reachedEnd || state.errored) return;
  if (state.page >= state.totalPages && state.page > 0) {
    state.reachedEnd = true;
    showEnd();
    return;
  }

  const requestGeneration = loadGeneration;
  state.loading = true;
  const nextPage = state.page + 1;
  if (nextPage === 1) {
    showSkeletons(6);
  } else {
    showLoadingMore();
  }

  try {
    const data = await UyDosh.fetchListings({
      page: nextPage,
      limit: PAGE_SIZE,
      listingTypeId: listingTypeQueryParam(),
      gender: genderQueryParam(),
      withPhoto: withPhotoQueryParam(),
      has3dTour: has3dTourQueryParam(),
      subwayLineId: subwayLineQueryParam(),
      locationId: locationQueryParam(),
      createdWithinDays: createdWithinDaysQueryParam(),
      sortBy: sortByQueryParam(),
      sortOrder: sortOrderQueryParam(),
    });
    // A newer filter/reset superseded this request while it was in flight —
    // drop the stale response instead of appending results for a filter
    // that's no longer selected (see `loadGeneration` comment above).
    if (requestGeneration !== loadGeneration) return;
    const listings = Array.isArray(data?.listings) ? data.listings : [];
    updatePagination(data, listings, nextPage);
    state.page = nextPage;
    state.items.push(...listings);
    if (nextPage === 1) gridEl.innerHTML = '';
    appendListings(listings);
    clearStatus();

    if (listings.length === 0 || state.page >= state.totalPages) {
      state.reachedEnd = true;
      showEnd();
    }
    // Warm up the Map tab's pins fetch + Yandex SDK script in the background
    // right after the list's own first page succeeds, so the first-ever tap
    // on "Карта" doesn't have to wait on a cold fetch + script download
    // before it can start rendering (see prefetchMap() for details). Fired
    // after (not alongside) the list request so it never competes with it
    // for bandwidth on a slow connection.
    if (nextPage === 1) feedMap.prefetchMap();
  } catch (err) {
    if (requestGeneration !== loadGeneration) return;
    console.error('Failed to load listings', err);
    state.errored = true;
    if (state.page === 0) gridEl.innerHTML = '';
    showError();
  } finally {
    if (requestGeneration === loadGeneration) {
      state.loading = false;
    }
  }
}

/**
 * Re-fetches every page the user had already reached before tapping into a
 * listing, then jumps back to their saved scroll offset — instead of the
 * plain `loadMore()` cold start, which would only bring back page 1 and
 * leave the grid too short for the old scroll offset to mean anything.
 */
async function restoreFeedScrollOrLoad() {
  const saved = takeFeedScrollState();
  if (!saved) {
    loadMore();
    return;
  }
  const targetPage = Math.min(saved.page, FEED_SCROLL_RESTORE_MAX_PAGES);
  for (let i = 0; i < targetPage; i += 1) {
    // Sequential and awaited: loadMore() reads/writes shared `state.page`,
    // so pages must resolve and apply in order, one at a time.
    // eslint-disable-next-line no-await-in-loop
    await loadMore();
    if (state.reachedEnd || state.errored) break;
  }
  const restoreY = Number(saved.scrollY);
  if (!Number.isFinite(restoreY) || restoreY <= 0) return;
  // Lazy-loaded photos can still shift layout after the first paint, so the
  // jump is reasserted a couple of times rather than trusting a single shot.
  const jump = () => {
    window.scrollTo(0, restoreY);
    // Keep the filter-collapse anchor and scroll-top button in sync with the
    // jump instead of the stale scrollY=0 they were set up with at page load.
    resetFiltersScrollAnchor(restoreY);
    updateScrollTopButton();
  };
  requestAnimationFrame(() => {
    jump();
    requestAnimationFrame(jump);
  });
  setTimeout(jump, 350);
}

if ('IntersectionObserver' in window) {
  const scrollObserver = new IntersectionObserver(
    (entries) => {
      if (state.view !== 'list') return;
      if (entries.some((entry) => entry.isIntersecting)) loadMore();
    },
    { root: null, rootMargin: '240px 0px', threshold: 0 },
  );
  scrollObserver.observe(sentinelEl);
}

for (const tab of viewTabs) {
  tab.addEventListener('click', () => {
    switchView(tab.getAttribute('data-view') || 'list');
  });
}

UyDosh.initLangSwitcher();
document.addEventListener('uydosh:langchange', () => {
  UyDosh.applyI18n();
  renderFilters();
  updateViewTabs();
  updateCardsLanguage();
  if (state.reachedEnd && state.view === 'list') showEnd();
  if (state.view === 'map') {
    feedMap.onLangChange();
  } else if (state.selectedMapPins.length > 0) {
    feedMap.renderMapPinTooltip();
  }
  UyDosh.logMiniAppEvent('lang_changed', { language: UyDosh.getLang() });
});

gridEl.addEventListener('click', (event) => {
  const card = event.target.closest('a.card');
  if (!card) return;
  // Saved unconditionally (not just in the Mini App) so returning via the
  // browser's own Back button benefits too, in case bfcache doesn't kick in.
  saveFeedScrollState();
  if (!UyDosh.isMiniApp()) return;
  const href = card.getAttribute('href') || '';
  const match = href.match(/[?&]id=(\d+)/);
  if (match) {
    UyDosh.logMiniAppEvent('listing_tap', { listing_id: Number(match[1]) });
  }
});

filtersEl.classList.add('filters--instant');
renderFilters();
updateViewTabs();
resetFiltersScrollAnchor();
requestAnimationFrame(() => {
  requestAnimationFrame(() => filtersEl.classList.remove('filters--instant'));
});
scrollTopBtnEl?.addEventListener('click', () => {
  scrollToFeedTop();
});
window.addEventListener('scroll', handleFeedScrollForFilters, { passive: true });
window.addEventListener('resize', updateScrollTopButton, { passive: true });
window.addEventListener('pageshow', () => {
  resetFiltersScrollAnchor();
  updateScrollTopButton();
});
requestAnimationFrame(() => resetFiltersScrollAnchor());
updateScrollTopButton();
restoreFeedScrollOrLoad();
// Best-effort "add your university" nudge — never blocks the feed itself.
UyDosh.maybeShowProfileNudge?.();

// Warm the Yandex Maps SDK in the background while the user is on the
// default List tab, so tapping over to Карта/Map later renders close to
// instantly instead of paying the full api-maps.yandex.ru script load then.
// Runs once, right here at app start (the feed always lands on 'list' first,
// see `state.view` above) — not on every tab switch. `loadYandexScript()` is
// itself idempotent (caches its in-flight/resolved promise and short-circuits
// once `window.ymaps` is ready), so this can't race or duplicate work if the
// user reaches the Map tab before it finishes; `loadFeedMap()` just reuses
// whatever this kicked off.
UyDosh.loadYandexMapModule()
  .then((mapModule) => mapModule.loadYandexScript(UyDosh.getLang()))
  .catch(() => {
    // Best-effort only — a real failure surfaces again (with its own retry
    // UI) when the user actually opens the Map tab via loadFeedMap().
  });
