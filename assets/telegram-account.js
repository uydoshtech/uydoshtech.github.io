UyDosh.initTelegramMiniApp();

// The participants sheet in this file is also opened from the group chat
// header. Account boot and the BackButton handler must stay on the account
// page, otherwise they replace the chat's own back navigation.
const isAccountPage = Boolean(document.getElementById('account-list'));

// Reached from the account menu on any page — the header's BackButton
// defaults to hidden (see `initTelegramMiniApp`), so show it here and send
// the user back to wherever a `?back=` deep link points, falling back to
// the feed (same pattern as listing.html).
if (isAccountPage && UyDosh.isMiniApp()) {
  const webApp = window.Telegram?.WebApp;
  const hasBack = Boolean(new URLSearchParams(location.search).get('back'));
  if (hasBack) {
    webApp?.BackButton?.show();
    webApp?.BackButton?.onClick(() => {
      UyDosh.haptic.light();
      location.href = UyDosh.miniAppBackTargetFromUrl();
    });
  } else {
    webApp?.BackButton?.hide();
  }
}

const loadingEl = document.getElementById('loading');
const emptyEl = document.getElementById('account-empty');
const emptyTextEl = document.getElementById('account-empty-text');
const emptyCtaEl = document.getElementById('account-empty-cta');
const listEl = document.getElementById('account-list');
const tabButtons = Array.from(document.querySelectorAll('[data-account-tab]'));

const TAB_MINE = 'mine';
const TAB_GROUPS = 'groups';
const TAB_FAVORITES = 'favorites';
const TAB_FOLLOWS = 'follows';
const TAB_FRIENDS = 'friends';
const FOLLOWS_PAGE_SIZE = 50;

function listingLooksGroupForming(listing) {
  const typeId = Number(listing?.listing_type_id ?? listing?.listing_type?.id);
  const code = listing?.listing_type?.code;
  return typeId === 3 || code === 'group_forming';
}

/** Deep-links from the header menu land here with `?tab=favorites` or `?tab=groups`. */
function initialTabFromUrl() {
  try {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab === TAB_FAVORITES) return TAB_FAVORITES;
    if (tab === TAB_FOLLOWS) return TAB_FOLLOWS;
    if (tab === TAB_FRIENDS) return TAB_FRIENDS;
    if (tab === TAB_MINE) return TAB_MINE;
    return TAB_GROUPS;
  } catch {
    return TAB_GROUPS;
  }
}

const state = {
  activeTab: initialTabFromUrl(),
  authError: false,
  myListings: [],
  myListingsError: false,
  favorites: [],
  favoritesError: false,
  // No usable session for the Bearer-token-based favorites API (distinct from
  // `authError`, which means there's no Telegram identity at all).
  favoritesUnavailable: false,
  groupChats: [],
  groupChatsError: false,
  // Group listings the viewer belongs to but does not own. Loaded from the
  // public listing so a member sees the same card as the creator.
  memberGroupListings: [],
  // False until GET /listings/group-forming/membership-limit says the user is
  // under group_forming_max_active_memberships. Owners count as participants.
  canCreateGroup: false,
  followsSegment: 'following',
  following: [],
  followers: [],
  discover: [],
  discoverTotal: 0,
  discoverPage: 0,
  discoverPages: 0,
  discoverQuery: '',
  discoverLoaded: false,
  followingTotal: 0,
  followersTotal: 0,
  followingPage: 0,
  followersPage: 0,
  followingPages: 0,
  followersPages: 0,
  followsError: false,
  followsUnavailable: false,
  followsLoaded: false,
  followsLoading: false,
  followToggleId: 0,
  followNote: '',
};

function statusBadgeHtml(listing, lang) {
  if (listing.moderation_status === 'pending_review') {
    return `<span class="account-status account-status-pending">${UyDosh.escapeHtml(UyDosh.t('account.statusPending', lang))}</span>`;
  }
  if (!listing.is_active) {
    return `<span class="account-status account-status-inactive">${UyDosh.escapeHtml(UyDosh.t('account.statusInactive', lang))}</span>`;
  }
  return '';
}

/** Amenity icons row shown under the listing thumbnail photo. */
function amenitiesRowHtml(listing, lang) {
  const icons = UyDosh.amenityIconsRowHtml(listing.amenities, lang, { showAll: true });
  return icons ? `<div class="account-row-amenities">${icons}</div>` : '';
}

function accountThumbHtml(listing) {
  const photo = UyDosh.primaryPhoto(listing);
  const photoSrc = photo ? UyDosh.photoUrl(photo) : '';
  const placeholderSrc = !photoSrc ? UyDosh.noPhotoPlaceholderImageUrl(listing) : '';
  if (photoSrc) {
    return `<div class="account-thumb"><img loading="lazy" decoding="async" src="${UyDosh.escapeHtml(photoSrc)}" alt="" onerror="this.parentElement.classList.add('empty'); this.remove();" /></div>`;
  }
  if (placeholderSrc) {
    return `<div class="account-thumb"><img loading="lazy" decoding="async" src="${UyDosh.escapeHtml(placeholderSrc)}" alt="" /></div>`;
  }
  return `<div class="account-thumb empty"></div>`;
}

