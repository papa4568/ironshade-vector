import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BABYLON_SPIN_HABITAT_IDENTITY,
  BABYLON_SPIN_HABITAT_LIGHTING,
} from '../src/game/babylonSpinHabitatPresentation';
import { getMapNavigationPlan } from '../src/game/mapNavigation';
import {
  spinHabitatArchitectureState,
  spinHabitatSpindownState,
} from '../src/game/spinHabitatArchitecture';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const renderer = read('src/game/babylonCombatRenderer.ts');
const habitat = read('src/game/babylonSpinHabitatPresentation.ts');
const three = read('src/game/hardSciFiVisuals.ts');
const threeRenderer = read('src/game/threeCombatRenderer.ts');
const world = read('src/game/babylonWorldPresentation.ts');
const browser = read('scripts/browser-runtime-smoke.mjs');
const workflow = read('.github/workflows/browser-e2e.yml');
const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };

assert(
  JSON.stringify(BABYLON_SPIN_HABITAT_IDENTITY) === JSON.stringify({
    silhouette: 'ring-and-spokes',
    material: 'habitat-alloy',
    lighting: 'cool-green',
    propSet: 'habitat-service',
  }),
  'P27-C3 Babylon Spin Habitat art identity must preserve the Three baseline.',
);

assert(
  three.includes("'spin-habitat': { silhouette: 'ring-and-spokes', material: 'habitat-alloy', lighting: 'cool-green', propSet: 'habitat-service' }"),
  'P27-C3 source baseline for Spin Habitat identity changed without updating the Babylon port.',
);

assert(
  BABYLON_SPIN_HABITAT_LIGHTING.id === 'cool-green'
    && BABYLON_SPIN_HABITAT_LIGHTING.keyColor === 0xd2e4dc
    && BABYLON_SPIN_HABITAT_LIGHTING.rimColor === 0x6fb2ac
    && BABYLON_SPIN_HABITAT_LIGHTING.emergencyColor === 0x6ba89f
    && BABYLON_SPIN_HABITAT_LIGHTING.keyIntensity === 2.2
    && BABYLON_SPIN_HABITAT_LIGHTING.rimIntensity === 1.06
    && BABYLON_SPIN_HABITAT_LIGHTING.emergencyIntensity === 7.8
    && BABYLON_SPIN_HABITAT_LIGHTING.exposure === 1.07,
  'P27-C3 Babylon Spin Habitat lighting must retain the cool-green Three profile.',
);

assert(
  threeRenderer.includes("'spin-habitat': { id: 'cool-green', keyColor: 0xd2e4dc, rimColor: 0x6fb2ac, emergencyColor: 0x6ba89f, keyIntensity: 2.2, rimIntensity: 1.06, emergencyIntensity: 7.8, exposure: 1.07 }"),
  'P27-C3 Three lighting baseline changed without updating the Babylon profile.',
);

const nominal = spinHabitatArchitectureState(1);
const reduced = spinHabitatArchitectureState(0.4);
const spindown = spinHabitatSpindownState(0);
assert(
  nominal.mode === 'nominal'
    && nominal.angularSpeed > 0
    && nominal.rpm > 0
    && reduced.mode === 'reduced'
    && reduced.angularSpeed < nominal.angularSpeed
    && spindown.active
    && spindown.intensity === 1,
  'P27-C3 Spin Habitat Babylon presentation must remain driven by shared gravity/spindown helpers.',
);

const navigation = getMapNavigationPlan('spin-habitat');
assert(
  navigation.routes.length >= 6
    && navigation.routes.some(route => route.kind === 'primary' && route.id === 'primary-spine')
    && navigation.landmarks.map(item => item.label).join('|') === 'RIM HAB|SPOKE TRANSIT|AXIS HUB',
  'P27-C3 Spin Habitat must retain deterministic primary/secondary navigation and its three landmarks.',
);

assert(
  habitat.includes("getMapNavigationPlan('spin-habitat')")
    && habitat.includes("environmentVisual = 'procedural-spin-habitat-babylon'")
    && habitat.includes("environmentMotion = 'gravity-coupled-rigid-rotation'")
    && habitat.includes("environmentSpinSource = 'sector-A-gravity'")
    && habitat.includes("environmentSpindownSource = 'sector-B-transfer-gravity'")
    && habitat.includes("environmentVfx = 'spindown-brake-arcs+axis-warning-pulse'")
    && habitat.includes("interactableKit = 'spin-bus-isolator+gravity-trim+bearing-control+attitude-flywheel+pressure-lock'")
    && habitat.includes("bossPresentation = 'sable-voss'")
    && habitat.includes("bossCue = 'counterspin-ring+governor-towers+phase-halo'")
    && habitat.includes("locationArtIdentity = 'ring-and-spokes|habitat-alloy|cool-green|habitat-service'")
    && habitat.includes("babylonSpinHabitatParity = 'architecture+spindown+props+interactables+navigation+boss-cues+shared-world-cues'"),
  'P27-C3 Babylon Spin Habitat must expose ring/spoke architecture, spindown, machinery, navigation, boss cues, and parity telemetry.',
);

assert(
  renderer.includes("const spinHabitatScenario = mission.location === 'spin-habitat';")
    && renderer.includes("this.canvas.dataset.babylonScenario = mission.location;")
    && renderer.includes('this.worldPresentation.sync(state, mission, budget.detailScale);')
    && renderer.includes("this.spinHabitatPresentation.sync(state, budget, mission.conditions.includes('low-visibility'));")
    && renderer.includes("this.damagedVesselPresentation.release('scenario-switch');")
    && renderer.includes("this.refineryPostProcessing.release('scenario-switch');"),
  'P27-C3 renderer must run Spin Habitat through shared Babylon gameplay cues while keeping location presentations isolated.',
);

assert(
  world.includes('biomeWorldState(mission.location, state)')
    && world.includes('this.syncObjects(state, detailScale);')
    && world.includes('this.syncHazards(')
    && world.includes('this.syncObjective(')
    && world.includes('this.syncGroundLoot(state, detailScale);')
    && world.includes('this.syncBreaches('),
  'P27-C3 shared Babylon world presentation must retain interactables, hazards, objectives, loot, breaches, and location state cues.',
);

assert(
  browser.includes('BROWSER_P27C3_BABYLON_SPIN_HABITAT_PASS')
    && workflow.includes('BROWSER_E2E_GRAPHICS_PATH=babylon BROWSER_E2E_LOCATION=spin-habitat'),
  'P27-C3 must remain covered by the headed Babylon browser route on desktop and mobile-landscape.',
);

assert(
  pkg.scripts?.['test:babylon-spin-habitat']?.includes('tests/babylon-spin-habitat.ts')
    && pkg.scripts?.build?.includes('npm run test:babylon-spin-habitat'),
  'P27-C3 unit/source regression must be wired into the full production build.',
);

console.log('BABYLON_SPIN_HABITAT_PASS identity=ring-and-spokes+habitat-alloy+cool-green+habitat-service spindown=shared-gravity navigation=shared boss=sable-voss world=shared-cues browser=headed');
