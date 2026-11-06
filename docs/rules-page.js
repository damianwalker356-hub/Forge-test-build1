// Rules page: the owner writes the active model's rules. "Apply" stores the text with the model and the worker
// conditions every generation and every question→answer training pass on it (hidden state after reading the
// rules). Rules start empty and are never prefilled. forge-test blocks let you check behaviour after training.
import { modelService as service } from './model-service.js';
import { readRecord, createRecord, saveRecord } from './model-records.js';
import { MAX_RULES_BYTES } from './rnn-core.js';
import { $, el, fmt, setStatus, download } from './page-utils.js';
import { showPage } from './ui.js';
const enc = new TextEncoder(), host = $('rulesPage');
host.append(
  el('p', { id: 'ruModel', role: 'status', class: 'modelLine' }),
  el('p', { text: 'Write your own rules in Markdown. Applying them makes the model read the rules before every answer and before every question→answer training pass, so corrections you teach are learned in the context of these rules. Whether the model follows a rule is something you measure with rule tests after training — the application does not claim it.' }),
  el('label', { for: 'ruText', text: 'Rules (blank until you write them)' }),
  el('textarea', { id: 'ruText', rows: '14', placeholder: 'Enter your rules here. Nothing is prefilled.' }),
  el('p', { id: 'ruBytes', class: 'muted' }),
  el('div', { class: 'actions' },
    el('button', { id: 'ruDraft', type: 'button', text: 'Save draft' }), el('button', { id: 'ruApply', type: 'button', text: 'Apply rules to this model' }),
    el('button', { id: 'ruClear', type: 'button', class: 'danger', text: 'Remove applied rules' }),
    el('label', {}, 'Import .md ', el('input', { id: 'ruImport', type: 'file', accept: '.md,text/markdown,text/plain' })),
    el('button', { id: 'ruExport', type: 'button', text: 'Export editor as .md' })),
  el('p', { id: 'ruStatus', role: 'status', hidden: true }),
  el('details', {}, el('summary', { text: 'Rules currently applied to the model' }), el('pre', { id: 'ruApplied' })),
  el('details', {}, el('summary', { text: 'Rule tests' }),
    el('p', { text: 'Add fenced forge-test blocks to your rules with JSON [{ "name", "prompt", "expected" }]. Running them generates an answer for each prompt with the applied rules and compares it to what you expect. Nothing is trained by a test.' }),
    el('pre', { text: '```forge-test\n[{ "name": "units", "prompt": "What unit is bore measured in?", "expected": "millimetres" }]\n```' }),
    el('button', { id: 'ruTest', type: 'button', text: 'Run rule tests on the applied rules' }), el('pre', { id: 'ruTestOut' })),
  el('details', {}, el('summary', { text: 'Draft history (this browser)' }), el('select', { id: 'ruHistory' }), el('button', { id: 'ruRestore', type: 'button', text: 'Restore selected version to editor' })));
