export type CarbineVariantId = 'carbine-burst' | 'carbine-precision';
export type BreacherVariantId = 'breacher-slug' | 'breacher-rapid';
export type WeaponVariantId = CarbineVariantId | BreacherVariantId;

export type WeaponVariantPresentation = {
  silhouetteScaleX: number;
  muzzleLengthMul: number;
  muzzleWidthMul: number;
  recoilVisualMul: number;
  aimLift: number;
};

type WeaponVariantStats = {
  damage: number;
  rate: number;
  projectileSpeed: number;
  penetration: number;
  recoil: number;
  spread: number;
  heatPerShot: number;
  heatDissipation: number;
  magazine: number;
  reloadSeconds: number;
  armorDamage: number;
  healthMultiplier: number;
  knockback: number;
  roundsPerTrigger: number;
  pellets: number;
};

export type CarbineVariantDefinition = {
  id: CarbineVariantId;
  family: 'carbine';
  name: string;
  shortName: string;
  firePattern: 'burst' | 'precision';
  description: string;
  tradeoff: string;
  stats: WeaponVariantStats;
  presentation: WeaponVariantPresentation;
};

export type BreacherVariantDefinition = {
  id: BreacherVariantId;
  family: 'breacher';
  name: string;
  shortName: string;
  firePattern: 'slug' | 'rapid';
  description: string;
  tradeoff: string;
  stats: WeaponVariantStats;
  presentation: WeaponVariantPresentation;
};

export type WeaponVariantDefinition = CarbineVariantDefinition | BreacherVariantDefinition;

export const carbineVariantDefinitions: readonly CarbineVariantDefinition[] = [
  {
    id: 'carbine-burst',
    family: 'carbine',
    name: 'Vektor M-7B Burst Carbine',
    shortName: 'M-7B BURST',
    firePattern: 'burst',
    description: 'A compact three-round coil packet that keeps Systems pressure mobile and thermally manageable.',
    tradeoff: 'The burst packet gives up single-round penetration and long-lane precision.',
    stats: {
      damage: 9.8,
      rate: 3.45,
      projectileSpeed: 825,
      penetration: 18,
      recoil: 49,
      spread: 0.022,
      heatPerShot: 0.036,
      heatDissipation: 0.24,
      magazine: 42,
      reloadSeconds: 1.32,
      armorDamage: 0.7,
      healthMultiplier: 1.02,
      knockback: 0.05,
      roundsPerTrigger: 3,
      pellets: 1,
    },
    presentation: {
      silhouetteScaleX: 0.94,
      muzzleLengthMul: 0.9,
      muzzleWidthMul: 1.18,
      recoilVisualMul: 1.14,
      aimLift: -0.012,
    },
  },
  {
    id: 'carbine-precision',
    family: 'carbine',
    name: 'Vektor M-7P Precision Carbine',
    shortName: 'M-7P PRECISION',
    firePattern: 'precision',
    description: 'A long-coil carbine package for deliberate single-shot lanes, sensor marks, and machinery picks.',
    tradeoff: 'Higher per-shot heat and a smaller magazine demand deliberate firing windows.',
    stats: {
      damage: 22.5,
      rate: 4.5,
      projectileSpeed: 1080,
      penetration: 42,
      recoil: 44,
      spread: 0.006,
      heatPerShot: 0.082,
      heatDissipation: 0.2,
      magazine: 20,
      reloadSeconds: 1.5,
      armorDamage: 0.94,
      healthMultiplier: 1,
      knockback: 0.06,
      roundsPerTrigger: 1,
      pellets: 1,
    },
    presentation: {
      silhouetteScaleX: 1.1,
      muzzleLengthMul: 1.24,
      muzzleWidthMul: 0.78,
      recoilVisualMul: 0.86,
      aimLift: 0.025,
    },
  },
] as const;

