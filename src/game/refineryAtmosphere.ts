export const REFINERY_ATMOSPHERE_PROFILE = Object.freeze({
  id: 'refinery-depth-atmosphere-v1',
  backgroundColor: 0x090604,
  fogColor: 0x160d08,
  fogNear: 18,
  fogFar: 42,
  lowVisibilityNear: 14,
  lowVisibilityFar: 32,
  exposureScale: 0.98,
  protectedCueGroups: Object.freeze(['hud', 'enemies', 'hazards', 'objectives', 'loot', 'interactables']),
});

export function refineryAtmosphereRange(lowVisibility: boolean) {
  return lowVisibility
    ? { near: REFINERY_ATMOSPHERE_PROFILE.lowVisibilityNear, far: REFINERY_ATMOSPHERE_PROFILE.lowVisibilityFar }
    : { near: REFINERY_ATMOSPHERE_PROFILE.fogNear, far: REFINERY_ATMOSPHERE_PROFILE.fogFar };
}

export function refineryAtmosphereTelemetry(lowVisibility: boolean) {
  const range = refineryAtmosphereRange(lowVisibility);
  const color = REFINERY_ATMOSPHERE_PROFILE.fogColor.toString(16).padStart(6, '0');
  return `fog:${REFINERY_ATMOSPHERE_PROFILE.id}:near-${range.near.toFixed(1)}:far-${range.far.toFixed(1)}:color-${color}:exposure-${REFINERY_ATMOSPHERE_PROFILE.exposureScale.toFixed(2)}`;
}
