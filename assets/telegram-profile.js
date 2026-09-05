// UyDosh Web — Telegram Mini App "Profile" page. Single-page form (not a
// wizard): today it only asks "are you a student?" + university, built so
// more self-profile fields can be appended the same way over time.
// Depends on uydosh-core.js, uydosh-api.js, uydosh-i18n.js, uydosh-icons.js,
// uydosh-mini-app.js. Load last.

UyDosh.initTelegramMiniApp();

// Reached from the account menu on any page — the header's BackButton
// defaults to hidden (see `initTelegramMiniApp`), so show it here and send
// the user back to wherever a `?back=` deep link points, falling back to
// the feed (same pattern as listing.html/telegram-account.js).
if (UyDosh.isMiniApp()) {
  const webApp = window.Telegram?.WebApp;
  webApp?.BackButton?.show();
  webApp?.BackButton?.onClick(() => {
    UyDosh.haptic.light();
    location.href = UyDosh.miniAppBackTargetFromUrl();
  });
}

const viewRootEl = document.getElementById('view-root');
const loadingEl = document.getElementById('loading');
const formRootEl = document.getElementById('form-root');
const footerEl = document.getElementById('profile-footer');

const tabButtons = Array.from(document.querySelectorAll('[data-profile-tab]'));
const tabBasicEl = document.getElementById('tab-basic');
const tabLifestyleEl = document.getElementById('tab-lifestyle');

const genderMaleBtn = document.getElementById('gender-male');
const genderFemaleBtn = document.getElementById('gender-female');
const profileLangSelectEl = document.getElementById('profile-lang-select');
const profileLangFlagEl = document.getElementById('profile-lang-flag');
const profileLangNameEl = document.getElementById('profile-lang-name');
const profileRoleSelectEl = document.getElementById('profile-role-select');
const profileRoleNameEl = document.getElementById('profile-role-name');
const regionSelectEl = document.getElementById('profile-region-select');
const regionNameEl = document.getElementById('profile-region-name');
const studentYesBtn = document.getElementById('student-yes');
const studentNoBtn = document.getElementById('student-no');
const universityFieldEl = document.getElementById('university-field');
const universitySearchEl = document.getElementById('university-search');
const universityListEl = document.getElementById('university-list');
const aboutMeInputEl = document.getElementById('about-me-input');
const nameInputEl = document.getElementById('name-input');
const lifestyleFieldsEl = document.getElementById('lifestyle-fields');
const lookingGenderChipsEl = document.getElementById('looking-gender-chips');
const lookingOverlapChipsEl = document.getElementById('looking-overlap-chips');
const lookingDealbreakerChipsEl = document.getElementById('looking-dealbreaker-chips');
const lookingPriorityChipsEl = document.getElementById('looking-priority-chips');
const birthYearInputEl = document.getElementById('birth-year-input');
const prefAgeMinInputEl = document.getElementById('pref-age-min-input');
const prefAgeMaxInputEl = document.getElementById('pref-age-max-input');
const budgetMinInputEl = document.getElementById('budget-min-input');
const budgetMaxInputEl = document.getElementById('budget-max-input');

const saveBtn = document.getElementById('save-btn');
const saveBtnLabel = document.getElementById('save-btn-label');
const saveBtnSpinner = document.getElementById('save-btn-spinner');


const TAB_BASIC = 'basic';
const TAB_LIFESTYLE = 'lifestyle';

const PROFILE_LANGS = [
  { id: 'uz', flag: '🇺🇿', native: "O'zbekcha" },
  { id: 'ru', flag: '🇷🇺', native: 'Русский' },
  { id: 'en', flag: '🇺🇸', native: 'English' },
];

function normalizeProfileLang(code) {
  const id = String(code || '').trim().toLowerCase();
  return PROFILE_LANGS.some((l) => l.id === id) ? id : UyDosh.getLang();
}

function profileLangMeta(code) {
  const id = normalizeProfileLang(code);
  return PROFILE_LANGS.find((l) => l.id === id) || PROFILE_LANGS[1];
}

function renderLanguageRow() {
  const meta = profileLangMeta(state.preferredLanguage);
  if (profileLangSelectEl) profileLangSelectEl.value = meta.id;
  if (profileLangFlagEl) profileLangFlagEl.textContent = meta.flag;
  if (profileLangNameEl) profileLangNameEl.textContent = meta.native;
}

const STAFF_ROLES = new Set(['admin', 'manager', 'moderator']);
const ROLE_LABEL_KEYS = {
  tenant: 'profile.roleTenant',
  landlord: 'profile.roleLandlord',
  admin: 'profile.roleAdmin',
  manager: 'profile.roleManager',
  moderator: 'profile.roleModerator',
};

function visibleProfileRole(role) {
  const id = String(role || '').trim().toLowerCase();
  if (id === 'admin' || id === 'manager' || id === 'moderator') return id;
  if (id === 'landlord' || id === 'service_provider') return 'landlord';
  return 'tenant';
}

function roleToSave(serverRole, selected) {
  if (serverRole === 'admin') return 'admin';
  if (serverRole === 'manager') return 'manager';
  if (serverRole === 'moderator') return 'moderator';
  if (serverRole === 'service_provider' && selected === 'landlord') return 'service_provider';
  if (serverRole === 'service_requester' && selected === 'tenant') return 'service_requester';
  return selected === 'landlord' ? 'landlord' : 'tenant';
}

function renderRoleRow() {
  if (!profileRoleSelectEl || !profileRoleNameEl) return;
  const staff = STAFF_ROLES.has(state.serverRole);
  const selected = staff ? state.serverRole : visibleProfileRole(state.selectedRole);
  const options = staff ? [state.serverRole] : ['landlord', 'tenant'];
  profileRoleSelectEl.innerHTML = options.map((id) => {
    const label = UyDosh.t(ROLE_LABEL_KEYS[id] || 'profile.roleTenant');
    return `<option value="${id}">${UyDosh.escapeHtml(label)}</option>`;
  }).join('');
  profileRoleSelectEl.value = selected;
  profileRoleSelectEl.disabled = staff;
  profileRoleNameEl.textContent = UyDosh.t(ROLE_LABEL_KEYS[selected] || 'profile.roleTenant');
}