/** Days remaining until `nextRenewalAtIso` (ISO string) is reached; 0 or less means renewal is available now. */
function daysUntil(nextRenewalAtIso) {
  if (!nextRenewalAtIso) return 0;
  const diffMs = new Date(nextRenewalAtIso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

function renewLabelHtml(listing, lang) {
  const days = daysUntil(listing.next_renewal_at);
  if (days <= 0) return UyDosh.escapeHtml(UyDosh.t('account.renew', lang));
  const key = days === 1 ? 'account.renewInOneDay' : 'account.renewInDays';
  return UyDosh.escapeHtml(UyDosh.t(key, lang).replace('{days}', String(days)));
}

function listingRowMainHtml(listing, { hidePhoto = false, ownerActions = true, phasePill = false } = {}) {
  const lang = UyDosh.getLang();
  const title = UyDosh.escapeHtml(listing.title || '');
  const price = UyDosh.formatPrice(listing, lang);
  const editHref = `/telegram/create.html?id=${encodeURIComponent(listing.id)}`;
  const groupsTab = state.activeTab === TAB_GROUPS;
  const backTo = groupsTab ? UyDosh.MINI_APP_GROUPS_PATH : UyDosh.MINI_APP_ACCOUNT_PATH;
  const detailHref = UyDosh.escapeHtml(UyDosh.listingPageUrl(listing.id, {
    backTo,
    group: groupsTab && ownerActions ? 'requests' : undefined,
  }));
  const visibilityLabelKey = listing.is_active ? 'account.deactivate' : 'account.activate';
  const visibilityLabel = UyDosh.t(visibilityLabelKey, lang);
  const visibilityIcon = listing.is_active ? UyDosh.iconEye() : UyDosh.iconEyeOff();
  const canRenew = daysUntil(listing.next_renewal_at) <= 0;
  const renewFull = renewLabelHtml(listing, lang);
  const photoBlock = hidePhoto ? '' : `
          <a class="account-row-link" href="${detailHref}">
            <div class="account-thumb-col">
              ${accountThumbHtml(listing)}
            </div>
          </a>`;
  const metaStrip = `
        <div class="account-row-strip">
          ${amenitiesRowHtml(listing, lang)}
        </div>`;
  return `
      <div class="account-row-stack">
        <a class="account-row-head${phasePill ? ' account-row-head--phase' : ''}" href="${detailHref}">
          <div class="account-row-title-block">
            ${phasePill ? groupPhasePillHtml(listing, lang) : ''}
            <div class="account-row-title">${title}</div>
          </div>
          <div class="account-row-meta">
            ${price ? `<span class="account-row-price">${price}<small>${UyDosh.escapeHtml(UyDosh.t('card.perMonth', lang))}</small></span>` : ''}
            ${statusBadgeHtml(listing, lang)}
          </div>
        </a>
        ${photoBlock}
        ${metaStrip}
        ${ownerActions ? `<div class="account-row-actions">
          <a class="account-edit-btn" href="${editHref}" title="${UyDosh.escapeHtml(UyDosh.t('account.edit', lang))}" aria-label="${UyDosh.escapeHtml(UyDosh.t('account.edit', lang))}">${UyDosh.iconPencil()}</a>
          <button
            type="button"
            class="account-visibility-btn"
            data-toggle-visibility="${listing.id}"
            aria-pressed="${listing.is_active ? 'true' : 'false'}"
            title="${UyDosh.escapeHtml(visibilityLabel)}"
            aria-label="${UyDosh.escapeHtml(visibilityLabel)}"
          >${visibilityIcon}</button>
          <button
            type="button"
            class="account-renew-btn"
            data-renew-listing="${listing.id}"
            title="${renewFull}"
            aria-label="${renewFull}"
            ${canRenew ? '' : 'disabled'}
          >${UyDosh.iconArrowUp()}</button>
          <button
            type="button"
            class="account-delete-btn"
            data-delete-listing="${listing.id}"
            data-haptic="heavy"
            title="${UyDosh.escapeHtml(UyDosh.t('account.delete', lang))}"
            aria-label="${UyDosh.escapeHtml(UyDosh.t('account.delete', lang))}"
          >${UyDosh.iconTrash()}</button>
        </div>` : ''}
      </div>`;
}

function listingRowHtml(listing) {
  return `
    <div class="account-row account-row-listing" data-listing-row="${listing.id}">
      ${listingRowMainHtml(listing)}
    </div>`;
}

function groupListingCardHtml(listing, conversation, { owner = true } = {}) {
  const chat = conversation ? groupChatRowHtml(conversation, { nested: true }) : '';
  const detailHref = UyDosh.escapeHtml(UyDosh.listingPageUrl(listing.id, {
    backTo: UyDosh.MINI_APP_GROUPS_PATH,
    group: owner ? 'requests' : undefined,
  }));
  return `
    <article class="account-card account-card--group" data-listing-row="${listing.id}" data-group-detail-href="${detailHref}">
      <div class="account-row-main">
        ${listingRowMainHtml(listing, { hidePhoto: true, ownerActions: owner, phasePill: true })}
        ${participantsPillHtml(listing, conversation)}
        ${housingOptionsRowHtml(listing)}
      </div>
      ${chat}
    </article>`;
}

function participantsFromConversation(conversation) {
  const members = Array.isArray(conversation?.members) ? conversation.members : [];
  return members.filter((m) => m && (m.name || m.avatar_url || m.user_id));
}

function participantAvatarHtml(person, index) {
  const url = person?.avatar_url || '';
  const initial = Array.from(String(person?.name || '').trim())[0] || '';
  const letter = UyDosh.escapeHtml(initial.toUpperCase());
  const inner = url
    ? `<img src="${UyDosh.escapeHtml(url)}" alt="" referrerpolicy="no-referrer" onerror="this.remove();" />`
    : (letter || UyDosh.iconChrome?.('person') || '');
  return `<span class="account-participants-avatar" style="z-index:${index + 1}" aria-hidden="true">${inner}</span>`;
}

function peopleForAvatarStack(listing, members) {
  const fromMembers = Array.isArray(members) ? members : [];
  const chat = listing ? chatForListing(listing, state.groupChats || []) : null;
  const fromChat = participantsFromConversation(chat);
  // A passed roster is the live membership. The chat cache can still list
  // someone who was just removed, and merging it back made the header
  // keep their name, face, and "group of N" count.
  const liveIds = new Set(
    fromMembers.map((person) => Number(person.user_id ?? person.id)).filter((id) => id > 0),
  );
  const chatPeople = Array.isArray(members)
    ? fromChat.filter((person) => liveIds.has(Number(person.user_id ?? person.id)))
    : fromChat;
  const byKey = new Map();
  for (const person of [...chatPeople, ...fromMembers]) {
    const id = Number(person.user_id ?? person.id);
    const key = id > 0 ? `id:${id}` : `name:${String(person.name || '').trim()}`;
    if (key === 'name:') continue;
    const prev = byKey.get(key) || {};
    byKey.set(key, {
      ...prev,
      ...person,
      user_id: id > 0 ? id : prev.user_id,
      name: person.name || prev.name,
      avatar_url: person.avatar_url || prev.avatar_url,
    });
  }
  const rows = [...byKey.values()];
  return rows.length ? rows : fromMembers;
}

function dropRemovedMemberFromCaches(listingId, memberUserId) {
  const id = Number(memberUserId);
  const groupId = Number(listingId);
  if (!(id > 0) || !(groupId > 0)) return;
  for (const chat of state.groupChats || []) {
    if (conversationListingId(chat) !== groupId || !Array.isArray(chat.members)) continue;
    chat.members = chat.members.filter((member) => Number(member.user_id ?? member.id) !== id);
  }
  for (const listing of [...(state.myListings || []), ...(state.memberGroupListings || [])]) {
    if (Number(listing?.id) !== groupId) continue;
    const count = Number(listing.group_member_count);
    if (Number.isFinite(count) && count > 0) listing.group_member_count = count - 1;
  }
}

function accountAvatarStackHtml(people) {
  const list = people.length ? people : [{}];
  const maxFaces = people.length > 4 ? 3 : list.length;
  const extra = people.length - maxFaces;
  return list.slice(0, maxFaces).map((person, index) => participantAvatarHtml(person, index)).join('')
    + (extra > 0 ? `<span class="account-participants-avatar account-participants-more">+${extra}</span>` : '');
}

function housingOptionsCount(listing) {
  const raw = listing?.group_shortlist_count ?? listing?.group_context?.group_shortlist_count;
  if (raw == null || raw === '') return null;
  const count = Number(raw);
  return Number.isInteger(count) && count >= 0 ? count : null;
}

function housingAvatarStackHtml(listing) {
  const previews = listing.housingOptionPreviews || [];
  const count = housingOptionsCount(listing) ?? previews.length;
  const slots = Math.min(5, Math.max(1, count));
  const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M4 10.5 12 4l8 6.5"/><path d="M6 9.5V20h12V9.5"/></svg>';
  return `<span class="account-participants-avatars account-housing-avatars" aria-hidden="true">${Array.from({ length: slots }, (_, index) => {
    const photo = previews[index] ? UyDosh.primaryPhoto(previews[index]) : null;
    const url = photo ? UyDosh.photoUrl(photo) : '';
    const remaining = index === 4 && count > 5 ? count - 5 : 0;
    return `<span class="account-participants-avatar account-housing-avatar">${icon}${url ? `<img src="${UyDosh.escapeHtml(url)}" alt="" loading="lazy" onerror="this.remove();" />` : ''}${remaining ? `<span class="account-housing-more">+${remaining}</span>` : ''}</span>`;
  }).join('')}</span>`;
}

function housingOptionsRowHtml(listing) {
  const lang = UyDosh.getLang();
  const href = UyDosh.escapeHtml(
    `${UyDosh.listingPageUrl(listing.id, { backTo: UyDosh.MINI_APP_GROUPS_PATH })}#group-shortlist`,
  );
  const count = housingOptionsCount(listing);
  const countLabel = count == null ? '' : ` · ${count}`;
  return `
        <a class="account-participants-pill account-housing-pill" data-housing-group="${Number(listing.id)}" href="${href}" data-haptic="selection">
          ${housingAvatarStackHtml(listing)}
          <span class="account-participants-label">${UyDosh.escapeHtml(UyDosh.t('account.housingOptions', lang))}${countLabel}</span>
          <span class="account-participants-chevron" aria-hidden="true">${UyDosh.iconChrome?.('chevronRight') || ''}</span>
        </a>`;
}

function participantsPillHtml(listing, conversation) {
  const lang = UyDosh.getLang();
  const people = peopleForAvatarStack(listing, participantsFromConversation(conversation));
  const avatars = accountAvatarStackHtml(people);
  const rawCount = listing?.group_context?.group_member_count ?? listing?.group_member_count;
  const reportedCount = rawCount == null ? NaN : Number(rawCount);
  const count = Number.isInteger(reportedCount) && reportedCount >= 0 ? reportedCount : people.length;
  return `
        <button type="button" class="account-participants-pill" data-open-participants="${listing.id}" data-haptic="selection">
          <span class="account-participants-avatars">${avatars}</span>
          <span class="account-participants-label">${UyDosh.escapeHtml(UyDosh.t('account.participants', lang))} · ${count}</span>
          <span class="account-participants-chevron" aria-hidden="true">${UyDosh.iconChrome?.('chevronRight') || ''}</span>
        </button>`;
}

/** Favorites rows link to the listing (not editable — it may not be the viewer's own) and offer a heart to unfavorite. */
function favoriteRowHtml(favorite) {
  const listing = favorite?.listing;
  if (!listing) return '';
  const lang = UyDosh.getLang();
  const title = UyDosh.escapeHtml(listing.title || '');
  const price = UyDosh.formatPrice(listing, lang);
  const href = UyDosh.escapeHtml(UyDosh.listingPageUrl(listing.id, { backTo: UyDosh.MINI_APP_FAVORITES_PATH }));
  return `
    <div class="account-row" data-favorite-row="${listing.id}">
      <a class="account-row-link" href="${href}">
        ${accountThumbHtml(listing)}
        <div class="account-row-body">
          <div class="account-row-title">${title}</div>
          <div class="account-row-meta">
            ${price ? `<span class="account-row-price">${price}<small>${UyDosh.escapeHtml(UyDosh.t('card.perMonth', lang))}</small></span>` : ''}
            ${statusBadgeHtml(listing, lang)}
          </div>
          ${amenitiesRowHtml(listing, lang)}
        </div>
      </a>
      <button type="button" class="account-favorite-btn" data-unfavorite-listing="${listing.id}" aria-label="${UyDosh.escapeHtml(UyDosh.t('detail.favorite.remove'))}">
        ${UyDosh.iconHeart(true)}
      </button>
    </div>`;
}

function showEmpty(text, { showCreateCta = false } = {}) {
  loadingEl.hidden = true;
  listEl.hidden = true;
  emptyEl.hidden = false;
  emptyTextEl.textContent = text;
  emptyCtaEl.hidden = !showCreateCta || state.activeTab === TAB_GROUPS;
}

function showList(html) {
  loadingEl.hidden = true;
  emptyEl.hidden = true;
  listEl.hidden = false;
  listEl.innerHTML = html;
  UyDosh.applyI18n(listEl);
  if (typeof UyDosh.hydrateIcons === 'function') UyDosh.hydrateIcons(listEl);
}

function bindVisibilityToggleButtons() {
  for (const btn of listEl.querySelectorAll('[data-toggle-visibility]')) {
    btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-toggle-visibility'));
      if (!Number.isFinite(id) || btn.disabled) return;
      const listing = state.myListings.find((l) => l?.id === id);
      if (!listing) return;
      btn.disabled = true;
      try {
        const data = await UyDosh.toggleListingActiveFromTelegramMiniApp(id);
        const updated = data?.listing;
        listing.is_active = updated ? !!updated.is_active : !listing.is_active;
        await loadGroupCreateEligibility();
        renderActiveTab();
      } catch (err) {
        console.error('Failed to toggle listing visibility', err);
        btn.disabled = false;
      }
    });
  }
}

