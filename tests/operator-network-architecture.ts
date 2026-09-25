import assert from 'node:assert/strict';
import {
  allocateOperatorNetworkNode,
  autoAllocateOperatorNetworkPlan,
  createOperatorNetworkState,
  legacyProgressionNodes,
  normalizeOperatorNetworkState,
  operatorNetworkBuildDefiningNodes,
  operatorNetworkClassWeaponNodes,
  operatorNetworkMilestoneActive,
  operatorNetworkNodeGateReason,
  operatorNetworkPlan,
  operatorNetworkRespecCreditCost,
  operatorNetworkSpecializationNodes,
  operatorNetworkCoreWaveNodes,
  operatorNetworkEdges,
  operatorNetworkNode,
  operatorNetworkNodes,
  operatorNetworkRouteToNode,
  operatorNetworkStartNodeForClass,
  rebuildOperatorNetworkState,
  refundOperatorNetworkNode,
  OPERATOR_NETWORK_SCHEMA_VERSION,
} from '../src/game/operatorNetwork';
import {
  allocateNode,
  autoAllocatePlannedOperatorNetwork,
  createDefaultProfile,
  deriveCombatBuild,
  normalizeStoredProfile,
  specializationNetworkHooksForProfile,
  setOperatorClass,
} from '../src/game/meta';
import { validateStoredProfile } from '../src/game/saveRecovery';

const ids = operatorNetworkNodes.map(node => node.id);
assert.equal(new Set(ids).size, ids.length, 'Operator Network node IDs must be unique.');
assert.equal(operatorNetworkNodes.length, 120, 'P9-D should extend the verified 93-node Network with 27 specialization-integration nodes.');
assert.equal(operatorNetworkCoreWaveNodes.length, 36, 'P9-B must retain six core nodes in each of the six branches.');
assert.equal(operatorNetworkClassWeaponNodes.length, 12, 'P9-B must retain four owned-weapon nodes for each class.');
assert.equal(operatorNetworkBuildDefiningNodes.length, 24, 'P9-C must author four build-defining nodes in each branch.');
assert.equal(operatorNetworkSpecializationNodes.length, 27, 'P9-D must add three nodes for each of the nine class specializations.');
assert.equal(operatorNetworkSpecializationNodes.filter(node => node.kind === 'specialization-entry').length, 9, 'Every specialization needs one LV15 Network entry milestone.');
assert.equal(operatorNetworkSpecializationNodes.filter(node => node.kind === 'specialization-stage').length, 9, 'Every specialization needs one LV16 Network stage milestone.');
assert.equal(operatorNetworkSpecializationNodes.filter(node => node.kind === 'specialization-hook').length, 9, 'Every specialization needs one campaign/boss/faction integration hook.');
assert.equal(operatorNetworkSpecializationNodes.filter(node => node.kind === 'specialization-hook').every(node => node.allocationCost === 1 && (node.effects?.length ?? 0) > 0 && node.integrationHooks?.length === 4 && !!node.unlockKey), true, 'Every specialization hook must cost one point, change runtime state, and bind gear/crafting/faction/Singular integration to an authored milestone.');
assert.equal(operatorNetworkNodes.filter(node => node.kind === 'travel').length, 15, 'P9-C must preserve P9-B travel routing.');
assert.equal(operatorNetworkNodes.filter(node => node.kind === 'notable').length, 21, 'P9-C must preserve existing Notables.');
assert.equal(operatorNetworkNodes.filter(node => node.kind === 'mastery').length, 6, 'P9-C must expose one Mastery per branch.');
assert.equal(operatorNetworkNodes.filter(node => node.kind === 'keystone').length, 12, 'P9-C must expose two Keystone choices per branch.');
assert.equal(operatorNetworkNodes.filter(node => node.kind === 'capstone').length, 6, 'P9-C must expose one Capstone per branch.');
assert.equal(operatorNetworkCoreWaveNodes.every(node => (node.effects?.length ?? 0) > 0), true, 'Every P9-B core node must remain mechanically active.');
assert.ok(operatorNetworkNode('awareness-track-fusion')?.effects?.some(effect => effect.stat === 'attack-speed-mul' && effect.value === 1.03), 'Track Fusion must provide the authored Operator Network source for canonical Attack Speed.');
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

