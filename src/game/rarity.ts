export const rarityOrder = ['Field', 'Refined', 'Prototype', 'Singular'] as const;

export type ItemRarity = (typeof rarityOrder)[number];
export type RarityShape = 'diamond' | 'bar' | 'hexagon' | 'star';

export type RarityDefinition = {
  rank: number;
  token: string;
  cue: string;
  meaning: string;
  worldLabel: string;
  colorHex: string;
  colorValue: number;
  icon: string;
  shape: RarityShape;
  accessibleLabel: string;
};

export const rarityContract: Record<ItemRarity, RarityDefinition> = {
  Field: {
    rank: 0,
    token: 'field',
    cue: 'BASELINE',
    meaning: 'Clean service-grade equipment with no rolled explicit modifiers; predictable foundations for later upgrades.',
    worldLabel: 'FIELD RECOVERY',
    colorHex: '#c3d0ca',
    colorValue: 0xc3d0ca,
    icon: '◇',
    shape: 'diamond',
    accessibleLabel: 'Field rarity, baseline equipment',
  },
  Refined: {
    rank: 1,
    token: 'refined',
    cue: 'UPGRADED',
    meaning: 'Improved equipment with one or two explicit modifiers; a focused step above service-grade hardware.',
    worldLabel: 'REFINED RECOVERY',
    colorHex: '#69aee8',
    colorValue: 0x69aee8,
    icon: '▰',
    shape: 'bar',
    accessibleLabel: 'Refined rarity, upgraded equipment',
  },
  Prototype: {
    rank: 2,
    token: 'prototype',
    cue: 'HIGH-END',
    meaning: 'Experimental high-end equipment with four to six explicit modifiers and stronger frame or augment potential.',
    worldLabel: 'PROTOTYPE RECOVERY',
    colorHex: '#c47ce8',
    colorValue: 0xc47ce8,
    icon: '⬢',
    shape: 'hexagon',
    accessibleLabel: 'Prototype rarity, high-end equipment',
  },
  Singular: {
    rank: 3,
    token: 'singular',
    cue: 'RULE-CHANGER',
    meaning: 'Named chase equipment with a fixed signature rule that can change how a build plays rather than simply adding more modifiers.',
    worldLabel: 'SINGULAR RECOVERY',
    colorHex: '#f0a45b',
    colorValue: 0xf0a45b,
    icon: '✦',
    shape: 'star',
    accessibleLabel: 'Singular rarity, build-changing equipment',
  },
};

export function rarityDefinition(rarity: ItemRarity) {
  return rarityContract[rarity];
}

export function rarityDisplayLabel(rarity: ItemRarity) {
  const definition = rarityDefinition(rarity);
  return `${rarity.toUpperCase()} · ${definition.cue}`;
}

export function rarityClassToken(rarity: ItemRarity) {
  return `rarity-${rarityContract[rarity].token}`;
}

export function compareRarity(left: ItemRarity, right: ItemRarity) {
  return rarityContract[left].rank - rarityContract[right].rank;
}
