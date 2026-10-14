(() => {
  'use strict';
  UyDosh.initTelegramMiniApp();
  UyDosh.applyI18n();
  const webApp = window.Telegram?.WebApp;
  webApp?.BackButton?.onClick(() => { location.href = '/telegram/'; });
  webApp?.BackButton?.show();
  const picker = document.getElementById('job-category');
  const list = document.getElementById('jobs-list');
  const status = document.getElementById('jobs-status');
  const retry = document.getElementById('jobs-retry');
  const pagination = document.getElementById('jobs-pagination');
  const previous = document.getElementById('jobs-previous');
  const next = document.getElementById('jobs-next');
  let page = 0, result = null, controller = null, requestId = 0, phase = 'loading';
  const t = key => UyDosh.t(`jobs.${key}`);
  const escape = value => UyDosh.escapeHtml(String(value ?? ''));
  const number = value => new Intl.NumberFormat(UyDosh.getLang()).format(value);

  function salaryHtml(salary) {
    if (!salary || (salary.from == null && salary.to == null)) return escape(t('noSalary'));
    const from = salary.from == null ? null : number(salary.from);
    const to = salary.to == null ? null : number(salary.to);
    const range = from && to ? `${from}–${to}` : from ? `${t('from')} ${from}` : `${t('to')} ${to}`;
    return escape(`${range} ${salary.currency || ''}${typeof salary.gross === 'boolean' ? ' · ' + t(salary.gross ? 'gross' : 'net') : ''}`);
  }
  function safeUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && ['hh.ru', 'hh.uz'].includes(url.hostname) && /^\/vacancy\/\d+$/.test(url.pathname) ? url.href : null;
    } catch { return null; }
  }
  function render() {
    document.title = `UyDosh — ${t('title')}`;
    retry.hidden = phase !== 'error';
    list.setAttribute('aria-busy', String(phase === 'loading'));
    pagination.hidden = phase !== 'ready' || (!result?.items.length && page === 0);
    if (phase !== 'ready') {
      status.textContent = t(phase === 'loading' ? 'loading' : 'error');
      list.innerHTML = '';
      return;
    }
    status.textContent = result.items.length ? t('count').replace('{count}', number(result.found)) : t('empty');
    list.innerHTML = result.items.map(job => {
      const url = safeUrl(job.url);
      if (!url) return '';
      const experience = job.experience === 'noExperience' ? t('no-experience') : job.experience === 'between1And3' ? t('junior') : '';
      return `<article class="job-card"><h2>${escape(job.title)}</h2><p class="job-salary">${salaryHtml(job.salary)}</p>${job.salary ? `<p class="job-salary-note">${escape(t('salaryDetails'))}</p>` : ''}<p class="job-meta">${escape([job.employer, job.city].filter(Boolean).join(' · '))}</p><p class="job-meta">${escape([experience, job.remote ? t('remoteBadge') : ''].filter(Boolean).join(' · '))}</p>${job.snippet ? `<p class="job-snippet">${escape(job.snippet)}</p>` : ''}<a class="job-link" href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(t('view'))} ↗</a></article>`;
    }).join('');
    previous.disabled = page === 0;
    next.disabled = page + 1 >= result.pages;
    document.getElementById('jobs-page').textContent = t('page').replace('{page}', number(page + 1)).replace('{pages}', number(Math.max(result.pages, page + 1)));
  }
  async function load() {
    controller?.abort();
    controller = new AbortController();
    const current = ++requestId;
    const activeController = controller;
    phase = 'loading';
    render();
    const timeout = setTimeout(() => activeController.abort(), 15000);
    try {
      const url = new URL(`${UyDosh.API_BASE}/jobs`);
      url.searchParams.set('category', picker.value);
      url.searchParams.set('page', String(page));
      const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: activeController.signal });
      if (!response.ok) throw new Error('Jobs unavailable');
      const data = await response.json();
      if (!Array.isArray(data.items) || !Number.isInteger(data.pages) || data.pages < 0 || !Number.isFinite(data.found)) throw new Error('Invalid jobs');
      if (current !== requestId) return;
      result = data;
      phase = 'ready';
    } catch {
      if (current !== requestId) return;
      phase = 'error';
    } finally {
      clearTimeout(timeout);
      if (current === requestId) render();
    }
  }
  picker.addEventListener('change', () => { page = 0; load(); });
  previous.addEventListener('click', () => { if (page > 0) { page--; load(); window.scrollTo({ top: 0 }); } });
  next.addEventListener('click', () => { if (result && page + 1 < result.pages) { page++; load(); window.scrollTo({ top: 0 }); } });
  retry.addEventListener('click', load);
  document.addEventListener('uydosh:langchange', () => { UyDosh.applyI18n(); render(); });
  load();
})();
