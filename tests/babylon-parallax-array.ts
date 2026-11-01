import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  BABYLON_PARALLAX_ARRAY_IDENTITY,
  BABYLON_PARALLAX_ARRAY_LIGHTING,
  BABYLON_PARALLAX_PREMIUM_SURFACES,
  parallaxArrayRenderProfile,
  parallaxReferenceState,
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
]) assert.ok(presentation.includes(detail), 'Parallax silhouette must expose calibrated hardware: ' + detail);
assert.ok(presentation.includes('floor.emissiveColor = colorFromHex(0x42566f).scale(0.10)'),
  'PBR floor relief needs restrained bounce fill at gameplay zoom');
assert.ok(presentation.includes('0.94) : 0'), 'Parallax normal-quality PBR needs nonblack IBL');
assert.ok(telegraphs.includes("const parallaxWarning = this.canvas.dataset.babylonScenario === 'parallax-array'"));
assert.ok(telegraphs.includes('parallaxWarning ? 0.12 : 0.14'), 'Parallax warning lanes must remain transparent');
assert.ok(telegraphs.includes('parallaxWarning ? 0.74 : iceWarning ? 0.72 : 1'), 'Parallax combat lanes must not become wide route ribbons');
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
assert.ok(babylon.includes('momentumTouchLanePan + parallaxTouchLanePan'),
  'Parallax camera should translate eye and target without changing simulation');
assert.ok(hudGlance.includes('.game-root[data-location="parallax-array"] .transient-alert-lane.event .combat-alert b'),
  'Parallax tactical alert lane must have a route-scoped mobile treatment');
assert.ok(hudGlance.includes('P28-G9/G7 exact-APK review')
  && hudGlance.includes('background: rgba(5, 11, 17, .78)'),
  'both compact tactical callouts must leave machinery and combat space visible');
const gameCanvas = readFileSync('src/components/GameCanvas.tsx', 'utf8');
for (const cue of ['ALIGN 3 REFERENCE PYLONS', 'SHEAR FRONT LIVE // REFERENCES DISAGREE',
  'CAPTURE MOMENTUM TRANSFER DRUMS', 'COUNTERMASS FRONT LIVE']) {
  assert.ok(gameCanvas.includes(cue), 'Parallax/Momentum route events need concise readable messages: ' + cue);
}
assert.ok(gameCanvas.includes("MASS-WELL LOCK LIVE"), 'Momentum event must fit a safe upper-HUD gap');
assert.ok(hudGlance.includes('P28-G9 real Android proof: reserve the *unoccupied top status roof*'),
  'Parallax and Momentum tactical alerts must not overlap gameplay floor/rails');
assert.ok(gameCanvas.includes("aria-label={hud.eventT > 0 && !bossTransitionCue && !deploymentCueVisible ? hud.eventText : undefined}"),
  'compact alerts must preserve the full original director announcement for accessibility');

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
assert.ok(readiness.includes("|| mission.location === 'parallax-array');"));
for (const detail of [
  'p28-g9-pylon-fiducial-', 'p28-g9-pylon-conductor-', 'p28-g9-frame-scale-',
  'p28-g9-carriage-stud-', 'p28-g9-anchor-insulator-', 'p28-g9-console-knob-',
]) assert.ok(presentation.includes(detail), 'missing Parallax calibrated geometry: ' + detail);
assert.ok(presentation.includes("Math.min(babylonRouteMarkingWidth(route.kind)"));
assert.ok(presentation.includes("this.canvas.dataset.babylonRouteMarkingMaxWidth = String(BABYLON_ROUTE_MARKING_WIDTHS.primary)"));
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
  && g9Capture.includes("await waitFor(readyWithLiveShear, 'post-reentry visually-ready director-authored shear'")
  && g9Capture.includes('P28G9_ACTUAL_SHEAR_FIELDS='),
  'real G9 shear must be observed concurrently with strict material/world readiness and diagnosed on failure');
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

assert.ok(g9Shell.includes("grep -qF 'Error: P28-G9 CDP timeout: Runtime.enable'"),
  'pre-frame Android CDP recovery must identify the exact observed transport failure');
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

console.log('BABYLON_PARALLAX_ARRAY_PASS identity=baseline-pylons|metrology-composite|reference-violet|inertial-reference routes='
  + navigation.routes.length + ' landmarks=' + navigation.landmarks.map(item => item.label).join('|') + ' shear=8s>19s references=3');
