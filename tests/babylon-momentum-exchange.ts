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
assert.ok(presentation.includes("0x10171b, 0.06, 0.98")
  && presentation.includes("route.kind === 'primary' ? 0.055 : 0.038"),
  'Momentum floor guides must be narrow dark non-mirror guides at Android zoom');
assert.ok(presentation.includes("this.laminationAlbedo = new DynamicTexture('p28-g9-machined-flywheel-albedo'")
  && presentation.includes("this.laminationNormal = new DynamicTexture('p28-g9-machined-flywheel-normal'")
  && presentation.includes('edgeMetal.bumpTexture = this.laminationNormal;')
  && presentation.includes('this.laminationNormal.dispose();'),
  'exposed rotor laminations must have actual turned-metal relief with disposed GPU textures');

assert.ok(presentation.includes("navigation.routes.filter(route => route.kind === 'primary').forEach")
  && presentation.includes('this.readabilityLight.range = 14.2;')
  && presentation.includes('this.hemisphere.intensity = 0.43')
  && presentation.includes('p28-g9-capture-drum-copper-retainer-ring-')
  && presentation.includes('tooth % 3 === 0 ? magneticCopper : structural'),
  'G7 real Android must preserve route topology but avoid cyan guide clutter and expose readable magnetic hardware');

assert.ok(presentation.includes('p28-g9-rail-rolling-shoe-')
  && presentation.includes('p28-g9-rail-magnetic-roller-')
  && presentation.includes('roller.parent = rail;')
  && babylon.includes('const momentumWideFraming = this.canvas.dataset.babylonScenario')
  && babylon.includes('momentumWideFraming ? (this.coarse ? 17.0 : 15.2)'),
  'Momentum must show physical copper-bearing carriers and preserve near-side actors in the camera');

const g7Hud = readFileSync('src/combatHudGlance.css', 'utf8');
assert.ok(g7Hud.includes('left: 28%;') && g7Hud.includes('width: min(12vw, 11rem);'),
  'narrow Momentum tactical roof must not collide with centered target HP panel');
assert.ok(presentation.includes("worldW * x, -0.02, worldH * z, length, 0.06, 0.16")
  && presentation.includes("carrier.position.set(0, 0.04, side * 0.15);")
  && babylon.includes("momentum-exchange' && !narrow ? 8.4 : 0;"),
  'G7 transfer track must be deck-recessed and full flywheel framed outside touch controls');
assert.ok(presentation.includes('Math.sin(angle) * 2.42, 0.46, Math.cos(angle) * 2.42')
  && presentation.includes('toothMesh.parent = rotor;')
  && babylon.includes("momentumContrast ? 0.77 : 0.06)")
  && babylon.includes("momentumContrast ? colorFromHex(0xa8d5e1).scale(0.30)")
  && babylon.includes("momentumActorLift = this.canvas.dataset.babylonScenario === 'momentum-exchange' ? 0.42 : 0;"),
  'magnetic teeth must sit on the moving rotor and actual G7 fighters must contrast with the deck');
assert.ok(presentation.includes("p28-g9-recessed-transfer-rail-steel")
  && presentation.includes("'p27-c8-transfer-rail-' + index, railMetal")
  && presentation.includes("railMetal, rail.position.x"),
  'real rail and carriers must be dark metal, not pale ribbons across combat');
assert.ok(presentation.includes("0x142a32, 0.11, 0.94")
  && presentation.includes("colorFromHex(0x28505c).scale(0.010 * routePulse)"),
  'Momentum route inlays must remain visually subordinate to combat telegraphs');

assert.ok(g7Hud.includes('.game-root[data-location="momentum-exchange"] .boss-hud.boss-hud--top'));
assert.ok(g7Hud.includes('.game-root[data-location="momentum-exchange"] .transient-alert-lane.event .combat-alert b'));
assert.ok(g7Hud.includes('top: max(.45rem, env(safe-area-inset-top));'),
  'route-specific tactical notice must move away from the live flywheel field');
