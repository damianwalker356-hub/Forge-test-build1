// Models page: create, list, activate, import, export and delete the owner's models. Every model starts from
// random weights chosen by a seed; nothing pretrained is shipped or downloaded.
import { modelService } from './model-service.js';
import { parameterCount, MIN_H, MAX_H } from './rnn-core.js';
import { $, el, fmt, short, setStatus, download } from './page-utils.js';
import { showPage } from './ui.js';
const host = $('modelsPage');
const SIZES = [[64, 'very fast, learns little'], [128, 'fast'], [256, 'moderate'], [400, 'slow on phones'], [800, '≈1,050,656 parameters; seconds per update on phones'], [1024, 'maximum; may stall older phones']];
host.append(
  el('p', { text: 'A model is a byte-level recurrent network trained only by you, in this browser, on what you type, upload, correct and approve. Larger hidden sizes can learn more but every update takes longer on this device. Measure before choosing.' }),
  el('div', { class: 'card' },
    el('h2', { text: 'Create a model' }),
    el('div', { class: 'row' },
      el('label', {}, 'Model ID ', el('input', { id: 'mbId', maxlength: '64', placeholder: 'my-first-model', autocomplete: 'off' })),
      el('label', {}, 'Hidden size ', el('select', { id: 'mbH' }, ...SIZES.map(([h, note]) => el('option', { value: String(h), selected: h === 128 || undefined, text: `${h} — ${fmt(parameterCount(h))} parameters — ${note}` })), el('option', { value: 'custom', text: 'Custom…' }))),
      el('label', { id: 'mbCustomLabel', hidden: true }, 'Custom hidden size ', el('input', { id: 'mbCustom', type: 'number', min: String(MIN_H), max: String(MAX_H), step: '1', value: '200' })),
      el('label', {}, 'Seed (optional) ', el('input', { id: 'mbSeed', type: 'number', step: '1', placeholder: 'random' }))),
    el('p', { id: 'mbParams', class: 'muted' }),
    el('div', { class: 'row' }, el('button', { id: 'mbBench', type: 'button', text: 'Measure this size on this device' }), el('button', { id: 'mbCreate', type: 'button', text: 'Create model' })),
    el('p', { id: 'mbStatus', role: 'status', hidden: true })),
  el('div', { class: 'card' },
    el('h2', { text: 'Import an exported checkpoint as a new model' }),
    el('p', { text: 'Only checkpoints exported by this application are accepted (format forge-rnn-v1). The import is saved under the ID you enter above; existing models are never overwritten.' }),
    el('input', { id: 'mbImport', type: 'file', accept: '.json' })),
  el('div', { class: 'card' }, el('h2', { text: 'Your models' }), el('div', { id: 'mbList', class: 'list' }), el('p', { id: 'mbListStatus', role: 'status', hidden: true })));
