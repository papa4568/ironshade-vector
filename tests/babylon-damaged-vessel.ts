import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BABYLON_DAMAGED_VESSEL_IDENTITY,
  BABYLON_DAMAGED_VESSEL_LIGHTING,
} from '../src/game/babylonDamagedVesselPresentation';
import { getMapNavigationPlan } from '../src/game/mapNavigation';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const renderer = read('src/game/babylonCombatRenderer.ts');
const vessel = read('src/game/babylonDamagedVesselPresentation.ts');
const world = read('src/game/babylonWorldPresentation.ts');
const browser = read('scripts/browser-runtime-smoke.mjs');
const workflow = read('.github/workflows/browser-e2e.yml');
const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };

assert(
  JSON.stringify(BABYLON_DAMAGED_VESSEL_IDENTITY) === JSON.stringify({
    silhouette: 'broken-ribs',
    material: 'scarred-hull',
    lighting: 'emergency-amber',
    propSet: 'salvage-cases',
  }),
  'P27-C2 Babylon Damaged Vessel art identity must preserve the Three baseline.',
);

assert(
  BABYLON_DAMAGED_VESSEL_LIGHTING.id === 'emergency-amber'
    && BABYLON_DAMAGED_VESSEL_LIGHTING.keyColor === 0xd8c6b2
    && BABYLON_DAMAGED_VESSEL_LIGHTING.rimColor === 0xa65d48
    && BABYLON_DAMAGED_VESSEL_LIGHTING.emergencyColor === 0xf0754f
    && BABYLON_DAMAGED_VESSEL_LIGHTING.keyIntensity === 1.8
    && BABYLON_DAMAGED_VESSEL_LIGHTING.rimIntensity === 0.92
    && BABYLON_DAMAGED_VESSEL_LIGHTING.emergencyIntensity === 12
    && BABYLON_DAMAGED_VESSEL_LIGHTING.exposure === 1,
  'P27-C2 Babylon Damaged Vessel lighting must retain the emergency-amber Three profile.',
);

const navigation = getMapNavigationPlan('damaged-vessel');

assert(
  vessel.includes("getMapNavigationPlan('damaged-vessel')")
    && vessel.includes("environmentVisual = 'procedural-damaged-vessel-babylon'")
    && vessel.includes("environmentLandmark = 'starboard-hull-breach'")
    && vessel.includes("environmentServiceDetails = 'salvage-rack:6+service-bundle:5'")
    && vessel.includes("environmentSurfaceDetail = 'broken-rib:5+torn-plate:6+scorch:6'")
    && vessel.includes("environmentVfx = 'breach-vapor:18+scorch:6'")
    && vessel.includes("readabilityLanguage = 'silhouette+damage-edge+breach-vapor+luminance'")
    && vessel.includes("locationArtIdentity = 'broken-ribs|scarred-hull|emergency-amber|salvage-cases'")
    && vessel.includes("babylonDamagedParity = 'architecture+scarred-hull+breach-effects+props+navigation+shared-world-cues'"),
  'P27-C2 Babylon Damaged Vessel must expose architecture, scarred materials, breach effects, props, wayfinding, and parity telemetry.',
);

assert(
  renderer.includes("const damagedVesselScenario = mission.location === 'damaged-vessel';")
    && renderer.includes("this.canvas.dataset.babylonScenario = mission.location;")
    && renderer.includes('this.worldPresentation.sync(state, mission, budget.detailScale);')
    && renderer.includes("this.damagedVesselPresentation.sync(state, budget, mission.conditions.includes('low-visibility'));")
    && renderer.includes("this.orbitalStationPresentation.release('scenario-switch');")
    && renderer.includes("this.refineryPostProcessing.release('scenario-switch');"),
  'P27-C2 renderer must run Damaged Vessel through shared Babylon gameplay cues while keeping location presentations isolated.',
);

assert(
  world.includes('biomeWorldState(mission.location, state)')
    && world.includes('this.syncObjects(state, detailScale);')
    && world.includes('this.syncHazards(')
    && world.includes('this.syncObjective(')
    && world.includes('this.syncGroundLoot(state, detailScale);')
    && world.includes('this.syncBreaches('),
  'P27-C2 shared Babylon world presentation must retain interactables, hazards, objectives, loot, breaches, and location state cues.',
);

assert(
  browser.includes('BROWSER_P27C2_BABYLON_DAMAGED_VESSEL_PASS')
    && workflow.includes('BROWSER_E2E_GRAPHICS_PATH=babylon BROWSER_E2E_LOCATION=damaged-vessel'),
  'P27-C2 must remain covered by the headed Babylon browser route on desktop and mobile-landscape.',
);

assert(
  pkg.scripts?.['test:babylon-damaged-vessel']?.includes('tests/babylon-damaged-vessel.ts')
    && pkg.scripts?.build?.includes('npm run test:babylon-damaged-vessel'),
  'P27-C2 unit/source regression must be wired into the full production build.',
);

console.log('BABYLON_DAMAGED_VESSEL_PASS identity=broken-ribs+scarred-hull+emergency-amber+salvage-cases breach=procedural navigation=shared world=shared-cues browser=headed');
