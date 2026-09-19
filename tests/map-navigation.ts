import { createDefaultCampaign, deepTargetForLocation, locationNameFor, missionObjectiveFor, type Contract, type LocationId, type ObjectiveMode } from '../src/game/campaign';
import { applyMissionSetup } from '../src/game/director';
import { auditNavigation, getMapNavigationPlan } from '../src/game/mapNavigation';
import { findNavigationPath } from '../src/game/mapPathfinding';
import { createSimulation, neutralCombatBuild, type CombatObject } from '../src/game/sim';

const locations: LocationId[] = ['orbital-station', 'damaged-vessel', 'asteroid-refinery', 'spin-habitat', 'jovian-harvester', 'ice-mine', 'solar-yard', 'lattice-annex', 'momentum-exchange', 'cryo-reserve', 'parallax-array'];

function modeFor(location: LocationId): ObjectiveMode {
  if (location === 'momentum-exchange') return 'momentum-capture';
  if (location === 'cryo-reserve') return 'thermal-routing';
  if (location === 'parallax-array') return 'reference-alignment';
  if (location === 'damaged-vessel' || location === 'jovian-harvester') return 'pressure-recovery';
  if (location === 'spin-habitat' || location === 'ice-mine') return 'gravity-stabilization';
  if (location === 'solar-yard' || location === 'lattice-annex') return 'grid-isolation';
  return 'deep-salvage';
}

function contractFor(location: LocationId, index: number): Contract {
  const mode = modeFor(location);
  const objective = missionObjectiveFor(mode, location);
  return {
    id: `map-audit-${location}`,
    sponsor: 'longarc',
    archetype: 'salvage',
    location,
    locationName: locationNameFor(location),
    title: `Navigation audit ${location}`,
    objective: objective.objective,
    objectiveMode: mode,
    objectiveSteps: objective.steps,
    briefing: 'Automated map navigation audit.',
    conditions: [],
    conditionLabels: [],
    directorPreview: '',
    deepTarget: deepTargetForLocation(location),
    rewardBase: { credits: 100 },
    reputationGain: 1,
    priority: false,
    anomalyOpportunity: false,
    seed: 9000 + index,
  };
}

function objectiveIds(mode: ObjectiveMode) {
  if (mode === 'pressure-recovery') return ['service-seal'];
  if (mode === 'grid-isolation') return ['grid-isolator-a', 'grid-isolator-b'];
  if (mode === 'gravity-stabilization') return ['gravity-control-a', 'gravity-control-b'];
  if (mode === 'machinery-recovery') return ['salvage-node-a', 'salvage-node-b'];
  if (mode === 'emergency-boarding') return ['door-control', 'boarding-lock'];
  if (mode === 'momentum-capture') return ['capture-drum-a', 'capture-drum-b'];
  if (mode === 'thermal-routing') return ['purge-valve-a', 'purge-valve-b'];
  if (mode === 'reference-alignment') return ['reference-node-a', 'reference-node-b', 'reference-node-c'];
  return ['salvage-node-a', 'salvage-node-b', 'salvage-node-c'];
}

const campaign = createDefaultCampaign();
if (campaign.resources.credits <= 0) throw new Error('Campaign baseline unavailable for map audit.');

let lowestReachableRatio = 1;
let totalObjectives = 0;
for (let index = 0; index < locations.length; index += 1) {
  const location = locations[index];
  const contract = contractFor(location, index);
  const state = createSimulation(neutralCombatBuild);
  applyMissionSetup(state, contract);
  const objectives = objectiveIds(contract.objectiveMode)
    .map(id => state.objects.find(object => object.id === id))
    .filter((object): object is CombatObject => !!object && object.active);
  if (objectives.length === 0) throw new Error(`${location}: no active objective objects found`);
  const audit = auditNavigation(state, objectives);
  if (!audit.reachable) throw new Error(`${location}: ${audit.reachableObjectives}/${audit.objectiveCount} objectives reachable`);
  if (audit.reachableRatio < 0.72) throw new Error(`${location}: only ${(audit.reachableRatio * 100).toFixed(1)}% of walkable cells connect to spawn`);
  const plan = getMapNavigationPlan(location);
  if (plan.routes.length < 7 || plan.landmarks.length !== 3) throw new Error(`${location}: wayfinding plan incomplete`);
  for (const objective of objectives) {
    const path = findNavigationPath(state, objective);
    if (!path.complete || path.points.length < 2) throw new Error(location + ': no obstacle-aware route to ' + objective.id);
  }
  const hostile = state.enemies.find(enemy => enemy.role !== 'boss' && enemy.active && !enemy.dead);
  if (hostile) {
    const hostilePath = findNavigationPath(state, { x: hostile.x, y: hostile.y });
    if (!hostilePath.complete || hostilePath.points.length < 2) throw new Error(location + ': no obstacle-aware route to active hostile');
  }
  lowestReachableRatio = Math.min(lowestReachableRatio, audit.reachableRatio);
  totalObjectives += objectives.length;
}

console.log(`MAP_NAVIGATION_PASS locations=${locations.length} objectives=${totalObjectives} minimumReachable=${(lowestReachableRatio * 100).toFixed(1)}%`);
