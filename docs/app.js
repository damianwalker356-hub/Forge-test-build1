import { Memory, IDBBackend } from "./memory.js";
import { Agent } from "./agent.js";
import { createTools } from "./tools.js";
import { WebLLM, MockLLM, listModels, pickDefault } from "./llm.js";
import { SEED } from "./seed.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const mock = params.has("mock");
const log = $("log"), input = $("t");

function add(cls, txt) {
  const d = document.createElement("div");
  d.className = "m " + cls; d.textContent = txt;
  log.appendChild(d); log.scrollTop = log.scrollHeight;
  return d;
}
const status = (t, p) => { $("status").textContent = t; if (p != null) $("bar").firstChild.style.width = Math.round(p * 100) + "%"; };

const session = localStorage.getItem("forge_session") || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
localStorage.setItem("forge_session", session);

const mem = await new Memory(new IDBBackend(mock ? "forge-agent-mock" : "forge-agent")).init();
mem.importSeed(SEED);
const tools = createTools({ getProxy: () => localStorage.getItem("forge_proxy") || "" });
const agent = new Agent(mem, mock ? new MockLLM() : null, tools);
agent.settings = { getProxy: () => localStorage.getItem("forge_proxy") || "", setProxy: (v) => localStorage.setItem("forge_proxy", v) };

if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});

async function fillModels() {
  const sel = $("models");
  try {
    const models = await listModels();
    sel.innerHTML = "";
    const def = localStorage.getItem("forge_model") || pickDefault(models);
    for (const m of models) { const o = new Option(`${m.id} (${m.mb} MB)`, m.id); o.selected = m.id === def; sel.add(o); }
    if (!models.length) sel.innerHTML = "<option>no small models found</option>";
  } catch (e) {
    sel.innerHTML = "<option>model list unavailable</option>";
    status("Could not load the WebLLM library (offline?). Slash commands still work.");
  }
}
if (mock) { $("models").innerHTML = "<option>mock model</option>"; status("Mock model active (test mode)."); }
else fillModels();

$("load").onclick = async () => {
  if (mock) return;
  const id = $("models").value;
  if (!id || id.includes(" ")) return;
  $("load").disabled = true;
  try {
    const llm = new WebLLM(id, (t, p) => status(t, p));
    await llm.load();
    agent.llm = llm;
    localStorage.setItem("forge_model", id);
    status("Loaded " + id + ". Ready.", 1);
  } catch (e) { status("Load failed: " + e.message); }
  $("load").disabled = false;
};

async function send(text) {
  add("u", text);
  const bubble = add("s", "thinking...");
  try {
    const r = await agent.run(session, text, (partial) => { bubble.className = "m a"; bubble.textContent = partial; log.scrollTop = log.scrollHeight; });
    bubble.className = "m a"; bubble.textContent = r.answer || "(no answer)";
    const used = r.trace.filter((x) => x.startsWith("tool:"));
    if (used.length) add("s", "tools: " + used.join(", "));
  } catch (e) { bubble.className = "m s"; bubble.textContent = "Error: " + e.message; }
}
$("f").onsubmit = (e) => { e.preventDefault(); const m = input.value.trim(); if (!m) return; input.value = ""; send(m); };
input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && innerWidth > 700) { e.preventDefault(); $("f").requestSubmit(); } });
$("mem").onclick = () => send("/memory");
$("help").onclick = () => send("/help");
add("s", "Forge Agent ready. Memory is stored on this device. Type /help.");

if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
window.__forge = { mem, agent };
