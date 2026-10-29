import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  BABYLON_MOMENTUM_EXCHANGE_IDENTITY,
  BABYLON_MOMENTUM_EXCHANGE_LIGHTING,
  BABYLON_MOMENTUM_EXCHANGE_PREMIUM_SURFACES,
  BABYLON_MOMENTUM_WASH_FOOTPRINT,
  momentumExchangeCaptureState,
  momentumExchangeRenderProfile,
  momentumExchangeWashMode,
} from '../src/game/babylonMomentumExchangePresentation';
import { getMapNavigationPlan } from '../src/game/mapNavigation';
import { BABYLON_ROUTE_MARKING_WIDTHS } from '../src/game/babylonRouteMarkings';
import { auditMomentumVisualProvenance } from '../tools/p28g7-momentum-provenance.mjs';

const babylon = readFileSync('src/game/babylonCombatRenderer.ts', 'utf8');
const presentation = readFileSync('src/game/babylonMomentumExchangePresentation.ts', 'utf8');
const encounters = readFileSync('src/game/encounters.ts', 'utf8');
const director = readFileSync('src/game/director.ts', 'utf8');
const campaign = readFileSync('src/game/campaign.ts', 'utf8');
const smoke = readFileSync('scripts/browser-runtime-smoke.mjs', 'utf8');
const workflow = readFileSync('.github/workflows/browser-e2e.yml', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };

assert.deepEqual(BABYLON_MOMENTUM_EXCHANGE_IDENTITY, {
  silhouette: 'flywheel-lane',
  material: 'magnetic-machinery',
  lighting: 'transfer-blue',
  propSet: 'capture-service',
});
assert.deepEqual(BABYLON_MOMENTUM_EXCHANGE_LIGHTING, {
  id: 'transfer-blue',
  keyColor: 0xd4e5ed,
  rimColor: 0x67b5d5,
  emergencyColor: 0x4d90ac,
  keyIntensity: 2.3,
  rimIntensity: 1.16,
  emergencyIntensity: 8.2,
  exposure: 1.06,
});

assert.equal(momentumExchangeWashMode(0), 'nominal');
assert.equal(momentumExchangeWashMode(1), 'countermass-wash');
assert.equal(momentumExchangeCaptureState(0, 2), 'armed');
assert.equal(momentumExchangeCaptureState(1, 2), 'partial');
assert.equal(momentumExchangeCaptureState(2, 2), 'loaded');
assert.equal(momentumExchangeCaptureState(0, 0), 'offline');

const full = momentumExchangeRenderProfile(1, false);
const coarse = momentumExchangeRenderProfile(1, true);
const performance = momentumExchangeRenderProfile(0.5, false);
assert.equal(full.name, 'full');
assert.equal(full.flywheelInstances, 3);
assert.equal(full.serviceFrameInstances, 6);
assert.equal(full.transferRailInstances, 4);
assert.equal(full.impulseBandInstances, 3);
assert.equal(coarse.name, 'full');
assert.equal(coarse.flywheelInstances, 3);
assert.equal(coarse.serviceFrameInstances, 6);
assert.equal(coarse.transferRailInstances, 4);
assert.equal(coarse.captureCradleInstances, 3);
assert.equal(coarse.impulseBandInstances, 3);
assert.equal(performance.name, 'performance');
assert.equal(performance.transferRailInstances, 2);
assert.equal(performance.impulseBandInstances, 1);

const navigation = getMapNavigationPlan('momentum-exchange');
assert.equal(navigation.routes.length, 8);
assert.deepEqual(navigation.landmarks.map(item => item.label), ['BRAKE DECK', 'TRANSFER TUNNEL', 'COUNTERMASS CRADLE']);

assert.ok(encounters.includes("addObject(state, coverObject('momentum-rail-a', 'Electromagnetic transfer rail A'"));
assert.ok(encounters.includes("addObject(state, coverObject('momentum-baffle', 'Countermass service baffle'"));
assert.ok(encounters.includes("addAt('capture-drum-a', 'Inbound capture drum'"));
assert.ok(encounters.includes("addAt('capture-drum-b', 'Outbound capture drum'"));
assert.ok(director.includes("state.sectors[1].gravity = 0.05"));
assert.ok(director.includes("deployHazard(state, 1050, 520, 'vectorWash', 6)"));
assert.ok(director.includes('COUNTERMASS WASH // TRANSFER LANE IMPULSE FRONT LIVE'));
assert.ok(director.includes('TRANSFER REVERSAL // SECOND COUNTERMASS WASH CROSSING LANE'));
assert.ok(campaign.includes('The cislunar exchange uses long electromagnetic transfer lanes and counter-rotating flywheels'));

