import type { Camera } from '@babylonjs/core/Cameras/camera';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import '@babylonjs/core/Meshes/instancedMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { SSAO2RenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline';
import { Scene } from '@babylonjs/core/scene';
import {
  REFINERY_BLOOM_PROFILE,
  refineryBloomStrengthForCost,
} from './refineryBloomProfile';
import {
  createRefineryContactDepthAlphaData,
  REFINERY_CONTACT_DEPTH_PROFILE,
  refineryContactDepthTelemetry,
} from './refineryContactDepth';
import {
  REFINERY_ATMOSPHERE_PROFILE,
  refineryAtmosphereContrast,
  refineryAtmosphereExposureScale,
  refineryAtmosphereRange,
  refineryAtmosphereTelemetry,
} from './refineryAtmosphere';
import type { RenderBudgetSnapshot } from './renderQuality';
import { getWorldSize } from './sim';

const WORLD_SCALE = 0.02;
const REFINERY_BASELINE_BACKGROUND = 0x070604;
const REFINERY_BASELINE_FOG = 0x0b0805;
const REFINERY_SSAO_PIPELINE_NAME = 'p28-a3-refinery-ssao2';
const REFINERY_SSAO_RATIO = Object.freeze({ ssaoRatio: 0.72, blurRatio: 1 });
const PROTECTED_BLOOM_NAME = /(enemy|telegraph|phase-cue|hazard|objective|loot|interactable|protocol|status|lifecycle|target|health|armor|guide)/i;
const REFINERY_BLOOM_SOURCE_NAME = /(refinery-(terminal|processor|pipe|cable-tray|service-conduit|smelter-gantry)|p27-b6-muzzle-(flash|core))/i;
const CONTACT_POINTS = Object.freeze([
  [0.29, 0.67, 1.00, 0.72],
  [0.50, 0.26, 1.16, 0.84],
  [0.71, 0.67, 1.00, 0.72],
  [0.50, 0.09, 1.55, 0.62],
  [0.18, 0.24, 0.72, 0.52],
  [0.82, 0.24, 0.72, 0.52],
  [0.18, 0.76, 0.72, 0.52],
  [0.82, 0.76, 0.72, 0.52],
  [0.29, 0.52, 0.54, 0.40],
  [0.71, 0.52, 0.54, 0.40],
] as const);

export type BabylonRefineryPostProcessingBudget = {
  tierName: RenderBudgetSnapshot['tierName'];
  ssaoEnabled: boolean;
  ssaoStrength: number;
  ssaoRadius: number;
  ssaoSamples: 0 | 8 | 16;
  ssaoBilateralSamples: 8 | 12 | 16;
  bloomEnabled: boolean;
  bloomStrength: number;
  bloomKernelSize: 12 | 18 | 24;
  contactDepthCount: number;
  atmosphereEnabled: boolean;
  atmosphereNear: number;
  atmosphereFar: number;
  exposureScale: number;
  contrast: number;
  gameplayCueScale: 1;
};

