import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  BABYLON_CRYO_RESERVE_IDENTITY,
  BABYLON_CRYO_RESERVE_LIGHTING,
  cryoReservePurgeMode,
  cryoReserveRenderProfile,
  cryoReserveValveState,
} from '../src/game/babylonCryoReservePresentation';
import { getMapNavigationPlan } from '../src/game/mapNavigation';
import { auditCryoVisualProvenance } from '../tools/p28g8-cryo-provenance.mjs';

const babylon = readFileSync('src/game/babylonCombatRenderer.ts', 'utf8');
const world = readFileSync('src/game/babylonWorldPresentation.ts', 'utf8');
const readiness = readFileSync('src/game/babylonRefineryMissionReadiness.ts', 'utf8');
const presentation = readFileSync('src/game/babylonCryoReservePresentation.ts', 'utf8');
const encounters = readFileSync('src/game/encounters.ts', 'utf8');
const director = readFileSync('src/game/director.ts', 'utf8');
const interdiction = readFileSync('src/game/postKhepriInterdiction.ts', 'utf8');
const smoke = readFileSync('scripts/browser-runtime-smoke.mjs', 'utf8');
const workflow = readFileSync('.github/workflows/browser-e2e.yml', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };

assert.deepEqual(BABYLON_CRYO_RESERVE_IDENTITY, {
  silhouette: 'tank-gallery',
  material: 'vacuum-jacketed-cryogenic',
  lighting: 'cold-blue',
  propSet: 'purge-service',
});
assert.deepEqual(BABYLON_CRYO_RESERVE_LIGHTING, {
  id: 'cold-blue',
  keyColor: 0xd0e3ed,
  rimColor: 0x77c6de,
  emergencyColor: 0x76cde9,
  keyIntensity: 2.0,
  rimIntensity: 1.12,
  emergencyIntensity: 8.4,
  exposure: 1.07,
});

assert.equal(cryoReservePurgeMode(0), 'nominal');
assert.equal(cryoReservePurgeMode(1), 'boiloff-purge');
assert.equal(cryoReserveValveState(0, 2), 'armed');
assert.equal(cryoReserveValveState(1, 2), 'partial');
assert.equal(cryoReserveValveState(2, 2), 'routed');
assert.equal(cryoReserveValveState(0, 0), 'offline');

const full = cryoReserveRenderProfile(1, false);
const coarse = cryoReserveRenderProfile(1, true);
const performance = cryoReserveRenderProfile(0.5, false);
assert.equal(full.name, 'full');
assert.equal(full.tankInstances, 7);
assert.equal(full.galleryFrameInstances, 6);
assert.equal(full.pipeRunInstances, 4);
assert.equal(full.plumeInstances, 3);
assert.equal(coarse.name, 'full');
assert.equal(coarse.tankInstances, 7);
assert.equal(coarse.galleryFrameInstances, 6);
assert.equal(coarse.pipeRunInstances, 4);
assert.equal(coarse.plumeInstances, 3);
assert.equal(performance.name, 'performance');
assert.equal(performance.pipeRunInstances, 2);
assert.equal(performance.plumeInstances, 1);

const navigation = getMapNavigationPlan('cryo-reserve');
assert.equal(navigation.routes.length, 8);
assert.deepEqual(navigation.landmarks.map(item => item.label), ['SERVICE COLLAR', 'PROPELLANT GALLERY', 'UMBRA TANK FARM']);

assert.ok(encounters.includes("function configureCryoReserve(state: SimState)"));
assert.ok(encounters.includes("coverObject('cryo-tank-a', 'Vacuum-jacket tank A'"));
assert.ok(encounters.includes("coverObject('cryo-tank-b', 'Vacuum-jacket tank B'"));
assert.ok(encounters.includes("coverObject('cryo-tank-c', 'Vacuum-jacket tank C'"));
assert.ok(encounters.includes("addAt('purge-valve-a', 'LH2 purge valve'"));
assert.ok(encounters.includes("addAt('purge-valve-b', 'Methane purge valve'"));
assert.ok(encounters.includes("boss.variant = 'umbraMarshal'"));
assert.ok(encounters.includes("'siphon-node-a'") && encounters.includes("'siphon-node-b'"));
assert.ok(director.includes("state.sectors[0].label = 'SERVICE COLLAR'"));
assert.ok(director.includes("state.sectors[1].label = 'PROPELLANT GALLERY'"));
assert.ok(director.includes("state.sectors[2].label = 'UMBRA TANK FARM'"));
assert.ok(director.includes("deployHazard(state, 980, 520, 'boiloffJet', 6.5)"));
assert.ok(director.includes("deployHazard(state, 1370, 620, 'boiloffJet', 6)"));
assert.ok(director.includes('CRYOGENIC BOILOFF // SERVICE GALLERY PURGE PLUME LIVE'));
assert.ok(director.includes('RESERVE PRESSURE RISE // SECONDARY BOILOFF PURGE'));
assert.ok(interdiction.includes("location: 'cryo-reserve'"));
assert.ok(interdiction.includes("mode: 'thermal-routing'"));
assert.ok(interdiction.includes("deepTarget: 'Umbra Systems Marshal Oren Saal'"));

