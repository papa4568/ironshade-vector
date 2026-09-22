import type { OperatorClassId } from './classSkills';

export const OPERATOR_NETWORK_SCHEMA_VERSION = 1 as const;

export const operatorNetworkBranches = ['Ballistics', 'Mobility', 'Systems', 'Survival', 'Engineering', 'Awareness'] as const;
export type OperatorNetworkBranch = typeof operatorNetworkBranches[number];
export type OperatorNetworkNodeKind = 'class-start' | 'travel' | 'standard' | 'notable' | 'mastery' | 'keystone' | 'capstone';
export type OperatorNetworkSector = 'origin' | 'core' | 'outer';

export type OperatorNetworkNode = {
  id: string;
  kind: OperatorNetworkNodeKind;
  branch: OperatorNetworkBranch | 'Origin';
  name: string;
  description: string;
  allocationCost: number;
  prerequisiteIds: string[];
  sector: OperatorNetworkSector;
  classStart?: OperatorClassId;
  legacyMajor?: boolean;
  legacyRequires?: string;
};

export type OperatorNetworkEdge = {
  a: string;
  b: string;
  route: 'class-start' | 'branch' | 'outer-ring';
};

export type OperatorNetworkState = {
  schemaVersion: typeof OPERATOR_NETWORK_SCHEMA_VERSION;
  startNodeId: string;
  allocatedNodeIds: string[];
  unspentPoints: number;
};

export type OperatorNetworkRoute = {
  nodeIds: string[];
  pointCost: number;
};

const classStartNodeIds: Record<OperatorClassId, string> = {
  vanguard: 'start-vanguard',
  vector: 'start-vector',
  systems: 'start-systems',
};

