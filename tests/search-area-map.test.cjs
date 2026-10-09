const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('assets/telegram-create.js','utf8');
test('map clicks move the circle; slider updates kilometres as metres; teardown destroys the map',async()=>{
 const input={value:'5',addEventListener(_,fn){this.input=fn;}}, output={}, error={},container={isConnected:true};
 let map,circle;
 class MapMock {constructor(){map=this;this.geoObjects={add(){}};this.events={add:(_,fn)=>{this.click=fn;}};}destroy(){this.destroyed=true;}}
 class CircleMock {constructor(coords){circle=this;this.coords=coords;this.geometry={setRadius:n=>{this.radius=n;},setCoordinates:c=>{this.center=c;}};}}
 const c=vm.createContext({state:{form:{searchArea:{latitude:41.31,longitude:69.28,radiusKm:1}}},stepPanelsEl:{querySelector:selector=>({'#search-area-map':container,'#search-radius':input,'#search-radius-value':output,'#search-area-error':error})[selector]},UyDosh:{getLang:()=> 'ru',loadYandexMapModule:async()=>({loadYandexScript:async()=>({Map:MapMock,Circle:CircleMock})})},updateWizardFooter(){}});
 vm.runInContext(source.slice(source.indexOf('let searchAreaMap ='),source.indexOf('function legacyLocationTabsHtml')),c);
 await c.mountSearchAreaMap();assert.equal(c.state.searchAreaMapReady,true);assert.equal(circle.coords[1],1000);
 input.value='10';input.input();assert.equal(circle.radius,10000);assert.equal(c.state.form.searchArea.radiusKm,10);
 map.click({get:()=>[41.32,69.3]});assert.equal(c.state.form.searchArea.latitude,41.32);assert.equal(circle.center[1],69.3);
 input.value='0';input.input();assert.equal(circle.radius,1000);assert.equal(c.state.form.searchArea.radiusKm,1);
 input.value='11';input.input();assert.equal(c.state.form.searchArea.radiusKm,10);
 c.disposeSearchAreaMap();assert.equal(map.destroyed,true);assert.equal(c.state.searchAreaMapReady,false);
});

test('university coordinates reject missing and invalid values, accepting numeric DB coordinates',()=>{
 const c=vm.createContext({});
 vm.runInContext(source.slice(source.indexOf('function universityCoordinates('),source.indexOf('async function bindUniversityArea(')),c);
 assert.equal(c.universityCoordinates({latitude:null,longitude:69}),null);
 assert.equal(c.universityCoordinates({latitude:91,longitude:69}),null);
 assert.equal(c.universityCoordinates({latitude:'bad',longitude:69}),null);
 assert.equal(c.universityCoordinates({latitude:'41.31',longitude:'69.28'}).latitude,41.31);
});
test('university map locks the centre while retaining the radius slider',async()=>{
 const input={value:'5',addEventListener(_,fn){this.input=fn;}},container={isConnected:true};
 let map,circle;
 class MapMock {constructor(){map=this;this.geoObjects={add(){}};this.events={add:()=>{this.clickRegistered=true;}};}destroy(){}}
 class CircleMock {constructor(){circle=this;this.geometry={setRadius:n=>{this.radius=n;}};}}
 const c=vm.createContext({state:{form:{searchArea:{latitude:41.31,longitude:69.28,radiusKm:1,universityId:12}}},stepPanelsEl:{querySelector:s=>s==='#search-area-map'?container:s==='#search-radius'?input:{}},UyDosh:{getLang:()=> 'ru',loadYandexMapModule:async()=>({loadYandexScript:async()=>({Map:MapMock,Circle:CircleMock})})},updateWizardFooter(){}});
 vm.runInContext(source.slice(source.indexOf('let searchAreaMap ='),source.indexOf('function legacyLocationTabsHtml')),c);
 await c.mountSearchAreaMap();
 assert.equal(map.clickRegistered,undefined);
 input.value='8';input.input();assert.equal(circle.radius,8000);
 assert.equal(c.state.form.searchArea.universityId,12);
});
