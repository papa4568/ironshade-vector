import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  REFINERY_ACTOR_GROUNDING_PROFILE,
  refineryActorGroundingScale,
  resolveBabylonRefineryLightingBudget,
  resolveRefineryShadowAnchor,
} from '../src/game/babylonRefineryLighting';
import { REFINERY_BABYLON_LIGHTING_PROFILE } from '../src/game/refineryLightingProfile';
import { AdaptiveRenderBudget } from '../src/game/renderQuality';

const highSnapshot = new AdaptiveRenderBudget(false).sample(1000 / 60, 1, 'flagship');
const balancedSnapshot = new AdaptiveRenderBudget(false).sample(1000 / 60, 0.72, 'adaptive');
const performanceSnapshot = new AdaptiveRenderBudget(false).sample(1000 / 60, 0.5, 'performance');

const high = resolveBabylonRefineryLightingBudget(highSnapshot);
const balanced = resolveBabylonRefineryLightingBudget(balancedSnapshot);
const performance = resolveBabylonRefineryLightingBudget(performanceSnapshot);

assert.deepEqual(
  { tier: high.tierName, shadow: high.shadowMapSize, practical: high.practicalLightCount, lights: high.maxSimultaneousLights },
  { tier: 'high', shadow: 2048, practical: 2, lights: 6 },
  'P28-A4 Flagship lighting must raise the refinery key shadow map above the old 1024 ceiling.',
);
assert.deepEqual(
  { tier: balanced.tierName, shadow: balanced.shadowMapSize, practical: balanced.practicalLightCount, lights: balanced.maxSimultaneousLights },
  { tier: 'balanced', shadow: 1024, practical: 2, lights: 5 },
  'P28-A4 Balanced lighting must retain a full-resolution recovery tier without dropping authored practical identity.',
);
assert.deepEqual(
  { tier: performance.tierName, shadow: performance.shadowMapSize, practical: performance.practicalLightCount, lights: performance.maxSimultaneousLights },
  { tier: 'performance', shadow: 0, practical: 1, lights: 3 },
  'Performance Babylon lighting budget must still shed shadows and the secondary practical before critical readability.',
);
assert.equal(high.iblEnabled, true);
assert.equal(balanced.iblEnabled, true);
assert.equal(performance.iblEnabled, false);
assert(high.iblIntensity > balanced.iblIntensity && balanced.iblIntensity > performance.iblIntensity);

assert.equal(REFINERY_BABYLON_LIGHTING_PROFILE.shadow.qualityId, 'p28-a4-flagship-soft-stable-v1');
assert(REFINERY_BABYLON_LIGHTING_PROFILE.shadow.bias < 0.0008, 'P28-A4 must reduce the old coarse depth bias that exaggerated peter-panning.');
assert(REFINERY_BABYLON_LIGHTING_PROFILE.shadow.normalBias < 0.018, 'P28-A4 must tighten normal bias while retaining acne protection.');
assert(REFINERY_BABYLON_LIGHTING_PROFILE.shadow.anchorSnap > 0, 'P28-A4 must quantize the player-relative shadow volume for stable camera motion.');
assert(REFINERY_BABYLON_LIGHTING_PROFILE.shadow.casterPadding > 0, 'P28-A4 must admit nearby off-footprint casters before they enter the visible shadow region.');
const anchorA = resolveRefineryShadowAnchor(10.1, 7.1);
const anchorB = resolveRefineryShadowAnchor(10.4, 7.4);
const anchorC = resolveRefineryShadowAnchor(11.4, 8.4);
assert.deepEqual(anchorA, anchorB, 'Sub-snap player motion must not continuously move the directional shadow volume.');
assert.notDeepEqual(anchorA, anchorC, 'The directional shadow volume must advance once the player crosses a snap cell.');

