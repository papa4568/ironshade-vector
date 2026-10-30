import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  BABYLON_LATTICE_ANNEX_IDENTITY,
  BABYLON_LATTICE_ANNEX_LIGHTING,
  BABYLON_LATTICE_ANNEX_PREMIUM_SURFACES,
  latticeAnnexCalibrationMode,
  latticeAnnexRenderProfile,
  latticeAnnexShutterState,
} from '../src/game/babylonLatticeAnnexPresentation';
import { getMapNavigationPlan } from '../src/game/mapNavigation';
import { BABYLON_ROUTE_MARKING_WIDTHS } from '../src/game/babylonRouteMarkings';
import { auditLatticeVisualProvenance } from '../tools/p28g6-lattice-provenance.mjs';

const babylon = readFileSync('src/game/babylonCombatRenderer.ts', 'utf8');
const world = readFileSync('src/game/babylonWorldPresentation.ts', 'utf8');
const readiness = readFileSync('src/game/babylonRefineryMissionReadiness.ts', 'utf8');
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
const coarse = latticeAnnexRenderProfile(1, true);
const performance = latticeAnnexRenderProfile(0.5, false);
assert.equal(full.name, 'full');
assert.equal(full.referencePylonInstances, 9);
assert.equal(full.surveyFrameInstances, 6);
assert.equal(full.massBandInstances, 3);
assert.equal(coarse.name, 'full');
assert.equal(coarse.referencePylonInstances, 9);
assert.equal(coarse.surveyFrameInstances, 6);
assert.equal(coarse.massBandInstances, 3);
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

// P28-G6: source-anchored checks reject the previous single-material, ungrounded
// gallery and enforce actual KTX2/IBL readiness rather than a constant ready flag.
assert.equal(BABYLON_LATTICE_ANNEX_PREMIUM_SURFACES.join(','),
  'deck-plate,painted-metal,bare-metal,polymer-rubber,emissive-fixture');
for (const detail of [
  'p28-g6-pylon-indexed-collar-', 'p28-g6-pylon-scale-tick-',
  'p28-g6-pylon-dielectric-fin-', 'p28-g6-survey-diagonal-brace-',
  'p28-g6-survey-optic-rail-', 'p28-g6-metrology-dial-',
  'p28-g6-cradle-indexed-hinge-', 'p28-g6-survey-hall-upright-',
]) assert.ok(presentation.includes(detail), 'P28-G6 missing premium mechanical layer: ' + detail);
assert.ok(presentation.includes('this.premiumSurfaces = createBabylonPremiumPbrSurfaceLibrary(scene)'));
assert.ok(presentation.includes("new CubeTexture('/assets/environments/refinery-prefiltered.env'"));
assert.ok(presentation.includes('this.canvas.dataset.babylonEnvironmentState = premiumReady && this.iblReady'));
assert.ok(presentation.includes("this.canvas.dataset.latticePremiumBindings = String(this.premiumBindingCount)"));
assert.ok(presentation.includes('this.premiumSurfaces.dispose()'));
assert.ok(presentation.includes('this.iblTexture.dispose()'));
assert.ok(presentation.includes('this.groundingTexture.dispose()'));
assert.ok(presentation.includes('this.enemyGrounding.delete(id)'));
assert.ok(presentation.includes('this.referencePylons.slice(0, 5)'));
assert.ok(presentation.includes('contact.position.set(pylon.position.x, 0.042, pylon.position.z)'));
assert.ok(!presentation.includes('contact.position.set(worldW * fraction, 0.042, cz)'));

// Review-driven visual controls must keep metrology guides dim and
// telegraph warning teeth/actor contrast distinct, only in the Annex.
assert.ok(presentation.includes("pbr(scene, 'p27-c7-lattice-route-primary', 0x23403b, 0.08, 0.94"));
assert.ok(presentation.includes('scale(0.026 * routePulse)'));
assert.ok(presentation.includes('scale(0.012 * routePulse)'));
const dangerSource = readFileSync('src/game/babylonEnemyTelegraphs.ts', 'utf8');
assert.ok(dangerSource.includes('p28-g6-attack-warning-tick-'));
assert.ok(dangerSource.includes("this.canvas.dataset.babylonScenario === 'lattice-annex'"));
assert.ok(dangerSource.includes('for (const tick of visual.annexAttackTicks) tick.setEnabled(false)'));
const actorSource = readFileSync('src/game/babylonCombatRenderer.ts', 'utf8');
assert.ok(actorSource.includes("const annexContrast = this.canvas.dataset.babylonScenario === 'lattice-annex'"));
assert.ok(actorSource.includes("const annexActorLift = this.canvas.dataset.babylonScenario === 'lattice-annex'"));
assert.ok(presentation.includes('babylonRouteMarkingWidth(route.kind)'));
assert.ok(BABYLON_ROUTE_MARKING_WIDTHS.primary <= 0.20);
assert.ok(presentation.includes("this.canvas.dataset.babylonRouteMarkingMaxWidth = String(BABYLON_ROUTE_MARKING_WIDTHS.primary)"));
assert.ok(world.includes("|| mission.location === 'ice-mine' || mission.location === 'lattice-annex'"));
assert.ok(world.includes("|| mission.location === 'momentum-exchange' || mission.location === 'cryo-reserve';"));
assert.ok(readiness.includes("|| mission.location === 'ice-mine' || mission.location === 'lattice-annex'"));


