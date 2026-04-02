// Part of listing.html's detail-page script, split out of the former single
// ~2900-line assets/listing-detail.js for maintainability (that file is the
// highest-churn file in the site). Loaded as a plain classic <script defer>
// alongside the other listing-detail-*.js files and assets/listing-detail.js
// itself — they all share one global scope (like separate inline <script>
// blocks would), so functions defined here are called directly by the other
// modules and by listing-detail.js's render()/load(). See listing-detail.js
// for the overall module map.
//
// This file: the 1-on-1 lifestyle compatibility tile shown to non-owner Mini App viewers.
      // --- 1-on-1 lifestyle compatibility with the listing owner -----------
      // Mirrors the mobile app's ListingDetailCompatibilitySection: scores
      // the viewer's and owner's `/profiles/:userId` records with the ported
      // algorithm (see assets/uydosh-profile-match.js) and shows either the
      // match percentage + breakdown, or a prompt to complete the viewer's
      // own profile when nothing could be scored. Mini App only, and never
      // shown to the owner viewing their own listing.

      function compatibilityTileHtml(isOwner) {
        if (!UyDosh.isMiniApp() || isOwner) return '';
        return `
          <div class="compat-section" data-compat-section aria-expanded="false" hidden>
            <button type="button" class="compat-toggle" data-compat-toggle aria-expanded="false">
              <span class="compat-avatars" aria-hidden="true">
                <span class="compat-avatar" data-compat-avatar-owner>${UyDosh.iconChrome('person')}</span>
                <span class="compat-avatar" data-compat-avatar-current>${UyDosh.iconChrome('person')}</span>
              </span>
              <span class="compat-toggle-title">
                <span class="compat-toggle-label">${UyDosh.escapeHtml(UyDosh.t('compat.title'))}</span>
                <span class="compat-toggle-percent" data-compat-percent><span class="compat-spinner" aria-hidden="true"></span></span>
              </span>
              <span class="compat-chevron" aria-hidden="true">▾</span>
            </button>
            <div class="compat-body" data-compat-body hidden></div>
          </div>
        `;
      }

      function bindCompatibilitySection() {
        const section = rootEl.querySelector('[data-compat-section]');
        const toggle = rootEl.querySelector('[data-compat-toggle]');
        const body = rootEl.querySelector('[data-compat-body]');
        if (!section || !toggle || !body) return;
        toggle.addEventListener('click', () => {
          const next = body.hidden;
          body.hidden = !next;
          section.setAttribute('aria-expanded', next ? 'true' : 'false');
          toggle.setAttribute('aria-expanded', next ? 'true' : 'false');
        });
      }

      function compatPercentClass(percent) {
        if (percent >= 80) return 'is-good';
        if (percent >= 60) return 'is-ok';
        return 'is-bad';
      }

      function setCompatAvatar(el, profile) {
        if (!el) return;
        const url = profile ? UyDosh.photoUrl(profile.avatar_url) : '';
        if (!url) { el.innerHTML = UyDosh.iconChrome('person'); return; }
        const img = document.createElement('img');
        img.alt = '';
        img.referrerPolicy = 'no-referrer';
        img.addEventListener('error', () => { el.innerHTML = UyDosh.iconChrome('person'); }, { once: true });
        img.src = url;
        el.innerHTML = '';
        el.appendChild(img);
      }

      function compatFieldIcon(labelKey) {
        switch (labelKey) {
          case 'wakeup_time': return 'sun';
          case 'sleep_time': return 'moon';
          case 'cleanliness': return 'sparkles';
          case 'noise_level': return 'volume';
          case 'sociability': return 'chatBubble';
          case 'guests': return 'users';
          case 'smoking_preference': return 'cigarette';
          case 'alcohol_preference': return 'wineGlass';
          case 'cooking_habits': return 'cookingPot';
          case 'pets_preference': return 'cat';
          case 'region': return 'mapPin';
          case 'language': return 'globe';
          case 'university': return 'graduationCap';
          case 'roommate_gender': return 'person';
          case 'age': return 'cake';
          case 'budget': return 'wallet';
          default: return 'dash';
        }
      }

      function compatFieldLabel(labelKey) {
        switch (labelKey) {
          case 'smoking_preference': return UyDosh.t('profile.lifestyle.smokingPreference');
          case 'pets_preference': return UyDosh.t('profile.lifestyle.petsPreference');
          case 'cleanliness': return UyDosh.t('profile.lifestyle.cleanliness');
          case 'noise_level': return UyDosh.t('profile.lifestyle.noiseLevel');
          case 'sociability': return UyDosh.t('profile.lifestyle.sociability');
          case 'alcohol_preference': return UyDosh.t('profile.lifestyle.alcoholPreference');
          case 'guests': return UyDosh.t('profile.lifestyle.guestsAllowed');
          case 'cooking_habits': return UyDosh.t('profile.lifestyle.cookingHabits');
          case 'language': return UyDosh.t('compat.language');
          default: return '';
        }
      }

      function compatScaleLabel(keys, value) {
        const idx = Math.min(Math.max((Number(value) || 1) - 1, 0), keys.length - 1);
        return UyDosh.t(`profile.lifestyle.${keys[idx]}`);
      }

      function compatDayPreferenceLabel(value) {
        if (value === 'morning' || value === 'evening' || value === 'night') return UyDosh.t(`profile.lifestyle.${value}`);
        return UyDosh.t('profile.lifestyle.notSpecified');
      }

      const COMPAT_ENUM_FIELDS = {
        smoking_preference: { 'non-smoker': 'nonSmoker', occasional: 'occasionalSmoker', regular: 'regularSmoker' },
        alcohol_preference: { 'non-drinker': 'nonDrinker', occasional: 'occasionalDrinker', regular: 'regularDrinker' },
        pets_preference: { dont_like_pets: 'dontLikePets', like_pets: 'likePets', have_cat: 'haveCat', have_dog: 'haveDog' },
      };

      function compatFieldValueText(profile, labelKey) {
        switch (labelKey) {
          case 'cleanliness': return compatScaleLabel(['veryMessy', 'messy', 'average', 'clean', 'veryClean'], profile.cleanliness);
          case 'noise_level': return compatScaleLabel(['veryQuiet', 'quiet', 'average', 'loud', 'veryLoud'], profile.noise_level);
          case 'sociability': return compatScaleLabel(['veryIntroverted', 'introverted', 'balanced', 'extroverted', 'veryExtroverted'], profile.sociability);
          case 'guests': return UyDosh.t(profile.guests_allowed ? 'profile.lifestyle.guestsYes' : 'profile.lifestyle.guestsNo');
          case 'cooking_habits': return UyDosh.t(profile.cooking_habits ? 'profile.lifestyle.cook' : 'profile.lifestyle.dontCook');
          case 'smoking_preference':
          case 'alcohol_preference':
          case 'pets_preference': {
            const mapped = COMPAT_ENUM_FIELDS[labelKey][profile[labelKey]];
            return mapped ? UyDosh.t(`profile.lifestyle.${mapped}`) : UyDosh.t('profile.lifestyle.notSpecified');
          }
          default: return '';
        }
      }

      function compatLanguageName(code) {
        const names = { uz: 'O‘zbekcha', ru: 'Русский', en: 'English' };
        return names[code] || UyDosh.t('profile.lifestyle.notSpecified');
      }

      function compatGenderLabel(gender) {
        if (Number(gender) === 1) return UyDosh.t('compat.male');
        if (Number(gender) === 2) return UyDosh.t('compat.female');
        return UyDosh.t('profile.lifestyle.notSpecified');
      }

      function compatGenderPrefLabel(pref) {
        const p = typeof pref === 'string' ? pref.trim().toLowerCase() : '';
        if (p === 'any') return UyDosh.t('compat.any');
        if (p === 'male') return UyDosh.t('compat.male');
        if (p === 'female') return UyDosh.t('compat.female');
        return UyDosh.t('profile.lifestyle.notSpecified');
      }

      function compatAgeFromBirthYear(birthYear) {
        if (birthYear == null) return UyDosh.t('profile.lifestyle.notSpecified');
        const age = new Date().getFullYear() - Number(birthYear);
        if (age < 0 || age > 120) return UyDosh.t('profile.lifestyle.notSpecified');
        return String(age);
      }

      function compatRangeText(min, max) {
        if (min != null && max != null) return `${min}–${max}`;
        if (min != null) return `${min}+`;
        if (max != null) return `≤${max}`;
        return UyDosh.t('profile.lifestyle.notSpecified');
      }

      function addCompatSleepRows(current, owner, rows) {
        [['wakeup_time', 'sun', 'profile.lifestyle.wakeupTime'], ['sleep_time', 'moon', 'profile.lifestyle.sleepTime']]
          .forEach(([key, icon, labelI18nKey]) => {
            const a = current[key];
            const b = owner[key];
            if (a == null || b == null) return;
            const slotScore = UyDosh.dayPhaseSlotScore(a, b);
            const label = UyDosh.t(labelI18nKey);
            const currentText = compatDayPreferenceLabel(a);
            const ownerText = compatDayPreferenceLabel(b);
            if (slotScore != null && slotScore >= 0.75) {
              rows.matches.push({ icon, label, text: currentText });
            } else {
              rows.differences.push({ icon, label, currentText, ownerText });
            }
          });
      }

      function addCompatUniversityRow(current, owner, status, rows, universitiesById, lang) {
        if (current.university_id == null || owner.university_id == null || status === 'incomplete') return;
        const currentUni = universitiesById.get(Number(current.university_id));
        const ownerUni = universitiesById.get(Number(owner.university_id));
        const currentText = currentUni ? UyDosh.titleCaseWords(UyDosh.localized(currentUni, lang)) : '';
        const ownerText = ownerUni ? UyDosh.titleCaseWords(UyDosh.localized(ownerUni, lang)) : '';
        const label = UyDosh.t('profile.universityLabel');
        const icon = 'graduationCap';
        if (Number(current.university_id) === Number(owner.university_id)) {
          rows.matches.push({ icon, label, text: currentText || ownerText });
        } else {
          // Different schools still counts as a soft positive ("both students") — matches
          // the mobile app's ProfileMatchScoring university weight (0.55 partial score).
          rows.matches.push({ icon, label, text: `${currentText} ↔ ${ownerText}` });
        }
      }

      async function addCompatRegionRow(current, owner, status, rows, lang) {
        if (current.region_id == null || owner.region_id == null || status === 'incomplete') return;
        const icon = 'mapPin';
        const label = UyDosh.t('compat.region');
        const unknown = UyDosh.t('profile.lifestyle.notSpecified');
        try {
          const [currentRegion, ownerRegion] = await Promise.all([
            UyDosh.fetchRegion(current.region_id).catch(() => null),
            UyDosh.fetchRegion(owner.region_id).catch(() => null),
          ]);
          const currentText = currentRegion ? UyDosh.localizedShort(currentRegion, lang) : '';
          const ownerText = ownerRegion ? UyDosh.localizedShort(ownerRegion, lang) : '';
          if (status === 'match') {
            rows.matches.push({ icon, label, text: currentText || ownerText || unknown });
          } else {
            const bucket = status === 'dealbreaker' ? rows.dealbreakers : rows.differences;
            bucket.push({ icon, label, currentText: currentText || unknown, ownerText: ownerText || unknown });
          }
        } catch { /* region lookup failed — skip the row rather than show blanks */ }
      }

      function addCompatLookingForRow(current, owner, field, rows) {
        if (field.status === 'incomplete') return;
        let label; let icon; let currentText; let ownerText;
        if (field.labelKey === 'roommate_gender') {
          label = UyDosh.t('compat.dimGender'); icon = 'person';
          currentText = compatGenderPrefLabel(current.pref_roommate_gender);
          ownerText = compatGenderLabel(owner.gender);
        } else if (field.labelKey === 'age') {
          label = UyDosh.t('compat.dimAge'); icon = 'cake';
          currentText = compatRangeText(current.pref_age_min, current.pref_age_max);
          ownerText = compatAgeFromBirthYear(owner.birth_year);
        } else if (field.labelKey === 'budget') {
          label = UyDosh.t('compat.dimBudget'); icon = 'wallet';
          currentText = compatRangeText(current.budget_min, current.budget_max);
          ownerText = compatRangeText(owner.budget_min, owner.budget_max);
        } else {
          return;
        }
        if (field.status === 'match') {
          rows.matches.push({ icon, label, text: ownerText || currentText });
        } else if (field.status === 'dealbreaker') {
          rows.dealbreakers.push({ icon, label, currentText, ownerText });
        } else {
          rows.differences.push({ icon, label, currentText, ownerText });
        }
      }

      function addCompatStandardRow(field, current, owner, rows) {
        if (field.status === 'incomplete') return;
        const icon = compatFieldIcon(field.labelKey);
        const label = compatFieldLabel(field.labelKey);
        const currentText = field.labelKey === 'language'
          ? compatLanguageName(current.preferred_language)
          : compatFieldValueText(current, field.labelKey);
        const ownerText = field.labelKey === 'language'
          ? compatLanguageName(owner.preferred_language)
          : compatFieldValueText(owner, field.labelKey);
        if (field.status === 'match') {
          rows.matches.push({ icon, label, text: currentText });
        } else if (field.status === 'dealbreaker') {
          rows.dealbreakers.push({ icon, label, currentText, ownerText });
        } else {
          rows.differences.push({ icon, label, currentText, ownerText });
        }
      }

      async function buildCompatibilityBreakdown(current, owner, analysis, lang) {
        const rows = { matches: [], differences: [], dealbreakers: [] };
        const universityField = analysis.fields.find((f) => f.labelKey === 'university');
        let universitiesById = new Map();
        if (universityField && universityField.status !== 'incomplete') {
          try {
            const data = await UyDosh.fetchUniversitiesAll(lang);
            const list = Array.isArray(data?.universities) ? data.universities : [];
            universitiesById = new Map(list.map((u) => [Number(u.id), u]));
          } catch { /* ignore — university row is skipped if names can't resolve */ }
        }
        for (const field of analysis.fields) {
          switch (field.labelKey) {
            case 'sleep_schedule':
              addCompatSleepRows(current, owner, rows);
              break;
            case 'university':
              addCompatUniversityRow(current, owner, field.status, rows, universitiesById, lang);
              break;
            case 'region':
              await addCompatRegionRow(current, owner, field.status, rows, lang);
              break;
            case 'roommate_gender':
            case 'age':
            case 'budget':
              addCompatLookingForRow(current, owner, field, rows);
              break;
            default:
              addCompatStandardRow(field, current, owner, rows);
          }
        }
        return rows;
      }

      function compatRowHtml(row, dealbreaker) {
        const text = row.text != null
          ? `<b>${UyDosh.escapeHtml(row.label)}:</b> ${UyDosh.escapeHtml(row.text)}`
          : `<b>${UyDosh.escapeHtml(row.label)}:</b> ${UyDosh.escapeHtml(row.currentText)} ↔ ${UyDosh.escapeHtml(row.ownerText)}`;
        return `
          <div class="compat-row${dealbreaker ? ' is-dealbreaker' : ''}">
            <span class="icon" aria-hidden="true">${UyDosh.iconChrome(row.icon)}</span>
            <span class="compat-row-text">${text}</span>
          </div>
        `;
      }

      function compatGroupHtml(titleKey, rows, dealbreaker) {
        if (!rows.length) return '';
        return `
          <div class="compat-group">
            <p class="compat-group-title${dealbreaker ? ' is-dealbreaker' : ''}">${UyDosh.escapeHtml(UyDosh.t(titleKey))}</p>
            ${rows.map((r) => compatRowHtml(r, dealbreaker)).join('')}
          </div>
        `;
      }

      function renderCompatibilityIncomplete(bodyEl) {
        bodyEl.innerHTML = `
          <p class="compat-incomplete-text">${UyDosh.escapeHtml(UyDosh.t('compat.incompleteBody'))}</p>
          <a class="compat-cta-btn" href="${UyDosh.MINI_APP_PROFILE_PATH}">${UyDosh.escapeHtml(UyDosh.t('compat.completeCta'))}</a>
        `;
      }

      function renderCompatibilityResult(bodyEl, rows, analysis, showCompleteProfileCta) {
        const groups = [
          compatGroupHtml('compat.dealbreakers', rows.dealbreakers, true),
          compatGroupHtml('compat.matches', rows.matches, false),
          compatGroupHtml('compat.differences', rows.differences, false),
        ].join('');
        const basedOn = UyDosh.t('compat.basedOn')
          .replace('{scored}', String(analysis.scoredFieldCount))
          .replace('{total}', String(analysis.totalFieldCount));
        // Even with a computed score, a viewer whose own profile still has
        // gaps gets a "complete profile" nudge below the breakdown — filling
        // in the rest sharpens their match percentage across every listing.
        const cta = showCompleteProfileCta
          ? `<div class="compat-complete-cta"><a class="compat-cta-btn" href="${UyDosh.MINI_APP_PROFILE_PATH}">${UyDosh.escapeHtml(UyDosh.t('compat.completeCta'))}</a></div>`
          : '';
        bodyEl.innerHTML = `${groups}<p class="compat-based-on">${UyDosh.escapeHtml(basedOn)}</p>${cta}`;
      }

      async function loadCompatibilityTile(listing, isOwner) {
        const sectionEl = rootEl.querySelector('[data-compat-section]');
        if (!sectionEl || isOwner) return;
        const percentEl = rootEl.querySelector('[data-compat-percent]');
        const bodyEl = rootEl.querySelector('[data-compat-body]');
        const avatarOwnerEl = rootEl.querySelector('[data-compat-avatar-owner]');
        const avatarCurrentEl = rootEl.querySelector('[data-compat-avatar-current]');

        try {
          const sessionReady = await UyDosh.ensureTelegramMiniAppSession();
          if (!sessionReady) return;
          const viewerId = UyDosh.getSessionUserId();
          const ownerId = Number(listing.user_id ?? listing.user?.id);
          if (viewerId == null || !Number.isFinite(ownerId)) return;

          sectionEl.hidden = false;

          const fetchProfileOrEmpty = async (id) => {
            try {
              return await UyDosh.fetchProfile(id);
            } catch (err) {
              if (err?.status === 404) return {};
              throw err;
            }
          };

          const [currentProfile, ownerProfile] = await Promise.all([
            fetchProfileOrEmpty(viewerId),
            fetchProfileOrEmpty(ownerId),
          ]);

          setCompatAvatar(avatarCurrentEl, currentProfile);
          setCompatAvatar(avatarOwnerEl, ownerProfile);

          const analysis = UyDosh.computeProfileCompatibility(currentProfile, ownerProfile);
          const lang = UyDosh.getLang();

          if (analysis.scoredFieldCount === 0) {
            if (percentEl) {
              percentEl.textContent = UyDosh.t('compat.notAvailable');
              percentEl.className = 'compat-toggle-percent';
            }
            renderCompatibilityIncomplete(bodyEl);
            return;
          }

          if (percentEl) {
            percentEl.textContent = `${analysis.percent}%`;
            percentEl.className = `compat-toggle-percent ${compatPercentClass(analysis.percent)}`;
          }

          const rows = await buildCompatibilityBreakdown(currentProfile, ownerProfile, analysis, lang);
          const showCompleteProfileCta = !UyDosh.isProfileFullyPopulated(currentProfile);
          renderCompatibilityResult(bodyEl, rows, analysis, showCompleteProfileCta);
        } catch (err) {
          console.error('Failed to load compatibility', err);
          sectionEl.hidden = true;
        }
      }

