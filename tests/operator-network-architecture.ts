import assert from 'node:assert/strict';
import {
  allocateOperatorNetworkNode,
  createOperatorNetworkState,
  legacyProgressionNodes,
  normalizeOperatorNetworkState,
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
  normalizeStoredProfile,
  setOperatorClass,
} from '../src/game/meta';
import { validateStoredProfile } from '../src/game/saveRecovery';

const ids = operatorNetworkNodes.map(node => node.id);
assert.equal(new Set(ids).size, ids.length, 'Operator Network node IDs must be unique.');
assert.equal(operatorNetworkNodes.length, 21, 'P9-A should expose 3 class starts plus the 18 migrated passives.');
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

console.log(`OPERATOR_NETWORK_ARCHITECTURE_PASS schema=${OPERATOR_NETWORK_SCHEMA_VERSION} nodes=${operatorNetworkNodes.length} edges=${operatorNetworkEdges.length} outer=6 starts=3`);
