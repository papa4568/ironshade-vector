import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import {
  enemyHudReadabilityTelemetry,
  resolveEnemyHudReadability,
} from './enemyMobileReadability';
import {
  resolveEnemyLifecyclePresentation,
  type EnemyLifecycleSignals,
} from './enemyLifecyclePresentation';
import type { Enemy, SimState } from './sim';

const WORLD_SCALE = 0.02;

type BabylonEnemyLifecycleEffectsMode = 'full' | 'reduced';

type EnemyLifecycleMemory = {
  lastActive: boolean;
  activatedAt: number;
  lastDead: boolean;
  deathAt: number;
  lastBossPhase: number;
  phaseAt: number;
};

type EnemyLifecycleVisual = {
  root: TransformNode;
  core: Mesh;
  spawnRing: Mesh;
  phaseRing: Mesh;
  dangerRing: Mesh;
  disabledRing: Mesh;
  targetRing: Mesh;
  targetSpokes: Mesh[];
  healthBack: Mesh;
  healthFill: Mesh;
  criticalBrackets: Mesh[];
  armorBreakBrackets: Mesh[];
  coreMaterial: StandardMaterial;
  spawnMaterial: StandardMaterial;
  phaseMaterial: StandardMaterial;
  dangerMaterial: StandardMaterial;
  disabledMaterial: StandardMaterial;
  targetMaterial: StandardMaterial;
  healthBackMaterial: StandardMaterial;
  healthMaterial: StandardMaterial;
  criticalMaterial: StandardMaterial;
  armorBreakMaterial: StandardMaterial;
};

