import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createCombatGraphicsBackend,
  babylonCombatGraphicsBackendFactory,
  productionCombatGraphicsBackendId,
  resolveCombatGraphicsPathSelection,
  selectCombatGraphicsBackendFactory,
  webgpuRefineryCombatGraphicsBackendFactory,
  type CombatGraphicsBackend,
  type CombatGraphicsBackendFactory,
} from '../src/game/combatGraphicsBackend';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(productionCombatGraphicsBackendId === 'webgl2', 'P21-A1 production graphics backend must remain WebGL2.');

const productionPath = resolveCombatGraphicsPathSelection('?graphicsPath=webgl2');
const explicitPath = resolveCombatGraphicsPathSelection('?graphicsCompare=1&graphicsPath=webgl2');
const webgpuPath = resolveCombatGraphicsPathSelection('?graphicsCompare=1&graphicsPath=webgpu');
const babylonPath = resolveCombatGraphicsPathSelection('?graphicsCompare=1&graphicsPath=babylon');
const babylonWebGpuPath = resolveCombatGraphicsPathSelection('?graphicsCompare=1&graphicsPath=babylon&babylonBackend=webgpu');
const babylonInvalidBackendPath = resolveCombatGraphicsPathSelection('?graphicsCompare=1&graphicsPath=babylon&babylonBackend=metal');
const unknownPath = resolveCombatGraphicsPathSelection('?graphicsCompare=1&graphicsPath=metal');
assert(
  productionPath.mode === 'production-default' && productionPath.requestedId === null && productionPath.selectedId === 'webgl2',
  'P21-A2 graphics-path overrides must remain disabled unless comparison mode is explicitly enabled.',
);
assert(
  explicitPath.mode === 'qa-explicit' && explicitPath.requestedId === 'webgl2' && explicitPath.selectedId === 'webgl2',
  'P21-A2 comparison mode must resolve an explicit WebGL2 request deterministically.',
);
assert(
  webgpuPath.mode === 'qa-explicit' && webgpuPath.requestedId === 'webgpu' && webgpuPath.selectedId === 'webgpu',
  'P21-F1 comparison mode must expose WebGPU only behind the explicit QA selector.',
);
assert(
  babylonPath.mode === 'qa-explicit' && babylonPath.requestedId === 'babylon' && babylonPath.selectedId === 'babylon' && babylonPath.babylonBackendRequested === 'webgl2',
  'P27-A2 comparison mode must expose Babylon WebGL2 only behind the explicit QA selector.',
);
assert(
  babylonWebGpuPath.mode === 'qa-explicit'
    && babylonWebGpuPath.requestedId === 'babylon'
    && babylonWebGpuPath.selectedId === 'babylon'
    && babylonWebGpuPath.babylonBackendRequested === 'webgpu',
  'P27-D1 comparison mode must deterministically select optional Babylon WebGPU when explicitly requested.',
);
assert(
  babylonInvalidBackendPath.babylonBackendRequested === 'webgl2',
  'P27-D1 unknown Babylon engine requests must deterministically use Babylon WebGL2.',
);
assert(
  productionPath.babylonBackendRequested === null,
  'P27-D1 production selection must not request Babylon WebGPU.',
);
assert(
  unknownPath.mode === 'production-default' && unknownPath.requestedId === null && unknownPath.selectedId === 'webgl2',
  'P21-A2 unknown comparison paths must fall back to the production WebGL2 selection instead of changing runtime behavior.',
);

const fakeBackend = {
  id: 'webgl2',
  loadedId: 'webgl2',
  render: () => undefined,
  performanceStats: () => ({ drawCalls: 0, triangles: 0 }),
  screenDirection: () => ({ x: 1, y: 0 }),
  dispose: () => undefined,
} as CombatGraphicsBackend;

let createCount = 0;
const unsupportedFactory = {
  id: 'webgl2',
  isSupported: () => false,
  create: () => {
    throw new Error('unsupported factory must not create a renderer');
  },
} as CombatGraphicsBackendFactory;
const supportedFactory = {
  id: 'webgl2',
  isSupported: () => true,
  create: () => {
    createCount += 1;
    return fakeBackend;
  },
} as CombatGraphicsBackendFactory;

const fakeWebGpuBackend = {
  ...fakeBackend,
  id: 'webgpu',
  loadedId: 'webgpu',
} as CombatGraphicsBackend;
const unsupportedWebGpuFactory = {
  id: 'webgpu',
  isSupported: () => false,
  create: () => {
    throw new Error('unsupported WebGPU factory must not create a renderer');
  },
} as CombatGraphicsBackendFactory;
const supportedWebGpuFactory = {
  id: 'webgpu',
  isSupported: () => true,
  create: () => fakeWebGpuBackend,
} as CombatGraphicsBackendFactory;

const fakeBabylonBackend = {
  ...fakeBackend,
  id: 'babylon',
  loadedId: 'babylon',
} as CombatGraphicsBackend;
const unsupportedBabylonFactory = {
  id: 'babylon',
  isSupported: () => false,
  create: () => {
    throw new Error('unsupported Babylon factory must not create a renderer');
  },
} as CombatGraphicsBackendFactory;
let capturedBabylonBackend: 'webgl2' | 'webgpu' | null = null;
const supportedBabylonFactory = {
  id: 'babylon',
  isSupported: () => true,
  create: (_canvas, _coarse, options) => {
    capturedBabylonBackend = options?.babylonBackend ?? null;
    return fakeBabylonBackend;
  },
} as CombatGraphicsBackendFactory;

assert(
  selectCombatGraphicsBackendFactory([unsupportedFactory, supportedFactory]) === supportedFactory,
  'P21-A1 backend selection must choose the first supported production WebGL2 factory.',
);
assert(
  createCombatGraphicsBackend({} as HTMLCanvasElement, false, [unsupportedFactory]) === null,
  'P21-A1 backend creation must preserve the Canvas 2D fallback when WebGL2 is unsupported.',
);
assert(
  createCombatGraphicsBackend({} as HTMLCanvasElement, false, [unsupportedFactory, supportedFactory]) === fakeBackend && createCount === 1,
  'P21-A1 backend creation must instantiate the selected renderer exactly once.',
);
assert(
  createCombatGraphicsBackend({} as HTMLCanvasElement, false, [supportedFactory], explicitPath.selectedId) === fakeBackend && createCount === 2,
  'P21-A2 explicit path creation must use the same backend factory and lifecycle as production WebGL2.',
);

