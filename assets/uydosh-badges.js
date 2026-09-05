// UyDosh Web — gender/listing-type badge + filter icon formatting, amenity
// sorting/icon helpers, and small platform utilities (isIOS, tryOpenListingInApp).
// Depends on uydosh-icons.js. Load after it.

/** Match mobile app gender badge colors. */
const GENDER_COLORS = {
  1: '#2196F3', // male
  2: '#C45A7C', // female
};

function listingTypeColor(listingTypeId) {
  return LISTING_TYPE_COLORS[Number(listingTypeId)] || null;
}

function genderColor(gender) {
  return GENDER_COLORS[Number(gender)] || null;
}

/** Short gender label for listing badges (matches mobile GenderBadge). */
function genderBadgeLabel(gender, lang = getLang()) {
  const g = Number(gender);
  if (g === 2) return t('card.genderBadge.female', lang);
  if (g === 1) return t('card.genderBadge.male', lang);
  return '';
}

/** Badge HTML with gender icon + label; empty when gender is unknown. */
function genderBadgeHtml(listing, lang = getLang()) {
  const g = Number(listing?.gender);
  if (g !== 1 && g !== 2) return '';
  const color = genderColor(g);
  const icon = g === 2 ? iconFemale(color) : iconMale(color);
  const label = genderBadgeLabel(g, lang);
  const style = color ? ` style="--badge-gender-color:${color}"` : '';
  return `<span class="badge badge-gender" data-gender="${g}"${style}>${icon}${escapeHtml(label)}</span>`;
}

function chipIconFilled(color, pathD) {
  const colorStyle = color ? ` style="color:${color}"` : '';
  return `<span class="chip-icon" aria-hidden="true"${colorStyle}><svg viewBox="0 0 24 24"><path d="${pathD}" fill="currentColor"/></svg></span>`;
}

function iconAll(color) {
  return chipIconFilled(
    color,
    'M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm0 6v4h4v-4h-4zm0 6v4h4v-4h-4z',
  );
}

