import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BABYLON_ICE_MINE_IDENTITY,
  BABYLON_ICE_MINE_LIGHTING,
  BABYLON_ICE_MINE_PREMIUM_SURFACES,
  iceMineFractureBudget,
} from '../src/game/babylonIceMinePresentation';
import { getMapNavigationPlan } from '../src/game/mapNavigation';
import { BABYLON_ROUTE_MARKING_WIDTHS } from '../src/game/babylonRouteMarkings';
import { createDefaultCampaign, generateStandardContracts } from '../src/game/campaign';
import { auditAuthoredVisualProvenance } from '../tools/p28g5-ice-provenance.mjs';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const renderer = read('src/game/babylonCombatRenderer.ts');
const ice = read('src/game/babylonIceMinePresentation.ts');
const world = read('src/game/babylonWorldPresentation.ts');
const browser = read('scripts/browser-runtime-smoke.mjs');
const workflow = read('.github/workflows/browser-e2e.yml');
const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };

assert(
  JSON.stringify(BABYLON_ICE_MINE_IDENTITY) === JSON.stringify({
    silhouette: 'bore-crystals',
    material: 'frosted-industrial',
    lighting: 'ice-cyan',
    propSet: 'drill-service',
  }),
  'P27-C5 Babylon Ice Mine art identity must preserve the Three baseline.',
);


assert(
  BABYLON_ICE_MINE_LIGHTING.id === 'ice-cyan'
    && BABYLON_ICE_MINE_LIGHTING.keyColor === 0xd2e7ef
    && BABYLON_ICE_MINE_LIGHTING.rimColor === 0x7ec9df
    && BABYLON_ICE_MINE_LIGHTING.emergencyColor === 0x76cde9
    && BABYLON_ICE_MINE_LIGHTING.keyIntensity === 2.1
    && BABYLON_ICE_MINE_LIGHTING.rimIntensity === 1.1
    && BABYLON_ICE_MINE_LIGHTING.emergencyIntensity === 8
    && BABYLON_ICE_MINE_LIGHTING.exposure === 1.08,
  'P27-C5 Babylon Ice Mine lighting must retain the ice-cyan Three profile.',
);


const fullFracture = iceMineFractureBudget(false, 1);
const coarseFracture = iceMineFractureBudget(true, 1);
const reducedFracture = iceMineFractureBudget(true, 0.54);
assert(
  fullFracture.shardBudget === 8
    && fullFracture.crackBudget === 3
    && fullFracture.detail === '8-shards+3-cracks+frost-pulse'
    && coarseFracture.shardBudget === 8
    && coarseFracture.crackBudget === 3
    && coarseFracture.detail === '8-shards+3-cracks+frost-pulse'
    && reducedFracture.shardBudget === 4
    && reducedFracture.crackBudget === 2
    && reducedFracture.detail === '4-shards+2-cracks+frost-pulse',
  'P27-C5 Babylon fracture cues must retain flagship density for coarse input and reduce only under the adaptive VFX budget.',
);

const navigation = getMapNavigationPlan('ice-mine');
assert(
  navigation.routes.length >= 6
    && navigation.routes.some(route => route.kind === 'primary' && route.id === 'primary-spine')
    && navigation.landmarks.map(item => item.label).join('|') === 'ACCESS BORE|EXTRACTION TUNNEL|SUBGLACIAL VAULT',
  'P27-C5 Ice Mine must retain deterministic navigation and all three landmarks.',
);

assert(
  ice.includes("environmentVisual = 'procedural-ice-mine-babylon'")
    && ice.includes("environmentLandmark = 'subglacial-vault-ice-pillars'")
    && ice.includes("environmentComposition = 'access-bore+reinforced-extraction-tunnel+subglacial-vault'")
    && ice.includes("environmentTunnelSequence = 'access-bore>extraction-tunnel>subglacial-vault'")
    && ice.includes("environmentMachineDetail = 'cryo-pump:2+coolant-manifold:3+freeze-compressor:2'")
    && ice.includes("environmentBrittleSupportIds = BRITTLE_SUPPORT_IDS.join(',')")
    && ice.includes("environmentFractureVfx = 'support-cracks+shard-burst+frost-pulse'")
    && ice.includes("environmentHazardLanguage = 'shared-hazards+brittle-support-fracture'")
    && ice.includes("bossPresentation = 'rhea-kade'")
    && ice.includes("bossSilhouette = 'bore-cowl+cryo-tanks+fracture-ram'")
    && ice.includes("bossCue = 'fracture-ring+cryo-halo+fracture-ram'")
    && ice.includes("locationArtIdentity = 'bore-crystals|frosted-industrial|ice-cyan|drill-service'")
    && ice.includes("babylonIceMineParity = 'architecture+frost-materials+props+interactables+hazards+fracture+navigation+boss-cues+shared-world-cues'"),
  'P27-C5 Babylon Ice Mine must expose architecture, frost materials, machinery, fracture hazards, navigation, boss cues, and parity telemetry.',
);

