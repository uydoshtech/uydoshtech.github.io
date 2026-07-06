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

  /** Best-effort stringification for `reportYandexMapIssue`'s `details` field. */
  function safeIssueDetails(value) {
    if (value == null) return undefined;
    if (value instanceof Error) return value.message || value.name || 'Error';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  /**
   * Fire-and-forget report of a failed Yandex Maps API call (script load,
   * pedestrian routing, etc.) to our own backend (`POST /app/yandex-maps-log`,
   * see uydosh_backend's appRoutes.ts) — it just logs it server-side via
   * plain `console.error`, which flows through the same PM2 -> CloudWatch
   * Agent pipeline as every other server log, so these failures (invisible
   * to us otherwise — they only ever reach a visitor's own browser console)
   * show up somewhere we can actually grep/alert on. Uses `sendBeacon` when
   * available so it still gets a chance to fire even if the map failure is
   * followed shortly by a page navigation/close. Never throws or rejects:
   * reporting a failure should never itself become a new one.
   */
  function reportYandexMapIssue(kind, message, details) {
    try {
      const apiBase = String(window.UyDosh?.API_BASE || 'https://api.uydosh.com').replace(/\/$/, '');
      const url = `${apiBase}/app/yandex-maps-log`;
      const payload = JSON.stringify({
        kind: String(kind || 'unknown'),
        message: String(message || ''),
        page: (typeof location !== 'undefined' && location.href) || '',
        details: safeIssueDetails(details),
      });
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
        return;
      }
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => { /* best-effort only */ });
    } catch { /* best-effort only */ }
  }

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

  /**
   * Mirror backend resolveListingMapCoordinates: listings processed by the
   * location-approx pipeline carry `location_precision` + a ready-to-use
   * `display_lat`/`display_lng` (a real address point for `exact`, or a
   * stable generated point around the metro/district/landmark anchor
   * otherwise) — those take priority so this pin matches the feed map and
   * mobile app instead of falling back to a shared station/district
   * coordinate. `location_precision === 'unknown'` deliberately yields no
   * pin. Listings never touched by that pipeline (older rows,
   * `location_precision` null/undefined) fall back to the legacy
   * resolution: address, then subway station, then district.
   */
  function resolveListingMapCoordinates(listing) {
    if (!listing) return null;
    if (listing.location_precision === 'unknown') return null;

    const displayLatitude = numberOrNull(listing.display_lat);
    const displayLongitude = numberOrNull(listing.display_lng);
    if (
      displayLatitude !== null &&
      displayLongitude !== null &&
      isValidCoordinate(displayLatitude, displayLongitude)
    ) {
      return {
        latitude: displayLatitude,
        longitude: displayLongitude,
        source: listing.is_approximate_location === true ? 'approximate' : 'exact',
      };
    }

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
        reportYandexMapIssue('script_load_failed', err?.message || String(err));
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

  function boundsFromRing(ring) {
    if (!Array.isArray(ring) || ring.length === 0) return null;
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLon = Infinity;
    let maxLon = -Infinity;
    for (const point of ring) {
      const lat = point?.[0];
      const lon = point?.[1];
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
    }
    if (!Number.isFinite(minLat) || !Number.isFinite(minLon)) return null;
    return { minLat, maxLat, minLon, maxLon };
  }

  function extendBoundsWithPins(bounds, pins) {
    let { minLat, maxLat, minLon, maxLon } = bounds;
    for (const pin of pins || []) {
      minLat = Math.min(minLat, pin.latitude);
      maxLat = Math.max(maxLat, pin.latitude);
      minLon = Math.min(minLon, pin.longitude);
      maxLon = Math.max(maxLon, pin.longitude);
    }
    return { minLat, maxLat, minLon, maxLon };
  }

  function boundsFromPins(pins) {
    if (!pins || pins.length === 0) return null;
    return extendBoundsWithPins(
      { minLat: Infinity, maxLat: -Infinity, minLon: Infinity, maxLon: -Infinity },
      pins,
    );
  }

  function mergeBounds(a, b) {
    if (!a) return b;
    if (!b) return a;
    return {
      minLat: Math.min(a.minLat, b.minLat),
      maxLat: Math.max(a.maxLat, b.maxLat),
      minLon: Math.min(a.minLon, b.minLon),
      maxLon: Math.max(a.maxLon, b.maxLon),
    };
  }

  /** `[[minLat, minLon], [maxLat, maxLon]]`, the shape `ymaps.Map#setBounds` expects. */
  function toYandexBounds(bounds) {
    if (!bounds) return null;
    return [[bounds.minLat, bounds.minLon], [bounds.maxLat, bounds.maxLon]];
  }

  /** Mirrors the mobile app's `_fitCameraToLatLonBounds` padding (yandex_map_widget.dart). */
  function locationFromBounds(bounds) {
    const latSpan = Math.abs(bounds.maxLat - bounds.minLat);
    const lonSpan = Math.abs(bounds.maxLon - bounds.minLon);
    const latPadding = Math.min(Math.max(latSpan * 0.18, 0.008), 0.06);
    const lonPadding = Math.min(Math.max(lonSpan * 0.18, 0.008), 0.06);
    const minLat = bounds.minLat - latPadding;
    const maxLat = bounds.maxLat + latPadding;
    const minLon = bounds.minLon - lonPadding;
    const maxLon = bounds.maxLon + lonPadding;
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

  /**
   * Three polygon looks for the district-boundaries layer, mirroring the mobile app's
   * `_DistrictPolygonStyle` (normal/dimmed/emphasized — see `_districtPolygonColors` in
   * yandex_map_widget_map_objects.dart): "normal" for the plain all-districts toggle,
   * "dimmed" for every other district once a location filter highlights one of them, and
   * "emphasized" for that highlighted district itself.
   */
  const DISTRICT_POLYGON_STYLES = {
    normal: { fillAlpha: 0.22, strokeAlpha: 0.78, strokeWidth: 2, zIndex: 4 },
    dimmed: { fillAlpha: 0.08, strokeAlpha: 0.34, strokeWidth: 1.5, zIndex: 3 },
    emphasized: { fillAlpha: 0.34, strokeAlpha: 0.95, strokeWidth: 3, zIndex: 6 },
  };

  function createDistrictPolygon(ymaps, district, style = 'normal') {
    const color = districtLayerColor(district.locationId);
    const { fillAlpha, strokeAlpha, strokeWidth, zIndex } =
      DISTRICT_POLYGON_STYLES[style] || DISTRICT_POLYGON_STYLES.normal;
    return new ymaps.Polygon([district.outerRing], {}, {
      fillColor: hexWithAlpha(color, fillAlpha),
      strokeColor: hexWithAlpha(color, strokeAlpha),
      strokeWidth,
      zIndex,
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

  /**
   * Small floating pill shown at the midpoint of a pin -> metro-station guide line/route
   * (see `setPinGuideLines`), reading e.g. "↝ 2.0 km  🕐 33 min" — a real `ymaps.Placemark`
   * (not a plain DOM overlay like `attachDragHintOverlay`) so it stays correctly anchored
   * to that geo point through pans/zooms for free, same reasoning as
   * `createDistrictLabelPlacemark` above.
   */
  const ROUTE_INFO_LABEL_CLASS = 'uydosh-route-info-label';
  const ROUTE_INFO_STYLE_ID = 'uydosh-map-route-info-styles';

  function ensureRouteInfoLabelStyles() {
    if (document.getElementById(ROUTE_INFO_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = ROUTE_INFO_STYLE_ID;
    style.textContent = `
      .${ROUTE_INFO_LABEL_CLASS} {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 9px;
        border-radius: 999px;
        background: rgba(20, 20, 20, 0.86);
        color: #fff;
        font: 700 11px/1.2 system-ui, -apple-system, sans-serif;
        white-space: nowrap;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
        transform: translate(-50%, -50%);
        pointer-events: none;
      }
      .${ROUTE_INFO_LABEL_CLASS} > span {
        display: inline-flex;
        align-items: center;
        gap: 3px;
      }
      .${ROUTE_INFO_LABEL_CLASS} .icon {
        width: 12px;
        height: 12px;
        display: inline-flex;
        flex: 0 0 auto;
      }
      .${ROUTE_INFO_LABEL_CLASS} .icon svg {
        width: 100%;
        height: 100%;
        display: block;
      }
      .${ROUTE_INFO_LABEL_CLASS} .icon svg * {
        stroke: currentColor;
      }
      .${ROUTE_INFO_LABEL_CLASS}-sep {
        width: 1px;
        height: 10px;
        background: rgba(255, 255, 255, 0.32);
      }
    `;
    document.head.appendChild(style);
  }

  function routeInfoLabelHtml(meters, minutes, lang) {
    const km = meters / 1000;
    const roundedMinutes = Math.max(1, Math.round(minutes));
    const distanceText = (window.UyDosh?.t?.('map.routeDistanceKm', lang) || '{km} km')
      .replace('{km}', km.toFixed(1));
    const durationText = (window.UyDosh?.t?.('map.routeDurationMin', lang) || '{minutes} min')
      .replace('{minutes}', String(roundedMinutes));
    const routeIcon = window.UyDosh?.iconRoute?.() ?? '';
    const clockIcon = window.UyDosh?.iconClock?.() ?? '';
    return `<span>${routeIcon}${distanceText}</span><span class="${ROUTE_INFO_LABEL_CLASS}-sep"></span><span>${clockIcon}${durationText}</span>`;
  }

  let routeInfoLayoutClass = null;
  function ensureRouteInfoLayout(ymaps) {
    if (routeInfoLayoutClass) return routeInfoLayoutClass;
    const Layout = ymaps.templateLayoutFactory.createClass(
      `<div class="${ROUTE_INFO_LABEL_CLASS}"></div>`,
      {
        build: function () {
          Layout.superclass.build.call(this);
          const props = this.getData().properties;
          const el = this.getElement()?.firstChild;
          if (!el) return;
          el.innerHTML = props.get('html') || '';
        },
      },
    );
    routeInfoLayoutClass = Layout;
    return Layout;
  }

  /** Midpoint between two `[lat, lng]` pairs — good enough for label placement at this
   * (city, walking-distance) scale; doesn't need to follow the route's actual path shape. */
  function midpointCoordinates(a, b) {
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  }

  function createRouteInfoPlacemark(ymaps, coordinates, meters, minutes, lang) {
    ensureRouteInfoLabelStyles();
    return new ymaps.Placemark(coordinates, {
      html: routeInfoLabelHtml(meters, minutes, lang),
    }, {
      iconLayout: ensureRouteInfoLayout(ymaps),
      iconShape: { type: 'Rectangle', coordinates: [[-55, -12], [55, 12]] },
      hasHint: false,
      hasBalloon: false,
      interactivityModel: 'default#transparent',
      zIndex: 30,
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

  function createMetroStationPlacemark(ymaps, station, lang, onClick) {
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
    const placemark = new ymaps.Placemark([lat, lon], {
      hintContent: name,
    }, {
      ...iconOptions,
      hasHint: true,
      hasBalloon: false,
      zIndex: customIcon?.zIndex ?? 50,
    });
    if (typeof onClick === 'function') {
      placemark.events.add('click', (event) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        onClick(station);
      });
    }
    return placemark;
  }

  /**
   * Tapping a metro station layer icon shows a small floating info card (name + district,
   * mirrors the mobile app's `MetroStationMapTooltip`) plus a walking-distance circle around
   * the station (mirrors `_createMetroStationWalkingRadius` in
   * yandex_map_widget_map_objects.dart). Both are real `ymaps.Placemark`/`ymaps.Circle` geo-
   * objects — not DOM overlays — so they stay correctly anchored through pans/zooms for free,
   * same reasoning as `createRouteInfoPlacemark` above.
   */
  const METRO_STATION_WALK_MINUTES = 15;
  const METRO_WALK_CIRCLE_COLOR = '#1E88E5';

  const METRO_TOOLTIP_CLASS = 'uydosh-metro-tooltip';
  const METRO_TOOLTIP_STYLE_ID = 'uydosh-map-metro-tooltip-styles';

  function ensureMetroTooltipStyles() {
    if (document.getElementById(METRO_TOOLTIP_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = METRO_TOOLTIP_STYLE_ID;
    style.textContent = `
      .${METRO_TOOLTIP_CLASS} {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 150px;
        max-width: 220px;
        padding: 10px 26px 10px 12px;
        border-radius: 14px;
        background: rgba(20, 20, 20, 0.92);
        color: #fff;
        font: 600 12px/1.3 system-ui, -apple-system, sans-serif;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.32);
        transform: translate(-50%, calc(-100% - 16px));
        pointer-events: auto;
        cursor: default;
      }
      .${METRO_TOOLTIP_CLASS}::after {
        content: '';
        position: absolute;
        left: 50%;
        top: 100%;
        transform: translateX(-50%);
        border: 6px solid transparent;
        border-top-color: rgba(20, 20, 20, 0.92);
      }
      .${METRO_TOOLTIP_CLASS}-row {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
      }
      .${METRO_TOOLTIP_CLASS}-row span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .${METRO_TOOLTIP_CLASS}-name {
        font-size: 13px;
        font-weight: 800;
      }
      .${METRO_TOOLTIP_CLASS}-district {
        opacity: 0.82;
        font-weight: 600;
      }
      .${METRO_TOOLTIP_CLASS} .icon {
        width: 14px;
        height: 14px;
        display: inline-flex;
        flex: 0 0 auto;
      }
      .${METRO_TOOLTIP_CLASS} .icon svg {
        width: 100%;
        height: 100%;
        display: block;
      }
      .${METRO_TOOLTIP_CLASS}-district .icon svg * {
        stroke: currentColor;
      }
      .${METRO_TOOLTIP_CLASS}-close {
        position: absolute;
        top: 2px;
        right: 2px;
        appearance: none;
        border: 0;
        background: transparent;
        color: #fff;
        opacity: 0.7;
        width: 22px;
        height: 22px;
        margin: 0;
        padding: 0;
        font-size: 16px;
        line-height: 1;
        cursor: pointer;
        display: grid;
        place-items: center;
        pointer-events: auto;
      }
      .${METRO_TOOLTIP_CLASS}-close:active { opacity: 1; }
    `;
    document.head.appendChild(style);
  }

  function metroTooltipHtml(station, lang) {
    const escapeHtml = window.UyDosh?.escapeHtml || ((s) => String(s ?? ''));
    const name = window.UyDosh?.localized?.(station, lang) || '';
    const location = window.UyDosh?.getCachedLocationById?.(station?.location_id, lang);
    const district = window.UyDosh?.localizedShort?.(location, lang) || '';
    const metroIcon = window.UyDosh?.iconMetro?.(station?.line) ?? '';
    const pinIcon = window.UyDosh?.iconPin?.() ?? '';
    const closeLabel = window.UyDosh?.t?.('map.tooltip.close', lang) || 'Close';
    const districtRow = district
      ? `<div class="${METRO_TOOLTIP_CLASS}-row ${METRO_TOOLTIP_CLASS}-district">${pinIcon}<span>${escapeHtml(district)}</span></div>`
      : '';
    return `
      <button type="button" class="${METRO_TOOLTIP_CLASS}-close" data-metro-tooltip-close aria-label="${escapeHtml(closeLabel)}">×</button>
      <div class="${METRO_TOOLTIP_CLASS}-row ${METRO_TOOLTIP_CLASS}-name">${metroIcon}<span>${escapeHtml(name)}</span></div>
      ${districtRow}
    `;
  }

  let metroTooltipLayoutClass = null;
  function ensureMetroTooltipLayout(ymaps) {
    if (metroTooltipLayoutClass) return metroTooltipLayoutClass;
    const Layout = ymaps.templateLayoutFactory.createClass(
      `<div class="${METRO_TOOLTIP_CLASS}"></div>`,
      {
        build: function () {
          Layout.superclass.build.call(this);
          const el = this.getElement()?.firstChild;
          if (!el) return;
          el.innerHTML = this.getData().properties.get('html') || '';
          this._closeHandler = (event) => {
            event.stopPropagation();
            this.getData().properties.get('onClose')?.();
          };
          el.querySelector('[data-metro-tooltip-close]')?.addEventListener('click', this._closeHandler);
        },
        clear: function () {
          const el = this.getElement()?.firstChild;
          const closeBtn = el?.querySelector('[data-metro-tooltip-close]');
          if (closeBtn && this._closeHandler) closeBtn.removeEventListener('click', this._closeHandler);
          Layout.superclass.clear.call(this);
        },
      },
    );
    metroTooltipLayoutClass = Layout;
    return Layout;
  }

  function createMetroStationTooltipPlacemark(ymaps, station, lang, onClose) {
    ensureMetroTooltipStyles();
    const lat = Number(station?.latitude);
    const lon = Number(station?.longitude);
    return new ymaps.Placemark([lat, lon], {
      html: metroTooltipHtml(station, lang),
      onClose,
    }, {
      iconLayout: ensureMetroTooltipLayout(ymaps),
      iconShape: { type: 'Rectangle', coordinates: [[-110, -90], [110, 6]] },
      hasHint: false,
      hasBalloon: false,
      zIndex: 60,
    });
  }

  function metroWalkRadiusMeters() {
    return window.UyDosh?.estimatedWalkRadiusMeters?.(METRO_STATION_WALK_MINUTES)
      ?? METRO_STATION_WALK_MINUTES * 80;
  }

  /** Circle geo-object for the "N min walk area" around a tapped metro station — geodesic
   * radius in meters, so it renders as a real-world circle regardless of zoom/latitude. */
  function createMetroWalkCircle(ymaps, station, radius) {
    const lat = Number(station?.latitude);
    const lon = Number(station?.longitude);
    return new ymaps.Circle([[lat, lon], radius], {}, {
      // Same 16%/42% fill/stroke alpha as the mobile app's walking-radius circle
      // (`_createWalkingRadiusCircle` in yandex_map_widget_map_objects.dart).
      fillColor: hexWithAlpha(METRO_WALK_CIRCLE_COLOR, 0.16),
      strokeColor: hexWithAlpha(METRO_WALK_CIRCLE_COLOR, 0.42),
      strokeWidth: 2,
      interactivityModel: 'default#transparent',
      zIndex: 15,
    });
  }

  /** North-shifted `[lat, lng]` for placing the "N min walk area" label above a station,
   * same fixed-latitude-degree approximation used elsewhere in this file (see `midpointCoordinates`) —
   * good enough at this (city, few-km) scale. Mirrors `_pointOffsetNorth` in the mobile app. */
  function offsetCoordinatesNorth(lat, lon, meters) {
    const METERS_PER_DEGREE_LATITUDE = 111320;
    return [lat + meters / METERS_PER_DEGREE_LATITUDE, lon];
  }

  function metroWalkAreaLabelHtml(minutes, lang) {
    const text = (window.UyDosh?.t?.('map.metroWalkArea', lang) || '{minutes} min walk area')
      .replace('{minutes}', String(minutes));
    const clockIcon = window.UyDosh?.iconClock?.() ?? '';
    return `<span>${clockIcon}${text}</span>`;
  }

  /** "N min walk area" pill placed near the top of the walk circle — reuses the route-info
   * label's layout/styles (`ensureRouteInfoLayout`/`ensureRouteInfoLabelStyles`) since it's
   * the same generic "dark pill with an icon" look, just different content. Mirrors the
   * mobile app's `_createMetroStationWalkingRadiusLabel`. */
  function createMetroWalkAreaLabel(ymaps, station, radiusMeters, lang) {
    ensureRouteInfoLabelStyles();
    const lat = Number(station?.latitude);
    const lon = Number(station?.longitude);
    const coordinates = offsetCoordinatesNorth(lat, lon, radiusMeters * 0.56);
    return new ymaps.Placemark(coordinates, {
      html: metroWalkAreaLabelHtml(METRO_STATION_WALK_MINUTES, lang),
    }, {
      iconLayout: ensureRouteInfoLayout(ymaps),
      iconShape: { type: 'Rectangle', coordinates: [[-65, -12], [65, 12]] },
      hasHint: false,
      hasBalloon: false,
      interactivityModel: 'default#transparent',
      zIndex: 20,
    });
  }

  /** Selects (or, if already selected, deselects) a metro station on the layer — shows/hides
   * its info tooltip and walking-radius circle. See `setMetroLayerMode` for where the click
   * that calls this is wired up, and the `map.events.add('click', ...)` in `renderPinsMap`
   * for dismissing on an outside tap. */
  function setSelectedMetroStation(container, station, lang) {
    const instance = activeMaps.get(container);
    const selection = instance?.metroLayer?.selection;
    if (!instance?.map || !selection) return;
    const stationId = Number(station?.id);
    if (selection.stationId === stationId) {
      clearSelectedMetroStation(container);
      return;
    }
    selection.collection.removeAll();
    selection.stationId = stationId;
    const ymaps = window.ymaps;
    const radius = metroWalkRadiusMeters();
    selection.collection.add(createMetroWalkCircle(ymaps, station, radius));
    selection.collection.add(createMetroWalkAreaLabel(ymaps, station, radius, lang));
    selection.collection.add(createMetroStationTooltipPlacemark(ymaps, station, lang, () => {
      clearSelectedMetroStation(container);
    }));
  }

  function clearSelectedMetroStation(container) {
    const instance = activeMaps.get(container);
    const selection = instance?.metroLayer?.selection;
    if (!selection) return;
    selection.stationId = null;
    selection.collection.removeAll();
  }

  /** off → all → line1 → line2 → line3 → line4 → off (matches the mobile app's metro layer cycle). */
  const METRO_LAYER_MODE_SEQUENCE = ['off', 'all', 'line1', 'line2', 'line3', 'line4'];

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

  /** Which polygon look (if any) a district should render with, given the layer's current
   * "show all" toggle and location-filter highlight — mirrors the mobile app's
   * `_createDistrictLayerMapObjects` (yandex_map_widget_map_objects.dart). */
  function districtStyleForLayer(district, layer) {
    if (layer.highlightedLocationId != null && Number(district.locationId) === layer.highlightedLocationId) {
      return 'emphasized';
    }
    if (layer.visible) return layer.highlightedLocationId != null ? 'dimmed' : 'normal';
    return null;
  }

  /**
   * Rebuilds the district-boundaries collection from the layer's current `visible` (all-
   * districts toggle) and `highlightedLocationId` (location filter) state. Called whenever
   * either changes — see `setDistrictLayerVisible` and `setHighlightedDistrict` below.
   */
  async function syncDistrictLayer(container) {
    const instance = activeMaps.get(container);
    const layer = instance?.districtLayer;
    if (!instance?.map || !layer) return;
    const token = (layer.syncToken = (layer.syncToken || 0) + 1);

    if (!layer.visible && layer.highlightedLocationId == null) {
      layer.collection.removeAll();
      layer.labelObjects = null;
      return;
    }

    if (!layer.allDistricts) {
      let districts = [];
      try {
        districts = await loadDistrictBoundaries();
      } catch (err) {
        console.warn('[UyDoshMap] Failed to load district boundaries', err);
      }
      if (!activeMaps.has(container) || layer.syncToken !== token) return;
      layer.allDistricts = districts;
    }
    if (layer.syncToken !== token) return;

    if (!layer.visible && layer.highlightedLocationId == null) {
      layer.collection.removeAll();
      layer.labelObjects = null;
      return;
    }

    const ymaps = window.ymaps;
    const lang = window.UyDosh?.getLang?.() || 'ru';
    const objects = [];
    const labelObjects = [];
    for (const district of layer.allDistricts) {
      const style = districtStyleForLayer(district, layer);
      if (!style) continue;
      objects.push(createDistrictPolygon(ymaps, district, style));
      // The highlighted (location-filter) district's own name is already shown in the
      // filter chip, so its name bubble on the map would be redundant — skip it and only
      // label the other, non-highlighted districts.
      if (style === 'emphasized') continue;
      const label = createDistrictLabelPlacemark(ymaps, district, lang);
      if (label) {
        objects.push(label);
        labelObjects.push(label);
      }
    }
    layer.collection.removeAll();
    for (const obj of objects) layer.collection.add(obj);
    layer.labelObjects = labelObjects;
    refreshDistrictLabelVisibility(instance);
  }

  async function setDistrictLayerVisible(container, visible) {
    const instance = activeMaps.get(container);
    const layer = instance?.districtLayer;
    if (!instance?.map || !layer) return;
    layer.visible = visible;
    await syncDistrictLayer(container);
  }

  /** Highlights the district matching the active location filter (or clears it when `null`) —
   * shows independently of the all-districts toggle, same as the mobile app. */
  async function setHighlightedDistrict(container, locationId) {
    const instance = activeMaps.get(container);
    const layer = instance?.districtLayer;
    if (!instance?.map || !layer) return;
    const normalized = Number(locationId) > 0 ? Number(locationId) : null;
    if (layer.highlightedLocationId === normalized) return;
    layer.highlightedLocationId = normalized;
    await syncDistrictLayer(container);
  }

  async function setMetroLayerMode(container, mode) {
    const instance = activeMaps.get(container);
    const layer = instance?.metroLayer;
    if (!instance?.map || !layer) return;
    layer.mode = mode;
    // Any mode change removes/rebuilds the layer's placemarks, so a tapped station's
    // tooltip/walk-circle would otherwise be left pointing at a (possibly now-hidden)
    // station — simplest correct behavior is to always clear the selection here.
    clearSelectedMetroStation(container);
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
        const placemark = createMetroStationPlacemark(ymaps, station, lang, (clickedStation) => {
          setSelectedMetroStation(container, clickedStation, lang);
        });
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

  // Yandex's `islands#*Icon` preset family (used below for `standardIcon`) renders a
  // ~30x42px teardrop with the coordinate anchored at the glyph's bottom tip — this is
  // Yandex's own documented default for that preset family, not something we measure
  // ourselves. Only used as the base size for `draggablePinIconShape` below.
  const STANDARD_PRESET_ICON_WIDTH = 30;
  const STANDARD_PRESET_ICON_HEIGHT = 42;

  // Draggable pins get a bigger *invisible* touch/drag target than their visible glyph —
  // small glyphs (especially the standard teardrop, which tapers to a point) are hard to
  // grab precisely with a fingertip.
  const DRAGGABLE_PIN_TOUCH_AREA_SCALE = 2;

  /**
   * Builds an `iconShape` rectangle scaled up from the icon's own bounding box —
   * Yandex uses `iconShape` purely for hit-testing (click/drag), so this only changes
   * how big an area responds to a touch/drag, not how the pin actually looks. Keeps the
   * box's bottom edge pinned to the glyph's anchor point (y = 0) rather than centering it
   * vertically, since the anchor is the glyph's bottom tip — centering would put half the
   * extra hit area *below* the ground point, which would feel like dragging from thin air
   * underneath the pin instead of from the pin itself.
   */
  function draggablePinIconShape(iconWidth, iconHeight) {
    const halfWidth = (iconWidth * DRAGGABLE_PIN_TOUCH_AREA_SCALE) / 2;
    const height = iconHeight * DRAGGABLE_PIN_TOUCH_AREA_SCALE;
    return {
      type: 'Rectangle',
      coordinates: [
        [-halfWidth, -height],
        [halfWidth, 0],
      ],
    };
  }

  function createPlacemark(ymaps, pin, { onPinClick, draggable, onDragEnd, standardIcon = false, ...visualOverrides } = {}) {
    // `standardIcon` swaps the app's custom pin bitmap (see `placemarkIconOptions` /
    // `createMapPinIcon` in uydosh-map-pins.js) for Yandex's own default red teardrop
    // marker — used for the draggable address-confirmation pin, which is meant to read as
    // "a plain, standard map pin you're placing" rather than one of the app's own listing-
    // type pins. `placemarkIconOptions` itself is untouched/still used everywhere else
    // (listing detail page, feed pins) — flip this back to `false` (or just omit it) to
    // restore the custom icon here too, once we're ready to reuse it for this widget.
    const iconOptions = standardIcon
      ? { preset: 'islands#redIcon' }
      : placemarkIconOptions(pin, pinVisualContext(visualOverrides));
    const [iconWidth, iconHeight] = standardIcon
      ? [STANDARD_PRESET_ICON_WIDTH, STANDARD_PRESET_ICON_HEIGHT]
      : iconOptions.iconImageSize ?? [STANDARD_PRESET_ICON_WIDTH, STANDARD_PRESET_ICON_HEIGHT];
    const placemark = new ymaps.Placemark(
      [pin.latitude, pin.longitude],
      {},
      {
        ...mapObjectInteractionOptions(),
        ...iconOptions,
        ...(draggable
          ? { draggable: true, iconShape: draggablePinIconShape(iconWidth, iconHeight) }
          : null),
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
    if (draggable && typeof onDragEnd === 'function') {
      placemark.events.add('dragend', () => {
        const [dragLatitude, dragLongitude] = placemark.geometry.getCoordinates();
        onDragEnd({ latitude: dragLatitude, longitude: dragLongitude });
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

    const changedFeatureIds = featureIdsNeedingPinRefresh(instance, prevCtx, nextCtx);
    for (const featureId of changedFeatureIds) {
      applyFeatureIconOptions(instance, featureId, nextCtx);
    }
    scheduleForceRefreshFeatureIcons(container, changedFeatureIds, nextCtx);

    instance.pinVisualDefaults = {
      selectedListingId: nextCtx.selectedListingId,
      selectedListingGroupIds: nextCtx.selectedListingGroupIds,
      visitedListingIds: nextCtx.visitedListingIds,
      darkMap: nextCtx.darkMap,
    };
  }

  function isCoordinateWithinBounds(latitude, longitude, bounds) {
    if (!bounds) return false;
    const [[lat1, lon1], [lat2, lon2]] = bounds;
    const minLat = Math.min(lat1, lat2);
    const maxLat = Math.max(lat1, lat2);
    const minLon = Math.min(lon1, lon2);
    const maxLon = Math.max(lon1, lon2);
    return latitude >= minLat && latitude <= maxLat && longitude >= minLon && longitude <= maxLon;
  }

  /**
   * Recenters the map on `pin` only when it has scrolled outside the current
   * viewport — used while swiping through the "all listings" tooltip carousel
   * so pins that are already on screen don't cause the map to jump around.
   */
  function panToPinIfNeeded(container, pin) {
    const instance = activeMaps.get(container);
    const map = instance?.map;
    if (!map || !pin) return;
    const latitude = Number(pin.latitude);
    const longitude = Number(pin.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    try {
      const bounds = map.getBounds();
      if (isCoordinateWithinBounds(latitude, longitude, bounds)) return;
      map.panTo([latitude, longitude], { duration: 280 });
    } catch { /* ignore */ }
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
   *
   * Separately, every custom pin/group icon (`iconLayout: 'default#image'`) is a plain `<img>`
   * pointing at a canvas `toDataURL()` bitmap — no text at all, so the fixes above don't touch
   * it. Android WebViews still treat that `<img>` as a native "draggable" element: tapping a
   * composite/group pin and then tapping elsewhere (any tiny finger movement in between reads as
   * a drag start) can kick off the browser's built-in image drag-and-select gesture, which
   * paints a solid highlight rectangle in the OS/app accent color at the drag's start/end box —
   * and it can get left on screen since we never get a real `dragend`/`drop` to clear it (we
   * `preventDefault()` the click, not the drag). `-webkit-user-drag: none` opts every element
   * out of that native drag affordance so a tap can never be misread as one.
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
        -webkit-user-drag: none;
        user-drag: none;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * `-webkit-user-drag: none` (above) opts elements out of Safari's *mouse*-driven native image
   * drag, but several WebViews (observed: Telegram iOS Mini App, some Android WebViews) still
   * start a native *touch*-driven "drag lift" on a placemark `<img>` from the CSS property alone
   * — a quick, slightly-off-axis tap-then-tap (exactly what tapping a pin and then tapping the
   * tooltip/another pin looks like) reads as a drag gesture. The OS then paints its solid
   * highlight-colored ghost box at the gesture's start/end position and — since we
   * `preventDefault()` the synthetic click, not the native `dragstart`/`dragend` pair — that
   * ghost is never told the drag ended, so it's left floating over the map indefinitely (the
   * blotchy pink/magenta rectangles reported after tapping pins). Intercepting `dragstart`
   * directly stops the gesture before the OS ever paints anything, which is more reliable across
   * WebView engines/versions than the CSS property alone. `selectstart` is a second belt for the
   * same class of engines ignoring `user-select: none` on dynamically-inserted map elements.
   * Delegated on `document` (once, globally) rather than per-container so it also covers markup
   * added by ymaps well after `ensureMapInteractionStyles()` first ran (clusters re-painting on
   * zoom, tooltip carousel re-renders, etc).
   */
  let mapNativeGestureGuardInstalled = false;

  function ensureMapNativeGestureGuard() {
    if (mapNativeGestureGuardInstalled) return;
    mapNativeGestureGuardInstalled = true;
    const preventInsideMapContainer = (event) => {
      if (event.target?.closest?.('.map-container')) {
        event.preventDefault();
      }
    };
    document.addEventListener('dragstart', preventInsideMapContainer, { passive: false });
    document.addEventListener('selectstart', preventInsideMapContainer, { passive: false });
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
  // Same silhouette as `iconHome()` in uydosh-icons.js (a listing = a home),
  // just recolored via `currentColor` instead of that icon's hardcoded pin
  // red, so it inherits the tile's white text color — this module keeps its
  // own inline SVGs rather than depending on uydosh-icons.js (see the layer
  // control icons above for the same pattern).
  const RESULTS_COUNT_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none">
    <path d="M4 10.5 12 4l8 6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
    <path d="M6 9.5V19a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1V9.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
  </svg>`;

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
        padding: 0 10px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        border-radius: 8px;
        background: #111;
        color: #fff;
        font: 700 13px/1 system-ui, -apple-system, sans-serif;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
        pointer-events: none;
        white-space: nowrap;
      }
      .${RESULTS_COUNT_TILE_CLASS} svg {
        width: 14px;
        height: 14px;
        display: block;
        flex: 0 0 auto;
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
    tile.innerHTML = `${RESULTS_COUNT_ICON_SVG}<span>${resultsCountLabel(count)}</span>`;
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
  const LAYER_CONTROL_BG_COLOR = '#000';
  const LAYER_CONTROL_MUTED_COLOR = '#94a3b8';
  const LAYER_CONTROL_ACTIVE_COLOR = '#60a5fa';
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
        background: ${LAYER_CONTROL_BG_COLOR};
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

  function attachLayerControls(container, instance, {
    onMetroModeChange,
    onDistrictVisibleChange,
  } = {}) {
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
      // Background stays solid black regardless of state; only the icon's
      // color communicates on/off (muted gray) vs. active (accent, or the
      // selected line's own color).
      let color = LAYER_CONTROL_MUTED_COLOR;
      let label = window.UyDosh?.t?.('map.layers.metro.show', lang) ?? 'Metro';
      if (mode === 'all') {
        color = LAYER_CONTROL_ACTIVE_COLOR;
        label = window.UyDosh?.t?.('map.layers.metro.all', lang) ?? label;
      } else if (lineId != null) {
        color = window.UyDosh?.metroLineColor?.(lineId) || LAYER_CONTROL_ACTIVE_COLOR;
        const lineName = window.UyDosh?.metroLineLabel?.(lineId, lang) || `Line ${lineId}`;
        label = (window.UyDosh?.t?.('map.layers.metro.line', lang) ?? 'Metro: {line}').replace('{line}', lineName);
      }
      metroBtn.style.color = color;
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
      districtBtn.style.color = visible ? LAYER_CONTROL_ACTIVE_COLOR : LAYER_CONTROL_MUTED_COLOR;
      districtBtn.setAttribute('aria-pressed', visible ? 'true' : 'false');
      districtBtn.setAttribute('aria-label', label);
      districtBtn.title = label;
    }

    metroBtn.addEventListener('click', () => {
      const nextMode = nextMetroLayerMode(instance.metroLayer.mode);
      setMetroLayerMode(container, nextMode).finally(refreshMetroButton);
      refreshMetroButton();
      onMetroModeChange?.(nextMode);
    });

    districtBtn.addEventListener('click', () => {
      const nextVisible = !instance.districtLayer.visible;
      setDistrictLayerVisible(container, nextVisible).finally(refreshDistrictButton);
      refreshDistrictButton();
      onDistrictVisibleChange?.(nextVisible);
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

  /**
   * Same blank/stuck-icon WebView issue as forceRefreshAllPinIcons above, but scoped to just
   * the handful of features a selection change actually touched (see refreshMapPinStates) —
   * e.g. tapping a pin to select it, then tapping a different one: the previously-selected
   * pin's setObjectOptions call (back to its normal size/color) can silently fail to repaint
   * in the Telegram iOS Mini App, leaving the old, now-stale bitmap on screen looking like a
   * plain colored box instead of the pin icon it's actually sized/positioned for. Re-applying
   * the *same* options via setObjectOptions alone wasn't enough to nudge some WebViews into
   * repainting, so this does a full remove+re-add of the feature (see
   * forceRebuildFeatureIcon) to force ObjectManager to throw away the stale overlay DOM node
   * and build a brand new one, without the cost of rebuilding every pin on the map per tap.
   */
  function scheduleForceRefreshFeatureIcons(container, featureIds, visualCtx) {
    if (!featureIds || featureIds.size === 0) return;
    const ids = [...featureIds];
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          const instance = activeMaps.get(container);
          if (!instance) return;
          const ctx = visualCtx ?? instance.pinVisualDefaults ?? pinVisualContext();
          for (const featureId of ids) {
            forceRebuildFeatureIcon(instance, featureId, ctx);
          }
        }, 250);
      });
    });
  }

  /**
   * More forceful variant of applyFeatureIconOptions: instead of updating the existing
   * overlay's options in place, removes the feature from the ObjectManager and re-adds it
   * with the new options, so Yandex has to build a brand new overlay DOM node from scratch.
   * Reserved for the retry pass in scheduleForceRefreshFeatureIcons above — plain
   * setObjectOptions is cheaper and works fine for the immediate (non-retry) update, so it's
   * still used there via applyFeatureIconOptions.
   */
  function forceRebuildFeatureIcon(instance, featureId, visualCtx) {
    const objectManager = instance.objectManager;
    if (!objectManager) {
      applyFeatureIconOptions(instance, featureId, visualCtx);
      return;
    }

    const featureKey = String(featureId);
    const group = instance.groupsByFeatureId?.get(featureKey);
    const id = group ? featureKey : Number(featureId);
    const options = group
      ? groupPlacemarkIconOptions(group, visualCtx)
      : (() => {
          const pin = instance.pinsById?.get(id);
          return pin ? placemarkIconOptions(pin, visualCtx) : null;
        })();
    if (!options) return;

    const feature = objectManager.objects.getById(id);
    if (!feature) {
      applyFeatureIconOptions(instance, featureId, visualCtx);
      return;
    }

    objectManager.remove([id]);
    objectManager.add({ ...feature, options: { ...feature.options, ...options } });
  }

  /**
   * Same blank-icon WebView issue as forceRefreshAllPinIcons above, but triggered by zoom
   * changes: when ObjectManager dissolves/reforms a cluster on zoom, the newly (re)painted
   * placemark icons for the pins that pop out of the cluster can come back blank in the
   * Telegram iOS Mini App, making the pin appear to "disappear" even though it's still
   * present and clickable. Debounced so a continuous pinch-zoom gesture only triggers one
   * refresh once the zoom level settles, instead of piling up a refresh per intermediate frame.
   */
  function scheduleForceRefreshPinIconsOnZoom(container) {
    const instance = activeMaps.get(container);
    if (!instance) return;
    if (instance.zoomPinIconRefreshTimer) {
      clearTimeout(instance.zoomPinIconRefreshTimer);
    }
    instance.zoomPinIconRefreshTimer = setTimeout(() => {
      const current = activeMaps.get(container);
      if (current) current.zoomPinIconRefreshTimer = null;
      forceRefreshAllPinIcons(container);
    }, 300);
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
   * Fits the map to every pin plus (when filtering by a location) that district's full
   * boundary, so panning/zooming after the pins render never crops the highlighted district
   * back out of view. Explicitly merging the district's own bounds here — rather than relying
   * on `map.geoObjects.getBounds()` to pick up the (already-rendered) boundary polygon — keeps
   * this correct regardless of the district layer's render/z-order timing.
   */
  function fitBoundsForPinsAndHighlight(map, validPins, highlightedDistrictBounds) {
    if (validPins.length <= 1) return;
    try {
      const combined = mergeBounds(boundsFromPins(validPins), highlightedDistrictBounds);
      const bounds = toYandexBounds(combined) ?? map.geoObjects.getBounds();
      if (bounds) {
        map.setBounds(bounds, { checkZoomRange: true, zoomMargin: 40 });
      }
    } catch { /* ignore */ }
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

  /**
   * One-time "you can drag this" bubble for a draggable single-pin map (see
   * `renderSinglePinMap`'s `dragHintText` option) — plain DOM overlay, not a
   * ymaps object, since it only ever needs to point at the pin's *initial*
   * position: the map is always centered on the pin when this map mounts, so
   * anchoring the bubble to the container's horizontal/vertical center (minus
   * half the selected-pin icon's height, see `MAP_PIN_ICON_SIZE_SELECTED` in
   * uydosh-map-pins.js) lines it up without needing to track the pin's
   * screen position through pans/zooms. It disappears for good the moment
   * the author actually drags the pin once — see the `dragstart` listener
   * below — so it never needs to catch up with the pin moving anyway.
   */
  const DRAG_HINT_CLASS = 'uydosh-map-drag-hint';
  const DRAG_HINT_STYLE_ID = 'uydosh-map-drag-hint-styles';
  // Half of MAP_PIN_ICON_SIZE_SELECTED (28px) plus a small gap, so the
  // bubble's arrow tip lands just above the pin instead of overlapping it.
  const DRAG_HINT_OFFSET_PX = 20;

  function ensureDragHintStyles() {
    if (document.getElementById(DRAG_HINT_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = DRAG_HINT_STYLE_ID;
    style.textContent = `
      .${DRAG_HINT_CLASS} {
        position: absolute;
        left: 50%;
        top: calc(50% - ${DRAG_HINT_OFFSET_PX}px);
        transform: translate(-50%, -100%);
        z-index: 15;
        max-width: calc(100% - 24px);
        padding: 6px 10px;
        border-radius: 8px;
        background: rgba(20, 20, 20, 0.86);
        color: #fff;
        font: 600 12px/1.3 system-ui, -apple-system, sans-serif;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        pointer-events: none;
        opacity: 1;
        transition: opacity 180ms ease;
      }
      .${DRAG_HINT_CLASS}::after {
        content: '';
        position: absolute;
        left: 50%;
        top: 100%;
        transform: translateX(-50%);
        border: 5px solid transparent;
        border-top-color: rgba(20, 20, 20, 0.86);
      }
      .${DRAG_HINT_CLASS}.uydosh-map-drag-hint-hide { opacity: 0; }
    `;
    document.head.appendChild(style);
  }

  function attachDragHintOverlay(container, text) {
    if (!container || !text) return null;
    ensureDragHintStyles();
    container.querySelector(`.${DRAG_HINT_CLASS}`)?.remove();
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }
    const el = document.createElement('div');
    el.className = DRAG_HINT_CLASS;
    el.textContent = text;
    container.appendChild(el);
    return {
      el,
      remove() {
        el.classList.add('uydosh-map-drag-hint-hide');
        setTimeout(() => el.remove(), 220);
      },
    };
  }

  /**
   * Moves the drag-hint bubble to sit just above the placemark's *current* on-screen
   * position — called on every `drag` event so the bubble tracks the pin's finger/mouse
   * position throughout the gesture instead of staying frozen at its initial (mount-time,
   * CSS-centered) spot. Switches the bubble from the default percentage-based centering
   * (`left: 50%` in `ensureDragHintStyles`) to explicit pixel coordinates — inline styles
   * win over the class's rules, so this only takes effect once a drag actually starts.
   */
  function repositionDragHint(el, container, map, coordinates) {
    if (!el || !container || !map) return;
    const projection = map.options.get('projection');
    if (!projection) return;
    const globalPixels = projection.toGlobalPixels(coordinates, map.getZoom());
    const [pageX, pageY] = map.converter.globalToPage(globalPixels);
    const containerRect = container.getBoundingClientRect();
    const left = pageX - containerRect.left - window.pageXOffset;
    const top = pageY - containerRect.top - window.pageYOffset;
    el.style.left = `${left}px`;
    el.style.top = `${top - DRAG_HINT_OFFSET_PX}px`;
  }

  async function renderSinglePinMap(container, {
    latitude,
    longitude,
    lang,
    listingTypeId,
    pin,
    selected = true,
    draggable = false,
    onPinDragEnd,
    dragHintText = '',
    zoomControl = false,
    standardIcon = false,
  } = {}) {
    await destroyMap(container);
    const ymaps = await loadYandexScript(lang);
    const controls = zoomControl
      ? [...MAP_CONTROLS, new ymaps.control.ZoomControl({ options: { size: 'small' } })]
      : MAP_CONTROLS;
    const map = new ymaps.Map(container, {
      center: [latitude, longitude],
      zoom: 15,
      controls,
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
    const placemark = createPlacemark(ymaps, mapPin, {
      selected,
      draggable,
      onDragEnd: onPinDragEnd,
      standardIcon,
    });
    map.geoObjects.add(placemark);
    if (draggable && dragHintText) {
      const hint = attachDragHintOverlay(container, dragHintText);
      if (hint) {
        // Track the pin's live position throughout the gesture (see
        // `repositionDragHint`) instead of dismissing on `dragstart` — some touch/
        // WebView environments (observed: Telegram mini app on iOS/Android) never
        // fire ymaps' synthetic `dragstart` for a touch-driven drag even though the
        // drag itself completes fine, so dismissing there left the hint frozen at its
        // original spot for the *entire* drag on those platforms. `dragend` is what
        // `onDragEnd` above already relies on, so it's the reliable one to clean up on.
        const followPinDuringDrag = () => {
          repositionDragHint(hint.el, container, map, placemark.geometry.getCoordinates());
        };
        const dismissHint = () => {
          placemark.events.remove('drag', followPinDuringDrag);
          placemark.events.remove('dragend', dismissHint);
          hint.remove();
        };
        placemark.events.add('drag', followPinDuringDrag);
        placemark.events.add('dragend', dismissHint);
      }
    }
    ensureMapInteractionStyles();
    ensureMapNativeGestureGuard();
    applyMapTileTheme(container, window.UyDosh?.prefersDarkMapPins?.() ?? false);
    const instance = { map, placemark };
    attachUserLocationControl(ymaps, map, instance);
    activeMaps.set(container, instance);
    trackedContainers.add(container);
    scheduleMapReflow(container);
    return map;
  }

  // Max time to wait for a pedestrian MultiRoute to resolve before giving up
  // on it and drawing a plain straight line instead (see `setPinGuideLines`)
  // — the Router request can fail silently (no `requestfail`, it just never
  // fires) if the API key's account has no Router access/quota, so a bare
  // `requestfail` listener alone isn't enough to guarantee something ends up
  // on screen.
  const GUIDE_LINE_ROUTE_TIMEOUT_MS = 6000;

  /**
   * Guide paths from a `renderSinglePinMap` pin to a set of other points —
   * used for the create-listing wizard's "walking distance to each tagged
   * metro station" preview, and the listing detail page's per-station
   * "draw route" buttons. Tries a real pedestrian `multiRouter.MultiRoute`
   * first (routingMode: 'pedestrian', no live tracking/re-routing — a single
   * static route lookup is exactly what MultiRoute is for, and it's covered
   * by Yandex's free-use terms' combined Geocoder+Router daily allowance,
   * see https://yandex.ru/legal/maps_api/en/ §2.3.9.3), falling back to a
   * plain dashed straight `Polyline` if that never pans out — either because
   * `ymaps.multiRouter` isn't available at all, the request comes back with
   * `requestfail` (e.g. no Router product enabled on this API key/account),
   * or it just never resolves within `GUIDE_LINE_ROUTE_TIMEOUT_MS`. Without
   * this fallback, any of those cases left the button that triggers this
   * looking like it did nothing at all. `reverseGeocoding` is left off since
   * both endpoints are already known coordinates — turning it on would
   * silently add a Geocoder call per route just to label the (hidden,
   * `wayPointVisible: false`) endpoint markers.
   *
   * Safe to call repeatedly — e.g. every time the selected-stations list
   * changes or the pin gets dragged: it fully replaces the previous set of
   * routes (a stale in-flight request from a superseded call is ignored via
   * `guideLinesToken`, not left to clobber a newer result) and, once every
   * route in the new batch has resolved/failed/fallen back, re-fits the
   * camera around the pin plus every route so the whole picture stays on
   * screen.
   */
  function setPinGuideLines(container, lines = []) {
    const instance = activeMaps.get(container);
    const ymaps = window.ymaps;
    if (!instance?.map || !instance?.placemark) return;

    const token = (instance.guideLinesToken = (instance.guideLinesToken || 0) + 1);

    if (!instance.guideLinesLayer) {
      instance.guideLinesLayer = new ymaps.GeoObjectCollection();
      instance.map.geoObjects.add(instance.guideLinesLayer);
    }
    const layer = instance.guideLinesLayer;
    layer.removeAll();

    const validLines = (lines || [])
      .map((line) => ({
        latitude: Number(line.latitude),
        longitude: Number(line.longitude),
        color: line.color || '#3b82f6',
      }))
      .filter((line) => Number.isFinite(line.latitude) && Number.isFinite(line.longitude));
    if (validLines.length === 0) return;

    const map = instance.map;
    const pinCoords = instance.placemark.geometry.getCoordinates();
    let pending = validLines.length;

    const fitOnceAllSettled = () => {
      if (instance.guideLinesToken !== token) return; // superseded by a newer call
      pending -= 1;
      if (pending > 0) return;
      try {
        const bounds = map.geoObjects.getBounds();
        if (bounds) map.setBounds(bounds, { checkZoomRange: true, zoomMargin: 48 });
      } catch { /* ignore */ }
    };

    const lang = window.UyDosh?.getLang?.();
    for (const line of validLines) {
      let settled = false;
      let timer = null;
      const destCoords = [line.latitude, line.longitude];
      const addInfoLabel = (meters, minutes) => {
        if (!Number.isFinite(meters) || !Number.isFinite(minutes)) return;
        try {
          layer.add(createRouteInfoPlacemark(
            ymaps,
            midpointCoordinates(pinCoords, destCoords),
            meters,
            minutes,
            lang,
          ));
        } catch { /* the route/line itself already drew — the label is a nice-to-have */ }
      };
      const drawStraightFallback = () => {
        if (instance.guideLinesToken !== token) return;
        const straight = new ymaps.Polyline(
          [pinCoords, destCoords],
          {},
          { strokeColor: line.color, strokeWidth: 3, strokeStyle: 'shortdash' },
        );
        layer.add(straight);
        const meters = window.UyDosh?.haversineMeters?.(pinCoords[0], pinCoords[1], line.latitude, line.longitude);
        addInfoLabel(meters, window.UyDosh?.estimatedWalkMinutes?.(meters));
      };
      const finish = () => {
        if (settled) return;
        settled = true;
        if (timer != null) clearTimeout(timer);
        fitOnceAllSettled();
      };

      if (!ymaps?.multiRouter) {
        reportYandexMapIssue('pedestrian_route_unavailable', 'ymaps.multiRouter module not available');
        drawStraightFallback();
        finish();
        continue;
      }

      timer = setTimeout(() => {
        reportYandexMapIssue(
          'pedestrian_route_timeout',
          `Pedestrian route request timed out after ${GUIDE_LINE_ROUTE_TIMEOUT_MS}ms`,
        );
        drawStraightFallback();
        finish();
      }, GUIDE_LINE_ROUTE_TIMEOUT_MS);

      const route = new ymaps.multiRouter.MultiRoute(
        {
          referencePoints: [pinCoords, [line.latitude, line.longitude]],
          params: { routingMode: 'pedestrian', reverseGeocoding: false },
        },
        {
          wayPointVisible: false,
          boundsAutoApply: false,
          routeActiveStrokeColor: line.color,
          routeActiveStrokeWidth: 4,
          routeStrokeColor: line.color,
          routeStrokeWidth: 4,
        },
      );
      route.model.events.add('requestsuccess', () => {
        if (instance.guideLinesToken === token) {
          try {
            const activeRoute = route.getActiveRoute();
            const distance = activeRoute?.properties?.get('distance');
            const duration = activeRoute?.properties?.get('duration');
            if (distance?.value != null && duration?.value != null) {
              addInfoLabel(distance.value, duration.value / 60);
            }
          } catch { /* the route itself already drew — the label is a nice-to-have */ }
        }
        finish();
      });
      route.model.events.add('requestfail', (event) => {
        const routeErr = event?.get?.('error');
        console.warn('[UyDoshMap] Pedestrian route request failed, falling back to a straight line', routeErr);
        reportYandexMapIssue('pedestrian_route_failed', 'Pedestrian route request failed', routeErr);
        drawStraightFallback();
        finish();
      });
      layer.add(route);
    }
  }

  /**
   * Real pedestrian walking time + distance from one origin to a batch of
   * destinations — headless (`multiRouter.MultiRouteModel`, no `MultiRoute`
   * view, nothing drawn/added to a map), so this works from panels that
   * have no map on screen at all (e.g. the "find nearby metro stations"
   * chip list in the create-listing wizard, see `findNearbyStations` in
   * telegram-create.js). One model per destination — the JS API has no
   * "distance to many points from one origin" batch call — each counting
   * as one Router access under Yandex's free combined Geocoder+Router daily
   * allowance (see `setPinGuideLines` above for the cost breakdown).
   *
   * Resolves with a `Map` from the input array's index to
   * `{ minutes, meters }`; any destination whose route fails, times out, or
   * comes back with unusable data is simply absent from the map — the
   * caller keeps whatever straight-line estimate it already had for those,
   * so a slow/broken Router response never blocks or breaks the UI, it just
   * misses out on the more accurate number.
   */
  function fetchPedestrianWalkTimes(lang, origin, destinations, { timeoutMs = 8000 } = {}) {
    if (!Array.isArray(destinations) || destinations.length === 0) {
      return Promise.resolve(new Map());
    }
    return loadYandexScript(lang).then((ymaps) => {
      if (!ymaps?.multiRouter) return new Map();
      const results = new Map();
      const tasks = destinations.map((dest, index) => new Promise((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        const timer = setTimeout(finish, timeoutMs);
        try {
          const model = new ymaps.multiRouter.MultiRouteModel(
            [[origin.latitude, origin.longitude], [dest.latitude, dest.longitude]],
            { routingMode: 'pedestrian', reverseGeocoding: false },
          );
          model.events.add('requestsuccess', () => {
            clearTimeout(timer);
            try {
              const route = model.getRoutes()[0];
              const meters = route?.properties.get('distance')?.value;
              const seconds = route?.properties.get('duration')?.value;
              if (Number.isFinite(meters) && Number.isFinite(seconds)) {
                results.set(index, { meters, minutes: seconds / 60 });
              }
            } catch { /* ignore — index just stays unresolved */ }
            finish();
          });
          model.events.add('requestfail', () => {
            clearTimeout(timer);
            finish();
          });
        } catch {
          clearTimeout(timer);
          finish();
        }
      }));
      return Promise.all(tasks).then(() => results);
    }).catch(() => new Map());
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
    highlightedLocationId = null,
    initialMetroLayerMode = 'off',
    initialDistrictLayerVisible = false,
    onMetroLayerModeChange,
    onDistrictLayerVisibleChange,
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

    // A location filter always wins the initial camera framing (bounds of that district,
    // extended to cover any pins outside it) — mirrors the mobile app's `_moveInitialCamera`
    // prioritizing `highlightedLocationId` over plain pin-bounds fitting.
    const normalizedHighlightId = Number(highlightedLocationId) > 0 ? Number(highlightedLocationId) : null;
    let allDistrictsForHighlight = null;
    let highlightedDistrict = null;
    if (normalizedHighlightId != null) {
      try {
        allDistrictsForHighlight = await loadDistrictBoundaries();
        highlightedDistrict = allDistrictsForHighlight.find(
          (d) => Number(d.locationId) === normalizedHighlightId,
        ) || null;
      } catch (err) {
        console.warn('[UyDoshMap] Failed to load highlighted district boundary', err);
      }
    }

    const ymaps = await loadYandexScript(lang);
    const pinGroups = groupPinsByCoordinate(validPins);
    let location = locationFromPins(validPins);
    const highlightedDistrictBounds = highlightedDistrict ? boundsFromRing(highlightedDistrict.outerRing) : null;
    if (highlightedDistrictBounds) {
      location = locationFromBounds(extendBoundsWithPins(highlightedDistrictBounds, validPins));
    }
    const map = new ymaps.Map(container, {
      center: location.center,
      zoom: location.zoom,
      controls: MAP_CONTROLS,
    }, {
      suppressMapOpenBlock: true,
    });

    map.events.add('click', () => {
      closeMapBalloon(map);
      clearSelectedMetroStation(container);
      onMapClick?.();
    });

    const mapInstance = { map };
    mapInstance.districtLayer = {
      visible: initialDistrictLayerVisible === true,
      highlightedLocationId: normalizedHighlightId,
      allDistricts: allDistrictsForHighlight,
      labelObjects: null,
      collection: new ymaps.GeoObjectCollection(),
      syncToken: 0,
    };
    mapInstance.metroLayer = {
      mode: initialMetroLayerMode || 'off',
      objectsByLine: null,
      collection: new ymaps.GeoObjectCollection(),
      // Tapped station's info tooltip + walk-radius circle (see `setSelectedMetroStation`) —
      // a separate collection/z-order from the station icons themselves so it always renders
      // on top of them regardless of add order.
      selection: {
        stationId: null,
        collection: new ymaps.GeoObjectCollection(),
      },
    };
    map.geoObjects.add(mapInstance.districtLayer.collection);
    map.geoObjects.add(mapInstance.metroLayer.collection);
    map.geoObjects.add(mapInstance.metroLayer.selection.collection);
    activeMaps.set(container, mapInstance);
    // Re-apply the caller's remembered layer toggle state (see `initialMetroLayerMode`/
    // `initialDistrictLayerVisible` above) so switching a listing filter — which always
    // rebuilds the map from scratch — doesn't silently turn the metro/district overlays
    // back off if the user had already turned them on.
    if (normalizedHighlightId != null || mapInstance.districtLayer.visible) {
      syncDistrictLayer(container);
    }
    if (mapInstance.metroLayer.mode !== 'off') {
      setMetroLayerMode(container, mapInstance.metroLayer.mode);
    }
    attachUserLocationControl(ymaps, map, mapInstance);
    autoRequestUserLocation(container, ymaps, mapInstance, {
      onUnavailable: onLocationUnavailable,
      onResolved: onLocationResolved,
    });
    attachResultsCountTile(container, total ?? validPins.length);
    attachLayerControls(container, mapInstance, {
      onMetroModeChange: onMetroLayerModeChange,
      onDistrictVisibleChange: onDistrictLayerVisibleChange,
    });
    map.events.add('boundschange', (event) => {
      if (event.get('newZoom') === event.get('oldZoom')) return;
      refreshDistrictLabelVisibility(mapInstance);
      scheduleForceRefreshPinIconsOnZoom(container);
    });

    const pinVisualDefaults = pinVisualContext({
      selectedListingId,
      selectedListingGroupIds,
      visitedListingIds,
      darkMap,
    });
    ensureMapInteractionStyles();
    ensureMapNativeGestureGuard();
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
      fitBoundsForPinsAndHighlight(map, validPins, highlightedDistrictBounds);
      return map;
    }

    fitBoundsForPinsAndHighlight(map, validPins, highlightedDistrictBounds);

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
    setPinGuideLines,
    fetchPedestrianWalkTimes,
    renderPinsMap,
    setHighlightedDistrict,
    locateUserFromTap,
    refreshMapPinStates,
    panToPinIfNeeded,
    destroyMap,
    reflowMap,
    reflowAllMaps,
  };
})();
