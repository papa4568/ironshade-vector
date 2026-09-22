import type { Enemy } from './sim';

export type EnemyAnimationPhase = 'idle' | 'locomotion' | 'tell' | 'commit' | 'recovery' | 'phase-transition' | 'death';

export type EnemyAnimationProfile = {
  id: string;
  gaitRate: number;
  gaitAmplitude: number;
  idleBreath: number;
  leftArm: number;
  rightArm: number;
  torsoLean: number;
  telegraphWindow: number;
  tellLean: number;
  tellLift: number;
  tellReach: number;
  commitDuration: number;
  commitKick: number;
  recoveryDuration: number;
  phaseDuration: number;
  phaseRise: number;
  modifierTension: number;
};

export type EnemyBossAnimationInput = {
  role: Enemy['role'];
  id: number;
  time: number;
  vx: number;
  vy: number;
  telegraph: number;
  sinceAttack: number;
  sincePhaseChange: number;
  combatClass: Enemy['combatClass'];
  protocolPulse: number;
  modifierCount: number;
  anchored: boolean;
  statuses: Enemy['statuses'];
  bossPhase: Enemy['bossPhase'];
  dead: boolean;
};

export type EnemyBossAnimationSignals = {
  profile: EnemyAnimationProfile;
  phase: EnemyAnimationPhase;
  speed: number;
  gait: number;
  idle: number;
  tell: number;
  commit: number;
  recovery: number;
  phaseTransition: number;
  modifier: number;
  status: {
    armorBreach: number;
    disrupted: number;
    marked: number;
    stagger: number;
    conductive: number;
    vacuum: number;
  };
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const pulse = (progress: number) => Math.sin(clamp01(progress) * Math.PI);

export const enemyAnimationProfiles: Record<Enemy['role'], EnemyAnimationProfile> = {
  assault: {
    id: 'assault-breach',
    gaitRate: 9.4,
    gaitAmplitude: 0.38,
    idleBreath: 0.010,
    leftArm: -0.28,
    rightArm: 0.24,
    torsoLean: -0.035,
    telegraphWindow: 0.55,
    tellLean: -0.18,
    tellLift: 0.055,
    tellReach: 0.11,
    commitDuration: 0.13,
    commitKick: 0.14,
    recoveryDuration: 0.22,
    phaseDuration: 0.70,
    phaseRise: 0.12,
    modifierTension: 0.08,
  },
  suppressor: {
    id: 'suppressor-braced',
    gaitRate: 7.2,
    gaitAmplitude: 0.29,
    idleBreath: 0.009,
    leftArm: -0.36,
    rightArm: 0.18,
    torsoLean: 0.045,
    telegraphWindow: 0.82,
    tellLean: -0.08,
    tellLift: 0.075,
    tellReach: 0.07,
    commitDuration: 0.16,
    commitKick: 0.11,
    recoveryDuration: 0.28,
    phaseDuration: 0.72,
    phaseRise: 0.10,
    modifierTension: 0.09,
  },
  technician: {
    id: 'technician-control',
    gaitRate: 6.8,
    gaitAmplitude: 0.25,
    idleBreath: 0.012,
    leftArm: -0.20,
    rightArm: 0.12,
    torsoLean: 0.065,
    telegraphWindow: 0.84,
    tellLean: 0.07,
    tellLift: 0.10,
    tellReach: 0.04,
    commitDuration: 0.14,
    commitKick: 0.09,
    recoveryDuration: 0.30,
    phaseDuration: 0.74,
    phaseRise: 0.11,
    modifierTension: 0.12,
  },
  elite: {
    id: 'elite-hunter',
    gaitRate: 8.0,
    gaitAmplitude: 0.34,
    idleBreath: 0.011,
    leftArm: -0.34,
    rightArm: 0.30,
    torsoLean: -0.025,
    telegraphWindow: 0.72,
    tellLean: -0.14,
    tellLift: 0.09,
    tellReach: 0.12,
    commitDuration: 0.15,
    commitKick: 0.16,
    recoveryDuration: 0.28,
    phaseDuration: 0.80,
    phaseRise: 0.16,
    modifierTension: 0.13,
  },
  boss: {
    id: 'boss-command',
    gaitRate: 5.6,
    gaitAmplitude: 0.22,
    idleBreath: 0.009,
    leftArm: -0.42,
    rightArm: 0.34,
    torsoLean: 0.055,
    telegraphWindow: 1.18,
    tellLean: -0.11,
    tellLift: 0.14,
    tellReach: 0.16,
    commitDuration: 0.20,
    commitKick: 0.18,
    recoveryDuration: 0.36,
    phaseDuration: 0.96,
    phaseRise: 0.24,
    modifierTension: 0.15,
  },
};

export function resolveEnemyBossAnimation(input: EnemyBossAnimationInput): EnemyBossAnimationSignals {
  const profile = enemyAnimationProfiles[input.role];
  const rawSpeed = clamp01(Math.hypot(input.vx, input.vy) * 0.012);
  const speed = input.anchored ? rawSpeed * 0.28 : rawSpeed;
  const gait = Math.sin(input.time * profile.gaitRate + input.id * 0.71) * speed * profile.gaitAmplitude;
  const idle = Math.sin(input.time * 2.1 + input.id * 0.37) * profile.idleBreath;

  const tell = input.telegraph > 0
    ? clamp01(0.35 + (1 - clamp01(input.telegraph / Math.max(0.01, profile.telegraphWindow))) * 0.65)
    : 0;

  let commit = 0;
  let recovery = 0;
  if (input.sinceAttack >= 0 && input.sinceAttack < profile.commitDuration) {
    commit = pulse(input.sinceAttack / profile.commitDuration);
  } else if (input.sinceAttack >= profile.commitDuration && input.sinceAttack < profile.commitDuration + profile.recoveryDuration) {
    recovery = 1 - clamp01((input.sinceAttack - profile.commitDuration) / profile.recoveryDuration);
  }

  const phaseTransition = input.role === 'boss'
    && input.bossPhase === 2
    && input.sincePhaseChange >= 0
    && input.sincePhaseChange < profile.phaseDuration
      ? pulse(input.sincePhaseChange / profile.phaseDuration)
      : 0;

  const classModifier = input.combatClass === 'command'
    ? 0.78
    : input.combatClass === 'elite'
      ? 0.62
      : input.combatClass === 'enhanced'
        ? 0.42
        : 0;
  const modifier = clamp01(Math.max(classModifier, input.protocolPulse, input.modifierCount * 0.16));

  const status = {
    armorBreach: clamp01(input.statuses.armorBreach / 2.4),
    disrupted: clamp01(input.statuses.disrupted / 2.4),
    marked: clamp01(input.statuses.marked / 3.2),
    stagger: clamp01(input.statuses.stagger / 0.9),
    conductive: clamp01(input.statuses.conductive / 5),
    vacuum: clamp01(input.statuses.vacuum / 3),
  };

  const phase: EnemyAnimationPhase = input.dead
    ? 'death'
    : phaseTransition > 0
      ? 'phase-transition'
      : tell > 0
        ? 'tell'
        : commit > 0
          ? 'commit'
          : recovery > 0
            ? 'recovery'
            : speed > 0.06
              ? 'locomotion'
              : 'idle';

  if (input.dead) {
    return {
      profile,
      phase,
      speed: 0,
      gait: 0,
      idle: 0,
      tell: 0,
      commit: 0,
      recovery: 0,
      phaseTransition: 0,
      modifier: 0,
      status: {
        armorBreach: 0,
        disrupted: 0,
        marked: 0,
        stagger: 0,
        conductive: 0,
        vacuum: 0,
      },
    };
  }

  return { profile, phase, speed, gait, idle, tell, commit, recovery, phaseTransition, modifier, status };
}
