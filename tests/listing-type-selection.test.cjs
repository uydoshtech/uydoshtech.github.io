const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('assets/telegram-create.js', 'utf8');
function load() {
  const state = {form:{listingTypeId:null,selectedLocationIds:[],selectedStationIds:[],addressText:'',locationMode:'metro'},step:0};
  const element = () => ({classList:{toggle(){}},removeAttribute(){}});
  const context = vm.createContext({state, LISTING_TYPE_ROOM_NEEDED:1,LISTING_TYPE_ROOMMATE_NEEDED:2,LISTING_TYPE_GROUP_FORMING:3,LOCATION_MODE_METRO:'metro',LOCATION_MODE_UNIVERSITY:'university',LOCATION_MODE_RADIUS:'radius',LOCATION_MODE_DISTRICT:'district',STEP_COUNT:4,
    UyDosh:{getLang:()=> 'ru',t:key=>key,escapeHtml:s=>s,filterListingTypeIcon:()=>'<svg></svg>'},
    legacyLocationTabsHtml:()=>'<div id="search-location"></div>',roommateLocationSectionHtml:()=>'<input id="listing-address">',
    supportsMultiLocation:()=>true,updateDefaultTitle(){},renderStep(){},applyNearbyStations(){},updateTelegramBackButton(){},hideTelegramMainButton(){},
    formRoot:{hidden:false},successRoot:{hidden:true},wizardFooterEl:element(),wizardNextBtn:element(),wizardBackBtn:element(),wizardNextLabelEl:element(),wizardNextSpinnerEl:element(),wizardNextIconEl:element()});
  for (const [start,end] of [ ['function isDemandSideType(', 'function isGroupForming('], ['function listingTypeCycleOrder(', 'function listingTypeLabel('], ['function renderStep0(', 'const ADDRESS_SUGGEST_MIN_LENGTH'], ['function validateStep(', 'async function submitListing('], ['function updateWizardFooter(', 'function renderProgress('] ]) {
    vm.runInContext(source.slice(source.indexOf(start),source.indexOf(end)),context);
  }
  return context;
}
test('new listings begin unselected, hide locations, and disable Next',()=>{
 assert.match(source,/listingTypeId: null/);
 const c=load(),html=c.renderStep0('ru');
 assert.equal((html.match(/aria-pressed="false"/g)||[]).length,3);
 assert.doesNotMatch(html,/is-active|id="listing-address"|id="search-location"/);
 assert.equal(c.validateStep(0).anchor,'listingType');
 c.updateWizardFooter();assert.equal(c.wizardNextBtn.disabled,true);
});
test('each card selects exactly one type and exposes its existing location flow',()=>{
 const c=load();
 for(const id of [1,2,3,1]) {
  c.applyListingTypeId(String(id));
  assert.equal(c.state.form.listingTypeId,id);
  const html=c.renderStep0('ru');
  assert.equal((html.match(/aria-pressed="true"/g)||[]).length,1);
  assert.match(html,id===2?/id="listing-address"/:/id="search-location"/);
  c.updateWizardFooter();assert.equal(c.wizardNextBtn.disabled,false);
 }
 c.applyListingTypeId('99');assert.equal(c.state.form.listingTypeId,1);
 c.applyListingTypeId(null);assert.equal(c.state.form.listingTypeId,1);
});
test('required address, metro and district validation still blocks progress after selection',()=>{
 const c=load();
 c.applyListingTypeId(2);assert.equal(c.validateStep(0).anchor,'location');
 c.state.form.addressText='Amir Temur 10';assert.equal(c.validateStep(0),null);
 for(const id of [1,3]) {
  c.applyListingTypeId(id);c.state.form.locationMode='metro';
  assert.equal(c.validateStep(0).anchor,'location');
  c.state.form.selectedStationIds=[1];assert.equal(c.validateStep(0),null);
  c.state.form.locationMode='district';assert.equal(c.validateStep(0).anchor,'location');
  c.state.form.selectedLocationIds=[1];assert.equal(c.validateStep(0),null);
  c.state.form.selectedLocationIds=[];
 }
});
test('reselecting the active card keeps locations; switching clears metro selections',()=>{
 const c=load();c.applyListingTypeId(1);c.state.form.selectedStationIds=[1];
 c.applyListingTypeId(1);assert.equal(c.state.form.selectedStationIds.length,1);
 c.applyListingTypeId(3);assert.equal(c.state.form.selectedStationIds.length,0);
 c.state.submitting=true;c.updateWizardFooter();assert.equal(c.wizardNextBtn.disabled,true);
});
test('creation links never silently select a type and edit hydration retains stored types',()=>{
 const init=source.slice(source.indexOf("const params = new URLSearchParams(location.search)"));
 assert.doesNotMatch(init,/state\.form\.listingTypeId\s*=/);
 const hydrate=source.slice(source.indexOf('function hydrateFormFromListing('),source.indexOf('function hydrateFormFromListing(')+270);
 assert.match(hydrate,/state\.form\.listingTypeId = isDemandSideType\(typeId\)/);
});

test('descriptions collapse after selection while icons remain, including returning to the step',()=>{
 const c=load();
 let html=c.renderStep0('ru');
 assert.equal((html.match(/class="listing-type-description"/g)||[]).length,3);
 assert.match(html,/create.chooseListingAction/);
 for(const id of [1,2,3]) {
  c.applyListingTypeId(id);
  html=c.renderStep0('ru');
  assert.match(html,/listing-type-field is-compact/);
  assert.equal((html.match(/class="listing-type-glyph"/g)||[]).length,3);
  assert.doesNotMatch(html,/listing-type-description|create.chooseListingAction/);
  assert.equal((html.match(/class="listing-type-label"/g)||[]).length,3);
  c.state.step=1;c.state.step=0;
  assert.equal(c.renderStep0('ru'),html);
 }
});

test('radius mode requires a loaded map and preserves required selection', () => {
 const c=load();c.applyListingTypeId(1);c.state.form.locationMode='radius';
 c.state.form.searchArea={latitude:41.31,longitude:69.28,radiusKm:5};
 c.updateWizardFooter();assert.equal(c.wizardNextBtn.disabled,true);
 assert.equal(c.validateStep(0).anchor,'location');
 c.state.searchAreaMapReady=true;c.updateWizardFooter();
 assert.equal(c.wizardNextBtn.disabled,false);assert.equal(c.validateStep(0),null);
});
