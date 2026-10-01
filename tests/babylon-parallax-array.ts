import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  BABYLON_PARALLAX_ARRAY_IDENTITY,
  BABYLON_PARALLAX_ARRAY_LIGHTING,
  parallaxArrayRenderProfile,
  parallaxReferenceState,
  parallaxShearMode,
} from '../src/game/babylonParallaxArrayPresentation';
import { getMapNavigationPlan } from '../src/game/mapNavigation';

const three = readFileSync('src/game/threeCombatRenderer.ts', 'utf8');
const babylon = readFileSync('src/game/babylonCombatRenderer.ts', 'utf8');
const presentation = readFileSync('src/game/babylonParallaxArrayPresentation.ts', 'utf8');
const encounters = readFileSync('src/game/encounters.ts', 'utf8');
const director = readFileSync('src/game/director.ts', 'utf8');
const sim = readFileSync('src/game/sim.ts', 'utf8');
const parallax = readFileSync('src/game/parallaxDebt.ts', 'utf8');
const smoke = readFileSync('scripts/browser-runtime-smoke.mjs', 'utf8');
const workflow = readFileSync('.github/workflows/browser-e2e.yml', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };

assert.deepEqual(BABYLON_PARALLAX_ARRAY_IDENTITY, {
  silhouette: 'baseline-pylons',
  material: 'metrology-composite',
  lighting: 'reference-violet',
  propSet: 'inertial-reference',
});
assert.ok(three.includes("'parallax-array': { id: 'reference-violet', keyColor: 0xe2ddf1, rimColor: 0x9a87cf, emergencyColor: 0x7864ba, keyIntensity: 2.2, rimIntensity: 1.15, emergencyIntensity: 8.1, exposure: 1.06 }"));
assert.deepEqual(BABYLON_PARALLAX_ARRAY_LIGHTING, {
  id: 'reference-violet',
  keyColor: 0xe2ddf1,
  rimColor: 0x9a87cf,
  emergencyColor: 0x7864ba,
  keyIntensity: 2.2,
  rimIntensity: 1.15,
  emergencyIntensity: 8.1,
  exposure: 1.06,
});

assert.deepEqual(parallaxArrayRenderProfile(1, false), {
  name: 'full',
  frameInstances: 3,
  carriageInstances: 3,
  anchorInstances: 8,
  shearInstances: 3,
});
assert.equal(parallaxArrayRenderProfile(0.8, false).name, 'balanced');
assert.equal(parallaxArrayRenderProfile(0.5, false).name, 'performance');
assert.equal(parallaxArrayRenderProfile(1, true).name, 'mobile');
assert.equal(parallaxReferenceState(0, 3), 'armed');
assert.equal(parallaxReferenceState(1, 3), 'partial');
assert.equal(parallaxReferenceState(3, 3), 'aligned');
assert.equal(parallaxReferenceState(0, 0), 'offline');
assert.equal(parallaxShearMode(1, 0.1), 'reference-shear');
assert.equal(parallaxShearMode(0, 0.4), 'gravity-split');
assert.equal(parallaxShearMode(0, 0.2), 'nominal');

const navigation = getMapNavigationPlan('parallax-array');
assert.ok(navigation.routes.length >= 6);
assert.deepEqual(navigation.landmarks.map(item => item.label), ['NEAR BASELINE', 'CROSS-TRACK GALLERY', 'DEEP REFERENCE']);

for (const marker of [
  "patchObject(state, 'bulkhead-a', { label: 'Near-baseline mass carriage'",
  "patchObject(state, 'bulkhead-b', { label: 'Reference interferometer housing'",
  "patchObject(state, 'conduit-a', { label: 'Baseline timing bus'",
  "patchObject(state, 'arena-cover', { label: 'Deep-reference carriage'",
  "['parallax-frame-a', 760, 340]",
  "['parallax-frame-b', 1080, 690]",
  "['parallax-frame-c', 1370, 390]",
  "['reference-node-a', 'reference-node-b', 'reference-node-c']",
]) assert.ok(encounters.includes(marker), 'missing Parallax authored encounter cue: ' + marker);

