// Part of listing.html's detail-page script, split out of the former single
// ~2900-line assets/listing-detail.js for maintainability (that file is the
// highest-churn file in the site). Loaded as a plain classic <script defer>
// alongside the other listing-detail-*.js files and assets/listing-detail.js
// itself — they all share one global scope (like separate inline <script>
// blocks would), so functions defined here are called directly by the other
// modules and by listing-detail.js's render()/load(). See listing-detail.js
// for the overall module map.
//
// This file: the report button, complaint submission sheet, the owner-facing complaints list, the claim banner, and the complaints warning banner.
      // Reporting reuses the shared `/complaints` API (same one the mobile app
      // uses) — it needs a real logged-in identity, which on this static site
      // only Telegram provides, so the button only ever renders in the Mini App.
      /** Owners can't report their own listing (matches the mobile app, which hides this action for owners too). */
      function isViewingOwnListing() {
        const l = state.listing;
        if (!l) return false;
        const viewerId = UyDosh.getSessionUserId();
        const ownerId = Number(l.user_id ?? l.user?.id);
        return viewerId != null && Number.isFinite(ownerId) && ownerId === Number(viewerId);
      }

      function reportButtonHtml() {
        if (!UyDosh.isMiniApp() || isViewingOwnListing()) return '';
        return `
          <button type="button" class="gallery-report-btn" data-report-listing aria-label="${UyDosh.escapeHtml(UyDosh.t('detail.report'))}">
            ${UyDosh.iconFlag()}
          </button>
        `;
      }

      // --- Complaint (report) bottom sheet ---------------------------------

      const complaintBackdropEl = document.getElementById('complaint-backdrop');
      complaintBackdropEl?.addEventListener('click', (e) => {
        if (e.target === complaintBackdropEl) closeComplaintSheet();
      });
      const complaintState = {
        categories: null,
        categoriesPromise: null,
        listing: null,
        selectedCategoryId: null,
        detailsText: '',
        submitting: false,
      };

      function complaintCategoryName(category, lang) {
        if (lang === 'ru') return category.name_ru || category.nameRu || category.name_en || '';
        if (lang === 'uz') return category.name_uz || category.nameUz || category.name_en || '';
        return category.name_en || category.nameEn || category.name_uz || category.nameUz || '';
      }

      function extractComplaintCategories(payload) {
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.data)) return payload.data;
        if (Array.isArray(payload?.content)) return payload.content;
        return [];
      }

      function loadComplaintCategories() {
        if (complaintState.categories) return Promise.resolve(complaintState.categories);
        if (!complaintState.categoriesPromise) {
          complaintState.categoriesPromise = UyDosh.fetchComplaintCategories()
            .then((payload) => {
              complaintState.categories = extractComplaintCategories(payload);
              return complaintState.categories;
            })
            .catch((err) => {
              complaintState.categoriesPromise = null;
              throw err;
            });
        }
        return complaintState.categoriesPromise;
      }

      function closeComplaintSheet() {
        complaintBackdropEl.classList.remove('is-open');
        window.setTimeout(() => {
          complaintBackdropEl.hidden = true;
          complaintBackdropEl.setAttribute('aria-hidden', 'true');
          complaintBackdropEl.innerHTML = '';
        }, 180);
      }

      function complaintSheetShellHtml(bodyHtml) {
        const lang = UyDosh.getLang();
        return `
          <div class="complaint-sheet" role="dialog" aria-modal="true" aria-label="${UyDosh.escapeHtml(UyDosh.t('complaint.title', lang))}">
            <div class="complaint-sheet-header">
              <h2>${UyDosh.escapeHtml(UyDosh.t('complaint.title', lang))}</h2>
              <button type="button" class="complaint-close-btn" data-complaint-close aria-label="${UyDosh.escapeHtml(UyDosh.t('complaint.cancel', lang))}">✕</button>
            </div>
            ${bodyHtml}
          </div>
        `;
      }

      function renderComplaintLoading() {
        const lang = UyDosh.getLang();
        complaintBackdropEl.innerHTML = complaintSheetShellHtml(`
          <div class="complaint-status">${UyDosh.escapeHtml(UyDosh.t('complaint.loadingReasons', lang))}</div>
        `);
        bindComplaintCloseHandlers();
      }

      function renderComplaintError() {
        const lang = UyDosh.getLang();
        complaintBackdropEl.innerHTML = complaintSheetShellHtml(`
          <div class="complaint-status">${UyDosh.escapeHtml(UyDosh.t('complaint.loadError', lang))}</div>
          <div class="complaint-actions">
            <button type="button" class="complaint-submit-btn" data-complaint-retry>${UyDosh.escapeHtml(UyDosh.t('feed.retry', lang))}</button>
          </div>
        `);
        bindComplaintCloseHandlers();
        complaintBackdropEl.querySelector('[data-complaint-retry]')?.addEventListener('click', () => {
          openComplaintSheet(complaintState.listing);
        });
      }

      function renderComplaintForm(categories, errorMessage = '') {
        const lang = UyDosh.getLang();
        const reasonsHtml = categories.map((category, index) => {
          const id = category.id ?? index;
          const selected = complaintState.selectedCategoryId === id;
          return `
            <label class="complaint-reason-item${selected ? ' selected' : ''}" data-complaint-reason-item>
              <input type="radio" name="complaint-reason" value="${UyDosh.escapeHtml(String(id))}" ${selected ? 'checked' : ''} />
              <span>${UyDosh.escapeHtml(complaintCategoryName(category, lang))}</span>
            </label>
          `;
        }).join('');

        complaintBackdropEl.innerHTML = complaintSheetShellHtml(`
          <div class="complaint-body">
            ${errorMessage ? `<p class="complaint-error-text">${UyDosh.escapeHtml(errorMessage)}</p>` : ''}
            <div class="complaint-reason-list">${reasonsHtml}</div>
            <div class="complaint-field">
              <label for="complaint-details">${UyDosh.escapeHtml(UyDosh.t('complaint.detailsLabel', lang))}</label>
              <textarea id="complaint-details" data-complaint-details placeholder="${UyDosh.escapeHtml(UyDosh.t('complaint.detailsPlaceholder', lang))}" maxlength="1000">${UyDosh.escapeHtml(complaintState.detailsText)}</textarea>
            </div>
          </div>
          <div class="complaint-actions">
            <button type="button" class="complaint-submit-btn" data-complaint-submit ${complaintState.selectedCategoryId == null ? 'disabled' : ''}>
              ${UyDosh.escapeHtml(UyDosh.t(complaintState.submitting ? 'complaint.submitting' : 'complaint.submit', lang))}
            </button>
          </div>
        `);

        bindComplaintCloseHandlers();

        for (const item of complaintBackdropEl.querySelectorAll('[data-complaint-reason-item]')) {
          item.addEventListener('click', () => {
            const input = item.querySelector('input[type="radio"]');
            const value = input?.value;
            const numeric = Number(value);
            complaintState.selectedCategoryId = Number.isFinite(numeric) ? numeric : value;
            UyDosh.haptic.selection();
            for (const other of complaintBackdropEl.querySelectorAll('[data-complaint-reason-item]')) {
              other.classList.toggle('selected', other === item);
            }
            const submitBtn = complaintBackdropEl.querySelector('[data-complaint-submit]');
            if (submitBtn) submitBtn.disabled = false;
          });
        }

        complaintBackdropEl.querySelector('[data-complaint-submit]')?.addEventListener('click', () => {
          submitComplaint(categories);
        });
      }

      function bindComplaintCloseHandlers() {
        complaintBackdropEl.querySelector('[data-complaint-close]')?.addEventListener('click', () => {
          closeComplaintSheet();
        });
      }

      async function submitComplaint(categories) {
        if (complaintState.submitting || complaintState.selectedCategoryId == null) return;
        const lang = UyDosh.getLang();
        complaintState.submitting = true;
        const submitBtn = complaintBackdropEl.querySelector('[data-complaint-submit]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = UyDosh.t('complaint.submitting', lang);
        }
        const detailsEl = complaintBackdropEl.querySelector('[data-complaint-details]');
        complaintState.detailsText = detailsEl?.value ?? '';
        try {
          await UyDosh.createComplaint({
            listingId: complaintState.listing.id,
            categoryId: complaintState.selectedCategoryId,
            text: complaintState.detailsText,
          });
          UyDosh.haptic.success();
          closeComplaintSheet();
          showTelegramAlert(UyDosh.t('complaint.success', lang));
          UyDosh.logMiniAppEvent('listing_complaint_submitted', {
            listing_id: Number(complaintState.listing.id),
            category_id: Number(complaintState.selectedCategoryId),
            source: 'telegram_mini_app',
          });
        } catch (err) {
          console.error('Failed to submit complaint', err);
          UyDosh.haptic.error();
          complaintState.submitting = false;
          const message = err?.status === 409
            ? UyDosh.t('complaint.errorDuplicate', lang)
            : UyDosh.t('complaint.errorGeneric', lang);
          renderComplaintForm(categories, message);
          return;
        }
        complaintState.submitting = false;
      }

      /** Telegram-native alert when available (Telegram.WebApp.showAlert), else a plain browser alert(). */
      function showTelegramAlert(message) {
        const tg = window.Telegram?.WebApp;
        if (typeof tg?.showAlert === 'function') {
          tg.showAlert(message);
        } else {
          window.alert(message);
        }
      }

      async function openComplaintSheet(listing) {
        if (!listing) return;
        complaintState.listing = listing;
        complaintState.selectedCategoryId = null;
        complaintState.detailsText = '';
        complaintState.submitting = false;

        complaintBackdropEl.hidden = false;
        complaintBackdropEl.setAttribute('aria-hidden', 'false');
        renderComplaintLoading();
        requestAnimationFrame(() => complaintBackdropEl.classList.add('is-open'));

        const lang = UyDosh.getLang();
        const sessionReady = await UyDosh.ensureTelegramMiniAppSession();
        if (!sessionReady) {
          closeComplaintSheet();
          showTelegramAlert(UyDosh.t('complaint.errorAuth', lang));
          return;
        }

        try {
          const categories = await loadComplaintCategories();
          renderComplaintForm(categories);
        } catch (err) {
          console.error('Failed to load complaint categories', err);
          renderComplaintError();
        }
      }

      function bindReportButton(l) {
        const btn = rootEl.querySelector('[data-report-listing]');
        if (!btn) return;
        btn.addEventListener('click', () => {
          openComplaintSheet(l);
        });
      }

      // --- Claim scraped listing --------------------------------------------
      // Listings imported from Telegram channels are initially owned by a
      // shared "import" service account. If the Mini App viewer's own linked
      // Telegram identity matches the original poster (checked server-side —
      // see GET /listings/:id/claim-eligibility), we offer to transfer
      // ownership to them so they can manage it like any other listing.
      // Like the report/favorite buttons, this only ever renders in the Mini
      // App (claiming requires a verified Telegram session).

      /** Telegram-native confirm dialog when available, else a plain browser confirm(). */
      function confirmTelegramAction(message) {
        return new Promise((resolve) => {
          const tg = window.Telegram?.WebApp;
          if (typeof tg?.showConfirm === 'function') {
            tg.showConfirm(message, (confirmed) => resolve(!!confirmed));
          } else {
            resolve(window.confirm(message));
          }
        });
      }

      function claimBannerHtml() {
        if (!UyDosh.isMiniApp()) return '';
        return `
          <div class="claim-banner" data-claim-banner hidden>
            <div class="claim-banner-card">
              <span class="claim-banner-icon" aria-hidden="true">${UyDosh.iconChrome('checkCircle')}</span>
              <div class="claim-banner-text">
                <p class="claim-banner-title">${UyDosh.escapeHtml(UyDosh.t('detail.claim.title'))}</p>
                <p class="claim-banner-subtitle">${UyDosh.escapeHtml(UyDosh.t('detail.claim.subtitle'))}</p>
              </div>
              <button type="button" class="claim-banner-btn" data-claim-listing>
                <span data-claim-btn-label>${UyDosh.escapeHtml(UyDosh.t('detail.claim.button'))}</span>
              </button>
            </div>
          </div>
        `;
      }

      async function loadClaimBanner(listing) {
        const wrapEl = rootEl.querySelector('[data-claim-banner]');
        if (!wrapEl) return;
        try {
          const sessionReady = await UyDosh.ensureTelegramMiniAppSession();
          if (!sessionReady) return;
          const status = await UyDosh.checkListingClaimEligibility(listing.id);
          if (!status?.eligible) return;
          wrapEl.hidden = false;

          const btn = wrapEl.querySelector('[data-claim-listing]');
          const labelEl = wrapEl.querySelector('[data-claim-btn-label]');
          let pending = false;
          btn?.addEventListener('click', async () => {
            if (pending) return;
            const confirmed = await confirmTelegramAction(UyDosh.t('detail.claim.confirm'));
            if (!confirmed) return;

            pending = true;
            btn.disabled = true;
            if (labelEl) labelEl.textContent = UyDosh.t('detail.claim.pending');
            try {
              const result = await UyDosh.claimListing(listing.id);
              UyDosh.haptic.success();
              if (result?.listing) state.listing = result.listing;
              showTelegramAlert(UyDosh.t('detail.claim.success'));
              render();
            } catch (err) {
              console.error('Failed to claim listing', err);
              UyDosh.haptic.error();
              showTelegramAlert(err?.payload?.error || UyDosh.t('detail.claim.error'));
              pending = false;
              btn.disabled = false;
              if (labelEl) labelEl.textContent = UyDosh.t('detail.claim.button');
            }
          });
        } catch (err) {
          console.error('Failed to check listing claim eligibility', err);
        }
      }

      // --- Complaints warning + grouped-by-user complaints list -----------
      // Mirrors the mobile app's ListingDetailComplaintsCard: a warning button
      // that only appears once a listing actually has complaints, opening a
      // sheet listing them grouped by whoever reported them (with avatars).
      // The underlying data is public (no auth), but — like the report button
      // above — this only renders inside the Mini App.

      function complaintsWarningIconHtml() {
        return `
          <span class="icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"></circle>
              <rect x="10.85" y="5.5" width="2.3" height="8.5" rx="1.15" fill="#fff"></rect>
              <rect x="10.85" y="16" width="2.3" height="2.3" rx="1.15" fill="#fff"></rect>
            </svg>
          </span>
        `;
      }

      function complaintsWarningHtml() {
        if (!UyDosh.isMiniApp()) return '';
        return `
          <div class="complaints-warning" data-complaints-warning hidden>
            <button type="button" class="complaints-warning-btn" data-view-complaints>
              ${complaintsWarningIconHtml()}
              <span data-complaints-warning-label></span>
            </button>
          </div>
        `;
      }

      async function loadComplaintsWarning(listing) {
        const wrapEl = rootEl.querySelector('[data-complaints-warning]');
        if (!wrapEl) return;
        try {
          const res = await UyDosh.fetchListingComplaintsCount(listing.id);
          const count = Number(res?.data?.count) || 0;
          if (count <= 0) return;
          const labelEl = wrapEl.querySelector('[data-complaints-warning-label]');
          if (labelEl) labelEl.textContent = UyDosh.listingComplaintsCountText(count, UyDosh.getLang());
          wrapEl.hidden = false;
          wrapEl.querySelector('[data-view-complaints]')?.addEventListener('click', () => {
            openComplaintsListSheet(listing.id);
          });
        } catch (err) {
          console.error('Failed to load listing complaints count', err);
        }
      }

      const listingComplaintsBackdropEl = document.getElementById('listing-complaints-backdrop');
      listingComplaintsBackdropEl?.addEventListener('click', (e) => {
        if (e.target === listingComplaintsBackdropEl) closeComplaintsListSheet();
      });

      function closeComplaintsListSheet() {
        listingComplaintsBackdropEl.classList.remove('is-open');
        window.setTimeout(() => {
          listingComplaintsBackdropEl.hidden = true;
          listingComplaintsBackdropEl.setAttribute('aria-hidden', 'true');
          listingComplaintsBackdropEl.innerHTML = '';
        }, 180);
      }

      function complaintsListSheetShellHtml(bodyHtml) {
        const lang = UyDosh.getLang();
        return `
          <div class="complaint-sheet" role="dialog" aria-modal="true" aria-label="${UyDosh.escapeHtml(UyDosh.t('complaints.title', lang))}">
            <div class="complaint-sheet-header">
              <h2>${UyDosh.escapeHtml(UyDosh.t('complaints.title', lang))}</h2>
              <button type="button" class="complaint-close-btn" data-complaints-close aria-label="${UyDosh.escapeHtml(UyDosh.t('complaint.cancel', lang))}">✕</button>
            </div>
            ${bodyHtml}
          </div>
        `;
      }

      function bindComplaintsListCloseHandlers() {
        listingComplaintsBackdropEl.querySelector('[data-complaints-close]')?.addEventListener('click', () => {
          closeComplaintsListSheet();
        });
      }

      function renderComplaintsListLoading() {
        listingComplaintsBackdropEl.innerHTML = complaintsListSheetShellHtml(`
          <div class="complaint-body">
            <div class="complaints-list-status">${UyDosh.escapeHtml(UyDosh.t('complaints.loading'))}</div>
          </div>
        `);
        bindComplaintsListCloseHandlers();
      }

      function renderComplaintsListError(listingId) {
        listingComplaintsBackdropEl.innerHTML = complaintsListSheetShellHtml(`
          <div class="complaint-body">
            <div class="complaints-list-status">${UyDosh.escapeHtml(UyDosh.t('complaints.loadError'))}</div>
          </div>
          <div class="complaint-actions">
            <button type="button" class="complaint-submit-btn" data-complaints-retry>${UyDosh.escapeHtml(UyDosh.t('feed.retry'))}</button>
          </div>
        `);
        bindComplaintsListCloseHandlers();
        listingComplaintsBackdropEl.querySelector('[data-complaints-retry]')?.addEventListener('click', () => {
          openComplaintsListSheet(listingId);
        });
      }

      /** Groups complaints by whoever filed them, most-recently-complaining user first. */
      function groupComplaintsByComplainant(complaints) {
        const groups = [];
        const byKey = new Map();
        for (const complaint of complaints) {
          const complainant = complaint?.complainant || null;
          const key = complainant?.id ?? `anon-${complaint.id}`;
          let group = byKey.get(key);
          if (!group) {
            group = { complainant, items: [] };
            byKey.set(key, group);
            groups.push(group);
          }
          group.items.push(complaint);
        }
        for (const group of groups) {
          group.items.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        }
        groups.sort((a, b) => new Date(b.items[0]?.created_at || 0) - new Date(a.items[0]?.created_at || 0));
        return groups;
      }

      function complaintsGroupHtml(group, lang) {
        const name = String(group.complainant?.profile?.name || '').trim() || UyDosh.t('complaints.anonymous', lang);
        const avatarUrl = group.complainant?.profile?.avatar_url ? UyDosh.photoUrl(group.complainant.profile.avatar_url) : '';
        const initial = name.charAt(0).toUpperCase() || '?';
        const avatarHtml = `
          ${avatarUrl ? `<img src="${UyDosh.escapeHtml(avatarUrl)}" alt="" referrerpolicy="no-referrer" onerror="this.remove();" />` : ''}
          <span>${UyDosh.escapeHtml(initial)}</span>
        `;
        const entriesHtml = group.items.map((complaint) => {
          const categoryLabel = complaint.category ? complaintCategoryName(complaint.category, lang) : '';
          const text = String(complaint.text || '').trim();
          const date = complaint.created_at ? UyDosh.formatDate(complaint.created_at, lang) : '';
          return `
            <div class="complaints-entry">
              ${categoryLabel ? `<div class="complaints-entry-category">${UyDosh.escapeHtml(categoryLabel)}</div>` : ''}
              ${text ? `<div class="complaints-entry-text">${UyDosh.escapeHtml(text)}</div>` : ''}
              ${date ? `<div class="complaints-entry-date">${UyDosh.escapeHtml(date)}</div>` : ''}
            </div>
          `;
        }).join('');
        return `
          <div class="complaints-group">
            <div class="complaints-group-header">
              <div class="complaints-avatar">${avatarHtml}</div>
              <div class="complaints-group-name">${UyDosh.escapeHtml(name)}</div>
              ${group.items.length > 1 ? `<span class="complaints-count-badge">${group.items.length}</span>` : ''}
            </div>
            ${entriesHtml}
          </div>
        `;
      }

      function renderComplaintsList(complaints) {
        const lang = UyDosh.getLang();
        if (!complaints.length) {
          listingComplaintsBackdropEl.innerHTML = complaintsListSheetShellHtml(`
            <div class="complaint-body">
              <div class="complaints-list-status">${UyDosh.escapeHtml(UyDosh.t('complaints.empty', lang))}</div>
            </div>
          `);
          bindComplaintsListCloseHandlers();
          return;
        }
        const groups = groupComplaintsByComplainant(complaints);
        const groupsHtml = groups.map((group) => complaintsGroupHtml(group, lang)).join('');
        listingComplaintsBackdropEl.innerHTML = complaintsListSheetShellHtml(`
          <div class="complaint-body">${groupsHtml}</div>
        `);
        bindComplaintsListCloseHandlers();
      }

      async function openComplaintsListSheet(listingId) {
        listingComplaintsBackdropEl.hidden = false;
        listingComplaintsBackdropEl.setAttribute('aria-hidden', 'false');
        renderComplaintsListLoading();
        requestAnimationFrame(() => listingComplaintsBackdropEl.classList.add('is-open'));

        try {
          const res = await UyDosh.fetchListingComplaints(listingId, { limit: 100 });
          const complaints = Array.isArray(res?.data) ? res.data : [];
          renderComplaintsList(complaints);
        } catch (err) {
          console.error('Failed to load listing complaints', err);
          renderComplaintsListError(listingId);
        }
      }

