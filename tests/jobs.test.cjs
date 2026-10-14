const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup() {
  const elements = new Map();
  const calls = [];
  const events = {};
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: 'all', hidden: false, innerHTML: '', textContent: '', setAttribute() {}, handlers: {}, addEventListener(name, fn) { this.handlers[name] = fn; } });
    return elements.get(id);
  };
  const ctx = vm.createContext({
    UyDosh: { initTelegramMiniApp() {}, applyI18n() {}, API_BASE: 'https://api.example', getLang: () => 'en', t: key => key, escapeHtml: x => x.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;') },
    document: { getElementById: element, addEventListener: (name, fn) => events[name] = fn },
    window: { scrollTo() {} }, location: {}, URL, AbortController, Intl,
    setTimeout: () => 1, clearTimeout() {},
    fetch: (url, options) => new Promise(resolve => calls.push({ url, options, resolve })),
  });
  vm.runInContext(fs.readFileSync('assets/telegram-jobs.js', 'utf8'), ctx);
  const respond = async (index, data, ok = true) => {
    calls[index].resolve({ ok, json: async () => data });
    await new Promise(resolve => setImmediate(resolve));
  };
  return { element, calls, respond, events };
}
const data = { pages: 3, found: 50, items: [{ title: '<script>bad</script>', url: 'https://hh.uz/vacancy/123', employer: 'Company', city: 'Tashkent' }] };
test('pagination, category reset, and safe rendering', async () => {
  const s = setup();
  await s.respond(0, data);
  assert.match(s.element('jobs-list').innerHTML, /&lt;script>/);
  assert.equal(s.element('jobs-previous').disabled, true);
  s.element('jobs-next').handlers.click();
  assert.equal(s.calls[1].url.searchParams.get('page'), '1');
  await s.respond(1, { ...data, pages: 2 });
  assert.equal(s.element('jobs-next').disabled, true);
  s.element('job-category').value = 'remote';
  s.element('job-category').handlers.change();
  assert.equal(s.calls[2].url.searchParams.get('page'), '0');
  assert.equal(s.calls[2].url.searchParams.get('category'), 'remote');
});
test('late results cannot overwrite the selected category', async () => {
  const s = setup();
  s.element('job-category').value = 'junior';
  s.element('job-category').handlers.change();
  assert.equal(s.calls[0].options.signal.aborted, true);
  await s.respond(1, { pages: 0, found: 0, items: [] });
  await s.respond(0, data);
  assert.equal(s.element('jobs-status').textContent, 'jobs.empty');
  assert.equal(s.element('jobs-list').innerHTML, '');
});
test('errors show retry; retry and language changes preserve loaded state', async () => {
  const s = setup();
  await s.respond(0, null, false);
  assert.equal(s.element('jobs-retry').hidden, false);
  s.element('jobs-retry').handlers.click();
  await s.respond(1, data);
  assert.equal(s.element('jobs-retry').hidden, true);
  s.events['uydosh:langchange']();
  assert.equal(s.calls.length, 2);
  assert.match(s.element('jobs-list').innerHTML, /Company/);
});
test('an empty later page keeps previous-page navigation available', async () => {
  const s = setup();
  await s.respond(0, data);
  s.element('jobs-next').handlers.click();
  await s.respond(1, { pages: 1, found: 20, items: [] });
  assert.equal(s.element('jobs-pagination').hidden, false);
  assert.equal(s.element('jobs-previous').disabled, false);
  assert.equal(s.element('jobs-next').disabled, true);
});