assert(
  selectCombatGraphicsBackendFactory([supportedFactory, supportedWebGpuFactory], webgpuPath.selectedId) === supportedWebGpuFactory,
  'P21-F1 explicit WebGPU selection must choose the WebGPU refinery backend when supported.',
);
assert(
  selectCombatGraphicsBackendFactory([supportedFactory, unsupportedWebGpuFactory], webgpuPath.selectedId) === supportedFactory,
  'P21-F1 unsupported WebGPU must fall back to the supported production WebGL2 factory.',
);
assert(
  createCombatGraphicsBackend({} as HTMLCanvasElement, false, [supportedFactory, unsupportedWebGpuFactory], webgpuPath.selectedId) === fakeBackend,
  'P21-F1 WebGPU creation must preserve safe WebGL2 fallback when the prototype is unsupported.',
);
assert(
  webgpuRefineryCombatGraphicsBackendFactory.id === 'webgpu',
  'P21-F1 WebGPU refinery factory must remain isolated from the production backend id.',
);

assert(
  selectCombatGraphicsBackendFactory([supportedFactory, supportedBabylonFactory], babylonPath.selectedId) === supportedBabylonFactory,
  'P27-A2 explicit Babylon selection must choose the Babylon QA backend when WebGL2 is supported.',
);
assert(
  selectCombatGraphicsBackendFactory([supportedFactory, unsupportedBabylonFactory], babylonPath.selectedId) === supportedFactory,
  'P27-A2 unsupported Babylon must fall back to the supported production WebGL2 factory.',
);
assert(
  createCombatGraphicsBackend({} as HTMLCanvasElement, false, [supportedFactory, unsupportedBabylonFactory], babylonPath.selectedId) === fakeBackend,
  'P27-A2 Babylon creation must preserve safe production WebGL2 fallback when unavailable.',
);
assert(
  createCombatGraphicsBackend(
    {} as HTMLCanvasElement,
    false,
    [supportedFactory, supportedBabylonFactory],
    babylonWebGpuPath.selectedId,
    { babylonBackend: babylonWebGpuPath.babylonBackendRequested ?? undefined },
  ) === fakeBabylonBackend && capturedBabylonBackend === 'webgpu',
  'P27-D1 Babylon WebGPU selection must reach the Babylon factory without selecting the legacy Three WebGPU backend.',
);
assert(
  babylonCombatGraphicsBackendFactory.id === 'babylon',
  'P27-A2 Babylon factory must remain isolated from the production backend id.',
);

const root = process.cwd();
const gameCanvasSource = readFileSync(resolve(root, 'src/components/GameCanvas.tsx'), 'utf8');
const boundarySource = readFileSync(resolve(root, 'src/game/combatGraphicsBackend.ts'), 'utf8');
const rendererSource = readFileSync(resolve(root, 'src/game/threeCombatRenderer.ts'), 'utf8');
const webgpuRendererSource = readFileSync(resolve(root, 'src/game/webGpuRefineryRenderer.ts'), 'utf8');
const babylonRendererSource = readFileSync(resolve(root, 'src/game/babylonCombatRenderer.ts'), 'utf8');
const babylonWebGpuEngineSource = readFileSync(resolve(root, 'src/game/babylonWebGpuEngine.ts'), 'utf8');
const babylonWorldSource = readFileSync(resolve(root, 'src/game/babylonWorldPresentation.ts'), 'utf8');
const babylonWeaponVfxSource = readFileSync(resolve(root, 'src/game/babylonWeaponVfx.ts'), 'utf8');
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const browserSmokeSource = readFileSync(resolve(root, 'scripts/browser-runtime-smoke.mjs'), 'utf8');
const refineryVerifierSource = readFileSync(resolve(root, 'scripts/verify-authored-refinery.mjs'), 'utf8');
const androidSmokeSource = readFileSync(resolve(root, 'scripts/android-runtime-smoke.mjs'), 'utf8');
const browserWorkflowSource = readFileSync(resolve(root, '.github/workflows/browser-e2e.yml'), 'utf8');

assert(
  gameCanvasSource.includes("createCombatGraphicsBackend(canvas, compactLayout, undefined, graphicsPathSelection.selectedId, { babylonBackend: graphicsPathSelection.babylonBackendRequested ?? undefined })")
    && gameCanvasSource.includes("useRef<CombatGraphicsBackend | null>(null)")
    && !gameCanvasSource.includes('new ThreeCombatRenderer(')
    && !gameCanvasSource.includes('ThreeCombatRenderer.isSupported()'),
  'P21-A1 combat runtime must create the renderer only through the graphics-backend boundary.',
);
assert(
  boundarySource.includes("productionCombatGraphicsBackendId: CombatGraphicsBackendId = 'webgl2'")
    && boundarySource.includes("new ThreeCombatRenderer(canvas, coarse)")
    && boundarySource.includes("return this.renderer.render(...args)")
    && boundarySource.includes("return this.renderer.screenDirection(...args)")
    && boundarySource.includes("this.renderer.dispose()"),
  'P21-A1 WebGL2 backend must delegate create/render/pointer/dispose to the existing Three.js renderer.',
);