const status = (t, tone) => setStatus($('mbStatus'), t, tone);
function chosenH() { const v = $('mbH').value; const h = v === 'custom' ? Number($('mbCustom').value) : Number(v); if (!Number.isInteger(h) || h < MIN_H || h > MAX_H) throw Error(`Hidden size must be an integer from ${MIN_H} to ${MAX_H}`); return h; }
function describeSize() { try { const h = chosenH(); $('mbParams').textContent = `Hidden size ${h}: ${fmt(parameterCount(h))} parameters (2·256·H + H² + H + 256), about ${fmt(Math.round(parameterCount(h) * 4 / 1024))} KiB of weights.`; } catch (e) { $('mbParams').textContent = e.message; } }
$('mbH').onchange = () => { $('mbCustomLabel').hidden = $('mbH').value !== 'custom'; describeSize(); }; $('mbCustom').oninput = describeSize; describeSize();
let busy = false;
async function act(fn) { if (busy) return; busy = true; try { await fn(); } catch (e) { status(e.message, 'error'); } finally { busy = false; await renderList(); } }
$('mbBench').onclick = () => act(async () => {
  const H = chosenH(); status(`Measuring hidden size ${H}… the page may be unresponsive for a moment.`, 'caution');
  const b = await modelService.benchmark(H);
  const perExample = b.updateMs * 2 + b.readMsPerByte * 64;
  status(`Hidden size ${H} on this device: one weight update ≈ ${b.updateMs.toFixed(0)} ms; reading text ≈ ${b.readMsPerByte.toFixed(2)} ms per byte; a typical short chat message ≈ ${(perExample / 1000).toFixed(1)} s of training. Rules of 2,000 bytes add ≈ ${(b.readMsPerByte * 2000 / 1000).toFixed(1)} s each time they are re-read.`, perExample > 3000 ? 'caution' : 'ok');
});
$('mbCreate').onclick = () => act(async () => {
  const id = $('mbId').value.trim(), H = chosenH(), seedRaw = $('mbSeed').value.trim();
  const seed = seedRaw === '' ? undefined : Number(seedRaw); if (seed !== undefined && !Number.isInteger(seed)) throw Error('Seed must be an integer');
  const s = await modelService.create(id, { H, seed });
  status(`Created and saved ${s.modelId}: hidden size ${s.H}, ${fmt(s.parameterCount)} randomly initialised parameters, 0 updates, no rules, no skills. It is now the active model for Chat, Trainer and Rules.`, 'ok');
  $('mbId').value = '';
});
$('mbImport').onchange = e => act(async () => {
  const f = e.target.files[0]; if (!f) return; e.target.value = '';
  const id = $('mbId').value.trim(); if (!id) throw Error('Enter the model ID to save the import under (Create a model → Model ID)');
  if (f.size > 96 * 1024 * 1024) throw Error('Checkpoint exceeds 96 MiB');
  let checkpoint; try { checkpoint = JSON.parse(await f.text()); } catch { throw Error('Checkpoint is not valid JSON'); }
  const s = await modelService.create(id, { checkpoint });
  status(`Imported ${f.name} as ${s.modelId}: ${fmt(s.parameterCount)} parameters, ${fmt(s.steps)} prior updates, ${s.examples} saved examples, rules ${fmt(s.rulesBytes)} bytes. Weights were verified finite; nothing else about their quality is known.`, 'ok');
  $('mbId').value = '';
});
let renderToken = 0;
async function renderList() {
  const token = ++renderToken, list = $('mbList');
  let models; try { models = await modelService.list(); } catch (e) { setStatus($('mbListStatus'), 'Could not read model storage: ' + e.message, 'error'); return; }
  if (token !== renderToken) return; // a newer render superseded this one
  list.replaceChildren();
  setStatus($('mbListStatus'), models.length ? '' : 'No models stored in this browser yet.', 'regular');
  const active = modelService.activeId;
  for (const m of models) {
    const isActive = m.modelId === active;
    list.append(el('div', { class: 'item' },
      el('h3', { text: m.modelId + (isActive ? ' — active' : '') , dataset: { tone: isActive ? 'ok' : 'regular' } }),
      el('p', { class: 'muted', text: `hidden ${m.H} · ${fmt(m.parameterCount)} parameters · ${fmt(m.steps)} updates · ${m.examples ?? 0} saved examples · rules ${fmt(m.rulesBytes || 0)} bytes · updated ${new Date(m.updatedAt).toLocaleString()}` }),
      el('div', { class: 'row' },
        !isActive && el('button', { type: 'button', text: 'Use this model', onclick: () => act(async () => { await modelService.select(m.modelId); status(`${m.modelId} is now active.`, 'ok'); }) }),
        isActive && el('button', { type: 'button', text: 'Export weights + learning history', onclick: () => act(async () => { const data = await modelService.export(); download(data, `${data.modelId}-checkpoint.json`); status(`Export of ${data.modelId} requested (weights ${short(data.weightsHash)}). Browser-local copy remains.`, 'ok'); }) }),
        isActive && el('button', { type: 'button', text: 'Open Trainer', onclick: () => showPage('trainer') }),
        el('button', { type: 'button', class: 'danger', text: 'Delete', onclick: () => act(async () => { if (!confirm(`Delete model ${m.modelId}, its learning history and receipts from this browser? Export first if you want a copy. This cannot be undone.`)) return; await modelService.delete(m.modelId); status(`Deleted ${m.modelId}.`, 'ok'); }) }))));
  }
}
modelService.addEventListener('selected', renderList);
document.addEventListener('forge:page', ({ detail }) => { if (detail.page === 'models') renderList(); });
await modelService.ready.catch(() => {}); await renderList();
