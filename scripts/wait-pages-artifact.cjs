const artifactName = 'github-pages';

async function waitForArtifact({ token, repository, runId, artifactId, apiBase = 'https://api.github.com', fetchImpl = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), attempts = 30 }) {
  if (!token || !repository || !runId || !artifactId) throw new Error('Missing Pages artifact context');
  for (let attempt = 0; attempt < attempts; attempt++) {
    const response = await fetchImpl(`${apiBase}/repos/${repository}/actions/runs/${runId}/artifacts?name=${artifactName}&per_page=100`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok && response.status < 500) throw new Error(`Artifact lookup failed: HTTP ${response.status}`);
    if (response.ok) {
      const result = await response.json();
      const artifacts = result.artifacts || [];
      if (artifacts.some(item => String(item.id) === String(artifactId) && item.name === artifactName && !item.expired)) return;
    }
    if (attempt + 1 < attempts) await sleep(2000);
  }
  throw new Error('Uploaded Pages artifact is not visible through the Actions API; refusing deployment');
}
module.exports = { waitForArtifact };
if (require.main === module) {
  waitForArtifact({ token: process.env.GITHUB_TOKEN, repository: process.env.GITHUB_REPOSITORY, runId: process.env.GITHUB_RUN_ID, artifactId: process.env.PAGES_ARTIFACT_ID, apiBase: process.env.GITHUB_API_URL })
    .then(() => console.log('Pages artifact is visible through the Actions API.'))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
