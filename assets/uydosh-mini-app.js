// UyDosh Web — Mini App bootstrap: URL routing helpers, Telegram theme/safe-area
// handling, the mini-app header, and Firebase Analytics wiring.
// Depends on all other uydosh-*.js modules. Load last.

const MINI_APP_FEED_PATH = '/telegram/';
const MINI_APP_CREATE_PATH = '/telegram/create.html';
const MINI_APP_CHATS_PATH = '/telegram/chats.html';
const MINI_APP_HOUSING_PATH = '/telegram/?listingTypeId=0';
const MINI_APP_COMMUNITY_PATH = '/telegram/account.html?tab=groups';

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

/**
 * @param {object} [options]
 * @param {string} [options.backTo] Same-origin path (e.g. a favorites/my-listings
 *   deep link) the Mini App's Telegram header BackButton should return to instead
 *   of the feed — see `miniAppBackTargetFromUrl`/listing.html's BackButton handler.
 * @param {string} [options.view] When `'3d'`, listing.html auto-opens the fullscreen
 *   3D room scan viewer once the listing loads (see maybeAutoOpenRoomScanFullscreen
 *   in listing-detail-roomscan.js) — set by redirectFromMiniAppStartParam for a
 *   `listing_{id}_3d` share link (see buildListing3dShareUrl).
 * @param {string} [options.group] When `'requests'`, listing.html scrolls to the
 *   group join-request panel (owner inbox / applicant CTA).
 */
function listingPageUrl(id, options = {}) {
  const lid = String(id ?? '').trim();
  if (!lid) return MINI_APP_FEED_PATH;
  if (isMiniApp()) {
    const params = new URLSearchParams({ id: lid, mini: '1' });
    if (options.backTo) params.set('back', options.backTo);
    if (options.view) params.set('view', options.view);
    if (options.group) params.set('group', options.group);
    return `/listing.html?${params.toString()}`;
  }
  return `/listing/${encodeURIComponent(lid)}`;
}

/**
 * Reads the `?back=` deep-link param set by `listingPageUrl` (mine/favorites
 * rows in telegram-account.js) and validates it's a safe same-site path before
 * handing it to the Telegram header BackButton handler — guards against an
 * open-redirect via a crafted `back=` value (e.g. `//evil.com`).
 */
function miniAppBackTargetFromUrl() {
  let back = '';
  try {
    back = new URLSearchParams(location.search).get('back') || '';
  } catch { /* ignore */ }
  return back.startsWith('/') && !back.startsWith('//') ? back : MINI_APP_FEED_PATH;
}

function feedPageUrl() {
  return isMiniApp() ? MINI_APP_FEED_PATH : 'listings.html';
}

function createPageUrl() {
  return MINI_APP_CREATE_PATH;
}

function profilePageUrl(userId, options = {}) {
  const params = new URLSearchParams();
  const id = Number(userId);
  if (Number.isFinite(id) && id > 0) params.set('user', String(id));
  if (options.backTo) params.set('back', options.backTo);
  const query = params.toString();
  return query ? `${MINI_APP_PROFILE_PATH}?${query}` : MINI_APP_PROFILE_PATH;
}

