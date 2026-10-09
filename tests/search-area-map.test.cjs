const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('assets/telegram-create.js','utf8');
test('map clicks move the circle; slider updates kilometres as metres; teardown destroys the map',async()=>{
 const button=()=>({isConnected:true,addEventListener(name,fn){this[name]=fn;},removeEventListener(){}});
 const less=button(),more=button();
 const input={value:'5',addEventListener(_,fn){this.input=fn;}}, output={}, error={},container={isConnected:true};
 let map,circle,pin; const handles=[]; const flags=[];
 class MapMock {constructor(container,options){map=this;this.controls=options.controls;this.geoObjects={add(){}};this.events={add:(_,fn)=>{this.click=fn;}};}destroy(){this.destroyed=true;}}
 class CircleMock {constructor(coords){circle=this;this.coords=coords;this.geometry={setRadius:n=>{this.radius=n;},setCoordinates:c=>{this.center=c;}};}}
 class PinMock {constructor(coords,properties,options){this.options=options;if(options?.zIndex===1100) handles.push(this);else if(options?.zIndex===1000) pin=this;else flags.push(this);this.center=coords;this.geometry={setCoordinates:c=>{this.center=c;},getCoordinates:()=>this.center};this.handlers={};this.events={add:(name,fn)=>{this.handlers[name]=fn;}}}}
 const c=vm.createContext({window:{addEventListener(){},removeEventListener(){}},document:{addEventListener(){},removeEventListener(){}},state:{form:{searchArea:{latitude:41.31,longitude:69.28,radiusKm:1}}},stepPanelsEl:{querySelector:selector=>({'#search-area-map':container,'#search-radius':input,'#search-radius-value':output,'#search-area-error':error,'#search-radius-less':less,'#search-radius-more':more})[selector]},UyDosh:{t:key=>key,getLang:()=> 'ru',loadYandexMapModule:async()=>({attachSearchAreaLayers:(container,map)=>{map.layersAttached=true;return ()=>map.destroy();},loadYandexScript:async()=>({Map:MapMock,Circle:CircleMock,Placemark:PinMock})})},updateWizardFooter(){}});
 vm.runInContext(source.slice(source.indexOf('let searchAreaMap ='),source.indexOf('function legacyLocationTabsHtml')),c);
 await c.mountSearchAreaMap();assert.equal(c.state.searchAreaMapReady,true);assert.equal(circle.coords[1],1000);assert.equal(map.controls.length,0);assert.equal(map.layersAttached,true);assert.equal(pin.center[0],41.31);
 more.click({detail:0});assert.equal(c.state.form.searchArea.radiusKm,1.1);assert.equal(circle.radius,1100);
 less.click({detail:0});assert.equal(c.state.form.searchArea.radiusKm,1);assert.equal(less.disabled,true);
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
 const radiusBeforeDrag=c.state.form.searchArea.radiusKm;
 pin.handlers.dragstart();pin.center=[41.33,69.31];pin.handlers.drag();
 assert.equal(c.state.form.searchArea.latitude,41.33);assert.equal(circle.center[1],69.31);
 assert.equal(c.state.form.searchArea.radiusKm,radiusBeforeDrag);
 assert.ok(Math.abs(c.searchAreaDistanceKm(c.state.form.searchArea,handles[0].center)-radiusBeforeDrag)<0.001);
 pin.handlers.dragend();assert.equal(flags.length,1);assert.equal(flags[0].center[0],41.31139);
 assert.equal(flags[0].options.draggable,false);
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
 let map,circle,pin; const handles=[]; const flags=[];
 class MapMock {constructor(container,options){map=this;this.controls=options.controls;this.geoObjects={add(){}};this.events={add:()=>{this.clickRegistered=true;}};}destroy(){}}
 class CircleMock {constructor(){circle=this;this.geometry={setRadius:n=>{this.radius=n;}};}}
 class PinMock {constructor(coords,properties,options){this.options=options;if(options?.zIndex===1100) handles.push(this);else if(options?.zIndex===1000) pin=this;else flags.push(this);this.center=coords;this.geometry={setCoordinates:c=>{this.center=c;},getCoordinates:()=>this.center};this.handlers={};this.events={add:(name,fn)=>{this.handlers[name]=fn;}}}}
 const c=vm.createContext({window:{addEventListener(){},removeEventListener(){}},document:{addEventListener(){},removeEventListener(){}},state:{form:{searchArea:{latitude:41.31,longitude:69.28,radiusKm:1,universityId:12}}},stepPanelsEl:{querySelector:s=>s==='#search-area-map'?container:s==='#search-radius'?input:{addEventListener(){},removeEventListener(){}}},UyDosh:{t:key=>key,getLang:()=> 'ru',loadYandexMapModule:async()=>({attachSearchAreaLayers:(container,map)=>{map.layersAttached=true;return ()=>map.destroy();},loadYandexScript:async()=>({Map:MapMock,Circle:CircleMock,Placemark:PinMock})})},updateWizardFooter(){}});
 vm.runInContext(source.slice(source.indexOf('let searchAreaMap ='),source.indexOf('function legacyLocationTabsHtml')),c);
 await c.mountSearchAreaMap();
 assert.equal(pin.center[0],41.31);
 assert.equal(map.clickRegistered,undefined);
 assert.equal(pin.options.draggable,false);assert.equal(pin.handlers.drag,undefined);
 input.value='8';input.input();assert.equal(circle.radius,8000);
 assert.equal(handles.length,4);
 const handle=handles[1];handle.handlers.dragstart();
 handle.center=c.searchAreaEdgeCoordinates({...c.state.form.searchArea,radiusKm:2.5},Math.PI/2);
 handle.handlers.dragend();assert.equal(c.state.form.searchArea.radiusKm,2.5);
 assert.equal(c.state.form.searchArea.latitude,41.31);assert.equal(pin.center[0],41.31);
 assert.equal(c.state.form.searchArea.universityId,12);
});

