import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Node } from '@babylonjs/core/node';
import type { Scene } from '@babylonjs/core/scene';
import {
  getBabylonGraphicsAssetRuntime,
  type BabylonGraphicsAssetInstance,
} from './babylonGraphicsAssets';
import { resolveEnemyBossAnimation } from './enemyBossAnimation';
import { ENEMY_ASSET_FAMILIES } from './graphicsAssetManifest';
import { createGraphicsAssetSpec, selectGraphicsAssetSpec, type GraphicsAssetFamily } from './graphicsAssets';
import type { GraphicsQualityMode } from './renderQuality';
import type { Enemy, SimState } from './sim';

const WORLD_SCALE = 0.02;

export const REFINERY_BOSS_ASSET_FAMILY = {
  id: ENEMY_ASSET_FAMILIES.boss.id,
  lods: {
    0: createGraphicsAssetSpec('enemy-boss-lod0', 'boss', '/assets/models/bosses/enemy-boss-lod0.glb', 0),
    1: ENEMY_ASSET_FAMILIES.boss.lods[1],
    2: ENEMY_ASSET_FAMILIES.boss.lods[2],
  },
} as const satisfies GraphicsAssetFamily;

type BossRigRest = {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scaling: { x: number; y: number; z: number };
};

type BossRig = {
  hip: TransformNode;
  torso: TransformNode;
  helmet: TransformNode;
  leftArm: TransformNode;
  rightArm: TransformNode;
  leftLeg: TransformNode;
  rightLeg: TransformNode;
  backpack: TransformNode;
  phaseNodes: TransformNode[];
  rest: Map<TransformNode, BossRigRest>;
};

export type RefineryBossPresentationTier = 'high' | 'balanced' | 'performance' | undefined;

export function refineryBossDetailScale(
  qualityMode: GraphicsQualityMode,
  runtimeTier: RefineryBossPresentationTier,
) {
  if (runtimeTier === 'performance') return 0.5;
  if (runtimeTier === 'balanced') return 0.78;
  if (runtimeTier === 'high') return 1;
  return qualityMode === 'performance' ? 0.5 : 1;
}

