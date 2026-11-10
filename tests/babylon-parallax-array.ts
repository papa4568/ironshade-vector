import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  BABYLON_PARALLAX_ARRAY_IDENTITY,
  BABYLON_PARALLAX_ARRAY_LIGHTING,
  BABYLON_PARALLAX_PREMIUM_SURFACES,
  parallaxArrayRenderProfile,
  parallaxReferenceState,
  parallaxReferenceRingFitsFrame,
  parallaxShearMode,
} from '../src/game/babylonParallaxArrayPresentation';
import { getMapNavigationPlan } from '../src/game/mapNavigation';
import { auditParallaxVisualProvenance } from '../tools/p28g9-parallax-provenance.mjs';
import { auditParallaxDeckRelief } from '../tools/p28g9-deck-relief.mjs';

const babylon = readFileSync('src/game/babylonCombatRenderer.ts', 'utf8');
const presentation = readFileSync('src/game/babylonParallaxArrayPresentation.ts', 'utf8');
const hudGlance = readFileSync('src/combatHudGlance.css', 'utf8');
const world = readFileSync('src/game/babylonWorldPresentation.ts', 'utf8');
const telegraphs = readFileSync('src/game/babylonEnemyTelegraphs.ts', 'utf8');
const readiness = readFileSync('src/game/babylonRefineryMissionReadiness.ts', 'utf8');
const encounters = readFileSync('src/game/encounters.ts', 'utf8');
const director = readFileSync('src/game/director.ts', 'utf8');
const sim = readFileSync('src/game/sim.ts', 'utf8');
const parallax = readFileSync('src/game/parallaxDebt.ts', 'utf8');
const smoke = readFileSync('scripts/browser-runtime-smoke.mjs', 'utf8');
const workflow = readFileSync('.github/workflows/browser-e2e.yml', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };

assert.deepEqual(BABYLON_PARALLAX_PREMIUM_SURFACES, [
  'deck-plate', 'painted-metal', 'bare-metal', 'polymer-rubber', 'emissive-fixture',
]);
assert.deepEqual(BABYLON_PARALLAX_ARRAY_IDENTITY, {
  silhouette: 'baseline-pylons',
  material: 'metrology-composite',
  lighting: 'reference-violet',
  propSet: 'inertial-reference',
});
assert.deepEqual(BABYLON_PARALLAX_ARRAY_LIGHTING, {
  id: 'reference-violet',
  keyColor: 0xe2ddf1,
  rimColor: 0x9a87cf,
  emergencyColor: 0x7864ba,
  keyIntensity: 2.5,
  rimIntensity: 1.4,
  emergencyIntensity: 7.5,
  exposure: 1.12,
});

// In addition to ready material bindings, the actual scene must have a
// sufficiently lit deck and fiducial faces that survive the gameplay zoom.
for (const detail of ['p28-g9-pylon-rear-scale-', 'p28-g9-pylon-readout-', 'p28-g9-perimeter-long-rail-']) {
  assert.ok(presentation.includes(detail), 'missing readable Parallax instrument detail: ' + detail);
}
assert.ok(presentation.includes('this.hemisphere.intensity = 0.90'), 'Parallax industrial structures need an ambient fill');
for (const detail of [
  'p28-g9-etched-datum-enamel', 'p28-g9-machined-brass-datum',
  'p28-g9-pylon-meter-recess-', 'p28-g9-reference-foot-datum-',
  'p28-g9-survey-apron-long-', 'p28-g9-exterior-survey-truss-',
  'p28-g9-survey-truss-leg-', 'p28-g9-survey-apron-feed-',
  'p28-g9-pylon-calibration-clamp-', 'p28-g9-pylon-calibration-index-',
  'p28-g9-pylon-servo-coupler-', 'p28-g9-optical-gantry-cross-brace-',
  'p28-g9-carriage-coupling-shaft-', 'p28-g9-carriage-rail-shoe-',
  'p28-g9-console-readout-scale-', 'p28-g9-console-optical-port-',
  'p28-g9-shear-perimeter-threat-tick-',
  'p28-g9-pylon-survey-yoke-', 'p28-g9-pylon-interferometer-lens-',
  'p28-g9-reference-objective-mast-', 'p28-g9-reference-objective-halo-',
  'p28-g9-frame-optical-reticle-', 'p28-g9-frame-reticle-index-',
  'p28-g9-carriage-mass-wheel-', 'p28-g9-carriage-mass-gauge-',
  'p28-g9-shear-anchor-fork-',
  'p28-g9-anchor-indexed-dial-', 'p28-g9-anchor-measuring-hub-',
  'p28-g9-anchor-etched-conductor-', 'p28-g9-anchor-index-mark-',
  'p28-g9-exposed-survey-conductor-', 'p28-g9-survey-conductor-isolator-',
  'p28-g9-survey-conductor-bolt-',
  'p28-g9-objective-deck-dial-backing-', 'p28-g9-objective-deck-diamond-',
  'p28-g9-objective-dial-index-rail-', 'p28-g9-objective-dial-index-lamp-',
  'p28-g9-shear-anchor-metal-prong-', 'p28-g9-shear-anchor-machined-jaw-',
  'p28-g9-shear-anchor-brass-station-', 'p28-g9-shear-anchor-violet-inset-',
  'p28-g9-elite-controller-contact-warning',
  'p28-g9-pylon-top-metrology-ruler-bed-', 'p28-g9-pylon-top-metrology-station-',
  'p28-g9-counterweight-arched-fork-', 'p28-g9-counterweight-top-flight-rule-',
  'p28-g9-pylon-machined-bearing-collar-', 'p28-g9-pylon-ribbed-metal-flute-',
  'p28-g9-objective-side-signal-foundation-', 'p28-g9-objective-side-signal-mast-',
  'p28-g9-objective-standalone-diamond-backing-',
  'p28-g9-objective-standalone-diamond-signal-',
  'p28-g9-objective-standalone-dark-bullseye-',
  'p28-g9-shear-anchor-hex-dial-', 'p28-g9-shear-anchor-index-window-',
]) assert.ok(presentation.includes(detail), 'Parallax silhouette must expose calibrated hardware: ' + detail);

// The overhead-view scale and target must be real scene geometry with
// contrasting mechanical insulation, not a status label or a bright route.
assert.ok(presentation.includes("fiducialBrass, side * 1.14, 2.26, 0.96"),
  'exposed reference conductors must use visible brass, not dark trim');
assert.ok(presentation.includes("insulation, side * 1.14, station, 1.01"),
  'conductors must have physically separate insulated support collars');
assert.ok(presentation.includes("objectiveDial.rotation.y = Math.PI / 4"),
  'objective beacon must form a camera-readable top-facing diamond');
assert.ok(presentation.includes("objectiveDialBack.material = graphite"),
  'bright objective markers need a grounded, dark metal backing');
assert.ok(presentation.includes("const fiducialBrass = pbr(scene, 'p28-g9-bold-graduated-brass', 0x816a50"),
  'brass must not render as bright cream optical wheels over the real machine');
assert.ok(presentation.includes('wheel.material = counterweightMetal'),
  'mass-carriage circular races must retain dark machinery contrast');