/** Telegram-native confirm dialog when available (Telegram.WebApp.showConfirm), else a plain browser confirm(). */
function confirmDestructiveAction(message) {
  return new Promise((resolve) => {
    const tg = window.Telegram?.WebApp;
    if (typeof tg?.showConfirm === 'function') {
      tg.showConfirm(message, (confirmed) => resolve(!!confirmed));
    } else {
      resolve(window.confirm(message));
    }
  });
}

/** Telegram-native alert when available (Telegram.WebApp.showAlert), else a plain browser alert(). */
function showTelegramAlert(message) {
  const tg = window.Telegram?.WebApp;
  if (typeof tg?.showAlert === 'function') {
    tg.showAlert(message);
  } else {
    window.alert(message);
  }
}

function bindRenewButtons() {
  for (const btn of listEl.querySelectorAll('[data-renew-listing]')) {
    btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-renew-listing'));
      if (!Number.isFinite(id) || btn.disabled) return;
      const listing = state.myListings.find((l) => l?.id === id);
      if (!listing) return;
      const lang = UyDosh.getLang();
      btn.disabled = true;
      try {
        const data = await UyDosh.renewListingFromTelegramMiniApp(id);
        if (data?.listing) Object.assign(listing, data.listing);
        UyDosh.haptic.success();
        renderActiveTab();
      } catch (err) {
        console.error('Failed to renew listing', err);
        const nextRenewalAt = err?.payload?.nextRenewalAt;
        if (nextRenewalAt) {
          // Cooldown still active (e.g. stale client state) — sync from the server's answer.
          listing.next_renewal_at = nextRenewalAt;
          renderActiveTab();
        } else {
          btn.disabled = false;
        }
        showTelegramAlert(UyDosh.t('account.renewError', lang));
      }
    });
  }
}

function bindDeleteButtons() {
  for (const btn of listEl.querySelectorAll('[data-delete-listing]')) {
    btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-delete-listing'));
      if (!Number.isFinite(id) || btn.disabled) return;
      const lang = UyDosh.getLang();
      const confirmed = await confirmDestructiveAction(UyDosh.t('account.deleteConfirm', lang));
      if (!confirmed) return;
      btn.disabled = true;
      try {
        await UyDosh.deleteListingFromTelegramMiniApp(id);
        state.myListings = state.myListings.filter((l) => l?.id !== id);
        await loadGroupCreateEligibility();
        renderActiveTab();
      } catch (err) {
        console.error('Failed to delete listing', err);
        btn.disabled = false;
        showTelegramAlert(UyDosh.t('account.deleteError', lang));
      }
    });
  }
}

function bindFavoriteRemoveButtons() {
  for (const btn of listEl.querySelectorAll('[data-unfavorite-listing]')) {
    btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-unfavorite-listing'));
      if (!Number.isFinite(id) || btn.disabled) return;
      btn.disabled = true;
      try {
        await UyDosh.toggleListingFavorite(id);
        state.favorites = state.favorites.filter((f) => f?.listing?.id !== id);
        renderActiveTab();
      } catch (err) {
        console.error('Failed to remove favorite', err);
        btn.disabled = false;
      }
    });
  }
}

const CLOCK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8"></circle><path d="M12 8v5l3 2"></path></svg>';

