// UyDosh Web — feed empty-state markup, listing type / gender / metro line
// enums shared across pages, metro line formatting, and the base SVG icon
// set (pin, metro, clock, calendar, lock, camera, article) plus the create-form
// description/title templates.
// Depends on uydosh-i18n.js (t()). Load after it.

let feedEmptyStateStylesInjected = false;

function ensureFeedEmptyStateStyles() {
  if (feedEmptyStateStylesInjected) return;
  feedEmptyStateStylesInjected = true;
  const style = document.createElement('style');
  style.id = 'uydosh-feed-empty-state';
  style.textContent = `
    .status.is-empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      min-height: min(52vh, 420px);
      padding: 24px 16px 40px;
      text-align: center;
    }
    .feed-empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      max-width: 280px;
    }
    .feed-empty-state-icon {
      width: 72px;
      height: 72px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      background: color-mix(in srgb, var(--accent, #60a5fa) 14%, transparent);
      color: color-mix(in srgb, var(--muted, #94a3b8) 88%, var(--fg, #fff));
    }
    .feed-empty-state-icon svg {
      width: 36px;
      height: 36px;
      display: block;
    }
    .feed-empty-state-icon svg * {
      stroke: currentColor;
      fill: none;
    }
    .feed-empty-state-title {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      line-height: 1.35;
      color: var(--fg);
    }
  `;
  document.head.appendChild(style);
}

/** Centered empty feed markup with a housing icon above the title. */
function feedEmptyStateHtml(lang = getLang()) {
  ensureFeedEmptyStateStyles();
  const title = escapeHtml(t('feed.empty', lang));
  return `
    <div class="feed-empty-state" role="status">
      <div class="feed-empty-state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M3 10.5 12 3l9 7.5" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"></path>
          <path d="M5 9.5V20h14V9.5" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"></path>
          <path d="M9 20v-6h6v6" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
      </div>
      <p class="feed-empty-state-title">${title}</p>
    </div>
  `;
}

/** Tashkent metro line colors (match mobile app). */
const METRO_LINE_COLORS = {
  1: '#E53E3E',
  2: '#3182CE',
  3: '#38A169',
  4: '#FF9800',
};

/** Tashkent metro line names (match mobile MetroCache). */
const METRO_LINE_NAMES = {
  1: { uz: 'Chilanzar', ru: 'Чиланзар', en: 'Chilanzar' },
  2: { uz: 'Oʻzbekiston', ru: 'Узбекистан', en: 'Uzbekistan' },
  3: { uz: 'Yunusobod', ru: 'Юнусабад', en: 'Yunusobod' },
  4: { uz: 'Circle', ru: 'Кольцевая', en: 'Circle' },
};

const METRO_LINE_IDS = [1, 2, 3, 4];

/** Listing type ids shared by the Telegram feed and create-listing wizard. */
const LISTING_TYPE_ALL = 0;
const LISTING_TYPE_ROOM_NEEDED = 1;
const LISTING_TYPE_ROOMMATE_NEEDED = 2;
const LISTING_TYPE_GROUP_FORMING = 3;

const GENDER_ANY = 0;
const GENDER_MALE = 1;
const GENDER_FEMALE = 2;

const METRO_LINE_ANY = 0;

function metroLineColor(line) {
  const n = Number(line);
  return METRO_LINE_COLORS[n] || null;
}

function metroLineLabel(line, lang = getLang()) {
  const names = METRO_LINE_NAMES[Number(line)];
  return names?.[lang] || names?.en || '';
}

/** Circular “M” badge matching mobile MLetterIcon. */
function metroLineBadgeHtml(line) {
  const color = metroLineColor(line) || 'currentColor';
  return `<span class="metro-m-badge" style="--line-color:${color}" aria-hidden="true">M</span>`;
}

function resolveMetroLine(listing) {
  const st = listing?.subway_station;
  if (st?.line != null) return Number(st.line);
  if (listing?.subway_line_id != null) return Number(listing.subway_line_id);
  return null;
}

function iconSvg(color, paths) {
  const colorStyle = color ? ` style="color:${color}"` : '';
  return `<span class="icon" aria-hidden="true"${colorStyle}><svg viewBox="0 0 24 24" fill="none">${paths}</svg></span>`;
}

/** Match mobile app listing tile location pin (AppColors.error). */
const LOCATION_PIN_COLOR = '#F44336';

function iconPin() {
  return iconSvg(LOCATION_PIN_COLOR, `
    <path d="M12 21s7-4.8 7-11a7 7 0 1 0-14 0c0 6.2 7 11 7 11Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
    <path d="M12 10.5a2.5 2.5 0 1 0 0.001-5.001A2.5 2.5 0 0 0 12 10.5Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
  `);
}

function iconMetro(line) {
  const color = metroLineColor(line) || 'currentColor';
  return iconSvg(color, `
    <path d="M7 3h10a3 3 0 0 1 3 3v10a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V6a3 3 0 0 1 3-3Z" stroke-width="2" stroke-linejoin="round"></path>
    <path d="M8 17h0.01M16 17h0.01" stroke-width="3" stroke-linecap="round"></path>
    <path d="M7 21l-2 2M17 21l2 2" stroke-width="2" stroke-linecap="round"></path>
    <path d="M7 8h10" stroke-width="2" stroke-linecap="round"></path>
  `);
}