assert.ok(presentation.includes('objectiveDial.position.set(-1.58, 0.86, 1.58)'),
  'physical reference target must be top-facing and raised above surrounding survey plates');
assert.ok(presentation.includes("shearCeramic, 0, 2.65, 0.52"),
  'violet should read as a narrow insulated hazard channel, not solid pale block prongs');
assert.ok(presentation.includes('this.eliteTellRing.setEnabled(Boolean(baselineController))'),
  'elite warning/contact presentation must be bound to an actual live enemy');
assert.ok(presentation.includes('const telegraphActive = baselineController.telegraph > 0;'),
  'strong elite alert must reflect a real combat telegraph, never an invented attack');
// Route-relative grounding is verified here; the raised 0.26m contact cue
// is specifically pinned by the P28-G9 legibility assertion below.
assert.ok(presentation.includes("this.eliteTellRing.position.set(scaled(baselineController.x),"),
  'elite threat ring must follow real enemy world-space position');
assert.ok(presentation.includes('objectiveDial.material = this.objectiveSignalMaterial'),
  'the objective must have an unlit amber physical-target finish at actual gameplay zoom');
assert.ok(presentation.includes("MeshBuilder.CreateCylinder('p27-c10-pylon-spine-'")
  && presentation.includes('diameterTop: 0.92, diameterBottom: 1.54, tessellation: 10'),
  'reference pylons need faceted tapered machine bodies instead of placeholder crates');
assert.ok(presentation.includes('spindle.material = shell'),
  'new three-dimensional pylon geometry must retain shared KTX2 PBR metal');
assert.ok(presentation.includes('diamondFace.rotation.z = Math.PI / 4')
  && presentation.includes("const diamondFace = box(scene, root, 'p28-g9-objective-standalone-diamond-signal-'")
  && presentation.includes('this.objectiveSignalMaterial, -2.24, 2.80, 1.62'),
  'objective signal must be a tall physical orange diamond with a mechanical footing');
assert.ok(presentation.includes('prong.material = insulation'),
  'shear forks need cylindrical insulated prongs rather than flat painted placeholder blocks');
assert.ok(presentation.includes("this.objectiveSignalMaterial.disableLighting = true"),
  'overexposed shared PBR lights may not erase the objective signal');
assert.ok(presentation.includes("station % 3 === 0 ? 0.31 : 0.18"),
  'camera-scale pylon graduation ticks must not regress to sub-pixel stripes');
assert.ok(presentation.includes("vectorWashes.length > 0 ? 0.23 : 0.06"),
  'authored active reference shear must remain visibly distinct from the dark floor');
assert.ok(presentation.includes("baselineController.telegraph > 0"),
  'never fabricate attack warning when the real elite has not telegraphed');
assert.ok(presentation.includes("this.objectiveSignalMaterial.dispose();"),
  'the physical objective target must not leak a scene-owned material');

assert.ok(presentation.includes('floor.emissiveColor = colorFromHex(0x42566f).scale(0.10)'),
  'PBR floor relief needs restrained bounce fill at gameplay zoom');
assert.ok(presentation.includes('0.94) : 0'), 'Parallax normal-quality PBR needs nonblack IBL');
assert.ok(telegraphs.includes("const parallaxWarning = this.canvas.dataset.babylonScenario === 'parallax-array'"));
assert.ok(telegraphs.includes('parallaxWarning ? 0.12 : 0.14'), 'Parallax warning lanes must remain transparent');
assert.ok(telegraphs.includes('parallaxWarning ? 0.74 : iceWarning ? 0.48 : 1'), 'Parallax combat lanes must not become wide route ribbons');
assert.ok(telegraphs.includes("this.canvas.dataset.babylonScenario === 'parallax-array' ? 0.27 : 0.42"),
  'Parallax boss phase rings must keep contact geometry visible');
assert.ok(director.includes("'Baseline Controller', 182, 132"), 'elite target label must be phone readable');

assert.deepEqual(parallaxArrayRenderProfile(1, false), {
  name: 'full',
  frameInstances: 3,
  carriageInstances: 3,
  anchorInstances: 8,
  shearInstances: 3,
});
assert.equal(parallaxArrayRenderProfile(0.8, false).name, 'balanced');
assert.equal(parallaxArrayRenderProfile(0.5, false).name, 'performance');
assert.deepEqual(parallaxArrayRenderProfile(1, true), parallaxArrayRenderProfile(1, false), 'Coarse input alone must preserve the full Parallax Array profile.');
assert.equal(parallaxReferenceState(0, 3), 'armed');
assert.equal(parallaxReferenceState(1, 3), 'partial');
assert.equal(parallaxReferenceState(3, 3), 'aligned');
assert.equal(parallaxReferenceState(0, 0), 'offline');
assert.equal(parallaxShearMode(1, 0.1), 'reference-shear');
assert.equal(parallaxShearMode(0, 0.4), 'gravity-split');
assert.equal(parallaxShearMode(0, 0.2), 'nominal');
// Unlike clipping/recoloring a screenshot, this checks a real scene-only
// visibility decision tied to the active camera: suppress bright ornamental
// rings that would be truncated at the lower phone edge, not physical pylons.
assert.equal(parallaxReferenceRingFitsFrame(650, 0, 900), true);
assert.equal(parallaxReferenceRingFitsFrame(720, 0, 900), true);
assert.equal(parallaxReferenceRingFitsFrame(721, 0, 900), false);
assert.equal(parallaxReferenceRingFitsFrame(750, 20, 900), false);
assert.equal(parallaxReferenceRingFitsFrame(700, 20, 900), true);
assert.equal(parallaxReferenceRingFitsFrame(Number.NaN, 0, 900), false);
assert.ok(presentation.includes('rig.core.setEnabled(ringFitsFrame)')
  && presentation.includes('ring.setEnabled(ringFitsFrame)')
  && presentation.includes('camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())'),
  'clip only bright scene-owned calibration ornament using real camera pixels; preserve physical reference station');

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
  "addAt('reference-node-a', labels[0], 'gravityControl', 0)",
  "addAt('reference-node-b', labels[1], 'gravityControl', 1)",
  "addAt('reference-node-c', labels[2], 'gravityControl', 2)",
]) assert.ok(encounters.includes(marker), 'missing Parallax authored encounter cue: ' + marker);

assert.ok(director.includes("contract.location === 'parallax-array'"));
assert.ok(director.includes("runtime.elapsed >= 8"));
assert.ok(director.includes("deployHazard(state, 980, 420, 'vectorWash', 6)"));
assert.ok(director.includes("runtime.elapsed >= 19"));
assert.ok(director.includes("deployHazard(state, 1420, 620, 'vectorWash', 6)"));
assert.ok(sim.includes("object.id.startsWith('reference-node-')"));
assert.ok(sim.includes('PHYSICAL BASELINE ALIGNED'));
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
assert.ok(babylon.includes("const parallaxTouchLanePan = this.canvas.dataset.babylonScenario === 'parallax-array' && !narrow ? 2.4 : 0;"),
  'Parallax combat framing must protect the existing right-side FIRE touch lane');
