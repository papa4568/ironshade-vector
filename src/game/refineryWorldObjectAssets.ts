import { REFINERY_ASSET_FAMILIES } from './graphicsAssetManifest';
import type { GraphicsAssetFamily } from './graphicsAssets';
import type { CombatObject } from './sim';

export type RefineryWorldObjectFamilyKey =
  | 'crate'
  | 'serviceConduit'
  | 'pipeRack'
  | 'wallPanel'
  | 'terminal'
  | 'processor';

const REFINERY_WORLD_OBJECT_FAMILY_BY_KIND: Record<CombatObject['kind'], RefineryWorldObjectFamilyKey> = {
  cover: 'crate',
  conduit: 'serviceConduit',
  coolant: 'pipeRack',
  breachPlate: 'wallPanel',
  doorControl: 'terminal',
  gravityControl: 'terminal',
  sealControl: 'terminal',
  powerControl: 'terminal',
  salvageNode: 'crate',
  anchorNode: 'processor',
};

const REFINERY_WORLD_OBJECT_FOOTPRINTS: Record<RefineryWorldObjectFamilyKey, { width: number; depth: number; longAxis: boolean }> = {
  crate: { width: 1.05, depth: 0.82, longAxis: false },
  serviceConduit: { width: 2.8, depth: 0.44, longAxis: true },
  pipeRack: { width: 3.8, depth: 1.32, longAxis: true },
  wallPanel: { width: 0.36, depth: 2.75, longAxis: true },
  terminal: { width: 0.88, depth: 0.88, longAxis: false },
  processor: { width: 3.13, depth: 2.78, longAxis: false },
};

export type RefineryWorldObjectFit = {
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  rotationY: number;
};

export function refineryWorldObjectFamilyKey(object: Pick<CombatObject, 'kind'>): RefineryWorldObjectFamilyKey {
  return REFINERY_WORLD_OBJECT_FAMILY_BY_KIND[object.kind];
}

export function refineryWorldObjectAssetFamily(object: Pick<CombatObject, 'kind'>): GraphicsAssetFamily {
  return REFINERY_ASSET_FAMILIES[refineryWorldObjectFamilyKey(object)];
}

export function refineryWorldObjectFit(
  object: Pick<CombatObject, 'kind' | 'w' | 'h'>,
  worldScale = 0.02,
): RefineryWorldObjectFit {
  const familyKey = refineryWorldObjectFamilyKey(object);
  const footprint = REFINERY_WORLD_OBJECT_FOOTPRINTS[familyKey];
  const width = Math.max(0.15, object.w * worldScale);
  const depth = Math.max(0.15, object.h * worldScale);
  const rotate = footprint.longAxis && depth > width;
  const localWidth = rotate ? depth : width;
  const localDepth = rotate ? width : depth;
  const scaleX = Math.max(0.12, localWidth / footprint.width);
  const scaleZ = Math.max(0.12, localDepth / footprint.depth);
  const scaleY = Math.max(0.42, Math.min(1.35, Math.sqrt(scaleX * scaleZ)));
  return {
    scaleX,
    scaleY,
    scaleZ,
    rotationY: rotate ? Math.PI / 2 : 0,
  };
}