// Mirrors the lifestyle fields on the Flutter app's edit-profile screen
// (`user_profiles` columns) — kept here as data so adding another field is
// just one more config entry instead of new bespoke markup/handlers.
const LIFESTYLE_FIELDS = [
  {
    key: 'employed',
    labelKey: 'profile.lifestyle.employed',
    options: [
      { value: true, labelKey: 'profile.lifestyle.employedYes', icon: 'checkCircle' },
      { value: false, labelKey: 'profile.lifestyle.employedNo', icon: 'xCircle' },
    ],
  },
  {
    key: 'wakeup_time',
    labelKey: 'profile.lifestyle.wakeupTime',
    icon: 'sun',
    options: [
      { value: 'morning', labelKey: 'profile.lifestyle.morning', icon: 'sun' },
      { value: 'evening', labelKey: 'profile.lifestyle.evening', icon: 'sunset' },
      { value: 'night', labelKey: 'profile.lifestyle.night', icon: 'moon' },
    ],
  },
  {
    key: 'sleep_time',
    labelKey: 'profile.lifestyle.sleepTime',
    icon: 'moon',
    options: [
      { value: 'morning', labelKey: 'profile.lifestyle.morning', icon: 'sun' },
      { value: 'evening', labelKey: 'profile.lifestyle.evening', icon: 'sunset' },
      { value: 'night', labelKey: 'profile.lifestyle.night', icon: 'moon' },
    ],
  },
  {
    key: 'cleanliness',
    labelKey: 'profile.lifestyle.cleanliness',
    // 1-5 scales render as a slider (see renderLifestyleFields) instead of
    // chips — the option list is still used to look up the current value's
    // label text shown below the track.
    type: 'scale',
    icon: 'sparkles',
    options: [
      { value: null, labelKey: 'profile.lifestyle.notSpecified' },
      { value: 1, labelKey: 'profile.lifestyle.veryMessy' },
      { value: 2, labelKey: 'profile.lifestyle.messy' },
      { value: 3, labelKey: 'profile.lifestyle.average' },
      { value: 4, labelKey: 'profile.lifestyle.clean' },
      { value: 5, labelKey: 'profile.lifestyle.veryClean' },
    ],
  },
  {
    key: 'noise_level',
    labelKey: 'profile.lifestyle.noiseLevel',
    type: 'scale',
    icon: 'volume',
    options: [
      { value: null, labelKey: 'profile.lifestyle.notSpecified' },
      { value: 1, labelKey: 'profile.lifestyle.veryQuiet' },
      { value: 2, labelKey: 'profile.lifestyle.quiet' },
      { value: 3, labelKey: 'profile.lifestyle.average' },
      { value: 4, labelKey: 'profile.lifestyle.loud' },
      { value: 5, labelKey: 'profile.lifestyle.veryLoud' },
    ],
  },
  {
    key: 'sociability',
    labelKey: 'profile.lifestyle.sociability',
    type: 'scale',
    icon: 'chatBubble',
    options: [
      { value: null, labelKey: 'profile.lifestyle.notSpecified' },
      { value: 1, labelKey: 'profile.lifestyle.veryIntroverted' },
      { value: 2, labelKey: 'profile.lifestyle.introverted' },
      { value: 3, labelKey: 'profile.lifestyle.balanced' },
      { value: 4, labelKey: 'profile.lifestyle.extroverted' },
      { value: 5, labelKey: 'profile.lifestyle.veryExtroverted' },
    ],
  },
  {
    key: 'guests_allowed',
    labelKey: 'profile.lifestyle.guestsAllowed',
    options: [
      { value: true, labelKey: 'profile.lifestyle.guestsYes', icon: 'users' },
      { value: false, labelKey: 'profile.lifestyle.guestsNo', icon: 'xCircle' },
    ],
  },
  {
    key: 'smoking_preference',
    labelKey: 'profile.lifestyle.smokingPreference',
    options: [
      { value: 'non-smoker', labelKey: 'profile.lifestyle.nonSmoker', icon: 'smokeFree' },
      { value: 'occasional', labelKey: 'profile.lifestyle.occasionalSmoker', icon: 'cigarette' },
      { value: 'regular', labelKey: 'profile.lifestyle.regularSmoker', icon: 'cigarette' },
    ],
  },
  {
    key: 'alcohol_preference',
    labelKey: 'profile.lifestyle.alcoholPreference',
    options: [
      { value: 'non-drinker', labelKey: 'profile.lifestyle.nonDrinker', icon: 'noDrink' },
      { value: 'occasional', labelKey: 'profile.lifestyle.occasionalDrinker', icon: 'wineGlass' },
      { value: 'regular', labelKey: 'profile.lifestyle.regularDrinker', icon: 'wineGlass' },
    ],
  },
  {
    key: 'cooking_habits',
    labelKey: 'profile.lifestyle.cookingHabits',
    options: [
      { value: true, labelKey: 'profile.lifestyle.cook', icon: 'cookingPot' },
      { value: false, labelKey: 'profile.lifestyle.dontCook', icon: 'takeout' },
    ],
  },
  {
    key: 'pets_preference',
    labelKey: 'profile.lifestyle.petsPreference',
    options: [
      { value: 'dont_like_pets', labelKey: 'profile.lifestyle.dontLikePets', icon: 'xCircle' },
      { value: 'like_pets', labelKey: 'profile.lifestyle.likePets', icon: 'heartOutline' },
      { value: 'have_cat', labelKey: 'profile.lifestyle.haveCat', icon: 'cat' },
      { value: 'have_dog', labelKey: 'profile.lifestyle.haveDog', icon: 'dog' },
    ],
  },
];

