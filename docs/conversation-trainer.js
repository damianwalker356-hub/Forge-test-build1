// Trainer: a conversation with the active model where every turn can become training data.
// Learn from this → text example; Send/ask → the model answers (and the message is learned when auto-learn is on);
// Correct previous answer → supervised pair for the last question. Receipts report the actual weight change.
import { modelService as service } from './model-service.js';
import { $, el, fmt, setStatus, readTextFiles, receiptText, download } from './page-utils.js';
import { showPage } from './ui.js';
const host = $('trainerPage');
host.append(
  el('p', { id: 'ctModelState', role: 'status', class: 'modelLine' }),
  el('div', { class: 'row' },
    el('label', {}, el('input', { id: 'ctAuto', type: 'checkbox', checked: true }), 'Learn from my messages and uploads in Chat and Trainer'),
    el('button', { id: 'ctPause', type: 'button', text: 'Pause learning' }), el('button', { id: 'ctResume', type: 'button', text: 'Resume learning' }),
    el('button', { id: 'ctExport', type: 'button', text: 'Export weights + history' }), el('button', { id: 'ctModels', type: 'button', text: 'Models page', onclick: () => showPage('models') })),
  el('p', { class: 'muted', text: 'Green lines are the model’s output or a saved weight change, not verified truth. Model answers are never used as training examples unless you correct them. Learning runs while this page or Chat is open; unfinished work resumes after reload. Keep the tab in the foreground on phones.' }),
  el('div', { id: 'ctLog', class: 'convo', 'aria-live': 'polite', 'aria-label': 'Training conversation' }),
  el('form', { id: 'ctForm' },
    el('div', { class: 'composerBox' }, el('textarea', { id: 'ctText', rows: '3', 'aria-label': 'Teaching text or question', placeholder: 'Teach, ask, or upload text and Markdown' }), el('button', { id: 'ctUpload', type: 'button', text: 'Upload' }), el('input', { id: 'ctFiles', type: 'file', multiple: true, hidden: true, accept: '.txt,.md,.json,.csv,.yaml,.yml,.js,.py,.log' })),
    el('div', { class: 'actions' }, el('button', { type: 'submit', value: 'learn', text: 'Learn from this' }), el('button', { type: 'submit', value: 'ask', text: 'Send / ask model' }), el('button', { type: 'submit', value: 'correct', text: 'Correct previous answer' }))),
  el('details', {}, el('summary', { text: 'Evidence, examples and limits' }),
    el('div', { class: 'row' }, el('button', { id: 'ctAudit', type: 'button', text: 'Show saved learning evidence' }), el('button', { id: 'ctEval', type: 'button', text: 'Re-test all trained question/answer examples' })),
    el('pre', { id: 'ctAuditOutput', class: 'codeBox' }),
    el('p', { text: 'Plain text and Markdown train next-byte prediction of the document. For question → answer training, include a fenced forge-example block with JSON {prompt, response}; such pairs are trained until the model reproduces the answer (or passes run out). A Markdown file with a forge-tool block is a skill: its text is learned here, but the tool is only installed from the Skills page after you review the code.' }),
    el('pre', { text: '```forge-example\n' + JSON.stringify({ prompt: 'What is 9+9?', response: '18' }, null, 2) + '\n```' }),
    el('p', { class: 'muted', text: 'Limits: 3 files per upload, 65,536 bytes combined; 500 saved examples and 2 MiB per model; 25 examples per submission. Nothing is truncated silently. Reproducing a training example is not generalisation; test with new questions.' })));