assert.ok(babylon.includes('momentumTouchLanePan + cryoTouchLanePan + parallaxTouchLanePan'),
  'Parallax camera should translate eye and target without changing simulation');
assert.ok(hudGlance.includes('.game-root[data-location="parallax-array"] .transient-alert-lane.event .combat-alert b'),
  'Parallax tactical alert lane must have a route-scoped mobile treatment');
assert.ok(hudGlance.includes('P28-G9/G7 exact-APK review')
  && hudGlance.includes('background: rgba(5, 11, 17, .78)'),
  'both compact tactical callouts must leave machinery and combat space visible');
const gameCanvas = readFileSync('src/components/GameCanvas.tsx', 'utf8');
for (const cue of ['ALIGN 3 REFERENCE PYLONS', 'SHEAR FRONT LIVE // ALIGN PYLONS',
  'CAPTURE MOMENTUM TRANSFER DRUMS', 'COUNTERMASS FRONT LIVE']) {
  assert.ok(gameCanvas.includes(cue), 'Parallax/Momentum route events need concise readable messages: ' + cue);
}
assert.ok(gameCanvas.includes("MASS-WELL LOCK LIVE"), 'Momentum event must fit a safe upper-HUD gap');
assert.ok(gameCanvas.includes("message.startsWith('DIRECTOR EVENT') && message.includes('LIFE-SUPPORT PURGE')")
  && gameCanvas.includes("return 'LIFE-SUPPORT PURGE // AIR LOW';"),
  'Parallax life-support warnings must stay legible in the roof, with full text accessible');
assert.ok(hudGlance.includes('Parallax\'s warning in the roof band')
  && hudGlance.includes('.game-root[data-location="parallax-array"] .transient-alert-lane.event > .combat-alert {')
  && hudGlance.includes('background: rgba(5, 11, 17, .68);'),
  'compact Parallax tactical warnings must not hide central physical metrology');
assert.ok(hudGlance.includes('P28-G9 real Android proof: reserve the *unoccupied top status roof*'),
  'Parallax and Momentum tactical alerts must not overlap gameplay floor/rails');
assert.ok(gameCanvas.includes("aria-label={hud.eventT > 0 && !bossTransitionCue && !deploymentCueVisible ? hud.eventText : undefined}"),
  'compact alerts must preserve the full original director announcement for accessibility');

// Do not preload the premium Parallax machinery on refinery/other routes:
// that races the 19 authored family assets required by P28-F6 lifecycle QA.
assert.ok(babylon.includes('private parallaxArrayPresentation: BabylonParallaxArrayPresentation | null = null'));
assert.ok(babylon.includes('this.parallaxArrayPresentation ??= new BabylonParallaxArrayPresentation(this.scene, this.canvas, false)'));
assert.ok(!babylon.includes('this.parallaxArrayPresentation = new BabylonParallaxArrayPresentation(scene, canvas, qualityCoarse)'));
assert.ok(babylon.includes("this.parallaxArrayPresentation?.release('scenario-exit')"));
assert.ok(babylon.includes("this.parallaxArrayPresentation?.release('scenario-switch')"));
assert.ok(babylon.includes('this.parallaxArrayPresentation?.dispose()'));
assert.ok(babylon.includes("this.parallaxArrayPresentation.sync(state, budget, mission.conditions.includes('low-visibility'));"));
assert.ok(babylon.includes('momentum-exchange,cryo-reserve,parallax-array'));
assert.ok(babylon.includes('this.worldPresentation.sync(state, mission, budget.detailScale);'));
assert.ok(smoke.includes('async function p27C10BabylonParallaxArrayAudit()'));
assert.ok(smoke.includes('BROWSER_P27C10_BABYLON_PARALLAX_ARRAY_PASS'));
assert.ok(smoke.includes("else if (targetLocation === 'parallax-array') await p27C10BabylonParallaxArrayAudit();"));
assert.ok(smoke.includes("if (targetLocation === 'parallax-array') {"));
assert.ok(smoke.includes("parallaxDebt.step = 2"));
assert.ok(smoke.includes("state.profile.level = Math.max(15, state.profile.level || 1)"));
assert.ok(smoke.includes("BROWSER_PARALLAX_ARRAY_SEED_PASS parallaxDebt=active step=2 level>=15 stage=predeploy"));
assert.ok(smoke.includes("BROWSER_PARALLAX_ARRAY_SEED_RESTORE_PASS stage=babylon-exit"));
assert.ok(smoke.includes("state.hazardMode === 'gravity-split' && gravitySheared"));
assert.ok(workflow.includes('BROWSER_E2E_GRAPHICS_PATH=babylon BROWSER_E2E_LOCATION=parallax-array'));
assert.ok(workflow.includes('p27c10-parallax-array.png'));
assert.ok(pkg.scripts['test:babylon-parallax-array']);
assert.ok(pkg.scripts.build.includes('npm run test:babylon-parallax-array'));

// Actual Android frame review: distant standards must expose rounded conductors,
 // countable machined analog graduations and an atlas-bound faceted drum instead
 // of looking like dark crates with a pale circle on top.
assert.ok(presentation.includes('p28-g9-pylon-machined-faceted-micrometer-')
  && presentation.includes('p28-g9-pylon-rotary-micrometer-engraved-station-')
  && presentation.includes('p28-g9-pylon-exposed-rounded-survey-conductor-')
  && presentation.includes('p28-g9-pylon-external-conductor-insulator-')
  && presentation.includes('p28-g9-pylon-top-ruled-analog-bed-')
  && presentation.includes('p28-g9-pylon-top-readable-analog-notch-')
  && presentation.includes('micrometerDrum.material = counterweightMetal;')
  && presentation.includes('conductor.material = calibrationInk;')
  && presentation.includes('station < 12')
  && presentation.includes('step < 5'),
  'physical KTX2-bound metrology details must remain visible at gameplay scale');
// The exact Android reviewer must be able to count real bold stations
// *on each pylon*, rather than only on the central, separately mounted gauge.
// Real reference-node alignment targets must be unmistakable against
// warm industrial caps and separate *navigation* bollards at phone zoom.
assert.ok(presentation.includes("indexInk.fillText('ALIGN', 18, 117)")
  && presentation.includes('p28-g9-pylon-align-optic-bracket-')
  && presentation.includes('p28-g9-pylon-align-objective-shroud-')
  && presentation.includes('p28-g9-pylon-align-machined-contrast-perimeter-')
  && presentation.includes('alignPerimeter.material = calibrationInk;')
  && presentation.includes('p28-g9-pylon-align-distinct-amber-diamond-')
  && presentation.includes('alignSignal.material = this.objectiveSignalMaterial;')
  && presentation.includes('p28-g9-pylon-align-dark-target-aperture-')
  && presentation.includes('alignBracket.parent = root;')
  && presentation.includes('p28-g9-wayfinding-grounded-bollard-shoe-')
  && presentation.includes('{ height: 1.10, diameterTop: 0.26, diameterBottom: 0.76')
  && presentation.includes('marker.material = cyan;'),
  'grounded cyan route bollards must not masquerade as amber physical objective pylons');
