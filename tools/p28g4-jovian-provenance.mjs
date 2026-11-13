// Supplemental G4 visual provenance: fail closed against every G4 asset and route constraint.
export function auditAuthoredVisualProvenance(state) {
  const finite = key => Number.isFinite(Number(state?.[key])) ? Number(state[key]) : NaN;
  const mapped = finite('mappedObjects'), authored = finite('authoredObjects'), fallback = finite('fallbackObjects');
  const problems = [];
  if (state?.capturedRoute !== 'jovian-harvester' || state?.backend !== 'webgl2') problems.push('wrong-map-or-backend');
  if (state?.tier !== 'high' || state?.captureMode !== 'high-tier-qa-visual-only'
      || !state?.assetIds || !state.assetIds.split(',').every(id => id.endsWith('-lod0')))
    problems.push('not-authored-lod0-flagship-visual');
  if (state?.artState !== 'ready' || !(mapped > 0 && authored === mapped && fallback === 0))
    problems.push('procedural-box-or-unresolved-world-slot');
  if (state?.premium !== 'ready' || !(finite('premiumBindings') >= 80)
      || state?.ibl !== 'shared-prefiltered:ready') problems.push('missing-or-unready-premium-material');
  if (state?.routeStyle !== 'jovian-recessed-deck-inlay'
      || !(finite('routeMaxWidth') > 0 && finite('routeMaxWidth') <= 0.20)) problems.push('oversized-route-material');
  if (state?.objectiveCue !== 'beacon+navigation-path' || !(finite('worldObjects') >= 1))
    problems.push('missing-or-occluded-objective');
  if (!state?.assetIds || !(finite('groundProps') >= 4)) problems.push('missing-asset-provenance');
  // An active object family can change after real gameplay input without any
  // new GLB loading. Only the mounted asset of a persistent object must remain
  // identical. Validate both snapshots and their complete authored mappings.
  const toBindings = (entries, expected) => {
    if (!Array.isArray(entries) || !(expected > 0) || entries.length !== expected) return null;
    const result = new Map();
    for (const entry of entries) {
      if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string'
          || !entry[0] || typeof entry[1] !== 'string' || !entry[1].endsWith('-lod0')
          || result.has(entry[0])) return null;
      result.set(entry[0], entry[1]);
    }
    return result;
  };
  const before = toBindings(state?.beforeObjectAssets, finite('beforeAuthoredObjects'));
  const after = toBindings(state?.objectAssets, authored);
  const familyNames = bindings => bindings ? [...new Set(bindings.values())].sort().join(',') : '';
  const persistent = before && after ? [...before].filter(([id]) => after.has(id)) : [];
  if (!before || !after || persistent.length === 0
      || state?.beforeAssetIds !== familyNames(before)
      || state?.assetIds !== familyNames(after)
      || persistent.some(([id, family]) => after.get(id) !== family)
      || !(finite('beforeMappedObjects') > 0
        && finite('beforeMappedObjects') === finite('beforeAuthoredObjects')
        && finite('beforeFallbackObjects') === 0
        && finite('beforePendingCount') === 0 && finite('beforeFailedCount') === 0)
      || state?.beforeArtState !== 'ready' || state?.beforePremium !== 'ready'
      || state?.beforeIbl !== 'shared-prefiltered:ready')
    problems.push('late-asset-pop-in');
  return { valid: problems.length === 0, problems };
}
