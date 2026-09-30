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
  babylonPath.mode === 'qa-explicit' && babylonPath.requestedId === 'babylon' && babylonPath.selectedId === 'babylon',
  'P27-A2 comparison mode must expose Babylon only behind the explicit QA selector.',
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
const supportedBabylonFactory = {
  id: 'babylon',
  isSupported: () => true,
  create: () => fakeBabylonBackend,
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
  babylonCombatGraphicsBackendFactory.id === 'babylon',
  'P27-A2 Babylon factory must remain isolated from the production backend id.',
);

const root = process.cwd();
const gameCanvasSource = readFileSync(resolve(root, 'src/components/GameCanvas.tsx'), 'utf8');
const boundarySource = readFileSync(resolve(root, 'src/game/combatGraphicsBackend.ts'), 'utf8');
const rendererSource = readFileSync(resolve(root, 'src/game/threeCombatRenderer.ts'), 'utf8');
const webgpuRendererSource = readFileSync(resolve(root, 'src/game/webGpuRefineryRenderer.ts'), 'utf8');
const babylonRendererSource = readFileSync(resolve(root, 'src/game/babylonCombatRenderer.ts'), 'utf8');
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const browserSmokeSource = readFileSync(resolve(root, 'scripts/browser-runtime-smoke.mjs'), 'utf8');
const refineryVerifierSource = readFileSync(resolve(root, 'scripts/verify-authored-refinery.mjs'), 'utf8');
const androidSmokeSource = readFileSync(resolve(root, 'scripts/android-runtime-smoke.mjs'), 'utf8');
const browserWorkflowSource = readFileSync(resolve(root, '.github/workflows/browser-e2e.yml'), 'utf8');

assert(
  gameCanvasSource.includes("createCombatGraphicsBackend(canvas, compactLayout, undefined, graphicsPathSelection.selectedId)")
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

assert(
  boundarySource.includes("await import('./babylonCombatRenderer')")
    && boundarySource.includes("babylon->webgl2:init-fallback")
    && boundarySource.includes("canvas.dataset.babylonInit = 'initializing'")
    && boundarySource.includes("canvas.dataset.babylonDisposed = 'true'")
    && boundarySource.includes("typeof WebGL2RenderingContext !== 'undefined'"),
  'P27-A2 backend boundary must lazy-load Babylon only for QA, expose lifecycle telemetry, and preserve production WebGL2 fallback.',
);
assert(
  babylonRendererSource.includes("from '@babylonjs/core/Engines/engine'")
    && babylonRendererSource.includes("from '@babylonjs/core/scene'")
    && babylonRendererSource.includes('new Engine(canvas, !coarse')
    && babylonRendererSource.includes('engine.webGLVersion !== 2')
    && babylonRendererSource.includes('new Scene(engine)')
    && babylonRendererSource.includes('this.scene.render()')
    && babylonRendererSource.includes('this.scene.dispose()')
    && babylonRendererSource.includes('this.engine.dispose()')
    && babylonRendererSource.includes("canvas.dataset.babylonBackend = 'webgl2'")
    && babylonRendererSource.includes("canvas.dataset.babylonScene = 'active'")
    && babylonRendererSource.includes("this.canvas.dataset.babylonScene = 'disposed'")
    && !babylonRendererSource.includes('ThreeCombatRenderer')
    && !babylonRendererSource.includes("from './sim'"),
  'P27-A2 Babylon renderer must own only a WebGL2 Babylon scene/render/dispose lifecycle without taking simulation or Three.js ownership.',
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
    && babylonRendererSource.includes('new Engine(canvas, !coarse')
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
    && babylonRendererSource.includes("canvas.dataset.babylonCameraParity = 'three-combat-v1'")
    && babylonRendererSource.includes("canvas.dataset.babylonInputParity = 'ground-plane-raycast-v1'")
    && babylonRendererSource.includes('this.canvas.dataset.babylonPointerDirection')
    && babylonRendererSource.includes('this.canvas.dataset.babylonViewport')
    && babylonRendererSource.includes('this.canvas.dataset.cameraFeedback'),
  'P27-B1 Babylon renderer must match the production camera framing, explicit pixel-ratio resize, feedback offsets, and normalized ground-plane pointer projection.',
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
    && browserSmokeSource.includes("url.searchParams.set('graphicsCompare', '1')")
    && browserSmokeSource.includes("url.searchParams.set('graphicsPath', requestedGraphicsPath)")
    && browserSmokeSource.includes('graphicsPathLoaded: canvas.dataset.graphicsPathLoaded')
    && browserSmokeSource.includes('BROWSER_P21A2_GRAPHICS_PATH_PASS')
    && browserSmokeSource.includes('BROWSER_P21F1_WEBGPU_PASS')
    && browserSmokeSource.includes('BROWSER_P21F2_REFINERY_PARITY_PASS')
    && browserSmokeSource.includes('BROWSER_P27A2_BABYLON_PASS')
    && browserSmokeSource.includes('BROWSER_P27B1_BABYLON_CAMERA_INPUT_PASS')
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
    && browserWorkflowSource.includes('p27a2-babylon.png')
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
console.log('P27_A2_BABYLON_QA_BACKEND_PASS production=webgl2 qa=babylon lazy=true webgl2-only=true fallback=webgl2 telemetry=init+backend+scene+frames+dispose dependencies=core+loaders-pinned');
console.log('P27_B1_BABYLON_CAMERA_INPUT_PASS camera=three-combat-v1 resize=explicit-pixel-ratio input=ground-plane-raycast-v1 feedback=shared simulation=unchanged');
console.log('P21_A2_GRAPHICS_PATH_HARNESS_PASS selector=opt-in explicit=webgl2 refinery=existing-route telemetry=path+drawcalls+triangles+frame+tier android=production-default');
console.log('P21_F1_WEBGPU_REFINERY_BACKEND_PASS production=webgl2 qa=webgpu lazy=true fallback=webgl2 assets=glb+ktx2+meshopt tsl=node-material camera=parity input=parity teardown=dispose');
console.log('P21_F2_WEBGPU_REFINERY_PARITY_PASS stack=ibl-proxy+selective-bloom+contact-depth+atmosphere budget=adaptive captures=webgl2+webgpu gaps=explicit production=webgl2');
