UyDosh.initTelegramMiniApp();

// LISTING_TYPE_ROOM_NEEDED / LISTING_TYPE_ROOMMATE_NEEDED are already global consts
// declared by uydosh-web.js (loaded before this file) — do not redeclare them here,
// classic <script> top-level `const` lives in a shared lexical scope and a second
// `const` with the same name throws a SyntaxError that aborts this entire script.
const LOCATION_MODE_METRO = 'metro';
const LOCATION_MODE_DISTRICT = 'district';
const TITLE_MAX = 50;
const DESCRIPTION_MAX = 1000;
const PRICE_MIN = 10;
const PRICE_MAX = 1000;
const STEP_COUNT = 4;
// Keep in sync with the backend's per-listing photo cap (listingPhotoService.ts).
const MAX_PHOTOS = 5;

const loadingEl = document.getElementById('loading');
const formRoot = document.getElementById('form-root');
const successRoot = document.getElementById('success-root');
const successPhotoWarningEl = document.getElementById('success-photo-warning');
const stepPanelsEl = document.getElementById('step-panels');
const stepTitleEl = document.getElementById('step-title');
const stepCounterEl = document.getElementById('step-counter');
const progressEl = document.getElementById('progress');
const formErrorEl = document.getElementById('form-error');
const wizardFooterEl = document.getElementById('wizard-footer');
const wizardBackBtn = document.getElementById('wizard-back');
const wizardNextBtn = document.getElementById('wizard-next');
const wizardNextLabelEl = document.getElementById('wizard-next-label');
const wizardNextIconEl = document.getElementById('wizard-next-icon');
const wizardNextSpinnerEl = document.getElementById('wizard-next-spinner');
const photoInput = document.getElementById('photo-input');

const state = {
  step: 0,
  auth: null,
  amenities: [],
  locations: [],
  stations: [],
  stationsLoading: false,
  submitting: false,
  validationError: '',
  validationAnchor: '',
  lastGeneratedTitle: '',
  form: {
    listingTypeId: LISTING_TYPE_ROOMMATE_NEEDED,
    locationMode: LOCATION_MODE_METRO,
    subwayLineId: 1,
    selectedStationIds: [],
    selectedLocationIds: [],
    price: 100,
    priceMin: 50,
    priceMax: 150,
    gender: 1,
    amenityIds: new Set(),
    moveInDate: '',
    privateRoom: false,
    title: '',
    description: '',
    photos: [],
  },
};

function tg() { return window.Telegram?.WebApp; }

function haptic(type = 'light') {
  tg()?.HapticFeedback?.impactOccurred(type);
}

function stepTitles(lang) {
  return [
    UyDosh.t('create.step.typeLocation', lang),
    UyDosh.t('create.step.details', lang),
    UyDosh.t('create.step.description', lang),
    UyDosh.t('create.step.review', lang),
  ];
}

function isRoomNeeded() {
  return state.form.listingTypeId === LISTING_TYPE_ROOM_NEEDED;
}

function supportsMultiLocation() {
  return isRoomNeeded();
}

function priceForRequest() {
  if (isRoomNeeded()) {
    return Math.round((state.form.priceMin + state.form.priceMax) / 2);
  }
  return Math.round(state.form.price);
}

function priceBoundsForRequest() {
  if (isRoomNeeded()) {
    return {
      min: Math.round(Math.min(state.form.priceMin, state.form.priceMax)),
      max: Math.round(Math.max(state.form.priceMin, state.form.priceMax)),
    };
  }
  const p = Math.round(state.form.price);
  return { min: p, max: p };
}

function formatPriceReviewHtml(lang) {
  const bounds = priceBoundsForRequest();
  const nf = new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'ru-RU');
  const perMonth = `<small>${UyDosh.escapeHtml(UyDosh.t('create.perMonth', lang))}</small>`;
  if (bounds.min === bounds.max) {
    return `$${nf.format(bounds.min)}${perMonth}`;
  }
  return `$${nf.format(bounds.min)}–$${nf.format(bounds.max)}${perMonth}`;
}

function listingTypeLabel(typeId, lang) {
  if (typeId === LISTING_TYPE_ROOM_NEEDED) return UyDosh.t('filter.type.roomNeeded', lang);
  return UyDosh.t('filter.type.roommateNeeded', lang);
}

function genderLabel(gender, lang) {
  return gender === 2
    ? UyDosh.t('filter.gender.female', lang)
    : UyDosh.t('filter.gender.male', lang);
}

/** Pre-fill title with preset hashtag; preserves manual edits like mobile create flow. */
function updateDefaultTitle(lang = UyDosh.getLang()) {
  const generated = UyDosh.presetListingTitleText(
    state.form.listingTypeId,
    state.form.gender,
    lang,
  );
  const current = state.form.title;
  const shouldOverwrite = !current || current === state.lastGeneratedTitle;
  if (shouldOverwrite) {
    state.form.title = generated;
  }
  state.lastGeneratedTitle = generated;
}

