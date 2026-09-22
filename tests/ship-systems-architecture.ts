import assert from 'node:assert/strict';
import {
  SHIP_SYSTEM_MAX_TIER,
  SHIP_SYSTEM_SCHEMA_VERSION,
  applyShipBonuses,
  buyShipUpgrade,
  createDefaultCampaign,
  getShipUpgradeStatus,
  getUpgradeCost,
  normalizeCampaignState,
  shipSystemGateSatisfied,
  upgradeDefinitions,
  type ShipUpgradeId,
} from '../src/game/campaign';
import { neutralCombatBuild } from '../src/game/sim';

const systemIds: ShipUpgradeId[] = ['reactor', 'drive', 'armor', 'cargo', 'sensors', 'fabrication', 'medical', 'drones'];
const engineeringIds = new Set<ShipUpgradeId>(['reactor', 'drive', 'armor', 'sensors']);

function approx(actual: number, expected: number, label: string) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: expected ${expected}, got ${actual}`);
}

function schemaSmoke() {
  assert.equal(SHIP_SYSTEM_SCHEMA_VERSION, 2, 'P11-A should own an explicit ship-system schema version.');
  assert.equal(SHIP_SYSTEM_MAX_TIER, 6, 'every major ship system should route through six major tiers.');
  assert.deepEqual(upgradeDefinitions.map(definition => definition.id).sort(), [...systemIds].sort(), 'all eight existing ship systems must migrate into the new schema without replacement IDs.');

  for (const definition of upgradeDefinitions) {
    assert.equal(definition.tiers.length, SHIP_SYSTEM_MAX_TIER, `${definition.name} must expose exactly six authored tier records.`);
    assert.deepEqual(definition.tiers.map(tier => tier.tier), [1, 2, 3, 4, 5, 6], `${definition.name} tier numbering must be contiguous.`);
    assert.equal(definition.tiers[0]?.implemented, true, `${definition.name} Tier 1 must preserve the live prototype effect.`);
    assert.equal(definition.tiers[1]?.implemented, true, `${definition.name} Tier 2 must preserve the live prototype effect.`);

    if (engineeringIds.has(definition.id)) {
      assert.equal(definition.tiers.slice(2).every(tier => tier.implemented), true, `${definition.name} Tier 3-6 must be commissioned in P11-B.`);
      assert.equal(definition.tiers.slice(2).every(tier => !/blueprint/i.test(tier.benefit)), true, `${definition.name} commissioned tiers must preview real combat payoff, not placeholder blueprint text.`);
    } else {
      assert.equal(definition.tiers.slice(2).every(tier => !tier.implemented), true, `${definition.name} Tier 3+ must remain implementation-locked until P11-C.`);
    }

    const credits = definition.tiers.map(tier => tier.cost.credits ?? 0);
    for (let index = 1; index < credits.length; index += 1) {
      assert.ok(credits[index]! > credits[index - 1]!, `${definition.name} should use a steeply increasing credit curve.`);
    }

    for (const tier of definition.tiers.slice(2)) {
      const dependency = tier.gates.find(gate => gate.kind === 'dependency');
      assert.ok(dependency && dependency.kind === 'dependency', `${definition.name} Tier ${tier.tier} requires a dependency edge.`);
      assert.notEqual(dependency.system, definition.id, `${definition.name} must not self-depend.`);
      assert.equal(dependency.tier, tier.tier - 1, `${definition.name} Tier ${tier.tier} should depend on the paired system's previous tier, avoiding same-tier cycles.`);
    }
  }
}

function legacyMigrationSmoke() {
  const legacy: any = createDefaultCampaign();
  delete legacy.shipSystemSchemaVersion;
  legacy.shipUpgrades = { ...legacy.shipUpgrades, reactor: 2, drive: 1, armor: 6, cargo: -4 };

  const migrated = normalizeCampaignState(legacy);
  assert.equal(migrated.shipSystemSchemaVersion, SHIP_SYSTEM_SCHEMA_VERSION, 'legacy two-tier campaigns should stamp the P11-A schema on load.');
  assert.equal(migrated.shipUpgrades.reactor, 2, 'a fully upgraded legacy system must retain its full paid value.');
  assert.equal(migrated.shipUpgrades.drive, 1, 'a partially upgraded legacy system must retain its paid tier.');
  assert.equal(migrated.shipUpgrades.armor, 2, 'pre-schema values must never be interpreted as unearned future tiers.');
  assert.equal(migrated.shipUpgrades.cargo, 0, 'invalid negative legacy levels should normalize safely.');

  const current: any = createDefaultCampaign();
  current.shipUpgrades.reactor = 6;
  assert.equal(normalizeCampaignState(current).shipUpgrades.reactor, 6, 'current-schema Tier 6 state must survive canonical normalization.');
}