function color3FromHex(hex: number) {
  return Color3.FromInts((hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff);
}

function color4FromHex(hex: number) {
  return new Color4(
    ((hex >> 16) & 0xff) / 255,
    ((hex >> 8) & 0xff) / 255,
    (hex & 0xff) / 255,
    1,
  );
}

export function isBabylonRefineryBloomSourceName(name: string) {
  return !PROTECTED_BLOOM_NAME.test(name) && REFINERY_BLOOM_SOURCE_NAME.test(name);
}

export function supportsBabylonRefinerySsao2(scene: Pick<Scene, 'getEngine'>) {
  const engine = scene.getEngine() as unknown as { createMultipleRenderTarget?: unknown };
  return SSAO2RenderingPipeline.IsSupported && typeof engine.createMultipleRenderTarget === 'function';
}

export function resolveBabylonRefineryPostProcessingBudget(
  budget: Pick<
    RenderBudgetSnapshot,
    'tierName'
      | 'refineryBloomScale'
      | 'refineryContactDepthScale'
      | 'refineryAtmosphereScale'
      | 'gameplayCueScale'
  >,
  lowVisibility = false,
): BabylonRefineryPostProcessingBudget {
  const atmosphere = refineryAtmosphereRange(lowVisibility, budget.refineryAtmosphereScale);
  const high = budget.tierName === 'high';
  const balanced = budget.tierName === 'balanced';
  return {
    tierName: budget.tierName,
    ssaoEnabled: budget.refineryContactDepthScale >= 0.5,
    ssaoStrength: high ? 1.08 : balanced ? 0.78 : 0,
    ssaoRadius: high ? 1.15 : balanced ? 0.95 : 0.8,
    ssaoSamples: high ? 16 : balanced ? 8 : 0,
    ssaoBilateralSamples: high ? 16 : balanced ? 12 : 8,
    bloomEnabled: budget.refineryBloomScale >= 0.5,
    bloomStrength: refineryBloomStrengthForCost(budget.refineryBloomScale),
    bloomKernelSize: high ? 24 : balanced ? 18 : 12,
    contactDepthCount: Math.max(
      1,
      Math.min(
        REFINERY_CONTACT_DEPTH_PROFILE.instanceLimit,
        Math.round(REFINERY_CONTACT_DEPTH_PROFILE.instanceLimit * budget.refineryContactDepthScale),
      ),
    ),
    atmosphereEnabled: budget.refineryAtmosphereScale >= 0.5,
    atmosphereNear: atmosphere.near,
    atmosphereFar: atmosphere.far,
    exposureScale: refineryAtmosphereExposureScale(budget.refineryAtmosphereScale, lowVisibility),
    contrast: refineryAtmosphereContrast(lowVisibility, budget.refineryAtmosphereScale),
    gameplayCueScale: budget.gameplayCueScale,
  };
}

export class BabylonRefineryPostProcessing {
  private readonly glow: GlowLayer;
  private readonly contactTexture: RawTexture;
  private readonly contactMaterial: StandardMaterial;
  private readonly contactMeshes: AbstractMesh[] = [];
  private readonly bloomMeshes = new Set<Mesh>();
  private ssao: SSAO2RenderingPipeline | null = null;
  private ssaoCamera: Camera | null = null;
  private ssaoAttached = false;
  private bloomMeshCount = -1;
  private upstreamExposure: number;
  private upstreamContrast: number;
  private appliedExposure: number | null = null;
  private appliedContrast: number | null = null;
  private released = false;

  constructor(
    private readonly scene: Scene,
    private readonly canvas: HTMLCanvasElement,
  ) {
    this.upstreamExposure = scene.imageProcessingConfiguration.exposure;
    this.upstreamContrast = scene.imageProcessingConfiguration.contrast;

    this.glow = new GlowLayer('p27-b12-refinery-selective-bloom', scene, {
      mainTextureRatio: 0.5,
      blurKernelSize: 24,
      excludeByDefault: true,
    });
    this.glow.intensity = REFINERY_BLOOM_PROFILE.strength;
    this.glow.isEnabled = false;

    const alpha = createRefineryContactDepthAlphaData();
    this.contactTexture = RawTexture.CreateRGBATexture(
      alpha,
      REFINERY_CONTACT_DEPTH_PROFILE.alphaTextureSize,
      REFINERY_CONTACT_DEPTH_PROFILE.alphaTextureSize,
      scene,
      false,
      false,
    );
    this.contactTexture.name = 'p27-b12-refinery-contact-alpha';
    this.contactTexture.hasAlpha = true;

    this.contactMaterial = new StandardMaterial('p27-b12-refinery-contact-material', scene);
    this.contactMaterial.diffuseColor = new Color3(0.02, 0.016, 0.012);
    this.contactMaterial.specularColor = new Color3(0, 0, 0);
    this.contactMaterial.diffuseTexture = this.contactTexture;
    this.contactMaterial.useAlphaFromDiffuseTexture = true;
    this.contactMaterial.alpha = REFINERY_CONTACT_DEPTH_PROFILE.opacity;
    this.contactMaterial.disableLighting = true;
    this.contactMaterial.disableDepthWrite = true;
    this.contactMaterial.backFaceCulling = false;

    const source = MeshBuilder.CreatePlane(
      'p27-b12-refinery-contact-0',
      { width: 2.4, height: 1.6, sideOrientation: Mesh.DOUBLESIDE },
      scene,
    );
    source.material = this.contactMaterial;
    source.isPickable = false;
    this.contactMeshes.push(source);
    for (let index = 1; index < REFINERY_CONTACT_DEPTH_PROFILE.instanceLimit; index += 1) {
      const instance = source.createInstance('p27-b12-refinery-contact-' + index);
      instance.isPickable = false;
      this.contactMeshes.push(instance);
    }
    this.positionContactDepth();
    this.contactMeshes.forEach(mesh => mesh.setEnabled(false));

    canvas.dataset.babylonPostProcessing = 'ssao2+selective-glow+contact-fallback+linear-fog+image-processing';
    canvas.dataset.babylonPostProtected = REFINERY_BLOOM_PROFILE.excludedCueGroups.join('+');
  }

  sync(lowVisibility: boolean, renderBudget: RenderBudgetSnapshot) {
    this.released = false;
    this.captureUpstreamImageProcessing();
    const qaExplicit = this.canvas.dataset.graphicsPathSelection === 'qa-explicit';
    const qaLowVisibility = qaExplicit && this.canvas.dataset.refineryImageGradeQa === 'low-visibility';
    const effectiveLowVisibility = qaLowVisibility || lowVisibility;
    const budget = resolveBabylonRefineryPostProcessingBudget(renderBudget, effectiveLowVisibility);
    const qaStackDisabled = qaExplicit && this.canvas.dataset.refineryPostStackQa === 'off';
    const stackEnabled = !qaStackDisabled;
    const sourceCount = this.syncBloomSources();

    const ssaoRequested = stackEnabled && (qaExplicit || budget.ssaoEnabled);
    const ssaoEnabled = this.syncSsao(ssaoRequested, budget);

    const bloomEnabled = stackEnabled && sourceCount > 0 && (qaExplicit || budget.bloomEnabled);
    this.glow.isEnabled = bloomEnabled;
    this.glow.intensity = budget.bloomStrength;
    this.glow.blurKernelSize = budget.bloomKernelSize;

    // P28-A3: SSAO2 owns contact depth whenever the runtime supports it.
    // The authored cards remain as a deterministic fallback for unsupported
    // hardware and the Performance tier instead of double-darkening the scene.
    const contactCount = stackEnabled && !ssaoEnabled ? budget.contactDepthCount : 0;
    this.contactMeshes.forEach((mesh, index) => mesh.setEnabled(index < contactCount));

    const atmosphereEnabled = stackEnabled && (qaExplicit || budget.atmosphereEnabled);
    if (atmosphereEnabled) {
      this.scene.fogMode = Scene.FOGMODE_LINEAR;
      this.scene.fogColor = color3FromHex(REFINERY_ATMOSPHERE_PROFILE.fogColor);
      this.scene.fogStart = budget.atmosphereNear;
      this.scene.fogEnd = budget.atmosphereFar;
      this.scene.clearColor = color4FromHex(REFINERY_ATMOSPHERE_PROFILE.backgroundColor);
      this.appliedExposure = this.upstreamExposure * budget.exposureScale;
      this.appliedContrast = this.upstreamContrast * budget.contrast;
      this.scene.imageProcessingConfiguration.exposure = this.appliedExposure;
      this.scene.imageProcessingConfiguration.contrast = this.appliedContrast;
    } else {
      this.applyBaselineAtmosphere(effectiveLowVisibility);
      this.restoreUpstreamImageProcessing();
    }

    this.canvas.dataset.environmentSsao2 = ssaoEnabled
      ? 'primary:refinery-ssao2-v1'
        + ':strength-' + budget.ssaoStrength.toFixed(2)
        + ':radius-' + budget.ssaoRadius.toFixed(2)
        + ':samples-' + budget.ssaoSamples
        + ':ratio-' + REFINERY_SSAO_RATIO.ssaoRatio.toFixed(2)
      : qaStackDisabled
        ? 'off:qa-baseline'
        : ssaoRequested
          ? 'off:unsupported+fallback-contact'
          : 'off:adaptive-budget+fallback-contact';

    this.canvas.dataset.environmentBloom = bloomEnabled
      ? 'selective:' + REFINERY_BLOOM_PROFILE.id
        + ':strength-' + budget.bloomStrength.toFixed(2)
        + ':kernel-' + budget.bloomKernelSize
        + ':cost-' + renderBudget.refineryBloomScale.toFixed(2)
      : qaStackDisabled ? 'off:qa-baseline' : sourceCount === 0 ? 'off:awaiting-authored-emissives' : 'off:adaptive-budget';
    this.canvas.dataset.environmentBloomSources = 'babylon-included:' + sourceCount + '+authored:processor+terminal+pipe+cable-tray+service-conduit+gantry+muzzle';
    this.canvas.dataset.environmentBloomExcluded = REFINERY_BLOOM_PROFILE.excludedCueGroups.join('+');
    this.canvas.dataset.environmentBloomCost = renderBudget.refineryBloomScale.toFixed(2);

    // Preserve the established contact-depth telemetry prefix so the older
    // P27 visual QA contract keeps recognizing this channel. A zero-instance
    // suffix is truthful: SSAO2 is primary and every proxy card is disabled.
    this.canvas.dataset.environmentContactDepth = qaStackDisabled
      ? 'off:qa-baseline'
      : ssaoEnabled
        ? refineryContactDepthTelemetry(0) + ':fallback-idle:ssao2-primary'
        : refineryContactDepthTelemetry(contactCount);
    this.canvas.dataset.environmentContactDepthProtected = REFINERY_CONTACT_DEPTH_PROFILE.protectedCueGroups.join('+');

    this.canvas.dataset.environmentAtmosphere = atmosphereEnabled
      ? refineryAtmosphereTelemetry(effectiveLowVisibility, renderBudget.refineryAtmosphereScale)
      : qaStackDisabled ? 'off:qa-baseline' : 'off:adaptive-budget';
    this.canvas.dataset.environmentAtmosphereProtected = REFINERY_ATMOSPHERE_PROFILE.protectedCueGroups.join('+');

    // Preserve the P27 telemetry contract exactly; P28 publishes the grade
    // identity separately while the runtime values remain available here.
    this.canvas.dataset.environmentPostTone = 'aces-exposure-'
      + this.scene.imageProcessingConfiguration.exposure.toFixed(2)
      + '+contrast-' + this.scene.imageProcessingConfiguration.contrast.toFixed(2);
    this.canvas.dataset.environmentImageGrade = REFINERY_ATMOSPHERE_PROFILE.gradeId;
    this.canvas.dataset.environmentImageGradeMode = effectiveLowVisibility ? 'low-visibility' : 'normal';
    this.canvas.dataset.environmentP21Budget = [
      'tier:' + renderBudget.tierName,
      'ibl:' + renderBudget.refineryIblScale.toFixed(2),
      'bloom:' + renderBudget.refineryBloomScale.toFixed(2),
      'contact:' + renderBudget.refineryContactDepthScale.toFixed(2),
      'atmosphere:' + renderBudget.refineryAtmosphereScale.toFixed(2),
      'critical:' + renderBudget.gameplayCueScale.toFixed(2),
    ].join('+');
    // Keep the P27 priority vocabulary stable; contact-depth now means SSAO2
    // when environmentSsao2 is primary, and proxy cards only on fallback.
    this.canvas.dataset.effectPriority = 'critical:hazards+telegraphs+class-cues@'
      + renderBudget.gameplayCueScale.toFixed(2)
      + '|secondary:bloom+contact-depth+atmosphere@'
      + renderBudget.secondaryEffectScale.toFixed(2);
    this.canvas.dataset.babylonPostBudget = [
      'tier:' + budget.tierName,
      'bloom:' + renderBudget.refineryBloomScale.toFixed(2),
      'contact:' + renderBudget.refineryContactDepthScale.toFixed(2),
      'atmosphere:' + renderBudget.refineryAtmosphereScale.toFixed(2),
      'critical:' + budget.gameplayCueScale.toFixed(2),
    ].join('|');
    this.canvas.dataset.babylonPostStack = qaStackDisabled
      ? 'off:qa-baseline'
      : qaExplicit ? 'on:qa-explicit' : 'on:adaptive';
  }

  release(reason: string) {
    if (this.released) return;
    this.released = true;
    this.captureUpstreamImageProcessing();
    this.restoreUpstreamImageProcessing();
    this.detachSsao();
    this.glow.isEnabled = false;
    this.contactMeshes.forEach(mesh => mesh.setEnabled(false));
    this.scene.fogMode = Scene.FOGMODE_NONE;
    this.canvas.dataset.babylonPostRelease = reason;
    for (const key of [
      'environmentSsao2',
      'environmentBloom',
      'environmentBloomSources',
      'environmentBloomExcluded',
      'environmentBloomCost',
      'environmentContactDepth',
      'environmentContactDepthProtected',
      'environmentAtmosphere',
      'environmentAtmosphereProtected',
      'environmentPostTone',
      'environmentImageGrade',
      'environmentImageGradeMode',
      'environmentP21Budget',
      'effectPriority',
      'babylonPostBudget',
      'babylonPostStack',
    ] as const) {
      delete this.canvas.dataset[key];
    }
  }

  dispose() {
    this.release('renderer-dispose');
    this.ssao?.dispose();
    this.ssao = null;
    this.ssaoCamera = null;
    this.ssaoAttached = false;
    this.glow.dispose();
    for (let index = this.contactMeshes.length - 1; index >= 0; index -= 1) {
      this.contactMeshes[index].dispose();
    }
    this.contactMeshes.length = 0;
    this.contactMaterial.dispose();
    this.contactTexture.dispose();
  }

  private captureUpstreamImageProcessing() {
    const imageProcessing = this.scene.imageProcessingConfiguration;
    if (this.appliedExposure === null || Math.abs(imageProcessing.exposure - this.appliedExposure) > 1e-6) {
      this.upstreamExposure = imageProcessing.exposure;
    }
    if (this.appliedContrast === null || Math.abs(imageProcessing.contrast - this.appliedContrast) > 1e-6) {
      this.upstreamContrast = imageProcessing.contrast;
    }
  }

  private restoreUpstreamImageProcessing() {
    this.scene.imageProcessingConfiguration.exposure = this.upstreamExposure;
    this.scene.imageProcessingConfiguration.contrast = this.upstreamContrast;
    this.appliedExposure = null;
    this.appliedContrast = null;
  }

  private syncSsao(requested: boolean, budget: BabylonRefineryPostProcessingBudget) {
    if (!requested) {
      this.detachSsao();
      return false;
    }

    const pipeline = this.ensureSsao();
    const camera = this.scene.activeCamera;
    if (!pipeline || !camera) {
      this.detachSsao();
      return false;
    }

    pipeline.totalStrength = budget.ssaoStrength;
    pipeline.radius = budget.ssaoRadius;
    pipeline.samples = budget.ssaoSamples;
    pipeline.expensiveBlur = true;
    pipeline.bypassBlur = false;
    pipeline.bilateralSamples = budget.ssaoBilateralSamples;
    pipeline.bilateralSoften = 0.55;
    pipeline.bilateralTolerance = 0.25;

    if (this.ssaoAttached && this.ssaoCamera !== camera) this.detachSsao();
    if (!this.ssaoAttached) {
      this.scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline(
        REFINERY_SSAO_PIPELINE_NAME,
        [camera],
      );
      this.ssaoCamera = camera;
      this.ssaoAttached = true;
    }
    return true;
  }

  private ensureSsao() {
    if (!supportsBabylonRefinerySsao2(this.scene)) return null;
    if (this.ssao) return this.ssao;

    const pipeline = new SSAO2RenderingPipeline(
      REFINERY_SSAO_PIPELINE_NAME,
      this.scene,
      REFINERY_SSAO_RATIO,
    );
    pipeline.base = 0;
    pipeline.epsilon = 0.02;
    pipeline.maxZ = 90;
    pipeline.minZAspect = 0.2;
    pipeline.textureSamples = 1;
    pipeline.expensiveBlur = true;
    pipeline.bypassBlur = false;
    this.ssao = pipeline;
    return pipeline;
  }

  private detachSsao() {
    if (!this.ssaoAttached || !this.ssaoCamera) {
      this.ssaoAttached = false;
      this.ssaoCamera = null;
      return;
    }
    this.scene.postProcessRenderPipelineManager.detachCamerasFromRenderPipeline(
      REFINERY_SSAO_PIPELINE_NAME,
      [this.ssaoCamera],
    );
    this.ssaoAttached = false;
    this.ssaoCamera = null;
  }

  private positionContactDepth() {
    const world = getWorldSize();
    const worldWidth = world.w * WORLD_SCALE;
    const worldHeight = world.h * WORLD_SCALE;
    this.contactMeshes.forEach((mesh, index) => {
      const [x, z, sx, sz] = CONTACT_POINTS[index];
      mesh.position.set(worldWidth * x, 0.021, worldHeight * z);
      mesh.rotation.set(Math.PI / 2, 0, index * 0.31);
      mesh.scaling.set(sx, sz, 1);
    });
  }

  private syncBloomSources() {
    if (this.bloomMeshCount === this.scene.meshes.length) return this.bloomMeshes.size;
    this.bloomMeshCount = this.scene.meshes.length;
    const next = new Set<Mesh>();
    for (const mesh of this.scene.meshes) {
      if (!(mesh instanceof Mesh) || mesh.getTotalVertices() <= 0) continue;
      if (!isBabylonRefineryBloomSourceName(mesh.name)) continue;
      next.add(mesh);
      if (!this.bloomMeshes.has(mesh)) this.glow.addIncludedOnlyMesh(mesh);
    }
    for (const mesh of this.bloomMeshes) {
      if (!next.has(mesh)) this.glow.removeIncludedOnlyMesh(mesh);
    }
    this.bloomMeshes.clear();
    next.forEach(mesh => this.bloomMeshes.add(mesh));
    return this.bloomMeshes.size;
  }

  private applyBaselineAtmosphere(lowVisibility: boolean) {
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogColor = color3FromHex(REFINERY_BASELINE_FOG);
    this.scene.fogDensity = lowVisibility ? 0.037 : 0.019;
    this.scene.clearColor = color4FromHex(REFINERY_BASELINE_BACKGROUND);
  }
}