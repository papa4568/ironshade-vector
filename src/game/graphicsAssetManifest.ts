import { createGraphicsAssetSpec, type GraphicsAssetFamily } from './graphicsAssets';

// The first committed authored operator asset is the Performance-tier LOD2.
// Higher-detail LOD0/LOD1 variants will be added during the rigged operator vertical slice.
// Keeping only shipped files in the family guarantees adaptive selection falls back to a real asset.
export const OPERATOR_ASSET_FAMILY: GraphicsAssetFamily = {
  id: 'operator-field-suit',
  lods: {
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
