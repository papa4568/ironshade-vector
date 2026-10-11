import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { BabylonCombatRenderer } from '../src/game/babylonCombatRenderer';
import {
  getBabylonGraphicsAssetRuntime,
  type BabylonGraphicsAssetInstance,
} from '../src/game/babylonGraphicsAssets';
import { REFINERY_ASSET_FAMILIES } from '../src/game/graphicsAssetManifest';
import { selectGraphicsAssetSpec, type GraphicsAssetSpec } from '../src/game/graphicsAssets';
import type { SimState } from '../src/game/sim';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

type RefineryFamilyKey = keyof typeof REFINERY_ASSET_FAMILIES;
type RuntimeProfile = {
  placements: number;
  batches: number;
  peak: number;
  batchSize: number;
  instantiateCalls: number;
  preloadFamilies: number;
  telemetry: string;
};

type HarnessRenderer = {
  scene: Scene;
  canvas: { dataset: Record<string, string> };
  disposed: boolean;
  refineryLoadGeneration: number;
  refineryAssetInstances: BabylonGraphicsAssetInstance[];
  refineryMountRoot: TransformNode | null;
  refineryEnvironmentSignature: string;
  refineryPremiumSurfaceLibrary: null;
  loadRefineryEnvironment: (
    state: SimState,
    worldW: number,
    worldH: number,
    selected: Array<{ key: RefineryFamilyKey; spec: GraphicsAssetSpec }>,
    generation: number,
  ) => Promise<void>;
  releaseRefineryEnvironment: (reason: string) => void;
  applyRefineryPremiumSurfaces: (
    key: RefineryFamilyKey,
    instance: BabylonGraphicsAssetInstance,
    usage: Map<RefineryFamilyKey, Set<string>>,
  ) => void;
  updateSceneTelemetry: () => void;
};

const PREMIUM_BY_KEY: Record<RefineryFamilyKey, readonly string[]> = {
  floor: ['deck-plate', 'bare-metal'],
  floorGrate: ['bare-metal', 'painted-metal'],
  bulkhead: ['painted-metal'],
  processor: ['painted-metal', 'bare-metal', 'emissive-fixture'],
  pipeRack: ['painted-metal', 'bare-metal', 'emissive-fixture'],
  wallPanel: ['bare-metal', 'painted-metal'],
  cableTray: ['painted-metal', 'bare-metal', 'emissive-fixture'],
  serviceConduit: ['painted-metal', 'bare-metal', 'emissive-fixture'],
  gantry: ['painted-metal', 'bare-metal', 'emissive-fixture'],
  crate: ['bare-metal', 'painted-metal', 'polymer-rubber'],
  terminal: ['painted-metal', 'bare-metal', 'emissive-fixture'],
};

function parsePlacementTelemetry(value: string) {
  const fields = new Map(value.split('|').map(part => {
    const index = part.indexOf(':');
    return index >= 0 ? [part.slice(0, index), part.slice(index + 1)] : [part, ''];
  }));
  return {
    strategy: fields.get('strategy') ?? '',
    batchSize: Number(fields.get('batch-size') ?? 0),
    peak: Number(fields.get('peak') ?? 0),
    batches: Number(fields.get('batches') ?? 0),
    placements: Number(fields.get('placements') ?? 0),
  };
}

function buildHarness() {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const dataset: Record<string, string> = { babylonEnvironmentState: 'loading' };
  const renderer = Object.create(BabylonCombatRenderer.prototype) as HarnessRenderer;
  Object.assign(renderer, {
    scene,
    canvas: { dataset },
    disposed: false,
    refineryLoadGeneration: 1,
    refineryAssetInstances: [],
    refineryMountRoot: null,
    refineryEnvironmentSignature: 'runtime-regression',
    refineryPremiumSurfaceLibrary: null,
  });
  renderer.applyRefineryPremiumSurfaces = (key, _instance, usage) => {
    usage.set(key, new Set(PREMIUM_BY_KEY[key]));
  };
  renderer.updateSceneTelemetry = () => undefined;
  return { engine, scene, renderer, dataset };
}

const selected = (Object.keys(REFINERY_ASSET_FAMILIES) as RefineryFamilyKey[]).map(key => {
  const spec = selectGraphicsAssetSpec(REFINERY_ASSET_FAMILIES[key], 1);
  assert(spec, `P28-PLOAD1 runtime regression requires a selected refinery asset for ${key}`);
  return { key, spec };
});
const state = { objects: [] } as unknown as SimState;

