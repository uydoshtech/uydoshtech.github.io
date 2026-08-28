UyDosh.initTelegramMiniApp();
document.body.classList.add('chat-page');

if (UyDosh.isMiniApp()) {
  const webApp = window.Telegram?.WebApp;
  webApp?.BackButton?.show();
  webApp?.BackButton?.onClick(() => {
    UyDosh.haptic.light();
    location.href = UyDosh.miniAppBackTargetFromUrl() || UyDosh.MINI_APP_GROUPS_PATH;
  });
}

const LISTING_SHARE_PREFIX = '[[uydosh:listing_share]]';
const POLL_MS = 4000;

const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('chat-error');
const threadEl = document.getElementById('chat-thread');
const peerHeaderEl = document.querySelector('[data-chat-peer-header]');
const composerEl = document.getElementById('chat-composer');
const inputEl = document.getElementById('chat-input');
const sendBtn = composerEl?.querySelector('.chat-send');

const conversationId = Number(new URLSearchParams(location.search).get('id'));

const state = {
  messages: [],
  page: 1,
  totalPages: 1,
  loadingOlder: false,
  sending: false,
  pollTimer: null,
  membersById: new Map(),
  members: [],
  conversation: null,
};

function myUserId() {
  return Number(UyDosh.getSessionUserId()) || 0;
}

function showError(message) {
  loadingEl.hidden = true;
  threadEl.hidden = true;
  composerEl.hidden = true;
  errorEl.hidden = false;
  errorEl.textContent = message;
}