function iconHome(color) {
  return chipIconFilled(color, 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5z');
}

function iconPeople(color) {
  return chipIconFilled(
    color,
    'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 2.05 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  );
}

function iconPerson(color) {
  return chipIconFilled(color, LISTING_TYPE_MAP_PIN_ICON_PATHS['2_absent']);
}

function isHostAbsent(listing) {
  const hostResident = listing?.host_resident;
  return hostResident === false || hostResident === 0 || hostResident === 'false';
}

function iconGroups(color) {
  return chipIconFilled(
    color,
    'M12 12.75c1.63 0 3.07.39 4.24.9 1.08.48 1.76 1.56 1.76 2.73V18H6v-1.62c0-1.17.68-2.25 1.76-2.73 1.17-.52 2.61-.9 4.24-.9zM12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM18.59 15.41A5.978 5.978 0 0 0 18 15c-1.66 0-3 1.34-3 3 0 .35.06.68.16 1H18v-3.59zM6.16 16c.1-.32.16-.65.16-1 0-1.66-1.34-3-3-3-.59 0-1.14.17-1.59.41V18h4.43z',
  );
}

function iconMale(color) {
  return chipIconFilled(
    color,
    'M20.5 4h-5v2h2.59l-3.13 3.13a6 6 0 1 0 1.42 1.42L19 7.41V10h2V4zM12 14a2 2 0 1 1 0-4 2 2 0 0 1 0 4z',
  );
}

function iconFemale(color) {
  return chipIconFilled(
    color,
    'M12 14a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0-2a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm-6 8v-2h2v-2.7a6.97 6.97 0 0 1-2-.32V18h2v2H6zm12 0v-2h-2v-2.7a6.97 6.97 0 0 0 2-.32V18h-2v2h2z',
  );
}

function filterListingTypeIcon(listingTypeId, { pressed = false } = {}) {
  const id = Number(listingTypeId);
  const color = pressed ? '#fff' : listingTypeColor(id);
  switch (id) {
    case 0:
      return iconAll(pressed ? '#fff' : null);
    case 1:
      return iconHome(color);
    case 2:
      return iconPeople(color);
    case 3:
      return iconGroups(color);
    case 4:
      return iconHome(color);
    default:
      return '';
  }
}

/** Listing-type glyph for card/detail badges (respects host_resident on roommate_needed). */
function listingTypeBadgeIcon(listing, { pressed = false } = {}) {
  const listingTypeId = listingTypeIdFromListing(listing);
  if (!listingTypeId) return '';
  const color = pressed ? '#fff' : listingTypeColor(listingTypeId);
  if (listingTypeId === 2 && isHostAbsent(listing)) {
    return iconPerson(color);
  }
  return filterListingTypeIcon(listingTypeId, { pressed });
}

/** True when a listing has a room scan available in any form the client can
 * render (Convert3D's GLB conversion, or the raw USDZ point cloud — mirrors
 * the mobile tile's [Room3dIconBadge] visibility check). */
function listingHas3dTour(listing) {
  return Boolean(listing?.room_scan_glb_url) || Boolean(listing?.point_cloud_url);
}

/** Compact corner badge marking a listing with a 3D room scan on feed cards
 * — reuses the isometric cube glyph shared with the detail page's room scan
 * toggle (mirrors mobile's Room3dIconBadge / Icons.view_in_ar). */
function threeDTourBadgeHtml(listing, lang = getLang()) {
  if (!listingHas3dTour(listing)) return '';
  const label = t('card.threeDTour.aria', lang);
  return `<div class="threed-badge" role="img" aria-label="${escapeHtml(label)}">${iconCube()}</div>`;
}

/** Neutral man+woman glyph (Material "wc") for the compact feed ribbon's
 * cycling gender chip in its "any" (off) state — no color so it inherits the
 * chip's muted text color, matching the district pin / metro "M" badges'
 * neutral resting look. */
function iconGenderAny() {
  return chipIconFilled(
    null,
    'M5.5 22v-7.5H4V9c0-1.1.9-2 2-2h3c1.1 0 2 .9 2 2v5.5H9.5V22h-4zM18 22v-6h3l-2.54-7.63A2.01 2.01 0 0 0 16.56 7h-.12a2 2 0 0 0-1.9 1.37L12 16h3v6h3zM7.5 6c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2zm9 0c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2z',
  );
}

function filterGenderIcon(gender, { pressed = false } = {}) {
  const value = Number(gender);
  if (!value) return '';
  const color = pressed ? '#fff' : genderColor(value);
  switch (value) {
    case 1:
      return iconMale(color);
    case 2:
      return iconFemale(color);
    default:
      return '';
  }
}

function formatDate(value, lang) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const locale = lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'uz-UZ';
  return stripLocaleYearSuffix(d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }));
}

/** Match mobile app AmenityIconHelper + listing tile/detail sort order. */
const AMENITY_TILE_PRIORITY = ['wifi', 'air_conditioning', 'bed', 'oven'];
const AMENITY_DETAIL_PRIORITY = ['wifi', 'air_conditioning'];

/** Match mobile AmenitiesCache.defaultOrderedCodes (create/edit listing form). */
const AMENITY_FORM_ORDER = [
  'wifi',
  'tv',
  'oven',
  'air_conditioning',
  'bed',
  'refrigerator',
  'washing_machine',
  'microwave',
  'pets',
];

