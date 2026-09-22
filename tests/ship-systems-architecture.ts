import assert from 'node:assert/strict';
import {
  SHIP_SYSTEM_MAX_TIER,
  SHIP_SYSTEM_SCHEMA_VERSION,
  buyShipUpgrade,
  createDefaultCampaign,
  getShipUpgradeStatus,
  getUpgradeCost,
  normalizeCampaignState,
  shipSystemGateSatisfied,
  upgradeDefinitions,
  type ShipUpgradeId,
} from '../src/game/campaign';

const systemIds: ShipUpgradeId[] = ['reactor', 'drive', 'armor', 'cargo', 'sensors', 'fabrication', 'medical', 'drones'];

function schemaSmoke() {
  assert.equal(SHIP_SYSTEM_SCHEMA_VERSION, 2, 'P11-A should own an explicit ship-system schema version.');
  assert.equal(SHIP_SYSTEM_MAX_TIER, 6, 'every major ship system should route through six major tiers.');
  assert.deepEqual(upgradeDefinitions.map(definition => definition.id).sort(), [...systemIds].sort(), 'all eight existing ship systems must migrate into the new schema without replacement IDs.');

  for (const definition of upgradeDefinitions) {
    assert.equal(definition.tiers.length, SHIP_SYSTEM_MAX_TIER, `${definition.name} must expose exactly six authored tier records.`);
    assert.deepEqual(definition.tiers.map(tier => tier.tier), [1, 2, 3, 4, 5, 6], `${definition.name} tier numbering must be contiguous.`);
    assert.equal(definition.tiers[0]?.implemented, true, `${definition.name} Tier 1 must preserve the live prototype effect.`);
    assert.equal(definition.tiers[1]?.implemented, true, `${definition.name} Tier 2 must preserve the live prototype effect.`);
    assert.equal(definition.tiers.slice(2).every(tier => !tier.implemented), true, `${definition.name} Tier 3+ must remain implementation-locked until P11-B/P11-C.`);

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
  assert.equal(getUpgradeCost(campaign, 'reactor'), null, 'mapped Tier 3 must not become purchasable before its engineering implementation wave.');
  result = buyShipUpgrade(campaign, 'reactor');
  assert.equal(JSON.stringify(result.campaign), beforeTierThreeAttempt, 'a queued future blueprint must never spend resources or grant unfinished power.');
  assert.match(result.message, /blueprint is mapped.*not commissioned/i, 'future-tier lock should explain why the route is visible but unavailable.');
}

function gateGraphSmoke() {
  let campaign = createDefaultCampaign();
  campaign = {
    ...campaign,
    contractsCompleted: 8,
    reputation: { ...campaign.reputation, heliostat: 6, longarc: 6 },
    shipUpgrades: { ...campaign.shipUpgrades, reactor: 2, sensors: 2 },
  };

  const reactor = getShipUpgradeStatus(campaign, 'reactor');
  assert.equal(reactor?.nextTier?.tier, 3, 'Tier 2 systems should preview their Tier 3 route.');
  assert.deepEqual(reactor?.gateFailures, [], 'campaign, faction, and dependency progress should satisfy the mapped Tier 3 access route.');
  assert.equal(reactor?.implementationLocked, true, 'access-ready Tier 3 blueprints remain locked until P11-B authors the actual effect.');

  const tierThreeGates = reactor!.nextTier!.gates;
  assert.equal(tierThreeGates.every(gate => shipSystemGateSatisfied(campaign, gate)), true, 'gate evaluation must agree with the status preview.');

  const tierFive = reactor!.definition.tiers[4]!;
  assert.equal(tierFive.gates.some(gate => gate.kind === 'directive'), true, 'Tier 5 must include an endgame Directive gate.');
  assert.equal(tierFive.gates.some(gate => gate.kind === 'trace'), true, 'Tier 5 must include a quarantined Trace gate.');
  const tierSix = reactor!.definition.tiers[5]!;
  assert.equal(tierSix.gates.some(gate => gate.kind === 'boss' && gate.chapter === 'interdiction'), true, 'Tier 6 must include a late boss/campaign gate.');
  assert.equal(tierSix.gates.some(gate => gate.kind === 'directive' && gate.minimumTier >= 8), true, 'Tier 6 must require mature Directive progress.');
}

schemaSmoke();
legacyMigrationSmoke();
prototypeCompatibilitySmoke();
gateGraphSmoke();

console.log(`SHIP_SYSTEMS_ARCHITECTURE_PASS schema=${SHIP_SYSTEM_SCHEMA_VERSION} systems=${upgradeDefinitions.length} tiers=${SHIP_SYSTEM_MAX_TIER} migration=legacy-preserved future-power=locked`);
