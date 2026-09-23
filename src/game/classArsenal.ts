export type CarbineVariantId = 'carbine-burst' | 'carbine-precision';

export type CarbineVariantDefinition = {
  id: CarbineVariantId;
  family: 'carbine';
  name: string;
  shortName: string;
  firePattern: 'burst' | 'precision';
  description: string;
  tradeoff: string;
  stats: {
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
  };
  presentation: {
    silhouetteScaleX: number;
    muzzleLengthMul: number;
    muzzleWidthMul: number;
    recoilVisualMul: number;
    aimLift: number;
  };
};

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

const carbineVariantById = new Map(carbineVariantDefinitions.map(definition => [definition.id, definition] as const));

export function carbineVariantDefinition(id: CarbineVariantId) {
  return carbineVariantById.get(id)!;
}

export function resolveCarbineVariant(item: { baseId: string; name: string; frameIdentity?: string | null }): CarbineVariantId {
  const key = `${item.baseId}:${item.name}`.toLowerCase();
  if (/service|sustained|feed|patchline|longarc/.test(key) || item.frameIdentity === 'carbine-feedline') return 'carbine-burst';
  if (/dense-flight|hyper|flux|countermass|compliance|palisade|stable/.test(key) || item.frameIdentity === 'carbine-hypervelocity' || item.frameIdentity === 'carbine-countermass') return 'carbine-precision';
  return 'carbine-burst';
}

export function carbineVariantPresentation(id: CarbineVariantId | null | undefined) {
  return id ? carbineVariantDefinition(id).presentation : null;
}
