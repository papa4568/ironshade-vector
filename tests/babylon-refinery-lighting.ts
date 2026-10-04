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
const iblSource = readFileSync('src/game/refineryLightingProfile.ts', 'utf8');
const packageSource = readFileSync('package.json', 'utf8');
const browserSource = readFileSync('scripts/browser-runtime-smoke.mjs', 'utf8');
const environmentBytes = readFileSync('public/assets/environments/refinery-prefiltered.env');
const environmentMagic = Buffer.from([0x86, 0x16, 0x87, 0x96, 0xf6, 0xd6, 0x96, 0x36]);
assert(environmentBytes.subarray(0, environmentMagic.length).equals(environmentMagic), 'P28-A1 refinery environment must use Babylon .env magic bytes.');
const manifestEnd = environmentBytes.indexOf(0, environmentMagic.length);
assert(manifestEnd > environmentMagic.length, 'P28-A1 refinery environment must contain a JSON manifest.');
const environmentManifest = JSON.parse(environmentBytes.subarray(environmentMagic.length, manifestEnd).toString('utf8')) as {
  version?: number;
  width?: number;
  irradiance?: Record<string, unknown>;
  specular?: { mipmaps?: Array<{ length?: number; position?: number }>; lodGenerationScale?: number };
};
assert.equal(environmentManifest.version, 1, 'P28-A1 refinery environment manifest version must be Babylon v1.');
assert((environmentManifest.width ?? 0) >= 16, 'P28-A1 authored environment must exceed the former 8x8 procedural cubemap resolution.');
assert.equal(environmentManifest.specular?.mipmaps?.length, 30, 'P28-A1 16px environment must contain five prefiltered mip levels across six faces.');
assert.equal(environmentManifest.specular?.lodGenerationScale, 0.8, 'P28-A1 authored environment must preserve calibrated Babylon roughness LOD generation.');
assert(environmentManifest.irradiance && Object.keys(environmentManifest.irradiance).length >= 9, 'P28-A1 authored environment must carry diffuse irradiance polynomial data.');
for (const mip of environmentManifest.specular?.mipmaps ?? []) {
  assert((mip.length ?? 0) > 0 && (mip.position ?? -1) >= 0, 'P28-A1 prefiltered mip entries must be non-empty and addressable.');
}

assert.match(rendererSource, /new AdaptiveRenderBudget\(qualityCoarse\)/, 'Babylon lighting must consume the shared adaptive render budget.');
assert.match(rendererSource, /new BabylonRefineryLighting\(scene, canvas\)/, 'Babylon renderer must own the B11 lighting layer.');
assert.match(rendererSource, /this\.refineryLighting\.sync\(state, budget\)/, 'Babylon renderer must synchronize B11 every refinery frame.');
assert.match(rendererSource, /this\.refineryLighting\.dispose\(\)/, 'Babylon renderer must deterministically release B11 GPU resources.');
assert.match(lightingSource, /new CubeTexture\(/, 'P28-A1 must load a Babylon-native authored prefiltered environment.');
assert.match(lightingSource, /refinery-prefiltered\.env/, 'P28-A1 must load the refinery environment from a committed local packaged asset.');
assert.match(lightingSource, /prefiltered-env:ready/, 'P28-A1 must expose deterministic authored-environment readiness telemetry.');
assert.match(lightingSource, /activateIblFallback\(\)/, 'P28-A1 must keep a deterministic load-failure fallback path.');
assert.match(lightingSource, /new RawCubeTexture\(/, 'P28-A1 must retain the procedural cubemap only as a bounded fallback.');
assert.match(lightingSource, /raw-cube-fallback/, 'P28-A1 fallback telemetry must not masquerade as the authored environment path.');
assert.match(lightingSource, /TONEMAPPING_ACES/, 'B11 must preserve ACES tone mapping parity.');
assert.match(lightingSource, /new ShadowGenerator\(budget\.shadowMapSize, this\.keyLight\)/, 'B11 must use bounded Babylon key-light shadow maps.');
assert.match(lightingSource, /refineryIblQa === 'off'/, 'B11 must preserve deterministic IBL stack-off QA capture control.');
assert.match(worldSource, /new PBRMaterial\('p27-b5-object-material-'/, 'Babylon refinery world fallback materials must use Babylon PBR.');
assert.match(worldSource, /visual\.material\.metallic =/, 'Babylon world material response must preserve authored metalness.');
assert.match(worldSource, /visual\.material\.roughness =/, 'Babylon world material response must preserve authored roughness.');
assert.match(iblSource, /REFINERY_IBL_PROFILE/, 'Babylon refinery IBL must use the engine-neutral authored environment profile.');
assert.match(browserSource, /BROWSER_P27B11_BABYLON_PBR_LIGHTING_PASS/, 'Browser QA must capture the real WebGL Babylon B11 stack.');
assert.match(browserSource, /p27b11-ibl-off/, 'Browser QA must retain the refinery IBL-off comparison capture.');
assert.match(browserSource, /p27b11-ibl-on/, 'Browser QA must retain the refinery IBL-on comparison capture.');
assert.match(packageSource, /test:babylon-refinery-lighting/, 'Production build must execute the refinery lighting regression.');

console.log('P28_A1_REFINERY_PREFILTERED_IBL_PASS pbr=authored+procedural ibl=local-prefiltered-env fallback=raw-cube-on-load-failure tone=aces shadows=1024>512>off practicals=2>2>1 qa-capture=webgl adaptive=shared-budget');
