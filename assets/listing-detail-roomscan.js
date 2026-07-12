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

      function roomScanModeLabelKey(mode) {
        if (mode === 'floorAndFurniture') return 'detail.roomScanModeFloorAndFurniture';
        if (mode === 'floorOnly') return 'detail.roomScanModeFloorOnly';
        return 'detail.roomScanModeFullRoom';
      }

      // Short one-word label actually shown on the button face (the aria-label above stays
      // the longer descriptive "tap to..." string for accessibility) — walls/furniture/floor
      // name what's newly revealed at each step of the cycle, not literally what's on screen
      // (e.g. floorOnly's floor is also visible in fullRoom).
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
          btn.textContent = UyDosh.t(roomScanModeShortLabelKey(mode));
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

      // Short label actually shown on the button face — mirrors roomScanModeShortLabelKey.
      function roomScanWallTextureShortLabelKey(texture) {
        return texture === 'plaster' ? 'detail.roomScanWallTexturePlasterShort' : 'detail.roomScanWallTextureBrickShort';
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
      function createRoomScanWallTextureButton(viewerEl) {
        let texture = 'brick';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'roomscan-texture-btn';
        const updateLabel = () => {
          btn.textContent = UyDosh.t(roomScanWallTextureShortLabelKey(texture));
          btn.setAttribute('aria-label', UyDosh.t(roomScanWallTextureLabelKey(texture)));
        };
        updateLabel();
        btn.addEventListener('click', () => {
          texture = nextRoomScanWallTexture(texture);
          updateLabel();
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

      // Short label actually shown on the button face — mirrors roomScanModeShortLabelKey.
      function roomScanFloorTextureShortLabelKey(texture) {
        return texture === 'tile' ? 'detail.roomScanFloorTextureTileShort' : 'detail.roomScanFloorTextureWoodShort';
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
      function createRoomScanFloorTextureButton(viewerEl) {
        let texture = 'wood';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'roomscan-floor-texture-btn';
        const updateLabel = () => {
          btn.textContent = UyDosh.t(roomScanFloorTextureShortLabelKey(texture));
          btn.setAttribute('aria-label', UyDosh.t(roomScanFloorTextureLabelKey(texture)));
        };
        updateLabel();
        btn.addEventListener('click', () => {
          texture = nextRoomScanFloorTexture(texture);
          updateLabel();
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

      /** Passes the same URL as both `url` and `linkPreviewUrl` to `shareListingLink`
       * so every fallback path it might take (Mini App Telegram dialog, browser
       * `navigator.share`, plain `window.open`) ends up sharing this exact `_3d` link
       * rather than the general listing share link. */
      async function shareRoomScan3d(l) {
        if (!l) return;
        UyDosh.haptic?.light?.();
        const lang = UyDosh.getLang();
        const shareUrl = buildListing3dShareUrl(l.id);
        const text = buildListingShareText(l, lang);
        const method = await UyDosh.shareListingLink(shareUrl, text, [], '', shareUrl);
        if (UyDosh.isMiniApp()) {
          UyDosh.logMiniAppEvent('listing_share_tapped', {
            listing_id: Number(l.id),
            source: 'telegram_mini_app_room_scan_3d',
            share_method: method || 'unknown',
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

      /** Mirrors the mobile app's room-3D tile stats (see room_3d_tile.dart), grouped into two
       * lines instead of one row each: dimensions + area share a line (separated by a dot,
       * evoking a stats strip like "3 bed • 2 bath"), height gets its own line below. Shared by
       * the inline toggle's under-viewer summary and the fullscreen viewer's dimensions
       * overlay — both just stack whatever lines this returns in a flex column. */
      function buildRoomScanDimensionsMetaHtml(l) {
        const floorLong = Number(l.room_scan_floor_long_m);
        const floorShort = Number(l.room_scan_floor_short_m);
        const heightM = Number(l.room_scan_height_m);
        const areaM2 = Number(l.room_scan_floor_area_m2);
        const isPositive = (n) => Number.isFinite(n) && n > 0;
        if (isPositive(floorLong) && isPositive(floorShort) && isPositive(heightM) && isPositive(areaM2)) {
          const dimsRow = roomScanMetaRowHtml(UyDosh.iconRectangleOutline(), `${UyDosh.t('detail.roomScanDimensions')}: ${floorLong.toFixed(1)} × ${floorShort.toFixed(1)} m`);
          const areaRow = roomScanMetaRowHtml(UyDosh.iconOverlapRects(), `${UyDosh.t('detail.roomScanArea')}: ~${areaM2.toFixed(1)} m²`);
          const heightRow = roomScanMetaRowHtml(UyDosh.iconHeightArrows(), `${UyDosh.t('detail.roomScanHeight')}: ${heightM.toFixed(1)} m`);
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
        el.setAttribute('shadow-intensity', '1');
        el.setAttribute('exposure', '1');
        el.setAttribute('environment-image', 'neutral');
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
          container.appendChild(createRoomScanModeButton(viewer));
          container.appendChild(createRoomScanWallTextureButton(viewer));
          container.appendChild(createRoomScanFloorTextureButton(viewer));
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
          roomScanBackdropEl.insertBefore(createRoomScanModeButton(viewer), controlsBar);
          roomScanBackdropEl.insertBefore(createRoomScanWallTextureButton(viewer), controlsBar);
          roomScanBackdropEl.insertBefore(createRoomScanFloorTextureButton(viewer), controlsBar);
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

