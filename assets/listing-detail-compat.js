// Part of listing.html's detail-page script, split out of the former single
// ~2900-line assets/listing-detail.js for maintainability (that file is the
// highest-churn file in the site). Loaded as a plain classic <script defer>
// alongside the other listing-detail-*.js files and assets/listing-detail.js
// itself — they all share one global scope (like separate inline <script>
// blocks would), so functions defined here are called directly by the other
// modules and by listing-detail.js's render()/load(). See listing-detail.js
// for the overall module map.
//
// This file: lifestyle compatibility on listing.html.
// Pair mode: viewer vs owner (hidden from the owner).
// Group mode: preference matrix for group_forming listings with 2+ members
// (shown to owners too — same as the Flutter listing detail screen).

      function isGroupCompatListing(listing) {
        const ctx = typeof listingGroupContext === 'function' ? listingGroupContext(listing) : listing?.group_context;
        if (!ctx?.is_group_forming) return false;
        return (Number(ctx.group_member_count) || 0) >= 2;
      }

      function compatibilityTileHtml(listing, isOwner) {
        if (!UyDosh.isMiniApp()) return '';
        const isGroup = isGroupCompatListing(listing);
        if (isOwner && !isGroup) return '';
        const label = isGroup ? UyDosh.t('compat.groupTitle') : UyDosh.t('compat.title');
        return `
          <div class="compat-section${isGroup ? ' is-group' : ''}" data-compat-section data-compat-mode="${isGroup ? 'group' : 'pair'}" aria-expanded="false" hidden>
            <button type="button" class="compat-toggle" data-compat-toggle aria-expanded="false">
              <span class="compat-avatars" aria-hidden="true" data-compat-avatars>
                <span class="compat-avatar" data-compat-avatar-owner>${UyDosh.iconChrome('person')}</span>
                <span class="compat-avatar" data-compat-avatar-current>${UyDosh.iconChrome('person')}</span>
              </span>
              <span class="compat-toggle-title">
                <span class="compat-toggle-label">${UyDosh.escapeHtml(label)}</span>
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
          case 'wakeup_time': return UyDosh.t('profile.lifestyle.wakeupTime');
          case 'sleep_time': return UyDosh.t('profile.lifestyle.sleepTime');
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
        return UyDosh.languageLabelWithFlag(code) || UyDosh.t('profile.lifestyle.notSpecified');
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

      async function fetchProfileOrEmpty(id) {
        try {
          return await UyDosh.fetchProfile(id);
        } catch (err) {
          if (err?.status === 404) return {};
          throw err;
        }
      }

      function firstName(name) {
        const raw = String(name || '').trim();
        if (!raw) return UyDosh.t('complaints.anonymous');
        return raw.split(/\s+/)[0];
      }

      function renderGroupAvatars(members) {
        const wrap = rootEl.querySelector('[data-compat-avatars]');
        if (!wrap) return;
        const shown = members.slice(0, 4);
        wrap.style.width = `${28 + Math.max(0, shown.length - 1) * 14}px`;
        wrap.innerHTML = shown.map((member, idx) => {
          const z = shown.length - idx;
          return `<span class="compat-avatar" style="left:${idx * 14}px;z-index:${z}"></span>`;
        }).join('');
        [...wrap.querySelectorAll('.compat-avatar')].forEach((el, idx) => {
          setCompatAvatar(el, members[idx]);
        });
      }

      function groupMatrixCellClass(status) {
        switch (status) {
          case 'fullMatch':
          case 'partialMatch': return 'is-match';
          case 'mismatch': return 'is-partial';
          case 'conflict': return 'is-conflict';
          default: return 'is-missing';
        }
      }

      function splitCompatReportSentences(text) {
        const sentences = [];
        let start = 0;
        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          if (char !== '.' && char !== '!' && char !== '?') continue;
          const next = i + 1;
          if (next < text.length && text[next].trim()) continue;
          const sentence = text.slice(start, next).trim();
          if (sentence) sentences.push(sentence);
          start = next;
          while (start < text.length && !text[start].trim()) start += 1;
          i = start - 1;
        }
        const trailing = text.slice(start).trim();
        if (trailing) sentences.push(trailing);
        return sentences;
      }

      function formatCompatReportForReadability(text) {
        const normalized = String(text || '')
          .replace(/\r\n?/g, '\n')
          .replace(/[ \t]+\n/g, '\n')
          .replace(/\n[ \t]+/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        if (!normalized) return '';
        if (/\n\s*\n/.test(normalized)) return normalized;
        const sentences = splitCompatReportSentences(normalized);
        return sentences.length <= 1 ? normalized : sentences.join('\n\n');
      }

      function formatCompatReportHtml(text) {
        const readable = formatCompatReportForReadability(text);
        if (!readable) return '';
        const withBold = renderCompatReportBold(readable);
        return withBold
          .split(/\n\s*\n/)
          .filter(Boolean)
          .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
          .join('');
      }

      /** Turns `**Name**` (and the unicode asterisk variants models sometimes
       *  emit) into `<strong>Name</strong>`. Parses the raw string first, then
       *  HTML-escapes each span, so a failed regex never leaves literal
       *  asterisks on screen. */
      function renderCompatReportBold(text) {
        const re = /[*∗＊]{2}\s*([^*∗＊]+?)\s*[*∗＊]{2}/g;
        let out = '';
        let cursor = 0;
        let match;
        while ((match = re.exec(text))) {
          out += UyDosh.escapeHtml(text.slice(cursor, match.index));
          out += `<strong>${UyDosh.escapeHtml(match[1].trim())}</strong>`;
          cursor = match.index + match[0].length;
        }
        out += UyDosh.escapeHtml(text.slice(cursor));
        return out.replace(/[*∗＊]{2}/g, '');
      }

      function groupCompatReportInnerHtml(report) {
        const body = formatCompatReportHtml(report);
        if (!body) return '';
        return `
          <p class="compat-group-report-title">
            <span class="icon" aria-hidden="true">${UyDosh.iconChrome('sparkles')}</span>
            <span>${UyDosh.escapeHtml(UyDosh.t('compat.groupReportTitle'))}</span>
          </p>
          <div class="compat-group-report-body">${body}</div>
        `;
      }

      function applyGroupCompatReport(bodyEl, report) {
        const slot = bodyEl.querySelector('[data-compat-group-report]');
        if (!slot) return false;
        const inner = groupCompatReportInnerHtml(report);
        if (!inner) {
          slot.hidden = true;
          slot.innerHTML = '';
          return false;
        }
        slot.hidden = false;
        slot.innerHTML = inner;
        return true;
      }

      function renderGroupCompatibilityBody(bodyEl, { members, result, matrix, report }) {
        const header = `
          <div class="compat-matrix-users" style="grid-template-columns:repeat(${members.length}, minmax(0, 1fr))">
            ${members.map((m) => `
              <div class="compat-matrix-user">
                <span class="compat-matrix-user-avatar" data-matrix-avatar="${m.user_id}"></span>
                <span class="compat-matrix-user-name">${UyDosh.escapeHtml(firstName(m.name))}</span>
              </div>
            `).join('')}
          </div>
        `;
        const rows = matrix.map((row) => `
          <div class="compat-matrix-row">
            <div class="compat-matrix-label">
              <span class="icon">${UyDosh.iconChrome(compatFieldIcon(row.labelKey) || 'list')}</span>
              <span>${UyDosh.escapeHtml(row.label)}</span>
            </div>
            <div class="compat-matrix-cells" style="grid-template-columns:repeat(${members.length}, minmax(0, 1fr))">
              ${row.cells.map((cell) => `
                <div class="compat-matrix-cell ${groupMatrixCellClass(cell.status)}">${UyDosh.escapeHtml(cell.value)}</div>
              `).join('')}
            </div>
          </div>
        `).join('');

        const summaryBits = [];
        if (result.fullMatches.length) {
          summaryBits.push(`<span class="is-match">${result.fullMatches.length}</span> ${UyDosh.escapeHtml(UyDosh.t('compat.groupSummaryFull'))}`);
        }
        if (result.partialMatches.length) {
          summaryBits.push(`<span class="is-partial">${result.partialMatches.length}</span> ${UyDosh.escapeHtml(UyDosh.t('compat.groupSummaryPartial'))}`);
        }
        if (result.discussItems.length) {
          summaryBits.push(`<span class="is-conflict">${result.discussItems.length}</span> ${UyDosh.escapeHtml(UyDosh.t('compat.groupSummaryDiscuss'))}`);
        }
        const summary = summaryBits.length
          ? `<p class="compat-group-summary">${summaryBits.join(' · ')}</p>`
          : '';
        const reportInner = groupCompatReportInnerHtml(report);

        bodyEl.innerHTML = `
          <p class="compat-matrix-title">${UyDosh.escapeHtml(UyDosh.t('compat.groupMatrixTitle'))}</p>
          <p class="compat-matrix-subtitle">${UyDosh.escapeHtml(UyDosh.t('compat.groupMatrixSubtitle'))}</p>
          <div class="compat-matrix">
            ${header}
            ${rows}
          </div>
          <div class="compat-group-report" data-compat-group-report${reportInner ? '' : ' hidden'}>${reportInner}</div>
          ${summary}
        `;
        bodyEl.querySelectorAll('[data-matrix-avatar]').forEach((el) => {
          const id = Number(el.getAttribute('data-matrix-avatar'));
          const member = members.find((m) => Number(m.user_id) === id);
          setCompatAvatar(el, member);
        });
      }

      async function maybeRefreshGroupCompatReport(listingId, bodyEl) {
        const delays = [2500, 4000];
        for (const ms of delays) {
          await new Promise((resolve) => setTimeout(resolve, ms));
          if (!bodyEl.isConnected) return;
          const slot = bodyEl.querySelector('[data-compat-group-report]');
          if (!slot || !slot.hidden) return;
          try {
            const fresh = await UyDosh.fetchListing(listingId);
            const report = String(fresh?.group_compatibility_report || '').trim();
            if (report) {
              applyGroupCompatReport(bodyEl, report);
              return;
            }
          } catch { /* first GET still generating — try again */ }
        }
      }

      async function loadGroupCompatibilityTile(listing) {
        const sectionEl = rootEl.querySelector('[data-compat-section]');
        const percentEl = rootEl.querySelector('[data-compat-percent]');
        const bodyEl = rootEl.querySelector('[data-compat-body]');
        if (!sectionEl || !bodyEl) return;

        try {
          const sessionReady = await UyDosh.ensureTelegramMiniAppSession();
          if (!sessionReady) return;

          const membersRaw = await UyDosh.fetchListingGroupMembers(listing.id);
          const ownerId = Number(listing.user_id ?? listing.user?.id);
          const members = [...membersRaw].sort((a, b) => {
            if (Number(a.user_id) === ownerId) return -1;
            if (Number(b.user_id) === ownerId) return 1;
            return 0;
          });
          if (members.length < 2) {
            sectionEl.hidden = true;
            return;
          }

          const profiles = await Promise.all(members.map(async (member) => {
            const profile = await fetchProfileOrEmpty(member.user_id);
            return {
              ...profile,
              user_id: member.user_id,
              avatar_url: profile.avatar_url || member.avatar_url,
              name: profile.name || member.name,
            };
          }));

          sectionEl.hidden = false;
          sectionEl.setAttribute('aria-expanded', 'true');
          const toggle = rootEl.querySelector('[data-compat-toggle]');
          if (toggle) toggle.setAttribute('aria-expanded', 'true');
          bodyEl.hidden = false;
          renderGroupAvatars(profiles);
          const result = UyDosh.calculateGroupCompatibility(profiles);
          const matrix = UyDosh.buildGroupPreferenceMatrix(profiles);
          if (percentEl) {
            if (result.percent == null) {
              percentEl.textContent = UyDosh.t('compat.notAvailable');
              percentEl.className = 'compat-toggle-percent';
            } else {
              percentEl.textContent = `${result.percent}%`;
              percentEl.className = `compat-toggle-percent ${compatPercentClass(result.percent)}`;
            }
          }
          const report = String(listing.group_compatibility_report || '').trim();
          renderGroupCompatibilityBody(bodyEl, {
            members: profiles,
            result,
            matrix,
            report,
          });
          if (!report) {
            void maybeRefreshGroupCompatReport(listing.id, bodyEl);
          }
        } catch (err) {
          console.error('Failed to load group compatibility', err);
          sectionEl.hidden = true;
        }
      }

      async function loadCompatibilityTile(listing, isOwner) {
        const sectionEl = rootEl.querySelector('[data-compat-section]');
        if (!sectionEl) return;
        if (isGroupCompatListing(listing)) {
          return loadGroupCompatibilityTile(listing);
        }
        if (isOwner) return;
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


