const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const live = require('../assets/friend-live-map.js');

const now = new Date('2026-10-09T12:00:00.000Z');

function friend(overrides) {
  return {
    userId: 1,
    name: 'A',
    latitude: 41.31,
    longitude: 69.28,
    updatedAt: now.toISOString(),
    mutual: false,
    ...overrides,
  };
}

test('followers filter keeps a subscriber who shared, mutual filter does not', () => {
  const people = [
    friend({ userId: 1, mutual: false }),
    friend({ userId: 3, mutual: true }),
  ];
  assert.deepEqual(live.visibleFriendMarkers(people, 'followers', now).map((row) => row.userId), [1, 3]);
  assert.deepEqual(live.visibleFriendMarkers(people, 'mutual', now).map((row) => row.userId), [3]);
});

test('a stale or removed point disappears from the map', () => {
  const stale = friend({
    updatedAt: new Date(now.getTime() - live.FRIEND_LOCATION_TTL_MS - 1).toISOString(),
  });
  assert.deepEqual(live.visibleFriendMarkers([stale], 'followers', now), []);
  const fresh = friend({ userId: 8 });
  const afterRemove = live.applyFriendLocationEvent([fresh], { type: 'remove', userId: 8 });
  assert.deepEqual(afterRemove, []);
});

test('an update replaces the previous point for that person', () => {
  const next = live.applyFriendLocationEvent(
    [friend({ latitude: 41 })],
    { type: 'upsert', friend: friend({ latitude: 42.5 }) },
  );
  assert.equal(next.length, 1);
  assert.equal(next[0].latitude, 42.5);
});

test('your own live point stays on the map in every filter', () => {
  const people = [
    friend({ userId: 7, self: true, mutual: false }),
    friend({ userId: 3, mutual: true }),
  ];
  assert.deepEqual(live.visibleFriendMarkers(people, 'mutual', now).map((row) => row.userId), [7, 3]);
  assert.deepEqual(live.visibleFriendMarkers(people, 'followers', now).map((row) => row.userId), [7, 3]);
  assert.deepEqual(live.visibleFriendMarkers(people, 'following', now).map((row) => row.userId), [7, 3]);
});

test('the map filter separates followers, people you follow, and mutual', () => {
  const people = [
    friend({ userId: 1, mutual: false, followsMe: true }),
    friend({ userId: 3, mutual: true, followsMe: true }),
    friend({ userId: 9, iFollow: true, mutual: false, followsMe: false }),
  ];
  assert.deepEqual(live.visibleFriendMarkers(people, 'followers', now).map((row) => row.userId), [1, 3]);
  assert.deepEqual(live.visibleFriendMarkers(people, 'following', now).map((row) => row.userId), [3, 9]);
  assert.deepEqual(live.visibleFriendMarkers(people, 'mutual', now).map((row) => row.userId), [3]);
});

test('a friend stays at the last location for 5 minutes', () => {
  const recent = friend({
    updatedAt: new Date(now.getTime() - 4 * 60 * 1000).toISOString(),
  });
  assert.equal(live.visibleFriendMarkers([recent], 'followers', now).length, 1);
  const expired = friend({
    updatedAt: new Date(now.getTime() - live.FRIEND_LOCATION_TTL_MS - 1).toISOString(),
  });
  assert.deepEqual(live.visibleFriendMarkers([expired], 'followers', now), []);
  assert.equal(live.FRIEND_LOCATION_TTL_MS, 5 * 60 * 1000);
});

test('a pin can say how long ago coordinates were reported', () => {
  assert.deepEqual(live.friendLocationAge(now.toISOString(), now), { unit: 'underMinute', n: 0 });
  assert.deepEqual(
    live.friendLocationAge(new Date(now.getTime() - 20000).toISOString(), now),
    { unit: 'underMinute', n: 0 },
  );
  assert.deepEqual(
    live.friendLocationAge(new Date(now.getTime() - 90000).toISOString(), now),
    { unit: 'minutes', n: 1 },
  );
  assert.equal(live.friendLocationAge('nope', now), null);
  assert.equal(live.friendLocationAge(null, now), null);
  assert.equal(live.friendLocationAge('', now), null);
});

test('sharing is off unless the server says it is enabled', () => {
  assert.deepEqual(live.normalizeFriendLocationSettings(null), { enabled: false, audience: 'mutual' });
  assert.deepEqual(live.normalizeFriendLocationSettings({ enabled: true, audience: 'following' }), {
    enabled: true,
    audience: 'following',
  });
});

test('the account page exposes the Friends tab', () => {
  const html = fs.readFileSync('telegram/account.html', 'utf8');
  const account = fs.readFileSync('assets/telegram-account.js', 'utf8');
  assert.match(html, /data-account-tab="friends"/);
  assert.match(account, /TAB_FRIENDS = 'friends'/);
});
