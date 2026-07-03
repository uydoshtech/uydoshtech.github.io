UyDosh.initTelegramMiniApp();
window.Telegram?.WebApp?.MainButton?.hide();

const PAGE_SIZE = 10;
// LISTING_TYPE_*, GENDER_*, METRO_LINE_ANY are already global consts declared by
// uydosh-icons.js (loaded before this file) — do not redeclare them here, classic
// <script> top-level `const` lives in a shared lexical scope and a second `const`
// with the same name throws a SyntaxError that aborts this entire script.
const DEFAULT_WITH_PHOTO = false;
// Default period filter value; kept in sync with uydosh_client's
// listingBrowseCreatedWithinDays so first-load behavior matches the app.
const PERIOD_DEFAULT_DAYS = 30;
const PERIOD_ALL_TIME = 0;
const PERIOD_OPTION_VALUES = [30, 90, PERIOD_ALL_TIME];
const FILTER_STORAGE_KEY = 'uydosh_tg_feed_filters';
const FILTER_COLLAPSED_KEY = 'uydosh_tg_filters_collapsed';
const FILTER_SCROLL_COLLAPSE_PX = 100;
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
const feedMapContactBannerEl = document.getElementById('feed-map-contact-banner');
const viewTabs = document.querySelectorAll('[data-view]');
const fabCreateEl = document.getElementById('fab-create');
const scrollTopBtnEl = document.getElementById('scroll-top-btn');
fabCreateEl?.addEventListener('click', () => {
  UyDosh.getTelegramInitData();
  UyDosh.logMiniAppEvent('create_listing_tap');
  window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
});
let filtersScrollAnchorY = 0;
let filtersScrollRaf = 0;
let filtersCollapsedByScroll = false;
let showScrollTopButton = false;

function resetFiltersScrollAnchor(y = window.scrollY) {
  filtersScrollAnchorY = Number.isFinite(y) ? Math.max(0, y) : 0;
}

function setFiltersCollapsedVisual(collapsed = state.filtersCollapsed) {
  filtersEl.classList.toggle('filters--collapsed', collapsed);
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
}

function expandFiltersFromScroll() {
  if (!state.filtersCollapsed || !filtersCollapsedByScroll || state.view !== 'list') return;
  state.filtersCollapsed = false;
  filtersCollapsedByScroll = false;
  persistFiltersCollapsed();
  setFiltersCollapsedVisual(false);
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
  window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
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
    } else if (filtersCollapsedByScroll && delta <= FILTER_SCROLL_EXPAND_PX) {
      expandFiltersFromScroll();
    }
  });
}