const futurePlan = operatorNetworkPlan(createOperatorNetworkState('vanguard', 1), ['ballistics-3']);
assert.deepEqual(futurePlan.nodeIds, ['ballistics-1', 'ballistics-2', 'ballistics-3'], 'Planner should preview a future legal route even when the current profile cannot afford every node yet.');
assert.equal(futurePlan.pointCost, 3, 'Planner must report the total point cost of the route.');
assert.deepEqual(futurePlan.unresolvedTargetIds, []);
const sharedPlan = operatorNetworkPlan(createOperatorNetworkState('vanguard', 1), ['ballistics-3', 'mobility-1']);
assert.deepEqual(sharedPlan.nodeIds, ['ballistics-1', 'ballistics-2', 'ballistics-3', 'mobility-1'], 'Multiple targets should reuse already-planned route nodes instead of double-counting them.');
assert.equal(sharedPlan.pointCost, 4, 'Shared planned routes should count each node cost once.');
const blockedPlan = operatorNetworkPlan(vanguard, ['vector-rail-entry']);
assert.deepEqual(blockedPlan.unresolvedTargetIds, ['vector-rail-entry'], 'Planner must preserve class arsenal route locks.');

const persistedPlanState = normalizeOperatorNetworkState({
  operatorClass: 'vanguard',
  level: 4,
  specialization: null,
  state: {
    ...createOperatorNetworkState('vanguard', 2),
    allocatedNodeIds: ['ballistics-1'],
    plannedTargetNodeIds: ['ballistics-3', 'mobility-1', 'ballistics-1', 'vector-rail-entry', 'retired-network-node'],
  },
});
assert.deepEqual(persistedPlanState.plannedTargetNodeIds, ['ballistics-3', 'mobility-1'], 'Persisted planner normalization must retain legal future targets while pruning satisfied, wrong-class, and removed targets deterministically.');
const persistedPlan = operatorNetworkPlan(persistedPlanState, persistedPlanState.plannedTargetNodeIds);
assert.deepEqual(persistedPlan.nodeIds, ['ballistics-2', 'ballistics-3', 'mobility-1'], 'A normalized persisted multi-target plan must restore the same aggregate route after reload.');
assert.equal(persistedPlan.pointCost, 3, 'Restored planner routes must remain non-destructive and report only the remaining point cost.');

const planAllocationSource = { ...createOperatorNetworkState('vanguard', 4), plannedTargetNodeIds: ['ballistics-1', 'ballistics-3'] };
const planAllocation = allocateOperatorNetworkNode(planAllocationSource, 'ballistics-1');
assert.equal(planAllocation.allocated, true);
assert.deepEqual(planAllocation.state.plannedTargetNodeIds, ['ballistics-3'], 'Allocating a planned target must prune only the now-satisfied target from persisted planner state.');

const autoFullSource = { ...createOperatorNetworkState('vanguard', 4), plannedTargetNodeIds: ['ballistics-3'] };
const autoFull = autoAllocateOperatorNetworkPlan(autoFullSource, autoFullSource.plannedTargetNodeIds);
assert.deepEqual(autoFull.allocatedNodeIds, ['ballistics-1', 'ballistics-2', 'ballistics-3'], 'Auto Allocate must commit a fully funded route in canonical dependency order.');
assert.equal(autoFull.pointsSpent, 3);
assert.equal(autoFull.pointsRemaining, 1);
assert.deepEqual(autoFull.remainingTargetNodeIds, []);
assert.equal(autoFull.futurePointsNeeded, 0);
assert.equal(autoFull.nextBlocker, null);

const autoPartialSource = { ...createOperatorNetworkState('vanguard', 2), plannedTargetNodeIds: ['ballistics-3', 'mobility-1'] };
const autoPartial = autoAllocateOperatorNetworkPlan(autoPartialSource, autoPartialSource.plannedTargetNodeIds);
assert.deepEqual(autoPartial.allocatedNodeIds, ['ballistics-1', 'ballistics-2'], 'Auto Allocate must spend only the progression points currently available.');
assert.equal(autoPartial.pointsSpent, 2);
assert.equal(autoPartial.pointsRemaining, 0);
assert.deepEqual(autoPartial.remainingTargetNodeIds, ['ballistics-3', 'mobility-1'], 'Partial Auto Allocate must preserve every still-unfunded planned target.');
assert.equal(autoPartial.futurePointsNeeded, 2, 'Partial Auto Allocate must report the future points needed to finish the remaining shared route.');
assert.deepEqual(autoPartial.nextBlocker, { nodeId: 'ballistics-3', reason: 'insufficient-points' });
const autoPartialReload = normalizeOperatorNetworkState({ operatorClass: 'vanguard', level: 3, specialization: null, state: autoPartial.state });
assert.deepEqual(autoPartialReload.allocatedNodeIds, ['ballistics-1', 'ballistics-2'], 'Partial Auto Allocate allocations must survive profile reload normalization.');
assert.deepEqual(autoPartialReload.plannedTargetNodeIds, ['ballistics-3', 'mobility-1'], 'Partial Auto Allocate remaining targets must survive reload.');
assert.equal(autoPartialReload.unspentPoints, 0);

