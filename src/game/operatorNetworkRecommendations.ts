import { operatorWeaponFamilyForClass, type OperatorClassId } from './classSkills';
import {
  operatorNetworkNode,
  operatorNetworkPlan,
  operatorNetworkRouteToNode,
  operatorNetworkStartNodeForClass,
  type OperatorNetworkState,
  type OperatorNetworkUnlockContext,
} from './operatorNetwork';
import type { SpecializationId } from './sim';

export type OperatorNetworkRecommendationStage = 'early' | 'core' | 'specialization';

export type OperatorNetworkRecommendationDefinition = {
  id: string;
  operatorClass: OperatorClassId;
  stage: OperatorNetworkRecommendationStage;
  name: string;
  loop: string;
  rationale: string;
  targetNodeIds: readonly string[];
  specialization?: SpecializationId;
};

export type OperatorNetworkRecommendation = OperatorNetworkRecommendationDefinition & {
  remainingTargetNodeIds: string[];
  routeNodeIds: string[];
  pointCost: number;
  complete: boolean;
};

const classRecommendations: OperatorNetworkRecommendationDefinition[] = [
  {
    id: 'vanguard-breach-guard-early',
    operatorClass: 'vanguard',
    stage: 'early',
    name: 'Breach Guard Line',
    loop: 'Breach Rush → Fracture Tag → Breacher break → Bulwark Pulse / Guard.',
    rationale: 'Breacher pressure and armor break feed Breach Guard while early Survival nodes keep the close-range loop stable.',
    targetNodeIds: ['vanguard-breach-telemetry', 'survival-2'],
  },
  {
    id: 'vanguard-breach-guard-core',
    operatorClass: 'vanguard',
    stage: 'core',
    name: 'Breach Economy Bulwark',
    loop: 'Open armor with the Breacher, extend Guard on breaks, then hold the lane with Bulwark Pulse.',
    rationale: 'Breacher telemetry, Breach Economy, and Survival mastery concentrate armor pressure without leaving Vanguard’s locked arsenal.',
    targetNodeIds: ['vanguard-breach-telemetry', 'ballistics-breach-economy-keystone', 'survival-shell-mastery'],
  },
  {
    id: 'vector-slipstream-early',
    operatorClass: 'vector',
    stage: 'early',
    name: 'Slipstream Firing Line',
    loop: 'Vector Shift or dodge → Deadeye Lock → stabilized Rail shot / Splitshot.',
    rationale: 'Rail velocity, recoil, penetration, and skill range pair with Mobility routing so Slipstream creates cleaner firing angles.',
    targetNodeIds: ['vector-rail-solution', 'mobility-3'],
  },
  {
    id: 'vector-slipstream-core',
    operatorClass: 'vector',
    stage: 'core',
    name: 'Perfect Rail Solution',
    loop: 'Reposition for Slipstream, lock a priority target, then spend the precision window on the Rail Lance.',
    rationale: 'Rail Solution, Perfect Solution, and Mobility mastery deepen long-range precision and movement control while accepting slower reloads.',
    targetNodeIds: ['vector-rail-solution', 'awareness-perfect-solution-keystone', 'mobility-inertial-mastery'],
  },
  {
    id: 'systems-closed-loop-early',
    operatorClass: 'systems',
    stage: 'early',
    name: 'Closed Loop Starter',
    loop: 'Polarity Well → Relay Hack → Cascade Arc → recycle the next Systems skill.',
    rationale: 'Carbine cycle support and the Systems spine improve capacitor economy, disruption, and skill recovery for repeated Closed Loop chains.',
    targetNodeIds: ['systems-carbine-loop', 'systems-3'],
  },
  {
    id: 'systems-closed-loop-core',
    operatorClass: 'systems',
    stage: 'core',
    name: 'Closed Bus Authority',
    loop: 'Group, hack, arc, then use the recovered bus window to restart the Carbine / ability cycle.',
    rationale: 'Carbine Loop, Open Bus, and Engineering mastery prioritize capacitor efficiency, recovery, and thermal control for sustained Closed Loop play.',
    targetNodeIds: ['systems-carbine-loop', 'systems-open-bus-keystone', 'engineering-service-mastery'],
  },
];

