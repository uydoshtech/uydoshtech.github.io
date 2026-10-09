const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('assets/telegram-create.js','utf8');
test('map clicks move the circle; slider updates kilometres as metres; teardown destroys the map',async()=>{
 const less={addEventListener(_,fn){this.click=fn;}},more={addEventListener(_,fn){this.click=fn;}};
 const input={value:'5',addEventListener(_,fn){this.input=fn;}}, output={}, error={},container={isConnected:true};
 let map,circle,pin; const handles=[];
 class MapMock {constructor(){map=this;this.geoObjects={add(){}};this.events={add:(_,fn)=>{this.click=fn;}};}destroy(){this.destroyed=true;}}
 class CircleMock {constructor(coords){circle=this;this.coords=coords;this.geometry={setRadius:n=>{this.radius=n;},setCoordinates:c=>{this.center=c;}};}}
 class PinMock {constructor(coords,properties,options){if(options?.draggable) handles.push(this);else pin=this;this.center=coords;this.geometry={setCoordinates:c=>{this.center=c;},getCoordinates:()=>this.center};this.handlers={};this.events={add:(name,fn)=>{this.handlers[name]=fn;}}}}
 const c=vm.createContext({state:{form:{searchArea:{latitude:41.31,longitude:69.28,radiusKm:1}}},stepPanelsEl:{querySelector:selector=>({'#search-area-map':container,'#search-radius':input,'#search-radius-value':output,'#search-area-error':error,'#search-radius-less':less,'#search-radius-more':more})[selector]},UyDosh:{getLang:()=> 'ru',loadYandexMapModule:async()=>({loadYandexScript:async()=>({Map:MapMock,Circle:CircleMock,Placemark:PinMock})})},updateWizardFooter(){}});
 vm.runInContext(source.slice(source.indexOf('let searchAreaMap ='),source.indexOf('function legacyLocationTabsHtml')),c);
 await c.mountSearchAreaMap();assert.equal(c.state.searchAreaMapReady,true);assert.equal(circle.coords[1],1000);assert.equal(pin.center[0],41.31);
 more.click();assert.equal(c.state.form.searchArea.radiusKm,1.1);assert.equal(circle.radius,1100);
 less.click();assert.equal(c.state.form.searchArea.radiusKm,1);assert.equal(less.disabled,true);
 input.value='10';input.input();assert.equal(more.disabled,true);assert.equal(circle.radius,10000);assert.equal(c.state.form.searchArea.radiusKm,10);
 map.click({get:()=>[41.32,69.3]});assert.equal(c.state.form.searchArea.latitude,41.32);assert.equal(circle.center[1],69.3);assert.equal(pin.center[0],41.32);assert.equal(pin.center[1],69.3);
 input.value='0';input.input();assert.equal(circle.radius,1000);assert.equal(c.state.form.searchArea.radiusKm,1);
 input.value='11';input.input();assert.equal(c.state.form.searchArea.radiusKm,10);
 assert.equal(handles.length,4);
 const handle=handles[0];
 handle.handlers.dragstart();
 handle.center=c.searchAreaEdgeCoordinates({...c.state.form.searchArea,radiusKm:3.4},0);
 handle.handlers.drag();assert.equal(c.state.form.searchArea.radiusKm,3.4);assert.equal(input.value,'3.4');assert.equal(circle.radius,3400);
 const centreBefore=c.state.form.searchArea.latitude;
 map.click({get:()=>[40,68]});assert.equal(c.state.form.searchArea.latitude,centreBefore);
 handle.center=c.searchAreaEdgeCoordinates({...c.state.form.searchArea,radiusKm:12},0);
 handle.handlers.dragend();assert.equal(c.state.form.searchArea.radiusKm,10);
 assert.ok(Math.abs(c.searchAreaDistanceKm(c.state.form.searchArea,handle.center)-10)<0.001);
 map.click({get:()=>[40,68]});assert.equal(c.state.form.searchArea.latitude,centreBefore);
 handle.handlers.dragstart();handle.center=[c.state.form.searchArea.latitude,c.state.form.searchArea.longitude];
 handle.handlers.dragend();assert.equal(c.state.form.searchArea.radiusKm,1);
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
 let map,circle,pin; const handles=[];
 class MapMock {constructor(){map=this;this.geoObjects={add(){}};this.events={add:()=>{this.clickRegistered=true;}};}destroy(){}}
 class CircleMock {constructor(){circle=this;this.geometry={setRadius:n=>{this.radius=n;}};}}
 class PinMock {constructor(coords,properties,options){if(options?.draggable) handles.push(this);else pin=this;this.center=coords;this.geometry={setCoordinates:c=>{this.center=c;},getCoordinates:()=>this.center};this.handlers={};this.events={add:(name,fn)=>{this.handlers[name]=fn;}}}}
 const c=vm.createContext({state:{form:{searchArea:{latitude:41.31,longitude:69.28,radiusKm:1,universityId:12}}},stepPanelsEl:{querySelector:s=>s==='#search-area-map'?container:s==='#search-radius'?input:{addEventListener(){}}},UyDosh:{getLang:()=> 'ru',loadYandexMapModule:async()=>({loadYandexScript:async()=>({Map:MapMock,Circle:CircleMock,Placemark:PinMock})})},updateWizardFooter(){}});
 vm.runInContext(source.slice(source.indexOf('let searchAreaMap ='),source.indexOf('function legacyLocationTabsHtml')),c);
 await c.mountSearchAreaMap();
 assert.equal(pin.center[0],41.31);
 assert.equal(map.clickRegistered,undefined);
 input.value='8';input.input();assert.equal(circle.radius,8000);
 assert.equal(handles.length,4);
 const handle=handles[1];handle.handlers.dragstart();
 handle.center=c.searchAreaEdgeCoordinates({...c.state.form.searchArea,radiusKm:2.5},Math.PI/2);
 handle.handlers.dragend();assert.equal(c.state.form.searchArea.radiusKm,2.5);
 assert.equal(c.state.form.searchArea.latitude,41.31);assert.equal(pin.center[0],41.31);
 assert.equal(c.state.form.searchArea.universityId,12);
});
