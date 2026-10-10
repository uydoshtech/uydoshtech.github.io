// Display rules for the Mini App Friends map.
// The server decides who granted access. This module only drops stale points
// and applies the followers / following / mutual filter on that already-allowed list.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.UyDoshFriendLive = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const FRIEND_LOCATION_TTL_MS = 5 * 60 * 1000;

  function isFreshFriendLocation(updatedAt, now, ttlMs) {
    const ttl = Number.isFinite(ttlMs) ? ttlMs : FRIEND_LOCATION_TTL_MS;
    const time = new Date(updatedAt).getTime();
    if (!Number.isFinite(time)) return false;
    const age = now.getTime() - time;
    return age <= ttl && age >= -5000;
  }

  function friendLocationAge(updatedAt, now) {
    if (updatedAt == null || updatedAt === '') return null;
    const time = new Date(updatedAt).getTime();
    const at = now instanceof Date ? now : new Date();
    if (!Number.isFinite(time)) return null;
    const seconds = Math.max(0, Math.floor((at.getTime() - time) / 1000));
    if (seconds < 60) return { unit: 'underMinute', n: 0 };
    return { unit: 'minutes', n: Math.floor(seconds / 60) };
  }

  // Presentation only: location ages and API values remain in minutes.
  function formatLocationDuration(minutes, translate) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    const parts = [];
    if (hours > 0) parts.push(translate('account.friends.durationHours').replace('{n}', String(hours)));
    if (remainder > 0 || hours === 0) parts.push(translate('account.friends.durationMinutes').replace('{n}', String(remainder)));
    return parts.join(' ');
  }

  function matchesFriendMapFilter(filter, friend) {
    const iFollow = friend?.iFollow === true || friend?.mutual === true;
    const followsMe = friend?.followsMe !== false;
    if (filter === 'mutual') return iFollow && followsMe;
    if (filter === 'following') return iFollow;
    return followsMe;
  }

  function visibleFriendMarkers(friends, filter, now) {
    const at = now instanceof Date ? now : new Date();
    return (Array.isArray(friends) ? friends : []).filter((friend) => {
      if (!friend || !(Number(friend.userId) > 0)) return false;
      if (!isFreshFriendLocation(friend.updatedAt, at)) return false;
      if (friend.self === true) return true;
      return matchesFriendMapFilter(filter, friend);
    });
  }

  function applyFriendLocationEvent(friends, event) {
    const list = Array.isArray(friends) ? friends.slice() : [];
    const userId = Number(event?.userId ?? event?.friend?.userId);
    if (!userId) return list;
    const without = list.filter((friend) => Number(friend.userId) !== userId);
    if (event?.type === 'remove') return without;
    if (event?.type === 'upsert' && event.friend) return without.concat([event.friend]);
    return list;
  }

  function normalizeFriendLocationSettings(payload) {
    return {
      enabled: payload?.enabled === true,
      audience: payload?.audience === 'following' ? 'following' : 'mutual',
    };
  }

  return {
    FRIEND_LOCATION_TTL_MS,
    isFreshFriendLocation,
    friendLocationAge,
    formatLocationDuration,
    matchesFriendMapFilter,
    visibleFriendMarkers,
    applyFriendLocationEvent,
    normalizeFriendLocationSettings,
  };
});