function reviewListingForBadges() {
  const typeId = state.form.listingTypeId;
  const listing = {
    listing_type_id: typeId,
    gender: state.form.gender,
  };
  if (typeId === LISTING_TYPE_ROOM_NEEDED) {
    listing.listing_type = {
      name_uz: UyDosh.t('filter.type.roomNeeded', 'uz'),
      name_ru: UyDosh.t('filter.type.roomNeeded', 'ru'),
      name_en: UyDosh.t('filter.type.roomNeeded', 'en'),
    };
  }
  return listing;
}

function listingTypeReviewBadgeHtml(lang) {
  const listing = reviewListingForBadges();
  const label = UyDosh.listingTypeBadgeLabel(listing, lang)
    || listingTypeLabel(state.form.listingTypeId, lang);
  const typeColor = UyDosh.listingTypeColor(state.form.listingTypeId);
  const icon = UyDosh.listingTypeBadgeIcon(listing, { pressed: false });
  const typeStyle = typeColor ? ` style="--badge-type-color:${typeColor}"` : '';
  return `<span class="badge badge-type"${typeStyle}>${icon}${UyDosh.escapeHtml(label)}</span>`;
}

function genderReviewBadgeHtml(lang) {
  return UyDosh.genderBadgeHtml({ gender: state.form.gender }, lang);
}

function selectedLocationSummary(lang) {
  if (state.form.locationMode === LOCATION_MODE_METRO) {
    const names = state.stations
      .filter((s) => state.form.selectedStationIds.includes(Number(s.id)))
      .map((s) => UyDosh.localized(s, lang));
    return names.join(', ');
  }
  const names = state.locations
    .filter((l) => state.form.selectedLocationIds.includes(Number(l.id)))
    .map((l) => UyDosh.localizedShort(l, lang));
  return names.join(', ');
}

function selectedLocationReviewHtml(lang) {
  const summary = selectedLocationSummary(lang);
  if (!summary) {
    return UyDosh.escapeHtml(UyDosh.t('create.reviewNotSet', lang));
  }
  if (state.form.locationMode === LOCATION_MODE_DISTRICT) {
    return `${UyDosh.iconPin()}<span>${UyDosh.escapeHtml(summary)}</span>`;
  }
  return UyDosh.escapeHtml(summary);
}

function fieldInlineErrorHtml(message) {
  if (!message) return '';
  return `<div class="field-inline-error" role="alert">${UyDosh.escapeHtml(message)}</div>`;
}

function fieldErrorAttrs(anchor) {
  const active = state.validationError && state.validationAnchor === anchor;
  return {
    className: active ? ' has-error' : '',
    inline: active ? fieldInlineErrorHtml(state.validationError) : '',
  };
}

function showFormError(message, anchor = '') {
  state.validationError = message || '';
  state.validationAnchor = message ? anchor : '';
  if (!message) {
    formErrorEl.hidden = true;
    formErrorEl.textContent = '';
    return;
  }
  formErrorEl.hidden = false;
  formErrorEl.textContent = message;
}

