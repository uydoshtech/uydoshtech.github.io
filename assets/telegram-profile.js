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

const studentYesBtn = document.getElementById('student-yes');
const studentNoBtn = document.getElementById('student-no');
const universityFieldEl = document.getElementById('university-field');
const universityPickedEl = document.getElementById('university-picked');
const universityPickedNameEl = document.getElementById('university-picked-name');
const universitySearchEl = document.getElementById('university-search');
const universityListEl = document.getElementById('university-list');

const saveBtn = document.getElementById('save-btn');
const saveBtnLabel = document.getElementById('save-btn-label');
const saveBtnSpinner = document.getElementById('save-btn-spinner');

let successTimer = null;

const state = {
  userId: null,
  authError: false,
  loadError: false,
  // Distinct from loadError: the user is authenticated but has no
  // `user_profiles` row yet (e.g. never posted a listing / used the app) —
  // PUT /profiles/:userId can't create one, so we can't offer the form yet.
  noProfile: false,
  universities: [],
  universitiesError: false,
  // null = not answered yet, true/false once the user (or existing data) answers.
  isStudent: null,
  selectedUniversityId: null,
  searchQuery: '',
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
    if (state.universities.length === 0 && !state.universitiesError) {
      universityListEl.innerHTML = `
        <div class="station-list-loading" aria-busy="true" aria-live="polite">
          <span class="station-list-spinner" aria-hidden="true"></span>
        </div>`;
    } else {
      renderUniversityList();
    }
  }

  saveBtn.disabled = state.saving;
  saveBtnLabel.textContent = state.saving ? UyDosh.t('profile.saving') : UyDosh.t('profile.save');
  saveBtnSpinner.hidden = !state.saving;
}

function bindEvents() {
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
    showFormError('');
    render();
  });

  universitySearchEl.addEventListener('input', () => {
    state.searchQuery = universitySearchEl.value || '';
    renderUniversityList();
  });

  universityListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-university-id]');
    if (!btn) return;
    state.selectedUniversityId = Number(btn.getAttribute('data-university-id'));
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

  const body = state.isStudent
    ? { university_id: state.selectedUniversityId }
    // `0` (not null/undefined) is what actually clears university_id server-side.
    : { university_id: 0 };

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
