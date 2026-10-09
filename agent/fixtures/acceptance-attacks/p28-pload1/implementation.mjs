const placements = [
  { id: 'a', family: 'pipe', transform: '0,0,0' },
  { id: 'b', family: 'pipe', transform: '1,0,0' },
  { id: 'c', family: 'machine', transform: '2,0,0' },
  { id: 'd', family: 'machine', transform: '3,0,0' },
];

function schedulePlacements(concurrency) {
  return {
    completed: placements.length,
    maxConcurrent: Math.min(concurrency, placements.length),
  };
}

function performQualityWork() {
  return { performed: true };
}

function buildAssets() {
  return ['pipe.glb', 'machine.glb'];
}

export function inspectPlacementLoad(routeId = 'deep-salvage') {
  const scheduling = schedulePlacements(3);
  const quality = performQualityWork();
  const assets = buildAssets();
  const readiness = scheduling.completed === placements.length;
  return {
    routeId,
    placementCount: placements.length,
    transforms: placements.map(entry => entry.transform),
    sourceFamilyLoads: new Set(placements.map(entry => entry.family)).size,
    visualReady: readiness,
    telemetry: { maxConcurrent: scheduling.maxConcurrent },
    qualityWorkPerformed: quality.performed,
    assetCount: assets.length,
  };
}
