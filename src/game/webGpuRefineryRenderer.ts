import type { ThreeCombatRenderer } from './threeCombatRenderer';
import { AdaptiveRenderBudget, type RenderBudgetSnapshot } from './renderQuality';
import { REFINERY_IBL_PROFILE } from './refineryIbl';
import {
  clampRefineryBloomCostScale,
  REFINERY_BLOOM_PROFILE,
  refineryBloomResolutionScale,
  refineryBloomStrengthForCost,
} from './refineryBloom';
import {
  createRefineryContactDepthAlphaData,
  REFINERY_CONTACT_DEPTH_PROFILE,
  refineryContactDepthTelemetry,
} from './refineryContactDepth';
import {
  REFINERY_ATMOSPHERE_PROFILE,
  refineryAtmosphereExposureScale,
  refineryAtmosphereRange,
  refineryAtmosphereTelemetry,
} from './refineryAtmosphere';

const WORLD_SCALE = 0.02;
const FLOOR_Y = 0;
const PROTOTYPE_ASSET_KEYS = ['floor', 'processor', 'terminal'] as const;
const WEBGPU_REFINERY_PARITY_GAPS = [
  'ibl-pmrem-generator-webgl-only:bounded-light-proxy',
  'combat-vfx-full-scene:not-in-f1-prototype',
] as const;

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
  private readonly renderBudget: AdaptiveRenderBudget;
  private readonly iblProxyLights: Array<{ intensity: number; visible: boolean }> = [];
  private readonly practicalMeshes: Array<InstanceType<typeof import('three/webgpu')['Mesh']>> = [];
  private readonly ownedGeometry: Array<{ dispose(): void }> = [];
  private readonly ownedMaterial: Array<{ dispose(): void }> = [];
  private readonly assets: Array<{ release(): void }> = [];
  private renderPipeline: { outputNode: any; needsUpdate: boolean; render(): void; dispose(): void } | null = null;
  private bloomNode: any = null;
  private beautyNode: any = null;
  private bloomCompositeNode: any = null;
  private contactShadows: InstanceType<typeof import('three/webgpu')['InstancedMesh']> | null = null;
  private contactDepthTexture: InstanceType<typeof import('three/webgpu')['DataTexture']> | null = null;
  private disposed = false;
  private width = 1;
  private height = 1;
  private pixelRatio = 1;
  private lastFrameAt = 0;
  private bloomEnabled = true;

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
    this.renderBudget = new AdaptiveRenderBudget(coarse);
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
    const warmIblProxy = new THREE.PointLight(0xffb36c, 0, 22, 1.6);
    warmIblProxy.position.set(-4.8, 5.2, -2.8);
    const serviceIblProxy = new THREE.PointLight(0x6edce7, 0, 18, 1.8);
    serviceIblProxy.position.set(4.1, 4.2, 2.6);
    this.iblProxyLights.push(warmIblProxy, serviceIblProxy);
    this.scene.add(hemisphere, key, rim, warmIblProxy, serviceIblProxy);
  }

  static async create(canvas: HTMLCanvasElement, coarse: boolean) {
    const gpu = (navigator as Navigator & {
      gpu?: { requestAdapter?: () => Promise<unknown> };
    }).gpu;
    if (!gpu?.requestAdapter) throw new Error('WebGPU API unavailable');
    const adapter = await gpu.requestAdapter();
    if (!adapter) throw new Error('WebGPU adapter unavailable');

    const [THREE, TSL, bloomModule, graphicsAssets, graphicsAssetManifest] = await Promise.all([
      import('three/webgpu'),
      import('three/tsl'),
      import('three/addons/tsl/display/BloomNode.js'),
      import('./graphicsAssets'),
      import('./graphicsAssetManifest'),
    ]);
    const renderer = new THREE.WebGPURenderer({
      canvas,
      antialias: !coarse,
      alpha: false,
      powerPreference: 'high-performance',
    });
    try {
      await renderer.init();
      graphicsAssets.configureGraphicsAssetRenderer(renderer);
      const instance = new WebGpuRefineryRenderer(canvas, coarse, THREE, renderer);
      await instance.initializePrototype(
        TSL,
        bloomModule,
        graphicsAssets,
        graphicsAssetManifest.REFINERY_ASSET_FAMILIES,
      );
      return instance;
    } catch (error) {
      renderer.dispose();
      throw error;
    }
  }

  private async initializePrototype(
    TSL: typeof import('three/tsl'),
    bloomModule: typeof import('three/addons/tsl/display/BloomNode.js'),
    graphicsAssets: typeof import('./graphicsAssets'),
    refineryAssetFamilies: typeof import('./graphicsAssetManifest')['REFINERY_ASSET_FAMILIES'],
  ) {
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
      const spec = graphicsAssets.selectGraphicsAssetSpec(refineryAssetFamilies[key], detailScale);
      if (!spec) throw new Error(`P21-F1 refinery asset unavailable: ${key}`);
      const asset = await graphicsAssets.instantiateGraphicsAsset(spec);
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

    const practicalSpecs = [
      { position: [-4.8, 2.9, -1.4] as const, color: 0xffb36c, scale: 0.24 },
      { position: [4.1, 2.3, 1.2] as const, color: 0x6edce7, scale: 0.20 },
    ];
    practicalSpecs.forEach((spec, index) => {
      const geometry = new this.THREE.SphereGeometry(spec.scale, 12, 8);
      const material = new this.THREE.MeshStandardNodeMaterial();
      material.colorNode = TSL.color(spec.color);
      material.emissiveNode = TSL.color(spec.color).mul(index === 0 ? 2.4 : 1.9);
      material.roughness = 0.34;
      material.metalness = 0.24;
      const mesh = new this.THREE.Mesh(geometry, material);
      mesh.name = `p21-f2-webgpu-practical-${index + 1}`;
      mesh.position.set(spec.position[0], spec.position[1], spec.position[2]);
      this.scene.add(mesh);
      this.practicalMeshes.push(mesh);
      this.ownedGeometry.push(geometry);
      this.ownedMaterial.push(material);
    });

    const contactGeometry = new this.THREE.PlaneGeometry(2.4, 1.6);
    const contactAlpha = createRefineryContactDepthAlphaData();
    const contactTexture = new this.THREE.DataTexture(
      contactAlpha,
      REFINERY_CONTACT_DEPTH_PROFILE.alphaTextureSize,
      REFINERY_CONTACT_DEPTH_PROFILE.alphaTextureSize,
      this.THREE.RGBAFormat,
    );
    contactTexture.name = 'p21-f2-webgpu-contact-depth-alpha';
    contactTexture.minFilter = this.THREE.LinearFilter;
    contactTexture.magFilter = this.THREE.LinearFilter;
    contactTexture.generateMipmaps = false;
    contactTexture.needsUpdate = true;
    this.contactDepthTexture = contactTexture;
    const contactMaterial = new this.THREE.MeshBasicMaterial({
      color: 0x050403,
      map: contactTexture,
      transparent: true,
      opacity: REFINERY_CONTACT_DEPTH_PROFILE.opacity,
      depthWrite: false,
      side: this.THREE.DoubleSide,
      toneMapped: false,
    });
    const contactShadows = new this.THREE.InstancedMesh(
      contactGeometry,
      contactMaterial,
      REFINERY_CONTACT_DEPTH_PROFILE.instanceLimit,
    );
    const contactTransform = new this.THREE.Object3D();
    const contactPoints = [
      [-4.8, -2.8, 1.20, 0.84], [4.1, 2.6, 1.05, 0.72], [-4.8, -1.4, 0.70, 0.52],
      [4.1, 1.2, 0.64, 0.48], [-2.6, 2.7, 0.62, 0.44], [2.5, -2.6, 0.62, 0.44],
      [-6.2, 2.2, 0.54, 0.40], [6.1, -2.1, 0.54, 0.40], [-1.2, -4.1, 0.48, 0.36],
      [1.4, 4.0, 0.48, 0.36],
    ];
    contactPoints.forEach(([x, z, sx, sz], index) => {
      contactTransform.position.set(x, 0.012, z);
      contactTransform.rotation.set(-Math.PI / 2, 0, index * 0.31);
      contactTransform.scale.set(sx, sz, 1);
      contactTransform.updateMatrix();
      contactShadows.setMatrixAt(index, contactTransform.matrix);
    });
    contactShadows.count = REFINERY_CONTACT_DEPTH_PROFILE.instanceLimit;
    contactShadows.instanceMatrix.needsUpdate = true;
    contactShadows.renderOrder = 1;
    contactShadows.name = 'p21-f2-webgpu-contact-darkening';
    this.contactShadows = contactShadows;
    this.scene.add(contactShadows);
    this.ownedGeometry.push(contactGeometry);
    this.ownedMaterial.push(contactMaterial);

    const scenePass = TSL.pass(this.scene, this.camera);
    const refineryMrt = TSL.mrt({
      output: TSL.output,
      emissive: TSL.vec4(TSL.emissive, TSL.output.a),
    });
    refineryMrt.setBlendMode('emissive', new this.THREE.BlendMode(this.THREE.NormalBlending));
    scenePass.setMRT(refineryMrt);
    const emissiveTexture = scenePass.getTexture('emissive');
    emissiveTexture.type = this.THREE.UnsignedByteType;
    this.beautyNode = scenePass.getTextureNode();
    const emissivePass = scenePass.getTextureNode('emissive');
    this.bloomNode = bloomModule.bloom(
      emissivePass,
      REFINERY_BLOOM_PROFILE.strength,
      REFINERY_BLOOM_PROFILE.radius,
      REFINERY_BLOOM_PROFILE.threshold,
    );
    this.bloomNode.setResolutionScale(REFINERY_BLOOM_PROFILE.fullResolutionScale);
    this.bloomCompositeNode = this.beautyNode.add(this.bloomNode);
    this.renderPipeline = new this.THREE.RenderPipeline(this.renderer);
    this.renderPipeline.outputNode = this.bloomCompositeNode;

    this.canvas.dataset.webgpuInit = 'ready';
    this.canvas.dataset.webgpuBackend = this.loadedId;
    this.canvas.dataset.webgpuTsl = 'mesh-standard-node-color+render-pipeline+mrt-emissive';
    this.canvas.dataset.webgpuAssetPipeline = 'glb+ktx2+meshopt';
    this.canvas.dataset.webgpuAssets = PROTOTYPE_ASSET_KEYS.join(',');
    this.canvas.dataset.webgpuCameraParity = 'three-combat-v1';
    this.canvas.dataset.webgpuInputParity = 'ground-plane-raycast-v1';
    this.canvas.dataset.webgpuEffectParity = 'ibl-proxy+selective-bloom+contact-depth+atmosphere+adaptive-budget';
    this.canvas.dataset.webgpuParityGaps = WEBGPU_REFINERY_PARITY_GAPS.join('|');
    this.canvas.dataset.environmentVisual = 'authored-refinery-webgpu-p21f2';
    this.canvas.dataset.environmentKit = PROTOTYPE_ASSET_KEYS.join(',');
    this.canvas.dataset.environmentInstances = String(this.assets.length);
  }

  render(...args: RenderArgs) {
    if (this.disposed) return;
    const [state, width, height, quality, qualityMode, mission, , , , , cameraFeedback] = args;
    if (mission.location !== 'asteroid-refinery') {
      this.canvas.dataset.webgpuScenario = 'refinery-only';
      return;
    }
    const now = performance.now();
    const frameMs = this.lastFrameAt > 0 ? now - this.lastFrameAt : 1000 / 60;
    this.lastFrameAt = now;
    const budget = this.renderBudget.sample(frameMs, quality, qualityMode);
    this.canvas.dataset.webgpuScenario = 'asteroid-refinery';
    this.resize(width, height, quality);
    this.playerRoot.position.set(state.player.x * WORLD_SCALE, 0, state.player.y * WORLD_SCALE);
    this.syncCamera(state, width / Math.max(1, height), cameraFeedback);
    this.applyRefineryEffects(mission, budget);
    if (this.renderPipeline) this.renderPipeline.render();
    else this.renderer.render(this.scene, this.camera);
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
    this.bloomNode?.dispose?.();
    this.renderPipeline?.dispose();
    this.renderPipeline = null;
    this.bloomNode = null;
    this.beautyNode = null;
    this.bloomCompositeNode = null;
    this.contactDepthTexture?.dispose();
    this.contactDepthTexture = null;
    this.contactShadows = null;
    this.ownedGeometry.forEach(geometry => geometry.dispose());
    this.ownedMaterial.forEach(material => material.dispose());
    this.renderer.dispose();
    const root = document.documentElement;
    root.dataset.webgpuDisposeCount = String(Number(root.dataset.webgpuDisposeCount ?? 0) + 1);
  }

  private applyRefineryEffects(
    mission: RenderArgs[5],
    budget: RenderBudgetSnapshot,
  ) {
    const qaExplicit = this.canvas.dataset.graphicsPathSelection === 'qa-explicit';
    const lowVisibility = mission.conditions.includes('low-visibility');
    this.canvas.dataset.environmentP21Budget = [
      `tier:${budget.tierName}`,
      `ibl:${budget.refineryIblScale.toFixed(2)}`,
      `bloom:${budget.refineryBloomScale.toFixed(2)}`,
      `contact:${budget.refineryContactDepthScale.toFixed(2)}`,
      `atmosphere:${budget.refineryAtmosphereScale.toFixed(2)}`,
      `critical:${budget.gameplayCueScale.toFixed(2)}`,
    ].join('+');

    const iblQaDisabled = qaExplicit && this.canvas.dataset.refineryIblQa === 'off';
    const iblEnabled = !iblQaDisabled && (qaExplicit || budget.refineryIblScale >= 0.5);
    const iblIntensity = REFINERY_IBL_PROFILE.intensity * budget.refineryIblScale;
    const iblLightIntensities = [2.4, 1.8];
    this.iblProxyLights.forEach((light, index) => {
      light.visible = iblEnabled;
      light.intensity = iblEnabled ? (iblLightIntensities[index] ?? 1.4) * iblIntensity : 0;
    });
    this.canvas.dataset.environmentIbl = iblEnabled
      ? `proxy:${REFINERY_IBL_PROFILE.id}:intensity-${iblIntensity.toFixed(2)}`
      : iblQaDisabled ? 'off:qa-baseline' : 'off:adaptive-budget';

    const atmosphereQaDisabled = qaExplicit && this.canvas.dataset.refineryAtmosphereQa === 'off';
    const atmosphereEnabled = !atmosphereQaDisabled && (qaExplicit || budget.refineryAtmosphereScale >= 0.5);
    this.renderer.toneMappingExposure = 1.02;
    if (atmosphereEnabled) {
      const range = refineryAtmosphereRange(lowVisibility, budget.refineryAtmosphereScale);
      if (this.scene.fog instanceof this.THREE.Fog) {
        this.scene.fog.color.setHex(REFINERY_ATMOSPHERE_PROFILE.fogColor);
        this.scene.fog.near = range.near;
        this.scene.fog.far = range.far;
      } else {
        this.scene.fog = new this.THREE.Fog(REFINERY_ATMOSPHERE_PROFILE.fogColor, range.near, range.far);
      }
      if (this.scene.background instanceof this.THREE.Color) {
        this.scene.background.setHex(REFINERY_ATMOSPHERE_PROFILE.backgroundColor);
      } else {
        this.scene.background = new this.THREE.Color(REFINERY_ATMOSPHERE_PROFILE.backgroundColor);
      }
      this.renderer.toneMappingExposure *= refineryAtmosphereExposureScale(budget.refineryAtmosphereScale);
      this.canvas.dataset.environmentAtmosphere = refineryAtmosphereTelemetry(lowVisibility, budget.refineryAtmosphereScale);
    } else {
      this.scene.fog = new this.THREE.FogExp2(0x0b0805, lowVisibility ? 0.037 : 0.019);
      if (this.scene.background instanceof this.THREE.Color) this.scene.background.setHex(0x101518);
      else this.scene.background = new this.THREE.Color(0x101518);
      this.canvas.dataset.environmentAtmosphere = atmosphereQaDisabled ? 'off:qa-baseline' : 'off:adaptive-budget';
    }
    this.canvas.dataset.environmentAtmosphereProtected = REFINERY_ATMOSPHERE_PROFILE.protectedCueGroups.join('+');

    if (this.contactShadows) {
      const contactQaDisabled = qaExplicit && this.canvas.dataset.refineryContactDepthQa === 'off';
      const count = Math.max(1, Math.min(
        REFINERY_CONTACT_DEPTH_PROFILE.instanceLimit,
        Math.round(REFINERY_CONTACT_DEPTH_PROFILE.instanceLimit * budget.refineryContactDepthScale),
      ));
      this.contactShadows.count = count;
      this.contactShadows.visible = !contactQaDisabled;
      this.canvas.dataset.environmentContactDepth = contactQaDisabled
        ? 'off:qa-baseline'
        : refineryContactDepthTelemetry(count);
      this.canvas.dataset.environmentContactDepthProtected = REFINERY_CONTACT_DEPTH_PROFILE.protectedCueGroups.join('+');
    }

    const bloomQaDisabled = qaExplicit && this.canvas.dataset.refineryBloomQa === 'off';
    const requestedCost = qaExplicit ? Number.parseFloat(this.canvas.dataset.refineryBloomCost ?? '') : Number.NaN;
    const costScale = clampRefineryBloomCostScale(
      Number.isFinite(requestedCost) ? requestedCost : budget.refineryBloomScale,
    );
    const bloomEnabled = !bloomQaDisabled && costScale > 0;
    if (this.bloomNode) {
      this.bloomNode.strength.value = refineryBloomStrengthForCost(costScale);
      this.bloomNode.radius.value = REFINERY_BLOOM_PROFILE.radius;
      this.bloomNode.threshold.value = REFINERY_BLOOM_PROFILE.threshold;
      this.bloomNode.setResolutionScale(refineryBloomResolutionScale(costScale));
    }
    if (this.renderPipeline && bloomEnabled !== this.bloomEnabled) {
      this.bloomEnabled = bloomEnabled;
      this.renderPipeline.outputNode = bloomEnabled ? this.bloomCompositeNode : this.beautyNode;
      this.renderPipeline.needsUpdate = true;
    }
    this.canvas.dataset.environmentBloom = bloomEnabled
      ? `selective:${REFINERY_BLOOM_PROFILE.id}:strength-${refineryBloomStrengthForCost(costScale).toFixed(2)}:radius-${REFINERY_BLOOM_PROFILE.radius.toFixed(2)}:cost-${costScale.toFixed(2)}:resolution-${refineryBloomResolutionScale(costScale).toFixed(2)}`
      : bloomQaDisabled ? 'off:qa-baseline' : 'off:cost-control';
    this.canvas.dataset.environmentBloomSources = 'authored:2+practical:2+vfx:muzzle-0';
    this.canvas.dataset.environmentBloomExcluded = REFINERY_BLOOM_PROFILE.excludedCueGroups.join('+');
    this.canvas.dataset.environmentBloomCost = costScale.toFixed(2);
    this.canvas.dataset.environmentLighting = `refinery-key+rim+ibl:${iblEnabled ? 'webgpu-light-proxy' : 'off'}+contact:bounded+practical:2+shadow:none`;
    this.canvas.dataset.environmentTone = `aces-${this.renderer.toneMappingExposure.toFixed(2)}+ibl-${iblEnabled ? iblIntensity.toFixed(2) : 'off'}+atmosphere-${atmosphereEnabled ? REFINERY_ATMOSPHERE_PROFILE.id : 'off'}`;
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
