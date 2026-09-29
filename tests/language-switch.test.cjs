const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assets = path.join(__dirname, '../assets');

for (const initial of ['uz', 'ru', 'en']) {
  test(`all languages are available for in-place switches starting in ${initial}`, () => {
    let language = initial;
    const loaded = [];
    const context = vm.createContext({
      getLang: () => language,
      UyDosh: {},
      document: {
        readyState: 'loading',
        currentScript: { src: 'https://example.test/assets/uydosh-i18n.js?v=test' },
        addEventListener() {},
        write(markup) {
          const code = markup.match(/i18n\/(uz|ru|en)\.js/)[1];
          loaded.push(code);
          vm.runInContext(fs.readFileSync(path.join(assets, `i18n/${code}.js`), 'utf8'), context);
        },
      },
    });
    context.window = context;
    vm.runInContext(fs.readFileSync(path.join(assets, 'uydosh-i18n.js'), 'utf8'), context);
    assert.deepEqual(loaded, ['uz', 'ru', 'en']);
    for (const next of ['en', 'ru', 'uz', 'en']) {
      language = next;
      assert.equal(context.UyDosh.t('profile.save'), context.I18N[next]['profile.save']);
    }
    assert.equal(context.UyDosh.t('profile.nameOrNickname'), 'Name or nickname');
    assert.equal(context.UyDosh.t('profile.gender'), 'Gender');
    assert.equal(context.UyDosh.t('profile.save'), 'Save');
  });
}