assert(
  boundarySource.includes('export type CombatGraphicsRenderArgs = [')
    && boundarySource.includes('export type CombatGraphicsPerformanceStats = {')
    && boundarySource.includes('export type CombatGraphicsPointerProjectionArgs = [')
    && boundarySource.includes('export type CombatGraphicsPointerDirection = {')
    && boundarySource.includes('export interface CombatGraphicsLifecycle')
    && boundarySource.includes('render(...args: CombatGraphicsRenderArgs): void')
    && boundarySource.includes('performanceStats(): CombatGraphicsPerformanceStats')
    && boundarySource.includes('screenDirection(...args: CombatGraphicsPointerProjectionArgs): CombatGraphicsPointerDirection')
    && !boundarySource.includes('Parameters<ThreeCombatRenderer')
    && !boundarySource.includes('ReturnType<ThreeCombatRenderer'),
  'P27-A1 graphics backend contract must own explicit renderer-neutral render, stats, pointer, lifecycle, and loaded-backend types.',
);
assert(
  webgpuRendererSource.includes('implements CombatGraphicsBackend')
    && webgpuRendererSource.includes('render(...args: CombatGraphicsRenderArgs): void')
    && webgpuRendererSource.includes('performanceStats(): CombatGraphicsPerformanceStats')
    && webgpuRendererSource.includes('screenDirection(...args: CombatGraphicsPointerProjectionArgs): CombatGraphicsPointerDirection')
    && !webgpuRendererSource.includes('ThreeCombatRenderer')
    && !webgpuRendererSource.includes('Parameters<ThreeCombatRenderer')
    && !webgpuRendererSource.includes('ReturnType<ThreeCombatRenderer'),
  'P27-A1 WebGPU QA renderer must implement the neutral backend contract without deriving public types from the Three.js renderer.',
);

assert(
  boundarySource.includes("export type CombatGraphicsBackendId = 'webgl2' | 'webgpu' | 'babylon'")
    && boundarySource.includes("await import('./webGpuRefineryRenderer')")
    && boundarySource.includes("if (selectedId !== productionCombatGraphicsBackendId)")
    && boundarySource.includes("productionCombatGraphicsBackendId")
    && boundarySource.includes("webgpu->webgl2:init-fallback"),
  'P21-F1 backend boundary must lazy-load WebGPU only for QA and preserve explicit WebGL2 fallback.',
);
assert(
  webgpuRendererSource.includes("import('three/webgpu')")
    && webgpuRendererSource.includes("import('three/tsl')")
    && webgpuRendererSource.includes('new THREE.WebGPURenderer')
    && webgpuRendererSource.includes('await renderer.init()')
    && webgpuRendererSource.includes('configureGraphicsAssetRenderer(renderer)')
    && !webgpuRendererSource.includes("renderer as unknown as Parameters<typeof graphicsAssets.configureGraphicsAssetRenderer>[0]")
    && webgpuRendererSource.includes('instantiateGraphicsAsset')
    && webgpuRendererSource.includes("PROTOTYPE_ASSET_KEYS = ['floor', 'processor', 'terminal']")
    && webgpuRendererSource.includes('MeshStandardNodeMaterial')
    && webgpuRendererSource.includes('ground-plane-raycast-v1')
    && webgpuRendererSource.includes('three-combat-v1')
    && webgpuRendererSource.includes('this.renderer.dispose()'),
  'P21-F1 WebGPU prototype must preserve TSL, authored refinery assets, camera/input parity, and teardown while later parity work remains isolated behind the same QA path.',
);

