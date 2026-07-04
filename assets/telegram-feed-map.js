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
   * @param {HTMLElement|null} [options.elements.feedMapContactBannerEl]
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
      feedMapContactBannerEl = null,
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
    // Most recent resolved device position, used if the user later taps the
    // "share phone number" banner (see maybeShowContactBanner()).
    let lastKnownUserPosition = null;

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
      feedMapStatusEl.classList.remove('interactive');
      if (!visible || !message) {
        feedMapStatusEl.hidden = true;
        feedMapStatusEl.textContent = '';
        feedMapStatusEl.innerHTML = '';
        return;
      }
      feedMapStatusEl.hidden = false;
      feedMapStatusEl.textContent = message;
    }

    function showFeedMapError(onRetry) {
      if (!feedMapStatusEl) return;
      feedMapStatusEl.classList.add('interactive');
      feedMapStatusEl.hidden = false;
      feedMapStatusEl.innerHTML = `
        <div class="feed-map-status-inner">
          <div>${UyDosh.escapeHtml(UyDosh.t('map.error'))}</div>
          <button type="button" class="btn" data-map-retry>${UyDosh.escapeHtml(UyDosh.t('map.retry'))}</button>
        </div>
      `;
      feedMapStatusEl.querySelector('[data-map-retry]')?.addEventListener('click', () => {
        onHaptic();
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

    function selectedMapPinGroupIds() {
      return state.selectedMapPins
        .map((pin) => Number(pin?.id))
        .filter((id) => id > 0);
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
      onHaptic();
      hideLocateBanner();
      UyDosh.logMiniAppEvent('map_locate_banner_tap');
      state.mapModule?.locateUserFromTap(feedMapEl).then((position) => {
        if (position) handleUserLocationResolved(position);
      });
    });

    /**
     * Called whenever the map resolves a device position (silently on open, or via the
     * locate banner tap fallback) so a later "share phone number" tap has coordinates to
     * attach to. Also offers the contact-share banner, gated to at most once ever per
     * device (see requestTelegramContactShare/hasOfferedTelegramContactShare) — unlike
     * the locate banner, phone sharing requires an explicit native popup every time it's
     * triggered, so nagging a user who already declined would be poor UX.
     */
    function handleUserLocationResolved(position) {
      lastKnownUserPosition = position;
      maybeShowContactBanner();
    }

    function maybeShowContactBanner() {
      if (!feedMapContactBannerEl || UyDosh.hasOfferedTelegramContactShare()) return;
      feedMapContactBannerEl.hidden = false;
    }

    function hideContactBanner() {
      if (!feedMapContactBannerEl) return;
      feedMapContactBannerEl.hidden = true;
    }

    feedMapContactBannerEl?.addEventListener('click', async () => {
      onHaptic();
      hideContactBanner();
      UyDosh.markTelegramContactShareOffered();
      UyDosh.logMiniAppEvent('map_share_phone_banner_tap');
      const contactRaw = await UyDosh.requestTelegramContactShare();
      UyDosh.logMiniAppEvent(contactRaw ? 'map_share_phone_sent' : 'map_share_phone_cancelled');
      if (!contactRaw || !lastKnownUserPosition) return;
      UyDosh.reportTelegramMiniAppLocation(
        lastKnownUserPosition.latitude,
        lastKnownUserPosition.longitude,
        contactRaw,
      );
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
      syncMapCarouselUi({ scrollToIndex: scroll ? nextIndex : null });
    }

    function bindMapPinTooltipEvents() {
      for (const closeBtn of feedMapTooltipEl?.querySelectorAll('[data-map-tooltip-close]') || []) {
        closeBtn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          onHaptic();
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
      const listingsById = { ...state.mapTooltipListings };
      await Promise.all(pins.map(async (pin) => {
        const listingId = Number(pin?.id);
        if (listingId <= 0 || listingsById[listingId]) return;
        try {
          listingsById[listingId] = await UyDosh.fetchListing(listingId);
        } catch (err) {
          console.warn('Failed to enrich map pin tooltip', err);
        }
      }));
      if (requestId !== state.mapTooltipRequestId) return;
      if (state.selectedMapPins.length !== pins.length) return;
      state.mapTooltipListings = listingsById;
      renderMapPinTooltip();
    }

    async function showMapPinTooltip(pinOrPins) {
      const pins = normalizeMapPinSelection(pinOrPins);
      if (pins.length === 0) return;
      onHaptic();
      const primaryPin = pins[0];
      UyDosh.logMiniAppEvent('map_pin_tap', {
        listing_id: primaryPin.id,
        pin_count: pins.length,
      });
      for (const pin of pins) {
        UyDosh.markListingVisited(pin.id);
      }
      state.selectedMapPins = pins;
      state.selectedMapPinIndex = 0;
      refreshFeedMapPinIcons();
      const requestId = ++state.mapTooltipRequestId;
      renderMapPinTooltip();
      enrichMapPinTooltipListings(pins, requestId);
    }

    function currentMapSignature(filterParams) {
      return JSON.stringify({ filters: filterParams, lang: UyDosh.getLang() });
    }

    async function loadFeedMap() {
      const generation = ++mapLoadGeneration;
      state.mapLoading = true;
      hideMapPinTooltip();
      hideLocateBanner();
      setFeedMapStatus(UyDosh.t('map.loading'), true);
      const filterParams = getFilterParams();
      const signature = currentMapSignature(filterParams);
      try {
        await UyDosh.waitForElementLayout(feedMapEl);
        if (generation !== mapLoadGeneration) return;

        const data = await UyDosh.withTimeout(
          UyDosh.fetchListingsForMap({
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
        if (pins.length === 0) {
          await UyDosh.loadYandexMapModule().then((m) => m.destroyMap(feedMapEl)).catch(() => {});
          if (generation !== mapLoadGeneration) return;
          setFeedMapStatus(UyDosh.t('map.empty'), true);
          state.mapLoaded = false;
          return;
        }

        await UyDosh.waitForElementLayout(feedMapEl);
        if (generation !== mapLoadGeneration) return;

        const mapModule = await UyDosh.withTimeout(
          UyDosh.loadYandexMapModule(),
          MAP_LOAD_TIMEOUT_MS,
          'Map module load timed out',
        );
        if (generation !== mapLoadGeneration) return;
        state.mapModule = mapModule;

        setFeedMapStatus('', false);
        const map = await UyDosh.withTimeout(
          mapModule.renderPinsMap(feedMapEl, {
            pins,
            total: state.mapResultTotal,
            lang: UyDosh.getLang(),
            visitedListingIds: UyDosh.loadVisitedListingIds(),
            onPinClick: (pin) => {
              showMapPinTooltip(pin);
            },
            onMapClick: () => {
              hideMapPinTooltip();
            },
            onLocationUnavailable: showLocateBanner,
            onLocationResolved: handleUserLocationResolved,
          }),
          MAP_LOAD_TIMEOUT_MS,
          'Map render timed out',
        );
        if (generation !== mapLoadGeneration) return;
        if (!map) {
          throw new Error('No mappable pins after coordinate validation');
        }

        state.mapLoaded = true;
        lastLoadedMapSignature = signature;
        UyDosh.reflowActiveMaps();
        UyDosh.logMiniAppEvent('map_view_opened', {
          pin_count: pins.length,
          listing_type_id: state.filters.listingTypeId,
          gender: state.filters.gender,
          with_photo: state.filters.withPhoto ? 'true' : 'false',
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
        return;
      }
      loadFeedMap();
    }

    function onLeaveMapView() {
      setFeedMapStatus('', false);
      hideMapPinTooltip();
      hideLocateBanner();
      hideContactBanner();
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
