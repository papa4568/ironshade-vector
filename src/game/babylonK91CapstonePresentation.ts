import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { Contract } from './campaign';
import {
  k91RenderProfile,
  k91StageIdentity,
  type K91StageNumber,
} from './k91Capstone';
import type { RenderBudgetSnapshot } from './renderQuality';
import { getWorldSize, type CombatObject, type Hazard, type SimState } from './sim';

const WORLD_SCALE = 0.02;
const MAX_STAGE_PROPS = 8;

export const BABYLON_K91_CAPSTONE_IDENTITY = Object.freeze({
  megastructure: 'counterweight:k-91',
  continuity: 'load-spine+countermass-rails+amber-inertial-datum',
  readability: 'amber-datum+opposed-mass-rails+shape-coded-risk',
  capstone: 'ballast-telemetry-blackbox',
});

export function k91InteractableCue(kind: CombatObject['kind']) {
  if (kind === 'doorControl' || kind === 'sealControl') return 'capture-lock' as const;
  if (kind === 'gravityControl' || kind === 'anchorNode') return 'mass-trim' as const;
  if (kind === 'powerControl' || kind === 'conduit') return 'lift-bus' as const;
  if (kind === 'coolant' || kind === 'breachPlate') return 'service-risk' as const;
  if (kind === 'salvageNode') return 'telemetry-recovery' as const;
  return null;
}

export function k91HazardCue(kind: Hazard['kind']) {
  if (kind === 'gravityWell') return 'tumble-shear' as const;
  if (kind === 'shockGrid') return 'lift-bus-arc' as const;
  if (kind === 'vacuumWake') return 'pressure-wake' as const;
  if (kind === 'vectorWash') return 'countermass-recoil' as const;
  return 'service-vent' as const;
}

