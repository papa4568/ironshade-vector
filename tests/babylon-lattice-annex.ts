import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  BABYLON_LATTICE_ANNEX_IDENTITY,
  BABYLON_LATTICE_ANNEX_LIGHTING,
  latticeAnnexCalibrationMode,
  latticeAnnexRenderProfile,
  latticeAnnexShutterState,
} from '../src/game/babylonLatticeAnnexPresentation';
import { getMapNavigationPlan } from '../src/game/mapNavigation';

const babylon = readFileSync('src/game/babylonCombatRenderer.ts', 'utf8');
const presentation = readFileSync('src/game/babylonLatticeAnnexPresentation.ts', 'utf8');
const encounters = readFileSync('src/game/encounters.ts', 'utf8');
const director = readFileSync('src/game/director.ts', 'utf8');
const smoke = readFileSync('scripts/browser-runtime-smoke.mjs', 'utf8');
const workflow = readFileSync('.github/workflows/browser-e2e.yml', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };

assert.deepEqual(BABYLON_LATTICE_ANNEX_IDENTITY, {
  silhouette: 'reference-pylons',
  material: 'survey-ceramic',
  lighting: 'metrology-teal',
  propSet: 'calibration-service',
});
assert.deepEqual(BABYLON_LATTICE_ANNEX_LIGHTING, {
  id: 'metrology-teal',
  keyColor: 0xd9e6e2,
  rimColor: 0x88b8ad,
  emergencyColor: 0x629d93,
  keyIntensity: 2.25,
  rimIntensity: 1.0,
  emergencyIntensity: 7.6,
  exposure: 1.05,
});

assert.equal(latticeAnnexCalibrationMode(0.03, 0.02), 'near-zero-g');
assert.equal(latticeAnnexCalibrationMode(0.11, 0.05), 'nominal');
assert.equal(latticeAnnexShutterState(2, 0), 'retracted');
assert.equal(latticeAnnexShutterState(2, 2), 'indexed');
assert.equal(latticeAnnexShutterState(2, 1), 'partial');
assert.equal(latticeAnnexShutterState(0, 0), 'destroyed');

const full = latticeAnnexRenderProfile(1, false);
const mobile = latticeAnnexRenderProfile(1, true);
const performance = latticeAnnexRenderProfile(0.5, false);
assert.equal(full.name, 'full');
assert.equal(full.referencePylonInstances, 9);
assert.equal(full.surveyFrameInstances, 6);
assert.equal(full.massBandInstances, 3);
assert.equal(mobile.name, 'mobile');
assert.equal(mobile.referencePylonInstances, 7);
assert.equal(mobile.surveyFrameInstances, 4);
assert.equal(performance.name, 'performance');
assert.equal(performance.referencePylonInstances, 5);
assert.equal(performance.massBandInstances, 1);

const navigation = getMapNavigationPlan('lattice-annex');
assert.equal(navigation.routes.length, 8);
assert.deepEqual(navigation.landmarks.map(item => item.label), ['METROLOGY RING', 'REFERENCE GALLERY', 'SAMPLE VAULT']);

assert.ok(encounters.includes("['lattice-reference-a', 1740, 250]"));
assert.ok(encounters.includes("['lattice-shutter-a', 1680, 300]"));
assert.ok(encounters.includes("boss.variant = 'latticeCustodian'"));
assert.ok(director.includes('KHEPRI CALIBRATION MASS SHIFT // REFERENCE GALLERY ENTERING NEAR-ZERO-G'));
assert.ok(director.includes('KHEPRI REFERENCE INDEX // CALIBRATION SHUTTERS REPOSITIONED // FIRING LANES CHANGED'));

for (const marker of [
  "environmentVisual = 'procedural-lattice-annex-babylon'",
  "environmentComposition = 'cold-metrology-ring+long-reference-gallery+sample-vault'",
  "environmentZoneIdentity = 'ring:survey-ceramic+metrology-plinths|gallery:reference-pylon-row+calibration-rails+mass-shift-bands|vault:sample-cradles+calibration-shutters+reference-network'",
  "environmentMaterials = 'survey-ceramic+brushed-metrology-steel+black-reference-glass+metrology-teal'",
  "environmentCalibrationTimeline = '10.0s:near-zero-g>20.0s:shutter-index'",
  "environmentHazardLanguage = 'shared-hazards+calibration-mass-shift+gravity-well+calibration-shutters+reference-network'",
  "locationArtIdentity = 'reference-pylons|survey-ceramic|metrology-teal|calibration-service'",
  "interactableBiome = 'lattice-annex'",
  "bossPresentation = veyra ? 'veyra-senn' : 'khepri-recovery-marshal'",
  "bossSilhouette = veyra ? 'survey-crown+reference-spines+archive-core' : 'survey-crown+archive-core'",
  "bossCue = 'survey-sweep+reference-lock+archive-purge'",
  "babylonLatticeAnnexParity = 'reference-pylon-architecture+survey-materials+props+interactables+hazards+calibration-mass-shift+shutters+reference-network+navigation+boss-cues+shared-world-cues'",
]) assert.ok(presentation.includes(marker), 'missing Lattice Annex parity marker: ' + marker);

assert.ok(presentation.includes("object.id.startsWith('lattice-reference')"));
assert.ok(presentation.includes("object.id.startsWith('lattice-shutter')"));
assert.ok(presentation.includes("['surveySweep', 'referenceLock', 'archivePurge'].includes(activeBoss.bossPattern)"));
assert.ok(babylon.includes("import { BabylonLatticeAnnexPresentation } from './babylonLatticeAnnexPresentation';"));
assert.ok(babylon.includes("const latticeAnnexScenario = mission.location === 'lattice-annex';"));
assert.ok(babylon.includes("this.latticeAnnexPresentation.sync(state, budget, mission.conditions.includes('low-visibility'));"));
assert.ok(babylon.includes("ported:asteroid-refinery,orbital-station,damaged-vessel,spin-habitat,jovian-harvester,ice-mine,solar-yard,lattice-annex"));
assert.ok(babylon.includes('this.worldPresentation.sync(state, mission, budget.detailScale);'));
assert.ok(smoke.includes('async function p27C7BabylonLatticeAnnexAudit()'));
assert.ok(smoke.includes('BROWSER_P27C7_BABYLON_LATTICE_ANNEX_PASS'));
assert.ok(smoke.includes("else if (targetLocation === 'lattice-annex') await p27C7BabylonLatticeAnnexAudit();"));
assert.ok(workflow.includes("blackLattice.step = 13"));
assert.ok(workflow.includes('BROWSER_E2E_GRAPHICS_PATH=babylon BROWSER_E2E_LOCATION=lattice-annex'));
assert.ok(workflow.includes('p27c7-lattice-annex.png'));
assert.ok(pkg.scripts['test:babylon-lattice-annex']);
assert.ok(pkg.scripts.build.includes('npm run test:babylon-lattice-annex'));

console.log('BABYLON_LATTICE_ANNEX_PASS identity=reference-pylons|survey-ceramic|metrology-teal|calibration-service routes=' + navigation.routes.length + ' landmarks=' + navigation.landmarks.map(item => item.label).join('|') + ' calibration=10s-near-zero-g>20s-shutter-index boss=veyra-senn');