const status = (t, tone) => setStatus($('ruStatus'), t, tone);
let record = null, busy = false;
function bytesLine() { const n = enc.encode($('ruText').value).length; $('ruBytes').textContent = `${fmt(n)} of ${fmt(MAX_RULES_BYTES)} bytes`; $('ruBytes').dataset.tone = n > MAX_RULES_BYTES ? 'error' : n > MAX_RULES_BYTES * 0.8 ? 'caution' : 'regular'; }
$('ruText').addEventListener('input', bytesLine);
async function load() {
  const s = await service.info();
  const controls = ['ruText', 'ruDraft', 'ruApply', 'ruClear', 'ruImport', 'ruExport', 'ruTest', 'ruRestore'];
  if (!s.exists) { record = null; for (const id of controls) $(id).disabled = true; setStatus($('ruModel'), 'No active model. Create one on the Models page, then write its rules here.', 'caution'); $('ruApplied').textContent = ''; return; }
  for (const id of controls) $(id).disabled = false;
  record = readRecord(localStorage, s.modelId) || createRecord(localStorage, s.modelId);
  if (document.activeElement !== $('ruText')) $('ruText').value = record.draft || '';
  bytesLine();
  const audit = await service.audit();
  setStatus($('ruModel'), `Model ${s.modelId} · applied rules ${fmt(s.rulesBytes)} bytes` + (audit.rulesHash ? ` (sha256 ${audit.rulesHash.slice(0, 12)})` : '') + ` · ${fmt(s.steps)} updates`, 'regular');
  const applied = audit.rules || '';
  $('ruApplied').textContent = applied || 'No rules applied. The model answers without any rule context.';
  const history = $('ruHistory'); history.replaceChildren(...record.history.map((v, i) => el('option', { value: String(i), text: `${new Date(v.at).toLocaleString()} — ${fmt(enc.encode(v.rules).length)} bytes` })));
}
async function appliedText() { const audit = await service.audit(); return audit.rules || ''; }
async function act(fn) { if (busy) return; busy = true; try { await fn(); } catch (e) { status(e.message, 'error'); } finally { busy = false; await load().catch(e => status(e.message, 'error')); } }
$('ruDraft').onclick = () => act(() => { record = saveRecord(localStorage, record, $('ruText').value); status('Draft saved in this browser (not applied to the model).', 'regular'); });
$('ruApply').onclick = () => act(async () => {
  const text = $('ruText').value;
  if (!text.trim() && !confirm('Apply empty rules? The model will answer without rule context.')) return;
  record = saveRecord(localStorage, record, text, true);
  const r = await service.setRules(text);
  status(`Applied ${fmt(r.rulesBytes)} bytes of rules to ${r.modelId} (sha256 ${r.rulesHash ? r.rulesHash.slice(0, 12) : 'none'}); rules state computed in ${r.rulesMilliseconds ? r.rulesMilliseconds.toFixed(0) : 0} ms at update ${r.steps}. Every answer and every question→answer training pass now starts from this state.`, 'ok');
});
$('ruClear').onclick = () => act(async () => { if (!confirm('Remove the applied rules from this model? Your draft stays in the editor.')) return; const r = await service.setRules(''); status(`Rules removed from ${r.modelId}.`, 'ok'); });
$('ruImport').onchange = e => act(async () => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; if (f.size > MAX_RULES_BYTES) throw Error(`File exceeds ${fmt(MAX_RULES_BYTES)} bytes`); $('ruText').value = await f.text(); bytesLine(); status(`Loaded ${f.name} into the editor. Save or apply it.`, 'regular'); });
$('ruExport').onclick = () => { const url = URL.createObjectURL(new Blob([$('ruText').value], { type: 'text/markdown' })), a = document.createElement('a'); a.href = url; a.download = `${record?.modelId || 'model'}-rules.md`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); };
$('ruRestore').onclick = () => act(() => { const v = record.history[Number($('ruHistory').value)]; if (!v) throw Error('Select a version'); $('ruText').value = v.rules; bytesLine(); status('Version restored to the editor; apply it to use it.', 'regular'); });
$('ruTest').onclick = () => act(async () => {
  const text = await appliedText(); const cases = [];
  for (const m of text.matchAll(/^```forge-test\s*\n([\s\S]*?)^```\s*$/gm)) { let o; try { o = JSON.parse(m[1]); } catch { throw Error('forge-test block is not valid JSON'); } for (const c of Array.isArray(o) ? o : [o]) cases.push(c); }
  if (!cases.length) throw Error('No forge-test blocks in the applied rules');
  const r = await service.evaluate(cases);
  $('ruTestOut').textContent = `${r.exact}/${r.total} exact at update ${r.steps} with ${fmt(r.rules.bytes)} bytes of rules.\n\n` + r.results.map(x => `${x.exactMatch ? 'PASS' : 'FAIL'} ${x.name || ''}\n  prompt:   ${x.prompt}\n  expected: ${JSON.stringify(x.expected)}\n  actual:   ${JSON.stringify(x.actual)}  (byte accuracy ${(x.byteAccuracy * 100).toFixed(0)}%)`).join('\n');
  $('ruTestOut').dataset.tone = r.exact === r.total ? 'ok' : 'caution';
});
service.addEventListener('selected', () => load().catch(e => status(e.message, 'error')));
document.addEventListener('forge:page', ({ detail }) => { if (detail.page === 'rules') load().catch(e => status(e.message, 'error')); });
export const openRules = () => showPage('rules');
await service.ready.catch(() => {}); await load().catch(e => status(e.message, 'error'));