export function k91BlackboxCueState(
  state: Pick<SimState, 'objects'>,
  stage: K91StageNumber,
) {
  if (stage !== 4) return `transit-stage-${stage}`;
  const blackbox = state.objects.find(object =>
    object.active && (object.kind === 'salvageNode' || object.kind === 'anchorNode')
  );
  if (!blackbox) return 'ballast-vault-ready' as const;
  if (blackbox.exposed) return 'blackbox-exposed' as const;
  if (blackbox.hp < blackbox.maxHp) return 'blackbox-damaged' as const;
  return 'blackbox-locked' as const;
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
  result.specularColor = colorFromHex(0x22282b);
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

export class BabylonK91CapstonePresentation {
  private readonly root: TransformNode;
  private readonly continuityRoot: TransformNode;
  private readonly railPairs: TransformNode[] = [];
  private readonly datumLights: TransformNode[] = [];
  private readonly stageRoots = new Map<K91StageNumber, TransformNode>();
  private readonly stageProps = new Map<K91StageNumber, TransformNode[]>();
  private readonly interactableCues: CueRig[] = [];
  private readonly hazardCues: CueRig[] = [];
  private readonly capstoneRoot: TransformNode;
  private readonly capstoneRings: Mesh[] = [];
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

    this.root = new TransformNode('p27-c12-k91-capstone', scene);
    this.continuityRoot = new TransformNode('p27-c12-k91-continuity', scene);
    this.continuityRoot.parent = this.root;

    const structural = material(scene, 'p27-c12-k91-structural', 0x4b555b);
    const ballast = material(scene, 'p27-c12-k91-ballast', 0x252d31);
    const datum = material(scene, 'p27-c12-k91-datum', 0xd0a15f, 0xa76a26, 0.58);
    const interactable = material(scene, 'p27-c12-k91-interactable', 0xe1b76f, 0xc98532, 0.74, 0.72);
    const hazard = material(scene, 'p27-c12-k91-hazard', 0xd66f54, 0xe56e45, 0.84, 0.62);
    const capstone = material(scene, 'p27-c12-k91-blackbox', 0xe3bd72, 0xd59a33, 0.94, 0.72);
    this.materials.push(structural, ballast, datum, interactable, hazard, capstone);

    box(scene, this.continuityRoot, 'p27-c12-k91-load-spine', structural, cx, 0.30, cz, worldW * 0.74, 0.22, scaled(24));

    for (let index = 0; index < 6; index += 1) {
      const pair = new TransformNode('p27-c12-k91-rail-pair-' + index, scene);
      pair.parent = this.continuityRoot;
      const t = index / 5;
      const x = worldW * (0.20 + t * 0.60);
      box(scene, pair, 'p27-c12-k91-rail-port-' + index, ballast, x, 0.38, worldH * 0.29, scaled(14), 0.42, scaled(38));
      box(scene, pair, 'p27-c12-k91-rail-starboard-' + index, ballast, x, 0.38, worldH * 0.71, scaled(14), 0.42, scaled(38));
      this.railPairs.push(pair);
    }

    for (let index = 0; index < 10; index += 1) {
      const guideRoot = new TransformNode('p27-c12-k91-datum-' + index, scene);
      guideRoot.parent = this.continuityRoot;
      const t = index / 9;
      box(scene, guideRoot, 'p27-c12-k91-datum-mesh-' + index, datum, worldW * (0.20 + t * 0.60), 0.46, cz, scaled(7), 0.07, scaled(4));
      this.datumLights.push(guideRoot);
    }

    this.buildStageOne(worldW, worldH, cz, structural, ballast);
    this.buildStageTwo(worldW, worldH, ballast);
    this.buildStageThree(worldW, worldH, datum);
    this.buildStageFour(worldW, worldH, ballast);

    const cueRoot = new TransformNode('p27-c12-k91-interactable-cues', scene);
    cueRoot.parent = this.root;
    for (let index = 0; index < 12; index += 1) {
      this.interactableCues.push(buildCueRig(scene, cueRoot, 'p27-c12-k91-interactable-' + index, interactable));
    }

    const hazardRoot = new TransformNode('p27-c12-k91-hazard-cues', scene);
    hazardRoot.parent = this.root;
    for (let index = 0; index < 12; index += 1) {
      this.hazardCues.push(buildCueRig(scene, hazardRoot, 'p27-c12-k91-hazard-' + index, hazard));
    }

    this.capstoneRoot = new TransformNode('p27-c12-k91-blackbox-cue', scene);
    this.capstoneRoot.parent = this.root;
    this.capstoneRoot.position.set(worldW * 0.78, 0, cz);
    for (let index = 0; index < 3; index += 1) {
      const ring = MeshBuilder.CreateTorus(
        'p27-c12-k91-blackbox-mass-lock-ring-' + index,
        { diameter: 1.82 + index * 0.38, thickness: 0.10, tessellation: 32 },
        scene,
      );
      ring.parent = this.capstoneRoot;
      ring.position.y = 0.74 + index * 0.18;
      ring.rotation.x = Math.PI / 2;
      ring.material = capstone;
      ring.isPickable = false;
      this.capstoneRings.push(ring);
    }
    box(scene, this.capstoneRoot, 'p27-c12-k91-blackbox-core', capstone, 0, 0.62, 0, 0.72, 0.84, 0.72);
    this.capstoneRoot.setEnabled(false);
    this.root.setEnabled(false);
  }

  private buildStageOne(
    worldW: number,
    worldH: number,
    cz: number,
    structural: StandardMaterial,
    ballast: StandardMaterial,
  ) {
    const accent = material(this.scene, 'p27-c12-k91-stage-1', 0x87949a, 0x33484f, 0.26);
    this.materials.push(accent);
    const root = new TransformNode('p27-c12-k91-stage-1-capture-collar', this.scene);
    root.parent = this.root;
    const collar = MeshBuilder.CreateTorus(
      'p27-c12-k91-capture-collar',
      { diameter: scaled(172), thickness: scaled(22), tessellation: 32 },
      this.scene,
    );
    collar.parent = root;
    collar.rotation.x = Math.PI / 2;
    collar.position.set(worldW * 0.20, 0.70, cz);
    collar.material = accent;
    collar.isPickable = false;
    const props: TransformNode[] = [];
    for (let index = 0; index < MAX_STAGE_PROPS; index += 1) {
      const prop = new TransformNode('p27-c12-k91-stage-1-capture-jaw-' + index, this.scene);
      prop.parent = root;
      box(
        this.scene,
        prop,
        'p27-c12-k91-stage-1-capture-jaw-mesh-' + index,
        index % 2 === 0 ? structural : ballast,
        worldW * (0.28 + (index % 4) * 0.12),
        0.45,
        worldH * (index < 4 ? 0.30 : 0.70),
        scaled(18),
        0.55,
        scaled(52),
      );
      props.push(prop);
    }
    this.stageRoots.set(1, root);
    this.stageProps.set(1, props);
  }

  private buildStageTwo(worldW: number, worldH: number, ballast: StandardMaterial) {
    const accent = material(this.scene, 'p27-c12-k91-stage-2', 0x87949a, 0x33484f, 0.26);
    this.materials.push(accent);
    const root = new TransformNode('p27-c12-k91-stage-2-mass-transit-spine', this.scene);
    root.parent = this.root;
    const props: TransformNode[] = [];
    for (let index = 0; index < MAX_STAGE_PROPS; index += 1) {
      const prop = new TransformNode('p27-c12-k91-stage-2-mass-carriage-' + index, this.scene);
      prop.parent = root;
      box(
        this.scene,
        prop,
        'p27-c12-k91-stage-2-mass-carriage-mesh-' + index,
        index % 2 === 0 ? accent : ballast,
        worldW * (0.25 + (index % 4) * 0.16),
        0.46,
        worldH * (index < 4 ? 0.30 : 0.70),
        worldW * 0.11,
        0.52,
        scaled(28),
      );
      props.push(prop);
    }
    this.stageRoots.set(2, root);
    this.stageProps.set(2, props);
  }

  private buildStageThree(worldW: number, worldH: number, datum: StandardMaterial) {
    const accent = material(this.scene, 'p27-c12-k91-stage-3', 0xc08b46, 0x7e4f1e, 0.30);
    this.materials.push(accent);
    const root = new TransformNode('p27-c12-k91-stage-3-power-transfer-gallery', this.scene);
    root.parent = this.root;
    const props: TransformNode[] = [];
    for (let index = 0; index < MAX_STAGE_PROPS; index += 1) {
      const prop = new TransformNode('p27-c12-k91-stage-3-lift-bus-' + index, this.scene);
      prop.parent = root;
      box(
        this.scene,
        prop,
        'p27-c12-k91-stage-3-lift-bus-mesh-' + index,
        index % 2 === 0 ? datum : accent,
        worldW * (0.24 + (index % 4) * 0.16),
        0.52,
        worldH * (index < 4 ? 0.31 : 0.69),
        worldW * 0.13,
        0.16,
        scaled(12),
      );
      props.push(prop);
    }
    this.stageRoots.set(3, root);
    this.stageProps.set(3, props);
  }

  private buildStageFour(worldW: number, worldH: number, ballast: StandardMaterial) {
    const accent = material(this.scene, 'p27-c12-k91-stage-4', 0x8f735d, 0x4b3529, 0.28);
    this.materials.push(accent);
    const root = new TransformNode('p27-c12-k91-stage-4-ballast-vault', this.scene);
    root.parent = this.root;
    const props: TransformNode[] = [];
    for (let index = 0; index < MAX_STAGE_PROPS; index += 1) {
      const prop = new TransformNode('p27-c12-k91-stage-4-ballast-block-' + index, this.scene);
      prop.parent = root;
      box(
        this.scene,
        prop,
        'p27-c12-k91-stage-4-ballast-block-mesh-' + index,
        index % 2 === 0 ? ballast : accent,
        worldW * (0.25 + (index % 4) * 0.16),
        0.50,
        worldH * (index < 4 ? 0.30 : 0.70),
        scaled(54),
        0.72,
        scaled(42),
      );
      props.push(prop);
    }
    this.stageRoots.set(4, root);
    this.stageProps.set(4, props);
  }

  sync(state: SimState, renderBudget: RenderBudgetSnapshot, mission: Contract) {
    const stage = k91StageIdentity(mission);
    if (!stage) {
      this.release('not-k91');
      return;
    }

    this.released = false;
    this.root.setEnabled(true);
    const profile = k91RenderProfile(renderBudget.detailScale, this.coarse);
    setEnabledCount(this.railPairs, profile.railPairs);
    setEnabledCount(this.datumLights, profile.datumLights);

    for (const [stageNumber, root] of this.stageRoots) {
      root.setEnabled(stageNumber === stage.stage);
    }
    setEnabledCount(this.stageProps.get(stage.stage) ?? [], profile.stageProps);

    const interactables = state.objects.filter(object => object.active && !!k91InteractableCue(object.kind));
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
      cue.root.rotation.y = state.time * 0.52 + index * 0.37;
    });

    const blackbox = state.objects.find(object =>
      object.active && (object.kind === 'salvageNode' || object.kind === 'anchorNode')
    );
    const capstoneActive = stage.stage === 4;
    this.capstoneRoot.setEnabled(capstoneActive);
    if (capstoneActive) {
      if (blackbox) {
        this.capstoneRoot.position.x = scaled(blackbox.x + blackbox.w / 2);
        this.capstoneRoot.position.z = scaled(blackbox.y + blackbox.h / 2);
      }
      const pulse = blackbox?.exposed ? 1.12 : 1 + Math.sin(state.time * 2.2) * 0.04;
      this.capstoneRoot.scaling.set(pulse, pulse, pulse);
      this.capstoneRings.forEach((ring, index) => {
        ring.rotation.y = state.time * (0.30 + index * 0.08) * (index % 2 === 0 ? 1 : -1);
      });
    }

    const activeInteractableKinds = [...new Set(interactables.map(object => k91InteractableCue(object.kind)).filter(Boolean))];
    const activeHazardKinds = [...new Set(activeHazards.map(hazardItem => k91HazardCue(hazardItem.kind)))];
    this.canvas.dataset.babylonK91State = 'ready';
    this.canvas.dataset.babylonK91Parity = 'stage-identity+load-spine+countermass-rails+stage-props+interactables+hazards+blackbox-capstone+shared-location-foundations';
    this.canvas.dataset.megastructureVisual = 'procedural-k91-capstone-babylon';
    this.canvas.dataset.megastructureIdentity = BABYLON_K91_CAPSTONE_IDENTITY.megastructure;
    this.canvas.dataset.megastructureStage = `${stage.stage}:${stage.code}:${stage.name.toLowerCase().replaceAll(' ', '-')}`;
    this.canvas.dataset.megastructureContinuity = BABYLON_K91_CAPSTONE_IDENTITY.continuity;
    this.canvas.dataset.megastructureStageKit = stage.kit.join('+');
    this.canvas.dataset.megastructureStagePurpose = stage.purpose;
    this.canvas.dataset.megastructureStageContinuity = stage.continuity;
    this.canvas.dataset.megastructureStageEvents = stage.eventA + '|' + stage.eventB;
    this.canvas.dataset.megastructureBatching = 'continuity-pairs+pooled-stage-cues';
    this.canvas.dataset.megastructureContinuityDrawCalls = 'babylon-shared-geometry';
    this.canvas.dataset.megastructurePerformanceProfile = `${profile.name}:rails-${profile.railPairs}:guides-${profile.datumLights}:props-${profile.stageProps}:shadows-${profile.castStructuralShadows ? 'on' : 'off'}`;
    this.canvas.dataset.megastructureReadability = BABYLON_K91_CAPSTONE_IDENTITY.readability;
    this.canvas.dataset.megastructureInteractableCues = String(Math.min(interactables.length, this.interactableCues.length));
    this.canvas.dataset.megastructureInteractableLanguage = activeInteractableKinds.join('+') || 'shared-world-cues';
    this.canvas.dataset.megastructureHazardCues = String(Math.min(activeHazards.length, this.hazardCues.length));
    this.canvas.dataset.megastructureHazardLanguage = activeHazardKinds.join('+') || 'shared-world-cues';
    this.canvas.dataset.megastructureCapstonePresentation = BABYLON_K91_CAPSTONE_IDENTITY.capstone;
    this.canvas.dataset.megastructureCapstoneCue = 'blackbox-beacon+mass-lock-rings+amber-recovery-core';
    this.canvas.dataset.megastructureCapstoneCueState = k91BlackboxCueState(state, stage.stage);
    this.canvas.dataset.megastructurePlayerPosition = `${state.player.x.toFixed(1)},${state.player.y.toFixed(1)}`;
  }

  release(reason: string) {
    if (this.released) return;
    this.released = true;
    this.root.setEnabled(false);
    this.capstoneRoot.setEnabled(false);
    this.interactableCues.forEach(cue => cue.root.setEnabled(false));
    this.hazardCues.forEach(cue => cue.root.setEnabled(false));
    this.canvas.dataset.babylonK91State = 'released';
    this.canvas.dataset.babylonK91Release = reason;
    for (const key of [
      'babylonK91Parity',
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
      'megastructureCapstonePresentation',
      'megastructureCapstoneCue',
      'megastructureCapstoneCueState',
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