function readFiltersCollapsed() {
  try {
    return sessionStorage.getItem(FILTER_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function persistFiltersCollapsed() {
  try {
    sessionStorage.setItem(FILTER_COLLAPSED_KEY, state.filtersCollapsed ? 'true' : 'false');
  } catch {
    // ignore quota / private mode
  }
}

function filterChevronIcon() {
  return `
    <span class="filters-toggle-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M6 9l6 6 6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
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
    const raw = sessionStorage.getItem(FILTER_STORAGE_KEY);
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
      subwayLineId: Number(parsed.subwayLineId) || METRO_LINE_ANY,
      createdWithinDays: PERIOD_OPTION_VALUES.includes(Number(parsed.createdWithinDays))
        ? Number(parsed.createdWithinDays)
        : PERIOD_DEFAULT_DAYS,
    };
  } catch {
    return null;
  }
}

function persistFilters() {
  try {
    sessionStorage.setItem(
      FILTER_STORAGE_KEY,
      JSON.stringify({
        listingTypeId: state.filters.listingTypeId,
        gender: state.filters.gender,
        withPhoto: state.filters.withPhoto,
        withPhotoExplicit: state.withPhotoExplicit,
        subwayLineId: state.filters.subwayLineId,
        createdWithinDays: state.filters.createdWithinDays,
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
  items: [],
  filters: {
    listingTypeId: urlListingTypeId ?? storedFilters?.listingTypeId ?? LISTING_TYPE_ALL,
    gender: storedFilters?.gender ?? GENDER_ANY,
    withPhoto: storedFilters?.withPhoto ?? DEFAULT_WITH_PHOTO,
    subwayLineId: storedFilters?.subwayLineId ?? METRO_LINE_ANY,
    createdWithinDays: storedFilters?.createdWithinDays ?? PERIOD_DEFAULT_DAYS,
  },
  withPhotoExplicit: storedFilters?.withPhotoExplicit ?? false,
  filtersCollapsed: readFiltersCollapsed(),
  view: 'list',
  mapPins: [],
  mapResultTotal: 0,
  mapLoading: false,
  mapLoaded: false,
  mapModule: null,
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

function filterTapHaptic() {
  window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
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

function subwayLineQueryParam() {
  const id = state.filters.subwayLineId;
  return id > 0 ? id : undefined;
}

function createdWithinDaysQueryParam() {
  const days = state.filters.createdWithinDays;
  return days > 0 ? days : undefined;
}

function logSearchEvent() {
  UyDosh.logMiniAppEvent('search', {
    listing_type_id: state.filters.listingTypeId,
    gender: state.filters.gender,
    with_photo: state.filters.withPhoto ? 'true' : 'false',
    subway_line_id: state.filters.subwayLineId,
    created_within_days: state.filters.createdWithinDays,
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
    feedMapContactBannerEl,
    fabCreateEl,
  },
  state,
  onHaptic: filterTapHaptic,
  getFilterParams: () => ({
    listingTypeId: listingTypeQueryParam(),
    gender: genderQueryParam(),
    withPhoto: withPhotoQueryParam(),
    subwayLineId: subwayLineQueryParam(),
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
}

function switchView(nextView) {
  if (state.view === nextView) return;
  filterTapHaptic();
  state.view = nextView;
  updateViewTabs();
  updateScrollTopButton();
  if (nextView === 'map') {
    feedMap.onEnterMapView();
  } else {
    resetFiltersScrollAnchor();
    feedMap.onLeaveMapView();
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

  const typeChips = typeOptions.map((opt) => {
    const pressed = state.filters.listingTypeId === opt.value;
    const icon = UyDosh.filterListingTypeIcon(opt.value, { pressed: false });
    return `
    <button
      type="button"
      class="chip"
      data-listing-type="${opt.value}"
      aria-pressed="${pressed ? 'true' : 'false'}"
    >${icon}<span class="chip-label">${UyDosh.escapeHtml(opt.label)}</span></button>
  `;
  }).join('');

  const typeChipsCompact = typeOptions.map((opt) => {
    const pressed = state.filters.listingTypeId === opt.value;
    const icon = UyDosh.filterListingTypeIcon(opt.value, { pressed: false });
    return `
    <button
      type="button"
      class="chip chip-icon-only"
      data-listing-type="${opt.value}"
      aria-pressed="${pressed ? 'true' : 'false'}"
      aria-label="${UyDosh.escapeHtml(opt.label)}"
    >${icon}</button>
  `;
  }).join('');

  const selectedGender = state.filters.gender;
  const genderSegments = genderOptions.map((opt) => {
    const pressed = selectedGender === opt.value;
    const icon = UyDosh.filterGenderIcon(opt.value, { pressed: false });
    return `
    <button
      type="button"
      class="gender-switch-segment"
      data-gender="${opt.value}"
      aria-pressed="${pressed ? 'true' : 'false'}"
      aria-label="${UyDosh.escapeHtml(opt.label)}"
    >${icon}<span class="chip-label">${UyDosh.escapeHtml(opt.label)}</span></button>
  `;
  }).join('');
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

  const genderChipsCompact = genderOptions.map((opt) => {
    const pressed = selectedGender === opt.value;
    const icon = UyDosh.filterGenderIcon(opt.value, { pressed: false });
    return `
    <button
      type="button"
      class="chip chip-icon-only chip-gender"
      data-gender="${opt.value}"
      aria-pressed="${pressed ? 'true' : 'false'}"
      aria-label="${UyDosh.escapeHtml(opt.label)}"
    >${icon}</button>
  `;
  }).join('');

  const photoPressed = state.filters.withPhoto;
  const photoChip = `
    <button
      type="button"
      class="chip chip-photo"
      data-with-photo
      aria-pressed="${photoPressed ? 'true' : 'false'}"
      aria-label="${UyDosh.escapeHtml(UyDosh.t('filter.photo.aria', lang))}"
    >${UyDosh.filterPhotoIcon({ pressed: false })}</button>
  `;

  const currentPeriod = periodOptions.find((opt) => opt.value === state.filters.createdWithinDays) ?? periodOptions[0];
  const periodChip = `
    <button
      type="button"
      class="chip chip-period"
      data-period-cycle
      aria-label="${UyDosh.escapeHtml(UyDosh.t('filter.period.aria', lang))}: ${UyDosh.escapeHtml(currentPeriod.label)}"
    ><span class="chip-label">${UyDosh.escapeHtml(currentPeriod.label)}</span></button>
  `;

  // Same icon-only-until-selected treatment as the compact row below: the
  // expanded metro row also stays as bare "M" badges and reveals the line
  // name (animated) only for the currently selected line.
  const lineChips = UyDosh.METRO_LINE_IDS.map((lineId) => {
    const pressed = state.filters.subwayLineId === lineId;
    const color = UyDosh.metroLineColor(lineId) || 'currentColor';
    const label = UyDosh.metroLineLabel(lineId, lang);
    return `
    <button
      type="button"
      class="chip chip-line"
      data-subway-line="${lineId}"
      style="--line-color:${color}"
      aria-pressed="${pressed ? 'true' : 'false'}"
      aria-label="${UyDosh.escapeHtml(label)}"
    >${UyDosh.metroLineBadgeHtml(lineId)}<span class="chip-label-collapse"><span class="chip-label">${UyDosh.escapeHtml(label)}</span></span></button>
  `;
  }).join('');

  // Collapsed metro chips stay icon-only until tapped: selecting a line
  // reveals its name inline (see `.chip-line-compact` in telegram/index.html)
  // instead of a plain always-on label, so the compact row can stay dense.
  const lineChipsCompact = UyDosh.METRO_LINE_IDS.map((lineId) => {
    const pressed = state.filters.subwayLineId === lineId;
    const color = UyDosh.metroLineColor(lineId) || 'currentColor';
    const label = UyDosh.metroLineLabel(lineId, lang);
    return `
    <button
      type="button"
      class="chip chip-line chip-line-compact"
      data-subway-line="${lineId}"
      style="--line-color:${color}"
      aria-pressed="${pressed ? 'true' : 'false'}"
      aria-label="${UyDosh.escapeHtml(label)}"
    >${UyDosh.metroLineBadgeHtml(lineId)}<span class="chip-label-collapse"><span class="chip-label">${UyDosh.escapeHtml(label)}</span></span></button>
  `;
  }).join('');

  filtersEl.classList.toggle('filters--collapsed', collapsed);
  const filtersToggleHtml = `
      <button
        type="button"
        class="filters-toggle"
        data-filters-toggle
        aria-expanded="${collapsed ? 'false' : 'true'}"
        aria-label="${UyDosh.escapeHtml(toggleLabel)}"
      >${filterChevronIcon()}</button>
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
                ${periodChip}
              </div>
            </div>
            <div class="filter-row filter-row-metro">
              <div class="chips chips-metro" role="group" aria-label="${UyDosh.escapeHtml(UyDosh.t('filter.line.aria', lang))}">
                ${lineChips}
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
                ${photoChip}
                ${lineChipsCompact}
              </div>
              ${filtersToggleHtml}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  setFiltersCollapsedVisual(collapsed);

  filtersEl.querySelectorAll('[data-filters-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      filterTapHaptic();
      const nextCollapsed = !state.filtersCollapsed;
      state.filtersCollapsed = nextCollapsed;
      filtersCollapsedByScroll = false;
      if (!nextCollapsed) {
        resetFiltersScrollAnchor();
      }
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
      filterTapHaptic();
      state.filters.listingTypeId = toggledOff ? LISTING_TYPE_ALL : next;
      persistFilters();
      logSearchEvent();
      resetAndLoad();
      if (state.view === 'map') feedMap.loadFeedMap();
    });
  });

  filtersEl.querySelectorAll('[data-subway-line]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = Number(btn.getAttribute('data-subway-line'));
      const toggledOff = state.filters.subwayLineId === next;
      filterTapHaptic();
      state.filters.subwayLineId = toggledOff ? METRO_LINE_ANY : next;
      // Flip aria-pressed on the existing buttons (instead of letting the
      // upcoming full re-render replace them) so the CSS transition that
      // expands the tapped chip into its name actually gets to play.
      syncMetroLineChipPressedState();
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
      filterTapHaptic();
      state.filters.gender = toggledOff ? GENDER_ANY : next;
      persistFilters();
      logSearchEvent();
      resetAndLoad();
      if (state.view === 'map') feedMap.loadFeedMap();
    });
  });

  filtersEl.querySelectorAll('[data-with-photo]').forEach((btn) => {
    btn.addEventListener('click', () => {
      filterTapHaptic();
      state.filters.withPhoto = !state.filters.withPhoto;
      state.withPhotoExplicit = true;
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
      filterTapHaptic();
      state.filters.createdWithinDays = PERIOD_OPTION_VALUES[nextIndex];
      persistFilters();
      logSearchEvent();
      resetAndLoad();
      if (state.view === 'map') feedMap.loadFeedMap();
    });
  });
}

