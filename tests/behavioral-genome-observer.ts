import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AssetContainer } from '@babylonjs/core/assetContainer';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { createDefaultCampaign, generateContracts, missionObjectiveFor } from '../src/game/campaign';
import { resolveCombatGraphicsPathSelection } from '../src/game/combatGraphicsBackend';
import { createMissionVisualFrameGate } from '../src/game/missionVisualReadinessGate';
import { AdaptiveRenderBudget } from '../src/game/renderQuality';
import { createSimulation, stepSimulation } from '../src/game/sim';
import { BabylonGraphicsAssetRuntime, type BabylonGraphicsAssetContainerLoader } from '../src/game/babylonGraphicsAssets';
import { OPERATOR_ASSET_FAMILY } from '../src/game/graphicsAssetManifest';
import { selectGraphicsAssetSpec } from '../src/game/graphicsAssets';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function observeSimulation() {
  const state = createSimulation();
  for (let frame = 0; frame < 120; frame += 1) stepSimulation(state, 1 / 60);
  const activeEnemies = state.enemies.filter(enemy => enemy.active && !enemy.dead);
  return {
    time: state.time,
    player: {
      hp: state.player.hp,
      armor: state.player.armor,
      x: state.player.x,
      y: state.player.y,
      weapon: state.player.currentWeapon,
    },
    activeEnemyCount: activeEnemies.length,
    enemyRoles: activeEnemies.map(enemy => enemy.role),
    hazards: state.hazards.filter(hazard => hazard.active).map(hazard => hazard.kind).sort(),
    trace: state.telemetry.trace.slice(0, 3),
    bossActive: state.bossActive,
  };
}

function observeMissionProgression() {
  const campaign = createDefaultCampaign();
  const contracts = generateContracts(campaign);
  assert(contracts.length >= 3, 'behavioral genome route requires at least three deterministic campaign contracts');
  return {
    contractCount: contracts.length,
    openingContracts: contracts.slice(0, 3).map(contract => ({
      seed: contract.seed,
      location: contract.location,
      objectiveMode: contract.objectiveMode,
      objective: missionObjectiveFor(contract),
      operationTier: contract.operationTier,
      deepTarget: contract.deepTarget,
      standardRepeatable: contract.standardRepeatable,
    })),
  };
}

function observeRendererState() {
  const production = resolveCombatGraphicsPathSelection('');
  const qaWebGpu = resolveCombatGraphicsPathSelection('?graphicsCompare=1&graphicsPath=babylon&babylonBackend=webgpu');
  return {
    production: {
      mode: production.mode,
      selectedId: production.selectedId,
      requestedBackend: production.babylonBackendRequested,
    },
    qaWebGpu: {
      mode: qaWebGpu.mode,
      selectedId: qaWebGpu.selectedId,
      requestedBackend: qaWebGpu.babylonBackendRequested,
    },
  };
}

function observeAssetLoadReadiness() {
  const gate = createMissionVisualFrameGate({} as HTMLCanvasElement);
  const initial = gate.status;
  gate.block('authored-assets');
  const authored = gate.status;
  gate.setDetail('route-transition');
  const transition = gate.status;
  gate.release();
  const released = gate.status;
  gate.dispose();
  const operatorHigh = selectGraphicsAssetSpec(OPERATOR_ASSET_FAMILY, 1);
  const operatorPerformance = selectGraphicsAssetSpec(OPERATOR_ASSET_FAMILY, 0.5);
  return {
    gate: { initial, authored, transition, released },
    operatorLods: {
      high: operatorHigh?.lod ?? null,
      performance: operatorPerformance?.lod ?? null,
    },
  };
}