function prototypeCompatibilitySmoke() {
  let campaign = createDefaultCampaign();
  campaign = {
    ...campaign,
    resources: { credits: 10_000, alloys: 100, electronics: 100, medstock: 100, components: 100, rareTech: 10 },
  };

  assert.deepEqual(getUpgradeCost(campaign, 'reactor'), { credits: 180, electronics: 3 }, 'Reactor Tier 1 must keep its exact pre-P11 price.');
  let result = buyShipUpgrade(campaign, 'reactor');
  campaign = result.campaign;
  assert.equal(campaign.shipUpgrades.reactor, 1, 'legacy Reactor Tier 1 should still purchase normally.');
  assert.match(result.message, /\+12 max capacitor and \+10% regeneration/, 'Tier 1 should keep its existing gameplay benefit.');

  assert.deepEqual(getUpgradeCost(campaign, 'reactor'), { credits: 340, electronics: 6, components: 2 }, 'Reactor Tier 2 must keep its exact pre-P11 price.');
  result = buyShipUpgrade(campaign, 'reactor');
  campaign = result.campaign;
  assert.equal(campaign.shipUpgrades.reactor, 2, 'legacy Reactor Tier 2 should still purchase normally.');

  const beforeTierThreeAttempt = JSON.stringify(campaign);
  const tierThree = getShipUpgradeStatus(campaign, 'reactor');
  assert.equal(tierThree?.implementationLocked, false, 'P11-B should commission the authored Reactor Tier 3 effect.');
  assert.ok((tierThree?.gateFailures.length ?? 0) > 0, 'Tier 3 should still respect the P11-A campaign, faction, and dependency gates.');
  assert.equal(getUpgradeCost(campaign, 'reactor'), null, 'Tier 3 must not expose a cost until its access gates are satisfied.');
  result = buyShipUpgrade(campaign, 'reactor');
  assert.equal(JSON.stringify(result.campaign), beforeTierThreeAttempt, 'a gated Tier 3 attempt must never spend resources.');
  assert.match(result.message, /tier 3 gated/i, 'a commissioned but inaccessible engineering tier should explain its remaining gates.');
}

function gateGraphSmoke() {
  const campaign = {
    ...createDefaultCampaign(),
    contractsCompleted: 8,
    reputation: { ...createDefaultCampaign().reputation, heliostat: 6, longarc: 6 },
    shipUpgrades: { ...createDefaultCampaign().shipUpgrades, reactor: 2, sensors: 2 },
  };

  const reactor = getShipUpgradeStatus(campaign, 'reactor');
  assert.equal(reactor?.nextTier?.tier, 3, 'Tier 2 systems should preview their Tier 3 route.');
  assert.deepEqual(reactor?.gateFailures, [], 'campaign, faction, and dependency progress should satisfy the mapped Tier 3 access route.');
  assert.equal(reactor?.implementationLocked, false, 'P11-B should commission access-ready Reactor Tier 3.');
  assert.equal(reactor?.canPurchase, true, 'a commissioned engineering tier with satisfied gates should expose its purchase route.');
  assert.deepEqual(getUpgradeCost(campaign, 'reactor'), { credits: 598, electronics: 9, components: 4 }, 'REP 6 discount should apply to the commissioned Tier 3 price.');

  const tierThreeGates = reactor!.nextTier!.gates;
  assert.equal(tierThreeGates.every(gate => shipSystemGateSatisfied(campaign, gate)), true, 'gate evaluation must agree with the status preview.');

  const tierFive = reactor!.definition.tiers[4]!;
  assert.equal(tierFive.gates.some(gate => gate.kind === 'directive'), true, 'Tier 5 must include an endgame Directive gate.');
  assert.equal(tierFive.gates.some(gate => gate.kind === 'trace'), true, 'Tier 5 must include a quarantined Trace gate.');
  const tierSix = reactor!.definition.tiers[5]!;
  assert.equal(tierSix.gates.some(gate => gate.kind === 'boss' && gate.chapter === 'interdiction'), true, 'Tier 6 must include a late boss/campaign gate.');
  assert.equal(tierSix.gates.some(gate => gate.kind === 'directive' && gate.minimumTier >= 8), true, 'Tier 6 must require mature Directive progress.');

  const driveTierFour = upgradeDefinitions.find(definition => definition.id === 'drive')!.tiers[3]!;
  assert.equal(driveTierFour.implemented, true, 'Vector Drive Tier 4 should be authored in P11-B.');
  assert.equal(driveTierFour.gates.some(gate => gate.kind === 'dependency' && gate.system === 'cargo' && gate.tier === 3), true, 'Vector Drive Tier 4 should remain naturally gated behind the future Cargo Grid Tier 3 support wave.');
}