for (const marker of [
  "environmentVisual = 'procedural-momentum-exchange-babylon'",
  "environmentComposition = 'brake-deck+near-zero-g-transfer-tunnel+countermass-cradle'",
  "environmentZoneIdentity = 'brake:flywheel-housings+capture-collar|tunnel:electromagnetic-rails+near-zero-g+countermass-wash|cradle:counterweight-cradle+reference-bus'",
  "environmentMaterials = 'magnetic-machinery+brushed-ferrous+transfer-blue+capture-cyan'",
  "environmentCountermassTimeline = '9.0s:first-wash>20.0s:transfer-reversal'",
  "environmentHazardLanguage = 'shared-hazards+countermass-wash+vector-wash+near-zero-g+magnetic-transfer'",
  "locationArtIdentity = 'flywheel-lane|magnetic-machinery|transfer-blue|capture-service'",
  "interactableBiome = 'momentum-exchange'",
  "bossPresentation = adjudicator ? 'iona-vale' : 'neris-vane'",
  "bossSilhouette = 'brake-crown+counterweights+transfer-core'",
  "bossCue = 'brake-wave+partition-sweep+recoil-vector'",
  "babylonMomentumExchangeParity = 'flywheel-transfer-architecture+magnetic-machinery+props+interactables+hazards+countermass-washes+capture-drums+navigation+boss-cues+shared-world-cues'",
]) assert.ok(presentation.includes(marker), 'missing Momentum Exchange parity marker: ' + marker);

assert.ok(presentation.includes("object.id === 'capture-drum-a'"));
assert.ok(presentation.includes("object.id === 'capture-drum-b'"));
assert.ok(presentation.includes("hazard.active && hazard.kind === 'vectorWash'"));
assert.ok(presentation.includes("['brakeWave', 'partitionSweep', 'recoilVector'].includes(activeBoss.bossPattern)"));
assert.ok(babylon.includes("import { BabylonMomentumExchangePresentation } from './babylonMomentumExchangePresentation';"));
assert.ok(babylon.includes("const momentumExchangeScenario = mission.location === 'momentum-exchange';"));
assert.ok(babylon.includes("this.momentumExchangePresentation.sync(state, budget, mission.conditions.includes('low-visibility'));"));
assert.ok(babylon.includes("ported:asteroid-refinery,orbital-station,damaged-vessel,spin-habitat,jovian-harvester,ice-mine,solar-yard,lattice-annex,momentum-exchange"));
assert.ok(babylon.includes('this.worldPresentation.sync(state, mission, budget.detailScale);'));
assert.ok(smoke.includes('async function p27C8BabylonMomentumExchangeAudit()'));
assert.ok(smoke.includes('BROWSER_P27C8_BABYLON_MOMENTUM_EXCHANGE_PASS'));
assert.ok(smoke.includes("else if (targetLocation === 'momentum-exchange') await p27C8BabylonMomentumExchangeAudit();"));
assert.ok(workflow.includes("interdiction.status = 'active'"));
assert.ok(workflow.includes('BROWSER_E2E_GRAPHICS_PATH=babylon BROWSER_E2E_LOCATION=momentum-exchange'));
assert.ok(workflow.includes('p27c8-momentum-exchange.png'));
assert.ok(pkg.scripts['test:babylon-momentum-exchange']);
assert.ok(pkg.scripts.build.includes('npm run test:babylon-momentum-exchange'));

// P28-G7 is only a visual rollout. Its live authored assets, exact Android
// pixels, and independent Copilot image inspection must disprove flat/late art.
assert.equal(BABYLON_MOMENTUM_WASH_FOOTPRINT.widthFraction, 0.014);
assert.ok(BABYLON_MOMENTUM_WASH_FOOTPRINT.lengthFraction <= 0.085);
assert.deepEqual(BABYLON_MOMENTUM_EXCHANGE_PREMIUM_SURFACES,
  ['deck-plate', 'painted-metal', 'bare-metal', 'polymer-rubber', 'emissive-fixture']);
