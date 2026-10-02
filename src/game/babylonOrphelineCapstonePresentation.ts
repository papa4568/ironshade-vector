import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { Contract } from './campaign';
import {
  orphelineRenderProfile,
  orphelineStageIdentity,
  type OrphelineStageNumber,
} from './orphelineCapstone';
import type { RenderBudgetSnapshot } from './renderQuality';
import { getWorldSize, type CombatObject, type Hazard, type SimState } from './sim';

const WORLD_SCALE = 0.02;
const MAX_STAGE_PROPS = 8;

export const BABYLON_ORPHELINE_CAPSTONE_IDENTITY = Object.freeze({
  megastructure: 'hidden-habitat:orpheline',
  continuity: 'rock-cut-spine+violet-utility-trunk+white-occupancy-marks',
  readability: 'violet-datum+white-occupancy+shape-coded-risk',
  boss: 'orpheline-habitat-warden',
});

export function orphelineInteractableCue(kind: CombatObject['kind']) {
  if (kind === 'doorControl' || kind === 'sealControl') return 'concealment-lock' as const;
  if (kind === 'gravityControl' || kind === 'anchorNode') return 'spin-authority' as const;
  if (kind === 'powerControl' || kind === 'conduit') return 'utility-bus' as const;
  if (kind === 'coolant' || kind === 'breachPlate') return 'pressure-route' as const;
  if (kind === 'salvageNode') return 'archive-recovery' as const;
  return null;
}

export function orphelineHazardCue(kind: Hazard['kind']) {
  if (kind === 'gravityWell') return 'warden-gravity-override' as const;
  if (kind === 'shockGrid') return 'archive-shutter-grid' as const;
  if (kind === 'vacuumWake') return 'shelter-pressure-purge' as const;
  if (kind === 'vectorWash') return 'habitat-vector-shear' as const;
  return 'service-vent' as const;
}

export function orphelineWardenCueState(
  state: Pick<SimState, 'bossActive' | 'bossDefeated' | 'enemies'>,
) {
  if (state.bossDefeated) return 'defeated' as const;
  const warden = state.enemies.find(enemy => enemy.role === 'boss' && enemy.variant === 'orphelineWarden');
  if (!warden || !state.bossActive || !warden.active || warden.dead) return 'queued' as const;
  return `active-phase-${warden.bossPhase}:${warden.bossPattern}`;
}

function scaled(value: number) {
  return value * WORLD_SCALE;
}

