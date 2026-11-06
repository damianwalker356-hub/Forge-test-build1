# Forge Agent

A static web app (GitHub Pages, `docs/`) in which you build, rule, train and extend your own language model entirely in the browser. No model is downloaded, no server or account is used, and nothing is paywalled: every weight in a Forge model was produced on your device from what you typed, uploaded, corrected or approved.

Open `https://<your-username>.github.io/forge-agent/` (Repo Settings → Pages → Deploy from branch `main`, folder `/docs`). Add to Home Screen on a phone to run it as an app.

## Pages

| Page | What it does |
|---|---|
| **Chat** | Search-engine style start screen. Messages go to your active model; the line under each answer states which model and update produced it, whether your rules were in context, and that generation changed no weights. With automatic learning on, your messages and attached text files are queued as learning material. `/skills`, `/tool name {json}`, `/help` and the memory slash commands work too. |
| **Models** | Create a model (ID, hidden size 8–1024, optional seed), measure how long one update takes on this device, list/switch/delete models, export (weights + rules + learning history + receipts) and import a checkpoint under a new ID. Hidden size 800 ≈ 1,050,656 parameters. |
| **Trainer** | A conversation with the model where every turn can become training data: *Learn from this*, *Send / ask model*, *Correct previous answer*, upload text/Markdown. Each committed weight change prints a green receipt: update range, byte targets, loss before/after, changed parameter count, SHA-256 of the weights before/after, rules context. Evidence and re-tests of trained pairs are one click away. |
| **Skills** | Upload Markdown skills that carry real tool code. You read and approve the code, the tests run in a sandbox, then the tool is installed. *Queue training examples* teaches the active model to call the tool. See [SKILLS.md](SKILLS.md). |
| **Rules** | Write your model's rules (blank until you do). *Apply* stores them with the model; the model reads them before every answer and every question→answer training pass. `forge-test` blocks let you measure rule-following after training. |
| **Tutorial** | The six steps above, what the model is, and a hands-on six-parameter math model to see a full train/evaluate loop in seconds. |

Colours: white = regular/your text; green = model output or a completed operation (not verified truth); red = error/rejected input; yellow = warnings, queued-not-yet-learned, heavy computation.

## How learning works

- Model: byte-level recurrent network (`docs/rnn-core.js`), parameters `2·256·H + H² + H + 256`. Truncated BPTT over 32-byte windows, SGD with gradient-norm clipping. Greedy decoding.
- Everything runs in a dedicated Web Worker (`docs/learning-worker.js`); weights, dataset, rules and receipts are committed to IndexedDB after every batch with optimistic revision checks.
- Text examples train next-byte prediction over the whole document; question→answer pairs train only the answer bytes (prompt and rules are context). Pairs run until the model reproduces the answer exactly or the pass budget is spent.
- Queued examples are trained round-robin with replay of older examples; when the queue drains, a consolidation pass re-tests every trained pair and re-queues (bounded) any the model has drifted away from.
- Rules are applied as a cached hidden state computed from the rules text (refreshed when rules change or every 16 updates); receipts and generation report the bytes and the update the state came from. Weights are not changed by changing rules — rule-following must be trained and measured.
- The model's answers are never used as training data unless you correct them. "False"/"wrong" style replies are recorded as text, not as answers.

## Skills and tools

A skill is a Markdown file with `forge-tool` (JavaScript `run(input)`), `forge-schema`, `forge-tests` and optional `forge-example` blocks. Installation requires your explicit approval of the shown code and every test passing inside the sandbox: an opaque-origin `<iframe sandbox="allow-scripts">` with `default-src 'none'` CSP running a Worker, with a timeout. Tools have no network, storage or page access. The model uses a tool by emitting `[tool:name] {json}`; Chat validates the JSON against the schema, runs the tool and shows the result. Format and a complete example: [SKILLS.md](SKILLS.md).

## Limits, stated plainly

- A fresh model outputs noise. A ~1 M-parameter byte model learns facts slowly, forgets, and generalises poorly; the receipts and tests exist so you can see exactly what it did and did not learn. Reproducing a trained example is not generalisation.
- Training speed is bound by your device. Measured in Node on the build machine: H=128 ≈ 32 ms per update, H=400 ≈ 130 ms, H=800 ≈ 400 ms. Phones are slower; use *Measure this size on this device*. Background tabs suspend training.
- Everything lives in this browser's storage; clearing site data deletes it. Export regularly.
- Verified in Linux Chromium (Playwright) only. iPhone Safari has not been tested by the author; the sandbox falls back from blob workers to data: URL workers for engines that need it, but that fallback is untested on a device.
- Browser memory and the 2 MiB dataset / 500 examples / 16 KiB rules / 2 KiB prompt limits are enforced without silent truncation.

## Tests

- `npm test` — Node unit tests (53): RNN gradient checks, parameter formula, seeds, rules conditioning, pair learning, data windows, skill format parsing/validation, tool-call parsing, memory/agent logic. Results: `validation/node-test-results.txt`.
- `python3 -m http.server 8765 --bind 127.0.0.1` then `python3 tests/browser-suite.py` — 22 end-to-end checks in headless Chromium at 390×844 (create model, rules, trainer receipts, sandbox isolation, skill install, tool execution, persistence, model switching). Results: `validation/browser-suite-results.json`.
- `python3 tests/browser-tool-learning.py` — slow check that a fresh model learns to emit a tool call and that Chat executes it. Results and caveats: `validation/browser-tool-learning.json`.

## Optional Python server

`agent/`, `supervisor.py`, `run.sh` are an earlier self-hosted variant (SQLite memory, Python standard library, local Ollama or mock). It is independent of the web app and not required. `python3 tests/test_agent.py`.
