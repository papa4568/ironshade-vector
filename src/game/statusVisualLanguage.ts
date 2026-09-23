import type { Enemy, PressureState } from './sim';

export type EnemyStatusVisualId = keyof Enemy['statuses'];
export type EnemyStatusVisualSignature = 'fracture' | 'jitter' | 'reticle' | 'impact' | 'arc' | 'frost';
export type EnemyStatusVisualMotion = 'shed' | 'snap' | 'track' | 'recoil' | 'link' | 'vent';

export type EnemyStatusVisualSpec = {
  label: string;
  signature: EnemyStatusVisualSignature;
  motion: EnemyStatusVisualMotion;
  primary: number;
  accent: number;
  nodeCount: number;
  scale: number;
  priority: 2 | 3 | 4;
};

const enemyStatusVisuals: Record<EnemyStatusVisualId, EnemyStatusVisualSpec> = {
  armorBreach: { label: 'ARMOR BREACH', signature: 'fracture', motion: 'shed', primary: 0xa55f42, accent: 0xffb06e, nodeCount: 4, scale: 1.08, priority: 3 },
  disrupted: { label: 'DISRUPTED', signature: 'jitter', motion: 'snap', primary: 0x67528f, accent: 0xc1a0ff, nodeCount: 4, scale: 1.04, priority: 4 },
  marked: { label: 'MARKED', signature: 'reticle', motion: 'track', primary: 0x8f9e4d, accent: 0xe3ef83, nodeCount: 4, scale: 1.02, priority: 2 },
  stagger: { label: 'STAGGER', signature: 'impact', motion: 'recoil', primary: 0x816453, accent: 0xffd3a0, nodeCount: 3, scale: 1.1, priority: 4 },
  conductive: { label: 'ARC-CHARGED', signature: 'arc', motion: 'link', primary: 0x3f7184, accent: 0x8de7ff, nodeCount: 5, scale: 1.05, priority: 3 },
  vacuum: { label: 'VACUUM', signature: 'frost', motion: 'vent', primary: 0x667c89, accent: 0xc8f2ff, nodeCount: 4, scale: 1.06, priority: 3 },
};

export const enemyStatusVisualIds = Object.keys(enemyStatusVisuals) as EnemyStatusVisualId[];

export function enemyStatusVisualSpecFor(id: EnemyStatusVisualId) {
  return enemyStatusVisuals[id];
}

export type PlayerStatusVisualId = 'thermal' | 'disrupted' | 'pressure-loss' | 'vacuum';
export type PlayerStatusVisualSpec = {
  label: string;
  primary: number;
  accent: number;
  signature: 'heat' | 'jitter' | 'pressure' | 'vacuum';
  priority: 2 | 3 | 4;
};

const playerStatusVisuals: Record<PlayerStatusVisualId, PlayerStatusVisualSpec> = {
  thermal: { label: 'THERMAL LOAD', primary: 0x8f4b32, accent: 0xff9b63, signature: 'heat', priority: 2 },
  disrupted: { label: 'ELECTRONIC DISRUPTION', primary: 0x67528f, accent: 0xc1a0ff, signature: 'jitter', priority: 4 },
  'pressure-loss': { label: 'PRESSURE LOSS', primary: 0x4d7180, accent: 0x8fd7e7, signature: 'pressure', priority: 3 },
  vacuum: { label: 'VACUUM EXPOSURE', primary: 0x607986, accent: 0xd2f6ff, signature: 'vacuum', priority: 4 },
};

export const playerStatusVisualIds = Object.keys(playerStatusVisuals) as PlayerStatusVisualId[];

export function playerStatusVisualSpecFor(id: PlayerStatusVisualId) {
  return playerStatusVisuals[id];
}

export type PlayerStatusVisualInput = {
  heat: number;
  disrupted: number;
  vacuumExposure: number;
  pressureState: PressureState;
  pressure: number;
};

export type ActivePlayerStatusVisual = {
  id: PlayerStatusVisualId;
  intensity: number;
  priority: 2 | 3 | 4;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function resolvePlayerStatusVisuals(input: PlayerStatusVisualInput): ActivePlayerStatusVisual[] {
  const active: ActivePlayerStatusVisual[] = [];
  if (input.heat >= 0.68) {
    active.push({ id: 'thermal', intensity: clamp01((input.heat - 0.6) / 0.4), priority: playerStatusVisuals.thermal.priority });
  }
  if (input.disrupted > 0) {
    active.push({ id: 'disrupted', intensity: clamp01(0.45 + input.disrupted * 0.55), priority: playerStatusVisuals.disrupted.priority });
  }

  const vacuum = input.pressureState === 'vacuum' || input.vacuumExposure >= 0.72;
  if (vacuum) {
    active.push({ id: 'vacuum', intensity: clamp01(0.55 + Math.max(input.vacuumExposure, 1 - input.pressure) * 0.45), priority: playerStatusVisuals.vacuum.priority });
  } else if (input.pressureState !== 'normal' || input.vacuumExposure > 0.12) {
    const pressureLoss = Math.max(1 - input.pressure, input.vacuumExposure * 0.72);
    active.push({ id: 'pressure-loss', intensity: clamp01(0.35 + pressureLoss * 0.65), priority: playerStatusVisuals['pressure-loss'].priority });
  }

  return active.sort((a, b) => b.priority - a.priority || b.intensity - a.intensity || a.id.localeCompare(b.id));
}

export function dominantEnemyStatusVisual(enemy: Enemy): EnemyStatusVisualId | null {
  return enemyStatusVisualIds
    .filter(id => enemy.statuses[id] > 0)
    .sort((a, b) =>
      enemyStatusVisuals[b].priority - enemyStatusVisuals[a].priority
      || enemy.statuses[b] - enemy.statuses[a]
      || a.localeCompare(b),
    )[0] ?? null;
}

export function statusVisualCss(color: number, alpha: number) {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgba(${r},${g},${b},${clamp01(alpha)})`;
}