const babylonBoundaryStart = boundarySource.indexOf('class BabylonCombatGraphicsBackend');
const babylonBoundaryEnd = boundarySource.indexOf('export const productionCombatGraphicsBackendId', babylonBoundaryStart);
const babylonBoundarySource = boundarySource.slice(babylonBoundaryStart, babylonBoundaryEnd);
assert(
  boundarySource.includes("await import('./babylonCombatRenderer')")
    && boundarySource.includes("canvas.dataset.babylonInit = 'initializing'")
    && boundarySource.includes("canvas.dataset.babylonDisposed = 'true'")
    && boundarySource.includes("canvas.dataset.babylonBackendRequested = requestedBackend")
    && boundarySource.includes('createWebGpuRenderSurface()')
    && boundarySource.includes("'webgpu',\n          this.canvas,\n          reason =>")
    && boundarySource.includes("await createBabylonCombatRenderer(this.canvas, this.coarse, 'webgl2', this.canvas)")
    && boundarySource.includes("webgpu->webgl2:runtime-device-lost")
    && boundarySource.includes('fallbackFromWebGpu(reason)')
    && boundarySource.includes('webgpu->webgl2:')
    && boundarySource.includes('Three.js fallback is intentionally disabled for the Babylon QA path')
    && !babylonBoundarySource.includes('new WebGl2CombatGraphicsBackend(')
    && boundarySource.includes("typeof WebGL2RenderingContext !== 'undefined'"),
  'P27-D1 backend boundary must lazy-load Babylon, recreate cleanly with Babylon WebGL2 after WebGPU failure, and never cross into Three after Babylon selection.',
);
assert(
  babylonRendererSource.includes("from '@babylonjs/core/Engines/abstractEngine'")
    && babylonRendererSource.includes("from '@babylonjs/core/Engines/engine'")
    && babylonRendererSource.includes("await import('./babylonWebGpuEngine')")
    && babylonWebGpuEngineSource.includes("from '@babylonjs/core/Engines/webgpuEngine.pure'")
    && !babylonWebGpuEngineSource.includes("@babylonjs/core/Audio/")
    && babylonRendererSource.includes('await WebGPUEngine.IsSupportedAsync')
    && babylonRendererSource.includes('new WebGPUEngine(renderCanvas')
    && babylonRendererSource.includes('doNotHandleContextLost: true')
    && babylonRendererSource.includes('await webGpuEngine.initAsync()')
    && babylonRendererSource.includes('webGpuDeviceLost = webGpuEngine._device.lost')
    && babylonRendererSource.includes("telemetryCanvas.dataset.babylonBackendFailureStage = 'runtime-device-lost'")
    && babylonRendererSource.includes('onFatalBackendFailure(reason)')
    && babylonRendererSource.includes('new Engine(renderCanvas, !coarse')
    && babylonRendererSource.includes('webGlEngine.webGLVersion !== 2')
    && babylonRendererSource.includes("telemetryCanvas.dataset.babylonBackendInitStage = 'scene-create'")
    && babylonRendererSource.includes('new Scene(engine)')
    && babylonRendererSource.includes('telemetryCanvas.dataset.babylonBackendLoaded = backend')
    && babylonRendererSource.includes('this.scene.render()')
    && babylonRendererSource.includes('this.scene.dispose()')
    && babylonRendererSource.includes('this.engine.dispose()')
    && babylonRendererSource.includes("this.canvas.dataset.babylonScene = 'disposed'")
    && !babylonRendererSource.includes('ThreeCombatRenderer'),
  'P27-D1 Babylon renderer must initialize WebGPU or WebGL2 before scene/resource creation, route device loss to deterministic fallback instead of Babylon rebuild, and stay independent from Three.js.',
);
assert(
  packageJson.dependencies?.['@babylonjs/core'] === '9.28.0'
    && packageJson.dependencies?.['@babylonjs/loaders'] === '9.28.0',
  'P27-A2 must pin full Babylon core and loader dependencies to the same exact version.',
);
assert(
  babylonRendererSource.includes("from '@babylonjs/core/Culling/ray'")
    && babylonRendererSource.includes('const WORLD_SCALE = 0.02')
    && babylonRendererSource.includes('const CAMERA_FOV_DEGREES = 42')
    && babylonRendererSource.includes('scene.useRightHandedSystem = true')
    && babylonRendererSource.includes('camera.fov = CAMERA_FOV_RADIANS')
    && babylonRendererSource.includes('camera.minZ = 0.1')
    && babylonRendererSource.includes('camera.maxZ = 180')
    && babylonRendererSource.includes('new Engine(renderCanvas, !coarse')
    && babylonRendererSource.includes('}, false);')
    && babylonRendererSource.includes('this.engine.setHardwareScalingLevel(1 / nextRatio)')
    && babylonRendererSource.includes('this.engine.resize()')
    && babylonRendererSource.includes('this.syncCamera(state, width / Math.max(1, height), cameraFeedback)')
    && babylonRendererSource.includes('cameraFeedback?.worldOffsetX')
    && babylonRendererSource.includes('cameraFeedback?.worldOffsetZ')
    && babylonRendererSource.includes('Ray.CreateNew(')
    && babylonRendererSource.includes('rect.width')
    && babylonRendererSource.includes('rect.height')
    && babylonRendererSource.includes('(FLOOR_Y - ray.origin.y) / denominator')
    && babylonRendererSource.includes('hitX / WORLD_SCALE - player.x')
    && babylonRendererSource.includes('hitZ / WORLD_SCALE - player.y')
    && babylonRendererSource.includes("telemetryCanvas.dataset.babylonCameraParity = 'three-combat-v1'")
    && babylonRendererSource.includes("telemetryCanvas.dataset.babylonInputParity = 'ground-plane-raycast-v1'")
    && babylonRendererSource.includes('this.canvas.dataset.babylonPointerDirection')
    && babylonRendererSource.includes('this.canvas.dataset.babylonViewport')
    && babylonRendererSource.includes('this.canvas.dataset.cameraFeedback'),
  'P27-B1 Babylon renderer must match the production camera framing, explicit pixel-ratio resize, feedback offsets, and normalized ground-plane pointer projection.',
);
assert(
  babylonRendererSource.includes("from './babylonGraphicsAssets'")
    && babylonRendererSource.includes("from './graphicsAssetManifest'")
    && babylonRendererSource.includes("from './graphicsAssets'")
    && babylonRendererSource.includes("from './sim'")
    && babylonRendererSource.includes('REFINERY_ASSET_FAMILIES')
    && babylonRendererSource.includes('getBabylonGraphicsAssetRuntime')
    && babylonRendererSource.includes('disposeBabylonGraphicsAssetRuntime')
    && babylonRendererSource.includes('selectGraphicsAssetSpec(REFINERY_ASSET_FAMILIES[key], detailScale)')
    && babylonRendererSource.includes('runtime.preload(selected.map(item => item.spec), 2)')
    && babylonRendererSource.includes('const instance = await runtime.instantiate(spec)')
    && babylonRendererSource.includes('instance.rootNodes.forEach(root =>')
    && babylonRendererSource.includes('instance.release()')
    && babylonRendererSource.includes("const REFINERY_ENVIRONMENT_KIT = 'floor,floor-grate,bulkhead,processor,pipe-rack,wall-panel,cable-tray,service-conduit,gantry,crate,terminal'")
    && babylonRendererSource.includes('for (const fx of [0.18, 0.34, 0.50, 0.66, 0.82])')
    && babylonRendererSource.includes('for (const fz of [0.20, 0.40, 0.60, 0.80])')
    && babylonRendererSource.includes('state.objects')
    && babylonRendererSource.includes('.filter(object => object.active && panelObject(object))')
    && babylonRendererSource.includes("this.canvas.dataset.environmentVisual = 'authored-refinery-babylon'")
    && babylonRendererSource.includes("this.canvas.dataset.babylonEnvironmentReuse = 'cache-shared+geometry-shared+material-shared'")
    && babylonRendererSource.includes("this.releaseRefineryEnvironment('scenario-exit')")
    && babylonRendererSource.includes("this.releaseRefineryEnvironment('renderer-dispose')")
    && babylonRendererSource.includes('this.canvas.dataset.babylonSceneTelemetry')
    && babylonRendererSource.includes('this.canvas.dataset.babylonEnvironmentRuntime'),
  'P27-B2 Babylon renderer must mount the complete authored refinery shell with shared asset-runtime ownership, matching world transforms/LOD selection, telemetry, and deterministic release behavior without changing collision geometry.',
);

