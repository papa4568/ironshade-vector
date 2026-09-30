import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BABYLON_ORBITAL_STATION_IDENTITY,
  BABYLON_ORBITAL_STATION_LIGHTING,
} from '../src/game/babylonOrbitalStationPresentation';
import { getMapNavigationPlan } from '../src/game/mapNavigation';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const renderer = read('src/game/babylonCombatRenderer.ts');
const station = read('src/game/babylonOrbitalStationPresentation.ts');
const three = read('src/game/hardSciFiVisuals.ts');
const threeRenderer = read('src/game/threeCombatRenderer.ts');
const world = read('src/game/babylonWorldPresentation.ts');
const browser = read('scripts/browser-runtime-smoke.mjs');
const workflow = read('.github/workflows/browser-e2e.yml');
const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };

assert(
  JSON.stringify(BABYLON_ORBITAL_STATION_IDENTITY) === JSON.stringify({
    silhouette: 'radial-spine',
    material: 'clean-industrial',
    lighting: 'neutral-cyan',
    propSet: 'service-cases',
  }),
  'P27-C1 Babylon Orbital Station art identity must preserve the Three baseline.',
);

assert(
  three.includes("'orbital-station': { silhouette: 'radial-spine', material: 'clean-industrial', lighting: 'neutral-cyan', propSet: 'service-cases' }"),
  'P27-C1 source baseline for Orbital Station identity changed without updating the Babylon port.',
);

assert(
  BABYLON_ORBITAL_STATION_LIGHTING.id === 'neutral-cyan'
    && BABYLON_ORBITAL_STATION_LIGHTING.keyColor === 0xd8e8e1
    && BABYLON_ORBITAL_STATION_LIGHTING.rimColor === 0x72a8b2
    && BABYLON_ORBITAL_STATION_LIGHTING.emergencyColor === 0xd97958
    && BABYLON_ORBITAL_STATION_LIGHTING.keyIntensity === 2.35
    && BABYLON_ORBITAL_STATION_LIGHTING.rimIntensity === 1
    && BABYLON_ORBITAL_STATION_LIGHTING.emergencyIntensity === 8.5
    && BABYLON_ORBITAL_STATION_LIGHTING.exposure === 1.06,
  'P27-C1 Babylon Orbital Station lighting must retain the neutral-cyan Three profile.',
);

assert(
  threeRenderer.includes("'orbital-station': { id: 'neutral-cyan', keyColor: 0xd8e8e1, rimColor: 0x72a8b2, emergencyColor: 0xd97958, keyIntensity: 2.35, rimIntensity: 1.0, emergencyIntensity: 8.5, exposure: 1.06 }"),
  'P27-C1 Three lighting baseline changed without updating the Babylon profile.',
);

const navigation = getMapNavigationPlan('orbital-station');
assert(
  navigation.routes.length >= 6
    && navigation.routes.some(route => route.kind === 'primary' && route.id === 'primary-spine')
    && navigation.landmarks.map(item => item.label).join('|') === 'SPIN ACCESS|TRANSFER BAY|CRANE WELL',
  'P27-C1 Orbital Station must retain deterministic primary/secondary navigation and its three landmarks.',
);

assert(
  station.includes("getMapNavigationPlan('orbital-station')")
    && station.includes("environmentVisual = 'procedural-orbital-station-babylon'")
    && station.includes("environmentKit = 'floor,radial-spine,ribs,airlocks,pipes,service-cases,wayfinding'")
    && station.includes("babylonOrbitalParity = 'architecture+materials+lighting+props+navigation+shared-world-cues'")
    && station.includes("locationArtIdentity = 'radial-spine|clean-industrial|neutral-cyan|service-cases'"),
  'P27-C1 Babylon station presentation must expose architecture, materials, props, wayfinding, and parity telemetry.',
);

assert(
  renderer.includes("const orbitalStationScenario = mission.location === 'orbital-station';")
    && renderer.includes("this.canvas.dataset.babylonScenario = mission.location;")
    && renderer.includes('this.worldPresentation.sync(state, mission, quality);')
    && renderer.includes("this.orbitalStationPresentation.sync(state, budget, mission.conditions.includes('low-visibility'));")
    && renderer.includes("this.refineryPostProcessing.release('scenario-switch');"),
  'P27-C1 renderer must run Orbital Station through shared Babylon gameplay cues while keeping refinery-only post processing isolated.',
);

assert(
  world.includes('biomeWorldState(mission.location, state)')
    && world.includes('this.syncObjects(state, detailScale);')
    && world.includes('this.syncHazards(')
    && world.includes('this.syncObjective(')
    && world.includes('this.syncGroundLoot(state, detailScale);')
    && world.includes('this.syncBreaches('),
  'P27-C1 shared Babylon world presentation must retain interactables, hazards, objectives, loot, breaches, and location state cues.',
);

assert(
  browser.includes('BROWSER_P27C1_BABYLON_ORBITAL_PASS')
    && workflow.includes('BROWSER_E2E_GRAPHICS_PATH=babylon BROWSER_E2E_LOCATION=orbital-station'),
  'P27-C1 must remain covered by the headed Babylon browser route on desktop and mobile-landscape.',
);

assert(
  pkg.scripts?.['test:babylon-orbital-station']?.includes('tests/babylon-orbital-station.ts')
    && pkg.scripts?.build?.includes('npm run test:babylon-orbital-station'),
  'P27-C1 unit/source regression must be wired into the full production build.',
);

console.log('BABYLON_ORBITAL_STATION_PASS identity=radial-spine+clean-industrial+neutral-cyan+service-cases navigation=shared world=shared-cues browser=headed');
