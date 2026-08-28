// UyDosh Web — i18n loader + t(), applyI18n(), the language switcher UI, the
// light/dark theme toggle button, and escapeHtml().
// Depends on uydosh-core.js (getLang/setLang). Load after it, synchronously —
// see loadActiveLanguageDictionaries() below for why this file must never be
// marked `defer`/`async`.

// The uz/ru/en translation strings themselves live in assets/i18n/{uz,ru,en}.js
// instead of one big dictionary here, and only the ones actually needed for the
// current session are loaded: `uz` always (it's the fallback language for any
// key missing from the active one — see t() below) plus the active language's
// own file if it isn't already uz. This cuts what would otherwise be ~70KB of
// translation strings shipped on every single page load down to ~1/3-2/3 of
// that, depending on which language is active.
//
// This only works because this script — unlike every other one loaded after
// it on these pages — stays a plain, synchronous, non-deferred <script> tag:
// document.write() here inserts the needed <script src> tag(s) directly into
// the still-parsing HTML stream, and the parser fetches + executes them
// (populating window.I18N) before moving on to the next tag, so every later
// script (deferred or not) is guaranteed to see a fully populated dictionary
// by the time it actually runs.
(function loadActiveLanguageDictionaries() {
  var lang = typeof getLang === 'function' ? getLang() : 'uz';
  var langs = lang === 'uz' ? ['uz'] : ['uz', lang];
  var thisScript = document.currentScript;
  var base = thisScript && thisScript.src
    ? thisScript.src.replace(/uydosh-i18n\.js.*$/, 'i18n/')
    : 'assets/i18n/';
  var version = '20260828-2';
  var canWrite = document.readyState === 'loading';
  langs.forEach(function (code) {
    var src = base + code + '.js?v=' + version;
    if (canWrite) {
      document.write('<script src="' + src + '"><' + '/script>');
    } else {
      // Defensive fallback only (shouldn't happen given this file's current,
      // always-synchronous <script> placement) — no ordering guarantee.
      var s = document.createElement('script');
      s.src = src;
      document.head.appendChild(s);
    }
  });
})();

function t(key, lang = getLang()) {
  return I18N[lang]?.[key] ?? I18N.uz[key] ?? key;
}