test('holding a chevron repeats, stops on release and limits, and never double-steps on click',()=>{
 const target=()=>({handlers:{},addEventListener(n,f){this.handlers[n]=f;},removeEventListener(n){delete this.handlers[n];}});
 const button=Object.assign(target(),{isConnected:true,disabled:false,setPointerCapture(){}}),win=target(),doc=target();
 let pending=null;
 const state={form:{searchArea:{radiusKm:2}}};
 const c=vm.createContext({state,window:win,document:doc,searchRadiusButtonCleanups:[],setTimeout(fn){pending=fn;return 1;},clearTimeout(){pending=null;},setSearchAreaRadius(value){state.form.searchArea.radiusKm=Math.min(10,Math.round(value*10)/10);button.disabled=state.form.searchArea.radiusKm===10;}});
 vm.runInContext(source.slice(source.indexOf('function bindSearchRadiusButton('),source.indexOf('async function mountSearchAreaMap(')),c);
 c.bindSearchRadiusButton(button,1);
 button.handlers.pointerdown({button:0,pointerId:1});assert.equal(state.form.searchArea.radiusKm,2.1);
 let next=pending;pending=null;next();assert.equal(state.form.searchArea.radiusKm,2.2);
 button.handlers.pointerup();assert.equal(pending,null);
 button.handlers.click({detail:1});assert.equal(state.form.searchArea.radiusKm,2.2);
 button.handlers.click({detail:0});assert.equal(state.form.searchArea.radiusKm,2.3);
 button.handlers.pointerdown({button:0,pointerId:1});win.handlers.blur();assert.equal(pending,null);
 button.handlers.pointerdown({button:0,pointerId:1});button.handlers.pointercancel();assert.equal(pending,null);
 button.handlers.pointerdown({button:0,pointerId:1});doc.hidden=true;doc.handlers.visibilitychange();assert.equal(pending,null);
 state.form.searchArea.radiusKm=9.9;button.handlers.pointerdown({button:0,pointerId:1});assert.equal(state.form.searchArea.radiusKm,10);assert.equal(pending,null);
 button.disabled=false;state.form.searchArea.radiusKm=5;button.handlers.pointerdown({button:0,pointerId:1});
 c.searchRadiusButtonCleanups.forEach(f=>f());assert.equal(pending,null);assert.equal(Object.keys(button.handlers).length,0);
});