function iconClock() {
  return iconSvg(null, `
    <circle cx="12" cy="12" r="9" stroke-width="2"></circle>
    <path d="M12 7v5l3 2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
  `);
}

function iconPhone() {
  return iconSvg(null, `
    <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.9 21 3 13.1 3 3.6c0-.6.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1L6.6 10.8Z" stroke-width="2" stroke-linejoin="round"></path>
  `);
}

function iconCalendar() {
  return iconSvg(null, `
    <rect x="4" y="5" width="16" height="16" rx="2" stroke-width="2" stroke-linejoin="round"></rect>
    <path d="M8 3v4M16 3v4M4 10h16" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
  `);
}

function iconLock() {
  return iconSvg(null, `
    <path d="M7 11V8a5 5 0 0 1 10 0v3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
    <rect x="5" y="11" width="14" height="10" rx="2" stroke-width="2" stroke-linejoin="round"></rect>
  `);
}

function iconCamera(color) {
  return chipIconFilled(
    color,
    'M9 2 7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.65 0-3 1.35-3 3s1.35 3 3 3 3-1.35 3-3-1.35-3-3-3z',
  );
}

/** Match mobile [Icons.article_outlined] for description templates. */
function iconArticle(color) {
  return iconSvg(color, `
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" stroke-width="2" stroke-linejoin="round"></path>
    <path d="M14 2v6h6" stroke-width="2" stroke-linejoin="round"></path>
    <path d="M16 13H8" stroke-width="2" stroke-linecap="round"></path>
    <path d="M16 17H8" stroke-width="2" stroke-linecap="round"></path>
    <path d="M10 9H8" stroke-width="2" stroke-linecap="round"></path>
  `);
}

/** Listing description starter text; mirrors mobile [ListingDescriptionTemplateButton]. */
function descriptionTemplateText(listingTypeId, gender, lang = getLang()) {
  const typeId = Number(listingTypeId);
  if (typeId === 1) return t('create.descriptionTemplate.roomNeeded', lang);
  if (typeId === 3) return t('create.descriptionTemplate.groupForming', lang);
  if (Number(gender) === 2) return t('create.descriptionTemplate.roommateNeededFemale', lang);
  return t('create.descriptionTemplate.roommateNeededMale', lang);
}

/** Default listing title hashtag; mirrors mobile [ListingUtils.presetListingTitleL10nKey]. */
function presetListingTitleText(listingTypeId, gender, lang = getLang()) {
  const typeId = Number(listingTypeId);
  const g = Number(gender) === 2 ? 2 : 1;
  if (typeId === 3) return t('create.presetTitle.groupForming', lang);
  if (typeId === 2) {
    return g === 2
      ? t('create.presetTitle.femaleRoommate', lang)
      : t('create.presetTitle.maleRoommate', lang);
  }
  return g === 2
    ? t('create.presetTitle.femaleRoom', lang)
    : t('create.presetTitle.maleRoom', lang);
}

function filterPhotoIcon({ pressed = false } = {}) {
  const color = pressed ? '#fff' : null;
  return iconCamera(color);
}

/** Checked/unchecked checkbox glyphs, matching mobile's
 * Icons.check_box / Icons.check_box_outline_blank used by
 * MultiStationPicker / MultiLocationPicker. */
function iconCheckboxChecked(color) {
  return chipIconFilled(
    color,
    'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
  );
}

function iconCheckboxUnchecked(color) {
  return chipIconFilled(
    color,
    'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z',
  );
}

/**
 * Checked + unchecked checkbox markup for a multi-select list row. Both
 * states are rendered and toggled purely via CSS keyed off the row's
 * `aria-pressed` attribute (see `.checkbox-icon-checked` /
 * `.checkbox-icon-unchecked` rules in telegram/create.html), so callers that
 * patch `aria-pressed` in place — see `updateStationSelectionUi` /
 * `updateLocationSelectionUi` in telegram-create.js — don't need to
 * re-render the row to reflect a new selection state.
 */
function iconCheckboxPair() {
  return `<span class="checkbox-icon" aria-hidden="true">` +
    `<span class="checkbox-icon-unchecked">${iconCheckboxUnchecked('var(--muted)')}</span>` +
    `<span class="checkbox-icon-checked">${iconCheckboxChecked('var(--brand)')}</span>` +
    `</span>`;
}

Object.assign(window.UyDosh, {
  feedEmptyStateHtml,
  metroLineColor,
  metroLineLabel,
  metroLineBadgeHtml,
  METRO_LINE_IDS,
  METRO_LINE_ANY,
  LISTING_TYPE_ALL,
  LISTING_TYPE_ROOM_NEEDED,
  LISTING_TYPE_ROOMMATE_NEEDED,
  LISTING_TYPE_GROUP_FORMING,
  GENDER_ANY,
  GENDER_MALE,
  GENDER_FEMALE,
  resolveMetroLine,
  iconPin,
  iconMetro,
  iconClock,
  iconPhone,
  iconCalendar,
  iconLock,
  iconCamera,
  filterPhotoIcon,
  iconCheckboxPair,
  iconArticle,
  descriptionTemplateText,
  presetListingTitleText,
});