function conversationAt(conversation) {
  const raw = conversation.last_message_at || conversation.updated_at || conversation.created_at;
  const t = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

function formatChatTime(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function groupChatAvatarInner(conversation) {
  const members = Array.isArray(conversation.members) ? conversation.members : [];
  const senderId = Number(conversation.last_message_sender_id);
  const lastSender = Number.isFinite(senderId) && senderId > 0
    ? members.find((m) => Number(m.user_id) === senderId)
    : null;
  const img = lastSender
    ? lastSender.avatar_url
    : (conversation.other_user_avatar || members.find((m) => m.avatar_url)?.avatar_url);
  if (img) {
    return `<img src="${UyDosh.escapeHtml(img)}" alt="" referrerpolicy="no-referrer" onerror="this.remove();" />`;
  }
  return UyDosh.iconChrome('chatBubble');
}

function groupChatPreview(conversation, lang) {
  return UyDosh.escapeHtml(conversation.last_message_content
    ? String(conversation.last_message_content).replace(/^\[\[uydosh:listing_share\]\].*/, UyDosh.t('chat.listingCard', lang))
    : UyDosh.t('account.groupChatPreview', lang));
}

function groupChatRowHtml(conversation, { nested = false } = {}) {
  const lang = UyDosh.getLang();
  const preview = groupChatPreview(conversation, lang);
  const unread = Number(conversation.unread_count) || 0;
  const href = UyDosh.escapeHtml(UyDosh.chatPageUrl(conversation.id, { backTo: UyDosh.MINI_APP_GROUPS_PATH }));
  const when = formatChatTime(conversationAt(conversation));
  if (nested) {
    return `
    <div class="account-nested-chat-wrap">
      <a class="account-nested-chat" href="${href}">
        <div class="account-chat-avatars" aria-hidden="true">${groupChatAvatarInner(conversation)}</div>
        <div class="account-nested-chat-body">
          <div class="account-chat-preview">${preview}</div>
          ${when ? `<div class="account-nested-time">${CLOCK_ICON}<span>${when}</span></div>` : ''}
        </div>
        ${unread > 0 ? `<span class="account-chat-unread">${unread}</span>` : ''}
        <span class="account-nested-chat-link"><span>${UyDosh.escapeHtml(UyDosh.t('chat.title', lang))}</span><span class="account-nested-go" aria-hidden="true">${UyDosh.iconChrome('chevronRight')}</span></span>
      </a>
    </div>`;
  }
  const title = UyDosh.escapeHtml(conversation.listing_title || UyDosh.t('chat.title', lang));
  return `
    <a class="account-row account-chat-row" href="${href}">
      <div class="account-chat-avatars" aria-hidden="true">${groupChatAvatarInner(conversation)}</div>
      <div class="account-row-body">
        <div class="account-row-title">${title}</div>
        <div class="account-row-meta"><span class="account-chat-preview">${preview}</span></div>
      </div>
      ${unread > 0 ? `<span class="account-chat-unread">${unread}</span>` : ''}
    </a>`;
}

function conversationListingId(conversation) {
  const id = Number(conversation?.listing_id ?? conversation?.listing?.id);
  return Number.isFinite(id) && id > 0 ? id : 0;
}

function chatForListing(listing, chats) {
  const listingId = Number(listing?.id);
  const conversationId = Number(listing?.group_conversation_id);
  if (Number.isFinite(conversationId) && conversationId > 0) {
    const byId = chats.find((c) => Number(c.id) === conversationId);
    if (byId) return byId;
  }
  if (Number.isFinite(listingId) && listingId > 0) {
    return chats.find((c) => conversationListingId(c) === listingId) || null;
  }
  return null;
}

function groupListings() {
  return state.myListings.filter(listingLooksGroupForming);
}

function nonGroupListings() {
  return state.myListings.filter((listing) => !listingLooksGroupForming(listing));
}

function renderMine() {
  const lang = UyDosh.getLang();
  if (state.authError) {
    showEmpty(UyDosh.t('create.errorAuth', lang));
    return;
  }
  if (state.myListingsError) {
    showEmpty(UyDosh.t('feed.error', lang));
    return;
  }
  const rows = nonGroupListings();
  if (!rows.length) {
    showEmpty(UyDosh.t('account.empty', lang), { showCreateCta: true });
    return;
  }
  showList(rows.map(listingRowHtml).join(''));
  bindVisibilityToggleButtons();
  bindRenewButtons();
  bindDeleteButtons();
}

function renderGroups() {
  const lang = UyDosh.getLang();
  if (state.authError) {
    showEmpty(UyDosh.t('create.errorAuth', lang));
    return;
  }
  if (state.myListingsError && state.groupChatsError) {
    showEmpty(UyDosh.t('feed.error', lang));
    return;
  }
  const chats = (state.groupChats || []).filter((c) => c.conversation_type === 'listing_group');
  const rows = groupListings();
  const memberRows = state.memberGroupListings || [];
  if (!chats.length && !rows.length && !memberRows.length) {
    showEmpty(UyDosh.t('account.groupsEmpty', lang), { showCreateCta: true });
    return;
  }
  const usedChatIds = new Set();
  const parts = [];
  for (const listing of rows) {
    const chat = chatForListing(listing, chats);
    if (chat?.id != null) usedChatIds.add(Number(chat.id));
    parts.push(groupListingCardHtml(listing, chat));
  }
  for (const listing of memberRows) {
    const chat = chatForListing(listing, chats);
    if (chat?.id != null) usedChatIds.add(Number(chat.id));
    parts.push(groupListingCardHtml(listing, chat, { owner: false }));
  }
  for (const chat of chats) {
    if (!usedChatIds.has(Number(chat.id))) parts.push(groupChatRowHtml(chat));
  }
  showList(parts.join(''));
  bindVisibilityToggleButtons();
  bindRenewButtons();
  bindDeleteButtons();
  bindParticipantsPills();
  bindGroupCardDetailNavigation();
}

function renderFavorites() {
  const lang = UyDosh.getLang();
  if (state.authError || state.favoritesUnavailable) {
    showEmpty(UyDosh.t('create.errorAuth', lang));
    return;
  }
  if (state.favoritesError) {
    showEmpty(UyDosh.t('feed.error', lang));
    return;
  }
  if (!state.favorites.length) {
    showEmpty(UyDosh.t('account.favoritesEmpty', lang));
    return;
  }
  showList(state.favorites.map(favoriteRowHtml).join(''));
  bindFavoriteRemoveButtons();
}

function syncCreateGroupAction() {
  const el = document.getElementById('create-group-action');
  if (!el) return;
  el.hidden = state.activeTab !== TAB_GROUPS || !state.canCreateGroup;
}

const DEFAULT_GROUP_FORMING_MAX_ACTIVE_MEMBERSHIPS = 2;

function localActiveGroupCount() {
  const ids = new Set();
  for (const listing of groupListings()) {
    if (listing?.is_active === false || listing?.group_forming_status === 'closed') continue;
    const id = Number(listing.id);
    if (id > 0) ids.add(id);
  }
  for (const chat of state.groupChats || []) {
    const id = conversationListingId(chat);
    if (id > 0) ids.add(id);
  }
  return ids.size;
}

async function loadGroupCreateEligibility() {
  const sessionReady = await UyDosh.ensureTelegramMiniAppSession();
  if (!sessionReady) {
    state.canCreateGroup = false;
    return;
  }
  try {
    const data = await UyDosh.fetchMyGroupMembershipLimit();
    const activeCount = Number(data?.activeCount);
    const limit = Number(data?.limit);
    state.canCreateGroup = Number.isFinite(activeCount) && Number.isFinite(limit) && activeCount < limit;
  } catch (err) {
    console.error('Failed to load group membership limit', err);
    state.canCreateGroup = localActiveGroupCount() < DEFAULT_GROUP_FORMING_MAX_ACTIVE_MEMBERSHIPS;
  }
}

function renderActiveTab() {
  syncCreateGroupAction();
  if (state.activeTab !== TAB_FRIENDS) window.UyDoshFriends?.deactivate();
  if (state.activeTab === TAB_FAVORITES) renderFavorites();
  else if (state.activeTab === TAB_GROUPS) renderGroups();
  else if (state.activeTab === TAB_FOLLOWS) renderFollows();
  else if (state.activeTab === TAB_FRIENDS) window.UyDoshFriends?.activate();
  else renderMine();
}

/** Mirrors the active tab's label in the mini-app header (e.g. "My listings" vs "Favorites"). */
function updateHeaderSubtitle(tab) {
  const subtitleEl = document.querySelector('[data-uydosh-mini-app-header] .brand span[data-i18n]');
  if (!subtitleEl) return;
  const key = tab === TAB_FAVORITES
    ? 'account.tabs.favorites'
    : tab === TAB_GROUPS
      ? 'account.tabs.groups'
      : tab === TAB_FOLLOWS
        ? 'account.followsTitle'
        : tab === TAB_FRIENDS
          ? 'account.friendsTitle'
          : 'account.subtitle';
  subtitleEl.setAttribute('data-i18n', key);
  subtitleEl.textContent = UyDosh.t(key, UyDosh.getLang());
}

function setActiveTab(tab) {
  if (state.activeTab === tab) return;
  state.activeTab = tab;
  for (const btn of tabButtons) {
    btn.setAttribute('aria-selected', btn.getAttribute('data-account-tab') === tab ? 'true' : 'false');
  }
  updateHeaderSubtitle(tab);
  if (tab === TAB_FOLLOWS && !state.followsLoaded && !state.followsLoading) loadFollows();
  renderActiveTab();
}

for (const btn of tabButtons) {
  btn.addEventListener('click', () => {
    setActiveTab(btn.getAttribute('data-account-tab'));
  });
}

for (const btn of tabButtons) {
  btn.setAttribute('aria-selected', btn.getAttribute('data-account-tab') === state.activeTab ? 'true' : 'false');
}
updateHeaderSubtitle(state.activeTab);

async function loadMyListings() {
  try {
    const data = await UyDosh.fetchMyTelegramMiniAppListings();
    state.myListings = Array.isArray(data?.listings) ? data.listings : [];
  } catch (err) {
    console.error('Failed to load my listings', err);
    state.myListingsError = true;
  }
}

/** Favorites reuse the shared `/favorites` API (Bearer-token auth, same as the mobile app). */
async function loadFavorites() {
  const sessionReady = await UyDosh.ensureTelegramMiniAppSession();
  if (!sessionReady) {
    state.favoritesUnavailable = true;
    return;
  }
  try {
    const data = await UyDosh.fetchFavoriteListings({ limit: 100 });
    const favorites = Array.isArray(data?.favorites) ? data.favorites : [];
    state.favorites = favorites.filter((f) => f?.listing);
  } catch (err) {
    console.error('Failed to load favorites', err);
    state.favoritesError = true;
  }
}

function readFollowPage(payload) {
  const users = Array.isArray(payload?.users) ? payload.users : [];
  const total = Number(payload?.total);
  return {
    users,
    total: Number.isFinite(total) ? total : users.length,
    page: Number(payload?.page) || (users.length ? 1 : 0),
    totalPages: Number(payload?.totalPages) || 0,
  };
}

function mergeFollowUsers(current, incoming) {
  const seen = new Set(current.map((user) => Number(user.userId)));
  const next = current.slice();
  for (const user of incoming) {
    const id = Number(user?.userId);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    next.push(user);
  }
  return next;
}

async function loadFollows({ segment = null, page = 1 } = {}) {
  if (state.followsLoading) return;
  state.followsLoading = true;
  state.followsError = false;
  if (page === 1 && !segment) {
    state.followsUnavailable = false;
  }
  if (state.activeTab === TAB_FOLLOWS) renderFollows();
  const sessionReady = await UyDosh.ensureTelegramMiniAppSession();
  const me = Number(UyDosh.getSessionUserId());
  if (!sessionReady || !me) {
    state.followsUnavailable = true;
    state.followsLoading = false;
    if (state.activeTab === TAB_FOLLOWS) renderFollows();
    return;
  }
  try {
    const wantFollowing = !segment || segment === 'following';
    const wantFollowers = !segment || segment === 'followers';
    const [following, followers] = await Promise.all([
      wantFollowing ? UyDosh.fetchFollowing(me, { page, limit: FOLLOWS_PAGE_SIZE }) : null,
      wantFollowers ? UyDosh.fetchFollowers(me, { page, limit: FOLLOWS_PAGE_SIZE }) : null,
    ]);
    if (following) {
      const parsed = readFollowPage(following);
      state.following = page > 1 ? mergeFollowUsers(state.following, parsed.users) : parsed.users;
      state.followingTotal = parsed.total;
      state.followingPage = parsed.page;
      state.followingPages = parsed.totalPages;
    }
    if (followers) {
      const parsed = readFollowPage(followers);
      state.followers = page > 1 ? mergeFollowUsers(state.followers, parsed.users) : parsed.users;
      state.followersTotal = parsed.total;
      state.followersPage = parsed.page;
      state.followersPages = parsed.totalPages;
    }
    state.followsLoaded = true;
  } catch (err) {
    console.error('Failed to load follows', err);
    if (page === 1 && !segment) state.followsError = true;
  } finally {
    state.followsLoading = false;
    if (state.activeTab === TAB_FOLLOWS) renderFollows();
  }
}

let discoverRequest = 0;
let discoverTimer = 0;

async function loadDiscover({ page = 1, query = state.discoverQuery } = {}) {
  const request = ++discoverRequest;
  state.discoverLoading = true;
  if (state.activeTab === TAB_FOLLOWS && state.followsSegment === 'discover') renderFollows();
  const sessionReady = await UyDosh.ensureTelegramMiniAppSession();
  if (!sessionReady || !Number(UyDosh.getSessionUserId())) {
    state.followsUnavailable = true;
    state.discoverLoading = false;
    if (state.activeTab === TAB_FOLLOWS) renderFollows();
    return;
  }
  try {
    const payload = await UyDosh.fetchDiscoverableUsers({
      page,
      limit: 20,
      q: String(query || '').trim(),
    });
    if (request !== discoverRequest) return;
    const parsed = readFollowPage(payload);
    state.discover = page > 1 ? mergeFollowUsers(state.discover, parsed.users) : parsed.users;
    state.discoverTotal = parsed.total;
    state.discoverPage = parsed.page;
    state.discoverPages = parsed.totalPages;
    state.discoverLoaded = true;
    state.discoverQueryLoaded = String(query || '').trim();
  } catch (err) {
    console.error('Failed to find people to follow', err);
    if (request !== discoverRequest) return;
    state.discoverLoaded = true;
    state.discoverQueryLoaded = String(query || '').trim();
    state.followNote = UyDosh.t('feed.error', UyDosh.getLang());
  } finally {
    if (request === discoverRequest) {
      state.discoverLoading = false;
      if (state.activeTab === TAB_FOLLOWS) renderFollows();
    }
  }
}

function applyFollowChange(userId, isFollowing) {
  const id = Number(userId);
  const follower = state.followers.find((user) => Number(user.userId) === id);
  const following = state.following.find((user) => Number(user.userId) === id);
  const discovered = state.discover.find((user) => Number(user.userId) === id);
  if (follower) follower.isFollowing = isFollowing;
  if (discovered) discovered.isFollowing = isFollowing;
  if (isFollowing) {
    if (following) following.isFollowing = true;
    else {
      const source = follower || discovered;
      if (source) {
        state.following.unshift({ ...source, isFollowing: true });
        state.followingTotal += 1;
      }
    }
    if (discovered && !state.discoverQuery.trim()) {
      state.discover = state.discover.filter((user) => Number(user.userId) !== id);
      state.discoverTotal = Math.max(0, state.discoverTotal - 1);
    }
    return;
  }
  if (following) {
    state.following = state.following.filter((user) => Number(user.userId) !== id);
    state.followingTotal = Math.max(0, state.followingTotal - 1);
  }
}

function followAvatarHtml(user) {
  const name = String(user?.name || '').trim();
  const letter = Array.from(name)[0] || '?';
  const raw = user?.avatarUrl || '';
  const url = raw && typeof UyDosh.photoUrl === 'function' ? UyDosh.photoUrl(raw) : raw;
  const img = url
    ? `<img src="${UyDosh.escapeHtml(url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove();" />`
    : '';
  return `<span class="follow-avatar" aria-hidden="true"><span>${UyDosh.escapeHtml(letter.toUpperCase())}</span>${img}</span>`;
}

function followRowHtml(user, lang) {
  const id = Number(user?.userId);
  const name = String(user?.name || '').trim() || UyDosh.t('complaints.anonymous', lang);
  const handle = String(user?.username || '').replace(/^@+/, '');
  const backTo = `${UyDosh.MINI_APP_ACCOUNT_PATH}?tab=follows`;
  const href = UyDosh.escapeHtml(UyDosh.profilePageUrl(id, { backTo }));
  const following = user?.isFollowing === true;
  const busy = state.followToggleId === id;
  return `
    <article class="follow-row">
      <a class="follow-row-link" href="${href}">
        ${followAvatarHtml(user)}
        <span class="follow-person">
          <span class="follow-name">${UyDosh.escapeHtml(name)}</span>
          ${handle ? `<span class="follow-handle">@${UyDosh.escapeHtml(handle)}</span>` : ''}
        </span>
      </a>
      <button type="button" class="follow-btn${following ? ' is-on' : ''}${busy ? ' is-busy' : ''}" data-follow-toggle="${id}" ${busy ? 'disabled aria-busy="true"' : ''}>
        <span class="follow-btn-label">${UyDosh.escapeHtml(UyDosh.t(following ? 'profile.following' : 'profile.follow', lang))}</span>
        ${busy ? '<span class="follow-btn-spinner" aria-hidden="true"></span>' : ''}
      </button>
    </article>`;
}

function renderFollows() {
  const lang = UyDosh.getLang();
  if (state.followsUnavailable || state.authError) {
    showEmpty(UyDosh.t('create.errorAuth', lang));
    return;
  }
  if (state.followsError) {
    showEmpty(UyDosh.t('feed.error', lang));
    return;
  }
  if (!state.followsLoaded && state.followsLoading) {
    showList('<div class="gp-loading" aria-busy="true"><span class="loading-spinner" aria-hidden="true"></span></div>');
    return;
  }
  const segment = state.followsSegment === 'followers'
    ? 'followers'
    : state.followsSegment === 'discover'
      ? 'discover'
      : 'following';
  const people = segment === 'followers'
    ? state.followers
    : segment === 'discover'
      ? state.discover
      : state.following;
  const page = segment === 'followers'
    ? state.followersPage
    : segment === 'discover'
      ? state.discoverPage
      : state.followingPage;
  const pages = segment === 'followers'
    ? state.followersPages
    : segment === 'discover'
      ? state.discoverPages
      : state.followingPages;
  const switchHtml = `
    <div class="follows-switch follows-switch-3" role="tablist" aria-label="${UyDosh.escapeHtml(UyDosh.t('account.followsTitle', lang))}">
      <button type="button" role="tab" data-follows-segment="following" aria-selected="${segment === 'following' ? 'true' : 'false'}">
        <span class="follows-switch-icon" data-icon="person" aria-hidden="true"></span>
        <span class="follows-switch-label">${UyDosh.escapeHtml(UyDosh.t('account.follows.following', lang))}</span>
        <span class="follows-count">${state.followingTotal}</span>
      </button>
      <button type="button" role="tab" data-follows-segment="followers" aria-selected="${segment === 'followers' ? 'true' : 'false'}">
        <span class="follows-switch-icon" data-icon="users" aria-hidden="true"></span>
        <span class="follows-switch-label">${UyDosh.escapeHtml(UyDosh.t('account.follows.followers', lang))}</span>
        <span class="follows-count">${state.followersTotal}</span>
      </button>
      <button type="button" role="tab" data-follows-segment="discover" aria-selected="${segment === 'discover' ? 'true' : 'false'}">
        <span class="follows-switch-icon" data-icon="search" aria-hidden="true"></span>
        <span class="follows-switch-label">${UyDosh.escapeHtml(UyDosh.t('account.follows.discover', lang))}</span>
      </button>
    </div>`;
  const searchHtml = segment === 'discover'
    ? `<input class="follows-search" type="search" enterkeyhint="search" data-follows-search value="${UyDosh.escapeHtml(state.discoverQuery)}" placeholder="${UyDosh.escapeHtml(UyDosh.t('account.follows.discoverPlaceholder', lang))}" />`
    : '';
  const emptyKey = segment === 'followers'
    ? 'account.follows.emptyFollowers'
    : segment === 'discover'
      ? (state.discoverQuery.trim() ? 'account.follows.discoverEmpty' : 'account.follows.discoverNone')
      : 'account.follows.emptyFollowing';
  const waiting = segment === 'discover' && !state.discoverLoaded && state.discoverLoading;
  const rows = waiting ? '<div class="gp-loading" aria-busy="true"><span class="loading-spinner" aria-hidden="true"></span></div>' : people.map((user) => followRowHtml(user, lang)).join('');
  const empty = people.length || waiting ? '' : `<p class="follows-empty">${UyDosh.escapeHtml(UyDosh.t(emptyKey, lang))}</p>`;
  const more = !waiting && page < pages
    ? `<button type="button" class="follows-more" data-follows-more="${segment}" ${(state.followsLoading || state.discoverLoading) ? 'disabled' : ''}>${UyDosh.escapeHtml(UyDosh.t('account.follows.more', lang))}</button>`
    : '';
  const note = state.followNote
    ? `<p class="follows-note" role="status">${UyDosh.escapeHtml(state.followNote)}</p>`
    : '';
  const keepSearchFocus = document.activeElement?.matches?.('[data-follows-search]') === true;
  showList(`${switchHtml}${searchHtml}${note}${rows || empty}${more}`);
  const search = listEl.querySelector('[data-follows-search]');
  if (search && keepSearchFocus) {
    search.focus();
    const end = search.value.length;
    try { search.setSelectionRange(end, end); } catch { /* type=search on some browsers */ }
  }
  search?.addEventListener('input', () => {
    state.discoverQuery = search.value;
    window.clearTimeout(discoverTimer);
    discoverTimer = window.setTimeout(() => {
      const term = state.discoverQuery.trim().replace(/^@+/, '');
      if (term.length === 1) return;
      loadDiscover({ page: 1, query: state.discoverQuery });
    }, 300);
  });
  for (const button of listEl.querySelectorAll('[data-follows-segment]')) {
    button.addEventListener('click', () => {
      const next = button.getAttribute('data-follows-segment');
      if (next !== 'following' && next !== 'followers' && next !== 'discover') return;
      if (state.followsSegment === next) return;
      state.followsSegment = next;
      state.followNote = '';
      UyDosh.haptic?.selection?.();
      renderFollows();
      if (next === 'discover' && state.discoverQueryLoaded !== state.discoverQuery.trim()) {
        loadDiscover({ page: 1, query: state.discoverQuery });
      }
    });
  }
  listEl.querySelector('[data-follows-more]')?.addEventListener('click', () => {
    if (segment === 'discover') loadDiscover({ page: page + 1, query: state.discoverQuery });
    else loadFollows({ segment, page: page + 1 });
  });
  for (const button of listEl.querySelectorAll('[data-follow-toggle]')) {
    button.addEventListener('click', async () => {
      const id = Number(button.getAttribute('data-follow-toggle'));
      if (!id || state.followToggleId) return;
      const person = [...state.following, ...state.followers, ...state.discover].find((user) => Number(user.userId) === id);
      if (person?.isFollowing === true) {
        const name = String(person.name || '').trim() || UyDosh.t('complaints.anonymous', lang);
        const confirmed = await confirmDestructiveAction(
          UyDosh.t('account.follows.unfollowConfirm', lang).replace('{name}', name),
        );
        if (!confirmed || state.followToggleId) return;
      }
      state.followToggleId = id;
      state.followNote = '';
      renderFollows();
      try {
        const result = await UyDosh.toggleFollow(id);
        applyFollowChange(id, result?.isFollowing === true);
        state.followToggleId = 0;
        renderFollows();
      } catch (err) {
        console.error('Failed to toggle follow', err);
        state.followToggleId = 0;
        state.followNote = UyDosh.t('account.follows.error', lang);
        renderFollows();
      }
    });
  }
}

async function loadMemberGroupListings() {
  const owned = new Set(groupListings().map((listing) => Number(listing.id)));
  const ids = [];
  for (const chat of state.groupChats || []) {
    const id = conversationListingId(chat);
    if (id > 0 && !owned.has(id) && !ids.includes(id)) ids.push(id);
  }
  const fetched = await Promise.all(ids.map(async (id) => {
    try {
      const listing = await UyDosh.fetchListing(id);
      return listing?.id ? listing : null;
    } catch (err) {
      console.error('Failed to load member group listing', id, err);
      return null;
    }
  }));
  state.memberGroupListings = fetched.filter(Boolean);
}

async function hydrateOwnedGroupProgress() {
  const listings = groupListings().filter((listing) => !listing?.group_context?.group_progress && Number(listing?.id) > 0);
  await Promise.all(listings.map(async (listing) => {
    try {
      const detail = await UyDosh.fetchListing(listing.id);
      if (detail?.group_context) listing.group_context = detail.group_context;
    } catch (err) {
      console.error('Failed to load group progress', listing.id, err);
    }
  }));
}

async function loadHousingOptionCounts() {
  const listings = [...groupListings(), ...(state.memberGroupListings || [])]
    .filter((listing) => housingOptionsCount(listing) == null && Number(listing?.id) > 0);
  if (!listings.length || typeof UyDosh.fetchGroupShortlistCount !== 'function') return;
  await Promise.all(listings.map(async (listing) => {
    try {
      const result = await UyDosh.fetchGroupShortlistCount(listing.id);
      const count = Number(result?.count);
      if (Number.isInteger(count) && count >= 0) listing.group_shortlist_count = count;
    } catch (err) {
      console.error('Failed to load housing option count', listing.id, err);
    }
  }));
}

async function loadHousingOptionPreviews() {
  const listings = [...groupListings(), ...(state.memberGroupListings || [])];
  await Promise.all(listings.filter(l => housingOptionsCount(l) !== 0).map(async listing => {
    try {
      const result = await UyDosh.fetchGroupShortlist(listing.id, 1, { limit: 5 });
      listing.housingOptionPreviews = (result.data || []).slice(0, 5).map(item => item.listing);
      if (Number.isInteger(result.total) && result.total >= 0) listing.group_shortlist_count = result.total;
      if (state.activeTab === TAB_GROUPS) {
        const link = listEl.querySelector(`[data-housing-group="${Number(listing.id)}"]`);
        if (link) link.outerHTML = housingOptionsRowHtml(listing);
      }
    } catch { /* Count-based house icons remain usable if previews are unavailable. */ }
  }));
}

async function loadGroupChats() {
  const sessionReady = await UyDosh.ensureTelegramMiniAppSession();
  if (!sessionReady) return;
  try {
    const data = await UyDosh.fetchUserConversations({ page: 1, limit: 50 });
    const list = data?.data?.conversations || data?.conversations || [];
    state.groupChats = Array.isArray(list)
      ? list.filter((c) => c.conversation_type === 'listing_group')
      : [];
  } catch (err) {
    console.error('Failed to load group chats', err);
    state.groupChatsError = true;
  }
}

async function boot() {
  UyDosh.applyI18n();
  document.addEventListener('uydosh:langchange', () => {
    UyDosh.applyI18n();
    renderActiveTab();
  });

  // Deliberately no separate `getTelegramInitData()` pre-check here — see
  // the matching comment in telegram-profile.js's `boot()`. Gating both
  // tabs on it up front would wrongly fail Favorites too: `loadFavorites`
  // calls `ensureTelegramMiniAppSession()` itself, which tries a cached
  // session token before falling back to initData, so a still-valid
  // session survives even once initData itself has expired. (My Listings
  // has no such fallback — `fetchMyTelegramMiniAppListings` always needs
  // initData directly — so it still degrades to its own `myListingsError`
  // state in that case, independent of Favorites.)

  const startup = [loadMyListings(), loadFavorites(), loadGroupChats()];
  if (state.activeTab === TAB_FOLLOWS) startup.push(loadFollows());
  await Promise.all(startup);
  await Promise.all([loadMemberGroupListings(), loadGroupCreateEligibility(), hydrateOwnedGroupProgress()]);
  await loadHousingOptionCounts();
  loadingEl.hidden = true;
  renderActiveTab();
  loadHousingOptionPreviews();
}

if (isAccountPage) boot();

const REMOVE_REASON_KEYS = ['inactive', 'rules', 'notFit', 'requested', 'other'];

const participantsRoot = document.getElementById('group-participants-root');
const participantsSheetState = {
  listingId: 0,
  listing: null,
  members: [],
  profilesById: {},
  myProfile: null,
  isOwner: false,
  busy: false,
  backTo: '',
};

function currentUserId() {
  return Number(UyDosh.getSessionUserId?.() || 0);
}

function openMemberProfile(userId) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id < 1) return;
  const backTo = participantsSheetState.backTo || UyDosh.MINI_APP_GROUPS_PATH;
  const href = typeof UyDosh.profilePageUrl === 'function'
    ? UyDosh.profilePageUrl(id, { backTo })
    : `${UyDosh.MINI_APP_PROFILE_PATH}?user=${encodeURIComponent(id)}&back=${encodeURIComponent(backTo)}`;
  location.href = href;
}