for (const premiumDetail of [
  "createBabylonPremiumPbrSurfaceLibrary(scene)",
  "this.premiumSurfaces.get('deck-plate')",
  "this.premiumSurfaces.get('bare-metal')",
  "this.premiumSurfaces.get('painted-metal')",
  "this.premiumSurfaces.get('polymer-rubber')",
  "this.premiumSurfaces.get('emissive-fixture')",
  "p28-g7-flywheel-lamination-",
  "p28-g7-flywheel-flux-tooth-",
  "p28-g7-bearing-race-",
  "p28-g7-transfer-frame-insulator-",
  "p28-g7-transfer-rail-carrier-",
  "p28-g7-cradle-polymer-shoe-",
  "p28-g7-drum-retainer-",
  "p28-g7-flywheel-plinth-contact-",
  "p28-g7-cradle-contact-",
  "p28-g7-momentum-enemy-contact-",
  "this.enemyGrounding.delete(id)",
  "this.premiumSurfaces.dispose()",
  "this.iblTexture.dispose()",
  "this.groundingTexture.dispose()",
  "this.canvas.dataset.momentumPremiumBindings = String(this.premiumBindingCount)",
  "this.canvas.dataset.babylonEnvironmentState = premiumReady && this.iblReady",
  "this.canvas.dataset.environmentIbl = this.iblReady",
  "this.canvas.dataset.babylonRouteMarkingProfile = 'momentum-recessed-transfer-inlay'",
  "this.canvas.dataset.environmentSurfaceDetail = 'flywheel-rig:'",
  "flux-tooth:48+bearing-race:6",
  "this.performanceDecoration.forEach(mesh => mesh.setEnabled(detailedMachinery))",
  "this.canvas.dataset.momentumDetailTier = detailedMachinery ? 'full-hardware' : 'compact-hardware'",
  "worldW * BABYLON_MOMENTUM_WASH_FOOTPRINT.widthFraction",
]) assert.ok(presentation.includes(premiumDetail), 'P28-G7 missing real mechanical layer or material gate: ' + premiumDetail);
assert.ok(presentation.includes("new CubeTexture('/assets/environments/refinery-prefiltered.env'"));
assert.ok(presentation.includes('babylonRouteMarkingWidth(route.kind)'));
assert.ok(BABYLON_ROUTE_MARKING_WIDTHS.primary <= 0.20);
const g7Hud = readFileSync('src/combatHudGlance.css', 'utf8');
assert.ok(g7Hud.includes('.game-root[data-location="momentum-exchange"] .boss-hud.boss-hud--top'));
assert.ok(g7Hud.includes('.game-root[data-location="momentum-exchange"] .transient-alert-lane.event .combat-alert b'));
assert.ok(babylon.includes("const momentumActorLift = this.canvas.dataset.babylonScenario === 'momentum-exchange'"));
assert.ok(babylon.includes("const momentumContrast = this.canvas.dataset.babylonScenario === 'momentum-exchange'"));
assert.ok(readFileSync('src/game/babylonWorldPresentation.ts', 'utf8')
  .includes("|| mission.location === 'momentum-exchange';"));

const validG7Proof = {
  capturedRoute: 'momentum-exchange', backend: 'webgl2', tier: 'high',
  captureMode: 'high-tier-qa-visual-only',
  mapReentry: 'exit-to-command-and-redeploy:ready',
  assetIds: 'refinery-crate-lod0,refinery-pipe-rack-lod0',
  beforeAssetIds: 'refinery-crate-lod0,refinery-pipe-rack-lod0',
  mappedObjects: 8, authoredObjects: 8, fallbackObjects: 0,
  artState: 'ready', beforeArtState: 'ready',
  premium: 'ready', beforePremium: 'ready',
  premiumBindings: 130, ibl: 'shared-prefiltered:ready', beforeIbl: 'shared-prefiltered:ready',
  routeStyle: 'momentum-recessed-transfer-inlay', routeMaxWidth: 0.16, washFootprint: 0.014,
  objectiveCue: 'beacon+navigation-path', worldObjects: 8, groundProps: 6,
  actionInput: 'manual-aim+live-touch-fire', shotsBefore: 0, shotsAfter: 1,
  surfaceDetail: 'laminated-rim:9+flux-tooth:48+bearing-race:6+rail-carrier:8',
  hazardLanguage: 'shared-hazards+countermass-wash+vector-wash+near-zero-g+magnetic-transfer',
};
assert.ok(auditMomentumVisualProvenance(validG7Proof).valid);
for (const [label, edit, reason] of [
  ['wrong-route', { capturedRoute: 'lattice-annex' }, 'wrong-map-or-backend'],
  ['no-reentry', { mapReentry: '' }, 'missing-map-reentry-proof'],
  ['unmapped', { fallbackObjects: 1 }, 'procedural-box-or-unresolved-world-slot'],
  ['untextured', { premiumBindings: 3 }, 'missing-or-unready-premium-material'],
  ['wide-ribbon', { routeMaxWidth: 0.48 }, 'oversized-route-material'],
  ['wash-slab', { washFootprint: 0.16 }, 'oversized-countermass-wash'],
  ['missing-rims', { surfaceDetail: 'flux-tooth:48' }, 'missing-transfer-depth-or-grounding'],
  ['missing-teeth', { surfaceDetail: 'laminated-rim:6' }, 'missing-transfer-depth-or-grounding'],
  ['no-contact', { groundProps: 0 }, 'missing-transfer-depth-or-grounding'],
  ['hazard-hidden', { hazardLanguage: 'none' }, 'missing-transfer-hazard-cues'],
  ['late-art', { beforeArtState: 'loading' }, 'late-asset-pop-in'],
  ['fake-action', { shotsAfter: 0 }, 'no-real-combat-action'],
] as const) {
  const result = auditMomentumVisualProvenance({ ...validG7Proof, ...edit });
  assert.ok(!result.valid && result.problems.includes(reason), 'P28-G7 accepted invalid ' + label);
}

