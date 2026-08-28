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

const loadingEl = document.getElementById('loading');
const formRootEl = document.getElementById('form-root');
const footerEl = document.getElementById('profile-footer');
const formErrorEl = document.getElementById('form-error');
const formSuccessEl = document.getElementById('form-success');

const tabButtons = Array.from(document.querySelectorAll('[data-profile-tab]'));
const tabBasicEl = document.getElementById('tab-basic');
const tabLifestyleEl = document.getElementById('tab-lifestyle');

const genderMaleBtn = document.getElementById('gender-male');
const genderFemaleBtn = document.getElementById('gender-female');
const profileLangSelectEl = document.getElementById('profile-lang-select');
const profileLangFlagEl = document.getElementById('profile-lang-flag');
const profileLangNameEl = document.getElementById('profile-lang-name');
const regionListEl = document.getElementById('region-list');
const studentYesBtn = document.getElementById('student-yes');
const studentNoBtn = document.getElementById('student-no');
const universityFieldEl = document.getElementById('university-field');
const universityPickedEl = document.getElementById('university-picked');
const universityPickedNameEl = document.getElementById('university-picked-name');
const universitySearchEl = document.getElementById('university-search');
const universityListEl = document.getElementById('university-list');
const aboutMeInputEl = document.getElementById('about-me-input');
const lifestyleFieldsEl = document.getElementById('lifestyle-fields');

const saveBtn = document.getElementById('save-btn');
const saveBtnLabel = document.getElementById('save-btn-label');
const saveBtnSpinner = document.getElementById('save-btn-spinner');

let successTimer = null;

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
  universities: [],
  universitiesError: false,
  // null = not answered yet, true/false once the user (or existing data) answers.
  isStudent: null,
  selectedUniversityId: null,
  searchQuery: '',
  // Guards the empty-result haptic burst in `renderUniversityList` so it fires once per
  // "typed into a no-match query" rather than again on every subsequent keystroke while
  // the result set stays empty.
  universitySearchEmptyHapticFired: false,
  // Keyed by LIFESTYLE_FIELDS[].key (snake_case, matching the API body directly).
  lifestyle: Object.fromEntries(LIFESTYLE_FIELDS.map((f) => [f.key, null])),
  saving: false,
};

function showFormError(message) {
  if (!message) {
    formErrorEl.hidden = true;
    formErrorEl.textContent = '';
    return;
  }
  formSuccessEl.hidden = true;
  formErrorEl.textContent = message;
  formErrorEl.hidden = false;
}

function showFormSuccess(message) {
  window.clearTimeout(successTimer);
  formErrorEl.hidden = true;
  formSuccessEl.textContent = message;
  formSuccessEl.hidden = false;
  successTimer = window.setTimeout(() => {
    formSuccessEl.hidden = true;
  }, 3000);
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

// Regions are a short static list (Uzbekistan's ~14 provinces/republic/capital),
// so — unlike the university field — they render as one always-visible chip
// grid instead of a type-to-filter autosuggest.
//
// Tashkent City (id 1) is pinned first as the capital, ahead of the
// alphabetical ordering used for the rest.
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
  if (state.regionsError) {
    regionListEl.innerHTML = `<div class="station-list-empty">${UyDosh.escapeHtml(UyDosh.t('profile.errorLoad'))}</div>`;
    return;
  }
  const lang = UyDosh.getLang();
  regionListEl.innerHTML = sortedRegions(lang).map((r) => {
    const id = Number(r.id);
    return UyDosh.chipButtonHtml({
      attrs: { 'data-region-id': id },
      pressed: Number(state.selectedRegionId) === id,
      label: UyDosh.titleCaseWords(UyDosh.localizedShort(r, lang)),
      labelWrap: false,
    });
  }).join('');
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
    if (selected) {
      universityPickedEl.hidden = false;
      universityPickedNameEl.textContent = UyDosh.titleCaseWords(UyDosh.localized(selected, lang));
    } else {
      universityPickedEl.hidden = true;
    }
    // Autosuggest: the match list only appears once the user types something
    // (see `universitySearchEl` input handler) — it never shows as a
    // permanently-visible full list.
    if (state.searchQuery.trim()) {
      universityListEl.hidden = false;
      renderUniversityList();
    } else {
      closeUniversitySuggestions();
    }
  }

  if (state.activeTab === TAB_LIFESTYLE) renderLifestyleFields();

  renderLanguageRow();

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

  regionListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-region-id]');
    if (!btn) return;
    const id = Number(btn.getAttribute('data-region-id'));
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

  profileLangSelectEl?.addEventListener('change', () => {
    const next = normalizeProfileLang(profileLangSelectEl.value);
    if (next === state.preferredLanguage) return;
    state.preferredLanguage = next;
    UyDosh.setLang(next);
    showFormError('');
    renderLanguageRow();
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
    if (state.searchQuery.trim()) {
      universityListEl.hidden = false;
      renderUniversityList();
    } else {
      closeUniversitySuggestions();
    }
  });

  universityListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-university-id]');
    if (!btn) return;
    state.selectedUniversityId = Number(btn.getAttribute('data-university-id'));
    // Selecting a suggestion closes the dropdown and clears the search box,
    // matching a typical autosuggest field — the picked banner above shows
    // the final choice instead.
    state.searchQuery = '';
    universitySearchEl.value = '';
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
    preferred_language: normalizeProfileLang(state.preferredLanguage),
    ...state.lifestyle,
  };

  try {
    await UyDosh.updateProfile(state.userId, body);
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
    const universityId = profile?.university_id != null ? Number(profile.university_id) : null;
    state.isStudent = universityId != null ? true : null;
    state.selectedUniversityId = universityId;
    state.gender = profile?.gender === 1 || profile?.gender === 2 ? profile.gender : null;
    state.selectedRegionId = profile?.region_id != null ? Number(profile.region_id) : null;
    state.aboutMe = profile?.about_me ?? '';
    state.preferredLanguage = normalizeProfileLang(profile?.preferred_language || UyDosh.getLang());
    for (const field of LIFESTYLE_FIELDS) {
      const raw = profile?.[field.key];
      state.lifestyle[field.key] = raw === undefined ? null : raw;
    }
  } catch (err) {
    if (err?.status === 404) {
      state.noProfile = true;
      return;
    }
    console.error('Failed to load profile', err);
    state.loadError = true;
  }
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
    render();
  });

  // Deliberately no separate `getTelegramInitData()` pre-check here —
  // `ensureTelegramMiniAppSession()` already tries a cached session token
  // first and only falls back to initData if there isn't one. Gating on
  // initData up front would wrongly fail a still-valid cached session: the
  // Mini App's own initData is only fresh on the entry page (Telegram
  // passes it via the URL hash, which internal navigation to this page
  // doesn't carry over) and the sessionStorage fallback copy of it expires
  // after 24h — but a previously-issued session token has its own,
  // separate backend expiry and can easily still be good past that point.
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

  // Set once here rather than in `render()` — see `state.aboutMe` comment.
  aboutMeInputEl.value = state.aboutMe;

  loadingEl.hidden = true;
  formRootEl.hidden = false;
  footerEl.hidden = false;
  bindEvents();
  render();
}

boot();
