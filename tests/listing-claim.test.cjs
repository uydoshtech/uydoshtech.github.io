const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('assets/listing-detail-complaints.js', 'utf8');
function setup({eligible = true, stored = new Map(), claim, answer = 'later', username = 'alice'} = {}) {
  let click, callback, claims = 0, prompts = 0, renders = 0, reloads = 0;
  const button = {addEventListener: (_, fn) => { click = fn; }};
  const label = {}, subtitle = {};
  const banner = { hidden: true, isConnected: true, querySelector: selector => selector === '[data-claim-listing]' ? button : selector === '[data-claim-btn-label]' ? label : subtitle };
  const context = vm.createContext({
    document: {getElementById: () => null}, rootEl: {querySelector: () => banner},
    state: {}, console: {error() {}},
    localStorage: {getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value)},
    window: {alert() {}, Telegram: {WebApp: {showPopup: (options, cb) => { prompts++; callback = cb; if (answer !== null) cb(answer); }}}},
    UyDosh: {
      ensureTelegramMiniAppSession: async () => true, getSessionUserId: () => 7,
      checkListingClaimEligibility: async () => ({eligible, telegramUsername: username}),
      claimListing: async () => { claims++; return claim ? claim() : {listing: {id: 1, user_id: 7}}; },
      t: key => key === 'detail.claim.account' ? 'Account {username}' : key,
      haptic: {success() {}, error() {}},
    },
    render: () => { renders++; }, load: async () => { reloads++; }, showTelegramAlert() {},
  });
  vm.runInContext(source, context);
  return {context, banner, button, subtitle, stored, load: () => context.loadClaimBanner({id: 1}), click: () => click(), answer: value => callback(value), counts: () => ({claims,prompts,renders,reloads}), setEligible: value => {eligible = value;}};
}
test('ineligible viewers see no prompt or banner', async () => {
  const ui = setup({eligible: false}); await ui.load();
  assert.equal(ui.banner.hidden, true); assert.equal(ui.counts().prompts, 0);
});
test('Later remembers the user/listing and leaves the banner actionable', async () => {
  const ui = setup(); await ui.load(); await ui.load();
  assert.equal(ui.counts().prompts, 1); assert.equal(ui.counts().claims, 0);
  assert.equal(ui.banner.hidden, false); assert.equal(ui.subtitle.textContent, 'Account @alice');
  const reopened = setup({stored: ui.stored}); await reopened.load();
  assert.equal(reopened.counts().prompts, 0);
});
test('acceptance submits exactly once and updates the listing', async () => {
  const ui = setup({answer: null}); const pending = ui.load();
  await new Promise(resolve => setImmediate(resolve));
  await ui.click(); ui.answer('claim'); await pending;
  assert.deepEqual(ui.counts(), {claims: 1, prompts: 1, renders: 1, reloads: 0});
  assert.equal(ui.context.state.listing.user_id, 7);
});
test('network failure leaves retry available, unavailable ownership hides banner', async () => {
  const ui = setup({answer: 'claim', claim: async () => {throw Error('network');}});
  await ui.load(); assert.equal(ui.banner.hidden, false); assert.equal(ui.button.disabled, false);
  ui.setEligible(false); await ui.click();
  assert.equal(ui.banner.hidden, true); assert.equal(ui.counts().reloads, 1);
});
test('changed account while confirmation is open does not submit a claim', async () => {
  const ui = setup({answer: null}); const pending = ui.load();
  await new Promise(resolve => setImmediate(resolve));
  ui.context.UyDosh.getSessionUserId = () => 8;
  ui.answer('claim'); await pending;
  assert.equal(ui.counts().claims, 0);
});
