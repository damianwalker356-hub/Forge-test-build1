// Model backends. WebLLM runs an open-source model on your phone's GPU via WebGPU.
const WEBLLM_URL = "https://esm.run/@mlc-ai/web-llm";

export async function hasF16() {
  try {
    const a = await navigator.gpu.requestAdapter();
    return !!a && a.features.has("shader-f16");
  } catch (_) { return false; }
}

export async function listModels(maxVramMB = 2000) {
  const webllm = await import(WEBLLM_URL);
  const f16 = await hasF16();
  return webllm.prebuiltAppConfig.model_list
    .filter((m) => m.vram_required_MB && m.vram_required_MB <= maxVramMB)
    .filter((m) => f16 || !/(q4f16|q0f16)/.test(m.model_id))
    .sort((a, b) => a.vram_required_MB - b.vram_required_MB)
    .map((m) => ({ id: m.model_id, mb: Math.round(m.vram_required_MB) }));
}

export function pickDefault(models) {
  const prefs = [/Llama-3\.2-1B/, /Qwen2\.5-1\.5B/, /Qwen3-1\.7B/, /SmolLM2-360M/];
  for (const p of prefs) { const m = models.find((x) => p.test(x.id)); if (m) return m.id; }
  return models[models.length - 1]?.id;
}

export class WebLLM {
  constructor(modelId, onProgress = () => {}) { this.modelId = modelId; this.onProgress = onProgress; this.engine = null; }
  async load() {
    if (!navigator.gpu) throw new Error("WebGPU is not available in this browser");
    const webllm = await import(WEBLLM_URL);
    this.engine = await webllm.CreateMLCEngine(this.modelId, { initProgressCallback: (r) => this.onProgress(r.text, r.progress) });
  }
  async chat(messages, onToken) {
    const stream = await this.engine.chat.completions.create({ messages, stream: true, temperature: 0.4, max_tokens: 512 });
    let out = "";
    for await (const c of stream) {
      out += c.choices[0]?.delta?.content || "";
      if (onToken) onToken(out);
    }
    return out.trim();
  }
}

// Deterministic stand-in for tests (?mock=1). Not intelligent.
export class MockLLM {
  async chat(messages, onToken) {
    const last = messages[messages.length - 1].content;
    let out;
    if (last.startsWith("OBSERVATION")) out = "Tool result received: " + last.slice(0, 200);
    else if (/lookup:/.test(last)) out = "TOOL: wiki_search " + JSON.stringify({ query: last.split("lookup:")[1].trim() });
    else if (last.includes("remember-test")) out = 'Noted. <remember kind="preference" key="test_pref">likes tests</remember>';
    else out = "mock reply: " + last.slice(0, 160);
    if (onToken) onToken(out);
    return out;
  }
}