function engineeringEffectSmoke() {
  const base = createDefaultCampaign();

  const reactorTwo = applyShipBonuses(neutralCombatBuild, { ...base, shipUpgrades: { ...base.shipUpgrades, reactor: 2 } });
  assert.equal(reactorTwo.player.maxCapAdd, 24, 'Reactor Tier 2 must preserve +24 capacitor.');
  approx(reactorTwo.player.capRegenMul, 1.2, 'Reactor Tier 2 regeneration');
  approx(reactorTwo.abilities[0].costMul, 1, 'Reactor Tier 2 skill cost');

  const reactorSix = applyShipBonuses(neutralCombatBuild, { ...base, shipUpgrades: { ...base.shipUpgrades, reactor: 6 } });
  assert.equal(reactorSix.player.maxCapAdd, 78, 'Reactor Tier 6 should deliver its authored reserve.');
  approx(reactorSix.player.capRegenMul, 1.56, 'Reactor Tier 6 regeneration');
  for (const [index, ability] of reactorSix.abilities.entries()) approx(ability.costMul, 0.88, `Reactor Tier 6 ability ${index + 1} cost`);

  const driveTwo = applyShipBonuses(neutralCombatBuild, { ...base, shipUpgrades: { ...base.shipUpgrades, drive: 2 } });
  approx(driveTwo.player.moveSpeedMul, 1.08, 'Vector Drive Tier 2 movement');
  approx(driveTwo.player.lowGControl, 0.24, 'Vector Drive Tier 2 low-g control');

  const driveSix = applyShipBonuses(neutralCombatBuild, { ...base, shipUpgrades: { ...base.shipUpgrades, drive: 6 } });
  approx(driveSix.player.moveSpeedMul, 1.22, 'Vector Drive Tier 6 movement');
  approx(driveSix.player.lowGControl, 0.8, 'Vector Drive Tier 6 low-g control');

  const armorTwo = applyShipBonuses(neutralCombatBuild, { ...base, shipUpgrades: { ...base.shipUpgrades, armor: 2 } });
  assert.equal(armorTwo.player.maxArmorAdd, 20, 'Armor Locker Tier 2 must preserve +20 armor.');
  const armorSix = applyShipBonuses(neutralCombatBuild, { ...base, shipUpgrades: { ...base.shipUpgrades, armor: 6 } });
  assert.equal(armorSix.player.maxArmorAdd, 80, 'Armor Locker Tier 6 should deliver its authored deployment reserve.');

  const sensorsTwo = applyShipBonuses(neutralCombatBuild, { ...base, shipUpgrades: { ...base.shipUpgrades, sensors: 2 } });
  approx(sensorsTwo.weapon.carbine.speedMul, 1.08, 'Sensors Tier 2 projectile velocity');
  approx(sensorsTwo.abilities[1].powerMul, 1.16, 'Sensors Tier 2 Sensor Spike power');
  assert.equal(sensorsTwo.weapon.carbine.penetrationAdd, 0, 'Sensors Tier 2 must preserve the legacy no-penetration behavior.');

  const sensorsSix = applyShipBonuses(neutralCombatBuild, { ...base, shipUpgrades: { ...base.shipUpgrades, sensors: 6 } });
  for (const weapon of Object.values(sensorsSix.weapon)) {
    approx(weapon.speedMul, 1.24, 'Sensors Tier 6 projectile velocity');
    assert.equal(weapon.penetrationAdd, 20, 'Sensors Tier 6 should add the authored firing-solution penetration.');
  }
  approx(sensorsSix.abilities[1].powerMul, 1.5, 'Sensors Tier 6 Sensor Spike power');
}

schemaSmoke();
legacyMigrationSmoke();
prototypeCompatibilitySmoke();
gateGraphSmoke();
engineeringEffectSmoke();

console.log(`SHIP_SYSTEMS_ARCHITECTURE_PASS schema=${SHIP_SYSTEM_SCHEMA_VERSION} systems=${upgradeDefinitions.length} tiers=${SHIP_SYSTEM_MAX_TIER} migration=legacy-preserved engineering=P11-B support=P11-C-locked`);
