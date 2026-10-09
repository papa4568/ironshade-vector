import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  babylonCombatGraphicsBackendFactory,
  createCombatGraphicsBackend,
  productionCombatGraphicsBackendId,
  resolveCombatGraphicsPathSelection,
  selectCombatGraphicsBackendFactory,
  type CombatGraphicsBackend,
  type CombatGraphicsBackendFactory,
} from '../src/game/combatGraphicsBackend';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(productionCombatGraphicsBackendId === 'babylon', 'P27-D8 production graphics backend must remain Babylon.');

const productionPath = resolveCombatGraphicsPathSelection('');
const ignoredLegacyWebGlPath = resolveCombatGraphicsPathSelection('?graphicsCompare=1&graphicsPath=webgl2');
const ignoredLegacyWebGpuPath = resolveCombatGraphicsPathSelection('?graphicsCompare=1&graphicsPath=webgpu');
const babylonPath = resolveCombatGraphicsPathSelection('?graphicsCompare=1&graphicsPath=babylon');
const babylonWebGpuPath = resolveCombatGraphicsPathSelection('?graphicsCompare=1&graphicsPath=babylon&babylonBackend=webgpu');
const babylonInvalidBackendPath = resolveCombatGraphicsPathSelection('?graphicsCompare=1&graphicsPath=babylon&babylonBackend=metal');
const unknownPath = resolveCombatGraphicsPathSelection('?graphicsCompare=1&graphicsPath=metal');

assert(
  productionPath.mode === 'production-default'
    && productionPath.requestedId === null
    && productionPath.selectedId === 'babylon'
    && productionPath.babylonBackendRequested === 'webgl2',
  'P27-D8 production selection must deterministically use Babylon WebGL2.',
);
assert(
  ignoredLegacyWebGlPath.mode === 'production-default'
    && ignoredLegacyWebGlPath.requestedId === null
    && ignoredLegacyWebGlPath.selectedId === 'babylon'
    && ignoredLegacyWebGlPath.babylonBackendRequested === 'webgl2',
  'P27-D8 retired Three WebGL2 QA requests must not select a legacy renderer.',
);
assert(
  ignoredLegacyWebGpuPath.mode === 'production-default'
    && ignoredLegacyWebGpuPath.requestedId === null
    && ignoredLegacyWebGpuPath.selectedId === 'babylon'
    && ignoredLegacyWebGpuPath.babylonBackendRequested === 'webgl2',
  'P27-D8 retired P21 WebGPU QA requests must not select a legacy renderer.',
);
assert(
  babylonPath.mode === 'qa-explicit'
    && babylonPath.requestedId === 'babylon'
    && babylonPath.selectedId === 'babylon'
    && babylonPath.babylonBackendRequested === 'webgl2',
  'P27-D8 explicit Babylon comparison mode must keep Babylon WebGL2 available for renderer-neutral QA.',
);
assert(
  babylonWebGpuPath.mode === 'qa-explicit'
    && babylonWebGpuPath.requestedId === 'babylon'
    && babylonWebGpuPath.selectedId === 'babylon'
    && babylonWebGpuPath.babylonBackendRequested === 'webgpu',
  'P27-D8 renderer-neutral QA must preserve optional Babylon WebGPU selection.',
);
assert(
  babylonInvalidBackendPath.babylonBackendRequested === 'webgl2',
  'P27-D8 unknown Babylon engine requests must deterministically use Babylon WebGL2.',
);
assert(
  unknownPath.mode === 'production-default'
    && unknownPath.requestedId === null
    && unknownPath.selectedId === 'babylon',
  'P27-D8 unknown graphics paths must remain on the production Babylon path.',
);

const fakeBabylonBackend = {
  id: 'babylon',
  loadedId: 'babylon',
  render: () => undefined,
  performanceStats: () => ({ drawCalls: 17, triangles: 1234 }),
  screenDirection: () => ({ x: 1, y: 0 }),
  dispose: () => undefined,
} as CombatGraphicsBackend;

let createCount = 0;
let capturedBabylonBackend: 'webgl2' | 'webgpu' | null = null;
const supportedBabylonFactory = {
  id: 'babylon',
  isSupported: () => true,
  create: (_canvas, _coarse, options) => {
    createCount += 1;
    capturedBabylonBackend = options?.babylonBackend ?? null;
    return fakeBabylonBackend;
  },
} as CombatGraphicsBackendFactory;
const unsupportedBabylonFactory = {
  id: 'babylon',
  isSupported: () => false,
  create: () => {
    throw new Error('unsupported Babylon factory must not create a renderer');
  },
} as CombatGraphicsBackendFactory;

