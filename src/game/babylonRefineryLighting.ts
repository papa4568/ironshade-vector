import { Constants } from '@babylonjs/core/Engines/constants';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { CubeTexture } from '@babylonjs/core/Materials/Textures/cubeTexture';
import { RawCubeTexture } from '@babylonjs/core/Materials/Textures/rawCubeTexture';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import { createRefineryContactDepthAlphaData } from './refineryContactDepth';
import {
  REFINERY_BABYLON_LIGHTING_PROFILE,
  REFINERY_IBL_PANELS,
  REFINERY_IBL_PROFILE,
} from './refineryLightingProfile';
import type { RenderBudgetSnapshot } from './renderQuality';
import { getWorldSize, type Enemy, type SimState } from './sim';

const WORLD_SCALE = 0.02;
const IBL_FALLBACK_FACE_SIZE = 8;
const REFINERY_PREFILTERED_IBL_URL = '/assets/environments/refinery-prefiltered.env';

export const REFINERY_ACTOR_GROUNDING_PROFILE = Object.freeze({
  id: 'key-linked-contact-projector-v1',
  nearbyRadius: 900,
  alphaTextureSize: 64,
  coreOpacity: 0.3,
  penumbraOpacity: 0.14,
  playerScale: 1,
  coreWidth: 0.68,
  coreDepth: 0.42,
  penumbraWidth: 1.18,
  penumbraDepth: 0.52,
  penumbraOffset: 0.24,
  protectedCueGroups: Object.freeze(['telegraphs', 'objectives', 'hazards', 'interactables']),
});

type RefineryIblLoadState = 'loading' | 'authored' | 'fallback';
type ActorGroundingVisual = { core: AbstractMesh; penumbra: AbstractMesh };
export type RefineryShadowAnchor = { x: number; z: number };

export type BabylonRefineryLightingBudget = {
  tierName: RenderBudgetSnapshot['tierName'];
  iblEnabled: boolean;
  iblIntensity: number;
  shadowMapSize: 0 | 1024 | 2048;
  practicalLightCount: 1 | 2;
  maxSimultaneousLights: 3 | 5 | 6;
};

export function resolveRefineryTopologyToken(items: readonly { uniqueId: number }[]) {
  const last = items.length ? items[items.length - 1].uniqueId : 0;
  return items.length + ':' + last;
}

export function resolveRefineryShadowWorkKey(
  meshTopologyToken: string,
  anchor: RefineryShadowAnchor,
  shadowMapSize: BabylonRefineryLightingBudget['shadowMapSize'],
) {
  return meshTopologyToken + '|' + shadowMapSize + '|' + anchor.x.toFixed(4) + ',' + anchor.z.toFixed(4);
}

export function resolveRefineryMaterialWorkKey(materialTopologyToken: string, maxSimultaneousLights: number) {
  return materialTopologyToken + '|' + maxSimultaneousLights;
}

export class RefineryLightingWorkProfile {
  frameCount = 0;
  shadowListRebuildCount = 0;
  materialLightRebuildCount = 0;
  private shadowKey = '';
  private materialKey = '';

  beginFrame() {
    this.frameCount += 1;
  }

  needsShadowListRebuild(key: string) {
    if (key === this.shadowKey) return false;
    this.shadowKey = key;
    this.shadowListRebuildCount += 1;
    return true;
  }

  invalidateShadowList() {
    this.shadowKey = '';
  }