const autoInsufficientSource = { ...createOperatorNetworkState('vanguard', 0), plannedTargetNodeIds: ['ballistics-1'] };
const autoInsufficient = autoAllocateOperatorNetworkPlan(autoInsufficientSource, autoInsufficientSource.plannedTargetNodeIds);
assert.deepEqual(autoInsufficient.allocatedNodeIds, [], 'Auto Allocate must be a no-op when the first legal route node is unfunded.');
assert.deepEqual(autoInsufficient.remainingTargetNodeIds, ['ballistics-1']);
assert.equal(autoInsufficient.futurePointsNeeded, 1);
assert.deepEqual(autoInsufficient.nextBlocker, { nodeId: 'ballistics-1', reason: 'insufficient-points' });

const autoUnresolvedSource = { ...createOperatorNetworkState('vanguard', 3), plannedTargetNodeIds: ['retired-network-node'] };
const autoUnresolved = autoAllocateOperatorNetworkPlan(autoUnresolvedSource, autoUnresolvedSource.plannedTargetNodeIds);
assert.deepEqual(autoUnresolved.allocatedNodeIds, [], 'An unresolved planned target must never spend points.');
assert.deepEqual(autoUnresolved.remainingTargetNodeIds, ['retired-network-node']);
assert.deepEqual(autoUnresolved.nextBlocker, { nodeId: 'retired-network-node', reason: 'unknown-node' });

const autoProfileSource = {
  ...createDefaultProfile(),
  level: 3,
  xp: 270,
  progressionPoints: 2,
  allocatedNodes: [],
  operatorNetwork: autoPartialSource,
};
const autoProfileResult = autoAllocatePlannedOperatorNetwork(autoProfileSource);
assert.deepEqual(autoProfileResult.profile.allocatedNodes, ['ballistics-1', 'ballistics-2'], 'Public Auto Allocate API must mirror canonical allocations into the profile.');
assert.equal(autoProfileResult.profile.progressionPoints, 0);
assert.match(autoProfileResult.message, /2 nodes allocated · 2 pt spent · 0 pt remaining/);
assert.match(autoProfileResult.message, /2 future points needed/);

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
const autoExclusiveSource = { ...buildDefiningState, plannedTargetNodeIds: ['ballistics-breach-economy-keystone'] };
const autoExclusive = autoAllocateOperatorNetworkPlan(autoExclusiveSource, autoExclusiveSource.plannedTargetNodeIds);
assert.deepEqual(autoExclusive.allocatedNodeIds, [], 'Auto Allocate must not bypass Keystone exclusivity.');
assert.deepEqual(autoExclusive.nextBlocker, { nodeId: 'ballistics-breach-economy-keystone', reason: 'exclusive-choice' });
assert.deepEqual(autoExclusive.remainingTargetNodeIds, ['ballistics-breach-economy-keystone']);
const capstoneAllocation = allocateOperatorNetworkNode(buildDefiningState, 'ballistics-terminal-collapse-capstone');
assert.equal(capstoneAllocation.allocated, true, 'A committed Keystone must open its branch Capstone.');
assert.equal(capstoneAllocation.state.unspentPoints, 4);

