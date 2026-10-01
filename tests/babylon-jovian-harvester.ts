import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BABYLON_JOVIAN_HARVESTER_IDENTITY,
  BABYLON_JOVIAN_HARVESTER_LIGHTING,
} from '../src/game/babylonJovianHarvesterPresentation';
import {
  jovianHarvesterRenderProfile,
  jovianHarvesterStormState,
} from '../src/game/jovianHarvesterVisualLanguage';
import { getMapNavigationPlan } from '../src/game/mapNavigation';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const renderer = read('src/game/babylonCombatRenderer.ts');
const jovian = read('src/game/babylonJovianHarvesterPresentation.ts');
const three = read('src/game/hardSciFiVisuals.ts');
const threeRenderer = read('src/game/threeCombatRenderer.ts');
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
  three.includes("'jovian-harvester': { silhouette: 'skimmer-towers', material: 'weathered-condenser', lighting: 'storm-orange', propSet: 'compressor-service' }"),
  'P27-C4 source baseline for Jovian Harvester identity changed without updating the Babylon port.',
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

assert(
  threeRenderer.includes("'jovian-harvester': { id: 'storm-orange', keyColor: 0xffc89a, rimColor: 0xd59a57, emergencyColor: 0xd46b45, keyIntensity: 2.5, rimIntensity: 1.18, emergencyIntensity: 9.5, exposure: 1.09 }"),
  'P27-C4 Three lighting baseline changed without updating the Babylon profile.',
);

const fullProfile = jovianHarvesterRenderProfile(1, false);
const mobileProfile = jovianHarvesterRenderProfile(1, true);
assert(
  fullProfile.deckInstances === 6
    && fullProfile.towerInstances === 5
    && fullProfile.bridgeInstances === 4
    && fullProfile.ballastInstances === 4
    && mobileProfile.deckInstances === 4
    && mobileProfile.towerInstances === 5
    && mobileProfile.bridgeInstances === 2
    && mobileProfile.ballastInstances === 2,
  'P27-C4 Babylon environment must preserve the shared Jovian adaptive structure budget.',
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
    && renderer.includes('this.worldPresentation.sync(state, mission, quality);')
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

console.log('BABYLON_JOVIAN_HARVESTER_PASS identity=skimmer-towers+weathered-condenser+storm-orange+compressor-service storm=shared-pressure navigation=shared boss=stormline-foreman-ilex world=shared-cues browser=headed');