function chatPageUrl(id, options = {}) {
  const cid = String(id ?? '').trim();
  if (!cid) return MINI_APP_GROUPS_PATH;
  const params = new URLSearchParams({ id: cid, mini: '1' });
  if (options.backTo) params.set('back', options.backTo);
  return `/telegram/chat.html?${params.toString()}`;
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

/** Swaps the mini-app header's skyline photo to the light variant when the
 * app's UI theme (see currentUiTheme() in uydosh-map-pins.js) is 'light' —
 * kept in sync on manual toggle + Telegram theme changes via the
 * 'uydosh:themechange' event (dispatched by both). */
function applyHeaderBgTheme() {
  document.documentElement.classList.toggle('mini-app-header-light', currentUiTheme() === 'light');
}
if (typeof document !== 'undefined') {
  document.addEventListener('uydosh:themechange', applyHeaderBgTheme);
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
      /* Horizontal margin (not the padding-based .content-gutter helper) so this
         card's own border/background sits at the same inset as sibling cards like
         .filters — .content-gutter only nudges an element's *inner* content in,
         which left this card's outer edge flush with .wrap's tighter padding. */
      margin: 10px var(--content-gutter-offset, 6px) 4px;
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
    <div class="profile-nudge" data-profile-nudge>
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

/**
 * True only when every field the profile page can edit has been filled in —
 * used to decide whether to nudge a viewer to finish their profile even when
 * they've already filled in some fields (e.g. the listing compatibility
 * tile's "complete profile" CTA, shown for any gap, not just a fully empty
 * profile).
 */
function isProfileFullyPopulated(profile) {
  if (!profile) return false;
  return PROFILE_COMPLETENESS_FIELDS.every((key) => profile[key] != null);
}

/** Hides the green "profile not populated" dot on every account menu on the page. */
function hideProfileMenuBadge() {
  document.querySelectorAll('[data-profile-menu-badge]').forEach((el) => { el.hidden = true; });
}

function hideJoinRequestNavBadge() {
  document.querySelectorAll('[data-nav-join-badge], [data-join-request-menu-badge]').forEach((el) => {
    el.hidden = true;
  });
}

function listingLooksGroupForming(listing) {
  const typeId = Number(listing?.listing_type_id ?? listing?.listing_type?.id);
  const code = listing?.listing_type?.code;
  return typeId === 3 || code === 'group_forming';
}

/**
 * Green blinking dot on the header hamburger (and a matching dot on
 * "My listings" in the drawer) when the signed-in owner has pending
 * group join requests. Fire-and-forget from initTelegramMiniApp; never
 * blocks the page.
 */
async function maybeShowJoinRequestNavBadge() {
  if (!isMiniApp()) return;
  try {
    const sessionReady = await ensureTelegramMiniAppSession();
    if (!sessionReady) return;
    const payload = await fetchMyTelegramMiniAppListings();
    const listings = Array.isArray(payload?.listings) ? payload.listings : [];
    let total = 0;
    const hasServerCount = listings.some((row) => row?.pending_join_request_count != null);
    if (hasServerCount) {
      total = listings.reduce((sum, row) => sum + (Number(row.pending_join_request_count) || 0), 0);
    } else {
      const groupListings = listings.filter(listingLooksGroupForming).slice(0, 10);
      const counts = await Promise.all(groupListings.map(async (row) => {
        try {
          const result = await fetchListingGroupJoinRequests(row.id);
          const rows = result?.data ?? result?.requests ?? result;
          return Array.isArray(rows) ? rows.length : 0;
        } catch {
          return 0;
        }
      }));
      total = counts.reduce((sum, n) => sum + n, 0);
    }
    if (total <= 0) {
      hideJoinRequestNavBadge();
      return;
    }
    const label = (typeof t === 'function' ? t : UyDosh.t)('nav.joinRequestsPending');
    document.querySelectorAll('[data-nav-join-badge]').forEach((el) => {
      el.hidden = false;
    });
    document.querySelectorAll('[data-nav-drawer-trigger]').forEach((el) => {
      el.setAttribute('aria-label', label);
    });
    document.querySelectorAll('[data-join-request-menu-badge]').forEach((el) => {
      el.hidden = false;
    });
  } catch (err) {
    console.warn('[UyDosh] join-request nav badge skipped', err);
  }
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
const MINI_APP_ZOOM_GUARD_STYLE_ID = 'uydosh-mini-app-zoom-guard';
// Max gap (ms) between two touchend events for the second one to count as a
// double-tap for `preventMiniAppDoubleTapZoom`'s purposes — long enough to
// cover a deliberate-but-quick double-tap, short enough to never eat two
// genuinely separate taps (e.g. tapping two different buttons in a hurry).
const MINI_APP_DOUBLE_TAP_WINDOW_MS = 350;
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
const MINI_APP_GROUPS_PATH = '/telegram/account.html?tab=groups';
const MINI_APP_FAVORITES_PATH = '/telegram/account.html?tab=favorites';
const MINI_APP_PROFILE_PATH = '/telegram/profile.html';
const MINI_APP_PRIVACY_PATH = '/privacy-policy.html';
const MINI_APP_TERMS_PATH = '/terms-of-service.html';
const MINI_APP_DELETE_ACCOUNT_PATH = '/delete-account.html';
const MINI_APP_CONTACT_HREF = 'mailto:uydoshtech@gmail.com';
// Native-app download links — App Store (production iOS) plus the same
// App Store / APK CTAs as the public landing page (index.html). Surfaced
// here since Mini App users otherwise have no way to find them without
// leaving Telegram to visit the website.
const MINI_APP_APP_STORE_HREF = 'https://apps.apple.com/uz/app/uydosh/id6767800712';
const MINI_APP_ANDROID_APK_HREF = 'https://github.com/uydoshtech/uydoshtech.github.io/releases/latest/download/app-release.apk';

/** Telegram profile photo of the current Mini App user, if Telegram exposed one. */
function accountMenuAvatarUrl() {
  try {
    return window.Telegram?.WebApp?.initDataUnsafe?.user?.photo_url || '';
  } catch {
    return '';
  }
}

/** Telegram display name ("First Last", falling back to "@username") of the current Mini App user, for the nav drawer's own profile header — empty outside Telegram. */
function accountMenuDisplayName() {
  try {
    const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (!user) return '';
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
    if (fullName) return fullName;
    return user.username ? `@${user.username}` : '';
  } catch {
    return '';
  }
}

/**
 * The user's own account shortcuts — profile, listings, favorites, create,
 * theme toggle — shared verbatim by both header dropdowns (see
 * accountMenuHtml() and navMenuHtml() below) so they always stay in sync.
 * Each instance's badge/theme-toggle elements are bound/refreshed
 * independently since every consumer of `[data-uydosh-theme-toggle]` /
 * `[data-profile-menu-badge]` already iterates with querySelectorAll.
 */
function accountShortcutItemsHtml() {
  return `
    <a role="menuitem" href="${MINI_APP_CREATE_PATH}">${UyDosh.iconChrome('plus')}<span data-i18n="create.postListing"></span></a>
    <a role="menuitem" href="${MINI_APP_ACCOUNT_PATH}">${UyDosh.iconChrome('house')}<span data-i18n="account.tabs.mine"></span></a>
    <a role="menuitem" href="${MINI_APP_GROUPS_PATH}" data-join-request-menu-item>
      ${UyDosh.iconChrome('users')}<span data-i18n="account.tabs.groups"></span>
      <span class="account-menu-badge" data-join-request-menu-badge hidden aria-hidden="true"></span>
    </a>
    <a role="menuitem" href="${MINI_APP_FAVORITES_PATH}">${UyDosh.iconChrome('heartOutline')}<span data-i18n="account.tabs.favorites"></span></a>
    <a role="menuitem" href="${MINI_APP_PROFILE_PATH}" data-profile-menu-item>
      ${UyDosh.iconChrome('graduationCap')}<span data-i18n="profile.menuLabel"></span>
      <span class="account-menu-badge" data-profile-menu-badge hidden aria-hidden="true"></span>
    </a>
    <div class="account-menu-divider" role="separator"></div>
    <button type="button" class="account-menu-theme" role="menuitem" data-uydosh-theme-toggle>
      <span data-theme-toggle-icon aria-hidden="true"></span>
      <span data-theme-toggle-label></span>
    </button>`;
}

/**
 * Avatar shown at the right of the Mini App header — replaces the public
 * site's language switcher here since the bot already sets the Mini App's
 * language via `?lang=` (see initTelegramMiniApp). Links straight to the
 * user's own profile page (the same shortcuts it used to open in a dropdown —
 * Post/My listings/Favorites/Profile/theme — already live one tap away in
 * the hamburger nav drawer, see navDrawerHtml(), so this avatar no longer
 * needs to duplicate them behind its own dropdown).
 */
function accountMenuHtml() {
  const avatarUrl = accountMenuAvatarUrl();
  const avatarInner = avatarUrl
    ? `<img class="account-menu-avatar-img" src="${escapeHtml(avatarUrl)}" alt="" referrerpolicy="no-referrer" onerror="this.parentElement.classList.remove('has-avatar');this.remove();" />`
    : UyDosh.iconChrome('person');
  return `
    <a
      class="account-menu-trigger"
      href="${MINI_APP_PROFILE_PATH}"
      data-i18n="profile.menuLabel"
      data-i18n-attr="aria-label"
    >
      <span class="account-menu-avatar${avatarUrl ? ' has-avatar' : ''}" aria-hidden="true">${avatarInner}</span>
    </a>`;
}

/**
 * Hamburger trigger shown at the left of the Mini App header (before the
 * brand logo) — bare icon (no circular chrome), separate from the avatar
 * link on the right (see accountMenuHtml(), which just navigates straight to
 * the profile page). Opens the full-height nav drawer (see navDrawerHtml()),
 * which holds the account shortcuts plus the app-level links.
 */
function navMenuHtml() {
  return `
    <div class="nav-menu">
      <button
        type="button"
        class="nav-menu-trigger"
        aria-haspopup="dialog"
        aria-expanded="false"
        data-nav-drawer-trigger
        data-i18n="nav.menuLabel"
        data-i18n-attr="aria-label"
      >
        <span class="nav-menu-icon" aria-hidden="true">${UyDosh.iconChrome('menu')}</span>
        <span class="nav-menu-join-badge" data-nav-join-badge hidden aria-hidden="true"></span>
      </button>
    </div>`;
}

/**
 * Left slide-out drawer opened by the hamburger trigger above — mounted once
 * on `document.body` (not inside the header) so it renders as a true
 * full-viewport overlay regardless of the header's own position/overflow.
 * Holds the account shortcuts (see accountShortcutItemsHtml()), the native
 * app download links (App Store / Android APK — kept flat/always visible
 * since they're a promo, not app-level plumbing), then a collapsed "More"
 * disclosure (see setNavDrawerMoreExpanded()) holding the app-level links
 * that otherwise have no entry point inside the Mini App (privacy, terms,
 * delete account, contact) — the public site exposes those via its own nav
 * instead. Only that last group is tucked behind a toggle, so the drawer's
 * default height stays short.
 */
function navDrawerHtml() {
  const avatarUrl = accountMenuAvatarUrl();
  const avatarInner = avatarUrl
    ? `<img class="nav-drawer-avatar-img" src="${escapeHtml(avatarUrl)}" alt="" referrerpolicy="no-referrer" onerror="this.parentElement.classList.remove('has-avatar');this.remove();" />`
    : UyDosh.iconChrome('person');
  const displayName = accountMenuDisplayName();
  return `
    <div class="nav-drawer-backdrop" data-nav-drawer-backdrop hidden aria-hidden="true">
      <div class="nav-drawer" role="dialog" aria-modal="true" data-i18n="nav.menuLabel" data-i18n-attr="aria-label">
        <div class="nav-drawer-header">
          <a class="nav-drawer-user" role="menuitem" href="${MINI_APP_PROFILE_PATH}">
            <span class="nav-drawer-avatar${avatarUrl ? ' has-avatar' : ''}" aria-hidden="true">${avatarInner}</span>
            ${displayName ? `<strong class="nav-drawer-username">${escapeHtml(displayName)}</strong>` : ''}
          </a>
        </div>
        <div class="nav-drawer-body" role="menu">
          ${accountShortcutItemsHtml()}
          <div class="account-menu-divider" role="separator"></div>
          <a role="menuitem" href="${MINI_APP_APP_STORE_HREF}" target="_blank" rel="noopener noreferrer" data-get-app-app-store>${UyDosh.iconChrome('apple')}<span data-i18n="nav.appStore"></span></a>
          <a role="menuitem" href="${MINI_APP_ANDROID_APK_HREF}" download="uydosh.apk" data-get-app-android-apk>${UyDosh.iconChrome('android')}<span data-i18n="nav.androidApk"></span></a>
          <div class="account-menu-divider" role="separator"></div>
          <button
            type="button"
            class="nav-drawer-more-toggle"
            data-nav-drawer-more-toggle
            aria-expanded="false"
            aria-controls="nav-drawer-more-panel"
          >
            ${UyDosh.iconChrome('moreHorizontal')}<span data-i18n="nav.more"></span>
            <span class="nav-drawer-more-chevron" aria-hidden="true">${UyDosh.iconChrome('chevronDown')}</span>
          </button>
          <div class="nav-drawer-more-panel" id="nav-drawer-more-panel" data-nav-drawer-more-panel hidden>
            <a role="menuitem" href="${MINI_APP_PRIVACY_PATH}">${UyDosh.iconChrome('shield')}<span data-i18n="nav.privacy"></span></a>
            <a role="menuitem" href="${MINI_APP_TERMS_PATH}">${UyDosh.iconChrome('fileText')}<span data-i18n="nav.terms"></span></a>
            <a role="menuitem" href="${MINI_APP_CONTACT_HREF}">${UyDosh.iconChrome('mail')}<span data-i18n="nav.contact"></span></a>
            <div class="account-menu-divider" role="separator"></div>
            <a role="menuitem" href="${MINI_APP_DELETE_ACCOUNT_PATH}" class="account-menu-item-danger">${UyDosh.iconChrome('trash')}<span data-i18n="nav.delete"></span></a>
          </div>
        </div>
      </div>
    </div>`;
}

/** Mirrors the drawer's own transition duration below (used for the close fallback timer). */
const NAV_DRAWER_TRANSITION_MS = 220;

function openNavDrawer() {
  const backdrop = document.querySelector('[data-nav-drawer-backdrop]');
  if (!backdrop) return;
  backdrop.hidden = false;
  backdrop.setAttribute('aria-hidden', 'false');
  // Force layout before adding the open class so the browser registers the
  // collapsed starting state and animates towards it instead of snapping.
  backdrop.getBoundingClientRect();
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => backdrop.classList.add('is-open'));
  for (const trigger of document.querySelectorAll('[data-nav-drawer-trigger]')) {
    trigger.setAttribute('aria-expanded', 'true');
  }
}

function closeNavDrawer() {
  const backdrop = document.querySelector('[data-nav-drawer-backdrop]');
  if (!backdrop || backdrop.hidden) return;
  backdrop.classList.remove('is-open');
  document.body.style.overflow = '';
  // Keep the drawer rendered (but not interactive) until the closing
  // transition finishes, then hide it — animating `display` directly isn't possible.
  window.setTimeout(() => {
    if (!backdrop.classList.contains('is-open')) {
      backdrop.hidden = true;
      backdrop.setAttribute('aria-hidden', 'true');
      // Reset the "More" disclosure so the drawer always reopens collapsed.
      setNavDrawerMoreExpanded(backdrop, false);
    }
  }, NAV_DRAWER_TRANSITION_MS);
  for (const trigger of document.querySelectorAll('[data-nav-drawer-trigger]')) {
    trigger.setAttribute('aria-expanded', 'false');
  }
}

/** Toggles the "More" (privacy/terms/contact/delete account) disclosure inside the drawer. */
function setNavDrawerMoreExpanded(backdrop, expanded) {
  const toggle = backdrop.querySelector('[data-nav-drawer-more-toggle]');
  const panel = backdrop.querySelector('[data-nav-drawer-more-panel]');
  if (!toggle || !panel) return;
  toggle.setAttribute('aria-expanded', String(expanded));
  panel.hidden = !expanded;
}

/** Lazily creates (once per page) and wires up the nav drawer + its hamburger trigger(s). */
function ensureNavDrawerMounted() {
  let backdrop = document.querySelector('[data-nav-drawer-backdrop]');
  if (!backdrop) {
    const holder = document.createElement('div');
    holder.innerHTML = navDrawerHtml();
    backdrop = holder.firstElementChild;
    document.body.appendChild(backdrop);
    applyI18n(backdrop);
    initThemeToggle();
  }
  for (const trigger of document.querySelectorAll('[data-nav-drawer-trigger]')) {
    if (trigger.dataset.bound) continue;
    trigger.dataset.bound = '1';
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      openNavDrawer();
    });
  }
  if (backdrop.dataset.bound) return;
  backdrop.dataset.bound = '1';
  // No dedicated close button — tapping the backdrop or Escape (below) are
  // the only ways out, same as tapping outside the account-menu dropdown.
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeNavDrawer();
  });
  // The "More" toggle expands/collapses its own panel in place — it must not
  // also close the whole drawer, unlike every other button below.
  backdrop.querySelector('[data-nav-drawer-more-toggle]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const expanded = e.currentTarget.getAttribute('aria-expanded') === 'true';
    setNavDrawerMoreExpanded(backdrop, !expanded);
  });
  // Nav items (`<a>`) close the drawer implicitly by navigating away; button
  // items (e.g. the theme toggle) don't navigate, so close explicitly. The
  // App Store / APK links are `<a>`s too, but `target="_blank"` / `download`
  // means this page never navigates away, so they need the same explicit
  // close as a button — plus a one-off analytics ping.
  backdrop.querySelector('.nav-drawer')?.addEventListener('click', (e) => {
    if (e.target.closest('[data-get-app-app-store]')) {
      logMiniAppEvent('get_app_tap', { platform: 'ios' });
    } else if (e.target.closest('[data-get-app-android-apk]')) {
      logMiniAppEvent('get_app_tap', { platform: 'android' });
    }
    if (e.target.closest('button:not([data-nav-drawer-more-toggle]), [data-get-app-app-store], [data-get-app-android-apk]')) {
      closeNavDrawer();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && backdrop.classList.contains('is-open')) closeNavDrawer();
  });
}

