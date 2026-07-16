// Makon3D web gallery — list recent scans, open one in <model-viewer>.
(() => {
  const API_BASE = window.UyDosh?.API_BASE || 'https://api.uydosh.com';
  const MODEL_VIEWER_SRC =
    'https://cdn.jsdelivr.net/npm/@google/model-viewer@4.3.1/dist/model-viewer.min.js';
  // Backend may rewrite room_scan.glb in place — bump to bust caches.
  const GLB_CACHE_VERSION = '20260716-1';

  const titleEl = document.getElementById('m3d-title');
  const backEl = document.getElementById('m3d-back');
  const statusEl = document.getElementById('m3d-status');
  const listEl = document.getElementById('m3d-list');
  const listPanelEl = document.getElementById('m3d-list-panel');
  const viewerPanelEl = document.getElementById('m3d-viewer-panel');
  const viewerWrapEl = document.getElementById('m3d-viewer-wrap');
  const viewerMetaEl = document.getElementById('m3d-viewer-meta');

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
    const rawId = qs.get('id') || qs.get('scan');
    const id = rawId && /^\d+$/.test(rawId) ? Number(rawId) : null;
    const deviceId = (qs.get('device_id') || '').trim();
    return { id, deviceId };
  }

  function setRoute(scanId) {
    const qs = new URLSearchParams(location.search);
    const { deviceId } = readRoute();
    if (deviceId) qs.set('device_id', deviceId);
    else qs.delete('device_id');
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
    statusEl.textContent = message;
    listEl.hidden = true;
  }

  function showListView() {
    openScanId = null;
    listPanelEl.hidden = false;
    viewerPanelEl.hidden = true;
    backEl.hidden = true;
    titleEl.textContent = 'Makon3D';
    viewerWrapEl.innerHTML = '';
    viewerMetaEl.innerHTML = '';
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
    el.setAttribute('auto-rotate', '');
    el.setAttribute('auto-rotate-delay', '0');
    el.setAttribute('rotation-per-second', '45deg');
    el.setAttribute('shadow-intensity', '0.9');
    el.setAttribute('exposure', '1.08');
    return el;
  }

  function renderViewerMeta(scan) {
    const dims = scanDimensions(scan);
    const date = formatDate(scan.createdAt);
    const rows = [];
    rows.push(`<div><strong>Scan #${escapeHtml(scan.id)}</strong></div>`);
    if (date) rows.push(`<div>${escapeHtml(date)}</div>`);
    if (dims.length) {
      rows.push(`<div class="m3d-dim-row">${dims.map((d) => `<span>${escapeHtml(d)}</span>`).join('')}</div>`);
    }
    if (!scan.glbUrl) {
      rows.push('<div>3D preview is still processing — USDZ is available for the native app.</div>');
    }
    viewerMetaEl.innerHTML = rows.join('');
  }

  async function mountViewer(scan) {
    viewerWrapEl.innerHTML =
      '<div class="m3d-viewer-status" role="status">Loading 3D model…</div>';
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
        const res = await fetch(`${API_BASE}/makon3d/scans/${id}`);
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
    titleEl.textContent = `Scan #${id}`;
    if (pushHistory) setRoute(id);
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
    const { id, deviceId } = readRoute();
    showListView();
    showStatus('Loading scans…');

    const qs = new URLSearchParams();
    if (deviceId) qs.set('device_id', deviceId);

    try {
      const res = await fetch(
        `${API_BASE}/makon3d/scans${qs.toString() ? `?${qs}` : ''}`
      );
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

  function initTelegramChrome() {
    try {
      const tg = window.Telegram?.WebApp;
      if (!tg) return;
      tg.ready?.();
      tg.expand?.();
      document.documentElement.style.setProperty('--tg-bg', tg.backgroundColor || '');
      document.documentElement.style.setProperty('--tg-fg', tg.textColor || '');
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

  window.addEventListener('popstate', () => {
    const { id } = readRoute();
    if (id) openScan(id, { pushHistory: false });
    else showListView();
  });

  initTelegramChrome();
  loadScans();
})();
