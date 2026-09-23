import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { prepareSaveRecovery, type SaveRecoveryResult } from './game/saveRecovery';
import './index.css';
import './spaceCombat.css';
import './mobileCombatReadability.css';
import './uiPolish.css';
import './designSystem.css';
import './missionPresentation.css';

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

function RecoveryNotice({ notices }: { notices: string[] }) {
  const [visible, setVisible] = useState(true);
  if (!visible || notices.length === 0) return null;
  return <aside role="alert" aria-live="assertive" style={{ position: 'fixed', zIndex: 10000, left: 12, right: 12, bottom: 12, maxWidth: 920, margin: '0 auto', padding: '12px 14px', border: '1px solid rgba(238,178,90,.72)', background: 'rgba(11,18,24,.97)', color: '#f2eee5', boxShadow: '0 10px 32px rgba(0,0,0,.45)', fontFamily: 'inherit' }}><div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between' }}><div><b>SAVE RECOVERY</b>{notices.map(notice => <div key={notice} style={{ marginTop: 5, fontSize: 12, lineHeight: 1.45 }}>{notice}</div>)}</div><button onClick={() => setVisible(false)}>Dismiss</button></div></aside>;
}

const root = createRoot(document.getElementById('root')!);

function renderClient(recovery: SaveRecoveryResult) {
  root.render(
    <StrictMode>
      {recovery.blocked ? <main className="surface-loader" role="alert" aria-live="assertive"><div><span>QUIET SIGNAL // SAVE RECOVERY LOCK</span><b>Existing save data was left untouched.</b><p>{recovery.notices.join(' ')}</p><button onClick={() => window.location.reload()}>Retry startup</button></div></main> : <AppErrorBoundary><App /><RecoveryNotice notices={recovery.notices} /></AppErrorBoundary>}
    </StrictMode>
  );
}

void prepareSaveRecovery()
  .then(renderClient)
  .catch(() => renderClient({ blocked: true, notices: ['SAVE RECOVERY LOCK // startup validation failed unexpectedly, so the game was stopped before any existing save could be overwritten.'], backups: [] }));
