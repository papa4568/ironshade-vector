export type JovianPressureState = 'normal' | 'leaking' | 'decompressing' | 'vacuum';

export type JovianHarvesterStormState = {
  mode: 'nominal' | 'charged' | 'shear' | 'venting';
  intensity: number;
  pressureShear: number;
  pressureSpread: number;
  minPressure: number;
  maxPressure: number;
  stormCharge: number;
  activeBreach: boolean;
  venting: boolean;
};

export type JovianHarvesterRenderProfileName = 'full' | 'balanced' | 'mobile' | 'performance';

export type JovianHarvesterRenderProfile = {
  name: JovianHarvesterRenderProfileName;
  assetDetailScale: number;
  deckInstances: 4 | 6;
  towerInstances: 5;
  bridgeInstances: 2 | 4;
  ballastInstances: 2 | 4;
  structureShadows: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function jovianHarvesterRenderProfile(detailScale: number, coarse: boolean): JovianHarvesterRenderProfile {
  const safeDetail = Number.isFinite(detailScale) ? clamp(detailScale, 0.35, 1) : 0.5;
  if (safeDetail < 0.62) {
    return { name: 'performance', assetDetailScale: 0.5, deckInstances: 4, towerInstances: 5, bridgeInstances: 2, ballastInstances: 2, structureShadows: false };
  }
  if (coarse) {
    return { name: 'mobile', assetDetailScale: Math.min(safeDetail, 0.58), deckInstances: 4, towerInstances: 5, bridgeInstances: 2, ballastInstances: 2, structureShadows: false };
  }
  if (safeDetail < 0.9) {
    return { name: 'balanced', assetDetailScale: safeDetail, deckInstances: 4, towerInstances: 5, bridgeInstances: 2, ballastInstances: 2, structureShadows: false };
  }
  return { name: 'full', assetDetailScale: safeDetail, deckInstances: 6, towerInstances: 5, bridgeInstances: 4, ballastInstances: 4, structureShadows: true };
}

export function jovianHarvesterStormState(
  pressures: readonly number[],
  pressureStates: readonly JovianPressureState[],
  serviceBreachActive: boolean,
  unstablePressure: boolean,
  damagedGrid: boolean,
): JovianHarvesterStormState {
  const safePressures = pressures.length > 0
    ? pressures.map(value => Number.isFinite(value) ? clamp(value, 0, 1.2) : 1)
    : [1];
  const minPressure = Math.min(...safePressures);
  const maxPressure = Math.max(...safePressures);
  const pressureSpread = Math.max(0, maxPressure - minPressure);
  const decompression = pressureStates.some(state => state === 'decompressing' || state === 'vacuum');
  const leaking = pressureStates.some(state => state === 'leaking');
  const venting = serviceBreachActive || decompression;

  const pressureShear = clamp(
    Math.max(0, pressureSpread - 0.04) / 0.46
      + (leaking ? 0.12 : 0)
      + (venting ? 0.28 : 0),
    0,
    1,
  );
  const stormCharge = clamp(
    0.24
      + pressureShear * 0.34
      + (unstablePressure ? 0.18 : 0)
      + (damagedGrid ? 0.28 : 0)
      + (venting ? 0.14 : 0),
    0,
    1,
  );
  const intensity = clamp(
    Math.max(pressureShear, stormCharge) * 0.9
      + (venting ? 0.10 : 0),
    0,
    1,
  );

  const mode: JovianHarvesterStormState['mode'] = venting
    ? 'venting'
    : pressureShear >= 0.42
      ? 'shear'
      : stormCharge >= 0.28 || pressureSpread >= 0.08
        ? 'charged'
        : 'nominal';

  return {
    mode,
    intensity,
    pressureShear,
    pressureSpread,
    minPressure,
    maxPressure,
    stormCharge,
    activeBreach: serviceBreachActive,
    venting,
  };
}