function bindParticipantsPills() {
  for (const btn of listEl.querySelectorAll('[data-open-participants]')) {
    btn.addEventListener('click', () => {
      const id = Number(btn.getAttribute('data-open-participants'));
      if (Number.isFinite(id) && id > 0) openParticipantsSheet(id);
    });
  }
}

/**
 * A group card is a shortcut to its listing details. Nested links and buttons
 * retain their own actions: chat, housing options, participants, and the listing controls are
 * intentionally excluded from this card-level navigation.
 */
function bindGroupCardDetailNavigation() {
  const interactiveSelector = 'a, button, input, select, textarea, label, [role="button"], [role="link"]';
  for (const card of listEl.querySelectorAll('[data-group-detail-href]')) {
    card.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.target.closest(interactiveSelector)) return;
      const href = card.getAttribute('data-group-detail-href');
      if (!href) return;
      UyDosh.haptic?.light?.();
      location.href = href;
    });
  }
}

function closeParticipantsSheet() {
  if (!participantsRoot) return;
  participantsRoot.classList.remove('is-open');
  participantsRoot.hidden = true;
  participantsRoot.innerHTML = '';
  participantsSheetState.listingId = 0;
  participantsSheetState.listing = null;
  participantsSheetState.members = [];
}

function memberRoleKey(member, listing, me) {
  const userId = Number(member.user_id);
  const ownerId = Number(listing?.user_id ?? listing?.user?.id);
  if (member.role === 'owner' || userId === ownerId) return 'organizer';
  if (member.role === 'landlord_guest') return 'landlord';
  if (userId === me) return 'you';
  return 'participant';
}