const specializationRecommendations: OperatorNetworkRecommendationDefinition[] = [
  {
    id: 'pressure-diver-refinement',
    operatorClass: 'vanguard',
    stage: 'specialization',
    specialization: 'pressure-diver',
    name: 'Pressure Diver Recirculation',
    loop: 'Breach Rush through low pressure, shed exposure with skills, then keep Guard pressure on the lane.',
    rationale: 'Abyssal Recirculation adds pressure resistance and class-skill recovery only after the Diver milestones and Khepri unlock are active.',
    targetNodeIds: ['pressure-diver-network-hook'],
  },
  {
    id: 'breach-vanguard-refinement',
    operatorClass: 'vanguard',
    stage: 'specialization',
    specialization: 'breach-vanguard',
    name: 'Custody Breach Refinement',
    loop: 'Stay inside Breacher range, break armor quickly, and convert those breaks into stagger and Guard uptime.',
    rationale: 'Custody Breach Doctrine adds Breacher armor damage and penetration only after the authored Dead Reckoning unlock applies.',
    targetNodeIds: ['breach-vanguard-network-hook'],
  },
  {
    id: 'bulkhead-warden-refinement',
    operatorClass: 'vanguard',
    stage: 'specialization',
    specialization: 'bulkhead-warden',
    name: 'Counterfort Refinement',
    loop: 'Absorb impacts under Breach Guard, recycle Bulwark Pulse, and repair armor in the crowd.',
    rationale: 'Meridian Counterfort reinforces armor and Guard recovery only after the Warden milestones and Meridian reputation gate apply.',
    targetNodeIds: ['bulkhead-warden-network-hook'],
  },
  {
    id: 'momentum-broker-refinement',
    operatorClass: 'vector',
    stage: 'specialization',
    specialization: 'momentum-broker',
    name: 'Reaction Ledger Refinement',
    loop: 'Bank recoil as capacitor, spend Slipstream on a clean Rail angle, then convert the bank into more movement.',
    rationale: 'ORO-7 Reaction Ledger adds mobility and capacitor recovery only after the Broker milestones and ORO-7 unlock are active.',
    targetNodeIds: ['momentum-broker-network-hook'],
  },
  {
    id: 'survey-deadeye-refinement',
    operatorClass: 'vector',
    stage: 'specialization',
    specialization: 'survey-deadeye',
    name: 'Reference Solution Refinement',
    loop: 'Deadeye Lock → Rail precision break → re-prime Slipstream for the follow-through.',
    rationale: 'Interdiction Reference Solution adds Rail penetration and class-skill range only after the survey milestones and Interdiction unlock apply.',
    targetNodeIds: ['survey-deadeye-network-hook'],
  },
  {
    id: 'redline-pilot-refinement',
    operatorClass: 'vector',
    stage: 'specialization',
    specialization: 'redline-pilot',
    name: 'Thermal Slip Refinement',
    loop: 'Run the Rail hot, dodge into Slipstream, then spend the high-heat precision shot before venting.',
    rationale: 'Long Arc Thermal Slip improves mobility and cooling only after the Pilot milestones and Long Arc reputation gate apply.',
    targetNodeIds: ['redline-pilot-network-hook'],
  },
  {
    id: 'grid-weaver-refinement',
    operatorClass: 'systems',
    stage: 'specialization',
    specialization: 'grid-weaver',
    name: 'Custody Mesh Refinement',
    loop: 'Polarity Well groups the mesh, Relay Hack paints it, and Cascade Arc routes control through machinery.',
    rationale: 'Teth Custody Mesh adds Systems power and control only after the Weaver milestones and Teth command-target unlock are active.',
    targetNodeIds: ['grid-weaver-network-hook'],
  },
  {
    id: 'capacitor-conductor-refinement',
    operatorClass: 'systems',
    stage: 'specialization',
    specialization: 'capacitor-conductor',
    name: 'Bus Harmonics Refinement',
    loop: 'Cast three different Systems skills in sequence, recover capacitor, then restart Closed Loop faster.',
    rationale: 'Parallax Bus Harmonics expands capacitor headroom and reduces class-skill cost only after the Conductor milestones and Parallax Debt unlock apply.',
    targetNodeIds: ['capacitor-conductor-network-hook'],
  },
  {
    id: 'thermal-shunter-refinement',
    operatorClass: 'systems',
    stage: 'specialization',
    specialization: 'thermal-shunter',
    name: 'Heat Exchange Refinement',
    loop: 'Warm the Carbine, cast a Systems skill, then spend the crossfed shot and recycle the bus.',
    rationale: 'Heliostat Heat Exchange deepens heat dissipation and venting only after the Shunter milestones and Heliostat reputation gate apply.',
    targetNodeIds: ['thermal-shunter-network-hook'],
  },
];

export const operatorNetworkRecommendationDefinitions: readonly OperatorNetworkRecommendationDefinition[] = [
  ...classRecommendations,
  ...specializationRecommendations,
];

export function operatorNetworkRecommendations(
  state: OperatorNetworkState,
  operatorClass: OperatorClassId,
  context: OperatorNetworkUnlockContext,
): OperatorNetworkRecommendation[] {
  if (state.startNodeId !== operatorNetworkStartNodeForClass(operatorClass)) return [];

  const ownedWeaponFamily = operatorWeaponFamilyForClass(operatorClass);
  const recommendations: OperatorNetworkRecommendation[] = [];

  for (const definition of operatorNetworkRecommendationDefinitions) {
    if (definition.operatorClass !== operatorClass) continue;
    if (definition.specialization && definition.specialization !== context.specialization) continue;

    const remainingTargetNodeIds = definition.targetNodeIds.filter(id => !state.allocatedNodeIds.includes(id));
    const routes = remainingTargetNodeIds.map(id => operatorNetworkRouteToNode(state, id, context));
    if (routes.some(route => route === null)) continue;

    const plan = operatorNetworkPlan(state, remainingTargetNodeIds, context);
    if (plan.unresolvedTargetIds.length > 0) continue;

    const routeIsClassLegal = [...remainingTargetNodeIds, ...plan.nodeIds].every(id => {
      const node = operatorNetworkNode(id);
      return !!node && (!node.weaponFamily || node.weaponFamily === ownedWeaponFamily);
    });
    if (!routeIsClassLegal) continue;

    recommendations.push({
      ...definition,
      remainingTargetNodeIds,
      routeNodeIds: plan.nodeIds,
      pointCost: plan.pointCost,
      complete: remainingTargetNodeIds.length === 0,
    });
  }

  return recommendations;
}
