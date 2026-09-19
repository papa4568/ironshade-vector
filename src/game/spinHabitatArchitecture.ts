export type SpinHabitatSpinMode = 'reduced' | 'nominal' | 'overspeed';

export type SpinHabitatArchitectureState = {
  gravity: number;
  gravityRatio: number;
  angularSpeed: number;
  rpm: number;
  mode: SpinHabitatSpinMode;
};

const NOMINAL_SPIN_GRAVITY = 1;
const NOMINAL_ANGULAR_SPEED = 0.12;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function spinHabitatArchitectureState(gravity: number): SpinHabitatArchitectureState {
  const safeGravity = Number.isFinite(gravity) ? Math.max(0, gravity) : NOMINAL_SPIN_GRAVITY;
  const gravityRatio = clamp(safeGravity / NOMINAL_SPIN_GRAVITY, 0.08, 1.35);
  const angularSpeed = NOMINAL_ANGULAR_SPEED * Math.sqrt(gravityRatio);
  const rpm = angularSpeed * 60 / (Math.PI * 2);
  const mode: SpinHabitatSpinMode = gravityRatio > 1.06 ? 'overspeed' : gravityRatio < 0.82 ? 'reduced' : 'nominal';
  return { gravity: safeGravity, gravityRatio, angularSpeed, rpm, mode };
}