export function refineryBossQaPreviewEnabled(search: string) {
  return new URLSearchParams(search).get('p28d8BossQa') === '1';
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function instanceNodes(instance: BabylonGraphicsAssetInstance) {
  const nodes: Node[] = [];
  for (const root of instance.rootNodes) nodes.push(root, ...root.getDescendants(false));
  return nodes;
}

function findInstanceTransform(instance: BabylonGraphicsAssetInstance, sourceName: string) {
  const node = instanceNodes(instance).find(candidate =>
    candidate.name === sourceName || candidate.name.endsWith(`:${sourceName}`));
  return node instanceof TransformNode ? node : null;
}

function captureRest(node: TransformNode): BossRigRest {
  if (node.rotationQuaternion) {
    node.rotation.copyFrom(node.rotationQuaternion.toEulerAngles());
    node.rotationQuaternion = null;
  }
  return {
    position: { x: node.position.x, y: node.position.y, z: node.position.z },
    rotation: { x: node.rotation.x, y: node.rotation.y, z: node.rotation.z },
    scaling: { x: node.scaling.x, y: node.scaling.y, z: node.scaling.z },
  };
}

function resetNode(node: TransformNode, rest: BossRigRest) {
  node.position.set(rest.position.x, rest.position.y, rest.position.z);
  node.rotation.set(rest.rotation.x, rest.rotation.y, rest.rotation.z);
  node.scaling.set(rest.scaling.x, rest.scaling.y, rest.scaling.z);
}

function createRig(instance: BabylonGraphicsAssetInstance): BossRig | null {
  const hip = findInstanceTransform(instance, 'hip');
  const torso = findInstanceTransform(instance, 'torso');
  const helmet = findInstanceTransform(instance, 'helmet');
  const leftArm = findInstanceTransform(instance, 'arm-left');
  const rightArm = findInstanceTransform(instance, 'arm-right');
  const leftLeg = findInstanceTransform(instance, 'leg-left');
  const rightLeg = findInstanceTransform(instance, 'leg-right');
  const backpack = findInstanceTransform(instance, 'backpack');
  if (!hip || !torso || !helmet || !leftArm || !rightArm || !leftLeg || !rightLeg || !backpack) return null;

  const phaseNodes = [
    'boss-reactor',
    'boss-command-crest',
    'boss-phase-anchor-left',
    'boss-phase-anchor-right',
  ].map(name => findInstanceTransform(instance, name)).filter((node): node is TransformNode => !!node);
  const animatedNodes = [hip, torso, helmet, leftArm, rightArm, leftLeg, rightLeg, backpack, ...phaseNodes];
  return {
    hip,
    torso,
    helmet,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    backpack,
    phaseNodes,
    rest: new Map(animatedNodes.map(node => [node, captureRest(node)])),
  };
}

export class BabylonRefineryBossPresentation {
  private readonly root: TransformNode;
  private fallbackRoot: TransformNode | null = null;
  private fallbackMaterial: StandardMaterial | null = null;
  private readonly runtime;
  private readonly qaPreview: boolean;
  private instance: BabylonGraphicsAssetInstance | null = null;
  private assetMount: TransformNode | null = null;
  private rig: BossRig | null = null;
  private assetSignature = '';
  private loadGeneration = 0;
  private disposed = false;
  private bossId: number | null = null;
  private lastBossPhase = 1;
  private phaseChangedAt = -1;
  private lastTelegraph = 0;
  private attackEventAt = -1;

  constructor(
    private readonly scene: Scene,
    private readonly canvas: HTMLCanvasElement,
  ) {
    this.runtime = getBabylonGraphicsAssetRuntime(scene);
    this.qaPreview = typeof location !== 'undefined' && refineryBossQaPreviewEnabled(location.search);
    this.root = new TransformNode('p28-d8-refinery-boss-root', scene);
    this.root.setEnabled(false);
    this.canvas.dataset.babylonBossPresentation = 'ready:idle';
    this.canvas.dataset.babylonBossAsset = 'none';
    this.canvas.dataset.babylonBossPhaseCue = 'idle';
    this.canvas.dataset.babylonBossQaPreview = this.qaPreview ? 'enabled' : 'disabled';
  }

  sync(
    state: SimState,
    qualityMode: GraphicsQualityMode,
  ) {
    if (this.disposed || this.scene.isDisposed) return;
    const runtimeTier = this.canvas.dataset.renderTier as RefineryBossPresentationTier;
    const detailScale = refineryBossDetailScale(qualityMode, runtimeTier);
    const boss = state.enemies.find(enemy => enemy.role === 'boss' && enemy.active);
    if (!boss) {
      if (!this.qaPreview) {
        this.root.setEnabled(false);
        this.canvas.dataset.babylonBossPhaseCue = 'inactive';
        return;
      }
      this.root.setEnabled(true);
      this.ensureAsset(detailScale);
      this.syncQaPreview(state, detailScale);
      return;
    }

    this.root.setEnabled(true);
    this.syncIdentity(state, boss);
    this.ensureAsset(detailScale);

    this.root.position.set(boss.x * WORLD_SCALE, 0, boss.y * WORLD_SCALE);
    const direction = boss.telegraph > 0 ? boss.telegraphAim : { x: boss.vx, y: boss.vy };
    if (Math.hypot(direction.x, direction.y) > 0.01) this.root.rotation.y = Math.atan2(-direction.y, direction.x);

    if (this.lastTelegraph > 0 && boss.telegraph <= 0 && !boss.dead && boss.statuses.disrupted <= 0 && boss.statuses.stagger <= 0) {
      this.attackEventAt = state.time;
    }
    this.lastTelegraph = boss.telegraph;

    const motion = resolveEnemyBossAnimation({
      role: 'boss',
      id: boss.id,
      time: state.time,
      vx: boss.vx,
      vy: boss.vy,
      telegraph: boss.telegraph,
      sinceAttack: this.attackEventAt >= 0 ? state.time - this.attackEventAt : -1,
      sincePhaseChange: this.phaseChangedAt >= 0 ? state.time - this.phaseChangedAt : -1,
      combatClass: boss.combatClass,
      protocolPulse: boss.protocolPulse,
      modifierCount: boss.protocols.length + boss.mutations.length + boss.commandTargetMutations.length + boss.bossPhaseMutations.length,
      anchored: boss.anchored,
      statuses: boss.statuses,
      bossPhase: boss.bossPhase,
      dead: boss.dead,
    });

    if (this.rig) this.syncRig(this.rig, boss, motion);
    if (boss.dead) this.root.rotation.z = (boss.id % 2 === 0 ? -1 : 1) * 0.82 * clamp01(1 - boss.deathT);
    else this.root.rotation.z = 0;

    this.canvas.dataset.babylonBossPhaseCue = `${motion.phase}:phase-${boss.bossPhase}`;
    this.canvas.dataset.babylonBossCueTiming = 'enemyBossAnimation:unchanged';
    this.canvas.dataset.babylonBossDetailScale = detailScale.toFixed(2);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.loadGeneration += 1;
    this.releaseAsset();
    this.fallbackRoot?.dispose();
    this.fallbackRoot = null;
    this.root.dispose();
    this.fallbackMaterial?.dispose();
    this.fallbackMaterial = null;
    this.canvas.dataset.babylonBossPresentation = 'disposed';
  }

  private syncQaPreview(state: SimState, detailScale: number) {
    this.root.position.set((state.player.x + 120) * WORLD_SCALE, 0, (state.player.y - 30) * WORLD_SCALE);
    this.root.rotation.set(0, -0.95, 0);
    if (this.rig) {
      for (const [node, rest] of this.rig.rest) resetNode(node, rest);
      this.rig.hip.position.y += 0.18;
      this.rig.torso.position.y += 0.06;
      this.rig.torso.rotation.z -= 0.08;
      this.rig.leftArm.rotation.z -= 0.18;
      this.rig.rightArm.rotation.z += 0.24;
      this.rig.helmet.rotation.z -= 0.04;
      this.rig.backpack.rotation.x += 0.08;
      for (const node of this.rig.phaseNodes) {
        const rest = this.rig.rest.get(node);
        if (!rest) continue;
        node.scaling.set(rest.scaling.x * 1.28, rest.scaling.y * 1.28, rest.scaling.z * 1.28);
      }
    }
    this.canvas.dataset.babylonBossPhaseCue = 'qa-preview:phase-2';
    this.canvas.dataset.babylonBossCueTiming = 'enemyBossAnimation:unchanged';
    this.canvas.dataset.babylonBossDetailScale = detailScale.toFixed(2);
  }

  private syncIdentity(state: SimState, boss: Enemy) {
    if (this.bossId !== boss.id) {
      this.bossId = boss.id;
      this.lastBossPhase = boss.bossPhase;
      this.phaseChangedAt = boss.bossPhase === 2 ? state.time : -1;
      this.lastTelegraph = boss.telegraph;
      this.attackEventAt = -1;
      return;
    }
    if (boss.bossPhase !== this.lastBossPhase) {
      this.lastBossPhase = boss.bossPhase;
      this.phaseChangedAt = state.time;
    }
  }

  private ensureAsset(detailScale: number) {
    const spec = selectGraphicsAssetSpec(REFINERY_BOSS_ASSET_FAMILY, detailScale);
    if (!spec) return;
    const signature = `${spec.id}:${detailScale.toFixed(2)}`;
    if (signature === this.assetSignature) return;
    this.assetSignature = signature;
    const generation = ++this.loadGeneration;
    this.releaseAsset();
    const fallbackRoot = this.ensureFallback();
    fallbackRoot.setEnabled(true);
    this.canvas.dataset.babylonBossPresentation = `loading:${spec.id}`;
    this.canvas.dataset.babylonBossAsset = spec.id;

    void this.runtime.instantiate(spec).then(instance => {
      if (this.disposed || this.scene.isDisposed || generation !== this.loadGeneration) {
        instance.release();
        return;
      }
      const mount = new TransformNode(`p28-d8-refinery-boss-${generation}`, this.scene);
      mount.parent = this.root;
      mount.setEnabled(false);
      instance.rootNodes.forEach(node => { node.parent = mount; });
      const rig = createRig(instance);
      if (!rig) {
        instance.release();
        mount.dispose();
        throw new Error(`Boss asset ${spec.id} is missing the shared articulated rig`);
      }
      this.instance = instance;
      this.assetMount = mount;
      this.rig = rig;
      this.fallbackRoot?.setEnabled(false);
      mount.setEnabled(true);
      this.canvas.dataset.babylonBossPresentation = `authored:${spec.id}`;
      this.canvas.dataset.babylonBossAsset = spec.id;
      this.canvas.dataset.babylonBossRig = rig.phaseNodes.length === 4 ? 'articulated+phase-anchors' : 'articulated';
    }).catch(error => {
      if (this.disposed || generation !== this.loadGeneration) return;
      this.canvas.dataset.babylonBossPresentation = 'ready:fallback';
      this.canvas.dataset.babylonBossFallbackReason = error instanceof Error ? error.message : String(error);
      this.ensureFallback().setEnabled(true);
    });
  }

  private releaseAsset() {
    this.instance?.release();
    this.instance = null;
    this.assetMount?.dispose();
    this.assetMount = null;
    this.rig = null;
  }

  private syncRig(rig: BossRig, boss: Enemy, motion: ReturnType<typeof resolveEnemyBossAnimation>) {
    for (const [node, rest] of rig.rest) resetNode(node, rest);

    const profile = motion.profile;
    rig.hip.position.y += motion.idle + profile.phaseRise * motion.phaseTransition;
    rig.leftLeg.rotation.z += motion.gait * 0.42;
    rig.rightLeg.rotation.z -= motion.gait * 0.42;
    rig.leftArm.rotation.z += profile.leftArm - motion.gait * 0.075;
    rig.rightArm.rotation.z += profile.rightArm + motion.gait * 0.065;
    rig.torso.rotation.z += profile.torsoLean;

    if (motion.tell > 0) {
      rig.torso.rotation.z += profile.tellLean * motion.tell;
      rig.torso.position.y += profile.tellLift * motion.tell;
      rig.rightArm.rotation.z -= profile.tellReach * motion.tell;
      rig.helmet.rotation.z -= 0.05 * motion.tell;
    }
    if (motion.commit > 0) {
      rig.torso.rotation.z -= profile.commitKick * motion.commit;
      rig.rightArm.rotation.z += profile.commitKick * 0.72 * motion.commit;
      rig.leftArm.rotation.z -= profile.commitKick * 0.28 * motion.commit;
    }
    if (motion.recovery > 0) {
      rig.torso.rotation.z += profile.commitKick * 0.12 * motion.recovery;
      rig.rightArm.rotation.z += profile.commitKick * 0.18 * motion.recovery;
    }
    if (motion.modifier > 0) {
      const tension = profile.modifierTension * motion.modifier;
      rig.leftArm.rotation.z -= tension;
      rig.rightArm.rotation.z += tension;
      rig.torso.rotation.x += tension * 0.32;
    }

    const phasePulse = motion.phaseTransition;
    const phaseSettled = boss.bossPhase === 2 ? 1 : 0;
    rig.torso.position.y += phasePulse * 0.045;
    rig.helmet.position.y += phasePulse * 0.035;
    rig.backpack.rotation.x += phasePulse * 0.08;
    for (let index = 0; index < rig.phaseNodes.length; index += 1) {
      const node = rig.phaseNodes[index];
      const rest = rig.rest.get(node);
      if (!rest) continue;
      const symmetricBeat = index < 2 ? 1 : 0.92;
      const scale = 1 + phaseSettled * 0.04 + phasePulse * 0.26 * symmetricBeat;
      node.scaling.set(rest.scaling.x * scale, rest.scaling.y * scale, rest.scaling.z * scale);
    }

    if (motion.status.stagger > 0) {
      const side = boss.id % 2 === 0 ? 1 : -1;
      rig.torso.rotation.z += side * 0.18 * motion.status.stagger;
      rig.helmet.rotation.z -= side * 0.12 * motion.status.stagger;
      rig.hip.position.x -= 0.05 * motion.status.stagger;
    }
    if (motion.status.disrupted > 0) {
      const tremor = Math.sin(boss.id * 0.71 + motion.status.disrupted * 11);
      rig.torso.rotation.x += tremor * 0.025 * motion.status.disrupted;
      rig.leftArm.rotation.z += tremor * 0.04 * motion.status.disrupted;
      rig.rightArm.rotation.z -= tremor * 0.04 * motion.status.disrupted;
    }
  }

  private ensureFallback() {
    if (this.fallbackRoot) return this.fallbackRoot;
    const fallbackRoot = new TransformNode('p28-d8-refinery-boss-fallback', this.scene);
    fallbackRoot.parent = this.root;
    const fallbackMaterial = new StandardMaterial('p28-d8-refinery-boss-fallback-material', this.scene);
    fallbackMaterial.diffuseColor = Color3.FromInts(111, 43, 35);
    fallbackMaterial.specularColor = Color3.FromInts(92, 75, 62);
    this.fallbackRoot = fallbackRoot;
    this.fallbackMaterial = fallbackMaterial;
    this.createFallbackGeometry(fallbackRoot, fallbackMaterial);
    return fallbackRoot;
  }

  private createFallbackGeometry(fallbackRoot: TransformNode, fallbackMaterial: StandardMaterial) {
    const body = MeshBuilder.CreateBox('p28-d8-boss-fallback-body', { width: 0.82, height: 1.28, depth: 0.72 }, this.scene);
    body.position.y = 0.72;
    body.parent = fallbackRoot;
    body.material = fallbackMaterial;
    for (const side of [-1, 1]) {
      const shoulder = MeshBuilder.CreateBox(`p28-d8-boss-fallback-shoulder-${side}`, { width: 0.38, height: 0.28, depth: 0.46 }, this.scene);
      shoulder.position.set(0, 1.16, side * 0.56);
      shoulder.parent = fallbackRoot;
      shoulder.material = fallbackMaterial;
    }
    const crest = MeshBuilder.CreateBox('p28-d8-boss-fallback-crest', { width: 0.18, height: 0.54, depth: 0.18 }, this.scene);
    crest.position.set(0, 1.66, 0);
    crest.parent = fallbackRoot;
    crest.material = fallbackMaterial;
  }
}