for (const marker of [
  "environmentVisual = 'procedural-cryo-reserve-babylon'",
  "environmentLandmark = 'staggered-vacuum-jacket-tank-gallery'",
  "environmentComposition = 'service-collar+propellant-gallery+umbra-tank-farm'",
  "environmentZoneIdentity = 'service-collar:valve-service+vacuum-jacket|gallery:staggered-tanks+boiloff-headers+purge-plumes|tank-farm:tank-saddles+umbra-manifold+siphon-bus'",
  "environmentMaterials = 'vacuum-jacketed-steel+frosted-insulation+cold-blue-purge+cold-cyan-service'",
  "environmentPurgeTimeline = '10.0s:first-boiloff>21.0s:secondary-purge'",
  "environmentHazardLanguage = 'shared-hazards+boiloff-jet+limited-atmosphere+damaged-grid+purge-routing'",
  "locationArtIdentity = 'tank-gallery|vacuum-jacketed-cryogenic|cold-blue|purge-service'",
  "interactableBiome = 'cryo-reserve'",
  "bossPresentation = umbraMarshal ? 'oren-saal' : 'reserve-command'",
  "bossSilhouette = 'purge-manifold+cold-siphon-spines+marshal-core'",
  "bossCue = 'purge-lance+bus-siphon+bus-reroute'",
  "babylonCryoReserveParity = 'tank-gallery-architecture+cryogenic-materials+props+interactables+hazards+boiloff-purges+purge-valves+siphon-relays+navigation+boss-cues+shared-world-cues'",
]) assert.ok(presentation.includes(marker), 'missing Cryo Reserve parity marker: ' + marker);

assert.ok(presentation.includes("object.id === 'purge-valve-a'"));
assert.ok(presentation.includes("object.id === 'purge-valve-b'"));
assert.ok(presentation.includes("hazard.active && hazard.kind === 'boiloffJet'"));
assert.ok(presentation.includes("['purgeLance', 'busSiphon', 'busReroute'].includes(activeBoss.bossPattern)"));
assert.ok(babylon.includes("import { BabylonCryoReservePresentation } from './babylonCryoReservePresentation';"));
assert.ok(babylon.includes("const cryoReserveScenario = mission.location === 'cryo-reserve';"));
assert.ok(babylon.includes("this.cryoReservePresentation.sync(state, budget, mission.conditions.includes('low-visibility'));"));
assert.ok(babylon.includes('momentum-exchange,cryo-reserve'));
assert.ok(babylon.includes('this.worldPresentation.sync(state, mission, budget.detailScale);'));
assert.ok(smoke.includes('async function p27C9BabylonCryoReserveAudit()'));
assert.ok(smoke.includes('BROWSER_P27C9_BABYLON_CRYO_RESERVE_PASS'));
assert.ok(smoke.includes("else if (targetLocation === 'cryo-reserve') await p27C9BabylonCryoReserveAudit();"));
assert.ok(workflow.includes("interdiction.step = 1"));
assert.ok(workflow.includes('BROWSER_E2E_GRAPHICS_PATH=babylon BROWSER_E2E_LOCATION=cryo-reserve'));
assert.ok(workflow.includes('p27c9-cryo-reserve.png'));
assert.ok(pkg.scripts['test:babylon-cryo-reserve']);
assert.ok(pkg.scripts.build.includes('npm run test:babylon-cryo-reserve'));