const g6Proof = {
  capturedRoute: 'lattice-annex', backend: 'webgl2', tier: 'high', captureMode: 'high-tier-qa-visual-only',
  mapReentry: 'exit-to-command-and-redeploy:ready',
  assetIds: 'refinery-crate-lod0,refinery-pipe-rack-lod0', beforeAssetIds: 'refinery-crate-lod0,refinery-pipe-rack-lod0',
  mappedObjects: 8, authoredObjects: 8, fallbackObjects: 0,
  artState: 'ready', beforeArtState: 'ready', premium: 'ready', beforePremium: 'ready',
  premiumBindings: 80, ibl: 'shared-prefiltered:ready', beforeIbl: 'shared-prefiltered:ready',
  routeStyle: 'lattice-recessed-metrology-inlay', routeMaxWidth: 0.16,
  objectiveCue: 'beacon+navigation-path', worldObjects: 8, groundProps: 5,
  actionInput: 'manual-aim+live-touch-fire', shotsBefore: 0, shotsAfter: 1,
  surfaceDetail: 'reference-pylon:9+sample-cradle:3+indexed-collar:36+survey-brace:12+hall-upright:8',
  hazardLanguage: 'shared-hazards+calibration-mass-shift+gravity-well+calibration-shutters+reference-network',
};
assert.ok(auditLatticeVisualProvenance(g6Proof).valid);
for (const [id, bad, reason] of [
  ['route', { capturedRoute: 'ice-mine' }, 'wrong-map-or-backend'],
  ['reentry', { mapReentry: '' }, 'missing-map-reentry-proof'],
  ['fallback', { fallbackObjects: 1 }, 'procedural-box-or-unresolved-world-slot'],
  ['material', { premiumBindings: 10 }, 'missing-or-unready-premium-material'],
  ['ribbon', { routeMaxWidth: 0.4 }, 'oversized-route-material'],
  ['ground', { groundProps: 1 }, 'missing-survey-depth-or-grounding'],
  ['hazard', { hazardLanguage: 'none' }, 'missing-calibration-hazard-cues'],
  ['pop-in', { beforeArtState: 'loading' }, 'late-asset-pop-in'],
  ['no-fire', { shotsAfter: 0 }, 'no-real-combat-action'],
] as const) {
  const audit = auditLatticeVisualProvenance({...g6Proof, ...bad});
  assert.ok(!audit.valid && audit.problems.includes(reason), 'G6 invalid provenance accepted: ' + id);
}
const g6Capture = readFileSync('tools/android-p28g6-lattice-capture.mjs', 'utf8');
const g6Workflow = readFileSync('.github/workflows/p28-g6-lattice-visual-qa.yml', 'utf8');
assert.ok(g6Capture.includes('story.step = 13'));
assert.ok(g6Capture.includes("url.searchParams.set('p27d5Lifecycle', '1')"));
assert.ok(g6Capture.includes('ANDROID_P28G6_LATTICE_REENTRY_PASS'));
assert.ok(g6Capture.includes("await waitFor(ready, 'post-reentry Lattice Annex authored-world readiness'"));
assert.ok(g6Capture.includes("d?.babylonScenario === 'lattice-annex'"));
assert.ok(g6Capture.includes("d.latticePremiumAssetState === 'ready'"));
assert.ok(g6Capture.includes("d.missionVisualReadiness === 'ready'"));
assert.ok(g6Capture.includes("const shotsBefore = await evaluate"));
assert.ok(g6Capture.includes("const touch = async (type, id, x, y)"));
assert.ok(g6Capture.includes("actionInput: 'manual-aim+live-touch-fire', shotsBefore, shotsAfter"));
assert.ok(g6Workflow.includes('G6 Independent Copilot PNG Inspection'));
assert.ok(g6Workflow.includes('imagesActuallyViewed !== true'));
assert.ok(g6Workflow.includes('imagesActuallyViewed"\\s*:\\s*'), 'G6 hard-wrapped true token must be repaired narrowly');
const g5VisualReview = readFileSync('.github/workflows/p28-g5-ice-visual-qa.yml', 'utf8');
assert.ok(g5VisualReview.includes('imagesActuallyViewed"\\s*:\\s*'), 'G5 visual review must use the same strict boolean repair');
// A genuine line-wrapped token is recoverable; nearby dishonest tokens and
// false approvals must remain invalid. The main workflow still demands a
// full real-image review, PASS verdict and an empty issue list.
const normalizeViewed = (raw: string) => raw.replace(/("imagesActuallyViewed"\s*:\s*)(?:t\r?\n+rue|tr\r?\n+ue|tru\r?\n+e)(?=\s*[,}])/g, '$1true');
assert.equal(JSON.parse(normalizeViewed('{"imagesActuallyViewed":t\nrue}')).imagesActuallyViewed, true);
assert.throws(() => JSON.parse(normalizeViewed('{"imagesActuallyViewed":tr\\nxe}')));
assert.equal(JSON.parse(normalizeViewed('{"imagesActuallyViewed":false}')).imagesActuallyViewed, false);