// Keep a camera-safe physical service scale and objective signal while
// avoiding the former huge in-world slab and multiple glowing orange caps.
// Independently identify the eight violet shear forks vs the three standards.
assert.ok(presentation.includes('standardCassette.scaling.set(0.80, 0.80, 0.80);')
  && presentation.includes('standardCassette.position.set(2.18, 2.35, 2.10);')
  && presentation.includes('p28-g9-pylon-spindle-exposed-datum-notch-')
  && presentation.includes('station < 5')
  && presentation.includes("p28-g9-shear-anchor-violet-powered-crosshead-")
  && presentation.includes("transducerRim.material = shearCeramic;")
  && presentation.includes("marker.material = shearCeramic;")
  && presentation.includes("0x49336e, 0.16, 0.87, 0xa16be2, 0.24")
  && presentation.includes("{ diameter: 1.54, height: 0.24, tessellation: 4 }"),
  'three physical scales, amber targets and eight insulated shear keys must retain distinct silhouettes');
assert.ok(presentation.includes('p28-g9-pylon-body-mounted-vernier-cassette-')
  && presentation.includes('standardCassette.parent = root;')
  && presentation.includes('p28-g9-pylon-body-vernier-enamel-bed-')
  && presentation.includes('p28-g9-pylon-body-vernier-machined-rail-')
  && presentation.includes('p28-g9-pylon-body-vernier-braced-mount-')
  && presentation.includes('p28-g9-pylon-body-vernier-number-')
  && presentation.includes('standardNumber.material = indexMaterial;')
  && presentation.includes('p28-g9-pylon-body-vernier-countable-tick-')
  && presentation.includes('graduation < 5')
  && presentation.includes('major ? 1.78 : 1.22'),
  'the three real reference pylons must show countable high-contrast body-mounted fiducials');
assert.ok(presentation.includes('p28-g9-pylon-survey-open-cheek-')
  && presentation.includes('p28-g9-pylon-survey-brass-conductor-')
  && presentation.includes('p28-g9-pylon-macro-cross-vernier-')
  && presentation.includes('p28-g9-pylon-open-scale-notch-')
  && presentation.includes('station < 4')
  && presentation.includes('rig.gauge.setEnabled(gaugeFitsFrame);')
  && presentation.includes('this.eliteContactBeacon.position.set(scaled(baselineController.x), 3.20'),
  'macro optical stations and world-space elite optics must survive at Android zoom');
assert.ok(presentation.includes('p28-g9-pylon-front-graduated-ruler-bed-')
  && presentation.includes('p28-g9-pylon-front-readable-graduation-')
  && presentation.includes('station < 8')
  && presentation.includes('p28-g9-pylon-front-isolated-conductor-')
  && presentation.includes('p28-g9-pylon-front-objective-beacon-amber-')
  && presentation.includes('beaconFace.rotation.z = Math.PI / 4;'),
  'three real reference standards need readable, body-mounted scales and amber objective diamonds');

assert.ok(presentation.includes('p28-g9-pylon-macro-ruler-housing-')
  && presentation.includes('p28-g9-pylon-macro-face-index-')
  && presentation.includes('p28-g9-pylon-macro-side-index-')
  && presentation.includes('major ? calibrationInk : etched')
  && presentation.includes('p28-g9-objective-top-amber-diamond-')
  && presentation.includes('p28-g9-objective-top-diamond-backing-')
  && presentation.includes('referenceDiamond.material = this.objectiveSignalMaterial;'),
  'real reference pylons require countable two-axis fiducials and their own bolted amber objective');
assert.ok(hudGlance.includes('.game-root[data-location="parallax-array"] .target-readout .target-values span')
  && hudGlance.includes('flex: 0 0 auto;')
  && hudGlance.includes('white-space: nowrap;'),
  'Parallax Baseline Controller HP and armor must not wrap in compact landscape');

assert.ok(presentation.includes("new DynamicTexture('p28-g9-physical-datum-numbered-display'")
  && presentation.includes("displayInk.fillText('DATUM', 34, 79);")
  && presentation.includes('p28-g9-pylon-top-facing-numbered-calibration-')
  && presentation.includes('p28-g9-console-numbered-readout-')
  && presentation.includes('p28-g9-carriage-coaxial-reference-race-')
  && presentation.includes('MeshBuilder.CreateCylinder(\'p27-c10-carriage-mass-\'')
  && presentation.includes('this.calibrationDisplayTexture.dispose();')
  && presentation.includes('this.calibrationDisplayMaterial.dispose();'),
  'G9 actual phone zoom needs visible numbered metrology hardware, cylindrical masses and disposed instrument textures');

assert.ok(presentation.includes('p28-g9-pylon-vertical-numbered-sight-glass-')
  && presentation.includes('p28-g9-pylon-sight-glass-support-')
  && presentation.includes('uprightScale.rotation.y = Math.PI / 4;')
  && presentation.includes('uprightScale.position.set(1.39, 3.22, 1.29);')
  && presentation.includes('{ width: 2.02, height: 1.10 }')
  && presentation.includes('uprightScale.material = this.calibrationDisplayMaterial;')
  && presentation.includes('graphite, 1.22, 3.16, 1.08, 2.36, 1.40, 0.22);'),
  'each actual Parallax pylon needs a legible, bracket-mounted graduated face in the real mobile camera');
assert.ok(presentation.includes("new DynamicTexture('p28-g9-pylon-numbered-engraving-' + index")
  && presentation.includes("indexInk.fillText(String(index + 1).padStart(2, '0'), 20, 99);")
  && presentation.includes("'p28-g9-pylon-numbered-plate-' + index")
  && presentation.includes("indexPlaque.position.set(2.13, 2.34, 1.49);")
  && presentation.includes('indexPlaque.material = indexMaterial;')
  && presentation.includes('{ width: 1.00, height: 0.62 }, scene);')
  && presentation.includes('graphite, 2.03, 2.32, 1.34, 1.10, 0.78, 0.14);')
  && presentation.includes('this.pylonIndexMaterials.forEach(material => material.dispose());')
  && presentation.includes('this.pylonIndexTextures.forEach(texture => texture.dispose());'),
  'all three reference pylons require distinct camera-facing engraved identities with managed GPU resources');
assert.ok(presentation.includes("MeshBuilder.CreateCylinder('p27-c10-pylon-core-' + index")
  && presentation.includes('{ diameter: 1.38, height: 0.24, tessellation: 4 }')
  && presentation.includes('core.material = this.objectiveSignalMaterial;'),
  'a real orange objective diamond must stand apart from pale calibration rings');

// This contact optic tracks a real elite, but must never appear as a huge
// opaque vertical ribbon across the player and calibrated apparatus.
assert.ok(presentation.includes("{ diameter: 2.48, thickness: 0.16, tessellation: 40 }")
  && presentation.includes('this.eliteTellRing.rotation.x = 0;')
  && presentation.includes('telegraphActive ? 0.82 : 0.42;'),
  'real Parallax elite contact must stay floor-bound and subordinate to danger tells');