const validG8Proof = {
  task: 'P28-G8', mapReentry: 'exit-to-command-and-redeploy:ready',
  capturedRoute: 'cryo-reserve', backend: 'webgl2',
  tier: 'high', captureMode: 'high-tier-qa-visual-only',
  assetIds: 'refinery-cover-crate-lod0', beforeAssetIds: 'refinery-cover-crate-lod0',
  artState: 'ready', beforeArtState: 'ready',
  mappedObjects: 5, authoredObjects: 5, fallbackObjects: 0,
  premium: 'ready', beforePremium: 'ready', premiumBindings: 110,
  ibl: 'shared-prefiltered:ready', beforeIbl: 'shared-prefiltered:ready',
  routeStyle: 'cryo-recessed-service-inlay', routeMaxWidth: 0.16,
  objectiveCue: 'beacon+navigation-path', worldObjects: 5,
  actionInput: 'manual-aim+live-touch-fire', shotsBefore: 2, shotsAfter: 5,
  hazardLanguage: 'shared-hazards+boiloff-jet+limited-atmosphere+damaged-grid+purge-routing',
  surfaceDetail: 'vacuum-jacket-tank:7+jacket-hoop:35+thermal-sensor:14+gallery-valve-bank:12',
};
assert.ok(auditCryoVisualProvenance(validG8Proof).valid);
for (const [label, patch, reason] of [
  ['other-map', { capturedRoute: 'momentum-exchange' }, 'wrong-map-or-backend'],
  ['missing-asset', { assetIds: '' }, 'not-authored-lod0-flagship-visual'],
  ['unready-ibl', { ibl: 'shared-prefiltered:loading' }, 'missing-or-unready-premium-material'],
  ['unbound-pbr', { premiumBindings: 4 }, 'missing-or-unready-premium-material'],
  ['placeholder', { authoredObjects: 4, fallbackObjects: 1 }, 'procedural-box-or-unresolved-world-slot'],
  ['oversized-route', { routeMaxWidth: 1.2 }, 'oversized-route-material'],
  ['no-reentry', { mapReentry: '' }, 'missing-map-reentry-proof'],
  ['no-combat', { shotsAfter: 2 }, 'no-real-combat-action'],
  ['late-pbr', { beforePremium: 'loading' }, 'late-asset-pop-in'],
  ['wrong-hazard', { hazardLanguage: 'wash' }, 'missing-boiloff-thermal-hazard-cues'],
] as const) {
  const report = auditCryoVisualProvenance({ ...validG8Proof, ...patch });
  assert.ok(!report.valid && report.problems.includes(reason),
    'P28-G8 accepted unsafe screenshot provenance: ' + label);
}
const g8Workflow = readFileSync('.github/workflows/p28-g8-cryo-visual-qa.yml', 'utf8');
const g8Capture = readFileSync('tools/android-p28g8-cryo-capture.mjs', 'utf8');
const g8Shell = readFileSync('tools/android-p28g8-cryo-capture.sh', 'utf8');
assert.ok(g8Capture.includes("interdiction.step = 1"));
assert.ok(g8Capture.includes("interdiction.completed = ['interdiction-0-undecided']"));
assert.ok(g8Capture.includes("d?.babylonScenario === 'cryo-reserve'"));
assert.ok(g8Capture.includes("d.cryoPremiumAssetState === 'ready'"));
assert.ok(g8Capture.includes("d.babylonSharedWorldArtState === 'ready'"));
assert.ok(g8Capture.includes("d.missionVisualReadiness === 'ready'"));
assert.ok(g8Capture.includes("await awaitCryoReady('post-reentry Cryo Reserve authored-world readiness'"));
assert.ok(g8Capture.includes("actionInput: 'manual-aim+live-touch-fire', shotsBefore, shotsAfter"));
assert.ok(g8Workflow.includes('G8 Independent Copilot PNG Inspection'));
assert.ok(g8Workflow.includes('--attachment android-p28g8-cryo-reserve-normal.png'));
assert.ok(g8Workflow.includes('script: bash tools/android-p28g8-cryo-capture.sh'));
assert.ok(g8Shell.includes('adb install -r "$APK"'));
assert.ok(g8Shell.includes('tools/verify-p28g8-gameplay-frames.mjs'));
assert.ok(g8Shell.includes("report.capturedRoute !== \"cryo-reserve\""));

// P28-G8: actual shared KTX2 material binding, authored-world readiness
// and dedicated cryogenic detail regressions. Live frame proof remains required.
for (const marker of [
  "createBabylonPremiumPbrSurfaceLibrary(scene)",
  "this.premiumSurfaces.get('deck-plate')",
  "this.premiumSurfaces.get('painted-metal')",
  "this.premiumSurfaces.get('bare-metal')",
  "this.premiumSurfaces.get('polymer-rubber')",
  "this.premiumSurfaces.get('emissive-fixture')",
  "const shared = new Set(this.premiumSurfaces.materials.values())",
  "mesh.material instanceof PBRMaterial && shared.has(mesh.material)",
  "material.albedoTexture?.isReady() === true",
  "material.bumpTexture?.isReady() === true",
  "material.metallicTexture?.isReady() === true",
  "premiumReady && this.iblReady ? 'ready' : 'loading'",
  "new CubeTexture('/assets/environments/refinery-prefiltered.env'",
  "this.premiumSurfaces.dispose()",
  "this.iblTexture.dispose()",
  "babylonRouteMarkingWidth(route.kind)",
  "p28-g8-jacket-hoop-",
  "p28-g8-tank-thermal-sensor-",
  "p28-g8-gallery-valve-bank-",
  "p28-g8-header-flange-",
  "p28-g8-purge-handwheel-grip-",
  "p28-g8-valve-control-face-",
  "this.canvas.dataset.cryoPremiumBindings = String(this.premiumBindingCount)",
]) assert.ok(presentation.includes(marker), 'P28-G8 missing visual/readiness gate: ' + marker);
assert.ok(world.includes("|| mission.location === 'momentum-exchange' || mission.location === 'cryo-reserve';"));
assert.ok(readiness.includes("|| mission.location === 'momentum-exchange' || mission.location === 'cryo-reserve');"));
assert.ok(presentation.includes("this.canvas.dataset.babylonRouteMarkingMaxWidth = String(BABYLON_ROUTE_MARKING_WIDTHS.primary)"));
assert.ok(!presentation.includes("const width = route.kind === 'primary' ? 0.12 : 0.076;"));

console.log('BABYLON_CRYO_RESERVE_PASS identity=tank-gallery|vacuum-jacketed-cryogenic|cold-blue|purge-service routes=' + navigation.routes.length + ' landmarks=' + navigation.landmarks.map(item => item.label).join('|') + ' purge=10s>21s valves=2');