function groupPhaseKey(listing) {
  const phase = listing?.group_context?.group_progress?.phase;
  if (phase === 'landlord_outreach' || phase === 'landlord_joined') return 'landlord';
  if (phase === 'housing_search' || phase === 'shortlisting') return 'housing';
  if (phase === 'closed') return 'closed';
  if (phase === 'forming') return 'forming';
  const target = Number(listing?.group_context?.group_size_target ?? listing?.group_size_target);
  const filled = Number(listing?.group_context?.group_member_count ?? listing?.group_member_count);
  if (Number.isFinite(target) && target > 0 && filled >= target) return 'housing';
  return 'forming';
}

function groupPhasePillHtml(listing, lang) {
  const label = groupStatusLabel(listing, lang);
  if (!label) return '';
  return `<span class="account-phase-pill" data-phase="${groupPhaseKey(listing)}">${UyDosh.escapeHtml(label)}</span>`;
}

function groupStatusLabel(listing, lang) {
  const ctx = listing?.group_context;
  const phase = ctx?.group_progress?.phase;
  if (phase === 'landlord_joined') return UyDosh.t('account.landlordJoined', lang);
  if (phase === 'landlord_outreach') return UyDosh.t('account.waitingLandlord', lang);
  if (phase === 'housing_search' || phase === 'shortlisting') {
    return UyDosh.t('account.lookingForHousing', lang);
  }
  if (phase === 'closed') return UyDosh.t('detail.group.closed', lang);
  if (phase === 'forming') return UyDosh.t('account.lookingForRoommates', lang);
  const target = Number(ctx?.group_size_target ?? listing?.group_size_target);
  const filled = Number(ctx?.group_member_count ?? listing?.group_member_count);
  if (Number.isFinite(target) && target > 0 && filled >= target) {
    return UyDosh.t('account.lookingForHousing', lang);
  }
  return UyDosh.t('account.lookingForRoommates', lang);
}

