// UyDosh Web — Telegram Mini App "Profile" page. Single-page form (not a
// wizard): today it only asks "are you a student?" + university, built so
// more self-profile fields can be appended the same way over time.
// Depends on uydosh-core.js, uydosh-api.js, uydosh-i18n.js, uydosh-icons.js,
// uydosh-mini-app.js. Load last.

UyDosh.initTelegramMiniApp();

const loadingEl = document.getElementById('loading');
const formRootEl = document.getElementById('form-root');
const footerEl = document.getElementById('profile-footer');
const formErrorEl = document.getElementById('form-error');
const formSuccessEl = document.getElementById('form-success');

const tabButtons = Array.from(document.querySelectorAll('[data-profile-tab]'));
const tabBasicEl = document.getElementById('tab-basic');
const tabLifestyleEl = document.getElementById('tab-lifestyle');

const studentYesBtn = document.getElementById('student-yes');
const studentNoBtn = document.getElementById('student-no');
const universityFieldEl = document.getElementById('university-field');
const universityPickedEl = document.getElementById('university-picked');
const universityPickedNameEl = document.getElementById('university-picked-name');
const universitySearchEl = document.getElementById('university-search');
const universityListEl = document.getElementById('university-list');
const lifestyleFieldsEl = document.getElementById('lifestyle-fields');

const saveBtn = document.getElementById('save-btn');
const saveBtnLabel = document.getElementById('save-btn-label');
const saveBtnSpinner = document.getElementById('save-btn-spinner');

let successTimer = null;

const TAB_BASIC = 'basic';
const TAB_LIFESTYLE = 'lifestyle';

// Mirrors the lifestyle fields on the Flutter app's edit-profile screen
// (`user_profiles` columns) — kept here as data so adding another field is
// just one more config entry instead of new bespoke markup/handlers.
const LIFESTYLE_FIELDS = [
  {
    key: 'employed',
    labelKey: 'profile.lifestyle.employed',
    options: [
      { value: null, labelKey: 'profile.lifestyle.notSpecified' },
      { value: true, labelKey: 'profile.lifestyle.employedYes' },
      { value: false, labelKey: 'profile.lifestyle.employedNo' },
    ],
  },
  {
    key: 'wakeup_time',
    labelKey: 'profile.lifestyle.wakeupTime',
    options: [
      { value: null, labelKey: 'profile.lifestyle.notSpecified' },
      { value: 'morning', labelKey: 'profile.lifestyle.morning' },
      { value: 'evening', labelKey: 'profile.lifestyle.evening' },
      { value: 'night', labelKey: 'profile.lifestyle.night' },
    ],
  },
  {
    key: 'sleep_time',
    labelKey: 'profile.lifestyle.sleepTime',
    options: [
      { value: null, labelKey: 'profile.lifestyle.notSpecified' },
      { value: 'morning', labelKey: 'profile.lifestyle.morning' },
      { value: 'evening', labelKey: 'profile.lifestyle.evening' },
      { value: 'night', labelKey: 'profile.lifestyle.night' },
    ],
  },
  {
    key: 'cleanliness',
    labelKey: 'profile.lifestyle.cleanliness',
    // 1-5 scales render as a slider (see renderLifestyleFields) instead of
    // chips — the option list is still used to look up the current value's
    // label text shown below the track.
    type: 'scale',
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
      { value: null, labelKey: 'profile.lifestyle.notSpecified' },
      { value: true, labelKey: 'profile.lifestyle.guestsYes' },
      { value: false, labelKey: 'profile.lifestyle.guestsNo' },
    ],
  },
  {
    key: 'smoking_preference',
    labelKey: 'profile.lifestyle.smokingPreference',
    options: [
      { value: null, labelKey: 'profile.lifestyle.notSpecified' },
      { value: 'non-smoker', labelKey: 'profile.lifestyle.nonSmoker' },
      { value: 'occasional', labelKey: 'profile.lifestyle.occasionalSmoker' },
      { value: 'regular', labelKey: 'profile.lifestyle.regularSmoker' },
    ],
  },
  {
    key: 'alcohol_preference',
    labelKey: 'profile.lifestyle.alcoholPreference',
    options: [
      { value: null, labelKey: 'profile.lifestyle.notSpecified' },
      { value: 'non-drinker', labelKey: 'profile.lifestyle.nonDrinker' },
      { value: 'occasional', labelKey: 'profile.lifestyle.occasionalDrinker' },
      { value: 'regular', labelKey: 'profile.lifestyle.regularDrinker' },
    ],
  },
  {
    key: 'cooking_habits',
    labelKey: 'profile.lifestyle.cookingHabits',
    options: [
      { value: null, labelKey: 'profile.lifestyle.notSpecified' },
      { value: true, labelKey: 'profile.lifestyle.cook' },
      { value: false, labelKey: 'profile.lifestyle.dontCook' },
    ],
  },
  {
    key: 'pets_preference',
    labelKey: 'profile.lifestyle.petsPreference',
    options: [
      { value: null, labelKey: 'profile.lifestyle.notSpecified' },
      { value: 'dont_like_pets', labelKey: 'profile.lifestyle.dontLikePets' },
      { value: 'like_pets', labelKey: 'profile.lifestyle.likePets' },
      { value: 'have_cat', labelKey: 'profile.lifestyle.haveCat' },
      { value: 'have_dog', labelKey: 'profile.lifestyle.haveDog' },
    ],
  },
];