assert(
  renderer.includes("const iceMineScenario = mission.location === 'ice-mine';")
    && renderer.includes("this.canvas.dataset.babylonScenario = mission.location;")
    && renderer.includes('this.worldPresentation.sync(state, mission, budget.detailScale);')
    && renderer.includes('this.iceMinePresentation.sync(')
    && renderer.includes("this.jovianHarvesterPresentation.release('scenario-switch');")
    && renderer.includes("this.iceMinePresentation.release('scenario-switch');"),
  'P27-C5 renderer must run Ice Mine through shared Babylon gameplay cues while keeping location presentations isolated.',
);

assert(
  world.includes('biomeWorldState(mission.location, state)')
    && world.includes('this.syncObjects(state, detailScale);')
    && world.includes('this.syncHazards(')
    && world.includes('this.syncObjective(')
    && world.includes('this.syncGroundLoot(state, detailScale);')
    && world.includes('this.syncBreaches('),
  'P27-C5 shared Babylon world presentation must retain interactables, hazards, objectives, loot, breaches, and location state cues.',
);

assert(
  browser.includes('BROWSER_P27C5_BABYLON_ICE_MINE_PASS')
    && workflow.includes('BROWSER_E2E_GRAPHICS_PATH=babylon BROWSER_E2E_LOCATION=ice-mine'),
  'P27-C5 must be covered by the headed Babylon browser route on desktop and mobile-landscape.',
);

assert(
  pkg.scripts?.['test:babylon-ice-mine']?.includes('tests/babylon-ice-mine.ts')
    && pkg.scripts?.build?.includes('npm run test:babylon-ice-mine'),
  'P27-C5 unit/source regression must be wired into the full production build.',
);

const readiness = read('src/game/babylonRefineryMissionReadiness.ts');
assert(
  BABYLON_ICE_MINE_PREMIUM_SURFACES.join(',') === 'deck-plate,painted-metal,bare-metal,polymer-rubber,emissive-fixture'
    && ice.includes('this.premiumSurfaces = createBabylonPremiumPbrSurfaceLibrary(scene)')
    && ice.includes("new CubeTexture('/assets/environments/refinery-prefiltered.env'")
    && ice.includes('ice.subSurface.isTranslucencyEnabled = true')
    && ice.includes('ice.clearCoat.roughness = 0.15')
    && ice.includes("this.canvas.dataset.babylonEnvironmentState = premiumReady && this.iblReady ? 'ready' : 'loading'")
    && ice.includes('this.premiumSurfaces.dispose()')
    && ice.includes('this.iblTexture.dispose()'),
  'P28-G5 must deliver premium KTX2/IBL readiness, frosted translucency and owned resource cleanup.',
);
assert(
  ['p28-g5-frost-wall-strata-', 'p28-g5-frost-wall-buttress-', 'p28-g5-frame-diagonal-brace-',
    'p28-g5-service-recessed-rail-', 'p28-g5-service-deck-crossbar-', 'p28-g5-cryo-pump-collar-',
    'p28-g5-manifold-feed-', 'p28-g5-compressor-cooling-bank-', 'p28-g5-ice-pillar-facet-seam-']
    .every(name => ice.includes(name))
    && ice.includes('babylonRouteMarkingWidth(route.kind)')
    && BABYLON_ROUTE_MARKING_WIDTHS.primary <= 0.20
    && !ice.includes("scaled(route.kind === 'primary' ? 72")
    && ice.includes('this.groundingSource.createInstance')
    && ice.includes('this.enemyGrounding.delete(id)')
    && ice.includes('this.groundingTexture.dispose()'),
  'P28-G5 scene depth, grounding and narrow route inlays must not regress.',
);
assert(
  world.includes("|| mission.location === 'ice-mine';")
    && readiness.includes("|| mission.location === 'ice-mine');")
    && ice.includes('this.syncBrittleSupports(state, renderBudget)')
    && ice.includes('this.fracturePulses.set(id, pulse)')
    && ice.includes('this.bossCueRoot.setEnabled(Boolean(activeBoss))'),
  'P28-G5 must await shared-world authored LOD0 and retain live fracture/boss hazard cues.',
);
const iceRotation = generateStandardContracts({ ...createDefaultCampaign(), cycle: 3 });
assert(iceRotation.some(contract => contract.location === 'ice-mine')
    && !generateStandardContracts({ ...createDefaultCampaign(), cycle: 2 }).some(contract => contract.location === 'ice-mine'),
  'P28-G5 Android visual QA must use the actual cycle-three rotating Ice Mine contract.');