function lifestyleValuesClose(a, b) {
  if (a == null || b == null || a === '') return null;
  if (typeof a === 'number' || typeof b === 'number') {
    return Math.abs(Number(a) - Number(b)) <= 1;
  }
  return String(a) === String(b);
}

function memberLifestyleHtml(member, roleKey) {
  if (roleKey === 'organizer') return '';
  const profile = participantsSheetState.profilesById[Number(member.user_id)];
  if (!profile) return '';
  const mine = participantsSheetState.myProfile;
  const chips = [];
  const add = (icon, mineVal, theirVal) => {
    if (theirVal == null || theirVal === '') return;
    const close = mine ? lifestyleValuesClose(mineVal, theirVal) : null;
    const tone = close == null ? '' : close ? 'is-match' : 'is-mismatch';
    chips.push(`<span class="gp-life-icon ${tone}" aria-hidden="true">${UyDosh.iconChrome?.(icon) || ''}</span>`);
  };
  const smokeIcon = (profile.smoking_preference === 'no' || profile.smoking_preference === 'never' || profile.smoking_preference === 'false')
    ? 'smokeFree'
    : 'cigarette';
  add('moon', mine?.sleep_time, profile.sleep_time);
  add(smokeIcon, mine?.smoking_preference, profile.smoking_preference);
  add('sparkles', mine?.cleanliness, profile.cleanliness);
  add('wineGlass', mine?.alcohol_preference, profile.alcohol_preference);
  add('cat', mine?.pets_preference, profile.pets_preference);
  if (!chips.length) return '';
  return `<div class="gp-life">${chips.join('')}</div>`;
}

function memberRoleLabel(roleKey, lang) {
  if (roleKey === 'you') return UyDosh.t('account.roleYou', lang);
  if (roleKey === 'organizer') return UyDosh.t('account.roleOrganizer', lang);
  if (roleKey === 'landlord') return UyDosh.t('account.roleLandlord', lang);
  return UyDosh.t('account.roleParticipant', lang);
}

function canOwnerRemoveMember(member, listing, me) {
  if (!participantsSheetState.isOwner) return false;
  const userId = Number(member.user_id);
  const ownerId = Number(listing?.user_id ?? listing?.user?.id);
  if (userId === me || userId === ownerId) return false;
  if (member.role === 'owner') return false;
  return true;
}

function matchPercentHtml(member, me, lang) {
  const myProfile = participantsSheetState.myProfile;
  const theirs = participantsSheetState.profilesById[Number(member.user_id)];
  const ownerId = Number(participantsSheetState.listing?.user_id ?? participantsSheetState.listing?.user?.id);
  if (!myProfile || !theirs || Number(member.user_id) === me) return '';
  if (Number(member.user_id) === ownerId || member.role === 'owner') return '';
  const analysis = UyDosh.computeProfileCompatibility?.(myProfile, theirs);
  const percent = Number(analysis?.percent);
  if (!Number.isFinite(percent) || !(Number(analysis?.scoredFieldCount) > 0)) return '';
  const cls = percent >= 80 ? 'is-good' : percent < 60 ? 'is-bad' : 'is-ok';
  return `<span class="gp-match ${cls}">${Math.round(percent)}%</span>`;
}

function memberCardHtml(member, listing, lang) {
  const me = currentUserId();
  const userId = Number(member.user_id);
  const roleKey = memberRoleKey(member, listing, me);
  const removable = canOwnerRemoveMember(member, listing, me);
  const name = member.name || UyDosh.t('complaints.anonymous', lang);
  const avatar = `<span class="gp-card-avatar">${participantAvatarHtml(member, 0)}</span>`;
  const leave = roleKey === 'you' && !participantsSheetState.isOwner
    ? `<button type="button" class="gp-leave" data-leave-group><span>${UyDosh.escapeHtml(UyDosh.t('account.leaveGroup', lang))}</span></button>`
    : '';
  const match = matchPercentHtml(member, me, lang);
  const front = `
    <div class="gp-member-front" data-open-profile="${userId}" role="link">
      ${avatar}
      <div class="gp-member-body">
        <div class="gp-member-row">
          <span class="gp-member-name">${UyDosh.escapeHtml(name)}</span>
          <span class="gp-role gp-role-${roleKey}">${UyDosh.escapeHtml(memberRoleLabel(roleKey, lang))}</span>
          <span class="gp-member-trail">
            ${match}
            <span class="gp-chevron" aria-hidden="true">${UyDosh.iconChrome?.('chevronRight') || ''}</span>
          </span>
        </div>
        ${memberLifestyleHtml(member, roleKey)}
        ${leave}
      </div>
    </div>`;
  if (!removable) {
    return `<article class="gp-member" data-member-id="${userId}">${front}</article>`;
  }
  return `
    <article class="gp-member gp-member-swipeable" data-member-id="${userId}" data-member-name="${UyDosh.escapeHtml(name)}">
      <button type="button" class="gp-swipe-remove" data-remove-member="${userId}" data-haptic="heavy">
        ${UyDosh.iconTrash()}
        <span>${UyDosh.escapeHtml(UyDosh.t('account.removeFromGroup', lang))}</span>
      </button>
      ${front}
    </article>`;
}

function participantsSheetHtml(listing, members, lang) {
  const people = peopleForAvatarStack(listing, members);
  const names = people.map((m) => String(m.name || '').trim()).filter(Boolean).join(', ');
  const count = people.length || members.length;
  const avatars = accountAvatarStackHtml(people);
  const cards = members.map((member) => memberCardHtml(member, listing, lang)).join('');
  return `
    <div class="gp-backdrop" data-gp-close></div>
    <div class="gp-sheet" role="dialog" aria-modal="true" aria-labelledby="gp-sheet-title">
      <div class="gp-handle" aria-hidden="true"></div>
      <div class="gp-sheet-head">
        <h2 id="gp-sheet-title">${UyDosh.escapeHtml(UyDosh.t('account.participantProfiles', lang))}</h2>
        <span class="gp-status-pill">${UyDosh.escapeHtml(groupStatusLabel(listing, lang))}</span>
        <div class="gp-summary">
          <span class="account-participants-avatars gp-summary-avatars">${avatars}</span>
          <div class="gp-summary-text">
            <div class="gp-summary-names">${UyDosh.escapeHtml(names)}</div>
            <div class="gp-summary-count">${UyDosh.escapeHtml(UyDosh.t('account.groupOfPeople', lang).replace('{count}', String(count)))}</div>
          </div>
        </div>
      </div>
      <div class="gp-list">${cards || `<p class="gp-empty">${UyDosh.escapeHtml(UyDosh.t('account.participants', lang))}</p>`}</div>
    </div>
    <div class="gp-confirm" data-gp-confirm hidden></div>`;
}

function renderParticipantsSheet() {
  if (!participantsRoot || !participantsSheetState.listing) return;
  const lang = UyDosh.getLang();
  participantsRoot.innerHTML = participantsSheetHtml(
    participantsSheetState.listing,
    participantsSheetState.members,
    lang,
  );
  if (typeof UyDosh.hydrateIcons === 'function') UyDosh.hydrateIcons(participantsRoot);
  bindParticipantsSheetEvents();
}

function listingFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.id) return payload;
  if (payload.data?.id) return payload.data;
  if (payload.listing?.id) return payload.listing;
  return null;
}

async function resolveParticipantsListing(listingOrId) {
  if (listingOrId && typeof listingOrId === 'object' && listingOrId.id) return listingOrId;
  const listingId = Number(listingOrId);
  if (!Number.isFinite(listingId) || listingId < 1) return null;
  const owned = state.myListings.find((l) => Number(l?.id) === listingId);
  if (owned) return owned;
  const joined = state.memberGroupListings.find((l) => Number(l?.id) === listingId);
  if (joined) return joined;
  const payload = await UyDosh.fetchListing(listingId);
  return listingFromPayload(payload);
}

async function openParticipantsSheet(listingOrId, { backTo } = {}) {
  if (!participantsRoot) return;
  let listing;
  try {
    listing = await resolveParticipantsListing(listingOrId);
  } catch (err) {
    console.error('Failed to load group listing', err);
    return;
  }
  const listingId = Number(listing?.id);
  if (!listing || !Number.isFinite(listingId) || listingId < 1) return;
  UyDosh.haptic?.light?.();
  const me = currentUserId();
  let ownerId = Number(listing.user_id ?? listing.user?.id);
  participantsSheetState.backTo = backTo || `${location.pathname}${location.search}`;
  participantsSheetState.listingId = listingId;
  participantsSheetState.listing = listing;
  participantsSheetState.isOwner = me > 0 && me === ownerId;
  participantsSheetState.members = [];
  participantsRoot.hidden = false;
  participantsRoot.classList.add('is-open');
  participantsRoot.innerHTML = `
    <div class="gp-backdrop" data-gp-close></div>
    <div class="gp-sheet" role="dialog" aria-modal="true">
      <div class="gp-handle" aria-hidden="true"></div>
      <div class="gp-sheet-head">
        <h2>${UyDosh.escapeHtml(UyDosh.t('account.participantProfiles'))}</h2>
      </div>
      <div class="gp-list"><div class="gp-loading" aria-busy="true"><span class="loading-spinner" aria-hidden="true"></span></div></div>
    </div>`;
  participantsRoot.querySelector('[data-gp-close]')?.addEventListener('click', closeParticipantsSheet);
  try {
    const [freshListing, members] = await Promise.all([
      UyDosh.fetchListing(listingId).then(listingFromPayload).catch(() => null),
      UyDosh.fetchListingGroupMembers(listingId),
    ]);
    if (freshListing?.group_context) {
      participantsSheetState.listing = { ...listing, ...freshListing };
      listing = participantsSheetState.listing;
      ownerId = Number(listing.user_id ?? listing.user?.id);
      participantsSheetState.isOwner = me > 0 && me === ownerId;
    }
    const rows = Array.isArray(members) ? [...members] : [];
    rows.sort((a, b) => {
      if (Number(a.user_id) === ownerId) return -1;
      if (Number(b.user_id) === ownerId) return 1;
      return 0;
    });
    participantsSheetState.members = rows;
    const ids = [...new Set(rows.map((m) => Number(m.user_id)).filter((id) => id > 0))];
    const profileIds = me > 0 ? [...new Set([me, ...ids])] : ids;
    const profiles = await Promise.all(profileIds.map((id) => UyDosh.fetchProfile(id).catch(() => null)));
    participantsSheetState.profilesById = {};
    profileIds.forEach((id, i) => {
      const profile = profiles[i];
      if (profile) participantsSheetState.profilesById[id] = profile;
    });
    participantsSheetState.myProfile = me > 0 ? participantsSheetState.profilesById[me] || null : null;
    renderParticipantsSheet();
  } catch (err) {
    console.error('Failed to load group members', err);
    closeParticipantsSheet();
  }
}

