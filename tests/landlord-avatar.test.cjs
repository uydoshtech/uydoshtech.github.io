const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('assets/telegram-account.js', 'utf8');
const ctx = vm.createContext({ state: { groupChats: [] }, chatForListing: () => null,
  UyDosh: { escapeHtml: String, t: () => 'Landlord', iconChrome: () => '' } });
for (const name of ['participantsFromConversation', 'participantAvatarHtml', 'peopleForAvatarStack']) {
  const start = source.indexOf(`function ${name}(`);
  vm.runInContext(source.slice(start, source.indexOf('\n}', start) + 2), ctx);
}
test('inbox avatars recover landlord identity from listing context when roles are absent', () => {
  const people = ctx.peopleForAvatarStack({ group_context: { group_progress: { active_landlord_user_id: 9 } } }, [{ user_id: 1, name: 'Organizer' }, { user_id: 9, name: 'Landlord' }]);
  assert.doesNotMatch(ctx.participantAvatarHtml(people[0], 0), /avatar--landlord/);
  assert.match(ctx.participantAvatarHtml(people[1], 1), /avatar--landlord/);
});
test('explicit landlord roles work without context and missing IDs do not highlight anyone', () => {
  assert.match(ctx.participantAvatarHtml({ role: 'landlord_guest' }, 0), /avatar--landlord/);
  const people = ctx.peopleForAvatarStack({}, [{ user_id: 1, name: 'Member' }]);
  assert.doesNotMatch(ctx.participantAvatarHtml(people[0], 0), /avatar--landlord/);
});