/** Updates aria-pressed on already-rendered metro chips (expanded + compact
 * rows) without touching the rest of the DOM, so `[aria-pressed]`-driven CSS
 * transitions (name reveal, border/badge pop) animate instead of snapping. */
function syncMetroLineChipPressedState() {
  const selected = state.filters.subwayLineId;
  filtersEl.querySelectorAll('[data-subway-line]').forEach((btn) => {
    const lineId = Number(btn.getAttribute('data-subway-line'));
    btn.setAttribute('aria-pressed', lineId === selected ? 'true' : 'false');
  });
}

function resetAndLoad({ skipFiltersRender = false } = {}) {
  state.page = 0;
  state.totalPages = 1;
  state.items = [];
  state.reachedEnd = false;
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
    metaParts.push(`<span class="dotsep">${UyDosh.iconMetro(line)}${UyDosh.escapeHtml(metro)}</span>`);
  }
  if (Number.isFinite(rooms) && rooms > 0) {
    metaParts.push(`<span class="dotsep">${rooms} ${UyDosh.escapeHtml(UyDosh.t('card.rooms'))}</span>`);
  }
  const privateRoomHtml = listing.private_room
    ? `<div class="meta meta-private-room"><span>${UyDosh.iconLock()}${UyDosh.escapeHtml(UyDosh.t('card.privateRoom'))}</span></div>`
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
  const placeholderSrc = !photoSrc ? UyDosh.noPhotoPlaceholderImageUrl(listing) : '';
  const thumb = photoSrc
    ? `<div class="thumb"><img loading="lazy" decoding="async" src="${UyDosh.escapeHtml(photoSrc)}" alt="${title}" onerror="this.parentElement.classList.add('empty'); this.remove();" />${featured}${typeBadge}${photoDots}</div>`
    : placeholderSrc
      ? `<div class="thumb thumb-placeholder"><img loading="lazy" decoding="async" src="${UyDosh.escapeHtml(placeholderSrc)}" alt="${title}" />${featured}${typeBadge}</div>`
      : `<div class="thumb empty">${featured}${typeBadge}</div>`;

  return `
    <a class="card" href="${UyDosh.escapeHtml(UyDosh.listingPageUrl(listing.id))}">
      ${thumb}
      <div class="body">
        <div class="title-row">
          <div class="title">${title}</div>
          ${price ? `<div class="price">${price}<small>${UyDosh.escapeHtml(UyDosh.t('card.perMonth'))}</small></div>` : ''}
        </div>
        ${metaParts.length ? `<div class="meta">${metaParts.join('')}</div>` : ''}
        ${privateRoomHtml}
        ${amenityHtml}
      </div>
    </a>
  `;
}

function renderAll() {
  gridEl.innerHTML = state.items.map(listingCardHtml).join('');
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
  statusEl.innerHTML = `
    <div>${UyDosh.escapeHtml(UyDosh.t('feed.error'))}</div>
    <button class="btn" id="retry" type="button">${UyDosh.escapeHtml(UyDosh.t('feed.retry'))}</button>
  `;
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
      subwayLineId: subwayLineQueryParam(),
      createdWithinDays: createdWithinDaysQueryParam(),
    });
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
  } catch (err) {
    console.error('Failed to load listings', err);
    state.errored = true;
    if (state.page === 0) gridEl.innerHTML = '';
    showError();
  } finally {
    state.loading = false;
  }
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
  renderAll();
  if (state.reachedEnd && state.view === 'list') showEnd();
  if (state.view === 'map') {
    feedMap.onLangChange();
  } else if (state.selectedMapPins.length > 0) {
    feedMap.renderMapPinTooltip();
  }
  UyDosh.logMiniAppEvent('lang_changed', { language: UyDosh.getLang() });
});

gridEl.addEventListener('click', (event) => {
  if (!UyDosh.isMiniApp()) return;
  const card = event.target.closest('a.card');
  if (!card) return;
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
loadMore();
