// UyDosh — lazy-loaded Yandex Maps JS API 2.1 for the web / Telegram Mini App.
// Loaded on demand from listing detail and feed map views only.

(function () {
  const TASHKENT_BOUNDS = {
    minLatitude: 41.15,
    maxLatitude: 41.42,
    minLongitude: 69.05,
    maxLongitude: 69.45,
  };

  /** Yandex Maps JavaScript API key (HTTP Referer: uydoshtech.github.io). */
  const COMPILE_TIME_WEB_MAPS_API_KEY = '70aaf6ac-5a4b-4a69-a5a5-c16536483324';

  const YMAPS_READY_TIMEOUT_MS = 15000;
  let scriptPromise = null;
  const activeMaps = new WeakMap();
  const trackedContainers = new Set();

  function numberOrNull(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function isValidCoordinate(latitude, longitude) {
    return (
      latitude >= TASHKENT_BOUNDS.minLatitude &&
      latitude <= TASHKENT_BOUNDS.maxLatitude &&
      longitude >= TASHKENT_BOUNDS.minLongitude &&
      longitude <= TASHKENT_BOUNDS.maxLongitude
    );
  }

  /** Mirror backend resolveListingMapCoordinates (address → metro → district). */
  function resolveListingMapCoordinates(listing) {
    if (!listing) return null;
    const candidates = [
      {
        source: 'address',
        latitude: listing.address_latitude,
        longitude: listing.address_longitude,
      },
      {
        source: 'subway_station',
        latitude: listing.subway_station?.latitude,
        longitude: listing.subway_station?.longitude,
      },
      {
        source: 'location',
        latitude: listing.location?.latitude,
        longitude: listing.location?.longitude,
      },
    ];
    for (const candidate of candidates) {
      const latitude = numberOrNull(candidate.latitude);
      const longitude = numberOrNull(candidate.longitude);
      if (
        latitude !== null &&
        longitude !== null &&
        isValidCoordinate(latitude, longitude)
      ) {
        return { latitude, longitude, source: candidate.source };
      }
    }
    return null;
  }

  function yandexMapsLang(lang) {
    const code = (lang || 'ru').slice(0, 2);
    if (code === 'uz') return 'uz_UZ';
    if (code === 'en') return 'en_US';
    return 'ru_RU';
  }

  function readMetaApiKey() {
    const meta = document.querySelector('meta[name="uydosh-yandex-maps-key"]');
    const value = meta?.content?.trim();
    return value || '';
  }

  async function fetchApiKeyFromBackend() {
    try {
      const apiBase = window.UyDosh?.API_BASE || 'https://api.uydosh.com';
      const res = await fetch(`${apiBase.replace(/\/$/, '')}/app/web-maps-config`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return '';
      const data = await res.json();
      return String(data?.yandexMapsApiKey ?? '').trim();
    } catch (err) {
      console.warn('[UyDoshMap] Backend key fetch failed', err);
      return '';
    }
  }

  async function getApiKey() {
    try {
      const qs = new URLSearchParams(location.search);
      const fromQuery = qs.get('ymapkey');
      if (fromQuery && fromQuery.trim()) {
        const clean = fromQuery.trim();
        try { localStorage.setItem('uydosh_yandex_maps_key', clean); } catch { /* ignore */ }
        return clean;
      }
    } catch { /* ignore */ }

    try {
      const saved = localStorage.getItem('uydosh_yandex_maps_key');
      if (saved && saved.trim()) return saved.trim();
    } catch { /* ignore */ }

    const metaKey = readMetaApiKey();
    if (metaKey) return metaKey;

    const backendKey = await fetchApiKeyFromBackend();
    if (backendKey) return backendKey;

    return COMPILE_TIME_WEB_MAPS_API_KEY;
  }

  function waitForYmapsReady(timeoutMs = YMAPS_READY_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
      if (!window.ymaps?.ready) {
        reject(new Error('Yandex Maps API did not initialize'));
        return;
      }
      const timer = setTimeout(() => {
        reject(new Error('Yandex Maps API ready timed out'));
      }, timeoutMs);
      window.ymaps.ready(
        () => {
          clearTimeout(timer);
          resolve(window.ymaps);
        },
        (err) => {
          clearTimeout(timer);
          reject(err || new Error('Yandex Maps API ready failed'));
        },
      );
    });
  }

  function resetYandexMapsLoader() {
    scriptPromise = null;
    clusterListingCountLayout = null;
    for (const script of document.querySelectorAll('script[data-uydosh-yandex-maps]')) {
      script.remove();
    }
    try {
      delete window.ymaps;
    } catch {
      window.ymaps = undefined;
    }
  }

  function scheduleMapReflow(container) {
    requestAnimationFrame(() => {
      reflowMap(container);
      requestAnimationFrame(() => reflowMap(container));
    });
  }

  function reflowMap(container) {
    const instance = activeMaps.get(container);
    if (!instance?.map?.container?.fitToViewport) return;
    try {
      instance.map.container.fitToViewport();
    } catch { /* ignore */ }
  }

  function reflowAllMaps() {
    for (const container of trackedContainers) {
      reflowMap(container);
    }
  }

  async function loadYandexScript(lang) {
    if (window.ymaps?.Map) {
      await waitForYmapsReady();
      return window.ymaps;
    }
    if (scriptPromise) return scriptPromise;

    scriptPromise = (async () => {
      try {
        const apiKey = await getApiKey();
        if (!apiKey) {
          throw new Error('Yandex Maps API key is not configured');
        }
        const mapLang = yandexMapsLang(lang);
        await new Promise((resolve, reject) => {
          const existing = document.querySelector('script[data-uydosh-yandex-maps]');
          if (existing) {
            if (window.ymaps?.Map) {
              waitForYmapsReady().then(resolve).catch(reject);
              return;
            }
            if (existing.dataset.uydoshYandexMapsFailed === '1') {
              reject(new Error('Yandex Maps script failed to load'));
              return;
            }
            if (existing.readyState === 'complete' || existing.readyState === 'loaded') {
              reject(new Error('Yandex Maps API did not initialize'));
              return;
            }
            existing.addEventListener('load', () => {
              waitForYmapsReady().then(resolve).catch(reject);
            }, { once: true });
            existing.addEventListener('error', () => {
              existing.dataset.uydoshYandexMapsFailed = '1';
              reject(new Error('Yandex Maps script failed to load'));
            }, { once: true });
            return;
          }
          const script = document.createElement('script');
          script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=${encodeURIComponent(mapLang)}`;
          script.async = true;
          script.dataset.uydoshYandexMaps = '1';
          script.addEventListener('load', () => {
            waitForYmapsReady().then(resolve).catch(reject);
          }, { once: true });
          script.addEventListener('error', () => {
            script.dataset.uydoshYandexMapsFailed = '1';
            reject(new Error('Yandex Maps script failed to load'));
          }, { once: true });
          document.head.appendChild(script);
        });
        return window.ymaps;
      } catch (err) {
        scriptPromise = null;
        throw err;
      }
    })();

    return scriptPromise;
  }

  function yandexMapsOpenUrl(latitude, longitude) {
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return 'https://yandex.com/maps/';
    return `https://yandex.com/maps/?pt=${lon},${lat}&z=17&l=map`;
  }

  function estimateZoom(minLat, maxLat, minLon, maxLon) {
    const span = Math.max(maxLat - minLat, maxLon - minLon, 0.008);
    if (span > 0.28) return 10;
    if (span > 0.16) return 11;
    if (span > 0.09) return 12;
    if (span > 0.05) return 13;
    if (span > 0.025) return 14;
    return 15;
  }

  /** API 2.1 center is [latitude, longitude]. */
  function locationFromPins(pins) {
    if (!pins.length) {
      return { center: [41.2995, 69.2401], zoom: 11 };
    }
    if (pins.length === 1) {
      return {
        center: [pins[0].latitude, pins[0].longitude],
        zoom: 15,
      };
    }
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLon = Infinity;
    let maxLon = -Infinity;
    for (const pin of pins) {
      minLat = Math.min(minLat, pin.latitude);
      maxLat = Math.max(maxLat, pin.latitude);
      minLon = Math.min(minLon, pin.longitude);
      maxLon = Math.max(maxLon, pin.longitude);
    }
    return {
      center: [(minLat + maxLat) / 2, (minLon + maxLon) / 2],
      zoom: estimateZoom(minLat, maxLat, minLon, maxLon),
    };
  }

  /** Static Tashkent district boundary polygons (generated from the mobile app's dataset). */
  const DISTRICT_BOUNDARIES_PATH = '/assets/data/tashkent-districts.json';
  let districtBoundariesPromise = null;

  function loadDistrictBoundaries() {
    if (districtBoundariesPromise) return districtBoundariesPromise;
    districtBoundariesPromise = fetch(DISTRICT_BOUNDARIES_PATH, { headers: { Accept: 'application/json' } })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => (Array.isArray(data?.districts) ? data.districts : []))
      .catch((err) => {
        districtBoundariesPromise = null;
        throw err;
      });
    return districtBoundariesPromise;
  }

  /** Matches the mobile app's `_districtLayerColor` palette (yandex_map_widget_map_objects.dart). */
  const DISTRICT_LAYER_COLORS = [
    '#E53935', '#8E24AA', '#3949AB', '#1E88E5', '#00ACC1', '#43A047',
    '#7CB342', '#FDD835', '#FFB300', '#FB8C00', '#6D4C41', '#546E7A',
  ];

  function districtLayerColor(locationId) {
    const idx = Math.abs(Number(locationId) - 1) % DISTRICT_LAYER_COLORS.length;
    return DISTRICT_LAYER_COLORS[idx];
  }

  function districtLocalizedName(district, lang) {
    if (lang === 'uz') return district.nameUz || district.nameRu || district.nameEn || '';
    if (lang === 'en') return district.nameEn || district.nameRu || district.nameUz || '';
    return district.nameRu || district.nameUz || district.nameEn || '';
  }

  function hexWithAlpha(hex, alpha) {
    const clean = String(hex || '#000000').replace('#', '');
    const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255).toString(16).padStart(2, '0');
    return `#${clean}${a}`;
  }

  /** Signed-area centroid of a simple polygon ring; falls back to the point average when degenerate. */
  function ringCentroid(ring) {
    if (!Array.isArray(ring) || ring.length === 0) return null;
    let area = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < ring.length; i++) {
      const [x0, y0] = ring[i];
      const [x1, y1] = ring[(i + 1) % ring.length];
      const cross = x0 * y1 - x1 * y0;
      area += cross;
      cx += (x0 + x1) * cross;
      cy += (y0 + y1) * cross;
    }
    area *= 0.5;
    if (Math.abs(area) < 1e-9) {
      let sx = 0;
      let sy = 0;
      for (const [x, y] of ring) {
        sx += x;
        sy += y;
      }
      return [sx / ring.length, sy / ring.length];
    }
    return [cx / (6 * area), cy / (6 * area)];
  }

  let districtLabelLayoutClass = null;
  function ensureDistrictLabelLayout(ymaps) {
    if (districtLabelLayoutClass) return districtLabelLayoutClass;
    const Layout = ymaps.templateLayoutFactory.createClass(
      '<div class="uydosh-district-label"></div>',
      {
        build: function () {
          Layout.superclass.build.call(this);
          const props = this.getData().properties;
          const el = this.getElement()?.firstChild;
          if (!el) return;
          el.textContent = props.get('label') || '';
          el.style.background = props.get('color') || '#546E7A';
        },
      },
    );
    districtLabelLayoutClass = Layout;
    return Layout;
  }

  function createDistrictPolygon(ymaps, district) {
    const color = districtLayerColor(district.locationId);
    return new ymaps.Polygon([district.outerRing], {}, {
      fillColor: hexWithAlpha(color, 0.22),
      strokeColor: hexWithAlpha(color, 0.85),
      strokeWidth: 2,
      zIndex: 5,
      interactivityModel: 'default#transparent',
    });
  }

  function createDistrictLabelPlacemark(ymaps, district, lang) {
    const center = ringCentroid(district.outerRing);
    if (!center) return null;
    return new ymaps.Placemark(center, {
      label: districtLocalizedName(district, lang),
      color: districtLayerColor(district.locationId),
    }, {
      iconLayout: ensureDistrictLabelLayout(ymaps),
      iconShape: { type: 'Rectangle', coordinates: [[-40, -10], [40, 10]] },
      hasHint: false,
      hasBalloon: false,
      interactivityModel: 'default#transparent',
      zIndex: 10,
    });
  }

  /** All Tashkent metro stations, cached per language (static infrastructure data). */
  const subwayStationsPromiseByLang = new Map();
  function loadAllSubwayStations(lang) {
    const key = lang || 'ru';
    let promise = subwayStationsPromiseByLang.get(key);
    if (!promise) {
      promise = Promise.resolve(window.UyDosh?.fetchSubwayStations?.(key))
        .then((stations) => (Array.isArray(stations) ? stations : []))
        .catch((err) => {
          subwayStationsPromiseByLang.delete(key);
          throw err;
        });
      subwayStationsPromiseByLang.set(key, promise);
    }
    return promise;
  }

  function createMetroStationPlacemark(ymaps, station, lang) {
    const lat = Number(station?.latitude);
    const lon = Number(station?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const name = window.UyDosh?.localized?.(station, lang) || '';
    const customIcon = window.UyDosh?.createMetroStationPinIcon?.(station?.line);
    const iconOptions = customIcon?.href
      ? {
          iconLayout: 'default#image',
          iconImageHref: customIcon.href,
          iconImageSize: customIcon.size,
          iconImageOffset: customIcon.offset,
        }
      : {
          preset: 'islands#circleIcon',
          iconColor: window.UyDosh?.metroLineColor?.(station?.line) || '#616161',
        };
    return new ymaps.Placemark([lat, lon], {
      hintContent: name,
    }, {
      ...iconOptions,
      hasHint: true,
      hasBalloon: false,
      zIndex: customIcon?.zIndex ?? 50,
    });
  }

  /** off → line1 → line2 → line3 → line4 → all → off (matches the mobile app's metro layer cycle). */
  const METRO_LAYER_MODE_SEQUENCE = ['off', 'line1', 'line2', 'line3', 'line4', 'all'];

  function nextMetroLayerMode(mode) {
    const idx = METRO_LAYER_MODE_SEQUENCE.indexOf(mode);
    return METRO_LAYER_MODE_SEQUENCE[(idx + 1) % METRO_LAYER_MODE_SEQUENCE.length] || 'off';
  }

  function metroLayerModeLineId(mode) {
    switch (mode) {
      case 'line1': return 1;
      case 'line2': return 2;
      case 'line3': return 3;
      case 'line4': return 4;
      default: return null;
    }
  }

  /**
   * District name pills only render within this zoom range (boundary outlines stay visible
   * outside of it either way):
   *  - below the min, the whole city is on screen and ~12 pills would overlap into a jumble;
   *  - above the max, we're zoomed in close enough that a pill mostly just covers streets/pins
   *    without adding context.
   * Min mirrors the mobile app's `_minDistrictLabelZoom` (yandex_map_widget.dart).
   */
  const DISTRICT_LABEL_MIN_ZOOM = 11.5;
  const DISTRICT_LABEL_MAX_ZOOM = 15;

  function refreshDistrictLabelVisibility(instance) {
    const layer = instance?.districtLayer;
    if (!instance?.map || !layer?.labelObjects?.length) return;
    const zoom = instance.map.getZoom();
    const visible = zoom >= DISTRICT_LABEL_MIN_ZOOM && zoom <= DISTRICT_LABEL_MAX_ZOOM;
    for (const label of layer.labelObjects) {
      label.options.set('visible', visible);
    }
  }

  async function setDistrictLayerVisible(container, visible) {
    const instance = activeMaps.get(container);
    const layer = instance?.districtLayer;
    if (!instance?.map || !layer) return;
    layer.visible = visible;
    if (!visible) {
      layer.collection.removeAll();
      return;
    }
    if (!layer.objects) {
      let districts = [];
      try {
        districts = await loadDistrictBoundaries();
      } catch (err) {
        console.warn('[UyDoshMap] Failed to load district boundaries', err);
      }
      if (layer.visible !== true || !activeMaps.has(container)) return;
      const ymaps = window.ymaps;
      const lang = window.UyDosh?.getLang?.() || 'ru';
      layer.objects = [];
      layer.labelObjects = [];
      for (const district of districts) {
        layer.objects.push(createDistrictPolygon(ymaps, district));
        const label = createDistrictLabelPlacemark(ymaps, district, lang);
        if (label) {
          layer.objects.push(label);
          layer.labelObjects.push(label);
        }
      }
    }
    if (layer.visible) {
      for (const obj of layer.objects) layer.collection.add(obj);
      refreshDistrictLabelVisibility(instance);
    }
  }

  async function setMetroLayerMode(container, mode) {
    const instance = activeMaps.get(container);
    const layer = instance?.metroLayer;
    if (!instance?.map || !layer) return;
    layer.mode = mode;
    if (mode === 'off') {
      layer.collection.removeAll();
      return;
    }
    if (!layer.objectsByLine) {
      let stations = [];
      try {
        stations = await loadAllSubwayStations(window.UyDosh?.getLang?.() || 'ru');
      } catch (err) {
        console.warn('[UyDoshMap] Failed to load subway stations', err);
      }
      if (!activeMaps.has(container)) return;
      const ymaps = window.ymaps;
      const lang = window.UyDosh?.getLang?.() || 'ru';
      const byLine = new Map();
      for (const station of stations) {
        const placemark = createMetroStationPlacemark(ymaps, station, lang);
        if (!placemark) continue;
        const line = Number(station.line) || 0;
        if (!byLine.has(line)) byLine.set(line, []);
        byLine.get(line).push(placemark);
      }
      layer.objectsByLine = byLine;
    }
    if (layer.mode !== mode || !activeMaps.has(container)) return;
    layer.collection.removeAll();
    const lineId = metroLayerModeLineId(mode);
    const lines = lineId != null ? [lineId] : [...layer.objectsByLine.keys()];
    for (const line of lines) {
      for (const placemark of layer.objectsByLine.get(line) || []) {
        layer.collection.add(placemark);
      }
    }
  }

  function pinColor(listingTypeId) {
    const colors = window.UyDosh?.listingTypeColor?.(listingTypeId);
    return colors || '#e11d2e';
  }

  function pinVisualContext(overrides = {}) {
    return {
      selectedListingId: overrides.selectedListingId ?? null,
      selectedListingGroupIds: overrides.selectedListingGroupIds ?? [],
      visitedListingIds:
        overrides.visitedListingIds ?? window.UyDosh?.loadVisitedListingIds?.() ?? new Set(),
      darkMap: overrides.darkMap ?? window.UyDosh?.prefersDarkMapPins?.() ?? false,
      selected: overrides.selected === true,
    };
  }

  function listingPinCoordinateKey(latitude, longitude) {
    if (window.UyDosh?.listingPinCoordinateKey) {
      return window.UyDosh.listingPinCoordinateKey(latitude, longitude);
    }
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
    return `${lat.toFixed(6)}_${lon.toFixed(6)}`;
  }

  function groupPinsByCoordinate(pins) {
    if (window.UyDosh?.groupPinsByCoordinate) {
      return window.UyDosh.groupPinsByCoordinate(pins);
    }
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

  function groupFeatureId(group) {
    return `group_${group.key}`;
  }

  function selectedListingIdsFromContext(visualCtx) {
    const ids = new Set();
    const selectedId =
      visualCtx.selectedListingId != null ? Number(visualCtx.selectedListingId) : null;
    if (selectedId != null && selectedId > 0) ids.add(selectedId);
    for (const id of visualCtx.selectedListingGroupIds || []) {
      const listingId = Number(id);
      if (listingId > 0) ids.add(listingId);
    }
    return ids;
  }

  function isGroupSelected(group, visualCtx) {
    const selectedIds = selectedListingIdsFromContext(visualCtx);
    return group.pins.some((pin) => selectedIds.has(Number(pin.id)));
  }

  function isGroupVisited(group, visualCtx) {
    if (isGroupSelected(group, visualCtx)) return false;
    const visited = visualCtx.visitedListingIds;
    if (!visited || typeof visited.has !== 'function') return false;
    return group.pins.length > 0 && group.pins.every((pin) => {
      const listingId = Number(pin.id);
      return listingId > 0 && visited.has(listingId);
    });
  }

  function isPinSelected(pin, visualCtx) {
    if (visualCtx.selected) return true;
    return selectedListingIdsFromContext(visualCtx).has(Number(pin?.id));
  }

  function mapObjectInteractionOptions() {
    return {
      hasBalloon: false,
      hasHint: false,
      openBalloonOnClick: false,
      openHintOnHover: false,
    };
  }

  function placemarkIconOptions(pin, visualCtx = pinVisualContext()) {
    const customIcon = window.UyDosh?.createMapPinIcon?.(pin, visualCtx);
    const interaction = mapObjectInteractionOptions();
    if (customIcon?.href) {
      return {
        ...interaction,
        iconLayout: 'default#image',
        iconImageHref: customIcon.href,
        iconImageSize: customIcon.size,
        iconImageOffset: customIcon.offset,
        zIndex: customIcon.zIndex ?? (isPinSelected(pin, visualCtx) ? 1000 : 100),
      };
    }
    return {
      ...interaction,
      preset: 'islands#circleIcon',
      iconColor: pinColor(pin.listing_type_id),
      zIndex: isPinSelected(pin, visualCtx) ? 1000 : 100,
    };
  }

  function groupPlacemarkIconOptions(group, visualCtx = pinVisualContext()) {
    const customIcon = window.UyDosh?.createMapGroupPinIcon?.(group, visualCtx);
    const interaction = mapObjectInteractionOptions();
    if (customIcon?.href) {
      return {
        ...interaction,
        iconLayout: 'default#image',
        iconImageHref: customIcon.href,
        iconImageSize: customIcon.size,
        iconImageOffset: customIcon.offset,
        zIndex: customIcon.zIndex ?? (isGroupSelected(group, visualCtx) ? 1000 : 100),
      };
    }
    return {
      ...interaction,
      preset: 'islands#violetCircleIcon',
      zIndex: isGroupSelected(group, visualCtx) ? 1000 : 100,
    };
  }

  function createPlacemark(ymaps, pin, { onPinClick, ...visualOverrides } = {}) {
    const visualCtx = pinVisualContext(visualOverrides);
    const placemark = new ymaps.Placemark(
      [pin.latitude, pin.longitude],
      {},
      {
        ...mapObjectInteractionOptions(),
        ...placemarkIconOptions(pin, visualCtx),
      },
    );
    if (typeof onPinClick === 'function') {
      placemark.events.add('click', (event) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        closeMapBalloon(event.get('target')?.getMap?.());
        onPinClick(pin);
      });
    }
    return placemark;
  }

  function createGroupPlacemark(ymaps, group, { onPinClick, ...visualOverrides } = {}) {
    const visualCtx = pinVisualContext(visualOverrides);
    const placemark = new ymaps.Placemark(
      [group.latitude, group.longitude],
      {},
      {
        ...mapObjectInteractionOptions(),
        ...groupPlacemarkIconOptions(group, visualCtx),
      },
    );
    if (typeof onPinClick === 'function') {
      placemark.events.add('click', (event) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        closeMapBalloon(event.get('target')?.getMap?.());
        onPinClick(group.pins.length > 1 ? group.pins : group.pins[0]);
      });
    }
    return placemark;
  }

  function refreshMapPinStates(container, overrides = {}) {
    const instance = activeMaps.get(container);
    if (!instance?.pinsById) return;

    const prevCtx = instance.pinVisualDefaults ?? pinVisualContext();
    const nextCtx = pinVisualContext({
      selectedListingId: prevCtx.selectedListingId,
      selectedListingGroupIds: prevCtx.selectedListingGroupIds,
      visitedListingIds: prevCtx.visitedListingIds,
      darkMap: prevCtx.darkMap,
      ...overrides,
    });

    const prevSelected =
      prevCtx.selectedListingId != null ? Number(prevCtx.selectedListingId) : null;
    const nextSelected =
      nextCtx.selectedListingId != null ? Number(nextCtx.selectedListingId) : null;
    const prevGroupIds = (prevCtx.selectedListingGroupIds || []).map(Number).sort().join(',');
    const nextGroupIds = (nextCtx.selectedListingGroupIds || []).map(Number).sort().join(',');

    if (
      prevSelected === nextSelected &&
      prevGroupIds === nextGroupIds &&
      visitedListingSetsEqual(prevCtx.visitedListingIds, nextCtx.visitedListingIds) &&
      prevCtx.darkMap === nextCtx.darkMap
    ) {
      return;
    }

    for (const featureId of featureIdsNeedingPinRefresh(instance, prevCtx, nextCtx)) {
      applyFeatureIconOptions(instance, featureId, nextCtx);
    }

    instance.pinVisualDefaults = {
      selectedListingId: nextCtx.selectedListingId,
      selectedListingGroupIds: nextCtx.selectedListingGroupIds,
      visitedListingIds: nextCtx.visitedListingIds,
      darkMap: nextCtx.darkMap,
    };
  }

  async function destroyMap(container) {
    if (!container) return;
    const instance = activeMaps.get(container);
    if (instance) {
      try {
        instance.map?.destroy?.();
      } catch { /* ignore */ }
      activeMaps.delete(container);
      trackedContainers.delete(container);
    }
    container.innerHTML = '';
  }

  const MAP_CONTROLS = [];
  const MAP_CLUSTER_MIN_PINS = 12;
  const USER_LOCATION_PIN_Z_INDEX = 2000;

  function userLocationPlacemarkOptions() {
    const customIcon = window.UyDosh?.createUserLocationPinIcon?.();
    if (customIcon?.href) {
      return {
        iconLayout: 'default#image',
        iconImageHref: customIcon.href,
        iconImageSize: customIcon.size,
        iconImageOffset: customIcon.offset,
        zIndex: customIcon.zIndex ?? USER_LOCATION_PIN_Z_INDEX,
      };
    }
    return {
      preset: 'islands#redCircleDotIcon',
      zIndex: USER_LOCATION_PIN_Z_INDEX,
    };
  }

  function setUserLocationPlacemark(instance, ymaps, latitude, longitude) {
    if (!instance?.map || !ymaps?.Placemark) return;
    const coords = [latitude, longitude];
    if (instance.userLocationPlacemark) {
      instance.userLocationPlacemark.geometry.setCoordinates(coords);
      return;
    }
    instance.userLocationPlacemark = new ymaps.Placemark(
      coords,
      {},
      userLocationPlacemarkOptions(),
    );
    instance.map.geoObjects.add(instance.userLocationPlacemark);
  }

  /** Returns the resolved position on success (so callers can report it), or null on failure. */
  async function focusUserLocation(map, ymaps, instance) {
    try {
      const position = await window.UyDosh.requestUserLocation();
      setUserLocationPlacemark(
        instance,
        ymaps,
        position.latitude,
        position.longitude,
      );
      map.panTo([position.latitude, position.longitude], { duration: 250 });
      return position;
    } catch (err) {
      console.warn('[UyDoshMap] User location unavailable', err);
      if (window.UyDosh?.isMiniApp?.()) {
        window.UyDosh.openTelegramLocationSettings?.();
      }
      return null;
    }
  }

  function attachUserLocationControl(ymaps, map, instance) {
    if (!ymaps.control?.GeolocationControl) return;
    const control = new ymaps.control.GeolocationControl({
      options: { noPlacemark: true },
    });
    control.events.add('click', () => {
      focusUserLocation(map, ymaps, instance);
    });
    control.events.add('locationchange', (event) => {
      const position = event.get('position');
      if (!position || position.length < 2) return;
      setUserLocationPlacemark(instance, ymaps, position[0], position[1]);
    });
    map.controls.add(control);
  }

  /**
   * Silently drop the user's position pin as soon as the feed map opens, without waiting
   * for a tap on the geolocation control and without panning away from the listings the
   * map already framed. Unlike `focusUserLocation`, failures (permission denied, no
   * geolocation support, etc.) are expected and swallowed here — this is a best-effort
   * background request, not a user-initiated action, so it must never surface an error
   * banner or open Telegram's location settings.
   *
   * In practice this silent call often comes back empty: several Telegram clients only
   * reliably surface the native permission prompt (or recover from a prior denial via
   * `openSettings()`, which Telegram documents as callable only from a user gesture) when
   * triggered by an explicit tap. `onUnavailable` lets the caller show a one-tap fallback
   * banner (see `locateUserFromTap`) instead of failing silently forever.
   */
  async function autoRequestUserLocation(container, ymaps, instance, { onUnavailable, onResolved } = {}) {
    try {
      const position = await window.UyDosh.requestUserLocation();
      if (activeMaps.get(container) !== instance) return;
      setUserLocationPlacemark(instance, ymaps, position.latitude, position.longitude);
      window.UyDosh.reportTelegramMiniAppLocation?.(position.latitude, position.longitude);
      onResolved?.(position);
    } catch (err) {
      console.warn('[UyDoshMap] Auto user location unavailable', err);
      if (activeMaps.get(container) === instance) onUnavailable?.();
    }
  }

  /**
   * Tap-driven fallback for `autoRequestUserLocation`, wired to the "Show my location"
   * banner. A location obtained this way is still reported (unlike the native
   * GeolocationControl click, which stays silent) since this banner only exists to
   * complete the same automatic on-open flow that the gesture-less attempt couldn't.
   */
  async function locateUserFromTap(container) {
    const instance = activeMaps.get(container);
    const ymaps = window.ymaps;
    if (!instance?.map || !ymaps) return null;
    const position = await focusUserLocation(instance.map, ymaps, instance);
    if (!position) return null;
    window.UyDosh.reportTelegramMiniAppLocation?.(position.latitude, position.longitude);
    return position;
  }

  /**
   * Yandex Maps 2.1 has no native dark tile theme (unlike v3's `theme` option), so we fake it
   * with a CSS filter on the tile ("ground") pane only — placemarks/controls live in sibling
   * panes and are left untouched. The versioned `ymaps-2-1-XX-` class prefix changes with every
   * API release, hence the wildcard attribute selector instead of a hardcoded class name.
   */
  const MAP_TILES_DARK_CLASS = 'uydosh-map-tiles-dark';
  const MAP_TILE_THEME_STYLE_ID = 'uydosh-map-tile-theme-styles';

  function ensureMapTileThemeStyles() {
    if (document.getElementById(MAP_TILE_THEME_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = MAP_TILE_THEME_STYLE_ID;
    style.textContent = `
      .${MAP_TILES_DARK_CLASS} [class*="ymaps-"][class*="-ground-pane"] {
        filter: invert(100%) hue-rotate(180deg) brightness(0.94) contrast(0.88);
      }
    `;
    document.head.appendChild(style);
  }

  function applyMapTileTheme(container, isDark) {
    if (!container) return;
    ensureMapTileThemeStyles();
    container.classList.toggle(MAP_TILES_DARK_CLASS, !!isDark);
  }

  /**
   * Placemark icons (`iconLayout: 'default#image'`) render as a plain, sharp-cornered
   * `<img>`/`<div>` sized to `iconImageSize` — the mobile WebView's default tap-highlight
   * (and any focus outline) is drawn against that rectangular box, not the rounded shape
   * painted inside it. On the small square single-listing pins the box roughly matches the
   * circle, so it's barely visible; on the wide pill-shaped composite/group pins (see
   * `createMapGroupPinIcon` in uydosh-map-pins.js) the box's square corners clearly stick out
   * past the pill's rounded ends, showing up as a gray "artifact rectangle" on tap. Neutralize
   * both — pin taps already get their own feedback via haptics + the custom tooltip/balloon.
   *
   * The cluster bubble's listing-count label (`.uydosh-map-cluster-count`, see
   * `ensureClusterListingCountLayout` below) is real DOM text overlaid on the icon, not part
   * of the canvas bitmap — without `user-select`/`-webkit-touch-callout` disabled, a tap/hold on
   * it can trigger the WebView's native text-selection highlight, drawn as a solid rectangle in
   * the OS/app accent color (e.g. green) floating over the cluster. `user-select: none` (plus
   * the callout reset, for iOS's copy/lookup menu) suppresses that too.
   */
  const MAP_INTERACTION_STYLE_ID = 'uydosh-map-interaction-styles';

  function ensureMapInteractionStyles() {
    if (document.getElementById(MAP_INTERACTION_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = MAP_INTERACTION_STYLE_ID;
    style.textContent = `
      .map-container, .map-container * {
        -webkit-tap-highlight-color: transparent;
        outline: none;
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        user-select: none;
      }
    `;
    document.head.appendChild(style);
  }

  // The light/dark toggle lives in the app header (see initThemeToggle() in uydosh-i18n.js)
  // and only affects the app's own UI colors — prefersDarkMapPins() always returns false, so
  // this listener is a deliberate no-op for the map tiles/pins, kept only in case that ever
  // changes again.
  if (typeof document !== 'undefined') {
    document.addEventListener('uydosh:themechange', () => {
      const isDark = window.UyDosh?.prefersDarkMapPins?.() ?? false;
      for (const container of trackedContainers) {
        refreshMapPinStates(container, { darkMap: isDark });
        applyMapTileTheme(container, isDark);
      }
    });
  }

  /**
   * Small badge showing the total found-listings count, top-right of the map. The native
   * geolocation control renders top-LEFT (Yandex's default placement), so this tile sits
   * alone in the top-right corner — same edge gutter as that control's default 10px so the
   * two stay visually symmetric. Rendered as a plain DOM overlay (not a ymaps control) so
   * its size/position are easy to keep in sync with that control's 34px sizing — same
   * height and a compact, roughly square shape (not a stretched pill) to visually match it.
   * Mini app only.
   */
  const MAP_CONTROL_ICON_COLOR = '#1f2933';
  const RESULTS_COUNT_TILE_CLASS = 'uydosh-map-results-count';
  const RESULTS_COUNT_STYLE_ID = 'uydosh-map-results-count-styles';
  const RESULTS_COUNT_CONTROL_SIZE = 34;
  const RESULTS_COUNT_CONTROL_GUTTER = 10;

  function ensureResultsCountStyles() {
    if (document.getElementById(RESULTS_COUNT_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = RESULTS_COUNT_STYLE_ID;
    style.textContent = `
      .${RESULTS_COUNT_TILE_CLASS} {
        position: absolute;
        top: ${RESULTS_COUNT_CONTROL_GUTTER}px;
        right: ${RESULTS_COUNT_CONTROL_GUTTER}px;
        z-index: 20;
        height: ${RESULTS_COUNT_CONTROL_SIZE}px;
        min-width: ${RESULTS_COUNT_CONTROL_SIZE}px;
        padding: 0 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        background: #fff;
        color: ${MAP_CONTROL_ICON_COLOR};
        font: 700 13px/1 system-ui, -apple-system, sans-serif;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
        pointer-events: none;
        white-space: nowrap;
      }
    `;
    document.head.appendChild(style);
  }

  function resultsCountLabel(count) {
    return count > 999 ? '999+' : String(count);
  }

  function attachResultsCountTile(container, total) {
    if (!container) return;
    const existing = container.querySelector(`.${RESULTS_COUNT_TILE_CLASS}`);
    const count = Number(total);
    if (!window.UyDosh?.isMiniApp?.() || !Number.isFinite(count) || count <= 0) {
      existing?.remove();
      return;
    }

    ensureResultsCountStyles();
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }

    const tile = existing ?? document.createElement('div');
    if (!existing) {
      tile.className = RESULTS_COUNT_TILE_CLASS;
      tile.setAttribute('role', 'status');
      container.appendChild(tile);
    }
    tile.textContent = resultsCountLabel(count);
    tile.setAttribute(
      'aria-label',
      window.UyDosh?.t?.('map.resultsCountAria')?.replace('{count}', String(count)) ??
        String(count),
    );
  }

  /**
   * Floating round buttons (bottom-right of the map) to toggle the district-boundaries
   * layer and cycle the metro-stations layer — mirrors the mobile app's map layer
   * buttons. Mini app only; rendered as a plain DOM overlay. Bottom-right keeps them
   * clear of the results-count tile (top-right) and the native geolocation control
   * (top-left). Lifted well above the gutter so they don't sit on top of Yandex's
   * own copyright/logo bar at the very bottom of the map.
   */
  const LAYER_CONTROLS_CLASS = 'uydosh-map-layer-controls';
  const LAYER_CONTROL_BTN_CLASS = 'uydosh-map-layer-btn';
  const LAYER_CONTROLS_STYLE_ID = 'uydosh-map-layer-controls-styles';
  const LAYER_CONTROL_MUTED_COLOR = '#94a3b8';
  const LAYER_CONTROLS_BOTTOM_GUTTER = 34;

  const METRO_LAYER_BUTTON_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none">
    <path d="M7 3h10a3 3 0 0 1 3 3v10a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V6a3 3 0 0 1 3-3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"></path>
    <path d="M8 17h0.01M16 17h0.01" stroke="currentColor" stroke-width="3" stroke-linecap="round"></path>
    <path d="M7 21l-2 2M17 21l2 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
    <path d="M7 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
  </svg>`;

  const DISTRICTS_LAYER_BUTTON_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none">
    <path d="M12 3 3 8l9 5 9-5-9-5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"></path>
    <path d="M3 12l9 5 9-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
    <path d="M3 16l9 5 9-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
  </svg>`;

  function ensureLayerControlsStyles() {
    if (document.getElementById(LAYER_CONTROLS_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = LAYER_CONTROLS_STYLE_ID;
    style.textContent = `
      .${LAYER_CONTROLS_CLASS} {
        position: absolute;
        bottom: ${LAYER_CONTROLS_BOTTOM_GUTTER}px;
        right: ${RESULTS_COUNT_CONTROL_GUTTER}px;
        z-index: 20;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .${LAYER_CONTROL_BTN_CLASS} {
        appearance: none;
        border: none;
        border-radius: 50%;
        width: ${RESULTS_COUNT_CONTROL_SIZE}px;
        height: ${RESULTS_COUNT_CONTROL_SIZE}px;
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #fff;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
        cursor: pointer;
      }
      .${LAYER_CONTROL_BTN_CLASS}:active {
        opacity: 0.85;
      }
      .${LAYER_CONTROL_BTN_CLASS} svg {
        width: 18px;
        height: 18px;
        display: block;
      }
      .uydosh-district-label {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 2px 8px;
        border-radius: 999px;
        color: #fff;
        font: 700 10px/1.4 system-ui, -apple-system, sans-serif;
        white-space: nowrap;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
        transform: translate(-50%, -50%);
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  function createLayerControlButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = LAYER_CONTROL_BTN_CLASS;
    return btn;
  }

  function attachLayerControls(container, instance) {
    if (!container || !window.UyDosh?.isMiniApp?.()) return;
    ensureLayerControlsStyles();
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }

    const existing = container.querySelector(`.${LAYER_CONTROLS_CLASS}`);
    existing?.remove();
    const wrap = document.createElement('div');
    wrap.className = LAYER_CONTROLS_CLASS;
    container.appendChild(wrap);

    const metroBtn = createLayerControlButton();
    metroBtn.innerHTML = METRO_LAYER_BUTTON_ICON_SVG;
    metroBtn.setAttribute('data-haptic', 'selection');
    const districtBtn = createLayerControlButton();
    districtBtn.innerHTML = DISTRICTS_LAYER_BUTTON_ICON_SVG;
    districtBtn.setAttribute('data-haptic', 'selection');
    wrap.append(metroBtn, districtBtn);

    function refreshMetroButton() {
      const mode = instance.metroLayer.mode;
      const lineId = metroLayerModeLineId(mode);
      const lang = window.UyDosh?.getLang?.() || 'ru';
      let color = LAYER_CONTROL_MUTED_COLOR;
      let label = window.UyDosh?.t?.('map.layers.metro.show', lang) ?? 'Metro';
      if (mode === 'all') {
        color = MAP_CONTROL_ICON_COLOR;
        label = window.UyDosh?.t?.('map.layers.metro.all', lang) ?? label;
      } else if (lineId != null) {
        color = window.UyDosh?.metroLineColor?.(lineId) || MAP_CONTROL_ICON_COLOR;
        const lineName = window.UyDosh?.metroLineLabel?.(lineId, lang) || `Line ${lineId}`;
        label = (window.UyDosh?.t?.('map.layers.metro.line', lang) ?? 'Metro: {line}').replace('{line}', lineName);
      }
      metroBtn.style.color = color;
      metroBtn.style.background = mode === 'off' ? '#fff' : hexWithAlpha(color, 0.16);
      metroBtn.setAttribute('aria-pressed', mode === 'off' ? 'false' : 'true');
      metroBtn.setAttribute('aria-label', label);
      metroBtn.title = label;
    }

    function refreshDistrictButton() {
      const lang = window.UyDosh?.getLang?.() || 'ru';
      const visible = instance.districtLayer.visible;
      const label = window.UyDosh?.t?.(
        visible ? 'map.layers.districts.hide' : 'map.layers.districts.show',
        lang,
      ) ?? (visible ? 'Hide districts' : 'Show districts');
      districtBtn.style.color = visible ? MAP_CONTROL_ICON_COLOR : LAYER_CONTROL_MUTED_COLOR;
      districtBtn.style.background = visible ? '#eef2ff' : '#fff';
      districtBtn.setAttribute('aria-pressed', visible ? 'true' : 'false');
      districtBtn.setAttribute('aria-label', label);
      districtBtn.title = label;
    }

    metroBtn.addEventListener('click', () => {
      const nextMode = nextMetroLayerMode(instance.metroLayer.mode);
      setMetroLayerMode(container, nextMode).finally(refreshMetroButton);
      refreshMetroButton();
    });

    districtBtn.addEventListener('click', () => {
      const nextVisible = !instance.districtLayer.visible;
      setDistrictLayerVisible(container, nextVisible).finally(refreshDistrictButton);
      refreshDistrictButton();
    });

    refreshMetroButton();
    refreshDistrictButton();
  }

  const MAP_CLUSTER_GRID_SIZE = 64;
  let clusterListingCountLayout = null;

  function listingCountForGeoObjects(geoObjects) {
    let total = 0;
    for (const obj of geoObjects || []) {
      total += Number(obj.properties?.listingCount) || 1;
    }
    return total;
  }

  function listingCountLabelForGeoObjects(geoObjects) {
    const total = listingCountForGeoObjects(geoObjects);
    return total > 99 ? '99+' : String(total);
  }

  /** Sum listing counts in a cluster (composite groups count as N, not 1). */
  function ensureClusterListingCountLayout(ymaps) {
    if (clusterListingCountLayout) return clusterListingCountLayout;
    const Layout = ymaps.templateLayoutFactory.createClass(
      '<div class="uydosh-map-cluster-count" style="color:#fff;font-weight:700;font-size:10px;font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;width:100%;height:100%;pointer-events:none;user-select:none;-webkit-user-select:none;"></div>',
      {
        build: function () {
          Layout.superclass.build.call(this);
          const geoObjects = this.getData().properties.geoObjects || [];
          this.getElement().firstChild.textContent = listingCountLabelForGeoObjects(geoObjects);
        },
      },
    );
    clusterListingCountLayout = Layout;
    return Layout;
  }

  function visitedListingSetsEqual(left, right) {
    if (left === right) return true;
    if (!left || !right || left.size !== right.size) return false;
    for (const id of left) {
      if (!right.has(id)) return false;
    }
    return true;
  }

  function buildPinFeatures(pinGroups, visualCtx) {
    const features = [];
    for (const group of pinGroups) {
      if (group.pins.length > 1) {
        features.push({
          type: 'Feature',
          id: groupFeatureId(group),
          geometry: {
            type: 'Point',
            coordinates: [group.latitude, group.longitude],
          },
          properties: {
            listingCount: group.pins.length,
          },
          options: groupPlacemarkIconOptions(group, visualCtx),
        });
        continue;
      }
      const pin = group.pins[0];
      const listingId = Number(pin.id);
      if (listingId <= 0) continue;
      features.push({
        type: 'Feature',
        id: listingId,
        geometry: {
          type: 'Point',
          coordinates: [pin.latitude, pin.longitude],
        },
        properties: {
          listingCount: 1,
        },
        options: placemarkIconOptions(pin, visualCtx),
      });
    }
    return features;
  }

  function featureIdsNeedingPinRefresh(instance, prevCtx, nextCtx) {
    const featureIds = new Set();
    if (prevCtx?.darkMap !== nextCtx?.darkMap) {
      for (const pin of instance.pins || []) {
        const listingId = Number(pin.id);
        if (listingId > 0) featureIds.add(String(listingId));
      }
      for (const group of instance.pinGroups || []) {
        if (group.pins.length > 1) featureIds.add(groupFeatureId(group));
      }
    }
    const prevSelected =
      prevCtx?.selectedListingId != null ? Number(prevCtx.selectedListingId) : null;
    const nextSelected =
      nextCtx?.selectedListingId != null ? Number(nextCtx.selectedListingId) : null;
    if (prevSelected != null && prevSelected > 0) featureIds.add(String(prevSelected));
    if (nextSelected != null && nextSelected > 0) featureIds.add(String(nextSelected));

    for (const id of prevCtx?.selectedListingGroupIds || []) {
      const listingId = Number(id);
      if (listingId > 0) featureIds.add(String(listingId));
    }
    for (const id of nextCtx?.selectedListingGroupIds || []) {
      const listingId = Number(id);
      if (listingId > 0) featureIds.add(String(listingId));
    }

    for (const group of instance.pinGroups || []) {
      if (group.pins.length <= 1) continue;
      const groupId = groupFeatureId(group);
      const wasSelected = isGroupSelected(group, prevCtx);
      const isSelected = isGroupSelected(group, nextCtx);
      const wasVisited = isGroupVisited(group, prevCtx);
      const nowVisited = isGroupVisited(group, nextCtx);
      if (wasSelected !== isSelected || wasVisited !== nowVisited) {
        featureIds.add(groupId);
      }
    }

    return featureIds;
  }

  function applyFeatureIconOptions(instance, featureId, visualCtx) {
    const featureKey = String(featureId);
    const group = instance.groupsByFeatureId?.get(featureKey);
    if (group) {
      const options = groupPlacemarkIconOptions(group, visualCtx);
      if (instance.objectManager) {
        instance.objectManager.objects.setObjectOptions(featureKey, options);
        return;
      }
      const placemark = instance.placemarksById?.get(featureKey);
      placemark?.options.set(options);
      return;
    }

    const listingId = Number(featureId);
    const pin = instance.pinsById?.get(listingId);
    if (!pin) return;
    const options = placemarkIconOptions(pin, visualCtx);
    if (instance.objectManager) {
      instance.objectManager.objects.setObjectOptions(listingId, options);
      return;
    }
    const placemark = instance.placemarksById?.get(String(featureId));
    placemark?.options.set(options);
  }

  /**
   * Some WebViews (observed in the Telegram iOS Mini App) occasionally fail to paint the
   * freshly-generated canvas bitmap for a placemark/cluster feature on the very first frame
   * after ObjectManager.add() — the feature exists and is clickable, it's just visually blank
   * until something forces Yandex to re-request its icon. Re-applying the same icon options a
   * moment after the initial render is a cheap, safe way to self-heal that without waiting for
   * the user to stumble onto it (e.g. by toggling the map theme, which happens to trigger the
   * same setObjectOptions call via refreshMapPinStates and "fixes" it as a side effect).
   */
  function forceRefreshAllPinIcons(container) {
    const instance = activeMaps.get(container);
    if (!instance) return;
    const ctx = instance.pinVisualDefaults ?? pinVisualContext();
    for (const pin of instance.pins || []) {
      const listingId = Number(pin.id);
      if (listingId > 0) applyFeatureIconOptions(instance, String(listingId), ctx);
    }
    for (const group of instance.pinGroups || []) {
      if (group.pins.length > 1) {
        applyFeatureIconOptions(instance, groupFeatureId(group), ctx);
      }
    }
  }

  function scheduleForceRefreshAllPinIcons(container) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => forceRefreshAllPinIcons(container), 250);
      });
    });
  }

  function buildPinGroupMaps(pinGroups) {
    const groupsByFeatureId = new Map();
    for (const group of pinGroups) {
      if (group.pins.length > 1) {
        groupsByFeatureId.set(groupFeatureId(group), group);
      }
    }
    return groupsByFeatureId;
  }

  function closeMapBalloon(map) {
    try {
      map?.balloon?.close?.();
    } catch { /* ignore */ }
  }

  /** Bounding box ([[minLat, minLon], [maxLat, maxLon]]) covering every geo object's coordinates. */
  function boundsFromGeoObjects(geoObjects) {
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLon = Infinity;
    let maxLon = -Infinity;
    for (const obj of geoObjects || []) {
      const coords = obj?.geometry?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) continue;
      const [lat, lon] = coords;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    }
    if (!Number.isFinite(minLat) || !Number.isFinite(minLon)) return null;
    return [[minLat, minLon], [maxLat, maxLon]];
  }

  /**
   * Zoom/pan so every placemark inside a cluster becomes visible.
   * Yandex's built-in cluster click-zoom only steps in one grid level and does not
   * guarantee all member placemarks end up on screen, so we fit bounds manually instead.
   */
  function handleMapClusterClick(event, { objectManager, map }) {
    const objectId = event.get('objectId');
    const cluster = objectManager?.clusters?.getById?.(objectId);
    const geoObjects = cluster?.properties?.geoObjects;
    const bounds = boundsFromGeoObjects(geoObjects);
    if (!bounds) return;
    event?.preventDefault?.();
    try {
      map.setBounds(bounds, { checkZoomRange: true, zoomMargin: 40 });
    } catch { /* ignore */ }
  }

  function handleMapFeatureClick(event, {
    onPinClick,
    pinsById,
    groupsByFeatureId,
    map,
  }) {
    if (typeof onPinClick !== 'function') return;
    closeMapBalloon(map);
    const objectId = event.get('objectId');
    const group = groupsByFeatureId.get(String(objectId));
    if (group) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      onPinClick(group.pins);
      return;
    }
    const listingId = Number(objectId);
    const pin = pinsById.get(listingId);
    if (!pin) return;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    onPinClick(pin);
  }

  async function renderSinglePinMap(container, {
    latitude,
    longitude,
    lang,
    listingTypeId,
    pin,
    selected = true,
  } = {}) {
    await destroyMap(container);
    const ymaps = await loadYandexScript(lang);
    const map = new ymaps.Map(container, {
      center: [latitude, longitude],
      zoom: 15,
      controls: MAP_CONTROLS,
    }, {
      suppressMapOpenBlock: true,
    });
    const mapPin = pin ?? {
      latitude,
      longitude,
      listing_type_id: listingTypeId,
      title: '',
    };
    if (mapPin.latitude == null) mapPin.latitude = latitude;
    if (mapPin.longitude == null) mapPin.longitude = longitude;
    map.geoObjects.add(createPlacemark(ymaps, mapPin, { selected }));
    ensureMapInteractionStyles();
    applyMapTileTheme(container, window.UyDosh?.prefersDarkMapPins?.() ?? false);
    const instance = { map };
    attachUserLocationControl(ymaps, map, instance);
    activeMaps.set(container, instance);
    trackedContainers.add(container);
    scheduleMapReflow(container);
    return map;
  }

  async function renderPinsMap(container, {
    pins,
    lang,
    onPinClick,
    onMapClick,
    onLocationUnavailable,
    onLocationResolved,
    selectedListingId = null,
    selectedListingGroupIds = [],
    visitedListingIds,
    darkMap,
    total = null,
  }) {
    await destroyMap(container);
    const validPins = (pins || []).filter((pin) => {
      const lat = numberOrNull(pin.latitude);
      const lon = numberOrNull(pin.longitude);
      return lat !== null && lon !== null && isValidCoordinate(lat, lon);
    });
    if (validPins.length === 0) {
      container.innerHTML = '';
      return null;
    }

    const ymaps = await loadYandexScript(lang);
    const pinGroups = groupPinsByCoordinate(validPins);
    const location = locationFromPins(validPins);
    const map = new ymaps.Map(container, {
      center: location.center,
      zoom: location.zoom,
      controls: MAP_CONTROLS,
    }, {
      suppressMapOpenBlock: true,
    });

    if (typeof onMapClick === 'function') {
      map.events.add('click', () => {
        closeMapBalloon(map);
        onMapClick();
      });
    }

    const mapInstance = { map };
    mapInstance.districtLayer = { visible: false, objects: null, labelObjects: null, collection: new ymaps.GeoObjectCollection() };
    mapInstance.metroLayer = { mode: 'off', objectsByLine: null, collection: new ymaps.GeoObjectCollection() };
    map.geoObjects.add(mapInstance.districtLayer.collection);
    map.geoObjects.add(mapInstance.metroLayer.collection);
    activeMaps.set(container, mapInstance);
    attachUserLocationControl(ymaps, map, mapInstance);
    autoRequestUserLocation(container, ymaps, mapInstance, {
      onUnavailable: onLocationUnavailable,
      onResolved: onLocationResolved,
    });
    attachResultsCountTile(container, total ?? validPins.length);
    attachLayerControls(container, mapInstance);
    map.events.add('boundschange', (event) => {
      if (event.get('newZoom') === event.get('oldZoom')) return;
      refreshDistrictLabelVisibility(mapInstance);
    });

    const pinVisualDefaults = pinVisualContext({
      selectedListingId,
      selectedListingGroupIds,
      visitedListingIds,
      darkMap,
    });
    ensureMapInteractionStyles();
    applyMapTileTheme(container, pinVisualDefaults.darkMap);
    window.UyDosh?.warmMapPinIconCache?.({ darkMap: pinVisualDefaults.darkMap });

    const pinsById = new Map();
    for (const pin of validPins) {
      const listingId = Number(pin.id);
      if (listingId > 0) pinsById.set(listingId, pin);
    }
    const groupsByFeatureId = buildPinGroupMaps(pinGroups);

    const features = buildPinFeatures(pinGroups, pinVisualDefaults);
    let objectManager = null;

    if (features.length > 0 && ymaps.ObjectManager) {
      objectManager = new ymaps.ObjectManager({
        clusterize: validPins.length >= MAP_CLUSTER_MIN_PINS,
        gridSize: MAP_CLUSTER_GRID_SIZE,
        clusterDisableClickZoom: true,
        clusterOpenBalloonOnClick: false,
      });
      objectManager.clusters.options.set({
        ...(window.UyDosh?.createMapClusterPinIcon?.()
          ? (() => {
              const clusterIcon = window.UyDosh.createMapClusterPinIcon();
              return {
                clusterIcons: [{
                  href: clusterIcon.href,
                  size: clusterIcon.size,
                  offset: clusterIcon.offset,
                }],
                clusterNumbers: [1000],
              };
            })()
          : {
              preset: 'islands#violetClusterIcons',
              iconColor: '#673AB7',
            }),
        clusterIconContentLayout: ensureClusterListingCountLayout(ymaps),
      });
      objectManager.add({
        type: 'FeatureCollection',
        features,
      });
      if (typeof onPinClick === 'function') {
        objectManager.objects.events.add('click', (event) => {
          handleMapFeatureClick(event, { onPinClick, pinsById, groupsByFeatureId, map });
        });
      }
      objectManager.clusters.events.add('click', (event) => {
        handleMapClusterClick(event, { objectManager, map });
      });
      map.geoObjects.add(objectManager);
    } else {
      const placemarksById = new Map();
      for (const group of pinGroups) {
        if (group.pins.length > 1) {
          const featureId = groupFeatureId(group);
          const placemark = createGroupPlacemark(ymaps, group, {
            onPinClick,
            ...pinVisualDefaults,
          });
          map.geoObjects.add(placemark);
          placemarksById.set(featureId, placemark);
          continue;
        }
        const pin = group.pins[0];
        const listingId = Number(pin.id);
        const placemark = createPlacemark(ymaps, pin, {
          onPinClick,
          ...pinVisualDefaults,
        });
        map.geoObjects.add(placemark);
        if (listingId > 0) placemarksById.set(String(listingId), placemark);
      }
      mapInstance.pins = validPins;
      mapInstance.pinGroups = pinGroups;
      mapInstance.pinsById = pinsById;
      mapInstance.groupsByFeatureId = groupsByFeatureId;
      mapInstance.placemarksById = placemarksById;
      mapInstance.pinVisualDefaults = pinVisualDefaults;
      activeMaps.set(container, mapInstance);
      trackedContainers.add(container);
      scheduleMapReflow(container);
      scheduleForceRefreshAllPinIcons(container);
      if (validPins.length > 1) {
        try {
          const bounds = map.geoObjects.getBounds();
          if (bounds) {
            map.setBounds(bounds, { checkZoomRange: true, zoomMargin: 40 });
          }
        } catch { /* ignore */ }
      }
      return map;
    }

    if (validPins.length > 1) {
      try {
        const bounds = map.geoObjects.getBounds();
        if (bounds) {
          map.setBounds(bounds, { checkZoomRange: true, zoomMargin: 40 });
        }
      } catch { /* ignore */ }
    }

    mapInstance.pins = validPins;
    mapInstance.pinGroups = pinGroups;
    mapInstance.pinsById = pinsById;
    mapInstance.groupsByFeatureId = groupsByFeatureId;
    mapInstance.objectManager = objectManager;
    mapInstance.pinVisualDefaults = pinVisualDefaults;
    activeMaps.set(container, mapInstance);
    trackedContainers.add(container);
    scheduleMapReflow(container);
    scheduleForceRefreshAllPinIcons(container);
    return map;
  }

  window.UyDoshMap = {
    resolveListingMapCoordinates,
    loadYandexScript,
    resetYandexMapsLoader,
    getApiKey,
    yandexMapsOpenUrl,
    yandexMapsLang,
    renderSinglePinMap,
    renderPinsMap,
    locateUserFromTap,
    refreshMapPinStates,
    destroyMap,
    reflowMap,
    reflowAllMaps,
  };
})();
