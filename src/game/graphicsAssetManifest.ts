import { createGraphicsAssetSpec, type GraphicsAssetFamily } from './graphicsAssets';

// LOD1 is the articulated mobile gameplay model; LOD2 remains the ultra-light fallback.
// Hero-quality LOD0 will be added after the animation and socket contract is proven.
// Keeping only shipped files in the family guarantees adaptive selection falls back to a real asset.
export const OPERATOR_ASSET_FAMILY: GraphicsAssetFamily = {
  id: 'operator-field-suit',
  lods: {
    1: createGraphicsAssetSpec('operator-field-suit-lod1', 'operator', '/assets/models/operators/operator-field-suit-lod1.glb', 1),
    2: createGraphicsAssetSpec('operator-field-suit-lod2', 'operator', '/assets/models/operators/operator-field-suit-lod2.glb', 2),
  },
};

export const SHOWCASE_REFINERY_MODULE_FAMILY: GraphicsAssetFamily = {
  id: 'refinery-processing-module-a',
  lods: {
    0: createGraphicsAssetSpec('refinery-processing-module-a-lod0', 'environment-module', '/assets/models/environments/refinery-processing-module-a-lod0.glb', 0),
    1: createGraphicsAssetSpec('refinery-processing-module-a-lod1', 'environment-module', '/assets/models/environments/refinery-processing-module-a-lod1.glb', 1),
    2: createGraphicsAssetSpec('refinery-processing-module-a-lod2', 'environment-module', '/assets/models/environments/refinery-processing-module-a-lod2.glb', 2),
  },
};
