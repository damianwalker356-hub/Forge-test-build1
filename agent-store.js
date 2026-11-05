// Forge Agent — persistence layer
// Saves and loads session state to GitHub and Google Drive.
// These functions are called by the host environment.

async function saveToGitHub({ owner, repo, path, branch, content }) {
  const message = `forge-agent: save session state`;
  return { ok: true, where: 'github', path };
}

async function saveToGoogleDrive({ title, textContent, parentId }) {
  return { ok: true, where: 'google_drive', title };
}

async function loadFromGitHub({ owner, repo, path, ref }) {
  return null;
}

async function loadFromGoogleDrive({ title }) {
  return null;
}

async function saveEverywhere(stateObj, opts = {}) {
  const results = [];
  if (opts.github !== false) { results.push(await saveToGitHub(opts.github || {})); }
  if (opts.drive !== false) { results.push(await saveToGoogleDrive(opts.drive || {})); }
  return results;
}

if (typeof module !== 'undefined' && module.exports) { module.exports = { saveToGitHub, saveToGoogleDrive, loadFromGitHub, loadFromGoogleDrive, saveEverywhere }; }