async function successfulColdLoadProfile(): Promise<RuntimeProfile> {
  const { engine, scene, renderer, dataset } = buildHarness();
  const runtime = getBabylonGraphicsAssetRuntime(scene);
  let instantiateCalls = 0;
  let inFlight = 0;
  let peakInFlight = 0;
  let preloadFamilies = 0;
  const active = new Set<number>();

  runtime.preload = async specs => {
    preloadFamilies = new Set(specs.map(spec => spec.url)).size;
    return { requested: preloadFamilies, loaded: preloadFamilies, failed: 0, workerCount: 2 };
  };
  runtime.instantiate = async spec => {
    const id = ++instantiateCalls;
    inFlight += 1;
    peakInFlight = Math.max(peakInFlight, inFlight);
    await Promise.resolve();
    inFlight -= 1;
    active.add(id);
    const root = new TransformNode(`p28-pload1-runtime-${id}`, scene);
    let released = false;
    return {
      spec,
      rootNodes: [root],
      animationGroups: [],
      nativeMeshInstances: 1,
      release: () => {
        if (released) return;
        released = true;
        active.delete(id);
        root.dispose();
      },
    };
  };
  runtime.stats = () => ({
    cachedAssets: preloadFamilies,
    activeInstances: active.size,
    activeNativeMeshInstances: active.size,
    estimatedCachedCompressedBytes: 0,
    maxCachedCompressedBytes: 64 * 1024 * 1024,
    maxCachedAssets: 32,
  });

  await renderer.loadRefineryEnvironment(state, 960, 540, selected, 1);
  assert(dataset.babylonEnvironmentState === 'ready', `runtime refinery load must complete, got ${dataset.babylonEnvironmentState}`);
  const telemetry = dataset.babylonEnvironmentPlacementLoad;
  assert(telemetry, 'runtime refinery load must publish placement batching telemetry');
  const parsed = parsePlacementTelemetry(telemetry);
  assert(parsed.strategy === 'bounded-batches', `runtime refinery load must report bounded batches, got ${parsed.strategy}`);
  assert(parsed.batchSize === 4, `runtime refinery load must retain batch size 4, got ${parsed.batchSize}`);
  assert(parsed.placements === instantiateCalls, `runtime placement count ${parsed.placements} must match actual instantiate calls ${instantiateCalls}`);
  assert(parsed.batches === Math.ceil(instantiateCalls / parsed.batchSize), `runtime batch count ${parsed.batches} must scale with batch size instead of one await per placement`);
  assert(peakInFlight === parsed.peak && parsed.peak === parsed.batchSize, `actual peak concurrency ${peakInFlight} must match telemetry ${parsed.peak}`);
  assert(preloadFamilies === selected.length, `runtime preloading must retain one request per selected source family, got ${preloadFamilies}/${selected.length}`);
  assert(active.size === instantiateCalls, 'successful runtime load must retain every mounted placement until teardown');

  const profile = {
    placements: parsed.placements,
    batches: parsed.batches,
    peak: parsed.peak,
    batchSize: parsed.batchSize,
    instantiateCalls,
    preloadFamilies,
    telemetry,
  };
  renderer.releaseRefineryEnvironment('p28-pload1-runtime-profile');
  assert(active.size === 0, 'runtime refinery teardown must release every mounted placement instance');
  scene.dispose();
  engine.dispose();
  return profile;
}