// A high-angle Android view must read each physical standard's numeral and
// coarse scale without trusting tiny front-facing tick marks hidden by yokes.
assert.ok(presentation.includes('p28-g9-pylon-overhead-engraved-head-')
  && presentation.includes('p28-g9-pylon-overhead-vernier-label-')
  && presentation.includes('p28-g9-pylon-overhead-vernier-brace-')
  && presentation.includes('gaugeFace.rotation.x = -Math.PI / 2;')
  && presentation.includes('gauge.position.set(-1.20, 6.12, 0.78);')
  && presentation.includes('rig.gaugeFace.getAbsolutePosition()')
  && presentation.includes('faceCenter.y <= viewport.y + viewport.height * 0.66;')
  && presentation.includes('rig.gauge.setEnabled(gaugeFitsFrame);')
  && presentation.includes("indexInk.fillRect(153, 19 + graduation * 23"),
  'physical Parallax overhead gauges must expose readable, supported fiducials');
assert.ok(babylon.includes("const parallaxThreatScale = this.canvas.dataset.babylonScenario === 'parallax-array'")
  && babylon.includes("enemy.role === 'elite' ? 1.22 : 1.12 : 1")
  && babylon.includes("visual.root.scaling.set(parallaxThreatScale, parallaxThreatScale, parallaxThreatScale)"),
  'only the Parallax rendered threat silhouette may grow; physics and other routes must be untouched');

// Exposed real metrology hardware must not collapse back into a white bar
// stack at Android gameplay zoom. Three calibrated vernier sleeves, six
// physical triangulated frame ties, and three raised carriage bearings
// establish different machine silhouettes without altering simulation.
assert.ok(presentation.includes('p28-g9-pylon-front-precision-face-')
  && presentation.includes('p28-g9-pylon-front-macro-graduation-')
  && presentation.includes('p28-g9-pylon-front-vernier-pointer-')
  && presentation.includes('frontDial.material = counterweightMetal')
  && presentation.includes('frontRim.material = fiducialBrass'),
  'physical readable front-facing metrology scales must survive the overhead camera');
assert.ok(presentation.includes('p28-g9-shear-anchor-optical-transducer-')
  && presentation.includes('p28-g9-shear-anchor-transducer-index-ring-')
  && presentation.includes('p28-g9-calibration-floor-ruled-track-')
  && presentation.includes('notch < 3'),
  'insulated shear forks and nonrepetitive physical floor bays cannot remain cuboid stacks');
assert.ok(babylon.includes("const parallaxSilhouette = this.canvas.dataset.babylonScenario === 'parallax-array';")
  && presentation.includes('telegraphActive ? 0.82 : 0.42;')
  && presentation.includes('telegraphActive ? 1.15 : 0.86')
  && presentation.includes('this.eliteContactBeacon.position.set(scaled(baselineController.x), 3.20, scaled(baselineController.y))'),
  'true Parallax elite contact must remain readable without inventing a timed attack');
assert.ok(presentation.includes('p28-g9-pylon-precision-dial-face-')
  && presentation.includes('p28-g9-pylon-precision-dial-rim-')
  && presentation.includes('p28-g9-pylon-precision-dial-index-')
  && presentation.includes('p28-g9-pylon-upright-measuring-yoke-')
  && presentation.includes('p28-g9-pylon-yoke-triangulation-')
  && presentation.includes('dialRim.material = fiducialBrass')
  && presentation.includes('measuringYoke.material = graphite'),
  'Parallax pylons need non-HUD top-facing calibrated dials and measured structural yokes');
assert.ok(babylon.includes("const parallaxActorLift = this.canvas.dataset.babylonScenario === 'parallax-array' ? 0.62 : 0;")
  && babylon.includes("const parallaxContrast = this.canvas.dataset.babylonScenario === 'parallax-array';")
  && babylon.includes('parallaxContrast ? 0.74')
  && babylon.includes('parallaxContrast ? 0.96'),
  'live player/enemy silhouettes must be distinguishable from the Parallax floor without fake attacks');
assert.ok(presentation.includes('p28-g9-pylon-machined-vernier-sleeve-')
  && presentation.includes('p28-g9-pylon-vernier-radial-calibration-')
  && presentation.includes('mark < 16')
  && presentation.includes('p28-g9-cross-track-triangulated-guy-')
  && presentation.includes('MeshBuilder.CreateTube')
  && presentation.includes('p28-g9-carriage-top-machined-bearing-')
  && presentation.includes('p28-g9-carriage-top-vernier-notch-')
  && presentation.includes('vernier-sleeve:3+cross-track-tie:6+counterweight-bearing:3'),
  'baseline pylons, cross-track frames and moving masses require distinct faceted calibrated hardware');
assert.ok(presentation.includes('this.eliteTellRing.position.set(scaled(baselineController.x), 0.13, scaled(baselineController.y))')
  && presentation.includes('this.eliteTellMaterial.alpha = telegraphActive ? 0.82 : 0.42;')
  && presentation.includes('this.bossWarning.setEnabled(patternHot);'),
  'real elite contact and telegraph phases must remain visible without inventing attacks');
// P28-G9: shipped KTX2 PBR bindings (not metadata-only), shared authored
// world objects and a fail-closed scene-readiness path are mandatory.
assert.ok(presentation.includes("this.premiumSurfaces = createBabylonPremiumPbrSurfaceLibrary(scene);"));
for (const id of BABYLON_PARALLAX_PREMIUM_SURFACES) {
  assert.ok(presentation.includes("this.premiumSurfaces.get('" + id + "')"), 'unbound Parallax KTX2 family: ' + id);
}
assert.ok(presentation.includes("material.albedoTexture?.isReady() === true"));
assert.ok(presentation.includes("material.bumpTexture?.isReady() === true"));
assert.ok(presentation.includes("material.metallicTexture?.isReady() === true"));
assert.ok(presentation.includes("this.canvas.dataset.babylonEnvironmentState = premiumReady && this.iblReady ? 'ready' : 'loading'"));
assert.ok(presentation.includes("this.iblTexture = new CubeTexture('/assets/environments/refinery-prefiltered.env'"));
assert.ok(presentation.includes("this.premiumSurfaces.dispose()"));
assert.ok(presentation.includes("this.iblTexture.dispose()"));
assert.ok(world.includes("|| mission.location === 'parallax-array';"));
assert.ok(world.includes("const parallaxGravity = this.canvas.dataset.babylonScenario === 'parallax-array'")
  && world.includes("parallaxGravity ? 0.24 : momentumHazard ? 0.34 : 1")
  && /parallaxGravity\s*\?\s*0\.13\s*\+\s*Math\.sin\(state\.time \* presentation\.pulseHz\) \* 0\.022/.test(world),
  'Parallax gravity radius and active glyph must stay real but cannot obscure instrument relief with luminous loops');
assert.ok(world.includes("const parallaxShearDuplicate = this.canvas.dataset.babylonScenario === 'parallax-array'")
  && world.includes("hazard.kind === 'vectorWash'")
  && /parallaxShearDuplicate\s*\?\s*0\.03/.test(world),
  'already authored violet shear must not get a second large cyan world-ring over the same real hazard');