function colorFromHex(hex: number) {
  return Color3.FromInts((hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff);
}

function material(
  scene: Scene,
  name: string,
  color: number,
  emissive = 0,
  emissiveIntensity = 0,
  alpha = 1,
) {
  const result = new StandardMaterial(name, scene);
  result.diffuseColor = colorFromHex(color);
  result.emissiveColor = colorFromHex(emissive).scale(emissiveIntensity);
  result.specularColor = colorFromHex(0x24272a);
  result.alpha = alpha;
  if (alpha < 1) {
    result.disableLighting = true;
    result.backFaceCulling = false;
  }
  return result;
}

function box(
  scene: Scene,
  parent: TransformNode,
  name: string,
  meshMaterial: StandardMaterial,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
) {
  const mesh = MeshBuilder.CreateBox(name, { width, height, depth }, scene);
  mesh.parent = parent;
  mesh.position.set(x, y, z);
  mesh.material = meshMaterial;
  mesh.isPickable = false;
  return mesh;
}

function setEnabledCount(items: readonly TransformNode[], count: number) {
  items.forEach((item, index) => item.setEnabled(index < count));
}

type CueRig = {
  root: TransformNode;
  ring: Mesh;
  stem: Mesh;
};

function buildCueRig(
  scene: Scene,
  parent: TransformNode,
  name: string,
  meshMaterial: StandardMaterial,
): CueRig {
  const root = new TransformNode(name, scene);
  root.parent = parent;
  const ring = MeshBuilder.CreateTorus(name + '-ring', { diameter: 1.16, thickness: 0.08, tessellation: 24 }, scene);
  ring.parent = root;
  ring.position.y = 0.08;
  ring.rotation.x = Math.PI / 2;
  ring.material = meshMaterial;
  ring.isPickable = false;
  const stem = box(scene, root, name + '-stem', meshMaterial, 0, 0.64, 0, 0.08, 1.12, 0.08);
  root.setEnabled(false);
  return { root, ring, stem };
}

export class BabylonOrphelineCapstonePresentation {
  private readonly root: TransformNode;
  private readonly continuityRoot: TransformNode;
  private readonly rockRibs: TransformNode[] = [];
  private readonly utilityLights: TransformNode[] = [];
  private readonly stageRoots = new Map<OrphelineStageNumber, TransformNode>();
  private readonly stageProps = new Map<OrphelineStageNumber, TransformNode[]>();
  private readonly interactableCues: CueRig[] = [];
  private readonly hazardCues: CueRig[] = [];
  private readonly bossRoot: TransformNode;
  private readonly bossRings: Mesh[] = [];
  private readonly materials: StandardMaterial[] = [];
  private released = true;

  constructor(
    private readonly scene: Scene,
    private readonly canvas: HTMLCanvasElement,
    private readonly coarse: boolean,
  ) {
    const world = getWorldSize();
    const worldW = scaled(world.w);
    const worldH = scaled(world.h);
    const cx = worldW * 0.5;
    const cz = worldH * 0.5;

    this.root = new TransformNode('p27-c13-orpheline-capstone', scene);
    this.continuityRoot = new TransformNode('p27-c13-orpheline-continuity', scene);
    this.continuityRoot.parent = this.root;

    const rock = material(scene, 'p27-c13-orpheline-rock', 0x30383d);
    const patched = material(scene, 'p27-c13-orpheline-patched', 0x697276);
    const utility = material(scene, 'p27-c13-orpheline-utility', 0x9a78d5, 0x7044aa, 0.62);
    const occupancy = material(scene, 'p27-c13-orpheline-occupancy', 0xd9d7cd, 0x77736a, 0.18);
    const interactable = material(scene, 'p27-c13-orpheline-interactable', 0xb69be2, 0x8254bd, 0.74, 0.72);
    const hazard = material(scene, 'p27-c13-orpheline-hazard', 0xe19766, 0xe66f44, 0.84, 0.62);
    const warden = material(scene, 'p27-c13-orpheline-warden', 0xd8cbe8, 0x8e63bf, 0.94, 0.68);
    this.materials.push(rock, patched, utility, occupancy, interactable, hazard, warden);

    box(scene, this.continuityRoot, 'p27-c13-orpheline-rock-cut-spine', rock, cx, 0.28, cz, worldW * 0.74, 0.20, scaled(22));
    box(scene, this.continuityRoot, 'p27-c13-orpheline-utility-trunk', utility, cx, 0.46, cz + scaled(22), worldW * 0.66, 0.09, scaled(7));

    for (let index = 0; index < 7; index += 1) {
      const rib = new TransformNode('p27-c13-orpheline-rib-' + index, scene);
      rib.parent = this.continuityRoot;
      const t = index / 6;
      const x = worldW * (0.18 + t * 0.64);
      const ribMaterial = index % 2 === 0 ? rock : patched;
      box(scene, rib, 'p27-c13-orpheline-rib-port-' + index, ribMaterial, x, 0.36, worldH * 0.18, scaled(16), 0.66, worldH * 0.16);
      box(scene, rib, 'p27-c13-orpheline-rib-starboard-' + index, ribMaterial, x, 0.36, worldH * 0.82, scaled(16), 0.66, worldH * 0.16);
      this.rockRibs.push(rib);
    }

    for (let index = 0; index < 10; index += 1) {
      const guide = new TransformNode('p27-c13-orpheline-guide-' + index, scene);
      guide.parent = this.continuityRoot;
      const t = index / 9;
      box(
        scene,
        guide,
        'p27-c13-orpheline-guide-mesh-' + index,
        index % 3 === 0 ? occupancy : utility,
        worldW * (0.20 + t * 0.60),
        0.50,
        cz,
        scaled(7),
        0.055,
        scaled(4),
      );
      this.utilityLights.push(guide);
    }

    this.buildStageOne(worldW, worldH, cz, rock, patched);
    this.buildStageTwo(worldW, worldH, patched);
    this.buildStageThree(worldW, worldH, occupancy);
    this.buildStageFour(worldW, worldH, cz, occupancy, utility);

    const cueRoot = new TransformNode('p27-c13-orpheline-interactable-cues', scene);
    cueRoot.parent = this.root;
    for (let index = 0; index < 12; index += 1) {
      this.interactableCues.push(buildCueRig(scene, cueRoot, 'p27-c13-orpheline-interactable-' + index, interactable));
    }

    const hazardRoot = new TransformNode('p27-c13-orpheline-hazard-cues', scene);
    hazardRoot.parent = this.root;
    for (let index = 0; index < 12; index += 1) {
      this.hazardCues.push(buildCueRig(scene, hazardRoot, 'p27-c13-orpheline-hazard-' + index, hazard));
    }

    this.bossRoot = new TransformNode('p27-c13-orpheline-warden-cue', scene);
    this.bossRoot.parent = this.root;
    for (let index = 0; index < 3; index += 1) {
      const ring = MeshBuilder.CreateTorus(
        'p27-c13-orpheline-warden-authority-ring-' + index,
        { diameter: 2.08 + index * 0.40, thickness: 0.10, tessellation: 32 },
        scene,
      );
      ring.parent = this.bossRoot;
      ring.position.y = 1.02 + index * 0.22;
      ring.rotation.x = Math.PI / 2;
      ring.rotation.y = index * 0.28;
      ring.material = warden;
      ring.isPickable = false;
      this.bossRings.push(ring);
    }
    const bossCore = MeshBuilder.CreateSphere('p27-c13-orpheline-warden-command-core', { diameter: 0.70, segments: 12 }, scene);
    bossCore.parent = this.bossRoot;
    bossCore.position.y = 0.80;
    bossCore.material = warden;
    bossCore.isPickable = false;
    this.bossRoot.setEnabled(false);
    this.root.setEnabled(false);
  }

  private buildStageOne(
    worldW: number,
    worldH: number,
    cz: number,
    rock: StandardMaterial,
    patched: StandardMaterial,
  ) {
    const accent = material(this.scene, 'p27-c13-orpheline-stage-1', 0x91b8c4, 0x315966, 0.30);
    this.materials.push(accent);
    const root = new TransformNode('p27-c13-orpheline-stage-1-ice-access-bore', this.scene);
    root.parent = this.root;
    const bore = MeshBuilder.CreateTorus(
      'p27-c13-orpheline-thermal-cut-bore',
      { diameter: scaled(156), thickness: scaled(20), tessellation: 30 },
      this.scene,
    );
    bore.parent = root;
    bore.rotation.x = Math.PI / 2;
    bore.position.set(worldW * 0.20, 0.65, cz);
    bore.material = accent;
    bore.isPickable = false;
    const props: TransformNode[] = [];
    for (let index = 0; index < MAX_STAGE_PROPS; index += 1) {
      const prop = new TransformNode('p27-c13-orpheline-stage-1-shutter-' + index, this.scene);
      prop.parent = root;
      box(
        this.scene,
        prop,
        'p27-c13-orpheline-stage-1-shutter-mesh-' + index,
        index % 2 === 0 ? patched : rock,
        worldW * (0.29 + (index % 4) * 0.12),
        0.42,
        worldH * (index < 4 ? 0.30 : 0.70),
        scaled(18),
        0.58,
        scaled(48),
      );
      props.push(prop);
    }
    this.stageRoots.set(1, root);
    this.stageProps.set(1, props);
  }

  private buildStageTwo(worldW: number, worldH: number, patched: StandardMaterial) {
    const accent = material(this.scene, 'p27-c13-orpheline-stage-2', 0xc28a58, 0x74451f, 0.30);
    this.materials.push(accent);
    const root = new TransformNode('p27-c13-orpheline-stage-2-industrial-commons', this.scene);
    root.parent = this.root;
    const props: TransformNode[] = [];
    for (let index = 0; index < MAX_STAGE_PROPS; index += 1) {
      const prop = new TransformNode('p27-c13-orpheline-stage-2-fabrication-stall-' + index, this.scene);
      prop.parent = root;
      box(
        this.scene,
        prop,
        'p27-c13-orpheline-stage-2-fabrication-stall-mesh-' + index,
        index % 2 === 0 ? accent : patched,
        worldW * (0.25 + (index % 4) * 0.16),
        0.40,
        worldH * (index < 4 ? 0.30 : 0.70),
        worldW * 0.105,
        0.48,
        scaled(30),
      );
      props.push(prop);
    }
    this.stageRoots.set(2, root);
    this.stageProps.set(2, props);
  }

  private buildStageThree(worldW: number, worldH: number, occupancy: StandardMaterial) {
    const accent = material(this.scene, 'p27-c13-orpheline-stage-3', 0x7da98f, 0x315c45, 0.30);
    this.materials.push(accent);
    const root = new TransformNode('p27-c13-orpheline-stage-3-residential-spin-ring', this.scene);
    root.parent = this.root;
    const props: TransformNode[] = [];
    for (let index = 0; index < MAX_STAGE_PROPS; index += 1) {
      const prop = new TransformNode('p27-c13-orpheline-stage-3-hab-pod-' + index, this.scene);
      prop.parent = root;
      const pod = MeshBuilder.CreateCylinder(
        'p27-c13-orpheline-stage-3-hab-pod-mesh-' + index,
        { diameter: scaled(30), height: scaled(56), tessellation: 10 },
        this.scene,
      );
      pod.parent = prop;
      pod.rotation.z = Math.PI / 2;
      pod.position.set(worldW * (0.25 + (index % 4) * 0.16), 0.50, worldH * (index < 4 ? 0.29 : 0.71));
      pod.material = index % 2 === 0 ? occupancy : accent;
      pod.isPickable = false;
      props.push(prop);
    }
    this.stageRoots.set(3, root);
    this.stageProps.set(3, props);
  }

  private buildStageFour(
    worldW: number,
    worldH: number,
    cz: number,
    occupancy: StandardMaterial,
    utility: StandardMaterial,
  ) {
    const accent = material(this.scene, 'p27-c13-orpheline-stage-4', 0xa98bc4, 0x65417d, 0.30);
    this.materials.push(accent);
    const root = new TransformNode('p27-c13-orpheline-stage-4-buried-control-vault', this.scene);
    root.parent = this.root;
    const props: TransformNode[] = [];
    for (let index = 0; index < MAX_STAGE_PROPS; index += 1) {
      const prop = new TransformNode('p27-c13-orpheline-stage-4-archive-wall-' + index, this.scene);
      prop.parent = root;
      box(
        this.scene,
        prop,
        'p27-c13-orpheline-stage-4-archive-wall-mesh-' + index,
        index % 2 === 0 ? occupancy : accent,
        worldW * (0.25 + (index % 4) * 0.16),
        0.50,
        worldH * (index < 4 ? 0.29 : 0.71),
        scaled(34),
        0.82,
        scaled(54),
      );
      props.push(prop);
    }
    const founderSeal = MeshBuilder.CreateTorus(
      'p27-c13-orpheline-founder-seal',
      { diameter: scaled(112), thickness: scaled(16), tessellation: 28 },
      this.scene,
    );
    founderSeal.parent = root;
    founderSeal.rotation.x = Math.PI / 2;
    founderSeal.position.set(worldW * 0.78, 0.78, cz);
    founderSeal.material = utility;
    founderSeal.isPickable = false;
    this.stageRoots.set(4, root);
    this.stageProps.set(4, props);
  }

  sync(state: SimState, renderBudget: RenderBudgetSnapshot, mission: Contract) {
    const stage = orphelineStageIdentity(mission);
    if (!stage) {
      this.release('not-orpheline');
      return;
    }

    this.released = false;
    this.root.setEnabled(true);
    const profile = orphelineRenderProfile(renderBudget.detailScale, this.coarse);
    setEnabledCount(this.rockRibs, profile.rockRibs);
    setEnabledCount(this.utilityLights, profile.utilityLights);

    for (const [stageNumber, root] of this.stageRoots) {
      root.setEnabled(stageNumber === stage.stage);
    }
    setEnabledCount(this.stageProps.get(stage.stage) ?? [], profile.stageProps);

    const interactables = state.objects.filter(object => object.active && !!orphelineInteractableCue(object.kind));
    this.interactableCues.forEach((cue, index) => {
      const object = interactables[index];
      cue.root.setEnabled(!!object);
      if (!object) return;
      cue.root.position.set(scaled(object.x + object.w / 2), 0, scaled(object.y + object.h / 2));
      const pulse = object.exposed ? 1.18 : object.hp < object.maxHp ? 1.08 : 1;
      cue.ring.scaling.set(pulse, pulse, pulse);
      cue.stem.scaling.y = object.exposed ? 1.22 : 1;
    });

    const activeHazards = state.hazards.filter(hazardItem => hazardItem.active && hazardItem.life > 0);
    this.hazardCues.forEach((cue, index) => {
      const hazardItem = activeHazards[index];
      cue.root.setEnabled(!!hazardItem);
      if (!hazardItem) return;
      cue.root.position.set(scaled(hazardItem.x), 0, scaled(hazardItem.y));
      const diameter = Math.max(0.8, scaled(hazardItem.radius * 2));
      cue.ring.scaling.set(diameter, diameter, diameter);
      cue.stem.scaling.y = 0.72 + Math.min(1.2, hazardItem.life * 0.08);
      cue.root.rotation.y = state.time * 0.50 + index * 0.39;
    });

    const warden = state.enemies.find(enemy => enemy.role === 'boss' && enemy.variant === 'orphelineWarden');
    const bossActive = stage.stage === 4 && !!warden && state.bossActive && warden.active && !warden.dead;
    this.bossRoot.setEnabled(bossActive);
    if (bossActive && warden) {
      this.bossRoot.position.set(scaled(warden.x), 0, scaled(warden.y));
      const phaseScale = warden.bossPhase === 2 ? 1.18 : 1;
      this.bossRoot.scaling.set(phaseScale, phaseScale, phaseScale);
      this.bossRings.forEach((ring, index) => {
        ring.rotation.y = state.time * (0.32 + index * 0.08) * (index % 2 === 0 ? 1 : -1);
      });
    }

    const activeInteractableKinds = [...new Set(interactables.map(object => orphelineInteractableCue(object.kind)).filter(Boolean))];
    const activeHazardKinds = [...new Set(activeHazards.map(hazardItem => orphelineHazardCue(hazardItem.kind)))];
    this.canvas.dataset.babylonOrphelineState = 'ready';
    this.canvas.dataset.babylonOrphelineParity = 'stage-identity+rock-cut-continuity+stage-props+interactables+hazards+warden-cues+shared-location-foundations';
    this.canvas.dataset.megastructureVisual = 'procedural-orpheline-capstone-babylon';
    this.canvas.dataset.megastructureIdentity = BABYLON_ORPHELINE_CAPSTONE_IDENTITY.megastructure;
    this.canvas.dataset.megastructureStage = `${stage.stage}:${stage.code}:${stage.name.toLowerCase().replaceAll(' ', '-')}`;
    this.canvas.dataset.megastructureContinuity = BABYLON_ORPHELINE_CAPSTONE_IDENTITY.continuity;
    this.canvas.dataset.megastructureStageKit = stage.kit.join('+');
    this.canvas.dataset.megastructureStagePurpose = stage.purpose;
    this.canvas.dataset.megastructureStageContinuity = stage.continuity;
    this.canvas.dataset.megastructureStageEvents = stage.eventA + '|' + stage.eventB;
    this.canvas.dataset.megastructureBatching = 'continuity-pairs+pooled-stage-cues';
    this.canvas.dataset.megastructureContinuityDrawCalls = 'babylon-shared-geometry';
    this.canvas.dataset.megastructurePerformanceProfile = `${profile.name}:ribs-${profile.rockRibs}:guides-${profile.utilityLights}:props-${profile.stageProps}:shadows-${profile.castStructuralShadows ? 'on' : 'off'}`;
    this.canvas.dataset.megastructureReadability = BABYLON_ORPHELINE_CAPSTONE_IDENTITY.readability;
    this.canvas.dataset.megastructureInteractableCues = String(Math.min(interactables.length, this.interactableCues.length));
    this.canvas.dataset.megastructureInteractableLanguage = activeInteractableKinds.join('+') || 'shared-world-cues';
    this.canvas.dataset.megastructureHazardCues = String(Math.min(activeHazards.length, this.hazardCues.length));
    this.canvas.dataset.megastructureHazardLanguage = activeHazardKinds.join('+') || 'shared-world-cues';
    this.canvas.dataset.megastructureBossPresentation = BABYLON_ORPHELINE_CAPSTONE_IDENTITY.boss;
    this.canvas.dataset.megastructureBossCue = 'founder-seal+warden-authority-rings+violet-command-core';
    this.canvas.dataset.megastructureBossCueState = orphelineWardenCueState(state);
    this.canvas.dataset.megastructurePlayerPosition = `${state.player.x.toFixed(1)},${state.player.y.toFixed(1)}`;
  }

  release(reason: string) {
    if (this.released) return;
    this.released = true;
    this.root.setEnabled(false);
    this.bossRoot.setEnabled(false);
    this.interactableCues.forEach(cue => cue.root.setEnabled(false));
    this.hazardCues.forEach(cue => cue.root.setEnabled(false));
    this.canvas.dataset.babylonOrphelineState = 'released';
    this.canvas.dataset.babylonOrphelineRelease = reason;
    for (const key of [
      'babylonOrphelineParity',
      'megastructureVisual',
      'megastructureIdentity',
      'megastructureStage',
      'megastructureContinuity',
      'megastructureStageKit',
      'megastructureStagePurpose',
      'megastructureStageContinuity',
      'megastructureStageEvents',
      'megastructureBatching',
      'megastructureContinuityDrawCalls',
      'megastructurePerformanceProfile',
      'megastructureReadability',
      'megastructureInteractableCues',
      'megastructureInteractableLanguage',
      'megastructureHazardCues',
      'megastructureHazardLanguage',
      'megastructureBossPresentation',
      'megastructureBossCue',
      'megastructureBossCueState',
      'megastructurePlayerPosition',
    ] as const) {
      delete this.canvas.dataset[key];
    }
  }

  dispose() {
    this.release('dispose');
    this.root.dispose(false, true);
    this.materials.forEach(item => item.dispose());
  }
}
