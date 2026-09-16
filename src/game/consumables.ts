export type ConsumableId = 'medGel' | 'armorPatch' | 'capacitorCell';
export type ConsumableInventory = Record<ConsumableId, number>;

export type ConsumableDefinition = {
  id: ConsumableId;
  name: string;
  shortName: string;
  description: string;
  effect: string;
  cost: number;
  maxStock: number;
  hotkey: '4' | '5' | '6';
};

export const consumableDefinitions: ConsumableDefinition[] = [
  { id: 'medGel', name: 'Trauma Gel', shortName: 'MED', description: 'Rapid clotting and tissue-seal pack for emergency suit treatment.', effect: 'Restore 40 health.', cost: 45, maxStock: 6, hotkey: '4' },
  { id: 'armorPatch', name: 'Armor Sealant', shortName: 'PATCH', description: 'Pressure-rated plate foam and ceramic weave for field armor repair.', effect: 'Restore 35 armor.', cost: 40, maxStock: 6, hotkey: '5' },
  { id: 'capacitorCell', name: 'Capacitor Cell', shortName: 'CELL', description: 'Disposable high-density cell with a thermal sink coupling.', effect: 'Restore 45 capacitor and vent 24% weapon heat.', cost: 35, maxStock: 6, hotkey: '6' },
];

export function defaultConsumables(): ConsumableInventory {
  return { medGel: 1, armorPatch: 0, capacitorCell: 0 };
}

export function consumableDefinition(id: ConsumableId) {
  return consumableDefinitions.find(item => item.id === id) ?? consumableDefinitions[0];
}
