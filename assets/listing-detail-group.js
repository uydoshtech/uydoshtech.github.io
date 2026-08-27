// Part of listing.html's detail-page script, split out of listing-detail.js.
// Group-forming join requests: applicant request/withdraw and owner accept/decline.
// Loaded as a classic <script defer> sharing global scope with listing-detail.js.

      const GROUP_JOIN_PROFILE_ERROR = 'Please complete your profile before joining a group';
      const GROUP_PROFILE_PAGE = '/telegram/profile.html';
      let groupSectionBusy = false;

      function listingGroupContext(listing) {
        const ctx = listing?.group_context;
        return ctx && ctx.is_group_forming ? ctx : null;
      }

      function groupI18n(key, replacements) {
        let text = UyDosh.t(key);
        if (replacements) {
          for (const [name, value] of Object.entries(replacements)) {
            text = text.replace(`{${name}}`, String(value));
          }
        }
        return text;
      }

      function groupActions(ctx) {
        return ctx?.group_progress?.available_actions || [];
      }

      function groupJoinErrorMessage(err) {
        const code = String(err?.payload?.error || err?.message || '');
        if (code.includes(GROUP_JOIN_PROFILE_ERROR) || /complete your profile/i.test(code)) {
          return UyDosh.t('detail.group.profileRequired');
        }
        if (/already full/i.test(code)) return UyDosh.t('detail.group.full');
        if (code === 'GROUP_MEMBERSHIP_LIMIT_REACHED' || /membership/i.test(code)) {
          return UyDosh.t('detail.group.error');
        }
        return UyDosh.t('detail.group.error');
      }

      function isGroupJoinProfileError(err) {
        const code = String(err?.payload?.error || err?.message || '');
        return code.includes(GROUP_JOIN_PROFILE_ERROR) || /complete your profile/i.test(code);
      }

      function isGroupFormed(ctx) {
        if (!ctx || ctx.group_forming_status === 'closed') return false;
        if (ctx.group_forming_status === 'full') return true;
        const memberCount = Number(ctx.group_member_count) || 0;
        const target = Number(ctx.group_size_target) || 0;
        if (target > 0 && memberCount >= target) return true;
        return target > 0 && Number(ctx.group_spots_open) <= 0;
      }

      function groupSectionHtml(listing) {
        const ctx = listingGroupContext(listing);
        if (!ctx) return '';
        const lang = UyDosh.getLang();
        const isMiniApp = UyDosh.isMiniApp();
        const memberCount = Number(ctx.group_member_count) || 0;
        const target = Number(ctx.group_size_target) || 0;
        const pendingCount = Number(ctx.pending_join_request_count) || 0;
        const spots = groupI18n('detail.group.spots', { count: memberCount, target: target || '—' });
        const actions = groupActions(ctx);
        const status = ctx.group_forming_status;
        const formed = isGroupFormed(ctx);
        const showOwnerInbox = ctx.is_owner && (!formed || pendingCount > 0);

        let titleKey = 'detail.group.title';
        if (formed) titleKey = 'detail.group.formedTitle';
        else if (ctx.is_owner) titleKey = 'detail.group.requestsTitle';

        const findHousingCta = (isMiniApp && formed && (ctx.is_owner || ctx.is_member))
          ? `<a class="btn primary" href="uydosh://listing/${encodeURIComponent(listing.id)}" data-group-find-housing>${UyDosh.escapeHtml(UyDosh.t('detail.group.findHousing', lang))}</a>`
          : '';

        const pendingWithdraw = (actions.includes('withdraw_join_request') || ctx.my_join_request_status === 'pending')
          ? `<button type="button" class="btn" data-group-withdraw>${UyDosh.escapeHtml(UyDosh.t('detail.group.withdraw', lang))}</button>`
          : '';

        let body = '';
        if (!isMiniApp) {
          body = formed
            ? `<p class="group-section-status">${UyDosh.escapeHtml(UyDosh.t('detail.group.full', lang))}</p>`
            : `<p class="group-section-status">${UyDosh.escapeHtml(UyDosh.t('detail.group.openInApp', lang))}</p>`;
        } else if (status === 'closed') {
          body = `<p class="group-section-status">${UyDosh.escapeHtml(UyDosh.t('detail.group.closed', lang))}</p>`;
        } else if (formed) {
          body = `
            <p class="group-section-status">${UyDosh.escapeHtml(UyDosh.t('detail.group.full', lang))}</p>
            ${findHousingCta}
            ${pendingWithdraw}
            ${showOwnerInbox ? '<div class="group-requests" data-group-requests></div>' : ''}
          `;
        } else if (ctx.is_owner) {
          body = `
            <div class="group-requests" data-group-requests>
              <p class="group-section-status">${UyDosh.escapeHtml(UyDosh.t('detail.group.requestsEmpty', lang))}</p>
            </div>
          `;
        } else if (ctx.is_member) {
          body = `<p class="group-section-status">${UyDosh.escapeHtml(UyDosh.t('detail.group.member', lang))}</p>`;
        } else if (actions.includes('withdraw_join_request') || ctx.my_join_request_status === 'pending') {
          body = `
            <p class="group-section-status">${UyDosh.escapeHtml(UyDosh.t('detail.group.pending', lang))}</p>
            <button type="button" class="btn" data-group-withdraw>${UyDosh.escapeHtml(UyDosh.t('detail.group.withdraw', lang))}</button>
          `;
        } else if (actions.includes('request_to_join')) {
          body = `
            <label class="group-message-label" for="group-join-message">${UyDosh.escapeHtml(UyDosh.t('detail.group.messageLabel', lang))}</label>
            <textarea id="group-join-message" class="group-join-message" data-group-message maxlength="500" placeholder="${UyDosh.escapeHtml(UyDosh.t('detail.group.messagePlaceholder', lang))}"></textarea>
            <button type="button" class="btn primary" data-group-join>${UyDosh.escapeHtml(UyDosh.t('detail.group.join', lang))}</button>
          `;
        }

        const pendingHint = ctx.is_owner && pendingCount > 0
          ? `<span class="group-section-pending">${UyDosh.escapeHtml(groupI18n('detail.group.requestsPending', { count: pendingCount }))}</span>`
          : '';

        return `
          <section class="group-section" data-group-section id="group-section"${formed ? ' data-group-formed' : ''}>
            <div class="group-section-head">
              <h2>${UyDosh.escapeHtml(UyDosh.t(titleKey, lang))}</h2>
              <div class="group-section-meta">
                <span>${UyDosh.escapeHtml(spots)}</span>
                ${pendingHint}
              </div>
            </div>
            <p class="group-section-error" data-group-error hidden></p>
            ${body}
          </section>
        `;
      }

      function showGroupError(message, { profileLink = false } = {}) {
        const el = rootEl.querySelector('[data-group-error]');
        if (!el) return;
        if (profileLink) {
          el.innerHTML = `${UyDosh.escapeHtml(message)} <a href="${GROUP_PROFILE_PAGE}">${UyDosh.escapeHtml(UyDosh.t('detail.group.profileLink'))}</a>`;
        } else {
          el.textContent = message;
        }
        el.hidden = !message;
      }

      function groupRequestCardHtml(request, { formed = false } = {}) {
        const name = request.applicant_name || UyDosh.t('complaints.anonymous');
        const note = typeof request.message === 'string' ? request.message.trim() : '';
        const avatar = request.applicant_avatar
          ? `<img src="${UyDosh.escapeHtml(request.applicant_avatar)}" alt="" referrerpolicy="no-referrer" onerror="this.remove();" />`
          : UyDosh.iconChrome?.('person') || '';
        const approveBtn = formed
          ? ''
          : `<button type="button" class="btn primary" data-group-approve>${UyDosh.escapeHtml(UyDosh.t('detail.group.accept'))}</button>`;
        return `
          <article class="group-request-card" data-group-request-id="${UyDosh.escapeHtml(String(request.id))}">
            <span class="group-request-avatar" aria-hidden="true">${avatar}</span>
            <div class="group-request-body">
              <div class="group-request-row">
                <div class="group-request-name">${UyDosh.escapeHtml(name)}</div>
                <div class="group-request-actions">
                  ${approveBtn}
                  <button type="button" class="btn" data-group-reject>${UyDosh.escapeHtml(UyDosh.t('detail.group.decline'))}</button>
                </div>
              </div>
              ${note ? `<p class="group-request-note">${UyDosh.escapeHtml(note)}</p>` : ''}
            </div>
          </article>
        `;
      }

      function renderOwnerJoinRequests(requests) {
        const host = rootEl.querySelector('[data-group-requests]');
        if (!host) return;
        const formed = Boolean(rootEl.querySelector('[data-group-section][data-group-formed]'));
        const rows = Array.isArray(requests) ? requests : [];
        if (!rows.length) {
          if (formed) {
            host.innerHTML = '';
            host.hidden = true;
            return;
          }
          host.hidden = false;
          host.innerHTML = `<p class="group-section-status">${UyDosh.escapeHtml(UyDosh.t('detail.group.requestsEmpty'))}</p>`;
          return;
        }
        host.hidden = false;
        host.innerHTML = rows.map((request) => groupRequestCardHtml(request, { formed })).join('');
        for (const card of host.querySelectorAll('[data-group-request-id]')) {
          const requestId = Number(card.getAttribute('data-group-request-id'));
          card.querySelector('[data-group-approve]')?.addEventListener('click', () => {
            handleOwnerJoinDecision(requestId, 'approve', card);
          });
          card.querySelector('[data-group-reject]')?.addEventListener('click', () => {
            handleOwnerJoinDecision(requestId, 'reject', card);
          });
        }
      }

      async function refreshListingGroupSection() {
        const data = await UyDosh.fetchListing(listingId);
        state.listing = data;
        const host = rootEl.querySelector('[data-group-section]');
        const html = groupSectionHtml(data);
        if (host) {
          host.outerHTML = html || '';
        } else if (html) {
          rootEl.querySelector('.title-row')?.insertAdjacentHTML('afterend', html);
        }
        bindGroupSection();
        await loadGroupJoinRequests();
      }

      async function handleOwnerJoinDecision(requestId, action, card) {
        if (groupSectionBusy || !Number.isFinite(requestId)) return;
        groupSectionBusy = true;
        showGroupError('');
        const approveBtn = card.querySelector('[data-group-approve]');
        const rejectBtn = card.querySelector('[data-group-reject]');
        if (approveBtn) approveBtn.disabled = true;
        if (rejectBtn) rejectBtn.disabled = true;
        try {
          if (action === 'approve') {
            const formed = Boolean(rootEl.querySelector('[data-group-section][data-group-formed]'));
            if (formed) {
              showGroupError(UyDosh.t('detail.group.full'));
              if (approveBtn) approveBtn.disabled = false;
              if (rejectBtn) rejectBtn.disabled = false;
              return;
            }
            await UyDosh.approveListingGroupJoinRequest(listingId, requestId);
            UyDosh.haptic?.success?.();
          } else {
            await UyDosh.rejectListingGroupJoinRequest(listingId, requestId);
            UyDosh.haptic?.light?.();
          }
          await refreshListingGroupSection();
        } catch (err) {
          console.error('Group join decision failed', err);
          showGroupError(groupJoinErrorMessage(err));
          if (approveBtn) approveBtn.disabled = false;
          if (rejectBtn) rejectBtn.disabled = false;
        } finally {
          groupSectionBusy = false;
        }
      }

      async function handleGroupJoin() {
        if (groupSectionBusy) return;
        groupSectionBusy = true;
        showGroupError('');
        const btn = rootEl.querySelector('[data-group-join]');
        const messageEl = rootEl.querySelector('[data-group-message]');
        if (btn) {
          btn.disabled = true;
          btn.textContent = UyDosh.t('detail.group.joining');
        }
        try {
          await UyDosh.createListingGroupJoinRequest(listingId, {
            message: messageEl?.value,
          });
          UyDosh.haptic?.success?.();
          await refreshListingGroupSection();
        } catch (err) {
          console.error('Group join request failed', err);
          showGroupError(groupJoinErrorMessage(err), { profileLink: isGroupJoinProfileError(err) });
          if (btn) {
            btn.disabled = false;
            btn.textContent = UyDosh.t('detail.group.join');
          }
        } finally {
          groupSectionBusy = false;
        }
      }

      async function handleGroupWithdraw() {
        if (groupSectionBusy) return;
        groupSectionBusy = true;
        showGroupError('');
        const btn = rootEl.querySelector('[data-group-withdraw]');
        if (btn) {
          btn.disabled = true;
          btn.textContent = UyDosh.t('detail.group.withdrawing');
        }
        try {
          await UyDosh.withdrawListingGroupJoinRequest(listingId);
          UyDosh.haptic?.light?.();
          await refreshListingGroupSection();
        } catch (err) {
          console.error('Group withdraw failed', err);
          showGroupError(groupJoinErrorMessage(err));
          if (btn) {
            btn.disabled = false;
            btn.textContent = UyDosh.t('detail.group.withdraw');
          }
        } finally {
          groupSectionBusy = false;
        }
      }

      function bindGroupSection() {
        rootEl.querySelector('[data-group-join]')?.addEventListener('click', () => {
          handleGroupJoin();
        });
        rootEl.querySelector('[data-group-withdraw]')?.addEventListener('click', () => {
          handleGroupWithdraw();
        });
      }

      async function loadGroupJoinRequests() {
        const ctx = listingGroupContext(state.listing);
        if (!ctx?.is_owner || !UyDosh.isMiniApp()) return;
        if (isGroupFormed(ctx) && !(Number(ctx.pending_join_request_count) > 0)) return;
        try {
          const payload = await UyDosh.fetchListingGroupJoinRequests(listingId);
          const requests = payload?.data ?? payload?.requests ?? payload;
          renderOwnerJoinRequests(Array.isArray(requests) ? requests : []);
        } catch (err) {
          console.error('Failed to load join requests', err);
          showGroupError(UyDosh.t('detail.group.error'));
        }
        maybeScrollToGroupSection();
      }

      function maybeScrollToGroupSection() {
        const want = new URLSearchParams(location.search).get('group') === 'requests';
        const el = document.getElementById('group-section');
        if (!want || !el) return;
        requestAnimationFrame(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