const renderWorldSource = readFileSync('src/game/babylonWorldPresentation.ts', 'utf8');
const attackSource = readFileSync('src/game/babylonEnemyTelegraphs.ts', 'utf8');
assert.ok(presentation.includes('spoke.rotation.y = spokeRotation'));
assert.ok(presentation.includes('ring.position.y = 0.26 + ringIndex * 0.13'));
assert.ok(presentation.includes('toothMesh.rotation.y = angle'));
assert.ok(presentation.includes('this.canvas.dataset.momentumSimTime = state.time.toFixed(2)'));
assert.ok(presentation.includes('laminated-rim:9+flux-tooth:48'));
assert.ok(renderWorldSource.includes("this.canvas.dataset.babylonScenario === 'momentum-exchange'"));
assert.ok(renderWorldSource.includes("hazard.kind === 'vectorWash'"));
assert.ok(renderWorldSource.includes('momentumWash ? 0xf0a876 : presentation.color'));
assert.ok(attackSource.includes('visual.sideA.material = momentumWarning ? visual.laneMaterial : visual.attackMaterial'));
assert.ok(attackSource.includes('tick.setEnabled(annexWarning || momentumWarning)'));
assert.ok(g7Hud.includes('.game-root[data-location="momentum-exchange"] .target-readout'));
assert.ok(babylon.includes("const momentumCombatPan = this.canvas.dataset.babylonScenario === 'momentum-exchange'"));
assert.ok(smoke.includes("viewportMode === 'mobile-landscape' ? 42_000 : 16_000"));
assert.ok(smoke.includes("momentum-wash-diagnostic="));

const g7Capture = readFileSync('tools/android-p28g7-momentum-capture.mjs', 'utf8');
const g7Shell = readFileSync('tools/android-p28g7-momentum-capture.sh', 'utf8');
const g7Workflow = readFileSync('.github/workflows/p28-g7-momentum-visual-qa.yml', 'utf8');
assert.ok(g7Capture.includes("interdiction.step = 0"));
assert.ok(g7Capture.includes("!campaign?.story?.interdiction || !campaign?.story?.postKhepri"));
assert.ok(g7Capture.includes("url.searchParams.set('p27d5Lifecycle', '1')"));
assert.ok(g7Capture.includes("d?.babylonScenario === 'momentum-exchange'"));
assert.ok(g7Capture.includes("d.momentumPremiumAssetState === 'ready'"));
assert.ok(g7Capture.includes("Number(d.momentumWashFootprint) <= 0.025"));
assert.ok(g7Capture.includes("d.missionVisualReadiness === 'ready'"));
assert.ok(g7Capture.includes("await waitFor(ready, 'post-reentry Momentum Exchange authored-world readiness'"));
assert.ok(g7Capture.includes("const shotsBefore = await evaluate"));
assert.ok(g7Capture.includes("const touch = async (type, id, x, y)"));
assert.ok(g7Capture.includes("actionInput: 'manual-aim+live-touch-fire', shotsBefore, shotsAfter"));
assert.ok(g7Shell.includes("node tools/verify-p28g7-gameplay-frames.mjs"));
assert.ok(g7Shell.includes('for attempt in 1 2 3; do'));
assert.ok(g7Shell.includes('P28-G7 non-cutout failure is not retryable'));
assert.ok(g7Workflow.includes('G7 Independent Copilot PNG Inspection'));
assert.ok(g7Workflow.includes('script: bash tools/android-p28g7-momentum-capture.sh'));
assert.ok(!g7Workflow.includes('scripts/android-fast-smoke.sh'));
assert.ok(smoke.includes('P27-B2 fully reauthored refinery after actual WebGPU device loss'));
assert.ok(g7Workflow.includes('imagesActuallyViewed !== true'));
assert.ok(g7Workflow.includes('--attachment android-p28g7-momentum-exchange-normal.png'));
assert.ok(g7Workflow.includes('gh api "/repos/$GITHUB_REPOSITORY/actions/artifacts/$ARTIFACT_ID/zip"'));

console.log('BABYLON_MOMENTUM_EXCHANGE_PASS identity=flywheel-lane|magnetic-machinery|transfer-blue|capture-service routes=' + navigation.routes.length + ' landmarks=' + navigation.landmarks.map(item => item.label).join('|') + ' washes=9s>20s capture=2');
