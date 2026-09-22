import assert from 'node:assert/strict';
import {
  allocateOperatorNetworkNode,
  createOperatorNetworkState,
  legacyProgressionNodes,
  normalizeOperatorNetworkState,
  operatorNetworkBuildDefiningNodes,
  operatorNetworkClassWeaponNodes,
  operatorNetworkCoreWaveNodes,
  operatorNetworkEdges,
  operatorNetworkNode,
  operatorNetworkNodes,
  operatorNetworkRouteToNode,
  operatorNetworkStartNodeForClass,
  OPERATOR_NETWORK_SCHEMA_VERSION,
} from '../src/game/operatorNetwork';
import {
  allocateNode,
  createDefaultProfile,
  deriveCombatBuild,
  normalizeStoredProfile,
  setOperatorClass,
} from '../src/game/meta';
import { validateStoredProfile } from '../src/game/saveRecovery';

const ids = operatorNetworkNodes.map(node => node.id);
assert.equal(new Set(ids).size, ids.length, 'Operator Network node IDs must be unique.');
assert.equal(operatorNetworkNodes.length, 93, 'P9-C should extend the verified 69-node core with 24 build-defining nodes.');
assert.equal(operatorNetworkCoreWaveNodes.length, 36, 'P9-B must retain six core nodes in each of the six branches.');
assert.equal(operatorNetworkClassWeaponNodes.length, 12, 'P9-B must retain four owned-weapon nodes for each class.');
assert.equal(operatorNetworkBuildDefiningNodes.length, 24, 'P9-C must author four build-defining nodes in each branch.');
assert.equal(operatorNetworkNodes.filter(node => node.kind === 'travel').length, 15, 'P9-C must preserve P9-B travel routing.');
assert.equal(operatorNetworkNodes.filter(node => node.kind === 'notable').length, 21, 'P9-C must preserve existing Notables.');
assert.equal(operatorNetworkNodes.filter(node => node.kind === 'mastery').length, 6, 'P9-C must expose one Mastery per branch.');
assert.equal(operatorNetworkNodes.filter(node => node.kind === 'keystone').length, 12, 'P9-C must expose two Keystone choices per branch.');
assert.equal(operatorNetworkNodes.filter(node => node.kind === 'capstone').length, 6, 'P9-C must expose one Capstone per branch.');
assert.equal(operatorNetworkCoreWaveNodes.every(node => (node.effects?.length ?? 0) > 0), true, 'Every P9-B core node must remain mechanically active.');
assert.equal(operatorNetworkClassWeaponNodes.every(node => !!node.weaponFamily && (node.effects?.length ?? 0) > 0), true, 'Every class weapon-sector node must remain family-owned and mechanically active.');
assert.equal(operatorNetworkBuildDefiningNodes.every(node => (node.effects?.length ?? 0) > 0), true, 'Every P9-C node must change runtime combat state.');
for (const branch of ['Ballistics', 'Mobility', 'Systems', 'Survival', 'Engineering', 'Awareness'] as const) {
  const branchNodes = operatorNetworkBuildDefiningNodes.filter(node => node.branch === branch);
  assert.equal(branchNodes.filter(node => node.kind === 'mastery').length, 1, `${branch} must have one P9-C Mastery.`);
  assert.equal(branchNodes.filter(node => node.kind === 'keystone').length, 2, `${branch} must have two P9-C Keystones.`);
  assert.equal(branchNodes.filter(node => node.kind === 'capstone').length, 1, `${branch} must have one P9-C Capstone.`);
  assert.equal(new Set(branchNodes.filter(node => node.kind === 'keystone').map(node => node.exclusiveGroup)).size, 1, `${branch} Keystones must share one exclusive choice group.`);
}
assert.equal(legacyProgressionNodes.length, 18, 'Legacy passive mechanics must remain represented during P9-A migration.');