const state = {
  userId: null,
  readOnly: false,
  profile: null,
  authError: false,
  loadError: false,
  // Distinct from loadError: the user is authenticated but has no
  // `user_profiles` row yet. The backend now silently creates one on first
  // Mini App login (see `ensureTelegramMiniAppSession`/`telegramWebAppAuth`),
  // so this should only bite pre-existing sessions from before that change,
  // or edge cases — PUT /profiles/:userId can't create one, so we still
  // can't offer the form for those without a fresh login.
  noProfile: false,
  activeTab: TAB_BASIC,
  // null = not answered yet; 1/2 once the user (or existing data) answers.
  gender: null,
  regions: [],
  regionsError: false,
  selectedRegionId: null,
  // Not reflected in `render()` — the textarea's own value is the source of
  // truth once the user starts typing (see `bindEvents`), so re-rendering it
  // on every state change would reset the cursor position mid-edit.
  aboutMe: '',
  preferredLanguage: 'ru',
  serverRole: 'tenant',
  selectedRole: 'tenant',
  universities: [],
  universitiesError: false,
  // null = not answered yet, true/false once the user (or existing data) answers.
  isStudent: null,
  selectedUniversityId: null,
  searchQuery: '',
  displayName: '',
  // Guards the empty-result haptic burst in `renderUniversityList` so it fires once per
  // "typed into a no-match query" rather than again on every subsequent keystroke while
  // the result set stays empty.
  universitySearchEmptyHapticFired: false,
  // Keyed by LIFESTYLE_FIELDS[].key (snake_case, matching the API body directly).
  lifestyle: Object.fromEntries(LIFESTYLE_FIELDS.map((f) => [f.key, null])),
  looking: {
    prefRoommateGender: null,
    prefBudgetOverlapRequired: null,
    dealbreakers: new Set(),
    topPriorities: new Set(),
  },
  saving: false,
};

const MAX_TOP_PRIORITIES = 3;
const LOOKING_GENDER_OPTIONS = [
  { value: null, labelKey: 'profile.lifestyle.notSpecified' },
  { value: 'any', labelKey: 'profile.looking.anyGender' },
  { value: 'male', labelKey: 'profile.genderMale' },
  { value: 'female', labelKey: 'profile.genderFemale' },
];
const LOOKING_OVERLAP_OPTIONS = [
  { value: null, labelKey: 'profile.lifestyle.notSpecified' },
  { value: true, labelKey: 'profile.studentYes' },
  { value: false, labelKey: 'profile.studentNo' },
];
const DEALBREAKER_SLUGS = ['smoking', 'pets', 'cleanliness', 'noise', 'gender', 'age', 'budget', 'sleep'];
const PRIORITY_SLUGS = ['sleep', 'smoking', 'pets', 'cleanliness', 'noise', 'sociability', 'drinking', 'gender', 'age', 'budget'];
const MATCH_DIM_LABEL = {
  sleep: 'profile.looking.dimSleep',
  smoking: 'profile.lifestyle.smokingPreference',
  pets: 'profile.lifestyle.petsPreference',
  cleanliness: 'profile.lifestyle.cleanliness',
  noise: 'profile.lifestyle.noiseLevel',
  sociability: 'profile.lifestyle.sociability',
  drinking: 'profile.lifestyle.alcoholPreference',
  gender: 'compat.dimGender',
  age: 'compat.dimAge',
  budget: 'compat.dimBudget',
};

function slugSetFrom(raw) {
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.filter((s) => typeof s === 'string' && s));
}

function optionalIntFromInput(el) {
  const raw = String(el?.value || '').trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return NaN;
  return n;
}

function intOrEmpty(value) {
  return value == null || value === '' ? '' : String(value);
}

function lookingChipHtml(opts, current, attrName) {
  return opts.map((opt, i) => UyDosh.chipButtonHtml({
    attrs: { [attrName]: i },
    pressed: current === opt.value,
    label: UyDosh.t(opt.labelKey),
    labelWrap: false,
  })).join('');
}

function lookingMultiChipHtml(slugs, selected) {
  return slugs.map((slug) => UyDosh.chipButtonHtml({
    attrs: { 'data-match-slug': slug },
    pressed: selected.has(slug),
    label: UyDosh.t(MATCH_DIM_LABEL[slug] || slug),
    labelWrap: false,
  })).join('');
}

function renderLookingFor() {
  if (!lookingGenderChipsEl) return;
  lookingGenderChipsEl.innerHTML = lookingChipHtml(
    LOOKING_GENDER_OPTIONS,
    state.looking.prefRoommateGender,
    'data-looking-gender',
  );
  lookingOverlapChipsEl.innerHTML = lookingChipHtml(
    LOOKING_OVERLAP_OPTIONS,
    state.looking.prefBudgetOverlapRequired,
    'data-looking-overlap',
  );
  lookingDealbreakerChipsEl.innerHTML = lookingMultiChipHtml(
    DEALBREAKER_SLUGS,
    state.looking.dealbreakers,
  );
  lookingPriorityChipsEl.innerHTML = lookingMultiChipHtml(
    PRIORITY_SLUGS,
    state.looking.topPriorities,
  );
}

function showFormError(message) {
  if (!message) {
    UyDosh.hideToast?.();
    return;
  }
  UyDosh.showToast?.(message, 'error', { duration: 4500 });
}

function showFormWarning(message) {
  UyDosh.showToast?.(message, 'warning', { duration: 4000 });
}

function showFormSuccess(message) {
  UyDosh.showToast?.(message, 'success', { duration: 3000 });
}

function filteredUniversities(lang) {
  const query = state.searchQuery.trim().toLowerCase();
  const sorted = [...state.universities].sort((a, b) =>
    UyDosh.localized(a, lang).localeCompare(UyDosh.localized(b, lang), lang));
  if (!query) return sorted;
  return sorted.filter((u) => {
    const name = UyDosh.localized(u, lang).toLowerCase();
    const shortName = UyDosh.localizedShort(u, lang).toLowerCase();
    return name.includes(query) || shortName.includes(query);
  });
}

function universityById(id) {
  return state.universities.find((u) => Number(u.id) === Number(id)) || null;
}

// Regions are a short static list (Uzbekistan's ~14 provinces/republic/capital).
// One native <select> (same overlay-row pattern as language) instead of a
// chip grid, so the basic tab stays compact.

const CAPITAL_REGION_ID = 1;

function sortedRegions(lang) {
  return [...state.regions].sort((a, b) => {
    const aIsCapital = Number(a.id) === CAPITAL_REGION_ID;
    const bIsCapital = Number(b.id) === CAPITAL_REGION_ID;
    if (aIsCapital !== bIsCapital) return aIsCapital ? -1 : 1;
    return UyDosh.localizedShort(a, lang).localeCompare(UyDosh.localizedShort(b, lang), lang);
  });
}

