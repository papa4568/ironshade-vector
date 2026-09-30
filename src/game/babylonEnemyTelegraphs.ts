import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { resolveEnemyLifecyclePresentation } from './enemyLifecyclePresentation';
import type { Enemy, SimState } from './sim';

const WORLD_SCALE = 0.02;
const FLOOR_Y = 0.045;
const TELEGRAPH_COLOR = 0xf2b174;
const ELITE_TELEGRAPH_COLOR = 0xff8a82;
const BOSS_TELEGRAPH_COLOR = 0xffa070;
const BOSS_PHASE_ONE_COLOR = 0x8ee8ff;
const BOSS_PHASE_TWO_COLOR = 0xff8e68;

export type BabylonEnemyTelegraphMode =
  | 'rifle-line'
  | 'marksman-lance'
  | 'melee-wedge'
  | 'elite-bracket'
  | 'boss-fan'
  | 'boss-pulse'
  | 'boss-ground-lock'
  | 'boss-direction';

export type BabylonEnemyTelegraphProfile = {
  mode: BabylonEnemyTelegraphMode;
  range: number;
  width: number;
  targetRadius: number;
  color: number;
};

type TelegraphVisual = {
  root: TransformNode;
  targetRoot: TransformNode;
  phaseRoot: TransformNode;
  sourceRing: Mesh;
  lane: Mesh;
  sideA: Mesh;
  sideB: Mesh;
  pulseRing: Mesh;
  targetRing: Mesh;
  targetCrossA: Mesh;
  targetCrossB: Mesh;
  phaseOuter: Mesh;
  phaseInner: Mesh;
  phaseSpokes: Mesh[];
  attackMaterial: StandardMaterial;
  phaseMaterial: StandardMaterial;
};

type BossPhaseTracking = {
  lastPhase: Enemy['bossPhase'];
  phaseEventAt: number;
};

