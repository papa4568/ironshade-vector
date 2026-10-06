export const REFINERY_ATMOSPHERE_PROFILE = Object.freeze({
  id: 'refinery-depth-atmosphere-v1',
  gradeId: 'p28-a5-dark-separation-v1',
  backgroundColor: 0x090604,
  fogColor: 0x160d08,
  fogNear: 18,
  fogFar: 42,
  lowVisibilityNear: 14,
  lowVisibilityFar: 32,
  exposureScale: 1.055,
  lowVisibilityExposureScale: 1.08,
  contrast: 0.985,
  lowVisibilityContrast: 0.965,
  protectedCueGroups: Object.freeze(['hud', 'enemies', 'hazards', 'objectives', 'loot', 'interactables']),
});

function clampRefineryAtmosphereScale(effectScale: number) {
  return Math.max(0, Math.min(1, Number.isFinite(effectScale) ? effectScale : 1));
}

export function refineryAtmosphereRange(lowVisibility: boolean, effectScale = 1) {
  const base = lowVisibility
    ? { near: REFINERY_ATMOSPHERE_PROFILE.lowVisibilityNear, far: REFINERY_ATMOSPHERE_PROFILE.lowVisibilityFar }
    : { near: REFINERY_ATMOSPHERE_PROFILE.fogNear, far: REFINERY_ATMOSPHERE_PROFILE.fogFar };
  const scale = clampRefineryAtmosphereScale(effectScale);
  return {
    near: base.near + (1 - scale) * 6,
    far: base.far + (1 - scale) * 12,
  };
}

export function refineryAtmosphereExposureScale(effectScale = 1, lowVisibility = false) {
  const scale = clampRefineryAtmosphereScale(effectScale);
  const target = lowVisibility
    ? REFINERY_ATMOSPHERE_PROFILE.lowVisibilityExposureScale
    : REFINERY_ATMOSPHERE_PROFILE.exposureScale;
  return 1 + (target - 1) * scale;
}

export function refineryAtmosphereContrast(lowVisibility = false, effectScale = 1) {
  const scale = clampRefineryAtmosphereScale(effectScale);
  const target = lowVisibility
    ? REFINERY_ATMOSPHERE_PROFILE.lowVisibilityContrast
    : REFINERY_ATMOSPHERE_PROFILE.contrast;
  return 1 + (target - 1) * scale;
}

export function refineryAtmosphereTelemetry(lowVisibility: boolean, effectScale = 1) {
  const range = refineryAtmosphereRange(lowVisibility, effectScale);
  const color = REFINERY_ATMOSPHERE_PROFILE.fogColor.toString(16).padStart(6, '0');
  return `fog:${REFINERY_ATMOSPHERE_PROFILE.id}:near-${range.near.toFixed(1)}:far-${range.far.toFixed(1)}:color-${color}:exposure-${refineryAtmosphereExposureScale(effectScale, lowVisibility).toFixed(3)}:contrast-${refineryAtmosphereContrast(lowVisibility, effectScale).toFixed(3)}:grade-${REFINERY_ATMOSPHERE_PROFILE.gradeId}`;
}
