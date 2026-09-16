import assert from 'node:assert/strict';
import { buyConsumable, createDefaultCampaign, loadCampaign, saveCampaign } from '../src/game/campaign';
import { aimAtMobileTarget, applyPlayerDamage, createSimulation, triggerConsumable } from '../src/game/sim';

const storage = new Map<string, string>();
const localStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, String(value)); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => { storage.clear(); },
};
(globalThis as unknown as { window: { localStorage: typeof localStorage } }).window = { localStorage };

const migratedSource = createDefaultCampaign();
const { consumables: _oldConsumables, ...legacyCampaign } = migratedSource;
localStorage.setItem('ironshade-vector-campaign-v1', JSON.stringify(legacyCampaign));
const migrated = loadCampaign();
assert.deepEqual(migrated.consumables, { medGel: 1, armorPatch: 0, capacitorCell: 0 }, 'existing saves should receive compatible default consumable storage');

let campaign = createDefaultCampaign();
const creditsBefore = campaign.resources.credits;
const stockBefore = campaign.consumables.medGel;
const purchase = buyConsumable(campaign, 'medGel');
campaign = purchase.campaign;
assert.equal(campaign.resources.credits, creditsBefore - 45, 'Trauma Gel should cost Credits');
assert.equal(campaign.consumables.medGel, stockBefore + 1, 'purchase should increase persistent stock');
saveCampaign(campaign);
assert.equal(loadCampaign().consumables.medGel, stockBefore + 1, 'consumable stock should round-trip through campaign save');

const healState = createSimulation();
healState.player.hp = 25;
assert.equal(triggerConsumable(healState, 'medGel'), true);
assert.equal(healState.player.hp, 65);
assert.equal(triggerConsumable(healState, 'medGel'), false, 'consumables should respect the shared use cooldown');
healState.player.consumableCooldown = 0;
healState.player.armor = 10;
assert.equal(triggerConsumable(healState, 'armorPatch'), true);
assert.equal(healState.player.armor, 45);
healState.player.consumableCooldown = 0;
healState.player.capacitor = 20;
healState.player.weaponHeat.carbine = 0.8;
assert.equal(triggerConsumable(healState, 'capacitorCell'), true);
assert.equal(healState.player.capacitor, 65);
assert.ok(Math.abs(healState.player.weaponHeat.carbine - 0.56) < 0.0001);

const deathState = createSimulation();
deathState.player.hp = 1;
deathState.player.armor = deathState.player.maxArmor;
applyPlayerDamage(deathState, 5, 0);
assert.equal(deathState.player.dead, true, 'a real damaging hit at displayed 1 HP must be lethal');
assert.equal(deathState.player.hp, 0);
assert.equal(deathState.telemetry.deaths, 1);

const aimState = createSimulation();
aimState.player.x = 1000;
aimState.player.y = 500;
aimState.player.aim = { x: 1, y: 0 };
for (const enemy of aimState.enemies) enemy.active = false;
const target = aimState.enemies.find(enemy => enemy.id === 1)!;
target.active = true;
target.dead = false;
target.x = 700;
target.y = 500;
assert.equal(aimAtMobileTarget(aimState, 'balanced', target.id), target.id);
assert.ok(aimState.player.aim.x > 0.95, 'first target-switch frame should turn toward the new target instead of snapping 180 degrees');
for (let i = 0; i < 30; i += 1) aimAtMobileTarget(aimState, 'balanced', target.id);
assert.ok(aimState.player.aim.x < -0.95, 'assisted aim should still converge fully on the target');

console.log(`GAMEPLAY_REGRESSIONS_PASS credits=${campaign.resources.credits} med=${campaign.consumables.medGel} hp=${deathState.player.hp} aim=${aimState.player.aim.x.toFixed(3)}`);
