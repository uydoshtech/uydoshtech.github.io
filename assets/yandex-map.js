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
      if (instance.themeToggleButton) themeToggleButtons.delete(instance.themeToggleButton);
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
      return true;
    } catch (err) {
      console.warn('[UyDoshMap] User location unavailable', err);
      if (window.UyDosh?.isMiniApp?.()) {
        window.UyDosh.openTelegramLocationSettings?.();
      }
      return false;
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

  const THEME_TOGGLE_ICON_COLOR = '#1f2933';
  const themeToggleButtons = new Set();

  function themeToggleIconSvg(isDark) {
    return isDark
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="${THEME_TOGGLE_ICON_COLOR}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="${THEME_TOGGLE_ICON_COLOR}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"></path></svg>`;
  }

  function themeToggleIconDataUrl(isDark) {
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(themeToggleIconSvg(isDark))}`;
  }

  function themeToggleTitle(isDark) {
    // Button shows the *target* mode's icon, so the tooltip names the mode it switches to.
    return window.UyDosh?.t?.(isDark ? 'map.themeToggleLight' : 'map.themeToggleDark') || 'Тема';
  }

  function refreshThemeToggleButton(button) {
    const isDark = window.UyDosh?.prefersDarkMapPins?.() ?? false;
    try {
      button.data.set('image', themeToggleIconDataUrl(isDark));
      button.data.set('title', themeToggleTitle(isDark));
    } catch { /* ignore */ }
  }

  /** Manual light/dark toggle, stacked directly under the geolocation control. Mini app only. */
  function attachThemeToggleControl(ymaps, map, instance) {
    if (!ymaps.control?.Button || !window.UyDosh?.isMiniApp?.()) return;
    const isDark = window.UyDosh?.prefersDarkMapPins?.() ?? false;
    const button = new ymaps.control.Button({
      data: {
        image: themeToggleIconDataUrl(isDark),
        title: themeToggleTitle(isDark),
      },
      options: { selectOnClick: false, maxWidth: 34 },
    });
    button.events.add('click', () => {
      window.UyDosh?.toggleManualTheme?.();
    });
    map.controls.add(button, { float: 'right' });
    themeToggleButtons.add(button);
    if (instance) instance.themeToggleButton = button;
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('uydosh:themechange', () => {
      for (const button of themeToggleButtons) {
        refreshThemeToggleButton(button);
      }
      const isDark = window.UyDosh?.prefersDarkMapPins?.() ?? false;
      for (const container of trackedContainers) {
        refreshMapPinStates(container, { darkMap: isDark });
      }
    });
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
      '<div class="uydosh-map-cluster-count" style="color:#fff;font-weight:700;font-size:10px;font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;width:100%;height:100%;"></div>',
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
    const instance = { map };
    attachUserLocationControl(ymaps, map, instance);
    attachThemeToggleControl(ymaps, map, instance);
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
    selectedListingId = null,
    selectedListingGroupIds = [],
    visitedListingIds,
    darkMap,
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
    attachUserLocationControl(ymaps, map, mapInstance);
    attachThemeToggleControl(ymaps, map, mapInstance);

    const pinVisualDefaults = pinVisualContext({
      selectedListingId,
      selectedListingGroupIds,
      visitedListingIds,
      darkMap,
    });
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
    refreshMapPinStates,
    destroyMap,
    reflowMap,
    reflowAllMaps,
  };
})();
