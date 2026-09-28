// Runs only on the disposable deployment checkout, after asset minification.
const fs = require('node:fs');
const path = require('node:path');

function buildMetadata(env, now = new Date()) {
  const run = Number(env.GITHUB_RUN_NUMBER);
  const attempt = Number(env.GITHUB_RUN_ATTEMPT);
  if (!Number.isSafeInteger(run) || run < 1 || !Number.isSafeInteger(attempt) || attempt < 1) {
    throw new Error('A release requires positive GITHUB_RUN_NUMBER and GITHUB_RUN_ATTEMPT');
  }
  if (!/^[a-f0-9]{40}$/i.test(env.GITHUB_SHA || '')) throw new Error('A release requires GITHUB_SHA');
  return { id: `${run}.${attempt}`, run, attempt, commit: env.GITHUB_SHA, builtAt: now.toISOString() };
}

function stampBuild(root, build) {
  const metadata = `<script id="uydosh-build-metadata">window.UYDOSH_BUILD=Object.freeze(${JSON.stringify(build)});</script>`;
  let pages = 0;
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || ['node_modules', 'scripts', 'tests'].includes(entry.name)) continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(file); continue; }
      if (!entry.name.endsWith('.html')) continue;
      let html = fs.readFileSync(file, 'utf8');
      if (!/<head(?:\s[^>]*)?>/i.test(html)) continue;
      html = html.replace(/<script id="uydosh-build-metadata">[\s\S]*?<\/script>\s*/g, '');
      html = html.replace(/<head(?:\s[^>]*)?>/i, match => `${match}\n    ${metadata}`);
      // Only local CSS/JS URLs; leave CDN scripts, images and navigation alone.
      html = html.replace(/\b(src|href)=(['"])([^'"]+)\2/g, (match, attr, quote, url) => {
        if (/^(?:[a-z]+:|\/\/)/i.test(url)) return match;
        const parsed = new URL(url, 'https://build.invalid/');
        if (!/\.(?:js|css)$/i.test(parsed.pathname)) return match;
        parsed.searchParams.set('v', build.id);
        return `${attr}=${quote}${url.split(/[?#]/)[0]}${parsed.search}${parsed.hash}${quote}`;
      });
      fs.writeFileSync(file, html);
      pages++;
    }
  }
  walk(root);
  if (!pages) throw new Error('No HTML pages stamped');
  fs.writeFileSync(path.join(root, 'build.json'), JSON.stringify(build, null, 2) + '\n');
  return pages;
}

async function assertLatestRun(env, fetchImpl = fetch) {
  if (!env.GITHUB_REPOSITORY || !env.GITHUB_TOKEN) throw new Error('GitHub release guard requires repository and token');
  const response = await fetchImpl(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/actions/workflows/deploy.yml/runs?per_page=1`, {
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
  });
  if (!response.ok) throw new Error(`Cannot check newer releases: HTTP ${response.status}`);
  const latest = (await response.json()).workflow_runs?.[0];
  if (!latest || Number(latest.run_number) !== Number(env.GITHUB_RUN_NUMBER)) {
    throw new Error('A newer publication run exists. Dispatch a NEW deployment to publish again; do not rerun an older release.');
  }
}

module.exports = { buildMetadata, stampBuild, assertLatestRun };
if (require.main === module) {
  (async () => {
    if (process.argv.includes('--guard')) { await assertLatestRun(process.env); return; }
    const build = buildMetadata(process.env);
    const pages = stampBuild(path.resolve(__dirname, '..'), build);
    console.log(`Telegram Build ${build.id} (${build.commit.slice(0, 7)}): stamped ${pages} pages`);
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `## Telegram Mini App\n\nBuild **${build.id}** · commit **${build.commit.slice(0, 7)}** · ${build.builtAt}\n`);
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
}
