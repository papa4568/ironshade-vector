import type { OperatorClassId } from './classSkills';

export type SkillAnimationPhase = 'idle' | 'anticipation' | 'action' | 'recovery';

export type SkillAnimationProfile = {
  id: string;
  anticipation: number;
  action: number;
  recovery: number;
  cancelWindow: number;
  torsoLean: number;
  torsoDip: number;
  socketReach: number;
  socketLift: number;
  socketRoll: number;
  leftArm: number;
  rightArm: number;
  hipShift: number;
};

export type PlayerSkillAnimationInput = {
  operatorClass: OperatorClassId | null;
  abilityIndex: number;
  elapsed: number;
  dodge: number;
  reload: number;
  vent: number;
  hit: number;
  dead: boolean;
};

export type PlayerSkillAnimationSignals = {
  profile: SkillAnimationProfile | null;
  phase: SkillAnimationPhase;
  weight: number;
  impulse: number;
  recovery: number;
  cancelReady: boolean;
  interrupted: boolean;
};

export type EnemyDamageAnimationInput = {
  hit: number;
  staggerTimer: number;
  armorBreak: number;
  dead: boolean;
};

export type EnemyDamageAnimationSignals = {
  hit: number;
  stagger: number;
  armorBreak: number;
  torsoSnap: number;
  armFlare: number;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const easeOut = (value: number) => 1 - Math.pow(1 - clamp01(value), 2);

export const classSkillAnimationProfiles: Record<OperatorClassId, readonly [SkillAnimationProfile, SkillAnimationProfile, SkillAnimationProfile]> = {
  vanguard: [
    { id: 'vanguard-breach-rush', anticipation: 0.08, action: 0.12, recovery: 0.25, cancelWindow: 0.16, torsoLean: -0.28, torsoDip: 0.04, socketReach: 0.15, socketLift: -0.02, socketRoll: 0.12, leftArm: -0.12, rightArm: 0.18, hipShift: -0.08 },
    { id: 'vanguard-fracture-tag', anticipation: 0.11, action: 0.11, recovery: 0.29, cancelWindow: 0.18, torsoLean: -0.12, torsoDip: 0.015, socketReach: 0.11, socketLift: 0.055, socketRoll: -0.24, leftArm: -0.2, rightArm: 0.12, hipShift: -0.04 },
    { id: 'vanguard-bulwark-pulse', anticipation: 0.14, action: 0.16, recovery: 0.34, cancelWindow: 0.24, torsoLean: 0.12, torsoDip: -0.065, socketReach: -0.04, socketLift: 0.08, socketRoll: 0.16, leftArm: -0.34, rightArm: 0.34, hipShift: -0.1 },
  ],
  vector: [
    { id: 'vector-shift', anticipation: 0.055, action: 0.09, recovery: 0.19, cancelWindow: 0.095, torsoLean: -0.2, torsoDip: 0.02, socketReach: 0.18, socketLift: 0.055, socketRoll: -0.08, leftArm: -0.08, rightArm: 0.1, hipShift: 0.11 },
    { id: 'vector-deadeye-lock', anticipation: 0.15, action: 0.1, recovery: 0.27, cancelWindow: 0.19, torsoLean: 0.08, torsoDip: -0.018, socketReach: 0.035, socketLift: 0.1, socketRoll: -0.18, leftArm: -0.22, rightArm: -0.04, hipShift: -0.02 },
    { id: 'vector-splitshot', anticipation: 0.085, action: 0.14, recovery: 0.24, cancelWindow: 0.16, torsoLean: -0.06, torsoDip: 0.01, socketReach: 0.1, socketLift: 0.06, socketRoll: 0.3, leftArm: -0.13, rightArm: 0.22, hipShift: 0.04 },
  ],
  systems: [
    { id: 'systems-polarity-well', anticipation: 0.12, action: 0.14, recovery: 0.29, cancelWindow: 0.19, torsoLean: 0.05, torsoDip: -0.025, socketReach: 0.045, socketLift: 0.1, socketRoll: 0.2, leftArm: -0.38, rightArm: 0.12, hipShift: 0.035 },
    { id: 'systems-relay-hack', anticipation: 0.13, action: 0.11, recovery: 0.28, cancelWindow: 0.19, torsoLean: 0.09, torsoDip: -0.015, socketReach: 0.02, socketLift: 0.12, socketRoll: -0.18, leftArm: -0.48, rightArm: -0.08, hipShift: 0.02 },
    { id: 'systems-cascade-arc', anticipation: 0.1, action: 0.17, recovery: 0.31, cancelWindow: 0.21, torsoLean: -0.08, torsoDip: 0.025, socketReach: 0.08, socketLift: 0.075, socketRoll: 0.24, leftArm: -0.3, rightArm: 0.3, hipShift: -0.02 },
  ],
};

export function skillAnimationProfile(operatorClass: OperatorClassId | null, abilityIndex: number) {
  if (!operatorClass || abilityIndex < 0 || abilityIndex > 2) return null;
  return classSkillAnimationProfiles[operatorClass][abilityIndex];
}

export function resolvePlayerSkillAnimation(input: PlayerSkillAnimationInput): PlayerSkillAnimationSignals {
  const profile = skillAnimationProfile(input.operatorClass, input.abilityIndex);
  if (!profile || input.elapsed < 0) {
    return { profile, phase: 'idle', weight: 0, impulse: 0, recovery: 0, cancelReady: false, interrupted: false };
  }

  const total = profile.anticipation + profile.action + profile.recovery;
  if (input.elapsed >= total) {
    return { profile, phase: 'idle', weight: 0, impulse: 0, recovery: 1, cancelReady: true, interrupted: false };
  }

  const cancelReady = input.elapsed >= profile.cancelWindow;
  const hardInterrupt = input.dead || input.hit > 0.25;
  const softInterrupt = input.dodge > 0 || input.reload > 0 || input.vent > 0;
  const interrupted = hardInterrupt || (softInterrupt && cancelReady);
  if (interrupted) {
    return { profile, phase: 'recovery', weight: 0, impulse: 0, recovery: 1, cancelReady, interrupted: true };
  }

  if (input.elapsed < profile.anticipation) {
    const progress = input.elapsed / Math.max(0.001, profile.anticipation);
    return {
      profile,
      phase: 'anticipation',
      weight: easeOut(progress),
      impulse: 0,
      recovery: 0,
      cancelReady,
      interrupted: false,
    };
  }

  if (input.elapsed < profile.anticipation + profile.action) {
    const progress = (input.elapsed - profile.anticipation) / Math.max(0.001, profile.action);
    return {
      profile,
      phase: 'action',
      weight: 1,
      impulse: Math.sin(progress * Math.PI),
      recovery: 0,
      cancelReady,
      interrupted: false,
    };
  }

  const progress = (input.elapsed - profile.anticipation - profile.action) / Math.max(0.001, profile.recovery);
  return {
    profile,
    phase: 'recovery',
    weight: Math.pow(1 - clamp01(progress), 2),
    impulse: 0,
    recovery: clamp01(progress),
    cancelReady,
    interrupted: false,
  };
}

export function resolveEnemyDamageAnimation(input: EnemyDamageAnimationInput): EnemyDamageAnimationSignals {
  if (input.dead) return { hit: 0, stagger: 0, armorBreak: 0, torsoSnap: 0, armFlare: 0 };
  const hit = clamp01(input.hit);
  const stagger = clamp01(input.staggerTimer / 0.9);
  const armorBreak = clamp01(input.armorBreak);
  return {
    hit,
    stagger,
    armorBreak,
    torsoSnap: clamp01(hit * 0.95 + stagger * 0.62 + armorBreak * 0.5),
    armFlare: clamp01(armorBreak * 0.9 + stagger * 0.28),
  };
}
