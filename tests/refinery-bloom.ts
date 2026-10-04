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
const browserSmokeSource = readFileSync(resolve(process.cwd(), 'scripts/browser-runtime-smoke.mjs'), 'utf8');
const androidSmokeSource = readFileSync(resolve(process.cwd(), 'scripts/android-runtime-smoke.mjs'), 'utf8');
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
