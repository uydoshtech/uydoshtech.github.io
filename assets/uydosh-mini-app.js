// UyDosh Web — Mini App bootstrap: URL routing helpers, Telegram theme/safe-area
// handling, the mini-app header, and Firebase Analytics wiring.
// Depends on all other uydosh-*.js modules. Load last.

const MINI_APP_FEED_PATH = '/telegram/';
const MINI_APP_CREATE_PATH = '/telegram/create.html';

/** True inside Telegram Mini App or on `?mini=1` / /telegram/. */
function isMiniApp() {
  if (isMiniAppPage()) return true;
  try {
    const tg = window.Telegram?.WebApp;
    if (tg?.initData && String(tg.initData).length > 0) return true;
    if (tg?.platform && tg.platform !== 'unknown') return true;
  } catch { /* ignore */ }
  return false;
}

function listingPageUrl(id) {
  const lid = String(id ?? '').trim();
  if (!lid) return MINI_APP_FEED_PATH;
  if (isMiniApp()) {
    return `/listing.html?id=${encodeURIComponent(lid)}&mini=1`;
  }
  return `/listing/${encodeURIComponent(lid)}`;
}

function feedPageUrl() {
  return isMiniApp() ? MINI_APP_FEED_PATH : 'listings.html';
}

function createPageUrl() {
  return MINI_APP_CREATE_PATH;
}

function applyTelegramTheme(tg) {
  const p = tg?.themeParams;
  if (!p) return;
  const root = document.documentElement;
  if (p.bg_color) root.style.setProperty('--tg-bg', p.bg_color);
  if (p.text_color) root.style.setProperty('--tg-fg', p.text_color);
  if (p.hint_color) root.style.setProperty('--tg-muted', p.hint_color);
  if (p.button_color) root.style.setProperty('--tg-btn', p.button_color);
  if (p.secondary_bg_color) root.style.setProperty('--tg-card', p.secondary_bg_color);
}

/**
 * "Add your university" nudge banner (feed page only — see `maybeShowProfileNudge`).
 * Dismissed permanently on this device either via its own close button or by
 * completing a save on the profile page itself (see telegram-profile.js),
 * since `user_profiles.university_id` alone can't distinguish "never asked"
 * from "answered — not a student" (both are `null`).
 */
const PROFILE_NUDGE_DISMISSED_KEY = 'uydosh_profile_nudge_dismissed';
const PROFILE_NUDGE_STYLE_ID = 'uydosh-profile-nudge-styles';