assert(
  babylonRendererSource.includes("from './classArsenal'")
    && babylonRendererSource.includes("from './playerHandlingAnimation'")
    && babylonRendererSource.includes('OPERATOR_CLASS_ASSET_FAMILIES')
    && babylonRendererSource.includes('WEAPON_ASSET_FAMILIES')
    && babylonRendererSource.includes("const BABYLON_WEAPON_IDS: readonly WeaponId[] = ['carbine', 'breacher', 'rail']")
    && babylonRendererSource.includes("findInstanceTransform(operatorInstance, 'weapon-socket')")
    && babylonRendererSource.includes("findInstanceTransform(instance, 'muzzle-socket')")
    && babylonRendererSource.includes('resolvePlayerHandlingAnimation({')
    && babylonRendererSource.includes('weaponVariantPresentation(variantId)')
    && babylonRendererSource.includes('weaponVariantThermalCue(variantId, heat)')
    && babylonRendererSource.includes('visual.mount.setEnabled(active)')
    && babylonRendererSource.includes('current.muzzleSocket.getAbsolutePosition()')
    && babylonRendererSource.includes("this.canvas.dataset.operatorRig = 'articulated'")
    && babylonRendererSource.includes("this.canvas.dataset.operatorSocket = 'weapon-socket'")
    && babylonRendererSource.includes("this.canvas.dataset.weaponVisual = 'authored-babylon'")
    && babylonRendererSource.includes("this.canvas.dataset.babylonWeaponMuzzleOrigin = 'muzzle-socket'")
    && babylonRendererSource.includes('this.canvas.dataset.operatorBlend')
    && babylonRendererSource.includes('this.canvas.dataset.weaponHandling')
    && babylonRendererSource.includes("this.canvas.dataset.babylonPlayerReuse = 'shared-runtime+authored-rig+authored-sockets+shared-presentation-signals'")
    && babylonRendererSource.includes("this.releasePlayerPresentation('scenario-exit')")
    && babylonRendererSource.includes("this.releasePlayerPresentation('renderer-dispose')"),
  'P27-B3 Babylon renderer must port class-specific authored operator/weapon attachments, shared handling and variant signals, authored muzzle origins, readable emissive accents, and deterministic player-presentation cleanup without changing combat simulation.',
);

assert(
  babylonRendererSource.includes('ENEMY_ASSET_FAMILIES')
    && babylonRendererSource.includes("const BABYLON_ENEMY_ROLES: readonly BabylonEnemyRole[] = ['assault', 'suppressor', 'technician', 'elite']")
    && babylonRendererSource.includes("function enemyVariantSilhouette(variant: Enemy['variant'])")
    && babylonRendererSource.includes("MeshBuilder.CreateCylinder(`p27-b4-enemy-body-${enemy.id}`")
    && babylonRendererSource.includes("MeshBuilder.CreateBox(`p27-b4-variant-${silhouette}-${enemy.id}`")
    && babylonRendererSource.includes('resolveEnemyBossAnimation({')
    && babylonRendererSource.includes('resolveEnemyDamageAnimation({')
    && babylonRendererSource.includes("findInstanceTransform(instance, 'weapon-socket')")
    && babylonRendererSource.includes('visual.fallbackRoot.setEnabled(false)')
    && babylonRendererSource.includes("this.canvas.dataset.enemyFacing = 'telegraph-or-velocity'")
    && babylonRendererSource.includes("this.canvas.dataset.enemySpawnDeath = 'active-root+spawn-pose+death-rig+deterministic-release'")
    && babylonRendererSource.includes("this.canvas.dataset.babylonEnemyReuse = 'shared-runtime+role-assets+variant-silhouettes+shared-animation-signals'")
    && babylonRendererSource.includes("this.disposeEnemyVisual(visual, 'despawn')")
    && babylonRendererSource.includes("this.releaseEnemyPresentation('scenario-exit')")
    && babylonRendererSource.includes("this.releaseEnemyPresentation('renderer-dispose')"),
  'P27-B4 Babylon renderer must port non-boss role/variant silhouettes, authored/fallback rigs, shared motion/damage signals, facing, spawn/death ownership, and deterministic cleanup without changing simulation.',
);

assert(
  babylonRendererSource.includes("from './babylonWorldPresentation'")
    && babylonRendererSource.includes('new BabylonRefineryWorldPresentation(scene, canvas, coarse)')
    && babylonRendererSource.includes('this.worldPresentation.sync(state, mission, quality)')
    && babylonRendererSource.includes("this.worldPresentation.release('scenario-exit')")
    && babylonRendererSource.includes('this.worldPresentation.dispose()')
    && babylonWorldSource.includes("from './encounters'")
    && babylonWorldSource.includes("from './fieldLoot'")
    && babylonWorldSource.includes("from './mapPathfinding'")
    && babylonWorldSource.includes("from './worldMaterialPolish'")
    && babylonWorldSource.includes('INTERACTABLE_ASSET_FAMILIES')
    && babylonWorldSource.includes('PICKUP_ASSET_FAMILY')
    && babylonWorldSource.includes('getNextMissionObjectiveTarget(state, mission)')
    && babylonWorldSource.includes('findNavigationPath(state, target)')
    && babylonWorldSource.includes('interactableWorldPresentation(object.kind)')
    && babylonWorldSource.includes('hazardWorldPresentation(hazard.kind)')
    && babylonWorldSource.includes('groundLootPresentation(drop.rarity)')
    && babylonWorldSource.includes('biomeWorldState(mission.location, state)')
    && babylonWorldSource.includes('materialWorldResponse(object.material)')
    && babylonWorldSource.includes('p27-b5-interactable-ring-')
    && babylonWorldSource.includes('p27-b5-objective-ring')
    && babylonWorldSource.includes('p27-b5-hazard-ring-')
    && babylonWorldSource.includes('p27-b5-breach-')
    && babylonWorldSource.includes('p27-b5-loot-beam-')
    && babylonWorldSource.includes("this.canvas.dataset.worldPresentationMode = 'scene-meshes-not-hud'")
    && babylonWorldSource.includes("this.canvas.dataset.interactableReadability = 'shape-coded+state-emissive+floor-cue:quality-safe'")
    && babylonWorldSource.includes("this.canvas.dataset.hazardReadability = 'shape-coded+floor-bound+quality-safe'")
    && babylonWorldSource.includes("this.canvas.dataset.lootReadability = 'authored-capsule+rarity-shape+ring+beam'")
    && babylonWorldSource.includes("this.canvas.dataset.worldStateVisual = 'floor-signal+breach-rings'"),
  'P27-B5 Babylon renderer must port refinery mission objects, authored interactables, in-world objective guidance, hazards, loot, breach/world-state decoration, and shared readability contracts without HUD-only substitution or simulation changes.',
);