function ensureLangSwitcherStyles() {
  if (document.getElementById(LANG_SWITCHER_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = LANG_SWITCHER_STYLE_ID;
  style.textContent = `
    .lang.lang-dropdown {
      position: relative;
      display: inline-flex;
      padding: 4px;
      gap: 0;
      border-radius: 999px;
      border: 1px solid var(--stroke, rgba(127, 127, 127, 0.35));
      background: rgba(127, 127, 127, 0.08);
      flex-shrink: 0;
    }
    .lang.lang-dropdown > .lang-trigger {
      appearance: none;
      border: 0;
      background: transparent;
      color: var(--muted, rgba(255, 255, 255, 0.7));
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 9px 6px 8px;
      border-radius: 999px;
      font: inherit;
      font-weight: 700;
      line-height: 1;
    }
    .lang.lang-dropdown > .lang-trigger:hover {
      color: var(--fg, rgba(255, 255, 255, 0.92));
    }
    .lang.lang-dropdown > .lang-trigger .flag {
      font-size: 14px;
      line-height: 1;
    }
    .lang.lang-dropdown > .lang-trigger .flag.flag-avatar {
      width: 29px;
      height: 29px;
      border-radius: 50%;
      border: 1.5px solid var(--stroke, rgba(127, 127, 127, 0.45));
      overflow: hidden;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0;
      flex-shrink: 0;
    }
    .lang.lang-dropdown > .lang-trigger .flag.flag-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .lang.lang-dropdown .lang-chevron {
      display: inline-flex;
      align-items: center;
      opacity: 0.65;
      transition: transform 0.15s ease;
    }
    .lang.lang-dropdown.lang-open .lang-chevron {
      transform: rotate(180deg);
    }
    .lang.lang-dropdown .lang-menu {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      min-width: 148px;
      padding: 4px;
      border-radius: 12px;
      border: 1px solid var(--stroke, rgba(127, 127, 127, 0.35));
      background: var(--card, rgba(15, 23, 42, 0.98));
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
      z-index: 100;
    }
    .lang.lang-dropdown .lang-menu button {
      appearance: none;
      border: 0;
      background: transparent;
      color: var(--muted, rgba(255, 255, 255, 0.7));
      width: 100%;
      text-align: left;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 8px;
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: normal;
    }
    .lang.lang-dropdown .lang-menu button:hover {
      background: rgba(127, 127, 127, 0.12);
      color: var(--fg, rgba(255, 255, 255, 0.92));
    }
    .lang.lang-dropdown .lang-menu button[aria-selected="true"] {
      color: var(--fg, rgba(255, 255, 255, 0.92));
      background: rgba(127, 127, 127, 0.16);
    }
    .lang.lang-dropdown .lang-menu .lang-label {
      flex: 1 1 auto;
      min-width: 0;
    }
  `;
  document.head.appendChild(style);
}

function buildLangDropdown(group) {
  if (group.querySelector('.lang-trigger')) return group;
  group.classList.add('lang-dropdown');

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'lang-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');

  const flagSpan = document.createElement('span');
  flagSpan.className = 'flag';
  flagSpan.setAttribute('aria-hidden', 'true');

  const chevron = document.createElement('span');
  chevron.className = 'lang-chevron';
  chevron.setAttribute('aria-hidden', 'true');
  chevron.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">' +
    '<path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>' +
    '</svg>';

  trigger.append(flagSpan, chevron);

  const menu = document.createElement('div');
  menu.className = 'lang-menu';
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;

  for (const lang of LANGS) {
    const meta = LANG_META[lang];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-lang', lang);
    btn.setAttribute('data-haptic', 'selection');
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-label', meta.label);
    btn.innerHTML =
      `<span class="flag" aria-hidden="true">${meta.flag}</span>` +
      `<span class="lang-label">${meta.label}</span>`;
    menu.appendChild(btn);
  }

  group.replaceChildren(trigger, menu);
  return group;
}

/** Telegram profile photo of the current Mini App user, if Telegram exposed one. */
function telegramMiniAppUserAvatarUrl() {
  try {
    return window.Telegram?.WebApp?.initDataUnsafe?.user?.photo_url || '';
  } catch {
    return '';
  }
}

function syncLangDropdown(group, lang) {
  const meta = LANG_META[lang];
  if (!meta) return;
  const trigger = group.querySelector('.lang-trigger');
  if (!trigger) return;
  const flag = trigger.querySelector('.flag');
  if (flag) {
    // Inside Telegram, the trigger shows the user's own avatar instead of the
    // currently selected language's flag — the flag list only appears once
    // the dropdown is opened.
    const avatarUrl = telegramMiniAppUserAvatarUrl();
    const currentAvatarImg = flag.querySelector('img.lang-avatar-img');
    if (avatarUrl) {
      if (currentAvatarImg?.getAttribute('src') !== avatarUrl) {
        flag.classList.add('flag-avatar');
        flag.innerHTML = `<img class="lang-avatar-img" src="${escapeHtml(avatarUrl)}" alt="" referrerpolicy="no-referrer" onerror="this.parentElement.classList.remove('flag-avatar'); this.parentElement.textContent='${meta.flag}';" />`;
      }
    } else if (currentAvatarImg || flag.textContent !== meta.flag) {
      flag.classList.remove('flag-avatar');
      flag.textContent = meta.flag;
    }
  }
  trigger.setAttribute('aria-label', meta.label);
  for (const opt of group.querySelectorAll('.lang-menu button[data-lang]')) {
    opt.setAttribute(
      'aria-selected',
      opt.getAttribute('data-lang') === lang ? 'true' : 'false',
    );
  }
}

function closeLangDropdown(group) {
  const menu = group.querySelector('.lang-menu');
  const trigger = group.querySelector('.lang-trigger');
  if (!menu || !trigger) return;
  menu.hidden = true;
  trigger.setAttribute('aria-expanded', 'false');
  group.classList.remove('lang-open');
}

function applyI18n(root = document) {
  const lang = getLang();
  root.documentElement && (root.documentElement.lang = lang);
  for (const el of root.querySelectorAll('[data-i18n]')) {
    const key = el.getAttribute('data-i18n');
    const attr = el.getAttribute('data-i18n-attr');
    const value = t(key, lang);
    if (attr) el.setAttribute(attr, value);
    else el.textContent = value;
  }
  for (const group of root.querySelectorAll('.lang.lang-dropdown')) {
    syncLangDropdown(group, lang);
  }
}

function initLangSwitcher() {
  ensureLangSwitcherStyles();
  for (const group of document.querySelectorAll('.lang')) {
    buildLangDropdown(group);
  }

  if (!document.documentElement.dataset.uydoshLangBound) {
    document.documentElement.dataset.uydoshLangBound = '1';
    document.addEventListener('click', (e) => {
      for (const group of document.querySelectorAll('.lang.lang-open')) {
        if (!group.contains(e.target)) closeLangDropdown(group);
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      for (const group of document.querySelectorAll('.lang.lang-open')) {
        closeLangDropdown(group);
      }
    });
  }

  for (const group of document.querySelectorAll('.lang.lang-dropdown')) {
    const trigger = group.querySelector('.lang-trigger');
    const menu = group.querySelector('.lang-menu');
    if (!trigger || !menu || trigger.dataset.bound) continue;
    trigger.dataset.bound = '1';
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = group.classList.contains('lang-open');
      for (const other of document.querySelectorAll('.lang.lang-open')) {
        closeLangDropdown(other);
      }
      if (!open) {
        menu.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        group.classList.add('lang-open');
      }
    });
    for (const btn of group.querySelectorAll('.lang-menu button[data-lang]')) {
      if (btn.dataset.bound) continue;
      btn.dataset.bound = '1';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        setLang(btn.getAttribute('data-lang'));
        applyI18n();
        closeLangDropdown(group);
      });
    }
  }
  applyI18n();
}

