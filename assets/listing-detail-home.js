/* Group household lifecycle and recurring chores. */
(function () {
  const e = value => UyDosh.escapeHtml(String(value ?? ''));
  const t = key => UyDosh.t(`home.${key}`);
  function html() { return '<section class="map-section discovery-section group-home" data-group-home></section>'; }
  async function bind(listing) {
    const host = rootEl.querySelector('[data-group-home]');
    if (!host) return;
    const request = (suffix = '', body) => UyDosh.groupHomeRequest(listing.id, suffix, body);
    let data, busy = false;
    const today = () => new Date().toLocaleDateString('en-CA');
    function message(text) { host.querySelector('[data-home-status]').textContent = text; }
    async function refresh() {
      host.innerHTML = `<p role="status">${e(t('loading'))}</p>`;
      try { data = await request(); paint(); }
      catch { host.innerHTML = `<p role="status">${e(t('error'))}</p><button class="btn" data-home-retry>${e(t('retry'))}</button>`; host.querySelector('button').onclick = refresh; }
    }
    async function save(suffix, body) {
      if (busy) return;
      busy = true;
      host.querySelectorAll('button').forEach(b => b.disabled = true);
      try { await request(suffix, body); await refresh(); }
      catch { message(t('error')); }
      finally { busy = false; host.querySelectorAll('button').forEach(b => b.disabled = false); }
    }
    function paint() {
      const members = data.members || [];
      const owner = data.owner;
      const canEdit = !data.closed;
      host.innerHTML = `<h2>${e(t('title'))}</h2><p role="status" data-home-status></p>`;
      if (!data.home) {
        host.insertAdjacentHTML('beforeend', `<p>${e(t('intro'))}</p>${owner && canEdit ? `<form data-move-in>
          <label>${e(t('housing'))}<select name="housing_listing_id" required><option value="">${e(t('choose'))}</option></select></label>
          <label>${e(t('date'))}<input name="moved_in_on" type="date" value="${today()}" max="${today()}" required></label>
          <button class="btn primary" type="submit">${UyDosh.iconCheck()}${e(t('confirm'))}</button></form>` : `<p>${e(t('ownerOnly'))}</p>`}`);
        const form = host.querySelector('form');
        if (form) {
          let page = 1;
          (async () => {
            try {
              let result;
              do {
                result = await UyDosh.fetchGroupShortlist(listing.id, page++);
                if (!form.isConnected) return;
                for (const item of result.data || []) if (item.listing) {
                  const option = document.createElement('option'); option.value = item.listing_id;
                  option.textContent = item.listing.title || `#${item.listing_id}`;
                  form.elements.housing_listing_id.append(option);
                }
              } while (page <= Number(result.totalPages));
            } catch { if (form.isConnected) message(t('error')); }
          })();
          form.onsubmit = event => { event.preventDefault(); const fields = new FormData(form); save('/move-in', { housing_listing_id: Number(fields.get('housing_listing_id')), moved_in_on: fields.get('moved_in_on') }); };
        }
        return;
      }
      const housing = data.home.housing_listing_id;
      host.insertAdjacentHTML('beforeend', `<p><strong>${e(t('movedIn'))}</strong> · ${e(data.home.moved_in_on)}</p>
        ${housing ? `<a href="${e(UyDosh.listingPageUrl(housing))}">${e(t('housing'))} #${e(housing)}</a>` : ''}
        <h3>${e(t('chores'))}</h3>
        ${(data.chores || []).map(chore => `<article class="home-chore">
          <strong>${e(chore.title)}</strong><span>${e(members.find(m => Number(m.user_id) === Number(chore.assignee_id))?.name || `#${chore.assignee_id}`)} · ${e(chore.due_on)}</span>
          ${chore.repeat_days ? `<small>${e(t('repeat'))}: ${e(chore.repeat_days)} ${e(t('days'))}</small>` : ''}
          ${chore.completed_at ? `<span>${e(t('done'))}</span>` : canEdit && (owner || Number(chore.assignee_id) === Number(UyDosh.getSessionUserId())) ? `<button class="btn" data-complete="${chore.id}">${UyDosh.iconCheck()}${e(t('complete'))}</button>` : ''}
        </article>`).join('') || `<p>${e(t('empty'))}</p>`}
        ${canEdit ? `<form data-chore><h3>${e(t('add'))}</h3>
          <label>${e(t('task'))}<input name="title" maxlength="160" required></label>
          <label>${e(t('assignee'))}<select name="assignee_id" required>${members.map(m => `<option value="${e(m.user_id)}">${e(m.name || `#${m.user_id}`)}</option>`).join('')}</select></label>
          <label>${e(t('due'))}<input name="due_on" type="date" value="${today()}" required></label>
          <label>${e(t('repeat'))}<select name="repeat_days"><option value="0">${e(t('once'))}</option><option value="1">${e(t('daily'))}</option><option value="7">${e(t('weekly'))}</option><option value="14">${e(t('fortnight'))}</option></select></label>
          <p>${e(t('rotation'))}</p><button class="btn primary">${UyDosh.iconPlus()}${e(t('add'))}</button></form>` : ''}`);
      const form = host.querySelector('[data-chore]');
      if (form) form.onsubmit = event => { event.preventDefault(); const fields = Object.fromEntries(new FormData(form)); save('/chores', { ...fields, assignee_id: Number(fields.assignee_id), repeat_days: Number(fields.repeat_days) }); };
      host.querySelectorAll('[data-complete]').forEach(button => button.onclick = () => {
        const chore = data.chores.find(c => String(c.id) === button.dataset.complete);
        save(`/chores/${chore.id}/complete`, { due_on: chore.due_on });
      });
    }
    await refresh();
  }
  window.UyDoshGroupHome = { html, bind };
})();