function scrollToValidationAnchor() {
  if (!state.validationAnchor) return;
  requestAnimationFrame(() => {
    stepPanelsEl.querySelector(`[data-validation-anchor="${state.validationAnchor}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

function hideTelegramMainButton() {
  tg()?.MainButton?.hide();
}

function updateTelegramBackButton() {
  const webApp = tg();
  if (!webApp?.BackButton) return;
  if (successRoot.hidden === false || formRoot.hidden) {
    webApp.BackButton.hide();
    return;
  }
  if (state.step <= 0) webApp.BackButton.show();
  else webApp.BackButton.hide();
}

function updateWizardFooter() {
  hideTelegramMainButton();
  updateTelegramBackButton();

  if (formRoot.hidden || successRoot.hidden === false) {
    wizardFooterEl.hidden = true;
    return;
  }

  wizardFooterEl.hidden = false;
  const lang = UyDosh.getLang();
  const isFirst = state.step <= 0;
  const isLast = state.step >= STEP_COUNT - 1;

  wizardBackBtn.hidden = isFirst;
  wizardNextBtn.classList.toggle('full', isFirst);

  const nextKey = state.submitting
    ? 'create.publishing'
    : isLast
      ? 'create.publish'
      : 'create.next';
  wizardNextLabelEl.textContent = UyDosh.t(nextKey, lang);
  wizardNextLabelEl.removeAttribute('data-i18n');

  wizardBackBtn.disabled = state.submitting;
  wizardNextBtn.disabled = state.submitting;
  wizardNextSpinnerEl.hidden = !state.submitting;
  wizardNextIconEl.hidden = state.submitting || isLast;
}

function renderProgress() {
  progressEl.innerHTML = Array.from({ length: STEP_COUNT }, (_, i) => {
    const cls = i < state.step ? 'done' : i === state.step ? 'active' : '';
    return `<div class="progress-seg ${cls}"><span></span></div>`;
  }).join('');
}

function stationListHtml(lang) {
  if (state.stationsLoading) {
    return `
      <div class="station-list-loading" aria-busy="true" aria-live="polite">
        <span class="station-list-spinner" aria-hidden="true"></span>
      </div>`;
  }
  const stationItems = state.stations.map((st) => {
    const id = Number(st.id);
    const pressed = state.form.selectedStationIds.includes(id);
    const lineId = Number(st.line) || state.form.subwayLineId;
    return `
      <button type="button" class="station-item" data-station-id="${id}" aria-pressed="${pressed ? 'true' : 'false'}">
        ${UyDosh.iconMetro(lineId)}
        <span>${UyDosh.escapeHtml(UyDosh.localized(st, lang))}</span>
      </button>`;
  }).join('');
  return stationItems || `<div class="status">…</div>`;
}

function renderStep0(lang) {
  const typeOptions = [
    { id: LISTING_TYPE_ROOMMATE_NEEDED, label: UyDosh.t('filter.type.roommateNeeded', lang) },
    { id: LISTING_TYPE_ROOM_NEEDED, label: UyDosh.t('filter.type.roomNeeded', lang) },
  ];
  const typeChips = typeOptions.map((opt) => {
    const pressed = state.form.listingTypeId === opt.id;
    return `
      <button type="button" class="chip" data-listing-type="${opt.id}" aria-pressed="${pressed ? 'true' : 'false'}">
        ${UyDosh.filterListingTypeIcon(opt.id, { pressed: false })}
        <span>${UyDosh.escapeHtml(opt.label)}</span>
      </button>`;
  }).join('');

  const modeChips = [
    { mode: LOCATION_MODE_METRO, label: UyDosh.t('create.locationMetro', lang) },
    { mode: LOCATION_MODE_DISTRICT, label: UyDosh.t('create.locationDistrict', lang) },
  ].map((opt) => {
    const pressed = state.form.locationMode === opt.mode;
    return `
      <button type="button" class="chip" data-location-mode="${opt.mode}" aria-pressed="${pressed ? 'true' : 'false'}">
        ${UyDosh.escapeHtml(opt.label)}
      </button>`;
  }).join('');

  const lineChips = UyDosh.METRO_LINE_IDS.map((lineId) => {
    const pressed = state.form.subwayLineId === lineId;
    const color = UyDosh.metroLineColor(lineId) || 'currentColor';
    const label = UyDosh.metroLineLabel(lineId, lang);
    return `
      <button type="button" class="chip chip-line" data-subway-line="${lineId}" style="--line-color:${color}" aria-pressed="${pressed ? 'true' : 'false'}">
        ${UyDosh.metroLineBadgeHtml(lineId)}
        <span>${UyDosh.escapeHtml(label)}</span>
      </button>`;
  }).join('');

  let locationBody = '';
  if (state.form.locationMode === LOCATION_MODE_METRO) {
    const stationLabel = supportsMultiLocation()
      ? UyDosh.t('create.metroStations', lang)
      : UyDosh.t('create.metroStation', lang);
    const stationField = fieldErrorAttrs('location');
    locationBody = `
      <div class="field">
        <div class="field-label">${UyDosh.escapeHtml(UyDosh.t('create.metroLine', lang))}</div>
        <div class="chips">${lineChips}</div>
      </div>
      <div class="field${stationField.className}" data-validation-anchor="location">
        <div class="field-label">${UyDosh.escapeHtml(stationLabel)}</div>
        ${stationField.inline}
        <div class="station-list">${stationListHtml(lang)}</div>
      </div>`;
  } else {
    const districtLabel = supportsMultiLocation()
      ? UyDosh.t('create.districts', lang)
      : UyDosh.t('create.district', lang);
    const districtField = fieldErrorAttrs('location');
    const districtItems = state.locations.map((loc) => {
      const id = Number(loc.id);
      const pressed = state.form.selectedLocationIds.includes(id);
      return `
        <button type="button" class="station-item" data-location-id="${id}" aria-pressed="${pressed ? 'true' : 'false'}">
          ${UyDosh.iconPin()}
          <span>${UyDosh.escapeHtml(UyDosh.localizedShort(loc, lang))}</span>
        </button>`;
    }).join('');
    locationBody = `
      <div class="field${districtField.className}" data-validation-anchor="location">
        <div class="field-label">${UyDosh.escapeHtml(districtLabel)}</div>
        ${districtField.inline}
        <div class="station-list">${districtItems || `<div class="status">…</div>`}</div>
      </div>`;
  }

  return `
    <section class="panel active" data-step="0">
      <div class="field">
        <div class="field-label">${UyDosh.escapeHtml(UyDosh.t('create.listingType', lang))}</div>
        <div class="chips">${typeChips}</div>
      </div>
      <div class="field">
        <div class="field-label">${UyDosh.escapeHtml(UyDosh.t('create.locationMode', lang))}</div>
        <div class="chips">${modeChips}</div>
      </div>
      ${locationBody}
    </section>`;
}

function renderStep1(lang) {
  const singlePrice = !isRoomNeeded();
  const priceField = fieldErrorAttrs('price');
  const priceBlock = singlePrice
    ? `
      <div class="field${priceField.className}" data-validation-anchor="price">
        <div class="field-label">${UyDosh.escapeHtml(UyDosh.t('create.price', lang))}</div>
        ${priceField.inline}
        <div class="price-value">$${state.form.price}</div>
        <input type="range" min="${PRICE_MIN}" max="${PRICE_MAX}" step="5" value="${state.form.price}" data-price-single />
      </div>`
    : `
      <div class="field${priceField.className}" data-validation-anchor="price">
        <div class="field-label">${UyDosh.escapeHtml(UyDosh.t('create.priceRange', lang))}</div>
        ${priceField.inline}
        <div class="price-value">$${state.form.priceMin} – $${state.form.priceMax}</div>
        <div class="price-row">
          <div>
            <label>${UyDosh.escapeHtml(UyDosh.t('create.priceMin', lang))}</label>
            <input type="range" min="${PRICE_MIN}" max="${PRICE_MAX}" step="5" value="${state.form.priceMin}" data-price-min />
          </div>
          <div>
            <label>${UyDosh.escapeHtml(UyDosh.t('create.priceMax', lang))}</label>
            <input type="range" min="${PRICE_MIN}" max="${PRICE_MAX}" step="5" value="${state.form.priceMax}" data-price-max />
          </div>
        </div>
      </div>`;

  const genderField = fieldErrorAttrs('gender');
  const genderChips = [1, 2].map((g) => {
    const pressed = state.form.gender === g;
    return `
      <button type="button" class="chip" data-gender="${g}" aria-pressed="${pressed ? 'true' : 'false'}">
        ${UyDosh.filterGenderIcon(g, { pressed: false })}
        <span>${UyDosh.escapeHtml(genderLabel(g, lang))}</span>
      </button>`;
  }).join('');

  const amenityChips = state.amenities.map((a) => {
    const id = Number(a.id);
    const pressed = state.form.amenityIds.has(id);
    return `
      <button type="button" class="amenity-chip" data-amenity-id="${id}" aria-pressed="${pressed ? 'true' : 'false'}">
        ${UyDosh.amenityIconHtml(UyDosh.getAmenityCode(a), { size: 16 })}
        <span>${UyDosh.escapeHtml(UyDosh.localized(a, lang))}</span>
      </button>`;
  }).join('');

  return `
    <section class="panel active" data-step="1">
      ${priceBlock}
      <div class="field${genderField.className}" data-validation-anchor="gender">
        <div class="field-label">${UyDosh.escapeHtml(UyDosh.t('create.gender', lang))}</div>
        ${genderField.inline}
        <div class="chips">${genderChips}</div>
      </div>
      <div class="field">
        <div class="field-label">${UyDosh.escapeHtml(UyDosh.t('create.amenities', lang))}</div>
        <div class="amenity-grid">${amenityChips}</div>
      </div>
      <div class="field">
        <label for="move-in-date">${UyDosh.escapeHtml(UyDosh.t('create.moveInDate', lang))}</label>
        <input id="move-in-date" type="date" value="${UyDosh.escapeHtml(state.form.moveInDate)}" />
      </div>
      ${!isRoomNeeded() ? `
      <div class="toggle-row">
        <span class="toggle-row-label">${UyDosh.escapeHtml(UyDosh.t('create.privateRoom', lang))}</span>
        <button
          type="button"
          class="switch"
          role="switch"
          data-private-room
          aria-checked="${state.form.privateRoom ? 'true' : 'false'}"
          aria-label="${UyDosh.escapeHtml(UyDosh.t('create.privateRoom', lang))}"
        >
          <span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
        </button>
      </div>` : ''}
    </section>`;
}

function renderStep2(lang) {
  const titleField = fieldErrorAttrs('title');
  const descriptionField = fieldErrorAttrs('description');
  const photoSlots = state.form.photos.map((photo, index) => `
    <div class="photo-slot">
      <img src="${UyDosh.escapeHtml(photo.previewUrl)}" alt="" />
      <button type="button" data-remove-photo="${index}" aria-label="Remove">×</button>
    </div>
  `).join('');

  return `
    <section class="panel active" data-step="2">
      <div class="field${titleField.className}" data-validation-anchor="title">
        <label for="listing-title">${UyDosh.escapeHtml(UyDosh.t('create.titleLabel', lang))}</label>
        ${titleField.inline}
        <input id="listing-title" type="text" maxlength="${TITLE_MAX}" value="${UyDosh.escapeHtml(state.form.title)}" placeholder="${UyDosh.escapeHtml(UyDosh.t('create.titlePlaceholder', lang))}" />
        <div class="char-count ${state.form.title.length > TITLE_MAX ? 'over' : ''}">${state.form.title.length}/${TITLE_MAX}</div>
      </div>
      <div class="field${descriptionField.className}" data-validation-anchor="description">
        <label for="listing-description">${UyDosh.escapeHtml(UyDosh.t('create.descriptionLabel', lang))}</label>
        ${descriptionField.inline}
        <textarea id="listing-description" maxlength="${DESCRIPTION_MAX}" placeholder="${UyDosh.escapeHtml(UyDosh.t('create.descriptionPlaceholder', lang))}">${UyDosh.escapeHtml(state.form.description)}</textarea>
        <div class="description-footer">
          <button
            type="button"
            class="description-template-btn"
            data-description-template
            aria-label="${UyDosh.escapeHtml(UyDosh.t('create.descriptionTemplateLabel', lang))}"
          >
            ${UyDosh.iconArticle(null)}
            <span>${UyDosh.escapeHtml(UyDosh.t('create.descriptionTemplateLabel', lang))}</span>
          </button>
          <div class="char-count description-char-count ${state.form.description.length > DESCRIPTION_MAX ? 'over' : ''}">${state.form.description.length}/${DESCRIPTION_MAX}</div>
        </div>
      </div>
      <div class="field">
        <div class="field-label">${UyDosh.escapeHtml(UyDosh.t('create.photos', lang))}</div>
        <div class="photo-grid">${photoSlots}</div>
        <button
          type="button"
          class="photo-add"
          data-add-photo
          aria-label="${UyDosh.escapeHtml(UyDosh.t('create.addPhoto', lang))}"
        >${UyDosh.iconCamera(null)}</button>
      </div>
    </section>`;
}

function renderStep3(lang) {
  const selectedAmenities = state.amenities.filter((a) =>
    state.form.amenityIds.has(Number(a.id)),
  );
  const amenityValueHtml = selectedAmenities.length
    ? UyDosh.amenityIconsRowHtml(selectedAmenities, lang, { showAll: true, variant: 'form' })
    : UyDosh.escapeHtml(UyDosh.t('create.reviewNotSet', lang));

  const moveIn = state.form.moveInDate
    ? UyDosh.formatDate(state.form.moveInDate, lang)
    : UyDosh.t('create.moveInAny', lang);

  const rows = [
    {
      label: UyDosh.t('create.reviewType', lang),
      valueHtml: listingTypeReviewBadgeHtml(lang),
      badges: true,
    },
    {
      label: UyDosh.t('create.reviewGender', lang),
      valueHtml: genderReviewBadgeHtml(lang),
      badges: true,
    },
    { label: UyDosh.t('create.titleLabel', lang), value: state.form.title, clip: true },
    { label: UyDosh.t('create.descriptionLabel', lang), value: state.form.description, clip: true },
    {
      label: UyDosh.t('create.reviewLocation', lang),
      valueHtml: selectedLocationReviewHtml(lang),
      location: true,
    },
    {
      label: UyDosh.t('create.reviewPrice', lang),
      valueHtml: formatPriceReviewHtml(lang),
      price: true,
    },
    {
      label: UyDosh.t('create.reviewAmenities', lang),
      valueHtml: amenityValueHtml,
      amenitiesIcons: true,
    },
    { label: UyDosh.t('create.reviewMoveIn', lang), value: moveIn },
  ];

  if (!isRoomNeeded()) {
    rows.push({
      label: UyDosh.t('create.reviewPrivateRoom', lang),
      value: state.form.privateRoom ? UyDosh.t('create.reviewYes', lang) : UyDosh.t('create.reviewNo', lang),
    });
  }

  const reviewRows = rows.map(({ label, value, valueHtml, clip, amenitiesIcons, badges, location, price }) => {
    const ddClass = [
      clip ? 'review-value-clip' : '',
      amenitiesIcons ? 'review-amenities-icons' : '',
      badges ? 'review-badges' : '',
      location ? 'review-location' : '',
      price ? 'review-price' : '',
    ].filter(Boolean).join(' ');
    const ddContent = valueHtml ?? UyDosh.escapeHtml(String(value ?? ''));
    return `
    <div class="review-row">
      <dt>${UyDosh.escapeHtml(label)}</dt>
      <dd${ddClass ? ` class="${ddClass}"` : ''}>${ddContent}</dd>
    </div>`;
  }).join('');

  return `
    <section class="panel active" data-step="3">
      <div class="review-card">${reviewRows}</div>
    </section>`;
}

function renderStep() {
  const lang = UyDosh.getLang();
  const titles = stepTitles(lang);
  stepTitleEl.textContent = titles[state.step] || '';
  stepCounterEl.textContent = UyDosh.t('create.stepCounter', lang)
    .replace('{current}', String(state.step + 1))
    .replace('{total}', String(STEP_COUNT));

  renderProgress();

  let html = '';
  if (state.step === 0) html = renderStep0(lang);
  else if (state.step === 1) html = renderStep1(lang);
  else if (state.step === 2) html = renderStep2(lang);
  else html = renderStep3(lang);

  stepPanelsEl.innerHTML = html;
  bindStepEvents();
  updateWizardFooter();
}

async function loadStationsForLine(lineId) {
  const lang = UyDosh.getLang();
  const data = await UyDosh.fetchSubwayStationsByLine(lineId, lang);
  if (lineId !== state.form.subwayLineId) return;
  state.stations = Array.isArray(data) ? data : (Array.isArray(data?.stations) ? data.stations : []);
  state.form.selectedStationIds = state.form.selectedStationIds.filter((id) =>
    state.stations.some((s) => Number(s.id) === id),
  );
}

async function loadLocations() {
  const lang = UyDosh.getLang();
  const data = await UyDosh.fetchLocations({ page: 1, limit: 200, language: lang });
  state.locations = Array.isArray(data?.locations) ? data.locations : [];
}

async function loadReferenceData() {
  const amenitiesData = await UyDosh.fetchAmenitiesOrdered();
  state.amenities = UyDosh.sortAmenitiesForForm(
    Array.isArray(amenitiesData?.amenities) ? amenitiesData.amenities : [],
  );
  await Promise.all([loadStationsForLine(state.form.subwayLineId), loadLocations()]);
}

function toggleSelection(list, id, multi) {
  const n = Number(id);
  if (!multi) return [n];
  if (list.includes(n)) return list.filter((x) => x !== n);
  return [...list, n];
}

/** Toggle pressed state without re-rendering scrollable station/location lists. */
function updateStationSelectionUi() {
  const selected = new Set(state.form.selectedStationIds.map(Number));
  stepPanelsEl.querySelectorAll('[data-station-id]').forEach((btn) => {
    const id = Number(btn.getAttribute('data-station-id'));
    btn.setAttribute('aria-pressed', selected.has(id) ? 'true' : 'false');
  });
}

function updateLocationSelectionUi() {
  const selected = new Set(state.form.selectedLocationIds.map(Number));
  stepPanelsEl.querySelectorAll('[data-location-id]').forEach((btn) => {
    const id = Number(btn.getAttribute('data-location-id'));
    btn.setAttribute('aria-pressed', selected.has(id) ? 'true' : 'false');
  });
}

function bindStepEvents() {
  stepPanelsEl.querySelectorAll('[data-listing-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      haptic();
      state.form.listingTypeId = Number(btn.getAttribute('data-listing-type'));
      if (!supportsMultiLocation()) {
        state.form.selectedStationIds = state.form.selectedStationIds.slice(0, 1);
        state.form.selectedLocationIds = state.form.selectedLocationIds.slice(0, 1);
      }
      updateDefaultTitle();
      renderStep();
    });
  });

  stepPanelsEl.querySelectorAll('[data-location-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      haptic();
      state.form.locationMode = btn.getAttribute('data-location-mode');
      renderStep();
    });
  });

  stepPanelsEl.querySelectorAll('[data-subway-line]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const nextLineId = Number(btn.getAttribute('data-subway-line'));
      if (nextLineId === state.form.subwayLineId && !state.stationsLoading) return;
      haptic();
      state.form.subwayLineId = nextLineId;
      state.form.selectedStationIds = [];
      state.stationsLoading = true;
      renderStep();
      try {
        await loadStationsForLine(nextLineId);
      } catch (err) {
        console.error(err);
        if (nextLineId === state.form.subwayLineId) state.stations = [];
      } finally {
        if (nextLineId === state.form.subwayLineId) {
          state.stationsLoading = false;
          renderStep();
        }
      }
    });
  });

  stepPanelsEl.querySelectorAll('[data-station-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      haptic();
      const id = Number(btn.getAttribute('data-station-id'));
      state.form.selectedStationIds = toggleSelection(
        state.form.selectedStationIds,
        id,
        supportsMultiLocation(),
      );
      if (state.form.selectedStationIds.length > 0 && state.validationError) {
        showFormError('');
        renderStep();
        return;
      }
      updateStationSelectionUi();
    });
  });

  stepPanelsEl.querySelectorAll('[data-location-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      haptic();
      const id = Number(btn.getAttribute('data-location-id'));
      state.form.selectedLocationIds = toggleSelection(
        state.form.selectedLocationIds,
        id,
        supportsMultiLocation(),
      );
      if (state.form.selectedLocationIds.length > 0 && state.validationError) {
        showFormError('');
        renderStep();
        return;
      }
      updateLocationSelectionUi();
    });
  });

  stepPanelsEl.querySelector('[data-price-single]')?.addEventListener('input', (e) => {
    state.form.price = Number(e.target.value);
    if (state.form.price >= PRICE_MIN) showFormError('');
    renderStep();
  });
  stepPanelsEl.querySelector('[data-price-min]')?.addEventListener('input', (e) => {
    state.form.priceMin = Number(e.target.value);
    if (state.form.priceMin > state.form.priceMax) state.form.priceMax = state.form.priceMin;
    if (priceBoundsForRequest().min >= PRICE_MIN) showFormError('');
    renderStep();
  });
  stepPanelsEl.querySelector('[data-price-max]')?.addEventListener('input', (e) => {
    state.form.priceMax = Number(e.target.value);
    if (state.form.priceMax < state.form.priceMin) state.form.priceMin = state.form.priceMax;
    if (priceBoundsForRequest().min >= PRICE_MIN) showFormError('');
    renderStep();
  });

  stepPanelsEl.querySelectorAll('[data-gender]').forEach((btn) => {
    btn.addEventListener('click', () => {
      haptic();
      state.form.gender = Number(btn.getAttribute('data-gender'));
      if (state.form.gender) showFormError('');
      updateDefaultTitle();
      renderStep();
    });
  });

  stepPanelsEl.querySelectorAll('[data-amenity-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      haptic();
      const id = Number(btn.getAttribute('data-amenity-id'));
      if (state.form.amenityIds.has(id)) state.form.amenityIds.delete(id);
      else state.form.amenityIds.add(id);
      renderStep();
    });
  });

  stepPanelsEl.querySelector('#move-in-date')?.addEventListener('change', (e) => {
    state.form.moveInDate = e.target.value || '';
  });

  stepPanelsEl.querySelector('[data-private-room]')?.addEventListener('click', (e) => {
    haptic();
    state.form.privateRoom = !state.form.privateRoom;
    e.currentTarget.setAttribute(
      'aria-checked',
      state.form.privateRoom ? 'true' : 'false',
    );
  });

  stepPanelsEl.querySelector('#listing-title')?.addEventListener('input', (e) => {
    state.form.title = e.target.value;
    if (state.form.title.trim() && state.validationError) {
      showFormError('');
      renderStep();
      return;
    }
    const counter = stepPanelsEl.querySelector('.char-count');
    if (counter) {
      counter.textContent = `${state.form.title.length}/${TITLE_MAX}`;
      counter.classList.toggle('over', state.form.title.length > TITLE_MAX);
    }
  });

  stepPanelsEl.querySelector('#listing-description')?.addEventListener('input', (e) => {
    state.form.description = e.target.value;
    if (state.form.description.trim() && state.validationError) {
      showFormError('');
      renderStep();
      return;
    }
    const counter = stepPanelsEl.querySelector('.description-char-count');
    if (counter) {
      counter.textContent = `${state.form.description.length}/${DESCRIPTION_MAX}`;
      counter.classList.toggle('over', state.form.description.length > DESCRIPTION_MAX);
    }
  });

  stepPanelsEl.querySelector('[data-description-template]')?.addEventListener('click', () => {
    haptic();
    const lang = UyDosh.getLang();
    const text = UyDosh.descriptionTemplateText(
      state.form.listingTypeId,
      state.form.gender,
      lang,
    );
    state.form.description = text;
    const textarea = stepPanelsEl.querySelector('#listing-description');
    if (textarea) {
      textarea.value = text;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (state.form.description.trim() && state.validationError) {
      showFormError('');
      renderStep();
    }
  });

  stepPanelsEl.querySelector('[data-add-photo]')?.addEventListener('click', () => {
    haptic();
    photoInput.click();
  });

  stepPanelsEl.querySelectorAll('[data-remove-photo]').forEach((btn) => {
    btn.addEventListener('click', () => {
      haptic();
      const index = Number(btn.getAttribute('data-remove-photo'));
      const removed = state.form.photos[index];
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      state.form.photos.splice(index, 1);
      renderStep();
    });
  });
}

function validateStep(step) {
  const lang = UyDosh.getLang();
  if (step === 0) {
    if (state.form.locationMode === LOCATION_MODE_METRO && state.form.selectedStationIds.length === 0) {
      return {
        message: UyDosh.t('create.errorLocationRequired', lang),
        anchor: 'location',
      };
    }
    if (state.form.locationMode === LOCATION_MODE_DISTRICT && state.form.selectedLocationIds.length === 0) {
      return {
        message: UyDosh.t('create.errorLocationRequired', lang),
        anchor: 'location',
      };
    }
  }
  if (step === 1) {
    if (!state.form.gender) {
      return {
        message: UyDosh.t('create.errorGenderRequired', lang),
        anchor: 'gender',
      };
    }
    const bounds = priceBoundsForRequest();
    if (bounds.min < PRICE_MIN) {
      return {
        message: UyDosh.t('create.errorPriceRequired', lang),
        anchor: 'price',
      };
    }
  }
  if (step === 2) {
    const title = state.form.title.trim();
    const description = state.form.description.trim();
    if (!title) {
      return {
        message: UyDosh.t('create.errorTitleRequired', lang),
        anchor: 'title',
      };
    }
    if (title.length > TITLE_MAX) {
      return {
        message: UyDosh.t('create.errorTitleTooLong', lang),
        anchor: 'title',
      };
    }
    if (!description) {
      return {
        message: UyDosh.t('create.errorDescriptionRequired', lang),
        anchor: 'description',
      };
    }
    if (description.length > DESCRIPTION_MAX) {
      return {
        message: UyDosh.t('create.errorDescriptionTooLong', lang),
        anchor: 'description',
      };
    }
  }
  return null;
}

async function submitListing() {
  if (state.submitting) return;
  UyDosh.logMiniAppEvent('listing_publish_tapped', {
    flow: 'telegram_create',
    listing_type_id: state.form.listingTypeId,
    photo_count: state.form.photos.length,
  });
  state.submitting = true;
  showFormError('');
  updateWizardFooter();
  haptic('medium');

  try {
    const bounds = priceBoundsForRequest();
    const body = {
      title: state.form.title.trim(),
      listingTypeId: state.form.listingTypeId,
      price: priceForRequest(),
      minPrice: isRoomNeeded() ? bounds.min : undefined,
      maxPrice: isRoomNeeded() ? bounds.max : undefined,
      description: state.form.description.trim(),
      gender: state.form.gender,
      amenityIds: [...state.form.amenityIds],
      moveInDate: state.form.moveInDate || undefined,
      privateRoom: !isRoomNeeded() ? state.form.privateRoom : undefined,
    };

    if (state.form.locationMode === LOCATION_MODE_METRO) {
      body.subwayLineId = state.form.subwayLineId;
      if (supportsMultiLocation()) {
        body.subwayStationIds = state.form.selectedStationIds;
      } else {
        body.subwayStationId = state.form.selectedStationIds[0];
      }
    } else if (supportsMultiLocation()) {
      body.locationIds = state.form.selectedLocationIds;
    } else {
      body.locationId = state.form.selectedLocationIds[0];
    }

    const result = await UyDosh.createListingFromTelegramMiniApp(body);
    const listingId = result?.listing?.id;
    UyDosh.logMiniAppEvent('listing_created', {
      listing_type_id: state.form.listingTypeId,
      photo_count: state.form.photos.length,
    });
    if (listingId) {
      UyDosh.logMiniAppEvent('listing_published', {
        listing_id: listingId,
        source: 'telegram_create',
        listing_type_id: state.form.listingTypeId,
      });
    }

    let failedPhotoCount = 0;
    if (listingId && state.form.photos.length > 0) {
      for (let i = 0; i < state.form.photos.length; i += 1) {
        const photo = state.form.photos[i];
        try {
          await UyDosh.uploadListingPhoto(listingId, photo.dataUrl, { isPrimary: i === 0 });
        } catch (photoErr) {
          console.error('Photo upload failed', photoErr);
          failedPhotoCount += 1;
        }
      }
    }

    formRoot.hidden = true;
    showFormError('');
    wizardFooterEl.hidden = true;
    hideTelegramMainButton();
    tg()?.BackButton?.hide();
    if (failedPhotoCount > 0 && successPhotoWarningEl) {
      successPhotoWarningEl.hidden = false;
      successPhotoWarningEl.textContent = UyDosh.t('create.successPhotoWarning', UyDosh.getLang());
    } else if (successPhotoWarningEl) {
      successPhotoWarningEl.hidden = true;
    }
    successRoot.hidden = false;
    successRoot.classList.add('active');
  } catch (err) {
    console.error('Create listing failed', err, err.payload);
    if (err.status === 401) UyDosh.clearTelegramInitData();
    haptic('heavy');
    showFormError(
      err.status === 401
        ? UyDosh.t('create.errorAuth', UyDosh.getLang())
        : err.message || UyDosh.t('create.errorGeneric', UyDosh.getLang()),
    );
  } finally {
    state.submitting = false;
    updateWizardFooter();
  }
}

function goNext() {
  const validation = validateStep(state.step);
  if (validation) {
    haptic('heavy');
    showFormError(validation.message, validation.anchor);
    renderStep();
    scrollToValidationAnchor();
    return;
  }
  showFormError('');
  if (state.step >= STEP_COUNT - 1) {
    submitListing();
    return;
  }
  haptic();
  state.step += 1;
  renderStep();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goBack() {
  haptic();
  if (state.step <= 0) {
    location.href = UyDosh.MINI_APP_FEED_PATH;
    return;
  }
  state.step -= 1;
  showFormError('');
  renderStep();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

photoInput.addEventListener('change', async () => {
  const files = [...(photoInput.files || [])];
  photoInput.value = '';
  for (const file of files.slice(0, MAX_PHOTOS - state.form.photos.length)) {
    try {
      const dataUrl = await UyDosh.resizeImageFileForUpload(file);
      state.form.photos.push({
        file,
        dataUrl,
        previewUrl: URL.createObjectURL(file),
      });
    } catch (err) {
      console.error('Photo resize failed', err);
      haptic('heavy');
      showFormError(UyDosh.t('create.errorPhotoProcess', UyDosh.getLang()));
    }
  }
  renderStep();
});

async function boot() {
  UyDosh.initLangSwitcher();
  UyDosh.applyI18n();

  document.addEventListener('uydosh:langchange', async () => {
    UyDosh.applyI18n();
    try {
      await loadReferenceData();
    } catch { /* ignore */ }
    updateDefaultTitle();
    renderStep();
    updateWizardFooter();
  });

  wizardBackBtn.addEventListener('click', () => {
    if (state.submitting || state.step <= 0) return;
    goBack();
  });
  wizardNextBtn.addEventListener('click', () => {
    if (state.submitting) return;
    goNext();
  });

  const webApp = tg();
  hideTelegramMainButton();
  webApp?.BackButton?.onClick(() => {
    if (state.step <= 0) goBack();
  });

  const initData = UyDosh.getTelegramInitData();
  if (!initData) {
    loadingEl.classList.add('error');
    loadingEl.textContent = UyDosh.t('create.errorAuth', UyDosh.getLang());
    return;
  }

  try {
    await UyDosh.authenticateTelegramMiniApp();
    await loadReferenceData();
    updateDefaultTitle();
    loadingEl.hidden = true;
    formRoot.hidden = false;
    renderStep();
  } catch (err) {
    console.error(err);
    if (err.status === 401) UyDosh.clearTelegramInitData();
    loadingEl.classList.add('error');
    loadingEl.textContent = err.status === 401
      ? UyDosh.t('create.errorAuth', UyDosh.getLang())
      : UyDosh.t('create.errorGeneric', UyDosh.getLang());
  }
}

boot();
