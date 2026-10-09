import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type {
  CombatGraphicsBackend,
  CombatGraphicsPerformanceStats,
  CombatGraphicsPointerDirection,
  CombatGraphicsPointerProjectionArgs,
  CombatGraphicsRenderArgs,
  MissionVisualReadiness,
} from './combatGraphicsBackend';
import { refineryWorldObjectFamilyKey } from './refineryWorldObjectAssets';
import { getWorldSize, type CombatObject, type SimState } from './sim';

const WORLD_SCALE = 0.02;
export const MISSION_VISUAL_FALLBACK_TIMEOUT_MS = 8_000;

type ReadinessInput = {
  refinery: boolean;
  elapsedMs: number;
  environmentState: string | undefined;
  environmentError: string | undefined;
  worldState: string | undefined;
  mappedCount: number;
  authoredCount: number;
  fallbackCount: number;
};

type SceneBackedBackend = CombatGraphicsBackend & { scene?: Scene };

type GuardVisuals = {
  root: TransformNode;
  material: StandardMaterial;
  meshes: Mesh[];
  missionKey: string;
};

function datasetCount(value: string | undefined) {
  const parsed = Number.parseInt(value ?? '0', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function resolveMissionVisualReadiness(input: ReadinessInput): Pick<MissionVisualReadiness, 'phase' | 'mode' | 'shell' | 'world' | 'reason'> {
  const timedOut = input.elapsedMs >= MISSION_VISUAL_FALLBACK_TIMEOUT_MS;
  if (!input.refinery) {
    const ready = input.worldState === 'ready';
    return ready
      ? { phase: 'ready', mode: 'authored', shell: 'authored', world: 'authored', reason: null }
      : timedOut
        ? { phase: 'ready', mode: 'fallback', shell: 'fallback', world: 'fallback', reason: 'readiness-timeout' }
        : { phase: 'loading', mode: 'authored', shell: 'loading', world: 'loading', reason: null };
  }

  const shell = input.environmentState === 'ready'
    ? 'authored'
    : input.environmentState === 'error' || timedOut
      ? 'fallback'
      : 'loading';
  const mappedSettled = input.mappedCount === 0 || input.authoredCount + input.fallbackCount >= input.mappedCount;
  const world = mappedSettled
    ? input.fallbackCount > 0 ? 'fallback' : 'authored'
    : timedOut
      ? 'fallback'
      : 'loading';
  const phase = shell !== 'loading' && world !== 'loading' ? 'ready' : 'loading';
  const mode = shell === 'fallback' || world === 'fallback' ? 'fallback' : 'authored';
  const reason = input.environmentState === 'error'
    ? input.environmentError || 'environment-load-failed'
    : timedOut && phase === 'ready' && mode === 'fallback'
      ? 'readiness-timeout'
      : null;
  return { phase, mode, shell, world, reason };
}

function objectHeight(object: CombatObject) {
  if (object.kind === 'doorControl'
    || object.kind === 'gravityControl'
    || object.kind === 'sealControl'
    || object.kind === 'powerControl'
    || object.kind === 'salvageNode') return 0.72;
  return object.kind === 'cover' ? 1.24 : 1.02;
}

export class BabylonMissionVisualReadinessBackend implements CombatGraphicsBackend {
  private missionKey = '';
  private generation = 0;
  private generationStartedAt = 0;
  private framesInGeneration = 0;
  private guardVisuals: GuardVisuals | null = null;
  private readiness: MissionVisualReadiness = {
    generation: 0,
    missionKey: 'initializing',
    phase: 'loading',
    mode: 'authored',
    shell: 'loading',
    world: 'loading',
    reason: null,
  };

  constructor(
    private readonly delegate: CombatGraphicsBackend,
    private readonly canvas: HTMLCanvasElement,
  ) {
    this.publish();
  }

  get id() {
    return this.delegate.id;
  }

  get loadedId() {
    return this.delegate.loadedId;
  }

  render(...args: CombatGraphicsRenderArgs) {
    const [state, , , , , mission] = args;
    const missionKey = `${mission.id}:${mission.seed}`;
    if (missionKey !== this.missionKey) this.beginGeneration(missionKey, state);
    this.ensureGuardVisuals(state, missionKey);
    this.delegate.render(...args);
    this.framesInGeneration += 1;
    this.refreshReadiness(mission.location === 'asteroid-refinery');
  }

  missionVisualReadiness() {
    return this.readiness;
  }

  performanceStats(): CombatGraphicsPerformanceStats {
    return this.delegate.performanceStats();
  }

  screenDirection(...args: CombatGraphicsPointerProjectionArgs): CombatGraphicsPointerDirection {
    return this.delegate.screenDirection(...args);
  }

  dispose() {
    this.disposeGuardVisuals();
    this.delegate.dispose();
  }

  private beginGeneration(missionKey: string, state: SimState) {
    this.missionKey = missionKey;
    this.generation += 1;
    this.generationStartedAt = performance.now();
    this.framesInGeneration = 0;
    this.disposeGuardVisuals();
    this.readiness = {
      generation: this.generation,
      missionKey,
      phase: 'loading',
      mode: 'authored',
      shell: 'loading',
      world: 'loading',
      reason: null,
    };
    this.canvas.dataset.missionVisualGeneration = String(this.generation);
    this.canvas.dataset.missionVisualMissionKey = missionKey;
    this.canvas.dataset.missionVisualGuard = 'initializing';
    this.publish();
    this.ensureGuardVisuals(state, missionKey);
  }

  private refreshReadiness(refinery: boolean) {
    if (this.framesInGeneration < 1) return;
    const resolved = resolveMissionVisualReadiness({
      refinery,
      elapsedMs: performance.now() - this.generationStartedAt,
      environmentState: this.canvas.dataset.babylonEnvironmentState,
      environmentError: this.canvas.dataset.babylonEnvironmentError,
      worldState: this.canvas.dataset.babylonWorldState,
      mappedCount: datasetCount(this.canvas.dataset.refineryWorldMappedCount),
      authoredCount: datasetCount(this.canvas.dataset.refineryWorldAuthoredCount),
      fallbackCount: datasetCount(this.canvas.dataset.refineryWorldFallbackCount),
    });
    this.readiness = {
      generation: this.generation,
      missionKey: this.missionKey,
      ...resolved,
    };
    if (resolved.phase === 'ready' && resolved.mode === 'authored') {
      this.disposeGuardVisuals();
      this.canvas.dataset.missionVisualGuard = 'released-authored';
    } else if (resolved.phase === 'ready' && resolved.mode === 'fallback') {
      this.canvas.dataset.missionVisualGuard = 'active-fallback';
    } else {
      this.canvas.dataset.missionVisualGuard = 'active-loading';
    }
    this.publish();
  }

  private publish() {
    this.canvas.dataset.missionVisualReadiness = this.readiness.phase;
    this.canvas.dataset.missionVisualMode = this.readiness.mode;
    this.canvas.dataset.missionVisualShell = this.readiness.shell;
    this.canvas.dataset.missionVisualWorld = this.readiness.world;
    this.canvas.dataset.missionVisualReason = this.readiness.reason ?? '';
  }

  private ensureGuardVisuals(state: SimState, missionKey: string) {
    if (this.guardVisuals?.missionKey === missionKey) return;
    this.disposeGuardVisuals();
    const scene = (this.delegate as SceneBackedBackend).scene;
    if (!scene) {
      this.canvas.dataset.missionVisualGuard = 'scene-unavailable';
      return;
    }

    const root = new TransformNode(`p28-pload0-readiness-guard-${this.generation}`, scene);
    const material = new StandardMaterial(`p28-pload0-readiness-guard-material-${this.generation}`, scene);
    material.diffuseColor = new Color3(0.10, 0.15, 0.16);
    material.emissiveColor = new Color3(0.025, 0.055, 0.058);
    material.specularColor = Color3.Black();
    const meshes: Mesh[] = [];
    const world = getWorldSize();
    const worldW = world.w * WORLD_SCALE;
    const worldH = world.h * WORLD_SCALE;
    const floor = MeshBuilder.CreateBox(`p28-pload0-readiness-floor-${this.generation}`, {
      width: worldW,
      height: 0.08,
      depth: worldH,
    }, scene);
    floor.parent = root;
    floor.position.set(worldW / 2, -0.04, worldH / 2);
    floor.material = material;
    floor.isPickable = false;
    meshes.push(floor);

    const wallThickness = 0.16;
    const wallHeight = 0.54;
    const wallSpecs = [
      { x: worldW / 2, z: -wallThickness / 2, width: worldW + wallThickness * 2, depth: wallThickness },
      { x: worldW / 2, z: worldH + wallThickness / 2, width: worldW + wallThickness * 2, depth: wallThickness },
      { x: -wallThickness / 2, z: worldH / 2, width: wallThickness, depth: worldH },
      { x: worldW + wallThickness / 2, z: worldH / 2, width: wallThickness, depth: worldH },
    ];
    wallSpecs.forEach((spec, index) => {
      const wall = MeshBuilder.CreateBox(`p28-pload0-readiness-wall-${this.generation}-${index}`, {
        width: spec.width,
        height: wallHeight,
        depth: spec.depth,
      }, scene);
      wall.parent = root;
      wall.position.set(spec.x, wallHeight / 2, spec.z);
      wall.material = material;
      wall.isPickable = false;
      meshes.push(wall);
    });

    for (const object of state.objects) {
      if (!object.active || !refineryWorldObjectFamilyKey(object)) continue;
      const height = objectHeight(object);
      const mesh = MeshBuilder.CreateBox(`p28-pload0-readiness-object-${this.generation}-${object.id}`, {
        width: Math.max(0.12, object.w * WORLD_SCALE),
        height,
        depth: Math.max(0.12, object.h * WORLD_SCALE),
      }, scene);
      mesh.parent = root;
      mesh.position.set((object.x + object.w / 2) * WORLD_SCALE, height / 2, (object.y + object.h / 2) * WORLD_SCALE);
      mesh.material = material;
      mesh.isPickable = false;
      meshes.push(mesh);
    }

    this.guardVisuals = { root, material, meshes, missionKey };
    this.canvas.dataset.missionVisualGuard = `active:${meshes.length}`;
  }

  private disposeGuardVisuals() {
    const guard = this.guardVisuals;
    if (!guard) return;
    guard.meshes.forEach(mesh => mesh.dispose());
    guard.material.dispose();
    guard.root.dispose();
    this.guardVisuals = null;
  }
}

export function createBabylonMissionVisualReadinessBackend(
  delegate: CombatGraphicsBackend,
  canvas: HTMLCanvasElement,
) {
  return new BabylonMissionVisualReadinessBackend(delegate, canvas);
}
