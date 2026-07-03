// UyDosh Web — network layer: JSON fetch helpers, Telegram initData/session
// persistence, listings/amenities/locations CRUD, photo upload + resize, and
// the lazy Yandex Maps module loader.
// Depends on uydosh-core.js (API_BASE). Load after it.

async function fetchJson(path, params) {
  const url = new URL(`${API_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

const SESSION_STORAGE_KEY = 'uydosh_session_token';
const TG_INIT_DATA_KEY = 'uydosh_tg_init_data';
const TG_INIT_DATA_MAX_AGE_SEC = 86400;

function readPersistedTelegramInitData() {
  try {
    return String(sessionStorage.getItem(TG_INIT_DATA_KEY) ?? '').trim();
  } catch {
    return '';
  }
}

function persistTelegramInitData(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return;
  try {
    sessionStorage.setItem(TG_INIT_DATA_KEY, value);
  } catch { /* ignore */ }
}

function clearPersistedTelegramInitData() {
  try {
    sessionStorage.removeItem(TG_INIT_DATA_KEY);
  } catch { /* ignore */ }
}

/** Parse auth_date from initData; returns null when hash/auth_date are missing. */
function parseTelegramInitDataAuthDate(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  try {
    const params = new URLSearchParams(value);
    if (!params.get('hash')?.trim()) return null;
    const authDate = Number(params.get('auth_date'));
    if (!Number.isFinite(authDate) || authDate <= 0) return null;
    return authDate;
  } catch {
    return null;
  }
}

/** Client-side freshness check (matches backend maxAgeSec). */
function isTelegramInitDataUsable(raw, { nowSec = Math.floor(Date.now() / 1000) } = {}) {
  const value = String(raw ?? '').trim();
  if (!value || value.length < 20) return false;
  const authDate = parseTelegramInitDataAuthDate(value);
  if (authDate == null) return false;
  return nowSec - authDate <= TG_INIT_DATA_MAX_AGE_SEC;
}

/** initData from Telegram WebApp, persisted for multi-page in-app navigation. */
function getTelegramInitData() {
  const fresh = String(window.Telegram?.WebApp?.initData ?? '').trim();
  const cached = readPersistedTelegramInitData();
  const freshOk = isTelegramInitDataUsable(fresh);
  const cachedOk = isTelegramInitDataUsable(cached);

  if (freshOk) {
    persistTelegramInitData(fresh);
    return fresh;
  }
  if (cachedOk) return cached;
  if (cached && !cachedOk) clearPersistedTelegramInitData();
  return '';
}

function clearTelegramInitData() {
  clearPersistedTelegramInitData();
}

function getSessionToken() {
  try {
    return sessionStorage.getItem(SESSION_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function setSessionToken(token) {
  try {
    if (token) sessionStorage.setItem(SESSION_STORAGE_KEY, token);
    else sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch { /* ignore */ }
}

async function fetchJsonAuth(path, { method = 'GET', body, params } = {}) {
  const token = getSessionToken();
  if (!token) {
    const err = new Error('Not authenticated');
    err.status = 401;
    throw err;
  }
  const url = new URL(`${API_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };
  const init = { method, headers };
  if (body != null) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url.toString(), init);
  let payload = null;
  try {
    payload = await res.json();
  } catch { /* ignore */ }
  if (!res.ok) {
    const err = new Error(payload?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  return payload;
}

/** Authenticate via Telegram Mini App initData; stores session token on success. */
async function authenticateTelegramMiniApp() {
  const initData = getTelegramInitData();
  if (!initData) {
    const err = new Error('Telegram initData missing');
    err.status = 401;
    throw err;
  }
  const res = await fetch(`${API_BASE}/users/telegram-webapp-auth`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ init_data: initData }),
  });
  let payload = null;
  try {
    payload = await res.json();
  } catch { /* ignore */ }
  if (!res.ok) {
    if (res.status === 401) clearTelegramInitData();
    const err = new Error(payload?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  if (payload?.sessionToken) setSessionToken(payload.sessionToken);
  return payload;
}

function fetchSubwayStationsByLine(lineId, lang = getLang()) {
  return fetchJson(`/subway-stations/line/${encodeURIComponent(lineId)}`, { language: lang });
}

/** All Tashkent metro stations (every line) — used by the mini app map's metro layer. */
function fetchSubwayStations(lang = getLang()) {
  return fetchJson('/subway-stations', { language: lang });
}

function fetchLocations({ page = 1, limit = 200, language = getLang() } = {}) {
  return fetchJson('/locations', { page, limit, language });
}

function fetchAmenitiesOrdered() {
  return fetchJson('/amenities/ordered');
}

function createListing(body) {
  return fetchJsonAuth('/listings', { method: 'POST', body });
}

/** Create a listing from the Telegram Mini App (verify initData on submit). */
async function createListingFromTelegramMiniApp(listing) {
  const initData = getTelegramInitData();
  if (!initData) {
    const err = new Error('Telegram initData missing');
    err.status = 401;
    throw err;
  }
  const res = await fetch(`${API_BASE}/listings/telegram-miniapp`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ init_data: initData, listing }),
  });
  let payload = null;
  try {
    payload = await res.json();
  } catch { /* ignore */ }
  if (!res.ok) {
    if (res.status === 401) clearTelegramInitData();
    const err = new Error(payload?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  if (payload?.sessionToken) setSessionToken(payload.sessionToken);
  return payload;
}

function createProfile(body) {
  return fetchJsonAuth('/profiles', { method: 'POST', body });
}

function uploadListingPhoto(listingId, imageData, { isPrimary = false } = {}) {
  return fetchJsonAuth(`/listings/${encodeURIComponent(listingId)}/photos`, {
    method: 'POST',
    body: { imageData, isPrimary },
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Loads an image file into a bitmap, respecting EXIF orientation where the
 * browser supports it (createImageBitmap with imageOrientation), falling
 * back to a plain <img> element otherwise.
 */
async function loadImageSource(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // fall through to <img> based loading below
    }
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Resizes/compresses a picked photo before it is base64-encoded for upload.
 * Full-resolution phone camera photos (often 3-8MB) blow past the backend's
 * 2MB JSON body limit once base64-encoded (~33% overhead) — this keeps the
 * mini app's uploads working the same way the native app's photo cropper
 * does (downscale + re-encode as JPEG).
 */
async function resizeImageFileForUpload(file, {
  maxDimension = 1600,
  quality = 0.85,
  minQuality = 0.5,
  targetBytes = 1.4 * 1024 * 1024,
} = {}) {
  const source = await loadImageSource(file);
  const sourceWidth = source.width || source.naturalWidth;
  const sourceHeight = source.height || source.naturalHeight;
  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if (typeof source.close === 'function') source.close();

  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  let currentQuality = quality;
  while (dataUrl.length > targetBytes * 1.37 && currentQuality > minQuality) {
    currentQuality = Math.max(minQuality, currentQuality - 0.15);
    dataUrl = canvas.toDataURL('image/jpeg', currentQuality);
  }
  return dataUrl;
}

const MINI_APP_CREATE_PATH = '/telegram/create.html';

function fetchListings({ page = 1, limit = 20, listingTypeId, gender, withPhoto, subwayLineId, createdWithinDays } = {}) {
  const params = { page, limit, isActive: 'true' };
  if (listingTypeId) params.listingTypeId = listingTypeId;
  if (gender) params.gender = gender;
  if (withPhoto != null) params.withPhoto = String(withPhoto);
  if (subwayLineId) params.subwayLineId = subwayLineId;
  if (createdWithinDays != null) params.createdWithinDays = createdWithinDays;
  return fetchJson('/listings', params);
}

function fetchListing(id) {
  return fetchJson(`/listings/${encodeURIComponent(id)}`);
}

function fetchListingsForMap({ page = 1, limit = 300, listingTypeId, gender, withPhoto, subwayLineId, createdWithinDays } = {}) {
  const params = { page, limit, isActive: 'true' };
  if (listingTypeId) params.listingTypeId = listingTypeId;
  if (gender) params.gender = gender;
  if (withPhoto != null) params.withPhoto = String(withPhoto);
  if (subwayLineId) params.subwayLineId = subwayLineId;
  if (createdWithinDays != null) params.createdWithinDays = createdWithinDays;
  return fetchJson('/listings/map', params);
}

const YANDEX_MAP_MODULE_PATH = '/assets/yandex-map.js';
let yandexMapModulePromise = null;

function resetYandexMaps({ hard = false } = {}) {
  yandexMapModulePromise = null;
  if (window.UyDoshMap?.resetYandexMapsLoader) {
    window.UyDoshMap.resetYandexMapsLoader();
  }
  if (!hard) return;
  for (const el of document.querySelectorAll('script[src*="yandex-map.js"]')) {
    el.remove();
  }
  try {
    delete window.UyDoshMap;
  } catch {
    window.UyDoshMap = undefined;
  }
}

function reflowActiveMaps() {
  if (!window.UyDoshMap?.reflowAllMaps) return;
  requestAnimationFrame(() => {
    window.UyDoshMap.reflowAllMaps();
    requestAnimationFrame(() => window.UyDoshMap.reflowAllMaps());
  });
}

function withTimeout(promise, ms, message = 'Timed out') {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function waitForElementLayout(el, { maxFrames = 24 } = {}) {
  if (!el) return;
  for (let i = 0; i < maxFrames; i += 1) {
    if (el.offsetWidth > 0 && el.offsetHeight > 0) return;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

/** Lazy-load /assets/yandex-map.js (Yandex Maps JS API helpers). */
function loadYandexMapModule() {
  if (window.UyDoshMap) return Promise.resolve(window.UyDoshMap);
  if (yandexMapModulePromise) return yandexMapModulePromise;
  yandexMapModulePromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${YANDEX_MAP_MODULE_PATH}?v=20260703-67`;
    script.async = true;
    script.onload = () => {
      if (window.UyDoshMap) resolve(window.UyDoshMap);
      else {
        yandexMapModulePromise = null;
        reject(new Error('UyDoshMap module missing'));
      }
    };
    script.onerror = () => {
      yandexMapModulePromise = null;
      reject(new Error('Failed to load UyDoshMap module'));
    };
    document.head.appendChild(script);
  });
  return yandexMapModulePromise;
}

Object.assign(window.UyDosh, {
  fetchListings,
  fetchListing,
  fetchListingsForMap,
  fetchSubwayStationsByLine,
  fetchSubwayStations,
  fetchLocations,
  fetchAmenitiesOrdered,
  createListing,
  createListingFromTelegramMiniApp,
  createProfile,
  uploadListingPhoto,
  readFileAsDataUrl,
  resizeImageFileForUpload,
  authenticateTelegramMiniApp,
  getTelegramInitData,
  clearTelegramInitData,
  isTelegramInitDataUsable,
  getSessionToken,
  setSessionToken,
  loadYandexMapModule,
  resetYandexMaps,
  reflowActiveMaps,
  withTimeout,
  waitForElementLayout,
  MINI_APP_CREATE_PATH,
});
