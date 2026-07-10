// UyDosh — Telegram Mini App feed map view (listings on Yandex Map + pin tooltips).
// Loaded from telegram/index.html after the uydosh-*.js modules.

(function () {
  const MAP_LOAD_TIMEOUT_MS = 18000;

  /**
   * @param {object} options
   * @param {typeof window.UyDosh} options.UyDosh
   * @param {object} options.elements
   * @param {HTMLElement|null} [options.elements.feedListPanel]
   * @param {HTMLElement|null} [options.elements.feedMapPanel]
   * @param {HTMLElement|null} [options.elements.feedMapEl]
   * @param {HTMLElement|null} [options.elements.feedMapTooltipEl]
   * @param {HTMLElement|null} [options.elements.feedMapStatusEl]
   * @param {HTMLElement|null} [options.elements.feedMapLocateBannerEl]
   * @param {HTMLElement|null} [options.elements.fabCreateEl]
   * @param {object} options.state Mutable feed state; map fields are owned by this controller.
   * @param {() => void} [options.onHaptic]
   * @param {() => object} options.getFilterParams Returns active listing filter query params.
   */
  function createFeedMapController({
    UyDosh,
    elements,
    state,
    onHaptic = () => {},
    getFilterParams,
  }) {
    const {
      feedListPanel = null,
      feedMapPanel = null,
      feedMapEl = null,
      feedMapTooltipEl = null,
      feedMapStatusEl = null,
      feedMapLocateBannerEl = null,
      fabCreateEl = null,
    } = elements;

    let mapLoadGeneration = 0;
    let panelHeightRaf = 0;
    // Signature (filters + lang) captured after the last successful `loadFeedMap()`
    // render. Lets `onEnterMapView()` tell whether anything actually changed since
    // the map was last shown, so switching List -> Map -> List -> Map without
    // touching filters reuses the existing map instance (preserving pan/zoom)
    // instead of tearing it down and re-fetching + rebuilding every time.
    let lastLoadedMapSignature = null;
    // Offered at most once per page session — see showLocateBanner() for why.
    let locateBannerOffered = false;
    // The metro-stations cycle / all-districts-boundaries toggle live only on the current
    // Yandex map instance (see yandex-map.js), and a filter change always tears that
    // instance down and builds a brand new one via loadFeedMap() below — without
    // remembering the user's choice here and re-applying it (see the `initial*`/`on*Change`
    // options passed to `renderPinsMap`), picking a filter while either layer was on would
    // silently reset it back off.
    let metroLayerMode = 'off';
    let districtLayerVisible = false;
    // In-flight/completed background prefetch (see `prefetchMap()`) keyed by
    // the same signature `loadFeedMap()` uses, so a matching prefetch can be
    // reused instead of re-fetching when the user actually opens the tab.
    let prefetchedMapSignature = null;
    let prefetchedMapDataPromise = null;

    /**
     * The map panel's CSS `height` is a `calc(100dvh - ... - <fixed px>)` guess
     * (see telegram-shared.css) that assumes a constant header/filters/tabs
     * height above it. That assumption breaks whenever the filters ribbon is
     * expanded (extra chip rows), the header wraps, or the platform's dvh
     * doesn't match the real visible viewport — the panel (and the pin
     * tooltip anchored to its bottom) then extends past the actual bottom of
     * the screen. Measure the real remaining space instead and pin the panel
     * height to it, so the map — and anything anchored to its bottom edge —
     * always stays within the visible viewport.
     */
    function syncFeedMapPanelHeight() {
      if (!feedMapPanel || !feedMapPanel.classList.contains('active')) return;
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return;
      const top = feedMapPanel.getBoundingClientRect().top;
      if (!Number.isFinite(top)) return;
      const insetBottom = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--uydosh-tg-inset-bottom'),
      ) || 0;
      const bottomGap = Math.max(16, insetBottom + 12);
      const available = viewportHeight - top - bottomGap;
      if (!Number.isFinite(available) || available <= 0) return;
      feedMapPanel.style.height = `${available}px`;
    }

    function scheduleSyncFeedMapPanelHeight() {
      if (panelHeightRaf) cancelAnimationFrame(panelHeightRaf);
      panelHeightRaf = requestAnimationFrame(() => {
        panelHeightRaf = 0;
        syncFeedMapPanelHeight();
      });
    }

    window.addEventListener('resize', scheduleSyncFeedMapPanelHeight, { passive: true });
    window.visualViewport?.addEventListener('resize', scheduleSyncFeedMapPanelHeight, { passive: true });

    function setFeedMapStatus(message, visible = true) {
      if (!feedMapStatusEl) return;
      feedMapStatusEl.classList.remove('interactive', 'map-empty');
      feedMapStatusEl.removeAttribute('aria-label');
      if (!visible || !message) {
        feedMapStatusEl.hidden = true;
        feedMapStatusEl.textContent = '';
        feedMapStatusEl.innerHTML = '';
        return;
      }
      feedMapStatusEl.hidden = false;
      feedMapStatusEl.textContent = message;
    }

    // Branded spinning "U" logo (same `.loading-spinner`/`uydosh-spin` used by the
    // account/profile/create pages' own full-panel loaders — see telegram-shared.css)
    // instead of a plain "Загрузка карты…" text line, so the map's loading state reads
    // as an on-brand UyDosh spinner rather than bare copy.
    function showFeedMapLoading() {
      if (!feedMapStatusEl) return;
      feedMapStatusEl.classList.remove('interactive', 'map-empty');
      feedMapStatusEl.hidden = false;
      feedMapStatusEl.innerHTML = `<span class="loading-spinner map-loading-spinner" aria-hidden="true"></span>`;
      feedMapStatusEl.setAttribute('aria-label', UyDosh.t('map.loading'));
    }

    // Anchored near the top of the panel (via the `map-empty` class) rather than the
    // dead-center default, since centering it puts the message/icon right on top of
    // the map's own center pin/marker.
    function showFeedMapEmpty() {
      if (!feedMapStatusEl) return;
      feedMapStatusEl.classList.remove('interactive');
      feedMapStatusEl.classList.add('map-empty');
      feedMapStatusEl.removeAttribute('aria-label');
      feedMapStatusEl.hidden = false;
      feedMapStatusEl.innerHTML = UyDosh.mapEmptyStateHtml();
    }

    function showFeedMapError(onRetry) {
      if (!feedMapStatusEl) return;
      feedMapStatusEl.classList.add('interactive');
      feedMapStatusEl.classList.remove('map-empty');
      feedMapStatusEl.removeAttribute('aria-label');
      feedMapStatusEl.hidden = false;
      feedMapStatusEl.innerHTML = `
        <div class="feed-map-status-inner">
          <div>${UyDosh.escapeHtml(UyDosh.t('map.error'))}</div>
          <button type="button" class="btn" data-map-retry>${UyDosh.escapeHtml(UyDosh.t('map.retry'))}</button>
        </div>
      `;
      feedMapStatusEl.querySelector('[data-map-retry]')?.addEventListener('click', () => {
        onRetry();
      });
    }

    function retryFeedMap({ hardReset = true } = {}) {
      state.mapLoaded = false;
      if (hardReset) {
        UyDosh.resetYandexMaps({ hard: true });
        if (feedMapEl) feedMapEl.innerHTML = '';
      }
      loadFeedMap();
    }

    function applyViewLayout(isMap) {
      feedListPanel?.classList.toggle('hidden', isMap);
      feedMapPanel?.classList.toggle('active', isMap);
      document.body.classList.toggle('view-map', isMap);
      if (fabCreateEl) fabCreateEl.hidden = isMap;
      if (isMap) scheduleSyncFeedMapPanelHeight();
    }

    function normalizeMapPinSelection(pinOrPins) {
      const pins = Array.isArray(pinOrPins) ? pinOrPins.filter(Boolean) : (pinOrPins ? [pinOrPins] : []);
      return pins;
    }

    // Number of neighboring carousel cards (each side) to eagerly fetch full
    // listing details for, so cards feel enriched a beat before the user
    // swipes onto them without fetching all (up to 300) map listings at once.
    const MAP_CAROUSEL_ENRICH_WINDOW = 2;

    // Reverse index of "which other listing ids share this listing's
    // coordinates" (coordinate groups = composite/stacked pins) — rebuilt
    // whenever the map pins change. Used purely to highlight a tapped pin's
    // whole composite group on the map (see selectedMapPinGroupIds below);
    // deliberately built from *every* fetched pin regardless of viewport,
    // since a pin's group membership doesn't depend on what's currently on
    // screen.
    let mapCarouselGroupIdsByListingId = new Map();

    function rebuildMapCarouselIndex() {
      const validPins = (state.mapPins || []).filter((pin) => {
        const lat = Number(pin?.latitude);
        const lon = Number(pin?.longitude);
        return Number.isFinite(lat) && Number.isFinite(lon);
      });
      const groupIdsByListingId = new Map();
      for (const group of UyDosh.groupPinsByCoordinate(validPins)) {
        const ids = group.pins.map((pin) => Number(pin.id)).filter((id) => id > 0);
        for (const pin of group.pins) {
          groupIdsByListingId.set(Number(pin.id), ids);
        }
      }
      mapCarouselGroupIdsByListingId = groupIdsByListingId;
    }

    /**
     * Flat, ordered view of only the listings currently within the map's
     * visible viewport (coordinate groups kept adjacent) — computed fresh
     * each time a pin is tapped (see showMapPinTooltip) rather than cached,
     * since which pins are "visible" changes as the user pans/zooms. This is
     * what the tooltip carousel pages through: on-screen listings only, not
     * every fetched pin regardless of whether it's actually in view.
     */
    function visibleMapCarouselOrder() {
      if (!state.mapModule || !feedMapEl) return [];
      const visiblePins = state.mapModule.getVisiblePins(feedMapEl, state.mapPins || []);
      const order = [];
      for (const group of UyDosh.groupPinsByCoordinate(visiblePins)) {
        order.push(...group.pins);
      }
      return order;
    }

    function pinsToEnrichAround(pins, index) {
      if (pins.length === 0) return [];
      const start = Math.max(0, index - MAP_CAROUSEL_ENRICH_WINDOW);
      const end = Math.min(pins.length, index + MAP_CAROUSEL_ENRICH_WINDOW + 1);
      return pins.slice(start, end);
    }

    function selectedMapPinGroupIds() {
      const listingId = Number(currentSelectedMapPin()?.id);
      if (listingId <= 0) return [];
      return mapCarouselGroupIdsByListingId.get(listingId) || [listingId];
    }

    function currentSelectedMapPin() {
      return state.selectedMapPins[state.selectedMapPinIndex] ?? state.selectedMapPins[0] ?? null;
    }

    /**
     * Shown at most once per page session when the silent auto-locate attempt
     * (autoRequestUserLocation in yandex-map.js) comes back empty — several Telegram
     * clients only reliably prompt for location permission (or recover from a prior
     * denial via openSettings()) when triggered by a genuine tap. The pre-existing
     * native geolocation control on the map remains available as a permanent retry
     * path, so it's safe to only nudge with this banner once rather than nagging on
     * every map open.
     */
    function showLocateBanner() {
      if (!feedMapLocateBannerEl || locateBannerOffered) return;
      locateBannerOffered = true;
      feedMapLocateBannerEl.hidden = false;
    }

    function hideLocateBanner() {
      if (!feedMapLocateBannerEl) return;
      feedMapLocateBannerEl.hidden = true;
    }

    feedMapLocateBannerEl?.addEventListener('click', () => {
      hideLocateBanner();
      UyDosh.logMiniAppEvent('map_locate_banner_tap');
      state.mapModule?.locateUserFromTap(feedMapEl).then((position) => {
        if (position) handleUserLocationResolved(position);
      });
    });

    function hideMapPinTooltip() {
      state.selectedMapPins = [];
      state.selectedMapPinIndex = 0;
      state.mapTooltipListings = {};
      if (!feedMapTooltipEl) return;
      feedMapTooltipEl.hidden = true;
      feedMapTooltipEl.innerHTML = '';
      refreshFeedMapPinIcons();
    }

    function refreshFeedMapPinIcons() {
      if (!state.mapModule || !feedMapEl || !state.mapLoaded) return;
      const activePin = currentSelectedMapPin();
      state.mapModule.refreshMapPinStates(feedMapEl, {
        selectedListingId: activePin?.id ?? null,
        selectedListingGroupIds: selectedMapPinGroupIds(),
        visitedListingIds: UyDosh.loadVisitedListingIds(),
      });
    }

    function syncMapCarouselUi({ scrollToIndex = null } = {}) {
      const track = feedMapTooltipEl?.querySelector('[data-map-carousel-track]');
      if (!track) return;
      const slides = [...track.querySelectorAll('.map-pin-carousel-slide')];
      if (slides.length === 0) return;

      const index = scrollToIndex != null
        ? Math.max(0, Math.min(scrollToIndex, slides.length - 1))
        : state.selectedMapPinIndex;
      const slideWidth = slides[0].offsetWidth + 10;
      if (scrollToIndex != null) {
        track.scrollTo({ left: slideWidth * index, behavior: 'auto' });
      }

      for (const dot of feedMapTooltipEl.querySelectorAll('[data-carousel-dot]')) {
        const dotIndex = Number(dot.getAttribute('data-carousel-dot'));
        dot.setAttribute('aria-current', dotIndex === index ? 'true' : 'false');
      }
      // No counter text to patch here above the dot limit — each slide
      // already carries its own correct "N / total" pill baked in at
      // render time (see `mapPinCarouselHtml`), so it's already right by
      // the time this slide scrolls into view.
      for (const [slideIndex, slide] of slides.entries()) {
        slide.setAttribute('aria-hidden', slideIndex === index ? 'false' : 'true');
      }
    }

    function setMapCarouselIndex(index, { scroll = true } = {}) {
      if (state.selectedMapPins.length === 0) return;
      const nextIndex = Math.max(0, Math.min(index, state.selectedMapPins.length - 1));
      state.selectedMapPinIndex = nextIndex;
      const pin = currentSelectedMapPin();
      if (pin) {
        UyDosh.markListingVisited(pin.id);
      }
      refreshFeedMapPinIcons();
      // Only recenters the map when the new card's pin has scrolled off the
      // visible viewport, so swiping within on-screen pins never yanks the map.
      state.mapModule?.panToPinIfNeeded?.(feedMapEl, pin);
      syncMapCarouselUi({ scrollToIndex: scroll ? nextIndex : null });
      enrichMapPinTooltipListings(pinsToEnrichAround(state.selectedMapPins, nextIndex), state.mapTooltipRequestId);
    }

    function bindMapPinTooltipEvents() {
      for (const closeBtn of feedMapTooltipEl?.querySelectorAll('[data-map-tooltip-close]') || []) {
        closeBtn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          hideMapPinTooltip();
        });
      }
      for (const link of feedMapTooltipEl?.querySelectorAll('[data-map-tooltip-open]') || []) {
        link.addEventListener('click', () => {
          const listingId = Number(link.getAttribute('data-listing-id'));
          if (listingId > 0) {
            UyDosh.logMiniAppEvent('map_tooltip_open_listing', { listing_id: listingId });
          }
        });
      }
      const track = feedMapTooltipEl?.querySelector('[data-map-carousel-track]');
      if (track) {
        let scrollTimer = 0;
        track.addEventListener('scroll', () => {
          clearTimeout(scrollTimer);
          scrollTimer = setTimeout(() => {
            const slides = [...track.querySelectorAll('.map-pin-carousel-slide')];
            if (slides.length <= 1) return;
            const slideWidth = slides[0].offsetWidth + 10;
            const index = Math.round(track.scrollLeft / Math.max(slideWidth, 1));
            if (index !== state.selectedMapPinIndex) {
              setMapCarouselIndex(index, { scroll: false });
            } else {
              syncMapCarouselUi();
            }
          }, 80);
        }, { passive: true });
      }
    }

    function renderMapPinTooltip() {
      if (!feedMapTooltipEl || state.selectedMapPins.length === 0) return;
      feedMapTooltipEl.innerHTML = UyDosh.mapPinCarouselHtml(state.selectedMapPins, {
        listingsById: state.mapTooltipListings,
        lang: UyDosh.getLang(),
        activeIndex: state.selectedMapPinIndex,
      });
      feedMapTooltipEl.hidden = false;
      bindMapPinTooltipEvents();
      requestAnimationFrame(() => syncMapCarouselUi({ scrollToIndex: state.selectedMapPinIndex }));
    }

    async function enrichMapPinTooltipListings(pins, requestId) {
      const pending = pins.filter((pin) => {
        const listingId = Number(pin?.id);
        return listingId > 0 && !state.mapTooltipListings[listingId];
      });
      if (pending.length === 0) return;
      const listingsById = { ...state.mapTooltipListings };
      const currentId = Number(currentSelectedMapPin()?.id);
      let currentEnriched = false;
      await Promise.all(pending.map(async (pin) => {
        const listingId = Number(pin.id);
        try {
          listingsById[listingId] = await UyDosh.fetchListing(listingId);
          if (listingId === currentId) currentEnriched = true;
        } catch (err) {
          console.warn('Failed to enrich map pin tooltip', err);
        }
      }));
      if (requestId !== state.mapTooltipRequestId || state.selectedMapPins.length === 0) return;
      state.mapTooltipListings = listingsById;
      // Cards render fine from raw pin fields alone (title/price/photo), so
      // only force a re-render when the *currently visible* card just got its
      // enrichment data — re-rendering for off-screen prefetches would rebuild
      // the whole carousel DOM and could interrupt an in-progress swipe.
      if (currentEnriched) renderMapPinTooltip();
    }

    async function showMapPinTooltip(pinOrPins) {
      const tappedPins = normalizeMapPinSelection(pinOrPins);
      if (tappedPins.length === 0) return;
      onHaptic();
      const primaryPin = tappedPins[0];
      UyDosh.logMiniAppEvent('map_pin_tap', {
        listing_id: primaryPin.id,
        pin_count: tappedPins.length,
      });
      for (const pin of tappedPins) {
        UyDosh.markListingVisited(pin.id);
      }
      // The carousel sources from listings currently visible within the
      // map's viewport (falling back to just the tapped pin(s) if that
      // somehow comes back empty), so swiping right from any pin pages
      // through what's actually on screen right now instead of every
      // fetched listing — including ones far off-screen — regardless of the
      // tapped pin's own composite group.
      const visiblePins = visibleMapCarouselOrder();
      const carouselPins = visiblePins.length > 0 ? visiblePins : tappedPins;
      const startIndex = Math.max(0, carouselPins.findIndex(
        (pin) => Number(pin.id) === Number(primaryPin.id),
      ));
      state.selectedMapPins = carouselPins;
      state.selectedMapPinIndex = startIndex;
      refreshFeedMapPinIcons();
      const requestId = ++state.mapTooltipRequestId;
      renderMapPinTooltip();
      enrichMapPinTooltipListings(pinsToEnrichAround(carouselPins, startIndex), requestId);
    }

    function currentMapSignature(filterParams) {
      return JSON.stringify({ filters: filterParams, lang: UyDosh.getLang() });
    }

    /**
     * Warms up the map's pins fetch + Yandex module script in the background
     * — without touching the (still `display:none`) map panel's DOM — so the
     * first-ever switch to Map view doesn't have to wait on a cold fetch and
     * a first-time SDK script download before `loadFeedMap()` can even start
     * rendering. Meant to be called once the feed's own first list page has
     * loaded (see telegram-feed.js), so it doesn't compete with that request
     * for bandwidth on a slow connection. Safe to call repeatedly/on every
     * filter change — no-ops if a matching prefetch is already in flight or
     * done for the current filters+language.
     */
    function prefetchMap() {
      if (state.mapLoading) return;
      const signature = currentMapSignature(getFilterParams());
      // Already showing a live, up-to-date map for these exact filters+lang
      // (e.g. the user visited Map, came back to List without changing
      // anything, and their first list page just reloaded) — nothing to warm.
      if (state.mapLoaded && lastLoadedMapSignature === signature) return;
      if (prefetchedMapSignature === signature) return;
      prefetchedMapSignature = signature;
      UyDosh.loadYandexMapModule().catch(() => { /* loadFeedMap() will retry + surface this */ });
      const fetchPromise = UyDosh.fetchListingsForMap({
        page: 1,
        limit: 300,
        ...getFilterParams(),
      });
      prefetchedMapDataPromise = fetchPromise;
      // Separate (unchained) handler purely so a rejection here doesn't log as
      // an unhandled promise rejection if `loadFeedMap()` never ends up
      // reusing `fetchPromise` (e.g. filters changed before the tab was
      // opened) — `fetchPromise` itself, stored above, is what `loadFeedMap()`
      // actually awaits and reacts to (its own try/catch shows the retry UI)
      // if it's still the current prefetch by the time that runs.
      fetchPromise.catch(() => {
        if (prefetchedMapSignature === signature) {
          prefetchedMapSignature = null;
          prefetchedMapDataPromise = null;
        }
      });
    }

    async function loadFeedMap() {
      const generation = ++mapLoadGeneration;
      state.mapLoading = true;
      hideMapPinTooltip();
      hideLocateBanner();
      showFeedMapLoading();
      const filterParams = getFilterParams();
      const signature = currentMapSignature(filterParams);
      // Fire-and-forget, in parallel with the pins fetch below — by the time the user taps a
      // pin, the district/subway-station name lookups are (usually) already cached, so the
      // tooltip's location/metro line can render immediately instead of waiting on that pin's
      // own full listing detail fetch (see showMapPinTooltip -> enrichMapPinTooltipListings).
      UyDosh.warmLocationSubwayCaches(UyDosh.getLang());
      // Reuse a matching background prefetch (see `prefetchMap()`) instead of
      // starting a fresh fetch — the common "first tap on Map view" case,
      // since telegram-feed.js fires that prefetch right after the list's
      // own first page loads.
      const reusablePinsPromise = prefetchedMapSignature === signature ? prefetchedMapDataPromise : null;
      prefetchedMapSignature = null;
      prefetchedMapDataPromise = null;
      try {
        await UyDosh.waitForElementLayout(feedMapEl);
        if (generation !== mapLoadGeneration) return;

        const data = await UyDosh.withTimeout(
          reusablePinsPromise || UyDosh.fetchListingsForMap({
            page: 1,
            limit: 300,
            ...filterParams,
          }),
          MAP_LOAD_TIMEOUT_MS,
          'Map listings fetch timed out',
        );
        if (generation !== mapLoadGeneration) return;

        const pins = Array.isArray(data?.pins) ? data.pins : [];
        const total = Number(data?.total);
        state.mapPins = pins;
        state.mapResultTotal = Number.isFinite(total) ? total : pins.length;
        rebuildMapCarouselIndex();
        if (generation !== mapLoadGeneration) return;

        await UyDosh.waitForElementLayout(feedMapEl);
        if (generation !== mapLoadGeneration) return;

        const mapModule = await UyDosh.withTimeout(
          UyDosh.loadYandexMapModule(),
          MAP_LOAD_TIMEOUT_MS,
          'Map module load timed out',
        );
        if (generation !== mapLoadGeneration) return;
        state.mapModule = mapModule;

        // Cleared even for the empty-results case below (which then re-shows it via
        // showFeedMapEmpty()) — `renderPinsMap` still builds a real, pannable map with
        // zero pins/placemarks (Tashkent-centered by default) rather than tearing it
        // down, so the "no results" message ends up as an overlay on top of a live map
        // instead of replacing it — keeping the map always loaded and available across
        // List <-> Map switches and filter changes, empty results included.
        setFeedMapStatus('', false);
        const map = await UyDosh.withTimeout(
          mapModule.renderPinsMap(feedMapEl, {
            pins,
            total: state.mapResultTotal,
            lang: UyDosh.getLang(),
            visitedListingIds: UyDosh.loadVisitedListingIds(),
            highlightedLocationId: filterParams.locationId ?? null,
            initialMetroLayerMode: metroLayerMode,
            initialDistrictLayerVisible: districtLayerVisible,
            onMetroLayerModeChange: (mode) => {
              metroLayerMode = mode;
            },
            onDistrictLayerVisibleChange: (visible) => {
              districtLayerVisible = visible;
            },
            onPinClick: (pin) => {
              showMapPinTooltip(pin);
            },
            onMapClick: () => {
              hideMapPinTooltip();
            },
            onLocationUnavailable: showLocateBanner,
            // The authoritative staleness check (see the matching `isStale` comment on
            // `renderPinsMap` in yandex-map.js): an older call can still *arrive* at
            // renderPinsMap after a newer one (e.g. this filter's own listings fetch just
            // happened to take longer than a later click's), so relying only on internal
            // call-arrival order there isn't enough — this ties it back to the true,
            // click-order generation counter instead.
            isStale: () => generation !== mapLoadGeneration,
          }),
          MAP_LOAD_TIMEOUT_MS,
          'Map render timed out',
        );
        if (generation !== mapLoadGeneration) return;
        if (!map) {
          // Listings came back but every single one failed coordinate validation — a
          // real data problem (see renderPinsMap), unlike the plain "no results for
          // these filters" case above, which always gets a real map back.
          throw new Error('No mappable pins after coordinate validation');
        }

        if (pins.length === 0) {
          showFeedMapEmpty();
          // Shares `emptyResultHapticFired` with the list view (see `showEnd` in
          // telegram-feed.js) so switching List <-> Map for the same empty filter
          // set only buzzes once, not again every time the other view also
          // discovers zero results.
          if (!state.emptyResultHapticFired) {
            state.emptyResultHapticFired = true;
            UyDosh.haptic.notFound();
          }
        }
        state.mapLoaded = true;
        lastLoadedMapSignature = signature;
        UyDosh.reflowActiveMaps();
        UyDosh.logMiniAppEvent('map_view_opened', {
          pin_count: pins.length,
          listing_type_id: state.filters.listingTypeId,
          gender: state.filters.gender,
          with_photo: state.filters.withPhoto ? 'true' : 'false',
          has_3d_tour: state.filters.has3dTour ? 'true' : 'false',
          subway_line_id: state.filters.subwayLineId,
        });
      } catch (err) {
        if (generation !== mapLoadGeneration) return;
        console.error('Failed to load feed map', err);
        showFeedMapError(() => retryFeedMap({ hardReset: true }));
        state.mapLoaded = false;
      } finally {
        if (generation === mapLoadGeneration) {
          state.mapLoading = false;
        }
      }
    }

    function onEnterMapView() {
      // Filters and language are unchanged since the last successful render —
      // reuse the still-live map instance instead of destroying and rebuilding
      // it (and re-fetching pins) on every List <-> Map tab switch. A real
      // filter change still forces a reload via the filter click handlers,
      // which call `loadFeedMap()` directly; a language change forces one via
      // `onLangChange()`. This only short-circuits the redundant "nothing
      // changed, user just tapped back to the tab" case.
      if (state.mapLoaded && lastLoadedMapSignature === currentMapSignature(getFilterParams())) {
        // Cheaply re-apply "visited" pin styling in case a listing was opened
        // (e.g. from the list view or a previous map tooltip) since this map
        // instance was last shown — a full reload would've picked this up via
        // a fresh loadVisitedListingIds() call, so this keeps that behavior.
        refreshFeedMapPinIcons();
        UyDosh.reflowActiveMaps();
        // onLeaveMapView() unconditionally clears the status overlay, so the "no
        // results" message needs re-showing here too — the underlying map itself
        // stays live/rendered either way (see loadFeedMap), only this text overlay
        // was hidden.
        if ((state.mapPins || []).length === 0) showFeedMapEmpty();
        return;
      }
      loadFeedMap();
    }

    function onLeaveMapView() {
      setFeedMapStatus('', false);
      hideMapPinTooltip();
      hideLocateBanner();
    }

    function onLangChange() {
      state.mapLoaded = false;
      hideMapPinTooltip();
      loadFeedMap();
    }

    return {
      MAP_LOAD_TIMEOUT_MS,
      applyViewLayout,
      loadFeedMap,
      prefetchMap,
      retryFeedMap,
      hideMapPinTooltip,
      renderMapPinTooltip,
      onEnterMapView,
      onLeaveMapView,
      onLangChange,
      syncFeedMapPanelHeight,
      scheduleSyncFeedMapPanelHeight,
    };
  }

  window.UyDoshTelegramFeedMap = {
    createFeedMapController,
    MAP_LOAD_TIMEOUT_MS,
  };
})();
