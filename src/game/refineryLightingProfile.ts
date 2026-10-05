export const REFINERY_IBL_PROFILE = {
  id: 'furnace-amber+service-cyan',
  intensity: 0.68,
  blur: 0.06,
  size: 64,
} as const;

export type RefineryIblPanelSpec = {
  color: readonly [number, number, number];
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
  size: readonly [number, number];
};

export const REFINERY_IBL_PANELS: readonly RefineryIblPanelSpec[] = [
  { color: [4.2, 1.72, 0.56], position: [0, 4.8, -3.7], rotation: [Math.PI / 2, 0, 0], size: [7.8, 3.2] },
  { color: [2.5, 0.74, 0.24], position: [-1.5, 1.1, -5.2], rotation: [0, 0, 0], size: [4.8, 3.0] },
  { color: [0.3, 1.65, 2.15], position: [5.0, 1.4, 0.4], rotation: [0, -Math.PI / 2, 0], size: [3.0, 5.0] },
  { color: [0.72, 0.82, 0.86], position: [-5.0, 0.8, 1.1], rotation: [0, Math.PI / 2, 0], size: [2.6, 5.8] },
  { color: [1.25, 0.62, 0.28], position: [1.2, -3.6, 1.8], rotation: [-Math.PI / 2, 0, 0], size: [5.4, 4.0] },
];

export const REFINERY_BABYLON_LIGHTING_PROFILE = {
  id: 'furnace-amber',
  exposure: 1.02,
  hemisphere: {
    skyColor: 0xa6c7c2,
    groundColor: 0x14110e,
    intensity: 0.74,
  },
  key: {
    color: 0xe3d0b8,
    intensity: 2.15,
    position: [16, 28, 14] as const,
  },
  rim: {
    color: 0xc58a4f,
    intensity: 0.95,
    position: [-18, 16, -10] as const,
  },
  emergency: {
    color: 0xdf7a55,
    intensity: 11,
    range: 18,
  },
  readability: {
    color: 0xb7efe3,
    intensity: 7.2,
    range: 7.5,
  },
  practicals: [
    { color: 0xffb36c, intensity: 9.6, range: 12, normalizedX: 0.50, normalizedZ: 0.23, height: 3.25 },
    { color: 0x6edce7, intensity: 7.0, range: 10, normalizedX: 0.71, normalizedZ: 0.67, height: 2.9 },
  ],
  shadow: {
    qualityId: 'p28-a4-flagship-soft-stable-v1',
    orthoExtent: 28,
    near: 1,
    far: 70,
    bias: 0.00035,
    normalBias: 0.012,
    anchorSnap: 1.5,
    casterPadding: 6,
  },
} as const;
