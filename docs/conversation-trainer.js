import{showPage}from'./ui.js';
const $=id=>document.getElementById(id),host=$('trainingPanels');
const advanced=document.createElement('details');advanced.id='trainerAdvanced';advanced.innerHTML='<summary>Advanced model controls</summary>';while(host.firstChild)advanced.append(host.firstChild);host.append(advanced);
const tutorial=document.createElement('section');tutorial.id='screenTutorial';tutorial.hidden=true;tutorial.className='view-tutorial';tutorial.innerHTML='<h1>Tutorial</h1>';document.querySelector('main').append(tutorial);
const math=$('mathQuestion')?.closest('details');
function route(page){showPage(page);tutorial.hidden=page!=='tutorial';if(page==='tutorial'){$('screenTrain').hidden=true;if(math){tutorial.append(math);math.open=true;const walk=$('walkId')?.closest('details');if(walk)walk.open=true;}}else if(math)advanced.append(math);}
document.addEventListener('click',e=>{const button=e.target.closest('[data-page],#buildMath');if(button){e.preventDefault();e.stopImmediatePropagation();route(button.id==='buildMath'?'tutorial':button.dataset.page);}else if(e.target.closest('#mem,#help,.brand'))route('chat');},true);
window.addEventListener('hashchange',()=>route(location.hash.slice(1)));
const panel=document.createElement('section');panel.id='conversationTrainer';panel.innerHTML=`<p>Target: the current experimental 1M checkpoint. Teach with text examples, then ask the model a question. This byte model is not instruction-tuned; updates do not guarantee understanding or rule compliance.</p><div class="trainerTools"><button id=ctInit>Initialize model</button><label class="checkpointLabel">Restore checkpoint <input id=ctRestore type=file accept=.json></label><button id=ctExport>Export weights</button><button id=ctStop disabled>Stop</button></div><div id=ctLog aria-live=polite aria-label="Training conversation"></div><form id=ctForm><div class="trainComposer"><textarea id=ctText rows=3 aria-label="Training instructions or test question" placeholder="Give an example, provide instructions, or upload training text"></textarea><button id=ctUpload type=button>Upload</button><input id=ctFiles type=file multiple hidden accept=".txt,.md,.json,.csv,.yaml,.yml,.js,.py,.log"></div><div id=ctAttachments></div><div class="trainerActions"><label>Updates <input id=ctUpdates type=number min=1 max=20 value=1></label><button type=submit value=learn>Learn from this</button><button type=submit value=ask>Ask model</button></div></form><p>Learning changes weights. Asking does not train. Training text stays in this tab; export weights before leaving. Plain text uploads only: up to 3 files and 65,536 combined bytes. PDF/images are not supported. Uploading never starts training by itself.</p>`;host.prepend(panel);
const style=document.createElement('style');style.textContent='#ctLog{display:flex;flex-direction:column;gap:16px;min-height:160px;margin:24px 0}#ctLog .m{max-width:92%}.trainerTools,.trainerActions{display:flex;flex-wrap:wrap;align-items:center;gap:10px}.trainComposer{display:flex;border:1px solid #fff;border-radius:18px;align-items:center;overflow:hidden}.trainComposer textarea{border:0;resize:vertical;min-height:100px}.trainComposer button{margin:10px;flex:none}#ctAttachments{overflow-wrap:anywhere}#ctUpdates{width:80px}#conversationTrainer{border:0!important;padding:0!important}.checkpointLabel input{display:block;max-width:220px}#screenTutorial .mathPanel{margin-top:0}@media(max-width:650px){.trainerActions button{flex:1}.trainComposer textarea{padding:10px}.trainComposer button{padding:8px;margin:6px}}';document.head.append(style);
let busy=false,reading=false,stopped=false,files=[],corpus='';
const bytes=t=>new TextEncoder().encode(t).length;
function add(role,text){const n=document.createElement('div');n.className='m '+role;n.textContent=(role==='u'?'You: ':role==='a'?'Model: ':'Trainer status: ')+text;if(role==='error'){n.className='m';n.dataset.tone='error';}if(role==='s')n.dataset.tone='caution';$('ctLog').append(n);n.scrollIntoView({block:'nearest'});return n;}
function lock(v){busy=v;for(const n of panel.querySelectorAll('button,input,textarea'))n.disabled=v;$('ctStop').disabled=!v;advanced.inert=v;if($('buildRnn'))$('buildRnn').disabled=v;}
function result(){return $('labStatus').textContent;}
function ensureIdle(){if(busy||reading||$('labTrain').disabled)throw Error('Another training/model operation is in progress.');}
async function act(fn){let owned=false;try{ensureIdle();lock(true);owned=true;stopped=false;await fn();}catch(e){add('error',e.message);}finally{if(owned)lock(false);}}
$('ctInit').onclick=()=>act(async()=>{await $('labInit').onclick();add('s',result());});
$('ctExport').onclick=()=>{try{ensureIdle();$('labSave').onclick();add('s','Weight export requested. If no model is initialized, initialize or restore one first.');}catch(e){add('error',e.message);}};
$('ctRestore').onchange=async e=>{const file=e.target.files[0];if(!file)return;await act(async()=>{await $('labImport').onchange({target:{files:[file]}});add(/Restored/.test(result())?'s':'error',result());});e.target.value='';};
$('ctStop').onclick=()=>{stopped=true;if(!$('labStop').disabled)$('labStop').onclick();};
$('ctUpload').onclick=()=>$('ctFiles').click();
function renderFiles(){$('ctAttachments').replaceChildren();files.forEach((f,i)=>{const b=document.createElement('button');b.type='button';b.textContent=f.name+' — Remove';b.onclick=()=>{files.splice(i,1);renderFiles();};$('ctAttachments').append(b);});$('ctText').placeholder=files.length?'':'Give an example, provide instructions, or upload training text';}
$('ctFiles').onchange=async e=>{const selected=Array.from(e.target.files);if(!selected.length)return;reading=true;$('ctUpload').disabled=true;try{if(selected.length>3)throw Error('Choose at most 3 training files.');const next=[];let total=0;for(const f of selected){if(!/\.(txt|md|json|csv|yaml|yml|js|py|log)$/i.test(f.name))throw Error('Unsupported training file: '+f.name);if(f.size>65536)throw Error('Training file exceeds 65,536 bytes.');const text=new TextDecoder('utf-8',{fatal:true}).decode(await f.arrayBuffer());if(text.includes('\u0000'))throw Error('Binary training files are not supported.');total+=bytes(text);if(total>65536)throw Error('Combined files exceed 65,536 bytes; nothing truncated.');next.push({name:f.name,text});}files=next;renderFiles();add('s','Files ready. Add instructions or examples and press Learn from this when you want to train.');}catch(x){add('error',x.message);}finally{reading=false;$('ctUpload').disabled=false;e.target.value='';}};
$('ctForm').onsubmit=async e=>{e.preventDefault();if(busy||reading){add('error','Wait for the current operation to finish.');return;}const kind=e.submitter?.value||'learn',text=$('ctText').value.trim();if(!text&&!files.length)return;
 await act(async()=>{
  if(kind==='ask'){
   if(files.length)throw Error('Ask model accepts a text question only. Learn from or remove the files first.');
   if(bytes(text)>2048)throw Error('Test question exceeds 2,048 UTF-8 bytes.');
   add('u',text);$('labPrompt').value=text;$('labLength').value='80';$('labTemp').value='0';
   await $('labGenerate').onclick();const output=$('labOutput').textContent;
   if(output)add('a',output);else add('error',result());$('ctText').value='';return;
  }
  const updates=Number($('ctUpdates').value);if(!Number.isInteger(updates)||updates<1||updates>20)throw Error('Updates must be 1–20.');
  const supplied=[text,...files.map(f=>f.text)].filter(Boolean).join('\n\n'),next=[corpus,supplied].filter(Boolean).join('\n\n');
  if(bytes(next)<17)throw Error('Provide at least 17 UTF-8 bytes of examples/instructions.');if(bytes(next)>131072)throw Error('Training text in this tab exceeds 131,072 bytes. Nothing truncated.');
  if(!confirm('Apply '+updates+' actual weight update(s) to the current 1M checkpoint using '+bytes(next)+' bytes of owner-provided training text? Each update samples 16 next-byte targets. Stopping keeps updates already completed.'))return;
  add('u',text+(files.length?'\nFiles: '+files.map(f=>f.name).join(', '):''));
  $('labText').value=next;let completed=0;const progress=add('s','Training the current model…');
  for(let i=0;i<updates&&!stopped;i++){await $('labTrain').onclick();if(!/^Update \d+/.test(result()))throw Error(result());completed++;progress.textContent='Trainer status: '+completed+'/'+updates+' updates completed. '+result();}
  if(completed){corpus=next;$('ctText').value='';files=[];renderFiles();}
  progress.textContent='Trainer status: '+(stopped?'Stopped. ':'Finished. ')+completed+' weight update(s) completed. Earlier updates are retained. Test with Ask model; this is not proof the instructions were learned.';progress.dataset.tone=stopped?'caution':'ok';
 });
};
route(location.hash.slice(1)||'chat');