function renderRegionList() {
  if (!regionSelectEl || !regionNameEl) return;
  const lang = UyDosh.getLang();
  const placeholder = UyDosh.t('profile.regionPlaceholder');
  if (state.regionsError) {
    regionNameEl.textContent = UyDosh.t('profile.errorLoad');
    regionNameEl.classList.add('is-placeholder');
    regionSelectEl.innerHTML = '';
    regionSelectEl.disabled = true;
    return;
  }
  regionSelectEl.disabled = false;
  const options = [`<option value="">${UyDosh.escapeHtml(placeholder)}</option>`]
    .concat(sortedRegions(lang).map((r) => {
      const id = Number(r.id);
      const label = UyDosh.titleCaseWords(UyDosh.localizedShort(r, lang));
      return `<option value="${id}">${UyDosh.escapeHtml(label)}</option>`;
    }));
  regionSelectEl.innerHTML = options.join('');
  const selected = state.selectedRegionId != null
    ? state.regions.find((r) => Number(r.id) === Number(state.selectedRegionId))
    : null;
  regionSelectEl.value = selected ? String(Number(selected.id)) : '';
  if (selected) {
    regionNameEl.textContent = UyDosh.titleCaseWords(UyDosh.localizedShort(selected, lang));
    regionNameEl.classList.remove('is-placeholder');
  } else {
    regionNameEl.textContent = placeholder;
    regionNameEl.classList.add('is-placeholder');
  }
}

function renderUniversityList() {
  if (state.universitiesError) {
    universityListEl.innerHTML = `<div class="station-list-empty">${UyDosh.escapeHtml(UyDosh.t('profile.errorLoad'))}</div>`;
    return;
  }
  const lang = UyDosh.getLang();
  const items = filteredUniversities(lang);
  if (items.length === 0) {
    universityListEl.innerHTML = `<div class="station-list-empty">${UyDosh.escapeHtml(UyDosh.t('profile.universityNotFound'))}</div>`;
    if (!state.universitySearchEmptyHapticFired) {
      state.universitySearchEmptyHapticFired = true;
      UyDosh.haptic.notFound();
    }
    return;
  }
  state.universitySearchEmptyHapticFired = false;
  universityListEl.innerHTML = items.map((u) => {
    const id = Number(u.id);
    const pressed = Number(state.selectedUniversityId) === id;
    return `
      <button type="button" class="station-item" data-university-id="${id}" data-haptic="selection" aria-pressed="${pressed ? 'true' : 'false'}">
        ${UyDosh.escapeHtml(UyDosh.titleCaseWords(UyDosh.localized(u, lang)))}
      </button>`;
  }).join('');
}

function closeUniversitySuggestions() {
  universityListEl.hidden = true;
  universityListEl.innerHTML = '';
  state.universitySearchEmptyHapticFired = false;
}

function scaleValueLabel(field, value) {
  const opt = field.options.find((o) => o.value === value);
  return UyDosh.t(opt ? opt.labelKey : 'profile.lifestyle.notSpecified');
}

/**
 * Renders the lifestyle fields (chips or, for 1-5 scales, sliders) into
 * `#lifestyle-fields` from scratch. Called once on boot (the field/option
 * set never changes) and again after any chip is clicked, so `aria-pressed`
 * reflects the new value. Slider drags update in place instead (see
 * `bindEvents`) to avoid rebuilding the DOM node mid-drag.
 */
function fieldLabelHtml(field) {
  const icon = field.icon ? `<span class="field-label-icon" aria-hidden="true">${UyDosh.iconChrome(field.icon)}</span>` : '';
  return `${icon}${UyDosh.escapeHtml(UyDosh.t(field.labelKey))}`;
}

function chipIconHtml(icon) {
  return icon ? `<span class="chip-icon" aria-hidden="true">${UyDosh.iconChrome(icon)}</span>` : '';
}

function renderLifestyleFields() {
  lifestyleFieldsEl.innerHTML = LIFESTYLE_FIELDS.map((field) => {
    const current = state.lifestyle[field.key];

    if (field.type === 'scale') {
      const scaleOptions = field.options.filter((opt) => opt.value !== null);
      const min = scaleOptions[0].value;
      const max = scaleOptions[scaleOptions.length - 1].value;
      // The track always shows a real position (defaults to the minimum) —
      // "not specified" is only true until the user actually drags it, at
      // which point it becomes a real answer (matches the Flutter slider).
      const sliderValue = current ?? min;
      const ticks = scaleOptions.map(() => '<span class="lifestyle-slider-tick"></span>').join('');
      return `
        <div class="field">
          <div class="field-label">${fieldLabelHtml(field)}</div>
          <div class="lifestyle-slider-wrap">
            <input
              type="range"
              class="lifestyle-slider"
              min="${min}"
              max="${max}"
              step="1"
              value="${sliderValue}"
              data-lifestyle-slider="${field.key}"
            />
            <div class="lifestyle-slider-ticks" aria-hidden="true">${ticks}</div>
          </div>
          <div class="lifestyle-slider-value" data-lifestyle-value-for="${field.key}">
            ${UyDosh.escapeHtml(scaleValueLabel(field, current))}
          </div>
        </div>`;
    }

    const chips = field.options.map((opt, i) => UyDosh.chipButtonHtml({
      attrs: { 'data-lifestyle-key': field.key, 'data-option-index': i },
      pressed: current === opt.value,
      icon: chipIconHtml(opt.icon),
      label: UyDosh.t(opt.labelKey),
      labelWrap: false,
    })).join('');
    return `
      <div class="field">
        <div class="field-label">${fieldLabelHtml(field)}</div>
        <div class="chips">${chips}</div>
      </div>`;
  }).join('');
}

function setActiveTab(tab) {
  if (state.activeTab === tab) return;
  state.activeTab = tab;
  for (const btn of tabButtons) {
    btn.setAttribute('aria-selected', btn.getAttribute('data-profile-tab') === tab ? 'true' : 'false');
  }
  tabBasicEl.hidden = tab !== TAB_BASIC;
  tabLifestyleEl.hidden = tab !== TAB_LIFESTYLE;
}