  needsMaterialLightRebuild(key: string) {
    if (key === this.materialKey) return false;
    this.materialKey = key;
    this.materialLightRebuildCount += 1;
    return true;
  }
}

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
  const pixels = new Uint8Array(IBL_FALLBACK_FACE_SIZE * IBL_FALLBACK_FACE_SIZE * 4);
  const denominator = Math.max(1, (IBL_FALLBACK_FACE_SIZE - 1) * 2);
  for (let y = 0; y < IBL_FALLBACK_FACE_SIZE; y += 1) {
    for (let x = 0; x < IBL_FALLBACK_FACE_SIZE; x += 1) {
      const mix = (x + y) / denominator;
      const offset = (y * IBL_FALLBACK_FACE_SIZE + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const linear = primary[channel] * (1 - mix) + secondary[channel] * mix;
        pixels[offset + channel] = Math.round(Math.max(0, Math.min(1, linear)) * 220);
      }
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}

export function createBabylonRefineryIblFallbackTexture(scene: Scene) {
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
    IBL_FALLBACK_FACE_SIZE,
    Constants.TEXTUREFORMAT_RGBA,
    Constants.TEXTURETYPE_UNSIGNED_BYTE,
    true,
    false,
    Constants.TEXTURE_TRILINEAR_SAMPLINGMODE,
  );
  texture.name = 'p28-a1-refinery-ibl-fallback';
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
    shadowMapSize: !budget.shadows || tierName === 'performance' ? 0 : tierName === 'high' ? 2048 : 1024,
    practicalLightCount: tierName === 'performance' ? 1 : 2,
    maxSimultaneousLights: tierName === 'high' ? 6 : tierName === 'balanced' ? 5 : 3,
  };
}

export function resolveRefineryShadowAnchor(worldX: number, worldZ: number): RefineryShadowAnchor {
  const snap = REFINERY_BABYLON_LIGHTING_PROFILE.shadow.anchorSnap;
  return {
    x: Math.round(worldX / snap) * snap,
    z: Math.round(worldZ / snap) * snap,
  };
}

export function refineryActorGroundingScale(role: Enemy['role']) {
  if (role === 'boss') return 1.62;
  if (role === 'elite') return 1.22;
  if (role === 'suppressor') return 1.14;
  if (role === 'technician') return 0.94;
  return 1;
}

function isShadowReceiver(mesh: AbstractMesh) {
  if (mesh.getTotalVertices() <= 0) return false;
  const alpha = mesh.material?.alpha ?? 1;
  if (alpha < 0.82) return false;
  return !/(ring|glyph|beam|marker|telegraph|protocol|status|lifecycle|muzzle|flash|signal|cue|objective-guide|hazard|grounding)/i.test(mesh.name);
}

function enableShadowReceiver(mesh: AbstractMesh) {
  const receiver = mesh instanceof InstancedMesh ? mesh.sourceMesh : mesh;
  receiver.receiveShadows = true;
}

function shadowPriority(mesh: AbstractMesh) {
  if (/player|operator|enemy/i.test(mesh.name)) return 0;
  if (/processor|bulkhead|crate|gantry|terminal|object/i.test(mesh.name)) return 1;
  return 2;
}

