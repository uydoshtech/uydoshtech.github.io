// Read the metadata embedded in THIS page, never replace it with /build.json.
(function () {
  const build = window.UYDOSH_BUILD || null;
  const open = document.getElementById('build-info-open');
  const dialog = document.getElementById('build-info-dialog');
  if (!open || !dialog) return;
  const details = document.getElementById('build-info-details');
  const status = document.getElementById('build-info-status');
  const copy = document.getElementById('build-info-copy');
  const close = document.getElementById('build-info-close');
  const update = document.getElementById('build-info-update');
  let latest = null;
  let text = '';
  const t = key => UyDosh.t(`build.${key}`);

  function render() {
    const label = build ? `Telegram · Build ${build.id}` : `Telegram · ${t('local')}`;
    open.textContent = label;
    open.hidden = false;
    text = build
      ? `${label}\n${t('date')}: ${new Date(build.builtAt).toLocaleString(UyDosh.getLang())}\nCommit: ${build.commit.slice(0, 7)}`
      : label;
    details.textContent = text;
    copy.textContent = t('copy');
    close.textContent = t('close');
    update.textContent = t('update');
  }

  open.addEventListener('click', async () => {
    render();
    status.textContent = '';
    dialog.showModal();
    // Optional update notice; an offline client still displays its own build.
    if (!build) return;
    try {
      const response = await fetch(`/build.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return;
      const candidate = await response.json();
      if (Number.isSafeInteger(candidate.run) && Number.isSafeInteger(candidate.attempt) &&
          (candidate.run > build.run || (candidate.run === build.run && candidate.attempt > build.attempt))) {
        latest = candidate;
        update.hidden = false;
      }
    } catch { /* Offline: the embedded metadata remains authoritative. */ }
  });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  copy.addEventListener('click', async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      status.textContent = t('copied');
    } catch {
      // Older WebViews: offer ordinary selectable text rather than losing it.
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(details);
      selection.removeAllRanges();
      selection.addRange(range);
      status.textContent = t('selectCopy');
    }
  });
  update.addEventListener('click', () => {
    if (!latest) return;
    const url = new URL(location.href);
    url.searchParams.set('build', latest.id);
    location.replace(url.href);
  });
  document.addEventListener('uydosh:langchange', render);
  render();
})();
