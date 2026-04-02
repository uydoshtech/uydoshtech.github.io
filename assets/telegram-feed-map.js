// UyDosh — Telegram Mini App feed map view (listings on Yandex Map + pin tooltips).
// Loaded from telegram/index.html after uydosh-web.js.

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
      fabCreateEl = null,
    } = elements;

    let mapLoadGeneration = 0;

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

    async function loadFeedMap() {
      const generation = ++mapLoadGeneration;
      state.mapLoading = true;
      hideMapPinTooltip();
      setFeedMapStatus(UyDosh.t('map.loading'), true);
      const filterParams = getFilterParams();
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
        state.mapPins = pins;
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
            lang: UyDosh.getLang(),
            visitedListingIds: UyDosh.loadVisitedListingIds(),
            onPinClick: (pin) => {
              showMapPinTooltip(pin);
            },
            onMapClick: () => {
              hideMapPinTooltip();
            },
          }),
          MAP_LOAD_TIMEOUT_MS,
          'Map render timed out',
        );
        if (generation !== mapLoadGeneration) return;
        if (!map) {
          throw new Error('No mappable pins after coordinate validation');
        }

        state.mapLoaded = true;
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
      loadFeedMap();
    }

    function onLeaveMapView() {
      setFeedMapStatus('', false);
      hideMapPinTooltip();
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
    };
  }

  window.UyDoshTelegramFeedMap = {
    createFeedMapController,
    MAP_LOAD_TIMEOUT_MS,
  };
})();
