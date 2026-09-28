const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function setup(build, response) {
  const elements = new Map();
  const el = id => {
    if (!elements.has(id)) elements.set(id,{hidden:true, handlers:{}, addEventListener(name,fn){this.handlers[name]=fn;},showModal(){this.open=true;},close(){this.open=false;}});
    return elements.get(id);
  };
  let copied, replaced;
  const context = vm.createContext({
    window:{UYDOSH_BUILD:build}, document:{getElementById:el,addEventListener(){}},
    UyDosh:{t:key=>key,getLang:()=> 'en'}, Date, URL,
    navigator:{clipboard:{writeText:async value=>{copied=value;}}},
    location:{href:'https://example.com/telegram/profile.html?mini=1',replace:url=>{replaced=url;}},
    fetch:async()=>{if(response instanceof Error) throw response; return {ok:true,json:async()=>response};},
  });
  vm.runInContext(fs.readFileSync('assets/build-info.js','utf8'),context);
  return {el,click:id=>el(id).handlers.click(),copied:()=>copied,replaced:()=>replaced};
}
const build={id:'142.1',run:142,attempt:1,commit:'a'.repeat(40),builtAt:'2026-09-29T10:00:00Z'};

test('new release shows an update action without relabeling the loaded build', async()=>{
  const ui=setup(build,{...build,id:'143.1',run:143});
  await ui.click('build-info-open');
  assert.equal(ui.el('build-info-open').textContent,'Telegram · Build 142.1');
  assert.equal(ui.el('build-info-update').hidden,false);
  await ui.click('build-info-copy');
  assert.match(ui.copied(),/142\.1/); assert.match(ui.copied(),/aaaaaaa/);
  await ui.click('build-info-update');
  assert.equal(ui.replaced(),'https://example.com/telegram/profile.html?mini=1&build=143.1');
});
test('offline client keeps its loaded version and can copy it',async()=>{
  const ui=setup(build,new Error('offline')); await ui.click('build-info-open'); await ui.click('build-info-copy');
  assert.equal(ui.el('build-info-update').hidden,true); assert.match(ui.copied(),/142\.1/);
});
test('source checkout clearly identifies an unpublished local build',()=>{
  const ui=setup(null); assert.match(ui.el('build-info-open').textContent,/build.local/);
});