const legacyNodes: OperatorNetworkNode[] = [
  { id: 'ballistics-1', kind: 'standard', branch: 'Ballistics', name: 'Dense Flight', description: '+8 penetration to all player projectiles.', allocationCost: 1, prerequisiteIds: [], sector: 'core' },
  { id: 'ballistics-2', kind: 'standard', branch: 'Ballistics', name: 'Armor Work', description: '+15% armor damage.', allocationCost: 1, prerequisiteIds: ['ballistics-1'], sector: 'core', legacyRequires: 'ballistics-1' },
  { id: 'ballistics-3', kind: 'notable', branch: 'Ballistics', name: 'Breach Doctrine', description: 'Armor Breach lasts longer, but direct health damage is slightly reduced.', allocationCost: 1, prerequisiteIds: ['ballistics-2'], sector: 'outer', legacyMajor: true, legacyRequires: 'ballistics-2' },

  { id: 'mobility-1', kind: 'standard', branch: 'Mobility', name: 'Servo Timing', description: '+6% movement speed.', allocationCost: 1, prerequisiteIds: [], sector: 'core' },
  { id: 'mobility-2', kind: 'standard', branch: 'Mobility', name: 'Low-G Footwork', description: 'Improved stopping control below 0.35g.', allocationCost: 1, prerequisiteIds: ['mobility-1'], sector: 'core', legacyRequires: 'mobility-1' },
  { id: 'mobility-3', kind: 'notable', branch: 'Mobility', name: 'Recoil Vectoring', description: 'While moving, 35% of weapon recoil is redirected into your chosen movement vector.', allocationCost: 1, prerequisiteIds: ['mobility-2'], sector: 'outer', legacyMajor: true, legacyRequires: 'mobility-2' },

  { id: 'systems-1', kind: 'standard', branch: 'Systems', name: 'Efficient Bus', description: '+12% capacitor regeneration.', allocationCost: 1, prerequisiteIds: [], sector: 'core' },
  { id: 'systems-2', kind: 'standard', branch: 'Systems', name: 'Signal Compression', description: '-8% ability capacitor cost.', allocationCost: 1, prerequisiteIds: ['systems-1'], sector: 'core', legacyRequires: 'systems-1' },
  { id: 'systems-3', kind: 'notable', branch: 'Systems', name: 'Disruption Relay', description: 'Electronically disrupted targets can be serviced by a relay microdrone.', allocationCost: 1, prerequisiteIds: ['systems-2'], sector: 'outer', legacyMajor: true, legacyRequires: 'systems-2' },

  { id: 'survival-1', kind: 'standard', branch: 'Survival', name: 'Layered Plate', description: '+12 maximum armor.', allocationCost: 1, prerequisiteIds: [], sector: 'core' },
  { id: 'survival-2', kind: 'standard', branch: 'Survival', name: 'Pressure Discipline', description: 'Vacuum exposure builds more slowly.', allocationCost: 1, prerequisiteIds: ['survival-1'], sector: 'core', legacyRequires: 'survival-1' },
  { id: 'survival-3', kind: 'notable', branch: 'Survival', name: 'Hard Vacuum Familiarity', description: 'Greatly reduces vacuum damage and decompression pull.', allocationCost: 1, prerequisiteIds: ['survival-2'], sector: 'outer', legacyMajor: true, legacyRequires: 'survival-2' },

  { id: 'engineering-1', kind: 'standard', branch: 'Engineering', name: 'Thermal Routing', description: '+12% weapon heat dissipation.', allocationCost: 1, prerequisiteIds: [], sector: 'core' },
  { id: 'engineering-2', kind: 'standard', branch: 'Engineering', name: 'Quick Vent', description: 'Manual vent cycles complete faster.', allocationCost: 1, prerequisiteIds: ['engineering-1'], sector: 'core', legacyRequires: 'engineering-1' },
  { id: 'engineering-3', kind: 'notable', branch: 'Engineering', name: 'Dodge Heat Shunt', description: 'Dodging vents weapon heat.', allocationCost: 1, prerequisiteIds: ['engineering-2'], sector: 'outer', legacyMajor: true, legacyRequires: 'engineering-2' },

  { id: 'awareness-1', kind: 'standard', branch: 'Awareness', name: 'Predictive Lead', description: '+8% projectile velocity.', allocationCost: 1, prerequisiteIds: [], sector: 'core' },
  { id: 'awareness-2', kind: 'standard', branch: 'Awareness', name: 'Weak-Path Telemetry', description: 'Marked targets take more armor damage.', allocationCost: 1, prerequisiteIds: ['awareness-1'], sector: 'core', legacyRequires: 'awareness-1' },
  { id: 'awareness-3', kind: 'notable', branch: 'Awareness', name: 'Penetration Optics', description: 'Sensor-marked targets expose penetration paths to all weapons.', allocationCost: 1, prerequisiteIds: ['awareness-2'], sector: 'outer', legacyMajor: true, legacyRequires: 'awareness-2' },
];

export const operatorNetworkNodes: OperatorNetworkNode[] = [
  { id: 'start-vanguard', kind: 'class-start', branch: 'Origin', name: 'Vanguard Origin', description: 'Breach / armor-control entry point.', allocationCost: 0, prerequisiteIds: [], sector: 'origin', classStart: 'vanguard' },
  { id: 'start-vector', kind: 'class-start', branch: 'Origin', name: 'Vector Origin', description: 'Mobility / precision-routing entry point.', allocationCost: 0, prerequisiteIds: [], sector: 'origin', classStart: 'vector' },
  { id: 'start-systems', kind: 'class-start', branch: 'Origin', name: 'Systems Origin', description: 'Capacitor / thermal-network entry point.', allocationCost: 0, prerequisiteIds: [], sector: 'origin', classStart: 'systems' },
  ...legacyNodes,
];

