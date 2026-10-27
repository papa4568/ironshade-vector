// G6 live scene-provenance gate; separately require independent PNG review.
export function auditLatticeVisualProvenance(state) {
  const finite = key => Number.isFinite(Number(state?.[key])) ? Number(state[key]) : NaN;
  const mapped = finite('mappedObjects'), authored = finite('authoredObjects'), fallback = finite('fallbackObjects');
  const problems = [];
  if (state?.capturedRoute !== 'lattice-annex' || state?.backend !== 'webgl2') problems.push('wrong-map-or-backend');
  if (state?.tier !== 'high' || state?.captureMode !== 'high-tier-qa-visual-only'
      || !state?.assetIds || !state.assetIds.split(',').every(id => id.endsWith('-lod0')))
    problems.push('not-authored-lod0-flagship-visual');
  if (state?.artState !== 'ready' || !(mapped > 0 && authored === mapped && fallback === 0))
    problems.push('procedural-box-or-unresolved-world-slot');
  if (state?.premium !== 'ready' || !(finite('premiumBindings') >= 80)
      || state?.ibl !== 'shared-prefiltered:ready')
    problems.push('missing-or-unready-premium-material');
  if (state?.routeStyle !== 'lattice-recessed-metrology-inlay'
      || !(finite('routeMaxWidth') > 0 && finite('routeMaxWidth') <= 0.20))
    problems.push('oversized-route-material');
  if (state?.objectiveCue !== 'beacon+navigation-path' || !(finite('worldObjects') >= 1))
    problems.push('missing-or-occluded-objective');
  if (!(finite('groundProps') >= 5) || !state?.surfaceDetail?.includes('indexed-collar:36'))
    problems.push('missing-survey-depth-or-grounding');
  if (state?.hazardLanguage !== 'shared-hazards+calibration-mass-shift+gravity-well+calibration-shutters+reference-network')
    problems.push('missing-calibration-hazard-cues');
  if (state?.beforeAssetIds !== state?.assetIds || state?.beforeArtState !== 'ready'
      || state?.beforePremium !== 'ready' || state?.beforeIbl !== 'shared-prefiltered:ready')
    problems.push('late-asset-pop-in');
  return {valid: problems.length === 0, problems};
}
