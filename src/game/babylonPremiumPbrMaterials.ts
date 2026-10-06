import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';

export type PremiumPbrSurfaceId = 'painted-metal' | 'bare-metal' | 'deck-plate' | 'polymer-rubber' | 'emissive-fixture';

export type PremiumPbrSurfaceDefinition = {
  id: PremiumPbrSurfaceId;
  uvScale: number;
  normalStrength: number;
  textures: {
    baseColor: string;
    normal: string;
    orm: string;
    emissive?: string;
  };
  emissiveColor?: readonly [number, number, number];
};

const ROOT = '/assets/materials/premium-pbr';

export const PREMIUM_PBR_SURFACE_LIBRARY: Readonly<Record<PremiumPbrSurfaceId, PremiumPbrSurfaceDefinition>> = {
  'painted-metal': {
    id: 'painted-metal',
    uvScale: 2,
    normalStrength: 0.9,
    textures: {
      baseColor: `${ROOT}/painted-metal-base-color.ktx2`,
      normal: `${ROOT}/painted-metal-normal.ktx2`,
      orm: `${ROOT}/painted-metal-orm.ktx2`,
    },
  },
  'bare-metal': {
    id: 'bare-metal',
    uvScale: 2.4,
    normalStrength: 0.8,
    textures: {
      baseColor: `${ROOT}/bare-metal-base-color.ktx2`,
      normal: `${ROOT}/bare-metal-normal.ktx2`,
      orm: `${ROOT}/bare-metal-orm.ktx2`,
    },
  },
  'deck-plate': {
    id: 'deck-plate',
    uvScale: 2,
    normalStrength: 1.05,
    textures: {
      baseColor: `${ROOT}/deck-plate-base-color.ktx2`,
      normal: `${ROOT}/deck-plate-normal.ktx2`,
      orm: `${ROOT}/deck-plate-orm.ktx2`,
    },
  },
  'polymer-rubber': {
    id: 'polymer-rubber',
    uvScale: 3,
    normalStrength: 0.85,
    textures: {
      baseColor: `${ROOT}/polymer-rubber-base-color.ktx2`,
      normal: `${ROOT}/polymer-rubber-normal.ktx2`,
      orm: `${ROOT}/polymer-rubber-orm.ktx2`,
    },
  },
  'emissive-fixture': {
    id: 'emissive-fixture',
    uvScale: 1.5,
    normalStrength: 0.8,
    textures: {
      baseColor: `${ROOT}/emissive-fixture-base-color.ktx2`,
      normal: `${ROOT}/emissive-fixture-normal.ktx2`,
      orm: `${ROOT}/emissive-fixture-orm.ktx2`,
      emissive: `${ROOT}/emissive-fixture-emissive.ktx2`,
    },
    emissiveColor: [0.72, 1, 1.18],
  },
};

export type PremiumPbrTextureFactory = (url: string, scene: Scene, gammaSpace: boolean) => Texture;

function defaultTextureFactory(url: string, scene: Scene, gammaSpace: boolean) {
  const texture = new Texture(url, scene, false, false, Texture.TRILINEAR_SAMPLINGMODE);
  texture.gammaSpace = gammaSpace;
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  return texture;
}

function applyTiling(texture: Texture, uvScale: number) {
  texture.uScale = uvScale;
  texture.vScale = uvScale;
  return texture;
}

export function createPremiumPbrSurfaceMaterial(
  scene: Scene,
  id: PremiumPbrSurfaceId,
  textureFactory: PremiumPbrTextureFactory = defaultTextureFactory,
) {
  const definition = PREMIUM_PBR_SURFACE_LIBRARY[id];
  const material = new PBRMaterial(`premium-pbr-${id}`, scene);
  const albedo = applyTiling(textureFactory(definition.textures.baseColor, scene, true), definition.uvScale);
  const normal = applyTiling(textureFactory(definition.textures.normal, scene, false), definition.uvScale);
  const orm = applyTiling(textureFactory(definition.textures.orm, scene, false), definition.uvScale);

  normal.level = definition.normalStrength;
  material.albedoTexture = albedo;
  material.bumpTexture = normal;
  material.metallicTexture = orm;
  material.metallic = 1;
  material.roughness = 1;
  material.useRoughnessFromMetallicTextureAlpha = false;
  material.useRoughnessFromMetallicTextureGreen = true;
  material.useMetallnessFromMetallicTextureBlue = true;
  material.useAmbientOcclusionFromMetallicTextureRed = true;
  material.useAmbientInGrayScale = true;
  material.forceIrradianceInFragment = true;

  if (definition.textures.emissive) {
    const emissive = applyTiling(textureFactory(definition.textures.emissive, scene, true), definition.uvScale);
    material.emissiveTexture = emissive;
    const [r, g, b] = definition.emissiveColor ?? [1, 1, 1];
    material.emissiveColor = new Color3(r, g, b);
  }

  return material;
}

export type PremiumPbrMaterialLibrary = Readonly<Record<PremiumPbrSurfaceId, PBRMaterial>>;

const sceneLibraries = new WeakMap<Scene, PremiumPbrMaterialLibrary>();

export function getPremiumPbrMaterialLibrary(scene: Scene): PremiumPbrMaterialLibrary {
  const existing = sceneLibraries.get(scene);
  if (existing) return existing;
  const library: PremiumPbrMaterialLibrary = {
    'painted-metal': createPremiumPbrSurfaceMaterial(scene, 'painted-metal'),
    'bare-metal': createPremiumPbrSurfaceMaterial(scene, 'bare-metal'),
    'deck-plate': createPremiumPbrSurfaceMaterial(scene, 'deck-plate'),
    'polymer-rubber': createPremiumPbrSurfaceMaterial(scene, 'polymer-rubber'),
    'emissive-fixture': createPremiumPbrSurfaceMaterial(scene, 'emissive-fixture'),
  };
  sceneLibraries.set(scene, library);
  scene.onDisposeObservable.addOnce(() => sceneLibraries.delete(scene));
  return library;
}