const state = {
  userId: null,
  authError: false,
  loadError: false,
  // Distinct from loadError: the user is authenticated but has no
  // `user_profiles` row yet (e.g. never posted a listing / used the app) —
  // PUT /profiles/:userId can't create one, so we can't offer the form yet.
  noProfile: false,
  activeTab: TAB_BASIC,
  universities: [],
  universitiesError: false,
  // null = not answered yet, true/false once the user (or existing data) answers.
  isStudent: null,
  selectedUniversityId: null,
  searchQuery: '',
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

function renderUniversityList() {
  if (state.universitiesError) {
    universityListEl.innerHTML = `<div class="station-list-empty">${UyDosh.escapeHtml(UyDosh.t('profile.errorLoad'))}</div>`;
    return;
  }
  const lang = UyDosh.getLang();
  const items = filteredUniversities(lang);
  if (items.length === 0) {
    universityListEl.innerHTML = `<div class="station-list-empty">${UyDosh.escapeHtml(UyDosh.t('profile.universityNotFound'))}</div>`;
    return;
  }
  universityListEl.innerHTML = items.map((u) => {
    const id = Number(u.id);
    const pressed = Number(state.selectedUniversityId) === id;
    return `
      <button type="button" class="station-item" data-university-id="${id}" aria-pressed="${pressed ? 'true' : 'false'}">
        ${UyDosh.escapeHtml(UyDosh.localized(u, lang))}
      </button>`;
  }).join('');
}

function closeUniversitySuggestions() {
  universityListEl.hidden = true;
  universityListEl.innerHTML = '';
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
      return `
        <div class="field">
          <div class="field-label">${UyDosh.escapeHtml(UyDosh.t(field.labelKey))}</div>
          <input
            type="range"
            class="lifestyle-slider"
            min="${min}"
            max="${max}"
            step="1"
            value="${sliderValue}"
            data-lifestyle-slider="${field.key}"
          />
          <div class="lifestyle-slider-value" data-lifestyle-value-for="${field.key}">
            ${UyDosh.escapeHtml(scaleValueLabel(field, current))}
          </div>
        </div>`;
    }

    const chips = field.options.map((opt, i) => {
      const pressed = current === opt.value;
      return `
        <button
          type="button"
          class="chip"
          data-lifestyle-key="${field.key}"
          data-option-index="${i}"
          aria-pressed="${pressed ? 'true' : 'false'}"
        >${UyDosh.escapeHtml(UyDosh.t(opt.labelKey))}</button>`;
    }).join('');
    return `
      <div class="field">
        <div class="field-label">${UyDosh.escapeHtml(UyDosh.t(field.labelKey))}</div>
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

  studentYesBtn.setAttribute('aria-pressed', state.isStudent === true ? 'true' : 'false');
  studentNoBtn.setAttribute('aria-pressed', state.isStudent === false ? 'true' : 'false');

  const showUniversityField = state.isStudent === true;
  universityFieldEl.hidden = !showUniversityField;

  if (showUniversityField) {
    const selected = state.selectedUniversityId != null ? universityById(state.selectedUniversityId) : null;
    if (selected) {
      universityPickedEl.hidden = false;
      universityPickedNameEl.textContent = UyDosh.localized(selected, lang);
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

  saveBtn.disabled = state.saving;
  saveBtnLabel.textContent = state.saving ? UyDosh.t('profile.saving') : UyDosh.t('profile.save');
  saveBtnSpinner.hidden = !state.saving;
}

function bindEvents() {
  for (const btn of tabButtons) {
    btn.addEventListener('click', () => {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
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
    ...state.lifestyle,
  };

  try {
    await UyDosh.updateProfile(state.userId, body);
    // Either answer ("student" + university, or "not a student") counts as
    // having engaged with the prompt — don't keep nudging on the feed.
    UyDosh.dismissProfileNudge?.();
    showFormSuccess(UyDosh.t('profile.saved'));
  } catch (err) {
    console.error('Failed to save profile', err);
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

async function loadProfile() {
  try {
    const profile = await UyDosh.fetchProfile(state.userId);
    const universityId = profile?.university_id != null ? Number(profile.university_id) : null;
    state.isStudent = universityId != null ? true : null;
    state.selectedUniversityId = universityId;
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

  if (!UyDosh.getTelegramInitData()) {
    state.authError = true;
    loadingEl.classList.add('error');
    loadingEl.textContent = UyDosh.t('profile.errorAuth');
    return;
  }

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

  await Promise.all([loadProfile(), loadUniversities()]);

  if (state.noProfile) {
    renderNoProfileState();
    return;
  }

  if (state.loadError) {
    loadingEl.classList.add('error');
    loadingEl.textContent = UyDosh.t('profile.errorLoad');
    return;
  }

  loadingEl.hidden = true;
  formRootEl.hidden = false;
  footerEl.hidden = false;
  bindEvents();
  render();
}

boot();
