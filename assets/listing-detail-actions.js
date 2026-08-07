// Part of listing.html's detail-page script, split out of the former single
// ~2900-line assets/listing-detail.js for maintainability (that file is the
// highest-churn file in the site). Loaded as a plain classic <script defer>
// alongside the other listing-detail-*.js files and assets/listing-detail.js
// itself — they all share one global scope (like separate inline <script>
// blocks would), so functions defined here are called directly by the other
// modules and by listing-detail.js's render()/load(). See listing-detail.js
// for the overall module map.
//
// This file: the share button/flow, the owner-only views toolbar + "..." menu, and the favorite button.
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

      // Same bot Mini App deep link as `buildListingShareUrl`, with a `_3d` marker
      // that `redirectFromMiniAppStartParam` (uydosh-mini-app.js) recognizes and
      // turns into `?view=3d` on the listing page, so the recipient lands straight
      // in the fullscreen 3D viewer instead of the collapsed tile. Used only by the
      // 3D viewer's own share button (see createRoomScanShareButton in
      // listing-detail-roomscan.js) — separate from the listing's general share button.
      function buildListing3dShareUrl(id) {
        return `https://t.me/${TELEGRAM_BOT_USERNAME}?startapp=listing_${encodeURIComponent(id)}_3d`;
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
      // When the listing has a ready 3D turntable GIF, prefer `?preview=3d` so
      // Telegram's link header shows the looping model instead of a still photo.
      // Otherwise keep `?preview=photo` (primary listing photo).
      function buildListingLinkPreviewUrl(id, listing) {
        const hasGif =
          typeof listing?.room_scan_rotation_gif_url === 'string' &&
          listing.room_scan_rotation_gif_url.trim().length > 0;
        const preview = hasGif ? '3d' : 'photo';
        return `${SHARE_WEB_BASE}/listing/${encodeURIComponent(id)}?preview=${preview}`;
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
          const mapPreviewUrl = buildListingMapPreviewUrl(l.id);
          const linkPreviewUrl = buildListingLinkPreviewUrl(l.id, l);
          const gifBase =
            typeof l.room_scan_rotation_gif_url === 'string' &&
            l.room_scan_rotation_gif_url.trim()
              ? UyDosh.photoUrl(l.room_scan_rotation_gif_url)
              : '';
          const gifV = l.room_scan_media_generated_at
            ? Date.parse(l.room_scan_media_generated_at) || Date.now()
            : Date.now();
          const gifUrl = gifBase
            ? `${gifBase}${gifBase.includes('?') ? '&' : '?'}v=${gifV}`
            : '';
          // Prefer attaching the rotation GIF when available so Telegram shows
          // the looping 3D preview as a media header; fall back to photos.
          const photoUrls = gifUrl
            ? [gifUrl]
            : sortedPhotos(l).map((p) => UyDosh.photoUrl(p)).filter(Boolean);
          const method = await UyDosh.shareListingLink(url, text, photoUrls, gifUrl ? '' : mapPreviewUrl, linkPreviewUrl);
          if (UyDosh.isMiniApp()) {
            UyDosh.logMiniAppEvent('listing_share_tapped', {
              listing_id: Number(l.id),
              source: 'telegram_mini_app',
              share_method: method || 'unknown',
            });
          }
        });
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
      function ownerToolbarHtml(isOwner, listingId, { hasRoomScan = false } = {}) {
        if (!isOwner) return '';
        const editHref = `/telegram/create.html?id=${encodeURIComponent(listingId)}`;
        // Replace scan only when a GLB already exists; the empty-state add card
        // on the detail body covers first-time scans (see buildOwnerAddRoomScanHtml).
        const showReplaceScan =
          hasRoomScan &&
          UyDosh.isMiniApp?.() &&
          UyDosh.shouldShowRoomScanClipCta?.() &&
          UyDosh.isListingEligibleForRoomScan?.(state.listing ?? { id: listingId });
        const replaceScanItem = showReplaceScan
          ? `<button type="button" class="owner-menu-item" data-owner-menu-replace-scan>
                  ${UyDosh.iconCube()}
                  <span>${UyDosh.escapeHtml(UyDosh.t('detail.replaceRoomScan'))}</span>
                </button>`
          : '';
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
                ${replaceScanItem}
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
        const replaceScanBtn = rootEl.querySelector('[data-owner-menu-replace-scan]');
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

        replaceScanBtn?.addEventListener('click', () => {
          closeOwnerMenu();
          const lang = UyDosh.getLang();
          const isIos = UyDosh.isIosPlatform?.() ?? false;
          // Ephemeral progress UI under the toolbar — viewer stays visible.
          let panel = rootEl.querySelector('[data-owner-replace-scan-panel]');
          if (!panel) {
            panel = document.createElement('div');
            panel.className = 'owner-replace-scan-panel';
            panel.dataset.ownerReplaceScanPanel = '';
            panel.innerHTML = `
              <p class="owner-replace-scan-status" data-owner-replace-scan-status hidden></p>
              <button type="button" class="btn primary roomscan-add-btn" data-owner-replace-scan-btn data-use-icon-label="1"></button>
              <div class="scan-upsell-qr owner-replace-scan-qr" data-owner-replace-scan-qr hidden></div>
            `;
            rootEl.querySelector('.owner-toolbar-row')?.after(panel);
          }
          panel.hidden = false;
          const statusEl = panel.querySelector('[data-owner-replace-scan-status]');
          const progressBtn = panel.querySelector('[data-owner-replace-scan-btn]');
          const qrHostEl = panel.querySelector('[data-owner-replace-scan-qr]');
          const idleLabel = (l) => (
            `${UyDosh.iconCube()}<span>${UyDosh.escapeHtml(
              isIos
                ? UyDosh.t('detail.replaceRoomScan', l)
                : UyDosh.t('create.scan3dCopyLink', l),
            )}</span>`
          );
          progressBtn.innerHTML = idleLabel(lang);
          UyDosh.startListingRoomScanFlow?.({
            listingId,
            buttonEl: progressBtn,
            statusEl,
            qrHostEl,
            getButtonIdleLabel: idleLabel,
            onFeatureDisabled: () => {
              panel.hidden = true;
              replaceScanBtn.hidden = true;
            },
            onCompleted: () => {
              const params = new URLSearchParams(location.search);
              params.set('view', '3d');
              if (!params.get('mini')) params.set('mini', '1');
              location.replace(`${location.pathname}?${params}`);
            },
          });
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

