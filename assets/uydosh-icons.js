// UyDosh Web — feed empty-state markup, listing type / gender / metro line
// enums shared across pages, metro line formatting, the base SVG icon
// set (pin, metro, clock, calendar, lock, camera, article), the shared
// "chrome" icon set (list, mapPin, house, heartOutline, plus, chevrons,
// person — see CHROME_ICONS/hydrateIcons) plus the create-form
// description/title templates.
// Depends on uydosh-i18n.js (t()). Load after it.

/**
 * Static "chrome" icons shared verbatim across mini-app pages — view-tab
 * icons, wizard back/next, the create FAB, scroll-to-top, back links, and
 * the account menu. Each is a self-contained `<svg>` (stroke/fill set on the
 * root so it recolors via CSS `color`/`currentColor` wherever it's placed).
 *
 * HTML pages render these by adding `data-icon="name"` to the element that
 * should hold the icon (see `hydrateIcons`), e.g.:
 *   <span class="view-tab-icon" aria-hidden="true" data-icon="list"></span>
 * JS call sites can instead call `iconChrome('name')` directly.
 */
const CHROME_ICONS = {
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13"></path><path d="M3 6h.01M3 12h.01M3 18h.01" stroke-width="3"></path></svg>',
  mapPin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z"></path><circle cx="12" cy="9.5" r="2.25"></circle></svg>',
  house: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5"></path><path d="M6 9.5V19a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1V9.5"></path></svg>',
  heartOutline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 20.5s-7-4.5-9-9A5 5 0 0 1 12 6a5 5 0 0 1 9 5.5c-2 4.5-9 9-9 9Z"></path></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>',
  chevronUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"></path></svg>',
  chevronDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg>',
  chevronLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"></path></svg>',
  chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"></path></svg>',
  person: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="3.5"></circle><path d="M4.5 20c1.4-3.6 4.4-5.5 7.5-5.5s6.1 1.9 7.5 5.5" stroke-linecap="round"></path></svg>',
  graduationCap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 9.5 12 5l10 4.5-10 4.5-10-4.5Z"></path><path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5"></path><path d="M20 9.5v5.5"></path></svg>',
  sparkles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 3c.6 3 2 4.4 5 5-3 .6-4.4 2-5 5-.6-3-2-4.4-5-5 3-.6 4.4-2 5-5Z"></path><path d="M18.5 14.5c.3 1.4.9 2 2.3 2.3-1.4.3-2 .9-2.3 2.3-.3-1.4-.9-2-2.3-2.3 1.4-.3 2-.9 2.3-2.3Z"></path></svg>',
  // Lifestyle chip/field icons (profile.html) — kept small and generic
  // (check/x/dash for yes/no/unspecified) so they read clearly at chip size.
  dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M8 12h8" stroke-linecap="round"></path></svg>',
  checkCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M8 12.5l2.5 2.5L16 9" stroke-linecap="round" stroke-linejoin="round"></path></svg>',
  xCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M9.5 9.5l5 5M14.5 9.5l-5 5" stroke-linecap="round"></path></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 3v2.5M12 18.5V21M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M3 12h2.5M18.5 12H21M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"></path></svg>',
  sunset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 18h18"></path><circle cx="12" cy="12" r="4"></circle><path d="M12 3.5v2M5.6 8.6l1.4 1.4M18.4 8.6l-1.4 1.4"></path></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.2A8.3 8.3 0 1 1 9.8 4a6.8 6.8 0 0 0 10.2 10.2Z"></path></svg>',
  cigarette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="14" width="13" height="3" rx="1"></rect><path d="M11.5 14v3"></path><path d="M17.5 14.5c1-1 1-2.5 0-3.5M20 13c1.4-1.4 1.4-3.4 0-4.8"></path></svg>',
  smokeFree: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="14" width="11" height="3" rx="1"></rect><path d="M16 14.5c1-1 1-2.5 0-3.5"></path><path d="M4 20L20 4"></path></svg>',
  wineGlass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3h8l-1 6.5a3 3 0 0 1-6 0L8 3Z"></path><path d="M12 12.5V19M9 19h6"></path></svg>',
  noDrink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3h8l-1 6.5a3 3 0 0 1-6 0L8 3Z"></path><path d="M12 12.5V19M9 19h6"></path><path d="M4 20L20 4"></path></svg>',
  cookingPot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11h16v2a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6v-2Z"></path><path d="M2 11h20"></path><path d="M8 11V8M12 11V7M16 11V8"></path></svg>',
  takeout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1.2 11a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z"></path><path d="M9 8V6a3 3 0 0 1 6 0v2"></path></svg>',
  cat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4l2 4.5M19 4l-2 4.5"></path><path d="M6.5 8h11a4.5 4.5 0 0 1 4.5 4.5v2A6.5 6.5 0 0 1 15.5 21h-7A6.5 6.5 0 0 1 2 14.5v-2A4.5 4.5 0 0 1 6.5 8Z"></path><path d="M9 14v.5M15 14v.5"></path><path d="M10.3 16.8c1 .7 2.4.7 3.4 0"></path></svg>',
  dog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8c-1.2-1.5-1.2-3.5 0-5 1.4.5 2.6 1.6 3 3"></path><path d="M19 8c1.2-1.5 1.2-3.5 0-5-1.4.5-2.6 1.6-3 3"></path><path d="M6 9h12a3 3 0 0 1 3 3v1.5A6.5 6.5 0 0 1 14.5 20h-5A6.5 6.5 0 0 1 3 13.5V12a3 3 0 0 1 3-3Z"></path><path d="M9.5 13.8v.4M14.5 13.8v.4"></path><path d="M11 16.3h2"></path></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8.5" cy="8" r="3"></circle><path d="M2.5 19c.8-3 3-4.8 6-4.8s5.2 1.8 6 4.8"></path><path d="M15 8.2a3 3 0 1 1 3.6 2.9"></path><path d="M15.5 14.5c2.3.4 3.9 1.9 4.5 4.4"></path></svg>',
  volume: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10v4h3.5L12 17.5v-11L7.5 10H4Z"></path><path d="M16 9.5a4 4 0 0 1 0 5M18.5 7a7.5 7.5 0 0 1 0 10"></path></svg>',
  chatBubble: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-4 3.5V16H4V5Z"></path></svg>',
  // Compatibility breakdown row icons (listing.html + uydosh-profile-match.js)
  // for the "language" / "age" / "budget" matching dimensions — no existing
  // chrome icon fit these, so kept minimal and consistent with the set above.
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3c2.5 2.5 4 5.8 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.8-4-9s1.5-6.5 4-9Z"></path></svg>',
  cake: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6"></path><path d="M4 20h16"></path><path d="M8 12V9M12 12V9M16 12V9"></path><path d="M8 9c0-1 .7-1.5.7-2.5S8 4.5 8 4M12 9c0-1 .7-1.5.7-2.5S12 4.5 12 4M16 9c0-1 .7-1.5.7-2.5S16 4.5 16 4"></path><path d="M4 16.5c1 .7 2 .7 3 0s2-.7 3 0 2 .7 3 0 2-.7 3 0 2 .7 3 0"></path></svg>',
  wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h13A1.5 1.5 0 0 1 19 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 3 16.5v-9Z"></path><path d="M3 10h16.5a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5H17"></path><circle cx="16.25" cy="13" r="1"></circle></svg>',
};

