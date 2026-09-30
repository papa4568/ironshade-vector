import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
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
  refineryAtmosphereExposureScale,
  refineryAtmosphereRange,
  refineryAtmosphereTelemetry,
} from './refineryAtmosphere';
import type { RenderBudgetSnapshot } from './renderQuality';
import { getWorldSize } from './sim';

const WORLD_SCALE = 0.02;
const REFINERY_BASELINE_BACKGROUND = 0x070604;
const REFINERY_BASELINE_FOG = 0x0b0805;
const PROTECTED_BLOOM_NAME = /(enemy|telegraph|phase-cue|hazard|objective|loot|interactable|protocol|status|lifecycle|target|health|armor|guide)/i;
const REFINERY_BLOOM_SOURCE_NAME = /(refinery-(terminal|processor)|p27-b6-muzzle-(flash|core))/i;
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
  return {
    tierName: budget.tierName,
    bloomEnabled: budget.refineryBloomScale >= 0.5,
    bloomStrength: refineryBloomStrengthForCost(budget.refineryBloomScale),
    bloomKernelSize: budget.tierName === 'high' ? 24 : budget.tierName === 'balanced' ? 18 : 12,
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
    exposureScale: refineryAtmosphereExposureScale(budget.refineryAtmosphereScale),
    contrast: 1 + 0.035 * budget.refineryAtmosphereScale,
    gameplayCueScale: budget.gameplayCueScale,
  };
}

export class BabylonRefineryPostProcessing {
  private readonly glow: GlowLayer;
  private readonly contactTexture: RawTexture;
  private readonly contactMaterial: StandardMaterial;
  private readonly contactMeshes: AbstractMesh[] = [];
  private readonly bloomMeshes = new Set<Mesh>();
  private bloomMeshCount = -1;
  private released = false;

  constructor(
    private readonly scene: Scene,
    private readonly canvas: HTMLCanvasElement,
  ) {
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

    canvas.dataset.babylonPostProcessing = 'selective-glow+instanced-contact+linear-fog+image-processing';
    canvas.dataset.babylonPostProtected = REFINERY_BLOOM_PROFILE.excludedCueGroups.join('+');
  }

  sync(lowVisibility: boolean, renderBudget: RenderBudgetSnapshot) {
    this.released = false;
    const budget = resolveBabylonRefineryPostProcessingBudget(renderBudget, lowVisibility);
    const qaExplicit = this.canvas.dataset.graphicsPathSelection === 'qa-explicit';
    const qaStackDisabled = qaExplicit && this.canvas.dataset.refineryPostStackQa === 'off';
    const stackEnabled = !qaStackDisabled;
    const sourceCount = this.syncBloomSources();

    const bloomEnabled = stackEnabled && sourceCount > 0 && (qaExplicit || budget.bloomEnabled);
    this.glow.isEnabled = bloomEnabled;
    this.glow.intensity = budget.bloomStrength;
    this.glow.blurKernelSize = budget.bloomKernelSize;

    const contactCount = stackEnabled ? budget.contactDepthCount : 0;
    this.contactMeshes.forEach((mesh, index) => mesh.setEnabled(index < contactCount));

    const atmosphereEnabled = stackEnabled && (qaExplicit || budget.atmosphereEnabled);
    const baseExposure = this.scene.imageProcessingConfiguration.exposure;
    if (atmosphereEnabled) {
      this.scene.fogMode = Scene.FOGMODE_LINEAR;
      this.scene.fogColor = color3FromHex(REFINERY_ATMOSPHERE_PROFILE.fogColor);
      this.scene.fogStart = budget.atmosphereNear;
      this.scene.fogEnd = budget.atmosphereFar;
      this.scene.clearColor = color4FromHex(REFINERY_ATMOSPHERE_PROFILE.backgroundColor);
      this.scene.imageProcessingConfiguration.exposure = baseExposure * budget.exposureScale;
      this.scene.imageProcessingConfiguration.contrast = budget.contrast;
    } else {
      this.applyBaselineAtmosphere(lowVisibility);
      this.scene.imageProcessingConfiguration.contrast = 1;
    }

    this.canvas.dataset.environmentBloom = bloomEnabled
      ? 'selective:' + REFINERY_BLOOM_PROFILE.id
        + ':strength-' + budget.bloomStrength.toFixed(2)
        + ':kernel-' + budget.bloomKernelSize
        + ':cost-' + renderBudget.refineryBloomScale.toFixed(2)
      : qaStackDisabled ? 'off:qa-baseline' : sourceCount === 0 ? 'off:awaiting-authored-emissives' : 'off:adaptive-budget';
    this.canvas.dataset.environmentBloomSources = 'babylon-included:' + sourceCount + '+authored:processor+terminal+muzzle';
    this.canvas.dataset.environmentBloomExcluded = REFINERY_BLOOM_PROFILE.excludedCueGroups.join('+');
    this.canvas.dataset.environmentBloomCost = renderBudget.refineryBloomScale.toFixed(2);

    this.canvas.dataset.environmentContactDepth = qaStackDisabled
      ? 'off:qa-baseline'
      : refineryContactDepthTelemetry(contactCount);
    this.canvas.dataset.environmentContactDepthProtected = REFINERY_CONTACT_DEPTH_PROFILE.protectedCueGroups.join('+');

    this.canvas.dataset.environmentAtmosphere = atmosphereEnabled
      ? refineryAtmosphereTelemetry(lowVisibility, renderBudget.refineryAtmosphereScale)
      : qaStackDisabled ? 'off:qa-baseline' : 'off:adaptive-budget';
    this.canvas.dataset.environmentAtmosphereProtected = REFINERY_ATMOSPHERE_PROFILE.protectedCueGroups.join('+');

    this.canvas.dataset.environmentPostTone = 'aces-exposure-'
      + this.scene.imageProcessingConfiguration.exposure.toFixed(2)
      + '+contrast-' + this.scene.imageProcessingConfiguration.contrast.toFixed(2);
    this.canvas.dataset.environmentP21Budget = [
      'tier:' + renderBudget.tierName,
      'ibl:' + renderBudget.refineryIblScale.toFixed(2),
      'bloom:' + renderBudget.refineryBloomScale.toFixed(2),
      'contact:' + renderBudget.refineryContactDepthScale.toFixed(2),
      'atmosphere:' + renderBudget.refineryAtmosphereScale.toFixed(2),
      'critical:' + renderBudget.gameplayCueScale.toFixed(2),
    ].join('+');
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
    this.glow.isEnabled = false;
    this.contactMeshes.forEach(mesh => mesh.setEnabled(false));
    this.scene.fogMode = Scene.FOGMODE_NONE;
    this.scene.imageProcessingConfiguration.contrast = 1;
    this.canvas.dataset.babylonPostRelease = reason;
    for (const key of [
      'environmentBloom',
      'environmentBloomSources',
      'environmentBloomExcluded',
      'environmentBloomCost',
      'environmentContactDepth',
      'environmentContactDepthProtected',
      'environmentAtmosphere',
      'environmentAtmosphereProtected',
      'environmentPostTone',
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
    this.glow.dispose();
    for (let index = this.contactMeshes.length - 1; index >= 0; index -= 1) {
      this.contactMeshes[index].dispose();
    }
    this.contactMeshes.length = 0;
    this.contactMaterial.dispose();
    this.contactTexture.dispose();
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