for (const edge of operatorNetworkEdges) {
  assert.ok(operatorNetworkNode(edge.a), `Edge source must exist: ${edge.a}`);
  assert.ok(operatorNetworkNode(edge.b), `Edge target must exist: ${edge.b}`);
  assert.notEqual(edge.a, edge.b, 'Operator Network edges cannot self-connect.');
}
assert.equal(operatorNetworkEdges.filter(edge => edge.route === 'outer-ring').length, 6, 'Shared outer network must connect all six branch sectors.');

assert.equal(operatorNetworkStartNodeForClass('vanguard'), 'start-vanguard');
assert.equal(operatorNetworkStartNodeForClass('vector'), 'start-vector');
assert.equal(operatorNetworkStartNodeForClass('systems'), 'start-systems');
for (const startId of ['start-vanguard', 'start-vector', 'start-systems']) {
  const node = operatorNetworkNode(startId)!;
  assert.equal(node.kind, 'class-start');
  assert.equal(node.allocationCost, 0);
}

const vanguard = createOperatorNetworkState('vanguard', 6);
assert.equal(vanguard.schemaVersion, OPERATOR_NETWORK_SCHEMA_VERSION);
assert.deepEqual(operatorNetworkRouteToNode(vanguard, 'ballistics-1'), { nodeIds: ['ballistics-1'], pointCost: 1 });
assert.deepEqual(operatorNetworkRouteToNode(vanguard, 'ballistics-3'), { nodeIds: ['ballistics-1', 'ballistics-2', 'ballistics-3'], pointCost: 3 });
assert.deepEqual(operatorNetworkRouteToNode(vanguard, 'mobility-1'), { nodeIds: ['ballistics-1', 'ballistics-2', 'ballistics-3', 'mobility-1'], pointCost: 4 });
assert.deepEqual(operatorNetworkRouteToNode(vanguard, 'vanguard-breach-telemetry'), { nodeIds: ['vanguard-breach-entry', 'vanguard-breach-pressure', 'vanguard-breach-impulse', 'vanguard-breach-telemetry'], pointCost: 4 });
assert.deepEqual(operatorNetworkRouteToNode(createOperatorNetworkState('vanguard', 12), 'ballistics-terminal-collapse-capstone'), { nodeIds: ['ballistics-1', 'ballistics-2', 'ballistics-3', 'ballistics-terminal-mastery', 'ballistics-overpenetration-keystone', 'ballistics-terminal-collapse-capstone'], pointCost: 8 }, 'Ballistics Capstone routing must require the existing branch spine, Mastery, one Keystone, then the Capstone.');
assert.equal(operatorNetworkRouteToNode(vanguard, 'vector-rail-entry'), null, 'Class weapon sectors cannot be used as cross-class routing shortcuts.');

let state = createOperatorNetworkState('vanguard', 3);
let result = allocateOperatorNetworkNode(state, 'ballistics-2');
assert.equal(result.allocated, false);
assert.equal(result.reason, 'missing-prerequisite');
result = allocateOperatorNetworkNode(state, 'ballistics-1');
assert.equal(result.allocated, true);
state = result.state;
result = allocateOperatorNetworkNode(state, 'ballistics-2');
assert.equal(result.allocated, true);
state = result.state;
assert.deepEqual(state.allocatedNodeIds, ['ballistics-1', 'ballistics-2']);
assert.equal(state.unspentPoints, 1);

const vectorWeaponGate = allocateOperatorNetworkNode(createOperatorNetworkState('vector', 3), 'vanguard-breach-entry');
assert.equal(vectorWeaponGate.allocated, false);
assert.equal(vectorWeaponGate.reason, 'wrong-arsenal');

