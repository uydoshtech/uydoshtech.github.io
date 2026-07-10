// Extracted from listing.html's inline <script> block — moved to an external,
// deferrable, cacheable file (see the <script defer> tag in listing.html)
// instead of ~2400 lines of JS re-parsed inline on every page load.
      document.getElementById('y').textContent = new Date().getFullYear();
      UyDosh.initTelegramMiniApp();

      // Custom back link hidden in Mini App — Telegram BackButton handles navigation.
      // document.querySelector('[data-mini-app-back]')?.addEventListener('click', () => {
      //   if (!UyDosh.isMiniApp()) return;
      //   window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
      // });

      if (UyDosh.isMiniApp()) {
        const webApp = window.Telegram?.WebApp;
        webApp?.MainButton?.hide();
        webApp?.BackButton?.show();
        webApp?.BackButton?.onClick(() => {
          UyDosh.haptic.light();
          // The 3D room scan fullscreen overlay has its own close button but
          // isn't wired into the Telegram header BackButton — without this
          // check, tapping BackButton while it's open would skip past the
          // listing detail screen straight to the feed instead of just
          // closing the overlay.
          if (closeRoomScanFullscreenIfOpen()) return;
          location.href = UyDosh.miniAppBackTargetFromUrl();
        });
      }

      // Owner-only "views" toolbar (see `ownerToolbarHtml`/`loadOwnerViewCount`) needs
      // the viewer's own app user id up front — resolved as a side effect of
      // establishing the Mini App session, which also lets the fetch below carry a
      // Bearer token so an owner can open their own not-yet-approved listing.
      async function ensureViewerIdentity() {
        if (!UyDosh.isMiniApp()) return;
        await UyDosh.ensureTelegramMiniAppSession();
      }

      const detailContactBarEl = document.getElementById('detail-contact-bar');

      function hideDetailContactBar() {
        if (!detailContactBarEl) return;
        detailContactBarEl.hidden = true;
        detailContactBarEl.setAttribute('aria-hidden', 'true');
        detailContactBarEl.innerHTML = '';
        document.documentElement.classList.remove('has-detail-contact');
      }

      function updateDetailContactBar(listing) {
        if (!detailContactBarEl || !UyDosh.isMiniApp()) {
          hideDetailContactBar();
          return;
        }
        const handle = UyDosh.listingContactTelegram(listing);
        const phone = UyDosh.listingContactPhone(listing);
        if (!handle && !phone) {
          hideDetailContactBar();
          return;
        }
        detailContactBarEl.innerHTML = UyDosh.detailContactBarHtml(handle, phone);
        detailContactBarEl.hidden = false;
        detailContactBarEl.setAttribute('aria-hidden', 'false');
        document.documentElement.classList.add('has-detail-contact');
        const prefillText = handle ? buildListingContactMessage(listing, UyDosh.getLang()) : '';
        UyDosh.bindDetailContactBar(detailContactBarEl, { listingId: listing?.id, prefillText });
        UyDosh.applyI18n(detailContactBarEl);
      }

      const APK_URL = 'https://github.com/uydoshtech/uydoshtech.github.io/releases/latest/download/app-release.apk';

      // `https://api.uydosh.com/listing/id` is the mobile app's own share
      // link (DeepLinkService.buildListingDeepLink) and is registered for
      // Universal/App Links, so tapping it opens the native app. Sharing
      // from the web (Mini App or the plain website) must always stay in
      // the web experience instead, so it deliberately uses a different
      // link — the bot's `t.me` Mini App deep link — for every share
      // originating here, not just inside the Mini App itself.
      const SHARE_WEB_BASE = 'https://api.uydosh.com';
      const TELEGRAM_BOT_USERNAME = 'uydosh_bot';

      function buildListingShareUrl(id) {
        return `https://t.me/${TELEGRAM_BOT_USERNAME}?startapp=listing_${encodeURIComponent(id)}`;
      }

      function buildListingShareText(l, lang) {
        const title = l.title || '';
        const price = UyDosh.formatPrice(l, lang);
        const priceLine = price ? `\n💰 ${price}${UyDosh.t('card.perMonth')}` : '';
        return `${title}${priceLine}`;
      }

      // Prefills the Telegram compose box (via `?text=`) when a guest taps
      // "Contact on Telegram" on the detail screen, so the host immediately
      // knows which listing the message refers to instead of a blank chat.
      // Laid out as short paragraphs with icons (greeting / facts / link)
      // rather than one run-on line, to read like a real message.
      function buildListingContactMessage(l, lang) {
        const title = l.title || `#${l.id}`;
        const price = UyDosh.formatPrice(l, lang);
        const district = UyDosh.localized(l.location, lang);

        const factLines = [`📌 ${title}`];
        if (price) factLines.push(`💰 ${price}${UyDosh.t('card.perMonth', lang)}`);
        if (district) factLines.push(`📍 ${district}`);

        const greeting = UyDosh.t('detail.contactMessage', lang);
        const link = buildListingShareUrl(l.id);
        return [greeting, factLines.join('\n'), `🔗 ${link}`].join('\n\n');
      }

      // `https://api.uydosh.com/listing/id?preview=photo` link used purely
      // for its server-rendered Open Graph tags — its `og:image` is the
      // listing's own primary photo. Used to unfurl a real photo into the
      // shared message whenever we *aren't* also attaching real photos as
      // native share attachments (see `shareListingLink`'s `linkPreviewUrl`
      // param), so the message never goes out with no image at all.
      //
      // A plain `https://api.uydosh.com/...` URL (rather than `t.me`, which
      // Telegram never crawls for Open Graph tags) is required here for the
      // unfurl to work at all — but since this same link is also what ends
      // up as the *visible* tappable text in the sent message (see
      // `shareListingLink`'s `linkToUnfurl`), the `?preview=photo` marker
      // tells the backend's `deepLinkRoutes.ts` that this tap, too,
      // originated from a web share and should stay on the web (bot Mini
      // App) instead of racing the native app scheme.
      function buildListingLinkPreviewUrl(id) {
        return `${SHARE_WEB_BASE}/listing/${encodeURIComponent(id)}?preview=photo`;
      }

      // `?preview=map` swaps that same Open Graph image for a static map of
      // the listing's location instead of a photo — paired with the real
      // photos already going out as attachments (see `shareListingLink`'s
      // `mapPreviewUrl` param), so the link preview adds new information
      // instead of repeating one.
      function buildListingMapPreviewUrl(id) {
        return `${SHARE_WEB_BASE}/listing/${encodeURIComponent(id)}?preview=map`;
      }

      function bindShareButton(l) {
        const btn = rootEl.querySelector('[data-share-listing]');
        if (!btn) return;
        btn.addEventListener('click', async () => {
          const lang = UyDosh.getLang();
          const url = buildListingShareUrl(l.id);
          const text = buildListingShareText(l, lang);
          const photoUrls = sortedPhotos(l).map((p) => UyDosh.photoUrl(p)).filter(Boolean);
          const mapPreviewUrl = buildListingMapPreviewUrl(l.id);
          const linkPreviewUrl = buildListingLinkPreviewUrl(l.id);
          const method = await UyDosh.shareListingLink(url, text, photoUrls, mapPreviewUrl, linkPreviewUrl);
          if (UyDosh.isMiniApp()) {
            UyDosh.logMiniAppEvent('listing_share_tapped', {
              listing_id: Number(l.id),
              source: 'telegram_mini_app',
              share_method: method || 'unknown',
            });
          }
        });
      }

      const params = new URLSearchParams(location.search);
      const listingId = params.get('id');

      if (listingId && !UyDosh.isMiniApp()) {
        UyDosh.tryOpenListingInApp(listingId);
      }

      const rootEl = document.getElementById('root');

      const state = {
        listing: null,
        photos: [],
        photoIdx: 0,
        mapExpanded: false,
        mapLoaded: false,
        mapLoading: false,
        // Bumped each time `refineMetroStationWalkTimes` runs so a stale
        // in-flight Router lookup from a previous mount can't clobber a
        // newer one — see there for why this only ever runs once per mount.
        metroWalkRefineToken: 0,
        // Station ids whose "draw route" button (see
        // `bindMetroStationRouteButtons`) is currently toggled on — each one
        // gets its own route drawn simultaneously (see `setPinGuideLines`),
        // unlike a radio group where picking one clears the rest.
        activeMetroStationRouteIds: new Set(),
        // `render()` re-runs on language change, so this guards against
        // recording the same page visit as multiple views.
        viewRecorded: false,
      };

      const GALLERY_AUTO_MS = 3000;
      const GALLERY_AUTO_RESUME_MS = 5000;
      let galleryAutoplayTimer = null;
      let galleryAutoplayResumeTimer = null;
      let galleryScrollRaf = null;
      const galleryReduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

      function stopGalleryAutoplay() {
        if (galleryAutoplayTimer) {
          clearInterval(galleryAutoplayTimer);
          galleryAutoplayTimer = null;
        }
        if (galleryAutoplayResumeTimer) {
          clearTimeout(galleryAutoplayResumeTimer);
          galleryAutoplayResumeTimer = null;
        }
      }

      function startGalleryAutoplay() {
        stopGalleryAutoplay();
        if (state.photos.length <= 1 || galleryReduceMotion) return;
        galleryAutoplayTimer = window.setInterval(() => {
          scrollGalleryTo((state.photoIdx + 1) % state.photos.length);
        }, GALLERY_AUTO_MS);
      }

      function pauseGalleryAutoplay(resumeAfterMs = GALLERY_AUTO_RESUME_MS) {
        stopGalleryAutoplay();
        if (state.photos.length <= 1 || galleryReduceMotion) return;
        galleryAutoplayResumeTimer = window.setTimeout(startGalleryAutoplay, resumeAfterMs);
      }

      function syncGalleryDots() {
        for (const dot of rootEl.querySelectorAll('[data-gallery-dot]')) {
          const i = Number(dot.getAttribute('data-gallery-dot'));
          dot.setAttribute('aria-current', String(i === state.photoIdx));
        }
      }

      function syncGalleryCounter() {
        const counterEl = rootEl.querySelector('.gallery .counter');
        if (counterEl) counterEl.textContent = `${state.photoIdx + 1} / ${state.photos.length}`;
      }

      function galleryScrollLeftForIndex(track, index) {
        const width = track.clientWidth;
        if (width > 0) return Math.round(width * index);
        const slide = track.querySelector(`[data-gallery-slide="${index}"]`);
        return slide?.offsetLeft ?? 0;
      }

      function scrollGalleryTo(i, { smooth = true, instant = false } = {}) {
        if (state.photos.length === 0) return;
        const n = state.photos.length;
        const nextIdx = ((i % n) + n) % n;
        const track = rootEl.querySelector('[data-gallery-track]');
        if (!track?.querySelector(`[data-gallery-slide="${nextIdx}"]`)) return;
        state.photoIdx = nextIdx;
        const left = galleryScrollLeftForIndex(track, nextIdx);
        const useInstant = instant || galleryReduceMotion || !smooth;
        if (useInstant) {
          track.scrollLeft = left;
        } else {
          try {
            track.scrollTo({ left, behavior: 'smooth' });
          } catch {
            track.scrollLeft = left;
          }
        }
        syncGalleryDots();
        syncGalleryCounter();
      }

      function syncGalleryFromScroll() {
        const track = rootEl.querySelector('[data-gallery-track]');
        if (!track) return;
        const slides = [...track.querySelectorAll('[data-gallery-slide]')];
        if (slides.length === 0) return;
        const scrollLeft = track.scrollLeft;
        const width = track.clientWidth;
        let best = 0;
        let bestDist = Infinity;
        for (const [index, slide] of slides.entries()) {
          const targetLeft = width > 0 ? width * index : slide.offsetLeft;
          const dist = Math.abs(targetLeft - scrollLeft);
          if (dist < bestDist) {
            bestDist = dist;
            best = index;
          }
        }
        if (best === state.photoIdx) return;
        state.photoIdx = best;
        syncGalleryDots();
        syncGalleryCounter();
      }

      function sortedPhotos(listing) {
        const photos = Array.isArray(listing?.photos) ? [...listing.photos] : [];
        photos.sort((a, b) => {
          if (a.is_primary && !b.is_primary) return -1;
          if (!a.is_primary && b.is_primary) return 1;
          return (a.photo_order ?? 0) - (b.photo_order ?? 0);
        });
        return photos;
      }

      function renderNotFound() {
        hideDetailContactBar();
        rootEl.innerHTML = `
          <div class="status-page">
            <h2 data-i18n="detail.notFound">${UyDosh.escapeHtml(UyDosh.t('detail.notFound'))}</h2>
            <a class="btn" href="${UyDosh.escapeHtml(UyDosh.feedPageUrl())}" data-i18n="nav.listings">${UyDosh.escapeHtml(UyDosh.t('nav.listings'))}</a>
          </div>
        `;
      }

      function renderError(retry) {
        hideDetailContactBar();
        rootEl.innerHTML = `
          <div class="status-page">
            <h2>${UyDosh.escapeHtml(UyDosh.t('feed.error'))}</h2>
            <button class="btn" id="retry" type="button">${UyDosh.escapeHtml(UyDosh.t('feed.retry'))}</button>
          </div>
        `;
        document.getElementById('retry')?.addEventListener('click', retry);
      }

      /**
       * Owner-only "views" panel shown above the gallery — matches the mobile app's
       * `ListingDetailOwnerToolbar`, which sits at the very top of a listing's own
       * detail screen. Only rendered inside the Mini App (the regular website has no
       * concept of a logged-in viewer) once ownership is confirmed via the resolved
       * session user id (see `ensureViewerIdentity`). A "..." menu (website-only,
       * mirrors the owner action sheet in the mobile app's
       * `ListingDetailScreen._buildActionMenuItems`, and the edit/delete row actions
       * in `telegram-account.js`) sits in the same row, pinned to the far right corner.
       */
      function ownerToolbarHtml(isOwner, listingId) {
        if (!isOwner) return '';
        const editHref = `/telegram/create.html?id=${encodeURIComponent(listingId)}`;
        return `
          <div class="owner-toolbar-row">
            <div class="owner-toolbar" data-owner-toolbar>
              ${UyDosh.iconEye()}
              <span class="owner-toolbar-text" data-owner-toolbar-text>
                <span class="owner-toolbar-spinner" aria-hidden="true"></span>
              </span>
            </div>
            <div class="owner-menu" data-owner-menu>
              <button
                type="button"
                class="owner-menu-btn"
                data-owner-menu-toggle
                aria-haspopup="true"
                aria-expanded="false"
                aria-label="${UyDosh.escapeHtml(UyDosh.t('detail.ownerMenu'))}"
              >${UyDosh.iconKebab()}</button>
              <div class="owner-menu-dropdown" data-owner-menu-dropdown hidden>
                <a class="owner-menu-item" href="${editHref}">
                  ${UyDosh.iconPencil()}
                  <span>${UyDosh.escapeHtml(UyDosh.t('account.edit'))}</span>
                </a>
                <button type="button" class="owner-menu-item owner-menu-item-danger" data-owner-menu-delete>
                  ${UyDosh.iconTrash()}
                  <span>${UyDosh.escapeHtml(UyDosh.t('account.delete'))}</span>
                </button>
              </div>
            </div>
          </div>
        `;
      }

      /** Closes the owner "..." dropdown if it's currently open (looked up fresh each
       * time since `render()` can replace the menu's DOM nodes, e.g. on language change). */
      function closeOwnerMenu() {
        const dropdownEl = rootEl.querySelector('[data-owner-menu-dropdown]');
        const toggleBtn = rootEl.querySelector('[data-owner-menu-toggle]');
        if (dropdownEl) dropdownEl.hidden = true;
        if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
      }

      // Bound once (not per-render, unlike the other `bind*` helpers below) since
      // these listen on `document` rather than on nodes recreated by `render()` —
      // attaching them again on every re-render would stack up duplicate handlers.
      let ownerMenuGlobalListenersBound = false;

      /**
       * Wires the owner "..." menu's open/close toggle and its Delete action.
       * Edit is a plain link (no JS needed). Delete reuses the same
       * `deleteListingFromTelegramMiniApp` API and confirm/error copy as the
       * "My Listings" row action in `telegram-account.js`, then bounces back
       * to the feed since the listing no longer exists.
       */
      function bindOwnerMenu(listingId) {
        const menuEl = rootEl.querySelector('[data-owner-menu]');
        const toggleBtn = rootEl.querySelector('[data-owner-menu-toggle]');
        const dropdownEl = rootEl.querySelector('[data-owner-menu-dropdown]');
        const deleteBtn = rootEl.querySelector('[data-owner-menu-delete]');
        if (!menuEl || !toggleBtn || !dropdownEl) return;

        toggleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (dropdownEl.hidden) {
            dropdownEl.hidden = false;
            toggleBtn.setAttribute('aria-expanded', 'true');
          } else {
            closeOwnerMenu();
          }
        });

        deleteBtn?.addEventListener('click', async () => {
          closeOwnerMenu();
          const lang = UyDosh.getLang();
          const confirmed = await confirmTelegramAction(UyDosh.t('account.deleteConfirm', lang));
          if (!confirmed) return;
          try {
            await UyDosh.deleteListingFromTelegramMiniApp(listingId);
            showTelegramAlert(UyDosh.t('account.deleteSuccess', lang));
            window.location.href = UyDosh.feedPageUrl();
          } catch (err) {
            console.error('Failed to delete listing', err);
            showTelegramAlert(UyDosh.t('account.deleteError', lang));
          }
        });

        if (!ownerMenuGlobalListenersBound) {
          ownerMenuGlobalListenersBound = true;
          document.addEventListener('click', (e) => {
            const menu = rootEl.querySelector('[data-owner-menu]');
            if (menu && !menu.contains(e.target)) closeOwnerMenu();
          });
          document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeOwnerMenu();
          });
        }
      }

      async function loadOwnerViewCount(listingId) {
        const textEl = rootEl.querySelector('[data-owner-toolbar-text]');
        if (!textEl) return;
        try {
          const data = await UyDosh.fetchListingViewCount(listingId);
          const count = Number(data?.viewCount) || 0;
          textEl.textContent = UyDosh.listingViewsCountText(count, UyDosh.getLang());
        } catch (err) {
          console.error('Failed to load listing view count', err);
          const toolbarEl = rootEl.querySelector('[data-owner-toolbar]');
          if (toolbarEl) toolbarEl.hidden = true;
        }
      }

      /**
       * Records a view for a non-owner opening the listing — matches the
       * mobile app's `_recordView` (see `ListingDetailScreen`). Needs a real
       * signed-in identity (only available inside the Mini App), and is
       * best-effort: a failure here should never surface to the viewer.
       */
      async function recordNonOwnerView(listingId) {
        if (state.viewRecorded || !UyDosh.isMiniApp()) return;
        state.viewRecorded = true;
        try {
          const sessionReady = await UyDosh.ensureTelegramMiniAppSession();
          if (!sessionReady) return;
          await UyDosh.recordListingView(listingId);
        } catch (err) {
          console.error('Failed to record listing view', err);
        }
      }

      function shareButtonHtml() {
        return `
          <button type="button" class="gallery-share-btn" data-share-listing aria-label="${UyDosh.escapeHtml(UyDosh.t('detail.share'))}">
            ${UyDosh.iconShare('#0f172a')}
          </button>
        `;
      }

      // Favoriting reuses the shared `/favorites` API (same one the mobile app
      // uses) — it needs a real logged-in identity, which on this static site
      // only Telegram provides, so the button only ever renders in the Mini App.
      /** Owners can't favorite their own listing (matches the mobile app, which hides this action for owners too). */
      function favoriteButtonHtml() {
        if (!UyDosh.isMiniApp() || isViewingOwnListing()) return '';
        return `
          <button type="button" class="gallery-favorite-btn" data-favorite-listing aria-pressed="false" aria-label="${UyDosh.escapeHtml(UyDosh.t('detail.favorite.add'))}">
            ${UyDosh.iconHeart(false)}
          </button>
        `;
      }

      /** Swaps the heart icon + aria state on the favorite button in place. */
      function setFavoriteButtonState(btn, isFavorited) {
        if (!btn) return;
        btn.setAttribute('aria-pressed', isFavorited ? 'true' : 'false');
        btn.setAttribute(
          'aria-label',
          UyDosh.t(isFavorited ? 'detail.favorite.remove' : 'detail.favorite.add'),
        );
        btn.innerHTML = UyDosh.iconHeart(isFavorited);
      }

      async function bindFavoriteButton(l) {
        const btn = rootEl.querySelector('[data-favorite-listing]');
        if (!btn) return;

        const sessionReady = await UyDosh.ensureTelegramMiniAppSession();
        if (!sessionReady) {
          btn.hidden = true;
          return;
        }

        let isFavorited = false;
        try {
          const status = await UyDosh.checkListingFavorited(l.id);
          isFavorited = Boolean(status?.isFavorited);
          setFavoriteButtonState(btn, isFavorited);
        } catch (err) {
          console.error('Failed to check favorite status', err);
          btn.hidden = true;
          return;
        }

        let pending = false;
        btn.addEventListener('click', async () => {
          if (pending) return;
          pending = true;
          const nextState = !isFavorited;
          setFavoriteButtonState(btn, nextState);
          try {
            const result = await UyDosh.toggleListingFavorite(l.id);
            isFavorited = Boolean(result?.isFavorited);
            setFavoriteButtonState(btn, isFavorited);
            UyDosh.logMiniAppEvent('listing_favorite_toggled', {
              listing_id: Number(l.id),
              is_favorited: isFavorited,
              source: 'telegram_mini_app',
            });
          } catch (err) {
            console.error('Failed to toggle favorite', err);
            setFavoriteButtonState(btn, isFavorited);
          } finally {
            pending = false;
          }
        });
      }

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

      function buildGalleryHtml() {
        if (state.photos.length === 0) {
          const placeholderSrc = UyDosh.noPhotoPlaceholderImageUrl(state.listing);
          const mainHtml = placeholderSrc
            ? `<img class="gallery-placeholder-img" src="${UyDosh.escapeHtml(placeholderSrc)}" alt="" />`
            : `<div style="display: grid; place-items: center; width: 100%; height: 100%; color: var(--muted); font-weight: 700; letter-spacing: 0.12em;">UyDosh</div>`;
          return `
            <div class="gallery" aria-label="UyDosh">
              <div class="main">
                ${mainHtml}
              </div>
              ${shareButtonHtml()}
              ${favoriteButtonHtml()}
              ${reportButtonHtml()}
            </div>
          `;
        }
        const multi = state.photos.length > 1;
        const counter = multi
          ? `<div class="counter">${state.photoIdx + 1} / ${state.photos.length}</div>` : '';
        const dots = multi ? `
          <div class="gallery-dots" role="tablist" aria-label="${UyDosh.escapeHtml(UyDosh.t('detail.gallery.dots'))}">
            ${state.photos.map((_, i) => `
              <button
                type="button"
                class="gallery-dot"
                role="tab"
                data-gallery-dot="${i}"
                aria-label="${UyDosh.escapeHtml(UyDosh.t('detail.gallery.photo'))} ${i + 1} / ${state.photos.length}"
                aria-current="${i === state.photoIdx ? 'true' : 'false'}"
              ></button>
            `).join('')}
          </div>
        ` : '';

        return `
          <div class="gallery" data-gallery>
            <div class="gallery-viewport">
              <div class="gallery-track" data-gallery-track tabindex="0" aria-roledescription="carousel">
                ${state.photos.map((p, i) => `
                  <div class="gallery-slide" data-gallery-slide="${i}" aria-roledescription="slide" aria-label="${UyDosh.escapeHtml(UyDosh.t('detail.gallery.photo'))} ${i + 1} / ${state.photos.length}">
                    <img
                      class="gallery-slide-bg"
                      aria-hidden="true"
                      ${i === 0 ? '' : 'loading="lazy" '}
                      src="${UyDosh.escapeHtml(UyDosh.photoUrl(p))}"
                      alt=""
                      draggable="false"
                    />
                    <div class="gallery-slide-scrim" aria-hidden="true"></div>
                    <img
                      class="gallery-slide-fg"
                      ${i === 0 ? '' : 'loading="lazy" '}
                      src="${UyDosh.escapeHtml(UyDosh.photoUrl(p))}"
                      alt="${UyDosh.escapeHtml(state.listing?.title || '')}"
                      draggable="false"
                    />
                  </div>
                `).join('')}
              </div>
              ${counter}
            </div>
            ${shareButtonHtml()}
            ${favoriteButtonHtml()}
            ${reportButtonHtml()}
            ${dots}
          </div>
        `;
      }

      function bindGallery() {
        stopGalleryAutoplay();
        const track = rootEl.querySelector('[data-gallery-track]');
        if (!track || state.photos.length <= 1) return;

        // Ignore pause triggers briefly after mount — iOS/Telegram can deliver a
        // ghost tap on the gallery when opening detail from a feed card.
        const pauseAfterMs = Date.now() + 700;
        const maybePauseAutoplay = () => {
          if (Date.now() < pauseAfterMs) return;
          pauseGalleryAutoplay();
        };

        track.addEventListener('scroll', () => {
          if (galleryScrollRaf) return;
          galleryScrollRaf = requestAnimationFrame(() => {
            galleryScrollRaf = null;
            syncGalleryFromScroll();
          });
        }, { passive: true });

        track.addEventListener('pointerdown', maybePauseAutoplay);
        track.addEventListener('touchstart', maybePauseAutoplay, { passive: true });
        track.addEventListener('wheel', maybePauseAutoplay, { passive: true });
        track.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') maybePauseAutoplay();
        });

        for (const dot of rootEl.querySelectorAll('[data-gallery-dot]')) {
          dot.addEventListener('click', () => {
            const i = Number(dot.getAttribute('data-gallery-dot'));
            if (Number.isNaN(i)) return;
            scrollGalleryTo(i);
            pauseGalleryAutoplay();
          });
        }

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            scrollGalleryTo(state.photoIdx, { instant: true });
            startGalleryAutoplay();
          });
        });
      }

      function showPhoto(i) {
        scrollGalleryTo(i);
        pauseGalleryAutoplay();
      }

      function buildAmenitiesRowHtml(amenities, lang) {
        const list = Array.isArray(amenities) ? amenities : [];
        if (list.length === 0) return '';
        const chips = UyDosh.sortAmenities(list, 'detail').map((amenity) => {
          const label = UyDosh.localized(amenity, lang);
          const code = UyDosh.getAmenityCode(amenity);
          const icon = code ? UyDosh.amenityIconHtml(code, { size: 16 }) : '';
          return `<span class="amenity">${icon}<span>${UyDosh.escapeHtml(label)}</span></span>`;
        }).join('');
        return `<div class="amenities amenities-inline">${chips}</div>`;
      }

      /**
       * Move-in date + amenities, styled as extra rows inside the
       * description card (see `map-section-extra` / `map-section-static`)
       * so they sit directly under the listing description instead of
       * trailing after the location/metro card.
       */
      function buildMoveInExtraHtml(l, lang) {
        if (!l.move_in_date) return '';
        return `
          <div class="map-section-extra map-section-move-in-extra">
            <dl class="meta-grid">
              <dt>${UyDosh.iconCalendar()}${UyDosh.escapeHtml(UyDosh.t('detail.moveIn'))}</dt>
              <dd>${UyDosh.escapeHtml(UyDosh.formatDate(l.move_in_date, lang))}</dd>
            </dl>
          </div>
        `;
      }

      function buildAmenitiesExtraHtml(amenities, lang) {
        const row = buildAmenitiesRowHtml(amenities, lang);
        if (!row) return '';
        return `
          <div class="map-section-extra map-section-amenities-extra">
            <h2 data-i18n="detail.amenities">${UyDosh.escapeHtml(UyDosh.t('detail.amenities'))}</h2>
            ${row}
          </div>
        `;
      }

      /**
       * One metro-station summary row: name + (when we can compute one) a
       * clock icon with walking distance/time from the listing's location
       * to that station — see `UyDosh.stationWalkInfo` in uydosh-core.js —
       * plus a "draw route" button (when the station has coordinates) that
       * plots a pedestrian route from the listing's pin to it on the map
       * below (see `bindMetroStationRouteButtons` / `setPinGuideLines`).
       *
       * The straight-line km/min shown here is only the *initial* number,
       * good enough for the collapsed summary that's visible before any map
       * traffic is spent — `refineMetroStationWalkTimes` swaps it for a
       * real Yandex-routed figure once the map section actually opens. The
       * row carries `data-station-id` and the text its own
       * `.map-section-walk-text` span so that later patch can target it
       * directly without a full re-render.
       */
      function buildMetroStationRowHtml(station, lang, fallbackLine, refCoords) {
        const name = UyDosh.localized(station, lang);
        if (!name) return '';
        const line = Number(station.line) || fallbackLine;
        const walk = UyDosh.stationWalkInfo(refCoords, station);
        const walkHtml = walk ? `
          <span class="map-section-walk">${UyDosh.iconClock()}<span class="map-section-walk-text">${UyDosh.escapeHtml(
            UyDosh.t('detail.metroWalkInfo')
              .replace('{km}', walk.km.toFixed(1))
              .replace('{minutes}', String(Math.max(1, Math.round(walk.minutes)))),
          )}</span></span>` : '';
        const stationLat = Number(station.latitude);
        const stationLon = Number(station.longitude);
        const stationId = Number(station.id);
        // `data-station-id` is duplicated here (also on the row div below) so
        // `bindMetroStationRouteButtons` can key its on/off toggle Set off the
        // button itself without needing to walk up to the parent row.
        const stationIdAttr = Number.isFinite(stationId) ? ` data-station-id="${stationId}"` : '';
        const routeBtn = Number.isFinite(stationLat) && Number.isFinite(stationLon)
          ? `<span class="map-section-row-route-btn" data-station-route${stationIdAttr} data-lat="${stationLat}" data-lon="${stationLon}" data-color="${UyDosh.escapeHtml(UyDosh.metroLineColor(line) || '')}" role="button" tabindex="0" aria-pressed="false" aria-label="${UyDosh.escapeHtml(UyDosh.t('detail.showRouteToStation'))}">${UyDosh.iconRoute()}</span>`
          : '';
        const idAttr = Number.isFinite(stationId) ? ` data-station-id="${stationId}"` : '';
        return `<div class="map-section-row map-section-row-metro"${idAttr}>${UyDosh.iconMetro(line)}<span class="map-section-row-metro-text"><span class="map-section-row-label">${UyDosh.escapeHtml(name)}</span>${walkHtml}</span>${routeBtn}</div>`;
      }

      /**
       * Several stations can be tagged on a listing (see multi-station
       * selection in telegram-create.js) — `search_subway_stations` holds
       * all of them, falling back to the single legacy `subway_station`.
       * Shared by `buildMapSectionHtml` (initial render) and
       * `refineMetroStationWalkTimes` (real-routing upgrade) so both agree
       * on exactly which stations are shown.
       */
      function listingMetroStations(l) {
        return Array.isArray(l?.search_subway_stations) && l.search_subway_stations.length > 0
          ? l.search_subway_stations
          : (l?.subway_station ? [l.subway_station] : []);
      }

      /**
       * Closest tagged metro station by straight-line walk distance (see
       * `UyDosh.stationWalkInfo`), or `null` when the listing has no station
       * with usable coordinates — used to auto-draw a route to it on map load
       * (see `mountListingMap`) without waiting for the user to tap a
       * per-station "draw route" button.
       */
      function nearestMetroStation(l) {
        const refCoords = UyDosh.listingReferenceCoordinates(l);
        if (!refCoords) return null;
        let nearest = null;
        let nearestKm = Infinity;
        for (const station of listingMetroStations(l)) {
          const walk = UyDosh.stationWalkInfo(refCoords, station);
          if (!walk || walk.km >= nearestKm) continue;
          nearestKm = walk.km;
          nearest = station;
        }
        return nearest;
      }

      function buildMapSectionHtml(l, lang) {
        const locName = UyDosh.localized(l.location, lang);
        const metroLine = UyDosh.resolveMetroLine(l);
        const address = typeof l.address_text === 'string' ? l.address_text.trim() : '';
        const stations = listingMetroStations(l);
        const hasLocation = Boolean(locName);
        const hasMetro = stations.length > 0;
        const hasAddress = Boolean(address);
        if (!hasLocation && !hasMetro && !hasAddress) return '';

        // District, then exact address, then metro stations last — the
        // general-to-specific area info comes first, with nearby-transit
        // details (which can run to several rows/lines for multi-station
        // listings) trailing at the bottom of the summary.
        const rows = [];
        if (hasLocation) {
          rows.push(`<div class="map-section-row">${UyDosh.iconPin()}<span>${UyDosh.escapeHtml(locName)}</span></div>`);
        }
        if (hasAddress) {
          // Extra top margin (on top of `.map-section-summary`'s row gap) so the
          // exact address stands apart from the district row above it — that
          // describes the general area, this is the precise address.
          // The country segment is redundant inside the Mini App (Telegram
          // users are already local), so it's reformatted away there as
          // "Street, District, City" (see `UyDosh.formatListingDetailAddressText`);
          // the standalone website keeps the full raw address.
          const displayAddress = UyDosh.isMiniApp()
            ? UyDosh.formatListingDetailAddressText(address)
            : address;
          rows.push(`<div class="map-section-row map-section-row-address">${UyDosh.iconHome()}<span>${UyDosh.escapeHtml(displayAddress)}</span></div>`);
        }
        if (hasMetro) {
          const refCoords = UyDosh.listingReferenceCoordinates(l);
          const metroRows = stations
            .map((station) => buildMetroStationRowHtml(station, lang, metroLine, refCoords))
            .filter(Boolean);
          // Same "stands apart from the rows above it" treatment as the
          // address row, but only on the first station row — multiple
          // stations shouldn't each get extra spacing from one another.
          if (metroRows.length && rows.length) {
            metroRows[0] = metroRows[0].replace(
              'map-section-row-metro',
              'map-section-row-metro map-section-row-metro-group-start',
            );
          }
          rows.push(...metroRows);
        }

        return `
          <section class="map-section" data-map-section aria-expanded="true">
            <button type="button" class="map-section-toggle" data-map-toggle aria-expanded="true">
              <div class="map-section-summary">${rows.join('')}</div>
            </button>
          <div class="map-section-body">
            <div class="map-container" id="listing-map" aria-label="${UyDosh.escapeHtml(UyDosh.t('detail.map'))}"></div>
            <div class="map-section-approx-note" data-map-approx-note hidden>${UyDosh.iconLocateMe()}${UyDosh.escapeHtml(UyDosh.t('map.approximateLocation'))}</div>
          </div>
        </section>
      `;
      }

      const MAP_LOAD_TIMEOUT_MS = 18000;

      function showListingMapError(container) {
        container.innerHTML = `
          <div class="map-section-status">
            <div class="map-section-status-inner">
              <div>${UyDosh.escapeHtml(UyDosh.t('detail.mapLoadError'))}</div>
              <button type="button" class="btn" data-map-retry>${UyDosh.escapeHtml(UyDosh.t('map.retry'))}</button>
            </div>
          </div>
        `;
        container.querySelector('[data-map-retry]')?.addEventListener('click', () => {
          state.mapLoaded = false;
          state.mapLoading = false;
          UyDosh.resetYandexMaps({ hard: true });
          mountListingMap();
        });
      }

      // Memoizes the in-flight mount so concurrent callers (the accordion
      // toggle *and* any metro row's "draw route" button, see
      // `bindMetroStationRouteButtons`) await the same load instead of one
      // of them racing past the `state.mapLoading` guard before the map
      // instance actually exists yet.
      let mapMountPromise = null;

      function mountListingMap() {
        if (mapMountPromise) return mapMountPromise;
        const container = rootEl.querySelector('#listing-map');
        if (!container || state.mapLoaded) return Promise.resolve();
        state.mapLoading = true;
        mapMountPromise = (async () => {
          container.innerHTML = `<div class="map-section-status">${UyDosh.escapeHtml(UyDosh.t('map.loading'))}</div>`;
          try {
            await UyDosh.waitForElementLayout(container);
            const mapModule = await UyDosh.withTimeout(
              UyDosh.loadYandexMapModule(),
              MAP_LOAD_TIMEOUT_MS,
              'Map module load timed out',
            );
            const coords = mapModule.resolveListingMapCoordinates(state.listing);
            if (!coords) {
              container.innerHTML = `<div class="map-section-status">${UyDosh.escapeHtml(UyDosh.t('detail.mapUnavailable'))}</div>`;
              return;
            }
            container.innerHTML = '';
            await UyDosh.waitForElementLayout(container);
            const map = await UyDosh.withTimeout(
              mapModule.renderSinglePinMap(container, {
                latitude: coords.latitude,
                longitude: coords.longitude,
                lang: UyDosh.getLang(),
                pin: {
                  id: state.listing?.id,
                  listing_type_id: state.listing?.listing_type_id ?? state.listing?.listing_type?.id,
                  listing_type_code: state.listing?.listing_type?.code ?? state.listing?.listing_type_code,
                  host_resident: state.listing?.host_resident,
                },
                selected: true,
              }),
              MAP_LOAD_TIMEOUT_MS,
              'Map render timed out',
            );
            if (!map) {
              throw new Error('Listing map failed to render');
            }
            const approxNote = rootEl.querySelector('[data-map-approx-note]');
            if (approxNote) {
              approxNote.toggleAttribute('hidden', coords.source !== 'approximate');
            }
            state.mapLoaded = true;
            UyDosh.reflowActiveMaps();
            refineMetroStationWalkTimes(mapModule, state.listing);
            drawNearestMetroStationRoute(mapModule, container, state.listing);
          } catch (err) {
            console.error('Failed to load listing map', err);
            showListingMapError(container);
          } finally {
            state.mapLoading = false;
          }
        })();
        mapMountPromise.finally(() => { mapMountPromise = null; });
        return mapMountPromise;
      }

      /**
       * Upgrades each metro row's straight-line walk-time text (see
       * `buildMetroStationRowHtml` / `UyDosh.stationWalkInfo`) to a real
       * Yandex pedestrian-routing number — mirrors
       * `refineNearbyStationWalkTimes` in telegram-create.js. Deliberately
       * *not* run on initial page load, only once `mountListingMap()`
       * actually succeeds (i.e. the author opened the map section, or
       * tapped a "draw route" button which opens it first): the summary row
       * with the straight-line estimate is visible before that, and every
       * listing page view running this eagerly would spend a Router access
       * per tagged station on every single view — unlike the create
       * wizard's one-off use while drafting, that's real recurring site
       * traffic. Piggybacking on the same gesture that already lazy-loads
       * the Yandex script keeps the free daily Router quota mostly spent on
       * visitors who actually engage with the map.
       *
       * Patches only each row's own `.map-section-walk-text` (found via the
       * `data-station-id` `buildMetroStationRowHtml` put on the row) instead
       * of a full re-render, and is guarded by a token so a stale in-flight
       * lookup from an earlier mount (map collapsed/expanded again) can't
       * clobber a newer one.
       */
      function refineMetroStationWalkTimes(mapModule, listing) {
        const refCoords = UyDosh.listingReferenceCoordinates(listing);
        const stations = listingMetroStations(listing).filter(
          (st) => Number.isFinite(Number(st?.latitude)) && Number.isFinite(Number(st?.longitude)),
        );
        if (!refCoords || stations.length === 0) return;

        const token = (state.metroWalkRefineToken += 1);
        mapModule.fetchPedestrianWalkTimes(
          UyDosh.getLang(),
          refCoords,
          stations.map((st) => ({ latitude: Number(st.latitude), longitude: Number(st.longitude) })),
        ).then((results) => {
          if (state.metroWalkRefineToken !== token || results.size === 0) return;
          for (const [index, { minutes, meters }] of results) {
            const station = stations[index];
            const stationId = Number(station?.id);
            if (!Number.isFinite(stationId)) continue;
            const textEl = rootEl.querySelector(
              `.map-section-row-metro[data-station-id="${stationId}"] .map-section-walk-text`,
            );
            if (!textEl) continue;
            textEl.textContent = UyDosh.t('detail.metroWalkInfo')
              .replace('{km}', (meters / 1000).toFixed(1))
              .replace('{minutes}', String(Math.max(1, Math.round(minutes))));
          }
        }).catch(() => { /* keep the straight-line estimate already on screen */ });
      }

      /**
       * Draws a pedestrian route from the listing's pin to its closest
       * tagged metro station (see `nearestMetroStation`) as soon as the map
       * finishes mounting — same `setPinGuideLines` call a per-station
       * "draw route" button tap makes (see `bindMetroStationRouteButtons`),
       * just fired automatically instead of waiting for one. No-ops when the
       * listing has no station with usable coordinates. Toggling that
       * station's own button off afterwards removes this line same as any
       * other; toggling a *different* station's button on adds its route
       * alongside this one instead of replacing it (see
       * `activeMetroStationRouteIds`).
       */
      function drawNearestMetroStationRoute(mapModule, container, listing) {
        const station = nearestMetroStation(listing);
        const latitude = Number(station?.latitude);
        const longitude = Number(station?.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
        const line = Number(station.line) || UyDosh.resolveMetroLine(listing);
        const stationId = Number(station.id);
        if (Number.isFinite(stationId)) {
          state.activeMetroStationRouteIds.add(stationId);
          setMetroRouteButtonPressed(
            rootEl.querySelector(`.map-section-row-route-btn[data-station-id="${stationId}"]`),
            true,
          );
        }
        mapModule.setPinGuideLines(container, [
          { latitude, longitude, color: UyDosh.metroLineColor(line) || undefined },
        ]);
      }

      /**
       * Awaits `mountListingMap()`, resolving immediately once the map is
       * already open/loaded (the normal case now that the section always
       * renders expanded — see `bindMapSection`). Kept as a safety net for
       * every metro row's "draw route" button (see
       * `bindMetroStationRouteButtons`) in case it's ever clicked before
       * `bindMapSection`'s initial mount has finished, so it still waits for
       * the pin to exist before trying to draw a line to it.
       */
      function expandMapSection() {
        const toggle = rootEl.querySelector('[data-map-toggle]');
        const section = rootEl.querySelector('[data-map-section]');
        const body = rootEl.querySelector('.map-section-body');
        if (!toggle || !section || !body) return Promise.resolve();
        if (state.mapExpanded) return mountListingMap();

        state.mapExpanded = true;
        section.setAttribute('aria-expanded', 'true');
        toggle.setAttribute('aria-expanded', 'true');
        body.hidden = false;
        return new Promise((resolve) => {
          setTimeout(() => {
            if (state.mapExpanded) mountListingMap().then(resolve, resolve);
            else resolve();
          }, 350);
        });
      }

      function bindMapSection() {
        const toggle = rootEl.querySelector('[data-map-toggle]');
        const section = rootEl.querySelector('[data-map-section]');
        const body = rootEl.querySelector('.map-section-body');
        if (!toggle || !section || !body) return;

        // Always expanded (no collapse) — markup already renders it open (see
        // buildMapSectionHtml). Mount immediately rather than routing through
        // expandMapSection()'s 350ms delay (that exists to let a click-driven
        // collapsed->expanded transition settle first; there's nothing to
        // wait out here since the section is already open at first paint).
        // `expandMapSection()` still short-circuits straight to
        // `mountListingMap()` for the metro row "draw route" buttons below,
        // since `state.mapExpanded` is already true by the time those fire.
        state.mapExpanded = true;
        mountListingMap();

        bindMetroStationRouteButtons();
      }

      /**
       * Scrolls the map section into view when it isn't fully on screen —
       * e.g. the metro row tapped (see `bindMetroStationRouteButtons` below)
       * sits far enough from it that the just-drawn route would otherwise
       * land off-screen. No-ops if the section is already fully visible.
       */
      function scrollMapIntoViewIfNeeded() {
        const section = rootEl.querySelector('[data-map-section]');
        if (!section) return;
        const rect = section.getBoundingClientRect();
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        const fullyVisible = rect.top >= 0 && rect.bottom <= viewportHeight;
        if (fullyVisible) return;
        section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      /**
       * Flips a single "draw route" button's on/off visuals — `aria-pressed`
       * (styled in listing-detail.css off `[aria-pressed="true"]`), its
       * a11y label, and a `--route-btn-active-color` custom property so the
       * filled "on" background matches that station's own metro-line color
       * (see `data-color`, same color the route itself is drawn in) instead
       * of one flat accent for every line. No-ops on a `null`/missing
       * element so callers (e.g. `drawNearestMetroStationRoute`) can pass a
       * `querySelector` result straight through.
       */
      function setMetroRouteButtonPressed(btn, pressed) {
        if (!btn) return;
        btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
        btn.setAttribute(
          'aria-label',
          UyDosh.t(pressed ? 'detail.hideRouteToStation' : 'detail.showRouteToStation'),
        );
        if (pressed && btn.dataset.color) {
          btn.style.setProperty('--route-btn-active-color', btn.dataset.color);
        } else {
          btn.style.removeProperty('--route-btn-active-color');
        }
      }

      /**
       * Every currently-toggled-on station's route, read back off the
       * buttons themselves (rather than kept as a separate lat/lon list) so
       * `activeMetroStationRouteIds` only ever has to track ids — this stays
       * the single source of truth for what `setPinGuideLines` should be
       * showing right now, whether that's after a button tap or a fresh
       * `bindMetroStationRouteButtons` call following a full re-render.
       */
      function activeMetroRouteLines() {
        const summary = rootEl.querySelector('.map-section-summary');
        if (!summary) return [];
        const lines = [];
        for (const btn of summary.querySelectorAll('[data-station-route]')) {
          const stationId = Number(btn.dataset.stationId);
          if (!Number.isFinite(stationId) || !state.activeMetroStationRouteIds.has(stationId)) continue;
          const latitude = Number(btn.dataset.lat);
          const longitude = Number(btn.dataset.lon);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
          lines.push({ latitude, longitude, color: btn.dataset.color || undefined });
        }
        return lines;
      }

      /**
       * Delegated click/keyboard handler for every metro row's
       * `[data-station-route]` pseudo-button (see `buildMetroStationRowHtml`)
       * — attached to `.map-section-summary`, a descendant of (but distinct
       * element from) the outer `.map-section-toggle` `<button>`, so calling
       * `stopPropagation()` here keeps a route-button tap from also
       * triggering the (now always-expanded, see `bindMapSection`) accordion
       * toggle.
       *
       * Each button is an independent on/off toggle rather than a radio —
       * tapping one adds/removes just its own station from
       * `activeMetroStationRouteIds` and re-passes the *whole* resulting set
       * to `setPinGuideLines`, which redraws every active route together and
       * re-fits the camera around all of them plus the pin at once (see its
       * docstring in yandex-map.js). Also (re-)syncs every button's pressed
       * visual from that same set on (re-)bind, so a full re-render (e.g.
       * language switch) doesn't leave a stale "off" look on a route that's
       * actually still drawn.
       */
      function bindMetroStationRouteButtons() {
        const summary = rootEl.querySelector('.map-section-summary');
        if (!summary) return;

        for (const btn of summary.querySelectorAll('[data-station-route]')) {
          const stationId = Number(btn.dataset.stationId);
          setMetroRouteButtonPressed(btn, Number.isFinite(stationId) && state.activeMetroStationRouteIds.has(stationId));
        }

        const activate = async (btn) => {
          const latitude = Number(btn.dataset.lat);
          const longitude = Number(btn.dataset.lon);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
          const stationId = Number(btn.dataset.stationId);
          const turningOn = !Number.isFinite(stationId) || !state.activeMetroStationRouteIds.has(stationId);
          try {
            scrollMapIntoViewIfNeeded();
            await expandMapSection();
            const mapModule = await UyDosh.loadYandexMapModule();
            const mapContainer = rootEl.querySelector('#listing-map');
            if (Number.isFinite(stationId)) {
              if (turningOn) state.activeMetroStationRouteIds.add(stationId);
              else state.activeMetroStationRouteIds.delete(stationId);
              setMetroRouteButtonPressed(btn, turningOn);
              mapModule.setPinGuideLines(mapContainer, activeMetroRouteLines());
            } else {
              // No station id to toggle off of later — fall back to a single
              // always-on route, same as before per-station toggling existed.
              setMetroRouteButtonPressed(btn, true);
              mapModule.setPinGuideLines(mapContainer, [
                { latitude, longitude, color: btn.dataset.color || undefined },
              ]);
            }
          } catch (err) {
            console.error('Failed to draw route to metro station', err);
          }
        };

        summary.addEventListener('click', (event) => {
          const btn = event.target.closest('[data-station-route]');
          if (!btn) return;
          event.preventDefault();
          event.stopPropagation();
          activate(btn);
        });
        summary.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          const btn = event.target.closest('[data-station-route]');
          if (!btn) return;
          event.preventDefault();
          event.stopPropagation();
          activate(btn);
        });
      }

      // --- 3D room scan (Convert3D-converted GLB) ---------------------------
      // Collapsible tile (mirrors .map-section) that, once expanded, lazy-loads
      // Google's <model-viewer> web component and points it at the listing's
      // GLB — backend-converted from the owner's RoomPlan USDZ scan (see
      // uydosh_backend's UsdzToGlbConversionService). Renders nothing when the
      // listing has no room_scan_glb_url yet (no scan, or conversion still
      // pending/failed — USDZ-only listings fall back to the native app/iOS
      // viewer, unaffected by this tile).
      const MODEL_VIEWER_SRC = 'https://cdn.jsdelivr.net/npm/@google/model-viewer@4.3.1/dist/model-viewer.min.js';
      let modelViewerLoadPromise = null;

      function loadModelViewerScript() {
        if (window.customElements?.get('model-viewer')) return Promise.resolve();
        if (modelViewerLoadPromise) return modelViewerLoadPromise;
        modelViewerLoadPromise = new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.type = 'module';
          script.src = MODEL_VIEWER_SRC;
          script.onload = () => resolve();
          script.onerror = () => {
            modelViewerLoadPromise = null;
            reject(new Error('Failed to load model-viewer'));
          };
          document.head.appendChild(script);
        });
        return modelViewerLoadPromise;
      }

      function roomScanFullscreenIconHtml() {
        return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M9 4H5a1 1 0 0 0-1 1v4M15 4h4a1 1 0 0 1 1 1v4M9 20H5a1 1 0 0 1-1-1v-4M15 20h4a1 1 0 0 0 1-1v-4"></path>
        </svg>`;
      }

      // --- 3D room scan display mode (full room / floor + furniture / floor only) --------
      // Mirrors the native app's cycling mode button (see DisplayMode in
      // RoomUsdzViewerViewController.swift): tapping this button advances
      // full room → floor + furniture → floor only → full room, swapping its
      // icon each time. Since <model-viewer> doesn't expose raw per-node
      // visibility, meshes are "hidden" by driving their material to fully
      // transparent via the Scene Graph API (https://modelviewer.dev/examples/scenegraph/)
      // — classified the same way the backend names them when it converts a
      // RoomPlan USDZ scan to GLB (see uydosh_backend's
      // applyRoomScanStylizedMaterials.ts: `Wall0_color`, `Floor0_color`,
      // `Chair0_color`, ...).
      const ROOM_SCAN_MODE_SEQUENCE = ['fullRoom', 'floorAndFurniture', 'floorOnly'];

      function nextRoomScanMode(mode) {
        const idx = ROOM_SCAN_MODE_SEQUENCE.indexOf(mode);
        return ROOM_SCAN_MODE_SEQUENCE[(idx + 1) % ROOM_SCAN_MODE_SEQUENCE.length];
      }

      function roomScanModeIconHtml(mode) {
        if (mode === 'floorAndFurniture') {
          return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 18v-4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"></path>
            <path d="M4 18v2M20 18v2"></path>
            <path d="M6 12V9a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3"></path>
          </svg>`;
        }
        if (mode === 'floorOnly') {
          return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="6" width="18" height="12" rx="2"></rect>
          </svg>`;
        }
        return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 10.5 12 4l8 6.5"></path>
          <path d="M6 9.5V19a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1V9.5"></path>
        </svg>`;
      }

      function roomScanModeLabelKey(mode) {
        if (mode === 'floorAndFurniture') return 'detail.roomScanModeFloorAndFurniture';
        if (mode === 'floorOnly') return 'detail.roomScanModeFloorOnly';
        return 'detail.roomScanModeFullRoom';
      }

      /** Wall/ceiling/door/window/opening → 'wall' (hidden in floorAndFurniture and floorOnly);
       * floor → always shown; everything else (furniture) → also hidden in floorOnly. Mirrors
       * shouldHideWallLikeSurface()/isOnFloorObject() on iOS. */
      function classifyRoomScanMaterialName(name) {
        const n = (name || '').toLowerCase();
        if (!n) return 'other';
        if (
          n.startsWith('wall') || n.includes('ceiling') ||
          n.includes('door') || n.includes('window') || n.includes('opening')
        ) {
          return 'wall';
        }
        if (n.startsWith('floor') || n.includes('ground')) return 'floor';
        return 'furniture';
      }

      /** Fully hides/shows a Scene Graph material by driving its base color alpha to 0/1 —
       * <model-viewer> has no direct per-mesh visibility toggle, so this is the standard
       * workaround (https://modelviewer.dev/examples/scenegraph/). Caches the material's
       * original alpha mode + color the first time it's hidden so showing it again restores
       * exactly what it looked like (textured or flat-colored materials alike). */
      function setRoomScanMaterialHidden(material, hidden) {
        try {
          const pbr = material.pbrMetallicRoughness;
          if (!pbr) return;
          if (hidden) {
            if (!material.__uydoshOriginalColor) {
              material.__uydoshOriginalColor = pbr.baseColorFactor.slice();
              material.__uydoshOriginalAlphaMode = material.getAlphaMode();
            }
            const base = material.__uydoshOriginalColor;
            material.setAlphaMode('BLEND');
            pbr.setBaseColorFactor([base[0], base[1], base[2], 0]);
          } else if (material.__uydoshOriginalColor) {
            pbr.setBaseColorFactor(material.__uydoshOriginalColor);
            material.setAlphaMode(material.__uydoshOriginalAlphaMode || 'OPAQUE');
          }
        } catch (err) {
          // Scene Graph API unavailable/model not loaded yet — the mode button still
          // works, it just won't visually apply until the next successful call.
        }
      }

      /** Applies `mode` to every material on the already-loaded model. Safe to call before
       * the model has finished loading (silently does nothing). */
      function applyRoomScanDisplayMode(viewerEl, mode) {
        const model = viewerEl && viewerEl.model;
        if (!model || !Array.isArray(model.materials)) return;
        model.materials.forEach((material) => {
          const kind = classifyRoomScanMaterialName(material.name);
          let hidden = false;
          if (mode === 'floorAndFurniture') hidden = kind === 'wall';
          else if (mode === 'floorOnly') hidden = kind === 'wall' || kind === 'furniture';
          setRoomScanMaterialHidden(material, hidden);
        });
      }

      /** Creates the mode-cycling button and wires it to `viewerEl`. Re-applies the current
       * mode once the model finishes loading, covering clicks that land before then. */
      function createRoomScanModeButton(viewerEl) {
        let mode = 'fullRoom';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'roomscan-mode-btn';
        const updateAppearance = () => {
          btn.innerHTML = roomScanModeIconHtml(mode);
          btn.setAttribute('aria-label', UyDosh.t(roomScanModeLabelKey(mode)));
        };
        updateAppearance();
        btn.addEventListener('click', () => {
          mode = nextRoomScanMode(mode);
          updateAppearance();
          UyDosh.haptic?.light?.();
          applyRoomScanDisplayMode(viewerEl, mode);
        });
        viewerEl.addEventListener('load', () => applyRoomScanDisplayMode(viewerEl, mode));
        return btn;
      }

      // --- 3D room scan zoom slider -----------------------------------------------------
      // Mirrors the native app's zoom slider (see zoomSlider/applyZoomFraction in
      // RoomUsdzViewerViewController.swift): a single 0…100 fraction (0 = zoomed out, 100 =
      // zoomed in) mapped onto the camera's field of view — narrower FOV reads as "closer",
      // exactly like the native app, rather than moving the camera itself (which would fight
      // the model-viewer default scroll/pinch zoom's own distance changes).
      const ROOM_SCAN_ZOOM_FOV_MIN_DEG = 28;
      const ROOM_SCAN_ZOOM_FOV_MAX_DEG = 82;
      // Default slider position (0-100). Raised above the neutral 50 midpoint so the model
      // takes up more of the viewer by default instead of looking small against the backdrop.
      const ROOM_SCAN_ZOOM_DEFAULT = 70;

      function roomScanZoomIconHtml(kind) {
        const glyph = kind === 'in'
          ? '<path d="M8 11h6M11 8v6"></path>'
          : '<path d="M8 11h6"></path>';
        return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7"></circle>
          ${glyph}
          <path d="M21 21l-4.3-4.3"></path>
        </svg>`;
      }

      /** Creates the pill zoom slider and wires it to `viewerEl`'s field of view. */
      function createRoomScanZoomSlider(viewerEl) {
        const wrap = document.createElement('div');
        wrap.className = 'roomscan-zoom-slider';

        const outIcon = document.createElement('span');
        outIcon.className = 'roomscan-zoom-icon';
        outIcon.innerHTML = roomScanZoomIconHtml('out');

        const input = document.createElement('input');
        input.type = 'range';
        input.className = 'roomscan-zoom-range';
        input.min = '0';
        input.max = '100';
        // Starts past the midpoint (rather than a neutral 50) so the model fills more of the
        // viewer on first render instead of leaving a lot of empty backdrop around it.
        input.value = String(ROOM_SCAN_ZOOM_DEFAULT);
        input.setAttribute('aria-label', UyDosh.t('detail.roomScanZoom'));

        const inIcon = document.createElement('span');
        inIcon.className = 'roomscan-zoom-icon';
        inIcon.innerHTML = roomScanZoomIconHtml('in');

        const applyZoom = () => {
          const t = Number(input.value) / 100;
          const fov = ROOM_SCAN_ZOOM_FOV_MAX_DEG - t * (ROOM_SCAN_ZOOM_FOV_MAX_DEG - ROOM_SCAN_ZOOM_FOV_MIN_DEG);
          viewerEl.fieldOfView = `${fov.toFixed(2)}deg`;
        };
        // Coalesce rapid `input` ticks onto one `fieldOfView` write per animation frame —
        // model-viewer re-renders the whole scene on every write, and on a full-screen canvas
        // (much larger than the 280px preview) doing that synchronously for every pointer-move
        // tick is enough to make the drag itself feel laggy/"fuzzy".
        let zoomRaf = 0;
        const scheduleApplyZoom = () => {
          if (zoomRaf) return;
          zoomRaf = requestAnimationFrame(() => {
            zoomRaf = 0;
            applyZoom();
          });
        };
        // Auto-rotate keeps re-rendering every frame regardless of the slider; pausing it while
        // the user is actively dragging (same idea as the native app ending its intro spin as
        // soon as the zoom slider is touched, see endIntroCinematic/zoomSliderChanged in
        // RoomUsdzViewerViewController.swift) frees up the render loop for the drag itself.
        let resumeAutoRotate = false;
        const pauseAutoRotateForDrag = () => {
          if (viewerEl.hasAttribute('auto-rotate')) {
            resumeAutoRotate = true;
            viewerEl.removeAttribute('auto-rotate');
          }
        };
        const resumeAutoRotateAfterDrag = () => {
          if (!resumeAutoRotate) return;
          resumeAutoRotate = false;
          viewerEl.setAttribute('auto-rotate', '');
        };
        input.addEventListener('pointerdown', pauseAutoRotateForDrag);
        input.addEventListener('pointerup', resumeAutoRotateAfterDrag);
        input.addEventListener('pointercancel', resumeAutoRotateAfterDrag);
        input.addEventListener('input', scheduleApplyZoom);

        wrap.appendChild(outIcon);
        wrap.appendChild(input);
        wrap.appendChild(inIcon);
        // Field of view only exists once the model has finished loading — apply the slider's
        // starting value then, same as the mode button re-applying on `load`.
        viewerEl.addEventListener('load', applyZoom);
        return wrap;
      }

      // Guards against a double-tap on the 3D viewer triggering the browser's native
      // double-tap-to-zoom instead of (or on top of) the custom zoom slider. That native
      // gesture visibly grows the model itself, but not the slider pill — which is
      // absolutely-positioned and so doesn't scale along with the rest of the page zoom —
      // leaving the slider's thumb out of sync with how "zoomed in" the model now looks.
      // `touch-action: manipulation` (set on .roomscan-viewer-wrap/.roomscan-backdrop in CSS)
      // is the standards-based way to disable it, but iOS Safari (and every WKWebView built
      // on it) has ignored that — and `user-scalable=no`/`maximum-scale` — for double-tap
      // zoom specifically since iOS 10; see the identical issue/fix for the Telegram Mini
      // App in preventMiniAppDoubleTapZoom (uydosh-mini-app.js). Suppressing the second tap's
      // default action directly via a touchend timestamp check is what actually stops it.
      const ROOM_SCAN_DOUBLE_TAP_WINDOW_MS = 350;
      function preventRoomScanDoubleTapZoom(el) {
        if (!el || el.dataset.roomscanZoomGuardBound) return;
        el.dataset.roomscanZoomGuardBound = '1';
        el.addEventListener('gesturestart', (event) => event.preventDefault());
        let lastTouchEnd = 0;
        el.addEventListener('touchend', (event) => {
          const now = Date.now();
          if (now - lastTouchEnd <= ROOM_SCAN_DOUBLE_TAP_WINDOW_MS) event.preventDefault();
          lastTouchEnd = now;
        }, { passive: false });
      }

      function roomScanMetaRowHtml(icon, text) {
        return `<span class="roomscan-toggle-meta-row"><span class="roomscan-toggle-meta-icon" aria-hidden="true">${icon}</span>${UyDosh.escapeHtml(text)}</span>`;
      }

      /** Mirrors the mobile app's room-3D tile: dimensions + height + area, one row each (see room_3d_tile.dart).
       * Shared by the inline toggle summary and the fullscreen viewer's dimensions overlay. */
      function buildRoomScanDimensionsMetaHtml(l) {
        const floorLong = Number(l.room_scan_floor_long_m);
        const floorShort = Number(l.room_scan_floor_short_m);
        const heightM = Number(l.room_scan_height_m);
        const areaM2 = Number(l.room_scan_floor_area_m2);
        const isPositive = (n) => Number.isFinite(n) && n > 0;
        if (isPositive(floorLong) && isPositive(floorShort) && isPositive(heightM) && isPositive(areaM2)) {
          return (
            roomScanMetaRowHtml(UyDosh.iconRectangleOutline(), `${UyDosh.t('detail.roomScanDimensions')}: ${floorLong.toFixed(1)} × ${floorShort.toFixed(1)} m`) +
            roomScanMetaRowHtml(UyDosh.iconHeightArrows(), `${UyDosh.t('detail.roomScanHeight')}: ${heightM.toFixed(1)} m`) +
            roomScanMetaRowHtml(UyDosh.iconOverlapRects(), `${UyDosh.t('detail.roomScanArea')}: ~${areaM2.toFixed(1)} m²`)
          );
        }
        if (isPositive(areaM2)) {
          return roomScanMetaRowHtml(UyDosh.iconOverlapRects(), `${UyDosh.t('detail.roomScanArea')}: ${Math.round(areaM2)} m²`);
        }
        return '';
      }

      function buildRoomScanSectionHtml(l) {
        const glbUrl = typeof l.room_scan_glb_url === 'string' ? l.room_scan_glb_url.trim() : '';
        if (!glbUrl) return '';
        const metaHtml = buildRoomScanDimensionsMetaHtml(l);
        return `
          <section class="roomscan-section" data-roomscan-section aria-expanded="true">
            <button type="button" class="roomscan-toggle" data-roomscan-toggle aria-expanded="true">
              <span class="roomscan-toggle-icon" aria-hidden="true">${UyDosh.iconCube()}</span>
              <span class="roomscan-toggle-title">
                <span class="roomscan-toggle-label">${UyDosh.escapeHtml(UyDosh.t('detail.roomScan'))}</span>
                ${metaHtml ? `<span class="roomscan-toggle-meta">${metaHtml}</span>` : ''}
              </span>
              <span class="roomscan-chevron" aria-hidden="true">▾</span>
            </button>
            <div class="roomscan-body">
              <div class="roomscan-viewer-wrap" data-roomscan-viewer-wrap></div>
            </div>
          </section>
        `;
      }

      /**
       * Builds a <model-viewer> element pointed at `glbUrl`. `ios-src` (the
       * original USDZ, when present) plus the `ar` attribute makes Safari
       * offer a native AR Quick Look button on top of the inline 3D preview
       * — same USDZ, no extra work.
       *
       * AR is skipped entirely inside the Telegram Mini App: on Android,
       * model-viewer's "scene-viewer" AR mode navigates to an `intent://`
       * URL, which Telegram's embedded WebView can't handle and fails with
       * `net::ERR_UNKNOWN_URL_SCHEME` instead of launching AR. The regular
       * mobile browser (outside Telegram) handles `intent://` fine, so AR
       * stays enabled there.
       */
      function createModelViewerEl(glbUrl, usdzUrl) {
        const el = document.createElement('model-viewer');
        el.setAttribute('src', glbUrl);
        if (!UyDosh.isMiniApp()) {
          if (usdzUrl) el.setAttribute('ios-src', usdzUrl);
          el.setAttribute('ar', '');
          el.setAttribute('ar-modes', 'webxr scene-viewer quick-look');
        }
        el.setAttribute('camera-controls', '');
        el.setAttribute('camera-orbit', '0deg 75deg 70%');
        // Widened beyond the zoom slider's own 28–82° range (see createRoomScanZoomSlider)
        // so the slider never gets clamped, and pinch/scroll zoom keeps working too.
        el.setAttribute('min-field-of-view', '20deg');
        el.setAttribute('max-field-of-view', '90deg');
        el.setAttribute('interaction-prompt', 'auto');
        el.setAttribute('interaction-prompt-threshold', '0');
        el.setAttribute('auto-rotate', '');
        el.setAttribute('auto-rotate-delay', '0');
        el.setAttribute('rotation-per-second', '60deg');
        el.setAttribute('shadow-intensity', '1');
        el.setAttribute('exposure', '1');
        el.setAttribute('environment-image', 'neutral');
        return el;
      }

      function showRoomScanLoadError(container) {
        container.dataset.roomscanMounted = '';
        container.innerHTML = `<div class="roomscan-status">${UyDosh.escapeHtml(UyDosh.t('detail.roomScanLoadError'))}</div>`;
      }

      async function mountRoomScanViewer(container, glbUrl, usdzUrl, l) {
        if (!container || container.dataset.roomscanMounted) return;
        container.dataset.roomscanMounted = '1';
        preventRoomScanDoubleTapZoom(container);
        container.innerHTML = `<div class="roomscan-status">${UyDosh.escapeHtml(UyDosh.t('detail.loading'))}</div>`;
        try {
          await loadModelViewerScript();
          const viewer = createModelViewerEl(glbUrl, usdzUrl);
          // `<model-viewer>` swallows bad/empty GLB responses internally instead
          // of rejecting a promise — only its `error` event tells us it failed.
          viewer.addEventListener('error', () => showRoomScanLoadError(container), { once: true });
          container.innerHTML = '';
          container.appendChild(viewer);

          const fullscreenBtn = document.createElement('button');
          fullscreenBtn.type = 'button';
          fullscreenBtn.className = 'roomscan-fullscreen-btn';
          fullscreenBtn.setAttribute('aria-label', UyDosh.t('detail.roomScanFullscreen'));
          fullscreenBtn.innerHTML = roomScanFullscreenIconHtml();
          fullscreenBtn.addEventListener('click', () => openRoomScanFullscreen(glbUrl, usdzUrl, l));

          const controlsBar = document.createElement('div');
          controlsBar.className = 'roomscan-controls-bar';
          controlsBar.appendChild(createRoomScanModeButton(viewer));
          controlsBar.appendChild(createRoomScanZoomSlider(viewer));
          controlsBar.appendChild(fullscreenBtn);
          container.appendChild(controlsBar);
        } catch (err) {
          console.error('Failed to load 3D room scan viewer', err);
          showRoomScanLoadError(container);
        }
      }

      function bindRoomScanSection() {
        const toggle = rootEl.querySelector('[data-roomscan-toggle]');
        const section = rootEl.querySelector('[data-roomscan-section]');
        const body = rootEl.querySelector('.roomscan-section .roomscan-body');
        const viewerWrap = rootEl.querySelector('[data-roomscan-viewer-wrap]');
        if (!toggle || !section || !body || !viewerWrap) return;

        const l = state.listing;
        const glbUrl = UyDosh.photoUrl(l.room_scan_glb_url);
        const usdzUrl = l.point_cloud_url ? UyDosh.photoUrl(l.point_cloud_url) : '';

        // Section renders expanded by default (see buildRoomScanSectionHtml)
        // so the viewer needs mounting up front instead of waiting for a
        // first toggle click.
        if (section.getAttribute('aria-expanded') === 'true') {
          mountRoomScanViewer(viewerWrap, glbUrl, usdzUrl, l);
        }

        toggle.addEventListener('click', () => {
          const next = section.getAttribute('aria-expanded') !== 'true';
          section.setAttribute('aria-expanded', next ? 'true' : 'false');
          toggle.setAttribute('aria-expanded', next ? 'true' : 'false');
          body.hidden = !next;
          if (next) {
            mountRoomScanViewer(viewerWrap, glbUrl, usdzUrl, l);
            // Bring the tile header as close to the top of the screen as the
            // page can scroll, so the newly expanded viewer has room to show.
            requestAnimationFrame(() => {
              toggle.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
          }
        });
      }

      const roomScanBackdropEl = document.getElementById('roomscan-backdrop');

      // Lets the Telegram header BackButton handler (bound up top, before this
      // function exists) close the fullscreen 3D overlay instead of navigating
      // away when it's open. Returns whether it actually closed something.
      function closeRoomScanFullscreenIfOpen() {
        // `hidden` flips synchronously on open (unlike the `is-open` class,
        // which is added a frame later for the transition), so it's the
        // reliable signal even right after the overlay opens.
        if (!roomScanBackdropEl || roomScanBackdropEl.hidden) return false;
        closeRoomScanFullscreen();
        return true;
      }

      function closeRoomScanFullscreen() {
        if (!roomScanBackdropEl) return;
        roomScanBackdropEl.classList.remove('is-open');
        roomScanBackdropEl.setAttribute('aria-hidden', 'true');
        setTimeout(() => {
          roomScanBackdropEl.hidden = true;
          roomScanBackdropEl.innerHTML = '';
        }, 180);
      }

      async function openRoomScanFullscreen(glbUrl, usdzUrl, l) {
        if (!roomScanBackdropEl) return;
        UyDosh.haptic?.light?.();
        preventRoomScanDoubleTapZoom(roomScanBackdropEl);
        roomScanBackdropEl.innerHTML = '';
        roomScanBackdropEl.hidden = false;
        roomScanBackdropEl.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(() => roomScanBackdropEl.classList.add('is-open'));

        // Dimensions overlay (top-leading, like the mobile app's native SceneKit viewer —
        // see RoomUsdzViewerViewController.swift's `hintContainer`). Built up front since it
        // doesn't depend on the model finishing load.
        const metaHtml = l ? buildRoomScanDimensionsMetaHtml(l) : '';
        if (metaHtml) {
          const dimensionsEl = document.createElement('div');
          dimensionsEl.className = 'roomscan-backdrop-dimensions';
          dimensionsEl.innerHTML = metaHtml;
          roomScanBackdropEl.appendChild(dimensionsEl);
        }

        // Close button (+ its bar) is created up front and stays put regardless of load
        // outcome, so a failed/slow model never traps the viewer open. The mode button and
        // zoom slider are inserted before it once the model is actually ready to control.
        const controlsBar = document.createElement('div');
        controlsBar.className = 'roomscan-controls-bar';
        roomScanBackdropEl.appendChild(controlsBar);

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'roomscan-backdrop-close';
        closeBtn.setAttribute('aria-label', UyDosh.t('complaint.cancel'));
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', closeRoomScanFullscreen);
        controlsBar.appendChild(closeBtn);

        const statusEl = document.createElement('div');
        statusEl.className = 'roomscan-status';
        statusEl.textContent = UyDosh.t('detail.loading');
        roomScanBackdropEl.appendChild(statusEl);

        try {
          await loadModelViewerScript();
          const viewer = createModelViewerEl(glbUrl, usdzUrl);
          viewer.addEventListener('error', () => {
            statusEl.textContent = UyDosh.t('detail.roomScanLoadError');
            statusEl.hidden = false;
            viewer.remove();
          }, { once: true });
          statusEl.hidden = true;
          roomScanBackdropEl.insertBefore(viewer, controlsBar);
          controlsBar.insertBefore(createRoomScanModeButton(viewer), closeBtn);
          controlsBar.insertBefore(createRoomScanZoomSlider(viewer), closeBtn);
        } catch (err) {
          console.error('Failed to load fullscreen 3D room scan viewer', err);
          statusEl.textContent = UyDosh.t('detail.roomScanLoadError');
        }
      }

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

      function render() {
        stopGalleryAutoplay();
        const l = state.listing;
        if (!l) return;
        const lang = UyDosh.getLang();
        document.documentElement.lang = lang;

        const title = UyDosh.escapeHtml(l.title || '');
        document.title = `UyDosh — ${l.title || '#' + l.id}`;
        const ogTitle = document.getElementById('og-title');
        const ogDesc = document.getElementById('og-desc');
        const ogImage = document.getElementById('og-image');
        if (ogTitle) ogTitle.setAttribute('content', `UyDosh — ${l.title || ''}`);
        const desc = UyDosh.localizedDescription(l, lang);
        if (ogDesc && desc) ogDesc.setAttribute('content', desc.slice(0, 160));
        const primary = UyDosh.primaryPhoto(l);
        if (ogImage && primary) ogImage.setAttribute('content', UyDosh.photoUrl(primary));

        const price = UyDosh.formatPrice(l, lang);
        const typeName = UyDosh.listingTypeBadgeLabel(l, lang);
        const listingTypeId = l.listing_type_id ?? l.listing_type?.id;
        const typeColor = UyDosh.listingTypeColor(listingTypeId);
        const locName = UyDosh.localized(l.location, lang);
        const metro = UyDosh.localized(l.subway_station, lang);
        const rooms = Number(l.rooms_number);

        // Row 1: type / gender / price — the headline facts about the
        // listing. Row 2: private room / room count — secondary details
        // that used to just wrap onto their own line by accident; now
        // they're deliberately grouped together below row 1.
        const primaryBadges = [];
        if (UyDosh.isFeatured(l)) {
          primaryBadges.push(`<span class="badge featured">${UyDosh.escapeHtml(UyDosh.t('card.featured'))}</span>`);
        }
        if (typeName) {
          const typeStyle = typeColor ? ` style="--badge-type-color:${typeColor}"` : '';
          const typeIcon = UyDosh.listingTypeBadgeIcon(l, { pressed: false });
          primaryBadges.push(`<span class="badge badge-type"${typeStyle}>${typeIcon}${UyDosh.escapeHtml(typeName)}</span>`);
        }
        const genderBadge = UyDosh.genderBadgeHtml(l, lang);
        if (genderBadge) primaryBadges.push(genderBadge);
        if (price) {
          primaryBadges.push(`<span class="price">${price}<small>${UyDosh.escapeHtml(UyDosh.t('card.perMonth'))}</small></span>`);
        }

        const secondaryBadges = [];
        if (l.private_room) {
          secondaryBadges.push(`<span class="badge">${UyDosh.iconLock()}${UyDosh.escapeHtml(UyDosh.t('card.privateRoom'))}</span>`);
        }
        if (Number.isFinite(rooms) && rooms > 0) {
          secondaryBadges.push(`<span class="badge">${rooms} ${UyDosh.escapeHtml(UyDosh.t('card.rooms'))}</span>`);
        }

        const amenities = Array.isArray(l.amenities) ? l.amenities : [];
        const addressText = typeof l.address_text === 'string' ? l.address_text.trim() : '';
        const hasMapSection = Boolean(locName || metro || addressText);

        const isMiniApp = UyDosh.isMiniApp();

        const metaRows = [];
        if (!hasMapSection && addressText) metaRows.push([UyDosh.t('detail.address'), addressText]);
        if (!hasMapSection && locName) metaRows.push([UyDosh.t('detail.location'), locName]);
        if (!hasMapSection && metro) metaRows.push([UyDosh.t('detail.metro'), metro]);
        if (l.created_at && !isMiniApp) metaRows.push([UyDosh.t('detail.posted'), UyDosh.formatDate(l.created_at, lang), true]);
        const metaHtml = metaRows.length ? `
          <dl class="meta-grid">
            ${metaRows.map(([k, v, isDate]) => `<dt>${isDate ? UyDosh.iconCalendar() : ''}${UyDosh.escapeHtml(k)}</dt><dd>${UyDosh.escapeHtml(v)}</dd>`).join('')}
          </dl>
        ` : '';

        // Description and "posted"/author info share one card (dividers
        // between them), rendered above the location/metro/map card — see
        // `descHtml` below and its placement in the template.
        const descriptionExtraHtml = desc ? `
          <div class="map-section-extra map-section-description">
            <h2 data-i18n="detail.description">${UyDosh.escapeHtml(UyDosh.t('detail.description'))}</h2>
            <div class="description">${UyDosh.escapeHtml(desc)}</div>
          </div>
        ` : '';

        // Move-in date and amenities render directly under the description
        // (inside the same card) rather than trailing after the
        // location/metro card below.
        const moveInExtraHtml = buildMoveInExtraHtml(l, lang);
        const amenitiesExtraHtml = buildAmenitiesExtraHtml(amenities, lang);

        const authorHandle = isMiniApp ? UyDosh.listingContactTelegram(l) : '';
        const authorAvatarUrl = authorHandle ? UyDosh.telegramAvatarUrl(authorHandle) : '';
        const postedExtraHtml = (isMiniApp && (authorHandle || l.created_at)) ? `
          <div class="map-section-extra map-section-posted${authorHandle ? ' map-section-posted--with-avatar' : ''}">
            <dl class="meta-grid">
              ${authorHandle ? `
                <dt>${UyDosh.escapeHtml(UyDosh.t('detail.author'))}</dt>
                <dd>@${UyDosh.escapeHtml(authorHandle)}</dd>
              ` : ''}
              ${l.created_at ? `
                <dt>${UyDosh.iconCalendar()}${UyDosh.escapeHtml(UyDosh.t('detail.posted'))}</dt>
                <dd>${UyDosh.escapeHtml(UyDosh.formatDate(l.created_at, lang))}</dd>
              ` : ''}
            </dl>
            ${authorHandle ? `
              <span class="author-avatar" aria-hidden="true">
                ${authorAvatarUrl ? `<img src="${UyDosh.escapeHtml(authorAvatarUrl)}" alt="" referrerpolicy="no-referrer" onerror="this.remove();" />` : UyDosh.iconChrome('person')}
              </span>
            ` : ''}
          </div>
        ` : '';

        const cardExtraHtml = `${descriptionExtraHtml}${moveInExtraHtml}${amenitiesExtraHtml}${postedExtraHtml}`;
        // Plain (non-collapsible) card, styled like `.map-section` — placed
        // above the location/metro/map card in the template so the reading
        // order is title → description → move-in/amenities → posted/author
        // → location/map.
        const descHtml = cardExtraHtml ? `<div class="map-section map-section-static">${cardExtraHtml}</div>` : '';

        const mapHtml = buildMapSectionHtml(l, lang);
        const roomScanHtml = buildRoomScanSectionHtml(l);
        state.mapExpanded = false;
        state.mapLoaded = false;
        state.mapLoading = false;

        // Owner-only "views" toolbar (see `ownerToolbarHtml`) — the viewer's own
        // user id is only resolvable inside the Mini App (see `ensureViewerIdentity`,
        // called from `load()` before the listing itself is fetched).
        const viewerId = isMiniApp ? UyDosh.getSessionUserId() : null;
        const ownerId = Number(l.user_id ?? l.user?.id);
        const isOwner = viewerId != null && Number.isFinite(ownerId) && ownerId === Number(viewerId);

        rootEl.innerHTML = `
          ${ownerToolbarHtml(isOwner, l.id)}
          <div class="layout">
            <div class="gallery-col">
              ${buildGalleryHtml()}
            </div>
            <div class="details">
              ${(primaryBadges.length || secondaryBadges.length) ? `
                <div class="badges-group">
                  ${primaryBadges.length ? `<div class="badges">${primaryBadges.join('')}</div>` : ''}
                  ${secondaryBadges.length ? `<div class="badges">${secondaryBadges.join('')}</div>` : ''}
                </div>
              ` : ''}
              <div class="title-row">
                <h1>${title}</h1>
              </div>
              ${isOwner ? '' : claimBannerHtml()}
              ${compatibilityTileHtml(isOwner)}
              ${roomScanHtml}
              ${descHtml}
              ${mapHtml}
              ${metaHtml}
              <div class="cta-row app-cta-row">
                <a class="btn primary" href="uydosh://listing/${encodeURIComponent(l.id)}" data-i18n="detail.openInApp">${UyDosh.escapeHtml(UyDosh.t('detail.openInApp'))}</a>
                <a class="btn" href="${APK_URL}" download="uydosh.apk" data-i18n="detail.downloadApk">${UyDosh.escapeHtml(UyDosh.t('detail.downloadApk'))}</a>
              </div>
              ${complaintsWarningHtml()}
            </div>
          </div>
        `;

        bindGallery();
        bindMapSection();
        bindRoomScanSection();
        bindShareButton(l);
        bindFavoriteButton(l);
        bindReportButton(l);
        updateDetailContactBar(l);
        if (isOwner) {
          loadOwnerViewCount(l.id);
          bindOwnerMenu(l.id);
        } else {
          loadClaimBanner(l);
          recordNonOwnerView(l.id);
        }
        if (isMiniApp) loadComplaintsWarning(l);
        if (isMiniApp && !isOwner) {
          bindCompatibilitySection();
          loadCompatibilityTile(l, isOwner);
        }
      }

      async function load() {
        if (!listingId) { renderNotFound(); return; }
        hideDetailContactBar();
        try {
          await ensureViewerIdentity();
          const data = await UyDosh.fetchListing(listingId);
          state.listing = data;
          state.photos = sortedPhotos(data);
          state.photoIdx = 0;
          render();
          if (UyDosh.isMiniApp()) {
            UyDosh.logMiniAppEvent('listing_viewed', {
              listing_id: Number(listingId),
              source: 'telegram_mini_app',
            });
            UyDosh.logMiniAppScreen('telegram_listing_detail', {
              listing_id: Number(listingId),
            });
          }
        } catch (err) {
          console.error('Failed to load listing', err);
          if (err?.status === 404) renderNotFound();
          else renderError(() => { rootEl.innerHTML = '<div class="status-page" data-i18n="detail.loading">' + UyDosh.escapeHtml(UyDosh.t('detail.loading')) + '</div>'; load(); });
        }
      }

      // Keyboard arrows for gallery navigation.
      document.addEventListener('keydown', (e) => {
        if (state.photos.length <= 1) return;
        if (e.key === 'ArrowLeft') { e.preventDefault(); showPhoto(state.photoIdx - 1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); showPhoto(state.photoIdx + 1); }
      });

      UyDosh.initLangSwitcher();
      document.addEventListener('uydosh:langchange', () => {
        if (state.listing) {
          render();
        } else {
          UyDosh.applyI18n();
          hideDetailContactBar();
        }
      });

      load();
