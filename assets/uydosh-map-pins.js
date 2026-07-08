// UyDosh Web — canvas-drawn Yandex Map pin/group/cluster/user-location icons,
// the manual light/dark map theme toggle, visited-listings tracking, Telegram
// geolocation, and the phone/Telegram contact bar shown on listing details.
// Depends on uydosh-icons.js (listing type colors/consts). Load after it.

/** Match mobile app listing-type badge colors (dark theme), except
 *  `group_forming`: mobile uses its purple brand color there, but the web map
 *  intentionally sticks to a blue/orange palette (no purple) across every pin
 *  state — see MAP_PIN_FILL.selected below. */
const LISTING_TYPE_COLORS = {
  1: '#64B5F6', // room_needed
  2: '#FF9800', // roommate_needed
  3: '#0288D1', // group_forming
};

/** Material-style SVG paths for listing-type map pin glyphs (viewBox 0 0 24 24). */
const LISTING_TYPE_MAP_PIN_ICON_PATHS = {
  1: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5z',
  2: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 2.05 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  '2_absent': 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  3: 'M12 12.75c1.63 0 3.07.39 4.24.9 1.08.48 1.76 1.56 1.76 2.73V18H6v-1.62c0-1.17.68-2.25 1.76-2.73 1.17-.52 2.61-.9 4.24-.9zM12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM18.59 15.41A5.978 5.978 0 0 0 18 15c-1.66 0-3 1.34-3 3 0 .35.06.68.16 1H18v-3.59zM6.16 16c.1-.32.16-.65.16-1 0-1.66-1.34-3-3-3-.59 0-1.14.17-1.59.41V18h4.43z',
  default: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5z',
};

// Yandex Maps JS 2.1 uses iconImageSize as on-screen CSS px (not Flutter bitmap px).
const MAP_PIN_ICON_SIZE = 24;
const MAP_PIN_ICON_SIZE_SELECTED = 28;
const mapPinIconCache = new Map();

/** Loosely matches Flutter map pin fills (yandex_map_widget_icons.dart), except
 *  `selected`: mobile highlights the active pin with its purple brand color
 *  (AppColors.primary), but the web map avoids purple entirely and uses a
 *  vivid blue instead — distinct enough from the pastel `room_needed` blue
 *  and the deeper `group_forming` blue above to still read as "selected". */
const MAP_PIN_FILL = {
  default: '#000000',
  dark: '#142A45',
  visited: '#9E9E9E',
  visitedDark: '#757575',
  selected: '#2962FF',
};

const VISITED_LISTINGS_STORAGE_KEY = 'uydosh_visited_listing_ids';

/**
 * Manual light/dark override (mini app header sun/moon toggle) — beats Telegram theme + system
 * preference. This only controls the app's own interface palette (cards, header, filters, …);
 * the Yandex map (tiles + pins) is intentionally excluded and always stays in its light
 * appearance — see prefersDarkMapPins() in this file and applyMapTileTheme() in yandex-map.js.
 */
const MANUAL_THEME_STORAGE_KEY = 'uydosh_manual_theme';
const UI_THEME_VARS = {
  dark: {
    '--bg': '#061525',
    '--fg': 'rgba(255, 255, 255, 0.92)',
    '--muted': 'rgba(255, 255, 255, 0.7)',
    '--card': 'rgba(255, 255, 255, 0.06)',
    '--stroke': 'rgba(255, 255, 255, 0.12)',
  },
  light: {
    '--bg': '#f6f7fb',
    '--fg': 'rgba(15, 23, 42, 0.92)',
    '--muted': 'rgba(15, 23, 42, 0.7)',
    '--card': 'rgba(15, 23, 42, 0.04)',
    '--stroke': 'rgba(15, 23, 42, 0.12)',
  },
};

