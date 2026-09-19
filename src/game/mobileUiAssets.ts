import type { OperatorClassId } from './classSkills';
import type { WeaponId } from './sim';

export const operatorClassIconAssets: Record<OperatorClassId, string> = {
  vanguard: '/assets/ui/classes/vanguard.svg',
  vector: '/assets/ui/classes/vector.svg',
  systems: '/assets/ui/classes/systems.svg',
};

export const classSkillIconAssets: Record<OperatorClassId, readonly [string, string, string]> = {
  vanguard: [
    '/assets/ui/skills/vanguard-rush.svg',
    '/assets/ui/skills/vanguard-break.svg',
    '/assets/ui/skills/vanguard-guard.svg',
  ],
  vector: [
    '/assets/ui/skills/vector-shift.svg',
    '/assets/ui/skills/vector-lock.svg',
    '/assets/ui/skills/vector-split.svg',
  ],
  systems: [
    '/assets/ui/skills/systems-well.svg',
    '/assets/ui/skills/systems-hack.svg',
    '/assets/ui/skills/systems-chain.svg',
  ],
};

export const weaponIconAssets: Record<WeaponId, string> = {
  carbine: '/assets/ui/weapons/carbine.svg',
  breacher: '/assets/ui/weapons/breacher.svg',
  rail: '/assets/ui/weapons/rail.svg',
};
