import { Color3 } from '@babylonjs/core/Maths/math.color';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { Scene } from '@babylonjs/core/scene';

export type PremiumPbrSurfaceId =
  | 'painted-metal'
  | 'bare-metal'
  | 'deck-plate'
  | 'polymer-rubber'
  | 'emissive-fixture';

export type PremiumPbrSurfaceDefinition = {
  id: PremiumPbrSurfaceId;
  baseColorUrl: string;
  normalUrl: string;
  ormUrl: string;
  emissiveUrl?: string;
  emissiveColor?: readonly [number, number, number];
  normalStrength: number;
};

const ROOT = '/assets/materials/premium-pbr';

export const PREMIUM_PBR_SURFACE_DEFINITIONS: readonly PremiumPbrSurfaceDefinition[] = [
  {
    id: 'painted-metal',
    baseColorUrl: `${ROOT}/painted-metal-base-color.ktx2`,
    normalUrl: `${ROOT}/painted-metal-normal.ktx2`,
    ormUrl: `${ROOT}/painted-metal-orm.ktx2`,
    normalStrength: 0.85,
  },
  {
    id: 'bare-metal',
    baseColorUrl: `${ROOT}/bare-metal-base-color.ktx2`,
    normalUrl: `${ROOT}/bare-metal-normal.ktx2`,
    ormUrl: `${ROOT}/bare-metal-orm.ktx2`,
    normalStrength: 0.7,
  },
  {
    id: 'deck-plate',
    baseColorUrl: `${ROOT}/deck-plate-base-color.ktx2`,
    normalUrl: `${ROOT}/deck-plate-normal.ktx2`,
    ormUrl: `${ROOT}/deck-plate-orm.ktx2`,
    normalStrength: 1,
  },
  {
    id: 'polymer-rubber',
    baseColorUrl: `${ROOT}/polymer-rubber-base-color.ktx2`,
    normalUrl: `${ROOT}/polymer-rubber-normal.ktx2`,
    ormUrl: `${ROOT}/polymer-rubber-orm.ktx2`,
    normalStrength: 0.72,
  },
  {
    id: 'emissive-fixture',
    baseColorUrl: `${ROOT}/emissive-fixture-base-color.ktx2`,
    normalUrl: `${ROOT}/emissive-fixture-normal.ktx2`,
    ormUrl: `${ROOT}/emissive-fixture-orm.ktx2`,
    emissiveUrl: `${ROOT}/emissive-fixture-emissive.ktx2`,
    emissiveColor: [1, 1, 1],
    normalStrength: 0.8,
  },
] as const;

export type BabylonPremiumPbrSurfaceLibrary = {
  readonly materials: ReadonlyMap<PremiumPbrSurfaceId, PBRMaterial>;
  get: (id: PremiumPbrSurfaceId) => PBRMaterial;
  dispose: () => void;
};

function createTexture(url: string, scene: Scene, gammaSpace: boolean, anisotropy: number) {
  const texture = new Texture(url, scene, false, false, Texture.TRILINEAR_SAMPLINGMODE);
  texture.gammaSpace = gammaSpace;
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  texture.anisotropicFilteringLevel = anisotropy;
  return texture;
}

export function createBabylonPremiumPbrSurfaceLibrary(scene: Scene): BabylonPremiumPbrSurfaceLibrary {
  const engineLimit = scene.getEngine().getCaps().maxAnisotropy ?? 16;
  const anisotropy = Math.max(1, Math.min(16, engineLimit));
  const materials = new Map<PremiumPbrSurfaceId, PBRMaterial>();
  const textures = new Set<Texture>();

  for (const definition of PREMIUM_PBR_SURFACE_DEFINITIONS) {
    const material = new PBRMaterial(`premium-pbr:${definition.id}`, scene);
    const albedo = createTexture(definition.baseColorUrl, scene, true, anisotropy);
    const normal = createTexture(definition.normalUrl, scene, false, anisotropy);
    const orm = createTexture(definition.ormUrl, scene, false, anisotropy);
    normal.level = definition.normalStrength;

    material.albedoTexture = albedo;
    material.bumpTexture = normal;
    material.metallicTexture = orm;
    material.ambientTexture = orm;
    material.metallic = 1;
    material.roughness = 1;
    material.useRoughnessFromMetallicTextureAlpha = false;
    material.useRoughnessFromMetallicTextureGreen = true;
    material.useMetallnessFromMetallicTextureBlue = true;
    material.useAmbientOcclusionFromMetallicTextureRed = true;
    material.useAmbientInGrayScale = true;
    material.ambientTextureStrength = 1;

    textures.add(albedo);
    textures.add(normal);
    textures.add(orm);

    if (definition.emissiveUrl) {
      const emissive = createTexture(definition.emissiveUrl, scene, true, anisotropy);
      material.emissiveTexture = emissive;
      const emissiveColor = definition.emissiveColor ?? [1, 1, 1];
      material.emissiveColor = new Color3(emissiveColor[0], emissiveColor[1], emissiveColor[2]);
      textures.add(emissive);
    }

    materials.set(definition.id, material);
  }

  let disposed = false;
  return {
    materials,
    get(id) {
      const material = materials.get(id);
      if (!material) throw new Error(`Unknown premium PBR surface ${id}`);
      return material;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const material of materials.values()) material.dispose(false, false);
      materials.clear();
      for (const texture of textures) texture.dispose();
      textures.clear();
    },
  };
}