type LifecycleTelemetry = {
  priority: number;
  enemy: Enemy;
  signals: EnemyLifecycleSignals;
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function scaled(value: number) {
  return value * WORLD_SCALE;
}

function color(hex: number) {
  return Color3.FromInts((hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff);
}

function material(scene: Scene, name: string, hex: number, alpha = 1) {
  const value = new StandardMaterial(name, scene);
  value.diffuseColor = color(hex).scale(0.28);
  value.emissiveColor = color(hex).scale(0.82);
  value.specularColor = Color3.Black();
  value.alpha = alpha;
  value.disableLighting = true;
  return value;
}

function enemyScale(enemy: Enemy) {
  if (enemy.role === 'boss') return 1.48;
  if (enemy.role === 'elite') return 1.18;
  return 1;
}

function lifecyclePriority(enemy: Enemy) {
  if (enemy.role === 'boss') return 5;
  if (enemy.role === 'elite') return 4;
  if (enemy.role === 'technician') return 3;
  if (enemy.role === 'suppressor') return 2;
  return 1;
}

function activeStatusWeight(enemy: Enemy) {
  return Object.values(enemy.statuses).some(value => typeof value === 'number' && value > 0) ? 0.5 : 0;
}

export function babylonEnemyLifecycleEffectsMode(
  detailScale: number,
  _coarse: boolean,
): BabylonEnemyLifecycleEffectsMode {
  return detailScale < 0.72 ? 'reduced' : 'full';
}

export class BabylonEnemyLifecycleVisuals {
  private readonly visuals = new Map<number, EnemyLifecycleVisual>();
  private readonly memory = new Map<number, EnemyLifecycleMemory>();
  private disposed = false;
  private releaseCount = 0;

  constructor(
    private readonly scene: Scene,
    private readonly canvas: HTMLCanvasElement,
    private readonly coarse: boolean,
  ) {}

  sync(
    state: SimState,
    mobileTargetId: number | null,
    detailScale: number,
    reducedTargetMotion = false,
  ) {
    if (this.disposed) return;
    const mode = babylonEnemyLifecycleEffectsMode(detailScale, this.coarse);
    const reducedEffects = mode === 'reduced';
    const reducedMotion = reducedTargetMotion || reducedEffects;
    const seen = new Set<number>();
    let visibleBars = 0;
    let lifecycleTelemetry: LifecycleTelemetry | null = null;
    let focusedEnemy: Enemy | null = null;

    for (const enemy of state.enemies) {
      seen.add(enemy.id);
      const visual = this.visuals.get(enemy.id) ?? this.createVisual(enemy);
      const memory = this.memory.get(enemy.id) ?? this.createMemory(enemy, state.time);

      if (enemy.active && !memory.lastActive) memory.activatedAt = state.time;
      if (enemy.dead && !memory.lastDead) memory.deathAt = state.time;
      if (enemy.bossPhase !== memory.lastBossPhase) {
        memory.lastBossPhase = enemy.bossPhase;
        memory.phaseAt = state.time;
      }
      memory.lastActive = enemy.active;
      memory.lastDead = enemy.dead;

      const signals = resolveEnemyLifecyclePresentation(enemy, {
        sinceActivated: memory.activatedAt >= 0 ? state.time - memory.activatedAt : -1,
        sincePhaseChange: memory.phaseAt >= 0 ? state.time - memory.phaseAt : -1,
        sinceDeath: memory.deathAt >= 0 ? state.time - memory.deathAt : -1,
      });
      const focused = enemy.active && !enemy.dead && enemy.id === mobileTargetId;
      const readability = resolveEnemyHudReadability(enemy, this.coarse, focused);
      const hpRatio = clamp01(enemy.hp / Math.max(1, enemy.maxHp));
      const armorBroken = !enemy.dead && enemy.maxArmor > 0 && enemy.armor <= 0;
      const criticalDurability = !enemy.dead && hpRatio <= 0.5;
      const lifecycleActive = signals.spawn > 0
        || signals.phaseTransition > 0
        || signals.dangerousReadiness > 0
        || signals.persistentDisabled > 0;
      const higherPriorityWeight = Math.max(enemy.telegraph > 0 ? 0.78 : 0, activeStatusWeight(enemy));
      const lifecycleVisibility = clamp01(1 - higherPriorityWeight * 0.78);
      const scale = enemyScale(enemy);

      visual.root.position.set(scaled(enemy.x), 0, scaled(enemy.y));
      visual.root.setEnabled(enemy.active);
      if (!enemy.active) continue;

      visual.core.setEnabled(lifecycleActive);
      visual.core.scaling.set(scale, 1, scale);
      visual.coreMaterial.alpha = enemy.dead ? 0.42 : 0.56 * lifecycleVisibility;

      visual.spawnRing.setEnabled(signals.spawn > 0);
      if (signals.spawn > 0) {
        const expansion = (0.82 + (1 - signals.spawn) * 0.48) * scale;
        visual.spawnRing.scaling.set(expansion, expansion, expansion);
        visual.spawnMaterial.alpha = (0.22 + signals.spawn * 0.66) * lifecycleVisibility;
        visual.spawnRing.rotation.y = reducedMotion ? 0 : state.time * 1.3;
      }

      visual.phaseRing.setEnabled(signals.phaseTransition > 0);
      if (signals.phaseTransition > 0) {
        const expansion = (0.88 + signals.phaseTransition * 0.34) * scale;
        visual.phaseRing.scaling.set(expansion, expansion, expansion);
        visual.phaseMaterial.alpha = (0.3 + signals.phaseTransition * 0.58) * lifecycleVisibility;
        visual.phaseRing.rotation.y = reducedMotion ? 0 : -state.time * 1.6;
      }

      visual.dangerRing.setEnabled(signals.dangerousReadiness > 0 && !enemy.dead);
      if (signals.dangerousReadiness > 0 && !enemy.dead) {
        const expansion = (0.94 + signals.dangerousReadiness * 0.16) * scale;
        visual.dangerRing.scaling.set(expansion, expansion, expansion);
        visual.dangerMaterial.alpha = (0.38 + signals.dangerousReadiness * 0.5) * lifecycleVisibility;
        visual.dangerRing.position.y = (enemy.role === 'boss' ? 3.05 : enemy.role === 'elite' ? 2.5 : 2.15) * scale;
        visual.dangerRing.rotation.y = reducedMotion ? 0 : state.time * (1.7 + signals.dangerousReadiness);
      }

      visual.disabledRing.setEnabled(signals.persistentDisabled > 0);
      if (signals.persistentDisabled > 0) {
        const expansion = (0.92 + signals.disable * 0.18) * scale;
        visual.disabledRing.scaling.set(expansion, expansion, expansion);
        visual.disabledMaterial.alpha = 0.34 + signals.disable * 0.28;
        visual.disabledRing.rotation.y = reducedMotion ? 0 : state.time * 0.18;
      }

      visual.targetRing.setEnabled(focused);
      for (const spoke of visual.targetSpokes) spoke.setEnabled(focused);
      if (focused) {
        focusedEnemy = enemy;
        const pulse = reducedTargetMotion ? 1 : 1 + Math.sin(state.time * 8) * 0.08;
        visual.targetRing.scaling.set(scale * pulse, scale * pulse, scale * pulse);
        visual.targetRing.rotation.y = reducedTargetMotion ? 0 : state.time * 1.35;
        visual.targetMaterial.alpha = reducedTargetMotion ? 0.92 : 0.78 + Math.sin(state.time * 8) * 0.1;
        visual.targetSpokes.forEach((spoke, index) => {
          spoke.scaling.set(scale, 1, scale);
          spoke.rotation.y = index * Math.PI / 2;
        });
      }

      const showHealth = readability.showHealthBar && !enemy.dead;
      visual.healthBack.setEnabled(showHealth);
      visual.healthFill.setEnabled(showHealth);
      if (showHealth) {
        visibleBars += 1;
        const width = 1.12 * scale;
        visual.healthBack.scaling.x = scale;
        visual.healthFill.scaling.x = Math.max(0.025, hpRatio) * scale;
        visual.healthFill.position.x = -(width * (1 - hpRatio)) / 2;
        visual.healthMaterial.alpha = focused ? 1 : 0.84;
      }

      for (const bracket of visual.criticalBrackets) bracket.setEnabled(criticalDurability);
      for (const bracket of visual.armorBreakBrackets) bracket.setEnabled(armorBroken);
      if (criticalDurability) {
        visual.criticalBrackets[0].position.x = -0.7 * scale;
        visual.criticalBrackets[1].position.x = 0.7 * scale;
      }
      if (armorBroken) {
        visual.armorBreakBrackets[0].position.x = -0.52 * scale;
        visual.armorBreakBrackets[1].position.x = 0.52 * scale;
      }

      if (lifecycleActive) {
        const priority = lifecyclePriority(enemy);
        if (!lifecycleTelemetry || priority > lifecycleTelemetry.priority) {
          lifecycleTelemetry = { priority, enemy, signals };
        }
      }
    }

    for (const [id, visual] of this.visuals) {
      if (seen.has(id)) continue;
      this.disposeVisual(visual, 'despawn');
      this.visuals.delete(id);
      this.memory.delete(id);
    }

    this.canvas.dataset.babylonEnemyLifecycleEffectsMode = mode;
    this.canvas.dataset.babylonEnemyReadability = enemyHudReadabilityTelemetry(this.coarse, reducedEffects);
    this.canvas.dataset.babylonEnemyVisibleBars = String(visibleBars);
    this.canvas.dataset.babylonEnemyLifecycleTracked = String(this.visuals.size);
    this.canvas.dataset.babylonEnemyLifecycleReducedEffects = reducedMotion ? 'preserved' : 'full';
    this.canvas.dataset.babylonEnemyLifecycleSimulationOwnership = 'read-only-presentation';
    this.canvas.dataset.babylonEnemyLifecycleCleanup = 'released:' + this.releaseCount;

    if (focusedEnemy) {
      this.canvas.dataset.babylonEnemyFocusedTarget = focusedEnemy.id + ':' + focusedEnemy.role + ':' + focusedEnemy.variant;
    } else {
      delete this.canvas.dataset.babylonEnemyFocusedTarget;
    }

    if (lifecycleTelemetry) {
      const item = lifecycleTelemetry;
      const values = [
        item.signals.spawn > 0 ? 'spawn' : '',
        item.signals.phaseTransition > 0 ? 'phase' : '',
        item.signals.dangerousReadiness > 0 ? 'readiness' : '',
        item.signals.persistentDisabled > 0 ? 'disabled' : '',
      ].filter(Boolean);
      this.canvas.dataset.babylonEnemyLifecyclePresentation = values.join('+');
      this.canvas.dataset.babylonEnemyLifecycleTarget = item.enemy.role + ':' + item.enemy.variant;
    } else {
      delete this.canvas.dataset.babylonEnemyLifecyclePresentation;
      delete this.canvas.dataset.babylonEnemyLifecycleTarget;
    }
  }

  release(reason: string) {
    for (const visual of this.visuals.values()) this.disposeVisual(visual, reason);
    this.visuals.clear();
    this.memory.clear();
    this.canvas.dataset.babylonEnemyLifecycleTracked = '0';
    this.canvas.dataset.babylonEnemyVisibleBars = '0';
    this.canvas.dataset.babylonEnemyLifecycleCleanup = 'released:' + this.releaseCount;
    delete this.canvas.dataset.babylonEnemyLifecyclePresentation;
    delete this.canvas.dataset.babylonEnemyLifecycleTarget;
    delete this.canvas.dataset.babylonEnemyFocusedTarget;
  }

  dispose() {
    if (this.disposed) return;
    this.release('renderer-dispose');
    this.disposed = true;
  }

  private createMemory(enemy: Enemy, time: number) {
    const memory: EnemyLifecycleMemory = {
      lastActive: enemy.active,
      activatedAt: enemy.active && !enemy.dead ? time : -1,
      lastDead: enemy.dead,
      deathAt: enemy.dead ? time : -1,
      lastBossPhase: enemy.bossPhase,
      phaseAt: -1,
    };
    this.memory.set(enemy.id, memory);
    return memory;
  }

  private createVisual(enemy: Enemy) {
    const id = enemy.id;
    const scale = enemyScale(enemy);
    const root = new TransformNode('p27-b10-lifecycle-root-' + id, this.scene);

    const coreMaterial = material(this.scene, 'p27-b10-core-material-' + id, 0x6c8b84, 0.56);
    const spawnMaterial = material(this.scene, 'p27-b10-spawn-material-' + id, 0x7ee0d5, 0.72);
    const phaseMaterial = material(this.scene, 'p27-b10-phase-material-' + id, 0xffb15b, 0.72);
    const dangerMaterial = material(this.scene, 'p27-b10-danger-material-' + id, 0xff7452, 0.78);
    const disabledMaterial = material(this.scene, 'p27-b10-disabled-material-' + id, 0xc46b54, 0.54);
    const targetMaterial = material(this.scene, 'p27-b10-target-material-' + id, 0xd5f5ef, 0.9);
    const healthBackMaterial = material(this.scene, 'p27-b10-health-back-material-' + id, 0x1b2422, 0.72);
    const healthMaterial = material(this.scene, 'p27-b10-health-material-' + id, 0x9fd1a7, 0.92);
    const criticalMaterial = material(this.scene, 'p27-b10-critical-material-' + id, 0xff8c73, 0.88);
    const armorBreakMaterial = material(this.scene, 'p27-b10-armor-break-material-' + id, 0xf2c879, 0.92);

    const core = MeshBuilder.CreateCylinder('p27-b10-lifecycle-core-' + id, {
      height: 0.13,
      diameter: 0.72,
      tessellation: 8,
    }, this.scene);
    core.parent = root;
    core.position.y = 0.12;
    core.material = coreMaterial;

    const makeRing = (name: string, diameter: number, ringMaterial: StandardMaterial) => {
      const ring = MeshBuilder.CreateTorus(name + '-' + id, {
        diameter,
        thickness: 0.055,
        tessellation: 24,
      }, this.scene);
      ring.parent = root;
      ring.position.y = 0.08;
      ring.material = ringMaterial;
      ring.isPickable = false;
      ring.setEnabled(false);
      return ring;
    };

    const spawnRing = makeRing('p27-b10-spawn-ring', 2.1, spawnMaterial);
    const phaseRing = makeRing('p27-b10-phase-ring', 2.5, phaseMaterial);
    phaseRing.position.y = 0.14;
    const dangerRing = makeRing('p27-b10-danger-ring', 1.55, dangerMaterial);
    const disabledRing = makeRing('p27-b10-disabled-ring', 2.0, disabledMaterial);
    disabledRing.position.y = 0.06;
    const targetRing = makeRing('p27-b10-target-ring', 2.35, targetMaterial);
    targetRing.position.y = 0.05;

    const targetSpokes = [0, 1, 2, 3].map(index => {
      const spoke = MeshBuilder.CreateBox('p27-b10-target-spoke-' + id + '-' + index, {
        width: 0.34,
        height: 0.055,
        depth: 0.08,
      }, this.scene);
      spoke.parent = root;
      spoke.position.set(1.28 * Math.cos(index * Math.PI / 2), 0.07, 1.28 * Math.sin(index * Math.PI / 2));
      spoke.material = targetMaterial;
      spoke.isPickable = false;
      spoke.setEnabled(false);
      return spoke;
    });

    const healthY = (enemy.role === 'boss' ? 3.45 : enemy.role === 'elite' ? 2.82 : 2.35) * scale;
    const healthBack = MeshBuilder.CreateBox('p27-b10-health-back-' + id, {
      width: 1.2,
      height: 0.075,
      depth: 0.08,
    }, this.scene);
    healthBack.parent = root;
    healthBack.position.y = healthY;
    healthBack.material = healthBackMaterial;
    healthBack.isPickable = false;
    healthBack.setEnabled(false);

    const healthFill = MeshBuilder.CreateBox('p27-b10-health-fill-' + id, {
      width: 1.12,
      height: 0.09,
      depth: 0.09,
    }, this.scene);
    healthFill.parent = root;
    healthFill.position.y = healthY + 0.005;
    healthFill.material = healthMaterial;
    healthFill.isPickable = false;
    healthFill.setEnabled(false);

    const criticalBrackets = [-1, 1].map(side => {
      const bracket = MeshBuilder.CreateBox('p27-b10-critical-bracket-' + id + '-' + side, {
        width: 0.07,
        height: 0.34,
        depth: 0.08,
      }, this.scene);
      bracket.parent = root;
      bracket.position.set(side * 0.7 * scale, healthY - 0.02, 0);
      bracket.material = criticalMaterial;
      bracket.isPickable = false;
      bracket.setEnabled(false);
      return bracket;
    });

    const armorBreakBrackets = [-1, 1].map(side => {
      const bracket = MeshBuilder.CreateBox('p27-b10-armor-break-bracket-' + id + '-' + side, {
        width: 0.28,
        height: 0.06,
        depth: 0.12,
      }, this.scene);
      bracket.parent = root;
      bracket.position.set(side * 0.52 * scale, healthY - 0.22, 0);
      bracket.rotation.z = side * 0.34;
      bracket.material = armorBreakMaterial;
      bracket.isPickable = false;
      bracket.setEnabled(false);
      return bracket;
    });

    for (const mesh of [
      core,
      spawnRing,
      phaseRing,
      dangerRing,
      disabledRing,
      targetRing,
      healthBack,
      healthFill,
      ...targetSpokes,
      ...criticalBrackets,
      ...armorBreakBrackets,
    ]) {
      mesh.isPickable = false;
    }
    core.setEnabled(false);

    const visual: EnemyLifecycleVisual = {
      root,
      core,
      spawnRing,
      phaseRing,
      dangerRing,
      disabledRing,
      targetRing,
      targetSpokes,
      healthBack,
      healthFill,
      criticalBrackets,
      armorBreakBrackets,
      coreMaterial,
      spawnMaterial,
      phaseMaterial,
      dangerMaterial,
      disabledMaterial,
      targetMaterial,
      healthBackMaterial,
      healthMaterial,
      criticalMaterial,
      armorBreakMaterial,
    };
    this.visuals.set(id, visual);
    return visual;
  }

  private disposeVisual(visual: EnemyLifecycleVisual, reason: string) {
    visual.root.dispose(false, true);
    visual.coreMaterial.dispose();
    visual.spawnMaterial.dispose();
    visual.phaseMaterial.dispose();
    visual.dangerMaterial.dispose();
    visual.disabledMaterial.dispose();
    visual.targetMaterial.dispose();
    visual.healthBackMaterial.dispose();
    visual.healthMaterial.dispose();
    visual.criticalMaterial.dispose();
    visual.armorBreakMaterial.dispose();
    this.releaseCount += 1;
    this.canvas.dataset.babylonEnemyLifecycleLastRelease = reason;
  }
}
