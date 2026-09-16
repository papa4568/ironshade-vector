from pathlib import Path
import json


def replace_exact(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, found {count}')
    return text.replace(old, new, 1)

# App: split major surfaces behind real navigation boundaries.
path = Path('src/App.tsx')
text = path.read_text()
text = replace_exact(text, "import { useEffect, useMemo, useState } from 'react';", "import { lazy, Suspense, useEffect, useMemo, useState } from 'react';", 'react lazy import')
text = replace_exact(text, "import Armory from './components/Armory';\nimport GameCanvas from './components/GameCanvas';\nimport ShipHub from './components/ShipHub';\n", "", 'remove eager surface imports')
anchor = "type Screen = 'ship' | 'combat' | 'build' | 'debrief';"
insert = """const loadArmory = () => import('./components/Armory');
const loadGameCanvas = () => import('./components/GameCanvas');
const loadShipHub = () => import('./components/ShipHub');
const Armory = lazy(loadArmory);
const GameCanvas = lazy(loadGameCanvas);
const ShipHub = lazy(loadShipHub);

type Screen = 'ship' | 'combat' | 'build' | 'debrief';"""
text = replace_exact(text, anchor, insert, 'lazy surface declarations')
loader_anchor = "type UplinkStatus = 'local' | 'sharing' | 'shared' | 'error';"
loader = """type UplinkStatus = 'local' | 'sharing' | 'shared' | 'error';

function SurfaceLoader({ screen }: { screen: Screen }) {
  const label = screen === 'combat' ? 'Preparing combat renderer' : screen === 'build' ? 'Opening equipment systems' : screen === 'ship' ? 'Opening command deck' : 'Loading mission debrief';
  return <main className=\"surface-loader\" role=\"status\" aria-live=\"polite\"><div><span>QUIET SIGNAL // CLIENT STREAM</span><b>{label}</b><i /></div></main>;
}"""
text = replace_exact(text, loader_anchor, loader, 'surface loader')
old_return = """  return <div className=\"app-shell\" onPointerDownCapture={() => feedback.unlock()} onClickCapture={event => { const target = event.target as HTMLElement; if (target.closest('button') && !target.closest('.game-root')) feedback.cue('ui'); }}>
    {screen === 'ship' && <ShipHub profile={profile} campaign={campaign} contracts={contracts} operations={operations} operationsStatus={operationsStatus} telemetrySharing={profile.settings.telemetrySharing} selectedContractId={selectedContract?.id ?? ''} statusMessage={statusMessage} onSelectContract={setSelectedContractId} onDeploy={() => selectedContract && setScreen('combat')} onOpenBuild={() => setScreen('build')} onCampaignChange={setCampaign} />}
    {screen === 'build' && <Armory profile={profile} campaign={campaign} newLootIds={newLootIds} onProfileChange={setProfile} onCampaignChange={setCampaign} onClose={() => { setNewLootIds([]); setScreen('ship'); }} />}
    {screen === 'combat' && selectedContract && <GameCanvas key={selectedContract.id} build={combatBuild} mission={selectedContract} profileSettings={profile.settings} consumables={campaign.consumables} buildLabel={buildIdentity(profile)} operatorFaction={dominantEquipmentFaction(profile)} onProfileSettingsChange={changeProfileSettings} onConsumablesChange={consumables => setCampaign(current => ({ ...current, consumables }))} onMissionResolve={finishMission} onAttemptFailed={reportFailedAttempt} onReturnToHub={abandonMission} />}
    {screen === 'debrief' && debrief && <DebriefScreen result={debrief} onShip={() => { setNewLootIds([]); setScreen('ship'); }} onBuild={() => setScreen('build')} onDiscard={discardRecoveredItem} onRepeat={contracts.some(contract => contract.id === debrief.contract.id) ? () => setScreen('combat') : undefined} />}
  </div>;"""
new_return = """  const openBuild = () => { void loadArmory(); setScreen('build'); };
  const openCombat = () => { if (!selectedContract) return; void loadGameCanvas(); setScreen('combat'); };

  return <div className=\"app-shell\" data-client-architecture=\"split-v1\" onPointerDownCapture={() => feedback.unlock()} onClickCapture={event => { const target = event.target as HTMLElement; if (target.closest('button') && !target.closest('.game-root')) feedback.cue('ui'); }}>
    <Suspense fallback={<SurfaceLoader screen={screen} />}>
      {screen === 'ship' && <ShipHub profile={profile} campaign={campaign} contracts={contracts} operations={operations} operationsStatus={operationsStatus} telemetrySharing={profile.settings.telemetrySharing} selectedContractId={selectedContract?.id ?? ''} statusMessage={statusMessage} onSelectContract={setSelectedContractId} onDeploy={openCombat} onOpenBuild={openBuild} onCampaignChange={setCampaign} />}
      {screen === 'build' && <Armory profile={profile} campaign={campaign} newLootIds={newLootIds} onProfileChange={setProfile} onCampaignChange={setCampaign} onClose={() => { setNewLootIds([]); setScreen('ship'); }} />}
      {screen === 'combat' && selectedContract && <GameCanvas key={selectedContract.id} build={combatBuild} mission={selectedContract} profileSettings={profile.settings} consumables={campaign.consumables} buildLabel={buildIdentity(profile)} operatorFaction={dominantEquipmentFaction(profile)} onProfileSettingsChange={changeProfileSettings} onConsumablesChange={consumables => setCampaign(current => ({ ...current, consumables }))} onMissionResolve={finishMission} onAttemptFailed={reportFailedAttempt} onReturnToHub={abandonMission} />}
      {screen === 'debrief' && debrief && <DebriefScreen result={debrief} onShip={() => { setNewLootIds([]); setScreen('ship'); }} onBuild={openBuild} onDiscard={discardRecoveredItem} onRepeat={contracts.some(contract => contract.id === debrief.contract.id) ? () => { void loadGameCanvas(); setScreen('combat'); } : undefined} />}
    </Suspense>
  </div>;"""
text = replace_exact(text, old_return, new_return, 'lazy screen rendering')
path.write_text(text)

# main: recover gracefully when a cached page references chunks deleted by a newer deploy.
path = Path('src/main.tsx')
text = path.read_text()
anchor = "import './uiPolish.css';\n\n"
handler = """import './uiPolish.css';

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

"""
text = replace_exact(text, anchor, handler, 'vite preload recovery')
path.write_text(text)

# Vite: emit a manifest for bundle-budget validation and isolate Three.js from other async UI chunks.
path = Path('vite.config.ts')
text = path.read_text()
text = replace_exact(text, "    sourcemap: false,\n    rollupOptions: {\n      maxParallelFileOps: 128,\n    },", "    sourcemap: false,\n    manifest: true,\n    rollupOptions: {\n      maxParallelFileOps: 128,\n      output: {\n        manualChunks(id) {\n          if (id.includes('/node_modules/three/')) return 'three-runtime';\n          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) return 'react-runtime';\n        },\n      },\n    },", 'vite chunk strategy')
path.write_text(text)

# Package: enforce the production client budget after Vite writes dist.
path = Path('package.json')
data = json.loads(path.read_text())
data['scripts']['test:bundle'] = 'node tests/client-bundle-budget.mjs'
data['scripts']['build'] = 'npm run test:beta && npm run test:gameplay && npm run test:maps && npm run test:loot && npm run test:ui && vite build && npm run test:bundle'
path.write_text(json.dumps(data, indent=2) + '\n')

# Loading state styling lives in the final UI override so all lazy surfaces share one language.
path = Path('src/uiPolish.css')
text = path.read_text()
text += """

/* Navigation-level code splitting fallback. Keep this tiny because it is part of the boot CSS. */
.surface-loader { min-height:100svh; display:grid; place-items:center; padding:24px; background:radial-gradient(circle at 50% 42%,rgba(63,111,98,.12),transparent 34%),#050a09; color:#c7d7d1; }
.surface-loader>div { width:min(420px,82vw); padding:18px; border:1px solid #304b43; background:#091210; box-shadow:0 18px 60px rgba(0,0,0,.35); }
.surface-loader span,.surface-loader b { display:block; }
.surface-loader span { color:#6f8c82; font:800 8px/1 ui-monospace,monospace; letter-spacing:.13em; }
.surface-loader b { margin-top:8px; font-size:15px; }
.surface-loader i { display:block; position:relative; height:3px; margin-top:14px; overflow:hidden; background:#14251f; }
.surface-loader i::after { content:''; position:absolute; inset:0; width:38%; background:#89b8a8; animation:client-stream 1s ease-in-out infinite alternate; }
@keyframes client-stream { from { transform:translateX(-10%); } to { transform:translateX(190%); } }
@media (prefers-reduced-motion:reduce) { .surface-loader i::after { animation:none; width:65%; } }
"""
path.write_text(text)

print('CLIENT_SPLITTING_PATCH_APPLIED')