assert.equal(REFINERY_ACTOR_GROUNDING_PROFILE.alphaTextureSize, 64, 'P28-A2 actor grounding must use a higher-resolution feathered alpha than the legacy static contact cards.');
assert(REFINERY_ACTOR_GROUNDING_PROFILE.nearbyRadius >= 650, 'P28-A2 must cover the camera-relevant nearby-enemy envelope.');
assert(REFINERY_ACTOR_GROUNDING_PROFILE.coreOpacity > REFINERY_ACTOR_GROUNDING_PROFILE.penumbraOpacity, 'P28-A2 contact core must stay tighter than the projected penumbra.');
assert(REFINERY_ACTOR_GROUNDING_PROFILE.penumbraOffset > 0, 'P28-A2 projected penumbra must visibly follow key-light direction instead of reading as a centered blob.');
assert(REFINERY_ACTOR_GROUNDING_PROFILE.protectedCueGroups.includes('telegraphs') && REFINERY_ACTOR_GROUNDING_PROFILE.protectedCueGroups.includes('objectives'), 'P28-A2 must explicitly preserve dominant gameplay cues.');
assert(refineryActorGroundingScale('boss') > refineryActorGroundingScale('elite'));
assert(refineryActorGroundingScale('elite') > refineryActorGroundingScale('assault'));
assert(refineryActorGroundingScale('technician') < refineryActorGroundingScale('assault'));

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
assert.match(lightingSource, /RawTexture\.CreateRGBATexture/, 'P28-A2 must use a Babylon-native soft-alpha projected grounding texture.');
assert.match(lightingSource, /actorGroundingCoreSource\.createInstance/, 'P28-A2 nearby enemies must reuse the player contact-core geometry through GPU instances.');
assert.match(lightingSource, /actorGroundingPenumbraSource\.createInstance/, 'P28-A2 nearby enemies must reuse the projected-penumbra geometry through GPU instances.');
assert.match(lightingSource, /REFINERY_BABYLON_LIGHTING_PROFILE\.key\.position/, 'P28-A2 projected actor shadows must derive direction from the authored refinery key light.');
assert.match(lightingSource, /dx \* dx \+ dy \* dy > radiusSq/, 'P28-A2 must restrict dynamic actor projections to nearby active enemies.');
assert.match(lightingSource, /alphaIndex = -300/, 'P28-A2 grounding must render beneath normal transparent gameplay cues.');
assert.match(lightingSource, /actorGroundingCuePriority/, 'P28-A2 must publish cue-priority telemetry for Deep Salvage QA.');
assert.match(lightingSource, /grounding\)\/i/, 'P28-A2 projected cards must be excluded from the global key-shadow caster/receiver pass.');
assert.match(lightingSource, /TONEMAPPING_ACES/, 'B11 must preserve ACES tone mapping parity.');
assert.match(lightingSource, /new ShadowGenerator\(budget\.shadowMapSize, this\.keyLight\)/, 'P28-A4 must keep the key-light map bounded by the refinery-specific adaptive tier.');
assert.match(lightingSource, /filteringQuality = ShadowGenerator\.QUALITY_HIGH/, 'P28-A4 must replace the legacy low-quality PCF path with high-quality PCF.');
assert.match(lightingSource, /syncShadowProjection\(px, pz\)/, 'P28-A4 must keep the key shadow projection centered around the player.');
assert.match(lightingSource, /Math\.round\(worldX \/ snap\) \* snap/, 'P28-A4 must quantize shadow-volume motion instead of swimming every frame.');
assert.match(lightingSource, /getAbsolutePosition\(\)/, 'P28-A4 caster admission must use actual scene-space positions.');
assert.match(lightingSource, /casterPadding/, 'P28-A4 caster coverage must include a padded spatial footprint.');
assert.doesNotMatch(lightingSource, /shadowCasterLimit/, 'P28-A4 must remove the old arbitrary 128\/72 shadow-caster ceilings.');
assert.match(lightingSource, /environmentShadowAnchor/, 'P28-A4 must expose the snapped key-shadow anchor for browser and phone QA.');
assert.match(lightingSource, /pcf-high:bias-/, 'P28-A4 must expose filter and bias tuning in deterministic runtime telemetry.');
assert.match(lightingSource, /refineryIblQa === 'off'/, 'B11 must preserve deterministic IBL stack-off QA capture control.');
assert.match(worldSource, /new PBRMaterial\('p27-b5-object-material-'/, 'Babylon refinery world fallback materials must use Babylon PBR.');
assert.match(worldSource, /visual\.material\.metallic =/, 'Babylon world material response must preserve authored metalness.');
assert.match(worldSource, /visual\.material\.roughness =/, 'Babylon world material response must preserve authored roughness.');
assert.match(iblSource, /REFINERY_IBL_PROFILE/, 'Babylon refinery IBL must use the engine-neutral authored environment profile.');
assert.match(browserSource, /BROWSER_P27B11_BABYLON_PBR_LIGHTING_PASS/, 'Browser QA must capture the real WebGL Babylon B11 stack that now contains the A4 key shadows.');
assert.match(browserSource, /p27b11-ibl-off/, 'Browser QA must retain the refinery IBL-off comparison capture.');
assert.match(browserSource, /p27b11-ibl-on/, 'Browser QA must retain the refinery IBL-on comparison capture.');
assert.match(packageSource, /test:babylon-refinery-lighting/, 'Production build must execute the refinery lighting regression.');

console.log('P28_A4_KEY_SHADOW_QUALITY_PASS maps=2048>1024>off filter=pcf-high bias=tuned casters=spatial-footprint anchor=snapped p28a1-a3=preserved');
