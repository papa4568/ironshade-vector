import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resolveBabylonRefineryLightingBudget,
} from '../src/game/babylonRefineryLighting';
import { AdaptiveRenderBudget } from '../src/game/renderQuality';

const highSnapshot = new AdaptiveRenderBudget(false).sample(1000 / 60, 1, 'flagship');
const balancedSnapshot = new AdaptiveRenderBudget(false).sample(1000 / 60, 0.72, 'adaptive');
const performanceSnapshot = new AdaptiveRenderBudget(false).sample(1000 / 60, 0.5, 'performance');

const high = resolveBabylonRefineryLightingBudget(highSnapshot);
const balanced = resolveBabylonRefineryLightingBudget(balancedSnapshot);
const performance = resolveBabylonRefineryLightingBudget(performanceSnapshot);

assert.deepEqual(
  {
    tier: high.tierName,
    shadow: high.shadowMapSize,
    receivers: high.shadowReceiverLimit,
    practical: high.practicalLightCount,
    lights: high.maxSimultaneousLights,
  },
  { tier: 'high', shadow: 1024, receivers: 128, practical: 2, lights: 6 },
  'High Babylon lighting budget must preserve full key shadow with a bounded receiver set, practicals, and material light count.',
);
assert.deepEqual(
  {
    tier: balanced.tierName,
    shadow: balanced.shadowMapSize,
    receivers: balanced.shadowReceiverLimit,
    practical: balanced.practicalLightCount,
    lights: balanced.maxSimultaneousLights,
  },
  { tier: 'balanced', shadow: 512, receivers: 72, practical: 2, lights: 5 },
  'Balanced Babylon lighting budget must reduce shadow resolution and receiver count without dropping authored practical identity.',
);
assert.deepEqual(
  {
    tier: performance.tierName,
    shadow: performance.shadowMapSize,
    receivers: performance.shadowReceiverLimit,
    practical: performance.practicalLightCount,
    lights: performance.maxSimultaneousLights,
  },
  { tier: 'performance', shadow: 0, receivers: 0, practical: 1, lights: 3 },
  'Performance Babylon lighting budget must shed shadows and receivers before critical readability.',
);
assert.equal(high.iblEnabled, true);
assert.equal(balanced.iblEnabled, true);
assert.equal(performance.iblEnabled, false);
assert(high.iblIntensity > balanced.iblIntensity && balanced.iblIntensity > performance.iblIntensity);

const rendererSource = readFileSync('src/game/babylonCombatRenderer.ts', 'utf8');
const lightingSource = readFileSync('src/game/babylonRefineryLighting.ts', 'utf8');
const worldSource = readFileSync('src/game/babylonWorldPresentation.ts', 'utf8');
const iblSource = readFileSync('src/game/refineryIbl.ts', 'utf8');
const packageSource = readFileSync('package.json', 'utf8');
const browserSource = readFileSync('scripts/browser-runtime-smoke.mjs', 'utf8');

assert.match(rendererSource, /new AdaptiveRenderBudget\(coarse\)/, 'Babylon lighting must consume the shared adaptive render budget.');
assert.match(rendererSource, /new BabylonRefineryLighting\(scene, canvas\)/, 'Babylon renderer must own the B11 lighting layer.');
assert.match(rendererSource, /this\.refineryLighting\.sync\(state, budget\)/, 'Babylon renderer must synchronize B11 every refinery frame.');
assert.match(rendererSource, /this\.refineryLighting\.dispose\(\)/, 'Babylon renderer must deterministically release B11 GPU resources.');
assert.match(lightingSource, /new RawCubeTexture\(/, 'B11 must use a Babylon-native cubemap for refinery IBL.');
assert.match(lightingSource, /TONEMAPPING_ACES/, 'B11 must preserve ACES tone mapping parity.');
assert.match(lightingSource, /new ShadowGenerator\(budget\.shadowMapSize, this\.keyLight\)/, 'B11 must use bounded Babylon key-light shadow maps.');
assert.match(
  lightingSource,
  /const shadowCandidates = this\.scene\.meshes\.filter\(isShadowCandidate\);/,
  'B11 must keep shadow casting independent from the bounded receiver set.',
);
assert.match(
  lightingSource,
  /\.filter\(isRefineryShadowReceiver\)[\s\S]*?\.slice\(0, budget\.shadowReceiverLimit\);/,
  'B11 must bound first-time Babylon shadow receiver invalidation to refinery receiving surfaces.',
);
assert.match(
  lightingSource,
  /const casters = shadowCandidates[\s\S]*?\.slice\(0, budget\.shadowCasterLimit\);/,
  'B11 must retain the existing independent shadow caster budget.',
);
assert.match(
  lightingSource,
  /if \(!mesh\.receiveShadows\) mesh\.receiveShadows = true;/,
  'B11 shadow receiver setup must avoid unnecessary Babylon receiver setter calls after initialization.',
);
assert.match(lightingSource, /refineryIblQa === 'off'/, 'B11 must preserve deterministic IBL stack-off QA capture control.');
assert.match(worldSource, /new PBRMaterial\('p27-b5-object-material-'/, 'Babylon refinery world fallback materials must use Babylon PBR.');
assert.match(worldSource, /visual\.material\.metallic =/, 'Babylon world material response must preserve authored metalness.');
assert.match(worldSource, /visual\.material\.roughness =/, 'Babylon world material response must preserve authored roughness.');
assert.match(iblSource, /from '.\/refineryLightingProfile'/, 'Three and Babylon refinery IBL must share the authored environment profile.');
assert.match(browserSource, /BROWSER_P27B11_BABYLON_PBR_LIGHTING_PASS/, 'Browser QA must capture the real WebGL Babylon B11 stack.');
assert.match(packageSource, /test:babylon-refinery-lighting/, 'Production build must execute the B11 regression.');

console.log('P27_B11_BABYLON_PBR_LIGHTING_PASS pbr=authored+procedural ibl=shared-amber-cyan tone=aces shadows=1024>512>off receivers=128>72>0 practicals=2>2>1 qa-capture=webgl adaptive=shared-budget');