assert.ok(readiness.includes("|| mission.location === 'parallax-array');"));
for (const detail of [
  'p28-g9-pylon-fiducial-', 'p28-g9-pylon-conductor-', 'p28-g9-frame-scale-',
  'p28-g9-carriage-stud-', 'p28-g9-anchor-insulator-', 'p28-g9-console-knob-',
]) assert.ok(presentation.includes(detail), 'missing Parallax calibrated geometry: ' + detail);
assert.ok(presentation.includes("Math.min(babylonRouteMarkingWidth(route.kind)"));
assert.ok(presentation.includes("this.canvas.dataset.babylonRouteMarkingMaxWidth = String(BABYLON_ROUTE_MARKING_WIDTHS.primary)"));
assert.ok(presentation.includes('p28-g9-physical-reference-baseline-')
  && presentation.includes('p28-g9-physical-datum-graduation-')
  && presentation.includes('p28-g9-reference-isolator-foot-')
  && presentation.includes('physical-baseline:3+datum-graduation:39+isolator-foot:12'),
  'three long-baseline metrology rails must exist as calibrated physical hardware');
assert.ok(presentation.includes("this.datumAlbedoTexture = new DynamicTexture('p28-g9-metrology-machined-etched-atlas'")
  && presentation.includes("this.datumNormalTexture = new DynamicTexture('p28-g9-metrology-etched-normal-atlas'")
  && presentation.includes('etched.bumpTexture = this.datumNormalTexture;')
  && presentation.includes('this.datumNormalTexture.dispose();'),
  'precision metrology housings must carry real normal and albedo relief');
assert.ok(presentation.includes('p28-g9-outboard-metrology-hall-deck')
  && presentation.includes('p28-g9-service-hall-back-wall-')
  && presentation.includes('p28-g9-service-hall-survey-window-')
  && presentation.includes('p28-g9-service-hall-calibration-ruler-'),
  'real Parallax outside camera corners must depict textured physical laboratory rooms, not black void');
assert.ok(presentation.includes('p28-g9-calibrated-baseline-conductor-')
  && presentation.includes('p28-g9-objective-side-beacon-')
  && presentation.includes('p28-g9-physical-objective-index-')
  && presentation.includes('side-objective-beacon:9+conductor-bar:6'),
  'legible physical side objectives and shielded baseline bars must survive at Android camera scale');
assert.ok(presentation.includes('p28-g9-pylon-exposed-metrology-ruler-')
  && presentation.includes('p28-g9-pylon-datum-large-mark-')
  && presentation.includes('p28-g9-instrumented-moving-counterweight-')
  && presentation.includes('p28-g9-counterweight-travel-indicator-')
  && presentation.includes('p28-g9-shear-anchor-insulated-upright-')
  && presentation.includes('p28-g9-shear-anchor-violet-crosshead-'),
  'Parallax fiducials, moving calibrated masses and insulated shear forks must be physically distinct at gameplay zoom');
assert.ok(presentation.includes("this.bossWarning = MeshBuilder.CreateTorus('p28-g9-boss-attack-warning-ring'")
  && presentation.includes('this.bossWarning.setEnabled(patternHot);')
  && presentation.includes('patternHot ? 0xf2a35e : phaseTwo')
  && presentation.includes('this.bossWarning.scaling.set(pulse, pulse, pulse);'),
  'amber boss danger ring must reflect the real pattern wind-up and not a fabricated HUD hazard');
assert.ok(presentation.includes("const graduation = pbr(scene, 'p28-g9-machined-brass-datum', 0x856747, 0.35, 0.76);")
  && presentation.includes("const fiducialBrass = pbr(scene, 'p28-g9-bold-graduated-brass'")
  && presentation.includes("counterweightMetal.bumpTexture = this.datumNormalTexture;")
  && presentation.includes("p28-g9-console-large-angled-housing-")
  && presentation.includes("p28-g9-shear-anchor-violet-crosshead-"),
  'heavy calibrated masses, consoles and dark shear ceramics must have distinct materials/relief from brass targets');
assert.ok(presentation.includes('p28-g9-survey-machine-floor-island-')
  && presentation.includes('p28-g9-survey-machine-floor-inset-')
  && presentation.includes('p28-g9-survey-machine-floor-joint-'),
  'three machined service islands must break the repetitive floor without broad luminous route bands');
assert.ok(presentation.includes('p28-g9-pylon-machined-service-plinth-')
  && presentation.includes('p28-g9-pylon-large-front-scale-bed-')
  && presentation.includes('p28-g9-pylon-large-scale-tick-')
  && presentation.includes('p28-g9-pylon-physical-align-target-')
  && presentation.includes('p28-g9-pylon-plinth-objective-corner-'),
  'the actual alignment pylons must display bolted reference plinths, counted scales and warm world-space objectives');
assert.ok(presentation.includes('p28-g9-shear-anchor-bolted-floor-foundation-')
  && presentation.includes('p28-g9-shear-anchor-grounded-saddle-')
  && presentation.includes('p28-g9-optical-frame-mounted-service-plate-'),
  'fork and frame structures must terminate in grounded metal foundations rather than floating lavender fins');
assert.ok(presentation.includes('p28-g9-counterweight-macro-top-graduation-')
  && presentation.includes('p28-g9-counterweight-axle-bearing-housing-')
  && presentation.includes('p28-g9-console-overhead-metric-glass-')
  && presentation.includes('p28-g9-console-overhead-readout-graduation-')
  && presentation.includes('survey-floor-island:3+pylon-plinth:3+grounded-anchor:8+macro-ruler:3+carriage-top-meter:3+console-top-screen:3'),
  'overhead view must expose large calibrated moving masses and readable analysis consoles');
assert.ok(gameCanvas.includes("message.startsWith('TACTICAL ALERT') && message.includes('DAMAGED GRID')")
  && gameCanvas.includes('GRID ARC LIVE // CLEAR FIELD'),
  'the live grid warning must remain actionable without filling the metrology instrument roof');
// Real Android screens showed overexposed cream calibration rings obscuring
// the active target identity. The objective toruses must remain physically
// attached, but use the saturated unlit amber signal, not PBR brass.
assert.ok(presentation.includes('target.material = this.objectiveSignalMaterial;')
  && presentation.includes('crown.material = this.objectiveSignalMaterial;')
  && presentation.includes("this.objectiveSignalMaterial.emissiveColor = colorFromHex(0xff861b).scale(0.84)")
  && presentation.includes('p28-g9-objective-standalone-diamond-signal-')
  && presentation.includes('p28-g9-pylon-top-metrology-ruler-bed-')
  && presentation.includes('p28-g9-pylon-exposed-metrology-ruler-'),
  'objective beacons must read as saturated amber instruments amid dark engraved PBR machines, not cream loops');
assert.ok(presentation.includes('p28-g9-pylon-near-deck-objective-plate-')
  && presentation.includes('p28-g9-pylon-near-deck-target-wing-')
  && presentation.includes('p28-g9-bold-graduated-brass')
  && presentation.includes('p28-g9-moving-inertial-counterweight')
  && presentation.includes('p28-g9-insulated-violet-shear-ceramic')
  && presentation.includes('p28-g9-calibration-console-screen')
  && presentation.includes('p28-g9-console-large-metric-screen-')
  && presentation.includes('p28-g9-console-calibration-channel-'),
  'G9 requires real high-contrast physical objectives, moving masses, split ceramic anchors, and readable consoles at gameplay zoom');
