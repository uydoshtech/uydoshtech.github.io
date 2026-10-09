const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
test('district preview replaces selected outlines, clears deselection and stops after teardown',async()=>{
 const districts=JSON.parse(fs.readFileSync('assets/data/tashkent-districts.json')).districts;
 let collection,map;
 class Collection {constructor(){collection=this;this.items=[];}add(item){this.items.push(item);}removeAll(){this.items=[];}}
 class MapMock {constructor(){map=this;this.geoObjects={add(){}};}setBounds(){this.fit=true;}destroy(){this.destroyed=true;}}
 const c=vm.createContext({loadYandexScript:async()=>({Map:MapMock,GeoObjectCollection:Collection}),loadDistrictBoundaries:async()=>districts,createDistrictPolygon:(_,d)=>({id:d.locationId}),createDistrictLabelPlacemark:()=>null,boundsFromRing:()=>[[0,0],[1,1]],mergeBounds:(a,b)=>b,toYandexBounds:b=>b});
 const source=fs.readFileSync('assets/yandex-map.js','utf8');
 vm.runInContext(source.slice(source.indexOf('  async function createDistrictSelectionPreview('),source.indexOf('  window.UyDoshMap =')),c);
 const preview=await c.createDistrictSelectionPreview({isConnected:true},{lang:'ru'});
 preview.update([4,9]);assert.deepEqual(collection.items.map(i=>i.id).sort((a,b)=>a-b),[4,9]);assert.equal(map.fit,true);
 preview.update([9]);assert.deepEqual(collection.items.map(i=>i.id),[9]);
 preview.update([]);assert.equal(collection.items.length,0);
 preview.update(districts.map(d=>d.locationId));assert.equal(collection.items.length,12);
 preview.destroy();assert.equal(map.destroyed,true);
 preview.update([]);assert.equal(collection.items.length,12);
 assert.equal(await c.createDistrictSelectionPreview({isConnected:false}),null);
});