const pressureNetworkState = { ...createOperatorNetworkState('vanguard', 2), allocatedNodeIds: ['survival-shell-mastery'] };
const pressureLv15Context = { level: 15, specialization: 'pressure-diver' as const, unlockKeys: [] as string[] };
assert.equal(operatorNetworkMilestoneActive(pressureNetworkState, 'pressure-diver-network-entry', pressureLv15Context), true, 'LV15 specialization entry must activate from the selected specialization plus its allocated anchor Mastery.');
assert.equal(operatorNetworkMilestoneActive(pressureNetworkState, 'pressure-diver-network-stage', pressureLv15Context), false, 'LV16 specialization stage must stay locked at level 15.');
const pressureLv16Context = { ...pressureLv15Context, level: 16 };
assert.equal(operatorNetworkMilestoneActive(pressureNetworkState, 'pressure-diver-network-stage', pressureLv16Context), true, 'LV16 specialization stage must activate without consuming a progression point.');
assert.equal(operatorNetworkRouteToNode(pressureNetworkState, 'pressure-diver-network-hook', pressureLv16Context), null, 'Campaign/boss/faction hook must not route before its external milestone is met.');
assert.equal(operatorNetworkNodeGateReason(pressureNetworkState, 'pressure-diver-network-hook', pressureLv16Context), 'external-gate');
const autoGatedSource = { ...pressureNetworkState, plannedTargetNodeIds: ['pressure-diver-network-hook'] };
const autoGated = autoAllocateOperatorNetworkPlan(autoGatedSource, autoGatedSource.plannedTargetNodeIds, pressureLv16Context);
assert.deepEqual(autoGated.allocatedNodeIds, [], 'Auto Allocate must not bypass authored campaign, boss, or faction gates.');
assert.deepEqual(autoGated.nextBlocker, { nodeId: 'pressure-diver-network-hook', reason: 'external-gate' });
assert.deepEqual(autoGated.remainingTargetNodeIds, ['pressure-diver-network-hook']);
const pressureUnlockedContext = { ...pressureLv16Context, unlockKeys: ['boss:khepri'] };
assert.deepEqual(operatorNetworkRouteToNode(pressureNetworkState, 'pressure-diver-network-hook', pressureUnlockedContext), { nodeIds: ['pressure-diver-network-hook'], pointCost: 1 }, 'Unlocked specialization field hook should be one adjacent progression point from its LV16 milestone.');
const pressureAllocation = allocateOperatorNetworkNode(pressureNetworkState, 'pressure-diver-network-hook', pressureUnlockedContext);
assert.equal(pressureAllocation.allocated, true, 'Unlocked specialization field hook must allocate through the canonical graph API.');
assert.equal(pressureAllocation.state.unspentPoints, 1);
assert.equal(operatorNetworkRouteToNode(pressureNetworkState, 'pressure-diver-network-hook', { level: 16, specialization: 'breach-vanguard', unlockKeys: ['boss:khepri'] }), null, 'A selected specialization cannot route through a different specialization subgraph.');

const pressureHookProfile = {
  ...createDefaultProfile(),
  level: 16,
  xp: 8100,
  classSelectionComplete: true,
  specialization: 'pressure-diver' as const,
  allocatedNodes: ['pressure-diver-network-hook'],
  operatorNetwork: { ...createOperatorNetworkState('vanguard', 0), allocatedNodeIds: ['pressure-diver-network-hook'] },
};
const pressureHookBuild = deriveCombatBuild(pressureHookProfile);
const pressureNoHookBuild = deriveCombatBuild({ ...pressureHookProfile, allocatedNodes: [], operatorNetwork: createOperatorNetworkState('vanguard', 0) });
assert.ok(pressureHookBuild.player.vacuumResistance > pressureNoHookBuild.player.vacuumResistance, 'Active specialization hook must materially alter runtime combat state.');
assert.deepEqual(new Set(specializationNetworkHooksForProfile(pressureHookProfile)), new Set(['gear', 'crafting', 'faction', 'singular']), 'Allocated active specialization hook must expose all four P9-D integration surfaces.');
const switchedSpecializationBuild = deriveCombatBuild({ ...pressureHookProfile, specialization: 'breach-vanguard' as const });
const switchedBaselineBuild = deriveCombatBuild({ ...pressureHookProfile, specialization: 'breach-vanguard' as const, allocatedNodes: [], operatorNetwork: createOperatorNetworkState('vanguard', 0) });
assert.equal(switchedSpecializationBuild.player.vacuumResistance, switchedBaselineBuild.player.vacuumResistance, 'Stored specialization hook effects must become inactive when another specialization is selected, preserving safe class/spec switching.');

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

