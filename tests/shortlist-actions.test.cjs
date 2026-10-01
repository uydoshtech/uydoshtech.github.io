const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('assets/listing-detail-discovery.js', 'utf8');
const start = source.indexOf('    function actionHtml(item)');
const code = source.slice(start, source.indexOf('    const back =', start));
function html(context, extra = {}, item = { listing_id: 7, listing: {} }) {
  const sandbox = { UyDosh: { iconChrome: name => `<span>${name}</span>` }, context, pendingInvite: null, pendingListing: null, items: [], e: String, t: k => k, ...extra };
  vm.runInNewContext(code + '\nresult = actionHtml(item);', Object.assign(sandbox, { item }));
  return sandbox.result;
}
test('owner can invite and discuss without any rating requirement', () => {
  const result = html({ is_owner: true, group_conversation_id: 4, group_progress: { can_invite_landlord: true } });
  assert.match(result, /data-invite-landlord="7"/);
  assert.match(result, /data-discuss-housing="7"/);
});
test('ordinary participant can discuss but cannot invite or revoke', () => {
  const result = html({ is_owner: false, group_conversation_id: 4 }, {}, { listing_id: 7, listing: {}, pending_landlord_invite_id: 3 });
  assert.match(result, /data-discuss-housing/);
  assert.doesNotMatch(result, /data-invite-landlord|data-revoke-landlord/);
});
test('pending invitation blocks other invites and allows owner to revoke', () => {
  const context = { is_owner: true, group_progress: { can_invite_landlord: false } };
  assert.match(html(context, { pendingInvite: 3, pendingListing: 7 }), /data-revoke-landlord="3"/);
  assert.doesNotMatch(html(context, { pendingInvite: 3, pendingListing: 8 }), /data-invite-landlord/);
});
test('joined landlord or unavailable listing blocks invitations', () => {
  assert.doesNotMatch(html({ is_owner: true, group_progress: { can_invite_landlord: true, active_landlord_user_id: 9 } }), /data-invite-landlord/);
  assert.equal(html({ is_owner: true }, {}, { listing_id: 7 }), '');
});
