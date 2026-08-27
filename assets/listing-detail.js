// Extracted from listing.html's inline <script> block — moved to external,
// deferrable, cacheable files instead of ~2900 lines of JS re-parsed inline on
// every page load. Split (2026-07) from one listing-detail.js monolith into
// this core file plus sibling modules, all loaded as plain classic
// <script defer> tags sharing one global scope:
//
//   listing-detail-gallery.js     photo gallery carousel
//   listing-detail-map.js         amenities/metro/map section
//   listing-detail-roomscan.js    3D room scan tile + fullscreen viewer
//   listing-detail-complaints.js  report button, complaint sheet/list, claim banner
//   listing-detail-actions.js     share button, owner toolbar, favorite button
//   listing-detail-compat.js      lifestyle compatibility tile + group matrix
//   listing-detail-group.js       group-forming join / owner accept
//   listing-detail.js (this file) bootstrap, shared state, render()/load()
//
// This file owns `state`/`rootEl`/`listingId` (read by every module above)
// and `render()`/`load()` (which call into every module above) — see the
// bottom of this file for the actual bootstrap sequence.
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

      // Floating "back" button — an extra, always-visible way back alongside
      // the Telegram header BackButton above (some clients make the header
      // easy to miss once you've scrolled into a long description). Mirrors
      // the header BackButton's own handler exactly, including the room-scan
      // overlay guard. Kept clear of the sticky contact bar via
      // html.has-detail-contact in listing-detail.css, not JS.
      const detailBackFabEl = document.getElementById('detail-back-fab');
      if (UyDosh.isMiniApp() && detailBackFabEl) {
        detailBackFabEl.hidden = false;
        detailBackFabEl.addEventListener('click', () => {
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
      // Admin-only "Edit (admin)" FAB — icon-only, stacked above detail-back-fab
      // (see .detail-admin-edit-fab in listing-detail.css). Independent of the
      // contact bar below: shown whenever the viewer is an admin who isn't the
      // owner, regardless of whether the listing has contact info to show there.
      const detailAdminEditFabEl = document.getElementById('detail-admin-edit-fab');
      let adminEditFabBound = false;

      function hideDetailContactBar() {
        // Also hides the admin-only edit FAB — both need a currently-loaded
        // listing, so every caller here (not-found/error pages, pre-fetch reset)
        // wants both gone together.
        if (detailAdminEditFabEl) detailAdminEditFabEl.hidden = true;
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

      function updateDetailAdminEditFab(listing, { isAdminViewer = false } = {}) {
        if (!detailAdminEditFabEl) return;
        if (!isAdminViewer) {
          detailAdminEditFabEl.hidden = true;
          return;
        }
        detailAdminEditFabEl.setAttribute('data-listing-id', String(listing?.id ?? ''));
        detailAdminEditFabEl.hidden = false;
        if (!adminEditFabBound) {
          adminEditFabBound = true;
          UyDosh.bindDetailAdminEditFab(detailAdminEditFabEl, listing?.id);
        }
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
        // Guards `maybeAutoOpenRoomScanFullscreen` (listing-detail-roomscan.js) so a
        // `?view=3d` share link only pops the fullscreen 3D viewer once, not again on
        // every language-change re-render.
        roomScan3dAutoOpened: false,
      };


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
        const groupCtx = listingGroupContext(l);
        if (groupCtx) {
          const memberCount = Number(groupCtx.group_member_count) || 0;
          const target = Number(groupCtx.group_size_target) || 0;
          secondaryBadges.push(`<span class="badge">${UyDosh.escapeHtml(groupI18n('detail.group.spots', { count: memberCount, target: target || '—' }))}</span>`);
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

        // Owner-only "views" toolbar (see `ownerToolbarHtml`) — the viewer's own
        // user id is only resolvable inside the Mini App (see `ensureViewerIdentity`,
        // called from `load()` before the listing itself is fetched).
        const viewerId = isMiniApp ? UyDosh.getSessionUserId() : null;
        const ownerId = Number(l.user_id ?? l.user?.id);
        const isOwner = viewerId != null && Number.isFinite(ownerId) && ownerId === Number(viewerId);
        const isAdmin = isMiniApp && Boolean(UyDosh.isAdmin?.());
        const mapHtml = buildMapSectionHtml(l, lang);
        const roomScanHtml = buildRoomScanSectionHtml(l, { isOwner, isAdmin });
        state.mapExpanded = false;
        state.mapLoaded = false;
        state.mapLoading = false;
        // Admins get their own floating "Edit (admin)" FAB (see `updateDetailAdminEditFab` below)
        // only when they're not already the owner — owners already have an edit link via
        // `ownerToolbarHtml`'s "..." menu, so this avoids showing two edit entry points.
        const isAdminViewer = isAdmin && !isOwner;

        rootEl.innerHTML = `
          ${ownerToolbarHtml(isOwner, l.id, {
            hasRoomScan: Boolean(l.room_scan_glb_url),
            isAdmin,
          })}
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
              ${groupSectionHtml(l)}
              ${isOwner ? '' : claimBannerHtml()}
              ${roomScanHtml}
              ${descHtml}
              ${mapHtml}
              ${compatibilityTileHtml(l, isOwner)}
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
        bindGroupSection();
        updateDetailContactBar(l);
        updateDetailAdminEditFab(l, { isAdminViewer });
        if (isOwner) {
          loadOwnerViewCount(l.id);
          bindOwnerMenu(l.id);
        } else {
          loadClaimBanner(l);
          recordNonOwnerView(l.id);
        }
        // Owner *or* admin may start a scan (admin CTA also shows on others' listings).
        if (isOwner || isAdmin) {
          bindOwnerAddRoomScan(l.id);
        }
        if (isMiniApp) loadComplaintsWarning(l);
        if (isMiniApp && (!isOwner || isGroupCompatListing(l))) {
          bindCompatibilitySection();
          loadCompatibilityTile(l, isOwner);
        }
        if (isMiniApp) loadGroupJoinRequests();
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
          else renderError(() => {
            // Branded spinner (same as the initial load) instead of a plain
            // "Loading…" text line while the retry is in flight.
            rootEl.innerHTML = '<div class="detail-loading" aria-busy="true" aria-live="polite"><span class="loading-spinner" aria-hidden="true"></span></div>';
            load();
          });
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