assert(
  babylonRendererSource.includes("from './babylonWeaponVfx'")
    && babylonRendererSource.includes('new BabylonWeaponVfx(scene, canvas, coarse)')
    && babylonRendererSource.includes('this.weaponVfx.sync(state, muzzlePosition, quality)')
    && babylonRendererSource.includes("this.weaponVfx.release('scenario-exit')")
    && babylonRendererSource.includes('this.weaponVfx.dispose()')
    && babylonWeaponVfxSource.includes("from './classArsenal'")
    && babylonWeaponVfxSource.includes('weaponHandlingProfiles')
    && babylonWeaponVfxSource.includes('state.weaponFlash')
    && babylonWeaponVfxSource.includes('state.projectiles')
    && babylonWeaponVfxSource.includes("effect.kind !== 'impact'")
    && babylonWeaponVfxSource.includes('state.impactEvent')
    && babylonWeaponVfxSource.includes('p27-b6-muzzle-flash')
    && babylonWeaponVfxSource.includes('p27-b6-projectile-core-')
    && babylonWeaponVfxSource.includes('p27-b6-impact-ring-')
    && babylonWeaponVfxSource.includes("this.canvas.dataset.babylonWeaponVfxFamilies = 'breacher,carbine,rail'")
    && babylonWeaponVfxSource.includes("this.canvas.dataset.babylonWeaponDamageFeedback")
    && babylonWeaponVfxSource.includes("effectsMode === 'reduced' ? 0 : 0.78 * fade")
    && !babylonWeaponVfxSource.includes('fireCurrent(')
    && packageJson.scripts['test:babylon-weapon-vfx']
    && packageJson.scripts.build.includes('npm run test:babylon-weapon-vfx'),
  'P27-B6 Babylon renderer must drive muzzle, three-family projectile/beam, impact, and damage-feedback VFX from existing simulation/presentation state while preserving reduced-effects priority and simulation ownership.',
);

assert(
  webgpuRendererSource.includes("from './refineryIbl'")
    && webgpuRendererSource.includes("from './refineryBloom'")
    && webgpuRendererSource.includes("from './refineryContactDepth'")
    && webgpuRendererSource.includes("from './refineryAtmosphere'")
    && webgpuRendererSource.includes('new this.THREE.RenderPipeline(this.renderer)')
    && webgpuRendererSource.includes('this.renderPipeline && this.bloomEnabled')
    && webgpuRendererSource.includes('else this.renderer.render(this.scene, this.camera)')
    && webgpuRendererSource.includes('webgpuCaptureRequest')
    && webgpuRendererSource.includes('readRenderTargetPixelsAsync')
    && webgpuRendererSource.includes('toDataURL(\'image/png\')')
    && webgpuRendererSource.includes('TSL.mrt({')
    && webgpuRendererSource.includes('emissive: TSL.vec4(TSL.emissive, TSL.output.a)')
    && webgpuRendererSource.includes("setBlendMode('emissive', new this.THREE.BlendMode(this.THREE.NormalBlending))")
    && webgpuRendererSource.includes("scenePass.getTexture('emissive')")
    && webgpuRendererSource.includes('emissiveTexture.type = this.THREE.UnsignedByteType')
    && webgpuRendererSource.includes('setResolutionScale(refineryBloomResolutionScale(costScale))')
    && webgpuRendererSource.includes('createRefineryContactDepthAlphaData()')
    && webgpuRendererSource.includes('refineryAtmosphereTelemetry')
    && webgpuRendererSource.includes('new AdaptiveRenderBudget(coarse)')
    && webgpuRendererSource.includes('environmentP21Budget')
    && webgpuRendererSource.includes('webgpuEffectParity')
    && webgpuRendererSource.includes('webgpuParityGaps')
    && webgpuRendererSource.includes('ibl-pmrem-generator-webgl-only:bounded-light-proxy')
    && webgpuRendererSource.includes('authored-refinery-webgpu-p21f2'),
  'P21-F2 WebGPU refinery path must reproduce the P21-B-E effect contracts with WebGPU-native selective bloom, bounded contact/atmosphere/adaptive scaling, and explicit parity gaps.',
);

