# Forge Agent Runtime

A self-hosted chat agent with persistent memory and internet access. Python standard library only, no pip installs, no API keys, no paid services. The reasoning comes from an open-source model you run yourself (Llama 3, Qwen, Mistral, DeepSeek-R1) through Ollama or any OpenAI-compatible local server.

This replaces the earlier placeholder files (agent-core.js, agent-store.js, agent-inject.js), which were not functional.

## Run it (PC, Mac, Linux box, or Raspberry Pi)

1. Install Python 3.9+ and Ollama (https://ollama.com), then: `ollama pull llama3.1:8b`
2. `./run.sh` (Windows: `run.bat`). Open http://127.0.0.1:8787
3. Type `/help`.

The supervisor restarts the server if it crashes. Logs go to `data/agent.log`. Memory lives in `data/memory.db` (SQLite) and survives restarts.

## Use it from your iPhone

Run it on a computer at home, then either use Tailscale (private, recommended) or your home Wi-Fi:

    FORGE_HOST=0.0.0.0 FORGE_TOKEN=<long random string> ./run.sh

It refuses to listen beyond localhost without a token. Open the page in Safari, tap Token, paste it, then Share > Add to Home Screen. Do not expose this to the public internet without HTTPS in front of it.

## What it does

- Memory: messages, facts, preferences, decisions and open items in SQLite. Past messages from other sessions are searched and injected on every turn. Slash commands (/remember, /pref, /decide, /todo, /done, /forget, /memory) work even if the model is down.
- State graph: recall > think > act > think ... > learn > respond. State is checkpointed to SQLite at every node.
- Tools: web_search (DuckDuckGo HTML, or your own SearXNG via FORGE_SEARXNG), fetch_url, list/read/write files inside `workspace/`, and run_shell (OFF unless FORGE_ALLOW_SHELL=1).
- Learning: the model can save things with <remember> tags, and you can correct it with /forget.

## Settings (environment variables)

FORGE_LLM=ollama|openai|mock, FORGE_MODEL, OLLAMA_HOST, FORGE_LLM_BASE, FORGE_HOST, FORGE_PORT, FORGE_TOKEN, FORGE_SEARXNG, FORGE_ALLOW_SHELL, FORGE_ALLOW_LOCAL, FORGE_WORKSPACE.

## Honest limits

- Intelligence equals the model you run. An 8B model on a laptop is far weaker than a hosted frontier model.
- It does not retrain model weights. "Learning" means saved memory and retrieval.
- Web search scrapes DuckDuckGo's HTML page and can be rate-limited or change. SearXNG is more reliable.
- Not yet tested against a live model or the live internet (the build environment had neither). Tests use a mock model.

Tests: `python3 tests/test_agent.py`. Injecting into Engine Forge later: call POST /api/chat from its page, or add a small fetch hook. Nothing here touches the Engine Forge code.