assert(
  selectCombatGraphicsBackendFactory([supportedBabylonFactory]) === supportedBabylonFactory,
  'P27-D8 default backend selection must choose the supported Babylon factory.',
);
assert(
  selectCombatGraphicsBackendFactory([unsupportedBabylonFactory]) === null,
  'P27-D8 unsupported Babylon must fail closed so the Canvas 2D safety renderer can take over.',
);
assert(
  createCombatGraphicsBackend(
    {} as HTMLCanvasElement,
    false,
    [supportedBabylonFactory],
    productionPath.selectedId,
    { babylonBackend: productionPath.babylonBackendRequested },
  ) === fakeBabylonBackend
    && capturedBabylonBackend === 'webgl2'
    && createCount === 1,
  'P27-D8 production creation must instantiate Babylon WebGL2 exactly once.',
);
assert(
  createCombatGraphicsBackend(
    {} as HTMLCanvasElement,
    false,
    [supportedBabylonFactory],
    babylonWebGpuPath.selectedId,
    { babylonBackend: babylonWebGpuPath.babylonBackendRequested },
  ) === fakeBabylonBackend
    && capturedBabylonBackend === 'webgpu'
    && createCount === 2,
  'P27-D8 explicit Babylon WebGPU QA must use the same Babylon renderer boundary.',
);
assert(
  createCombatGraphicsBackend(
    {} as HTMLCanvasElement,
    false,
    [unsupportedBabylonFactory],
    productionPath.selectedId,
    { babylonBackend: productionPath.babylonBackendRequested },
  ) === null,
  'P27-D8 unavailable Babylon must return null for the existing Canvas 2D safety path.',
);
assert(
  babylonCombatGraphicsBackendFactory.id === 'babylon',
  'P27-D8 the concrete runtime factory must be Babylon.',
);

const root = process.cwd();
const boundarySource = readFileSync(resolve(root, 'src/game/combatGraphicsBackend.ts'), 'utf8');
const gameCanvasSource = readFileSync(resolve(root, 'src/components/GameCanvas.tsx'), 'utf8');
const babylonRendererSource = readFileSync(resolve(root, 'src/game/babylonCombatRenderer.ts'), 'utf8');
const browserWorkflowSource = readFileSync(resolve(root, '.github/workflows/browser-e2e.yml'), 'utf8');

assert(
  boundarySource.includes("export type CombatGraphicsBackendId = 'babylon'")
    && boundarySource.includes("productionCombatGraphicsBackendId: CombatGraphicsBackendId = 'babylon'")
    && boundarySource.includes("import('./babylonCombatRenderer')")
    && boundarySource.includes('factories: readonly CombatGraphicsBackendFactory[] = [babylonCombatGraphicsBackendFactory]')
    && !boundarySource.includes('ThreeCombatRenderer')
    && !boundarySource.includes("./threeCombatRenderer")
    && !boundarySource.includes("./webGpuRefineryRenderer")
    && !boundarySource.includes('webgl2CombatGraphicsBackendFactory')
    && !boundarySource.includes('webgpuRefineryCombatGraphicsBackendFactory'),
  'P27-D8 runtime boundary must contain only the Babylon combat renderer path.',
);
assert(
  boundarySource.includes('export type CombatGraphicsRenderArgs = [')
    && boundarySource.includes('export type CombatGraphicsPerformanceStats = {')
    && boundarySource.includes('export type CombatGraphicsPointerProjectionArgs = [')
    && boundarySource.includes('performanceStats(): CombatGraphicsPerformanceStats')
    && boundarySource.includes('screenDirection(...args: CombatGraphicsPointerProjectionArgs): CombatGraphicsPointerDirection'),
  'P27-D8 renderer-neutral render, performance, pointer, and lifecycle measurements must remain on the backend contract.',
);
assert(
  boundarySource.includes('requestedBackend: BabylonGraphicsBackendId')
    && boundarySource.includes("'webgpu',\n          this.canvas,\n          reason =>")
    && boundarySource.includes("await createBabylonCombatRenderer(this.canvas, this.coarse, 'webgl2', this.canvas)")
    && boundarySource.includes("renderDeviceClassPolicy = coarse ? 'flagship-default:coarse-hint-ignored' : 'flagship-default'")
    && babylonRendererSource.includes('const qualityCoarse = false')
    && boundarySource.includes('fallbackFromWebGpu(reason)')
    && boundarySource.includes('webgpu->webgl2:runtime-device-lost')
    && boundarySource.includes('createWebGpuRenderSurface()'),
  'P27-D8 Babylon WebGPU QA and deterministic Babylon WebGL2 fallback must remain available while P28-A0 removes coarse-device render ceilings.',
);
assert(
  gameCanvasSource.includes('createCombatGraphicsBackend(canvas, compactLayout')
    && gameCanvasSource.includes('graphicsBackend?.performanceStats()')
    && gameCanvasSource.includes('graphicsBackendRef.current?.screenDirection(')
    && !gameCanvasSource.includes('new ThreeCombatRenderer('),
  'P27-D8 combat runtime and renderer-neutral QA measurements must continue through the backend boundary.',
);
assert(
  babylonRendererSource.includes('implements CombatGraphicsBackend')
    && babylonRendererSource.includes('performanceStats(): CombatGraphicsPerformanceStats')
    && babylonRendererSource.includes('screenDirection(...args: CombatGraphicsPointerProjectionArgs): CombatGraphicsPointerDirection')
    && !babylonRendererSource.includes('ThreeCombatRenderer'),
  'P27-D8 Babylon renderer must remain independent of the retired Three combat renderer.',
);
assert(
  !browserWorkflowSource.includes('BROWSER_E2E_GRAPHICS_PATH=webgl2')
    && !browserWorkflowSource.includes('BROWSER_E2E_GRAPHICS_PATH=webgpu')
    && browserWorkflowSource.includes('BROWSER_E2E_GRAPHICS_PATH=babylon')
    && browserWorkflowSource.includes('BROWSER_E2E_BABYLON_BACKEND=webgpu'),
  'P27-D8 browser QA must stop exercising retired Three paths while preserving Babylon WebGL2/WebGPU coverage.',
);

console.log('P27-D8 graphics backend retirement passed');
