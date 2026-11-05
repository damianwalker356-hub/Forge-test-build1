// Forge Agent — injection point
// Add this to Engine Forge when ready. It reads Engine Forge state
// and logs it to the agent's memory without modifying Engine Forge code.

function forgeHook(eventType, payload) {
  agent.logEvent(eventType, payload);
}

function forgeInit() {
  const summary = agent.getContextSummary();
  console.log(summary);
  return summary;
}

if (typeof module !== 'undefined' && module.exports) { module.exports = { forgeHook, forgeInit }; }