let buildDefiningState = createOperatorNetworkState('vanguard', 12);
for (const nodeId of ['ballistics-1', 'ballistics-2', 'ballistics-3', 'ballistics-terminal-mastery', 'ballistics-overpenetration-keystone']) {
  const allocation = allocateOperatorNetworkNode(buildDefiningState, nodeId);
  assert.equal(allocation.allocated, true, `Expected P9-C route allocation to succeed: ${nodeId}`);
  buildDefiningState = allocation.state;
}
const exclusiveKeystone = allocateOperatorNetworkNode(buildDefiningState, 'ballistics-breach-economy-keystone');
assert.equal(exclusiveKeystone.allocated, false, 'A branch cannot hold both mutually exclusive P9-C Keystones.');
assert.equal(exclusiveKeystone.reason, 'exclusive-choice');
assert.equal(operatorNetworkRouteToNode(buildDefiningState, 'ballistics-breach-economy-keystone'), null, 'Route preview must respect an already-committed Keystone choice.');
const capstoneAllocation = allocateOperatorNetworkNode(buildDefiningState, 'ballistics-terminal-collapse-capstone');
assert.equal(capstoneAllocation.allocated, true, 'A committed Keystone must open its branch Capstone.');
assert.equal(capstoneAllocation.state.unspentPoints, 4);

let profile = { ...createDefaultProfile(), level: 4, xp: 540, progressionPoints: 3 };
const first = allocateNode(profile, 'ballistics-1');
assert.ok(first.profile.allocatedNodes.includes('ballistics-1'), 'Public allocation API should mirror canonical network state to legacy allocatedNodes.');
assert.equal(first.profile.operatorNetwork?.allocatedNodeIds.includes('ballistics-1'), true);
assert.equal(first.profile.progressionPoints, first.profile.operatorNetwork?.unspentPoints);

profile = first.profile;
const switched = setOperatorClass(profile, 'vector').profile;
assert.equal(switched.operatorNetwork?.startNodeId, 'start-vector', 'Changing class should move the free graph origin.');
assert.deepEqual(switched.operatorNetwork?.allocatedNodeIds, profile.operatorNetwork?.allocatedNodeIds, 'Changing class must not delete existing allocations.');
assert.equal(switched.operatorNetwork?.unspentPoints, profile.operatorNetwork?.unspentPoints, 'Changing class must preserve unspent points.');

const legacyProfile: any = {
  ...createDefaultProfile(),
  level: 4,
  xp: 540,
  progressionPoints: 1,
  allocatedNodes: ['ballistics-1', 'ballistics-2'],
};
delete legacyProfile.operatorNetwork;
const migrated = normalizeStoredProfile(legacyProfile);
assert.equal(migrated.operatorNetwork?.schemaVersion, OPERATOR_NETWORK_SCHEMA_VERSION);
assert.equal(migrated.operatorNetwork?.startNodeId, 'start-vanguard');
assert.deepEqual(migrated.operatorNetwork?.allocatedNodeIds, ['ballistics-1', 'ballistics-2']);
assert.equal(migrated.progressionPoints, 1);
assert.deepEqual(migrated.allocatedNodes, migrated.operatorNetwork?.allocatedNodeIds);
assert.equal(validateStoredProfile(migrated), null, 'Canonical network profile should pass save validation.');

const runtimeProfile = createDefaultProfile();
runtimeProfile.allocatedNodes = ['ballistics-vectoring-lane', 'ballistics-bore-map', 'vanguard-breach-entry', 'vanguard-breach-pressure', 'vanguard-breach-impulse', 'vanguard-breach-telemetry'];
runtimeProfile.operatorNetwork = { ...createOperatorNetworkState('vanguard', 0), allocatedNodeIds: [...runtimeProfile.allocatedNodes] };
const runtimeBuild = deriveCombatBuild(runtimeProfile);
assert.equal(runtimeBuild.weapon.carbine.penetrationAdd, 4, 'Shared Ballistics travel nodes must affect the full active arsenal stat model.');
assert.ok(runtimeBuild.weapon.breacher.damageMul > runtimeBuild.weapon.rail.damageMul, 'Vanguard weapon-sector damage must remain Breacher-specific.');
assert.ok(runtimeBuild.weapon.breacher.armorDamageMul > runtimeBuild.weapon.rail.armorDamageMul, 'Vanguard weapon-sector armor pressure must remain Breacher-specific.');
assert.ok(runtimeBuild.weapon.breacher.knockbackMul > runtimeBuild.weapon.rail.knockbackMul, 'Vanguard weapon-sector handling must remain Breacher-specific.');
assert.ok(runtimeBuild.classSkillFamily.armorMul > 1, 'Class weapon-sector Notables must feed class-skill identity.');
assert.ok(runtimeBuild.classSkillFamily.sources.includes('network:vanguard-breach-telemetry'), 'Class-skill effects must expose their Operator Network source.');