function isProfileNudgeDismissed() {
  try {
    return localStorage.getItem(PROFILE_NUDGE_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function dismissProfileNudge() {
  try {
    localStorage.setItem(PROFILE_NUDGE_DISMISSED_KEY, '1');
  } catch { /* ignore */ }
  document.querySelector('.profile-nudge')?.remove();
}

function ensureProfileNudgeStyles() {
  if (document.getElementById(PROFILE_NUDGE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PROFILE_NUDGE_STYLE_ID;
  style.textContent = `
    .profile-nudge {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 10px 0 4px;
      padding: 11px 12px;
      border: 1px solid var(--stroke, rgba(127, 127, 127, 0.35));
      border-radius: 14px;
      background: color-mix(in srgb, var(--brand2, #e11d2e) 10%, transparent);
    }
    .profile-nudge-icon {
      flex-shrink: 0;
      display: inline-flex;
      color: var(--brand2, #e11d2e);
    }
    .profile-nudge-icon svg { width: 22px; height: 22px; display: block; }
    .profile-nudge-text {
      flex: 1;
      min-width: 0;
      font-size: 13px;
      font-weight: 600;
      line-height: 1.35;
      color: var(--fg);
    }
    .profile-nudge-cta {
      flex-shrink: 0;
      appearance: none;
      border: 0;
      border-radius: 999px;
      padding: 8px 14px;
      background: var(--brand2, #e11d2e);
      color: #fff;
      font-weight: 700;
      font-size: 12px;
      text-decoration: none;
      white-space: nowrap;
    }
    .profile-nudge-close {
      flex-shrink: 0;
      appearance: none;
      border: 0;
      background: transparent;
      color: var(--muted);
      width: 22px;
      height: 22px;
      padding: 0;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
    }
  `;
  document.head.appendChild(style);
}

function profileNudgeHtml() {
  return `
    <div class="profile-nudge content-gutter" data-profile-nudge>
      <span class="profile-nudge-icon" aria-hidden="true">${UyDosh.iconChrome('graduationCap')}</span>
      <span class="profile-nudge-text" data-i18n="profile.nudgeText"></span>
      <a class="profile-nudge-cta" href="${MINI_APP_PROFILE_PATH}" data-i18n="profile.nudgeCta"></a>
      <button type="button" class="profile-nudge-close" data-profile-nudge-close aria-label="${escapeHtml(t('profile.nudgeDismiss', getLang()))}">×</button>
    </div>`;
}

/**
 * Best-effort, non-blocking "add your university" nudge shown once per page
 * load on the feed when the signed-in user's profile is missing a
 * university (see `PROFILE_NUDGE_DISMISSED_KEY` for the suppression rule).
 * Silently no-ops on any auth/network failure — this must never block or
 * break the page it's called from.
 */
async function maybeShowProfileNudge(anchorEl) {
  if (!isMiniApp() || isProfileNudgeDismissed()) return;
  const anchor = anchorEl || document.querySelector('header.uydosh-mini-app-header');
  if (!anchor || anchor.parentElement?.querySelector('.profile-nudge')) return;
  try {
    const sessionReady = await ensureTelegramMiniAppSession();
    if (!sessionReady) return;
    const userId = getSessionUserId();
    if (!userId) return;
    const profile = await fetchProfile(userId);
    if (profile?.university_id != null) return;
    if (isProfileNudgeDismissed()) return; // re-check: user may have dismissed while this was in flight
    ensureProfileNudgeStyles();
    anchor.insertAdjacentHTML('afterend', profileNudgeHtml());
    const banner = anchor.parentElement?.querySelector('.profile-nudge');
    if (!banner) return;
    applyI18n(banner);
    banner.querySelector('[data-profile-nudge-close]')?.addEventListener('click', dismissProfileNudge);
  } catch (err) {
    console.warn('[UyDosh] profile nudge skipped', err);
  }
}

/**
 * `user_profiles` columns the Telegram profile page (telegram-profile.js)
 * can fill in today — used only to decide whether the account-menu "Profile"
 * green dot (below) should show, not tied to that page's own field list.
 */
const PROFILE_COMPLETENESS_FIELDS = [
  'university_id', 'employed', 'wakeup_time', 'sleep_time', 'cleanliness',
  'noise_level', 'sociability', 'guests_allowed', 'smoking_preference',
  'alcohol_preference', 'cooking_habits', 'pets_preference',
];

/** True when every field the profile page can edit is still unset. */
function isProfileEmpty(profile) {
  if (!profile) return true;
  return PROFILE_COMPLETENESS_FIELDS.every((key) => profile[key] == null);
}

/** Hides the green "profile not populated" dot on every account menu on the page. */
function hideProfileMenuBadge() {
  document.querySelectorAll('[data-profile-menu-badge]').forEach((el) => { el.hidden = true; });
}

/**
 * Best-effort, non-blocking green dot on the header account menu's "Profile"
 * item, shown whenever the signed-in user hasn't filled in anything on their
 * profile yet. Runs on every mini-app page (see initTelegramMiniApp) since
 * the account menu itself appears in every page header. Silently no-ops on
 * any auth/network failure — this must never block or break the page it's
 * called from.
 */
async function maybeShowProfileMenuBadge() {
  if (!isMiniApp()) return;
  try {
    const sessionReady = await ensureTelegramMiniAppSession();
    if (!sessionReady) return;
    const userId = getSessionUserId();
    if (!userId) return;
    let profile = null;
    try {
      profile = await fetchProfile(userId);
    } catch (err) {
      if (err?.status !== 404) throw err; // 404 = no profile row yet, i.e. definitely empty
    }
    if (!isProfileEmpty(profile)) return;
    document.querySelectorAll('[data-profile-menu-badge]').forEach((el) => { el.hidden = false; });
  } catch (err) {
    console.warn('[UyDosh] profile menu badge skipped', err);
  }
}

const MINI_APP_SAFE_AREA_STYLE_ID = 'uydosh-mini-app-safe-area-v2';
const TELEGRAM_MOBILE_PLATFORMS = new Set(['ios', 'android', 'android_x']);
const TELEGRAM_DESKTOP_PLATFORMS = new Set(['tdesktop', 'macos', 'unigram', 'weba', 'webk']);
/** Minimum space below Telegram mobile header chrome (Close + title bar). */
const TELEGRAM_MOBILE_HEADER_MIN_TOP = 72;
/** Minimum left inset so brand/logo clears the floating Close control. */
const TELEGRAM_MOBILE_HEADER_MIN_LEFT = 100;
/** Minimum right inset so lang switcher clears Telegram menu controls. */
const TELEGRAM_MOBILE_HEADER_MIN_RIGHT = 60;

function normalizeTelegramPlatform(tg) {
  return String(tg?.platform || 'unknown').toLowerCase();
}

/** True when the Mini App runs inside Telegram iOS/Android. */
function isTelegramMobile(tg = window.Telegram?.WebApp) {
  return TELEGRAM_MOBILE_PLATFORMS.has(normalizeTelegramPlatform(tg));
}

/** True when the Mini App runs inside Telegram Desktop or Web. */
function isTelegramDesktop(tg = window.Telegram?.WebApp) {
  return TELEGRAM_DESKTOP_PLATFORMS.has(normalizeTelegramPlatform(tg));
}

function applyTelegramPlatformClass(tg) {
  const root = document.documentElement;
  root.classList.remove('mini-app-mobile', 'mini-app-desktop');
  if (!tg) return;
  if (isTelegramMobile(tg)) {
    root.classList.add('mini-app-mobile');
  } else if (isTelegramDesktop(tg)) {
    root.classList.add('mini-app-desktop');
  }
}

/** Sum device + Telegram UI insets (see core.telegram.org/bots/webapps). */
function sumTelegramInsets(device = {}, content = {}) {
  return {
    top: (Number(device.top) || 0) + (Number(content.top) || 0),
    right: (Number(device.right) || 0) + (Number(content.right) || 0),
    bottom: (Number(device.bottom) || 0) + (Number(content.bottom) || 0),
    left: (Number(device.left) || 0) + (Number(content.left) || 0),
  };
}

function applyTelegramSafeAreaInsets(tg) {
  const root = document.documentElement;
  const device = tg?.safeAreaInset ?? {};
  const content = tg?.contentSafeAreaInset ?? {};
  const insets = sumTelegramInsets(device, content);
  // Sum device + content insets (Telegram docs); content-only top under-reports on mobile.
  let top = insets.top || 0;
  let right = insets.right || 0;
  const bottom = insets.bottom || 0;
  let left = insets.left || 0;
  if (tg && isTelegramMobile(tg)) {
    top = Math.max(top, TELEGRAM_MOBILE_HEADER_MIN_TOP);
    left = Math.max(left, TELEGRAM_MOBILE_HEADER_MIN_LEFT);
    right = Math.max(right, TELEGRAM_MOBILE_HEADER_MIN_RIGHT);
  }
  applyTelegramPlatformClass(tg);
  root.style.setProperty('--uydosh-tg-inset-top', `${top}px`);
  root.style.setProperty('--uydosh-tg-sticky-top', `${top}px`);
  root.style.setProperty('--uydosh-tg-filters-sticky-top', `${top}px`);
  root.style.setProperty('--uydosh-tg-inset-right', `${right}px`);
  root.style.setProperty('--uydosh-tg-inset-bottom', `${bottom}px`);
  root.style.setProperty('--uydosh-tg-inset-left', `${left}px`);
}

function parseMiniAppHeaderOptions(el) {
  const options = {};
  const subtitle = el?.getAttribute('data-uydosh-header-subtitle');
  if (subtitle) options.subtitleKey = subtitle;
  if (el?.getAttribute('data-uydosh-header-brand-link') === 'false') {
    options.brandLink = false;
  }
  const iconSrc = el?.getAttribute('data-uydosh-header-icon');
  if (iconSrc) options.iconSrc = iconSrc;
  return options;
}

const MINI_APP_ACCOUNT_PATH = '/telegram/account.html';
const MINI_APP_PROFILE_PATH = '/telegram/profile.html';

/** Telegram profile photo of the current Mini App user, if Telegram exposed one. */
function accountMenuAvatarUrl() {
  try {
    return window.Telegram?.WebApp?.initDataUnsafe?.user?.photo_url || '';
  } catch {
    return '';
  }
}

/**
 * Avatar-triggered account menu shown in the Mini App header — replaces the
 * public site's language switcher here since the bot already sets the Mini
 * App's language via `?lang=` (see initTelegramMiniApp). Links to the user's
 * own listings ("Account") and the create-listing flow.
 */
function accountMenuHtml() {
  const avatarUrl = accountMenuAvatarUrl();
  const avatarInner = avatarUrl
    ? `<img class="account-menu-avatar-img" src="${escapeHtml(avatarUrl)}" alt="" referrerpolicy="no-referrer" onerror="this.parentElement.classList.remove('has-avatar');this.remove();" />`
    : UyDosh.iconChrome('person');
  return `
    <div class="account-menu" role="group">
      <button
        type="button"
        class="account-menu-trigger"
        aria-haspopup="true"
        aria-expanded="false"
        data-i18n="account.menuLabel"
        data-i18n-attr="aria-label"
      >
        <span class="account-menu-avatar${avatarUrl ? ' has-avatar' : ''}" aria-hidden="true">${avatarInner}</span>
        <span class="account-menu-chevron" aria-hidden="true">${UyDosh.iconChrome('chevronDown')}</span>
      </button>
      <div class="account-menu-list" role="menu" hidden>
        <a role="menuitem" href="${MINI_APP_PROFILE_PATH}" data-profile-menu-item>
          ${UyDosh.iconChrome('graduationCap')}<span data-i18n="profile.menuLabel"></span>
          <span class="account-menu-badge" data-profile-menu-badge hidden aria-hidden="true"></span>
        </a>
        <a role="menuitem" href="${MINI_APP_ACCOUNT_PATH}">${UyDosh.iconChrome('person')}<span data-i18n="account.menuAccount"></span></a>
        <a role="menuitem" href="${MINI_APP_CREATE_PATH}">${UyDosh.iconChrome('plus')}<span data-i18n="create.postListing"></span></a>
      </div>
    </div>`;
}

/** Mirrors the .account-menu-list transition duration below (used for the close fallback timer). */
const ACCOUNT_MENU_TRANSITION_MS = 180;

function closeAccountMenu(menu) {
  const list = menu.querySelector('.account-menu-list');
  const trigger = menu.querySelector('.account-menu-trigger');
  if (!list || !trigger || list.hidden) return;
  trigger.setAttribute('aria-expanded', 'false');
  menu.classList.remove('account-menu-open');
  // Keep the list rendered (but not interactive) until the closing transition
  // finishes, then hide it — animating `display` directly isn't possible.
  const hideWhenClosed = () => {
    if (!menu.classList.contains('account-menu-open')) list.hidden = true;
  };
  window.setTimeout(hideWhenClosed, ACCOUNT_MENU_TRANSITION_MS);
}

function bindAccountMenu(menu) {
  const trigger = menu.querySelector('.account-menu-trigger');
  const list = menu.querySelector('.account-menu-list');
  if (!trigger || !list || trigger.dataset.bound) return;
  trigger.dataset.bound = '1';
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = menu.classList.contains('account-menu-open');
    for (const other of document.querySelectorAll('.account-menu.account-menu-open')) {
      closeAccountMenu(other);
    }
    if (!open) {
      list.hidden = false;
      // Force layout before adding the open class so the browser registers the
      // collapsed starting state and animates towards it instead of snapping.
      list.getBoundingClientRect();
      trigger.setAttribute('aria-expanded', 'true');
      menu.classList.add('account-menu-open');
    }
  });
}

/** Wire up open/close + outside-click/Escape handling for every account menu on the page. */
function initMiniAppAccountMenus() {
  for (const menu of document.querySelectorAll('.account-menu')) {
    bindAccountMenu(menu);
  }
  if (document.documentElement.dataset.uydoshAccountMenuBound) return;
  document.documentElement.dataset.uydoshAccountMenuBound = '1';
  document.addEventListener('click', (e) => {
    for (const menu of document.querySelectorAll('.account-menu.account-menu-open')) {
      if (!menu.contains(e.target)) closeAccountMenu(menu);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    for (const menu of document.querySelectorAll('.account-menu.account-menu-open')) {
      closeAccountMenu(menu);
    }
  });
}

/** Shared Telegram mini-app header markup (brand + account menu slot). */
function miniAppHeaderHtml(options = {}) {
  const {
    subtitleKey = 'brand.tagline',
    brandLink = true,
    iconSrc = '/apple-touch-icon.png',
  } = options;
  const brandContent =
    `<img src="${escapeHtml(iconSrc)}" width="44" height="44" alt="UyDosh" />` +
    `<div><strong>UyDosh</strong><span data-i18n="${escapeHtml(subtitleKey)}"></span></div>`;
  const brand = brandLink
    ? `<a class="brand" href="${MINI_APP_FEED_PATH}" data-mini-app-home>${brandContent}</a>`
    : `<div class="brand">${brandContent}</div>`;
  const themeToggle = `<button type="button" class="theme-toggle-btn" data-uydosh-theme-toggle></button>`;
  return `${brand}<div class="header-actions">${themeToggle}${accountMenuHtml()}</div>`;
}

/** Inject the shared mini-app header into a <header> or mount element. */
function mountMiniAppHeader(target, options = {}) {
  const header = target?.tagName === 'HEADER' ? target : target?.closest?.('header');
  if (!header) return null;
  header.innerHTML = miniAppHeaderHtml(options);
  header.classList.add('uydosh-mini-app-header');
  header.dataset.uydoshHeaderMounted = '1';
  applyI18n(header);
  initThemeToggle();
  initMiniAppAccountMenus();
  syncMobileHeaderLayout();
  return header;
}

function mountAllMiniAppHeaders() {
  for (const el of document.querySelectorAll('[data-uydosh-mini-app-header]')) {
    if (el.dataset.uydoshHeaderMounted === '1') continue;
    mountMiniAppHeader(el, parseMiniAppHeaderOptions(el));
  }
}

/** Keep brand + account menu in one header row on phone (undo legacy relocation). */
function syncMobileHeaderLayout() {
  if (!isTelegramMobile()) return;
  const header = document.querySelector('header');
  if (!header) return;
  header.removeAttribute('hidden');
  for (const row of document.querySelectorAll('.mobile-lang-row')) {
    const menu = row.querySelector('.account-menu');
    if (menu && !header.querySelector('.account-menu')) {
      const nav = header.querySelector('nav');
      (nav || header).appendChild(menu);
    }
    row.remove();
  }
  const orphanMenu = document.querySelector('.feed-sticky > .account-menu, .wrap > .account-menu');
  if (orphanMenu && !header.contains(orphanMenu)) {
    const nav = header.querySelector('nav');
    (nav || header).appendChild(orphanMenu);
  }
}

function ensureMiniAppSafeAreaStyles() {
  let style = document.getElementById(MINI_APP_SAFE_AREA_STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = MINI_APP_SAFE_AREA_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = `
    html.mini-app {
      --bg: var(--tg-bg, #061525);
      --fg: var(--tg-fg, rgba(255, 255, 255, 0.92));
      --muted: var(--tg-muted, rgba(255, 255, 255, 0.7));
      --card: var(--tg-card, rgba(255, 255, 255, 0.06));
      /* Re-derive against the real runtime wrap gutter (set below on '.wrap')
         instead of the stale 14px fallback baked into telegram-shared.css's
         ':root', so list/grid content (and '.view-tabs') lines up with the
         header + filters boxes instead of sitting closer to the edge. */
      --content-gutter-offset: calc(var(--feed-content-gutter, 25px) - var(--feed-wrap-gutter, max(5px, env(safe-area-inset-left, 0px))));
    }
    html.mini-app .wrap {
      max-width: none;
      margin: 0;
      padding-top: 0;
      padding-bottom: 32px;
      --feed-wrap-gutter: max(5px, env(safe-area-inset-left, 0px));
      padding-left: var(--feed-wrap-gutter);
      padding-right: max(5px, env(safe-area-inset-right, 0px));
    }
    html.mini-app .grid {
      grid-template-columns: 1fr;
      gap: 20px;
    }
    html.mini-app body {
      background: var(--bg);
      /* '--uydosh-fixed-footer-height' lets a page reserve extra room above
         this safe-area padding for its OWN fixed bottom bar (e.g. the create
         wizard's/profile form's footer) — set on ':root' in that page's own
         CSS. Defaults to 0 so pages without one (feed, account, …) are
         unaffected. This rule's selector is deliberately as specific as any
         page-level 'body { padding-bottom: … }' override so it always wins
         the cascade instead of silently discarding it (that used to drop the
         page's fixed-footer reservation entirely, letting content hide
         behind the footer with no way to scroll it into view). */
      padding-bottom: calc(var(--uydosh-fixed-footer-height, 0px) + max(env(safe-area-inset-bottom, 0px), var(--uydosh-tg-inset-bottom, 0px)));
    }
    html.mini-app header {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      flex-wrap: nowrap;
      gap: 12px;
      /* Safe-area inset lives OUTSIDE the bordered box (margin), not inside it (padding),
         so the tile's border wraps only the brand row and never stretches up to
         enclose Telegram's own status bar / native Close button chrome. */
      margin-top: var(--uydosh-tg-inset-top, var(--tg-content-safe-area-inset-top, 0px));
      margin-left: calc(var(--feed-content-gutter, 25px) - var(--feed-wrap-gutter, max(5px, env(safe-area-inset-left, 0px))));
      margin-right: calc(var(--feed-content-gutter, 25px) - max(5px, env(safe-area-inset-right, 0px)));
      padding: 12px 14px;
      min-height: 44px;
      box-sizing: border-box;
      border: 1px solid var(--stroke);
      border-radius: 18px;
    }
    html.mini-app-desktop header {
      margin-top: var(--uydosh-tg-inset-top, 0px);
    }
    html.mini-app .feed-sticky {
      margin-left: calc(-1 * var(--feed-wrap-gutter, max(5px, env(safe-area-inset-left, 0px))));
      margin-right: calc(-1 * max(5px, env(safe-area-inset-right, 0px)));
      padding-top: 8px;
      padding-bottom: 0;
      box-sizing: border-box;
    }
    html.mini-app-desktop .feed-sticky {
      padding-left: var(--feed-content-gutter, 25px);
      padding-right: var(--feed-content-gutter, 25px);
    }
    html.mini-app-mobile header {
      align-items: center;
      margin-top: var(--uydosh-tg-inset-top, ${TELEGRAM_MOBILE_HEADER_MIN_TOP}px);
    }
    html.mini-app-mobile .feed-sticky {
      top: var(--uydosh-tg-filters-sticky-top, var(--uydosh-tg-sticky-top, ${TELEGRAM_MOBILE_HEADER_MIN_TOP}px));
      /* Same as the desktop rule below: '.feed-sticky' already breaks out to
         the raw screen edge (margin cancels '.wrap''s padding above), so this
         padding IS the full inset — it must not also add the wrap gutter on
         top, or the filters box ends up further in than the header/feed tiles. */
      padding-left: var(--feed-content-gutter, 25px);
      padding-right: var(--feed-content-gutter, 25px);
    }
    html.mini-app header nav {
      display: flex;
      align-items: center;
      flex: 1 1 auto;
      min-width: 0;
      gap: 10px;
    }
    html.mini-app .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      flex: 0 1 auto;
      text-decoration: none;
    }
    html.mini-app .brand:hover { text-decoration: none; }
    html.mini-app .brand img {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      box-shadow: none;
      background: transparent;
    }
    html.mini-app .brand strong {
      font-size: 15px;
      letter-spacing: 0.2px;
    }
    html.mini-app .brand span {
      color: var(--muted);
      font-size: 13px;
      display: block;
    }
    html.mini-app .header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
      flex-shrink: 0;
    }
    html.mini-app .account-menu {
      position: relative;
      flex-shrink: 0;
    }
    html.mini-app .account-menu-trigger {
      appearance: none;
      border: 1.5px solid var(--stroke, rgba(127, 127, 127, 0.45));
      background: rgba(127, 127, 127, 0.08);
      color: var(--muted, rgba(255, 255, 255, 0.7));
      height: 34px;
      padding: 3px 9px 3px 3px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      cursor: pointer;
    }
    html.mini-app .account-menu-trigger:active {
      opacity: 0.88;
    }
    html.mini-app .account-menu-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      overflow: hidden;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    html.mini-app .account-menu-avatar svg {
      width: 16px;
      height: 16px;
      display: block;
    }
    html.mini-app .account-menu-avatar.has-avatar .account-menu-avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    html.mini-app .account-menu-chevron {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: transform 0.18s ease;
    }
    html.mini-app .account-menu-chevron svg {
      width: 18px;
      height: 18px;
      display: block;
      stroke-width: 2.5;
    }
    html.mini-app .account-menu.account-menu-open .account-menu-chevron {
      transform: rotate(180deg);
    }
    html.mini-app .account-menu-list {
      position: absolute;
      top: calc(100% + 3px);
      right: 0;
      min-width: 190px;
      padding: 6px;
      border-radius: 14px;
      border: 1px solid var(--stroke, rgba(127, 127, 127, 0.35));
      /* Solid, never see-through — this floats over feed content below it. */
      background: color-mix(in srgb, var(--bg), black 6%);
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
      z-index: 100;
      display: flex;
      flex-direction: column;
      gap: 2px;
      transform-origin: top right;
      opacity: 0;
      transform: translateY(-6px) scale(0.96);
      pointer-events: none;
      transition: opacity 0.16s ease, transform 0.16s ease;
    }
    html.mini-app .account-menu-list[hidden] {
      display: none;
    }
    html.mini-app .account-menu.account-menu-open .account-menu-list {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }
    html.mini-app .account-menu-list a {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 10px;
      color: var(--fg, rgba(255, 255, 255, 0.92));
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
    }
    html.mini-app .account-menu-list a:active {
      background: rgba(127, 127, 127, 0.16);
    }
    html.mini-app .account-menu-list a svg {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      display: block;
      stroke: currentColor;
      fill: none;
    }
    html.mini-app .account-menu-badge {
      display: inline-block;
      flex-shrink: 0;
      margin-left: auto;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--bg), black 6%);
    }
    html.mini-app .account-menu-badge[hidden] {
      display: none;
    }
    html.mini-app .theme-toggle-btn {
      appearance: none;
      border: 1px solid var(--stroke, rgba(127, 127, 127, 0.35));
      background: rgba(127, 127, 127, 0.08);
      color: var(--muted, rgba(255, 255, 255, 0.7));
      width: 34px;
      height: 34px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      padding: 0;
      flex-shrink: 0;
    }
    html.mini-app .theme-toggle-btn:hover {
      color: var(--fg, rgba(255, 255, 255, 0.92));
    }
    html.mini-app .theme-toggle-btn:active {
      opacity: 0.85;
    }
    html.mini-app .theme-toggle-btn svg {
      display: block;
    }
    html.mini-app [data-hide-in-mini-app] {
      display: none !important;
    }
    html.mini-app.has-detail-contact .wrap {
      padding-bottom: calc(88px + max(env(safe-area-inset-bottom, 0px), var(--uydosh-tg-inset-bottom, 0px)));
    }
    .detail-contact-bar {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 40;
      padding:
        10px max(16px, env(safe-area-inset-left, 0px))
        calc(10px + max(env(safe-area-inset-bottom, 0px), var(--uydosh-tg-inset-bottom, 0px)))
        max(16px, env(safe-area-inset-right, 0px));
      background: color-mix(in srgb, var(--bg) 90%, transparent);
      border-top: 1px solid var(--stroke);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
    }
    .detail-contact-bar[hidden] {
      display: none !important;
    }
    .detail-contact-bar-inner {
      max-width: 1000px;
      margin: 0 auto;
    }
    .detail-contact-bar-inner-row {
      display: flex;
      gap: 10px;
    }
    .detail-contact-bar-inner-row .detail-contact-btn {
      flex: 1 1 0;
    }
    .detail-contact-btn {
      width: 100%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 14px 18px;
      border-radius: 14px;
      border: 0;
      background: linear-gradient(135deg, #229ED9, #2AABEE);
      box-shadow: 0 10px 28px rgba(34, 158, 217, 0.35);
      color: #fff;
      font: inherit;
      font-weight: 700;
      font-size: 16px;
      cursor: pointer;
    }
    .detail-contact-btn:active {
      opacity: 0.92;
    }
    .detail-contact-btn .icon svg {
      width: 22px;
      height: 22px;
      display: block;
    }
    .detail-contact-btn-phone {
      background: linear-gradient(135deg, #25C06D, #1FAE60);
      box-shadow: 0 10px 28px rgba(37, 192, 109, 0.35);
    }
  `;
}

const FIREBASE_VERSION = '11.6.0';
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAv3KDcxTbeLCuyh7QVVk-MwxR4fnC96yM',
  authDomain: 'uydosh-cd0fe.firebaseapp.com',
  projectId: 'uydosh-cd0fe',
  storageBucket: 'uydosh-cd0fe.firebasestorage.app',
  messagingSenderId: '626930983094',
  appId: '1:626930983094:web:0e1a429bcdf9602f580617',
  measurementId: 'G-EH9C2VMSD8',
};

let _logEventFn = null;
let _analyticsInitPromise = null;

/** Truncates a string to `max` chars for safe GA4/Firebase param/property values. */
function _clip(value, max) {
  if (value == null) return undefined;
  const s = String(value);
  return s.length > max ? s.slice(0, max) : s;
}

/** Telegram WebApp context attached to every Mini App analytics event (max extraction). */
function getTelegramAnalyticsContext() {
  const tg = window.Telegram?.WebApp;
  const initDataUnsafe = tg?.initDataUnsafe || {};
  const user = initDataUnsafe.user;
  const chat = initDataUnsafe.chat;
  return {
    platform: tg?.platform || 'unknown',
    tg_version: tg?.version || '',
    color_scheme: tg?.colorScheme || '',
    user_language: user?.language_code || '',
    start_param: initDataUnsafe.start_param || '',
    chat_type: initDataUnsafe.chat_type || '',
    is_expanded: tg?.isExpanded ? 1 : 0,
    ...(user?.id != null ? { tg_user_id: user.id } : {}),
    ...(user?.username ? { tg_username: _clip(user.username, 100) } : {}),
    ...(user?.first_name ? { tg_first_name: _clip(user.first_name, 100) } : {}),
    ...(user?.last_name ? { tg_last_name: _clip(user.last_name, 100) } : {}),
    ...(user?.photo_url ? { tg_photo_url: _clip(user.photo_url, 100) } : {}),
    ...(user?.is_premium != null
      ? { is_premium: user.is_premium ? 1 : 0 }
      : {}),
    ...(user?.is_bot != null ? { tg_is_bot: user.is_bot ? 1 : 0 } : {}),
    ...(user?.allows_write_to_pm != null
      ? { allows_write_pm: user.allows_write_to_pm ? 1 : 0 }
      : {}),
    ...(user?.added_to_attachment_menu != null
      ? { added_to_menu: user.added_to_attachment_menu ? 1 : 0 }
      : {}),
    ...(initDataUnsafe.query_id ? { tg_query_id: _clip(initDataUnsafe.query_id, 100) } : {}),
    ...(initDataUnsafe.chat_instance
      ? { tg_chat_instance: _clip(initDataUnsafe.chat_instance, 100) }
      : {}),
    ...(initDataUnsafe.auth_date ? { tg_auth_date: initDataUnsafe.auth_date } : {}),
    ...(initDataUnsafe.can_send_after != null
      ? { tg_can_send_after: initDataUnsafe.can_send_after }
      : {}),
    ...(chat?.id != null ? { tg_chat_id: chat.id } : {}),
    ...(chat?.type ? { tg_chat_kind: chat.type } : {}),
  };
}

/** Sets Telegram identity fields as GA4/Firebase user properties (persist on the user, not just one event). */
function setTelegramAnalyticsUserProperties(analyticsMod, analytics) {
  const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
  if (!user) return;
  const props = {
    tg_username: _clip(user.username, 36),
    tg_first_name: _clip(user.first_name, 36),
    tg_last_name: _clip(user.last_name, 36),
    tg_language: _clip(user.language_code, 36),
    tg_platform: _clip(window.Telegram?.WebApp?.platform, 36),
    ...(user.is_premium != null ? { tg_is_premium: user.is_premium ? '1' : '0' } : {}),
    ...(user.is_bot != null ? { tg_is_bot: user.is_bot ? '1' : '0' } : {}),
  };
  for (const k of Object.keys(props)) {
    if (props[k] === undefined) delete props[k];
  }
  if (Object.keys(props).length > 0) {
    analyticsMod.setUserProperties(analytics, props);
  }
}

/** Loads Firebase Analytics once; no-op outside Telegram Mini App. */
function initMiniAppAnalytics() {
  if (!isMiniApp()) return Promise.resolve(false);
  if (_analyticsInitPromise) return _analyticsInitPromise;

  _analyticsInitPromise = (async () => {
    try {
      const appMod = await import(
        `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`
      );
      const analyticsMod = await import(
        `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-analytics.js`
      );
      if (!(await analyticsMod.isSupported())) {
        console.warn('[UyDosh] Firebase Analytics not supported in this environment');
        return false;
      }
      const app = appMod.initializeApp(FIREBASE_CONFIG);
      const analytics = analyticsMod.getAnalytics(app);
      _logEventFn = (name, params) => analyticsMod.logEvent(analytics, name, params);

      const tgUserId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
      if (tgUserId != null) {
        analyticsMod.setUserId(analytics, String(tgUserId));
      }
      setTelegramAnalyticsUserProperties(analyticsMod, analytics);

      _logEventFn('app_opened', {
        source: 'telegram_mini_app',
        ...getTelegramAnalyticsContext(),
      });
      return true;
    } catch (err) {
      console.warn('[UyDosh] Firebase Analytics init failed', err);
      return false;
    }
  })();

  return _analyticsInitPromise;
}

/** Log a custom GA4/Firebase event (Telegram Mini App only). */
function logMiniAppEvent(name, params) {
  if (!isMiniApp()) return;
  const payload = {
    source: 'telegram_mini_app',
    ...getTelegramAnalyticsContext(),
    ...params,
  };
  initMiniAppAnalytics().then((ok) => {
    if (ok && _logEventFn) _logEventFn(name, payload);
  });
}

/** Log a screen view for the Mini App feed or listing detail. */
function logMiniAppScreen(screenName, params) {
  logMiniAppEvent('screen_view', {
    firebase_screen: screenName,
    firebase_screen_class: 'telegram_mini_app',
    screen_name: screenName,
    ...params,
  });
}

/**
 * `t.me/<bot>?startapp=listing_123` direct links (used by the in-app Share
 * button) launch the Mini App at its configured menu-button URL — the feed —
 * with `listing_123` passed through as `start_param` (mirrored in the
 * `tgWebAppStartParam` query param). Redirect straight to that listing
 * instead of flashing the feed first.
 */
function redirectFromMiniAppStartParam() {
  if (/listing\.html/i.test(location.pathname)) return false;
  const tg = window.Telegram?.WebApp;
  const startParam =
    tg?.initDataUnsafe?.start_param ||
    new URLSearchParams(location.search).get('tgWebAppStartParam') ||
    '';
  const match = /^listing_(\d+)$/.exec(String(startParam).trim());
  if (!match) return false;
  location.replace(listingPageUrl(match[1]));
  return true;
}

/**
 * Telegram's Mini App WebView doesn't reliably follow a plain `<a href>` tap to a
 * same-origin page on every client/platform — the tap can silently do nothing (see
 * https://bugs.telegram.org/c/19188 and multiple developer reports of internal links
 * "not working" inside Mini Apps). Explicitly driving navigation from the click handler
 * via `location.href` — instead of leaving it to the WebView's native tap-to-navigate
 * behavior — is the reliable way to move between this app's own pages. External links
 * (different origin), `target="_blank"`/download links, and modified clicks (cmd/ctrl/
 * middle-click) are left alone so they keep their normal/native handling.
 */
function bindMiniAppInternalNav() {
  if (document.documentElement.dataset.uydoshInternalNavBound) return;
  document.documentElement.dataset.uydoshInternalNavBound = '1';
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = e.target.closest('a[href]');
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
    let url;
    try {
      url = new URL(link.href, location.href);
    } catch {
      return;
    }
    if (url.origin !== location.origin) return;
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
    e.preventDefault();
    location.href = url.href;
  });
}

/**
 * Elements that get automatic tap feedback from `bindMiniAppHapticFeedback`
 * below — every real button, link, and ARIA button/tab/switch/menu item in
 * the Mini App, so new UI gets feedback for free without wiring up a
 * `HapticFeedback` call by hand on every tap.
 */
const MINI_APP_HAPTIC_TAP_SELECTOR = [
  'button',
  '.btn',
  'input[type="submit"]',
  'input[type="button"]',
  'a[href]',
  '[role="button"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="menuitem"]',
].join(', ');

/**
 * Resolves which `UyDosh.haptic` profile a tapped element should use.
 * Defaults to `light` (a plain button/link tap); set `data-haptic="medium"`,
 * `"heavy"`, `"selection"`, `"success"`, `"warning"`, or `"error"` on an
 * element (or an ancestor) to use a different profile for it, or
 * `data-haptic="none"` to opt out entirely — e.g. an element whose own click
 * handler already fires more specific feedback itself.
 */
function miniAppHapticProfileFor(el) {
  return el.closest('[data-haptic]')?.getAttribute('data-haptic') || 'light';
}

function fireMiniAppHapticProfile(profile) {
  if (profile === 'none') return;
  const haptic = window.UyDosh?.haptic;
  const fn = haptic?.[profile];
  (typeof fn === 'function' ? fn : haptic?.light)?.();
}

/**
 * Best-effort tactile feedback on every button/link/tab press across the
 * Mini App. A single delegated (capture-phase, so it still runs even if a
 * handler later calls `stopPropagation`) listener replaces having to wire up
 * a `HapticFeedback` call by hand in every click handler — see
 * `MINI_APP_HAPTIC_TAP_SELECTOR`/`miniAppHapticProfileFor` above for the
 * element matching + profile override rules.
 */
function bindMiniAppHapticFeedback() {
  if (document.documentElement.dataset.uydoshHapticBound) return;
  document.documentElement.dataset.uydoshHapticBound = '1';
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented) return;
    const target = e.target.closest?.(MINI_APP_HAPTIC_TAP_SELECTOR);
    if (!target || target.disabled || target.getAttribute('aria-disabled') === 'true') return;
    fireMiniAppHapticProfile(miniAppHapticProfileFor(target));
  }, true);
}