function scaled(value: number) {
  return value * WORLD_SCALE;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function colorFromHex(hex: number) {
  return Color3.FromInts((hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff);
}

function normalizedDirection(x: number, y: number) {
  const length = Math.hypot(x, y);
  return length > 0.001 ? { x: x / length, y: y / length } : { x: 1, y: 0 };
}

export function babylonEnemyTelegraphEffectsMode(detailScale: number, coarse: boolean) {
  const effectiveDetail = coarse ? Math.min(detailScale, 0.55) : detailScale;
  return effectiveDetail < 0.58 ? 'reduced' as const : 'full' as const;
}

export function babylonEnemyTelegraphProfile(
  enemy: Pick<Enemy, 'role' | 'variant' | 'bossPattern'>,
): BabylonEnemyTelegraphProfile {
  if (enemy.role === 'boss') {
    if (enemy.bossPattern === 'massPulse') {
      return {
        mode: 'boss-pulse',
        range: 330,
        width: 0,
        targetRadius: 330,
        color: BOSS_TELEGRAPH_COLOR,
      };
    }
    if (enemy.bossPattern === 'craneLock') {
      return {
        mode: 'boss-ground-lock',
        range: 0,
        width: 18,
        targetRadius: 112,
        color: BOSS_TELEGRAPH_COLOR,
      };
    }
    if (enemy.bossPattern === 'coilFan') {
      return {
        mode: 'boss-fan',
        range: 700,
        width: 20,
        targetRadius: 0,
        color: BOSS_TELEGRAPH_COLOR,
      };
    }
    return {
      mode: 'boss-direction',
      range: 700,
      width: 26,
      targetRadius: 0,
      color: BOSS_TELEGRAPH_COLOR,
    };
  }

  if (enemy.variant === 'marksman' || enemy.variant === 'baselineMarksman') {
    return {
      mode: 'marksman-lance',
      range: 930,
      width: 12,
      targetRadius: 34,
      color: TELEGRAPH_COLOR,
    };
  }
  if (enemy.variant === 'meleeExosuit') {
    return {
      mode: 'melee-wedge',
      range: 155,
      width: 54,
      targetRadius: 48,
      color: TELEGRAPH_COLOR,
    };
  }
  if (enemy.role === 'elite') {
    return {
      mode: 'elite-bracket',
      range: 690,
      width: 24,
      targetRadius: 38,
      color: ELITE_TELEGRAPH_COLOR,
    };
  }
  return {
    mode: 'rifle-line',
    range: enemy.role === 'assault' ? 330 : 690,
    width: enemy.role === 'suppressor' ? 22 : 18,
    targetRadius: 28,
    color: TELEGRAPH_COLOR,
  };
}

export class BabylonEnemyTelegraphs {
  private readonly scene: Scene;
  private readonly canvas: HTMLCanvasElement;
  private readonly coarse: boolean;
  private readonly visuals = new Map<number, TelegraphVisual>();
  private readonly bossPhaseTracking = new Map<number, BossPhaseTracking>();
  private disposed = false;

  constructor(scene: Scene, canvas: HTMLCanvasElement, coarse: boolean) {
    this.scene = scene;
    this.canvas = canvas;
    this.coarse = coarse;
    this.canvas.dataset.babylonEnemyTelegraphs = 'ready';
    this.canvas.dataset.babylonEnemyTelegraphActive = '0';
    this.canvas.dataset.babylonEnemyTelegraphModes = '';
    this.canvas.dataset.babylonEnemyTelegraphReadability = 'shape-coded+aim+range+phone-safe';
    this.canvas.dataset.babylonBossPatternCue = 'idle';
    this.canvas.dataset.babylonBossPhaseCue = 'idle';
  }

  sync(state: SimState, detailScale: number) {
    if (this.disposed) return;
    const effectsMode = babylonEnemyTelegraphEffectsMode(detailScale, this.coarse);
    const seen = new Set<number>();
    const activeModes = new Set<BabylonEnemyTelegraphMode>();
    const activeRoles = new Set<Enemy['role']>();
    let activeTelegraphs = 0;
    let bossPatternCue = 'idle';
    let bossPhaseCue = 'idle';
    let transitionStrength = 0;

    for (const enemy of state.enemies) {
      seen.add(enemy.id);
      const needsVisual = enemy.role === 'boss' || (enemy.active && !enemy.dead && enemy.telegraph > 0) || this.visuals.has(enemy.id);
      if (!needsVisual) continue;
      const visual = this.visuals.get(enemy.id) ?? this.createVisual(enemy.id);
      this.resetAttackVisual(visual);

      if (!enemy.active || enemy.dead) {
        visual.phaseRoot.setEnabled(false);
        continue;
      }

      if (enemy.role === 'boss') {
        const phaseTransition = this.syncBossPhaseVisual(visual, enemy, state);
        transitionStrength = Math.max(transitionStrength, phaseTransition);
        bossPhaseCue = `phase:${enemy.bossPhase}|transition:${phaseTransition > 0 ? 'active' : 'idle'}`;
      } else {
        visual.phaseRoot.setEnabled(false);
      }

      if (enemy.telegraph <= 0) continue;
      const profile = babylonEnemyTelegraphProfile(enemy);
      this.syncAttackVisual(visual, enemy, state, profile);
      activeTelegraphs += 1;
      activeModes.add(profile.mode);
      activeRoles.add(enemy.role);
      if (enemy.role === 'boss') bossPatternCue = `${enemy.bossPattern}:${profile.mode}`;
    }

    for (const [id, visual] of this.visuals) {
      if (seen.has(id)) continue;
      this.disposeVisual(visual);
      this.visuals.delete(id);
      this.bossPhaseTracking.delete(id);
    }

    this.canvas.dataset.babylonEnemyTelegraphActive = String(activeTelegraphs);
    this.canvas.dataset.babylonEnemyTelegraphModes = [...activeModes].sort().join(',');
    this.canvas.dataset.babylonEnemyTelegraphRoles = [...activeRoles].sort().join(',');
    this.canvas.dataset.babylonEnemyTelegraphEffectsMode = effectsMode;
    this.canvas.dataset.babylonBossPatternCue = bossPatternCue;
    this.canvas.dataset.babylonBossPhaseCue = bossPhaseCue;
    this.canvas.dataset.babylonBossPhaseTransition = transitionStrength.toFixed(2);
    this.canvas.dataset.babylonEnemyTelegraphs = 'attack+aim+range+boss-pattern+phase';
    this.canvas.dataset.babylonEnemyTelegraphSimulationOwnership = 'read-only-presentation';
  }

  release(reason: string) {
    if (this.disposed) return;
    for (const visual of this.visuals.values()) {
      visual.root.setEnabled(false);
      visual.targetRoot.setEnabled(false);
      visual.phaseRoot.setEnabled(false);
    }
    this.bossPhaseTracking.clear();
    this.canvas.dataset.babylonEnemyTelegraphActive = '0';
    this.canvas.dataset.babylonEnemyTelegraphModes = '';
    this.canvas.dataset.babylonEnemyTelegraphRoles = '';
    this.canvas.dataset.babylonBossPatternCue = 'idle';
    this.canvas.dataset.babylonBossPhaseCue = 'idle';
    this.canvas.dataset.babylonBossPhaseTransition = '0.00';
    this.canvas.dataset.babylonEnemyTelegraphRelease = reason;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const visual of this.visuals.values()) this.disposeVisual(visual);
    this.visuals.clear();
    this.bossPhaseTracking.clear();
    this.canvas.dataset.babylonEnemyTelegraphs = 'disposed';
  }

  private createMaterial(name: string, color: number) {
    const material = new StandardMaterial(name, this.scene);
    const signal = colorFromHex(color);
    material.diffuseColor = signal.scale(0.18);
    material.emissiveColor = signal;
    material.specularColor = Color3.Black();
    material.alpha = 0.72;
    material.disableLighting = true;
    return material;
  }

  private createVisual(id: number): TelegraphVisual {
    const attackMaterial = this.createMaterial(`p27-b8-attack-material-${id}`, TELEGRAPH_COLOR);
    const phaseMaterial = this.createMaterial(`p27-b8-phase-material-${id}`, BOSS_PHASE_ONE_COLOR);

    const root = new TransformNode(`p27-b8-telegraph-root-${id}`, this.scene);
    root.position.y = FLOOR_Y;

    const sourceRing = MeshBuilder.CreateTorus(`p27-b8-source-ring-${id}`, {
      diameter: 1,
      thickness: 0.06,
      tessellation: 28,
    }, this.scene);
    sourceRing.parent = root;
    sourceRing.material = attackMaterial;
    sourceRing.isPickable = false;

    const lane = MeshBuilder.CreateBox(`p27-b8-telegraph-lane-${id}`, {
      width: 1,
      height: 0.026,
      depth: 1,
    }, this.scene);
    lane.parent = root;
    lane.position.y = 0.01;
    lane.material = attackMaterial;
    lane.isPickable = false;

    const sideA = MeshBuilder.CreateBox(`p27-b8-telegraph-side-a-${id}`, {
      width: 1,
      height: 0.024,
      depth: 1,
    }, this.scene);
    sideA.parent = root;
    sideA.position.y = 0.012;
    sideA.material = attackMaterial;
    sideA.isPickable = false;

    const sideB = sideA.clone(`p27-b8-telegraph-side-b-${id}`);
    sideB.parent = root;
    sideB.material = attackMaterial;
    sideB.isPickable = false;

    const pulseRing = MeshBuilder.CreateTorus(`p27-b8-telegraph-pulse-${id}`, {
      diameter: 1,
      thickness: 0.075,
      tessellation: 40,
    }, this.scene);
    pulseRing.parent = root;
    pulseRing.position.y = 0.008;
    pulseRing.material = attackMaterial;
    pulseRing.isPickable = false;

    const targetRoot = new TransformNode(`p27-b8-target-root-${id}`, this.scene);
    targetRoot.position.y = FLOOR_Y + 0.012;
    const targetRing = MeshBuilder.CreateTorus(`p27-b8-target-ring-${id}`, {
      diameter: 1,
      thickness: 0.065,
      tessellation: 32,
    }, this.scene);
    targetRing.parent = targetRoot;
    targetRing.material = attackMaterial;
    targetRing.isPickable = false;

    const targetCrossA = MeshBuilder.CreateBox(`p27-b8-target-cross-a-${id}`, {
      width: 1,
      height: 0.025,
      depth: 0.07,
    }, this.scene);
    targetCrossA.parent = targetRoot;
    targetCrossA.position.y = 0.01;
    targetCrossA.material = attackMaterial;
    targetCrossA.isPickable = false;

    const targetCrossB = targetCrossA.clone(`p27-b8-target-cross-b-${id}`);
    targetCrossB.parent = targetRoot;
    targetCrossB.rotation.y = Math.PI / 2;
    targetCrossB.material = attackMaterial;
    targetCrossB.isPickable = false;

    const phaseRoot = new TransformNode(`p27-b8-phase-root-${id}`, this.scene);
    phaseRoot.position.y = FLOOR_Y + 0.018;

    const phaseOuter = MeshBuilder.CreateTorus(`p27-b8-phase-outer-${id}`, {
      diameter: 3,
      thickness: 0.075,
      tessellation: 48,
    }, this.scene);
    phaseOuter.parent = phaseRoot;
    phaseOuter.material = phaseMaterial;
    phaseOuter.isPickable = false;

    const phaseInner = MeshBuilder.CreateTorus(`p27-b8-phase-inner-${id}`, {
      diameter: 1.72,
      thickness: 0.055,
      tessellation: 36,
    }, this.scene);
    phaseInner.parent = phaseRoot;
    phaseInner.position.y = 0.025;
    phaseInner.material = phaseMaterial;
    phaseInner.isPickable = false;

    const phaseSpokes: Mesh[] = [];
    for (let index = 0; index < 4; index += 1) {
      const angle = index * Math.PI / 2;
      const spoke = MeshBuilder.CreateBox(`p27-b8-phase-spoke-${id}-${index}`, {
        width: 0.78,
        height: 0.03,
        depth: 0.09,
      }, this.scene);
      spoke.parent = phaseRoot;
      spoke.position.set(Math.cos(angle) * 1.15, 0.035, Math.sin(angle) * 1.15);
      spoke.rotation.y = -angle;
      spoke.material = phaseMaterial;
      spoke.isPickable = false;
      phaseSpokes.push(spoke);
    }

    root.setEnabled(false);
    targetRoot.setEnabled(false);
    phaseRoot.setEnabled(false);

    const visual = {
      root,
      targetRoot,
      phaseRoot,
      sourceRing,
      lane,
      sideA,
      sideB,
      pulseRing,
      targetRing,
      targetCrossA,
      targetCrossB,
      phaseOuter,
      phaseInner,
      phaseSpokes,
      attackMaterial,
      phaseMaterial,
    };
    this.visuals.set(id, visual);
    return visual;
  }

  private resetAttackVisual(visual: TelegraphVisual) {
    visual.root.setEnabled(false);
    visual.targetRoot.setEnabled(false);
    visual.sourceRing.setEnabled(false);
    visual.lane.setEnabled(false);
    visual.sideA.setEnabled(false);
    visual.sideB.setEnabled(false);
    visual.pulseRing.setEnabled(false);
    visual.targetRing.setEnabled(false);
    visual.targetCrossA.setEnabled(false);
    visual.targetCrossB.setEnabled(false);
    visual.sideA.rotation.y = 0;
    visual.sideB.rotation.y = 0;
    visual.sideA.position.z = 0;
    visual.sideB.position.z = 0;
  }

  private syncAttackVisual(
    visual: TelegraphVisual,
    enemy: Enemy,
    state: SimState,
    profile: BabylonEnemyTelegraphProfile,
  ) {
    const signal = colorFromHex(profile.color);
    visual.attackMaterial.diffuseColor = signal.scale(0.18);
    visual.attackMaterial.emissiveColor = signal;
    visual.attackMaterial.alpha = clamp01(0.66 + Math.sin(state.time * 10 + enemy.id * 0.73) * 0.1);

    const originX = scaled(enemy.x);
    const originZ = scaled(enemy.y);
    visual.root.position.set(originX, FLOOR_Y, originZ);
    visual.root.setEnabled(true);
    visual.sourceRing.setEnabled(true);
    const sourceDiameter = enemy.role === 'boss' ? 2.3 : enemy.role === 'elite' ? 1.55 : 1.15;
    visual.sourceRing.scaling.set(sourceDiameter, sourceDiameter, sourceDiameter);

    let direction = normalizedDirection(enemy.telegraphAim.x, enemy.telegraphAim.y);
    let laneRange = profile.range;
    let targetX = enemy.x + direction.x * profile.range;
    let targetY = enemy.y + direction.y * profile.range;

    if (profile.mode === 'boss-ground-lock') {
      targetX = state.player.x + state.player.vx * 0.45;
      targetY = state.player.y + state.player.vy * 0.45;
      direction = normalizedDirection(targetX - enemy.x, targetY - enemy.y);
      laneRange = Math.hypot(targetX - enemy.x, targetY - enemy.y);
      this.canvas.dataset.babylonBossGroundLock = `${targetX.toFixed(1)},${targetY.toFixed(1)}`;
    }

    visual.root.rotation.y = Math.atan2(-direction.y, direction.x);
    const laneLength = Math.max(0.08, scaled(laneRange));
    const laneWidth = Math.max(0.08, scaled(profile.width));
    const setLane = (mesh: Mesh, widthScale = 1) => {
      mesh.position.x = laneLength / 2;
      mesh.scaling.set(laneLength, 1, laneWidth * widthScale);
      mesh.setEnabled(true);
    };

    if (profile.mode === 'boss-pulse') {
      const radius = scaled(profile.targetRadius);
      visual.pulseRing.scaling.set(radius * 2, radius * 2, radius * 2);
      visual.pulseRing.setEnabled(true);
      visual.sourceRing.scaling.set(2.8, 2.8, 2.8);
    } else if (profile.mode === 'boss-fan') {
      setLane(visual.lane, 1.15);
      setLane(visual.sideA, 0.78);
      setLane(visual.sideB, 0.78);
      visual.sideA.rotation.y = 0.12;
      visual.sideB.rotation.y = -0.12;
    } else if (profile.mode === 'elite-bracket') {
      setLane(visual.lane, 0.7);
      setLane(visual.sideA, 0.45);
      setLane(visual.sideB, 0.45);
      visual.sideA.position.z = laneWidth * 1.8;
      visual.sideB.position.z = -laneWidth * 1.8;
      this.positionTargetCue(visual, targetX, targetY, profile.targetRadius, false);
    } else if (profile.mode === 'melee-wedge') {
      setLane(visual.lane, 1.25);
      setLane(visual.sideA, 0.4);
      setLane(visual.sideB, 0.4);
      visual.sideA.rotation.y = 0.3;
      visual.sideB.rotation.y = -0.3;
      this.positionTargetCue(visual, targetX, targetY, profile.targetRadius, false);
    } else {
      setLane(visual.lane, profile.mode === 'marksman-lance' ? 0.58 : 1);
      if (profile.mode === 'boss-direction') {
        setLane(visual.sideA, 0.42);
        setLane(visual.sideB, 0.42);
        visual.sideA.position.z = laneWidth * 1.55;
        visual.sideB.position.z = -laneWidth * 1.55;
      }
      if (profile.mode === 'marksman-lance') {
        this.positionTargetCue(visual, targetX, targetY, profile.targetRadius, true);
      }
    }

    if (profile.mode === 'boss-ground-lock') {
      setLane(visual.lane, 0.72);
      this.positionTargetCue(visual, targetX, targetY, profile.targetRadius, true);
    }

    this.canvas.dataset.babylonEnemyTelegraphLast = [
      `${enemy.role}:${enemy.variant}`,
      profile.mode,
      `range:${profile.mode === 'boss-ground-lock' ? laneRange.toFixed(0) : profile.range}`,
      `remaining:${enemy.telegraph.toFixed(2)}`,
    ].join('|');
  }

  private positionTargetCue(
    visual: TelegraphVisual,
    targetX: number,
    targetY: number,
    radius: number,
    showCross: boolean,
  ) {
    const sceneRadius = Math.max(0.18, scaled(radius));
    visual.targetRoot.position.set(scaled(targetX), FLOOR_Y + 0.012, scaled(targetY));
    visual.targetRoot.setEnabled(true);
    visual.targetRing.scaling.set(sceneRadius * 2, sceneRadius * 2, sceneRadius * 2);
    visual.targetRing.setEnabled(true);
    visual.targetCrossA.scaling.set(sceneRadius * 1.45, 1, 1);
    visual.targetCrossB.scaling.set(sceneRadius * 1.45, 1, 1);
    visual.targetCrossA.setEnabled(showCross);
    visual.targetCrossB.setEnabled(showCross);
  }

  private syncBossPhaseVisual(visual: TelegraphVisual, enemy: Enemy, state: SimState) {
    let tracking = this.bossPhaseTracking.get(enemy.id);
    if (!tracking) {
      tracking = { lastPhase: enemy.bossPhase, phaseEventAt: -1 };
      this.bossPhaseTracking.set(enemy.id, tracking);
    } else if (tracking.lastPhase !== enemy.bossPhase) {
      tracking.lastPhase = enemy.bossPhase;
      tracking.phaseEventAt = state.time;
    }

    const sincePhaseChange = tracking.phaseEventAt >= 0 ? state.time - tracking.phaseEventAt : -1;
    const lifecycle = resolveEnemyLifecyclePresentation(enemy, {
      sinceActivated: -1,
      sincePhaseChange,
      sinceDeath: -1,
    });
    const phaseTwo = enemy.bossPhase === 2;
    const phaseSignal = colorFromHex(phaseTwo ? BOSS_PHASE_TWO_COLOR : BOSS_PHASE_ONE_COLOR);
    visual.phaseMaterial.diffuseColor = phaseSignal.scale(0.16);
    visual.phaseMaterial.emissiveColor = phaseSignal;
    visual.phaseMaterial.alpha = clamp01(
      0.42
      + (phaseTwo ? 0.1 : 0)
      + lifecycle.phaseTransition * 0.24
      + Math.sin(state.time * (phaseTwo ? 5.8 : 3.2) + enemy.patternIndex) * 0.06,
    );

    visual.phaseRoot.position.set(scaled(enemy.x), FLOOR_Y + 0.018, scaled(enemy.y));
    visual.phaseRoot.scaling.setAll(1 + lifecycle.phaseTransition * 0.14);
    visual.phaseRoot.setEnabled(true);
    visual.phaseOuter.setEnabled(true);
    visual.phaseOuter.scaling.setAll(1 + (phaseTwo ? 0.08 : 0.04) * Math.sin(state.time * 4.5));
    visual.phaseInner.setEnabled(phaseTwo);
    visual.phaseInner.scaling.setAll(phaseTwo ? 1 + Math.sin(state.time * 5.4) * 0.06 : 1);
    for (const spoke of visual.phaseSpokes) spoke.setEnabled(lifecycle.phaseTransition > 0);

    return lifecycle.phaseTransition;
  }

  private disposeVisual(visual: TelegraphVisual) {
    visual.attackMaterial.dispose();
    visual.phaseMaterial.dispose();
    visual.root.dispose();
    visual.targetRoot.dispose();
    visual.phaseRoot.dispose();
  }
}
