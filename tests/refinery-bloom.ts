import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  clampRefineryBloomCostScale,
  isRefineryBloomAssetLabel,
  REFINERY_BLOOM_LAYER,
  REFINERY_BLOOM_PROFILE,
  refineryBloomResolutionScale,
  refineryBloomStrengthForCost,
} from '../src/game/refineryBloomProfile';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(REFINERY_BLOOM_LAYER === 1, 'P21-C selective bloom must remain isolated on one non-default scene layer.');
assert(REFINERY_BLOOM_PROFILE.strength > 0 && REFINERY_BLOOM_PROFILE.strength < 0.7, 'P21-C bloom strength must stay bounded.');
assert(REFINERY_BLOOM_PROFILE.radius > 0 && REFINERY_BLOOM_PROFILE.radius < 0.5, 'P21-C bloom radius must stay bounded.');
assert(clampRefineryBloomCostScale(-1) === 0 && clampRefineryBloomCostScale(2) === 1, 'P21-C bloom cost control must clamp to 0..1.');
assert(refineryBloomResolutionScale(0) === 0, 'P21-C zero bloom cost must allow a complete post-processing bypass.');
assert(refineryBloomResolutionScale(0.35) < refineryBloomResolutionScale(1), 'P21-C reduced bloom cost must lower bloom render resolution.');
assert(refineryBloomStrengthForCost(0.35) < refineryBloomStrengthForCost(1), 'P21-C reduced bloom cost must lower secondary glow strength.');
assert(isRefineryBloomAssetLabel('refinery-terminal') && isRefineryBloomAssetLabel('refinery-processor'), 'P21-C authored refinery emissives must be explicit bloom sources.');
for (const excluded of ['refinery-floor', 'refinery-bulkhead', 'refinery-crate', 'objective', 'loot', 'hazard', 'interactable', 'enemy']) {
  assert(!isRefineryBloomAssetLabel(excluded), `P21-C non-emissive/gameplay source leaked into authored bloom selection: ${excluded}`);
}

const rendererSource = readFileSync(resolve(process.cwd(), 'src/game/threeCombatRenderer.ts'), 'utf8');
const browserSmokeSource = readFileSync(resolve(process.cwd(), 'scripts/browser-runtime-smoke.mjs'), 'utf8');
const androidSmokeSource = readFileSync(resolve(process.cwd(), 'scripts/android-runtime-smoke.mjs'), 'utf8');

assert(
  rendererSource.includes('new RefineryBloomPipeline(this.renderer, this.scene, this.camera)')
    && rendererSource.includes('this.refineryBloom.render()')
    && rendererSource.includes('this.renderer.render(this.scene, this.camera)'),
  'P21-C renderer must provide a refinery bloom post-process path plus a zero-cost/non-refinery direct-render path.',
);
assert(
  rendererSource.includes("this.renderer.domElement.dataset.graphicsPathSelection === 'qa-explicit'")
    && rendererSource.includes("this.renderer.domElement.dataset.refineryBloomQa === 'off'")
    && rendererSource.includes("'off:qa-baseline'"),
  'P21-C deterministic bloom disable must be QA-only and leave production enabled by default.',
);
assert(
  rendererSource.includes('mesh.layers.enable(REFINERY_BLOOM_LAYER)')
    && rendererSource.includes('this.muzzleFlash.layers.enable(REFINERY_BLOOM_LAYER)')
    && rendererSource.includes('mesh.layers.set(REFINERY_BLOOM_LAYER)'),
  'P21-C selective layer must cover authored emissives, practical-light proxies, and important muzzle VFX.',
);
for (const methodName of ['private syncObjectiveBeacon', 'private ensureHazard', 'private syncGroundLoot', 'private syncEnemies']) {
  const start = rendererSource.indexOf(methodName);
  const next = rendererSource.indexOf('\n  private ', start + methodName.length);
  const body = rendererSource.slice(start, next > start ? next : rendererSource.length);
  assert(start >= 0 && !body.includes('REFINERY_BLOOM_LAYER'), `P21-C must not add bloom to gameplay-critical path: ${methodName}`);
}
assert(
  rendererSource.includes("REFINERY_BLOOM_PROFILE.excludedCueGroups.join('+')")
    && REFINERY_BLOOM_PROFILE.excludedCueGroups.join('+') === 'hud+enemies+hazards+objectives+loot+interactables',
  'P21-C must expose the protected gameplay-cue groups in runtime telemetry.',
);
assert(
  rendererSource.includes('this.refineryBloom.resize(this.width, this.height, this.pixelRatio, costScale)')
    && rendererSource.includes('this.refineryBloom.dispose()'),
  'P21-C post-processing lifecycle must resize and dispose with the WebGL renderer.',
);
assert(
  browserSmokeSource.includes('BROWSER_P21C_BLOOM_PASS')
    && browserSmokeSource.includes("canvas.dataset.refineryBloomQa = 'off'")
    && browserSmokeSource.includes("canvas.dataset.refineryBloomCost = '0.45'")
    && browserSmokeSource.includes('p21c-bloom-off')
    && browserSmokeSource.includes('p21c-bloom-on'),
  'P21-C Browser E2E must verify deterministic bloom off/on evidence plus the runtime cost control.',
);
assert(
  androidSmokeSource.includes('ANDROID_P21C_BLOOM_PASS')
    && androidSmokeSource.includes('ANDROID_P21C_BLOOM_RESUME_PASS'),
  'P21-C Android fast smoke must cover production bloom and pause/resume stability.',
);

console.log(`P21C_REFINERY_BLOOM_PASS layer=${REFINERY_BLOOM_LAYER} strength=${REFINERY_BLOOM_PROFILE.strength.toFixed(2)} radius=${REFINERY_BLOOM_PROFILE.radius.toFixed(2)} cost=0..1 sources=authored-emissive+practical+muzzle excluded=${REFINERY_BLOOM_PROFILE.excludedCueGroups.join('+')}`);