/** Sun/moon glyph for the header app-theme toggle (matches the old map control's icon). */
function themeToggleButtonIconSvg(isDark) {
  return isDark
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"></path></svg>`;
}

/**
 * Sync every header theme-toggle button's icon/label with the current app UI theme (not the
 * map's theme — the map deliberately ignores this toggle, see prefersDarkMapPins()).
 */
function refreshThemeToggleButtons() {
  const isDark = currentUiTheme() === 'dark';
  // Button shows the *target* mode's icon, so the label names the mode it switches to.
  const label = t(isDark ? 'theme.toggleLight' : 'theme.toggleDark');
  for (const btn of document.querySelectorAll('[data-uydosh-theme-toggle]')) {
    // Menu-item form has separate icon/label slots (keeps its own text visible);
    // the plain circle-button form has neither, so its whole innerHTML is the icon.
    const iconSlot = btn.querySelector('[data-theme-toggle-icon]');
    const labelSlot = btn.querySelector('[data-theme-toggle-label]');
    if (iconSlot || labelSlot) {
      if (iconSlot) iconSlot.innerHTML = themeToggleButtonIconSvg(isDark);
      if (labelSlot) labelSlot.textContent = label;
    } else {
      btn.innerHTML = themeToggleButtonIconSvg(isDark);
    }
    btn.setAttribute('aria-label', label);
    btn.title = label;
  }
}

/** Wire up header theme-toggle button(s) — mirrors the map's old sun/moon control. */
function initThemeToggle() {
  for (const btn of document.querySelectorAll('[data-uydosh-theme-toggle]')) {
    if (btn.dataset.bound) continue;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      toggleManualTheme();
    });
  }
  refreshThemeToggleButtons();
}

if (typeof document !== 'undefined') {
  document.addEventListener('uydosh:themechange', refreshThemeToggleButtons);
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

Object.assign(window.UyDosh, {
  applyI18n,
  initLangSwitcher,
  initThemeToggle,
  escapeHtml,
  t,
});
