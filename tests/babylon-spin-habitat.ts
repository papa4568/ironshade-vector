import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BABYLON_SPIN_HABITAT_IDENTITY,
  BABYLON_SPIN_HABITAT_LIGHTING,
  BABYLON_SPIN_PREMIUM_SURFACES,
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
const world = read('src/game/babylonWorldPresentation.ts');
const browser = read('scripts/browser-runtime-smoke.mjs');
const browserRetry = read('scripts/browser-runtime-smoke-retry.mjs');
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


const androidWorkflow = read('.github/workflows/pr-android-apk.yml');
const androidCapture = read('scripts/android-p28g3-spin-capture.mjs');
const androidCaptureRunner = read('scripts/android-p28g3-spin-capture.sh');
const readiness = read('src/game/babylonRefineryMissionReadiness.ts');
assert(
  BABYLON_SPIN_PREMIUM_SURFACES.join(',') === 'deck-plate,painted-metal,bare-metal,polymer-rubber,emissive-fixture'
    && habitat.includes('this.premiumSurfaces = createBabylonPremiumPbrSurfaceLibrary(scene)')
    && habitat.includes("this.iblTexture = new CubeTexture('/assets/environments/refinery-prefiltered.env'")
    && habitat.includes('this.canvas.dataset.spinPremiumBindings = String(this.premiumBindingCount)')
    && habitat.includes("this.canvas.dataset.spinPremiumAssetState = premiumReady ? 'ready' : 'loading'")
    && habitat.includes('this.groundingSource.createInstance')
    && habitat.includes('this.enemyGrounding.delete(id)')
    && habitat.includes('this.premiumSurfaces.dispose()')
    && habitat.includes('this.iblTexture.dispose()')
    && habitat.includes('this.groundingTexture.dispose()'),
  'P28-G3 Spin Habitat must bind real KTX2 premium surfaces, IBL and grounded props/actors with cleanup.',
);
assert(
  habitat.includes('p28-g3-spin-torque-rail-')
    && habitat.includes('p28-g3-spin-ring-joint-')
    && habitat.includes('p28-g3-spin-spoke-cross-rib-')
    && habitat.includes('p28-g3-spin-service-brace-')
    && habitat.includes('p28-g3-spin-axis-bearing-foot-')
    && habitat.includes('this.rotorRoot.rotation.y = this.rotationY')
    && world.includes("|| mission.location === 'spin-habitat'")
    && readiness.includes("|| mission.location === 'spin-habitat'"),
  'P28-G3 must keep the rotating frame linked to gravity, add visible mechanical detail, and prevent bare world fallbacks.',
);
assert(
  browser.includes("canvas?.dataset.spinPremiumAssetState === 'ready'")
    && browser.includes("state.environmentIbl !== 'shared-prefiltered:ready'")
    && browser.includes("state.authoredWorld !== state.mappedWorld")
    && browser.includes("state.materialIntent !== 'premium-ktx2-habitat-alloy-pbr+shared-world-pbr'")
    && androidCapture.includes("campaign.cycle = 1")
    && androidCapture.includes("state.campaign.cycle = 1")
    && androidCapture.includes("let updated = false")
    && androidCapture.includes("if (campaignRaw)")
    && androidCapture.includes("return updated;")
    && !androidCapture.includes("if (!campaignRaw) return false;")
    && androidCapture.includes("await call('Page.reload', { ignoreCache: true })")
    && androidCapture.includes("could not seed the persisted cycle-one campaign")
    && androidCapture.includes("d?.babylonScenario === 'spin-habitat'")
    && androidCapture.includes("d.babylonSharedWorldArtState === 'ready'")
    && androidCapture.includes("d.spinPremiumAssetState === 'ready'")
    && androidCapture.includes("d.environmentIbl === 'shared-prefiltered:ready'")
    && androidCapture.includes("Number(d.babylonRouteMarkingMaxWidth) <= 0.20")
    && androidCapture.includes('before === result.playerPosition')
    && androidCapture.includes("execFileSync('adb', ['exec-out', 'screencap', '-p']")
    && androidCaptureRunner.includes('CDP_ENDPOINT=http://127.0.0.1:9222 node scripts/android-p28g3-spin-capture.mjs')
    && androidCaptureRunner.includes('adb exec-out screencap -p')
    && androidWorkflow.includes('bash scripts/android-p28g3-spin-capture.sh'),
  'P28-G3 must require real high-tier APK normal/action frames, shared LOD0, loaded surfaces and source provenance.',
);


assert(
  browserRetry.includes("const lostDevicePattern = /webgpu->webgl2:runtime-device-lost/")
    && browserRetry.includes("process.env.BROWSER_E2E_VIEWPORT === 'desktop'")
    && browserRetry.includes("process.env.BROWSER_E2E_BABYLON_BACKEND === 'webgpu'")
    && browserRetry.includes("writeFileSync(newPath, original")
    && browserRetry.includes("remote-debugging-port=9224")
    && browserRetry.includes("ironshade-browser-e2e-fresh")
    && browserRetry.includes("CDP_ENDPOINT: 'http://127.0.0.1:9224'")
    && browserRetry.includes("BROWSER_WEBGPU_FRESH_BROWSER_PASS backend=webgpu")
    && browserRetry.includes("return await runSmoke({ ...process.env, CDP_ENDPOINT: 'http://127.0.0.1:9224' })"),
  'P28-G3 CI device-loss recovery must launch one fresh genuine headed WebGPU context and retain the strict render gate.',
);

console.log('BABYLON_SPIN_HABITAT_PASS identity=ring-and-spokes+habitat-alloy+cool-green+habitat-service spindown=shared-gravity navigation=shared boss=sable-voss world=shared-cues browser=headed');