/** Shared Telegram mini-app header markup (nav menu + brand + account menu slots). */
function miniAppHeaderHtml(options = {}) {
  const {
    subtitleKey = 'brand.tagline',
    brandLink = true,
    iconSrc = '/images/uydosh-logo.svg?v=20260715-1',
  } = options;
  const brandContent =
    `<img src="${escapeHtml(iconSrc)}" width="44" height="44" alt="UyDosh" />` +
    `<div><strong><span class="brand-uy">Uy</span><span class="brand-dosh">Dosh</span></strong><span class="brand-tagline" data-i18n="${escapeHtml(subtitleKey)}"></span></div>`;
  const brand = brandLink
    ? `<a class="brand" href="${MINI_APP_FEED_PATH}" data-mini-app-home>${brandContent}</a>`
    : `<div class="brand">${brandContent}</div>`;
  return `${navMenuHtml()}${brand}<div class="header-actions">${accountMenuHtml()}</div>`;
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
  ensureNavDrawerMounted();
  syncMobileHeaderLayout();
  return header;
}

function mountAllMiniAppHeaders() {
  for (const el of document.querySelectorAll('[data-uydosh-mini-app-header]')) {
    if (el.dataset.uydoshHeaderMounted === '1') continue;
    mountMiniAppHeader(el, parseMiniAppHeaderOptions(el));
  }
}

