const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('assets/telegram-profile.js','utf8');
function setup() {
  let haptics = 0, blurred = false;
  const classes = new Set();
  const state = {universities:[{id:7,name:'Test University',short_name:'TU'},{id:8,name:'Other University',short_name:'OU'}], selectedUniversityId:null, searchQuery:'', universitySearchEmptyHapticFired:false};
  const input = {value:'',closest:()=>({classList:{add:v=>classes.add(v),remove:v=>classes.delete(v)}}),blur:()=>{blurred=true;}};
  const list = {hidden:true,innerHTML:''};
  const context = vm.createContext({state,universitySearchEl:input,universityListEl:list,
    showFormError(){},render(){},UyDosh:{localized:u=>u.name,localizedShort:u=>u.short_name,
      titleCaseWords:s=>s,escapeHtml:s=>s,t:k=>k,getLang:()=> 'en',haptic:{notFound:()=>haptics++}}});
  vm.runInContext(source.slice(source.indexOf('function filteredUniversities('),source.indexOf('// Regions are a short static list')),context);
  vm.runInContext(source.slice(source.indexOf('function renderUniversityList('),source.indexOf('function scaleValueLabel(')),context);
  return {state,input,list,context,classes,haptics:()=>haptics,blurred:()=>blurred};
}
test('selection commits the full name and removes any empty-state panel even when input retained focus',()=>{
  const ui=setup();ui.input.value='T';ui.state.searchQuery='T';ui.list.hidden=false;ui.list.innerHTML='Nothing found';
  ui.context.selectUniversity(7);
  assert.equal(ui.state.selectedUniversityId,7);assert.equal(ui.input.value,'Test University');
  assert.equal(ui.list.hidden,true);assert.equal(ui.list.innerHTML,'');assert.equal(ui.state.searchQuery,'');
  assert.equal(ui.blurred(),true);assert.equal(ui.classes.has('is-picked'),true);
});
test('duplicate input after choosing a suggestion does not reopen search',()=>{
  const ui=setup();ui.context.selectUniversity(7);ui.context.handleUniversitySearchInput();
  assert.equal(ui.list.hidden,true);assert.equal(ui.haptics(),0);assert.equal(ui.state.selectedUniversityId,7);
});
test('a new unmatched query cannot silently save the old university',()=>{
  const ui=setup();ui.context.selectUniversity(7);ui.input.value='zzzz';ui.context.handleUniversitySearchInput();
  assert.equal(ui.state.selectedUniversityId,null);assert.equal(ui.list.hidden,false);
  assert.match(ui.list.innerHTML,/universityNotFound/);assert.equal(ui.haptics(),1);
  ui.input.value='OU';ui.context.handleUniversitySearchInput();ui.context.selectUniversity(8);
  assert.equal(ui.list.hidden,true);assert.equal(ui.state.selectedUniversityId,8);assert.equal(ui.input.value,'Other University');
});
test('clearing search removes both the selection and empty results',()=>{
  const ui=setup();ui.context.selectUniversity(7);ui.input.value='';ui.context.handleUniversitySearchInput();
  assert.equal(ui.state.selectedUniversityId,null);assert.equal(ui.list.hidden,true);assert.equal(ui.list.innerHTML,'');
});
test('transport university is found by its Russian name and stays selected after a late input event',()=>{
  const ui=setup();
  ui.state.universities=[{id:17,name:'ТРАНСПОРТНЫЙ УНИВЕРСИТЕТ',short_name:'ТРАНСПОРТНЫЙ ИНСТИТУТ'}];
  ui.input.value='транспортный';ui.context.handleUniversitySearchInput();
  assert.match(ui.list.innerHTML,/data-university-id="17"/);
  ui.context.selectUniversity(17);
  ui.context.handleUniversitySearchInput();
  assert.equal(ui.state.selectedUniversityId,17);
  assert.equal(ui.input.value,'ТРАНСПОРТНЫЙ УНИВЕРСИТЕТ');
  assert.equal(ui.list.hidden,true);assert.equal(ui.list.innerHTML,'');
});
