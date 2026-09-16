import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './spaceCombat.css';
import './mobileCombatReadability.css';
import './uiPolish.css';

window.addEventListener('vite:preloadError', event => {
  event.preventDefault();
  try {
    const key = 'ironshade:chunk-reload';
    const now = Date.now();
    const previous = Number(sessionStorage.getItem(key) ?? '0');
    if (now - previous < 10_000) return;
    sessionStorage.setItem(key, String(now));
  } catch {
    // sessionStorage can be unavailable in hardened browser modes; reloading is still safe.
  }
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