function iconChrome(name) {
  return CHROME_ICONS[name] || '';
}

/** Fills every `[data-icon]` element under `root` with its named chrome icon markup. */
function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    el.innerHTML = iconChrome(el.getAttribute('data-icon'));
  });
}

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

/**
 * Transfer (interchange) station pairs, matching mobile MetroCache.
 * Maps a station id to its transfer partner's id + line + name (per
 * language, matching mobile metro_cache.dart), so a transfer station can
 * render the connecting station's icon + name alongside its own.
 */
const METRO_TRANSFER_PAIRS = {
  // Paxtakor <-> Alisher Navoiy
  12: { partnerId: 22, partnerLine: 2, partnerName: { uz: 'Alisher Navoiy', ru: 'Алишер Навои', en: 'Alisher Navoi' } },
  22: { partnerId: 12, partnerLine: 1, partnerName: { uz: 'Paxtakor', ru: 'Пахтакор', en: 'Pakhtakor' } },
  // A. Temur Xiyoboni <-> Yunus Rajabiy
  14: { partnerId: 30, partnerLine: 3, partnerName: { uz: 'Yunus Rajabiy', ru: 'Юнус Раджаби', en: 'Yunus Rajabiy' } },
  30: { partnerId: 14, partnerLine: 1, partnerName: { uz: 'A. Temur Xiyoboni', ru: 'Сквер Амира Темура', en: 'A. Temur Square' } },
  // Oybek <-> Mingurik
  25: { partnerId: 29, partnerLine: 3, partnerName: { uz: 'Mingurik', ru: 'Мингурик', en: 'Mingurik' } },
  29: { partnerId: 25, partnerLine: 2, partnerName: { uz: 'Oybek', ru: 'Ойбек', en: 'Oybek' } },
  // Chinor <-> Qipchoq
  1: { partnerId: 50, partnerLine: 4, partnerName: { uz: 'Qipchoq', ru: 'Кипчок', en: 'Qipchoq' } },
  50: { partnerId: 1, partnerLine: 1, partnerName: { uz: 'Chinor', ru: 'Чинор', en: 'Chinor' } },
  // Do'stlik <-> Texnopark
  28: { partnerId: 37, partnerLine: 4, partnerName: { uz: 'Texnopark', ru: 'Технопарк', en: 'Technopark' } },
  37: { partnerId: 28, partnerLine: 2, partnerName: { uz: 'Doʻstlik', ru: 'Дустлик', en: 'Dustlik' } },
};

