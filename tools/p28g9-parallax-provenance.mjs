// P28-G9 live Parallax Array scene provenance. Pixel/Copilot review is separate.
export function auditParallaxVisualProvenance(state) {
  const finite = key => Number.isFinite(Number(state?.[key])) ? Number(state[key]) : NaN;
  const mapped = finite('mappedObjects'), authored = finite('authoredObjects'), fallback = finite('fallbackObjects');
  const problems = [];
  if (state?.mapReentry !== 'exit-to-command-and-redeploy:ready') problems.push('missing-map-reentry-proof');
  if (state?.capturedRoute !== 'parallax-array' || state?.backend !== 'webgl2') problems.push('wrong-map-or-backend');
  if (state?.tier !== 'high' || state?.captureMode !== 'high-tier-qa-visual-only'
      || !state?.assetIds || !state.assetIds.split(',').every(id => id.endsWith('-lod0')))
    problems.push('not-authored-lod0-flagship-visual');
  if (state?.artState !== 'ready' || !(mapped > 0 && authored === mapped && fallback === 0))
    problems.push('procedural-box-or-unresolved-world-slot');
  if (state?.premium !== 'ready' || !(finite('premiumBindings') >= 40)
      || state?.ibl !== 'shared-prefiltered:ready')
    problems.push('missing-or-unready-premium-material');
  if (state?.routeStyle !== 'parallax-recessed-metrology-inlay'
      || !(finite('routeMaxWidth') > 0 && finite('routeMaxWidth') <= 0.16))
    problems.push('oversized-route-material');
  if (state?.objectiveCue !== 'beacon+navigation-path' || !(finite('worldObjects') >= 1))
    problems.push('missing-or-occluded-objective');
  if (state?.actionInput !== 'manual-aim+live-touch-fire' || !(finite('shotsAfter') > finite('shotsBefore')))
    problems.push('no-real-combat-action');
  for (const detail of ['pylon-fiducial:27', 'frame-scale:30',
      'carriage-stud:18', 'console-knob:9', 'anchor-insulator:8']) {
    if (!state?.surfaceDetail?.includes(detail)) problems.push('missing-metrology-detail:' + detail);
  }
  if (state?.hazardLanguage !== 'shared-hazards+reference-shear+gravity-split+physical-baseline-alignment')
    problems.push('missing-reference-shear-hazard-cues');
  if (state?.referenceNodeIds !== 'reference-node-a,reference-node-b,reference-node-c'
      || state?.shearTimeline !== '8.0s:first-shear>19.0s:deep-reference-reversal')
    problems.push('missing-physical-alignment-reference-timeline');
  // babylonSharedWorldAssets is an inventory of ACTIVE authored objects, not
  // immutable loaded files. A new object may legitimately activate between
  // movement and live FIRE. Both snapshots must already be authored-ready,
  // and any newly active family must be explained by an increase in the
  // active, fully authored mapped-object inventory (never a late GLB load).
  const beforeIds = (state?.beforeAssetIds ?? '').split(',').filter(Boolean);
  const afterIds = (state?.assetIds ?? '').split(',').filter(Boolean);
  const addedIds = afterIds.filter(id => !beforeIds.includes(id));
  const onlyNewlyActivated = addedIds.length > 0
    && beforeIds.length > 0
    && beforeIds.every(id => afterIds.includes(id))
    && finite('beforeMappedObjects') > 0
    && finite('beforeMappedObjects') === finite('beforeAuthoredObjects')
    && mapped > finite('beforeMappedObjects')
    && authored > finite('beforeAuthoredObjects')
    && addedIds.length <= mapped - finite('beforeMappedObjects');
  if ((state?.beforeAssetIds !== state?.assetIds && !onlyNewlyActivated)
      || state?.beforeArtState !== 'ready' || state?.beforePremium !== 'ready'
      || state?.beforeIbl !== 'shared-prefiltered:ready')
    problems.push('late-asset-pop-in');
  return { valid: problems.length === 0, problems };
}
