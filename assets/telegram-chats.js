UyDosh.initTelegramMiniApp();

const loadingEl = document.getElementById('loading');
const emptyEl = document.getElementById('chats-empty');
const emptyTextEl = document.getElementById('chats-empty-text');
const listEl = document.getElementById('chats-list');

function previewText(conversation, lang) {
  const raw = String(conversation.last_message_content || '');
  if (!raw) return UyDosh.t('account.groupChatPreview', lang);
  if (raw.startsWith('[[uydosh:listing_share]]')) return UyDosh.t('chat.listingCard', lang);
  return raw;
}

function chatRowHtml(conversation) {
  const lang = UyDosh.getLang();
  const isGroup = conversation.conversation_type === 'listing_group';
  const title = UyDosh.escapeHtml(
    isGroup
      ? (conversation.listing_title || UyDosh.t('chat.title', lang))
      : (conversation.other_user_name || UyDosh.t('chat.inboxTitle', lang)),
  );
  const preview = UyDosh.escapeHtml(previewText(conversation, lang));
  const unread = Number(conversation.unread_count) || 0;
  const href = UyDosh.escapeHtml(UyDosh.chatPageUrl(conversation.id, { backTo: UyDosh.MINI_APP_CHATS_PATH }));
  const members = Array.isArray(conversation.members) ? conversation.members : [];
  let avatarInner = '';
  if (isGroup) {
    const img = members.find((m) => m.avatar_url)?.avatar_url;
    avatarInner = img
      ? `<img src="${UyDosh.escapeHtml(img)}" alt="" referrerpolicy="no-referrer" onerror="this.remove();" />`
      : UyDosh.iconChrome('users');
  } else if (conversation.other_user_avatar) {
    avatarInner = `<img src="${UyDosh.escapeHtml(conversation.other_user_avatar)}" alt="" referrerpolicy="no-referrer" onerror="this.remove();" />`;
  } else {
    avatarInner = UyDosh.iconChrome('person');
  }
  return `
    <a class="account-row account-chat-row" href="${href}">
      <div class="account-chat-avatars" aria-hidden="true">${avatarInner}</div>
      <div class="account-row-body">
        <div class="account-row-title">${title}</div>
        <div class="account-row-meta"><span class="account-chat-preview">${preview}</span></div>
      </div>
      ${unread > 0 ? `<span class="account-chat-unread">${unread}</span>` : ''}
    </a>`;
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
}

async function boot() {
  UyDosh.applyI18n();
  document.addEventListener('uydosh:langchange', () => {
    UyDosh.applyI18n();
  });
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
    showList(list.map(chatRowHtml).join(''));
  } catch (err) {
    console.error('Failed to load chats', err);
    showEmpty();
    emptyTextEl.textContent = UyDosh.t('feed.error');
  }
}

boot();
