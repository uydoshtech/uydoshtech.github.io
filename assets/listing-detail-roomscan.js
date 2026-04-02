// Part of listing.html's detail-page script, split out of the former single
// ~2900-line assets/listing-detail.js for maintainability (that file is the
// highest-churn file in the site). Loaded as a plain classic <script defer>
// alongside the other listing-detail-*.js files and assets/listing-detail.js
// itself — they all share one global scope (like separate inline <script>
// blocks would), so functions defined here are called directly by the other
// modules and by listing-detail.js's render()/load(). See listing-detail.js
// for the overall module map.
//
// This file: the collapsible 3D room scan tile and its fullscreen <model-viewer> overlay.
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