export const breacherVariantDefinitions: readonly BreacherVariantDefinition[] = [
  {
    id: 'breacher-slug',
    family: 'breacher',
    name: 'Kestrel B-4S Slug Breacher',
    shortName: 'B-4S SLUG',
    firePattern: 'slug',
    description: 'A dense single-bore breach package that converts Vanguard recoil authority into one deliberate armor-cracking projectile.',
    tradeoff: 'The slug trades room-clearing spread, cadence, and thermal recovery for reach, penetration, and single-hit transfer.',
    stats: {
      damage: 63.5,
      rate: 1.1,
      projectileSpeed: 820,
      penetration: 56,
      recoil: 142,
      spread: 0.012,
      heatPerShot: 0.205,
      heatDissipation: 0.17,
      magazine: 5,
      reloadSeconds: 1.95,
      armorDamage: 1.42,
      healthMultiplier: 1.18,
      knockback: 0.16,
      roundsPerTrigger: 1,
      pellets: 1,
    },
    presentation: {
      silhouetteScaleX: 1.12,
      muzzleLengthMul: 1.25,
      muzzleWidthMul: 0.72,
      recoilVisualMul: 1.24,
      aimLift: 0.018,
    },
  },
  {
    id: 'breacher-rapid',
    family: 'breacher',
    name: 'Kestrel B-4R Rapid Breacher',
    shortName: 'B-4R RAPID',
    firePattern: 'rapid',
    description: 'A short-cycle scatter package that keeps Vanguard breach pressure active through repeated close-range follow-up shots.',
    tradeoff: 'Fast cycling, lighter impulse, and better cooling give up slug-class reach, penetration, and per-trigger authority.',
    stats: {
      damage: 5.4,
      rate: 2.6,
      projectileSpeed: 600,
      penetration: 6,
      recoil: 78,
      spread: 0.14,
      heatPerShot: 0.085,
      heatDissipation: 0.26,
      magazine: 10,
      reloadSeconds: 1.5,
      armorDamage: 0.3,
      healthMultiplier: 1.35,
      knockback: 0.075,
      roundsPerTrigger: 1,
      pellets: 5,
    },
    presentation: {
      silhouetteScaleX: 0.93,
      muzzleLengthMul: 0.86,
      muzzleWidthMul: 1.16,
      recoilVisualMul: 0.78,
      aimLift: -0.014,
    },
  },
] as const;

const carbineVariantById = new Map<CarbineVariantId, CarbineVariantDefinition>(
  carbineVariantDefinitions.map(definition => [definition.id, definition] as const),
);
const breacherVariantById = new Map<BreacherVariantId, BreacherVariantDefinition>(
  breacherVariantDefinitions.map(definition => [definition.id, definition] as const),
);
const weaponVariantById = new Map<WeaponVariantId, WeaponVariantDefinition>(
  [...carbineVariantDefinitions, ...breacherVariantDefinitions].map(definition => [definition.id, definition] as const),
);

export function carbineVariantDefinition(id: CarbineVariantId) {
  return carbineVariantById.get(id)!;
}

export function breacherVariantDefinition(id: BreacherVariantId) {
  return breacherVariantById.get(id)!;
}

export function weaponVariantDefinition(id: WeaponVariantId) {
  return weaponVariantById.get(id)!;
}

export function resolveCarbineVariant(item: { baseId: string; name: string; frameIdentity?: string | null }): CarbineVariantId {
  const key = `${item.baseId}:${item.name}`.toLowerCase();
  if (/service|sustained|feed|patchline|longarc/.test(key) || item.frameIdentity === 'carbine-feedline') return 'carbine-burst';
  if (/dense-flight|hyper|flux|countermass|compliance|palisade|stable/.test(key) || item.frameIdentity === 'carbine-hypervelocity' || item.frameIdentity === 'carbine-countermass') return 'carbine-precision';
  return 'carbine-burst';
}

export function resolveBreacherVariant(item: { baseId: string; name: string; frameIdentity?: string | null }): BreacherVariantId {
  const key = `${item.baseId}:${item.name}`.toLowerCase();
  if (/dense|choke|slug|bore|tungsten/.test(key) || item.frameIdentity === 'breacher-dense') return 'breacher-slug';
  if (/backblast|thrust|cryo|cycle|rapid|feed/.test(key) || item.frameIdentity === 'breacher-thrust' || item.frameIdentity === 'breacher-cryo') return 'breacher-rapid';
  return 'breacher-slug';
}

export function weaponVariantPresentation(id: WeaponVariantId | null | undefined) {
  return id ? weaponVariantDefinition(id).presentation : null;
}

export function carbineVariantPresentation(id: CarbineVariantId | null | undefined) {
  return id ? carbineVariantDefinition(id).presentation : null;
}

export function breacherVariantPresentation(id: BreacherVariantId | null | undefined) {
  return id ? breacherVariantDefinition(id).presentation : null;
}
