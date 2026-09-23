import { StrictMode, useState, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { createBootDiagnostics, publishBootDiagnostics, type BootStage } from './game/bootDiagnostics';
import type { SaveRecoveryResult } from './game/saveRecovery';
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

function BootLoader() {
  return <main className="surface-loader" role="status" aria-live="polite"><div><span>QUIET SIGNAL // BOOT SEQUENCE</span><b>Validating local save integrity</b><i /></div></main>;
}

const root = createRoot(document.getElementById('root')!);
const bootDiagnostics = createBootDiagnostics();

function markBootStage(stage: BootStage) {
  publishBootDiagnostics(bootDiagnostics.mark(stage));
}

function renderBlocked(recovery: SaveRecoveryResult) {
  root.render(
    <StrictMode>
      <main className="surface-loader" role="alert" aria-live="assertive"><div><span>QUIET SIGNAL // SAVE RECOVERY LOCK</span><b>Existing save data was left untouched.</b><p>{recovery.notices.join(' ')}</p><button onClick={() => window.location.reload()}>Retry startup</button></div></main>
    </StrictMode>
  );
}

function renderClient(recovery: SaveRecoveryResult, App: ComponentType) {
  root.render(
    <StrictMode>
      <AppErrorBoundary><App /><RecoveryNotice notices={recovery.notices} /></AppErrorBoundary>
    </StrictMode>
  );
}

markBootStage('entry');
root.render(<StrictMode><BootLoader /></StrictMode>);

async function startClient() {
  const recoveryModule = await import('./game/saveRecovery');
  markBootStage('recovery-module-ready');

  const recovery = await recoveryModule.prepareSaveRecovery();
  markBootStage('recovery-complete');

  if (recovery.blocked) {
    renderBlocked(recovery);
    markBootStage('recovery-blocked');
    return;
  }

  const { default: App } = await import('./App');
  markBootStage('app-module-ready');
  renderClient(recovery, App);
  markBootStage('app-render-requested');

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => markBootStage('first-frame'));
  } else {
    markBootStage('first-frame');
  }
}

void startClient().catch(() => {
  renderBlocked({
    blocked: true,
    notices: ['SAVE RECOVERY LOCK // startup validation failed unexpectedly, so the game was stopped before any existing save could be overwritten.'],
    backups: [],
  });
  markBootStage('startup-failed');
});