function render() {
  const lang = UyDosh.getLang();

  genderMaleBtn.setAttribute('aria-pressed', state.gender === 1 ? 'true' : 'false');
  genderFemaleBtn.setAttribute('aria-pressed', state.gender === 2 ? 'true' : 'false');

  renderRegionList();

  studentYesBtn.setAttribute('aria-pressed', state.isStudent === true ? 'true' : 'false');
  studentNoBtn.setAttribute('aria-pressed', state.isStudent === false ? 'true' : 'false');

  const showUniversityField = state.isStudent === true;
  universityFieldEl.hidden = !showUniversityField;

  if (showUniversityField) {
    const selected = state.selectedUniversityId != null ? universityById(state.selectedUniversityId) : null;
    const wrap = universitySearchEl?.closest('.university-search-wrap');
    if (selected && !state.searchQuery.trim()) {
      const label = UyDosh.titleCaseWords(UyDosh.localized(selected, lang));
      if (universitySearchEl && document.activeElement !== universitySearchEl) {
        universitySearchEl.value = label;
      }
      wrap?.classList.add('is-picked');
    } else if (!state.searchQuery.trim()) {
      if (universitySearchEl && document.activeElement !== universitySearchEl) {
        universitySearchEl.value = '';
      }
      wrap?.classList.remove('is-picked');
    } else {
      wrap?.classList.remove('is-picked');
    }
    if (state.searchQuery.trim()) {
      universityListEl.hidden = false;
      renderUniversityList();
    } else {
      closeUniversitySuggestions();
    }
  }

  if (state.activeTab === TAB_LIFESTYLE) {
    renderLifestyleFields();
    renderLookingFor();
  }

  renderLanguageRow();
  renderRoleRow();

  saveBtn.disabled = state.saving;
  saveBtnLabel.textContent = state.saving ? UyDosh.t('profile.saving') : UyDosh.t('profile.save');
  saveBtnSpinner.hidden = !state.saving;
}

function bindEvents() {
  for (const btn of tabButtons) {
    btn.addEventListener('click', () => {
      setActiveTab(btn.getAttribute('data-profile-tab'));
      render();
    });
  }

  lifestyleFieldsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-lifestyle-key]');
    if (!btn) return;
    const field = LIFESTYLE_FIELDS.find((f) => f.key === btn.getAttribute('data-lifestyle-key'));
    const option = field?.options[Number(btn.getAttribute('data-option-index'))];
    if (!field || !option) return;
    state.lifestyle[field.key] = option.value;
    showFormError('');
    render();
  });

  // Sliders update the value text in place instead of calling render() on
  // every 'input' tick — replacing the <input type="range"> DOM node
  // mid-drag would kill the browser's native pointer-capture, making the
  // handle jump around while dragging (see the same pattern in create.html).
  lifestyleFieldsEl.addEventListener('input', (e) => {
    const slider = e.target.closest('[data-lifestyle-slider]');
    if (!slider) return;
    const field = LIFESTYLE_FIELDS.find((f) => f.key === slider.getAttribute('data-lifestyle-slider'));
    if (!field) return;
    const value = Number(slider.value);
    state.lifestyle[field.key] = value;
    const valueEl = lifestyleFieldsEl.querySelector(`[data-lifestyle-value-for="${field.key}"]`);
    if (valueEl) valueEl.textContent = scaleValueLabel(field, value);
    showFormError('');
  });

  genderMaleBtn.addEventListener('click', () => {
    if (state.gender === 1) return;
    state.gender = 1;
    showFormError('');
    render();
  });

  genderFemaleBtn.addEventListener('click', () => {
    if (state.gender === 2) return;
    state.gender = 2;
    showFormError('');
    render();
  });

  regionSelectEl?.addEventListener('change', () => {
    const raw = regionSelectEl.value;
    const id = raw === '' ? null : Number(raw);
    if (id != null && !Number.isFinite(id)) return;
    if (state.selectedRegionId === id) return;
    state.selectedRegionId = id;
    showFormError('');
    render();
  });

  // Free-text field — updates state directly on every keystroke instead of
  // going through render(), which would reset the textarea's value/cursor
  // position mid-edit (nothing else in the UI depends on `state.aboutMe`).
  aboutMeInputEl.addEventListener('input', () => {
    state.aboutMe = aboutMeInputEl.value;
    showFormError('');
  });

  nameInputEl?.addEventListener('input', () => {
    state.displayName = nameInputEl.value;
    showFormError('');
  });

  lookingGenderChipsEl?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-looking-gender]');
    if (!btn) return;
    const option = LOOKING_GENDER_OPTIONS[Number(btn.getAttribute('data-looking-gender'))];
    if (!option) return;
    state.looking.prefRoommateGender = option.value;
    showFormError('');
    renderLookingFor();
  });

  lookingOverlapChipsEl?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-looking-overlap]');
    if (!btn) return;
    const option = LOOKING_OVERLAP_OPTIONS[Number(btn.getAttribute('data-looking-overlap'))];
    if (!option) return;
    state.looking.prefBudgetOverlapRequired = option.value;
    showFormError('');
    renderLookingFor();
  });

  lookingDealbreakerChipsEl?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-match-slug]');
    if (!btn) return;
    const slug = btn.getAttribute('data-match-slug');
    const next = new Set(state.looking.dealbreakers);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    state.looking.dealbreakers = next;
    showFormError('');
    renderLookingFor();
  });

  lookingPriorityChipsEl?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-match-slug]');
    if (!btn) return;
    const slug = btn.getAttribute('data-match-slug');
    const next = new Set(state.looking.topPriorities);
    if (next.has(slug)) {
      next.delete(slug);
    } else if (next.size >= MAX_TOP_PRIORITIES) {
      showFormWarning(UyDosh.t('profile.looking.prioritiesHint'));
      return;
    } else {
      next.add(slug);
    }
    state.looking.topPriorities = next;
    showFormError('');
    renderLookingFor();
  });

  profileLangSelectEl?.addEventListener('change', () => {
    const next = normalizeProfileLang(profileLangSelectEl.value);
    if (next === state.preferredLanguage) return;
    state.preferredLanguage = next;
    UyDosh.setLang(next);
    showFormError('');
    renderLanguageRow();
  });

  profileRoleSelectEl?.addEventListener('change', () => {
    const next = visibleProfileRole(profileRoleSelectEl.value);
    if (next === state.selectedRole) return;
    state.selectedRole = next;
    showFormError('');
    renderRoleRow();
  });

  studentYesBtn.addEventListener('click', () => {
    if (state.isStudent === true) return;
    state.isStudent = true;
    showFormError('');
    render();
  });

  studentNoBtn.addEventListener('click', () => {
    if (state.isStudent === false) return;
    state.isStudent = false;
    state.selectedUniversityId = null;
    state.searchQuery = '';
    universitySearchEl.value = '';
    showFormError('');
    render();
  });

  universitySearchEl.addEventListener('input', () => {
    state.searchQuery = universitySearchEl.value || '';
    universitySearchEl.closest('.university-search-wrap')?.classList.remove('is-picked');
    if (state.searchQuery.trim()) {
      universityListEl.hidden = false;
      renderUniversityList();
    } else {
      closeUniversitySuggestions();
    }
  });

  universitySearchEl.addEventListener('focus', () => {
    if (state.selectedUniversityId != null && !state.searchQuery.trim()) {
      universitySearchEl.select();
    }
  });

  universityListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-university-id]');
    if (!btn) return;
    state.selectedUniversityId = Number(btn.getAttribute('data-university-id'));
    state.searchQuery = '';
    showFormError('');
    render();
  });

  saveBtn.addEventListener('click', onSave);
}

