# Forge Agent

A persistent chat agent with memory and internet tools, in two versions that share the same design.

## Browser version (iPhone-friendly, no server)

A static page in `docs/` served by GitHub Pages. The model runs inside Safari on your phone's GPU (WebGPU, via WebLLM). Memory is stored on the device in IndexedDB. No API key, no host, no computer.

1. Repo Settings > Pages > Source: Deploy from a branch > Branch `main`, folder `/docs` > Save.
2. Open `https://<your-username>.github.io/forge-agent/` in Safari.
3. Tap Load model (first load downloads several hundred MB, once) and chat.
4. Share > Add to Home Screen.

Slash commands work before the model loads: /help, /remember, /pref, /decide, /todo, /done, /forget, /memory, /wiki, /search, /fetch, /proxy, /export, /import.

Limits, stated plainly:
- iPhone web pages get roughly 1.5 GB of memory, so only small models (about 1B parameters) are realistic. They are far weaker than large models.
- A static page can only read sites that allow browser access (CORS). /wiki (Wikipedia) works. General web search and arbitrary pages need a CORS proxy you provide with /proxy.
- Memory lives in this browser. Safari may clear site data; use /export to back up and /import to restore.
- The model download and chat path has not been tested by the author's build environment (no WebGPU there). The logic and UI are tested with a mock model.

Tests: `node --test tests/` (Node 20+).

## Python version (needs a computer or server)

A self-hosted server with SQLite memory, a Python standard library only runtime, and Ollama or any OpenAI-compatible local model. Files: `agent/`, `supervisor.py`, `run.sh`, `run.bat`, `seed/`, `tests/test_agent.py`.

1. Install Python 3.9+ and Ollama, then `ollama pull llama3.1:8b`.
2. `sh run.sh` (Windows: `run.bat`), then open http://127.0.0.1:8787

It refuses to listen beyond localhost without FORGE_TOKEN. Shell access is off unless FORGE_ALLOW_SHELL=1. Settings: FORGE_LLM=ollama|openai|mock, FORGE_MODEL, OLLAMA_HOST, FORGE_LLM_BASE, FORGE_HOST, FORGE_PORT, FORGE_TOKEN, FORGE_SEARXNG, FORGE_ALLOW_LOCAL, FORGE_WORKSPACE. Tests: `python3 tests/test_agent.py`.

The earlier agent-core.js, agent-store.js and agent-inject.js files were non-functional placeholders and are superseded by the above.

Nothing here touches the Engine Forge code.
