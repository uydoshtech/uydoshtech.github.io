const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('assets/listing-detail-description.js', 'utf8');

async function setup(overrides = {}, listing = { id: 42, description: 'Original', description_ru: 'Cached' }) {
  const buttons = ['original', 'uz', 'ru', 'en'].map(code => ({
    dataset: { descriptionLanguage: code }, setAttribute() {},
  }));
  let click;
  const controls = { querySelectorAll: () => buttons, addEventListener: (_, fn) => { click = fn; } };
  const description = { setAttribute() {}, removeAttribute() {} };
  const status = {};
  const section = { isConnected: true, querySelector: selector => selector === '.description-languages' ? controls : selector === '.description' ? description : status };
  const calls = [];
  const context = vm.createContext({
    rootEl: { querySelector: () => section },
    UyDosh: {
      getLang: () => 'en', escapeHtml: s => s.replaceAll('<', '&lt;'), t: s => s,
      fetchGeminiListingUiHidden: async () => false,
      ensureTelegramMiniAppSession: async () => true,
      translateListingDescription: async (...args) => { calls.push(args); return { translatedText: '<b>Translated</b>' }; },
      saveDescriptionTranslation: async () => {}, ...overrides,
    },
  });
  vm.runInContext(source, context);
  const html = context.listingDescriptionHtml(listing, listing.description);
  context.bindListingDescription(listing);
  await Promise.resolve();
  return { html, calls, description, status, controls, click: code => click({ target: { closest: () => buttons.find(b => b.dataset.descriptionLanguage === code) } }) };
}

test('cached translations and Original require no translation calls', async () => {
  const ui = await setup();
  await ui.click('ru');
  assert.equal(ui.description.textContent, 'Cached');
  await ui.click('original');
  assert.equal(ui.description.textContent, 'Original');
  assert.equal(ui.calls.length, 0);
});

test('new translations use original text, render as text, and are reused', async () => {
  const ui = await setup();
  await ui.click('en');
  assert.deepEqual(ui.calls, [['Original', 'en']]);
  assert.equal(ui.description.textContent, '<b>Translated</b>');
  await ui.click('original');
  await ui.click('en');
  assert.equal(ui.calls.length, 1);
});

test('Original wins over pending result and duplicate clicks do not send requests', async () => {
  let resolve;
  let count = 0;
  const ui = await setup({ translateListingDescription: () => { count++; return new Promise(r => { resolve = r; }); } });
  const pending = ui.click('en');
  await Promise.resolve();
  await ui.click('uz');
  await ui.click('original');
  resolve({ translatedText: 'Result' });
  await pending;
  assert.equal(count, 1);
  assert.equal(ui.description.textContent, 'Original');
});

test('quota failure preserves text and allows retry', async () => {
  const ui = await setup({ translateListingDescription: async () => { throw { status: 403, payload: { code: 'gemini_quota_exceeded' } }; } });
  await ui.click('en');
  assert.equal(ui.description.textContent, 'Original');
  assert.equal(ui.status.textContent, 'detail.translation.quota');
});

test('authentication failure does not submit translation', async () => {
  const ui = await setup({ ensureTelegramMiniAppSession: async () => false });
  await ui.click('en');
  assert.equal(ui.calls.length, 0);
  assert.equal(ui.status.textContent, 'detail.translation.auth');
});

test('server kill switch hides language controls', async () => {
  const ui = await setup({ fetchGeminiListingUiHidden: async () => true });
  assert.equal(ui.controls.hidden, true);
  await ui.click('en');
  assert.equal(ui.calls.length, 0);
});