function metroTransferPartner(stationId) {
  return METRO_TRANSFER_PAIRS[Number(stationId)] || null;
}

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

/**
 * Metro-line selector ribbon: one `.chip-line` button per line, each an
 * icon-only "M" badge that reveals its line name (slide + fade, via the
 * shared `.chip-line` / `.chip-label-collapse` CSS in telegram-shared.css)
 * once selected. Shared by the feed filter bar (expanded + compact rows,
 * `compact: true`) and the create-listing wizard's metro-line picker so all
 * three stay byte-identical instead of drifting via copy-paste.
 *
 * Callers are expected to wire up `[data-subway-line]` click handlers
 * themselves (see `syncMetroLineChipPressedState` in telegram-feed.js for
 * the aria-pressed-only update used to let the reveal animation play).
 */
function metroLineChipsHtml(selectedId, lang = getLang(), { compact = false } = {}) {
  const selected = Number(selectedId);
  return METRO_LINE_IDS.map((lineId) => {
    const pressed = selected === lineId;
    const color = metroLineColor(lineId) || 'currentColor';
    const label = metroLineLabel(lineId, lang);
    return `
    <button
      type="button"
      class="chip chip-line${compact ? ' chip-line-compact' : ''}"
      data-subway-line="${lineId}"
      data-haptic="selection"
      style="--line-color:${color}"
      aria-pressed="${pressed ? 'true' : 'false'}"
      aria-label="${escapeHtml(label)}"
    >${metroLineBadgeHtml(lineId)}<span class="chip-label-collapse"><span class="chip-label">${escapeHtml(label)}</span></span></button>
  `;
  }).join('');
}

/**
 * Generic `.chip`-style toggle button — shared by the feed filter ribbon
 * (telegram-feed.js: listing type, gender, photo, period chips), the
 * create-listing wizard (telegram-create.js: listing type, location mode,
 * gender, amenity chips), and the profile page's lifestyle chips
 * (telegram-profile.js), all of which rendered near-identical
 * `<button class="chip" data-*="..." data-haptic="selection"
 * aria-pressed="...">icon+label</button>` markup by hand before this existed.
 * Bespoke shapes (the metro-line reveal ribbon, icon-only chips with just an
 * `aria-label`) still just pass a different `className`/`labelWrap` — this
 * only centralizes the common attribute/escaping plumbing, not every
 * possible chip variant.
 */
