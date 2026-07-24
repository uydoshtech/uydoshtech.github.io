// Makon3D web gallery — list recent scans, open one in <model-viewer>.
(() => {
  const API_BASE = window.UyDosh?.API_BASE || 'https://api.uydosh.com';
  const MODEL_VIEWER_SRC =
    'https://cdn.jsdelivr.net/npm/@google/model-viewer@4.3.1/dist/model-viewer.min.js';
  // Backend may rewrite room_scan.glb in place — bump to bust caches.
  const GLB_CACHE_VERSION = '20260716-1';

  const backEl = document.getElementById('m3d-back');
  const navTriggerEl = document.getElementById('m3d-nav-trigger');
  const drawerBackdropEl = document.getElementById('m3d-drawer-backdrop');
  const drawerHomeEl = document.getElementById('m3d-drawer-home');
  const avatarEl = document.getElementById('m3d-avatar');
  const drawerAvatarEl = document.getElementById('m3d-drawer-avatar');
  const drawerUsernameEl = document.getElementById('m3d-drawer-username');
  const statusEl = document.getElementById('m3d-status');
  const listEl = document.getElementById('m3d-list');
  const listPanelEl = document.getElementById('m3d-list-panel');
  const viewerPanelEl = document.getElementById('m3d-viewer-panel');
  const viewerWrapEl = document.getElementById('m3d-viewer-wrap');
  const viewerMetaEl = document.getElementById('m3d-viewer-meta');
  const materialsEl = document.getElementById('m3d-materials');

  /** @type {any[]} */
  let scansCache = [];
  /** @type {number|null} */
  let openScanId = null;
  let modelViewerLoadPromise = null;

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function photoUrl(relative) {
    if (typeof window.UyDosh?.photoUrl === 'function') {
      return window.UyDosh.photoUrl(relative);
    }
    if (!relative) return '';
    if (/^https?:\/\//i.test(relative)) return relative;
    return `${API_BASE}${relative.startsWith('/') ? '' : '/'}${relative}`;
  }

  function withCacheBust(url) {
    if (!url) return '';
    return `${url}${url.includes('?') ? '&' : '?'}v=${GLB_CACHE_VERSION}`;
  }

  function inTelegram() {
    try {
      return Boolean(window.Telegram?.WebApp?.initData);
    } catch {
      return false;
    }
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(d);
    } catch {
      return d.toLocaleString();
    }
  }

  function formatMeters(n) {
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 0) return null;
    return `${v.toFixed(v >= 10 ? 1 : 2)} m`;
  }

  function formatArea(n) {
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 0) return null;
    return `${v.toFixed(v >= 10 ? 1 : 2)} m²`;
  }

  function scanDimensions(scan) {
    const parts = [];
    const long = formatMeters(scan.floorLongM);
    const short = formatMeters(scan.floorShortM);
    const height = formatMeters(scan.heightM);
    const area = formatArea(scan.floorAreaM2);
    if (long && short) parts.push(`${long} × ${short}`);
    else if (long) parts.push(long);
    if (height) parts.push(`H ${height}`);
    if (area) parts.push(area);
    return parts;
  }

  function readRoute() {
    const qs = new URLSearchParams(location.search);
    let rawId = qs.get('id') || qs.get('scan');
    // Support path-style URLs: /makon3d/scans/123 (custom domain / SPA hosts).
    if (!rawId) {
      const pathMatch = location.pathname.match(/\/scans\/(\d+)\/?$/);
      if (pathMatch) rawId = pathMatch[1];
    }
    const id = rawId && /^\d+$/.test(rawId) ? Number(rawId) : null;
    const token = (qs.get('token') || '').trim();
    return { id, token };
  }

  function setRoute(scanId) {
    const qs = new URLSearchParams(location.search);
    // The gallery always shows every public scan — drop any legacy
    // device-scoped links.
    qs.delete('device_id');
    if (scanId) qs.set('id', String(scanId));
    else qs.delete('id');
    qs.delete('scan');
    const next = qs.toString();
    const url = `${location.pathname}${next ? `?${next}` : ''}${location.hash || ''}`;
    history.pushState({ scanId: scanId || null }, '', url);
  }

  function showStatus(message, isError = false) {
    statusEl.hidden = false;
    statusEl.dataset.error = isError ? '1' : '';
    statusEl.removeAttribute('aria-label');
    statusEl.textContent = message;
    listEl.hidden = true;
  }

  /** Spinning Makon mark (see .m3d-loading-spinner in makon3d.css) — the one
   * loader used everywhere across the mini app, like UyDosh's spinning "U". */
  function loadingSpinnerHtml() {
    return '<span class="m3d-loading-spinner" aria-hidden="true"></span>';
  }

  function showLoadingStatus(label) {
    statusEl.hidden = false;
    statusEl.dataset.error = '';
    statusEl.setAttribute('aria-label', label);
    statusEl.innerHTML = loadingSpinnerHtml();
    listEl.hidden = true;
  }

  function showListView() {
    openScanId = null;
    listPanelEl.hidden = false;
    viewerPanelEl.hidden = true;
    backEl.hidden = true;
    navTriggerEl.hidden = false;
    viewerWrapEl.classList.remove('is-blueprint');
    delete viewerWrapEl.dataset.roomscanBlueprintAlignRad;
    viewerWrapEl.innerHTML = '';
    viewerMetaEl.innerHTML = '';
    if (materialsEl) {
      materialsEl.hidden = true;
      materialsEl.innerHTML = '';
    }
    clearShareOgTags();
  }

  function clearShareOgTags() {
    document.querySelectorAll('meta[data-m3d-og]').forEach((el) => el.remove());
  }

  function setShareOgTags({ title, description, imageUrl, pageUrl }) {
    clearShareOgTags();
    const tags = [
      ['og:title', title],
      ['og:description', description],
      ['og:image', imageUrl],
      ['og:url', pageUrl],
      ['twitter:card', 'summary_large_image'],
    ];
    for (const [property, content] of tags) {
      if (!content) continue;
      const meta = document.createElement('meta');
      meta.setAttribute('data-m3d-og', '1');
      if (property.startsWith('twitter:')) meta.setAttribute('name', property);
      else meta.setAttribute('property', property);
      meta.setAttribute('content', content);
      document.head.appendChild(meta);
    }
  }

  function viewerShareUrl(scanId) {
    return `${location.origin}${location.pathname}?id=${scanId}`;
  }

  async function shareScan(scan) {
    const id = Number(scan.id);
    const shareUrl = scan.viewerUrl || viewerShareUrl(id);
    const text = `View this 3D scan in Makon3D:\n\n${shareUrl}`;
    const gifUrl = scan.rotationGifUrl ? photoUrl(scan.rotationGifUrl) : '';
    try {
      if (gifUrl && navigator.share && navigator.canShare) {
        const res = await fetch(gifUrl);
        const blob = await res.blob();
        const file = new File([blob], `makon3d-scan-${id}.gif`, {
          type: 'image/gif',
        });
        if (navigator.canShare({ files: [file], text, url: shareUrl })) {
          await navigator.share({ files: [file], text, url: shareUrl, title: 'Makon3D' });
          return;
        }
      }
      if (navigator.share) {
        await navigator.share({ title: 'Makon3D', text, url: shareUrl });
        return;
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      console.warn('[Makon3D] share failed', err);
    }
    try {
      await navigator.clipboard.writeText(text);
      showStatus('Link copied to clipboard.');
    } catch {
      window.prompt('Copy this link:', shareUrl);
    }
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

  function createModelViewer(glbUrl, usdzUrl) {
    const el = document.createElement('model-viewer');
    el.setAttribute('src', glbUrl);
    // AR intents break inside Telegram's WebView — keep AR for regular browsers.
    if (!inTelegram()) {
      if (usdzUrl) el.setAttribute('ios-src', usdzUrl);
      el.setAttribute('ar', '');
      el.setAttribute('ar-modes', 'webxr scene-viewer quick-look');
    }
    el.setAttribute('camera-controls', '');
    el.setAttribute('camera-orbit', '0deg 45deg 70%');
    el.setAttribute('min-field-of-view', '20deg');
    el.setAttribute('max-field-of-view', '90deg');
    el.setAttribute('interaction-prompt', 'auto');
    el.setAttribute('interaction-prompt-threshold', '0');
    el.setAttribute('auto-rotate', '');
    el.setAttribute('auto-rotate-delay', '0');
    el.setAttribute('rotation-per-second', '60deg');
    el.setAttribute('shadow-intensity', '0.9');
    el.setAttribute('exposure', '1.08');
    return el;
  }

  function haptic() {
    window.UyDosh?.haptic?.light?.();
  }

  // --- 3D scene controls, ported from UyDosh's room-scan viewer -------------
  // Source of truth: assets/listing-detail-roomscan.js (inline tile variant).
  // Same class names + behavior so the two stay easy to diff/sync; only the
  // UyDosh.t() localization and listing-specific bits are dropped.

  // Display mode: full room → floor + furniture → floor only.
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

  function roomScanModeLabel(mode) {
    if (mode === 'floorAndFurniture') return 'Floor and furniture';
    if (mode === 'floorOnly') return 'Floor only';
    return 'Full room';
  }

  /** Wall/ceiling/door/window/opening → 'wall'; floor → always shown;
   * everything else (furniture) → also hidden in floorOnly. */
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

  /** Hides/shows a Scene Graph material by driving its base color alpha to 0/1
   * (model-viewer has no per-mesh visibility toggle). Caches the original
   * alpha mode + color the first time it's hidden. */
  function setRoomScanMaterialHidden(material, hidden) {
    try {
      const pbr = material.pbrMetallicRoughness;
      if (!pbr) return;
      if (hidden) {
        if (!material.__m3dOriginalColor) {
          material.__m3dOriginalColor = pbr.baseColorFactor.slice();
          material.__m3dOriginalAlphaMode = material.getAlphaMode();
        }
        const base = material.__m3dOriginalColor;
        material.setAlphaMode('BLEND');
        pbr.setBaseColorFactor([base[0], base[1], base[2], 0]);
      } else if (material.__m3dOriginalColor) {
        pbr.setBaseColorFactor(material.__m3dOriginalColor);
        material.setAlphaMode(material.__m3dOriginalAlphaMode || 'OPAQUE');
      }
    } catch {
      // Scene Graph API unavailable / model not loaded yet — applies next call.
    }
  }

  /** Applies `mode` to every material on the loaded model. Safe to call before
   * the model finishes loading (silently does nothing). */
  function applyRoomScanDisplayMode(viewerEl, mode) {
    if (viewerEl) viewerEl.__m3dDisplayMode = mode;
    const model = viewerEl && viewerEl.model;
    if (!model || !Array.isArray(model.materials)) return;
    model.materials.forEach((material) => {
      const kind = classifyRoomScanMaterialName(material.name);
      let hidden = false;
      if (mode === 'floorAndFurniture') hidden = kind === 'wall';
      else if (mode === 'floorOnly') hidden = kind === 'wall' || kind === 'furniture';
      // In the top-down 2D view a ceiling mesh would lid the whole plan.
      if (viewerEl.__m3dPlanViewActive && (material.name || '').toLowerCase().includes('ceiling')) {
        hidden = true;
      }
      setRoomScanMaterialHidden(material, hidden);
    });
  }

  /** Creates the mode-cycling button and wires it to `viewerEl`. */
  function createRoomScanModeButton(viewerEl) {
    let mode = 'fullRoom';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'roomscan-mode-btn';
    const updateAppearance = () => {
      btn.innerHTML = roomScanModeIconHtml(mode);
      btn.setAttribute('aria-label', roomScanModeLabel(mode));
    };
    updateAppearance();
    btn.addEventListener('click', () => {
      mode = nextRoomScanMode(mode);
      updateAppearance();
      haptic();
      applyRoomScanDisplayMode(viewerEl, mode);
    });
    viewerEl.addEventListener('load', () => applyRoomScanDisplayMode(viewerEl, mode));
    return btn;
  }

  // --- 2D floor plan (bird's-eye) toggle ------------------------------------
  // Locks the camera straight down (polar angle pinned to 0°) so dragging only
  // rotates/zooms the plan, and hides any ceiling mesh that would lid the room.

  function enterRoomScanPlanView(viewerEl) {
    if (viewerEl.__m3dPlanViewActive) return;
    viewerEl.__m3dPlanViewActive = true;
    viewerEl.__m3dPlanSavedOrbit = viewerEl.cameraOrbit;
    viewerEl.__m3dPlanResumeAutoRotate = viewerEl.hasAttribute('auto-rotate');
    viewerEl.removeAttribute('auto-rotate');
    viewerEl.dispatchEvent(new CustomEvent('m3d-autorotate-changed'));
    viewerEl.setAttribute('min-camera-orbit', '-Infinity 0deg auto');
    viewerEl.setAttribute('max-camera-orbit', 'Infinity 0deg auto');
    viewerEl.cameraOrbit = '0deg 0deg 105%';
    applyRoomScanDisplayMode(viewerEl, viewerEl.__m3dDisplayMode || 'fullRoom');
  }

  function exitRoomScanPlanView(viewerEl) {
    if (!viewerEl.__m3dPlanViewActive) return;
    viewerEl.__m3dPlanViewActive = false;
    viewerEl.removeAttribute('min-camera-orbit');
    viewerEl.removeAttribute('max-camera-orbit');
    viewerEl.cameraOrbit = viewerEl.__m3dPlanSavedOrbit || '0deg 45deg 70%';
    if (viewerEl.__m3dPlanResumeAutoRotate && !viewerEl.hasAttribute('auto-rotate')) {
      viewerEl.setAttribute('auto-rotate', '');
    }
    viewerEl.__m3dPlanResumeAutoRotate = false;
    viewerEl.dispatchEvent(new CustomEvent('m3d-autorotate-changed'));
    applyRoomScanDisplayMode(viewerEl, viewerEl.__m3dDisplayMode || 'fullRoom');
  }

  /** "3D | 2D" segmented pill, wired to `viewerEl`. Always starts on 3D.
   *
   * 2D first tries the vector blueprint overlay (walls/doors/furniture +
   * measurements extracted from the GLB — mountRoomScanBlueprint, shared with
   * listing.html via assets/listing-detail-floorplan.js), mounted into `host`
   * (the viewer wrap). The top-down camera lock is applied either way: it's
   * the visible fallback when the blueprint can't be built, and it stops the
   * hidden 3D render loop from spinning under the overlay when it can. */
  function createRoomScanPlanToggle(viewerEl, host, glbUrl) {
    const wrap = document.createElement('div');
    wrap.className = 'roomscan-plan-toggle';
    wrap.setAttribute('role', 'tablist');
    wrap.setAttribute('aria-label', 'View mode');

    const makeBtn = (label, isPlan) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'roomscan-plan-toggle-btn';
      btn.setAttribute('role', 'tab');
      btn.textContent = label;
      btn.addEventListener('click', () => {
        if (btn.classList.contains('is-active')) return;
        haptic();
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
    const btn3d = makeBtn('3D', false);
    const btn2d = makeBtn('2D', true);
    const updateSelection = () => {
      const planActive = !!viewerEl.__m3dPlanViewActive;
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

  // --- Wall texture toggle (baked-in brick ⇄ generated plaster) --------------
  const ROOM_SCAN_WALL_TEXTURES = ['brick', 'plaster'];

  function nextRoomScanWallTexture(texture) {
    const idx = ROOM_SCAN_WALL_TEXTURES.indexOf(texture);
    return ROOM_SCAN_WALL_TEXTURES[(idx + 1) % ROOM_SCAN_WALL_TEXTURES.length];
  }

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

  // Texture swapping only ever touches actual wall surfaces (doors/windows/
  // ceiling keep their originally captured materials).
  function isRoomScanWallMaterialName(name) {
    return (name || '').toLowerCase().startsWith('wall');
  }

  let roomScanPlasterTextureDataUrl = null;

  /** Deterministic tileable plaster pattern rendered to a canvas once. */
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

  async function getRoomScanPlasterTexture(viewerEl) {
    if (viewerEl.__m3dPlasterTexture) return viewerEl.__m3dPlasterTexture;
    const texture = await viewerEl.createTexture(getRoomScanPlasterTextureDataUrl());
    viewerEl.__m3dPlasterTexture = texture;
    return texture;
  }

  async function applyRoomScanWallTexture(viewerEl, texture) {
    const model = viewerEl && viewerEl.model;
    if (!model || !Array.isArray(model.materials)) return;
    const plasterTexture = texture === 'plaster' ? await getRoomScanPlasterTexture(viewerEl) : null;
    model.materials.forEach((material) => {
      if (!isRoomScanWallMaterialName(material.name)) return;
      try {
        const pbr = material.pbrMetallicRoughness;
        if (!pbr || !pbr.baseColorTexture) return;
        if (!material.__m3dOriginalWallTexture) {
          material.__m3dOriginalWallTexture = pbr.baseColorTexture.texture;
        }
        pbr.baseColorTexture.setTexture(texture === 'plaster' ? plasterTexture : material.__m3dOriginalWallTexture);
      } catch {
        // Model not loaded yet — applies next call.
      }
    });
  }

  function createRoomScanWallTextureButton(viewerEl) {
    let texture = 'brick';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'roomscan-texture-btn';
    const updateAppearance = () => {
      btn.innerHTML = roomScanWallTextureIconHtml(texture);
      btn.setAttribute('aria-label', texture === 'plaster' ? 'Plaster walls' : 'Brick walls');
    };
    updateAppearance();
    btn.addEventListener('click', () => {
      texture = nextRoomScanWallTexture(texture);
      updateAppearance();
      haptic();
      applyRoomScanWallTexture(viewerEl, texture);
    });
    return btn;
  }

  // --- Floor texture toggle (baked-in wood ⇄ generated light tile) -----------
  const ROOM_SCAN_FLOOR_TEXTURES = ['wood', 'tile'];

  function nextRoomScanFloorTexture(texture) {
    const idx = ROOM_SCAN_FLOOR_TEXTURES.indexOf(texture);
    return ROOM_SCAN_FLOOR_TEXTURES[(idx + 1) % ROOM_SCAN_FLOOR_TEXTURES.length];
  }

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

  function isRoomScanFloorMaterialName(name) {
    const n = (name || '').toLowerCase();
    return n.startsWith('floor') || n.includes('ground');
  }

  let roomScanTileTextureDataUrl = null;

  /** Deterministic tileable light-tile pattern rendered to a canvas once. */
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
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(x + groutW / 2, y + groutW / 2, w, 3);
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        ctx.fillRect(x + groutW / 2, y + groutW / 2 + w - 3, w, 3);
      }
    }
    roomScanTileTextureDataUrl = canvas.toDataURL('image/png');
    return roomScanTileTextureDataUrl;
  }

  async function getRoomScanTileTexture(viewerEl) {
    if (viewerEl.__m3dTileTexture) return viewerEl.__m3dTileTexture;
    const texture = await viewerEl.createTexture(getRoomScanTileTextureDataUrl());
    viewerEl.__m3dTileTexture = texture;
    return texture;
  }

  async function applyRoomScanFloorTexture(viewerEl, texture) {
    const model = viewerEl && viewerEl.model;
    if (!model || !Array.isArray(model.materials)) return;
    const tileTexture = texture === 'tile' ? await getRoomScanTileTexture(viewerEl) : null;
    model.materials.forEach((material) => {
      if (!isRoomScanFloorMaterialName(material.name)) return;
      try {
        const pbr = material.pbrMetallicRoughness;
        if (!pbr || !pbr.baseColorTexture) return;
        if (!material.__m3dOriginalFloorTexture) {
          material.__m3dOriginalFloorTexture = pbr.baseColorTexture.texture;
        }
        pbr.baseColorTexture.setTexture(texture === 'tile' ? tileTexture : material.__m3dOriginalFloorTexture);
      } catch {
        // Model not loaded yet — applies next call.
      }
    });
  }

  function createRoomScanFloorTextureButton(viewerEl) {
    let texture = 'wood';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'roomscan-floor-texture-btn';
    const updateAppearance = () => {
      btn.innerHTML = roomScanFloorTextureIconHtml(texture);
      btn.setAttribute('aria-label', texture === 'tile' ? 'Tile floor' : 'Wood floor');
    };
    updateAppearance();
    btn.addEventListener('click', () => {
      texture = nextRoomScanFloorTexture(texture);
      updateAppearance();
      haptic();
      applyRoomScanFloorTexture(viewerEl, texture);
    });
    return btn;
  }

  // --- Auto-rotate play/pause ------------------------------------------------
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

  function createRoomScanRotateButton(viewerEl) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'roomscan-rotate-btn';
    const updateAppearance = () => {
      const isRotating = viewerEl.hasAttribute('auto-rotate');
      btn.innerHTML = roomScanRotateIconHtml(isRotating);
      btn.setAttribute('aria-label', isRotating ? 'Pause rotation' : 'Rotate');
    };
    updateAppearance();
    btn.addEventListener('click', () => {
      haptic();
      if (viewerEl.hasAttribute('auto-rotate')) viewerEl.removeAttribute('auto-rotate');
      else viewerEl.setAttribute('auto-rotate', '');
      updateAppearance();
      viewerEl.dispatchEvent(new CustomEvent('m3d-autorotate-changed'));
    });
    // The 2D plan toggle also pauses/resumes auto-rotate and announces it via
    // this event so the play/pause icon here doesn't go stale.
    viewerEl.addEventListener('m3d-autorotate-changed', updateAppearance);
    return btn;
  }

  // --- Zoom slider (0…100 mapped onto camera field of view) -------------------
  const ROOM_SCAN_ZOOM_FOV_MIN_DEG = 28;
  const ROOM_SCAN_ZOOM_FOV_MAX_DEG = 82;
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
    input.value = String(ROOM_SCAN_ZOOM_DEFAULT);
    input.setAttribute('aria-label', 'Zoom');

    const inIcon = document.createElement('span');
    inIcon.className = 'roomscan-zoom-icon';
    inIcon.innerHTML = roomScanZoomIconHtml('in');

    const applyZoom = () => {
      const t = Number(input.value) / 100;
      const fov = ROOM_SCAN_ZOOM_FOV_MAX_DEG - t * (ROOM_SCAN_ZOOM_FOV_MAX_DEG - ROOM_SCAN_ZOOM_FOV_MIN_DEG);
      viewerEl.fieldOfView = `${fov.toFixed(2)}deg`;
    };
    // Coalesce rapid input ticks onto one fieldOfView write per frame —
    // model-viewer re-renders the whole scene on every write.
    let zoomRaf = 0;
    const scheduleApplyZoom = () => {
      if (zoomRaf) return;
      zoomRaf = requestAnimationFrame(() => {
        zoomRaf = 0;
        applyZoom();
      });
    };
    // Pause auto-rotate while dragging so the render loop serves the drag.
    let resumeAutoRotate = false;
    const pauseAutoRotateForDrag = () => {
      if (viewerEl.hasAttribute('auto-rotate')) {
        resumeAutoRotate = true;
        viewerEl.removeAttribute('auto-rotate');
        viewerEl.dispatchEvent(new CustomEvent('m3d-autorotate-changed'));
      }
    };
    const resumeAutoRotateAfterDrag = () => {
      if (!resumeAutoRotate) return;
      resumeAutoRotate = false;
      viewerEl.setAttribute('auto-rotate', '');
      viewerEl.dispatchEvent(new CustomEvent('m3d-autorotate-changed'));
    };
    input.addEventListener('pointerdown', pauseAutoRotateForDrag);
    input.addEventListener('pointerup', resumeAutoRotateAfterDrag);
    input.addEventListener('pointercancel', resumeAutoRotateAfterDrag);
    input.addEventListener('input', scheduleApplyZoom);

    wrap.appendChild(outIcon);
    wrap.appendChild(input);
    wrap.appendChild(inIcon);
    viewerEl.addEventListener('load', applyZoom);
    return wrap;
  }

  // Suppresses the browser's native double-tap-to-zoom on the viewer — iOS
  // WebViews ignore touch-action for that gesture, so the second tap's default
  // action is prevented directly via a touchend timestamp check.
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

  function renderViewerMeta(scan) {
    const dims = scanDimensions(scan);
    const date = formatDate(scan.createdAt);
    const gifReady = scan.mediaGenerationStatus === 'ready' && scan.rotationGifUrl;
    const rows = [];
    rows.push(`<div><strong>Scan #${escapeHtml(scan.id)}</strong></div>`);
    if (date) rows.push(`<div>${escapeHtml(date)}</div>`);
    if (dims.length) {
      rows.push(`<div class="m3d-dim-row">${dims.map((d) => `<span>${escapeHtml(d)}</span>`).join('')}</div>`);
    }
    if (!scan.glbUrl) {
      rows.push('<div>3D preview is still processing — USDZ is available for the native app.</div>');
    }
    viewerMetaEl.innerHTML = `
      <div class="m3d-viewer-meta-row">
        <div class="m3d-viewer-meta-text">${rows.join('')}</div>
        <button type="button" class="m3d-share-btn" id="m3d-share-btn">
          ${gifReady ? 'Share GIF' : 'Share link'}
        </button>
      </div>
    `;
    const btn = document.getElementById('m3d-share-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        void shareScan(scan);
      });
    }
    renderMaterialsPanel(scan);
  }

  // --- Material estimate (floor / wall tiles) --------------------------------
  // Ported from makon3d_mobile's RoomMaterialsScreen + FloorTileEstimator:
  // same math, presets and defaults, so the app and mini app agree.

  const MATERIALS_PREFS_STORAGE_KEY = 'makon3d:tilePrefs';
  const MATERIALS_DEFAULTS = {
    floor: { widthCm: 40, heightCm: 40, wastePercent: 10 },
    walls: { widthCm: 30, heightCm: 60, wastePercent: 10 },
  };
  const MATERIALS_SQUARE_PRESETS = [[30, 30], [40, 40], [60, 60]];
  const MATERIALS_RECT_PRESETS = [[20, 30], [30, 60], [40, 50]];

  /** Prefer the polygon floor area; fall back to the OBB long × short. */
  function resolveFloorAreaM2(scan) {
    const area = Number(scan?.floorAreaM2);
    if (Number.isFinite(area) && area > 0) return area;
    const long = Number(scan?.floorLongM);
    const short = Number(scan?.floorShortM);
    if (long > 0 && short > 0) return long * short;
    return null;
  }

  function floorAreaUsedBoundingFallback(scan) {
    const area = Number(scan?.floorAreaM2);
    return !(Number.isFinite(area) && area > 0) && resolveFloorAreaM2(scan) != null;
  }

  /** Approximate wall area: footprint perimeter (2 × (long + short)) × height.
   * Door/window openings are not subtracted. */
  function resolveWallAreaM2(scan) {
    const long = Number(scan?.floorLongM);
    const short = Number(scan?.floorShortM);
    const height = Number(scan?.heightM);
    if (!(long > 0) || !(short > 0) || !(height > 0)) return null;
    return 2 * (long + short) * height;
  }

  function estimateTiles(areaM2, widthCm, heightCm, wastePercent) {
    if (!(areaM2 > 0) || !(widthCm > 0) || !(heightCm > 0)) return null;
    const waste = Math.min(100, Math.max(0, Number(wastePercent) || 0));
    const tileAreaM2 = (widthCm / 100) * (heightCm / 100);
    const effectiveAreaM2 = areaM2 * (1 + waste / 100);
    const tileCount = Math.max(1, Math.ceil(effectiveAreaM2 / tileAreaM2));
    return {
      tileAreaM2,
      effectiveAreaM2,
      tileCount,
      buyAreaM2: tileCount * tileAreaM2,
    };
  }

  function loadMaterialsPrefs() {
    let stored = null;
    try {
      stored = JSON.parse(localStorage.getItem(MATERIALS_PREFS_STORAGE_KEY) || 'null');
    } catch { /* ignore */ }
    const merged = {};
    for (const surface of ['floor', 'walls']) {
      const raw = stored?.[surface] || {};
      const defaults = MATERIALS_DEFAULTS[surface];
      merged[surface] = {
        widthCm: Number(raw.widthCm) > 0 ? Number(raw.widthCm) : defaults.widthCm,
        heightCm: Number(raw.heightCm) > 0 ? Number(raw.heightCm) : defaults.heightCm,
        wastePercent: Number.isFinite(Number(raw.wastePercent))
          ? Math.min(20, Math.max(0, Number(raw.wastePercent)))
          : defaults.wastePercent,
      };
    }
    return merged;
  }

  function saveMaterialsPrefs(prefs) {
    try {
      localStorage.setItem(MATERIALS_PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch { /* private mode etc. — estimates still work, just not sticky */ }
  }

  function formatCm(value) {
    const v = Number(value);
    if (!Number.isFinite(v)) return '';
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  }

  // Collapsed by default on every newly opened scan.
  let materialsExpanded = false;
  let materialsScanId = null;

  function renderMaterialsPanel(scan) {
    if (!materialsEl) return;
    const scanId = Number(scan?.id);
    if (scanId !== materialsScanId) {
      materialsScanId = scanId;
      materialsExpanded = false;
    }

    const prefs = loadMaterialsPrefs();
    let surface = 'floor';
    let current = { ...prefs.floor };
    let isSquare = Math.abs(current.widthCm - current.heightCm) < 0.001;

    materialsEl.hidden = false;
    materialsEl.innerHTML = `
      <button type="button" class="m3d-mat-toggle" id="m3d-mat-toggle" aria-expanded="${materialsExpanded}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
        <span>Material estimate</span>
        <span class="m3d-mat-toggle-chevron" aria-hidden="true">›</span>
      </button>
      <div class="m3d-mat-body" id="m3d-mat-body" ${materialsExpanded ? '' : 'hidden'}>
        <div class="m3d-seg" role="tablist" aria-label="Surface" id="m3d-mat-surface">
          <button type="button" class="m3d-seg-btn" role="tab" data-surface="floor">Floor</button>
          <button type="button" class="m3d-seg-btn" role="tab" data-surface="walls">Walls</button>
        </div>
        <p class="m3d-mat-area" id="m3d-mat-area"></p>
        <p class="m3d-mat-approx" id="m3d-mat-approx" hidden></p>
        <div class="m3d-mat-label">Tile shape</div>
        <div class="m3d-seg" role="tablist" aria-label="Tile shape" id="m3d-mat-shape">
          <button type="button" class="m3d-seg-btn" role="tab" data-square="1">Square</button>
          <button type="button" class="m3d-seg-btn" role="tab" data-square="">Rectangle</button>
        </div>
        <div class="m3d-mat-label">Tile size (cm)</div>
        <div class="m3d-chips" id="m3d-mat-presets"></div>
        <div class="m3d-mat-inputs">
          <label class="m3d-mat-input">
            <span>Width</span>
            <input type="number" inputmode="decimal" min="1" step="0.1" id="m3d-mat-width" />
          </label>
          <label class="m3d-mat-input" id="m3d-mat-height-wrap">
            <span>Length</span>
            <input type="number" inputmode="decimal" min="1" step="0.1" id="m3d-mat-height" />
          </label>
        </div>
        <div class="m3d-mat-label" id="m3d-mat-waste-label"></div>
        <input type="range" class="m3d-mat-range" id="m3d-mat-waste" min="0" max="20" step="1" />
        <div class="m3d-mat-waste-quick">
          <button type="button" data-waste="5">5%</button>
          <button type="button" data-waste="10">10%</button>
          <button type="button" data-waste="15">15%</button>
        </div>
        <div class="m3d-mat-result" id="m3d-mat-result"></div>
      </div>
    `;

    const toggleBtn = materialsEl.querySelector('#m3d-mat-toggle');
    const bodyEl = materialsEl.querySelector('#m3d-mat-body');
    const surfaceSegEl = materialsEl.querySelector('#m3d-mat-surface');
    const areaEl = materialsEl.querySelector('#m3d-mat-area');
    const approxEl = materialsEl.querySelector('#m3d-mat-approx');
    const shapeSegEl = materialsEl.querySelector('#m3d-mat-shape');
    const presetsEl = materialsEl.querySelector('#m3d-mat-presets');
    const widthInput = materialsEl.querySelector('#m3d-mat-width');
    const heightWrapEl = materialsEl.querySelector('#m3d-mat-height-wrap');
    const heightInput = materialsEl.querySelector('#m3d-mat-height');
    const wasteLabelEl = materialsEl.querySelector('#m3d-mat-waste-label');
    const wasteInput = materialsEl.querySelector('#m3d-mat-waste');
    const resultEl = materialsEl.querySelector('#m3d-mat-result');

    function persist() {
      prefs[surface] = { ...current };
      saveMaterialsPrefs(prefs);
    }

    function surfaceArea() {
      return surface === 'walls' ? resolveWallAreaM2(scan) : resolveFloorAreaM2(scan);
    }

    function renderPresets() {
      const presets = isSquare ? MATERIALS_SQUARE_PRESETS : MATERIALS_RECT_PRESETS;
      presetsEl.innerHTML = presets
        .map(([w, h]) => {
          const active =
            Math.abs(current.widthCm - w) < 0.001 && Math.abs(current.heightCm - h) < 0.001;
          return `<button type="button" class="m3d-chip${active ? ' is-active' : ''}" data-w="${w}" data-h="${h}">${formatCm(w)}×${formatCm(h)}</button>`;
        })
        .join('');
    }

    function update() {
      for (const btn of surfaceSegEl.querySelectorAll('.m3d-seg-btn')) {
        const active = btn.dataset.surface === surface;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      }
      for (const btn of shapeSegEl.querySelectorAll('.m3d-seg-btn')) {
        const active = Boolean(btn.dataset.square) === isSquare;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      }
      heightWrapEl.hidden = isSquare;
      renderPresets();

      const area = surfaceArea();
      if (area != null) {
        areaEl.textContent = `${surface === 'walls' ? 'Wall area' : 'Measured area'}: ~${area.toFixed(1)} m²`;
        areaEl.dataset.error = '';
      } else {
        areaEl.textContent =
          surface === 'walls'
            ? 'No wall measurements for this scan.'
            : 'No floor area for this scan.';
        areaEl.dataset.error = '1';
      }
      const approxNote =
        surface === 'walls'
          ? area != null
            ? 'Perimeter × height, door and window openings not subtracted.'
            : ''
          : floorAreaUsedBoundingFallback(scan)
            ? 'Using room length × width (approximate).'
            : '';
      approxEl.hidden = !approxNote;
      approxEl.textContent = approxNote;

      wasteLabelEl.textContent = `Waste: ${Math.round(current.wastePercent)}%`;

      const estimate = area == null
        ? null
        : estimateTiles(area, current.widthCm, current.heightCm, current.wastePercent);
      resultEl.innerHTML = estimate
        ? `
          <div class="m3d-mat-result-heading">To buy</div>
          <div class="m3d-mat-result-count">${estimate.tileCount} tiles</div>
          <div>~${estimate.buyAreaM2.toFixed(1)} m² of tiles</div>
          <div class="m3d-mat-result-detail">Tile ${estimate.tileAreaM2.toFixed(2)} m² · with waste ~${estimate.effectiveAreaM2.toFixed(1)} m²</div>
        `
        : '<div class="m3d-mat-result-detail">Nothing to estimate without measurements.</div>';
    }

    function syncInputs() {
      widthInput.value = formatCm(current.widthCm);
      heightInput.value = formatCm(current.heightCm);
      wasteInput.value = String(Math.round(current.wastePercent));
    }

    toggleBtn.addEventListener('click', () => {
      haptic();
      materialsExpanded = !materialsExpanded;
      bodyEl.hidden = !materialsExpanded;
      toggleBtn.setAttribute('aria-expanded', String(materialsExpanded));
    });

    surfaceSegEl.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-surface]');
      if (!btn || btn.dataset.surface === surface) return;
      haptic();
      surface = btn.dataset.surface;
      current = { ...prefs[surface] };
      isSquare = Math.abs(current.widthCm - current.heightCm) < 0.001;
      syncInputs();
      update();
    });

    shapeSegEl.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-square]');
      if (!btn) return;
      const nextSquare = Boolean(btn.dataset.square);
      if (nextSquare === isSquare) return;
      haptic();
      isSquare = nextSquare;
      if (isSquare) {
        current.heightCm = current.widthCm;
        heightInput.value = formatCm(current.heightCm);
        persist();
      }
      update();
    });

    presetsEl.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-w]');
      if (!btn) return;
      haptic();
      current.widthCm = Number(btn.dataset.w);
      current.heightCm = Number(btn.dataset.h);
      isSquare = current.widthCm === current.heightCm;
      syncInputs();
      persist();
      update();
    });

    widthInput.addEventListener('input', () => {
      const parsed = Number(widthInput.value.replace(',', '.'));
      if (!(parsed > 0)) return;
      current.widthCm = parsed;
      if (isSquare) {
        current.heightCm = parsed;
        heightInput.value = formatCm(parsed);
      }
      persist();
      update();
    });

    heightInput.addEventListener('input', () => {
      const parsed = Number(heightInput.value.replace(',', '.'));
      if (!(parsed > 0)) return;
      current.heightCm = parsed;
      isSquare = false;
      persist();
      update();
    });

    wasteInput.addEventListener('input', () => {
      current.wastePercent = Number(wasteInput.value) || 0;
      persist();
      update();
    });

    materialsEl.querySelector('.m3d-mat-waste-quick').addEventListener('click', (event) => {
      const btn = event.target.closest('[data-waste]');
      if (!btn) return;
      haptic();
      current.wastePercent = Number(btn.dataset.waste);
      wasteInput.value = btn.dataset.waste;
      persist();
      update();
    });

    syncInputs();
    update();
  }

  async function mountViewer(scan) {
    // The blueprint overlay's host class/dataset must not survive from a
    // previously opened scan (innerHTML is cleared, but classes aren't).
    viewerWrapEl.classList.remove('is-blueprint');
    delete viewerWrapEl.dataset.roomscanBlueprintAlignRad;
    viewerWrapEl.innerHTML =
      `<div class="m3d-viewer-status" role="status" aria-label="Loading 3D model">${loadingSpinnerHtml()}</div>`;
    renderViewerMeta(scan);

    const glb = scan.glbUrl ? withCacheBust(photoUrl(scan.glbUrl)) : '';
    const usdz = scan.usdzUrl ? photoUrl(scan.usdzUrl) : '';

    if (!glb) {
      viewerWrapEl.innerHTML =
        '<div class="m3d-viewer-status">No web 3D preview yet for this scan.</div>';
      return;
    }

    try {
      await loadModelViewerScript();
      preventRoomScanDoubleTapZoom(viewerWrapEl);
      const viewer = createModelViewer(glb, usdz);
      viewer.addEventListener(
        'error',
        () => {
          viewerWrapEl.innerHTML =
            '<div class="m3d-viewer-status">Could not load this 3D model.</div>';
        },
        { once: true }
      );
      viewerWrapEl.innerHTML = '';
      viewerWrapEl.appendChild(viewer);

      // Bottom bar: rotate play/pause + zoom slider (mirrors UyDosh's inline tile).
      const controlsBar = document.createElement('div');
      controlsBar.className = 'roomscan-controls-bar';
      controlsBar.appendChild(createRoomScanRotateButton(viewer));
      controlsBar.appendChild(createRoomScanZoomSlider(viewer));
      viewerWrapEl.appendChild(controlsBar);
      // Top-right stacked toggles: display mode / wall texture / floor texture.
      viewerWrapEl.appendChild(createRoomScanModeButton(viewer));
      viewerWrapEl.appendChild(createRoomScanWallTextureButton(viewer));
      viewerWrapEl.appendChild(createRoomScanFloorTextureButton(viewer));
      // Top-left: 3D/2D toggle — 2D mounts the vector blueprint floor plan.
      viewerWrapEl.appendChild(createRoomScanPlanToggle(viewer, viewerWrapEl, glb));
    } catch (err) {
      console.error('[Makon3D] model-viewer failed', err);
      viewerWrapEl.innerHTML =
        '<div class="m3d-viewer-status">Could not load the 3D viewer.</div>';
    }
  }

  async function openScan(scanOrId, { pushHistory = true } = {}) {
    let scan = typeof scanOrId === 'object' && scanOrId ? scanOrId : null;
    const id = scan ? Number(scan.id) : Number(scanOrId);
    if (!Number.isInteger(id) || id <= 0) return;

    if (!scan) {
      scan = scansCache.find((s) => Number(s.id) === id) || null;
    }
    if (!scan) {
      try {
        const { token } = readRoute();
        const qs = token ? `?token=${encodeURIComponent(token)}` : '';
        const res = await fetch(`${API_BASE}/makon3d/scans/${id}${qs}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        scan = await res.json();
      } catch (err) {
        console.error('[Makon3D] fetch scan failed', err);
        showStatus('Scan not found.', true);
        showListView();
        return;
      }
    }

    openScanId = id;
    listPanelEl.hidden = true;
    viewerPanelEl.hidden = false;
    backEl.hidden = false;
    // The burger yields its spot to the back button — two buttons before the
    // brand would crowd the header on narrow phones.
    navTriggerEl.hidden = true;
    if (pushHistory) setRoute(id);
    renderViewerMeta(scan);
    const pageUrl = scan.viewerUrl || viewerShareUrl(id);
    const imageUrl = scan.rotationGifUrl
      ? photoUrl(scan.rotationGifUrl)
      : scan.posterImageUrl
        ? photoUrl(scan.posterImageUrl)
        : '';
    setShareOgTags({
      title: `Makon3D scan #${id}`,
      description: 'View this 3D scan in Makon3D',
      imageUrl,
      pageUrl,
    });
    await mountViewer(scan);
  }

  function renderList(scans) {
    scansCache = Array.isArray(scans) ? scans : [];
    if (!scansCache.length) {
      showStatus('No scans yet.');
      return;
    }

    statusEl.hidden = true;
    listEl.hidden = false;
    listEl.innerHTML = scansCache
      .map((scan) => {
        const ready = Boolean(scan.glbUrl);
        const badge = ready
          ? '<span class="m3d-badge m3d-badge-ready">3D ready</span>'
          : '<span class="m3d-badge m3d-badge-pending">Processing</span>';
        const dims = scanDimensions(scan);
        const date = formatDate(scan.createdAt);
        const metaBits = [date, ...dims].filter(Boolean);
        return `
          <li>
            <button type="button" class="m3d-item" data-scan-id="${escapeHtml(scan.id)}">
              <span class="m3d-item-body">
                <span class="m3d-item-top">
                  <span class="m3d-item-title">Scan #${escapeHtml(scan.id)}</span>
                  ${badge}
                </span>
                <span class="m3d-item-meta">
                  ${metaBits.map((b) => `<span>${escapeHtml(b)}</span>`).join('')}
                </span>
              </span>
              <span class="m3d-item-chevron" aria-hidden="true">›</span>
            </button>
          </li>
        `;
      })
      .join('');
  }

  async function loadScans() {
    const { id } = readRoute();
    showListView();
    showLoadingStatus('Loading scans');

    try {
      const res = await fetch(`${API_BASE}/makon3d/scans`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      renderList(data.scans || []);
      if (id) await openScan(id, { pushHistory: false });
    } catch (err) {
      console.error('[Makon3D] list failed', err);
      showStatus('Could not load scans. Pull to refresh or try again later.', true);
      if (id) await openScan(id, { pushHistory: false });
    }
  }

  // --- Scan a room (UyDosh App Clip) -----------------------------------------
  // Mirrors the UyDosh Mini App's post-publish upsell (telegram-create.js):
  // POST /makon3d/scan-sessions mints a short-lived invocation URL, the iOS
  // App Clip scans with RoomPlan and uploads, the backend feeds the result
  // into makon3d_scans, and the clip deep-links back here with a
  // `scan_<token>` start_param (handled by restoreScanSessionFromStartParam).

  const scanCtaEl = document.getElementById('m3d-scan-cta');
  const SCAN_SESSION_STORAGE_KEY = 'makon3d:activeScanSession';
  const SCAN_SESSION_TTL_MS = 60 * 60 * 1000;
  let scanPollTimer = null;

  /** Lazy-loaded QR generator, same CDN pattern as model-viewer above. */
  const QRCODE_LIB_SRC = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.5.0/qrcode.js';
  let qrCodeLibPromise = null;

  function loadQrCodeLib() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    if (qrCodeLibPromise) return qrCodeLibPromise;
    qrCodeLibPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = QRCODE_LIB_SRC;
      script.async = true;
      script.onload = () => {
        if (window.qrcode) resolve(window.qrcode);
        else {
          qrCodeLibPromise = null;
          reject(new Error('qrcode lib missing after load'));
        }
      };
      script.onerror = () => {
        qrCodeLibPromise = null;
        reject(new Error('Failed to load qrcode lib'));
      };
      document.head.appendChild(script);
    });
    return qrCodeLibPromise;
  }

  /**
   * Portrait CSS screen profiles unique to iPhones that certainly have no
   * LiDAR (LiDAR starts with the iPhone 12 Pro). Copied from the UyDosh Mini
   * App's device pre-filter (telegram-create.js) — intentionally optimistic;
   * the App Clip's real RoomCaptureSession.isSupported check is the authority.
   */
  const NON_LIDAR_IPHONE_SCREENS = new Set([
    '320x568',
    '375x667',
    '414x736',
    '375x812',
    '414x896',
  ]);

  function isLikelyRoomScanCapableDevice() {
    const ua = navigator.userAgent || '';
    const osMatch = /OS (\d+)_/.exec(ua);
    if (osMatch && Number(osMatch[1]) < 16) return false;
    const shortSide = Math.min(screen.width, screen.height);
    const longSide = Math.max(screen.width, screen.height);
    return !NON_LIDAR_IPHONE_SCREENS.has(`${shortSide}x${longSide}`);
  }

  function isIosClient() {
    const tgPlatform = String(window.Telegram?.WebApp?.platform || '').toLowerCase();
    if (tgPlatform === 'ios') return true;
    if (tgPlatform && tgPlatform !== 'unknown') return false;
    return /iPhone|iPad|iPod/.test(navigator.userAgent || '');
  }

  async function createScanSession() {
    const res = await fetch(`${API_BASE}/makon3d/scan-sessions`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    let payload = null;
    try {
      payload = await res.json();
    } catch { /* ignore */ }
    if (!res.ok) {
      const err = new Error(payload?.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.payload = payload;
      throw err;
    }
    return payload;
  }

  async function fetchScanSession(token) {
    const res = await fetch(`${API_BASE}/scan-sessions/${encodeURIComponent(token)}`, {
      headers: { Accept: 'application/json' },
    });
    let payload = null;
    try {
      payload = await res.json();
    } catch { /* ignore */ }
    if (!res.ok) {
      const err = new Error(payload?.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.payload = payload;
      throw err;
    }
    return payload;
  }

  function renderScanCta() {
    if (!scanCtaEl) return;
    const isIos = isIosClient();
    // Mirror the UyDosh Mini App: hide the affordance entirely on iPhones
    // that certainly can't scan; keep the QR/copy-link path everywhere else
    // (the link can be opened on another device).
    if (isIos && !isLikelyRoomScanCapableDevice()) return;

    scanCtaEl.innerHTML = `
      <p class="m3d-scan-cta-status" id="m3d-scan-cta-status" hidden></p>
      <button type="button" class="m3d-scan-cta-btn" id="m3d-scan-cta-btn">
        ${isIos ? 'Scan a room' : 'Get scan link'}
      </button>
    `;
    scanCtaEl.hidden = false;
    // Reserves list-panel space for the fixed bottom banner (see makon3d.css).
    document.body.classList.add('m3d-has-scan-banner');
    document
      .getElementById('m3d-scan-cta-btn')
      ?.addEventListener('click', () => startScanFlow(isIos));
  }

  function setScanCtaStatus(message) {
    const el = document.getElementById('m3d-scan-cta-status');
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || '';
  }

  async function showScanQrCode(invocationUrl) {
    if (!scanCtaEl) return;
    let wrap = document.getElementById('m3d-scan-cta-qr');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'm3d-scan-cta-qr';
      wrap.className = 'm3d-scan-cta-qr';
      scanCtaEl.appendChild(wrap);
    }
    try {
      const qrcode = await loadQrCodeLib();
      const qr = qrcode(0, 'M');
      qr.addData(invocationUrl);
      qr.make();
      const img = document.createElement('img');
      img.src = qr.createDataURL(5, 4);
      img.alt = invocationUrl;
      img.decoding = 'async';
      wrap.innerHTML = '';
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'm3d-scan-cta-qr-close';
      closeBtn.setAttribute('aria-label', 'Close');
      closeBtn.innerHTML = '&times;';
      closeBtn.addEventListener('click', () => {
        haptic();
        wrap.remove();
      });
      wrap.appendChild(closeBtn);
      wrap.appendChild(img);
      const hint = document.createElement('p');
      hint.className = 'm3d-scan-cta-qr-hint';
      hint.textContent = 'Scan this code with an iPhone camera to start scanning.';
      wrap.appendChild(hint);
    } catch (err) {
      console.error('[Makon3D] QR render failed', err);
      wrap.remove();
    }
  }

  async function startScanFlow(isIos) {
    const button = document.getElementById('m3d-scan-cta-btn');
    if (button) {
      button.disabled = true;
      button.textContent = 'Starting…';
    }
    haptic();
    try {
      const session = await createScanSession();
      try {
        sessionStorage.setItem(
          SCAN_SESSION_STORAGE_KEY,
          JSON.stringify({ token: session.scanSessionId, createdAt: Date.now() }),
        );
      } catch { /* ignore */ }

      if (isIos) {
        const tg = window.Telegram?.WebApp;
        if (tg?.openLink) tg.openLink(session.invocationUrl);
        else window.open(session.invocationUrl, '_blank');
        if (button) {
          button.disabled = false;
          button.textContent = 'Scan a room';
        }
        watchScanSession(session.scanSessionId);
      } else {
        // Desktop/Android: QR first (clipboard writes can reject in some
        // Telegram webviews and must not kill the flow), then copy.
        showScanQrCode(session.invocationUrl);
        watchScanSession(session.scanSessionId);
        let copied = false;
        try {
          await navigator.clipboard?.writeText?.(session.invocationUrl);
          copied = true;
        } catch { /* clipboard unavailable — the QR still carries the link */ }
        if (button) {
          button.disabled = false;
          button.textContent = copied ? 'Link copied' : 'Get scan link';
        }
      }
    } catch (err) {
      console.error('[Makon3D] scan session create failed', err);
      if (err?.payload?.code === 'lidar_room_scan_disabled' && scanCtaEl) {
        scanCtaEl.hidden = true;
        document.body.classList.remove('m3d-has-scan-banner');
        return;
      }
      setScanCtaStatus('Could not start scanning. Try again later.');
      if (button) {
        button.disabled = false;
        button.textContent = isIos ? 'Scan a room' : 'Get scan link';
      }
    }
  }

  /** Re-fetches the scan list, then opens the freshly created scan. */
  async function openCompletedScan(makon3dScanId) {
    try {
      const res = await fetch(`${API_BASE}/makon3d/scans`);
      if (res.ok) {
        const data = await res.json();
        renderList(data.scans || []);
      }
    } catch { /* list refresh is best-effort */ }
    if (Number.isInteger(makon3dScanId) && makon3dScanId > 0) {
      await openScan(makon3dScanId);
    }
  }

  /**
   * Polls the scan session while the page is visible; stops on any terminal
   * status. Used both after tapping the CTA and when resuming a session
   * persisted in sessionStorage.
   */
  function watchScanSession(token) {
    const stop = () => {
      if (scanPollTimer) {
        clearInterval(scanPollTimer);
        scanPollTimer = null;
      }
    };
    const clearStored = () => {
      try { sessionStorage.removeItem(SCAN_SESSION_STORAGE_KEY); } catch { /* ignore */ }
    };

    const poll = async () => {
      if (document.visibilityState !== 'visible') return;
      let session;
      try {
        session = await fetchScanSession(token);
      } catch (err) {
        if (err?.status === 404 || err?.status === 410) {
          stop();
          clearStored();
        }
        return;
      }
      if (session.status === 'processing') {
        setScanCtaStatus('Building the 3D model…');
      } else if (session.status === 'completed') {
        stop();
        clearStored();
        document.getElementById('m3d-scan-cta-qr')?.remove();
        setScanCtaStatus('');
        haptic();
        await openCompletedScan(Number(session.makon3dScanId));
      } else if (session.status === 'failed' || session.status === 'expired') {
        stop();
        clearStored();
        document.getElementById('m3d-scan-cta-qr')?.remove();
        setScanCtaStatus(
          session.status === 'failed'
            ? 'Scan processing failed. Please try again.'
            : '',
        );
      }
    };

    stop();
    scanPollTimer = setInterval(poll, 4000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && scanPollTimer) poll();
    });
    poll();
  }

  /** Resumes polling a scan session persisted before the App Clip hop. */
  function resumeStoredScanSession() {
    let stored = null;
    try {
      stored = JSON.parse(sessionStorage.getItem(SCAN_SESSION_STORAGE_KEY) || 'null');
    } catch { /* ignore */ }
    if (!stored?.token) return;
    if (Date.now() - (Number(stored.createdAt) || 0) > SCAN_SESSION_TTL_MS) {
      try { sessionStorage.removeItem(SCAN_SESSION_STORAGE_KEY); } catch { /* ignore */ }
      return;
    }
    watchScanSession(stored.token);
  }

  // --- Return leg from the App Clip (start_param) ----------------------------
  // After uploading, the clip opens t.me/<bot>/<app>?startapp=scan_<token>;
  // Telegram passes that through as initDataUnsafe.start_param. Show a
  // blocking overlay while the backend converts, then open the scan.

  function scanReturnOverlay() {
    let overlay = document.getElementById('m3d-scan-overlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'm3d-scan-overlay';
    overlay.className = 'm3d-scan-overlay';
    overlay.innerHTML = `
      <div class="m3d-scan-overlay-card">
        ${loadingSpinnerHtml()}
        <p id="m3d-scan-overlay-text">Building the 3D model…</p>
        <button type="button" class="m3d-scan-cta-btn" id="m3d-scan-overlay-close" hidden>
          Back to scans
        </button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#m3d-scan-overlay-close')?.addEventListener('click', () => {
      overlay.remove();
    });
    return overlay;
  }

  function failScanReturnOverlay(message) {
    const overlay = document.getElementById('m3d-scan-overlay');
    if (!overlay) return;
    overlay.querySelector('.m3d-loading-spinner')?.remove();
    const text = overlay.querySelector('#m3d-scan-overlay-text');
    if (text) text.textContent = message;
    const close = overlay.querySelector('#m3d-scan-overlay-close');
    if (close) close.hidden = false;
  }

  async function restoreScanSessionFromStartParam() {
    let startParam = '';
    try {
      startParam = String(window.Telegram?.WebApp?.initDataUnsafe?.start_param || '');
    } catch { /* ignore */ }
    const match = /^scan_([A-Za-z0-9_-]{4,64})$/.exec(startParam);
    if (!match) return false;
    const token = match[1];

    const overlay = scanReturnOverlay();
    const finish = () => overlay.remove();

    const poll = async () => {
      let session;
      try {
        session = await fetchScanSession(token);
      } catch (err) {
        if (err?.status === 404 || err?.status === 410) {
          failScanReturnOverlay('This scan link has expired.');
          return true;
        }
        return false; // transient — keep polling
      }
      if (session.status === 'completed') {
        finish();
        haptic();
        await openCompletedScan(Number(session.makon3dScanId));
        return true;
      }
      if (session.status === 'failed') {
        failScanReturnOverlay('Scan processing failed. Please try scanning again.');
        return true;
      }
      if (session.status === 'expired') {
        failScanReturnOverlay('This scan session has expired.');
        return true;
      }
      return false; // created / uploading / processing — keep waiting
    };

    if (await poll()) return true;
    const timer = setInterval(async () => {
      if (!document.getElementById('m3d-scan-overlay')) {
        clearInterval(timer);
        return;
      }
      if (await poll()) clearInterval(timer);
    }, 3000);
    return true;
  }

  const DRAWER_TRANSITION_MS = 220;
  let drawerCloseTimer = null;

  function openDrawer() {
    if (!drawerBackdropEl) return;
    clearTimeout(drawerCloseTimer);
    drawerBackdropEl.hidden = false;
    drawerBackdropEl.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => drawerBackdropEl.classList.add('is-open'));
    navTriggerEl?.setAttribute('aria-expanded', 'true');
  }

  function closeDrawer() {
    if (!drawerBackdropEl || drawerBackdropEl.hidden) return;
    drawerBackdropEl.classList.remove('is-open');
    drawerBackdropEl.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    navTriggerEl?.setAttribute('aria-expanded', 'false');
    drawerCloseTimer = setTimeout(() => {
      drawerBackdropEl.hidden = true;
    }, DRAWER_TRANSITION_MS);
  }

  /** Telegram user's photo + display name into the header/drawer avatars. */
  function initTelegramUserChrome() {
    let user = null;
    try {
      user = window.Telegram?.WebApp?.initDataUnsafe?.user || null;
    } catch {
      user = null;
    }
    if (!user) return;
    const photoUrl = typeof user.photo_url === 'string' ? user.photo_url : '';
    if (photoUrl) {
      for (const holder of [avatarEl, drawerAvatarEl]) {
        if (!holder) continue;
        const img = document.createElement('img');
        img.className = 'm3d-avatar-img';
        img.src = photoUrl;
        img.alt = '';
        img.referrerPolicy = 'no-referrer';
        img.onerror = () => {
          holder.classList.remove('has-avatar');
          img.remove();
        };
        holder.classList.add('has-avatar');
        holder.appendChild(img);
      }
    }
    const displayName =
      [user.first_name, user.last_name].filter(Boolean).join(' ').trim() ||
      (user.username ? `@${user.username}` : '');
    if (displayName && drawerUsernameEl) {
      drawerUsernameEl.textContent = displayName;
      drawerUsernameEl.hidden = false;
    }
  }

  // Same fix as UyDosh's mini app (see applyTelegramSafeAreaInsets in
  // uydosh-mini-app.js): inside Telegram's WebView env(safe-area-inset-*)
  // reports 0, so Telegram's own Close/menu buttons float over the app's
  // header. Read the insets from the WebApp API instead and publish them as
  // CSS vars that makon3d.css prefers over env().
  const TELEGRAM_MOBILE_PLATFORMS = new Set(['ios', 'android', 'android_x']);
  /** Minimum space below Telegram mobile header chrome (Close + title bar). */
  const TELEGRAM_MOBILE_HEADER_MIN_TOP = 72;

  function isTelegramMobile(tg) {
    return TELEGRAM_MOBILE_PLATFORMS.has(String(tg?.platform || 'unknown').toLowerCase());
  }

  function applyTelegramSafeAreaInsets(tg) {
    const root = document.documentElement;
    const device = tg?.safeAreaInset ?? {};
    const content = tg?.contentSafeAreaInset ?? {};
    // Sum device + content insets (Telegram docs); content-only top under-reports on mobile.
    let top = (Number(device.top) || 0) + (Number(content.top) || 0);
    const bottom = (Number(device.bottom) || 0) + (Number(content.bottom) || 0);
    if (isTelegramMobile(tg)) {
      top = Math.max(top, TELEGRAM_MOBILE_HEADER_MIN_TOP);
    }
    root.style.setProperty('--uydosh-tg-inset-top', `${top}px`);
    root.style.setProperty('--uydosh-tg-inset-bottom', `${bottom}px`);
  }

  function initTelegramChrome() {
    try {
      const tg = window.Telegram?.WebApp;
      if (!tg) return;
      tg.ready?.();
      tg.expand?.();
      document.documentElement.style.setProperty('--tg-bg', tg.backgroundColor || '');
      document.documentElement.style.setProperty('--tg-fg', tg.textColor || '');
      applyTelegramSafeAreaInsets(tg);
      if (typeof tg.onEvent === 'function') {
        for (const event of ['safeAreaChanged', 'contentSafeAreaChanged', 'viewportChanged']) {
          tg.onEvent(event, () => applyTelegramSafeAreaInsets(tg));
        }
      }
      // Insets are often still 0 on the very first tick — re-apply once the
      // client has settled (same rAF + 150ms retry as uydosh-mini-app.js).
      requestAnimationFrame(() => applyTelegramSafeAreaInsets(tg));
      setTimeout(() => applyTelegramSafeAreaInsets(tg), 150);
    } catch {
      /* ignore */
    }
  }

  listEl.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-scan-id]');
    if (!btn) return;
    const id = Number(btn.getAttribute('data-scan-id'));
    if (Number.isInteger(id) && id > 0) openScan(id);
  });

  backEl.addEventListener('click', () => {
    showListView();
    setRoute(null);
  });

  navTriggerEl?.addEventListener('click', openDrawer);

  drawerBackdropEl?.addEventListener('click', (event) => {
    // Only the dimmed area closes; navigation links close via page unload,
    // except the SPA-style "Scans" home link handled below.
    if (event.target === drawerBackdropEl) closeDrawer();
  });

  drawerHomeEl?.addEventListener('click', (event) => {
    event.preventDefault();
    closeDrawer();
    showListView();
    setRoute(null);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDrawer();
  });

  window.addEventListener('popstate', () => {
    const { id } = readRoute();
    if (id) openScan(id, { pushHistory: false });
    else showListView();
  });

  initTelegramChrome();
  initTelegramUserChrome();
  renderScanCta();
  loadScans();
  // The App Clip return leg (`scan_<token>` start_param) takes precedence
  // over resuming a stored session — both would poll the same session anyway.
  restoreScanSessionFromStartParam().then((handled) => {
    if (!handled) resumeStoredScanSession();
  });
})();