async function failureRecoveryProfile() {
  const { engine, scene, renderer, dataset } = buildHarness();
  const runtime = getBabylonGraphicsAssetRuntime(scene);
  let calls = 0;
  let releases = 0;
  let active = 0;

  runtime.preload = async specs => ({ requested: specs.length, loaded: specs.length, failed: 0, workerCount: 2 });
  runtime.instantiate = async spec => {
    const id = ++calls;
    await Promise.resolve();
    if (id === 6) throw new Error('p28-pload1-injected-placement-failure');
    active += 1;
    const root = new TransformNode(`p28-pload1-failure-${id}`, scene);
    let released = false;
    return {
      spec,
      rootNodes: [root],
      animationGroups: [],
      nativeMeshInstances: 1,
      release: () => {
        if (released) return;
        released = true;
        releases += 1;
        active -= 1;
        root.dispose();
      },
    };
  };
  runtime.stats = () => ({
    cachedAssets: selected.length,
    activeInstances: active,
    activeNativeMeshInstances: active,
    estimatedCachedCompressedBytes: 0,
    maxCachedCompressedBytes: 64 * 1024 * 1024,
    maxCachedAssets: 32,
  });

  await renderer.loadRefineryEnvironment(state, 960, 540, selected, 1);
  assert(dataset.babylonEnvironmentState === 'error', 'runtime placement failure must put refinery load in error state');
  assert(dataset.babylonEnvironmentError === 'p28-pload1-injected-placement-failure', `runtime failure reason must be preserved, got ${dataset.babylonEnvironmentError}`);
  assert(calls === 8, `failure in the second batch must stop after its bounded in-flight work, got ${calls} instantiate calls`);
  assert(active === 0, 'runtime placement failure must release fulfilled current-batch and previously mounted instances');
  assert(releases === 7, `runtime placement failure must release all seven fulfilled instances around one rejection, got ${releases}`);
  assert(renderer.refineryAssetInstances.length === 0 && renderer.refineryMountRoot === null, 'failed runtime load must not publish partial refinery ownership');
  scene.dispose();
  engine.dispose();
}

async function cancellationRecoveryProfile() {
  const { engine, scene, renderer, dataset } = buildHarness();
  const runtime = getBabylonGraphicsAssetRuntime(scene);
  let calls = 0;
  let releases = 0;
  let active = 0;
  let cancelled = false;

  runtime.preload = async specs => ({ requested: specs.length, loaded: specs.length, failed: 0, workerCount: 2 });
  runtime.instantiate = async spec => {
    const id = ++calls;
    active += 1;
    const root = new TransformNode(`p28-pload1-cancel-${id}`, scene);
    await Promise.resolve();
    if (id === 6 && !cancelled) {
      cancelled = true;
      renderer.releaseRefineryEnvironment('p28-pload1-runtime-cancel');
    }
    let released = false;
    return {
      spec,
      rootNodes: [root],
      animationGroups: [],
      nativeMeshInstances: 1,
      release: () => {
        if (released) return;
        released = true;
        releases += 1;
        active -= 1;
        root.dispose();
      },
    };
  };
  runtime.stats = () => ({
    cachedAssets: selected.length,
    activeInstances: active,
    activeNativeMeshInstances: active,
    estimatedCachedCompressedBytes: 0,
    maxCachedCompressedBytes: 64 * 1024 * 1024,
    maxCachedAssets: 32,
  });

  await renderer.loadRefineryEnvironment(state, 960, 540, selected, 1);
  assert(cancelled, 'runtime cancellation regression must exercise releaseRefineryEnvironment during an in-flight batch');
  assert(calls === 8, `cancellation in the second batch must stop after its bounded in-flight work, got ${calls} instantiate calls`);
  assert(active === 0, 'runtime cancellation must release fulfilled current-batch and previously mounted instances');
  assert(releases === calls, `runtime cancellation must release all ${calls} fulfilled in-flight/mounted instances, got ${releases}`);
  assert(dataset.babylonEnvironmentState === 'released', `runtime cancellation must retain released state, got ${dataset.babylonEnvironmentState}`);
  assert(renderer.refineryAssetInstances.length === 0 && renderer.refineryMountRoot === null, 'cancelled runtime load must not publish partial refinery ownership');
  scene.dispose();
  engine.dispose();
}

async function run() {
  const coldA = await successfulColdLoadProfile();
  const coldB = await successfulColdLoadProfile();
  assert(JSON.stringify(coldA) === JSON.stringify(coldB), `deterministic cold-load placement profiles must match across runs: ${JSON.stringify(coldA)} vs ${JSON.stringify(coldB)}`);
  assert(coldA.placements > coldA.batchSize, 'cold-load runtime profile must exercise the full multi-batch refinery placement count');
  await failureRecoveryProfile();
  await cancellationRecoveryProfile();

  console.log(
    `P28_PLOAD1_RUNTIME_PROFILE_PASS placements=${coldA.placements} batches=${coldA.batches} batchSize=${coldA.batchSize} peak=${coldA.peak} sourceFamilies=${coldA.preloadFamilies} failureRecovery=fulfilled+mounted-release cancellation=releaseRefineryEnvironment deterministicRuns=2`,
  );
}

run().catch(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
