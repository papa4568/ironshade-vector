export type RuntimeScalabilityTier = 'high' | 'balanced' | 'performance';

export type RuntimeScalabilityProfile = {
  animation: {
    nearDistance: number;
    farDistance: number;
    standardFarStride: 1 | 2 | 3;
    eliteFarStride: 1 | 2;
  };
  poolRetention: {
    damageNumbers: number;
    effects: number;
    impactSparks: number;
    debris: number;
  };
  preloadConcurrency: 1 | 2 | 3;
  preloadAssetLimit: number;
};

export const RUNTIME_SCALABILITY_PROFILES: Record<RuntimeScalabilityTier, RuntimeScalabilityProfile> = {
  high: {
    animation: { nearDistance: 18, farDistance: 30, standardFarStride: 1, eliteFarStride: 1 },
    poolRetention: { damageNumbers: 48, effects: 72, impactSparks: 24, debris: 64 },
    preloadConcurrency: 3,
    preloadAssetLimit: 12,
  },
  balanced: {
    animation: { nearDistance: 16, farDistance: 27, standardFarStride: 2, eliteFarStride: 1 },
    poolRetention: { damageNumbers: 36, effects: 54, impactSparks: 16, debris: 48 },
    preloadConcurrency: 2,
    preloadAssetLimit: 8,
  },
  performance: {
    animation: { nearDistance: 14, farDistance: 24, standardFarStride: 3, eliteFarStride: 2 },
    poolRetention: { damageNumbers: 24, effects: 36, impactSparks: 10, debris: 32 },
    preloadConcurrency: 1,
    preloadAssetLimit: 5,
  },
};

export function runtimeScalabilityProfile(tier: RuntimeScalabilityTier) {
  return RUNTIME_SCALABILITY_PROFILES[tier];
}

export type RuntimeAnimationRequest = {
  tier: RuntimeScalabilityTier;
  role: string;
  distance: number;
  targeted: boolean;
  criticalCue: boolean;
};

export function runtimeAnimationStride(request: RuntimeAnimationRequest): 1 | 2 | 3 {
  const profile = runtimeScalabilityProfile(request.tier);
  if (
    request.tier === 'high'
    || request.role === 'boss'
    || request.targeted
    || request.criticalCue
    || request.distance <= profile.animation.nearDistance
  ) return 1;

  if (request.role === 'elite') {
    return request.distance > profile.animation.farDistance ? profile.animation.eliteFarStride : 1;
  }

  if (request.distance <= profile.animation.farDistance) return request.tier === 'performance' ? 2 : 1;
  return profile.animation.standardFarStride;
}

export function runtimePoolTrimTarget(allocated: number, active: number, retainedIdleCapacity: number) {
  const safeAllocated = Math.max(0, Math.floor(allocated));
  const safeActive = Math.max(0, Math.floor(active));
  const target = Math.max(safeActive, Math.max(0, Math.floor(retainedIdleCapacity)));
  const trimThreshold = Math.max(target + 8, Math.ceil(target * 1.5));
  return safeAllocated > trimThreshold ? target : safeAllocated;
}