async function onSave() {
  if (state.saving) return;

  if (state.isStudent === null) {
    showFormError(UyDosh.t('profile.errorStudentRequired'));
    return;
  }
  if (state.isStudent === true && !state.selectedUniversityId) {
    showFormError(UyDosh.t('profile.universityNotSelected'));
    return;
  }

  const name = String(state.displayName || '').trim();
  if (!name) {
    setActiveTab(TAB_BASIC);
    showFormError(UyDosh.t('profile.errorNameRequired'));
    render();
    return;
  }

  const birthYear = optionalIntFromInput(birthYearInputEl);
  const prefAgeMin = optionalIntFromInput(prefAgeMinInputEl);
  const prefAgeMax = optionalIntFromInput(prefAgeMaxInputEl);
  const budgetMin = optionalIntFromInput(budgetMinInputEl);
  const budgetMax = optionalIntFromInput(budgetMaxInputEl);
  const lookingInts = [birthYear, prefAgeMin, prefAgeMax, budgetMin, budgetMax];
  const lookingInvalid = lookingInts.some((n) => Number.isNaN(n))
    || (birthYear != null && (birthYear < 1900 || birthYear > 2100))
    || (prefAgeMin != null && (prefAgeMin < 0 || prefAgeMin > 120))
    || (prefAgeMax != null && (prefAgeMax < 0 || prefAgeMax > 120))
    || (prefAgeMin != null && prefAgeMax != null && prefAgeMin > prefAgeMax)
    || (budgetMin != null && (budgetMin < 0 || budgetMin > 100000000))
    || (budgetMax != null && (budgetMax < 0 || budgetMax > 100000000))
    || (budgetMin != null && budgetMax != null && budgetMin > budgetMax);
  if (lookingInvalid) {
    setActiveTab(TAB_LIFESTYLE);
    showFormError(UyDosh.t('profile.errorLookingNumbers'));
    render();
    return;
  }

  showFormError('');
  state.saving = true;
  render();

  const body = {
    ...(state.isStudent
      ? { university_id: state.selectedUniversityId }
      // `0` (not null/undefined) is what actually clears university_id server-side.
      : { university_id: 0 }),
    // Gender/region are optional and have no "not specified" chip — only
    // send them once the user (or existing data) has actually picked one,
    // so an untouched field never overwrites a value set elsewhere (e.g.
    // the Flutter app) with a clear.
    ...(state.gender != null ? { gender: state.gender } : {}),
    ...(state.selectedRegionId != null ? { region_id: state.selectedRegionId } : {}),
    about_me: state.aboutMe.trim(),
    name,
    preferred_language: normalizeProfileLang(state.preferredLanguage),
    ...(!STAFF_ROLES.has(state.serverRole)
      ? { role: roleToSave(state.serverRole, state.selectedRole) }
      : {}),
    ...state.lifestyle,
    birth_year: birthYear,
    pref_age_min: prefAgeMin,
    pref_age_max: prefAgeMax,
    budget_min: budgetMin,
    budget_max: budgetMax,
    pref_roommate_gender: state.looking.prefRoommateGender,
    pref_budget_overlap_required: state.looking.prefBudgetOverlapRequired,
    dealbreakers: [...state.looking.dealbreakers],
    top_priorities: [...state.looking.topPriorities],
  };

  try {
    await UyDosh.updateProfile(state.userId, body);
    if (!STAFF_ROLES.has(state.serverRole)) {
      const saved = roleToSave(state.serverRole, state.selectedRole);
      state.serverRole = saved;
      state.selectedRole = visibleProfileRole(saved);
      UyDosh.setSessionUserRole?.(saved);
    }
    // Either answer ("student" + university, or "not a student") counts as
    // having engaged with the prompt — don't keep nudging on the feed, and
    // the account menu's "profile not populated" dot no longer applies.
    UyDosh.dismissProfileNudge?.();
    UyDosh.hideProfileMenuBadge?.();
    UyDosh.haptic.success();
    showFormSuccess(UyDosh.t('profile.saved'));
  } catch (err) {
    console.error('Failed to save profile', err);
    UyDosh.haptic.error();
    if (err?.status === 401) {
      UyDosh.clearTelegramInitData();
      showFormError(UyDosh.t('profile.errorAuth'));
    } else {
      showFormError(UyDosh.t('profile.errorSave'));
    }
  } finally {
    state.saving = false;
    render();
  }
}

async function loadUniversities() {
  try {
    const data = await UyDosh.fetchUniversitiesAll(UyDosh.getLang());
    state.universities = Array.isArray(data?.universities) ? data.universities : [];
  } catch (err) {
    console.error('Failed to load universities', err);
    state.universitiesError = true;
  }
}

async function loadRegions() {
  try {
    const data = await UyDosh.fetchRegionsAll(UyDosh.getLang());
    state.regions = Array.isArray(data?.regions) ? data.regions : [];
  } catch (err) {
    console.error('Failed to load regions', err);
    state.regionsError = true;
  }
}