const g7RoofRules = g7Hud.slice(g7Hud.indexOf('/* P28-G9 real Android proof:'));
assert.ok(g7RoofRules.includes('.game-root[data-location="momentum-exchange"] .transient-alert-lane.event > .combat-alert {')
  && g7RoofRules.includes('display: block;')
  && g7RoofRules.includes('-webkit-line-clamp: 2;')
  && g7RoofRules.includes('overflow: hidden;'),
  'real G7 tactical notice must stack the label and limit the warning to two legible lines');
const g7CanvasSource = readFileSync('src/components/GameCanvas.tsx', 'utf8');
assert.ok(g7CanvasSource.includes("message.startsWith('CISLUNAR MOMENTUM EXCHANGE')")
  && g7CanvasSource.includes("message.startsWith('COUNTERMASS MOBILITY')")
  && g7CanvasSource.includes("return 'LATERAL VECTOR BURST'"),
  'real director messages must use concise roof captions without changing their accessible text');
assert.ok(presentation.includes('p28-g9-momentum-machined-lamination-')
  && presentation.includes('0.26, 0.17, 0.36'),
  'Momentum hardware must have fine real laminations rather than chunky flux cubes');
assert.ok(babylon.includes("momentumActorLift = this.canvas.dataset.babylonScenario === 'momentum-exchange' ? 0.42 : 0"),
  'Momentum operator must remain readable against dark industrial flooring');
assert.ok(babylon.includes("const momentumActorLift = this.canvas.dataset.babylonScenario === 'momentum-exchange'"));
assert.ok(babylon.includes("const momentumContrast = this.canvas.dataset.babylonScenario === 'momentum-exchange'"));
assert.ok(readFileSync('src/game/babylonWorldPresentation.ts', 'utf8')
  .includes("|| mission.location === 'momentum-exchange' || mission.location === 'cryo-reserve'\n      || mission.location === 'parallax-array';"));