function chipButtonHtml({
  className = 'chip',
  attrs = {},
  pressed,
  icon = '',
  label = '',
  labelWrap = true,
  labelClassName = 'chip-label',
  ariaLabel = '',
  haptic = 'selection',
} = {}) {
  const attrHtml = Object.entries(attrs).map(([name, value]) => {
    if (value === true) return ` ${name}`;
    if (value == null || value === false) return '';
    return ` ${name}="${escapeHtml(String(value))}"`;
  }).join('');
  const pressedHtml = pressed == null ? '' : ` aria-pressed="${pressed ? 'true' : 'false'}"`;
  const ariaLabelHtml = ariaLabel ? ` aria-label="${escapeHtml(ariaLabel)}"` : '';
  const labelText = label ? escapeHtml(label) : '';
  const labelHtml = labelText ? (labelWrap ? `<span class="${labelClassName}">${labelText}</span>` : labelText) : '';
  return `<button type="button" class="${className}"${attrHtml} data-haptic="${haptic}"${pressedHtml}${ariaLabelHtml}>${icon}${labelHtml}</button>`;
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

/** Street address marker — used on the listing detail page when the host entered an exact address. */
function iconHome() {
  return iconSvg(LOCATION_PIN_COLOR, `
    <path d="M4 10.5 12 4l8 6.5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
    <path d="M6 9.5V19a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1V9.5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
  `);
}

/** "My location" crosshair — used by the create-listing address field's "Use current location" button. */
function iconLocateMe(color = null) {
  return iconSvg(color, `
    <circle cx="12" cy="12" r="6.5" stroke-width="2"></circle>
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"></circle>
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke-width="2" stroke-linecap="round"></path>
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

/**
 * Trailing "<-> icon Name" suffix for a station's transfer partner, shown
 * after the station name for interchange stations, e.g.
 * "icon Do'stlik <-> icon Texnopark". Empty string when the station isn't a
 * transfer station.
 */
function metroTransferSuffixHtml(stationId, lang = getLang()) {
  const partner = metroTransferPartner(stationId);
  if (!partner) return '';
  const name = partner.partnerName?.[lang] || partner.partnerName?.en || '';
  return `<span class="station-item-transfer">↔ ${iconMetro(partner.partnerLine)}<span class="station-item-transfer-name">${escapeHtml(name)}</span></span>`;
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

/** Match mobile app owner-toolbar view count icon (CupertinoIcons.eye). */
function iconEye() {
  return iconSvg(null, `
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
    <circle cx="12" cy="12" r="3" stroke-width="2"></circle>
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

/** "My Listings" row action icons (edit / show / hide / boost-renew / delete). */
function iconPencil() {
  return iconSvg(null, `
    <path d="M12 20h9" stroke-width="2" stroke-linecap="round"></path>
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
  `);
}

function iconEyeOff() {
  return iconSvg(null, `
    <path d="M10.6 5.1A11 11 0 0 1 12 5c7 0 11 7 11 7a13.4 13.4 0 0 1-3.1 3.9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
    <path d="M6.5 6.6C3.7 8.3 1 12 1 12s4 7 11 7a10.6 10.6 0 0 0 4.2-.9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
    <path d="M3 3l18 18" stroke-width="2" stroke-linecap="round"></path>
  `);
}

function iconArrowUp() {
  return iconSvg(null, `
    <path d="M12 19V5" stroke-width="2" stroke-linecap="round"></path>
    <path d="M5 12l7-7 7 7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
  `);
}

function iconTrash() {
  return iconSvg(null, `
    <path d="M3 6h18" stroke-width="2" stroke-linecap="round"></path>
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
    <path d="M10 11v6M14 11v6" stroke-width="2" stroke-linecap="round"></path>
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
  iconChrome,
  hydrateIcons,
  feedEmptyStateHtml,
  metroLineColor,
  metroLineLabel,
  metroLineBadgeHtml,
  metroLineChipsHtml,
  chipButtonHtml,
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
  metroTransferPartner,
  metroTransferSuffixHtml,
  iconPin,
  iconHome,
  iconLocateMe,
  iconMetro,
  iconClock,
  iconPhone,
  iconEye,
  iconEyeOff,
  iconCalendar,
  iconLock,
  iconPencil,
  iconArrowUp,
  iconTrash,
  iconCamera,
  filterPhotoIcon,
  iconCheckboxPair,
  iconArticle,
  descriptionTemplateText,
  presetListingTitleText,
});

// This script loads at the bottom of the page (after the markup containing
// `[data-icon]` placeholders), so the DOM is already parsed by the time this
// runs — no DOMContentLoaded wait needed.
hydrateIcons();