assert.ok(g6Workflow.includes('actions/artifacts/$ARTIFACT_ID/zip'));
assert.ok(g6Workflow.includes('actual_name" = "$expected_name"'));
assert.ok(g6Workflow.includes("gh api \"/repos/$GITHUB_REPOSITORY/actions/artifacts/$ARTIFACT_ID\""));
const rendererImplementation = readFileSync('src/game/babylonCombatRenderer.ts', 'utf8');
assert.ok(rendererImplementation.includes('private latticeAnnexPresentation: BabylonLatticeAnnexPresentation | null = null'));
assert.ok(rendererImplementation.includes('this.latticeAnnexPresentation ??= new BabylonLatticeAnnexPresentation(this.scene, this.canvas, false)'));
assert.ok(!rendererImplementation.includes('this.latticeAnnexPresentation = new BabylonLatticeAnnexPresentation(scene, canvas, qualityCoarse)'));
assert.ok(rendererImplementation.includes("this.latticeAnnexPresentation?.release('scenario-switch')"));
assert.ok(rendererImplementation.includes('this.latticeAnnexPresentation?.dispose()'));
assert.ok(rendererImplementation.includes("const annexCombatPan = this.canvas.dataset.babylonScenario === 'lattice-annex' && !narrow ? 3.5 : 0"));
assert.ok(rendererImplementation.includes("const annexTouchLanePan = this.canvas.dataset.babylonScenario === 'lattice-annex' && !narrow ? 3.2 : 0"));
assert.ok(rendererImplementation.includes('px + cameraOffset + offsetX + annexCombatPan + annexTouchLanePan'));
assert.ok(rendererImplementation.includes('pz + cameraOffset + offsetZ + annexCombatPan - annexTouchLanePan'));
assert.ok(rendererImplementation.includes('pz + state.player.aim.y * 1.1 - offsetZ * 0.2 + annexCombatPan - annexTouchLanePan'));

const g6CaptureShell = readFileSync('tools/android-p28g6-lattice-capture.sh', 'utf8');
assert.ok(g6CaptureShell.includes('for attempt in 1 2 3; do'));
assert.ok(g6CaptureShell.includes('P28-G6 non-cutout failure is not retryable'));
assert.ok(g6CaptureShell.includes('r.provenance?.valid !== true'));
assert.ok(g6CaptureShell.includes('r.margins?.normal?.leftBrightPixels !== 144'));
assert.ok(g6CaptureShell.includes('r.margins?.action?.leftBrightPixels !== 144'));
assert.ok(g6CaptureShell.includes('run_gameplay_pair'));
assert.ok(g6CaptureShell.includes('CDP_ENDPOINT=http://127.0.0.1:9222 node tools/android-p28g6-lattice-capture.mjs || return $?'));
assert.ok(g6CaptureShell.includes('android-p28g6-lattice-annex-pixel-report.json android-p28g6-lattice-annex.json || return $?'));
assert.ok(g6Workflow.includes('P28-G6 early Android startup retry'));
assert.ok(g6Workflow.includes('test "$ok" = 1 && bash tools/android-p28g6-lattice-capture.sh'));
assert.ok(g6Workflow.includes('--attachment android-p28g6-lattice-annex-normal.png'));

for (const detail of [
  'p28-g6-pylon-optic-bezel-', 'p28-g6-pylon-exposed-glass-',
  'p28-g6-pylon-optic-reticle-', 'p28-g6-pylon-optic-axis-',
  'p28-g6-pylon-front-datum-rail-',
]) assert.ok(presentation.includes(detail), 'P28-G6 hidden/flat survey optic: ' + detail);
const g6Hud = readFileSync('src/combatHudGlance.css', 'utf8');
const g6Controls = readFileSync('src/components/GameCanvas.tsx', 'utf8');
assert.ok(g6Controls.includes('data-location={activeMission.location}'));
assert.ok(g6Hud.includes('.game-root[data-location="lattice-annex"] .touch-ability-fan .ability-0'));
assert.ok(g6Hud.includes('bottom: 172px;'));

console.log('BABYLON_LATTICE_ANNEX_PASS identity=reference-pylons|survey-ceramic|metrology-teal|calibration-service routes=' + navigation.routes.length + ' landmarks=' + navigation.landmarks.map(item => item.label).join('|') + ' calibration=10s-near-zero-g>20s-shutter-index boss=veyra-senn');
