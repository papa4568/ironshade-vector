import type { ThreeCombatRenderer } from './threeCombatRenderer';
import { REFINERY_ASSET_FAMILIES } from './graphicsAssetManifest';
import {
  configureGraphicsAssetRenderer,
  instantiateGraphicsAsset,
  selectGraphicsAssetSpec,
  type GraphicsAssetInstance,
} from './graphicsAssets';

const WORLD_SCALE = 0.02;
const FLOOR_Y = 0;
const PROTOTYPE_ASSET_KEYS = ['floor', 'processor', 'terminal'] as const;

type RenderArgs = Parameters<ThreeCombatRenderer['render']>;
type ScreenDirectionArgs = Parameters<ThreeCombatRenderer['screenDirection']>;
export type WebGpuRefineryLoadedPath = 'webgpu' | 'webgl2';

export class WebGpuRefineryRenderer {
  readonly id = 'webgpu' as const;
  readonly loadedId: WebGpuRefineryLoadedPath;

  private readonly canvas: HTMLCanvasElement;
  private readonly coarse: boolean;
  private readonly THREE: typeof import('three/webgpu');
  private readonly renderer: InstanceType<typeof import('three/webgpu')['WebGPURenderer']>;
  private readonly scene: InstanceType<typeof import('three/webgpu')['Scene']>;
  private readonly camera: InstanceType<typeof import('three/webgpu')['PerspectiveCamera']>;
  private readonly raycaster: InstanceType<typeof import('three/webgpu')['Raycaster']>;
  private readonly groundPlane: InstanceType<typeof import('three/webgpu')['Plane']>;
  private readonly playerRoot: InstanceType<typeof import('three/webgpu')['Group']>;
  private readonly ownedGeometry: Array<{ dispose(): void }> = [];
  private readonly ownedMaterial: Array<{ dispose(): void }> = [];
  private readonly assets: GraphicsAssetInstance[] = [];
  private disposed = false;
  private width = 1;
  private height = 1;
  private pixelRatio = 1;

