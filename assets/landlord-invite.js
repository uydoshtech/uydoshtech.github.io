// Shared group-chat invitation card. Used in the messages inbox and on the
// group listing page so a landlord sees the same banner in both places.
(function () {
  const collapsedInviteIds = new Set();

  function inviteFacesHtml(members) {
    const people = Array.isArray(members) ? members.filter((member) => member && (member.avatar_url || member.name)) : [];
    if (!people.length) return '';
    const shown = people.slice(0, people.length > 4 ? 3 : people.length);
    const extra = people.length - shown.length;
    const faces = shown.map((person) => {
      if (person.avatar_url) {
        return `<img src="${UyDosh.escapeHtml(person.avatar_url)}" alt="" referrerpolicy="no-referrer" onerror="this.remove();" />`;
      }
      const initial = Array.from(String(person.name || '').trim())[0] || '';
      return `<span class="inbox-avatar-fallback">${UyDosh.escapeHtml(initial.toUpperCase())}</span>`;
    }).join('');
    const more = extra > 0 ? `<span class="inbox-avatar-fallback inbox-avatar-more">+${extra}</span>` : '';
    return `<span class="inbox-avatars landlord-invite-faces" aria-hidden="true">${faces}${more}</span>`;
  }

  function landlordInviteCardsHtml(invites, { busy = false, hideGroupLink = false, backTo = '' } = {}) {
    const e = UyDosh.escapeHtml;
    const t = (key) => UyDosh.t('chat.invite.' + key);
    return (invites || []).map((invite) => {
      const id = Number(invite.invite_id);
      const expanded = !collapsedInviteIds.has(id);
      const disabled = busy ? 'disabled' : '';
      const faces = inviteFacesHtml(invite.members);
      const groupHref = UyDosh.listingPageUrl(invite.group_listing_id, backTo ? { backTo } : {});
      const groupLink = hideGroupLink ? '' : `<a class="landlord-invite-group" href="${e(groupHref)}">${e(t('viewGroup'))}<span aria-hidden="true">${UyDosh.iconChrome('chevronRight')}</span></a>`;
      return `<article class="landlord-invite-card" data-invite-id="${id}" data-expanded="${expanded ? 'true' : 'false'}">
        <button type="button" class="landlord-invite-head" data-invite-toggle aria-expanded="${expanded ? 'true' : 'false'}" aria-label="${e(t(expanded ? 'collapse' : 'expand'))}">
          <span class="landlord-invite-head-text">
            ${faces}
            <p class="landlord-invite-kicker">${e(t('title'))}</p>
            <p class="landlord-invite-title">${e(invite.group_listing_title || '#' + invite.group_listing_id)}</p>
          </span>
          <span class="inbox-toggle" aria-hidden="true">
            <span class="inbox-chevron-up">${UyDosh.iconChrome('chevronUp')}</span>
            <span class="inbox-chevron-down">${UyDosh.iconChrome('chevronDown')}</span>
          </span>
        </button>
        <div class="landlord-invite-body">
          <p class="landlord-invite-hint">${e(t('hint'))}</p>
          ${groupLink}
          <a class="landlord-invite-listing" href="${e(UyDosh.listingPageUrl(invite.housing_listing_id, backTo ? { backTo } : {}))}">${e(invite.housing_listing_title || '#' + invite.housing_listing_id)}</a>
          <div class="landlord-invite-actions">
            <button type="button" class="landlord-invite-decline" data-invite-decline="${id}" ${disabled}>${e(t('decline'))}</button>
            <button type="button" class="landlord-invite-accept" data-invite-accept="${id}" ${disabled}>${e(t('accept'))}</button>
          </div>
        </div>
      </article>`;
    }).join('');
  }

  function bindLandlordInviteCards(container, {
    getInvite,
    isBusy,
    setBusy,
    rerender,
    removeInvite,
    onAccepted,
    onError,
    after,
  }) {
    if (!container) return;
    const t = (key) => UyDosh.t('chat.invite.' + key);
    container.querySelectorAll('[data-invite-toggle]').forEach((button) => button.addEventListener('click', () => {
      const card = button.closest('.landlord-invite-card');
      const id = Number(card?.dataset.inviteId);
      if (!card || !id) return;
      const open = card.getAttribute('data-expanded') !== 'true';
      card.setAttribute('data-expanded', open ? 'true' : 'false');
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      button.setAttribute('aria-label', t(open ? 'collapse' : 'expand'));
      if (open) collapsedInviteIds.delete(id);
      else collapsedInviteIds.add(id);
    }));
    container.querySelectorAll('[data-invite-accept], [data-invite-decline]').forEach((button) => button.addEventListener('click', async () => {
      if (isBusy()) return;
      const accept = button.hasAttribute('data-invite-accept');
      const id = Number(button.dataset.inviteAccept || button.dataset.inviteDecline);
      const invite = getInvite(id);
      if (!invite) return;
      setBusy(true);
      rerender();
      try {
        const response = await UyDosh.respondToLandlordInvite(invite.group_listing_id, id, accept);
        removeInvite(id);
        setBusy(false);
        if (accept && response?.conversation_id && typeof onAccepted === 'function') {
          onAccepted(response);
          return;
        }
        rerender();
        if (typeof after === 'function') await after();
      } catch (err) {
        setBusy(false);
        if (typeof onError === 'function') onError(err);
        else rerender();
      }
    }));
  }

  UyDosh.landlordInviteCardsHtml = landlordInviteCardsHtml;
  UyDosh.bindLandlordInviteCards = bindLandlordInviteCards;
})();
