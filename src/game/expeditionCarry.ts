import type { GroundLootReceipt } from './fieldLoot';

export function carryExpeditionLoot(collectedLoot: GroundLootReceipt[]) {
  return collectedLoot.map(receipt => ({ ...receipt }));
}
