import assert from 'node:assert/strict';
import {
  SHIP_SYSTEM_MAX_TIER,
  SHIP_SYSTEM_SCHEMA_VERSION,
  applyShipBonuses,
  buyShipUpgrade,
  cargoRecoveryMultiplier,
  createDefaultCampaign,
  getShipUpgradeStatus,
  getShipSpecializationStatus,
  getUpgradeCost,
  installShipSpecialization,
  normalizeCampaignState,
  shipSpecializationDefinitions,
  shipSystemGateSatisfied,
  upgradeDefinitions,
  type ShipSpecializationId,
  type ShipUpgradeId,
} from '../src/game/campaign';
import { reconstructionCreditDiscountForTier } from '../src/game/reconstruction';
import { shipHardwareState, shipSystemPresentation } from '../src/game/shipSystemPresentation';
import { neutralCombatBuild } from '../src/game/sim';

const systemIds: ShipUpgradeId[] = ['reactor', 'drive', 'armor', 'cargo', 'sensors', 'fabrication', 'medical', 'drones'];
const engineeringIds = new Set<ShipUpgradeId>(['reactor', 'drive', 'armor', 'sensors']);
const supportIds = new Set<ShipUpgradeId>(['cargo', 'fabrication', 'medical', 'drones']);

function approx(actual: number, expected: number, label: string) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: expected ${expected}, got ${actual}`);
}

function schemaSmoke() {
  assert.equal(SHIP_SYSTEM_SCHEMA_VERSION, 3, 'P11-D should advance the ship-system schema without invalidating the six-tier P11 foundation.');
  assert.equal(SHIP_SYSTEM_MAX_TIER, 6, 'every major ship system should route through six major tiers.');
  assert.deepEqual(upgradeDefinitions.map(definition => definition.id).sort(), [...systemIds].sort(), 'all eight existing ship systems must migrate into the new schema without replacement IDs.');

  for (const definition of upgradeDefinitions) {
    assert.equal(definition.tiers.length, SHIP_SYSTEM_MAX_TIER, `${definition.name} must expose exactly six authored tier records.`);
    assert.deepEqual(definition.tiers.map(tier => tier.tier), [1, 2, 3, 4, 5, 6], `${definition.name} tier numbering must be contiguous.`);
    assert.equal(definition.tiers[0]?.implemented, true, `${definition.name} Tier 1 must preserve the live prototype effect.`);
    assert.equal(definition.tiers[1]?.implemented, true, `${definition.name} Tier 2 must preserve the live prototype effect.`);

    if (engineeringIds.has(definition.id)) {
      assert.equal(definition.tiers.slice(2).every(tier => tier.implemented), true, `${definition.name} Tier 3-6 must remain commissioned from P11-B.`);
    } else {
      assert.equal(supportIds.has(definition.id), true, `${definition.name} must belong to the P11-C support wave.`);
      assert.equal(definition.tiers.slice(2).every(tier => tier.implemented), true, `${definition.name} Tier 3-6 must be commissioned in P11-C.`);
    }
    assert.equal(definition.tiers.slice(2).every(tier => !/blueprint/i.test(tier.benefit)), true, `${definition.name} commissioned tiers must preview real field or economy payoff, not placeholder blueprint text.`);

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

  assert.equal(shipSpecializationDefinitions.length, 3, 'P11-D should expose three mutually exclusive high-tier package choices.');
  assert.equal(new Set(shipSpecializationDefinitions.map(definition => definition.id)).size, shipSpecializationDefinitions.length, 'advanced package ids must be unique.');
  for (const definition of shipSpecializationDefinitions) {
    assert.ok((definition.cost.credits ?? 0) >= 2000, `${definition.name} should remain an aspirational late-game credit sink.`);
    assert.ok((definition.cost.rareTech ?? 0) >= 2, `${definition.name} should consume quarantined traces rather than becoming a free power layer.`);
    assert.equal(definition.gates.some(gate => gate.kind === 'directive' && gate.minimumTier >= 6), true, `${definition.name} should require mature Directive progress.`);
    const systemGates = definition.gates.filter(gate => gate.kind === 'dependency');
    assert.ok(systemGates.length >= 2, `${definition.name} should bind multiple existing systems into a specialization package.`);
    assert.equal(systemGates.every(gate => gate.kind === 'dependency' && gate.tier === 5), true, `${definition.name} should specialize high-tier foundations without replacing Tier 6 progression.`);
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

  const p11c: any = createDefaultCampaign();
  p11c.shipSystemSchemaVersion = 2;
  p11c.shipUpgrades.reactor = 6;
  assert.equal(normalizeCampaignState(p11c).shipUpgrades.reactor, 6, 'P11-C schema-2 Tier 6 state must survive the P11-D schema migration.');

  const current: any = createDefaultCampaign();
  current.shipUpgrades.reactor = 6;
  current.shipSpecialization = 'heliostat-hot-bus';
  const normalizedCurrent = normalizeCampaignState(current);
  assert.equal(normalizedCurrent.shipUpgrades.reactor, 6, 'current-schema Tier 6 state must survive canonical normalization.');
  assert.equal(normalizedCurrent.shipSpecialization, 'heliostat-hot-bus', 'a valid P11-D specialization must survive canonical normalization.');

  const invalidSpecialization: any = createDefaultCampaign();
  invalidSpecialization.shipSpecialization = 'untrusted-package';
  assert.equal(normalizeCampaignState(invalidSpecialization).shipSpecialization, null, 'unknown specialization ids must normalize to an empty slot.');
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

function supportGateGraphSmoke() {
  const base = createDefaultCampaign();
  const campaign = {
    ...base,
    contractsCompleted: 8,
    reputation: { ...base.reputation, longarc: 6, heliostat: 6, meridian: 6 },
    shipUpgrades: { ...base.shipUpgrades, drive: 2, cargo: 2, fabrication: 2, armor: 2, medical: 2, sensors: 2, drones: 2 },
  };

  const expectations: Array<[ShipUpgradeId, number]> = [
    ['cargo', 552],
    ['fabrication', 662],
    ['medical', 561],
    ['drones', 699],
  ];
  for (const [id, credits] of expectations) {
    const status = getShipUpgradeStatus(campaign, id);
    assert.equal(status?.nextTier?.tier, 3, `${id} should expose its Tier 3 support route.`);
    assert.equal(status?.implementationLocked, false, `${id} Tier 3 should be commissioned in P11-C.`);
    assert.deepEqual(status?.gateFailures, [], `${id} Tier 3 should honor the existing access graph when its gates are satisfied.`);
    assert.equal(status?.canPurchase, true, `${id} Tier 3 should become purchasable when its gates are satisfied.`);
    assert.equal(getUpgradeCost(campaign, id)?.credits, credits, `${id} Tier 3 should keep the P11-A cost curve and REP 6 discount.`);
  }
}

function supportEffectSmoke() {
  const base = createDefaultCampaign();

  approx(cargoRecoveryMultiplier(2), 1.24, 'Cargo Grid Tier 2 salvage yield');
  approx(cargoRecoveryMultiplier(6), 1.72, 'Cargo Grid Tier 6 salvage yield');

  approx(reconstructionCreditDiscountForTier(1), 0.1, 'Microforge Tier 1 credit discount');
  approx(reconstructionCreditDiscountForTier(2), 0.2, 'Microforge Tier 2 credit discount');
  approx(reconstructionCreditDiscountForTier(6), 0.45, 'Microforge Tier 6 credit discount');

  const medicalTwo = applyShipBonuses(neutralCombatBuild, { ...base, shipUpgrades: { ...base.shipUpgrades, medical: 2 } });
  assert.equal(medicalTwo.player.maxHpAdd, 16, 'Trauma Bay Tier 2 must preserve +16 maximum health.');
  const medicalSix = applyShipBonuses(neutralCombatBuild, { ...base, shipUpgrades: { ...base.shipUpgrades, medical: 6 } });
  assert.equal(medicalSix.player.maxHpAdd, 48, 'Trauma Bay Tier 6 should deliver +48 maximum health.');

  const dronesTwo = applyShipBonuses(neutralCombatBuild, { ...base, shipUpgrades: { ...base.shipUpgrades, drones: 2 } });
  assert.equal(dronesTwo.mechanics.arcDrone, true, 'Support Drone Rack Tier 2 must preserve relay drone support.');
  approx(dronesTwo.mechanics.arcDroneScale, 1, 'Support Drone Rack Tier 2 relay damage');
  approx(dronesTwo.abilities[2].cooldownMul, 0.9, 'Support Drone Rack Tier 2 Arc Tap cooldown');
  approx(dronesTwo.abilities[2].powerMul, 1, 'Support Drone Rack Tier 2 Arc Tap power');

  const dronesSix = applyShipBonuses(neutralCombatBuild, { ...base, shipUpgrades: { ...base.shipUpgrades, drones: 6 } });
  approx(dronesSix.mechanics.arcDroneScale, 2.2, 'Support Drone Rack Tier 6 relay damage');
  approx(dronesSix.abilities[2].cooldownMul, 0.78, 'Support Drone Rack Tier 6 Arc Tap cooldown');
  approx(dronesSix.abilities[2].powerMul, 1.2, 'Support Drone Rack Tier 6 Arc Tap power');
}


function specializationGateAndCostSmoke() {
  const base = createDefaultCampaign();
  const rich = {
    ...base,
    resources: { credits: 50_000, alloys: 200, electronics: 200, medstock: 200, components: 200, rareTech: 20 },
    reputation: { meridian: 14, heliostat: 14, longarc: 14 },
    directives: { ...base.directives, highestTier: 6 },
    shipUpgrades: { reactor: 5, drive: 5, armor: 5, cargo: 5, sensors: 5, fabrication: 5, medical: 5, drones: 5 },
  };

  const ids = shipSpecializationDefinitions.map(definition => definition.id) as ShipSpecializationId[];
  for (const id of ids) {
    const status = getShipSpecializationStatus(rich, id);
    assert.ok(status, `${id} should expose an install status.`);
    assert.deepEqual(status?.gateFailures, [], `${id} should satisfy its authored prerequisites in the prepared late-game campaign.`);
    assert.deepEqual(status?.resourceFailures, [], `${id} should report no resource shortages against a rich wallet.`);
    assert.equal(status?.canInstall, true, `${id} should become installable when prerequisites and costs are satisfied.`);
  }

  const heliostatCost = shipSpecializationDefinitions.find(definition => definition.id === 'heliostat-hot-bus')!.cost;
  const installed = installShipSpecialization(rich, 'heliostat-hot-bus');
  assert.equal(installed.campaign.shipSpecialization, 'heliostat-hot-bus', 'installing a package should persist the selected specialization id.');
  assert.equal(installed.campaign.resources.credits, rich.resources.credits - (heliostatCost.credits ?? 0), 'specialization installation should spend the exact previewed credit cost.');
  assert.equal(installed.campaign.resources.rareTech, rich.resources.rareTech - (heliostatCost.rareTech ?? 0), 'specialization installation should spend the exact previewed trace cost.');

  const meridianAfterLock = getShipSpecializationStatus(installed.campaign, 'meridian-continuity');
  assert.equal(meridianAfterLock?.lockedByOther, true, 'a selected package must lock the other high-tier packages.');
  assert.equal(meridianAfterLock?.canInstall, false, 'a mutually exclusive package must not remain installable after another package is selected.');
  const blocked = installShipSpecialization(installed.campaign, 'meridian-continuity');
  assert.equal(blocked.campaign, installed.campaign, 'attempting a second specialization must not mutate campaign state.');

  const poor = { ...rich, resources: { ...rich.resources, credits: 0 } };
  const poorStatus = getShipSpecializationStatus(poor, 'longarc-farline');
  assert.equal(poorStatus?.resourceFailures.some(([key]) => key === 'credits'), true, 'resource preview should expose an insufficient credit wallet before installation.');
  assert.equal(poorStatus?.canInstall, false, 'resource shortages must block specialization installation.');
}

function specializationEffectSmoke() {
  const base = createDefaultCampaign();

  const heliostatCampaign = {
    ...base,
    shipSpecialization: 'heliostat-hot-bus' as const,
    shipUpgrades: { ...base.shipUpgrades, reactor: 5, fabrication: 5, drones: 5 },
  };
  const heliostat = applyShipBonuses(neutralCombatBuild, heliostatCampaign);
  assert.equal(heliostat.player.maxCapAdd, 70, 'Hot-Bus Mesh should add a narrow +8 capacitor layer over Reactor Tier 5.');
  approx(heliostat.abilities[0].costMul, 0.92 * 0.98, 'Hot-Bus Mesh class-skill capacitor cost');
  approx(heliostat.mechanics.arcDroneScale, 1.8 * 1.1, 'Hot-Bus Mesh relay-drone damage');

  const meridianCampaign = {
    ...base,
    shipSpecialization: 'meridian-continuity' as const,
    shipUpgrades: { ...base.shipUpgrades, armor: 5, medical: 5 },
  };
  const meridian = applyShipBonuses(neutralCombatBuild, meridianCampaign);
  assert.equal(meridian.player.maxArmorAdd, 72, 'Continuity Bulkhead should add +10 armor over Armor Tier 5.');
  assert.equal(meridian.player.maxHpAdd, 48, 'Continuity Bulkhead should add +8 health over Trauma Bay Tier 5.');

  const longarcCampaign = {
    ...base,
    shipSpecialization: 'longarc-farline' as const,
    shipUpgrades: { ...base.shipUpgrades, drive: 5, cargo: 5, sensors: 5 },
  };
  const longarc = applyShipBonuses(neutralCombatBuild, longarcCampaign);
  approx(longarc.player.moveSpeedMul, 1.18 * 1.03, 'Farline Recovery movement');
  for (const weapon of Object.values(longarc.weapon)) {
    approx(weapon.speedMul, 1.2 * 1.04, 'Farline Recovery projectile velocity');
    assert.equal(weapon.penetrationAdd, 16, 'Farline Recovery should add only +4 penetration over Sensors Tier 5.');
  }
}

function physicalPresentationSmoke() {
  assert.deepEqual(Object.keys(shipSystemPresentation).sort(), [...systemIds].sort(), 'P11-E must give every commissioned ship system a physical hardware presentation.');

  const mechanisms = new Set<string>();
  for (const id of systemIds) {
    const presentation = shipSystemPresentation[id];
    mechanisms.add(presentation.mechanism);
    assert.ok(presentation.hardwareName.length >= 12, `${id} should expose a readable physical hardware identity.`);
    assert.ok(presentation.location.length >= 8, `${id} should expose a ship-space location for physical legibility.`);
    assert.equal(presentation.tierStates.length, SHIP_SYSTEM_MAX_TIER, `${id} should author one physical state for each major tier.`);
    assert.equal(new Set(presentation.tierStates).size, SHIP_SYSTEM_MAX_TIER, `${id} physical tier states should remain visibly distinct.`);
    assert.equal(shipHardwareState(id, 0), 'Uncommissioned frame', `${id} should expose a stable pre-installation frame state.`);
    assert.equal(shipHardwareState(id, 1), presentation.tierStates[0], `${id} Tier 1 should resolve to its first authored hardware state.`);
    assert.equal(shipHardwareState(id, 6), presentation.tierStates[5], `${id} Tier 6 should resolve to its fully realized hardware state.`);
    assert.equal(shipHardwareState(id, 99), presentation.tierStates[5], `${id} presentation should clamp impossible future tiers safely.`);
  }

  assert.equal(mechanisms.size, systemIds.length, 'the eight ship systems should use distinct mechanism silhouettes in the physical systems bay.');
}

schemaSmoke();
legacyMigrationSmoke();
prototypeCompatibilitySmoke();
gateGraphSmoke();
engineeringEffectSmoke();
supportGateGraphSmoke();
supportEffectSmoke();
specializationGateAndCostSmoke();
specializationEffectSmoke();
physicalPresentationSmoke();

console.log(`SHIP_SYSTEMS_ARCHITECTURE_PASS schema=${SHIP_SYSTEM_SCHEMA_VERSION} systems=${upgradeDefinitions.length} tiers=${SHIP_SYSTEM_MAX_TIER} migration=legacy-preserved engineering=P11-B support=P11-C specialization=P11-D physical=P11-E`);