const MINI_APP_TABBAR_STYLE_ID = 'uydosh-mini-app-tabbar-styles';

function shouldMountMiniAppTabbar() {
  if (!isMiniApp()) return false;
  const path = location.pathname || '';
  if (/listing\.html/i.test(path)) return false;
  if (/chat\.html/i.test(path)) return false;
  if (/create\.html/i.test(path)) return false;
  if (/profile\.html/i.test(path)) return false;
  if (/delete-account/i.test(path)) return false;
  return /\/telegram(\/|$)/i.test(path) || /telegram\.html$/i.test(path);
}

function miniAppTabbarActiveId() {
  const path = location.pathname || '';
  const params = new URLSearchParams(location.search);
  if (/chats\.html/i.test(path)) return 'messages';
  if (/create\.html/i.test(path)) return 'create';
  if (/account\.html/i.test(path)) return 'community';
  if (/\/telegram\/?$/i.test(path) || /\/telegram\/index\.html$/i.test(path)) return 'housing';
  return '';
}

function ensureMiniAppTabbarStyles() {
  if (document.getElementById(MINI_APP_TABBAR_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = MINI_APP_TABBAR_STYLE_ID;
  style.textContent = `
    html.mini-app-has-tabbar {
      --uydosh-tabbar-height: 58px;
      --uydosh-fixed-footer-height: calc(var(--uydosh-tabbar-height) + 8px);
    }
    html.mini-app-has-tabbar .fab-create { display: none !important; }
    html.mini-app-has-tabbar .scroll-top-btn {
      bottom: calc(var(--uydosh-tabbar-height) + 18px + max(env(safe-area-inset-bottom, 0px), var(--uydosh-tg-inset-bottom, 0px)));
    }
    .mini-app-tabbar {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 40;
      height: calc(var(--uydosh-tabbar-height) + max(env(safe-area-inset-bottom, 0px), var(--uydosh-tg-inset-bottom, 0px)));
      padding-bottom: max(env(safe-area-inset-bottom, 0px), var(--uydosh-tg-inset-bottom, 0px));
      background: #0b1a2b;
    }
    html.mini-app-header-light .mini-app-tabbar { background: #e8eef6; }
    .mini-app-tabbar-items {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      height: var(--uydosh-tabbar-height);
      align-items: center;
      padding: 0 6px;
    }
    .mini-app-tab {
      appearance: none;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      padding: 6px 4px;
      color: rgba(255, 255, 255, 0.88);
      text-decoration: none;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.1;
      min-width: 0;
    }
    .mini-app-tab svg { width: 22px; height: 22px; display: block; }
    .mini-app-tab.is-active { color: #38bdf8; }
    html.mini-app-header-light .mini-app-tab { color: rgba(15, 23, 42, 0.72); }
    html.mini-app-header-light .mini-app-tab.is-active { color: #0284c7; }
    .mini-app-tab-badge {
      position: absolute;
      top: 4px;
      margin-left: 16px;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      border-radius: 999px;
      background: #ef4444;
      color: #fff;
      font-size: 10px;
      font-weight: 800;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .mini-app-tab-badge[hidden] { display: none !important; }
  `;
  document.head.appendChild(style);
}

function miniAppTabbarHtml(activeId) {
  const item = (id, href, icon, labelKey) => {
    const active = id === activeId ? ' is-active' : '';
    const badge = id === 'messages'
      ? '<span class="mini-app-tab-badge" data-tabbar-unread hidden></span>'
      : '';
    return `<a class="mini-app-tab${active}" href="${href}" data-tabbar-id="${id}">${badge}${UyDosh.iconChrome(icon)}<span data-i18n="${labelKey}"></span></a>`;
  };
  return `
    <nav class="mini-app-tabbar" aria-label="Main">
      <div class="mini-app-tabbar-items">
        ${item('housing', MINI_APP_HOUSING_PATH, 'house', 'tabbar.housing')}
        ${item('community', MINI_APP_COMMUNITY_PATH, 'users', 'tabbar.community')}
        ${item('messages', MINI_APP_CHATS_PATH, 'chatBubbles', 'tabbar.messages')}
        ${item('create', MINI_APP_CREATE_PATH, 'plus', 'tabbar.create')}
      </div>
    </nav>`;
}

function mountMiniAppTabbar() {
  if (!shouldMountMiniAppTabbar()) return null;
  if (document.querySelector('.mini-app-tabbar')) return document.querySelector('.mini-app-tabbar');
  ensureMiniAppTabbarStyles();
  document.documentElement.classList.add('mini-app-has-tabbar');
  document.body.insertAdjacentHTML('beforeend', miniAppTabbarHtml(miniAppTabbarActiveId()));
  const bar = document.querySelector('.mini-app-tabbar');
  applyI18n(bar);
  if (typeof hydrateIcons === 'function') hydrateIcons(bar);
  refreshMiniAppTabbarUnread();
  return bar;
}

async function refreshMiniAppTabbarUnread() {
  const badge = document.querySelector('[data-tabbar-unread]');
  if (!badge || typeof fetchUnreadMessageCount !== 'function') return;
  try {
    const sessionReady = await ensureTelegramMiniAppSession();
    if (!sessionReady) return;
    const payload = await fetchUnreadMessageCount();
    const count = Number(payload?.data?.unread_count ?? payload?.unread_count) || 0;
    if (count > 0) {
      badge.hidden = false;
      badge.textContent = count > 99 ? '99+' : String(count);
    } else {
      badge.hidden = true;
    }
  } catch {
    /* ignore */
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

/**
 * Stops Telegram's in-app WebView from zooming in on a double-tap anywhere
 * in the mini app (reported as happening when tapping outside a focused
 * control) — called once from `initTelegramMiniApp`. Three layers, because
 * no single one is reliable across every WebView Telegram embeds:
 *
 * 1. `touch-action: manipulation` on `html.mini-app`(+`body`) — the CSS-level
 *    way to disable double-tap-to-zoom while still allowing normal
 *    scrolling/panning.
 * 2. A `gesturestart` listener — stops pinch-zoom specifically, which
 *    `touch-action` doesn't cover on older WebKit.
 * 3. A manual `touchend`-timestamp double-tap guard (the classic "FastClick"
 *    technique) — the layer that actually matters: iOS Safari (and every
 *    WKWebView built on it, including Telegram's) has ignored
 *    `user-scalable=no`/`maximum-scale` viewport hints for accessibility
 *    since iOS 10, and `touch-action` only covers whatever DOM the tap
 *    directly lands on — not reliable everywhere, e.g. right after a
 *    control loses focus. Suppressing the second tap's default action
 *    directly, independent of viewport/touch-action support, is what
 *    actually stops the zoom. Form controls are excluded so double-tapping
 *    to place a caret or select text inside a field still works normally.
 */
function preventMiniAppDoubleTapZoom() {
  let style = document.getElementById(MINI_APP_ZOOM_GUARD_STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = MINI_APP_ZOOM_GUARD_STYLE_ID;
    style.textContent = `
      html.mini-app, html.mini-app body {
        touch-action: manipulation;
      }
    `;
    document.head.appendChild(style);
  }
  if (window.__uydoshMiniAppZoomGuardBound) return;
  window.__uydoshMiniAppZoomGuardBound = true;

  document.addEventListener('gesturestart', (event) => event.preventDefault());

  let lastTouchEnd = 0;
  document.addEventListener('touchend', (event) => {
    const target = event.target;
    const isFormControl = target?.closest?.('input, textarea, select, [contenteditable]');
    const now = Date.now();
    if (!isFormControl && now - lastTouchEnd <= MINI_APP_DOUBLE_TAP_WINDOW_MS) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });
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
    }
    html.mini-app .wrap {
      max-width: none;
      margin: 0;
      padding-top: 0;
      padding-bottom: 32px;
      --feed-wrap-gutter: max(5px, env(safe-area-inset-left, 0px));
      padding-left: var(--feed-wrap-gutter);
      padding-right: max(5px, env(safe-area-inset-right, 0px));
      /* Must be declared here (not up on 'html.mini-app') so its
         'var(--feed-wrap-gutter, ...)' resolves against the *runtime* value
         just set above, not the stale 14px default baked into
         telegram-index.css's/telegram-shared.css's ':root' — custom
         properties resolve 'var()' using the value cascaded on the same
         element they're declared on, not the element(s) that read them, so
         declaring this on the 'html' ancestor captured the pre-override
         14px and threw off every '.content-gutter'/'.view-tabs'/grid
         consumer (they ended up ~9px closer to the edge than the header
         and filter ribbon, which compute their own margins inline instead
         of going through this variable). */
      --content-gutter-offset: calc(var(--feed-content-gutter, 25px) - var(--feed-wrap-gutter, max(5px, env(safe-area-inset-left, 0px))));
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
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 18px;
      /* Header art is a skyline photo, dark by default (dark/blue theme) —
         the gradient keeps brand text/icons legible over it. Light theme
         swaps in a lighter skyline variant below ('mini-app-header-light'),
         kept in sync with currentUiTheme() — see applyHeaderBgTheme().
         'bottom' anchoring means any extra cover-crop (on wide/short header
         boxes) trims sky off the top instead of cutting into the skyline
         itself. */
      background-image: linear-gradient(180deg, rgba(6, 21, 37, 0.32), rgba(6, 21, 37, 0.55)), url('/images/telegram-header-bg.webp');
      background-size: cover;
      /* Not fully bottom-anchored (100%) — that clipped the tops of the
         taller buildings/tower. 80% keeps the skyline low enough to read as
         a "header backdrop" while leaving the rooftops and tower tip clear
         of the top edge on every header width. */
      background-position: center 80%;
      background-repeat: no-repeat;
    }
    html.mini-app-header-light header {
      background-image: linear-gradient(180deg, rgba(6, 21, 37, 0.22), rgba(6, 21, 37, 0.45)), url('/images/telegram-header-bg-light.webp');
    }
    html.mini-app header,
    html.mini-app header .brand strong {
      color: rgba(255, 255, 255, 0.95);
    }
    html.mini-app header .brand span {
      color: rgba(255, 255, 255, 0.72);
    }
    html.mini-app header .brand .brand-uy,
    html.mini-app header .brand .brand-dosh {
      /* '.brand span' (below) forces display:block + 13px on every span
         inside .brand for the tagline — override both back to inline
         text so "Uy"/"Dosh" stay on one line at the title's font size. */
      display: inline;
      font-size: inherit;
    }
    html.mini-app header .brand .brand-uy {
      color: var(--brand, #ff0000);
    }
    html.mini-app header .brand .brand-dosh {
      color: rgba(255, 255, 255, 0.95);
    }
    html.mini-app header .account-menu-avatar {
      border-color: rgba(255, 255, 255, 0.3);
      background: rgba(255, 255, 255, 0.12);
      color: rgba(255, 255, 255, 0.85);
    }
    html.mini-app header .nav-menu-trigger {
      color: rgba(255, 255, 255, 0.85);
    }
    /* Light-theme header (lighter skyline variant, see 'mini-app-header-light'
       above) — "Dosh" and the tagline read better dark here, even though the
       header's photo is still dark-blue-tinted overall. */
    html.mini-app-header-light header .brand .brand-dosh {
      color: rgba(0, 0, 0, 0.92);
    }
    html.mini-app-header-light header .brand .brand-tagline {
      color: rgba(0, 0, 0, 0.72);
    }
    html.mini-app-header-light header .account-menu-avatar {
      border-color: rgba(0, 0, 0, 0.45);
    }
    html.mini-app-header-light header .nav-menu-trigger {
      color: rgba(0, 0, 0, 0.75);
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
    /* Pulls the hamburger closer to the header's left edge (3px) and the
       logo (6px) — header's own 14px padding + 12px inter-item gap are
       otherwise shared by every header child, so this trims just this one
       item's flanks without touching the brand/account-menu spacing). */
    html.mini-app .nav-menu {
      /* display:flex (not the default block) so this wrapper shrinks exactly
         to the 24px button's height — left as block, the inline-flex button
         gets baseline-aligned inside an invisible line box that pads the
         wrapper a few px taller than its content, which then throws off the
         header's own align-items: center centering against the 44px logo/
         avatar by a visible ~1.5px. */
      display: flex;
      align-items: center;
      margin-left: -6px;
      margin-right: -6px;
      flex-shrink: 0;
    }
    html.mini-app .account-menu-trigger {
      appearance: none;
      border: none;
      background: none;
      padding: 0;
      /* Matches .brand img (the UyDosh logo) so both header circles/tiles
         read as the same visual size. */
      width: 44px;
      height: 44px;
      display: inline-flex;
      cursor: pointer;
      flex-shrink: 0;
    }
    html.mini-app .account-menu-trigger:active {
      opacity: 0.88;
    }
    html.mini-app .account-menu-avatar {
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      border-radius: 50%;
      overflow: hidden;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1.5px solid var(--stroke, rgba(127, 127, 127, 0.45));
      background: rgba(127, 127, 127, 0.08);
      color: var(--muted, rgba(255, 255, 255, 0.7));
    }
    html.mini-app .account-menu-avatar svg {
      width: 20px;
      height: 20px;
      display: block;
    }
    html.mini-app .account-menu-avatar.has-avatar .account-menu-avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    /* Bare icon, deliberately no circular chrome behind it — distinguishes
       this app-level nav trigger from the avatar-styled account menu. */
    html.mini-app .nav-menu-trigger {
      appearance: none;
      border: none;
      background: none;
      padding: 0;
      /* Hugs the 24px icon exactly (unlike the old 44px box, which padded
         the glyph 10px on every side — invisible space the .nav-menu
         margins below couldn't reach since they only push on the *outside*
         of this box). Tap target is restored via the ::before below instead
         of by oversizing this box. */
      width: 24px;
      height: 24px;
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      color: var(--muted, rgba(255, 255, 255, 0.7));
    }
    html.mini-app .nav-menu-trigger:active {
      opacity: 0.88;
    }
    /* Invisible hit-area expansion back to ~44px so the smaller visual box
       above doesn't shrink the actual tap target — doesn't affect layout
       since it's taken out of flow. */
    html.mini-app .nav-menu-trigger::before {
      content: '';
      position: absolute;
      inset: -10px;
    }
    html.mini-app .nav-menu-join-badge {
      display: block;
      position: absolute;
      top: -4px;
      right: -4px;
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 0 2px rgba(6, 21, 37, 0.85);
      z-index: 2;
      pointer-events: none;
      transform-origin: center;
      animation: nav-menu-join-pulse 1s ease-in-out infinite;
    }
    html.mini-app .nav-menu-join-badge::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 50%;
      box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.85);
      animation: nav-menu-join-ring 1.4s ease-out infinite;
    }
    html.mini-app-header-light header .nav-menu-join-badge {
      box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.9);
    }
    html.mini-app .nav-menu-join-badge[hidden] {
      display: none;
    }
    @keyframes nav-menu-join-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.45); }
    }
    @keyframes nav-menu-join-ring {
      0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.8); opacity: 1; }
      100% { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); opacity: 0; }
    }
    html.mini-app .nav-menu-icon svg {
      width: 24px;
      height: 24px;
      display: block;
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
    html.mini-app .account-menu-divider {
      height: 1px;
      margin: 4px 6px;
      background: var(--stroke, rgba(127, 127, 127, 0.35));
      flex-shrink: 0;
    }
    html.mini-app .account-menu-theme {
      appearance: none;
      width: 100%;
      border: none;
      background: none;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    /* Flags "Delete account" as a sensitive/destructive action, same red
       used by the standalone delete button on the account page
       (.account-delete-btn in telegram-account.css). */
    html.mini-app .nav-drawer-body a.account-menu-item-danger {
      color: var(--error, #f87171);
    }
    /* Left slide-out drawer opened by the hamburger trigger — mounted on
       document.body (see ensureNavDrawerMounted()), not inside the header,
       so it renders as a true full-viewport overlay above everything else. */
    html.mini-app .nav-drawer-backdrop {
      position: fixed;
      inset: 0;
      z-index: 300;
      background: rgba(0, 0, 0, 0.55);
      display: flex;
      align-items: stretch;
      justify-content: flex-start;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    html.mini-app .nav-drawer-backdrop[hidden] {
      display: none !important;
    }
    html.mini-app .nav-drawer-backdrop.is-open {
      opacity: 1;
    }
    html.mini-app .nav-drawer {
      width: min(82vw, 300px);
      max-width: 300px;
      height: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      /* Same solid tint used elsewhere behind the account-menu-badge, so its
         box-shadow ring (color-mix'd against that background) still matches. */
      background: color-mix(in srgb, var(--bg), black 6%);
      border-right: 1px solid var(--stroke, rgba(127, 127, 127, 0.35));
      box-shadow: 18px 0 60px rgba(0, 0, 0, 0.45);
      /* Top padding adds a flat 16px on top of --uydosh-tg-inset-top (not just
         max()'d against it, like the other three sides) — that variable is
         Telegram's own reserved header-chrome height (its native title bar/
         close button sit *inside* the WebView's top edge on some clients, see
         its definition above), so max() alone would leave the logo row and
         "Профиль" flush against that chrome with zero breathing room. */
      padding: calc(var(--uydosh-tg-inset-top, env(safe-area-inset-top, 0px)) + 16px) 16px
        max(16px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px));
      transform: translateX(-100%);
      transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
      overflow-y: auto;
    }
    html.mini-app .nav-drawer-backdrop.is-open .nav-drawer {
      transform: translateX(0);
    }
    html.mini-app .nav-drawer-header {
      margin-bottom: 18px;
      flex: 0 0 auto;
    }
    /* Own circular Telegram avatar + display name, replacing the brand logo
       that used to sit here — the drawer already opens from an identity
       -bearing avatar trigger in the header, so it reads better as "this is
       your account" than as another UyDosh wordmark. Row layout (not
       stacked) — no dedicated close button anymore, so there's no corner
       element to keep clear of either; tap the backdrop or Escape to close.
       Itself a link to the profile page (mirrors the "Profile" item further
       down in .nav-drawer-body, but tapping the avatar/name directly is the
       more natural gesture). */
    html.mini-app .nav-drawer-user {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 12px;
      min-width: 0;
      margin: -6px -8px;
      padding: 6px 8px;
      border-radius: 12px;
      color: inherit;
      text-decoration: none;
    }
    html.mini-app .nav-drawer-user:active {
      background: rgba(127, 127, 127, 0.16);
    }
    html.mini-app .nav-drawer-avatar {
      width: 48px;
      height: 48px;
      box-sizing: border-box;
      border-radius: 50%;
      overflow: hidden;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(127, 127, 127, 0.16);
      color: var(--fg, rgba(255, 255, 255, 0.85));
    }
    html.mini-app .nav-drawer-avatar svg {
      width: 22px;
      height: 22px;
      display: block;
    }
    html.mini-app .nav-drawer-avatar.has-avatar {
      background: transparent;
    }
    html.mini-app .nav-drawer-avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    html.mini-app .nav-drawer-username {
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.1px;
      color: var(--fg, rgba(255, 255, 255, 0.92));
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    html.mini-app .nav-drawer-body {
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow-y: auto;
      flex: 1 1 auto;
    }
    html.mini-app .nav-drawer-body a,
    html.mini-app .nav-drawer-body button {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 10px;
      border-radius: 10px;
      color: var(--fg, rgba(255, 255, 255, 0.92));
      font-size: 15px;
      font-weight: 600;
      text-decoration: none;
      width: 100%;
      border: none;
      background: none;
      font-family: inherit;
      text-align: left;
      cursor: pointer;
    }
    html.mini-app .nav-drawer-body a:active,
    html.mini-app .nav-drawer-body button:active {
      background: rgba(127, 127, 127, 0.16);
    }
    html.mini-app .nav-drawer-body a svg,
    html.mini-app .nav-drawer-body button svg {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      display: block;
      stroke: currentColor;
      fill: none;
    }
    /* Collapsed "More" disclosure (privacy/terms/contact/delete account) —
       trailing chevron rotates open the same way as .filters-toggle's
       (telegram-index.css) and the listing-detail page's collapsible
       sections (.compat-chevron/.roomscan-chevron). */
    html.mini-app .nav-drawer-more-toggle {
      color: var(--muted, rgba(255, 255, 255, 0.65));
    }
    html.mini-app .nav-drawer-more-chevron svg {
      width: 18px;
      height: 18px;
      display: block;
      transition: transform 180ms ease;
    }
    html.mini-app .nav-drawer-more-toggle[aria-expanded="true"] .nav-drawer-more-chevron svg {
      transform: rotate(180deg);
    }
    html.mini-app .nav-drawer-more-toggle .nav-drawer-more-chevron {
      margin-left: auto;
    }
    html.mini-app .nav-drawer-more-panel {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding-left: 8px;
    }
    html.mini-app .nav-drawer-more-panel[hidden] {
      display: none;
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
    a.detail-contact-btn-group-chat {
      background: var(--brand2, #22c55e);
      box-shadow: 0 10px 28px color-mix(in srgb, var(--brand2, #22c55e) 40%, transparent);
      text-decoration: none;
      box-sizing: border-box;
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

// Firebase Crashlytics has no web/JS SDK (mobile/desktop only), so uncaught
// JS errors here previously only showed up in a device's own devtools
// console — e.g. the `haptic is not defined` ReferenceError that silently
// killed the admin-edit button's click handler. Report them as GA4
// `exception` events on the same Firebase project instead, via the
// Mini-App-only analytics pipeline above.
const _reportedJsErrorKeys = new Set();
function _logJsException(description, extra) {
  const key = _clip(description, 100);
  if (!key || _reportedJsErrorKeys.has(key)) return; // de-dupe repeats within this page load
  _reportedJsErrorKeys.add(key);
  logMiniAppEvent('exception', {
    description: key,
    fatal: false,
    page_path: _clip(location.pathname, 100),
    ...extra,
  });
}

window.addEventListener('error', (event) => {
  // Plain resource-load Events (img/script 404s) aren't real ErrorEvents.
  if (!(event instanceof ErrorEvent)) return;
  _logJsException(`${event.message} @ ${event.filename}:${event.lineno}:${event.colno}`, {
    error_stack: _clip(event.error?.stack, 100),
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const message = reason instanceof Error ? reason.message : String(reason);
  _logJsException(`unhandled rejection: ${message}`, {
    error_stack: _clip(reason instanceof Error ? reason.stack : '', 100),
  });
});

/**
 * `t.me/<bot>?startapp=listing_123` direct links (used by the in-app Share
 * button) launch the Mini App at its configured menu-button URL — the feed —
 * with `listing_123` passed through as `start_param` (mirrored in the
 * `tgWebAppStartParam` query param). Redirect straight to that listing
 * instead of flashing the feed first.
 *
 * Unlike a URL query param, `tg.initDataUnsafe.start_param` is scoped to the
 * whole Mini App *launch session*, not the current page — Telegram keeps
 * reporting the exact same value on every page of that session, including
 * ones reached by later in-app navigation (e.g. tapping the header
 * BackButton to go from the listing back to the feed). Without the
 * `sessionStorage` guard below, that stale value would re-trigger this
 * redirect back to the listing every time the feed page loads for the rest
 * of the session, making it impossible to ever land on/stay on the feed
 * after opening a shared listing link.
 *
 * A trailing `_3d` (from `buildListing3dShareUrl`, the 3D viewer's own share
 * button — see listing-detail-roomscan.js) carries through as `?view=3d` so
 * the listing page auto-opens the fullscreen 3D viewer instead of just
 * landing on the listing.
 */
function redirectFromMiniAppStartParam() {
  if (/listing\.html/i.test(location.pathname)) return false;
  const tg = window.Telegram?.WebApp;
  const startParam =
    tg?.initDataUnsafe?.start_param ||
    new URLSearchParams(location.search).get('tgWebAppStartParam') ||
    '';
  const trimmed = String(startParam).trim();
  const sessionKey = 'uydosh:consumedStartParam';

  // Return leg of the App Clip room-scan flow: the clip's "Return to
  // Telegram" button deep-links here with scan_<token>. Show a blocking
  // status overlay, poll the scan session, and land on the listing's 3D
  // view once the backend finishes building the plan.
  const scanMatch = /^scan_([A-Za-z0-9_-]{4,64})$/.exec(trimmed);
  if (scanMatch) {
    try {
      if (sessionStorage.getItem(sessionKey) === trimmed) return false;
      sessionStorage.setItem(sessionKey, trimmed);
    } catch { /* ignore — worst case this restore fires again */ }
    restoreScanSessionFromStartParam(scanMatch[1]);
    return true;
  }

  const match = /^listing_(\d+)(_3d|_join)?$/.exec(trimmed);
  if (!match) return false;
  try {
    if (sessionStorage.getItem(sessionKey) === trimmed) return false;
    sessionStorage.setItem(sessionKey, trimmed);
  } catch { /* ignore — worst case this redirect fires again */ }
  const extras = {};
  if (match[2] === '_3d') extras.view = '3d';
  if (match[2] === '_join') extras.group = 'requests';
  location.replace(listingPageUrl(match[1], extras));
  return true;
}

/**
 * Blocking overlay + polling for a returning room-scan session. Polls only
 * while the session is still pending/processing and stops on any terminal
 * status (completed → redirect to the listing's 3D view; failed/expired →
 * message with a plain "open listing" fallback).
 */
function restoreScanSessionFromStartParam(token) {
  const t = (key) => window.UyDosh?.t?.(key, window.UyDosh?.getLang?.()) || key;

  const overlay = document.createElement('div');
  overlay.className = 'scan-restore-overlay';
  const spinner = document.createElement('div');
  spinner.className = 'loading-spinner';
  const message = document.createElement('p');
  message.className = 'scan-restore-message';
  message.textContent = t('scanRestore.loading');
  overlay.appendChild(spinner);
  overlay.appendChild(message);
  const attach = () => document.body.appendChild(overlay);
  if (document.body) attach();
  else document.addEventListener('DOMContentLoaded', attach, { once: true });

  const showFallbackButton = (listingId) => {
    spinner.remove();
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'scan-restore-button';
    button.textContent = t('scanRestore.openListing');
    button.addEventListener('click', () => {
      location.replace(listingId ? listingPageUrl(listingId) : MINI_APP_FEED_PATH);
    });
    overlay.appendChild(button);
  };

  const startedAt = Date.now();
  const maxWaitMs = 4 * 60 * 1000;
  let listingId = null;

  const poll = async () => {
    let session;
    try {
      session = await window.UyDosh.fetchScanSession(token);
    } catch (err) {
      if (err?.status === 404 || err?.status === 410) {
        message.textContent = t('scanRestore.expired');
        showFallbackButton(listingId);
        return;
      }
      // Transient error — keep polling until the deadline.
      session = null;
    }

    if (session) {
      listingId = session.listingId ?? listingId;
      if (session.status === 'completed') {
        location.replace(listingPageUrl(session.listingId, { view: '3d' }));
        return;
      }
      if (session.status === 'failed') {
        message.textContent = t('scanRestore.failed');
        showFallbackButton(listingId);
        return;
      }
      if (session.status === 'expired') {
        message.textContent = t('scanRestore.expired');
        showFallbackButton(listingId);
        return;
      }
      message.textContent = t(
        session.status === 'processing' ? 'scanRestore.processing' : 'scanRestore.loading',
      );
    }

    if (Date.now() - startedAt > maxWaitMs) {
      message.textContent = t('scanRestore.failed');
      showFallbackButton(listingId);
      return;
    }
    setTimeout(poll, 3000);
  };

  poll();
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

// --- Single active Mini App instance: blocking "session revoked" screen ---
// Paired with `startTelegramMiniAppSession`/`onMiniAppSessionRevoked` in
// uydosh-api.js. Shown when this tab/WebView's instance has been superseded
// by another one opened for the same Telegram user (either pushed instantly
// over the Socket.IO channel, or discovered on the next ~10s heartbeat).

const MINI_APP_SESSION_REVOKED_STYLE_ID = 'uydosh-mini-app-session-revoked-styles';

function ensureMiniAppSessionRevokedStyles() {
  if (document.getElementById(MINI_APP_SESSION_REVOKED_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = MINI_APP_SESSION_REVOKED_STYLE_ID;
  style.textContent = `
    .mini-app-session-revoked-overlay {
      position: fixed;
      inset: 0;
      z-index: 20000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: color-mix(in srgb, var(--bg, #061525) 96%, black);
      -webkit-backdrop-filter: blur(6px);
      backdrop-filter: blur(6px);
    }
    .mini-app-session-revoked-card {
      max-width: 360px;
      width: 100%;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
    }
    .mini-app-session-revoked-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .mini-app-session-revoked-icon img {
      width: 68px;
      height: 68px;
      display: block;
    }
    .mini-app-session-revoked-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--fg, rgba(255, 255, 255, 0.92));
      margin: 0;
    }
    .mini-app-session-revoked-message {
      font-size: 14px;
      line-height: 1.5;
      color: var(--muted, rgba(255, 255, 255, 0.7));
      margin: 0;
    }
    .mini-app-session-revoked-device {
      font-size: 12px;
      font-weight: 600;
      color: var(--muted, rgba(255, 255, 255, 0.6));
      background: rgba(127, 127, 127, 0.14);
      border-radius: 999px;
      padding: 6px 14px;
      margin: 0;
    }
    .mini-app-session-revoked-actions {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      margin-top: 6px;
      width: 100%;
    }
    .mini-app-session-revoked-refresh,
    .mini-app-session-revoked-close {
      appearance: none;
      border: 0;
      border-radius: 999px;
      padding: 12px 28px;
      font-weight: 700;
      font-size: 15px;
      cursor: pointer;
      width: 100%;
      max-width: 240px;
    }
    .mini-app-session-revoked-refresh {
      background: var(--brand2, #60a5fa);
      color: #06121f;
    }
    .mini-app-session-revoked-close {
      background: transparent;
      border: 1px solid var(--muted, rgba(255, 255, 255, 0.35));
      color: var(--fg, rgba(255, 255, 255, 0.92));
    }
    .mini-app-session-revoked-refresh:active,
    .mini-app-session-revoked-close:active {
      opacity: 0.88;
    }
  `;
  document.head.appendChild(style);
}

/** Locale-aware "HH:MM" for the new session's start time, matching `formatPublicationDate`'s locale mapping. */
function formatMiniAppSessionRevokedTime(startedAt, lang) {
  if (!startedAt) return '';
  const d = new Date(startedAt);
  if (Number.isNaN(d.getTime())) return '';
  const locale = lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'uz-UZ';
  return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

/**
 * Renders the full-screen blocking overlay with two actions: "Refresh" (reloads
 * the page, in case this instance is actually still the active one — a race
 * between the heartbeat and the other tab closing) and "Close" (attempts
 * `Telegram.WebApp.close()`) — satisfies "show a blocking screen or call
 * Telegram.WebApp.close()" without abruptly closing the app out from under the
 * user before they understand why.
 *
 * `details` (from the `session_revoked` socket payload or the heartbeat's 409
 * body — see TelegramMiniAppSessionService server-side) optionally carries
 * `{ device, startedAt }` describing the *new* session that took over, shown
 * as a small security-style hint (e.g. "New session: iPhone/iPad • 14:32").
 */
function showMiniAppSessionRevokedScreen(_reason, details = {}) {
  if (document.querySelector('.mini-app-session-revoked-overlay')) return;
  ensureMiniAppSessionRevokedStyles();
  const lang = getLang();
  const device = typeof details?.device === 'string' ? details.device.trim() : '';
  const time = formatMiniAppSessionRevokedTime(details?.startedAt, lang);
  const info = [device, time].filter(Boolean).join(' • ');
  const deviceLineHtml = info
    ? `<p class="mini-app-session-revoked-device">${escapeHtml(t('session.revokedDeviceLine', lang).replace('{info}', info))}</p>`
    : '';
  const overlay = document.createElement('div');
  overlay.className = 'mini-app-session-revoked-overlay';
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <div class="mini-app-session-revoked-card">
      <span class="mini-app-session-revoked-icon" aria-hidden="true"><img src="/images/uydosh-logo.svg?v=20260715-1" alt="" /></span>
      <h2 class="mini-app-session-revoked-title">${escapeHtml(t('session.revokedTitle', lang))}</h2>
      <p class="mini-app-session-revoked-message">${escapeHtml(t('session.revokedMessage', lang))}</p>
      ${deviceLineHtml}
      <div class="mini-app-session-revoked-actions">
        <button type="button" class="mini-app-session-revoked-refresh" data-session-revoked-refresh>${escapeHtml(t('session.revokedRefresh', lang))}</button>
        <button type="button" class="mini-app-session-revoked-close" data-session-revoked-close>${escapeHtml(t('session.revokedClose', lang))}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('[data-session-revoked-refresh]')?.addEventListener('click', () => {
    // Covers the case where this instance was revoked stale (e.g. the other
    // session already ended) — reloading re-runs `startTelegramMiniAppSession`
    // and drops back into the normal app if this is once again the sole active
    // instance, instead of forcing the user all the way out via `close()`.
    window.location.reload();
  });
  overlay.querySelector('[data-session-revoked-close]')?.addEventListener('click', () => {
    try {
      if (typeof window.Telegram?.WebApp?.close === 'function') {
        window.Telegram.WebApp.close();
        return;
      }
    } catch { /* ignore */ }
    // Outside Telegram (desktop browser testing) there's nothing to "close" —
    // leave the blocking overlay up, which already prevents further interaction.
  });
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
    // Block content-area swipe-down so the Mini App doesn't collapse while
    // scrolling / dragging maps. Users still close via the header ✕ (or by
    // swiping the header itself). No-op on clients < Bot API 7.7.
    // Same call as makon3d.js `initTelegramChrome`.
    try { tg.disableVerticalSwipes?.(); } catch { /* ignore */ }
    // Telegram doesn't reset the header BackButton to match whatever page
    // you've navigated to — it can carry over "shown" from wherever you came
    // from (e.g. back from a listing to the feed). Default it off here, on
    // every page, since only specific pages need it: `listing.html` and
    // `telegram-create.js` (see `updateTelegramBackButton`) explicitly show
    // it themselves, after this runs.
    try { tg.BackButton?.hide(); } catch { /* ignore */ }
    if (redirectFromMiniAppStartParam()) return true;
    // Single active Mini App instance per Telegram user: register this launch,
    // then start the ~10s heartbeat / realtime socket that detect being
    // superseded by another instance (see uydosh-api.js + backend
    // TelegramMiniAppSessionService). Fire-and-forget — must never block startup.
    onMiniAppSessionRevoked(showMiniAppSessionRevokedScreen);
    startTelegramMiniAppSession();
    // Fire-and-forget: inits the LocationManager and requests the user's location right away.
    // On a user's very first Mini App visit ever, this is what triggers Telegram's native
    // location permission prompt; on every visit after that (granted or denied), it silently
    // resolves/no-ops with no repeat prompt. See `requestAndReportUserLocation`.
    requestAndReportUserLocation();
    applyTelegramTheme(tg);
    applyStoredManualTheme();
    applyHeaderBgTheme();
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
  preventMiniAppDoubleTapZoom();
  applyStoredManualTheme();
  applyHeaderBgTheme();
  ensureMiniAppSafeAreaStyles();
  applyTelegramSafeAreaInsets(tg);
  bindMiniAppInternalNav();
  bindMiniAppHapticFeedback();
  mountAllMiniAppHeaders();
  mountMiniAppTabbar();
  syncMobileHeaderLayout();
  // Fire-and-forget: reveals a green dot on the account menu's "Profile" item
  // once the profile fetch resolves, if the user hasn't filled anything in yet.
  maybeShowProfileMenuBadge();
  maybeShowJoinRequestNavBadge();
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
    } else if (/chat\.html/i.test(path)) {
      logMiniAppScreen('telegram_group_chat');
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
  chatPageUrl,
  profilePageUrl,
  miniAppBackTargetFromUrl,
  feedPageUrl,
  createPageUrl,
  bindMiniAppInternalNav,
  initTelegramMiniApp,
  bindMiniAppHapticFeedback,
  redirectFromMiniAppStartParam,
  mountMiniAppHeader,
  mountAllMiniAppHeaders,
  miniAppHeaderHtml,
  MINI_APP_ACCOUNT_PATH,
  MINI_APP_GROUPS_PATH,
  MINI_APP_FAVORITES_PATH,
  MINI_APP_CREATE_PATH,
  MINI_APP_CHATS_PATH,
  MINI_APP_PROFILE_PATH,
  maybeShowProfileNudge,
  dismissProfileNudge,
  maybeShowProfileMenuBadge,
  maybeShowJoinRequestNavBadge,
  hideJoinRequestNavBadge,
  hideProfileMenuBadge,
  isProfileEmpty,
  isProfileFullyPopulated,
  initMiniAppAnalytics,
  logMiniAppEvent,
  logMiniAppScreen,
  MINI_APP_FEED_PATH,
  showMiniAppSessionRevokedScreen,
});
