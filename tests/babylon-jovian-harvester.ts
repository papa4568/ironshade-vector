import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BABYLON_JOVIAN_HARVESTER_IDENTITY,
  BABYLON_JOVIAN_HARVESTER_LIGHTING,
  BABYLON_JOVIAN_PREMIUM_SURFACES,
} from '../src/game/babylonJovianHarvesterPresentation';
import {
  jovianHarvesterRenderProfile,
  jovianHarvesterStormState,
} from '../src/game/jovianHarvesterVisualLanguage';
import { getMapNavigationPlan } from '../src/game/mapNavigation';
import { auditAuthoredVisualProvenance } from '../tools/p28g4-jovian-provenance.mjs';
import { createDefaultCampaign, generateStandardContracts } from '../src/game/campaign';
import { BABYLON_ROUTE_MARKING_WIDTHS } from '../src/game/babylonRouteMarkings';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const renderer = read('src/game/babylonCombatRenderer.ts');
const jovian = read('src/game/babylonJovianHarvesterPresentation.ts');
const world = read('src/game/babylonWorldPresentation.ts');
const browser = read('scripts/browser-runtime-smoke.mjs');
const workflow = read('.github/workflows/browser-e2e.yml');
const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };

assert(
  JSON.stringify(BABYLON_JOVIAN_HARVESTER_IDENTITY) === JSON.stringify({
    silhouette: 'skimmer-towers',
    material: 'weathered-condenser',
    lighting: 'storm-orange',
    propSet: 'compressor-service',
  }),
  'P27-C4 Babylon Jovian Harvester art identity must preserve the Three baseline.',
);


assert(
  BABYLON_JOVIAN_HARVESTER_LIGHTING.id === 'storm-orange'
    && BABYLON_JOVIAN_HARVESTER_LIGHTING.keyColor === 0xffc89a
    && BABYLON_JOVIAN_HARVESTER_LIGHTING.rimColor === 0xd59a57
    && BABYLON_JOVIAN_HARVESTER_LIGHTING.emergencyColor === 0xd46b45
    && BABYLON_JOVIAN_HARVESTER_LIGHTING.keyIntensity === 2.5
    && BABYLON_JOVIAN_HARVESTER_LIGHTING.rimIntensity === 1.18
    && BABYLON_JOVIAN_HARVESTER_LIGHTING.emergencyIntensity === 9.5
    && BABYLON_JOVIAN_HARVESTER_LIGHTING.exposure === 1.09,
  'P27-C4 Babylon Jovian Harvester lighting must retain the storm-orange Three profile.',
);


const fullProfile = jovianHarvesterRenderProfile(1, false);
const coarseProfile = jovianHarvesterRenderProfile(1, true);
const performanceProfile = jovianHarvesterRenderProfile(0.55, true);
assert(
  fullProfile.deckInstances === 6
    && fullProfile.towerInstances === 5
    && fullProfile.bridgeInstances === 4
    && fullProfile.ballastInstances === 4
    && coarseProfile.deckInstances === 6
    && coarseProfile.towerInstances === 5
    && coarseProfile.bridgeInstances === 4
    && coarseProfile.ballastInstances === 4
    && performanceProfile.name === 'performance'
    && performanceProfile.deckInstances === 4
    && performanceProfile.bridgeInstances === 2
    && performanceProfile.ballastInstances === 2,
  'P27-C4 Babylon environment must preserve flagship structure density for coarse input and degrade only with the adaptive render budget.',
);

const nominalStorm = jovianHarvesterStormState([1, 0.96], ['normal', 'normal'], false, false, false);
const ventingStorm = jovianHarvesterStormState([1, 0.25], ['normal', 'decompressing'], true, true, true);
assert(
  nominalStorm.mode === 'nominal'
    && ventingStorm.mode === 'venting'
    && ventingStorm.venting
    && ventingStorm.intensity > nominalStorm.intensity
    && ventingStorm.pressureShear > nominalStorm.pressureShear,
  'P27-C4 Babylon storm language must remain driven by shared pressure/breach state.',
);

const navigation = getMapNavigationPlan('jovian-harvester');
assert(
  navigation.routes.length >= 6
    && navigation.routes.some(route => route.kind === 'primary' && route.id === 'primary-spine')
    && navigation.landmarks.map(item => item.label).join('|') === 'PRESSURE LOCK|SKIMMER DECK|COMPRESSOR CROWN',
  'P27-C4 Jovian Harvester must retain deterministic navigation and all three landmarks.',
);