/** Material-style icon paths (24×24 viewBox, filled). */
const AMENITY_ICON_PATHS = {
  wifi: 'M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z',
  internet: 'M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z',
  parking: 'M13 3H6v18h4v-6h3c3.31 0 6-2.69 6-6s-2.69-6-6-6zm0 10h-3V9h3c1.66 0 3 1.34 3 3s-1.34 3-3 3z',
  bed: 'M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z',
  air_conditioning: 'M22 11h-4.17l3.24-3.24-1.41-1.41L15 11h-2V9l4.66-4.66-1.41-1.41L13 6.17V2h-2v4.17L7.76 2.93 6.34 4.34 11 9v2H9L4.34 6.34 2.93 7.76 6.17 11H2v2h4.17l-3.24 3.24 1.41 1.41L9 13h2v2l-4.66 4.66 1.41 1.41L11 17.83V22h2v-4.17l3.24 3.24 1.41-1.41L13 15v-2h2l4.66 4.66 1.41-1.41L17.83 13H22z',
  tv: 'M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z',
  microwave: 'M20 8H4c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-8c0-1.1-.9-2-2-2zm-8 9c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm6-1H9v-2h9v2z',
  washing_machine: 'M18 2.01L6 2c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-1.99-2zM9 18c-1.65 0-3-1.35-3-3s1.35-3 3-3 3 1.35 3 3-1.35 3-3 3zm8-1H7v-2h10v2z',
  refrigerator: 'M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM9 4h2v5H9V4zm4 0h2v5h-2V4z',
  gas_stove: 'M13.5.67s.74 2.65.74 4.8c0 2.49-2.01 4.5-4.5 4.5S5.24 7.96 5.24 5.47c0-2.15.74-4.8.74-4.8C4.55 1.4 3 3.05 3 5.47 3 8.53 5.86 11 9.24 11c3.38 0 6.24-2.47 6.24-5.53 0-2.42-1.55-4.07-2.12-4.8z',
  stove: 'M13.5.67s.74 2.65.74 4.8c0 2.49-2.01 4.5-4.5 4.5S5.24 7.96 5.24 5.47c0-2.15.74-4.8.74-4.8C4.55 1.4 3 3.05 3 5.47 3 8.53 5.86 11 9.24 11c3.38 0 6.24-2.47 6.24-5.53 0-2.42-1.55-4.07-2.12-4.8z',
  oven: 'M6.5 10H4v7h2.5v-7zm4.5 7h2V10H11v7zm5-7H14v7h2.5v-7zM20 8H4c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-8c0-1.1-.9-2-2-2z',
  furniture: 'M20 9V7c0-1.1-.9-2-2-2h-3c-1.1 0-2 .9-2 2v2H9V7c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v2c-1.1 0-2 .9-2 2v5h1.33L4 19h1v.5c0 .83.67 1.5 1.5 1.5S7 20.33 7 19.5V19h2v.5c0 .83.67 1.5 1.5 1.5S12 20.33 12 19.5V19h2v.5c0 .83.67 1.5 1.5 1.5S16 20.33 16 19.5V19h1l.67-3H22v-5c0-1.1-.9-2-2-2z',
  kitchen_appliances: 'M8.1 13.34l2.83-2.83L3.91 3.5c-1.56 1.56-1.56 4.09 0 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z',
  shower: 'M9 5v2h10V5H9zm12 6v8h-4v-7c0-1.1-.9-2-2-2h-6c-1.1 0-2 .9-2 2v7H3v-8c0-1.66 1.34-3 3-3h12c1.66 0 3 1.34 3 3z',
  pets: 'M4.5 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zm4.5-4a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zm6 0a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zm4.5 4a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5M17.5 14.5c-1.5 3-4.5 4.5-6.5 4.5s-5-1.5-6.5-4.5c-.3-.6-.2-1.3.3-1.8.5-.5 1.2-.6 1.8-.3 1 .5 2.2.8 3.4.8s2.4-.3 3.4-.8c.6-.3 1.3-.2 1.8.3.5.5.6 1.2.3 1.8z',
  no_smoking: 'M2 19h18v-2H2v2zm12.57-9.67c-.23-.05-.46-.08-.69-.08-1.98 0-3.58 1.18-4.3 2.88H9.61V5.08C9.57 5.05 9.53 5 9.49 5c-.32 0-.57.26-.57.58v8.15c0 .32.25.57.57.57.3 0 .55-.23.57-.54v-1.28h.95c.36 1.98 2.06 3.47 4.07 3.47.23 0 .46-.03.69-.08l-2.22 2.22 1.41 1.41L19.41 11l-4.84-4.84-1.41 1.41 2.22 2.22z',
  default: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
};

function getAmenityCode(amenity) {
  const code = String(amenity?.code ?? '').trim().toLowerCase();
  return code || null;
}

function amenitySortRank(code, priorityList) {
  const normalized = String(code ?? '').trim().toLowerCase();
  const priorityIndex = priorityList.indexOf(normalized);
  if (priorityIndex !== -1) return priorityIndex;
  if (normalized === 'pets') return priorityList.length + 1;
  return priorityList.length;
}

