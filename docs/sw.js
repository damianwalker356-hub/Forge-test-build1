const CACHE='forge-agent-conversation-v1';
const FILES=['./','index.html','ui.css','ui.js','app.js','agent.js','memory.js','tools.js','llm.js','seed.js','manifest.webmanifest','icon.svg','lab-loader.js','local-lab.js','owner-rules.js','model-records.js','math-core.js','math-lab.js','math-checkpoint.json','conversation-trainer.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));self.skipWaiting();});
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)));}return r;}).catch(()=>caches.match(e.request)));});
