import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createCombatGraphicsBackend,
  productionCombatGraphicsBackendId,
  selectCombatGraphicsBackendFactory,
  type CombatGraphicsBackend,
  type CombatGraphicsBackendFactory,
} from '../src/game/combatGraphicsBackend';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(productionCombatGraphicsBackendId === 'webgl2', 'P21-A1 production graphics backend must remain WebGL2.');

const fakeBackend = {
  id: 'webgl2',
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

const root = process.cwd();
const gameCanvasSource = readFileSync(resolve(root, 'src/components/GameCanvas.tsx'), 'utf8');
const boundarySource = readFileSync(resolve(root, 'src/game/combatGraphicsBackend.ts'), 'utf8');
const rendererSource = readFileSync(resolve(root, 'src/game/threeCombatRenderer.ts'), 'utf8');

assert(
  gameCanvasSource.includes("createCombatGraphicsBackend(canvas, coarse)")
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