const baselineBuild = deriveCombatBuild(createDefaultProfile());
const overpenetrationProfile = createDefaultProfile();
overpenetrationProfile.allocatedNodes = ['ballistics-terminal-mastery', 'ballistics-overpenetration-keystone', 'ballistics-terminal-collapse-capstone'];
overpenetrationProfile.operatorNetwork = { ...createOperatorNetworkState('vanguard', 0), allocatedNodeIds: [...overpenetrationProfile.allocatedNodes] };
const overpenetrationBuild = deriveCombatBuild(overpenetrationProfile);
assert.ok(overpenetrationBuild.weapon.breacher.speedMul > baselineBuild.weapon.breacher.speedMul, 'Overpenetration must materially increase projectile velocity.');
assert.ok(overpenetrationBuild.weapon.breacher.penetrationAdd >= baselineBuild.weapon.breacher.penetrationAdd + 36, 'Mastery, Keystone, and Capstone penetration must stack.');
assert.ok(overpenetrationBuild.weapon.breacher.recoilMul > baselineBuild.weapon.breacher.recoilMul, 'Overpenetration tradeoff must increase recoil.');
assert.ok(overpenetrationBuild.weapon.breacher.heatPerShotMul > baselineBuild.weapon.breacher.heatPerShotMul, 'Overpenetration tradeoff must increase heat per shot.');
assert.ok(overpenetrationBuild.classSkillFamily.armorMul > baselineBuild.classSkillFamily.armorMul, 'Ballistics Capstone must feed class-skill armor pressure.');

const breachEconomyProfile = createDefaultProfile();
breachEconomyProfile.allocatedNodes = ['ballistics-terminal-mastery', 'ballistics-breach-economy-keystone'];
breachEconomyProfile.operatorNetwork = { ...createOperatorNetworkState('vanguard', 0), allocatedNodeIds: [...breachEconomyProfile.allocatedNodes] };
const breachEconomyBuild = deriveCombatBuild(breachEconomyProfile);
assert.ok(breachEconomyBuild.weapon.breacher.armorDamageMul > baselineBuild.weapon.breacher.armorDamageMul, 'Breach Economy must increase armor damage.');
assert.ok(breachEconomyBuild.weapon.breacher.healthMultiplierMul < baselineBuild.weapon.breacher.healthMultiplierMul, 'Breach Economy tradeoff must reduce direct health damage.');

const normalized = normalizeOperatorNetworkState({
  operatorClass: 'systems',
  level: 6,
  state: null,
  legacyAllocatedNodes: ['systems-1', 'systems-2', 'unknown-node'],
  legacyUnspentPoints: 1,
});
assert.equal(normalized.startNodeId, 'start-systems');
assert.deepEqual(normalized.allocatedNodeIds, ['systems-1', 'systems-2']);
assert.equal(normalized.unspentPoints, 3, 'Migration must refund level-earned points that are not represented by valid allocations.');

console.log(`OPERATOR_NETWORK_ARCHITECTURE_PASS schema=${OPERATOR_NETWORK_SCHEMA_VERSION} nodes=${operatorNetworkNodes.length} edges=${operatorNetworkEdges.length} outer=6 starts=3 coreWave=${operatorNetworkCoreWaveNodes.length} classWeapon=${operatorNetworkClassWeaponNodes.length} buildDefining=${operatorNetworkBuildDefiningNodes.length}`);