export const operatorNetworkEdges: OperatorNetworkEdge[] = [
  { a: 'start-vanguard', b: 'ballistics-1', route: 'class-start' },
  { a: 'start-vanguard', b: 'survival-1', route: 'class-start' },
  { a: 'start-vector', b: 'mobility-1', route: 'class-start' },
  { a: 'start-vector', b: 'awareness-1', route: 'class-start' },
  { a: 'start-systems', b: 'systems-1', route: 'class-start' },
  { a: 'start-systems', b: 'engineering-1', route: 'class-start' },

  { a: 'ballistics-1', b: 'ballistics-2', route: 'branch' },
  { a: 'ballistics-2', b: 'ballistics-3', route: 'branch' },
  { a: 'mobility-1', b: 'mobility-2', route: 'branch' },
  { a: 'mobility-2', b: 'mobility-3', route: 'branch' },
  { a: 'systems-1', b: 'systems-2', route: 'branch' },
  { a: 'systems-2', b: 'systems-3', route: 'branch' },
  { a: 'survival-1', b: 'survival-2', route: 'branch' },
  { a: 'survival-2', b: 'survival-3', route: 'branch' },
  { a: 'engineering-1', b: 'engineering-2', route: 'branch' },
  { a: 'engineering-2', b: 'engineering-3', route: 'branch' },
  { a: 'awareness-1', b: 'awareness-2', route: 'branch' },
  { a: 'awareness-2', b: 'awareness-3', route: 'branch' },

  { a: 'ballistics-3', b: 'mobility-1', route: 'outer-ring' },
  { a: 'mobility-3', b: 'awareness-1', route: 'outer-ring' },
  { a: 'awareness-3', b: 'systems-1', route: 'outer-ring' },
  { a: 'systems-3', b: 'engineering-1', route: 'outer-ring' },
  { a: 'engineering-3', b: 'survival-1', route: 'outer-ring' },
  { a: 'survival-3', b: 'ballistics-1', route: 'outer-ring' },
];

const nodeById = new Map(operatorNetworkNodes.map(node => [node.id, node]));
const neighborsById = new Map<string, string[]>();
for (const node of operatorNetworkNodes) neighborsById.set(node.id, []);
for (const edge of operatorNetworkEdges) {
  neighborsById.get(edge.a)?.push(edge.b);
  neighborsById.get(edge.b)?.push(edge.a);
}

function normalizedPointCount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function operatorNetworkStartNodeForClass(operatorClass: OperatorClassId) {
  return classStartNodeIds[operatorClass];
}

export function operatorNetworkNode(nodeId: string) {
  return nodeById.get(nodeId);
}

export function isOperatorNetworkNodeId(nodeId: unknown): nodeId is string {
  return typeof nodeId === 'string' && nodeById.has(nodeId);
}

export function operatorNetworkNeighbors(nodeId: string) {
  return [...(neighborsById.get(nodeId) ?? [])];
}

export function createOperatorNetworkState(operatorClass: OperatorClassId, unspentPoints = 0): OperatorNetworkState {
  return {
    schemaVersion: OPERATOR_NETWORK_SCHEMA_VERSION,
    startNodeId: operatorNetworkStartNodeForClass(operatorClass),
    allocatedNodeIds: [],
    unspentPoints: normalizedPointCount(unspentPoints),
  };
}

export function normalizeOperatorNetworkState(input: {
  operatorClass: OperatorClassId;
  level: number;
  state?: Partial<OperatorNetworkState> | null;
  legacyAllocatedNodes?: readonly string[];
  legacyUnspentPoints?: number;
}): OperatorNetworkState {
  const sourceAllocated = input.state?.schemaVersion === OPERATOR_NETWORK_SCHEMA_VERSION && Array.isArray(input.state.allocatedNodeIds)
    ? input.state.allocatedNodeIds
    : input.legacyAllocatedNodes ?? [];
  const allocatedNodeIds = [...new Set(sourceAllocated.filter(id => {
    const node = operatorNetworkNode(id);
    return !!node && node.kind !== 'class-start';
  }))];

  const usedPoints = allocatedNodeIds.reduce((total, id) => total + (operatorNetworkNode(id)?.allocationCost ?? 0), 0);
  const earnedLevelPoints = Math.max(0, Math.floor(input.level) - 1);
  const storedUnspent = input.state?.schemaVersion === OPERATOR_NETWORK_SCHEMA_VERSION
    ? normalizedPointCount(input.state.unspentPoints)
    : normalizedPointCount(input.legacyUnspentPoints);
  const minimumUnspent = Math.max(0, earnedLevelPoints - usedPoints);

  return {
    schemaVersion: OPERATOR_NETWORK_SCHEMA_VERSION,
    startNodeId: operatorNetworkStartNodeForClass(input.operatorClass),
    allocatedNodeIds,
    unspentPoints: Math.max(storedUnspent, minimumUnspent),
  };
}