async function observeResourceOwnership() {
  const spec = selectGraphicsAssetSpec(OPERATOR_ASSET_FAMILY, 0.72);
  assert(spec, 'behavioral genome resource route requires the operator asset spec');
  const engine = new NullEngine();
  const scene = new Scene(engine);
  let loads = 0;
  let disposals = 0;
  const loadContainer: BabylonGraphicsAssetContainerLoader = async (_spec, targetScene) => {
    loads += 1;
    const container = new AssetContainer(targetScene);
    const root = new TransformNode(`ev3-root-${loads}`, targetScene);
    const mesh = MeshBuilder.CreateBox(`ev3-box-${loads}`, { size: 1 }, targetScene);
    mesh.parent = root;
    container.rootNodes.push(root);
    container.meshes.push(mesh);
    const originalDispose = container.dispose.bind(container);
    container.dispose = () => {
      disposals += 1;
      originalDispose();
    };
    return container;
  };
  const runtime = new BabylonGraphicsAssetRuntime(scene, loadContainer);
  const first = await runtime.instantiate(spec);
  const second = await runtime.instantiate(spec);
  const during = runtime.stats();
  first.release();
  const afterFirstRelease = runtime.stats();
  second.release();
  const afterAllRelease = runtime.stats();
  await runtime.dispose();
  scene.dispose();
  engine.dispose();
  return {
    loads,
    during: {
      cachedAssets: during.cachedAssets,
      activeInstances: during.activeInstances,
      activeNativeMeshInstances: during.activeNativeMeshInstances,
    },
    afterFirstRelease: {
      cachedAssets: afterFirstRelease.cachedAssets,
      activeInstances: afterFirstRelease.activeInstances,
    },
    afterAllRelease: {
      cachedAssets: afterAllRelease.cachedAssets,
      activeInstances: afterAllRelease.activeInstances,
    },
    disposals,
  };
}

function observePerformanceBands() {
  const budget = new AdaptiveRenderBudget(false);
  const start = budget.sample(16.7, 1, 'adaptive');
  let pressure = start;
  let pressureSamples = 0;
  while (pressureSamples < 60 && pressure.runtimeTierName !== 'performance') {
    pressure = budget.sample(160, 1, 'adaptive');
    pressureSamples += 1;
  }
  let recovery = pressure;
  for (let frame = 0; frame < 700; frame += 1) recovery = budget.sample(16.4, 1, 'adaptive');
  return {
    start: {
      tier: start.runtimeTierName,
      detailScale: start.detailScale,
      pixelRatioScale: start.pixelRatioScale,
    },
    pressure: {
      tier: pressure.runtimeTierName,
      samples: pressureSamples,
      transition: pressure.lastTierTransition,
      transitionCount: pressure.tierTransitionCount,
      detailScale: pressure.detailScale,
      pixelRatioScale: pressure.pixelRatioScale,
    },
    recovery: {
      tier: recovery.runtimeTierName,
      transition: recovery.lastTierTransition,
      transitionCount: recovery.tierTransitionCount,
      detailScale: recovery.detailScale,
      pixelRatioScale: recovery.pixelRatioScale,
    },
  };
}

async function main() {
  const output = resolve(process.env.BEHAVIORAL_GENOME_OBSERVATIONS ?? '.behavioral-genome/observations.json');
  const document = {
    schema: 'ironshade-behavior-observations:v1',
    routeId: 'ev3-core-route-v1',
    excludedObservations: [
      { path: 'rendererState.wallClockMs', reason: 'host scheduling and wall-clock timing are nondeterministic; tier semantics are observed instead' },
      { path: 'resourceOwnership.engineFrameTiming', reason: 'NullEngine timing is runner noise; cache/instance ownership is deterministic' },
    ],
    domains: {
      simulation: observeSimulation(),
      missionProgression: observeMissionProgression(),
      rendererState: observeRendererState(),
      assetLoadReadiness: observeAssetLoadReadiness(),
      resourceOwnership: await observeResourceOwnership(),
      performanceBands: observePerformanceBands(),
    },
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  console.log(`BEHAVIORAL_GENOME_OBSERVER_PASS route=${document.routeId} domains=${Object.keys(document.domains).length} output=${output}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