async function loadProfile() {
  try {
    const profile = await UyDosh.fetchProfile(state.userId);
    state.profile = profile;
    const universityId = profile?.university_id != null ? Number(profile.university_id) : null;
    state.isStudent = universityId != null ? true : null;
    state.selectedUniversityId = universityId;
    state.gender = profile?.gender === 1 || profile?.gender === 2 ? profile.gender : null;
    state.selectedRegionId = profile?.region_id != null ? Number(profile.region_id) : null;
    state.aboutMe = profile?.about_me ?? '';
    state.displayName = String(profile?.name || '').trim();
    if (!state.displayName) {
      const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
      const fromTg = [tgUser?.first_name, tgUser?.last_name].filter(Boolean).join(' ').trim()
        || String(tgUser?.username || '').trim();
      if (fromTg) state.displayName = fromTg;
    }
    state.preferredLanguage = normalizeProfileLang(profile?.preferred_language || UyDosh.getLang());
    state.serverRole = String(UyDosh.getSessionUserRole?.() || profile?.role || 'tenant').toLowerCase();
    state.selectedRole = visibleProfileRole(state.serverRole);
    for (const field of LIFESTYLE_FIELDS) {
      const raw = profile?.[field.key];
      state.lifestyle[field.key] = raw === undefined ? null : raw;
    }
    const genderPref = profile?.pref_roommate_gender;
    state.looking.prefRoommateGender = genderPref === 'any' || genderPref === 'male' || genderPref === 'female'
      ? genderPref
      : null;
    const overlap = profile?.pref_budget_overlap_required;
    state.looking.prefBudgetOverlapRequired = overlap === true || overlap === false ? overlap : null;
    state.looking.dealbreakers = slugSetFrom(profile?.dealbreakers);
    state.looking.topPriorities = slugSetFrom(profile?.top_priorities);
  } catch (err) {
    if (err?.status === 404) {
      state.noProfile = true;
      return;
    }
    console.error('Failed to load profile', err);
    state.loadError = true;
  }
}

function viewUserIdFromUrl() {
  try {
    const raw = new URLSearchParams(window.location.search).get('user');
    const id = Number(raw);
    return Number.isFinite(id) && id > 0 ? id : 0;
  } catch {
    return 0;
  }
}

function lifestyleFieldValueLabel(field, value, lang) {
  if (!field || value == null || value === '') return '';
  const match = field.options.find((opt) => opt.value === value
    || (typeof opt.value === 'number' && Number(value) === opt.value)
    || String(opt.value) === String(value));
  if (!match || match.value == null) return '';
  return UyDosh.t(match.labelKey, lang);
}

function viewRowHtml({ icon, iconClass, label, value }) {
  if (!value) return '';
  return `
    <div class="pv-row">
      <span class="pv-icon${iconClass ? ` ${iconClass}` : ''}" aria-hidden="true">${UyDosh.iconChrome?.(icon) || ''}</span>
      <div class="pv-text">
        <div class="pv-label">${UyDosh.escapeHtml(label)}</div>
        <div class="pv-value">${UyDosh.escapeHtml(value)}</div>
      </div>
    </div>`;
}

function renderReadOnlyProfile() {
  const lang = UyDosh.getLang();
  const profile = state.profile || {};
  const name = String(profile.name || '').trim();
  const avatarUrl = profile.avatar_url || profile.telegram_avatar_url || '';
  const avatarInner = avatarUrl
    ? `<img src="${UyDosh.escapeHtml(avatarUrl)}" alt="" referrerpolicy="no-referrer" onerror="this.remove();" />`
    : (UyDosh.iconChrome?.('person') || '');
  const genderValue = profile.gender === 1
    ? UyDosh.t('profile.genderMale', lang)
    : profile.gender === 2
      ? UyDosh.t('profile.genderFemale', lang)
      : '';
  const genderIconClass = profile.gender === 1 ? 'is-male' : profile.gender === 2 ? 'is-female' : '';
  const region = state.regions.find((r) => Number(r.id) === Number(profile.region_id));
  const regionName = region ? (UyDosh.localized(region, lang) || region.name || '') : '';
  const university = state.universities.find((u) => Number(u.id) === Number(profile.university_id));
  const universityName = university ? (UyDosh.localized(university, lang) || university.name || '') : '';
  const langMeta = profileLangMeta(profile.preferred_language);
  const langValue = `${langMeta.flag} ${langMeta.native}`;
  const about = String(profile.about_me || '').trim();

  const employedField = LIFESTYLE_FIELDS.find((f) => f.key === 'employed');
  const wakeField = LIFESTYLE_FIELDS.find((f) => f.key === 'wakeup_time');
  const sleepField = LIFESTYLE_FIELDS.find((f) => f.key === 'sleep_time');
  const cleanField = LIFESTYLE_FIELDS.find((f) => f.key === 'cleanliness');
  const employedLabel = lifestyleFieldValueLabel(employedField, profile.employed, lang);
  const employedShort = profile.employed === true
    ? UyDosh.t('profile.studentYes', lang)
    : profile.employed === false
      ? UyDosh.t('profile.studentNo', lang)
      : employedLabel;
  const wakeLabel = lifestyleFieldValueLabel(wakeField, profile.wakeup_time, lang);
  const sleepLabel = lifestyleFieldValueLabel(sleepField, profile.sleep_time, lang);
  const cleanLabel = lifestyleFieldValueLabel(cleanField, profile.cleanliness, lang);

  const basicRows = [
    viewRowHtml({ icon: 'person', label: UyDosh.t('profile.nameOrNickname', lang), value: name }),
    viewRowHtml({
      icon: 'person',
      iconClass: genderIconClass,
      label: UyDosh.t('profile.gender', lang),
      value: genderValue,
    }),
    viewRowHtml({
      icon: 'mapPin',
      iconClass: 'is-pin',
      label: UyDosh.t('profile.district', lang),
      value: regionName,
    }),
    viewRowHtml({ icon: 'graduationCap', label: UyDosh.t('profile.universityLabel', lang), value: universityName }),
    viewRowHtml({ icon: 'globe', label: UyDosh.t('profile.language', lang), value: langValue }),
    viewRowHtml({ icon: 'alertCircle', label: UyDosh.t('profile.aboutMe', lang), value: about }),
  ].join('');

  const roommateGenderLabel = profile.pref_roommate_gender === 'any'
    ? UyDosh.t('profile.looking.anyGender', lang)
    : profile.pref_roommate_gender === 'male'
      ? UyDosh.t('profile.genderMale', lang)
      : profile.pref_roommate_gender === 'female'
        ? UyDosh.t('profile.genderFemale', lang)
        : '';
  const overlapLabel = profile.pref_budget_overlap_required === true
    ? UyDosh.t('profile.studentYes', lang)
    : profile.pref_budget_overlap_required === false
      ? UyDosh.t('profile.studentNo', lang)
      : '';
  const dimList = (slugs) => Array.isArray(slugs) && slugs.length
    ? slugs.map((s) => UyDosh.t(MATCH_DIM_LABEL[s] || s, lang)).join(', ')
    : '';
  const ageRange = [profile.pref_age_min, profile.pref_age_max].every((n) => n == null)
    ? ''
    : `${profile.pref_age_min ?? '—'}–${profile.pref_age_max ?? '—'}`;
  const budgetRange = [profile.budget_min, profile.budget_max].every((n) => n == null)
    ? ''
    : `${profile.budget_min ?? '—'}–${profile.budget_max ?? '—'}`;

  const lookingRows = [
    viewRowHtml({ icon: 'person', label: UyDosh.t('profile.looking.roommateGender', lang), value: roommateGenderLabel }),
    viewRowHtml({ icon: 'cake', label: UyDosh.t('profile.looking.birthYear', lang), value: profile.birth_year ? String(profile.birth_year) : '' }),
    viewRowHtml({ icon: 'cake', label: UyDosh.t('profile.looking.ageRange', lang), value: ageRange }),
    viewRowHtml({ icon: 'wallet', label: UyDosh.t('profile.looking.budgetRange', lang), value: budgetRange }),
    viewRowHtml({ icon: 'wallet', label: UyDosh.t('profile.looking.budgetOverlap', lang), value: overlapLabel }),
    viewRowHtml({ icon: 'xCircle', label: UyDosh.t('profile.looking.dealbreakers', lang), value: dimList(profile.dealbreakers) }),
    viewRowHtml({ icon: 'sparkles', label: UyDosh.t('profile.looking.priorities', lang), value: dimList(profile.top_priorities) }),
  ].join('');

  const lifeRows = [
    viewRowHtml({ icon: 'checkCircle', label: UyDosh.t('profile.work', lang), value: employedShort }),
    `<div class="pv-grid">${
      viewRowHtml({ icon: 'sun', label: UyDosh.t('profile.lifestyle.wakeupTime', lang), value: wakeLabel })
      + viewRowHtml({ icon: 'moon', label: UyDosh.t('profile.lifestyle.sleepTime', lang), value: sleepLabel })
    }</div>`,
    viewRowHtml({ icon: 'sparkles', label: UyDosh.t('profile.lifestyle.cleanliness', lang), value: cleanLabel }),
  ].join('');

  viewRootEl.innerHTML = `
    <div class="pv-avatar-wrap"><div class="pv-avatar">${avatarInner}</div></div>
    <div class="pv-card">${basicRows}</div>
    <div class="pv-card-title">${UyDosh.escapeHtml(UyDosh.t('profile.tabs.lifestyle', lang))}</div>
    <div class="pv-card">${lifeRows}</div>
    <div class="pv-card-title">${UyDosh.escapeHtml(UyDosh.t('profile.looking.title', lang))}</div>
    <div class="pv-card">${lookingRows}</div>`;
}

