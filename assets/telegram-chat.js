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
const replyBarEl = document.getElementById('chat-reply-bar');
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
  replyTo: null,
};

const REPLY_TRIGGER_PX = 54;
const REPLY_MAX_PX = 82;
const REPLY_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 17l-5-5 5-5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 12h10.5A5.5 5.5 0 0 1 20 17.5V18" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const REPLY_CLOSE_SVG = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>';

const swipe = {
  row: null,
  inner: null,
  hint: null,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastT: 0,
  offset: 0,
  lock: null,
  pointerId: null,
  armed: false,
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

function messagePreviewText(message) {
  const share = parseListingShare(message?.content);
  const raw = share?.title || share?.intro || String(message?.content || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '…';
  return raw.length > 90 ? `${raw.slice(0, 89)}…` : raw;
}

function quotedMessage(message) {
  const nested = message?.reply_to_message;
  if (nested && nested.id) return nested;
  const id = Number(message?.reply_to_message_id);
  if (!Number.isFinite(id) || id <= 0) return null;
  return state.messages.find((row) => Number(row.id) === id) || null;
}

function quoteHtml(message, mine) {
  const quoted = quotedMessage(message);
  if (!quoted) return '';
  const name = Number(quoted.sender_id) === myUserId()
    ? UyDosh.t('chat.you')
    : (senderName(quoted) || UyDosh.t('chat.you'));
  return `
    <div class="chat-quote">
      <div class="chat-quote-name">${UyDosh.escapeHtml(name)}</div>
      <div class="chat-quote-text">${UyDosh.escapeHtml(messagePreviewText(quoted))}</div>
    </div>
  `;
}

function canSwipeReply(message, mine) {
  if (mine) return false;
  if (message?.is_deleted) return false;
  const type = String(message?.message_type || 'text').toLowerCase();
  return type !== 'system';
}

function renderReplyBar() {
  if (!replyBarEl) return;
  const target = state.replyTo;
  if (!target) {
    replyBarEl.hidden = true;
    replyBarEl.innerHTML = '';
    return;
  }
  const name = senderName(target) || UyDosh.t('chat.you');
  const label = UyDosh.t('chat.replyingTo').replace('{name}', name);
  replyBarEl.hidden = false;
  replyBarEl.innerHTML = `
    <span class="chat-reply-avatar" aria-hidden="true">${senderAvatar(target)}</span>
    <div class="chat-reply-copy">
      <div class="chat-reply-label">${REPLY_ICON_SVG}${UyDosh.escapeHtml(label)}</div>
      <div class="chat-reply-preview">${UyDosh.escapeHtml(messagePreviewText(target))}</div>
    </div>
    <button type="button" class="chat-reply-cancel" data-reply-cancel aria-label="${UyDosh.escapeHtml(UyDosh.t('chat.replyCancel'))}">${REPLY_CLOSE_SVG}</button>
  `;
}

function startReplyToMessage(message) {
  if (!canSwipeReply(message, Number(message?.sender_id) === myUserId())) return;
  state.replyTo = message;
  renderReplyBar();
  UyDosh.haptic?.light?.();
  inputEl?.focus();
}

function clearReplyMode() {
  if (!state.replyTo) return;
  state.replyTo = null;
  renderReplyBar();
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
  const row = `
    <div class="chat-bubble-row${mine ? ' mine' : ''}" data-message-id="${UyDosh.escapeHtml(String(message.id))}">
      <span class="chat-avatar" aria-hidden="true">${senderAvatar(message)}</span>
      <div class="chat-bubble">
        ${!mine && name ? `<div class="chat-sender">${UyDosh.escapeHtml(name)}</div>` : ''}
        ${quoteHtml(message, mine)}
        ${body}
        <span class="chat-time">${UyDosh.escapeHtml(formatTime(message.created_at))}</span>
      </div>
    </div>
  `;
  const swipeWrap = canSwipeReply(message, mine)
    ? `<div class="chat-swipe" data-reply-id="${UyDosh.escapeHtml(String(message.id))}"><span class="chat-swipe-hint">${REPLY_ICON_SVG}</span>${row}</div>`
    : row;
  return `
    ${showDay ? `<div class="chat-day">${UyDosh.escapeHtml(formatDay(message.created_at))}</div>` : ''}
    ${swipeWrap}
  `;
}

function threadScroller() {
  return threadEl;
}

function nearBottom() {
  const scroller = threadScroller();
  if (!scroller) return true;
  const slack = 80;
  return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <= slack;
}

function scrollThreadToBottom() {
  const scroller = threadScroller();
  if (!scroller) return;
  scroller.scrollTop = scroller.scrollHeight;
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
    requestAnimationFrame(() => scrollThreadToBottom());
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
    const payload = await UyDosh.sendConversationMessage(conversationId, content, {
      replyToMessageId: state.replyTo?.id,
    });
    const message = payload?.data || payload;
    if (message?.id) mergeMessages([message]);
    else await loadPage(1);
    if (inputEl) {
      inputEl.value = '';
      resizeInput();
    }
    clearReplyMode();
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
  const scroller = threadScroller();
  if (scroller && scroller.scrollTop > 40) return;
  state.loadingOlder = true;
  const nextPage = state.page + 1;
  const prevHeight = scroller ? scroller.scrollHeight : 0;
  const prevTop = scroller ? scroller.scrollTop : 0;
  try {
    await loadPage(nextPage, { prepend: true });
    state.page = nextPage;
    renderThread({ stick: false });
    if (scroller) {
      const delta = scroller.scrollHeight - prevHeight;
      scroller.scrollTop = prevTop + delta;
    }
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

function swipeResetVisual() {
  if (swipe.inner) swipe.inner.style.transform = '';
  if (swipe.hint) {
    swipe.hint.style.opacity = '0';
    swipe.hint.classList.remove('is-start', 'is-end');
  }
}

function swipeEnd(shouldReply) {
  const row = swipe.row;
  const messageId = Number(row?.getAttribute('data-reply-id'));
  swipeResetVisual();
  swipe.row = null;
  swipe.inner = null;
  swipe.hint = null;
  swipe.lock = null;
  swipe.pointerId = null;
  swipe.offset = 0;
  swipe.armed = false;
  const message = state.messages.find((m) => Number(m.id) === messageId);
  if (message) startReplyToMessage(message);
}

function applySwipeOffset(offset) {
  swipe.offset = Math.max(-REPLY_MAX_PX, Math.min(REPLY_MAX_PX, offset));
  if (swipe.inner) swipe.inner.style.transform = `translateX(${swipe.offset}px)`;
  if (!swipe.hint) return;
  const progress = Math.min(1, Math.abs(swipe.offset) / REPLY_TRIGGER_PX);
  swipe.hint.style.opacity = String(progress);
  swipe.hint.classList.toggle('is-end', swipe.offset < 0);
  swipe.hint.classList.toggle('is-start', swipe.offset > 0);
}

function onThreadPointerDown(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  const row = event.target.closest('.chat-swipe');
  if (!row || !threadEl.contains(row)) return;
  swipe.row = row;
  swipe.inner = row.querySelector('.chat-bubble-row');
  swipe.hint = row.querySelector('.chat-swipe-hint');
  swipe.startX = event.clientX;
  swipe.startY = event.clientY;
  swipe.lastX = event.clientX;
  swipe.lastT = event.timeStamp;
  swipe.offset = 0;
  swipe.armed = false;
  swipe.lock = null;
  swipe.pointerId = event.pointerId;
}

function onThreadPointerMove(event) {
  if (swipe.pointerId !== event.pointerId || !swipe.row) return;
  const dx = event.clientX - swipe.startX;
  const dy = event.clientY - swipe.startY;
  if (!swipe.lock) {
    if (Math.hypot(dx, dy) < 10) return;
    swipe.lock = Math.abs(dx) > Math.abs(dy) * 1.15 ? 'h' : 'v';
    if (swipe.lock === 'h') {
      try { swipe.row.setPointerCapture(event.pointerId); } catch { /* ignore */ }
    }
  }
  if (swipe.lock !== 'h') return;
  event.preventDefault();
  swipe.lastX = event.clientX;
  swipe.lastT = event.timeStamp;
  applySwipeOffset(dx);
  const armed = Math.abs(swipe.offset) >= REPLY_TRIGGER_PX;
  if (armed && !swipe.armed) UyDosh.haptic?.light?.();
  swipe.armed = armed;
}

function onThreadPointerUp(event) {
  if (swipe.pointerId !== event.pointerId || !swipe.row) return;
  const dt = Math.max(16, event.timeStamp - swipe.lastT);
  const velocity = (event.clientX - swipe.lastX) / dt * 1000;
  const shouldReply = swipe.lock === 'h'
    && (Math.abs(swipe.offset) >= REPLY_TRIGGER_PX || Math.abs(velocity) >= 650);
  swipeEnd(shouldReply);
}

threadEl?.addEventListener('pointerdown', onThreadPointerDown);
threadEl?.addEventListener('pointermove', onThreadPointerMove, { passive: false });
threadEl?.addEventListener('pointerup', onThreadPointerUp);
threadEl?.addEventListener('pointercancel', () => swipeEnd(false));

composerEl?.addEventListener('submit', handleSend);
composerEl?.addEventListener('click', (event) => {
  if (event.target.closest('[data-reply-cancel]')) {
    event.preventDefault();
    clearReplyMode();
  }
});
inputEl?.addEventListener('input', resizeInput);
inputEl?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    composerEl?.requestSubmit();
  }
});
threadEl?.addEventListener('scroll', () => {
  maybeLoadOlder();
}, { passive: true });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) poll();
});
document.addEventListener('uydosh:langchange', () => {
  UyDosh.applyI18n();
  updateHeader(state.conversation, state.members);
  renderReplyBar();
  renderThread();
});

boot();