assert(
  jovian.includes("getMapNavigationPlan('jovian-harvester')")
    && jovian.includes("environmentVisual = 'procedural-jovian-harvester-babylon'")
    && jovian.includes("environmentLandmark = 'five-skimmer-tower-spine'")
    && jovian.includes("environmentComposition = 'elevated-skimmer-decks+five-tower-spine+transfer-bridges+ballast-pods'")
    && jovian.includes("environmentStormLanguage = 'storm-charge-sweeps+pressure-shear-bands+relief-pulse'")
    && jovian.includes("environmentStormSource = 'live-sector-pressure+service-breach+contract-conditions'")
    && jovian.includes("environmentAmbient = 'upper-haze+pressure-clouds+charged-particulate'")
    && jovian.includes("interactableKit = 'storm-bus-isolator+deck-mass-trim+skimmer-compressor+separator-package'")
    && jovian.includes("interactablePressureKit = 'storm-pressure-lock+relief-manifold'")
    && jovian.includes("bossPresentation = 'stormline-foreman-ilex'")
    && jovian.includes("bossCue = 'storm-ring+pressure-crown+relief-stacks'")
    && jovian.includes("locationArtIdentity = 'skimmer-towers|weathered-condenser|storm-orange|compressor-service'")
    && jovian.includes("babylonJovianParity = 'architecture+weather+storm-pressure+props+interactables+navigation+boss-cues+shared-world-cues'"),
  'P27-C4 Babylon Jovian Harvester must expose architecture, storm/pressure, machinery, navigation, boss cues, and parity telemetry.',
);

assert(
  renderer.includes("const jovianHarvesterScenario = mission.location === 'jovian-harvester';")
    && renderer.includes("this.canvas.dataset.babylonScenario = mission.location;")
    && renderer.includes('this.worldPresentation.sync(state, mission, budget.detailScale);')
    && renderer.includes("this.jovianHarvesterPresentation.sync(")
    && renderer.includes("mission.conditions.includes('unstable-pressure')")
    && renderer.includes("mission.conditions.includes('damaged-grid')")
    && renderer.includes("this.spinHabitatPresentation.release('scenario-switch');")
    && renderer.includes("this.refineryPostProcessing.release('scenario-switch');"),
  'P27-C4 renderer must run Jovian Harvester through shared Babylon gameplay cues while keeping location presentations isolated.',
);

assert(
  world.includes('biomeWorldState(mission.location, state)')
    && world.includes('this.syncObjects(state, detailScale);')
    && world.includes('this.syncHazards(')
    && world.includes('this.syncObjective(')
    && world.includes('this.syncGroundLoot(state, detailScale);')
    && world.includes('this.syncBreaches('),
  'P27-C4 shared Babylon world presentation must retain interactables, hazards, objectives, loot, breaches, and location state cues.',
);

assert(
  browser.includes('BROWSER_P27C4_BABYLON_JOVIAN_HARVESTER_PASS')
    && workflow.includes('BROWSER_E2E_GRAPHICS_PATH=babylon BROWSER_E2E_LOCATION=jovian-harvester'),
  'P27-C4 must remain covered by the headed Babylon browser route on desktop and mobile-landscape.',
);

assert(
  pkg.scripts?.['test:babylon-jovian-harvester']?.includes('tests/babylon-jovian-harvester.ts')
    && pkg.scripts?.build?.includes('npm run test:babylon-jovian-harvester'),
  'P27-C4 unit/source regression must be wired into the full production build.',
);


