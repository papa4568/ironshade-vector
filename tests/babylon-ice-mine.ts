import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BABYLON_ICE_MINE_IDENTITY,
  BABYLON_ICE_MINE_LIGHTING,
  iceMineFractureBudget,
} from '../src/game/babylonIceMinePresentation';
import { getMapNavigationPlan } from '../src/game/mapNavigation';

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
const mobileFracture = iceMineFractureBudget(true, 1);
assert(
  fullFracture.shardBudget === 8
    && fullFracture.crackBudget === 3
    && fullFracture.detail === '8-shards+3-cracks+frost-pulse'
    && mobileFracture.shardBudget === 4
    && mobileFracture.crackBudget === 2
    && mobileFracture.detail === '4-shards+2-cracks+frost-pulse',
  'P27-C5 Babylon fracture cues must preserve the Three desktop/mobile budgets.',
);

const navigation = getMapNavigationPlan('ice-mine');

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

console.log('BABYLON_ICE_MINE_PASS identity=bore-crystals+frosted-industrial+ice-cyan+drill-service fracture=state-linked navigation=shared boss=rhea-kade world=shared-cues browser=headed');
