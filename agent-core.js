// Forge Agent — standalone subagent memory core
// Independent of Engine Forge. Inject later when ready.

const VERSION = '1.0.0';

const state = {
  sessionId: null,
  startedAt: null,
  lastEvent: null,
  events: [],
  decisions: [],
  openItems: [],
  userPrefs: {},
  projectRefs: {}
};

function makeSessionId() {
  return 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function logEvent(type, payload) {
  const event = { id: 'evt_' + Date.now().toString(36), t: Date.now(), type, ...payload };
  state.events.push(event);
  state.lastEvent = event;
  return event;
}

function recordDecision(key, value, reason) {
  const existing = state.decisions.find(d => d.key === key);
  if (existing) { existing.value = value; existing.reason = reason; existing.updatedAt = Date.now(); }
  else { state.decisions.push({ key, value, reason, createdAt: Date.now(), updatedAt: Date.now() }); }
  logEvent('decision', { key, value, reason });
}

function trackOpenItem(id, title, status, notes) {
  const existing = state.openItems.find(i => i.id === id);
  if (existing) { existing.status = status; existing.notes = notes; existing.updatedAt = Date.now(); }
  else { state.openItems.push({ id, title, status, notes, createdAt: Date.now(), updatedAt: Date.now() }); }
  logEvent('openItem', { id, title, status, notes });
}

function setPref(key, value) {
  state.userPrefs[key] = value;
  logEvent('pref', { key, value });
}

function linkProject(name, repo, branch) {
  state.projectRefs[name] = { repo, branch, linkedAt: Date.now() };
  logEvent('projectLink', { name, repo, branch });
}

function exportState() {
  return { version: VERSION, sessionId: state.sessionId, startedAt: state.startedAt, lastEvent: state.lastEvent, events: state.events, decisions: state.decisions, openItems: state.openItems, userPrefs: state.userPrefs, projectRefs: state.projectRefs };
}

function importState(data) {
  if (!data) return false;
  state.sessionId = data.sessionId || makeSessionId();
  state.startedAt = data.startedAt || Date.now();
  state.events = data.events || [];
  state.decisions = data.decisions || [];
  state.openItems = data.openItems || [];
  state.userPrefs = data.userPrefs || {};
  state.projectRefs = data.projectRefs || {};
  state.lastEvent = data.lastEvent || null;
  return true;
}

function initSession() {
  state.sessionId = makeSessionId();
  state.startedAt = Date.now();
  logEvent('sessionStart', { sessionId: state.sessionId });
  return state.sessionId;
}

function getContextSummary() {
  const recent = state.events.slice(-10).map(e => e.type + ': ' + JSON.stringify(e)).join('\n  ');
  const pending = state.openItems.filter(i => i.status !== 'done').map(i => '- ' + i.title + ' (' + i.status + ')').join('\n');
  const keys = Object.keys(state.userPrefs).map(k => k + ': ' + state.userPrefs[k]).join('\n');
  return '\n=== FORGE AGENT CONTEXT ===\nSession: ' + state.sessionId + '\nDecisions: ' + state.decisions.length + '\nOpen items:\n' + (pending || '  (none)') + '\nPreferences:\n' + (keys || '  (none)') + '\nRecent events:\n  ' + (recent || '  (none)') + '\n=========================\n';
}

if (typeof module !== 'undefined' && module.exports) { module.exports = { initSession, logEvent, recordDecision, trackOpenItem, setPref, linkProject, exportState, importState, getContextSummary, VERSION }; }