function getManualTheme() {
  try {
    const saved = localStorage.getItem(MANUAL_THEME_STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : null;
  } catch {
    return null;
  }
}

function applyManualThemeVars(uiTheme) {
  const vars = UI_THEME_VARS[uiTheme];
  if (!vars) return;
  const root = document.documentElement;
  for (const [prop, value] of Object.entries(vars)) {
    root.style.setProperty(prop, value);
  }
}

/** Re-apply a saved manual theme on load, before/after Telegram theme colors land. */
function applyStoredManualTheme() {
  const theme = getManualTheme();
  if (theme) applyManualThemeVars(theme);
}

function setManualTheme(theme) {
  if (theme !== 'light' && theme !== 'dark') return;
  try {
    localStorage.setItem(MANUAL_THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
  applyManualThemeVars(theme);
  document.dispatchEvent(new CustomEvent('uydosh:themechange', { detail: { theme } }));
}

/**
 * Currently active app UI theme, in priority order:
 * 1. Manual override (header sun/moon toggle) — always wins once set.
 * 2. Telegram's own theme (`Telegram.WebApp.colorScheme`) when running inside a Mini App —
 *    this can differ from the OS setting (Telegram's theme is configured independently).
 * 3. OS/browser `prefers-color-scheme` — fallback when opened outside Telegram.
 */
function currentUiTheme() {
  const manual = getManualTheme();
  if (manual) return manual;
  if (typeof window === 'undefined') return 'dark';
  try {
    const tgScheme = window.Telegram?.WebApp?.colorScheme;
    if (tgScheme === 'light' || tgScheme === 'dark') return tgScheme;
  } catch { /* ignore */ }
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light';
  } catch {
    return 'dark';
  }
}

function toggleManualTheme() {
  const next = currentUiTheme() === 'dark' ? 'light' : 'dark';
  setManualTheme(next);
  return next;
}

/**
 * The Yandex map (tiles + pins) always renders in its light appearance — by design it never
 * switches to a dark style, regardless of the app's UI theme, system preference, or Telegram
 * theme. See applyMapTileTheme() in yandex-map.js.
 */
function prefersDarkMapPins() {
  return false;
}

function loadVisitedListingIds() {
  if (typeof sessionStorage === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(VISITED_LISTINGS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map(Number).filter((id) => id > 0));
  } catch {
    return new Set();
  }
}

function markListingVisited(listingId) {
  const id = Number(listingId);
  if (!id) return false;
  const visited = loadVisitedListingIds();
  if (visited.has(id)) return false;
  visited.add(id);
  try {
    sessionStorage.setItem(
      VISITED_LISTINGS_STORAGE_KEY,
      JSON.stringify([...visited]),
    );
  } catch {
    /* ignore */
  }
  return true;
}

function resolveMapPinIconStyle(pin, {
  selectedListingId = null,
  visitedListingIds = null,
  darkMap = null,
  selected = false,
} = {}) {
  const listingId = Number(pin?.id);
  const isDark = darkMap ?? prefersDarkMapPins();
  const visited = visitedListingIds ?? loadVisitedListingIds();
  const isSelected =
    selected ||
    (selectedListingId != null && listingId > 0 && listingId === Number(selectedListingId));

  if (isSelected) {
    return { variant: 'selected', selected: true, visited: false, darkMap: isDark };
  }
  if (listingId > 0 && visited.has(listingId)) {
    return { variant: 'visited', selected: false, visited: true, darkMap: isDark };
  }
  if (isDark) {
    return { variant: 'dark', selected: false, visited: false, darkMap: true };
  }
  return { variant: 'default', selected: false, visited: false, darkMap: false };
}

function mapPinFillColor(style) {
  if (style.selected) return MAP_PIN_FILL.selected;
  if (style.visited) {
    return style.darkMap ? MAP_PIN_FILL.visitedDark : MAP_PIN_FILL.visited;
  }
  if (style.darkMap) return MAP_PIN_FILL.dark;
  return MAP_PIN_FILL.default;
}

function resolveListingTypeIdFromPin(pin) {
  const typeId = Number(pin?.listing_type_id);
  if (typeId > 0) return typeId;
  const code = String(pin?.listing_type_code ?? '').trim();
  if (code === 'room_needed') return 1;
  if (code === 'roommate_needed') return 2;
  if (code === 'group_forming') return 3;
  return 0;
}

function resolveMapPinIconKey(pin) {
  const typeId = resolveListingTypeIdFromPin(pin);
  if (typeId === 2) {
    const hostResident = pin?.host_resident;
    const absentHost =
      hostResident === false ||
      hostResident === 0 ||
      hostResident === 'false';
    if (absentHost) return '2_absent';
  }
  return typeId > 0 ? String(typeId) : 'default';
}

function drawMapPinIconPath(ctx, pathD, centerX, centerY, iconSize) {
  const path = new Path2D(pathD);
  const scale = iconSize / 24;
  ctx.save();
  ctx.translate(centerX - iconSize / 2, centerY - iconSize / 2);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff';
  ctx.fill(path);
  ctx.restore();
}

function drawRoundRect(ctx, x, y, width, height, radius) {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius);
    return;
  }
  const r = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

/**
 * Canvas bitmap for Yandex Maps placemarks (mobile parity, minus purple —
 * see MAP_PIN_FILL above): black/blue/gray fill + white listing-type glyph +
 * white outline.
 */
function createMapPinIcon(pin, options = {}) {
  if (typeof document === 'undefined') return null;

  const style = resolveMapPinIconStyle(pin, options);
  const iconKey = resolveMapPinIconKey(pin);
  const fillColor = mapPinFillColor(style);
  const pinSize = style.selected ? MAP_PIN_ICON_SIZE_SELECTED : MAP_PIN_ICON_SIZE;
  const cacheKey = `${iconKey}:${style.variant}:${pinSize}`;
  const cached = mapPinIconCache.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  // Draw at 1× logical px — Yandex Maps + Telegram WebView treat data-URL bitmaps
  // as iconImageSize in CSS px; a retina canvas makes pins ~devicePixelRatio too large.
  canvas.width = pinSize;
  canvas.height = pinSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const center = pinSize / 2;
  const radius = pinSize * 0.39;
  const outlineWidth = style.selected ? 2 : 1.5;
  const shadowOffsetY = style.selected ? 2 : 1;
  const shadowAlpha = style.selected ? 0.35 : 0.18;

  ctx.beginPath();
  ctx.arc(center, center + shadowOffsetY, radius + outlineWidth, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(center, center, radius + outlineWidth, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fillStyle = fillColor;
  ctx.fill();

  const pathD =
    LISTING_TYPE_MAP_PIN_ICON_PATHS[iconKey] ||
    LISTING_TYPE_MAP_PIN_ICON_PATHS.default;
  drawMapPinIconPath(ctx, pathD, center, center, pinSize * (style.selected ? 0.54 : 0.52));

  const result = {
    href: canvas.toDataURL('image/png'),
    size: [pinSize, pinSize],
    offset: [-pinSize / 2, -pinSize / 2],
    zIndex: style.selected ? 1000 : 100,
  };
  mapPinIconCache.set(cacheKey, result);
  return result;
}

const MAP_GROUP_PIN_WIDTH = 54;
const MAP_GROUP_PIN_HEIGHT = 28;
const MAP_GROUP_PIN_WIDTH_SELECTED = 58;
const MAP_GROUP_PIN_HEIGHT_SELECTED = 30;
const mapGroupPinIconCache = new Map();

function resolveMapGroupPinStyle(group, {
  selectedListingId = null,
  selectedListingGroupIds = null,
  visitedListingIds = null,
  darkMap = null,
  selected = false,
} = {}) {
  const isDark = darkMap ?? prefersDarkMapPins();
  const visited = visitedListingIds ?? loadVisitedListingIds();
  const groupIds = new Set(
    (selectedListingGroupIds || [])
      .map(Number)
      .filter((id) => id > 0),
  );
  const selectedId = selectedListingId != null ? Number(selectedListingId) : null;
  const pins = Array.isArray(group?.pins) ? group.pins : [];
  const isSelected =
    selected ||
    pins.some((pin) => {
      const listingId = Number(pin?.id);
      if (listingId <= 0) return false;
      return listingId === selectedId || groupIds.has(listingId);
    });
  if (isSelected) {
    return { variant: 'selected', selected: true, visited: false, darkMap: isDark };
  }
  const allVisited = pins.length > 0 && pins.every((pin) => {
    const listingId = Number(pin?.id);
    return listingId > 0 && visited.has(listingId);
  });
  if (allVisited) {
    return { variant: 'visited', selected: false, visited: true, darkMap: isDark };
  }
  if (isDark) {
    return { variant: 'dark', selected: false, visited: false, darkMap: true };
  }
  return { variant: 'default', selected: false, visited: false, darkMap: false };
}

function mapGroupPinFillColor(style) {
  if (style.selected) return MAP_PIN_FILL.selected;
  if (style.visited) {
    return style.darkMap ? MAP_PIN_FILL.visitedDark : MAP_PIN_FILL.visited;
  }
  if (style.darkMap) return MAP_PIN_FILL.dark;
  return MAP_PIN_FILL.default;
}

/**
 * Pill-shaped composite pin icon with listing count (mobile parity).
 */
function createMapGroupPinIcon(group, options = {}) {
  if (typeof document === 'undefined') return null;
  const pins = Array.isArray(group?.pins) ? group.pins : [];
  const count = pins.length;
  if (count <= 1) return createMapPinIcon(pins[0], options);

  const style = resolveMapGroupPinStyle(group, options);
  const representativePin = pins[0];
  const iconKey = resolveMapPinIconKey(representativePin);
  const fillColor = mapGroupPinFillColor(style);
  const width = style.selected ? MAP_GROUP_PIN_WIDTH_SELECTED : MAP_GROUP_PIN_WIDTH;
  const height = style.selected ? MAP_GROUP_PIN_HEIGHT_SELECTED : MAP_GROUP_PIN_HEIGHT;
  const cacheKey = `group:${count}:${iconKey}:${style.variant}:${width}x${height}`;
  const cached = mapGroupPinIconCache.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const centerX = width / 2;
  const centerY = height / 2;
  const pillHeight = height;
  const pillWidth = width;
  const radius = pillHeight / 2;
  const outlineWidth = style.selected ? 2 : 1.5;

  ctx.beginPath();
  drawRoundRect(
    ctx,
    centerX - pillWidth / 2,
    centerY - pillHeight / 2 + 1,
    pillWidth,
    pillHeight,
    radius,
  );
  ctx.fillStyle = style.selected ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.24)';
  ctx.fill();

  ctx.beginPath();
  drawRoundRect(
    ctx,
    centerX - (pillWidth / 2) - outlineWidth,
    centerY - (pillHeight / 2) - outlineWidth,
    pillWidth + outlineWidth * 2,
    pillHeight + outlineWidth * 2,
    radius + outlineWidth,
  );
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.beginPath();
  drawRoundRect(
    ctx,
    centerX - pillWidth / 2,
    centerY - pillHeight / 2,
    pillWidth,
    pillHeight,
    radius,
  );
  ctx.fillStyle = fillColor;
  ctx.fill();

  const label = count > 99 ? '99+' : String(count);
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${label.length > 2 ? 10 : 12}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const labelWidth = ctx.measureText(label).width;
  const iconSize = style.selected ? 13 : 12;
  const gap = 3;
  const contentWidth = labelWidth + gap + iconSize;
  const contentLeft = centerX - contentWidth / 2;
  ctx.fillText(label, contentLeft, centerY + 0.5);

  const pathD =
    LISTING_TYPE_MAP_PIN_ICON_PATHS[iconKey] ||
    LISTING_TYPE_MAP_PIN_ICON_PATHS.default;
  drawMapPinIconPath(ctx, pathD, contentLeft + labelWidth + gap + iconSize / 2, centerY, iconSize);

  const result = {
    href: canvas.toDataURL('image/png'),
    size: [width, height],
    offset: [-width / 2, -height / 2],
    zIndex: style.selected ? 1000 : 100,
  };
  mapGroupPinIconCache.set(cacheKey, result);
  return result;
}

const USER_LOCATION_PIN_SIZE = 22;
const USER_LOCATION_PIN_FILL = '#F44336';
const MAP_CLUSTER_PIN_SIZE = 32;
let userLocationPinIconCache = null;
let mapClusterPinIconCache = null;

// Brand blue (`--brand2` in telegram-shared.css) — kept as a literal here since
// this canvas-drawing code runs independent of any stylesheet being loaded.
const MAP_CLUSTER_PIN_FILL = '#60a5fa';

/** Compact brand-blue cluster bubble (replaces oversized islands#blueClusterIcons preset). */
function createMapClusterPinIcon() {
  if (typeof document === 'undefined') return null;
  if (mapClusterPinIconCache) return mapClusterPinIconCache;

  const size = MAP_CLUSTER_PIN_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const center = size / 2;
  const radius = size * 0.34;
  const outlineWidth = 1.5;

  ctx.beginPath();
  ctx.arc(center, center + 1, radius + outlineWidth, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(center, center, radius + outlineWidth, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fillStyle = MAP_CLUSTER_PIN_FILL;
  ctx.fill();

  mapClusterPinIconCache = {
    href: canvas.toDataURL('image/png'),
    size: [size, size],
    offset: [-size / 2, -size / 2],
  };
  return mapClusterPinIconCache;
}

const METRO_STATION_PIN_SIZE = 20;
const metroStationPinIconCache = new Map();

/** Subway glyph stroke paths (viewBox 0 0 24 24) — mirrors iconMetro() in uydosh-icons.js. */
const METRO_PIN_GLYPH_PATHS = [
  { d: 'M7 3h10a3 3 0 0 1 3 3v10a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V6a3 3 0 0 1 3-3Z', lineWidth: 2 },
  { d: 'M7 8h10', lineWidth: 2 },
  { d: 'M7 21l-2 2M17 21l2 2', lineWidth: 2 },
  { d: 'M8 17h0.01M16 17h0.01', lineWidth: 3 },
];

function metroPinGlyphSvg(centerX, centerY, iconSize) {
  const scale = iconSize / 24;
  const tx = centerX - iconSize / 2;
  const ty = centerY - iconSize / 2;
  const paths = METRO_PIN_GLYPH_PATHS.map(
    ({ d, lineWidth }) =>
      `<path d="${d}" fill="none" stroke="#ffffff" stroke-width="${lineWidth}" stroke-linecap="round" stroke-linejoin="round"/>`,
  ).join('');
  return `<g transform="translate(${tx} ${ty}) scale(${scale})">${paths}</g>`;
}

/**
 * SVG-based map pin for metro stations: a small line-colored circle with a white subway glyph
 * on top (mobile parity — see `Icons.directions_subway_rounded` in yandex_map_widget_icons.dart).
 * Line 4 gets a black outline instead of white since its orange fill doesn't contrast well
 * against a white ring.
 *
 * Uses an inline SVG (rather than a canvas-rasterized PNG) so the icon stays crisp on
 * high-density screens: Yandex Maps scales `iconImageHref` to `iconImageSize` in CSS px, and a
 * vector source has no fixed pixel grid to upscale/blur, unlike a small PNG raster.
 */
function createMetroStationPinIcon(line) {
  const lineId = Number(line) || 0;
  const cacheKey = String(lineId);
  const cached = metroStationPinIconCache.get(cacheKey);
  if (cached) return cached;

  const fillColor = metroLineColor(lineId) || '#616161';
  const outlineColor = lineId === 4 ? '#000000' : '#ffffff';
  const pinSize = METRO_STATION_PIN_SIZE;
  const center = pinSize / 2;
  const radius = pinSize * 0.39;
  const outlineWidth = 1.5;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pinSize}" height="${pinSize}" viewBox="0 0 ${pinSize} ${pinSize}">` +
    `<circle cx="${center}" cy="${center + 1}" r="${radius + outlineWidth}" fill="rgba(0,0,0,0.2)"/>` +
    `<circle cx="${center}" cy="${center}" r="${radius + outlineWidth}" fill="${outlineColor}"/>` +
    `<circle cx="${center}" cy="${center}" r="${radius}" fill="${fillColor}"/>` +
    metroPinGlyphSvg(center, center, pinSize * 0.56) +
    `</svg>`;

  const result = {
    href: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    size: [pinSize, pinSize],
    offset: [-pinSize / 2, -pinSize / 2],
    zIndex: 50,
  };
  metroStationPinIconCache.set(cacheKey, result);
  return result;
}

/** Red dot with white ring — matches mobile user-location pin. */
function createUserLocationPinIcon() {
  if (typeof document === 'undefined') return null;
  if (userLocationPinIconCache) return userLocationPinIconCache;

  const pinSize = USER_LOCATION_PIN_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = pinSize;
  canvas.height = pinSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const center = pinSize / 2;
  const outerRadius = pinSize * 0.39;
  const innerRadius = outerRadius - 2;

  ctx.beginPath();
  ctx.arc(center, center + 2, outerRadius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(center, center, outerRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(center, center, innerRadius, 0, Math.PI * 2);
  ctx.fillStyle = USER_LOCATION_PIN_FILL;
  ctx.fill();

  userLocationPinIconCache = {
    href: canvas.toDataURL('image/png'),
    size: [pinSize, pinSize],
    offset: [-pinSize / 2, -pinSize / 2],
    zIndex: 2000,
  };
  return userLocationPinIconCache;
}

function initTelegramLocationManager() {
  const loc = window.Telegram?.WebApp?.LocationManager;
  if (!loc || typeof loc.init !== 'function') {
    return Promise.resolve(null);
  }
  if (loc.isInited) return Promise.resolve(loc);
  return new Promise((resolve) => {
    loc.init(() => resolve(loc));
  });
}

function requestUserLocationFromBrowser() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('browser_geolocation_unavailable'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = Number(position?.coords?.latitude);
        const longitude = Number(position?.coords?.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          reject(new Error('browser_geolocation_invalid'));
          return;
        }
        resolve({ latitude, longitude });
      },
      (err) => reject(err || new Error('browser_geolocation_denied')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  });
}

/** Wraps `LocationManager.getLocation` in a promise resolving to `{ latitude, longitude }`. */
function getTelegramLocationData(loc) {
  return new Promise((resolve, reject) => {
    loc.getLocation((data) => {
      const latitude = Number(data?.latitude);
      const longitude = Number(data?.longitude);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        resolve({ latitude, longitude });
        return;
      }
      reject(new Error('telegram_location_denied'));
    });
  });
}

/** Telegram LocationManager first (Mini App), then browser Geolocation API. */
async function requestUserLocation() {
  if (isMiniApp()) {
    const loc = await initTelegramLocationManager();
    if (loc?.isLocationAvailable) {
      return getTelegramLocationData(loc);
    }
  }
  return requestUserLocationFromBrowser();
}

/**
 * Fire-and-forget location request + report, meant to run once as soon as the Mini App
 * opens. `LocationManager.getLocation` only surfaces Telegram's native permission prompt
 * the first time it's ever called for this user (while `isAccessRequested` is still
 * false); once the user has answered (granted or denied), later calls resolve/reject
 * immediately with no repeat prompt. So in practice this asks once on a user's very first
 * visit and is a silent no-op (or silent report) on every visit after that. Reuses the
 * same `/app/telegram-mini-app-location` endpoint (and its per-IP rate limit) as the map
 * view, so no extra client-side throttling is needed here.
 */
async function requestAndReportUserLocation() {
  if (!isMiniApp()) return;
  try {
    const loc = await initTelegramLocationManager();
    if (!loc?.isLocationAvailable) return;
    const position = await getTelegramLocationData(loc);
    await window.UyDosh.reportTelegramMiniAppLocation(position.latitude, position.longitude);
  } catch (err) {
    console.warn('[UyDoshMap] Background location report failed', err);
  }
}

function openTelegramLocationSettings() {
  const loc = window.Telegram?.WebApp?.LocationManager;
  if (!loc || typeof loc.openSettings !== 'function') return false;
  loc.openSettings();
  return true;
}

/** Strip leading @ and normalize a Telegram username/handle. */
function normalizeTelegramUsername(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const withoutAt = raw.startsWith('@') ? raw.slice(1) : raw;
  return withoutAt.trim();
}

/** Telegram handles for which the contact button is intentionally hidden on the detail screen. */
const DETAIL_CONTACT_TELEGRAM_BLOCKLIST = new Set(['roommateuz']);

/** Resolve the listing owner's Telegram handle from a listing detail payload. */
function listingContactTelegram(listing) {
  const handle = normalizeTelegramUsername(listing?.contact_telegram);
  if (handle && DETAIL_CONTACT_TELEGRAM_BLOCKLIST.has(handle.toLowerCase())) return '';
  return handle;
}

/** Strip formatting from a phone number, keeping digits and a leading "+" only. */
function normalizePhoneNumber(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const cleaned = raw.replace(/[^0-9+]/g, '');
  return cleaned.replace(/(?!^)\+/g, '');
}

/** Resolve the listing owner's extracted contact phone number. */
function listingContactPhone(listing) {
  return normalizePhoneNumber(listing?.contact_phone);
}

/** `text` prefills the chat's compose box (documented Telegram deep-link param). */
function telegramUserUrl(username, text) {
  const clean = normalizeTelegramUsername(username);
  if (!clean) return '';
  const base = `https://t.me/${encodeURIComponent(clean)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

function telPhoneUrl(phone) {
  const clean = normalizePhoneNumber(phone);
  return clean ? `tel:${clean}` : '';
}

/**
 * Open a Telegram user chat (Mini App uses openTelegramLink). `prefillText`,
 * when given, pre-populates the message box with listing context so the
 * host immediately knows which listing the guest means.
 */
function openTelegramContact(handle, prefillText) {
  const url = telegramUserUrl(handle, prefillText);
  if (!url) return false;
  const tg = window.Telegram?.WebApp;
  if (isMiniApp() && typeof tg?.openTelegramLink === 'function') {
    tg.openTelegramLink(url);
  } else if (typeof tg?.openLink === 'function') {
    tg.openLink(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  return true;
}

/**
 * Start a phone call. `Telegram.WebApp.openLink`/`openTelegramLink` reject
 * the `tel:` scheme ("Url protocol is not supported"), so this always goes
 * through `window.open`, which reliably hands off to the OS dialer from
 * inside the Telegram in-app browser on both iOS and Android.
 */
function openPhoneContact(phone) {
  const url = telPhoneUrl(phone);
  if (!url) return false;
  window.open(url, '_blank');
  return true;
}

function iconTelegram(color = '#fff') {
  return iconSvg(color, `
    <path d="M21.5 4.5 2.8 11.2c-1.1.4-1.1 1.1-.2 1.4l4.8 1.5 1.8 5.6c.2.6.1.8.7.8.5 0 .7-.2 1-.5l2.4-2.3 5 3.7c.9.5 1.6.2 1.8-.9L22.8 6c.3-1.2-.5-1.7-1.3-1.5Z" fill="currentColor" stroke="none"></path>
    <path d="m8.6 13.8 9.7-6.1c.5-.3.9-.1.5.2l-7.9 7.2-.3 3.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"></path>
  `);
}

function iconPhone(color = '#fff') {
  return iconSvg(color, `
    <path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.2 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.2 1.1L6.6 10.8Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path>
  `);
}

function iconShare(color = '#fff') {
  return iconSvg(color, `
    <circle cx="18" cy="5" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6"></circle>
    <circle cx="6" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6"></circle>
    <circle cx="18" cy="19" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6"></circle>
    <path d="M8.3 10.6 15.8 6.4M8.3 13.4l7.5 4.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path>
  `);
}

/** Match mobile app favorite heart colors (AppColors.favoriteActive/Inactive). */
const FAVORITE_ICON_COLOR_ACTIVE = '#F44336';
const FAVORITE_ICON_COLOR_INACTIVE = '#757575';
const FAVORITE_ICON_HEART_PATH =
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35Z';

function iconHeart(filled = false) {
  const color = filled ? FAVORITE_ICON_COLOR_ACTIVE : FAVORITE_ICON_COLOR_INACTIVE;
  const path = filled
    ? `<path d="${FAVORITE_ICON_HEART_PATH}" fill="currentColor" stroke="none"></path>`
    : `<path d="${FAVORITE_ICON_HEART_PATH}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"></path>`;
  return iconSvg(color, path);
}

/** Report/complain icon (listing detail gallery action) — matches the mobile app's red "Complain" exclamation-circle icon. */
const REPORT_ICON_COLOR = '#F44336';

function iconFlag() {
  return iconSvg(REPORT_ICON_COLOR, `
    <circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"></circle>
    <rect x="10.85" y="5.5" width="2.3" height="8.5" rx="1.15" fill="#fff"></rect>
    <rect x="10.85" y="16" width="2.3" height="2.3" rx="1.15" fill="#fff"></rect>
  `);
}

/**
 * Fetches up to `limit` listing photo URLs as `File` blobs for `navigator.share`.
 * Cross-origin fetch works because the API enables CORS globally. Each photo
 * gets its own timeout so one slow/broken image can't hang the whole share
 * flow — it's just dropped from the result instead of failing everything.
 */
async function fetchListingPhotoFiles(photoUrls, { limit = 5, timeoutMs = 8000 } = {}) {
  const urls = Array.isArray(photoUrls) ? photoUrls.filter(Boolean).slice(0, limit) : [];
  if (urls.length === 0) return [];

  const files = await Promise.all(
    urls.map(async (photoUrl, index) => {
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
      try {
        const response = await fetch(photoUrl, { signal: controller?.signal });
        if (!response.ok) return null;
        const blob = await response.blob();
        if (!blob || blob.size === 0) return null;
        const type = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
        const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
        return new File([blob], `uydosh-listing-photo-${index + 1}.${ext}`, { type });
      } catch {
        return null;
      } finally {
        if (timer) clearTimeout(timer);
      }
    }),
  );
  return files.filter(Boolean);
}

/**
 * Opens Telegram's native share/forward dialog for a URL + caption. Falls
 * back to the OS share sheet (regular browser visits to this page outside
 * the Mini App) or a plain window.open of the t.me share link.
 *
 * When `photoUrls` is given and we're inside the Mini App on a native
 * Telegram client (iOS/Android/Desktop — not Telegram Web, which sandboxes
 * the webview and blocks the Web Share API), this first tries
 * `navigator.share` with the listing's real photos attached as files —
 * Telegram then posts them as real photo attachments plus the caption/link
 * as its own message, the same as sharing from any other native app. Any
 * failure along that path (unsupported, fetch failed, permission denied)
 * silently falls through to the plain link share below, so this is purely
 * additive and a tap never comes up empty.
 *
 * `url` (used by every fallback path below) is deliberately left as-is —
 * inside the Mini App that's a `t.me/<bot>?startapp=...` deep link, which
 * Telegram always renders as its own generic "Open App" bot card, never a
 * per-listing preview (t.me links aren't crawled for Open Graph tags). The
 * photo-attach path needs an actual per-listing preview instead (the point
 * of attaching photos is to *add* the map, not repeat the same generic
 * card), so it takes a separate `photoShareUrl` — an `https://.../listing/id`
 * link Telegram *will* unfurl via our Open Graph tags — and falls back to
 * `url` only if that wasn't supplied.
 *
 * Returns a string describing what happened (`'photos'`, `'link'`,
 * `'cancelled'`) or `false` if there was no URL to share, so callers can
 * log which path was actually used.
 */
async function shareListingLink(url, text, photoUrls, photoShareUrl) {
  if (!url) return false;
  // `url` is usually the bot's `t.me/<bot>?startapp=...` deep link, which
  // Telegram never unfurls with custom OG tags (always shows the bot's own
  // generic card) — see listing-detail.js `buildListingShareUrl`. Whenever we
  // have the web `?preview=map` URL, prefer it here so the rich link preview
  // (map or photo) actually shows up; the bot deep link is still embedded as
  // plain text inside `text` (via `buildListingShareText`), so tapping it
  // still launches the Mini App directly.
  const linkToUnfurl = photoShareUrl || url;
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(linkToUnfurl)}&text=${encodeURIComponent(text || '')}`;
  const tg = window.Telegram?.WebApp;

  const canAttemptPhotoShare =
    isMiniApp() &&
    Array.isArray(photoUrls) &&
    photoUrls.length > 0 &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function';

  if (canAttemptPhotoShare) {
    try {
      const files = await fetchListingPhotoFiles(photoUrls);
      if (files.length > 0 && navigator.canShare({ files })) {
        const caption = text ? `${text}\n\n${linkToUnfurl}` : linkToUnfurl;
        await navigator.share({ files, text: caption });
        return 'photos';
      }
    } catch (err) {
      if (err && err.name === 'AbortError') {
        // User dismissed the native photo-share sheet — don't also pop the
        // Telegram link-share dialog right after; that would look broken.
        return 'cancelled';
      }
      // Any other failure (unsupported file types, permission, network)
      // falls through to the link-only share below.
    }
  }

  if (isMiniApp() && typeof tg?.openTelegramLink === 'function') {
    tg.openTelegramLink(shareUrl);
    return 'link';
  }
  if (typeof navigator.share === 'function') {
    navigator.share({ title: text, text, url }).catch(() => { /* user cancelled */ });
    return 'link';
  }
  if (typeof tg?.openLink === 'function') {
    tg.openLink(shareUrl);
    return 'link';
  }
  window.open(shareUrl, '_blank', 'noopener,noreferrer');
  return 'link';
}

/** Sticky Mini App footer CTA(s) to reach the listing owner: Telegram and/or a direct call. */
function detailContactBarHtml(username, phone) {
  const cleanHandle = normalizeTelegramUsername(username);
  const cleanPhone = normalizePhoneNumber(phone);
  if (!cleanHandle && !cleanPhone) return '';

  const telegramBtn = cleanHandle
    ? `
      <button type="button" class="detail-contact-btn" data-detail-contact-telegram data-telegram-username="${escapeHtml(cleanHandle)}">
        ${iconTelegram('#fff')}
        <span data-i18n="detail.contactTelegram">${escapeHtml(t('detail.contactTelegram'))}</span>
      </button>
    `
    : '';
  const phoneBtn = cleanPhone
    ? `
      <button type="button" class="detail-contact-btn detail-contact-btn-phone" data-detail-contact-phone data-phone-number="${escapeHtml(cleanPhone)}">
        ${iconPhone('#fff')}
        <span data-i18n="detail.contactPhone">${escapeHtml(t('detail.contactPhone'))}</span>
      </button>
    `
    : '';

  const rowClass = cleanHandle && cleanPhone ? ' detail-contact-bar-inner-row' : '';
  return `
    <div class="detail-contact-bar-inner${rowClass}">
      ${telegramBtn}
      ${phoneBtn}
    </div>
  `;
}

function bindDetailContactBar(container, { listingId, prefillText, onOpen, onCall } = {}) {
  const telegramBtn = container?.querySelector('[data-detail-contact-telegram]');
  telegramBtn?.addEventListener('click', () => {
    const handle = telegramBtn.getAttribute('data-telegram-username');
    if (!openTelegramContact(handle, prefillText)) return;
    if (typeof onOpen === 'function') onOpen(handle);
    else if (listingId != null) {
      logMiniAppEvent('telegram_contact_tapped', {
        listing_id: Number(listingId),
        source: 'telegram_mini_app',
      });
    }
  });

  const phoneBtn = container?.querySelector('[data-detail-contact-phone]');
  phoneBtn?.addEventListener('click', () => {
    const phone = phoneBtn.getAttribute('data-phone-number');
    if (!openPhoneContact(phone)) return;
    if (typeof onCall === 'function') onCall(phone);
    else if (listingId != null) {
      logMiniAppEvent('phone_contact_tapped', {
        listing_id: Number(listingId),
        source: 'telegram_mini_app',
      });
    }
  });
}

/** Pre-render all pin bitmap variants so the first map paint avoids canvas work. */
function warmMapPinIconCache({ darkMap = null } = {}) {
  if (typeof document === 'undefined') return;
  createUserLocationPinIcon();
  createMapClusterPinIcon();
  const isDark = darkMap ?? prefersDarkMapPins();
  const stubPins = [
    { id: 101, listing_type_id: 1 },
    { id: 102, listing_type_id: 2 },
    { id: 103, listing_type_id: 2, host_resident: false },
    { id: 104, listing_type_id: 3 },
    { id: 105, listing_type_id: 0 },
  ];
  const visited = new Set([101]);
  for (const pin of stubPins) {
    createMapPinIcon(pin, { darkMap: isDark });
    createMapPinIcon(pin, { darkMap: true });
    createMapPinIcon(pin, { visitedListingIds: visited, darkMap: isDark });
    createMapPinIcon(pin, { selectedListingId: pin.id, darkMap: isDark });
  }
  for (const count of [2, 3, 5, 12]) {
    createMapGroupPinIcon(
      { pins: stubPins.slice(0, Math.min(count, stubPins.length)) },
      { darkMap: isDark },
    );
    createMapGroupPinIcon(
      { pins: stubPins.slice(0, Math.min(count, stubPins.length)) },
      { selectedListingId: 101, darkMap: isDark },
    );
  }
}

Object.assign(window.UyDosh, {
  createMapPinIcon,
  createMapGroupPinIcon,
  createMapClusterPinIcon,
  createMetroStationPinIcon,
  createUserLocationPinIcon,
  requestUserLocation,
  requestAndReportUserLocation,
  openTelegramLocationSettings,
  normalizeTelegramUsername,
  listingContactTelegram,
  telegramUserUrl,
  openTelegramContact,
  iconTelegram,
  normalizePhoneNumber,
  listingContactPhone,
  telPhoneUrl,
  openPhoneContact,
  iconPhone,
  iconShare,
  iconHeart,
  iconFlag,
  shareListingLink,
  detailContactBarHtml,
  bindDetailContactBar,
  warmMapPinIconCache,
  loadVisitedListingIds,
  markListingVisited,
  prefersDarkMapPins,
  getManualTheme,
  setManualTheme,
  toggleManualTheme,
  applyStoredManualTheme,
  currentUiTheme,
});