const proof = {
  capturedRoute: 'ice-mine', backend: 'webgl2', tier: 'high', captureMode: 'high-tier-qa-visual-only',
  assetIds: 'refinery-crate-lod0,refinery-pipe-rack-lod0',
  beforeAssetIds: 'refinery-crate-lod0,refinery-pipe-rack-lod0',
  mappedObjects: 16, authoredObjects: 16, fallbackObjects: 0,
  artState: 'ready', beforeArtState: 'ready', premium: 'ready', beforePremium: 'ready',
  premiumBindings: 100, ibl: 'shared-prefiltered:ready', beforeIbl: 'shared-prefiltered:ready',
  routeStyle: 'ice-recessed-bore-inlay', routeMaxWidth: 0.16,
  objectiveCue: 'beacon+navigation-path', worldObjects: 16, groundProps: 4,
  fractureLanguage: 'shared-hazards+brittle-support-fracture',
};
assert(auditAuthoredVisualProvenance(proof).valid, 'P28-G5 legitimate Ice Mine provenance must pass.');
for (const [name, change, expected] of [
  ['wrong-route', {capturedRoute: 'jovian-harvester'}, 'wrong-map-or-backend'],
  ['fallback', {fallbackObjects: 1}, 'procedural-box-or-unresolved-world-slot'],
  ['premium', {premiumBindings: 39}, 'missing-or-unready-premium-material'],
  ['route-band', {routeMaxWidth: 0.24}, 'oversized-route-material'],
  ['fracture', {fractureLanguage: 'no-fracture'}, 'missing-fracture-cue'],
  ['late-pop-in', {beforeArtState: 'loading'}, 'late-asset-pop-in'],
] as const) {
  const audit = auditAuthoredVisualProvenance({ ...proof, ...change });
  assert(!audit.valid && audit.problems.includes(expected), 'P28-G5 negative control admitted ' + name);
}


// Exact-APK normal/action proof must exercise genuine Ice Mine cycle-three
// deployment and reject missing textures, fallback slots and pale route bands.
const capture = read('tools/android-p28g5-ice-capture.mjs');
const workflow = read('.github/workflows/p28-g5-ice-visual-qa.yml');
const shell = read('tools/android-p28g5-ice-capture.sh');
const verifier = read('tools/verify-p28g5-gameplay-frames.mjs');
assert(
  capture.includes('state.campaign.cycle = 3')
    && capture.includes("d?.babylonScenario === 'ice-mine'")
    && capture.includes("d.icePremiumAssetState === 'ready'")
    && capture.includes("Number(d.icePremiumBindings || 0) >= 80")
    && capture.includes("d.environmentIbl === 'shared-prefiltered:ready'")
    && capture.includes("d.environmentHazardLanguage === 'shared-hazards+brittle-support-fracture'")
    && capture.includes("d.babylonSharedWorldArtState === 'ready'")
    && capture.includes("d.missionVisualReadiness === 'ready'")
    && capture.includes("Number(d.babylonRouteMarkingMaxWidth) <= 0.20")
    && shell.includes('android-p28g5-ice-normal.png')
    && verifier.includes('auditGameplayPair')
    && workflow.includes('ironshade-vector-pr-android-apk')
    && workflow.includes('github.event.pull_request.head.sha'),
  'P28-G5 exact-APK Ice Mine proof must enforce real textures/LOD0/route/frame content.');

console.log('BABYLON_ICE_MINE_PASS identity=bore-crystals+frosted-industrial+ice-cyan+drill-service fracture=state-linked navigation=shared boss=rhea-kade world=shared-cues browser=headed');
