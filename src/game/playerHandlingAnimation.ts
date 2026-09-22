import type { WeaponId } from './sim';

export type HandlingOperatorClass = 'vanguard' | 'vector' | 'systems' | null;

export type PlayerHandlingAnimationProfile = {
  id: string;
  leftArm: number;
  rightArm: number;
  torsoLean: number;
  hipOffset: number;
  gaitScale: number;
  aimLean: number;
  aimLift: number;
  recoilScale: number;
  chargeLean: number;
  ventLean: number;
  overheatStrain: number;
  dodgeWeight: number;
};

export type PlayerHandlingAnimationInput = {
  operatorClass: HandlingOperatorClass;
  weapon: WeaponId;
  time: number;
  vx: number;
  vy: number;
  aimX: number;
  aimY: number;
  moveX: number;
  moveY: number;
  weaponFlash: number;
  fireCooldown: number;
  weaponRate: number;
  firingIntent: boolean;
  reloadT: number;
  reloadDuration: number;
  ventT: number;
  ventDuration: number;
  heat: number;
  dodgeTime: number;
  hit: number;
};

export type PlayerHandlingAnimationSignals = {
  profile: PlayerHandlingAnimationProfile;
  speed: number;
  gait: number;
  idleBreath: number;
  aimOffset: number;
  aimForward: number;
  recoil: number;
  reload: number;
  charge: number;
  vent: number;
  overheat: number;
  dodge: number;
  hit: number;
};

const neutralProfile: PlayerHandlingAnimationProfile = {
  id: 'neutral-ready',
  leftArm: -0.5,
  rightArm: 0.34,
  torsoLean: -0.015,
  hipOffset: 0,
  gaitScale: 1,
  aimLean: 0.08,
  aimLift: 0.035,
  recoilScale: 1,
  chargeLean: 0.06,
  ventLean: 0.07,
  overheatStrain: 0.09,
  dodgeWeight: 1,
};

export const playerHandlingAnimationProfiles: Record<Exclude<HandlingOperatorClass, null>, PlayerHandlingAnimationProfile> = {
  vanguard: {
    id: 'vanguard-planted-breach',
    leftArm: -0.66,
    rightArm: 0.52,
    torsoLean: -0.09,
    hipOffset: -0.035,
    gaitScale: 0.82,
    aimLean: 0.075,
    aimLift: 0.02,
    recoilScale: 1.18,
    chargeLean: 0.04,
    ventLean: 0.085,
    overheatStrain: 0.14,
    dodgeWeight: 0.78,
  },
  vector: {
    id: 'vector-linear-precision',
    leftArm: -0.74,
    rightArm: 0.27,
    torsoLean: 0.035,
    hipOffset: -0.012,
    gaitScale: 0.9,
    aimLean: 0.165,
    aimLift: 0.085,
    recoilScale: 0.92,
    chargeLean: 0.17,
    ventLean: 0.12,
    overheatStrain: 0.075,
    dodgeWeight: 1.2,
  },
  systems: {
    id: 'systems-mobile-brace',
    leftArm: -0.42,
    rightArm: 0.34,
    torsoLean: -0.025,
    hipOffset: 0.008,
    gaitScale: 1.1,
    aimLean: 0.12,
    aimLift: 0.05,
    recoilScale: 0.82,
    chargeLean: 0.065,
    ventLean: 0.07,
    overheatStrain: 0.105,
    dodgeWeight: 1.02,
  },
};

export function playerHandlingAnimationProfile(operatorClass: HandlingOperatorClass) {
  return operatorClass ? playerHandlingAnimationProfiles[operatorClass] : neutralProfile;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function normalized(x: number, y: number) {
  const length = Math.hypot(x, y);
  return length > 0.0001 ? { x: x / length, y: y / length, length } : { x: 0, y: 0, length: 0 };
}

export function resolvePlayerHandlingAnimation(input: PlayerHandlingAnimationInput): PlayerHandlingAnimationSignals {
  const profile = playerHandlingAnimationProfile(input.operatorClass);
  const speed = clamp01(Math.hypot(input.vx, input.vy) * 0.012);
  const gait = Math.sin(input.time * (8.5 + speed * 3)) * speed * profile.gaitScale;
  const idleBreath = Math.sin(input.time * 2.4);

  const aim = normalized(input.aimX, input.aimY);
  const move = normalized(input.moveX, input.moveY);
  const aimOffset = move.length > 0.1 && aim.length > 0.1
    ? Math.max(-1, Math.min(1, move.x * aim.y - move.y * aim.x))
    : 0;
  const aimForward = move.length > 0.1 && aim.length > 0.1
    ? Math.max(-1, Math.min(1, move.x * aim.x + move.y * aim.y))
    : 1;

  const recoil = clamp01(input.weaponFlash * 8);
  const reload = input.reloadT > 0 ? clamp01(input.reloadT / Math.max(0.01, input.reloadDuration)) : 0;
  const vent = input.ventT > 0 ? clamp01(input.ventT / Math.max(0.01, input.ventDuration)) : 0;
  const overheat = clamp01((input.heat - 0.72) / 0.26);
  const dodge = input.dodgeTime > 0 ? clamp01(input.dodgeTime / 0.18) : 0;
  const hit = clamp01(input.hit);

  // Rail charge is a presentation layer only. It rises between committed shots while FIRE remains held;
  // simulation cadence, projectile timing, heat, and class ownership remain unchanged.
  const charge = input.weapon === 'rail' && input.firingIntent && reload === 0 && vent === 0
    ? clamp01(1 - input.fireCooldown * Math.max(0.01, input.weaponRate))
    : 0;

  return {
    profile,
    speed,
    gait,
    idleBreath,
    aimOffset,
    aimForward,
    recoil,
    reload,
    charge,
    vent,
    overheat,
    dodge,
    hit,
  };
}