const schemaTwoProfile: any = {
  ...migrated,
  operatorNetwork: {
    schemaVersion: 2,
    startNodeId: 'start-vanguard',
    allocatedNodeIds: ['ballistics-1', 'ballistics-2'],
    unspentPoints: 1,
  },
};
const schemaThreeMigration = normalizeStoredProfile(schemaTwoProfile);
assert.equal(schemaThreeMigration.operatorNetwork?.schemaVersion, OPERATOR_NETWORK_SCHEMA_VERSION, 'Network schema 2 profiles must migrate into the persisted-planner schema.');
assert.deepEqual(schemaThreeMigration.operatorNetwork?.allocatedNodeIds, ['ballistics-1', 'ballistics-2'], 'Network schema migration must preserve existing allocations.');
assert.equal(schemaThreeMigration.operatorNetwork?.unspentPoints, 1, 'Network schema migration must preserve unspent progression points.');
assert.deepEqual(schemaThreeMigration.operatorNetwork?.plannedTargetNodeIds, [], 'Network schema 2 profiles should gain an empty persisted plan without inventing targets.');

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
  specialization: null,
  state: null,
  legacyAllocatedNodes: ['systems-1', 'systems-2', 'unknown-node'],
  legacyUnspentPoints: 1,
});
assert.equal(normalized.startNodeId, 'start-systems');
assert.deepEqual(normalized.allocatedNodeIds, ['systems-1', 'systems-2']);
assert.equal(normalized.unspentPoints, 3, 'Migration must refund level-earned points that are not represented by valid allocations.');

assert.equal(operatorNetworkRespecCreditCost(8, 1), 0, 'Early experimentation must remain free through level 8.');
assert.equal(operatorNetworkRespecCreditCost(9, 1), 6, 'Post-field-trial node refunds must begin with a modest credit cost.');
assert.equal(operatorNetworkRespecCreditCost(16, 1), 14, 'High-level single-node recalibration must carry a meaningful credit cost.');
assert.equal(operatorNetworkRespecCreditCost(16, 8, 'rebuild'), 90, 'High-level full rebuilds should scale with build size while retaining the rebuild discount.');

const refundSource = { ...createOperatorNetworkState('vanguard', 0), allocatedNodeIds: ['ballistics-1', 'ballistics-2'], unspentPoints: 1 };
const blockedRefund = refundOperatorNetworkNode(refundSource, 'ballistics-1');
assert.equal(blockedRefund.refunded, false, 'An upstream node cannot be removed while a downstream allocation depends on it.');
assert.equal(blockedRefund.reason, 'dependent-node');
const leafRefund = refundOperatorNetworkNode(refundSource, 'ballistics-2');
assert.equal(leafRefund.refunded, true, 'A legal leaf node must be individually refundable.');
assert.equal(leafRefund.refundedPoints, 1);
assert.deepEqual(leafRefund.state.allocatedNodeIds, ['ballistics-1']);
assert.equal(leafRefund.state.unspentPoints, 2, 'Individual refunds must return the exact progression-point cost.');

const rebuildSource = { ...createOperatorNetworkState('vanguard', 0), allocatedNodeIds: ['ballistics-1', 'ballistics-2', 'ballistics-3'], unspentPoints: 2, plannedTargetNodeIds: ['mobility-1'] };
const rebuilt = rebuildOperatorNetworkState(rebuildSource);
assert.deepEqual(rebuilt.state.allocatedNodeIds, [], 'Full rebuild must clear every paid allocation.');
assert.equal(rebuilt.refundedPoints, 3);
assert.equal(rebuilt.state.unspentPoints, 5, 'Full rebuild must return every spent progression point without loss.');
assert.deepEqual(rebuilt.state.plannedTargetNodeIds, [], 'Full rebuild must preserve the existing planner behavior of clearing the planned route.');

const retiredNodeMigration = normalizeOperatorNetworkState({
  operatorClass: 'vanguard',
  level: 4,
  specialization: null,
  state: { ...createOperatorNetworkState('vanguard', 0), allocatedNodeIds: ['ballistics-1', 'retired-network-node'], unspentPoints: 0 },
});
assert.deepEqual(retiredNodeMigration.allocatedNodeIds, ['ballistics-1'], 'Removed Network node IDs must be repaired out of a current save.');
assert.ok(retiredNodeMigration.unspentPoints >= 2, 'Removed Network node IDs must refund their point budget instead of deleting progression value.');

const classMigration = normalizeOperatorNetworkState({
  operatorClass: 'vector',
  level: 16,
  specialization: null,
  state: { ...createOperatorNetworkState('vanguard', 0), allocatedNodeIds: ['vanguard-breach-entry'], unspentPoints: 0 },
});
assert.equal(classMigration.startNodeId, 'start-vector');
assert.equal(classMigration.allocatedNodeIds.includes('vanguard-breach-entry'), false, 'A class migration must remove old weapon-family sector allocations.');
assert.ok(classMigration.unspentPoints >= 1, 'A class migration must refund old weapon-family sector points.');

