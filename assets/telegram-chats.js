UyDosh.initTelegramMiniApp();

const loadingEl = document.getElementById('loading');
const emptyEl = document.getElementById('chats-empty');
const emptyTextEl = document.getElementById('chats-empty-text');
const listEl = document.getElementById('chats-list');

const CLOCK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8"></circle><path d="M12 8v5l3 2"></path></svg>';

function previewText(conversation, lang) {
  const raw = String(conversation.last_message_content || '');
  if (!raw) return UyDosh.t('account.groupChatPreview', lang);
  if (raw.startsWith('[[uydosh:listing_share]]')) return UyDosh.t('chat.listingCard', lang);
  return raw;
}

function conversationAt(conversation) {
  const raw = conversation.last_message_at || conversation.updated_at || conversation.created_at;
  const t = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

function dayKey(ms) {
  const d = new Date(ms || Date.now());
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDayLabel(ms, lang) {
  const locale = lang === 'en' ? 'en-US' : lang === 'uz' ? 'uz-UZ' : 'ru-RU';
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ms || Date.now()));
}

function formatTime(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function stationsCountText(n, lang) {
  if (lang === 'ru') return `${n} станций`;
  if (lang === 'uz') return `${n} stansiya`;
  return n === 1 ? '1 station' : `${n} stations`;
}

function listingIdOf(conversation) {
  const id = Number(conversation?.listing_id ?? conversation?.listing?.id);
  return Number.isFinite(id) && id > 0 ? id : 0;
}

function isListingBacked(conversation) {
  return listingIdOf(conversation) > 0
    || conversation.conversation_type === 'listing_group'
    || conversation.context_type === 'listing';
}

function typeClass(conversation) {
  const typeId = Number(conversation.listing_type_id);
  if (typeId === 3) return 'inbox-type-group';
  if (typeId === 2) return 'inbox-type-seek';
  return 'inbox-type-housing';
}

function typeIcon(conversation) {
  const typeId = Number(conversation.listing_type_id);
  if (typeId === 3 || typeId === 2) return UyDosh.iconChrome('users');
  return UyDosh.iconChrome('house');
}

function metroLabel(conversation, lang) {
  const search = Array.isArray(conversation.search_subway_stations)
    ? conversation.search_subway_stations
    : [];
  if (search.length > 1) return stationsCountText(search.length, lang);
  const st = search[0] || {
    name_uz: conversation.subway_station_name_uz,
    name_ru: conversation.subway_station_name_ru,
    name_en: conversation.subway_station_name_en,
  };
  return UyDosh.localized(st, lang) || '';
}

function districtLabel(conversation, lang) {
  return UyDosh.localized({
    name_uz: conversation.location_name_uz,
    name_ru: conversation.location_name_ru,
    name_en: conversation.location_name_en,
    short_name_uz: conversation.location_short_name_uz,
    short_name_ru: conversation.location_short_name_ru,
    short_name_en: conversation.location_short_name_en,
  }, lang) || '';
}

function priceLabel(conversation, lang) {
  return UyDosh.formatPrice({ price: conversation.listing_price }, lang);
}

function memberAvatarsHtml(conversations) {
  const seen = new Set();
  const urls = [];
  for (const c of conversations) {
    const members = Array.isArray(c.members) ? c.members : [];
    for (const member of members) {
      const url = member?.avatar_url;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
      if (urls.length >= 3) break;
    }
    if (urls.length >= 3) break;
    if (!urls.length && c.other_user_avatar && !seen.has(c.other_user_avatar)) {
      seen.add(c.other_user_avatar);
      urls.push(c.other_user_avatar);
    }
  }
  if (!urls.length) return '';
  return urls.map((url) => (
    `<img src="${UyDosh.escapeHtml(url)}" alt="" referrerpolicy="no-referrer" onerror="this.remove();" />`
  )).join('');
}

function chatAvatarHtml(conversation, isGroup) {
  if (isGroup) {
    const img = (Array.isArray(conversation.members) ? conversation.members : [])
      .find((m) => m.avatar_url)?.avatar_url;
    if (img) {
      return `<img src="${UyDosh.escapeHtml(img)}" alt="" referrerpolicy="no-referrer" onerror="this.remove();" />`;
    }
    return UyDosh.iconChrome('users');
  }
  if (conversation.other_user_avatar) {
    return `<img src="${UyDosh.escapeHtml(conversation.other_user_avatar)}" alt="" referrerpolicy="no-referrer" onerror="this.remove();" />`;
  }
  return UyDosh.iconChrome('person');
}

function nestedChatHtml(conversation, lang) {
  const preview = UyDosh.escapeHtml(previewText(conversation, lang));
  const unread = Number(conversation.unread_count) || 0;
  const href = UyDosh.escapeHtml(UyDosh.chatPageUrl(conversation.id, { backTo: UyDosh.MINI_APP_CHATS_PATH }));
  const isGroup = conversation.conversation_type === 'listing_group';
  const when = formatTime(conversationAt(conversation));
  return `
    <a class="inbox-chat" href="${href}">
      <div class="inbox-chat-avatar" aria-hidden="true">${chatAvatarHtml(conversation, isGroup)}</div>
      <div class="inbox-chat-body">
        <div class="inbox-chat-preview">${preview}</div>
        ${when ? `<div class="inbox-chat-time">${CLOCK_ICON}<span>${when}</span></div>` : ''}
      </div>
      ${unread > 0 ? `<span class="inbox-unread">${unread}</span>` : ''}
      <span class="inbox-chat-go" aria-hidden="true">${UyDosh.iconChrome('chevronRight')}</span>
    </a>`;
}

function listingCardHtml(group, lang) {
  const sample = group.conversations[0];
  const title = UyDosh.escapeHtml(sample.listing_title || UyDosh.t('chat.title', lang));
  const metro = UyDosh.escapeHtml(metroLabel(sample, lang));
  const district = UyDosh.escapeHtml(districtLabel(sample, lang));
  const price = priceLabel(sample, lang);
  const expanded = group.conversations.length === 1;
  const avatars = memberAvatarsHtml(group.conversations);
  const metroLine = Number(sample.subway_station_line || sample.listing_subway_line_id) || null;
  return `
    <article class="inbox-card" data-expanded="${expanded ? 'true' : 'false'}">
      <button type="button" class="inbox-card-head" data-inbox-toggle aria-expanded="${expanded ? 'true' : 'false'}">
        <div class="inbox-card-top">
          <span class="inbox-type ${typeClass(sample)}" aria-hidden="true">${typeIcon(sample)}</span>
          <span class="inbox-card-title">${title}</span>
          ${avatars ? `<span class="inbox-avatars" aria-hidden="true">${avatars}</span>` : ''}
        </div>
        ${metro ? `<div class="inbox-meta-row">${UyDosh.iconMetro(metroLine)}<span>${metro}</span></div>` : ''}
        ${district ? `<div class="inbox-meta-row">${UyDosh.iconPin()}<span>${district}</span></div>` : ''}
        <div class="inbox-price-row">
          ${price ? `<span>${UyDosh.escapeHtml(price)}</span>` : ''}
          <span class="inbox-toggle" aria-hidden="true">
            <span class="inbox-chevron-up">${UyDosh.iconChrome('chevronUp')}</span>
            <span class="inbox-chevron-down">${UyDosh.iconChrome('chevronDown')}</span>
          </span>
        </div>
      </button>
      <div class="inbox-chats">
        <div class="inbox-you">${UyDosh.escapeHtml(UyDosh.t('chat.you', lang))}</div>
        ${group.conversations.map((c) => nestedChatHtml(c, lang)).join('')}
      </div>
    </article>`;
}

function directCardHtml(conversation, lang) {
  const title = UyDosh.escapeHtml(conversation.other_user_name || UyDosh.t('chat.inboxTitle', lang));
  const preview = UyDosh.escapeHtml(previewText(conversation, lang));
  const unread = Number(conversation.unread_count) || 0;
  const href = UyDosh.escapeHtml(UyDosh.chatPageUrl(conversation.id, { backTo: UyDosh.MINI_APP_CHATS_PATH }));
  return `
    <article class="inbox-card">
      <a class="inbox-direct" href="${href}">
        <div class="inbox-chat-avatar" aria-hidden="true">${chatAvatarHtml(conversation, false)}</div>
        <div class="inbox-direct-body">
          <div class="inbox-direct-title">${title}</div>
          <div class="inbox-direct-preview">${preview}</div>
        </div>
        ${unread > 0 ? `<span class="inbox-unread">${unread}</span>` : ''}
      </a>
    </article>`;
}

function buildTiles(conversations) {
  const groups = new Map();
  const tiles = [];
  conversations.forEach((conversation, index) => {
    if (!isListingBacked(conversation)) {
      tiles.push({
        kind: 'direct',
        at: conversationAt(conversation),
        conversation,
      });
      return;
    }
    const key = listingIdOf(conversation) || `g-${conversation.id || index}`;
    const existing = groups.get(key);
    if (existing) {
      existing.conversations.push(conversation);
      existing.at = Math.max(existing.at, conversationAt(conversation));
      return;
    }
    const group = {
      kind: 'listing',
      at: conversationAt(conversation),
      conversations: [conversation],
    };
    groups.set(key, group);
    tiles.push(group);
  });
  for (const group of groups.values()) {
    group.conversations.sort((a, b) => conversationAt(b) - conversationAt(a));
  }
  tiles.sort((a, b) => b.at - a.at);
  return tiles;
}

function inboxHtml(conversations, lang) {
  const tiles = buildTiles(conversations);
  const parts = [];
  let lastDay = '';
  for (const tile of tiles) {
    const day = dayKey(tile.at);
    if (day !== lastDay) {
      lastDay = day;
      parts.push(`<div class="inbox-day"><span>${UyDosh.escapeHtml(formatDayLabel(tile.at, lang))}</span></div>`);
    }
    parts.push(tile.kind === 'listing' ? listingCardHtml(tile, lang) : directCardHtml(tile.conversation, lang));
  }
  return parts.join('');
}

function showEmpty() {
  loadingEl.hidden = true;
  listEl.hidden = true;
  emptyEl.hidden = false;
  emptyTextEl.textContent = UyDosh.t('chat.inboxEmpty');
}

function showList(html) {
  loadingEl.hidden = true;
  emptyEl.hidden = true;
  listEl.hidden = false;
  listEl.innerHTML = html;
  if (typeof UyDosh.hydrateIcons === 'function') UyDosh.hydrateIcons(listEl);
}

function bindToggles() {
  listEl.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-inbox-toggle]');
    if (!btn || !listEl.contains(btn)) return;
    const card = btn.closest('.inbox-card');
    if (!card) return;
    const open = card.getAttribute('data-expanded') !== 'true';
    card.setAttribute('data-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}

async function boot() {
  UyDosh.applyI18n();
  document.addEventListener('uydosh:langchange', () => {
    UyDosh.applyI18n();
  });
  bindToggles();
  const sessionReady = await UyDosh.ensureTelegramMiniAppSession();
  if (!sessionReady) {
    showEmpty();
    emptyTextEl.textContent = UyDosh.t('create.errorAuth');
    return;
  }
  try {
    const data = await UyDosh.fetchUserConversations({ page: 1, limit: 50 });
    const list = data?.data?.conversations || data?.conversations || [];
    if (!Array.isArray(list) || !list.length) {
      showEmpty();
      return;
    }
    showList(inboxHtml(list, UyDosh.getLang()));
  } catch (err) {
    console.error('Failed to load chats', err);
    showEmpty();
    emptyTextEl.textContent = UyDosh.t('feed.error');
  }
}

boot();
