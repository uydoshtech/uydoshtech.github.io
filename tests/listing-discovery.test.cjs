const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ window: {}, URLSearchParams });
vm.runInContext(fs.readFileSync('assets/listing-discovery.js', 'utf8'), context);
const D = context.window.UyDoshDiscovery;
const plain = value => JSON.parse(JSON.stringify(value));
const group = { id: 10, price: 100, min_price: 80, max_price: 120, group_size_target: 3,
  group_context: { is_group_forming: true, is_member: true, group_member_count: 2,
    group_forming_status: 'open', group_progress: { can_view_shortlist: true } } };

test('similar search carries type, station ahead of district, and 20% price band', () => {
  assert.deepEqual(plain(D.similarFilters({ listing_type_id: 2, price: 500, subway_station: { id: 4 }, location: { id: 7 } })),
    { listingTypeId: 2, subwayStationId: 4, minPrice: 400, maxPrice: 600 });
});
test('similar search falls back to district and omits missing price', () => {
  assert.deepEqual(plain(D.similarFilters({ listing_type_id: 2, price: 0, location: { id: 7 } })), { listingTypeId: 2, locationId: 7 });
});
test('search URLs round-trip context and reject malformed price ranges', () => {
  const link = D.searchUrl({ id: 42, listing_type_id: 2, price: 500 }, { group: 10 });
  const filters = D.readSearch(link.split('?')[1]);
  assert.equal(filters.group, 10); assert.equal(filters.exclude, 42); assert.equal(filters.minPrice, 400);
  assert.equal(D.readSearch('?search=similar&minPrice=900&maxPrice=1').minPrice, null);
  assert.equal(D.readSearch('?search=similar&subwayStationId=-1').subwayStationId, null);
  assert.equal(D.readSearch('?search=similar&minPrice=0').minPrice, 0);
});
test('group search targets housing without hiding over-budget candidates', () => {
  const parsed = D.readSearch(D.searchUrl(group, { group: 10, housing: true }).split('?')[1]);
  assert.equal(parsed.listingTypeId, 2); assert.equal(parsed.minPrice, null); assert.equal(parsed.maxPrice, null);
});
test('budget comparison uses target size and explicit ranges without hidden tolerance', () => {
  const budget = D.budget(group, { price: 360 });
  assert.equal(budget.fit, 'fits'); assert.equal(budget.share.max, 120); assert.equal(budget.total.max, 360);
  assert.equal(D.budget(group, { price: 361 }).fit, 'above');
  assert.equal(D.budget(group, { min_price: 300, max_price: 400 }).fit, 'partial');
});
test('missing budget or group size never produces a false fit', () => {
  assert.equal(D.budget({ price: 0, group_size_target: 3 }, { price: 300 }), null);
  assert.equal(D.budget({ price: 100 }, { price: 300 }), null);
});
test('shortlists require membership, minimum group size, and server capability', () => {
  assert.equal(D.canShortlist(group), true);
  assert.equal(D.canShortlist({ ...group, group_context: { ...group.group_context, is_member: false } }), false);
  assert.equal(D.canShortlist({ ...group, group_context: { ...group.group_context, group_member_count: 1 } }), false);
  assert.equal(D.canShortlist({ ...group, group_context: { ...group.group_context, group_forming_status: 'closed' } }), false);
});
test('list and map API requests forward station and price filters, including zero minimum', async () => {
  const calls = [];
  const source = fs.readFileSync('assets/uydosh-api.js', 'utf8');
  const api = vm.createContext({ fetchJson: (path, params) => calls.push({ path, params }) });
  for (const name of ['fetchListings', 'fetchListingsForMap']) {
    const start = source.indexOf(`function ${name}(`);
    const end = source.indexOf('\n}\n', start) + 2;
    vm.runInContext(source.slice(start, end), api);
    api[name]({ subwayStationId: 4, minPrice: 0, maxPrice: 600 });
  }
  for (const call of calls) {
    assert.equal(call.params.subwayStationId, 4);
    assert.equal(call.params.minPrice, 0); assert.equal(call.params.maxPrice, 600);
  }
});