const readiness = read('src/game/babylonRefineryMissionReadiness.ts');
assert(
  BABYLON_JOVIAN_PREMIUM_SURFACES.join(',') === 'deck-plate,painted-metal,bare-metal,polymer-rubber,emissive-fixture'
    && jovian.includes("this.premiumSurfaces = createBabylonPremiumPbrSurfaceLibrary(scene)")
    && jovian.includes("new CubeTexture('/assets/environments/refinery-prefiltered.env'")
    && jovian.includes("this.canvas.dataset.jovianPremiumAssetState = premiumReady ? 'ready' : 'loading'")
    && jovian.includes("this.canvas.dataset.jovianPremiumBindings = String(this.premiumBindingCount)")
    && jovian.includes('this.premiumSurfaces.dispose()')
    && jovian.includes('this.iblTexture.dispose()'),
  'P28-G4 Jovian industrial materials must use shipped KTX2 PBR textures and live shared IBL with cleanup.',
);
assert(
  ['p28-g4-deck-inset-rail-', 'p28-g4-deck-cross-shoe-', 'p28-g4-skimmer-condenser-collar-',
    'p28-g4-skimmer-braced-condenser-', 'p28-g4-skimmer-storm-duct-', 'p28-g4-bridge-cable-tray-',
    'p28-g4-bridge-lattice-foot-', 'p28-g4-ballast-pressure-collar-', 'p28-g4-ballast-saddle-']
    .every(name => jovian.includes(name))
    && jovian.includes('babylonRouteMarkingWidth(route.kind)')
    && BABYLON_ROUTE_MARKING_WIDTHS.primary <= 0.2
    && !jovian.includes("scaled(route.kind === 'primary' ? 72")
    && jovian.includes('this.groundingSource.createInstance')
    && jovian.includes('this.enemyGrounding.delete(id)')
    && jovian.includes('this.groundingTexture.dispose()'),
  'P28-G4 industrial depth, grounding and recessed route guides cannot regress to bare boxes or broad route bands.',
);
assert(
  world.includes("|| mission.location === 'spin-habitat' || mission.location === 'jovian-harvester'")
    && readiness.includes("|| mission.location === 'spin-habitat' || mission.location === 'jovian-harvester'")
    && jovian.includes("this.canvas.dataset.jovianPremiumAssetState = premiumReady ? 'ready' : 'loading'")
    && jovian.includes("this.canvas.dataset.jovianPremiumBindings = String(this.premiumBindingCount)")
    && readiness.includes("mission.location === 'jovian-harvester'")
    && world.includes("mission.location === 'jovian-harvester'"),
  'P28-G4 must block entry until authored LOD0 world, all premium maps, IBL and real gameplay cues are ready.',
);
assert(
  jovian.includes('this.stormChargeSweeps.forEach(')
    && jovian.includes('this.pressureShearBands.forEach(')
    && jovian.includes('this.reliefMaterial.alpha')
    && jovian.includes("this.canvas.dataset.environmentStormSource = 'live-sector-pressure+service-breach+contract-conditions'")
    && jovian.includes('this.bossCueRoot.setEnabled(Boolean(activeBoss))'),
  'P28-G4 must preserve storm and relief hazard precedence and live boss-state visuals.',
);


const jovianRotation = generateStandardContracts({ ...createDefaultCampaign(), cycle: 2 });
assert(
  jovianRotation.some(contract => contract.location === 'jovian-harvester')
    && !generateStandardContracts({ ...createDefaultCampaign(), cycle: 1 })
      .some(contract => contract.location === 'jovian-harvester'),
  'P28-G4 Android visual QA must use the actual cycle-two rotating Jovian contract rather than the cycle-one Spin precondition.',
);

// G4's real API 35 capture is consumed by the same fail-closed pixel/provenance
// gate as G2/G3; preserve negative controls for every new map-specific bound.
const jovianProvenance = {
  capturedRoute: 'jovian-harvester', backend: 'webgl2',
  tier: 'high', captureMode: 'high-tier-qa-visual-only',
  assetIds: 'refinery-crate-lod0,refinery-pipe-rack-lod0',
  beforeAssetIds: 'refinery-crate-lod0,refinery-pipe-rack-lod0',
  mappedObjects: 18, authoredObjects: 18, fallbackObjects: 0,
  artState: 'ready', beforeArtState: 'ready',
  premium: 'ready', beforePremium: 'ready', premiumBindings: 141,
  ibl: 'shared-prefiltered:ready', beforeIbl: 'shared-prefiltered:ready',
  routeStyle: 'jovian-recessed-deck-inlay', routeMaxWidth: 0.16,
  objectiveCue: 'beacon+navigation-path', worldObjects: 18, groundProps: 4,
};
assert(auditAuthoredVisualProvenance(jovianProvenance).valid,
  'P28-G4 real Android provenance must pass the shared independent audit.');
for (const [name, mutation, expectedProblem] of [
  ['wrong-backend', { backend: 'webgl' }, 'wrong-map-or-backend'],
  ['downshift', { tier: 'performance' }, 'not-authored-lod0-flagship-visual'],
  ['fallback-world', { fallbackObjects: 1 }, 'procedural-box-or-unresolved-world-slot'],
  ['missing-premium', { premiumBindings: 79 }, 'missing-or-unready-premium-material'],
  ['broad-route', { routeMaxWidth: 0.21 }, 'oversized-route-material'],
  ['missing-contact', { groundProps: 3 }, 'missing-asset-provenance'],
  ['late-pop-in', { beforeArtState: 'loading' }, 'late-asset-pop-in'],
] as const) {
  const audit = auditAuthoredVisualProvenance({ ...jovianProvenance, ...mutation });
  assert(!audit.valid && audit.problems.includes(expectedProblem),
    'P28-G4 provenance negative control admitted ' + name);
}

