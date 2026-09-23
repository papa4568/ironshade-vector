import type { LocationId } from './campaign';
import type { CombatObject, Hazard, Material, SimState } from './sim';

export type WorldReadabilityShape = 'diamond' | 'bar' | 'hexagon' | 'star';
export type WorldPolishQualityName = 'high' | 'balanced' | 'performance';
export type WorldStateAudioCue = 'breach' | 'gravity' | 'machinery';

export type WorldMaterialQualityProfile = {
  materialDepthScale: number;
  interactableCueOpacity: number;
  hazardCueOpacity: number;
  pickupBeamScale: number;
  stateMotionScale: number;
};

export type WorldInteractablePresentation = {
  shape: WorldReadabilityShape;
  color: number;
  scaleX: number;
  scaleZ: number;
  pulseHz: number;
};

export type WorldHazardPresentation = {
  shape: WorldReadabilityShape;
  color: number;
  scaleX: number;
  scaleZ: number;
  rotationSpeed: number;
  pulseHz: number;
};

export type BiomeWorldState = {
  id: string;
  severity: number;
  color: number;
  motionHz: number;
  audioCue: WorldStateAudioCue | null;
};

const QUALITY_PROFILES: Record<WorldPolishQualityName, WorldMaterialQualityProfile> = {
  high: {
    materialDepthScale: 1,
    interactableCueOpacity: 0.82,
    hazardCueOpacity: 0.86,
    pickupBeamScale: 1,
    stateMotionScale: 1,
  },
  balanced: {
    materialDepthScale: 0.76,
    interactableCueOpacity: 0.74,
    hazardCueOpacity: 0.78,
    pickupBeamScale: 0.72,
    stateMotionScale: 0.78,
  },
  performance: {
    materialDepthScale: 0.52,
    interactableCueOpacity: 0.66,
    hazardCueOpacity: 0.72,
    pickupBeamScale: 0.5,
    stateMotionScale: 0.56,
  },
};

const INTERACTABLE_PRESENTATION: Partial<Record<CombatObject['kind'], WorldInteractablePresentation>> = {
  doorControl: { shape: 'bar', color: 0x73c9b1, scaleX: 1.28, scaleZ: 0.62, pulseHz: 3.2 },
  gravityControl: { shape: 'hexagon', color: 0x7fb8ea, scaleX: 1, scaleZ: 1, pulseHz: 2.4 },
  sealControl: { shape: 'diamond', color: 0xe6a672, scaleX: 0.92, scaleZ: 0.92, pulseHz: 4.1 },
  powerControl: { shape: 'star', color: 0xbc92e1, scaleX: 0.94, scaleZ: 0.94, pulseHz: 5.2 },
  salvageNode: { shape: 'hexagon', color: 0xd7d27d, scaleX: 0.78, scaleZ: 0.78, pulseHz: 2.8 },
};

const HAZARD_PRESENTATION: Record<Hazard['kind'], WorldHazardPresentation> = {
  shockGrid: { shape: 'star', color: 0xa382dc, scaleX: 0.92, scaleZ: 0.92, rotationSpeed: 0.22, pulseHz: 7.2 },
  gravityWell: { shape: 'hexagon', color: 0x72add0, scaleX: 0.88, scaleZ: 0.88, rotationSpeed: -0.82, pulseHz: 3.2 },
  coolantJet: { shape: 'diamond', color: 0x78cfdd, scaleX: 0.62, scaleZ: 1.22, rotationSpeed: 0.36, pulseHz: 6.1 },
  vacuumWake: { shape: 'diamond', color: 0x9ab6c7, scaleX: 1.3, scaleZ: 0.54, rotationSpeed: 0.16, pulseHz: 2.6 },
  vectorWash: { shape: 'bar', color: 0x69c8e9, scaleX: 1.48, scaleZ: 0.48, rotationSpeed: 0.58, pulseHz: 5.3 },
  boiloffJet: { shape: 'star', color: 0xace9f4, scaleX: 0.7, scaleZ: 1.18, rotationSpeed: 0.44, pulseHz: 6.6 },
};

const MATERIAL_RESPONSE: Record<Material, { metalness: number; roughness: number }> = {
  light: { metalness: 0.46, roughness: 0.34 },
  industrial: { metalness: 0.7, roughness: 0.52 },
  bulkhead: { metalness: 0.84, roughness: 0.43 },
  system: { metalness: 0.62, roughness: 0.27 },
};

