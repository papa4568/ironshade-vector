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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
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