const specializationMigration = normalizeOperatorNetworkState({
  operatorClass: 'vanguard',
  level: 16,
  specialization: null,
  state: { ...createOperatorNetworkState('vanguard', 0), allocatedNodeIds: ['pressure-diver-network-hook'], unspentPoints: 0 },
});
assert.equal(specializationMigration.allocatedNodeIds.includes('pressure-diver-network-hook'), false, 'Clearing a specialization must repair incompatible specialization allocations.');
assert.ok(specializationMigration.unspentPoints >= 1, 'Specialization migration must refund removed specialization allocation value.');

const vanguardRepresentative = setOperatorClass(createDefaultProfile(), 'vanguard').profile;
vanguardRepresentative.allocatedNodes = ['vanguard-breach-entry', 'vanguard-breach-pressure', 'vanguard-breach-impulse', 'vanguard-breach-telemetry'];
vanguardRepresentative.operatorNetwork = { ...createOperatorNetworkState('vanguard', 0), allocatedNodeIds: [...vanguardRepresentative.allocatedNodes] };
const vanguardRepresentativeBuild = deriveCombatBuild(vanguardRepresentative);

const vectorRepresentative = setOperatorClass(createDefaultProfile(), 'vector').profile;
vectorRepresentative.allocatedNodes = ['vector-rail-entry', 'vector-rail-brace', 'vector-rail-bore', 'vector-rail-solution'];
vectorRepresentative.operatorNetwork = { ...createOperatorNetworkState('vector', 0), allocatedNodeIds: [...vectorRepresentative.allocatedNodes] };
const vectorRepresentativeBuild = deriveCombatBuild(vectorRepresentative);

const systemsRepresentative = setOperatorClass(createDefaultProfile(), 'systems').profile;
systemsRepresentative.allocatedNodes = ['systems-carbine-entry', 'systems-carbine-thermal', 'systems-carbine-drive', 'systems-carbine-loop'];
systemsRepresentative.operatorNetwork = { ...createOperatorNetworkState('systems', 0), allocatedNodeIds: [...systemsRepresentative.allocatedNodes] };
const systemsRepresentativeBuild = deriveCombatBuild(systemsRepresentative);

assert.ok(vanguardRepresentativeBuild.weapon.breacher.armorDamageMul > vanguardRepresentativeBuild.weapon.rail.armorDamageMul, 'Representative Vanguard routing must preserve Breacher armor-pressure identity.');
assert.ok(vectorRepresentativeBuild.weapon.rail.speedMul > vectorRepresentativeBuild.weapon.breacher.speedMul, 'Representative Vector routing must preserve Rail projectile-velocity identity.');
assert.ok(systemsRepresentativeBuild.weapon.carbine.magazineAdd > systemsRepresentativeBuild.weapon.rail.magazineAdd, 'Representative Systems routing must preserve Carbine sustain identity.');
const diversitySignatures = new Set([
  `vanguard:${vanguardRepresentativeBuild.weapon.breacher.armorDamageMul.toFixed(4)}:${vanguardRepresentativeBuild.classSkillFamily.armorMul.toFixed(4)}`,
  `vector:${vectorRepresentativeBuild.weapon.rail.speedMul.toFixed(4)}:${vectorRepresentativeBuild.classSkillFamily.rangeMul.toFixed(4)}`,
  `systems:${systemsRepresentativeBuild.weapon.carbine.magazineAdd}:${systemsRepresentativeBuild.classSkillFamily.recoveryMul.toFixed(4)}`,
]);
assert.equal(diversitySignatures.size, 3, 'Representative class builds must remain mechanically distinct after P9-F migration/respec changes.');

console.log(`OPERATOR_NETWORK_ARCHITECTURE_PASS schema=${OPERATOR_NETWORK_SCHEMA_VERSION} planner=persisted nodes=${operatorNetworkNodes.length} edges=${operatorNetworkEdges.length} outer=6 starts=3 coreWave=${operatorNetworkCoreWaveNodes.length} classWeapon=${operatorNetworkClassWeaponNodes.length} buildDefining=${operatorNetworkBuildDefiningNodes.length} specialization=${operatorNetworkSpecializationNodes.length} p9f=respec+migration+diversity`);
