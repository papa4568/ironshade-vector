import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BABYLON_DAMAGED_VESSEL_IDENTITY,
  BABYLON_DAMAGED_VESSEL_LIGHTING,
  BABYLON_DAMAGED_PREMIUM_SURFACES,
} from '../src/game/babylonDamagedVesselPresentation';
import { getMapNavigationPlan } from '../src/game/mapNavigation';
import { BABYLON_ROUTE_MARKING_WIDTHS, babylonRouteMarkingWidth } from '../src/game/babylonRouteMarkings';

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
  navigation.routes.length >= 6
    && navigation.routes.some(route => route.kind === 'primary' && route.id === 'primary-spine')
    && navigation.landmarks.map(item => item.label).join('|') === 'FORE HAB|CARGO SPINE|ENGINE VAULT',
  'P27-C2 Damaged Vessel must retain deterministic primary/secondary navigation and its three landmarks.',
);

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


// P28-G2: the old 74/50/36 simulation-unit slabs rendered as 1.48/1.00/0.72
// world-unit opaque floor bands. Keep decorative inlays separate from the
// simulation's 78-unit lane-clearance contract and inspect other ported routes.
assert(
  Object.entries(BABYLON_ROUTE_MARKING_WIDTHS).every(([kind, width]) =>
    width > 0 && width <= 0.20 && babylonRouteMarkingWidth(kind as keyof typeof BABYLON_ROUTE_MARKING_WIDTHS) === width)
    && BABYLON_ROUTE_MARKING_WIDTHS.primary > BABYLON_ROUTE_MARKING_WIDTHS.secondary
    && BABYLON_ROUTE_MARKING_WIDTHS.secondary > BABYLON_ROUTE_MARKING_WIDTHS.connector
    && [vessel, read('src/game/babylonOrbitalStationPresentation.ts'), read('src/game/babylonSpinHabitatPresentation.ts')]
      .every(source => source.includes('babylonRouteMarkingWidth(route.kind)')
        && source.includes('babylonRouteMarkingMaxWidth')
        && !/scaled\(route\.kind/.test(source))
    && read('src/game/babylonSolarYardPresentation.ts').includes("route.kind === 'primary' ? 0.12 : 0.075")
    && read('src/game/mapNavigation.ts').includes('rectRouteDistance(object, route.points[index], route.points[index + 1]) < 78'),
  'P28-G2 floor navigation must use legible narrow visual inlays while preserving simulation-owned lane clearance.',
);

assert(
  world.includes("mission.location === 'orbital-station' || mission.location === 'damaged-vessel'")
    && world.includes('if (!this.authoredWorldObjects.has(object.id))')
    && world.includes('const mappedFamily = mappedScenario ? refineryWorldObjectFamilyKey(object) : null')
    && world.includes("this.canvas.dataset.babylonSharedWorldArtState = sharedPremiumScenario")
    && world.includes("this.canvas.dataset.babylonSharedWorldFallbackCount = String(sharedPremiumScenario ? fallbackCount : 0)")
    && world.includes('authoredWorld.mount.scaling.set(fit.scaleX, fit.scaleY * durabilityScale, fit.scaleZ)'),
  'P28-G2 Orbital/Damaged shared world must use authored mesh families, count fallbacks, preserve authored placement and block visual-ready while incomplete.',
);

const androidG2 = read('scripts/android-p28g2-damaged-capture.mjs');
const androidG2Runner = read('scripts/android-p28g2-damaged-capture.sh');
assert(
  androidG2.includes("d?.babylonScenario === 'damaged-vessel'")
    && androidG2.includes("d.babylonSharedWorldArtState === 'ready'")
    && androidG2.includes("Number(d.babylonRouteMarkingMaxWidth) <= 0.20")
    && androidG2.includes("execFileSync('adb', ['exec-out', 'screencap', '-p']")
    && androidG2Runner.includes('adb exec-out screencap -p')
    && workflow.includes('bash scripts/android-p28g2-damaged-capture.sh'),
  'P28-G2 must generate APK-backed normal/action Damaged Vessel frames with authored/route provenance.',
);

assert(
  BABYLON_DAMAGED_PREMIUM_SURFACES.join(',') === 'deck-plate,painted-metal,bare-metal,polymer-rubber,emissive-fixture'
    && vessel.includes('this.premiumSurfaces = createBabylonPremiumPbrSurfaceLibrary(scene)')
    && vessel.includes("this.iblTexture = new CubeTexture('/assets/environments/refinery-prefiltered.env'")
    && vessel.includes("this.canvas.dataset.damagedPremiumAssetState = premiumReady ? 'ready' : 'loading'")
    && vessel.includes('this.groundingSource.createInstance')
    && vessel.includes('this.canvas.dataset.damagedPremiumBindings = String(this.premiumBindingCount)')
    && vessel.includes("this.canvas.dataset.environmentIbl = this.iblReady ? 'shared-prefiltered:ready' : 'shared-prefiltered:loading'")
    && vessel.includes('this.premiumSurfaces.dispose()'),
  'P28-G2 Damaged Vessel must bind real KTX2 PBR textures, shared IBL and grounded actors/props with deterministic disposal.',
);

console.log('BABYLON_DAMAGED_VESSEL_PASS identity=broken-ribs+scarred-hull+emergency-amber+salvage-cases breach=procedural navigation=shared world=shared-cues browser=headed');