export function operatorNetworkLegacyMirror(state: OperatorNetworkState) {
  return {
    allocatedNodes: [...state.allocatedNodeIds],
    progressionPoints: state.unspentPoints,
  };
}

export type OperatorNetworkAllocationResult = {
  state: OperatorNetworkState;
  allocated: boolean;
  reason: 'allocated' | 'unknown-node' | 'class-start' | 'already-allocated' | 'insufficient-points' | 'missing-prerequisite' | 'not-connected';
};

export function allocateOperatorNetworkNode(state: OperatorNetworkState, nodeId: string): OperatorNetworkAllocationResult {
  const node = operatorNetworkNode(nodeId);
  if (!node) return { state, allocated: false, reason: 'unknown-node' };
  if (node.kind === 'class-start') return { state, allocated: false, reason: 'class-start' };
  if (state.allocatedNodeIds.includes(nodeId)) return { state, allocated: false, reason: 'already-allocated' };
  if (state.unspentPoints < node.allocationCost) return { state, allocated: false, reason: 'insufficient-points' };

  const allocated = new Set(state.allocatedNodeIds);
  if (node.prerequisiteIds.some(requiredId => !allocated.has(requiredId))) {
    return { state, allocated: false, reason: 'missing-prerequisite' };
  }

  const connectedIds = new Set([state.startNodeId, ...state.allocatedNodeIds]);
  const connected = operatorNetworkNeighbors(nodeId).some(neighborId => connectedIds.has(neighborId));
  if (!connected) return { state, allocated: false, reason: 'not-connected' };

  return {
    allocated: true,
    reason: 'allocated',
    state: {
      ...state,
      allocatedNodeIds: [...state.allocatedNodeIds, nodeId],
      unspentPoints: state.unspentPoints - node.allocationCost,
    },
  };
}

export function operatorNetworkRouteToNode(state: OperatorNetworkState, targetNodeId: string): OperatorNetworkRoute | null {
  const target = operatorNetworkNode(targetNodeId);
  if (!target || target.kind === 'class-start') return null;
  if (state.allocatedNodeIds.includes(targetNodeId)) return { nodeIds: [], pointCost: 0 };

  const allocated = new Set(state.allocatedNodeIds);
  const owned = new Set([state.startNodeId, ...state.allocatedNodeIds]);
  const frontier: Array<{ nodeId: string; path: string[]; cost: number }> = [...owned].map(nodeId => ({ nodeId, path: [], cost: 0 }));
  const bestCost = new Map<string, number>([...owned].map(nodeId => [nodeId, 0]));

  while (frontier.length > 0) {
    frontier.sort((left, right) => left.cost - right.cost || left.path.length - right.path.length);
    const current = frontier.shift()!;

    for (const neighborId of operatorNetworkNeighbors(current.nodeId)) {
      const neighbor = operatorNetworkNode(neighborId);
      if (!neighbor) continue;
      if (neighbor.kind === 'class-start' && neighborId !== state.startNodeId) continue;

      const pathSet = new Set([...allocated, ...current.path]);
      if (neighbor.kind !== 'class-start' && neighbor.prerequisiteIds.some(requiredId => !pathSet.has(requiredId))) continue;

      const alreadyOwned = owned.has(neighborId);
      const alreadyInPath = current.path.includes(neighborId);
      const nextPath = neighbor.kind === 'class-start' || alreadyOwned || alreadyInPath ? current.path : [...current.path, neighborId];
      const nextCost = current.cost + (neighbor.kind === 'class-start' || alreadyOwned || alreadyInPath ? 0 : neighbor.allocationCost);

      if (neighborId === targetNodeId) return { nodeIds: nextPath, pointCost: nextCost };

      const priorCost = bestCost.get(neighborId);
      if (priorCost !== undefined && priorCost <= nextCost) continue;
      bestCost.set(neighborId, nextCost);
      frontier.push({ nodeId: neighborId, path: nextPath, cost: nextCost });
    }
  }

  return null;
}

export const legacyProgressionNodes = legacyNodes.map(node => ({
  id: node.id,
  branch: node.branch as OperatorNetworkBranch,
  name: node.name,
  description: node.description,
  major: node.legacyMajor || undefined,
  requires: node.legacyRequires,
}));
