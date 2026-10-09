import { performance } from 'node:perf_hooks';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { createDefaultCampaign, generateContracts } from '../src/game/campaign';
import { applyMissionSetup, createDirector, stepMissionDirector } from '../src/game/director';
import { OPERATOR_ASSET_FAMILY } from '../src/game/graphicsAssetManifest';
import { selectGraphicsAssetSpec } from '../src/game/graphicsAssets';
import {
  BabylonGraphicsAssetRuntime,
  configureBabylonGraphicsDecoders,
  type BabylonGraphicsAssetContainerLoader,
} from '../src/game/babylonGraphicsAssets';
import { AdaptiveRenderBudget } from '../src/game/renderQuality';
import { createSimulation, stepSimulation } from '../src/game/sim';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function capture() {
  const simulationState = createSimulation();
  for (let index = 0; index < 120; index += 1) stepSimulation(simulationState, 1 / 60);

  const contract = generateContracts(createDefaultCampaign())[0];
  assert(contract, 'behavioral genome route requires a deterministic representative contract');
  const missionState = createSimulation();
  const director = createDirector();
  applyMissionSetup(missionState, contract);
  for (let index = 0; index < 40; index += 1) stepMissionDirector(missionState, director, contract, 0.25);

  const budget = new AdaptiveRenderBudget(false);
  const high = budget.sample(16.7, 1);
  let pressure = high;
  for (let index = 0; index < 40; index += 1) pressure = budget.sample(160, 1);
  assert(pressure.runtimeTierName === 'performance', 'representative pressure route must reach the Performance band');

  const selectedAsset = selectGraphicsAssetSpec(OPERATOR_ASSET_FAMILY, pressure.detailScale);
  assert(selectedAsset, 'representative pressure route must select an operator asset');

  configureBabylonGraphicsDecoders();
  await import('../src/game/babylonGltfLoader');
  const engine = new NullEngine();
  const scene = new Scene(engine);
  let loadCount = 0;
  const loadContainer: BabylonGraphicsAssetContainerLoader = async (spec, targetScene) => {
    loadCount += 1;
    const path = resolve(process.cwd(), 'public', spec.url.replace(/^\/+/, ''));
    const data = await readFile(path);
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    return LoadAssetContainerAsync(bytes, targetScene, { pluginExtension: '.glb', name: spec.id });
  };

  const runtime = new BabylonGraphicsAssetRuntime(scene, loadContainer);
  const loadStartedAt = performance.now();
  const first = await runtime.instantiate(selectedAsset);
  const second = await runtime.instantiate(selectedAsset);
  const loadDurationMs = performance.now() - loadStartedAt;
  const peakStats = runtime.stats();
  const firstReady = first.rootNodes.length > 0;
  const secondReady = second.rootNodes.length > 0;
  first.release();
  const afterOneRelease = runtime.stats();
  second.release();
  const afterAllRelease = runtime.stats();
  await runtime.dispose();
  scene.dispose();
  engine.dispose();

  const observations = {
    schema: 'ironshade-behavior-observations:v1',
    route: 'ev3-representative-route-v1',
    domains: {
      simulation: {
        time: simulationState.time,
        player: {
          x: simulationState.player.x,
          y: simulationState.player.y,
          hp: simulationState.player.hp,
          armor: simulationState.player.armor,
          capacitor: simulationState.player.capacitor,
          currentWeapon: simulationState.player.currentWeapon,
        },
        activeEnemies: simulationState.enemies.filter(enemy => enemy.active && !enemy.dead).length,
        activeHazards: simulationState.hazards.filter(hazard => hazard.active).length,
        telemetry: {
          kills: simulationState.telemetry.kills,
          damageDealt: simulationState.telemetry.damageDealt,
          damageTaken: simulationState.telemetry.damageTaken,
        },
      },
      mission: {
        contract: {
          location: contract.location,
          objectiveMode: contract.objectiveMode,
          seed: contract.seed,
          conditions: [...contract.conditions],
        },
        elapsed: director.elapsed,
        deepElapsed: director.deepElapsed,
        deep: director.deep,
        reinforcementsReleased: director.reinforcementsReleased,
        gridTriggered: director.gridTriggered,
        pressureTriggered: director.pressureTriggered,
        gravityTriggered: director.gravityTriggered,
        environmentalActive: director.environmental.active,
        eventText: missionState.eventText,
      },
      presentation: {
        high: {
          tierName: high.runtimeTierName,
          pixelRatioScale: high.pixelRatioScale,
          detailScale: high.detailScale,
          shadows: high.shadows,
        },
        pressure: {
          tierName: pressure.runtimeTierName,
          pixelRatioScale: pressure.pixelRatioScale,
          detailScale: pressure.detailScale,
          shadows: pressure.shadows,
        },
        selectedAsset: { id: selectedAsset.id, lod: selectedAsset.lod },
      },
      load: {
        selectedAssetId: selectedAsset.id,
        selectedLod: selectedAsset.lod,
        loadCount,
        firstReady,
        secondReady,
        cachedAssets: peakStats.cachedAssets,
        loadDurationMs,
      },
      resources: {
        peakActiveInstances: peakStats.activeInstances,
        peakNativeMeshInstances: peakStats.activeNativeMeshInstances,
        activeAfterOneRelease: afterOneRelease.activeInstances,
        activeAfterAllRelease: afterAllRelease.activeInstances,
        nativeAfterAllRelease: afterAllRelease.activeNativeMeshInstances,
        cachedCompressedBytes: peakStats.estimatedCachedCompressedBytes,
      },
      performance: {
        high: {
          rawFrameMs: high.rawFrameMs,
          smoothedFrameMs: high.smoothedFrameMs,
          tier: high.runtimeTierName,
          transition: high.lastTierTransition,
          transitionCount: high.tierTransitionCount,
        },
        pressure: {
          rawFrameMs: pressure.rawFrameMs,
          smoothedFrameMs: pressure.smoothedFrameMs,
          tier: pressure.runtimeTierName,
          transition: pressure.lastTierTransition,
          transitionCount: pressure.tierTransitionCount,
        },
      },
    },
  };

  const output = process.env.BEHAVIORAL_GENOME_OUTPUT ?? '.agent-genome/observations.json';
  const absolute = resolve(output);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, `${JSON.stringify(observations, null, 2)}\n`, 'utf8');
  console.log(`BEHAVIORAL_GENOME_ROUTE_PASS route=${observations.route} asset=${selectedAsset.id} loads=${loadCount} activePeak=${peakStats.activeInstances} tier=${pressure.runtimeTierName}`);
}

capture().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