assert.ok(director.includes("contract.location === 'parallax-array'"));
assert.ok(director.includes("runtime.elapsed >= 8"));
assert.ok(director.includes("deployHazard(state, 980, 420, 'vectorWash', 6)"));
assert.ok(director.includes("runtime.elapsed >= 19"));
assert.ok(director.includes("deployHazard(state, 1420, 620, 'vectorWash', 6)"));
assert.ok(sim.includes("object.id.startsWith('reference-node-')"));
assert.ok(sim.includes("'PHYSICAL BASELINE ALIGNED'"));
assert.ok(sim.includes("boss.variant === 'baselineKeeper'"));
assert.ok(sim.includes("['parallaxSweep', 'baselineFork', 'shearCollapse', 'baselineFork']"));
assert.ok(parallax.includes("title: 'Parallax Debt // Blind Meridian'"));
assert.ok(parallax.includes("deepTarget: 'Baseline Keeper Sera Nox'"));
assert.ok(parallax.includes("phaseFinale: true"));

for (const marker of [
  "environmentVisual = 'procedural-parallax-array-babylon'",
  "environmentLandmark = 'three-point-long-baseline'",
  "environmentComposition = 'three-point-baseline+cross-track-frames+perimeter-shear-anchors'",
  "environmentMaterials = 'graphite-structure+reference-shell+violet-alignment+cyan-readout'",
  "environmentZoneIdentity = 'near-baseline:reference-pylon+mass-carriage|cross-track:reference-frame+timing-bus|deep-reference:baseline-pylon+shear-anchor'",
  "readabilityLanguage = 'baseline-silhouette+violet-cyan+luminance'",
  "environmentReferenceNodeIds = 'reference-node-a,reference-node-b,reference-node-c'",
  "environmentShearTimeline = '8.0s:first-shear>19.0s:deep-reference-reversal'",
  "environmentHazardLanguage = 'shared-hazards+reference-shear+gravity-split+physical-baseline-alignment'",
  "locationArtIdentity = 'baseline-pylons|metrology-composite|reference-violet|inertial-reference'",
  "interactableBiome = 'parallax-array'",
  "bossPresentation = baselineKeeper ? 'sera-nox' : 'array-command'",
  "bossSilhouette = 'triple-reference-crown+baseline-forks+shear-core'",
  "bossCue = 'baseline-fork+parallax-sweep+shear-collapse'",
  "babylonParallaxArrayParity = 'baseline-pylon-architecture+metrology-reference+props+interactables+hazards+reference-shear+physical-alignment+navigation+boss-cues+shared-world-cues'",
]) assert.ok(presentation.includes(marker), 'missing Parallax Babylon parity marker: ' + marker);

assert.ok(presentation.includes("object.id.startsWith('reference-node-')"));
assert.ok(presentation.includes("hazard.active && hazard.kind === 'vectorWash'"));
assert.ok(presentation.includes("['baselineFork', 'parallaxSweep', 'shearCollapse'].includes(activeBoss.bossPattern)"));
assert.ok(babylon.includes("import { BabylonParallaxArrayPresentation } from './babylonParallaxArrayPresentation';"));
assert.ok(babylon.includes("const parallaxArrayScenario = mission.location === 'parallax-array';"));
assert.ok(babylon.includes("this.parallaxArrayPresentation.sync(state, budget, mission.conditions.includes('low-visibility'));"));
assert.ok(babylon.includes('momentum-exchange,cryo-reserve,parallax-array'));
assert.ok(babylon.includes('this.worldPresentation.sync(state, mission, quality);'));
assert.ok(smoke.includes('async function p27C10BabylonParallaxArrayAudit()'));
assert.ok(smoke.includes('BROWSER_P27C10_BABYLON_PARALLAX_ARRAY_PASS'));
assert.ok(smoke.includes("else if (targetLocation === 'parallax-array') await p27C10BabylonParallaxArrayAudit();"));
assert.ok(workflow.includes("parallaxDebt.step = 2"));
assert.ok(workflow.includes("state.profile.level = Math.max(15, state.profile.level || 1)"));
assert.ok(workflow.includes('BROWSER_E2E_GRAPHICS_PATH=babylon BROWSER_E2E_LOCATION=parallax-array'));
assert.ok(workflow.includes('p27c10-parallax-array.png'));
assert.ok(pkg.scripts['test:babylon-parallax-array']);
assert.ok(pkg.scripts.build.includes('npm run test:babylon-parallax-array'));

console.log('BABYLON_PARALLAX_ARRAY_PASS identity=baseline-pylons|metrology-composite|reference-violet|inertial-reference routes='
  + navigation.routes.length + ' landmarks=' + navigation.landmarks.map(item => item.label).join('|') + ' shear=8s>19s references=3');