// Brightness and objective identity must be physical, not another floating
// HUD marker or a blown-out cream PBR instrument cap at mobile zoom.
assert.ok(presentation.includes("'p28-g9-pylon-objective-signal-fork-'")
  && presentation.includes("'p28-g9-pylon-objective-diamond-shroud-'")
  && presentation.includes("'p28-g9-pylon-objective-diamond-visible-'")
  && presentation.includes("'p28-g9-pylon-objective-diamond-dark-aperture-'")
  && presentation.includes('signalFace.material = this.objectiveSignalMaterial;')
  && presentation.includes("0x344c59, 0.22, 0.94"),
  'real pylon objectives need bright, supported top-facing diamonds and satin anti-glare caps');
assert.ok(presentation.includes('p28-g9-physical-datum-objective-beacon')
  && presentation.includes('p28-g9-objective-datum-beacon-crown-')
  && presentation.includes('p28-g9-objective-calibration-chevron-')
  && presentation.includes('objective-crown:9'),
  'objective beacons must be unique, raised, warm-gold physical instruments at each pylon');
const shearOpacity = presentation.match(/vectorWashes\.length > 0 \? ([0-9.]+) : ([0-9.]+)/);
assert.ok(shearOpacity && Number(shearOpacity[1]) >= 0.20 && Number(shearOpacity[1]) <= 0.24
  && Number(shearOpacity[2]) <= 0.06
  && presentation.includes("colorFromHex(0xc9a0ff).scale(0.82"),
  'real violet shear must be visible without masking the machined survey deck');
assert.ok(hudGlance.includes('width: min(25vw, 20rem);')
  && gameCanvas.includes("message.startsWith('REFERENCE TECH')"),
  'G9 small tactical warnings should not occupy the main survey work surface');
const g9Capture = readFileSync('tools/android-p28g9-parallax-capture.mjs', 'utf8');
const g9Shell = readFileSync('tools/android-p28g9-parallax-capture.sh', 'utf8');
const g9Workflow = readFileSync('.github/workflows/p28-g9-parallax-visual-qa.yml', 'utf8');
const g9Verify = readFileSync('tools/verify-p28g9-gameplay-frames.mjs', 'utf8');
assert.ok(g9Capture.includes("parallaxPremiumAssetState === 'ready'"));
assert.ok(g9Capture.includes("babylonSharedWorldArtState === 'ready'"));
assert.ok(g9Capture.includes("environmentIbl === 'shared-prefiltered:ready'"));
assert.ok(g9Capture.includes("window.dispatchEvent(new Event('ironshade:p27d5-return-to-hub'))"));
assert.ok(g9Capture.includes("shotsAfter > shotsBefore"));
assert.ok(g9Capture.includes("Number(document.querySelector('canvas')?.dataset.environmentReferenceShear ?? 0) > 0"),
  'action frame must contain at least one actual director-triggered vectorWash, even during a boss pattern');
assert.ok(presentation.includes("this.canvas.dataset.environmentReferenceShear = String(vectorWashes.length)"),
  'live-shear capture observation must derive from real active sim hazards');
assert.ok(g9Capture.includes("await redeployParallaxForShear('initial')")
  && g9Capture.includes("await redeployParallaxForShear('recover-live-director-window')")
  && g9Capture.includes('ANDROID_P28G9_REAL_SHEAR_REDEPLOY'),
  'native ANR recovery must reacquire hazard only through the real command-deck lifecycle');
assert.ok(g9Capture.includes("await waitFor(liveShear, 'live shear during combat'"),
  'live shear must remain present in the actual action, not only during setup');
assert.ok(g9Capture.includes("const readyWithLiveShear = '(' + ready + ') && (' + liveShear + ')'")
  && g9Capture.includes("await waitForRealShearWithProgress('post-reentry visually-ready director-authored shear'")
  && g9Capture.includes('P28G9_ACTUAL_SHEAR_FIELDS='),
  'real G9 shear must be observed concurrently with strict material/world readiness and diagnosed on failure');
assert.ok(g9Capture.includes("lastProgress + 0.06")
  && g9Capture.includes("await sleep(1800)")
  && g9Capture.includes("director-clock-stalled")
  && g9Capture.includes("ANDROID_P28G9_REAL_DIRECTOR_SHEAR_PASS"),
  'slow WebGL2 Android emulators must be allowed actual director simulation time, not fake hazard state');
assert.ok(gameCanvas.includes('canvas.dataset.parallaxDirectorElapsed = directorRef.current.elapsed.toFixed(2)')
  && gameCanvas.includes('canvas.dataset.parallaxDirectorEventA = directorRef.current.locationEventA')
  && gameCanvas.includes('canvas.dataset.parallaxDirectorEventB = directorRef.current.locationEventB'),
  'real director timeline must remain observable without fake hazard state');

assert.ok(g9Capture.includes('ANDROID_P28G9_KTX2_DECK_VISIBLE_PASS')
  && g9Capture.includes('auditParallaxDeckRelief(decodeScreenshotPng(readFileSync(normalPath)))'),
  'G9 screenshot source must wait for actual deck pixels, not only asset telemetry');
assert.ok(g9Verify.includes('deck.normal.valid && deck.action.valid'),
  'G9 post-capture proof must reject flat normal and action decks');

// Synthetic frames are strict negative/positive unit controls, not visual proof.
// The production audit consumes untouched Android PNG pixels in both G9 jobs.
const deckWidth = 960, deckHeight = 450;
const plate = (textured: boolean) => {
  const pixels = new Uint8Array(deckWidth * deckHeight * 4);
  for (let y = 0; y < deckHeight; y++) for (let x = 0; x < deckWidth; x++) {
    const offset = (y * deckWidth + x) * 4;
    const engraved = textured && (Math.floor(x / 3) + Math.floor(y / 3)) % 2 === 0;
    const value = engraved ? 112 : 70;
    pixels[offset] = value;
    pixels[offset + 1] = value;
    pixels[offset + 2] = value;
    pixels[offset + 3] = 255;
  }
  return { width: deckWidth, height: deckHeight, pixels };
};
assert.equal(auditParallaxDeckRelief(plate(false)).valid, false,
  'flat material without uploaded normal-map relief must fail the deck gate');
assert.equal(auditParallaxDeckRelief(plate(true)).valid, true,
  'raised metrology calibration plate must pass the same pixel-edge criterion');

assert.ok(g9Shell.includes("grep -qE 'Error: P28-G9 CDP timeout: (Runtime|Page)\\.enable'"),
  'pre-frame Android CDP recovery must distinguish the observed Runtime/Page enable transport stalls');
assert.ok(g9Capture.includes("await call('Runtime.enable', {}, 60_000)")
  && g9Capture.includes("await call('Page.enable', {}, 60_000)")
  && g9Capture.includes("async function call(method, params = {}, timeoutMs = 25_000)"),
  'only cold CDP domain startup gets a longer bounded wait; gameplay calls retain 25s deadlines');
