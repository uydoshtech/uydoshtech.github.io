const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = fs.readFileSync('assets/uydosh-core.js', 'utf8');
const ctx = vm.createContext({ localizedShort: d => d?.name || '', t: key => ({'location.allTashkent':'Весь Ташкент','location.districts.one':'{count} район Ташкента','location.districts.few':'{count} района Ташкента','location.districts.many':'{count} районов Ташкента'})[key] });
vm.runInContext(core.slice(core.indexOf('function listingTypeIdFromListing'), core.indexOf('function isRoommateNeededListing')), ctx);
const listing = (ids, type = 3) => ({listing_type_id:type,location:{name:'Legacy'},search_locations:ids.map(id=>({id,name:`District ${id}`}))});
test('cards distinguish one, two, several and all search districts', () => {
 assert.equal(ctx.listingLocationLabel(listing([4]),'ru'),'District 4');
 assert.equal(ctx.listingLocationLabel(listing([4,9]),'ru'),'District 4, District 9');
 assert.equal(ctx.listingLocationLabel(listing([1,2,3,4]),'ru'),'4 района Ташкента');
 assert.equal(ctx.listingLocationLabel(listing(Array.from({length:12},(_,i)=>i+1)),'ru'),'Весь Ташкент');
});
test('deduplicates districts and keeps offered housing location unchanged',()=>{
 assert.equal(ctx.listingLocationLabel(listing([4,4]),'ru'),'District 4');
 assert.equal(ctx.listingLocationLabel(listing([1,2,3],2),'ru'),'Legacy');
 assert.equal(ctx.listingLocationLabel(listing([1,2,3],1),'ru'),'3 района Ташкента');
});
test('map draws only selected district polygons and fits their combined bounds without pins',async()=>{
 const src=fs.readFileSync('assets/yandex-map.js','utf8');
 const data=JSON.parse(fs.readFileSync('assets/data/tashkent-districts.json')).districts;
 const polygons=[];let options,bounds;
 const instance={districtLayer:{collection:{add(o){if(o.id)polygons.push(o.id);}}}};
 const map={async setBounds(b){bounds=b;}};
 const c=vm.createContext({Set,Number,Error,window:{ymaps:{}},loadDistrictBoundaries:async()=>data,renderPinsMap:async(_,o)=>{options=o;return map;},activeMaps:{get:()=>instance},createDistrictPolygon:(_,d)=>({id:d.locationId}),createDistrictLabelPlacemark:()=>null,boundsFromRing:ring=>[[Math.min(...ring.map(p=>p[0])),Math.min(...ring.map(p=>p[1]))],[Math.max(...ring.map(p=>p[0])),Math.max(...ring.map(p=>p[1]))]],mergeBounds:(a,b)=>a?[[Math.min(a[0][0],b[0][0]),Math.min(a[0][1],b[0][1])],[Math.max(a[1][0],b[1][0]),Math.max(a[1][1],b[1][1])]]:b,refreshDistrictLabelVisibility(){}});
 vm.runInContext(src.slice(src.indexOf('  function boundsFromRing('), src.indexOf('  function locationFromBounds(')), c);
 vm.runInContext(src.slice(src.indexOf('  async function renderSearchDistrictMap'),src.indexOf('  async function renderPinsMap')),c);
 await c.renderSearchDistrictMap({}, {locationIds:[4,9],lang:'ru'});
 assert.deepEqual(polygons.sort((a,b)=>a-b),[4,9]);assert.equal(options.pins.length,0);assert.equal(options.showLayerControls,false);
 for(const d of data.filter(d=>[4,9].includes(d.locationId))) for(const [lat,lon] of d.outerRing) assert.ok(lat>=bounds[0][0] && lat<=bounds[1][0] && lon>=bounds[0][1] && lon<=bounds[1][1]);
 await assert.rejects(c.renderSearchDistrictMap({}, {locationIds:[999],lang:'ru'}),/unavailable/);
});
