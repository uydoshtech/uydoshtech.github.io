const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildMetadata, stampBuild, assertLatestRun } = require('../scripts/stamp-build.cjs');
const env = { GITHUB_RUN_NUMBER: '142', GITHUB_RUN_ATTEMPT: '1', GITHUB_SHA: 'a'.repeat(40) };

test('a retry and a fresh publication of the same commit get distinct build IDs', () => {
  assert.equal(buildMetadata(env).id, '142.1');
  assert.equal(buildMetadata({...env, GITHUB_RUN_ATTEMPT: '2'}).id, '142.2');
  assert.equal(buildMetadata({...env, GITHUB_RUN_NUMBER: '143'}).id, '143.1');
  assert.throws(() => buildMetadata({...env, GITHUB_RUN_NUMBER: ''}));
  assert.throws(() => buildMetadata({...env, GITHUB_SHA: 'unknown'}));
});

test('stamps nested HTML, preserves external URLs, and versions all local styles/scripts', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uydosh-build-test-'));
  t.after(() => fs.rmSync(dir, {recursive:true, force:true}));
  fs.mkdirSync(path.join(dir, 'telegram'));
  const file = path.join(dir, 'telegram', 'profile.html');
  fs.writeFileSync(file, '<html><head><script src="../assets/a.js?v=old"></script><link href="../assets/a.css"><script src="https://telegram.org/a.js"></script></head><body><img src="x.png"></body></html>');
  const build = buildMetadata(env, new Date('2026-09-29T10:00:00Z'));
  assert.equal(stampBuild(dir, build), 1);
  const html = fs.readFileSync(file, 'utf8');
  assert.ok(html.indexOf('window.UYDOSH_BUILD') < html.indexOf('assets/a.js'));
  assert.match(html, /a\.js\?v=142\.1/);
  assert.match(html, /a\.css\?v=142\.1/);
  assert.match(html, /src="https:\/\/telegram.org\/a.js"/);
  assert.match(html, /src="x.png"/);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir,'build.json'))), build);
  stampBuild(dir, {...build,id:'142.2',attempt:2});
  assert.equal(fs.readFileSync(file,'utf8').match(/id="uydosh-build-metadata"/g).length,1);
});

test('old workflow retries cannot replace a newer publication; network errors fail closed', async () => {
  const auth = {...env, GITHUB_REPOSITORY:'org/repo', GITHUB_TOKEN:'test'};
  const response = number => async () => ({ok:true,json:async()=>({workflow_runs:[{run_number:number}]})});
  await assertLatestRun(auth,response(142));
  await assert.rejects(assertLatestRun(auth,response(143)), /newer publication/);
  await assert.rejects(assertLatestRun(auth,async()=>({ok:false,status:503})), /HTTP 503/);
});