assert(
  gameCanvasSource.includes('resolveCombatGraphicsPathSelection(window.location.search)')
    && gameCanvasSource.includes('canvas.dataset.graphicsPathSelection = graphicsPathSelection.mode')
    && gameCanvasSource.includes("canvas.dataset.graphicsPathRequested = graphicsPathSelection.requestedId ?? ''")
    && gameCanvasSource.includes('canvas.dataset.graphicsPathLoaded = loadedGraphicsPath')
    && gameCanvasSource.includes("${activeMissionRef.current.location}:${compactLayout ? 'touch' : 'pointer'}:${loadedGraphicsPath}"),
  'P21-A2 combat telemetry must expose requested/loaded path alongside the existing performance scenario without touching simulation state.',
);
assert(
  browserSmokeSource.includes("process.env.BROWSER_E2E_GRAPHICS_PATH")
    && browserSmokeSource.includes("process.env.BROWSER_E2E_BABYLON_BACKEND")
    && browserSmokeSource.includes("process.env.BROWSER_E2E_REQUIRE_BABYLON_WEBGPU === '1'")
    && browserSmokeSource.includes("requireBabylonWebGpuComparison && state.backendLoaded !== 'webgpu'")
    && browserSmokeSource.includes("url.searchParams.set('graphicsCompare', '1')")
    && browserSmokeSource.includes("url.searchParams.set('graphicsPath', requestedGraphicsPath)")
    && browserSmokeSource.includes("url.searchParams.set('babylonBackend', requestedBabylonBackend)")
    && browserSmokeSource.includes('graphicsPathLoaded: canvas.dataset.graphicsPathLoaded')
    && browserSmokeSource.includes('BROWSER_P21A2_GRAPHICS_PATH_PASS')
    && browserSmokeSource.includes('BROWSER_P21F1_WEBGPU_PASS')
    && browserSmokeSource.includes('BROWSER_P21F2_REFINERY_PARITY_PASS')
    && browserSmokeSource.includes('BROWSER_P27A2_BABYLON_PASS')
    && browserSmokeSource.includes('BROWSER_P27D1_BABYLON_WEBGPU_PASS')
    && browserSmokeSource.includes('babylonBackendRequested')
    && browserSmokeSource.includes('babylonBackendLoaded')
    && browserSmokeSource.includes('babylonBackendFallback')
    && browserSmokeSource.includes('BROWSER_P27B1_BABYLON_CAMERA_INPUT_PASS')
    && browserSmokeSource.includes('BROWSER_P27B4_BABYLON_ENEMY_PASS')
    && browserSmokeSource.includes('BROWSER_P27B6_BABYLON_WEAPON_VFX_PASS')
    && browserSmokeSource.includes('babylonWeaponShotCount')
    && browserSmokeSource.includes('babylonWeaponDamageFeedback')
    && browserSmokeSource.includes('babylonCameraParity')
    && browserSmokeSource.includes('babylonInputParity')
    && browserSmokeSource.includes('babylonPointerDirection')
    && browserSmokeSource.includes("await p21F2RefineryParityAudit('webgl2')")
    && browserSmokeSource.includes("await p21F2RefineryParityAudit('webgpu')")
    && browserSmokeSource.includes("canvas.dataset.refineryIblQa = 'off'")
    && browserSmokeSource.includes("canvas.dataset.refineryBloomQa = 'off'")
    && browserSmokeSource.includes("canvas.dataset.refineryContactDepthQa = 'off'")
    && browserSmokeSource.includes("canvas.dataset.refineryAtmosphereQa = 'off'")
    && browserSmokeSource.includes("call('Input.dispatchTouchEvent'")
    && browserSmokeSource.includes("type: 'touchStart'")
    && browserSmokeSource.includes("type: 'touchEnd'"),
  'P21-A2 browser QA must reuse the existing deterministic runtime smoke as the explicit comparison entry point.',
);
assert(
  refineryVerifierSource.includes("graphicsPathLoaded !== 'webgl2'")
    && refineryVerifierSource.includes('renderFrameMs: canvas.dataset.renderFrameMs')
    && refineryVerifierSource.includes('renderFrameBudget: canvas.dataset.renderFrameBudget'),
  'P21-A2 refinery verification must keep path, frame, and adaptive-tier telemetry on the existing showcase.',
);
assert(
  browserWorkflowSource.includes('BROWSER_E2E_GRAPHICS_PATH=webgl2 node scripts/browser-runtime-smoke.mjs')
    && browserWorkflowSource.includes('BROWSER_E2E_GRAPHICS_PATH=webgpu')
    && browserWorkflowSource.includes('BROWSER_E2E_GRAPHICS_PATH=babylon')
    && browserWorkflowSource.includes('BROWSER_E2E_BABYLON_BACKEND=webgpu')
    && browserWorkflowSource.includes('p27a2-babylon.png')
    && browserWorkflowSource.includes('p27d1-babylon-webgpu.png')
    && browserWorkflowSource.includes('p21f1-webgpu.png')
    && browserWorkflowSource.includes('p21f2-stack-*.png')
    && browserWorkflowSource.includes('--enable-unsafe-webgpu')
    && browserWorkflowSource.includes('--use-webgpu-adapter=swiftshader')
    && browserWorkflowSource.includes('--use-vulkan=swiftshader')
    && browserWorkflowSource.includes('vk_swiftshader_icd.json')
    && browserWorkflowSource.includes('--headless=new')
    && browserWorkflowSource.includes('puppeteer-core@24.26.1')
    && browserWorkflowSource.includes("import puppeteer from 'puppeteer-core'")
    && browserWorkflowSource.includes('puppeteer.launch({')
    && browserWorkflowSource.includes('headless: false')
    && browserWorkflowSource.includes('VK_DRIVER_FILES')
    && browserWorkflowSource.includes("lvp_icd.json")
    && browserWorkflowSource.includes('xvfb-run -a -s "-screen 0 1280x720x24"')
    && browserWorkflowSource.includes("BROWSER_E2E_REQUIRE_WEBGPU: '1'")
    && browserWorkflowSource.includes('lavapipe-xvfb-black-canvas')
    && browserWorkflowSource.includes("'--ozone-platform=x11'")
    && !browserWorkflowSource.includes("'--disable-vulkan-surface'")
    && browserWorkflowSource.includes('P21-F2 desktop Chrome mode: puppeteer-headed-xvfb')
    && browserWorkflowSource.includes('BROWSER_E2E_REQUIRE_WEBGPU')
    && browserWorkflowSource.includes('BROWSER_E2E_WEBGPU_SWIFTSHADER')
    && browserWorkflowSource.includes('--use-gpu-in-tests')
    && browserSmokeSource.includes("process.env.BROWSER_E2E_REQUIRE_WEBGPU === '1'")
    && browserSmokeSource.includes("process.env.BROWSER_E2E_WEBGPU_SWIFTSHADER === '1'")
    && browserWorkflowSource.includes('BROWSER_E2E_SKIP_SYNTHETIC_CONTROLLER')
    && browserSmokeSource.includes("process.env.BROWSER_E2E_SKIP_SYNTHETIC_CONTROLLER === '1'")
    && browserSmokeSource.includes('controller=skipped-headed-webgpu-ci')
    && browserSmokeSource.includes('P21-F2 requires a real WebGPU desktop comparison')
    && browserSmokeSource.includes("message === 'OperationError: Instance dropped in popErrorScope'")
    && browserSmokeSource.includes('BROWSER_P21F2_WEBGPU_KNOWN_CI_GAP')
    && browserSmokeSource.includes("requestedGraphicsPath !== 'webgpu'")
    && browserSmokeSource.includes('phase=prior-page-disposal')
    && browserSmokeSource.includes('staleScopeDrops')
    && browserSmokeSource.includes('unexpectedWebGpuExceptions')
    && browserSmokeSource.includes('webgpuFallbackReason')
    && browserSmokeSource.includes('P21-F2 WebGPU stack-off/stack-on captures are pixel-identical')
    && browserSmokeSource.includes('BROWSER_P21F2_RAW_WEBGPU_PRESENTATION_PASS')
    && browserSmokeSource.includes('BROWSER_P21F2_WEBGPU_PRESENTATION_KNOWN_GAP')
    && browserSmokeSource.includes('captureWebGpuRendererFrame')
    && browserSmokeSource.includes('capture.maxChannel <= 12')
    && browserSmokeSource.includes('capture.nonBlackRatio <= 0.001')
    && browserSmokeSource.includes("error === \"Cannot read properties of undefined (reading 'format')\"")
    && browserSmokeSource.includes('BROWSER_P21F2_WEBGPU_READBACK_KNOWN_GAP')
    && browserSmokeSource.includes('three-r186-render-target-descriptor')
    && browserSmokeSource.includes('P21-F2 WebGPU renderer capture is blank')
    && browserSmokeSource.includes('BROWSER_P21F2_WEBGPU_CAPTURE_PASS'),
  'P21-F2 Browser E2E must preserve explicit WebGL2/WebGPU QA paths and retain deterministic stack-off/stack-on comparison evidence.',
);
assert(
  androidSmokeSource.includes('ANDROID_P21A2_GRAPHICS_PATH_PASS selection=production-default requested=none loaded=webgl2')
    && androidSmokeSource.includes("p21a2GraphicsPath.selection !== 'production-default'")
    && androidSmokeSource.includes("p21a2GraphicsPath.loaded !== 'webgl2'"),
  'P21-A2 Android smoke must verify that production still loads WebGL2 without the QA selector.',
);

