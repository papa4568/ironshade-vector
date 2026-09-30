export const REFINERY_BLOOM_LAYER = 1;

export const REFINERY_BLOOM_PROFILE = Object.freeze({
  id: 'refinery-selective-v1',
  strength: 0.46,
  radius: 0.28,
  threshold: 0.08,
  defaultCostScale: 1,
  fullResolutionScale: 0.55,
  minimumResolutionScale: 0.32,
  excludedCueGroups: Object.freeze(['hud', 'enemies', 'hazards', 'objectives', 'loot', 'interactables']),
});

export function clampRefineryBloomCostScale(value: number) {
  if (!Number.isFinite(value)) return REFINERY_BLOOM_PROFILE.defaultCostScale;
  return Math.max(0, Math.min(1, value));
}

export function refineryBloomResolutionScale(value: number) {
  const cost = clampRefineryBloomCostScale(value);
  if (cost <= 0) return 0;
  const span = REFINERY_BLOOM_PROFILE.fullResolutionScale - REFINERY_BLOOM_PROFILE.minimumResolutionScale;
  return REFINERY_BLOOM_PROFILE.minimumResolutionScale + span * Math.sqrt(cost);
}

export function refineryBloomStrengthForCost(value: number) {
  const cost = clampRefineryBloomCostScale(value);
  return REFINERY_BLOOM_PROFILE.strength * Math.sqrt(cost);
}

export function isRefineryBloomAssetLabel(label: string) {
  return label === 'refinery-terminal' || label === 'refinery-processor';
}