function showReadOnlyProfile() {
  document.body.classList.add('profile-readonly');
  loadingEl.hidden = true;
  formRootEl.hidden = true;
  footerEl.hidden = true;
  viewRootEl.hidden = false;
  renderReadOnlyProfile();
}

function renderNoProfileState() {
  const lang = UyDosh.getLang();
  loadingEl.innerHTML = `
    <div>
      <p>${UyDosh.escapeHtml(UyDosh.t('profile.noProfileYet', lang))}</p>
      <a class="status-cta" href="${UyDosh.MINI_APP_CREATE_PATH}">${UyDosh.escapeHtml(UyDosh.t('profile.noProfileCta', lang))}</a>
    </div>`;
}

async function boot() {
  UyDosh.applyI18n();
  document.addEventListener('uydosh:langchange', () => {
    UyDosh.applyI18n();
    if (state.readOnly) renderReadOnlyProfile();
    else render();
  });

  const viewUserId = viewUserIdFromUrl();
  state.readOnly = viewUserId > 0;

  if (!state.readOnly) {
    const sessionReady = await UyDosh.ensureTelegramMiniAppSession();
    if (!sessionReady) {
      state.authError = true;
      loadingEl.classList.add('error');
      loadingEl.textContent = UyDosh.t('profile.errorAuth');
      return;
    }
    state.userId = UyDosh.getSessionUserId();
    if (!state.userId) {
      state.authError = true;
      loadingEl.classList.add('error');
      loadingEl.textContent = UyDosh.t('profile.errorAuth');
      return;
    }
  } else {
    state.userId = viewUserId;
    await UyDosh.ensureTelegramMiniAppSession();
  }

  await Promise.all([loadProfile(), loadUniversities(), loadRegions()]);

  if (state.noProfile) {
    renderNoProfileState();
    return;
  }

  if (state.loadError) {
    loadingEl.classList.add('error');
    loadingEl.textContent = UyDosh.t('profile.errorLoad');
    return;
  }

  if (state.readOnly) {
    showReadOnlyProfile();
    return;
  }

  if (!aboutMeInputEl) {
    loadingEl.classList.add('error');
    loadingEl.textContent = UyDosh.t('profile.errorLoad');
    return;
  }

  aboutMeInputEl.value = state.aboutMe;
  if (nameInputEl) nameInputEl.value = state.displayName;
  if (birthYearInputEl) birthYearInputEl.value = intOrEmpty(state.profile?.birth_year);
  if (prefAgeMinInputEl) prefAgeMinInputEl.value = intOrEmpty(state.profile?.pref_age_min);
  if (prefAgeMaxInputEl) prefAgeMaxInputEl.value = intOrEmpty(state.profile?.pref_age_max);
  if (budgetMinInputEl) budgetMinInputEl.value = intOrEmpty(state.profile?.budget_min);
  if (budgetMaxInputEl) budgetMaxInputEl.value = intOrEmpty(state.profile?.budget_max);

  loadingEl.hidden = true;
  formRootEl.hidden = false;
  footerEl.hidden = false;
  bindEvents();
  render();
}

boot().catch((err) => {
  console.error('Profile page failed to start', err);
  if (loadingEl) {
    loadingEl.classList.add('error');
    loadingEl.textContent = UyDosh.t('profile.errorLoad');
  }
});
