import { mountPanels } from './ui.js';
try { await import('./local-lab.js'); await import('./owner-rules.js'); await import('./math-lab.js'); mountPanels(); await import('./conversation-trainer.js'); } catch(e) { const p=document.createElement('p');p.textContent='Trainer load failed: '+e.message;p.dataset.tone='error';document.querySelector('#trainingPanels').append(p); }
