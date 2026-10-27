// Supplemental G5 visual provenance: fail closed against every G5 asset and route constraint.
export function auditAuthoredVisualProvenance(state) {
  const finite = key => Number.isFinite(Number(state?.[key])) ? Number(state[key]) : NaN;
  const mapped = finite('mappedObjects'), authored = finite('authoredObjects'), fallback = finite('fallbackObjects');
  const problems = [];
  if (state?.capturedRoute !== 'ice-mine' || state?.backend !== 'webgl2') problems.push('wrong-map-or-backend');
  if (state?.tier !== 'high' || state?.captureMode !== 'high-tier-qa-visual-only'
      || !state?.assetIds || !state.assetIds.split(',').every(id => id.endsWith('-lod0')))
    problems.push('not-authored-lod0-flagship-visual');
  if (state?.artState !== 'ready' || !(mapped > 0 && authored === mapped && fallback === 0))
    problems.push('procedural-box-or-unresolved-world-slot');
  if (state?.premium !== 'ready' || !(finite('premiumBindings') >= 80)
      || state?.ibl !== 'shared-prefiltered:ready') problems.push('missing-or-unready-premium-material');
  if (state?.routeStyle !== 'ice-recessed-bore-inlay'
      || !(finite('routeMaxWidth') > 0 && finite('routeMaxWidth') <= 0.20)) problems.push('oversized-route-material');
  if (state?.objectiveCue !== 'beacon+navigation-path' || !(finite('worldObjects') >= 1))
    problems.push('missing-or-occluded-objective');
  if (!state?.assetIds || !(finite('groundProps') >= 4)) problems.push('missing-asset-provenance');
  if (state?.fractureLanguage !== 'shared-hazards+brittle-support-fracture')
    problems.push('missing-fracture-cue');
  if (state?.beforeAssetIds !== state?.assetIds || state?.beforeArtState !== 'ready'
      || state?.beforePremium !== 'ready' || state?.beforeIbl !== 'shared-prefiltered:ready')
    problems.push('late-asset-pop-in');
  return { valid: problems.length === 0, problems };
}
