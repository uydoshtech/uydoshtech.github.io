// Friends live map for the Telegram Mini App account page.
// Locations come from the backend. Markers are removed when a point expires,
// the sharer stops, or the viewer no longer has access.
(function () {
  const TASHKENT = [41.311151, 69.279737];
  const FILTERS = ['followers', 'following', 'mutual'];
  const FILTER_ICONS = {
    followers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="14" cy="8" r="3"></circle><path d="M8.2 19.2c.9-2.6 2.8-4 5.8-4s4.9 1.4 5.8 4"></path><path d="M2.5 12h5"></path><path d="M5.2 9.6 7.6 12 5.2 14.4"></path></svg>',
    following: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3"></circle><path d="M3.2 19.2c.9-2.6 2.8-4 5.8-4s4.9 1.4 5.8 4"></path><path d="M16.5 12h5"></path><path d="M19.2 9.6 21.6 12 19.2 14.4"></path></svg>',
    mutual: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="9" r="2.4"></circle><circle cx="16" cy="9" r="2.4"></circle><path d="M3.6 18.6c.7-2.2 2.2-3.4 4.4-3.4s3.7 1.2 4.4 3.4"></path><path d="M11.6 18.6c.7-2.2 2.2-3.4 4.4-3.4s3.7 1.2 4.4 3.4"></path></svg>',
  };
  const state = {
    active: false,
    filter: 'followers',
    settings: { enabled: false, audience: 'mutual' },
    friends: [],
    selectedId: 0,
    error: '',
    permission: false,
    loading: false,
    authed: true,
    busy: false,
    shareExpanded: false,
    map: null,
    ymaps: null,
    markers: new Map(),
    fitted: false,
    pollTimer: null,
    unsubscribe: null,
    mapToken: 0,
  };

  function liveApi() {
    return window.UyDoshFriendLive;
  }

  function listEl() {
    return document.getElementById('account-list');
  }

  function rootEl() {
    return listEl()?.querySelector('[data-friends-root]') || null;
  }

  function showPanel() {
    const loading = document.getElementById('loading');
    const empty = document.getElementById('account-empty');
    const list = listEl();
    if (loading) loading.hidden = true;
    if (empty) empty.hidden = true;
    if (list) list.hidden = false;
  }

  function avatarHtml(friend) {
    const name = String(friend?.name || '').trim();
    const letter = (Array.from(name)[0] || '?').toUpperCase();
    const raw = friend?.avatarUrl || '';
    const url = raw && typeof UyDosh.photoUrl === 'function' ? UyDosh.photoUrl(raw) : raw;
    const img = url
      ? `<img src="${UyDosh.escapeHtml(url)}" alt="" referrerpolicy="no-referrer" />`
      : '';
    return `<span class="friend-avatar" aria-hidden="true"><span>${UyDosh.escapeHtml(letter)}</span>${img}</span>`;
  }

  function visibleFriends() {
    const api = liveApi();
    if (!api) return [];
    return api.visibleFriendMarkers(state.friends, state.filter, new Date());
  }

  function cardHtml(friend, lang) {
    const id = Number(friend.userId);
    const name = String(friend?.name || '').trim() || UyDosh.t('complaints.anonymous', lang);
    const backTo = `${UyDosh.MINI_APP_ACCOUNT_PATH}?tab=friends`;
    const href = UyDosh.escapeHtml(UyDosh.profilePageUrl(id, { backTo }));
    const mutual = friend.mutual === true;
    const badge = friend.self
      ? `<span class="friend-badge">${UyDosh.escapeHtml(UyDosh.t('account.friends.you', lang))}</span>`
      : mutual
        ? `<span class="friend-badge">${UyDosh.escapeHtml(UyDosh.t('account.friends.mutualBadge', lang))}</span>`
        : '';
    const follow = friend.self
      ? ''
      : `<button type="button" class="follow-btn${mutual ? ' is-on' : ''}" data-friend-follow="${id}">${UyDosh.escapeHtml(UyDosh.t(mutual ? 'profile.following' : 'profile.follow', lang))}</button>`;
    return `
      <article class="friend-card" data-friend-id="${id}">
        <a class="friend-card-link" href="${href}">
          ${avatarHtml(friend)}
          <span class="friend-card-text">
            <span class="friend-name">${UyDosh.escapeHtml(name)}</span>
            <span class="friend-live">${UyDosh.escapeHtml(UyDosh.t('account.friends.live', lang))}</span>
          </span>
          ${badge}
        </a>
        ${follow}
      </article>`;
  }

  function chromeIcon(name) {
    if (typeof UyDosh.iconChrome === 'function') return UyDosh.iconChrome(name);
    return '';
  }

  function mount(list) {
    list.innerHTML = `
      <section class="friends-panel" data-friends-root>
        <div class="friends-share-card" data-friends-share-card data-expanded="false">
          <div class="friends-share-head">
            <label class="friends-share-toggle">
              <input type="checkbox" data-friends-share />
              <span data-i18n="account.friends.share"></span>
            </label>
            <button type="button" class="friends-share-chevron" data-friends-share-toggle aria-expanded="false" aria-controls="friends-share-body">
              <span class="friends-chevron-down">${chromeIcon('chevronDown')}</span>
              <span class="friends-chevron-up">${chromeIcon('chevronUp')}</span>
            </button>
          </div>
          <div id="friends-share-body" class="friends-share-body" hidden>
            <p class="friends-status" data-friends-status></p>
            <p class="friends-rule" data-i18n="account.friends.rule"></p>
            <fieldset class="friends-audience">
              <legend data-i18n="account.friends.audience"></legend>
              <label>
                <input type="radio" name="friend-audience" value="following" data-friends-audience-value="following" />
                <span data-i18n="account.friends.audienceFollowing"></span>
              </label>
              <label>
                <input type="radio" name="friend-audience" value="mutual" data-friends-audience-value="mutual" />
                <span data-i18n="account.friends.audienceMutual"></span>
              </label>
            </fieldset>
            <p class="friends-permission" data-friends-permission hidden></p>
            <button type="button" class="friends-settings" data-friends-open-settings hidden data-i18n="account.friends.openSettings"></button>
          </div>
        </div>
        <p class="friends-error" data-friends-error hidden></p>
        <button type="button" class="friends-retry" data-friends-retry hidden data-i18n="account.friends.retry"></button>
        <div class="friends-map-wrap">
          <div id="friends-map" class="friends-map" role="region"></div>
          <button type="button" class="friends-map-filter" data-friends-filter-toggle>
            <span class="friends-map-filter-icon" data-friends-filter-icon></span>
          </button>
        </div>
        <div class="friends-list" data-friends-list></div>
      </section>`;
    UyDosh.applyI18n(list);
    bind(list.querySelector('[data-friends-root]'));
  }

  function bind(root) {
    root.addEventListener('change', (event) => {
      const share = event.target.closest('[data-friends-share]');
      if (share) {
        void onShareToggle(share.checked);
        return;
      }
      const audience = event.target.closest('[data-friends-audience-value]');
      if (audience) void onAudienceChange(audience.value);
    });
    root.addEventListener('click', (event) => {
      if (event.target.closest('[data-friends-filter-toggle]')) {
        const index = FILTERS.indexOf(state.filter);
        state.filter = FILTERS[(index + 1) % FILTERS.length];
        paint();
        return;
      }
      if (event.target.closest('[data-friends-retry]')) {
        void refresh();
        return;
      }
      if (event.target.closest('[data-friends-share-toggle]')) {
        state.shareExpanded = !state.shareExpanded;
        paint();
        return;
      }
      if (event.target.closest('[data-friends-open-settings]')) {
        const loc = window.Telegram?.WebApp?.LocationManager;
        if (typeof loc?.openSettings === 'function') loc.openSettings();
        return;
      }
      const follow = event.target.closest('[data-friend-follow]');
      if (follow) {
        event.preventDefault();
        void onFollow(Number(follow.getAttribute('data-friend-follow')));
        return;
      }
      const card = event.target.closest('[data-friend-id]');
      if (card) {
        state.selectedId = Number(card.getAttribute('data-friend-id'));
        paint();
      }
    });
  }

  function paint() {
    const root = rootEl();
    if (!root || !state.active) return;
    const lang = UyDosh.getLang();
    const shareCard = root.querySelector('[data-friends-share-card]');
    const shareToggle = root.querySelector('[data-friends-share-toggle]');
    const shareBody = root.querySelector('#friends-share-body');
    if (state.permission) state.shareExpanded = true;
    if (shareCard) shareCard.setAttribute('data-expanded', state.shareExpanded ? 'true' : 'false');
    if (shareBody) shareBody.hidden = !state.shareExpanded;
    if (shareToggle) {
      shareToggle.setAttribute('aria-expanded', state.shareExpanded ? 'true' : 'false');
      shareToggle.setAttribute('aria-label', UyDosh.t(
        state.shareExpanded ? 'account.friends.collapse' : 'account.friends.expand',
        lang,
      ));
    }
    const share = root.querySelector('[data-friends-share]');
    if (share) {
      share.checked = state.settings.enabled === true;
      share.disabled = state.busy || !state.authed;
    }
    for (const input of root.querySelectorAll('[data-friends-audience-value]')) {
      input.checked = input.value === state.settings.audience;
      input.disabled = state.busy || !state.authed;
    }
    const status = root.querySelector('[data-friends-status]');
    if (status) {
      const key = !state.authed
        ? 'account.friends.auth'
        : state.settings.enabled
          ? 'account.friends.sharingOn'
          : 'account.friends.sharingOff';
      status.textContent = UyDosh.t(key, lang);
    }
    const permission = root.querySelector('[data-friends-permission]');
    const settingsBtn = root.querySelector('[data-friends-open-settings]');
    if (permission) {
      permission.hidden = !state.permission;
      permission.textContent = state.permission ? UyDosh.t('account.friends.permission', lang) : '';
    }
    if (settingsBtn) settingsBtn.hidden = !state.permission;
    const filterButton = root.querySelector('[data-friends-filter-toggle]');
    const filterIcon = root.querySelector('[data-friends-filter-icon]');
    const filterKey = state.filter === 'mutual'
      ? 'account.friends.mutual'
      : state.filter === 'following'
        ? 'account.friends.following'
        : 'account.friends.followers';
    if (filterButton) filterButton.setAttribute('aria-label', UyDosh.t(filterKey, lang));
    if (filterIcon) filterIcon.innerHTML = FILTER_ICONS[state.filter] || FILTER_ICONS.followers;
    const error = root.querySelector('[data-friends-error]');
    const retry = root.querySelector('[data-friends-retry]');
    if (error) {
      error.hidden = !state.error;
      error.textContent = state.error ? UyDosh.t('account.friends.error', lang) : '';
    }
    if (retry) retry.hidden = !state.error;
    const people = visibleFriends();
    const list = root.querySelector('[data-friends-list]');
    const map = root.querySelector('#friends-map');
    if (map) map.hidden = false;
    const selected = people.find((friend) => Number(friend.userId) === state.selectedId) || null;
    if (list) {
      list.hidden = !selected;
      list.innerHTML = selected ? cardHtml(selected, lang) : '';
    }
    syncMarkers(people);
  }

  async function ensureMap() {
    const container = rootEl()?.querySelector('#friends-map');
    if (!container || state.map) return;
    const token = ++state.mapToken;
    try {
      const mapApi = await UyDosh.loadYandexMapModule();
      const ymaps = await mapApi.loadYandexScript(UyDosh.getLang());
      if (!state.active || token !== state.mapToken || !container.isConnected) return;
      state.ymaps = ymaps;
      state.map = new ymaps.Map(container, {
        center: TASHKENT,
        zoom: 11,
        controls: ['zoomControl'],
      }, {
        suppressMapOpenBlock: true,
        yandexMapDisablePoiInteractivity: true,
      });
      syncMarkers(visibleFriends());
      state.map.container.fitToViewport();
    } catch (err) {
      console.error('Failed to load friends map', err);
      state.error = 'map';
      paint();
    }
  }

  function telegramSelfAvatar() {
    try {
      return window.Telegram?.WebApp?.initDataUnsafe?.user?.photo_url || '';
    } catch {
      return '';
    }
  }

  function pinLayout(ymaps, friend, selected) {
    const name = String(friend?.name || '').trim();
    const letter = UyDosh.escapeHtml((Array.from(name)[0] || '?').toUpperCase());
    const raw = friend.self
      ? (telegramSelfAvatar() || friend.avatarUrl || '')
      : (friend?.avatarUrl || '');
    const url = raw && typeof UyDosh.photoUrl === 'function' ? UyDosh.photoUrl(raw) : raw;
    const img = url
      ? `<img src="${UyDosh.escapeHtml(url)}" alt="" referrerpolicy="no-referrer" />`
      : '';
    const selfClass = friend.self ? ' is-self' : '';
    const selectedClass = selected && !friend.self ? ' is-selected' : '';
    const html = `<div class="friend-map-pin${selfClass}${selectedClass}"><span>${letter}</span>${img}</div>`;
    return ymaps.templateLayoutFactory.createClass(html);
  }

  function syncMarkers(people) {
    if (!state.map || !state.ymaps) return;
    const ymaps = state.ymaps;
    const seen = new Set();
    for (const friend of people) {
      const id = Number(friend.userId);
      seen.add(id);
      const coords = [Number(friend.latitude), Number(friend.longitude)];
      if (!Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) continue;
      const selected = id === state.selectedId;
      let placemark = state.markers.get(id);
      if (!placemark) {
        placemark = new ymaps.Placemark(coords, {}, {
          iconLayout: pinLayout(ymaps, friend, selected),
          iconShape: { type: 'Circle', coordinates: [22, 22], radius: 22 },
          iconOffset: [-22, -22],
          zIndex: selected ? 2000 : friend.self ? 1600 : 1000,
        });
        placemark.events.add('click', () => {
          state.selectedId = id;
          paint();
        });
        state.map.geoObjects.add(placemark);
        state.markers.set(id, placemark);
      } else {
        placemark.geometry.setCoordinates(coords);
        placemark.options.set('iconLayout', pinLayout(ymaps, friend, selected));
        placemark.options.set('zIndex', selected ? 2000 : friend.self ? 1600 : 1000);
      }
    }
    for (const [id, placemark] of state.markers) {
      if (seen.has(id)) continue;
      state.map.geoObjects.remove(placemark);
      state.markers.delete(id);
    }
    if (!state.fitted && people.length) {
      const bounds = people
        .map((friend) => [Number(friend.latitude), Number(friend.longitude)])
        .filter((pair) => Number.isFinite(pair[0]) && Number.isFinite(pair[1]));
      if (bounds.length === 1) {
        state.map.setCenter(bounds[0], 14);
      } else if (bounds.length > 1) {
        state.map.setBounds(ymaps.util.bounds.fromPoints(bounds), { checkZoomRange: true, zoomMargin: 48 });
      }
      state.fitted = true;
    }
  }

  function destroyMap() {
    state.mapToken += 1;
    try { state.map?.destroy(); } catch { /* already gone */ }
    state.map = null;
    state.ymaps = null;
    state.markers = new Map();
    state.fitted = false;
  }

  function applySettings(payload, extra) {
    const api = liveApi();
    state.settings = api
      ? api.normalizeFriendLocationSettings(payload)
      : { enabled: payload?.enabled === true, audience: payload?.audience === 'following' ? 'following' : 'mutual' };
    if (extra?.permission != null) state.permission = extra.permission === true;
    if (state.settings.enabled) state.permission = false;
  }

  function mergeLocations(page) {
    const incoming = (Array.isArray(page?.friends) ? page.friends : [])
      .filter((friend) => friend && friend.self !== true);
    const previousSelf = state.friends.find((friend) => friend.self === true) || null;
    const selfSource = page?.self || (state.settings.enabled ? previousSelf : null);
    if (!selfSource || !(Number(selfSource.userId) > 0)) return incoming;
    const selfId = Number(selfSource.userId);
    return incoming
      .filter((friend) => Number(friend.userId) !== selfId)
      .concat([{
        ...selfSource,
        self: true,
        mutual: false,
        avatarUrl: telegramSelfAvatar() || selfSource.avatarUrl || null,
      }]);
  }

  let refreshing = false;

  async function refresh() {
    if (!state.active || refreshing) return;
    refreshing = true;
    try {
      state.error = '';
      const sessionReady = await UyDosh.ensureTelegramMiniAppSession();
      if (!state.active) return;
      if (!sessionReady) {
        state.authed = false;
        state.friends = [];
        paint();
        void ensureMap();
        return;
      }
      state.authed = true;
      const [settings, page] = await Promise.all([
        UyDosh.fetchFriendLocationSettings(),
        UyDosh.fetchFriendLiveLocations('followers'),
      ]);
      if (!state.active) return;
      const draftAudience = state.settings.enabled ? null : state.settings.audience;
      applySettings(settings);
      if (!state.settings.enabled && draftAudience) state.settings.audience = draftAudience;
      state.friends = mergeLocations(page);
      paint();
      void ensureMap();
    } catch (err) {
      console.error('Failed to load friend locations', err);
      if (!state.active) return;
      state.error = 'load';
      paint();
    } finally {
      refreshing = false;
    }
  }

  async function onShareToggle(enabled) {
    if (!state.authed || state.busy) {
      paint();
      return;
    }
    state.busy = true;
    state.permission = false;
    paint();
    try {
      if (!enabled) {
        const settings = await UyDosh.stopFriendLocationSharing();
        applySettings(settings, { permission: false });
      } else {
        const settings = await UyDosh.enableFriendLocationSharing(state.settings.audience);
        applySettings(settings, { permission: false });
      }
    } catch (err) {
      console.error('Failed to change friend location sharing', err);
      const denied = err?.message === 'location_denied'
        || err?.message === 'location_unavailable'
        || err?.message === 'location_manager_missing';
      state.permission = denied;
      if (denied) {
        try { await UyDosh.stopFriendLocationSharing({ permission: true }); } catch { /* already off */ }
      }
      applySettings(state.settings, { permission: denied });
      state.settings = { ...state.settings, enabled: false };
    } finally {
      state.busy = false;
      if (state.active) paint();
    }
  }

  async function onAudienceChange(audience) {
    if (audience !== 'following' && audience !== 'mutual') return;
    state.settings = { ...state.settings, audience };
    if (!state.settings.enabled || !state.authed) {
      paint();
      return;
    }
    state.busy = true;
    paint();
    try {
      const settings = await UyDosh.updateFriendLocationSettings({
        enabled: true,
        audience,
      });
      applySettings(settings);
    } catch (err) {
      console.error('Failed to update friend location audience', err);
      state.error = 'save';
    } finally {
      state.busy = false;
      if (state.active) paint();
    }
  }

  async function onFollow(userId) {
    if (!userId || state.busy) return;
    state.busy = true;
    paint();
    try {
      await UyDosh.toggleFollow(userId);
      await refresh();
    } catch (err) {
      console.error('Failed to toggle follow from friends map', err);
      state.error = 'follow';
    } finally {
      state.busy = false;
      if (state.active) paint();
    }
  }

  function onSocket(event, payload) {
    if (!state.active) return;
    const api = liveApi();
    const userId = Number(payload?.userId);
    if (!api || !userId) return;
    if (event === 'remove') {
      state.friends = api.applyFriendLocationEvent(state.friends, { type: 'remove', userId });
      if (state.selectedId === userId) state.selectedId = 0;
    } else if (event === 'upsert') {
      const existing = state.friends.find((friend) => Number(friend.userId) === userId);
      const friend = existing?.self
        ? { ...payload, self: true, mutual: false, avatarUrl: telegramSelfAvatar() || existing.avatarUrl || payload.avatarUrl }
        : {
          ...payload,
          iFollow: payload?.iFollow === true || payload?.mutual === true,
          followsMe: payload?.followsMe !== false,
        };
      state.friends = api.applyFriendLocationEvent(state.friends, { type: 'upsert', friend });
    }
    paint();
  }

  function onSelfLocation(event) {
    if (!state.active || !state.settings.enabled) return;
    const detail = event.detail || {};
    const userId = Number(typeof UyDosh.getSessionUserId === 'function' ? UyDosh.getSessionUserId() : 0);
    const latitude = Number(detail.latitude);
    const longitude = Number(detail.longitude);
    if (!userId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const existing = state.friends.find((friend) => Number(friend.userId) === userId);
    const name = [tgUser?.first_name, tgUser?.last_name].filter(Boolean).join(' ').trim();
    const api = liveApi();
    const friend = {
      userId,
      name: existing?.name || name || null,
      avatarUrl: telegramSelfAvatar() || existing?.avatarUrl || null,
      latitude,
      longitude,
      updatedAt: detail.updatedAt || new Date().toISOString(),
      mutual: false,
      self: true,
    };
    state.friends = api
      ? api.applyFriendLocationEvent(state.friends, { type: 'upsert', friend })
      : state.friends.filter((row) => Number(row.userId) !== userId).concat([friend]);
    paint();
  }

  function onSettingsEvent(event) {
    if (!state.active) return;
    applySettings(event.detail, { permission: event.detail?.permission === true });
    if (!state.settings.enabled) {
      state.friends = state.friends.filter((friend) => friend.self !== true);
    }
    paint();
  }

  function startPoll() {
    if (state.pollTimer) return;
    state.pollTimer = setInterval(() => {
      if (!state.active || document.visibilityState === 'hidden') return;
      const api = liveApi();
      if (api) {
        const fresh = state.friends.filter((friend) => api.isFreshFriendLocation(friend.updatedAt, new Date()));
        if (fresh.length !== state.friends.length) {
          state.friends = fresh;
          paint();
        }
      }
      void refresh();
    }, 12000);
  }

  function stopPoll() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  function activate() {
    const list = listEl();
    if (!list) return;
    state.active = true;
    showPanel();
    if (!list.querySelector('[data-friends-root]')) mount(list);
    if (!state.unsubscribe && typeof UyDosh.onFriendLiveLocation === 'function') {
      state.unsubscribe = UyDosh.onFriendLiveLocation(onSocket);
    }
    document.addEventListener('uydosh:friend-location-settings', onSettingsEvent);
    document.addEventListener('uydosh:friend-location-self', onSelfLocation);
    startPoll();
    void refresh();
  }

  function deactivate() {
    if (!state.active && !state.map) return;
    state.active = false;
    stopPoll();
    if (state.unsubscribe) {
      state.unsubscribe();
      state.unsubscribe = null;
    }
    document.removeEventListener('uydosh:friend-location-settings', onSettingsEvent);
    document.removeEventListener('uydosh:friend-location-self', onSelfLocation);
    destroyMap();
  }

  window.UyDoshFriends = { activate, deactivate };
})();
