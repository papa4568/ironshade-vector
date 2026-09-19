export type SpinHabitatSpinMode = 'reduced' | 'nominal' | 'overspeed';

export type SpinHabitatArchitectureState = {
  gravity: number;
  gravityRatio: number;
  angularSpeed: number;
  rpm: number;
  mode: SpinHabitatSpinMode;
};

export type SpinHabitatSpindownState = {
  active: boolean;
  intensity: number;
  transferGravity: number;
  transferRatio: number;
};

export type SpinHabitatRenderProfileName = 'full' | 'balanced' | 'mobile' | 'performance';

export type SpinHabitatRenderProfile = {
  name: SpinHabitatRenderProfileName;
  assetDetailScale: number;
  ringInstances: 4 | 6;
  spokeInstances: 4;
  serviceInstances: 2 | 4;
  movingShadows: boolean;
  proceduralRingSegments: 32 | 40 | 48 | 64;
};

const NOMINAL_SPIN_GRAVITY = 1;
const NOMINAL_TRANSFER_GRAVITY = 0.42;
const NOMINAL_ANGULAR_SPEED = 0.12;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function spinHabitatRenderProfile(detailScale: number, coarse: boolean): SpinHabitatRenderProfile {
  const safeDetail = Number.isFinite(detailScale) ? clamp(detailScale, 0.35, 1) : 0.5;
  if (safeDetail < 0.62) {
    return { name: 'performance', assetDetailScale: 0.5, ringInstances: 4, spokeInstances: 4, serviceInstances: 2, movingShadows: false, proceduralRingSegments: 32 };
  }
  if (coarse) {
    return { name: 'mobile', assetDetailScale: Math.min(safeDetail, 0.58), ringInstances: 4, spokeInstances: 4, serviceInstances: 2, movingShadows: false, proceduralRingSegments: 40 };
  }
  if (safeDetail < 0.9) {
    return { name: 'balanced', assetDetailScale: safeDetail, ringInstances: 4, spokeInstances: 4, serviceInstances: 2, movingShadows: false, proceduralRingSegments: 48 };
  }
  return { name: 'full', assetDetailScale: safeDetail, ringInstances: 6, spokeInstances: 4, serviceInstances: 4, movingShadows: true, proceduralRingSegments: 64 };
}

export function spinHabitatArchitectureState(gravity: number): SpinHabitatArchitectureState {
  const safeGravity = Number.isFinite(gravity) ? Math.max(0, gravity) : NOMINAL_SPIN_GRAVITY;
  const gravityRatio = clamp(safeGravity / NOMINAL_SPIN_GRAVITY, 0.08, 1.35);
  const angularSpeed = NOMINAL_ANGULAR_SPEED * Math.sqrt(gravityRatio);
  const rpm = angularSpeed * 60 / (Math.PI * 2);
  const mode: SpinHabitatSpinMode = gravityRatio > 1.06 ? 'overspeed' : gravityRatio < 0.82 ? 'reduced' : 'nominal';
  return { gravity: safeGravity, gravityRatio, angularSpeed, rpm, mode };
}

export function spinHabitatSpindownState(transferGravity: number): SpinHabitatSpindownState {
  const safeGravity = Number.isFinite(transferGravity) ? Math.max(0, transferGravity) : NOMINAL_TRANSFER_GRAVITY;
  const transferRatio = clamp(safeGravity / NOMINAL_TRANSFER_GRAVITY, 0, 1.5);
  const intensity = clamp((0.78 - transferRatio) / 0.66, 0, 1);
  return {
    active: intensity > 0.01,
    intensity,
    transferGravity: safeGravity,
    transferRatio,
  };
}