  private constructor(
    canvas: HTMLCanvasElement,
    coarse: boolean,
    THREE: typeof import('three/webgpu'),
    renderer: InstanceType<typeof import('three/webgpu')['WebGPURenderer']>,
  ) {
    this.canvas = canvas;
    this.coarse = coarse;
    this.THREE = THREE;
    this.renderer = renderer;
    const backend = renderer.backend as { isWebGPUBackend?: boolean };
    this.loadedId = backend?.isWebGPUBackend ? 'webgpu' : 'webgl2';

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x101518);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 180);
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -FLOOR_Y);
    this.playerRoot = new THREE.Group();
    this.playerRoot.name = 'p21-f1-player-parity-marker';
    this.scene.add(this.playerRoot);

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;

    const hemisphere = new THREE.HemisphereLight(0xc8d9d6, 0x17100b, 1.4);
    const key = new THREE.DirectionalLight(0xe7c79d, 2.1);
    key.position.set(12, 20, 10);
    const rim = new THREE.DirectionalLight(0x77a7ad, 0.9);
    rim.position.set(-10, 12, -8);
    this.scene.add(hemisphere, key, rim);
  }

  static async create(canvas: HTMLCanvasElement, coarse: boolean) {
    const gpu = (navigator as Navigator & {
      gpu?: { requestAdapter?: () => Promise<unknown> };
    }).gpu;
    if (!gpu?.requestAdapter) throw new Error('WebGPU API unavailable');
    const adapter = await gpu.requestAdapter();
    if (!adapter) throw new Error('WebGPU adapter unavailable');

    const [THREE, TSL] = await Promise.all([
      import('three/webgpu'),
      import('three/tsl'),
    ]);
    const renderer = new THREE.WebGPURenderer({
      canvas,
      antialias: !coarse,
      alpha: false,
      powerPreference: 'high-performance',
    });
    try {
      await renderer.init();
      configureGraphicsAssetRenderer(
        renderer as unknown as Parameters<typeof configureGraphicsAssetRenderer>[0],
      );
      const instance = new WebGpuRefineryRenderer(canvas, coarse, THREE, renderer);
      await instance.initializePrototype(TSL);
      return instance;
    } catch (error) {
      renderer.dispose();
      throw error;
    }
  }

  private async initializePrototype(TSL: typeof import('three/tsl')) {
    const platformGeometry = new this.THREE.PlaneGeometry(28, 20);
    const platformMaterial = new this.THREE.MeshStandardNodeMaterial();
    platformMaterial.colorNode = TSL.color(0x293134);
    platformMaterial.roughness = 0.78;
    platformMaterial.metalness = 0.48;
    const platform = new this.THREE.Mesh(platformGeometry, platformMaterial);
    platform.name = 'p21-f1-tsl-platform';
    platform.rotation.x = -Math.PI / 2;
    platform.position.y = -0.02;
    this.scene.add(platform);
    this.ownedGeometry.push(platformGeometry);
    this.ownedMaterial.push(platformMaterial);

    const playerGeometry = new this.THREE.CylinderGeometry(0.28, 0.34, 0.9, 10);
    const playerMaterial = new this.THREE.MeshStandardNodeMaterial();
    playerMaterial.colorNode = TSL.color(0xb8d4cb);
    playerMaterial.roughness = 0.42;
    playerMaterial.metalness = 0.58;
    const player = new this.THREE.Mesh(playerGeometry, playerMaterial);
    player.position.y = 0.45;
    this.playerRoot.add(player);
    this.ownedGeometry.push(playerGeometry);
    this.ownedMaterial.push(playerMaterial);

    const placements: Record<(typeof PROTOTYPE_ASSET_KEYS)[number], [number, number, number, number]> = {
      floor: [0, 0, 0, 0],
      processor: [-4.8, 0, -2.8, 0.2],
      terminal: [4.1, 0, 2.6, -0.35],
    };
    const detailScale = this.coarse ? 0.55 : 0.78;
    for (const key of PROTOTYPE_ASSET_KEYS) {
      const spec = selectGraphicsAssetSpec(REFINERY_ASSET_FAMILIES[key], detailScale);
      if (!spec) throw new Error(`P21-F1 refinery asset unavailable: ${key}`);
      const asset = await instantiateGraphicsAsset(spec);
      if (this.disposed) {
        asset.release();
        throw new Error('P21-F1 renderer disposed during asset initialization');
      }
      const [x, y, z, rotationY] = placements[key];
      asset.root.position.set(x, y, z);
      asset.root.rotation.y = rotationY;
      this.scene.add(asset.root);
      this.assets.push(asset);
    }

    this.canvas.dataset.webgpuInit = 'ready';
    this.canvas.dataset.webgpuBackend = this.loadedId;
    this.canvas.dataset.webgpuTsl = 'mesh-standard-node-color';
    this.canvas.dataset.webgpuAssetPipeline = 'glb+ktx2+meshopt';
    this.canvas.dataset.webgpuAssets = PROTOTYPE_ASSET_KEYS.join(',');
    this.canvas.dataset.webgpuCameraParity = 'three-combat-v1';
    this.canvas.dataset.webgpuInputParity = 'ground-plane-raycast-v1';
    this.canvas.dataset.environmentVisual = 'authored-refinery-webgpu-prototype';
    this.canvas.dataset.environmentKit = PROTOTYPE_ASSET_KEYS.join(',');
    this.canvas.dataset.environmentInstances = String(this.assets.length);
  }

  render(...args: RenderArgs) {
    if (this.disposed) return;
    const [state, width, height, quality, , mission, , , , , cameraFeedback] = args;
    if (mission.location !== 'asteroid-refinery') {
      this.canvas.dataset.webgpuScenario = 'refinery-only';
      return;
    }
    this.canvas.dataset.webgpuScenario = 'asteroid-refinery';
    this.resize(width, height, quality);
    this.playerRoot.position.set(state.player.x * WORLD_SCALE, 0, state.player.y * WORLD_SCALE);
    this.syncCamera(state, width / Math.max(1, height), cameraFeedback);
    this.renderer.render(this.scene, this.camera);
  }

  performanceStats() {
    const render = this.renderer.info.render;
    return { drawCalls: render.calls, triangles: render.triangles };
  }

  screenDirection(...args: ScreenDirectionArgs) {
    const [clientX, clientY, rect, player] = args;
    if (rect.width <= 0 || rect.height <= 0) return null;
    const pointer = new this.THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(pointer, this.camera);
    const hit = new this.THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, hit)) return null;
    const dx = hit.x / WORLD_SCALE - player.x;
    const dy = hit.z / WORLD_SCALE - player.y;
    const length = Math.hypot(dx, dy);
    if (length <= 0.01) return null;
    const direction = { x: dx / length, y: dy / length };
    this.canvas.dataset.webgpuPointerDirection = `${direction.x.toFixed(3)},${direction.y.toFixed(3)}`;
    return direction;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.assets.forEach(asset => asset.release());
    this.assets.length = 0;
    this.ownedGeometry.forEach(geometry => geometry.dispose());
    this.ownedMaterial.forEach(material => material.dispose());
    this.renderer.dispose();
    const root = document.documentElement;
    root.dataset.webgpuDisposeCount = String(Number(root.dataset.webgpuDisposeCount ?? 0) + 1);
  }

  private resize(width: number, height: number, quality: number) {
    const qualityCap = quality < 0.55 ? 1.12 : this.coarse || quality < 0.8 ? 1.35 : 1.8;
    const nextRatio = Math.min(qualityCap, window.devicePixelRatio || 1);
    if (Math.abs(nextRatio - this.pixelRatio) > 0.01) {
      this.pixelRatio = nextRatio;
      this.renderer.setPixelRatio(nextRatio);
    }
    if (width !== this.width || height !== this.height) {
      this.width = Math.max(1, width);
      this.height = Math.max(1, height);
      this.renderer.setSize(this.width, this.height, false);
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
    }
  }

  private syncCamera(
    state: RenderArgs[0],
    aspect: number,
    cameraFeedback?: RenderArgs[10],
  ) {
    const px = state.player.x * WORLD_SCALE;
    const pz = state.player.y * WORLD_SCALE;
    const narrow = aspect < 1.15;
    const cameraHeight = narrow ? 18 : this.coarse ? 14.8 : 12.8;
    const cameraOffset = narrow ? 13.2 : this.coarse ? 11.2 : 9.8;
    const offsetX = cameraFeedback?.worldOffsetX ?? 0;
    const offsetZ = cameraFeedback?.worldOffsetZ ?? 0;
    this.camera.position.set(px + cameraOffset + offsetX, cameraHeight, pz + cameraOffset + offsetZ);
    this.camera.lookAt(
      px + state.player.aim.x * 1.1 - offsetX * 0.2,
      0.62,
      pz + state.player.aim.y * 1.1 - offsetZ * 0.2,
    );
    this.camera.updateMatrixWorld();
  }
}

export async function createWebGpuRefineryRenderer(canvas: HTMLCanvasElement, coarse: boolean) {
  return WebGpuRefineryRenderer.create(canvas, coarse);
}
