import { Constants } from '@babylonjs/core/Engines/constants';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { RawCubeTexture } from '@babylonjs/core/Materials/Textures/rawCubeTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Scene } from '@babylonjs/core/scene';
import {
  REFINERY_BABYLON_LIGHTING_PROFILE,
  REFINERY_IBL_PANELS,
  REFINERY_IBL_PROFILE,
} from './refineryLightingProfile';
import type { RenderBudgetSnapshot } from './renderQuality';
import { getWorldSize, type SimState } from './sim';

const WORLD_SCALE = 0.02;
const IBL_FACE_SIZE = 8;

export type BabylonRefineryLightingBudget = {
  tierName: RenderBudgetSnapshot['tierName'];
  iblEnabled: boolean;
  iblIntensity: number;
  shadowMapSize: 0 | RenderBudgetSnapshot['shadowMapSize'];
  practicalLightCount: 1 | 2;
  maxSimultaneousLights: 3 | 5 | 6;
  shadowCasterLimit: 0 | 72 | 128;
};

function scaled(value: number) {
  return value * WORLD_SCALE;
}

function colorFromHex(hex: number) {
  return Color3.FromInts((hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff);
}

function normalizedPanelRgb(panelIndex: number): readonly [number, number, number] {
  const source = REFINERY_IBL_PANELS[panelIndex]?.color ?? [1, 1, 1];
  const max = Math.max(1, source[0], source[1], source[2]);
  return [source[0] / max, source[1] / max, source[2] / max];
}

function createFace(primary: readonly [number, number, number], secondary: readonly [number, number, number]) {
  const pixels = new Uint8Array(IBL_FACE_SIZE * IBL_FACE_SIZE * 4);
  const denominator = Math.max(1, (IBL_FACE_SIZE - 1) * 2);
  for (let y = 0; y < IBL_FACE_SIZE; y += 1) {
    for (let x = 0; x < IBL_FACE_SIZE; x += 1) {
      const mix = (x + y) / denominator;
      const offset = (y * IBL_FACE_SIZE + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const linear = primary[channel] * (1 - mix) + secondary[channel] * mix;
        pixels[offset + channel] = Math.round(Math.max(0, Math.min(1, linear)) * 220);
      }
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}

export function createBabylonRefineryIblTexture(scene: Scene) {
  const amber = normalizedPanelRgb(0);
  const furnace = normalizedPanelRgb(1);
  const cyan = normalizedPanelRgb(2);
  const neutral = normalizedPanelRgb(3);
  const lower = normalizedPanelRgb(4);
  const faces = [
    createFace(cyan, neutral),
    createFace(neutral, furnace),
    createFace(amber, cyan),
    createFace(lower, furnace),
    createFace(furnace, amber),
    createFace(amber, neutral),
  ];
  const texture = new RawCubeTexture(
    scene,
    faces,
    IBL_FACE_SIZE,
    Constants.TEXTUREFORMAT_RGBA,
    Constants.TEXTURETYPE_UNSIGNED_BYTE,
    true,
    false,
    Constants.TEXTURE_TRILINEAR_SAMPLINGMODE,
  );
  texture.name = 'p27-b11-refinery-ibl';
  texture.gammaSpace = false;
  return texture;
}

export function resolveBabylonRefineryLightingBudget(
  budget: Pick<RenderBudgetSnapshot, 'tierName' | 'shadows' | 'shadowMapSize' | 'refineryIblScale'>,
): BabylonRefineryLightingBudget {
  const tierName = budget.tierName;
  return {
    tierName,
    iblEnabled: budget.refineryIblScale >= 0.5,
    iblIntensity: REFINERY_IBL_PROFILE.intensity * budget.refineryIblScale,
    shadowMapSize: budget.shadows ? budget.shadowMapSize : 0,
    practicalLightCount: tierName === 'performance' ? 1 : 2,
    maxSimultaneousLights: tierName === 'high' ? 6 : tierName === 'balanced' ? 5 : 3,
    shadowCasterLimit: tierName === 'high' ? 128 : tierName === 'balanced' ? 72 : 0,
  };
}

function isShadowReceiver(mesh: AbstractMesh) {
  if (!mesh.isEnabled() || !mesh.isVisible || mesh.visibility < 0.85 || mesh.getTotalVertices() <= 0) return false;
  const alpha = mesh.material?.alpha ?? 1;
  if (alpha < 0.82) return false;
  return !/(ring|glyph|beam|marker|telegraph|protocol|status|lifecycle|muzzle|flash|signal|cue|objective-guide|hazard)/i.test(mesh.name);
}

function shadowPriority(mesh: AbstractMesh) {
  if (/player|operator|enemy/i.test(mesh.name)) return 0;
  if (/processor|bulkhead|crate|gantry|terminal|object/i.test(mesh.name)) return 1;
  return 2;
}

export class BabylonRefineryLighting {
  private readonly scene: Scene;
  private readonly canvas: HTMLCanvasElement;
  private readonly hemisphere: HemisphericLight;
  private readonly keyLight: DirectionalLight;
  private readonly rimLight: DirectionalLight;
  private readonly emergencyLight: PointLight;
  private readonly readabilityLight: PointLight;
  private readonly practicalLights: readonly [PointLight, PointLight];
  private readonly iblTexture: RawCubeTexture;
  private shadowGenerator: ShadowGenerator | null = null;
  private shadowMapSize = 0;

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
    this.scene = scene;
    this.canvas = canvas;

    const profile = REFINERY_BABYLON_LIGHTING_PROFILE;
    this.hemisphere = new HemisphericLight('p27-b11-refinery-hemisphere', new Vector3(-0.5, 1, 0.35), scene);
    this.hemisphere.diffuse = colorFromHex(profile.hemisphere.skyColor);
    this.hemisphere.groundColor = colorFromHex(profile.hemisphere.groundColor);
    this.hemisphere.intensity = profile.hemisphere.intensity;

    const keyPosition = Vector3.FromArray(profile.key.position);
    this.keyLight = new DirectionalLight('p27-b11-refinery-key', keyPosition.scale(-1).normalize(), scene);
    this.keyLight.position = keyPosition;
    this.keyLight.diffuse = colorFromHex(profile.key.color);
    this.keyLight.intensity = profile.key.intensity;
    this.keyLight.autoUpdateExtends = false;
    this.keyLight.orthoLeft = -profile.shadow.orthoExtent;
    this.keyLight.orthoRight = profile.shadow.orthoExtent;
    this.keyLight.orthoTop = profile.shadow.orthoExtent;
    this.keyLight.orthoBottom = -profile.shadow.orthoExtent;
    this.keyLight.shadowMinZ = profile.shadow.near;
    this.keyLight.shadowMaxZ = profile.shadow.far;

    const rimPosition = Vector3.FromArray(profile.rim.position);
    this.rimLight = new DirectionalLight('p27-b11-refinery-rim', rimPosition.scale(-1).normalize(), scene);
    this.rimLight.position = rimPosition;
    this.rimLight.diffuse = colorFromHex(profile.rim.color);
    this.rimLight.intensity = profile.rim.intensity;

    this.emergencyLight = new PointLight('p27-b11-refinery-emergency', Vector3.Zero(), scene);
    this.emergencyLight.diffuse = colorFromHex(profile.emergency.color);
    this.emergencyLight.range = profile.emergency.range;

    this.readabilityLight = new PointLight('p27-b11-player-readability', Vector3.Zero(), scene);
    this.readabilityLight.diffuse = colorFromHex(profile.readability.color);
    this.readabilityLight.range = profile.readability.range;

    this.practicalLights = profile.practicals.map((practical, index) => {
      const light = new PointLight('p27-b11-refinery-practical-' + index, Vector3.Zero(), scene);
      light.diffuse = colorFromHex(practical.color);
      light.range = practical.range;
      return light;
    }) as unknown as readonly [PointLight, PointLight];

    this.iblTexture = createBabylonRefineryIblTexture(scene);
    scene.environmentTexture = this.iblTexture;
    scene.environmentIntensity = REFINERY_IBL_PROFILE.intensity;

    scene.imageProcessingConfiguration.toneMappingEnabled = true;
    scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    scene.imageProcessingConfiguration.exposure = profile.exposure;

    canvas.dataset.babylonLightingProfile = profile.id;
    canvas.dataset.babylonMaterialIntent = 'authored-gltf-pbr+procedural-world-pbr';
    this.setEnabled(false);
  }

  setEnabled(enabled: boolean) {
    this.hemisphere.setEnabled(enabled);
    this.keyLight.setEnabled(enabled);
    this.rimLight.setEnabled(enabled);
    this.emergencyLight.setEnabled(enabled);
    this.readabilityLight.setEnabled(enabled);
    this.practicalLights.forEach(light => light.setEnabled(enabled));
    if (enabled) return;
    this.shadowGenerator?.dispose();
    this.shadowGenerator = null;
    this.shadowMapSize = 0;
    if (this.scene.environmentTexture === this.iblTexture) this.scene.environmentTexture = null;
    this.scene.environmentIntensity = 0;
    this.emergencyLight.intensity = 0;
    this.readabilityLight.intensity = 0;
    this.practicalLights.forEach(light => { light.intensity = 0; });
  }

  sync(state: SimState, renderBudget: RenderBudgetSnapshot) {
    this.setEnabled(true);
    const profile = REFINERY_BABYLON_LIGHTING_PROFILE;
    const budget = resolveBabylonRefineryLightingBudget(renderBudget);
    const tierScale = budget.tierName === 'high' ? 1 : budget.tierName === 'balanced' ? 0.88 : 0.72;

    this.hemisphere.intensity = profile.hemisphere.intensity * (budget.tierName === 'performance' ? 0.88 : 1);
    this.keyLight.intensity = profile.key.intensity * tierScale;
    this.rimLight.intensity = profile.rim.intensity * (budget.tierName === 'performance' ? 0.76 : 1);

    const px = scaled(state.player.x);
    const pz = scaled(state.player.y);
    const activeBoss = state.enemies.find(enemy => enemy.active && !enemy.dead && enemy.role === 'boss') ?? null;
    const bossPulse = activeBoss?.bossPhase === 2 ? 1 + Math.sin(state.time * 4.6) * 0.16 : 1;
    this.emergencyLight.position.set(px + 2.4, 3.2, pz - 2.2);
    this.emergencyLight.intensity = profile.emergency.intensity * tierScale * bossPulse;

    let readabilityX = px;
    let readabilityZ = pz;
    let nearestDistanceSq = Number.POSITIVE_INFINITY;
    for (const enemy of state.enemies) {
      if (!enemy.active || enemy.dead) continue;
      const dx = enemy.x - state.player.x;
      const dy = enemy.y - state.player.y;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq >= nearestDistanceSq || distanceSq > 650 * 650) continue;
      nearestDistanceSq = distanceSq;
      readabilityX = scaled(state.player.x + dx * 0.42);
      readabilityZ = scaled(state.player.y + dy * 0.42);
    }
    this.readabilityLight.position.set(readabilityX, 2.7, readabilityZ);
    this.readabilityLight.intensity = profile.readability.intensity * (budget.tierName === 'performance' ? 0.7 : 1);
    this.readabilityLight.range = profile.readability.range * (budget.tierName === 'performance' ? 0.78 : 1);

    const world = getWorldSize();
    this.practicalLights.forEach((light, index) => {
      const spec = profile.practicals[index];
      const enabled = index < budget.practicalLightCount;
      light.setEnabled(enabled);
      light.position.set(scaled(world.w * spec.normalizedX), spec.height, scaled(world.h * spec.normalizedZ));
      light.intensity = enabled ? spec.intensity * tierScale * bossPulse : 0;
    });

    const qaExplicit = this.canvas.dataset.graphicsPathSelection === 'qa-explicit';
    const qaIblDisabled = qaExplicit && this.canvas.dataset.refineryIblQa === 'off';
    const iblEnabled = !qaIblDisabled && (qaExplicit || budget.iblEnabled);
    this.scene.environmentTexture = iblEnabled ? this.iblTexture : null;
    this.scene.environmentIntensity = iblEnabled ? budget.iblIntensity : 0;
    this.scene.imageProcessingConfiguration.exposure = profile.exposure * (budget.tierName === 'performance' ? 0.98 : 1);

    let pbrMaterials = 0;
    let standardMaterials = 0;
    for (const material of this.scene.materials) {
      if (material instanceof PBRMaterial) {
        material.maxSimultaneousLights = budget.maxSimultaneousLights;
        pbrMaterials += 1;
      } else if (material.getClassName() === 'StandardMaterial') {
        standardMaterials += 1;
      }
    }

    const shadowCasterCount = this.syncShadows(budget);
    this.canvas.dataset.renderTier = budget.tierName;
    this.canvas.dataset.graphicsQuality = renderBudget.qualityMode;
    this.canvas.dataset.babylonLightingBudget = [
      'tier:' + budget.tierName,
      'ibl:' + renderBudget.refineryIblScale.toFixed(2),
      'shadow:' + budget.shadowMapSize,
      'practical:' + budget.practicalLightCount,
      'max-lights:' + budget.maxSimultaneousLights,
    ].join('|');
    this.canvas.dataset.environmentIbl = iblEnabled
      ? 'raw-cube:' + REFINERY_IBL_PROFILE.id + ':intensity-' + budget.iblIntensity.toFixed(2)
      : qaIblDisabled ? 'off:qa-baseline' : 'off:adaptive-budget';
    this.canvas.dataset.environmentLighting = [
      'refinery-key',
      'rim',
      'ibl:' + (iblEnabled ? 'raw-cube' : 'off'),
      'practical:' + budget.practicalLightCount,
      'shadow:' + (budget.shadowMapSize || 'off'),
    ].join('+');
    this.canvas.dataset.environmentShadowBudget = budget.shadowMapSize
      ? 'key:' + budget.shadowMapSize + ':pcf-low:casters-' + shadowCasterCount
      : 'key:off';
    this.canvas.dataset.environmentTone = 'aces-' + this.scene.imageProcessingConfiguration.exposure.toFixed(2)
      + '+ibl-' + (iblEnabled ? budget.iblIntensity.toFixed(2) : 'off');
    this.canvas.dataset.locationLighting = 'asteroid-refinery:' + profile.id
      + ':aces-' + this.scene.imageProcessingConfiguration.exposure.toFixed(2);
    this.canvas.dataset.babylonPbrMaterials = 'pbr:' + pbrMaterials
      + '|standard:' + standardMaterials
      + '|max-lights:' + budget.maxSimultaneousLights;
  }

  private syncShadows(budget: BabylonRefineryLightingBudget) {
    if (!budget.shadowMapSize || budget.shadowCasterLimit === 0) {
      this.shadowGenerator?.dispose();
      this.shadowGenerator = null;
      this.shadowMapSize = 0;
      return 0;
    }

    if (!this.shadowGenerator || this.shadowMapSize !== budget.shadowMapSize) {
      this.shadowGenerator?.dispose();
      const generator = new ShadowGenerator(budget.shadowMapSize, this.keyLight);
      generator.usePercentageCloserFiltering = true;
      generator.filteringQuality = ShadowGenerator.QUALITY_LOW;
      generator.bias = REFINERY_BABYLON_LIGHTING_PROFILE.shadow.bias;
      generator.normalBias = REFINERY_BABYLON_LIGHTING_PROFILE.shadow.normalBias;
      this.shadowGenerator = generator;
      this.shadowMapSize = budget.shadowMapSize;
    }

    const receivers = this.scene.meshes.filter(isShadowReceiver);
    for (const mesh of receivers) mesh.receiveShadows = true;
    const casters = receivers
      .filter(mesh => !/(floor|grate|ring|beam|signal)/i.test(mesh.name))
      .sort((a, b) => shadowPriority(a) - shadowPriority(b) || a.name.localeCompare(b.name))
      .slice(0, budget.shadowCasterLimit);
    const map = this.shadowGenerator.getShadowMap();
    if (map) map.renderList = casters;
    return casters.length;
  }

  dispose() {
    if (this.scene.environmentTexture === this.iblTexture) this.scene.environmentTexture = null;
    this.shadowGenerator?.dispose();
    this.shadowGenerator = null;
    this.hemisphere.dispose();
    this.keyLight.dispose();
    this.rimLight.dispose();
    this.emergencyLight.dispose();
    this.readabilityLight.dispose();
    this.practicalLights.forEach(light => light.dispose());
    this.iblTexture.dispose();
  }
}
