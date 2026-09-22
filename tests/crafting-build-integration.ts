import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { craftingRulesForItem } from '../src/game/craftingRules';
import { craftingBuildIntegration, reconstructItem, reconstructionCost, type ReconstructionAction } from '../src/game/reconstruction';
import { createDefaultProfile, materializeModifier, type Item, type PlayerProfile } from '../src/game/meta';
import type { SalvageWallet } from '../src/game/campaign';

const wallet: SalvageWallet = { credits: 5000, alloys: 30, electronics: 30, medstock: 0, components: 30, rareTech: 10 };

function railItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'p10-d-rail',
    baseId: 'r2-hypervelocity-bed',
    name: 'P10-D Rail',
    slot: 'rail',
    equipmentClass: 'Rail assembly',
    rarity: 'Refined',
    levelRequirement: 1,
    core: 'P10-D fixture.',
    modifiers: [],
    recoveryLevel: 50,
    frameGeneration: 5,
    frameIdentity: 'rail-hypervelocity',
    equipmentQuality: 0,
    augmentSlots: 2,
    augments: [],
    recoveryQuality: 4,
    recoverySource: 'P10-D regression',
    craftStability: 100,
    ...overrides,
  };
}

function profileFor(item: Item, operatorClass: 'vanguard' | 'vector' = 'vector'): PlayerProfile {
  const base = createDefaultProfile();
  return {
    ...base,
    level: 18,
    xp: 10200,
    operatorClass,
    classSelectionComplete: true,
    specialization: operatorClass === 'vector' ? 'survey-deadeye' : null,
    specializationOverclock: false,
    allocatedNodes: operatorClass === 'vector' ? ['survey-deadeye-network-hook'] : [],
    inventory: [item],
    equipped: { carbine: null, breacher: null, rail: operatorClass === 'vector' ? item.id : null, suit: null, rig: null, implant: null },
  };
}