function amenityFormSortRank(code) {
  const normalized = String(code ?? '').trim().toLowerCase();
  const priorityIndex = AMENITY_FORM_ORDER.indexOf(normalized);
  return priorityIndex !== -1 ? priorityIndex : AMENITY_FORM_ORDER.length;
}

function sortAmenities(amenities, variant = 'tile') {
  if (variant === 'form') {
    return sortAmenitiesForForm(amenities);
  }
  const priority = variant === 'detail' ? AMENITY_DETAIL_PRIORITY : AMENITY_TILE_PRIORITY;
  const list = Array.isArray(amenities) ? [...amenities] : [];
  list.sort((a, b) => {
    const rankCompare = amenitySortRank(getAmenityCode(a), priority)
      - amenitySortRank(getAmenityCode(b), priority);
    if (rankCompare !== 0) return rankCompare;
    return String(getAmenityCode(a) ?? '').localeCompare(String(getAmenityCode(b) ?? ''));
  });
  return list;
}

function sortAmenitiesForForm(amenities) {
  const list = Array.isArray(amenities) ? [...amenities] : [];
  list.sort((a, b) => {
    const rankCompare = amenityFormSortRank(getAmenityCode(a))
      - amenityFormSortRank(getAmenityCode(b));
    if (rankCompare !== 0) return rankCompare;
    return String(getAmenityCode(a) ?? '').localeCompare(String(getAmenityCode(b) ?? ''));
  });
  return list;
}

function amenityIconPath(code) {
  const normalized = String(code ?? '').trim().toLowerCase();
  return AMENITY_ICON_PATHS[normalized] || AMENITY_ICON_PATHS.default;
}

function amenityIconHtml(code, { size = 18, className = 'amenity-icon' } = {}) {
  const path = amenityIconPath(code);
  return `<span class="${className}" aria-hidden="true" style="width:${size}px;height:${size}px"><svg viewBox="0 0 24 24" width="${size}" height="${size}"><path d="${path}" fill="currentColor"/></svg></span>`;
}

function amenityChipHtml(amenity, lang) {
  const label = localized(amenity, lang);
  const code = getAmenityCode(amenity);
  return `<span class="amenity-chip" role="img" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${amenityIconHtml(code, { size: 18 })}</span>`;
}

function amenityIconsRowHtml(amenities, lang, { maxVisible = 5, showAll = false, variant = 'tile' } = {}) {
  const sorted = sortAmenities(amenities, variant);
  if (sorted.length === 0) return '';
  const limit = showAll ? sorted.length : maxVisible;
  const visible = sorted.slice(0, limit);
  const remaining = showAll ? 0 : sorted.length - visible.length;
  const icons = visible.map((amenity) => {
    const label = localized(amenity, lang);
    const code = getAmenityCode(amenity);
    return `<span class="amenity-inline" role="img" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${amenityIconHtml(code, { size: 16, className: 'amenity-icon amenity-icon-inline' })}</span>`;
  }).join('');
  const overflow = remaining > 0
    ? `<span class="amenity-more" aria-label="+${remaining}">+${remaining}</span>`
    : '';
  return `${icons}${overflow}`;
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** iOS fallback when Universal Links are not verified yet. */
function tryOpenListingInApp(listingId, onFallback) {
  const id = String(listingId ?? '').trim();
  if (!id || !/^\d+$/.test(id) || !isIOS() || isMiniApp()) {
    if (onFallback) onFallback();
    return false;
  }
  window.location.href = `uydosh://listing/${encodeURIComponent(id)}`;
  if (onFallback) setTimeout(onFallback, 1200);
  return true;
}

Object.assign(window.UyDosh, {
  listingTypeColor,
  genderColor,
  genderBadgeLabel,
  genderBadgeHtml,
  listingTypeBadgeIcon,
  filterListingTypeIcon,
  filterGenderIcon,
  iconGenderAny,
  listingHas3dTour,
  threeDTourBadgeHtml,
  formatDate,
  getAmenityCode,
  sortAmenities,
  sortAmenitiesForForm,
  amenityIconHtml,
  amenityChipHtml,
  amenityIconsRowHtml,
  isIOS,
  tryOpenListingInApp,
});