/** Call on mini-app pages after telegram-web-app.js is loaded. */
function initTelegramMiniApp() {
  // Persist the bot-selected `?lang=` for the rest of this session so
  // in-app navigation (links without `?lang=`) keeps using it too.
  if (isMiniAppPage()) {
    try {
      const urlLang = new URLSearchParams(location.search).get('lang');
      if (urlLang && LANGS.includes(urlLang)) setLang(urlLang);
    } catch { /* ignore */ }
  }
  const tg = window.Telegram?.WebApp;
  if (tg) {
    getTelegramInitData();
    try { tg.ready(); } catch { /* ignore */ }
    try { tg.expand(); } catch { /* ignore */ }
    if (redirectFromMiniAppStartParam()) return true;
    // Fire-and-forget: inits the LocationManager and requests the user's location right away.
    // On a user's very first Mini App visit ever, this is what triggers Telegram's native
    // location permission prompt; on every visit after that (granted or denied), it silently
    // resolves/no-ops with no repeat prompt. See `requestAndReportUserLocation`.
    requestAndReportUserLocation();
    applyTelegramTheme(tg);
    applyStoredManualTheme();
    applyTelegramSafeAreaInsets(tg);
    if (typeof tg.onEvent === 'function') {
      tg.onEvent('themeChanged', () => {
        applyTelegramTheme(tg);
        applyStoredManualTheme();
        // Keeps the header toggle's icon/label correct if Telegram's theme flips while a user
        // has no manual override set — currentUiTheme() falls back to tg.colorScheme (see
        // uydosh-map-pins.js), manual overrides still win regardless of this event firing.
        document.dispatchEvent(new CustomEvent('uydosh:themechange'));
      });
      tg.onEvent('contentSafeAreaChanged', () => {
        applyTelegramSafeAreaInsets(tg);
        syncMobileHeaderLayout();
        reflowActiveMaps();
        window.UyDoshFeedMap?.scheduleSyncFeedMapPanelHeight?.();
      });
      tg.onEvent('safeAreaChanged', () => {
        applyTelegramSafeAreaInsets(tg);
        syncMobileHeaderLayout();
        reflowActiveMaps();
        window.UyDoshFeedMap?.scheduleSyncFeedMapPanelHeight?.();
      });
      tg.onEvent('viewportChanged', () => {
        applyTelegramSafeAreaInsets(tg);
        syncMobileHeaderLayout();
        reflowActiveMaps();
        window.UyDoshFeedMap?.scheduleSyncFeedMapPanelHeight?.();
      });
    }
    requestAnimationFrame(() => {
      applyTelegramSafeAreaInsets(tg);
      syncMobileHeaderLayout();
    });
    setTimeout(() => {
      applyTelegramSafeAreaInsets(tg);
      syncMobileHeaderLayout();
    }, 150);
  }
  if (!isMiniApp()) return false;
  document.documentElement.classList.add('mini-app');
  applyStoredManualTheme();
  ensureMiniAppSafeAreaStyles();
  applyTelegramSafeAreaInsets(tg);
  bindMiniAppInternalNav();
  bindMiniAppHapticFeedback();
  mountAllMiniAppHeaders();
  syncMobileHeaderLayout();
  // Fire-and-forget: reveals a green dot on the account menu's "Profile" item
  // once the profile fetch resolves, if the user hasn't filled anything in yet.
  maybeShowProfileMenuBadge();
  for (const el of document.querySelectorAll('[data-hide-in-mini-app]')) {
    el.setAttribute('hidden', '');
  }
  for (const el of document.querySelectorAll('[data-mini-app-home]')) {
    el.setAttribute('href', MINI_APP_FEED_PATH);
  }
  // Custom back links are hidden in Mini App — Telegram header BackButton handles navigation.
  // for (const el of document.querySelectorAll('[data-mini-app-back]')) {
  //   el.setAttribute('href', MINI_APP_FEED_PATH);
  // }
  initMiniAppAnalytics().then((ok) => {
    if (!ok) return;
    const path = location.pathname || '';
    if (/create\.html/i.test(path) || /\/telegram\/create\/?$/i.test(path)) {
      logMiniAppScreen('telegram_create_listing');
    } else if (!/listing\.html/i.test(path)) {
      logMiniAppScreen('telegram_feed');
    }
  });
  return true;
}

Object.assign(window.UyDosh, {
  isMiniApp,
  isTelegramMobile,
  isTelegramDesktop,
  listingPageUrl,
  feedPageUrl,
  createPageUrl,
  bindMiniAppInternalNav,
  initTelegramMiniApp,
  bindMiniAppHapticFeedback,
  redirectFromMiniAppStartParam,
  mountMiniAppHeader,
  mountAllMiniAppHeaders,
  miniAppHeaderHtml,
  initMiniAppAccountMenus,
  MINI_APP_ACCOUNT_PATH,
  MINI_APP_CREATE_PATH,
  MINI_APP_PROFILE_PATH,
  maybeShowProfileNudge,
  dismissProfileNudge,
  maybeShowProfileMenuBadge,
  hideProfileMenuBadge,
  initMiniAppAnalytics,
  logMiniAppEvent,
  logMiniAppScreen,
  MINI_APP_FEED_PATH,
});