let busy = false, reading = false; const receipts = new Map();
function add(role, text) {
  const n = el('div', { class: 'm ' + (role === 'u' ? 'u' : role === 'a' ? 'a' : 's'), text: (role === 'u' ? 'You: ' : role === 'a' ? 'Model: ' : '') + text });
  n.dataset.tone = role === 'error' ? 'error' : role === 'a' || role === 'ok' ? 'ok' : role === 'u' ? 'regular' : 'caution';
  $('ctLog').append(n); n.scrollIntoView({ block: 'nearest' }); return n;
}
async function state() {
  const s = await service.info();
  $('ctAuto').checked = s.autoLearn !== false;
  setStatus($('ctModelState'), !s.exists ? 'No active model. Create one on the Models page; this trainer teaches whichever model is active.' : `Model ${s.modelId} · ${fmt(s.parameterCount)} parameters · ${fmt(s.steps)} weight updates · ${s.pending} queued example(s) · rules ${fmt(s.rulesBytes)} bytes · ${s.paused ? 'learning paused' : 'learning on'}`, s.exists ? 'regular' : 'caution');
}
async function act(fn) { if (busy || reading) { add('error', 'Wait for the current operation.'); return; } busy = true; try { await fn(); } catch (e) { add('error', e.message); } finally { busy = false; await state().catch(() => {}); } }
service.addEventListener('selected', () => state().catch(e => add('error', e.message)));
service.addEventListener('rules', () => state().catch(() => {}));
service.addEventListener('receipt', ({ detail: r }) => { const prior = receipts.get(r.jobId), n = add('ok', receiptText(r)); if (prior) prior.replaceWith(n); receipts.set(r.jobId, n); state().catch(() => {}); });
service.addEventListener('queued', ({ detail: r }) => add('s', `${fmt(r.bytes)} bytes saved as ${r.jobIds.length} example(s) for ${r.modelId}. Queued is not learned; the green receipt confirms the weight change.`));
service.addEventListener('error', ({ detail }) => add('error', detail.message));
service.addEventListener('consolidation', ({ detail: c }) => add(c.requeued.length ? 's' : 'ok', `Consolidation check at update ${c.step}: ${c.reproduced}/${c.tested} trained question/answer pairs still reproduced` + (c.rules.bytes ? ` with ${fmt(c.rules.bytes)} bytes of rules` : '') + (c.requeued.length ? `; re-queued ${c.requeued.length} that drifted: ${[...new Set(c.requeued)].join(', ')}.` : '.')));
service.addEventListener('notice', ({ detail }) => add('s', detail.message));
$('ctPause').onclick = () => act(async () => { await service.call('pause'); add('s', 'Learning paused; queued examples wait.'); });
$('ctResume').onclick = () => act(async () => { await service.call('resume'); add('s', 'Learning resumed.'); });
$('ctAuto').onchange = e => act(() => service.call('auto', { enabled: e.target.checked }));
$('ctExport').onclick = () => act(async () => { const data = await service.export(); download(data, `${data.modelId}-checkpoint.json`); add('ok', 'Checkpoint download requested. Browser-local weights remain saved.'); });
$('ctAudit').onclick = () => act(async () => { $('ctAuditOutput').textContent = JSON.stringify(await service.audit(), null, 2); });
$('ctEval').onclick = () => act(async () => {
  const audit = await service.audit(), pairs = audit.jobs.filter(j => j.kind === 'pair');
  if (!pairs.length) throw Error('No question/answer examples saved for this model yet.');
  const full = await service.export(); const dec = new TextDecoder();
  const cases = full.learning.jobs.filter(j => j.kind === 'pair').slice(0, 200).map(j => { const t = new Uint8Array(j.tokens); return { name: j.name, prompt: dec.decode(t.slice(0, j.responseStart)).slice(6, -8), expected: dec.decode(t.slice(j.responseStart, -1)) }; });
  const r = await service.evaluate(cases);
  $('ctAuditOutput').textContent = `Re-test of ${r.total} trained example(s) at update ${r.steps} (weights ${r.weightsHash.slice(0, 12)}, rules ${r.rules.bytes} bytes): ${r.exact} exact.\nThese are the training prompts themselves — reproduction, not generalisation.\n\n` + r.results.map(x => `${x.exactMatch ? 'EXACT' : 'DIFF '} ${x.name}\n  prompt:   ${JSON.stringify(x.prompt)}\n  expected: ${JSON.stringify(x.expected)}\n  actual:   ${JSON.stringify(x.actual)}`).join('\n');
});
$('ctUpload').onclick = () => $('ctFiles').click();
$('ctFiles').onchange = async e => {
  if (busy || reading) return; reading = true;
  try { const files = await readTextFiles(e.target.files, { maxFiles: 3, maxTotalBytes: 65536 }); if (!files.length) return; add('u', 'Uploaded: ' + files.map(f => f.name).join(', ')); const r = await service.interact('', { files, learnOnly: true }); if (!r.queued) add('s', 'Nothing was queued (automatic learning is off and no examples were found).'); }
  catch (error) { add('error', error.message); } finally { reading = false; e.target.value = ''; }
};
$('ctForm').onsubmit = e => {
  e.preventDefault(); const kind = e.submitter?.value || 'ask', text = $('ctText').value.trim(); if (!text) return;
  act(async () => {
    add('u', (kind === 'learn' ? '[learn] ' : kind === 'correct' ? '[correction] ' : '') + text);
    const r = await service.interact(text, { learnOnly: kind === 'learn', correction: kind === 'correct' });
    if (kind === 'ask') { if (r.feedbackOnly) add('s', 'Negative feedback recorded as text. Enter the correct answer and press Correct previous answer.'); else add('a', r.text || '(empty response)'); if (r.text !== undefined) add('s', `Generated at update ${r.steps}${r.rules?.bytes ? ` with ${fmt(r.rules.bytes)} bytes of rules (state from update ${r.rules.stateStep})` : ', no rules assigned'}. Generation changes no weights.`); }
    $('ctText').value = '';
  });
};
await service.ready.catch(() => {}); await state().catch(e => add('error', e.message));
