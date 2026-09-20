export type SolarYardRenderProfileName = 'full' | 'balanced' | 'mobile' | 'performance';

export type SolarYardRenderProfile = {
  name: SolarYardRenderProfileName;
  assetDetailScale: number;
  ceramicDeckInstances: 4 | 6;
  trussFrameInstances: 3 | 5;
  radiatorTowerInstances: 2 | 4;
  reflectorPylonInstances: 3;
  sinterForgeInstances: 1 | 2;
  printerSpindleInstances: 2 | 3;
  feedstockPressInstances: 1 | 2;
  transferRailInstances: 2 | 3;
  gantryCraneInstances: 1 | 2;
  shadePatchInstances: 1 | 2 | 3;
  sunPatchInstances: 1 | 2 | 3;
  fallbackPanelInstances: 3 | 5 | 7;
  environmentShadows: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function solarYardRenderProfile(detailScale: number, coarse: boolean): SolarYardRenderProfile {
  const safeDetail = Number.isFinite(detailScale) ? clamp(detailScale, 0.35, 1) : 0.5;
  if (safeDetail < 0.62) {
    return {
      name: 'performance',
      assetDetailScale: 0.5,
      ceramicDeckInstances: 4,
      trussFrameInstances: 3,
      radiatorTowerInstances: 2,
      reflectorPylonInstances: 3,
      sinterForgeInstances: 1,
      printerSpindleInstances: 2,
      feedstockPressInstances: 1,
      transferRailInstances: 2,
      gantryCraneInstances: 1,
      shadePatchInstances: 1,
      sunPatchInstances: 1,
      fallbackPanelInstances: 3,
      environmentShadows: false,
    };
  }
  if (coarse) {
    return {
      name: 'mobile',
      assetDetailScale: Math.min(safeDetail, 0.58),
      ceramicDeckInstances: 4,
      trussFrameInstances: 3,
      radiatorTowerInstances: 2,
      reflectorPylonInstances: 3,
      sinterForgeInstances: 1,
      printerSpindleInstances: 2,
      feedstockPressInstances: 1,
      transferRailInstances: 2,
      gantryCraneInstances: 2,
      shadePatchInstances: 2,
      sunPatchInstances: 2,
      fallbackPanelInstances: 5,
      environmentShadows: false,
    };
  }
  if (safeDetail < 0.9) {
    return {
      name: 'balanced',
      assetDetailScale: safeDetail,
      ceramicDeckInstances: 4,
      trussFrameInstances: 3,
      radiatorTowerInstances: 2,
      reflectorPylonInstances: 3,
      sinterForgeInstances: 1,
      printerSpindleInstances: 2,
      feedstockPressInstances: 1,
      transferRailInstances: 2,
      gantryCraneInstances: 2,
      shadePatchInstances: 2,
      sunPatchInstances: 2,
      fallbackPanelInstances: 5,
      environmentShadows: false,
    };
  }
  return {
    name: 'full',
    assetDetailScale: safeDetail,
    ceramicDeckInstances: 6,
    trussFrameInstances: 5,
    radiatorTowerInstances: 4,
    reflectorPylonInstances: 3,
    sinterForgeInstances: 2,
    printerSpindleInstances: 3,
    feedstockPressInstances: 2,
    transferRailInstances: 3,
    gantryCraneInstances: 2,
    shadePatchInstances: 3,
    sunPatchInstances: 3,
    fallbackPanelInstances: 7,
    environmentShadows: true,
  };
}
