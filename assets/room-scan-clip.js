/**
 * Shared App Clip room-scan session helpers for the Telegram Mini App.
 *
 * Used by the post-publish upsell (`telegram-create.js`) and the owner
 * "Add / Replace 3D scan" CTAs on listing detail. Creates a short-lived
 * scan session, opens the invocation URL (iOS) or shows QR + copy link
 * (elsewhere), then polls until the scan completes.
 *
 * Attaches to `window.UyDosh` once `uydosh-api.js` has loaded (this script
 * must come after it).
 */
(function (UyDosh) {
  'use strict';
  if (!UyDosh) return;

  const QRCODE_LIB_SRC = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.5.0/qrcode.js';
  let qrCodeLibPromise = null;
  let pollTimer = null;

  /**
   * Portrait CSS screen profiles (short×long) unique to iPhones that certainly
   * have no LiDAR: SE1 (320×568), 6/7/8/SE2/SE3 (375×667), 6–8 Plus (414×736),
   * X/XS/11 Pro/12 mini/13 mini (375×812), XR/XS Max/11/11 Pro Max (414×896).
   * LiDAR starts with the iPhone 12 Pro, and none of these sizes belong to a
   * 12-Pro-or-newer Pro model.
   */
  const NON_LIDAR_IPHONE_SCREENS = new Set([
    '320x568',
    '375x667',
    '414x736',
    '375x812',
    '414x896',
  ]);

  function tg() {
    return window.Telegram?.WebApp;
  }

  function isIosPlatform() {
    return (tg()?.platform || '') === 'ios';
  }

  /**
   * Best-effort web equivalent of the Flutter app's native LiDAR capability
   * check. Optimistic on ambiguous Pro/non-Pro shared screen sizes — the App
   * Clip itself runs the real hardware check.
   */
  function isLikelyRoomScanCapableDevice() {
    const ua = navigator.userAgent || '';
    const osMatch = /OS (\d+)_/.exec(ua);
    if (osMatch && Number(osMatch[1]) < 16) return false;
    const shortSide = Math.min(screen.width, screen.height);
    const longSide = Math.max(screen.width, screen.height);
    return !NON_LIDAR_IPHONE_SCREENS.has(`${shortSide}x${longSide}`);
  }

  /** Supply-side listings only — demand types have nothing physical to scan. */
  function isListingEligibleForRoomScan(listing) {
    const typeId = Number(listing?.listing_type_id ?? listing?.listing_type?.id);
    if (!Number.isFinite(typeId)) return true;
    const roomNeeded = Number(UyDosh.LISTING_TYPE_ROOM_NEEDED) || 1;
    const groupForming = Number(UyDosh.LISTING_TYPE_GROUP_FORMING) || 3;
    return typeId !== roomNeeded && typeId !== groupForming;
  }

  /**
   * Whether to show an App Clip scan CTA for the current device. Non-iOS keeps
   * the copy-link / QR fallback (link can be opened on another iPhone).
   */
  function shouldShowRoomScanClipCta() {
    if (isIosPlatform() && !isLikelyRoomScanCapableDevice()) return false;
    return true;
  }

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
   * Renders the invocation URL as a QR inside `hostEl` (clears previous
   * contents). Optional for non-iOS flows.
   */
  async function showScanQrCode(hostEl, invocationUrl, hintText) {
    if (!hostEl) return;
    try {
      const qrcode = await loadQrCodeLib();
      const qr = qrcode(0, 'M');
      qr.addData(invocationUrl);
      qr.make();
      const img = document.createElement('img');
      img.src = qr.createDataURL(5, 4);
      img.alt = invocationUrl;
      img.decoding = 'async';
      hostEl.innerHTML = '';
      hostEl.hidden = false;
      hostEl.appendChild(img);
      if (hintText) {
        const hint = document.createElement('p');
        hint.className = 'scan-upsell-qr-hint';
        hint.textContent = hintText;
        hostEl.appendChild(hint);
      }
    } catch (err) {
      console.error('QR render failed', err);
      hostEl.innerHTML = '';
      hostEl.hidden = true;
    }
  }

  function stopWatchingScanSession() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  /**
   * Polls the scan session while the page is visible; stops on terminal
   * status. `onCompleted({ listingId, roomScanGlbUrl })` fires once.
   */
  function watchScanSession(token, listingId, { statusEl, qrHostEl, buttonEl, onCompleted } = {}) {
    const lang = UyDosh.getLang();

    const poll = async () => {
      if (document.visibilityState !== 'visible') return;
      let session;
      try {
        session = await UyDosh.fetchScanSession(token);
      } catch (err) {
        if (err?.status === 404 || err?.status === 410) stopWatchingScanSession();
        return;
      }
      if (session.status === 'processing' && statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = UyDosh.t('create.scan3dProcessing', lang);
      } else if (session.status === 'completed') {
        stopWatchingScanSession();
        try { sessionStorage.removeItem('uydosh:activeScanSession'); } catch { /* ignore */ }
        if (qrHostEl) {
          qrHostEl.innerHTML = '';
          qrHostEl.hidden = true;
        }
        if (statusEl) {
          statusEl.hidden = false;
          statusEl.textContent = UyDosh.t('create.scan3dReady', lang);
        }
        onCompleted?.({
          listingId,
          roomScanGlbUrl: session.roomScanGlbUrl || session.room_scan_glb_url || null,
          buttonEl,
          statusEl,
        });
      } else if (session.status === 'failed' || session.status === 'expired') {
        stopWatchingScanSession();
        try { sessionStorage.removeItem('uydosh:activeScanSession'); } catch { /* ignore */ }
        if (qrHostEl) {
          qrHostEl.innerHTML = '';
          qrHostEl.hidden = true;
        }
      }
    };

    stopWatchingScanSession();
    pollTimer = setInterval(poll, 4000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && pollTimer) poll();
    });
  }

  /**
   * Create a scan session and launch the App Clip (iOS) or QR/copy fallback.
   *
   * @param {object} opts
   * @param {number|string} opts.listingId
   * @param {HTMLButtonElement} [opts.buttonEl]
   * @param {() => string} opts.getButtonIdleLabel — restore label after start
   * @param {HTMLElement} [opts.statusEl]
   * @param {HTMLElement} [opts.qrHostEl]
   * @param {() => void} [opts.onFeatureDisabled] — 403 lidar_room_scan_disabled
   * @param {(result: object) => void} [opts.onCompleted]
   */
  async function startListingRoomScanFlow({
    listingId,
    buttonEl,
    getButtonIdleLabel,
    statusEl,
    qrHostEl,
    onFeatureDisabled,
    onCompleted,
  }) {
    const lang = UyDosh.getLang();
    const isIos = isIosPlatform();
    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.textContent = UyDosh.t('create.scan3dStarting', lang);
    }
    UyDosh.hapticImpact?.('medium');
    try {
      const session = await UyDosh.createListingScanSession(listingId);
      try {
        sessionStorage.setItem(
          'uydosh:activeScanSession',
          JSON.stringify({ token: session.scanSessionId, listingId, createdAt: Date.now() }),
        );
      } catch { /* ignore */ }
      UyDosh.logMiniAppEvent?.('room_scan_session_created', { listing_id: listingId });

      if (isIos) {
        const webApp = tg();
        if (webApp?.openLink) webApp.openLink(session.invocationUrl);
        else window.open(session.invocationUrl, '_blank');
        if (buttonEl) {
          buttonEl.disabled = false;
          restoreButtonLabel(buttonEl, getButtonIdleLabel?.(lang));
        }
        watchScanSession(session.scanSessionId, listingId, {
          statusEl,
          qrHostEl,
          buttonEl,
          onCompleted,
        });
      } else {
        await showScanQrCode(
          qrHostEl,
          session.invocationUrl,
          UyDosh.t('create.scan3dQrHint', lang),
        );
        watchScanSession(session.scanSessionId, listingId, {
          statusEl,
          qrHostEl,
          buttonEl,
          onCompleted,
        });
        let copied = false;
        try {
          await navigator.clipboard?.writeText?.(session.invocationUrl);
          copied = true;
        } catch { /* clipboard unavailable */ }
        if (buttonEl) {
          buttonEl.disabled = false;
          buttonEl.textContent = copied
            ? UyDosh.t('create.scan3dLinkCopied', lang)
            : UyDosh.t('create.scan3dCopyLink', lang);
        }
      }
    } catch (err) {
      console.error('Scan session create failed', err);
      if (err?.payload?.code === 'lidar_room_scan_disabled') {
        onFeatureDisabled?.();
        return;
      }
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = UyDosh.t('create.scan3dError', lang);
      }
      if (buttonEl) {
        buttonEl.disabled = false;
        restoreButtonLabel(buttonEl, getButtonIdleLabel?.(lang));
      }
    }
  }

  function restoreButtonLabel(buttonEl, label) {
    if (!buttonEl || label == null || label === '') return;
    if (buttonEl.dataset.useIconLabel === '1') buttonEl.innerHTML = label;
    else buttonEl.textContent = label;
  }

  Object.assign(UyDosh, {
    isLikelyRoomScanCapableDevice,
    isListingEligibleForRoomScan,
    shouldShowRoomScanClipCta,
    isIosPlatform,
    showScanQrCode,
    startListingRoomScanFlow,
    stopWatchingScanSession,
  });
})(window.UyDosh);
