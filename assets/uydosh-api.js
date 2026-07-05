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

const SESSION_USER_ID_KEY = 'uydosh_session_user_id';

/** The app-side numeric user id behind the current session token (see `setSessionUserId`), used to detect e.g. listing ownership without a dedicated "whoami" round trip. */
function getSessionUserId() {
  try {
    const raw = sessionStorage.getItem(SESSION_USER_ID_KEY);
    const id = raw ? Number(raw) : NaN;
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

function setSessionUserId(id) {
  try {
    if (id != null && Number.isFinite(Number(id))) {
      sessionStorage.setItem(SESSION_USER_ID_KEY, String(Number(id)));
    } else {
      sessionStorage.removeItem(SESSION_USER_ID_KEY);
    }
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
  if (payload?.user?.id != null) setSessionUserId(payload.user.id);
  return payload;
}

/**
 * Ensures a session token is available for endpoints that only accept the generic
 * Bearer-token auth (e.g. `/favorites/*`, shared with the mobile app) rather than a
 * dedicated `init_data`-verifying endpoint. Authenticates via Telegram initData on
 * first use and caches the resulting session token for the rest of the tab's session.
 * Returns false when there's no usable Telegram identity to authenticate with.
 */
async function ensureTelegramMiniAppSession() {
  if (getSessionToken()) return true;
  if (!getTelegramInitData()) return false;
  try {
    await authenticateTelegramMiniApp();
    return Boolean(getSessionToken());
  } catch {
    return false;
  }
}

/** Whether the current Mini App user has favorited a listing (reuses the shared favorites API). */
function checkListingFavorited(listingId) {
  return fetchJsonAuth(`/favorites/check/${encodeURIComponent(listingId)}`);
}

/** Toggle favorite status for a listing (reuses the shared favorites API). */
function toggleListingFavorite(listingId) {
  return fetchJsonAuth(`/favorites/toggle/${encodeURIComponent(listingId)}`, { method: 'PUT' });
}

/** List the current Mini App user's favorited listings (reuses the shared favorites API). */
function fetchFavoriteListings({ page = 1, limit = 100 } = {}) {
  return fetchJsonAuth('/favorites', { params: { page, limit } });
}

/**
 * Whether the current Mini App user's linked Telegram identity matches the original
 * poster of a scraped listing (still owned by the import service account) and can
 * therefore claim it. Returns `{ eligible: boolean }`.
 */
function checkListingClaimEligibility(listingId) {
  return fetchJsonAuth(`/listings/${encodeURIComponent(listingId)}/claim-eligibility`);
}

/** Claim a scraped listing that matches the current user's Telegram identity. */
function claimListing(listingId) {
  return fetchJsonAuth(`/listings/${encodeURIComponent(listingId)}/claim`, { method: 'POST' });
}

/**
 * Records the Mini App user's device location, verified server-side via initData (no
 * session required). Fire-and-forget: swallows failures since it's called from a
 * best-effort background flow (see autoRequestUserLocation in yandex-map.js) and must
 * never surface an error to the user.
 *
 * @param {string} [contactRaw] Optional raw `response` string from a successful
 *   `Telegram.WebApp.requestContact()` share (see `requestTelegramContactShare`),
 *   verified independently server-side and stored on this same location row.
 */
async function reportTelegramMiniAppLocation(latitude, longitude, contactRaw) {
  const initData = getTelegramInitData();
  if (!initData) return false;
  try {
    const body = { init_data: initData, latitude, longitude };
    if (contactRaw) body.contact = contactRaw;
    const res = await fetch(`${API_BASE}/app/telegram-mini-app-location`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (err) {
    console.warn('[UyDosh] Failed to report Mini App location', err);
    return false;
  }
}

/**
 * Wraps `Telegram.WebApp.requestContact()` (native "share phone number" consent popup)
 * in a Promise. Resolves with the raw, signable `response` string (never `responseUnsafe`
 * — see Telegram docs) on share, or `null` if the user cancels/declines or the method is
 * unavailable (e.g. desktop client, old app version).
 */
function requestTelegramContactShare() {
  const tg = window.Telegram?.WebApp;
  if (typeof tg?.requestContact !== 'function') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      tg.requestContact((success, response) => {
        resolve(success && response?.status === 'sent' ? response.response : null);
      });
    } catch (err) {
      console.warn('[UyDosh] requestContact failed', err);
      resolve(null);
    }
  });
}

/**
 * Reads the phone number out of a raw contact-share `response` string (see
 * `requestTelegramContactShare`). The string is a query string (structurally identical
 * to initData) with a JSON-encoded `contact` field, e.g. `contact=<json>&auth_date=...
 * &hash=...` — NOT bare JSON, so it must be parsed as a query string first.
 */
function phoneNumberFromContactShareResponse(contactRaw) {
  if (!contactRaw) return '';
  try {
    const contactJson = new URLSearchParams(contactRaw).get('contact');
    if (!contactJson) return '';
    const parsed = JSON.parse(contactJson);
    return typeof parsed?.phone_number === 'string' ? parsed.phone_number.trim() : '';
  } catch {
    return '';
  }
}

/** Persists the account's phone number (e.g. shared via `requestTelegramContactShare`). */
function updateMyPhoneNumber(phoneNumber) {
  return fetchJsonAuth('/users/me/phone-number', {
    method: 'PATCH',
    body: { phone_number: phoneNumber },
  });
}

/** Complaint reasons for reporting a listing (public, shared with mobile app). */
function fetchComplaintCategories() {
  return fetchJson('/complaint-categories');
}

/** Submit a complaint about a listing (reuses the shared complaints API, same as mobile app). */
function createComplaint({ listingId, categoryId, text }) {
  const body = { listing_id: Number(listingId), category_id: Number(categoryId) };
  const trimmedText = String(text ?? '').trim();
  if (trimmedText) body.text = trimmedText;
  return fetchJsonAuth('/complaints', { method: 'POST', body });
}

/** Complaint count for a listing (public, no auth) — drives the listing detail page's complaints warning button. */
function fetchListingComplaintsCount(listingId) {
  return fetchJson('/complaints/counts-by-listing', { listing_id: listingId });
}

/**
 * Complaints for a listing, including each complainant's name/avatar (public, no
 * auth — same `GET /complaints` endpoint the mobile app falls back to). Used to
 * render the "grouped by user" complaints sheet.
 */
function fetchListingComplaints(listingId, { limit = 100 } = {}) {
  return fetchJson('/complaints', { listing_id: listingId, limit });
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

/**
 * Reverse-geocodes coordinates into a human-readable address via the backend's
 * Yandex Geocoder proxy — used by the create-listing wizard's "Use current
 * location" address button. Requires a session token (see
 * `ensureTelegramMiniAppSession`/`authenticateTelegramMiniApp`). Resolves to
 * `{ addressText }`.
 */
function fetchReverseGeocodeAddress(latitude, longitude, lang = getLang()) {
  return fetchJsonAuth('/app/geosuggest/reverse', { params: { latitude, longitude, lang } });
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

/**
 * Update a listing from the Telegram Mini App (verify initData on submit).
 * Only the listing's own owner (resolved from initData) may edit it.
 */
async function updateListingFromTelegramMiniApp(listingId, listing) {
  const initData = getTelegramInitData();
  if (!initData) {
    const err = new Error('Telegram initData missing');
    err.status = 401;
    throw err;
  }
  const res = await fetch(`${API_BASE}/listings/telegram-miniapp/${encodeURIComponent(listingId)}`, {
    method: 'PUT',
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
  return payload;
}

/** List the current Telegram Mini App user's own listings (verified initData). */
async function fetchMyTelegramMiniAppListings() {
  const initData = getTelegramInitData();
  if (!initData) {
    const err = new Error('Telegram initData missing');
    err.status = 401;
    throw err;
  }
  return fetchJson('/listings/telegram-miniapp/mine', { init_data: initData });
}

/**
 * Toggle a listing's active/inactive (visibility) status from the Telegram Mini App
 * (verify initData on submit). Only the listing's own owner may toggle it.
 */
async function toggleListingActiveFromTelegramMiniApp(listingId) {
  const initData = getTelegramInitData();
  if (!initData) {
    const err = new Error('Telegram initData missing');
    err.status = 401;
    throw err;
  }
  const res = await fetch(`${API_BASE}/listings/telegram-miniapp/${encodeURIComponent(listingId)}/toggle-active`, {
    method: 'PATCH',
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
  return payload;
}

/**
 * Free weekly "renew publication" bump from the Telegram Mini App (verify
 * initData on submit). Only the listing's own owner may renew it. On a 429
 * cooldown response, `err.payload.nextRenewalAt` (ISO string) tells the
 * caller when renewal becomes available again.
 */
async function renewListingFromTelegramMiniApp(listingId) {
  const initData = getTelegramInitData();
  if (!initData) {
    const err = new Error('Telegram initData missing');
    err.status = 401;
    throw err;
  }
  const res = await fetch(`${API_BASE}/listings/telegram-miniapp/${encodeURIComponent(listingId)}/renew`, {
    method: 'PATCH',
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
  return payload;
}

/**
 * Delete a listing from the Telegram Mini App (verify initData on submit).
 * Only the listing's own owner may delete it.
 */
async function deleteListingFromTelegramMiniApp(listingId) {
  const initData = getTelegramInitData();
  if (!initData) {
    const err = new Error('Telegram initData missing');
    err.status = 401;
    throw err;
  }
  const res = await fetch(`${API_BASE}/listings/telegram-miniapp/${encodeURIComponent(listingId)}`, {
    method: 'DELETE',
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
  return payload;
}

function createProfile(body) {
  return fetchJsonAuth('/profiles', { method: 'POST', body });
}

/** Current (or any) user's profile — public endpoint, no session required. */
function fetchProfile(userId) {
  return fetchJson(`/profiles/${encodeURIComponent(userId)}`);
}

/**
 * Partial profile update (only the fields set are changed). Note: per the
 * backend's update handler, `university_id: 0` clears the university —
 * `null`/`undefined` are both treated as "leave unchanged", not "clear".
 */
function updateProfile(userId, body) {
  return fetchJsonAuth(`/profiles/${encodeURIComponent(userId)}`, { method: 'PUT', body });
}

/** Full university list (for pickers) — public, localized by `lang`. */
function fetchUniversitiesAll(lang = getLang()) {
  return fetchJson('/universities/all', { language: lang });
}

// Regions are static reference data (1h server cache) — memoize per id so the
// 1-on-1 compatibility breakdown (see uydosh-profile-match.js) doesn't refetch
// the same region twice when both profiles share it.
const _regionCache = new Map();

/** Single region by id (for the compatibility breakdown's "region" row) — public. */
function fetchRegion(id) {
  const key = Number(id);
  if (!Number.isFinite(key)) return Promise.resolve(null);
  if (_regionCache.has(key)) return _regionCache.get(key);
  const promise = fetchJson(`/regions/${encodeURIComponent(key)}`).catch((err) => {
    _regionCache.delete(key);
    throw err;
  });
  _regionCache.set(key, promise);
  return promise;
}

function uploadListingPhoto(listingId, imageData, { isPrimary = false } = {}) {
  return fetchJsonAuth(`/listings/${encodeURIComponent(listingId)}/photos`, {
    method: 'POST',
    body: { imageData, isPrimary },
  });
}

/** Delete a listing photo (used when editing an existing listing). */
function deleteListingPhoto(listingId, photoId) {
  return fetchJsonAuth(`/listings/${encodeURIComponent(listingId)}/photos/${encodeURIComponent(photoId)}`, {
    method: 'DELETE',
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

function fetchListings({ page = 1, limit = 20, listingTypeId, gender, withPhoto, subwayLineId, createdWithinDays } = {}) {
  const params = { page, limit, isActive: 'true' };
  if (listingTypeId) params.listingTypeId = listingTypeId;
  if (gender) params.gender = gender;
  if (withPhoto != null) params.withPhoto = String(withPhoto);
  if (subwayLineId) params.subwayLineId = subwayLineId;
  if (createdWithinDays != null) params.createdWithinDays = createdWithinDays;
  return fetchJson('/listings', params);
}

/**
 * Fetches listing detail, attaching the Mini App session's Bearer token when one is
 * already available (harmless for the public site — the endpoint's
 * `optionalAuthenticateToken` middleware just resolves the viewer's identity when
 * present). This lets an owner view their own not-yet-approved listing from "My
 * Listings" and lets the page detect ownership (see `getSessionUserId`) without a
 * separate request.
 */
async function fetchListing(id) {
  const token = getSessionToken();
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/listings/${encodeURIComponent(id)}`, { headers });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/** View count for a listing — only the listing's own owner may read this (reuses the shared, Bearer-authenticated endpoint the mobile app uses). */
function fetchListingViewCount(listingId) {
  return fetchJsonAuth(`/listings/${encodeURIComponent(listingId)}/view-count`);
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
    script.src = `${YANDEX_MAP_MODULE_PATH}?v=20260705-97`;
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
  fetchListingViewCount,
  fetchListingsForMap,
  fetchSubwayStationsByLine,
  fetchSubwayStations,
  fetchLocations,
  fetchAmenitiesOrdered,
  createListing,
  fetchReverseGeocodeAddress,
  createListingFromTelegramMiniApp,
  updateListingFromTelegramMiniApp,
  fetchMyTelegramMiniAppListings,
  toggleListingActiveFromTelegramMiniApp,
  renewListingFromTelegramMiniApp,
  deleteListingFromTelegramMiniApp,
  createProfile,
  fetchProfile,
  updateProfile,
  fetchUniversitiesAll,
  fetchRegion,
  uploadListingPhoto,
  deleteListingPhoto,
  readFileAsDataUrl,
  resizeImageFileForUpload,
  authenticateTelegramMiniApp,
  ensureTelegramMiniAppSession,
  checkListingFavorited,
  toggleListingFavorite,
  fetchFavoriteListings,
  checkListingClaimEligibility,
  claimListing,
  fetchComplaintCategories,
  createComplaint,
  fetchListingComplaintsCount,
  fetchListingComplaints,
  reportTelegramMiniAppLocation,
  requestTelegramContactShare,
  phoneNumberFromContactShareResponse,
  updateMyPhoneNumber,
  getTelegramInitData,
  clearTelegramInitData,
  isTelegramInitDataUsable,
  getSessionToken,
  setSessionToken,
  getSessionUserId,
  loadYandexMapModule,
  resetYandexMaps,
  reflowActiveMaps,
  withTimeout,
  waitForElementLayout,
});