assert.ok(g9Shell.includes('ANDROID_P28G9_CDP_STARTUP_RELAUNCH attempt='),
  'pre-frame recovery must relaunch the real Android activity');
assert.ok(g9Shell.includes('if [[ ! -s android-p28g9-parallax-array-pixel-report.json ]]'),
  'once pixels exist, startup recovery must not waive content or native margin failures');
assert.ok(g9Shell.includes('r.provenance?.valid !== true') && g9Shell.includes('r.margins?.normal?.leftBrightPixels !== 144'),
  'native cutout relaunch must retain the exact proven-pixel restriction');

assert.ok(g9Workflow.includes('G9 Independent Copilot PNG Inspection'));
assert.ok(g9Workflow.includes('github.event.pull_request.head.sha'));
assert.ok(g9Workflow.includes('android-p28g9-parallax-array-action.png'));
assert.ok(g9Verify.includes('auditGameplayPair(normal, action)'));
const validG9Proof = {
  mapReentry: 'exit-to-command-and-redeploy:ready', capturedRoute: 'parallax-array', backend: 'webgl2',
  tier: 'high', captureMode: 'high-tier-qa-visual-only',
  assetIds: 'refinery-cover-crate-lod0', beforeAssetIds: 'refinery-cover-crate-lod0',
  beforeMappedObjects: 5, beforeAuthoredObjects: 5,
  mappedObjects: 5, authoredObjects: 5, fallbackObjects: 0,
  artState: 'ready', beforeArtState: 'ready', premium: 'ready', beforePremium: 'ready',
  premiumBindings: 40, ibl: 'shared-prefiltered:ready', beforeIbl: 'shared-prefiltered:ready',
  routeStyle: 'parallax-recessed-metrology-inlay', routeMaxWidth: 0.16,
  objectiveCue: 'beacon+navigation-path', worldObjects: 5,
  actionInput: 'manual-aim+live-touch-fire', shotsBefore: 2, shotsAfter: 5,
  surfaceDetail: 'reference-frame:3+shear-anchor:8+pylon-fiducial:27+frame-scale:30+carriage-stud:18+console-knob:9+anchor-insulator:8',
  hazardLanguage: 'shared-hazards+reference-shear+gravity-split+physical-baseline-alignment',
  referenceNodeIds: 'reference-node-a,reference-node-b,reference-node-c',
  shearTimeline: '8.0s:first-shear>19.0s:deep-reference-reversal',
};
assert.ok(auditParallaxVisualProvenance(validG9Proof).valid);
assert.ok(!auditParallaxVisualProvenance({ ...validG9Proof, premiumBindings: 0 }).valid);
assert.ok(!auditParallaxVisualProvenance({ ...validG9Proof, fallbackObjects: 1 }).valid);
assert.ok(!auditParallaxVisualProvenance({ ...validG9Proof, routeMaxWidth: 0.5 }).valid);
assert.ok(!auditParallaxVisualProvenance({ ...validG9Proof, shotsAfter: 2 }).valid);
assert.ok(!auditParallaxVisualProvenance({ ...validG9Proof, beforeAssetIds: 'late-object-lod0' }).valid);

assert.ok(presentation.includes('major ? calibrationInk : etched, 0, 1.02 + station * 0.36, 2.51,')
  && presentation.includes('calibrationInk, side * 0.76, 2.28, 2.31, 0.24, 2.92, 0.28);'),
  'physical pylon-facing graduation and insulated conductors need readable machined contrast');

assert.ok(presentation.includes('major ? calibrationInk : indexed, Math.cos(angle) * 1.38,')
  && presentation.includes('major ? 0.54 : 0.27, major ? 0.23 : 0.14, 0.17);'),
  'physical graduated pylon dial needs readable instrument-metal contrast');
assert.ok(presentation.includes('counterweightMetal, 0, 1.71, 0, 1.60, 0.82, 1.05);')
  && presentation.includes('shell, 0, 2.18, 0, 2.18, 0.14, 1.18);')
  && presentation.includes('shearCeramic, 0, 2.44, 0.52, 1.82, 0.32, 0.38);')
  && presentation.includes('graphite, side * 0.77, 1.61, 0.26, 0.24, 2.18, 0.48);'),
  'real exposed mass race and insulated fork must not revert to pale cargo-box silhouettes');
assert.ok(!presentation.includes('graphite, 2.15, 3.18, 2.04, 3.88, 2.24, 0.28);')
  && !presentation.includes('indexPlaque.position.set(3.27, 3.80, 2.50);'),
  'oversized central instrument billboard must remain off the active combat sightline');
assert.ok(babylon.includes('parallaxContrast ? colorFromHex(0xa6d8e8).scale(0.42)'),
  'Parallax-only actual enemy silhouette requires cool contact-fill');

// Original real PNG review found unreadable scale nubs and dark actor tells.
assert.ok(presentation.includes("new DynamicTexture('p28-g9-vertical-vernier-etched-metal-atlas'")
  && presentation.includes("vernierInk.fillText(String(station).padStart(2, '0'), 19, y + 11);")
  && presentation.includes("MeshBuilder.CreatePlane('p28-g9-pylon-camera-vernier-indexed-scale-' + index")
  && presentation.includes("verticalRuler.position.set(2.69, 2.32, 2.30);")
  && presentation.includes("verticalRuler.material = this.pylonVernierMaterial;")
  && presentation.includes("verticalRulerBed.rotation.y = Math.PI / 4;")
  && presentation.includes("rulerBrace.material = graphite;")
  && presentation.includes("this.pylonVernierMaterial.dispose();")
  && presentation.includes("this.pylonVernierTexture.dispose();"),
  'actual pylons need physical numbered verniers and managed GPU assets');
assert.ok(presentation.includes("'p28-g9-pylon-camera-vernier-fastener-' + index")
  && presentation.includes("p28-g9-pylon-camera-vernier-steel-mount-")
  && presentation.includes("0x45345f, 0.08, 0.92, 0x7862b7, 0.36")
  && presentation.includes("{ diameter: 2.48, thickness: 0.16, tessellation: 40 }"),
  'distinct shear anchor insulation and real elite attack ring must remain legible');
assert.ok(babylon.includes('parallaxContrast ? colorFromHex(0xa6d8e8).scale(0.42)')
  && babylon.includes('parallaxContrast ? 0.43')
  && babylon.includes('parallaxContrast ? 0.74')
  && babylon.includes('parallaxContrast ? 0.96'),
  'route-only actor contrast must improve without rewriting other scenario branches');
assert.ok(!presentation.includes('verticalRuler.position.set(3.8')
  && !presentation.includes("{ width: 3.56, height: 1.92 }"),
  'instrument must remain a bounded physical ruler rather than opaque HUD-sized billboard');

console.log('BABYLON_PARALLAX_ARRAY_PASS identity=baseline-pylons|metrology-composite|reference-violet|inertial-reference routes='
  + navigation.routes.length + ' landmarks=' + navigation.landmarks.map(item => item.label).join('|') + ' shear=8s>19s references=3');
