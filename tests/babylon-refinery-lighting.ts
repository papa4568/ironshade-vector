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
  { tier: high.tierName, shadow: high.shadowMapSize, practical: high.practicalLightCount, lights: high.maxSimultaneousLights },
  { tier: 'high', shadow: 1024, practical: 2, lights: 6 },
  'High Babylon lighting budget must preserve full key shadow, practicals, and material light count.',
);
assert.deepEqual(
  { tier: balanced.tierName, shadow: balanced.shadowMapSize, practical: balanced.practicalLightCount, lights: balanced.maxSimultaneousLights },
  { tier: 'balanced', shadow: 512, practical: 2, lights: 5 },
  'Balanced Babylon lighting budget must reduce shadow resolution without dropping authored practical identity.',
);
assert.deepEqual(
  { tier: performance.tierName, shadow: performance.shadowMapSize, practical: performance.practicalLightCount, lights: performance.maxSimultaneousLights },
  { tier: 'performance', shadow: 0, practical: 1, lights: 3 },
  'Performance Babylon lighting budget must shed shadows and the secondary practical before critical readability.',
);
assert.equal(high.iblEnabled, true);
assert.equal(balanced.iblEnabled, true);
assert.equal(performance.iblEnabled, false);
assert(high.iblIntensity > balanced.iblIntensity && balanced.iblIntensity > performance.iblIntensity);

const rendererSource = readFileSync('src/game/babylonCombatRenderer.ts', 'utf8');
const lightingSource = readFileSync('src/game/babylonRefineryLighting.ts', 'utf8');
const worldSource = readFileSync('src/game/babylonWorldPresentation.ts', 'utf8');
const packageSource = readFileSync('package.json', 'utf8');
const browserSource = readFileSync('scripts/browser-runtime-smoke.mjs', 'utf8');

assert.match(rendererSource, /new AdaptiveRenderBudget\(coarse\)/, 'Babylon lighting must consume the shared adaptive render budget.');
assert.match(rendererSource, /new BabylonRefineryLighting\(scene, canvas\)/, 'Babylon renderer must own the B11 lighting layer.');
assert.match(rendererSource, /this\.refineryLighting\.sync\(state, budget\)/, 'Babylon renderer must synchronize B11 every refinery frame.');
assert.match(rendererSource, /this\.refineryLighting\.dispose\(\)/, 'Babylon renderer must deterministically release B11 GPU resources.');
assert.match(lightingSource, /new RawCubeTexture\(/, 'B11 must use a Babylon-native cubemap for refinery IBL.');
assert.match(lightingSource, /TONEMAPPING_ACES/, 'B11 must preserve ACES tone mapping parity.');
assert.match(lightingSource, /new ShadowGenerator\(budget\.shadowMapSize, this\.keyLight\)/, 'B11 must use bounded Babylon key-light shadow maps.');
assert.match(lightingSource, /refineryIblQa === 'off'/, 'B11 must preserve deterministic IBL stack-off QA capture control.');
assert.match(worldSource, /new PBRMaterial\('p27-b5-object-material-'/, 'Babylon refinery world fallback materials must use Babylon PBR.');
assert.match(worldSource, /visual\.material\.metallic =/, 'Babylon world material response must preserve authored metalness.');
assert.match(worldSource, /visual\.material\.roughness =/, 'Babylon world material response must preserve authored roughness.');
assert.match(browserSource, /BROWSER_P27B11_BABYLON_PBR_LIGHTING_PASS/, 'Browser QA must capture the real WebGL Babylon B11 stack.');
assert.match(packageSource, /test:babylon-refinery-lighting/, 'Production build must execute the B11 regression.');

console.log('P27_B11_BABYLON_PBR_LIGHTING_PASS pbr=authored+procedural ibl=shared-amber-cyan tone=aces shadows=1024>512>off practicals=2>2>1 qa-capture=webgl adaptive=shared-budget');