const renderStart = rendererSource.indexOf('  render(state: SimState');
const statsStart = rendererSource.indexOf('  performanceStats()', renderStart);
const renderPath = rendererSource.slice(renderStart, statsStart);
assert(
  renderStart >= 0
    && statsStart > renderStart
    && renderPath.includes('this.resize(width, height, quality, budget)')
    && renderPath.includes('this.renderer.render(this.scene, this.camera)'),
  'P21-A1 renderer render path must retain the existing resize-before-render lifecycle.',
);

const resizeStart = rendererSource.indexOf('  private resize(width: number');
const resizeEnd = rendererSource.indexOf('  private addMegastructureInstanceBatch', resizeStart);
const resizePath = rendererSource.slice(resizeStart, resizeEnd);
assert(
  resizeStart >= 0
    && resizeEnd > resizeStart
    && resizePath.includes('this.renderer.setPixelRatio(nextRatio)')
    && resizePath.includes('this.renderer.setSize(this.width, this.height, false)')
    && resizePath.includes('this.camera.updateProjectionMatrix()'),
  'P21-A1 resize lifecycle must preserve pixel-ratio, canvas-size, and projection updates.',
);

const directionStart = rendererSource.indexOf('  screenDirection(');
const disposeStart = rendererSource.indexOf('  dispose()', directionStart);
const directionPath = rendererSource.slice(directionStart, disposeStart);
assert(
  directionStart >= 0
    && disposeStart > directionStart
    && directionPath.includes('((clientX - rect.left) / rect.width) * 2 - 1')
    && directionPath.includes('-((clientY - rect.top) / rect.height) * 2 + 1')
    && directionPath.includes('this.raycaster.setFromCamera(pointer, this.camera)')
    && directionPath.includes('this.raycaster.ray.intersectPlane(this.groundPlane, hit)')
    && directionPath.includes('return length > 0.01 ? { x: dx / length, y: dy / length } : null'),
  'P21-A1 pointer-direction behavior must retain NDC projection, ground-plane raycast, and normalized world direction.',
);

const disposeEnd = rendererSource.indexOf('  private scheduleRuntimeAssetPreload', disposeStart);
const disposePath = rendererSource.slice(disposeStart, disposeEnd);
assert(
  disposeStart >= 0
    && disposeEnd > disposeStart
    && disposePath.includes('disposeTree(this.scene)')
    && disposePath.includes('this.renderer.dispose()'),
  'P21-A1 renderer disposal must continue reclaiming scene and WebGL resources.',
);

console.log('P21_A1_GRAPHICS_BACKEND_PASS default=webgl2 create=boundary render=delegated resize=preserved pointer=preserved dispose=preserved fallback=canvas2d');
console.log('P27_A1_NEUTRAL_GRAPHICS_CONTRACT_PASS render=explicit stats=explicit pointer=explicit lifecycle=explicit loaded=explicit webgl2=implemented webgpu=implemented');
console.log('P27_A2_BABYLON_QA_BACKEND_PASS production=webgl2 qa=babylon lazy=true default=webgl2 telemetry=init+backend+scene+frames+dispose dependencies=core+loaders-pinned');
console.log('P27_D1_BABYLON_WEBGPU_BACKEND_PASS qa=optional-webgpu fallback=babylon-webgl2 three-fallback=disabled selection=pre-scene telemetry=requested+loaded+fallback android=webgl2-required');
console.log('P27_B1_BABYLON_CAMERA_INPUT_PASS camera=three-combat-v1 resize=explicit-pixel-ratio input=ground-plane-raycast-v1 feedback=shared simulation=unchanged');
console.log('P27_B2_BABYLON_REFINERY_ENVIRONMENT_PASS kit=11 placements=three-parity lod=shared-runtime reuse=shared-resources cleanup=generation+release telemetry=asset+scene collision=unchanged');
console.log('P27_B3_BABYLON_OPERATOR_WEAPON_PASS classes=3 weapons=3 rig=articulated socket=weapon-socket handling=shared variant=shared thermal=shared muzzle=authored-socket accents=emissive cleanup=generation+release simulation=unchanged');
console.log('P27_B5_BABYLON_WORLD_PRESENTATION_PASS objects=sim-state interactables=authored+shape-state objective=beacon+path hazards=shared-shapes loot=authored+rarity breach=world-state cleanup=deterministic simulation=unchanged');
console.log('P27_B6_BABYLON_WEAPON_VFX_BOUNDARY_PASS muzzle=authored-socket projectiles=sim-state impacts=shared-event reduced=secondary-sparks-only simulation=unchanged');
console.log('P21_A2_GRAPHICS_PATH_HARNESS_PASS selector=opt-in explicit=webgl2 refinery=existing-route telemetry=path+drawcalls+triangles+frame+tier android=production-default');
console.log('P21_F1_WEBGPU_REFINERY_BACKEND_PASS production=webgl2 qa=webgpu lazy=true fallback=webgl2 assets=glb+ktx2+meshopt tsl=node-material camera=parity input=parity teardown=dispose');
console.log('P21_F2_WEBGPU_REFINERY_PARITY_PASS stack=ibl-proxy+selective-bloom+contact-depth+atmosphere budget=adaptive captures=webgl2+webgpu gaps=explicit production=webgl2');
