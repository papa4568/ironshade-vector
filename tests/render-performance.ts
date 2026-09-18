import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AdaptiveRenderBudget } from '../src/game/renderQuality';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const gameCanvasSource = readFileSync(resolve(process.cwd(), 'src/components/GameCanvas.tsx'), 'utf8');
assert(!gameCanvasSource.includes('useRef<SimState>(createMissionState(firstMission))'), 'GameCanvas must not construct a new simulation on every React render');
assert(gameCanvasSource.includes('useState(() => createMissionState(firstMission))'), 'GameCanvas initial simulation should use a lazy one-time initializer');
assert(gameCanvasSource.includes('profileSettingsRef.current.effectIntensity') && gameCanvasSource.includes('profileSettingsRef.current.screenShake'), 'combat render loop must read live profile settings');

const rendererSource = readFileSync(resolve(process.cwd(), 'src/game/threeCombatRenderer.ts'), 'utf8');
const bossSyncStart = rendererSource.indexOf('private syncBossSignature');
const enemySyncStart = rendererSource.indexOf('private syncEnemies');
assert(bossSyncStart > 0 && enemySyncStart > bossSyncStart, 'boss signature sync path must exist before enemy iteration');
const bossSyncSource = rendererSource.slice(bossSyncStart, enemySyncStart);
assert(!bossSyncSource.includes('new THREE.Mesh(') && !bossSyncSource.includes('new THREE.' + 'Geometry'), 'boss hot path must update pooled visuals instead of allocating geometry per frame');
assert(rendererSource.includes("this.playerReadabilityLight.distance = reducedEffects ? 5.8 : 7.5"), 'reduced-effects mode must retain combat readability lighting');
assert(rendererSource.includes("telegraph.visible = enemy.telegraph > 0"), 'boss telegraph geometry must remain available independent of particle density');

const desktop = new AdaptiveRenderBudget(false);
let snapshot = desktop.sample(16.7, 1);
assert(snapshot.tier === 0, 'desktop should start at full quality');
assert(snapshot.tierName === 'high', 'desktop full quality should expose the high tier name');
assert(snapshot.shadows, 'desktop full quality should keep shadows');
assert(snapshot.shadowMapSize === 1024, 'high tier should use the 1024 shadow budget');
assert(snapshot.vfxDensity === 1, 'high tier should keep full VFX density');
assert(snapshot.transparencyScale === 1, 'high tier should keep full transparency budget');

for (let index = 0; index < 90; index += 1) snapshot = desktop.sample(30, 1);
assert(snapshot.tier >= 1, 'sustained slow frames should lower render quality');
for (let index = 0; index < 90; index += 1) snapshot = desktop.sample(30, 1);
assert(snapshot.tier === 2, 'continued slow frames should reach performance tier');
assert(snapshot.tierName === 'performance', 'slow-frame adaptation should expose the performance tier name');
assert(!snapshot.shadows, 'performance tier should disable dynamic shadows');
assert(snapshot.shadowMapSize === 256, 'performance tier should cap shadow-map allocation at 256');
assert(snapshot.pixelRatioScale < 0.75, 'performance tier should reduce pixel density');
assert(snapshot.vfxDensity === 0.45, 'performance tier should reduce secondary VFX density');
assert(snapshot.transparencyScale === 0.4, 'performance tier should reduce transparency-heavy effects');

for (let index = 0; index < 700; index += 1) snapshot = desktop.sample(16.4, 1);
assert(snapshot.tier === 0, 'sustained healthy frames should recover desktop quality');

const coarse = new AdaptiveRenderBudget(true);
snapshot = coarse.sample(16.7, 1);
assert(snapshot.tier === 1, 'coarse pointers should start at balanced tier');
assert(snapshot.tierName === 'balanced', 'coarse/mobile should expose balanced tier at startup');
assert(snapshot.shadowMapSize === 512, 'balanced tier should cap shadows at 512');
assert(snapshot.vfxDensity === 0.72, 'balanced tier should reduce secondary VFX density');
assert(snapshot.transparencyScale === 0.68, 'balanced tier should reduce transparency cost');

const reducedEffects = new AdaptiveRenderBudget(false);
snapshot = reducedEffects.sample(16.7, 0.45);
assert(snapshot.tier === 2, 'reduced effect intensity should enforce performance visual tier');
assert(!snapshot.shadows, 'reduced effect intensity should disable dynamic shadows');
assert(snapshot.vfxDensity === 0.45 && snapshot.transparencyScale === 0.4, 'reduced effects should enforce the low-cost VFX/transparency budgets');

assert(rendererSource.includes('budget.shadowMapSize'), 'renderer must apply the tier shadow-map budget');
assert(rendererSource.includes('budget.vfxDensity'), 'renderer must apply the tier VFX density budget');
assert(rendererSource.includes('budget.transparencyScale'), 'renderer must apply the tier transparency budget');
assert(rendererSource.includes('dataset.renderTier = budget.tierName'), 'runtime QA must expose the active render tier');
assert(rendererSource.includes('tier-${budget.tier}'), 'environment signature must react to render-tier transitions so authored LOD can change');
assert(rendererSource.includes('loadAuthoredRefineryEnvironment(state, world.w, world.h, budget.detailScale)'), 'refinery authored LOD selection must follow the active detail tier');

console.log('RENDER_PERFORMANCE_PASS');
