import type { Enemy } from './sim';

export type EnemyLifecycleTiming = {
  sinceActivated: number;
  sincePhaseChange: number;
  sinceDeath: number;
};

export type EnemyLifecycleSignals = {
  spawn: number;
  phaseTransition: number;
  dangerousReadiness: number;
  disable: number;
  persistentDisabled: number;
};

type LifecycleEnemy = Pick<
  Enemy,
  'active' | 'dead' | 'deathT' | 'role' | 'combatClass' | 'protocols' | 'mutations' | 'commandTargetMutations' | 'bossPhaseMutations' | 'protocolPulse' | 'telegraph' | 'bossPhase'
>;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function eventEnvelope(since: number, duration: number) {
  if (since < 0 || since >= duration) return 0;
  return 1 - clamp01(since / duration);
}

export function dangerousEnemyCombinationReadiness(enemy: LifecycleEnemy) {
  if (!enemy.active || enemy.dead) return 0;
  const commandLike = enemy.role === 'boss' || enemy.combatClass === 'elite' || enemy.combatClass === 'enhanced';
  if (!commandLike) return 0;

  const modifierCount = enemy.protocols.length
    + enemy.mutations.length
    + enemy.commandTargetMutations.length
    + enemy.bossPhaseMutations.length;
  if (modifierCount < 2) return 0;

  const protocolWindup = enemy.protocols.reduce((max, protocol) => Math.max(max, protocol.windup), 0);
  const liveThreat = Math.max(
    clamp01(protocolWindup),
    clamp01(enemy.protocolPulse),
    enemy.telegraph > 0 ? clamp01(0.45 + enemy.telegraph * 0.45) : 0,
  );
  if (liveThreat < 0.28) return 0;

  const stack = clamp01((modifierCount - 1) / 4);
  const roleWeight = enemy.role === 'boss' ? 0.16 : enemy.combatClass === 'elite' ? 0.09 : 0.04;
  return clamp01(0.38 + liveThreat * 0.34 + stack * 0.24 + roleWeight);
}

export function resolveEnemyLifecyclePresentation(enemy: LifecycleEnemy, timing: EnemyLifecycleTiming): EnemyLifecycleSignals {
  const spawn = !enemy.dead ? eventEnvelope(timing.sinceActivated, 0.95) : 0;
  const phaseProgress = timing.sincePhaseChange >= 0 && timing.sincePhaseChange < 1.1
    ? clamp01(timing.sincePhaseChange / 1.1)
    : -1;
  const phaseTransition = enemy.role === 'boss' && enemy.bossPhase === 2 && phaseProgress >= 0
    ? Math.sin(phaseProgress * Math.PI)
    : 0;
  const disable = enemy.dead
    ? Math.max(eventEnvelope(timing.sinceDeath, 0.8), clamp01(enemy.deathT / 0.8))
    : 0;

  return {
    spawn,
    phaseTransition,
    dangerousReadiness: dangerousEnemyCombinationReadiness(enemy),
    disable,
    persistentDisabled: enemy.dead ? 1 : 0,
  };
}