const validG7Proof = {
  capturedRoute: 'momentum-exchange', backend: 'webgl2', tier: 'high',
  captureMode: 'high-tier-qa-visual-only',
  mapReentry: 'exit-to-command-and-redeploy:ready',
  assetIds: 'refinery-crate-lod0,refinery-pipe-rack-lod0',
  beforeAssetIds: 'refinery-crate-lod0,refinery-pipe-rack-lod0',
  mappedObjects: 8, authoredObjects: 8, fallbackObjects: 0,
  artState: 'ready', beforeArtState: 'ready',
  premium: 'ready', beforePremium: 'ready',
  premiumBindings: 105, ibl: 'shared-prefiltered:ready', beforeIbl: 'shared-prefiltered:ready',
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
assert.ok(presentation.includes('ring.position.y = 0.36 + ringIndex * 0.19'));
assert.ok(presentation.includes('toothMesh.rotation.y = angle'));
assert.ok(presentation.includes('this.canvas.dataset.momentumSimTime = state.time.toFixed(2)'));
assert.ok(presentation.includes('laminated-rim:9+flux-tooth:48'));
assert.ok(renderWorldSource.includes("this.canvas.dataset.babylonScenario === 'momentum-exchange'"));
assert.ok(renderWorldSource.includes("hazard.kind === 'vectorWash'"));
assert.ok(renderWorldSource.includes('momentumWash ? 0xf0a876'));
assert.ok(attackSource.includes('visual.sideA.material = annexWarning || momentumWarning || cryoWarning || parallaxWarning || iceWarning ? visual.laneMaterial : visual.attackMaterial'));
assert.ok(attackSource.includes('tick.setEnabled(annexWarning || momentumWarning || cryoWarning || parallaxWarning)'));
assert.ok(g7Hud.includes('.game-root[data-location="momentum-exchange"] .target-readout'));
assert.ok(g7Hud.includes('.game-root[data-location="momentum-exchange"] .transient-alert-lane:not([data-presentation="deployment"])'));
assert.ok(g7Hud.includes('left: 43%'));
assert.ok(presentation.includes("const magneticCopper = pbr(scene, 'p28-g7-exposed-magnetic-copper'"));
assert.ok(presentation.includes('tooth % 3 === 0 ? magneticCopper : structural'));
// 24 of the 48 indexed flux shoes now use the actual shared bare-metal PBR.
// This adds premium bindings without lowering the live >=100 acceptance gate.
assert.ok(presentation.includes("const shared = new Set(this.premiumSurfaces.materials.values())"));
assert.ok(presentation.includes('ring.material = ringIndex === 1 ? magneticCopper : edgeMetal'));
assert.ok(renderWorldSource.includes('visual.ringMaterial.emissiveColor = color.scale(parallaxShearDuplicate ? 0.12 : parallaxGravity ? 0.24 : momentumHazard ? 0.34 : 1)'));
assert.ok(renderWorldSource.includes('momentumHazard && hazard.kind ==='));
assert.ok(attackSource.includes('(momentumWarning ? 0.46 : parallaxWarning ? 0.54 : cryoWarning ? 0.60 : 0.66)'));
assert.ok(babylon.includes('const momentumTouchLanePan = this.canvas.dataset.babylonScenario ==='));

assert.ok(babylon.includes("const momentumCombatPan = this.canvas.dataset.babylonScenario === 'momentum-exchange'"));
assert.ok(smoke.includes("viewportMode === 'mobile-landscape' ? 42_000 : 90_000"));
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
assert.ok(g7Capture.includes("await awaitMomentumReady('post-reentry Momentum Exchange authored-world readiness'"));
assert.ok(g7Capture.includes("const shotsBefore = await evaluate"));
assert.ok(g7Capture.includes("const touch = async (type, id, x, y)"));
assert.ok(g7Capture.includes("actionInput: 'manual-aim+live-touch-fire', shotsBefore, shotsAfter"));
assert.ok(g7Shell.includes("node tools/verify-p28g7-gameplay-frames.mjs"));
assert.ok(g7Shell.includes('adb install -r "$APK"'));
assert.ok(g7Shell.includes('adb shell pm path "$PACKAGE"'));
assert.ok(g7Shell.includes('P28-G7 capture exited before valid pixel/provenance evidence'));
assert.ok(g7Shell.includes('confirm_immersive_mode_for_g7 || return $?'));
assert.ok(g7Shell.includes('immersive_mode_confirmations confirmed'));
assert.ok(g7Shell.includes('uiautomator dump --compressed'));
assert.ok(g7Shell.includes('node.attrib.get("text") != "Got it"'));
assert.ok(g7Shell.includes('adb shell input tap "$x" "$y"'));
assert.ok(g7Shell.includes('for attempt in 1 2 3; do'));
const androidPrWorkflow = readFileSync('.github/workflows/pr-android-apk.yml', 'utf8');
assert.ok(androidPrWorkflow.includes('name: Android PR API 35 Smoke\n    needs: android-pr-apk\n    runs-on: ubuntu-24.04')
  && androidPrWorkflow.includes('    timeout-minutes: 35\n    steps:'));
assert.ok(g7Shell.includes('P28-G7 non-cutout failure is not retryable'));
assert.ok(g7Workflow.includes('G7 Independent Copilot PNG Inspection'));
assert.ok(g7Workflow.includes('script: bash tools/android-p28g7-momentum-capture.sh'));
assert.ok(!g7Workflow.includes('scripts/android-fast-smoke.sh'));
assert.ok(smoke.includes('P27-B2 fully reauthored refinery after actual WebGPU device loss'));
assert.ok(smoke.includes('P27-B2 fully authored refinery after initial asset upload'));
assert.ok(smoke.includes('d?.babylonEnvironmentState === \'ready\''));
assert.ok(g7Capture.includes('P28G7_ACTUAL_READINESS_FIELDS='));
assert.ok(g7Capture.includes('awaitMomentumReady('));
assert.ok(g7Workflow.includes('imagesActuallyViewed !== true'));
assert.ok(g7Workflow.includes('--attachment android-p28g7-momentum-exchange-normal.png'));
assert.ok(g7Workflow.includes('gh api "/repos/$GITHUB_REPOSITORY/actions/artifacts/$ARTIFACT_ID/zip"'));

console.log('BABYLON_MOMENTUM_EXCHANGE_PASS identity=flywheel-lane|magnetic-machinery|transfer-blue|capture-service routes=' + navigation.routes.length + ' landmarks=' + navigation.landmarks.map(item => item.label).join('|') + ' washes=9s>20s capture=2');