function isShadowCasterInCoverage(mesh: AbstractMesh, anchor: RefineryShadowAnchor) {
  const position = mesh.getAbsolutePosition();
  const coverage = REFINERY_BABYLON_LIGHTING_PROFILE.shadow.orthoExtent
    + REFINERY_BABYLON_LIGHTING_PROFILE.shadow.casterPadding;
  return Math.abs(position.x - anchor.x) <= coverage && Math.abs(position.z - anchor.z) <= coverage;
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
  private readonly actorGroundingTexture: RawTexture;
  private readonly actorGroundingCoreMaterial: StandardMaterial;
  private readonly actorGroundingPenumbraMaterial: StandardMaterial;
  private readonly actorGroundingCoreSource: Mesh;
  private readonly actorGroundingPenumbraSource: Mesh;
  private readonly enemyGrounding = new Map<number, ActorGroundingVisual>();
  private readonly workProfile = new RefineryLightingWorkProfile();
  private iblTexture: CubeTexture | RawCubeTexture | null = null;
  private authoredIblTexture: CubeTexture | null = null;
  private fallbackIblTexture: RawCubeTexture | null = null;
  private iblLoadState: RefineryIblLoadState = 'loading';
  private shadowGenerator: ShadowGenerator | null = null;
  private shadowMapSize = 0;
  private shadowCasterCount = 0;
  private shadowMeshTopologyToken = '';
  private shadowAnchorKey = '';
  private shadowRebuildReason = 'init';
  private materialPbrCount = 0;
  private materialStandardCount = 0;
  private materialTopologyToken = '';
  private materialMaxSimultaneousLights = 0;
  private materialRebuildReason = 'init';

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

    const groundingAlpha = createRefineryContactDepthAlphaData(REFINERY_ACTOR_GROUNDING_PROFILE.alphaTextureSize);
    this.actorGroundingTexture = RawTexture.CreateRGBATexture(
      groundingAlpha,
      REFINERY_ACTOR_GROUNDING_PROFILE.alphaTextureSize,
      REFINERY_ACTOR_GROUNDING_PROFILE.alphaTextureSize,
      scene,
      false,
      false,
    );
    this.actorGroundingTexture.name = 'p28-a2-actor-grounding-alpha';
    this.actorGroundingTexture.hasAlpha = true;

    this.actorGroundingCoreMaterial = new StandardMaterial('p28-a2-actor-grounding-core-material', scene);
    this.actorGroundingCoreMaterial.diffuseColor = new Color3(0.012, 0.011, 0.01);
    this.actorGroundingCoreMaterial.specularColor = Color3.Black();
    this.actorGroundingCoreMaterial.diffuseTexture = this.actorGroundingTexture;
    this.actorGroundingCoreMaterial.useAlphaFromDiffuseTexture = true;
    this.actorGroundingCoreMaterial.alpha = REFINERY_ACTOR_GROUNDING_PROFILE.coreOpacity;
    this.actorGroundingCoreMaterial.disableLighting = true;
    this.actorGroundingCoreMaterial.disableDepthWrite = true;
    this.actorGroundingCoreMaterial.backFaceCulling = false;

    this.actorGroundingPenumbraMaterial = new StandardMaterial('p28-a2-actor-grounding-penumbra-material', scene);
    this.actorGroundingPenumbraMaterial.diffuseColor = new Color3(0.018, 0.015, 0.012);
    this.actorGroundingPenumbraMaterial.specularColor = Color3.Black();
    this.actorGroundingPenumbraMaterial.diffuseTexture = this.actorGroundingTexture;
    this.actorGroundingPenumbraMaterial.useAlphaFromDiffuseTexture = true;
    this.actorGroundingPenumbraMaterial.alpha = REFINERY_ACTOR_GROUNDING_PROFILE.penumbraOpacity;
    this.actorGroundingPenumbraMaterial.disableLighting = true;
    this.actorGroundingPenumbraMaterial.disableDepthWrite = true;
    this.actorGroundingPenumbraMaterial.backFaceCulling = false;

    this.actorGroundingCoreSource = MeshBuilder.CreatePlane(
      'p28-a2-player-grounding-core',
      { width: 1, height: 1, sideOrientation: Mesh.DOUBLESIDE },
      scene,
    );
    this.actorGroundingCoreSource.material = this.actorGroundingCoreMaterial;
    this.actorGroundingCoreSource.isPickable = false;
    this.actorGroundingCoreSource.receiveShadows = false;
    this.actorGroundingCoreSource.alphaIndex = -300;

    this.actorGroundingPenumbraSource = MeshBuilder.CreatePlane(
      'p28-a2-player-grounding-penumbra',
      { width: 1, height: 1, sideOrientation: Mesh.DOUBLESIDE },
      scene,
    );
    this.actorGroundingPenumbraSource.material = this.actorGroundingPenumbraMaterial;
    this.actorGroundingPenumbraSource.isPickable = false;
    this.actorGroundingPenumbraSource.receiveShadows = false;
    this.actorGroundingPenumbraSource.alphaIndex = -301;

    const authoredIblTexture = new CubeTexture(
      REFINERY_PREFILTERED_IBL_URL,
      scene,
      undefined,
      false,
      undefined,
      () => {
        this.iblLoadState = 'authored';
        this.canvas.dataset.refineryIblAsset = 'prefiltered-env:ready';
      },
      () => this.activateIblFallback(),
      undefined,
      true,
    );
    authoredIblTexture.name = 'p28-a1-refinery-prefiltered-ibl';
    authoredIblTexture.gammaSpace = false;
    this.authoredIblTexture = authoredIblTexture;
    this.iblTexture = authoredIblTexture;
    canvas.dataset.refineryIblAsset = 'prefiltered-env:loading';
    scene.environmentTexture = authoredIblTexture;
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
    this.actorGroundingCoreSource.setEnabled(false);
    this.actorGroundingPenumbraSource.setEnabled(false);
    for (const visual of this.enemyGrounding.values()) {
      visual.core.setEnabled(false);
      visual.penumbra.setEnabled(false);
    }
    for (const key of ['actorGrounding', 'actorGroundingActors', 'actorGroundingCuePriority', 'environmentShadowAnchor'] as const) {
      delete this.canvas.dataset[key];
    }
    this.shadowGenerator?.dispose();
    this.shadowGenerator = null;
    this.shadowMapSize = 0;
    this.shadowCasterCount = 0;
    this.workProfile.invalidateShadowList();
    if (this.scene.environmentTexture === this.iblTexture) this.scene.environmentTexture = null;
    this.scene.environmentIntensity = 0;
    this.emergencyLight.intensity = 0;
    this.readabilityLight.intensity = 0;
    this.practicalLights.forEach(light => { light.intensity = 0; });
  }

  sync(state: SimState, renderBudget: RenderBudgetSnapshot) {
    this.workProfile.beginFrame();
    this.setEnabled(true);
    const profile = REFINERY_BABYLON_LIGHTING_PROFILE;
    const budget = resolveBabylonRefineryLightingBudget(renderBudget);
    const tierScale = budget.tierName === 'high' ? 1 : budget.tierName === 'balanced' ? 0.88 : 0.72;

    this.hemisphere.intensity = profile.hemisphere.intensity * (budget.tierName === 'performance' ? 0.88 : 1);
    this.keyLight.intensity = profile.key.intensity * tierScale;
    this.rimLight.intensity = profile.rim.intensity * (budget.tierName === 'performance' ? 0.76 : 1);

    const px = scaled(state.player.x);
    const pz = scaled(state.player.y);
    const shadowAnchor = this.syncShadowProjection(px, pz);
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

    const materialStats = this.syncMaterialLights(budget.maxSimultaneousLights);
    const groundedEnemyCount = this.syncActorGrounding(state, budget);
    const shadowCasterCount = this.syncShadows(budget, shadowAnchor);
    const authoredIblReady = this.iblLoadState === 'authored';
    const iblTelemetry = authoredIblReady
      ? 'raw-cube:' + REFINERY_IBL_PROFILE.id + ':intensity-' + budget.iblIntensity.toFixed(2)
      : this.iblLoadState === 'fallback'
        ? 'raw-cube-fallback:' + REFINERY_IBL_PROFILE.id + ':intensity-' + budget.iblIntensity.toFixed(2)
        : 'loading:prefiltered-env';
    const iblLightingTelemetry = authoredIblReady ? 'raw-cube' : this.iblLoadState === 'fallback' ? 'raw-cube-fallback' : 'loading';

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
      ? iblTelemetry
      : qaIblDisabled ? 'off:qa-baseline' : 'off:adaptive-budget';
    this.canvas.dataset.refineryIblAsset = this.iblLoadState === 'fallback'
      ? 'raw-cube:fallback'
      : 'prefiltered-env:' + this.iblLoadState;
    this.canvas.dataset.environmentLighting = [
      'refinery-key',
      'rim',
      'ibl:' + (iblEnabled ? iblLightingTelemetry : 'off'),
      'practical:' + budget.practicalLightCount,
      'shadow:' + (budget.shadowMapSize || 'off'),
      'actor-grounding:key-linked',
    ].join('+');
    this.canvas.dataset.environmentShadowAnchor = shadowAnchor.x.toFixed(2) + ',' + shadowAnchor.z.toFixed(2);
    this.canvas.dataset.environmentShadowBudget = budget.shadowMapSize
      ? 'key:' + budget.shadowMapSize
        + ':pcf-high:bias-' + profile.shadow.bias
        + ':normal-' + profile.shadow.normalBias
        + ':coverage-' + (profile.shadow.orthoExtent + profile.shadow.casterPadding)
        + ':snap-' + profile.shadow.anchorSnap
        + ':casters-' + shadowCasterCount
        + ':rebuilds-' + this.workProfile.shadowListRebuildCount
      : 'key:off:rebuilds-' + this.workProfile.shadowListRebuildCount;
    this.canvas.dataset.actorGrounding = REFINERY_ACTOR_GROUNDING_PROFILE.id
      + ':radius-' + REFINERY_ACTOR_GROUNDING_PROFILE.nearbyRadius
      + ':alpha-' + REFINERY_ACTOR_GROUNDING_PROFILE.alphaTextureSize;
    this.canvas.dataset.actorGroundingActors = 'player:1|enemies:' + groundedEnemyCount
      + '|layers:' + ((groundedEnemyCount + 1) * 2);
    this.canvas.dataset.actorGroundingCuePriority = 'alpha-index:-301..-300|protected:'
      + REFINERY_ACTOR_GROUNDING_PROFILE.protectedCueGroups.join('+');
    this.canvas.dataset.environmentTone = 'aces-' + this.scene.imageProcessingConfiguration.exposure.toFixed(2)
      + '+ibl-' + (iblEnabled ? budget.iblIntensity.toFixed(2) : 'off');
    this.canvas.dataset.locationLighting = 'asteroid-refinery:' + profile.id
      + ':aces-' + this.scene.imageProcessingConfiguration.exposure.toFixed(2);
    this.canvas.dataset.babylonPbrMaterials = 'pbr:' + materialStats.pbr
      + '|standard:' + materialStats.standard
      + '|max-lights:' + budget.maxSimultaneousLights
      + '|material-rebuilds:' + this.workProfile.materialLightRebuildCount;
    this.canvas.dataset.refineryLightingWork = [
      'frames:' + this.workProfile.frameCount,
      'shadow-rebuilds:' + this.workProfile.shadowListRebuildCount,
      'material-rebuilds:' + this.workProfile.materialLightRebuildCount,
      'shadow-reason:' + this.shadowRebuildReason,
      'material-reason:' + this.materialRebuildReason,
    ].join('|');
  }

  private syncMaterialLights(maxSimultaneousLights: BabylonRefineryLightingBudget['maxSimultaneousLights']) {
    const topologyToken = resolveRefineryTopologyToken(this.scene.materials);
    const workKey = resolveRefineryMaterialWorkKey(topologyToken, maxSimultaneousLights);
    if (!this.workProfile.needsMaterialLightRebuild(workKey)) {
      return { pbr: this.materialPbrCount, standard: this.materialStandardCount };
    }

    const reasons: string[] = [];
    if (topologyToken !== this.materialTopologyToken) reasons.push('topology');
    if (maxSimultaneousLights !== this.materialMaxSimultaneousLights) reasons.push('tier');
    this.materialRebuildReason = reasons.join('+') || 'initial';
    this.materialTopologyToken = topologyToken;
    this.materialMaxSimultaneousLights = maxSimultaneousLights;

    let pbrMaterials = 0;
    let standardMaterials = 0;
    for (const material of this.scene.materials) {
      if (material instanceof PBRMaterial) {
        material.maxSimultaneousLights = maxSimultaneousLights;
        pbrMaterials += 1;
      } else if (material.getClassName() === 'StandardMaterial') {
        standardMaterials += 1;
      }
    }
    this.materialPbrCount = pbrMaterials;
    this.materialStandardCount = standardMaterials;
    return { pbr: pbrMaterials, standard: standardMaterials };
  }

  private syncActorGrounding(state: SimState, budget: BabylonRefineryLightingBudget) {
    const profile = REFINERY_ACTOR_GROUNDING_PROFILE;
    const keyPosition = REFINERY_BABYLON_LIGHTING_PROFILE.key.position;
    const keyLength = Math.max(0.001, Math.hypot(keyPosition[0], keyPosition[2]));
    const shadowX = -keyPosition[0] / keyLength;
    const shadowZ = -keyPosition[2] / keyLength;
    const shadowAngle = Math.atan2(shadowZ, shadowX);
    const opacityScale = budget.tierName === 'high' ? 1 : budget.tierName === 'balanced' ? 0.92 : 0.84;
    this.actorGroundingCoreMaterial.alpha = profile.coreOpacity * opacityScale;
    this.actorGroundingPenumbraMaterial.alpha = profile.penumbraOpacity * opacityScale;

    this.syncActorGroundingPair(
      { core: this.actorGroundingCoreSource, penumbra: this.actorGroundingPenumbraSource },
      state.player.x,
      state.player.y,
      profile.playerScale,
      shadowX,
      shadowZ,
      shadowAngle,
    );

    for (const visual of this.enemyGrounding.values()) {
      visual.core.setEnabled(false);
      visual.penumbra.setEnabled(false);
    }

    let groundedEnemies = 0;
    const radiusSq = profile.nearbyRadius * profile.nearbyRadius;
    for (const enemy of state.enemies) {
      if (!enemy.active || enemy.dead) continue;
      const dx = enemy.x - state.player.x;
      const dy = enemy.y - state.player.y;
      if (dx * dx + dy * dy > radiusSq) continue;
      let visual = this.enemyGrounding.get(enemy.id);
      if (!visual) {
        const core = this.actorGroundingCoreSource.createInstance('p28-a2-enemy-grounding-core-' + enemy.id);
        const penumbra = this.actorGroundingPenumbraSource.createInstance('p28-a2-enemy-grounding-penumbra-' + enemy.id);
        core.isPickable = false;
        penumbra.isPickable = false;
        core.alphaIndex = -300;
        penumbra.alphaIndex = -301;
        visual = { core, penumbra };
        this.enemyGrounding.set(enemy.id, visual);
      }
      this.syncActorGroundingPair(
        visual,
        enemy.x,
        enemy.y,
        refineryActorGroundingScale(enemy.role),
        shadowX,
        shadowZ,
        shadowAngle,
      );
      groundedEnemies += 1;
    }
    return groundedEnemies;
  }

  private syncActorGroundingPair(
    visual: ActorGroundingVisual,
    simX: number,
    simY: number,
    scale: number,
    shadowX: number,
    shadowZ: number,
    shadowAngle: number,
  ) {
    const profile = REFINERY_ACTOR_GROUNDING_PROFILE;
    const x = scaled(simX);
    const z = scaled(simY);
    visual.core.setEnabled(true);
    visual.core.position.set(x, 0.029, z);
    visual.core.rotation.set(Math.PI / 2, shadowAngle, 0);
    visual.core.scaling.set(profile.coreWidth * scale, profile.coreDepth * scale, 1);

    visual.penumbra.setEnabled(true);
    visual.penumbra.position.set(
      x + shadowX * profile.penumbraOffset * scale,
      0.027,
      z + shadowZ * profile.penumbraOffset * scale,
    );
    visual.penumbra.rotation.set(Math.PI / 2, shadowAngle, 0);
    visual.penumbra.scaling.set(profile.penumbraWidth * scale, profile.penumbraDepth * scale, 1);
  }

  private activateIblFallback() {
    if (this.iblLoadState === 'fallback') return;
    const authoredIblTexture = this.authoredIblTexture;
    const wasActive = this.scene.environmentTexture === authoredIblTexture;
    const fallbackIblTexture = createBabylonRefineryIblFallbackTexture(this.scene);
    this.fallbackIblTexture = fallbackIblTexture;
    this.iblTexture = fallbackIblTexture;
    this.iblLoadState = 'fallback';
    this.canvas.dataset.refineryIblAsset = 'raw-cube:fallback';
    if (wasActive) this.scene.environmentTexture = fallbackIblTexture;
    authoredIblTexture?.dispose();
    this.authoredIblTexture = null;
  }

  private syncShadowProjection(playerX: number, playerZ: number) {
    const anchor = resolveRefineryShadowAnchor(playerX, playerZ);
    const key = REFINERY_BABYLON_LIGHTING_PROFILE.key.position;
    this.keyLight.position.set(anchor.x + key[0], key[1], anchor.z + key[2]);
    return anchor;
  }

  private syncShadows(budget: BabylonRefineryLightingBudget, anchor: RefineryShadowAnchor) {
    if (!budget.shadowMapSize) {
      this.shadowGenerator?.dispose();
      this.shadowGenerator = null;
      this.shadowMapSize = 0;
      this.shadowCasterCount = 0;
      this.workProfile.invalidateShadowList();
      return 0;
    }

    const topologyToken = resolveRefineryTopologyToken(this.scene.meshes);
    const anchorKey = anchor.x.toFixed(4) + ',' + anchor.z.toFixed(4);
    const workKey = resolveRefineryShadowWorkKey(topologyToken, anchor, budget.shadowMapSize);
    if (this.shadowGenerator && !this.workProfile.needsShadowListRebuild(workKey)) {
      return this.shadowCasterCount;
    }

    const reasons: string[] = [];
    if (topologyToken !== this.shadowMeshTopologyToken) reasons.push('topology');
    if (anchorKey !== this.shadowAnchorKey) reasons.push('anchor');
    if (budget.shadowMapSize !== this.shadowMapSize) reasons.push('tier');
    this.shadowRebuildReason = reasons.join('+') || 'initial';
    this.shadowMeshTopologyToken = topologyToken;
    this.shadowAnchorKey = anchorKey;

    if (!this.shadowGenerator || this.shadowMapSize !== budget.shadowMapSize) {
      this.shadowGenerator?.dispose();
      const generator = new ShadowGenerator(budget.shadowMapSize, this.keyLight);
      generator.usePercentageCloserFiltering = true;
      generator.filteringQuality = ShadowGenerator.QUALITY_HIGH;
      generator.bias = REFINERY_BABYLON_LIGHTING_PROFILE.shadow.bias;
      generator.normalBias = REFINERY_BABYLON_LIGHTING_PROFILE.shadow.normalBias;
      this.shadowGenerator = generator;
      this.shadowMapSize = budget.shadowMapSize;
    }

    const receivers = this.scene.meshes.filter(isShadowReceiver);
    for (const mesh of receivers) enableShadowReceiver(mesh);
    const casters = receivers
      .filter(mesh => !/(floor|grate|ring|beam|signal)/i.test(mesh.name))
      .filter(mesh => isShadowCasterInCoverage(mesh, anchor))
      .sort((a, b) => shadowPriority(a) - shadowPriority(b) || a.name.localeCompare(b.name));
    const map = this.shadowGenerator.getShadowMap();
    if (map) map.renderList = casters;
    this.shadowCasterCount = casters.length;
    return casters.length;
  }

  dispose() {
    if (this.scene.environmentTexture === this.iblTexture) this.scene.environmentTexture = null;
    this.shadowGenerator?.dispose();
    this.shadowGenerator = null;
    for (const visual of this.enemyGrounding.values()) {
      visual.core.dispose();
      visual.penumbra.dispose();
    }
    this.enemyGrounding.clear();
    this.actorGroundingCoreSource.dispose();
    this.actorGroundingPenumbraSource.dispose();
    this.actorGroundingCoreMaterial.dispose();
    this.actorGroundingPenumbraMaterial.dispose();
    this.actorGroundingTexture.dispose();
    this.hemisphere.dispose();
    this.keyLight.dispose();
    this.rimLight.dispose();
    this.emergencyLight.dispose();
    this.readabilityLight.dispose();
    this.practicalLights.forEach(light => light.dispose());
    this.authoredIblTexture?.dispose();
    this.fallbackIblTexture?.dispose();
    this.authoredIblTexture = null;
    this.fallbackIblTexture = null;
    this.iblTexture = null;
  }
}
