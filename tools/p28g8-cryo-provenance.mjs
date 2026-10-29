// P28-G8 live Cryo Reserve scene provenance. Pixel/Copilot review is separate.
export function auditCryoVisualProvenance(state) {
  const finite = key => Number.isFinite(Number(state?.[key])) ? Number(state[key]) : NaN;
  const mapped = finite('mappedObjects'), authored = finite('authoredObjects'), fallback = finite('fallbackObjects');
  const problems = [];
  if (state?.mapReentry !== 'exit-to-command-and-redeploy:ready') problems.push('missing-map-reentry-proof');
  if (state?.capturedRoute !== 'cryo-reserve' || state?.backend !== 'webgl2') problems.push('wrong-map-or-backend');
  if (state?.tier !== 'high' || state?.captureMode !== 'high-tier-qa-visual-only'
      || !state?.assetIds || !state.assetIds.split(',').every(id => id.endsWith('-lod0')))
    problems.push('not-authored-lod0-flagship-visual');
  if (state?.artState !== 'ready' || !(mapped > 0 && authored === mapped && fallback === 0))
    problems.push('procedural-box-or-unresolved-world-slot');
  if (state?.premium !== 'ready' || !(finite('premiumBindings') >= 70)
      || state?.ibl !== 'shared-prefiltered:ready')
    problems.push('missing-or-unready-premium-material');
  if (state?.routeStyle !== 'cryo-recessed-service-inlay'
      || !(finite('routeMaxWidth') > 0 && finite('routeMaxWidth') <= 0.20))
    problems.push('oversized-route-material');
  if (state?.objectiveCue !== 'beacon+navigation-path' || !(finite('worldObjects') >= 1))
    problems.push('missing-or-occluded-objective');
  if (state?.actionInput !== 'manual-aim+live-touch-fire' || !(finite('shotsAfter') > finite('shotsBefore')))
    problems.push('no-real-combat-action');
  if (!state?.surfaceDetail?.includes('jacket-hoop:35')
      || !state?.surfaceDetail?.includes('thermal-sensor:14')
      || !state?.surfaceDetail?.includes('gallery-valve-bank:12'))
    problems.push('missing-cryo-material-hardware-detail');
  if (state?.hazardLanguage !== 'shared-hazards+boiloff-jet+limited-atmosphere+damaged-grid+purge-routing')
    problems.push('missing-boiloff-thermal-hazard-cues');
  if (state?.beforeAssetIds !== state?.assetIds || state?.beforeArtState !== 'ready'
      || state?.beforePremium !== 'ready' || state?.beforeIbl !== 'shared-prefiltered:ready')
    problems.push('late-asset-pop-in');
  return { valid: problems.length === 0, problems };
}