const androidWorkflow = read('.github/workflows/p28-g4-jovian-visual-qa.yml');
const g4FrameHelper = read('tools/p28g4-android-frame.mjs');
const androidCapture = read('tools/android-p28g4-jovian-capture.mjs');
const androidShell = read('tools/android-p28g4-jovian-capture.sh');
const androidVerifier = read('tools/verify-p28g4-gameplay-frames.mjs');
const captureHelper = read('scripts/android-quickstep-frame-recovery.mjs');
assert(
  androidCapture.includes('state.campaign.cycle = 2')
    && androidCapture.includes('campaign.cycle = 2')
    && androidCapture.includes("d?.babylonScenario === 'jovian-harvester'")
    && androidCapture.includes("d.jovianPremiumAssetState === 'ready'")
    && androidCapture.includes("Number(d.jovianPremiumBindings || 0) >= 80")
    && androidCapture.includes("d.environmentIbl === 'shared-prefiltered:ready'")
    && androidCapture.includes("d.environmentStormSource === 'live-sector-pressure+service-breach+contract-conditions'")
    && androidCapture.includes("d.babylonSharedWorldArtState === 'ready'")
    && androidCapture.includes("d.missionVisualReadiness === 'ready'")
    && androidCapture.includes("Number(d.babylonRouteMarkingMaxWidth) <= 0.20")
    && androidCapture.includes("Number(d.babylonSharedWorldFallbackCount || 0) === 0")
    && androidCapture.includes("captureAcceptedG4Frame(path, 'P28-G4')")
    && g4FrameHelper.includes("captureVerifiedAndroidGameplay(path, label)")
    && g4FrameHelper.includes("auditGameplayFrame(decodeScreenshotPng(png))")
    && g4FrameHelper.includes("needsQuickstepRecovery(frame)")
    && g4FrameHelper.includes("if (verdict === 'reject') throw new Error")
    && androidShell.includes('await captureAcceptedG4Frame("android-p28g4-jovian-harvester-device.png"')

    && androidWorkflow.includes('ANDROID_SMOKE_APK=Ironshade-Vector-Android-Smoke.apk bash scripts/android-fast-smoke.sh')
    && androidCapture.includes('const target = await waitForTarget()')
    && androidCapture.includes('WebView target was replaced during startup')
    && androidCapture.includes("waitFor('location.href', 'initial cold WebView URL', 120_000)")
    && androidCapture.split(String.fromCharCode(10)).includes("  const current = await waitFor('location.href', 'initial cold WebView URL', 120_000);")
    && androidShell.includes('trap capture_diagnostics EXIT')
    && androidShell.includes('android-p28g4-jovian-harvester-activity.txt')
    && androidCapture.includes('before === result.playerPosition')
    && captureHelper.includes("execFileSync('adb', ['exec-out', 'screencap', '-p']")
    && captureHelper.includes('auditGameplayFrame(decodeScreenshotPng(png))')
    && captureHelper.includes('writeFileSync(path, png)')
    && captureHelper.includes('!dismissObservedQuickstepDialog()')
    && androidVerifier.includes('auditGameplayPair(')
    && androidVerifier.includes('auditAuthoredVisualProvenance(')
    && androidVerifier.includes("state.capturedRoute !== 'jovian-harvester'")
    && androidShell.includes('CDP_ENDPOINT=http://127.0.0.1:9222 node tools/android-p28g4-jovian-capture.mjs')
    && androidShell.includes('adb exec-out screencap -p')
    && androidWorkflow.includes('bash tools/android-p28g4-jovian-capture.sh')
    && androidWorkflow.includes('android-p28g4-jovian-harvester-pixel-report.json'),
  'P28-G4 requires actual APK Android screenshots, independent pixel/provenance audit and storm-readability contract.',
);

console.log('BABYLON_JOVIAN_HARVESTER_PASS identity=skimmer-towers+weathered-condenser+storm-orange+compressor-service storm=shared-pressure navigation=shared boss=stormline-foreman-ilex world=shared-cues browser=headed');