const LOCATION_STATE_COLOR: Record<LocationId, number> = {
  'orbital-station': 0x74b9a8,
  'damaged-vessel': 0xdf7956,
  'asteroid-refinery': 0xdc9a55,
  'spin-habitat': 0x73b7b2,
  'jovian-harvester': 0xe0a05d,
  'ice-mine': 0x8cd9eb,
  'solar-yard': 0xf2a65f,
  'lattice-annex': 0x82bac1,
  'momentum-exchange': 0x73bad4,
  'cryo-reserve': 0x7dc5dc,
  'parallax-array': 0xa48cdb,
};

export function worldMaterialQualityProfile(name: WorldPolishQualityName): WorldMaterialQualityProfile {
  return QUALITY_PROFILES[name];
}

export function interactableWorldPresentation(kind: CombatObject['kind']) {
  return INTERACTABLE_PRESENTATION[kind] ?? null;
}

export function hazardWorldPresentation(kind: Hazard['kind']) {
  return HAZARD_PRESENTATION[kind];
}

export function materialWorldResponse(material: Material) {
  return MATERIAL_RESPONSE[material];
}

function hasPressureCrisis(state: Pick<SimState, 'sectors' | 'breaches'>) {
  return state.breaches.some(breach => breach.active && !breach.sealed)
    || state.sectors.some(sector => sector.pressureState === 'decompressing' || sector.pressureState === 'vacuum');
}

function gravityDeviation(state: Pick<SimState, 'sectors'>) {
  return state.sectors.reduce((largest, sector) => Math.max(largest, Math.abs(sector.gravity - 1)), 0);
}

export function biomeWorldState(
  location: LocationId,
  state: Pick<SimState, 'time' | 'sectors' | 'breaches' | 'hazards' | 'objects'>,
): BiomeWorldState {
  const activeHazards = state.hazards.filter(hazard => hazard.active);
  const activeKinds = new Set(activeHazards.map(hazard => hazard.kind));
  const pressureCrisis = hasPressureCrisis(state);

  if (pressureCrisis) {
    return { id: 'pressure-critical', severity: 1, color: 0xf07d55, motionHz: 5.8, audioCue: 'breach' };
  }

  if (location === 'solar-yard') {
    const shutterClosed = !!state.objects.find(object => object.id === 'solar-shutter')?.exposed;
    if (state.time >= 10 && state.time < 18 && !shutterClosed) {
      return { id: 'solar-surge', severity: 0.84, color: 0xf6aa62, motionHz: 3.4, audioCue: 'machinery' };
    }
  }

  if (location === 'spin-habitat' && gravityDeviation(state) >= 0.16) {
    return { id: 'spin-imbalance', severity: 0.76, color: 0x7dcbd5, motionHz: 3.1, audioCue: 'gravity' };
  }

  if (location === 'jovian-harvester' && (activeKinds.has('boiloffJet') || activeKinds.has('vectorWash') || state.sectors.some(sector => sector.pressureState === 'leaking'))) {
    return { id: 'storm-shear', severity: 0.72, color: 0xe2a05c, motionHz: 4.2, audioCue: 'machinery' };
  }

  if (location === 'ice-mine' && (activeKinds.has('coolantJet') || activeKinds.has('boiloffJet'))) {
    return { id: 'bore-fracture', severity: 0.74, color: 0xa7e5ef, motionHz: 4.8, audioCue: 'breach' };
  }

  const primaryHazard = activeHazards[0];
  if (primaryHazard) {
    const presentation = hazardWorldPresentation(primaryHazard.kind);
    const audioCue: WorldStateAudioCue = primaryHazard.kind === 'gravityWell'
      ? 'gravity'
      : primaryHazard.kind === 'coolantJet' || primaryHazard.kind === 'boiloffJet' || primaryHazard.kind === 'vacuumWake'
        ? 'breach'
        : 'machinery';
    return {
      id: `hazard-${primaryHazard.kind}`,
      severity: 0.62,
      color: presentation.color,
      motionHz: presentation.pulseHz * 0.5,
      audioCue,
    };
  }

  if (state.sectors.some(sector => sector.pressureState === 'leaking')) {
    return { id: 'pressure-watch', severity: 0.46, color: 0xd6a16e, motionHz: 2.1, audioCue: 'machinery' };
  }

  return {
    id: 'nominal',
    severity: 0,
    color: LOCATION_STATE_COLOR[location],
    motionHz: 0,
    audioCue: null,
  };
}