function bindMemberSwipe(card) {
  const front = card.querySelector('.gp-member-front');
  if (!front) return;
  const max = 132;
  let startX = 0;
  let startY = 0;
  let dx = 0;
  let tracking = false;
  let open = false;
  let swiped = false;

  const setX = (x) => {
    dx = Math.min(0, Math.max(-max, x));
    front.style.transform = `translateX(${dx}px)`;
  };

  card.addEventListener('pointerdown', (event) => {
    if (event.target.closest('[data-remove-member], [data-leave-group]')) return;
    tracking = true;
    swiped = false;
    startX = event.clientX;
    startY = event.clientY;
    front.style.transition = 'none';
    card.setPointerCapture?.(event.pointerId);
  });
  card.addEventListener('pointermove', (event) => {
    if (!tracking) return;
    const moveX = event.clientX - startX;
    const moveY = event.clientY - startY;
    if (Math.abs(moveY) > Math.abs(moveX) && Math.abs(moveX) < 8) return;
    if (Math.abs(moveX) > 10) swiped = true;
    setX((open ? -max : 0) + moveX);
  });
  const end = () => {
    if (!tracking) return;
    tracking = false;
    front.style.transition = 'transform 0.18s ease';
    open = dx < -56;
    setX(open ? -max : 0);
  };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', end);
  card.addEventListener('click', (event) => {
    if (event.target.closest('[data-remove-member], [data-leave-group]')) return;
    if (swiped || open) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const userId = Number(card.getAttribute('data-member-id'));
    openMemberProfile(userId);
  });
}

function bindParticipantsSheetEvents() {
  participantsRoot.querySelector('[data-gp-close]')?.addEventListener('click', closeParticipantsSheet);
  for (const card of participantsRoot.querySelectorAll('.gp-member-swipeable')) {
    bindMemberSwipe(card);
  }
  for (const front of participantsRoot.querySelectorAll('[data-open-profile]')) {
    if (front.closest('.gp-member-swipeable')) continue;
    front.addEventListener('click', (event) => {
      if (event.target.closest('[data-leave-group]')) return;
      openMemberProfile(front.getAttribute('data-open-profile'));
    });
  }
  for (const btn of participantsRoot.querySelectorAll('[data-remove-member]')) {
    btn.addEventListener('click', () => {
      const card = btn.closest('[data-member-id]');
      const userId = Number(btn.getAttribute('data-remove-member'));
      const name = card?.getAttribute('data-member-name') || '';
      openRemoveConfirm(userId, name);
    });
  }
  participantsRoot.querySelector('[data-leave-group]')?.addEventListener('click', async () => {
    if (participantsSheetState.busy) return;
    participantsSheetState.busy = true;
    try {
      await UyDosh.leaveListingGroup(participantsSheetState.listingId);
      UyDosh.haptic?.success?.();
      const listingId = participantsSheetState.listingId;
      closeParticipantsSheet();
      document.dispatchEvent(new CustomEvent('uydosh-group-roster-changed', { detail: { listingId } }));
      if (isAccountPage) {
        await Promise.all([loadGroupChats(), loadMemberGroupListings(), loadGroupCreateEligibility()]);
        renderActiveTab();
      }
    } catch (err) {
      console.error('Failed to leave group', err);
      showTelegramAlert(UyDosh.t('account.removeError'));
    } finally {
      participantsSheetState.busy = false;
    }
  });
}

function removeReasonIcon(key) {
  if (key === 'inactive') return UyDosh.iconClock?.() || '';
  if (key === 'rules') return UyDosh.iconChrome?.('alertCircle') || '';
  if (key === 'notFit') return UyDosh.iconChrome?.('person') || '';
  if (key === 'requested') return UyDosh.iconChrome?.('chevronLeft') || '';
  return UyDosh.iconChrome?.('moreHorizontal') || '';
}

function openRemoveConfirm(memberUserId, name) {
  const lang = UyDosh.getLang();
  const host = participantsRoot.querySelector('[data-gp-confirm]');
  if (!host) return;
  const member = participantsSheetState.members.find((m) => Number(m.user_id) === memberUserId);
  const reasons = REMOVE_REASON_KEYS.map((key) => `
    <button type="button" class="gp-reason" data-reason-key="${key}" data-haptic="selection">
      <span class="icon" aria-hidden="true">${removeReasonIcon(key)}</span>
      <span>${UyDosh.escapeHtml(UyDosh.t(`account.removeReason.${key}`, lang))}</span>
    </button>`).join('');
  host.hidden = false;
  host.innerHTML = `
    <div class="gp-confirm-card" role="alertdialog" aria-labelledby="gp-confirm-title">
      <h3 id="gp-confirm-title">${UyDosh.escapeHtml(UyDosh.t('account.removeFromGroupTitle', lang))}</h3>
      <div class="gp-confirm-user">
        ${participantAvatarHtml(member || { name }, 0)}
        <p>${UyDosh.escapeHtml(UyDosh.t('account.removeFromGroupBody', lang).replace('{name}', name))}</p>
      </div>
      <div class="gp-reason-label">${UyDosh.escapeHtml(UyDosh.t('account.removeReasonLabel', lang))}</div>
      <div class="gp-reasons">${reasons}</div>
      <div class="gp-confirm-actions">
        <button type="button" class="gp-confirm-cancel" data-gp-confirm-cancel>${UyDosh.escapeHtml(UyDosh.t('account.removeCancel', lang))}</button>
        <button type="button" class="gp-confirm-remove" data-gp-confirm-ok data-haptic="heavy">${UyDosh.escapeHtml(UyDosh.t('account.removeConfirm', lang))}</button>
      </div>
    </div>`;
  if (typeof UyDosh.hydrateIcons === 'function') UyDosh.hydrateIcons(host);
  let reasonText = '';
  for (const btn of host.querySelectorAll('[data-reason-key]')) {
    btn.addEventListener('click', () => {
      for (const other of host.querySelectorAll('[data-reason-key]')) {
        other.setAttribute('aria-pressed', other === btn ? 'true' : 'false');
      }
      reasonText = UyDosh.t(`account.removeReason.${btn.getAttribute('data-reason-key')}`, lang);
    });
  }
  host.querySelector('[data-gp-confirm-cancel]')?.addEventListener('click', () => {
    host.hidden = true;
    host.innerHTML = '';
  });
  host.querySelector('[data-gp-confirm-ok]')?.addEventListener('click', async () => {
    if (participantsSheetState.busy) return;
    participantsSheetState.busy = true;
    const okBtn = host.querySelector('[data-gp-confirm-ok]');
    if (okBtn) okBtn.disabled = true;
    try {
      await UyDosh.removeListingGroupMember(participantsSheetState.listingId, memberUserId, {
        reason: reasonText,
      });
      UyDosh.haptic?.success?.();
      host.hidden = true;
      host.innerHTML = '';
      participantsSheetState.members = participantsSheetState.members.filter(
        (m) => Number(m.user_id) !== memberUserId,
      );
      dropRemovedMemberFromCaches(participantsSheetState.listingId, memberUserId);
      renderParticipantsSheet();
      if (isAccountPage) renderActiveTab();
      document.dispatchEvent(new CustomEvent('uydosh-group-roster-changed', {
        detail: { listingId: participantsSheetState.listingId },
      }));
    } catch (err) {
      console.error('Failed to remove member', err);
      showTelegramAlert(UyDosh.t('account.removeError', lang));
      if (okBtn) okBtn.disabled = false;
    } finally {
      participantsSheetState.busy = false;
    }
  });
}

window.UyDosh.openGroupParticipantsSheet = openParticipantsSheet;

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && participantsRoot && !participantsRoot.hidden) {
    const confirm = participantsRoot.querySelector('[data-gp-confirm]');
    if (confirm && !confirm.hidden) {
      confirm.hidden = true;
      confirm.innerHTML = '';
      return;
    }
    closeParticipantsSheet();
  }
});
