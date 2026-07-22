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

      // The backend rewrites room_scan.glb in place (furniture-catalog backfill,
      // re-stylize, furniture-edit rebuilds, ...) without changing its URL, so
      // WebViews — Telegram's in particular — keep serving a stale cached copy
      // forever. Bump this whenever deployed GLBs change server-side globally.
      const ROOM_SCAN_GLB_CACHE_VERSION = '20260717-1';

      // Per-listing busting: furniture edits rebuild only that listing's GLB and
      // bump its `updated_at`, so fold it into the query string too — otherwise a
      // global version alone can't refresh a single edited listing.
      function roomScanGlbUrlWithVersion(url, updatedAt) {
        if (!url) return '';
        const sep = url.includes('?') ? '&' : '?';
        const stamp = updatedAt ? Date.parse(updatedAt) : NaN;
        const rev = Number.isFinite(stamp) ? `-${stamp}` : '';
        return `${url}${sep}v=${ROOM_SCAN_GLB_CACHE_VERSION}${rev}`;
      }

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

      // Short one-word label shown on the button face in the fullscreen viewer only (see
      // `showLabel` on createRoomScanModeButton) — the aria-label above stays the longer
      // descriptive "tap to..." string for accessibility.
      function roomScanModeShortLabelKey(mode) {
        if (mode === 'floorAndFurniture') return 'detail.roomScanModeFloorAndFurnitureShort';
        if (mode === 'floorOnly') return 'detail.roomScanModeFloorOnlyShort';
        return 'detail.roomScanModeFullRoomShort';
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
       * the model has finished loading (silently does nothing). Remembers the last applied
       * mode on the viewer element so the 2D plan view (see enterRoomScanPlanView) can
       * re-apply it — with ceilings force-hidden — without owning the mode state itself. */
      function applyRoomScanDisplayMode(viewerEl, mode) {
        if (viewerEl) viewerEl.__uydoshDisplayMode = mode;
        const model = viewerEl && viewerEl.model;
        if (!model || !Array.isArray(model.materials)) return;
        model.materials.forEach((material) => {
          const kind = classifyRoomScanMaterialName(material.name);
          let hidden = false;
          if (mode === 'floorAndFurniture') hidden = kind === 'wall';
          else if (mode === 'floorOnly') hidden = kind === 'wall' || kind === 'furniture';
          // In the top-down 2D plan view a ceiling mesh (RoomPlan captures one for some
          // rooms; the backend leaves it on its original material, see classifySurface in
          // applyRoomScanStylizedMaterials.ts) would cover the entire floor plan — walls
          // seen edge-on from above read as the plan outline, but a ceiling is just a lid.
          if (viewerEl.__uydoshPlanViewActive && isRoomScanCeilingMaterialName(material.name)) {
            hidden = true;
          }
          setRoomScanMaterialHidden(material, hidden);
        });
      }

      // --- 2D floor plan (bird's-eye) view toggle -----------------------------------------
      // Mirrors the native app's "3D / 2D" tab switch (ViewerTab in
      // RoomUsdzViewerViewController.swift). iOS draws a real vector floor plan from the
      // USDZ geometry (FloorPlanCanvas.swift); on the web we approximate the same bird's-eye
      // read with the GLB we already have: lock <model-viewer>'s camera straight down (polar
      // angle pinned to 0° via min/max-camera-orbit, so dragging only rotates/zooms the
      // plan, never tilts it) and force-hide any ceiling mesh that would otherwise lid the
      // room. Walls stay visible — seen edge-on from above they read as the plan outline.
      function isRoomScanCeilingMaterialName(name) {
        return (name || '').toLowerCase().includes('ceiling');
      }

      /** Locks the camera top-down and hides ceilings. Saves whatever it changes on the
       * viewer element so exitRoomScanPlanView can restore the exact prior 3D state. */
      function enterRoomScanPlanView(viewerEl) {
        if (viewerEl.__uydoshPlanViewActive) return;
        viewerEl.__uydoshPlanViewActive = true;
        viewerEl.__uydoshPlanSavedOrbit = viewerEl.cameraOrbit;
        viewerEl.__uydoshPlanResumeAutoRotate = viewerEl.hasAttribute('auto-rotate');
        viewerEl.removeAttribute('auto-rotate');
        // Keeps the rotate play/pause button's icon in sync (it otherwise only re-reads
        // the auto-rotate attribute on its own clicks).
        viewerEl.dispatchEvent(new CustomEvent('uydosh-autorotate-changed'));
        // Pin the polar (tilt) angle at 0° — theta (plan rotation) and radius (zoom)
        // stay free, so the plan can still be spun and zoomed like a map.
        viewerEl.setAttribute('min-camera-orbit', '-Infinity 0deg auto');
        viewerEl.setAttribute('max-camera-orbit', 'Infinity 0deg auto');
        // Slightly backed off (105%) so the whole footprint fits with a small margin.
        viewerEl.cameraOrbit = '0deg 0deg 105%';
        // Re-apply the mode button's current state — with __uydoshPlanViewActive now set,
        // this pass additionally hides ceiling meshes (see applyRoomScanDisplayMode).
        applyRoomScanDisplayMode(viewerEl, viewerEl.__uydoshDisplayMode || 'fullRoom');
        // Stops the inline tile's passive wall on/off showcase (see autoToggleWalls in
        // createRoomScanModeButton) — in the top-down plan the walls are the outline, and
        // an outline that blinks every 4s reads as a glitch, not a showcase.
        viewerEl.dispatchEvent(new CustomEvent('uydosh-planview-entered'));
      }

      /** Undoes enterRoomScanPlanView: unclamps the camera, restores the saved orbit and
       * auto-rotate, and un-hides ceilings by re-applying the current display mode. */
      function exitRoomScanPlanView(viewerEl) {
        if (!viewerEl.__uydoshPlanViewActive) return;
        viewerEl.__uydoshPlanViewActive = false;
        viewerEl.removeAttribute('min-camera-orbit');
        viewerEl.removeAttribute('max-camera-orbit');
        viewerEl.cameraOrbit = viewerEl.__uydoshPlanSavedOrbit || '0deg 45deg 70%';
        if (viewerEl.__uydoshPlanResumeAutoRotate && !viewerEl.hasAttribute('auto-rotate')) {
          viewerEl.setAttribute('auto-rotate', '');
        }
        viewerEl.__uydoshPlanResumeAutoRotate = false;
        viewerEl.dispatchEvent(new CustomEvent('uydosh-autorotate-changed'));
        applyRoomScanDisplayMode(viewerEl, viewerEl.__uydoshDisplayMode || 'fullRoom');
      }

      /** Creates the "3D | 2D" segmented pill and wires it to `viewerEl` — the web
       * counterpart of the native viewer's top tab control. Always starts on 3D, same as
       * the mode/texture buttons resetting on mount.
       *
       * 2D first tries the vector blueprint overlay (walls/doors/furniture + measurements
       * extracted from the GLB — see listing-detail-floorplan.js), mounted into `host`
       * (the inline viewer wrap or the fullscreen backdrop). The top-down camera lock is
       * applied either way: it's the visible fallback when the blueprint can't be built,
       * and it stops the hidden 3D render loop from spinning under the overlay when it can. */
      function createRoomScanPlanToggle(viewerEl, host, glbUrl) {
        const wrap = document.createElement('div');
        wrap.className = 'roomscan-plan-toggle';
        wrap.setAttribute('role', 'tablist');
        wrap.setAttribute('aria-label', UyDosh.t('detail.roomScanViewToggle'));

        const makeBtn = (label, ariaKey, isPlan) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'roomscan-plan-toggle-btn';
          btn.setAttribute('role', 'tab');
          btn.textContent = label;
          btn.setAttribute('aria-label', UyDosh.t(ariaKey));
          btn.addEventListener('click', () => {
            if (btn.classList.contains('is-active')) return;
            UyDosh.haptic?.light?.();
            if (isPlan) {
              enterRoomScanPlanView(viewerEl);
              if (typeof mountRoomScanBlueprint === 'function' && host && glbUrl) {
                mountRoomScanBlueprint(host, glbUrl);
              }
            } else {
              if (typeof unmountRoomScanBlueprint === 'function' && host) {
                unmountRoomScanBlueprint(host);
              }
              exitRoomScanPlanView(viewerEl);
            }
            updateSelection();
          });
          return btn;
        };
        // "3D"/"2D" stay unlocalized on the button faces (same as the native tab control
        // and the app's own `3D`-style icon labels); the aria-labels carry the translation.
        const btn3d = makeBtn('3D', 'detail.roomScanView3d', false);
        const btn2d = makeBtn('2D', 'detail.roomScanView2d', true);
        const updateSelection = () => {
          const planActive = !!viewerEl.__uydoshPlanViewActive;
          btn3d.classList.toggle('is-active', !planActive);
          btn2d.classList.toggle('is-active', planActive);
          btn3d.setAttribute('aria-selected', planActive ? 'false' : 'true');
          btn2d.setAttribute('aria-selected', planActive ? 'true' : 'false');
        };
        wrap.appendChild(btn3d);
        wrap.appendChild(btn2d);
        updateSelection();
        return wrap;
      }

      // 4s: long enough that a glance registers each state (walls on vs. off) before it
      // flips again, short enough to catch a scrolling viewer's eye — and deliberately not a
      // clean multiple of the model's own 6s auto-rotate period (see rotation-per-second in
      // createModelViewerEl), so the reveal doesn't always land at the same rotation angle.
      const ROOM_SCAN_AUTO_WALL_TOGGLE_INTERVAL_MS = 4000;

      /** Creates the mode-cycling button and wires it to `viewerEl`. Re-applies the current
       * mode once the model finishes loading, covering clicks that land before then.
       *
       * `autoToggleWalls` (inline preview tile only, see mountRoomScanViewer — the fullscreen
       * viewer already gives the user full manual control, so it doesn't need this) makes the
       * button also automatically alternate fullRoom ⇄ floorAndFurniture on a timer, as a
       * passive "peek inside" showcase for someone just scrolling past. It reuses the same `mode`/
       * `updateAppearance`/`applyRoomScanDisplayMode` path the manual click handler uses, so
       * the button's own label always matches whatever state — manual or automatic — the
       * model is actually in. An IntersectionObserver pauses the timer once the tile scrolls
       * off-screen or its section is collapsed (both leave it with zero size), mirroring
       * createRoomScanZoomSlider's own care about not burning cycles on a render loop no one
       * can see. The first manual tap always wins permanently — it stops the timer and
       * disconnects the observer, handing full control to the user from then on. */
      function createRoomScanModeButton(viewerEl, { autoToggleWalls = false, showLabel = false } = {}) {
        let mode = 'fullRoom';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = showLabel ? 'roomscan-mode-btn roomscan-mode-btn--label' : 'roomscan-mode-btn';
        const updateAppearance = () => {
          if (showLabel) {
            btn.innerHTML = roomScanModeIconHtml(mode) +
              `<span class="roomscan-btn-label-text">${UyDosh.escapeHtml(UyDosh.t(roomScanModeShortLabelKey(mode)))}</span>`;
          } else {
            btn.innerHTML = roomScanModeIconHtml(mode);
          }
          btn.setAttribute('aria-label', UyDosh.t(roomScanModeLabelKey(mode)));
        };
        updateAppearance();

        let autoToggleTimer = null;
        let autoToggleObserver = null;
        const stopAutoToggle = () => {
          if (autoToggleTimer) clearInterval(autoToggleTimer);
          autoToggleTimer = null;
          autoToggleObserver?.disconnect();
          autoToggleObserver = null;
        };

        btn.addEventListener('click', () => {
          stopAutoToggle();
          mode = nextRoomScanMode(mode);
          updateAppearance();
          UyDosh.haptic?.light?.();
          applyRoomScanDisplayMode(viewerEl, mode);
        });
        viewerEl.addEventListener('load', () => applyRoomScanDisplayMode(viewerEl, mode));

        if (autoToggleWalls) {
          // Entering the 2D plan view (see enterRoomScanPlanView) permanently stops the
          // showcase too, same as a manual tap — the user is clearly engaged by then.
          viewerEl.addEventListener('uydosh-planview-entered', stopAutoToggle, { once: true });
          const tick = () => {
            mode = mode === 'fullRoom' ? 'floorAndFurniture' : 'fullRoom';
            updateAppearance();
            applyRoomScanDisplayMode(viewerEl, mode);
          };
          autoToggleObserver = new IntersectionObserver((entries) => {
            const isVisible = entries.some((entry) => entry.isIntersecting);
            if (isVisible && !autoToggleTimer) {
              autoToggleTimer = setInterval(tick, ROOM_SCAN_AUTO_WALL_TOGGLE_INTERVAL_MS);
            } else if (!isVisible && autoToggleTimer) {
              clearInterval(autoToggleTimer);
              autoToggleTimer = null;
            }
          });
          autoToggleObserver.observe(viewerEl.parentElement || viewerEl);
        }

        return btn;
      }

      // --- 3D room scan wall texture toggle -----------------------------------------------
      // Lets the viewer swap the GLB's baked-in brick wall look for an alternate plaster
      // look, entirely client-side via <model-viewer>'s Scene Graph API
      // (https://modelviewer.dev/examples/scenegraph/) — no backend re-conversion needed,
      // since the backend already bakes wall UVs to repeat at a fixed physical tile size
      // regardless of which image ends up sampling them (see classifySurface/MATERIAL_PARAMS
      // in uydosh_backend's applyRoomScanStylizedMaterials.ts), so swapping in a differently
      // generated texture here still tiles correctly.
      const ROOM_SCAN_WALL_TEXTURES = ['brick', 'plaster'];

      function nextRoomScanWallTexture(texture) {
        const idx = ROOM_SCAN_WALL_TEXTURES.indexOf(texture);
        return ROOM_SCAN_WALL_TEXTURES[(idx + 1) % ROOM_SCAN_WALL_TEXTURES.length];
      }

      function roomScanWallTextureLabelKey(texture) {
        return texture === 'plaster' ? 'detail.roomScanWallTexturePlaster' : 'detail.roomScanWallTextureBrick';
      }

      // Short label shown on the button face in the fullscreen viewer only — mirrors
      // roomScanModeShortLabelKey.
      function roomScanWallTextureShortLabelKey(texture) {
        return texture === 'plaster' ? 'detail.roomScanWallTexturePlasterShort' : 'detail.roomScanWallTextureBrickShort';
      }

      // Per-state glyph, mirroring roomScanModeIconHtml — a staggered brick pattern for
      // 'brick', a paint roller for 'plaster' — so the icon itself (not just the
      // aria-label/short label) reflects which texture is currently applied.
      function roomScanWallTextureIconHtml(texture) {
        if (texture === 'plaster') {
          return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="2" y="2" width="16" height="6" rx="2"></rect>
            <path d="M10 16v-2a2 2 0 0 1 2-2h8"></path>
            <path d="M18 12h2a2 2 0 0 1 2 2v2"></path>
            <rect x="8" y="16" width="4" height="6" rx="1"></rect>
          </svg>`;
        }
        return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="2" y="4" width="20" height="16" rx="1"></rect>
          <path d="M2 9h20M2 15h20"></path>
          <path d="M8 4v5M16 9v6M8 15v5"></path>
        </svg>`;
      }

      // Stricter than classifyRoomScanMaterialName's grouped 'wall' (which also folds in
      // ceiling/door/window/opening for display-mode hiding, matching iOS) — texture
      // swapping should only ever touch actual wall surfaces, mirroring the backend's own
      // wall-only bake (classifySurface in applyRoomScanStylizedMaterials.ts keeps doors/
      // windows/openings/ceiling on their originally captured materials).
      function isRoomScanWallMaterialName(name) {
        return (name || '').toLowerCase().startsWith('wall');
      }

      let roomScanPlasterTextureDataUrl = null;

      /** Renders a small tileable plaster-wall pattern into an offscreen canvas once and
       * caches the resulting data URL — deterministic (no Math.random) so repeated calls
       * (e.g. across the inline tile and fullscreen viewer, which each need their own
       * model-viewer <Texture>) always produce byte-identical output, mirroring the
       * deterministic SVG generators backend/scripts/render-room-scan-textures.js uses for
       * brick/wood-floor. A muted beige base (rather than a near-white one) keeps the
       * material readable as painted plaster instead of blowing out to a flat white wall
       * once lit by the scene (same concern the metal furniture texture's comment notes). */
      function getRoomScanPlasterTextureDataUrl() {
        if (roomScanPlasterTextureDataUrl) return roomScanPlasterTextureDataUrl;
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#C7B896';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 900; i++) {
          const x = (i * 53) % size;
          const y = (i * 97) % size;
          const r = 6 + (i % 5);
          ctx.fillStyle = i % 3 === 0 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)';
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        // Faint trowel-stroke streaks running across the tile.
        for (let i = 0; i < 24; i++) {
          const y = (i / 24) * size + (i % 2) * 4;
          ctx.strokeStyle = i % 2 === 0 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(size, y + 10);
          ctx.stroke();
        }
        roomScanPlasterTextureDataUrl = canvas.toDataURL('image/png');
        return roomScanPlasterTextureDataUrl;
      }

      /** Creates (once per viewer element, since model-viewer <Texture> objects belong to a
       * specific loaded model) and caches the plaster <Texture> used to retexture walls. */
      async function getRoomScanPlasterTexture(viewerEl) {
        if (viewerEl.__uydoshPlasterTexture) return viewerEl.__uydoshPlasterTexture;
        const texture = await viewerEl.createTexture(getRoomScanPlasterTextureDataUrl());
        viewerEl.__uydoshPlasterTexture = texture;
        return texture;
      }

      /** Swaps every wall material's base color texture between the GLB's baked-in brick
       * (cached the first time we switch away from it, same pattern as
       * setRoomScanMaterialHidden's __uydoshOriginalColor caching) and the plaster texture
       * above. */
      async function applyRoomScanWallTexture(viewerEl, texture) {
        const model = viewerEl && viewerEl.model;
        if (!model || !Array.isArray(model.materials)) return;
        const plasterTexture = texture === 'plaster' ? await getRoomScanPlasterTexture(viewerEl) : null;
        model.materials.forEach((material) => {
          if (!isRoomScanWallMaterialName(material.name)) return;
          try {
            const pbr = material.pbrMetallicRoughness;
            if (!pbr || !pbr.baseColorTexture) return;
            if (!material.__uydoshOriginalWallTexture) {
              material.__uydoshOriginalWallTexture = pbr.baseColorTexture.texture;
            }
            pbr.baseColorTexture.setTexture(texture === 'plaster' ? plasterTexture : material.__uydoshOriginalWallTexture);
          } catch (err) {
            // Scene Graph API unavailable/model not loaded yet — same tolerance as
            // setRoomScanMaterialHidden above.
          }
        });
      }

      /** Creates the wall-texture toggle button and wires it to `viewerEl`. Always starts
       * from 'brick' (the GLB's own baked default) on mount, same as the mode button
       * resetting to 'fullRoom' — mirrors createRoomScanModeButton just above. */
      function createRoomScanWallTextureButton(viewerEl, { showLabel = false } = {}) {
        let texture = 'brick';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = showLabel ? 'roomscan-texture-btn roomscan-texture-btn--label' : 'roomscan-texture-btn';
        const updateAppearance = () => {
          if (showLabel) {
            btn.innerHTML = roomScanWallTextureIconHtml(texture) +
              `<span class="roomscan-btn-label-text">${UyDosh.escapeHtml(UyDosh.t(roomScanWallTextureShortLabelKey(texture)))}</span>`;
          } else {
            btn.innerHTML = roomScanWallTextureIconHtml(texture);
          }
          btn.setAttribute('aria-label', UyDosh.t(roomScanWallTextureLabelKey(texture)));
        };
        updateAppearance();
        btn.addEventListener('click', () => {
          texture = nextRoomScanWallTexture(texture);
          updateAppearance();
          UyDosh.haptic?.light?.();
          applyRoomScanWallTexture(viewerEl, texture);
        });
        return btn;
      }

      // --- 3D room scan floor texture toggle ----------------------------------------------
      // Same idea as the wall texture toggle above, applied to floor materials instead —
      // swaps the GLB's baked-in dark wood floor for a light tile look, entirely client-side.
      const ROOM_SCAN_FLOOR_TEXTURES = ['wood', 'tile'];

      function nextRoomScanFloorTexture(texture) {
        const idx = ROOM_SCAN_FLOOR_TEXTURES.indexOf(texture);
        return ROOM_SCAN_FLOOR_TEXTURES[(idx + 1) % ROOM_SCAN_FLOOR_TEXTURES.length];
      }

      function roomScanFloorTextureLabelKey(texture) {
        return texture === 'tile' ? 'detail.roomScanFloorTextureTile' : 'detail.roomScanFloorTextureWood';
      }

      // Short label shown on the button face in the fullscreen viewer only — mirrors
      // roomScanModeShortLabelKey.
      function roomScanFloorTextureShortLabelKey(texture) {
        return texture === 'tile' ? 'detail.roomScanFloorTextureTileShort' : 'detail.roomScanFloorTextureWoodShort';
      }

      // Per-state glyph, mirroring roomScanWallTextureIconHtml — parallel planks for
      // 'wood', a 2x2 tile grid for 'tile' — so the icon itself reflects the applied floor
      // texture instead of staying static across both states.
      function roomScanFloorTextureIconHtml(texture) {
        if (texture === 'tile') {
          return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2"></rect>
            <path d="M3 12h18"></path>
            <path d="M12 3v18"></path>
          </svg>`;
        }
        return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="1"></rect>
          <path d="M3 8.5h18M3 13h18M3 17.5h18"></path>
        </svg>`;
      }

      // Mirrors classifySurface's floor check in applyRoomScanStylizedMaterials.ts.
      function isRoomScanFloorMaterialName(name) {
        const n = (name || '').toLowerCase();
        return n.startsWith('floor') || n.includes('ground');
      }

      let roomScanTileTextureDataUrl = null;

      /** Renders a small tileable light-tile-floor pattern (white/off-white square tiles,
       * dark grey grout) into an offscreen canvas once and caches the resulting data URL —
       * same deterministic-canvas approach as getRoomScanPlasterTextureDataUrl above. */
      function getRoomScanTileTextureDataUrl() {
        if (roomScanTileTextureDataUrl) return roomScanTileTextureDataUrl;
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const tiles = 4;
        const tileSize = size / tiles;
        const groutW = 6;
        const tileShades = ['#F1EEE4', '#E9E6DA', '#F6F3EA'];
        ctx.fillStyle = '#2E2E2E';
        ctx.fillRect(0, 0, size, size);
        for (let ty = 0; ty < tiles; ty++) {
          for (let tx = 0; tx < tiles; tx++) {
            const x = tx * tileSize;
            const y = ty * tileSize;
            const w = tileSize - groutW;
            ctx.fillStyle = tileShades[(tx + ty * tiles) % tileShades.length];
            ctx.fillRect(x + groutW / 2, y + groutW / 2, w, w);
            // Faint top highlight / bottom shadow per tile for a subtle glazed look.
            ctx.fillStyle = 'rgba(255,255,255,0.18)';
            ctx.fillRect(x + groutW / 2, y + groutW / 2, w, 3);
            ctx.fillStyle = 'rgba(0,0,0,0.06)';
            ctx.fillRect(x + groutW / 2, y + groutW / 2 + w - 3, w, 3);
          }
        }
        roomScanTileTextureDataUrl = canvas.toDataURL('image/png');
        return roomScanTileTextureDataUrl;
      }

      /** Creates (once per viewer element) and caches the tile <Texture> used to
       * retexture floors — mirrors getRoomScanPlasterTexture above. */
      async function getRoomScanTileTexture(viewerEl) {
        if (viewerEl.__uydoshTileTexture) return viewerEl.__uydoshTileTexture;
        const texture = await viewerEl.createTexture(getRoomScanTileTextureDataUrl());
        viewerEl.__uydoshTileTexture = texture;
        return texture;
      }

      /** Swaps every floor material's base color texture between the GLB's baked-in dark
       * wood and the tile texture above — mirrors applyRoomScanWallTexture above. */
      async function applyRoomScanFloorTexture(viewerEl, texture) {
        const model = viewerEl && viewerEl.model;
        if (!model || !Array.isArray(model.materials)) return;
        const tileTexture = texture === 'tile' ? await getRoomScanTileTexture(viewerEl) : null;
        model.materials.forEach((material) => {
          if (!isRoomScanFloorMaterialName(material.name)) return;
          try {
            const pbr = material.pbrMetallicRoughness;
            if (!pbr || !pbr.baseColorTexture) return;
            if (!material.__uydoshOriginalFloorTexture) {
              material.__uydoshOriginalFloorTexture = pbr.baseColorTexture.texture;
            }
            pbr.baseColorTexture.setTexture(texture === 'tile' ? tileTexture : material.__uydoshOriginalFloorTexture);
          } catch (err) {
            // Scene Graph API unavailable/model not loaded yet — same tolerance as
            // setRoomScanMaterialHidden above.
          }
        });
      }

      /** Creates the floor-texture toggle button and wires it to `viewerEl`. Always starts
       * from 'wood' (the GLB's own baked default) on mount — mirrors
       * createRoomScanWallTextureButton above. */
      function createRoomScanFloorTextureButton(viewerEl, { showLabel = false } = {}) {
        let texture = 'wood';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = showLabel ? 'roomscan-floor-texture-btn roomscan-floor-texture-btn--label' : 'roomscan-floor-texture-btn';
        const updateAppearance = () => {
          if (showLabel) {
            btn.innerHTML = roomScanFloorTextureIconHtml(texture) +
              `<span class="roomscan-btn-label-text">${UyDosh.escapeHtml(UyDosh.t(roomScanFloorTextureShortLabelKey(texture)))}</span>`;
          } else {
            btn.innerHTML = roomScanFloorTextureIconHtml(texture);
          }
          btn.setAttribute('aria-label', UyDosh.t(roomScanFloorTextureLabelKey(texture)));
        };
        updateAppearance();
        btn.addEventListener('click', () => {
          texture = nextRoomScanFloorTexture(texture);
          updateAppearance();
          UyDosh.haptic?.light?.();
          applyRoomScanFloorTexture(viewerEl, texture);
        });
        return btn;
      }

      // --- 3D room scan auto-rotate play/pause --------------------------------------------
      // Occupies the bottom control bar's leading slot the mode-cycling button used to sit
      // in before it moved into the top-right button group alongside the wall/floor texture
      // toggles (see createRoomScanModeButton and its mount sites below). Reflects
      // `<model-viewer>`'s own `auto-rotate` attribute directly rather than separate state,
      // so it stays correct even though createRoomScanZoomSlider's
      // pauseAutoRotateForDrag/resumeAutoRotateAfterDrag also toggles that same attribute
      // (transiently, for the duration of a slider drag) — if the user paused rotation with
      // this button, a slider drag reads `auto-rotate` as already absent and won't
      // resurrect it afterward.
      function roomScanRotateIconHtml(isRotating) {
        if (isRotating) {
          return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1"></rect>
            <rect x="14" y="5" width="4" height="14" rx="1"></rect>
          </svg>`;
        }
        return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M7 4.5v15l13-7.5-13-7.5Z"></path>
        </svg>`;
      }

      function roomScanRotateLabelKey(isRotating) {
        return isRotating ? 'detail.roomScanRotatePause' : 'detail.roomScanRotatePlay';
      }

      /** Creates the auto-rotate play/pause button and wires it to `viewerEl`. */
      function createRoomScanRotateButton(viewerEl) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'roomscan-rotate-btn';
        const updateAppearance = () => {
          const isRotating = viewerEl.hasAttribute('auto-rotate');
          btn.innerHTML = roomScanRotateIconHtml(isRotating);
          btn.setAttribute('aria-label', UyDosh.t(roomScanRotateLabelKey(isRotating)));
        };
        updateAppearance();
        btn.addEventListener('click', () => {
          UyDosh.haptic?.light?.();
          if (viewerEl.hasAttribute('auto-rotate')) viewerEl.removeAttribute('auto-rotate');
          else viewerEl.setAttribute('auto-rotate', '');
          updateAppearance();
        });
        // The 2D plan toggle also pauses/resumes auto-rotate (see enterRoomScanPlanView)
        // and announces it via this event so the play/pause icon here doesn't go stale.
        viewerEl.addEventListener('uydosh-autorotate-changed', updateAppearance);
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

      // --- World-direction compass ring (fullscreen 3D only) ------------------------------
      // Ports FloorPlanNorthOrientation + WorldCompassRingController from room_scan_kit: a
      // thin floor ring around the building with N/E/S/W badges (same look as the native
      // Flutter/iOS viewer). Drawn as an SVG overlay projected through <model-viewer>'s
      // camera — not the small HUD rose. Hidden in 2D blueprint mode (native hides the
      // 3D ring on the floor-plan tab too).

      /** Degrees clockwise from true north of world +X, normalized to [0, 360). */
      function roomScanEffectiveWorldPlusXBearingDeg(scanBearing, correctionDeg) {
        let bearing = scanBearing + correctionDeg;
        bearing %= 360;
        if (bearing < 0) bearing += 360;
        return bearing;
      }

      /**
       * Plan-space angle (radians, CCW from world +X toward world −Z) of geographic north.
       * Mirrors FloorPlanNorthOrientation.trueNorthPlanAngleRad (worldEast defaults to 0 —
       * the published GLB is still in scan/world axes, not a re-yawed editable plan).
       */
      function roomScanTrueNorthPlanAngleRad(scanBearingDeg, correctionDeg) {
        const correction = Number.isFinite(correctionDeg) ? correctionDeg : 0;
        if (Number.isFinite(scanBearingDeg)) {
          return roomScanEffectiveWorldPlusXBearingDeg(scanBearingDeg, correction) * Math.PI / 180;
        }
        // No compass at scan time: world −Z is scan "forward" on the plan.
        return Math.PI / 2 + correction * Math.PI / 180;
      }

      function roomScanParseListingBearing(l) {
        const bearing = Number(l?.room_scan_world_plus_x_bearing_deg);
        const correction = Number(l?.room_scan_north_correction_deg);
        return {
          scanBearingDeg: Number.isFinite(bearing) ? bearing : null,
          correctionDeg: Number.isFinite(correction) ? correction : 0,
        };
      }

      /** worldXZ(φ) = (cos φ, −sin φ) — same as WorldCompassRingController. */
      function roomScanWorldXZFromPlanAngle(planAngleRad) {
        return { x: Math.cos(planAngleRad), z: -Math.sin(planAngleRad) };
      }

      /**
       * Projects a world-space point through <model-viewer>'s current orbit camera into
       * element-local CSS pixels. Returns null when the point is behind the camera.
       */
      function roomScanProjectWorldToScreen(wx, wy, wz, viewerEl) {
        if (typeof viewerEl.getCameraOrbit !== 'function' || typeof viewerEl.getCameraTarget !== 'function') {
          return null;
        }
        const orbit = viewerEl.getCameraOrbit();
        const target = viewerEl.getCameraTarget();
        const fovDeg = typeof viewerEl.getFieldOfView === 'function' ? viewerEl.getFieldOfView() : 45;
        if (!orbit || !target || !Number.isFinite(orbit.radius) || !(orbit.radius > 0)) return null;

        const rect = viewerEl.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        if (!(width > 1 && height > 1)) return null;
        const aspect = width / height;
        const fovY = (Number.isFinite(fovDeg) ? fovDeg : 45) * Math.PI / 180;
        const theta = orbit.theta;
        const phi = orbit.phi;
        const radius = orbit.radius;

        // Three.js / model-viewer spherical: theta from +Z toward +X, phi from +Y.
        const eyeX = target.x + radius * Math.sin(phi) * Math.sin(theta);
        const eyeY = target.y + radius * Math.cos(phi);
        const eyeZ = target.z + radius * Math.sin(phi) * Math.cos(theta);

        let fx = target.x - eyeX;
        let fy = target.y - eyeY;
        let fz = target.z - eyeZ;
        const fLen = Math.hypot(fx, fy, fz) || 1;
        fx /= fLen; fy /= fLen; fz /= fLen;

        // Prefer +Y up; when looking nearly straight down/up, derive up from theta so the
        // basis stays stable (same singularity model-viewer handles in its orbit controls).
        let ux = 0;
        let uy = 1;
        let uz = 0;
        if (Math.abs(fy) > 0.999) {
          ux = -Math.sin(theta);
          uy = 0;
          uz = -Math.cos(theta);
        }

        let rx = fy * uz - fz * uy;
        let ry = fz * ux - fx * uz;
        let rz = fx * uy - fy * ux;
        const rLen = Math.hypot(rx, ry, rz) || 1;
        rx /= rLen; ry /= rLen; rz /= rLen;

        ux = ry * fz - rz * fy;
        uy = rz * fx - rx * fz;
        uz = rx * fy - ry * fx;

        const dx = wx - eyeX;
        const dy = wy - eyeY;
        const dz = wz - eyeZ;
        const viewZ = -(dx * fx + dy * fy + dz * fz);
        if (!(viewZ < -1e-4)) return null;
        const viewX = dx * rx + dy * ry + dz * rz;
        const viewY = dx * ux + dy * uy + dz * uz;

        const tanHalf = Math.tan(fovY / 2);
        const ndcX = viewX / (-viewZ * tanHalf * aspect);
        const ndcY = viewY / (-viewZ * tanHalf);
        return {
          x: (ndcX * 0.5 + 0.5) * width,
          y: (-ndcY * 0.5 + 0.5) * height,
        };
      }

      /**
       * Floor compass ring around the scan footprint — fullscreen 3D only.
       * Mirrors WorldCompassRingController (torus + billboard N/E/S/W badges).
       */
      function createRoomScanWorldCompassRing(viewerEl, host, l) {
        const { scanBearingDeg, correctionDeg } = roomScanParseListingBearing(l);
        const trueNorthPlanAngleRad = roomScanTrueNorthPlanAngleRad(scanBearingDeg, correctionDeg);

        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.classList.add('roomscan-world-compass');
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', UyDosh.t('detail.roomScanCompass'));

        const ringPath = document.createElementNS(svgNS, 'path');
        ringPath.classList.add('roomscan-world-compass-ring');
        svg.appendChild(ringPath);

        // Plan offsets match WorldCompassRingController.rebuildCardinals.
        const badges = [
          { text: 'N', offset: 0, isNorth: true },
          { text: 'E', offset: -Math.PI / 2, isNorth: false },
          { text: 'S', offset: Math.PI, isNorth: false },
          { text: 'W', offset: Math.PI / 2, isNorth: false },
        ].map(({ text, offset, isNorth }) => {
          const g = document.createElementNS(svgNS, 'g');
          g.classList.add('roomscan-world-compass-badge');
          if (isNorth) g.classList.add('is-n');
          const circle = document.createElementNS(svgNS, 'circle');
          circle.setAttribute('r', '16');
          const label = document.createElementNS(svgNS, 'text');
          label.textContent = text;
          label.setAttribute('text-anchor', 'middle');
          label.setAttribute('dominant-baseline', 'central');
          g.appendChild(circle);
          g.appendChild(label);
          svg.appendChild(g);
          return { g, circle, label, offset, isNorth };
        });

        const RING_MARGIN_M = 0.65;
        const MIN_RADIUS_M = 1.5;
        const RING_SAMPLES = 64;
        // Listing footprint as a pre-load fallback (model dims win once available).
        const listingLong = Number(l?.room_scan_floor_long_m);
        const listingShort = Number(l?.room_scan_floor_short_m);

        let raf = 0;
        let spinRaf = 0;
        const ac = new AbortController();
        const { signal } = ac;

        const resolveLayout = () => {
          let sizeX = 0;
          let sizeY = 0;
          let sizeZ = 0;
          let cx = 0;
          let cy = 0;
          let cz = 0;
          if (typeof viewerEl.getDimensions === 'function') {
            const dims = viewerEl.getDimensions();
            if (dims && Number.isFinite(dims.x) && dims.x > 0.05) {
              sizeX = dims.x;
              sizeY = dims.y;
              sizeZ = dims.z;
            }
          }
          if (!(sizeX > 0) && listingLong > 0 && listingShort > 0) {
            sizeX = listingLong;
            sizeZ = listingShort;
            sizeY = Number(l?.room_scan_height_m) || 3;
          }
          if (typeof viewerEl.getBoundingBoxCenter === 'function') {
            const c = viewerEl.getBoundingBoxCenter();
            if (c && Number.isFinite(c.x)) {
              cx = c.x; cy = c.y; cz = c.z;
            }
          } else if (typeof viewerEl.getCameraTarget === 'function') {
            const t = viewerEl.getCameraTarget();
            if (t && Number.isFinite(t.x)) {
              cx = t.x; cy = t.y; cz = t.z;
            }
          }
          if (!(sizeX > 0 && sizeZ > 0)) return null;
          const halfDiag = 0.5 * Math.hypot(sizeX, sizeZ);
          const radius = Math.max(halfDiag + RING_MARGIN_M, MIN_RADIUS_M);
          // Sit the ring on the floor plane (bottom of the AABB), slightly lifted.
          const floorY = cy - sizeY * 0.5 + 0.02;
          return { cx, cy: floorY, cz, radius };
        };

        const apply = () => {
          if (!svg.isConnected) {
            ac.abort();
            return;
          }
          // Native hides the 3D floor ring on the floor-plan tab.
          if (host.classList.contains('is-blueprint') || viewerEl.__uydoshPlanViewActive) {
            svg.hidden = true;
            return;
          }
          const layout = resolveLayout();
          if (!layout) {
            svg.hidden = true;
            return;
          }
          svg.hidden = false;

          const { cx, cy, cz, radius } = layout;
          const pts = [];
          for (let i = 0; i <= RING_SAMPLES; i++) {
            const a = (i / RING_SAMPLES) * Math.PI * 2;
            const xz = roomScanWorldXZFromPlanAngle(a);
            const p = roomScanProjectWorldToScreen(
              cx + xz.x * radius,
              cy,
              cz + xz.z * radius,
              viewerEl
            );
            if (p) pts.push(p);
          }
          if (pts.length < 8) {
            svg.hidden = true;
            return;
          }
          ringPath.setAttribute(
            'd',
            pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z'
          );

          // Badge size from projected ring radius (rough: distance between opposite samples).
          let screenRadius = 80;
          if (pts.length > 2) {
            const mid = pts[Math.floor(pts.length / 2)];
            screenRadius = Math.hypot(pts[0].x - mid.x, pts[0].y - mid.y) * 0.5;
          }
          const badgeR = Math.max(14, Math.min(22, screenRadius * 0.09));

          for (const badge of badges) {
            const planAngle = trueNorthPlanAngleRad + badge.offset;
            const xz = roomScanWorldXZFromPlanAngle(planAngle);
            const labelR = radius + (badge.isNorth ? 0.55 : 0.48);
            const p = roomScanProjectWorldToScreen(
              cx + xz.x * labelR,
              cy + badgeR * 0.02,
              cz + xz.z * labelR,
              viewerEl
            );
            if (!p) {
              badge.g.setAttribute('visibility', 'hidden');
              continue;
            }
            badge.g.setAttribute('visibility', 'visible');
            badge.g.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
            badge.circle.setAttribute('r', badgeR.toFixed(1));
            badge.label.setAttribute('font-size', Math.max(11, badgeR * 0.95).toFixed(1));
          }
        };

        const schedule = () => {
          if (raf || signal.aborted) return;
          raf = requestAnimationFrame(() => {
            raf = 0;
            apply();
          });
        };

        const spinTick = () => {
          if (!svg.isConnected) {
            ac.abort();
            return;
          }
          apply();
          if (viewerEl.hasAttribute('auto-rotate') && !viewerEl.__uydoshPlanViewActive) {
            spinRaf = requestAnimationFrame(spinTick);
          } else {
            spinRaf = 0;
          }
        };
        const syncSpinLoop = () => {
          if (spinRaf || signal.aborted) return;
          if (viewerEl.hasAttribute('auto-rotate') && !viewerEl.__uydoshPlanViewActive) {
            spinRaf = requestAnimationFrame(spinTick);
          } else {
            schedule();
          }
        };

        viewerEl.addEventListener('camera-change', schedule, { signal });
        viewerEl.addEventListener('load', schedule, { signal });
        viewerEl.addEventListener('uydosh-autorotate-changed', syncSpinLoop, { signal });
        host.addEventListener('uydosh-blueprint-changed', schedule, { signal });
        window.addEventListener('resize', schedule, { signal });
        svg.__uydoshCompassAbort = ac;
        schedule();
        syncSpinLoop();
        return svg;
      }

      /** Share button for the fullscreen overlay only — separate from the listing's
       * general share button (`data-share-listing`, listing-detail-actions.js). Shares
       * a link that lands the recipient straight in this same fullscreen 3D view (see
       * buildListing3dShareUrl/redirectFromMiniAppStartParam) rather than the plain
       * listing page. */
      function createRoomScanShareButton(l) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'roomscan-share-btn';
        btn.innerHTML = UyDosh.iconShare('#fff');
        btn.setAttribute('aria-label', UyDosh.t('detail.roomScanShare'));
        btn.addEventListener('click', () => shareRoomScan3d(l));
        return btn;
      }

      /** Passes a crawlable API URL as `linkPreviewUrl` so Telegram unfurls
       * Open Graph tags (GIF when ready). The tap target stays the `t.me` `_3d` link. */
      async function shareRoomScan3d(l) {
        if (!l) return;
        UyDosh.haptic?.light?.();
        const lang = UyDosh.getLang();
        const shareUrl = buildListing3dShareUrl(l.id);
        const text = buildListingShareText(l, lang);
        const linkPreviewUrl = `${UyDosh.API_BASE || 'https://api.uydosh.com'}/listing/${encodeURIComponent(l.id)}?preview=3d`;
        // Bust WebView/CDN immutable cache — rotation.gif is overwritten in place.
        const gifBase = typeof l.room_scan_rotation_gif_url === 'string'
          ? UyDosh.photoUrl(l.room_scan_rotation_gif_url)
          : '';
        const gifV = l.room_scan_media_generated_at
          ? Date.parse(l.room_scan_media_generated_at) || Date.now()
          : Date.now();
        const gifUrl = gifBase
          ? `${gifBase}${gifBase.includes('?') ? '&' : '?'}v=${gifV}`
          : '';
        const photoUrls = gifUrl ? [gifUrl] : [];
        const method = await UyDosh.shareListingLink(
          shareUrl,
          text,
          photoUrls,
          '',
          linkPreviewUrl
        );
        if (UyDosh.isMiniApp()) {
          UyDosh.logMiniAppEvent('listing_share_tapped', {
            listing_id: Number(l.id),
            source: 'telegram_mini_app_room_scan_3d',
            share_method: method || 'unknown',
            has_rotation_gif: Boolean(gifUrl),
          });
        }
      }

      function roomScanMetaRowHtml(icon, text) {
        return `<span class="roomscan-toggle-meta-row"><span class="roomscan-toggle-meta-icon" aria-hidden="true">${icon}</span>${UyDosh.escapeHtml(text)}</span>`;
      }

      // Small filled-dot separator between two meta rows sharing one line (dimensions • area)
      // — CSS-styled (.roomscan-toggle-meta-sep) rather than a full icon, since it's just a
      // plain inline glyph.
      const ROOM_SCAN_META_SEP_HTML = '<span class="roomscan-toggle-meta-sep" aria-hidden="true">&#9679;</span>';

      /** Mirrors the mobile app's room-3D tile stats (see room_3d_tile.dart). Two layouts:
       * the inline toggle's under-viewer summary groups dimensions + area onto one line
       * (separated by a dot, evoking a stats strip like "3 bed • 2 bath") with height on a
       * line below, to stay compact under the small mini-view; the fullscreen viewer's
       * dimensions overlay instead gives each stat its own row (`oneRowPerStat: true`), same
       * as it originally had room for. Both just stack whatever lines this returns in a flex
       * column. */
      function buildRoomScanDimensionsMetaHtml(l, { oneRowPerStat = false } = {}) {
        const floorLong = Number(l.room_scan_floor_long_m);
        const floorShort = Number(l.room_scan_floor_short_m);
        const heightM = Number(l.room_scan_height_m);
        const areaM2 = Number(l.room_scan_floor_area_m2);
        const isPositive = (n) => Number.isFinite(n) && n > 0;
        if (isPositive(floorLong) && isPositive(floorShort) && isPositive(heightM) && isPositive(areaM2)) {
          const dimsRow = roomScanMetaRowHtml(UyDosh.iconRectangleOutline(), `${UyDosh.t('detail.roomScanDimensions')}: ${floorLong.toFixed(1)} × ${floorShort.toFixed(1)} m`);
          const areaRow = roomScanMetaRowHtml(UyDosh.iconOverlapRects(), `${UyDosh.t('detail.roomScanArea')}: ~${areaM2.toFixed(1)} m²`);
          const heightRow = roomScanMetaRowHtml(UyDosh.iconHeightArrows(), `${UyDosh.t('detail.roomScanHeight')}: ${heightM.toFixed(1)} m`);
          if (oneRowPerStat) {
            return (
              `<span class="roomscan-toggle-meta-line">${dimsRow}</span>` +
              `<span class="roomscan-toggle-meta-line">${areaRow}</span>` +
              `<span class="roomscan-toggle-meta-line">${heightRow}</span>`
            );
          }
          return (
            `<span class="roomscan-toggle-meta-line">${dimsRow}${ROOM_SCAN_META_SEP_HTML}${areaRow}</span>` +
            `<span class="roomscan-toggle-meta-line">${heightRow}</span>`
          );
        }
        if (isPositive(areaM2)) {
          return `<span class="roomscan-toggle-meta-line">${roomScanMetaRowHtml(UyDosh.iconOverlapRects(), `${UyDosh.t('detail.roomScanArea')}: ${Math.round(areaM2)} m²`)}</span>`;
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
              </span>
              <span class="roomscan-chevron" aria-hidden="true">▾</span>
            </button>
            <div class="roomscan-body">
              <div class="roomscan-viewer-wrap" data-roomscan-viewer-wrap></div>
              ${metaHtml ? `<div class="roomscan-meta">${metaHtml}</div>` : ''}
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
        // Polar angle lowered from the original 75deg to a steeper, more
        // overhead isometric look so the room layout reads more clearly.
        el.setAttribute('camera-orbit', '0deg 45deg 70%');
        // Widened beyond the zoom slider's own 28–82° range (see createRoomScanZoomSlider)
        // so the slider never gets clamped, and pinch/scroll zoom keeps working too.
        el.setAttribute('min-field-of-view', '20deg');
        el.setAttribute('max-field-of-view', '90deg');
        el.setAttribute('interaction-prompt', 'auto');
        el.setAttribute('interaction-prompt-threshold', '0');
        el.setAttribute('auto-rotate', '');
        el.setAttribute('auto-rotate-delay', '0');
        el.setAttribute('rotation-per-second', '60deg');
        el.setAttribute('shadow-intensity', '0.9');
        // Slightly above 1 so wood/floor PBR reads closer to the native iOS
        // SceneKit sun look. Avoid environment-image="neutral" — that cool
        // studio IBL washes Kenney furniture to cream/grey vs warm wood on iOS.
        el.setAttribute('exposure', '1.08');
        return el;
      }

      function showRoomScanLoadError(container) {
        container.dataset.roomscanMounted = '';
        container.innerHTML = `<div class="roomscan-status">${UyDosh.escapeHtml(UyDosh.t('detail.roomScanLoadError'))}</div>`;
      }

      /** Branded spinning "U" logo (same `.loading-spinner`/`uydosh-spin` used by the feed
       * map and account/profile/create pages — see telegram-index.css/telegram-shared.css)
       * instead of a plain "Загрузка…" text line, so the 3D viewer's loading state reads as
       * an on-brand UyDosh spinner rather than bare copy. */
      function roomScanLoadingStatusHtml() {
        return `<div class="roomscan-status" role="status" aria-label="${UyDosh.escapeHtml(UyDosh.t('detail.loading'))}"><span class="loading-spinner roomscan-loading-spinner" aria-hidden="true"></span></div>`;
      }

      async function mountRoomScanViewer(container, glbUrl, usdzUrl, l) {
        if (!container || container.dataset.roomscanMounted) return;
        container.dataset.roomscanMounted = '1';
        preventRoomScanDoubleTapZoom(container);
        container.innerHTML = roomScanLoadingStatusHtml();
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
          controlsBar.appendChild(createRoomScanRotateButton(viewer));
          controlsBar.appendChild(createRoomScanZoomSlider(viewer));
          controlsBar.appendChild(fullscreenBtn);
          container.appendChild(controlsBar);
          // Floating top-right corner, deliberately outside the bottom controls-bar — stacked
          // mode / wall-texture / floor-texture toggles (see .roomscan-mode-btn/
          // .roomscan-texture-btn/.roomscan-floor-texture-btn in listing-detail.css).
          // `autoToggleWalls` only applies here — this preview is easy to scroll past without
          // ever tapping anything, so it auto-cycles walls on/off as a passive showcase; the
          // fullscreen viewer already has the user's full attention and manual controls.
          container.appendChild(createRoomScanModeButton(viewer, { autoToggleWalls: true }));
          container.appendChild(createRoomScanWallTextureButton(viewer));
          container.appendChild(createRoomScanFloorTextureButton(viewer));
          // Top-left, opposite the mode/texture buttons — the web counterpart of the
          // native viewer's 3D/2D tab control (see createRoomScanPlanToggle).
          container.appendChild(createRoomScanPlanToggle(viewer, container, glbUrl));
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
        const glbUrl = roomScanGlbUrlWithVersion(UyDosh.photoUrl(l.room_scan_glb_url), l.updated_at);
        const usdzUrl = l.point_cloud_url ? UyDosh.photoUrl(l.point_cloud_url) : '';

        // Section renders expanded by default (see buildRoomScanSectionHtml)
        // so the viewer needs mounting up front instead of waiting for a
        // first toggle click.
        if (section.getAttribute('aria-expanded') === 'true') {
          mountRoomScanViewer(viewerWrap, glbUrl, usdzUrl, l);
        }

        maybeAutoOpenRoomScanFullscreen(glbUrl, usdzUrl, l);

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
        // Drop compass listeners on the persistent backdrop host before clearing DOM.
        roomScanBackdropEl.querySelectorAll('.roomscan-world-compass').forEach((el) => {
          el.__uydoshCompassAbort?.abort?.();
        });
        // The blueprint overlay's host class must not survive into the next open
        // (innerHTML is cleared below, but classes/dataset aren't).
        roomScanBackdropEl.classList.remove('is-blueprint');
        delete roomScanBackdropEl.dataset.roomscanBlueprintAlignRad;
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

        // Dimensions overlay (top-leading), like the mobile app's native SceneKit viewer —
        // see RoomUsdzViewerViewController.swift's `hintContainer`. Built up front since it
        // doesn't depend on the model finishing load.
        const topLeadingEl = document.createElement('div');
        topLeadingEl.className = 'roomscan-backdrop-top-leading';
        roomScanBackdropEl.appendChild(topLeadingEl);

        const metaHtml = l ? buildRoomScanDimensionsMetaHtml(l, { oneRowPerStat: true }) : '';
        if (metaHtml) {
          const dimensionsEl = document.createElement('div');
          dimensionsEl.className = 'roomscan-backdrop-dimensions';
          dimensionsEl.innerHTML = metaHtml;
          topLeadingEl.appendChild(dimensionsEl);
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
        statusEl.setAttribute('role', 'status');
        statusEl.setAttribute('aria-label', UyDosh.t('detail.loading'));
        statusEl.innerHTML = '<span class="loading-spinner roomscan-loading-spinner" aria-hidden="true"></span>';
        roomScanBackdropEl.appendChild(statusEl);

        try {
          await loadModelViewerScript();
          const viewer = createModelViewerEl(glbUrl, usdzUrl);
          viewer.addEventListener('error', () => {
            statusEl.removeAttribute('aria-label');
            statusEl.textContent = UyDosh.t('detail.roomScanLoadError');
            statusEl.hidden = false;
            viewer.remove();
          }, { once: true });
          statusEl.hidden = true;
          roomScanBackdropEl.insertBefore(viewer, controlsBar);
          controlsBar.insertBefore(createRoomScanRotateButton(viewer), closeBtn);
          controlsBar.insertBefore(createRoomScanZoomSlider(viewer), closeBtn);
          // Floating top-right corner, deliberately outside the bottom controls-bar — stacked
          // mode / wall-texture / floor-texture toggles (see .roomscan-mode-btn/
          // .roomscan-texture-btn/.roomscan-floor-texture-btn in listing-detail.css) —
          // inserted before controlsBar so they stack under the dimensions overlay in DOM
          // order, not that it matters visually since both are absolutely positioned in
          // opposite corners.
          roomScanBackdropEl.insertBefore(createRoomScanModeButton(viewer, { showLabel: true }), controlsBar);
          roomScanBackdropEl.insertBefore(createRoomScanWallTextureButton(viewer, { showLabel: true }), controlsBar);
          roomScanBackdropEl.insertBefore(createRoomScanFloorTextureButton(viewer, { showLabel: true }), controlsBar);
          // Bottom-center, floating just above the controls bar (the top corners are
          // already taken by the dimensions overlay and the labeled toggle pills) — the
          // web counterpart of the native viewer's 3D/2D tab control.
          roomScanBackdropEl.insertBefore(
            createRoomScanPlanToggle(viewer, roomScanBackdropEl, glbUrl),
            controlsBar
          );
          // Floor compass ring around the building (N/E/S/W) — fullscreen 3D only.
          // Inserted before controls so it paints under the HUD chrome (z-index 0 vs 1).
          if (l) {
            roomScanBackdropEl.insertBefore(
              createRoomScanWorldCompassRing(viewer, roomScanBackdropEl, l),
              controlsBar
            );
          }
        } catch (err) {
          console.error('Failed to load fullscreen 3D room scan viewer', err);
          statusEl.removeAttribute('aria-label');
          statusEl.textContent = UyDosh.t('detail.roomScanLoadError');
        }

        // Added last (regardless of load success above) — floats directly above the close
        // button (see .roomscan-share-btn in listing-detail.css) rather than sitting inline
        // in the bottom bar, so it stays reachable even if the model failed to load — a
        // share link doesn't depend on the model itself.
        if (l) {
          roomScanBackdropEl.insertBefore(createRoomScanShareButton(l), controlsBar);
        }
      }

      /** Auto-opens the fullscreen 3D viewer when the page was loaded from a
       * `?view=3d` share link (see buildListing3dShareUrl/redirectFromMiniAppStartParam),
       * so the recipient lands straight in it instead of the collapsed tile. Guarded by
       * `state.roomScan3dAutoOpened` since `render()` (and so `bindRoomScanSection()`)
       * re-runs on every language change. */
      function maybeAutoOpenRoomScanFullscreen(glbUrl, usdzUrl, l) {
        if (state.roomScan3dAutoOpened) return;
        if (params.get('view') !== '3d') return;
        state.roomScan3dAutoOpened = true;
        openRoomScanFullscreen(glbUrl, usdzUrl, l);
      }