function parseListingShare(content) {
  const raw = String(content || '');
  if (!raw.startsWith(LISTING_SHARE_PREFIX)) return null;
  try {
    const parsed = JSON.parse(raw.slice(LISTING_SHARE_PREFIX.length).trim());
    const listingId = Number(parsed?.listing_id);
    const title = typeof parsed?.title === 'string' ? parsed.title.trim() : '';
    if (!Number.isFinite(listingId) || listingId <= 0 || !title) return null;
    return {
      listing_id: listingId,
      title,
      location: parsed.location || '',
      metro: parsed.metro || '',
      price_label: parsed.price_label || '',
      intro: parsed.intro || '',
    };
  } catch {
    return null;
  }
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const lang = UyDosh.getLang();
  const locale = lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-GB' : 'uz-UZ';
  return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

function dayKey(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDay(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const lang = UyDosh.getLang();
  const locale = lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-GB' : 'uz-UZ';
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
}

function senderName(message) {
  const profile = message?.sender?.profile;
  if (profile?.name) return profile.name;
  const member = state.membersById.get(Number(message?.sender_id));
  return member?.name || '';
}

function senderAvatar(message) {
  const profile = message?.sender?.profile;
  const member = state.membersById.get(Number(message?.sender_id));
  const isMine = Number(message?.sender_id) === myUserId();
  const url = profile?.avatar_url
    || profile?.telegram_avatar_url
    || member?.avatar_url
    || (isMine && (window.Telegram?.WebApp?.initDataUnsafe?.user?.photo_url || ''))
    || '';
  if (url) {
    return `<img src="${UyDosh.escapeHtml(url)}" alt="" referrerpolicy="no-referrer" onerror="this.remove();" />`;
  }
  return UyDosh.iconChrome?.('person') || '';
}

function listingCardHtml(share) {
  const href = UyDosh.escapeHtml(UyDosh.listingPageUrl(share.listing_id, {
    backTo: location.pathname + location.search,
  }));
  const meta = [share.price_label, share.location || share.metro].filter(Boolean).join(' · ');
  return `
    <a class="chat-listing-card" href="${href}">
      <div class="chat-listing-card-kicker">${UyDosh.escapeHtml(UyDosh.t('chat.listingCard'))}</div>
      <div class="chat-listing-card-title">${UyDosh.escapeHtml(share.title)}</div>
      ${meta ? `<div class="chat-listing-card-meta">${UyDosh.escapeHtml(meta)}</div>` : ''}
    </a>
  `;
}

function messageHtml(message, { showDay }) {
  const type = message.message_type || 'text';
  const mine = Number(message.sender_id) === myUserId();
  const share = parseListingShare(message.content);
  if (type === 'system') {
    return `
      ${showDay ? `<div class="chat-day">${UyDosh.escapeHtml(formatDay(message.created_at))}</div>` : ''}
      <div class="chat-bubble-row system">
        <div class="chat-bubble"><div class="chat-text">${UyDosh.escapeHtml(message.content || '')}</div></div>
      </div>
    `;
  }
  const name = senderName(message);
  const body = share
    ? `${share.intro ? `<div class="chat-text">${UyDosh.escapeHtml(share.intro)}</div>` : ''}${listingCardHtml(share)}`
    : `<div class="chat-text">${UyDosh.escapeHtml(message.content || '')}</div>`;
  return `
    ${showDay ? `<div class="chat-day">${UyDosh.escapeHtml(formatDay(message.created_at))}</div>` : ''}
    <div class="chat-bubble-row${mine ? ' mine' : ''}" data-message-id="${UyDosh.escapeHtml(String(message.id))}">
      <span class="chat-avatar" aria-hidden="true">${senderAvatar(message)}</span>
      <div class="chat-bubble">
        ${!mine && name ? `<div class="chat-sender">${UyDosh.escapeHtml(name)}</div>` : ''}
        ${body}
        <span class="chat-time">${UyDosh.escapeHtml(formatTime(message.created_at))}</span>
      </div>
    </div>
  `;
}

function nearBottom() {
  const slack = 80;
  return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - slack;
}

function renderThread({ stick } = {}) {
  const shouldStick = stick || nearBottom();
  const rows = [];
  let lastDay = '';
  for (const message of state.messages) {
    const day = dayKey(message.created_at);
    rows.push(messageHtml(message, { showDay: day && day !== lastDay }));
    lastDay = day;
  }
  if (!rows.length) {
    threadEl.innerHTML = `<p class="chat-empty">${UyDosh.escapeHtml(UyDosh.t('chat.empty'))}</p>`;
  } else {
    threadEl.innerHTML = rows.join('');
  }
  threadEl.hidden = false;
  if (shouldStick) {
    requestAnimationFrame(() => window.scrollTo(0, document.documentElement.scrollHeight));
  }
}

function mergeMessages(incoming, { prepend = false } = {}) {
  const byId = new Map(state.messages.map((m) => [m.id, m]));
  for (const message of incoming) {
    if (message?.id != null) byId.set(message.id, message);
  }
  const next = Array.from(byId.values()).sort((a, b) => Number(a.id) - Number(b.id));
  const grew = next.length > state.messages.length
    || (next.at(-1)?.id !== state.messages.at(-1)?.id);
  state.messages = next;
  return grew || prepend;
}

function unwrapMessages(payload) {
  const data = payload?.data || payload;
  const list = data?.messages || data;
  return {
    messages: Array.isArray(list) ? list : [],
    page: Number(data?.page) || 1,
    totalPages: Number(data?.totalPages) || 1,
  };
}

function headerPeople(conversation, members) {
  const rows = Array.isArray(members) ? members.filter((m) => m && (m.name || m.avatar_url)) : [];
  if (rows.length) return rows;
  const name = conversation?.other_user_name || '';
  const avatar = conversation?.other_user_avatar || '';
  if (name || avatar) return [{ name, avatar_url: avatar }];
  return [];
}

function headerAvatarHtml(person, index) {
  const url = person?.avatar_url || '';
  const inner = url
    ? `<img src="${UyDosh.escapeHtml(url)}" alt="" referrerpolicy="no-referrer" onerror="this.remove();" />`
    : (UyDosh.iconChrome?.('person') || '');
  return `<span class="chat-peer-avatar" style="z-index:${index + 1}">${inner}</span>`;
}

function updateHeader(conversation, members) {
  if (!peerHeaderEl) return;
  const people = headerPeople(conversation, members);
  const names = people.map((p) => String(p.name || '').trim()).filter(Boolean).join(', ')
    || UyDosh.t('chat.title');
  const subtitle = conversation?.listing?.title
    || conversation?.listing_title
    || '';
  const avatars = people.slice(0, 3).map((person, index) => headerAvatarHtml(person, index)).join('');
  peerHeaderEl.hidden = false;
  peerHeaderEl.innerHTML = `
    <div class="chat-peer-avatars" aria-hidden="true">${avatars}</div>
    <div class="chat-peer-text">
      <div class="chat-peer-names">${UyDosh.escapeHtml(names)}</div>
      ${subtitle ? `<div class="chat-peer-sub">${UyDosh.escapeHtml(subtitle)}</div>` : ''}
    </div>
  `;
}

async function loadPage(page, { prepend = false } = {}) {
  const payload = await UyDosh.fetchConversationMessages(conversationId, { page, limit: 50 });
  const { messages, totalPages } = unwrapMessages(payload);
  state.totalPages = totalPages;
  const changed = mergeMessages(messages, { prepend });
  return changed;
}

async function poll() {
  if (document.hidden || state.sending) return;
  try {
    const changed = await loadPage(1);
    if (changed) renderThread();
    UyDosh.markConversationRead(conversationId).catch(() => {});
  } catch {
    /* keep the open thread; next poll retries */
  }
}

function resizeInput() {
  if (!inputEl) return;
  inputEl.style.height = 'auto';
  inputEl.style.height = `${Math.min(inputEl.scrollHeight, 120)}px`;
}

async function handleSend(event) {
  event.preventDefault();
  const content = String(inputEl?.value || '').trim();
  if (!content || state.sending) return;
  state.sending = true;
  errorEl.hidden = true;
  if (sendBtn) sendBtn.disabled = true;
  try {
    const payload = await UyDosh.sendConversationMessage(conversationId, content);
    const message = payload?.data || payload;
    if (message?.id) mergeMessages([message]);
    else await loadPage(1);
    if (inputEl) {
      inputEl.value = '';
      resizeInput();
    }
    renderThread({ stick: true });
    UyDosh.haptic?.success?.();
  } catch (err) {
    console.error('Failed to send chat message', err);
    errorEl.hidden = false;
    errorEl.textContent = UyDosh.t('chat.sendError');
    setTimeout(() => { errorEl.hidden = true; }, 2500);
  } finally {
    state.sending = false;
    if (sendBtn) sendBtn.disabled = false;
    inputEl?.focus();
  }
}

async function maybeLoadOlder() {
  if (state.loadingOlder || state.page >= state.totalPages) return;
  if (window.scrollY > 40) return;
  state.loadingOlder = true;
  const nextPage = state.page + 1;
  const prevHeight = document.documentElement.scrollHeight;
  try {
    await loadPage(nextPage, { prepend: true });
    state.page = nextPage;
    renderThread({ stick: false });
    const delta = document.documentElement.scrollHeight - prevHeight;
    window.scrollTo(0, window.scrollY + delta);
  } catch (err) {
    console.error('Failed to load older chat messages', err);
  } finally {
    state.loadingOlder = false;
  }
}

async function boot() {
  UyDosh.applyI18n();
  if (!Number.isFinite(conversationId) || conversationId <= 0) {
    showError(UyDosh.t('chat.error'));
    return;
  }
  const sessionReady = await UyDosh.ensureTelegramMiniAppSession();
  if (!sessionReady) {
    showError(UyDosh.t('create.errorAuth'));
    return;
  }
  try {
    const [conversationPayload, membersPayload] = await Promise.all([
      UyDosh.fetchConversation(conversationId),
      UyDosh.fetchConversationMembers(conversationId).catch(() => ({ data: [] })),
    ]);
    state.conversation = conversationPayload?.data || conversationPayload;
    const members = membersPayload?.data || membersPayload || [];
    state.members = Array.isArray(members) ? members : [];
    for (const member of state.members) {
      state.membersById.set(Number(member.user_id), member);
    }
    updateHeader(state.conversation, state.members);
    await loadPage(1);
    loadingEl.hidden = true;
    composerEl.hidden = false;
    renderThread({ stick: true });
    UyDosh.markConversationRead(conversationId).catch(() => {});
    state.pollTimer = setInterval(poll, POLL_MS);
  } catch (err) {
    console.error('Failed to open group chat', err);
    const denied = err?.status === 403;
    showError(UyDosh.t(denied ? 'chat.accessDenied' : 'chat.error'));
  }
}

composerEl?.addEventListener('submit', handleSend);
inputEl?.addEventListener('input', resizeInput);
inputEl?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    composerEl?.requestSubmit();
  }
});
window.addEventListener('scroll', () => {
  maybeLoadOlder();
}, { passive: true });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) poll();
});
document.addEventListener('uydosh:langchange', () => {
  UyDosh.applyI18n();
  updateHeader(state.conversation, state.members);
  renderThread();
});

boot();
