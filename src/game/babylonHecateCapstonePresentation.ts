import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { Contract } from './campaign';
import {
  hecateRenderProfile,
  hecateStageIdentity,
  type HecateStageNumber,
} from './hecateCapstone';
import type { RenderBudgetSnapshot } from './renderQuality';
import { getWorldSize, type CombatObject, type Hazard, type SimState } from './sim';

const WORLD_SCALE = 0.02;
const MAX_STAGE_PROPS = 8;

export const BABYLON_HECATE_CAPSTONE_IDENTITY = Object.freeze({
  megastructure: 'shipbreaking-yard:hecate',
  continuity: 'salvage-truss-spine+red-clamp-arms+yellow-cutter-datum',
  readability: 'red-clamp+yellow-cutter+shape-coded-risk',
  boss: 'hecate-yardmaster-null',
});

export function hecateInteractableCue(kind: CombatObject['kind']) {
  if (kind === 'doorControl' || kind === 'sealControl') return 'yard-clamp-lock' as const;
  if (kind === 'gravityControl' || kind === 'anchorNode') return 'crane-authority' as const;
  if (kind === 'powerControl' || kind === 'conduit') return 'cutter-grid' as const;
  if (kind === 'coolant' || kind === 'breachPlate') return 'pressure-route' as const;
  if (kind === 'salvageNode') return 'salvage-ledger' as const;
  return null;
}

export function hecateHazardCue(kind: Hazard['kind']) {
  if (kind === 'gravityWell') return 'crane-lock' as const;
  if (kind === 'shockGrid') return 'cutter-grid-arc' as const;
  if (kind === 'vacuumWake') return 'wreck-pressure-purge' as const;
  if (kind === 'vectorWash') return 'clamp-sweep' as const;
  if (kind === 'boiloffJet') return 'thermal-cutter' as const;
  return 'breaking-field-vent' as const;
}

export function hecateYardmasterCueState(
  state: Pick<SimState, 'bossActive' | 'bossDefeated' | 'enemies'>,
) {
  if (state.bossDefeated) return 'defeated' as const;
  const yardmaster = state.enemies.find(enemy => enemy.role === 'boss' && enemy.variant === 'hecateYardmaster');
  if (!yardmaster || !state.bossActive || !yardmaster.active || yardmaster.dead) return 'queued' as const;
  return `active-phase-${yardmaster.bossPhase}:${yardmaster.bossPattern}`;
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

export class BabylonHecateCapstonePresentation {
  private readonly root: TransformNode;
  private readonly continuityRoot: TransformNode;
  private readonly trussPairs: TransformNode[] = [];
  private readonly cutterDatums: TransformNode[] = [];
  private readonly stageRoots = new Map<HecateStageNumber, TransformNode>();
  private readonly stageProps = new Map<HecateStageNumber, TransformNode[]>();
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

    this.root = new TransformNode('p27-c14-hecate-capstone', scene);
    this.continuityRoot = new TransformNode('p27-c14-hecate-continuity', scene);
    this.continuityRoot.parent = this.root;

    const truss = material(scene, 'p27-c14-hecate-truss', 0x303438);
    const hull = material(scene, 'p27-c14-hecate-hull', 0x777a78);
    const clamp = material(scene, 'p27-c14-hecate-clamp', 0xb64335, 0x5b1712, 0.28);
    const cutter = material(scene, 'p27-c14-hecate-cutter', 0xe1b348, 0x8d5e12, 0.56);
    const interactable = material(scene, 'p27-c14-hecate-interactable', 0xf0ca72, 0xc06a2a, 0.78, 0.72);
    const hazard = material(scene, 'p27-c14-hecate-hazard', 0xe36d48, 0xde3a22, 0.88, 0.62);
    const yardmaster = material(scene, 'p27-c14-hecate-yardmaster', 0xf1c766, 0xb83a27, 0.94, 0.7);
    this.materials.push(truss, hull, clamp, cutter, interactable, hazard, yardmaster);

    for (let index = 0; index < 7; index += 1) {
      const pair = new TransformNode('p27-c14-hecate-truss-pair-' + index, scene);
      pair.parent = this.continuityRoot;
      const t = index / 6;
      const x = worldW * (0.18 + t * 0.64);
      const beamMaterial = index % 2 === 0 ? truss : hull;
      box(scene, pair, 'p27-c14-hecate-truss-north-' + index, beamMaterial, x, 0.36, worldH * 0.18, scaled(16), 0.64, worldH * 0.17);
      box(scene, pair, 'p27-c14-hecate-truss-south-' + index, beamMaterial, x, 0.36, worldH * 0.82, scaled(16), 0.64, worldH * 0.17);
      if (index % 2 === 0) {
        box(scene, pair, 'p27-c14-hecate-clamp-north-' + index, clamp, x, 0.48, worldH * 0.28, scaled(8), 0.72, scaled(26));
        box(scene, pair, 'p27-c14-hecate-clamp-south-' + index, clamp, x, 0.48, worldH * 0.72, scaled(8), 0.72, scaled(26));
      }
      this.trussPairs.push(pair);
    }

    for (let index = 0; index < 10; index += 1) {
      const datum = new TransformNode('p27-c14-hecate-cutter-datum-' + index, scene);
      datum.parent = this.continuityRoot;
      const t = index / 9;
      box(
        scene,
        datum,
        'p27-c14-hecate-cutter-datum-mesh-' + index,
        index % 3 === 0 ? clamp : cutter,
        worldW * (0.2 + t * 0.6),
        0.51,
        cz,
        scaled(7),
        0.055,
        scaled(4),
      );
      this.cutterDatums.push(datum);
    }

    this.buildStageOne(worldW, cz, hull, clamp);
    this.buildStageTwo(worldW, worldH, clamp);
    this.buildStageThree(worldW, worldH, hull);
    this.buildStageFour(worldW, worldH, cz, truss, clamp, cutter);

    for (let index = 0; index < 8; index += 1) {
      this.interactableCues.push(buildCueRig(scene, this.root, 'p27-c14-hecate-interactable-cue-' + index, interactable));
      this.hazardCues.push(buildCueRig(scene, this.root, 'p27-c14-hecate-hazard-cue-' + index, hazard));
    }

    this.bossRoot = new TransformNode('p27-c14-hecate-yardmaster-cue', scene);
    this.bossRoot.parent = this.root;
    for (let index = 0; index < 3; index += 1) {
      const ring = MeshBuilder.CreateTorus(
        'p27-c14-hecate-yardmaster-authority-ring-' + index,
        { diameter: 2.08 + index * 0.42, thickness: 0.11, tessellation: 32 },
        scene,
      );
      ring.parent = this.bossRoot;
      ring.position.y = 1.02 + index * 0.20;
      ring.rotation.x = Math.PI / 2;
      ring.rotation.y = index * 0.30;
      ring.material = yardmaster;
      ring.isPickable = false;
      this.bossRings.push(ring);
    }
    box(scene, this.bossRoot, 'p27-c14-hecate-yardmaster-master-clamp-a', yardmaster, 0, 0.72, 0, 2.20, 0.16, 0.20).rotation.y = Math.PI / 4;
    box(scene, this.bossRoot, 'p27-c14-hecate-yardmaster-master-clamp-b', yardmaster, 0, 0.72, 0, 2.20, 0.16, 0.20).rotation.y = -Math.PI / 4;
    const bossCore = MeshBuilder.CreateSphere('p27-c14-hecate-yardmaster-command-core', { diameter: 0.72, segments: 12 }, scene);
    bossCore.parent = this.bossRoot;
    bossCore.position.y = 0.82;
    bossCore.material = yardmaster;
    bossCore.isPickable = false;
    this.bossRoot.setEnabled(false);
    this.root.setEnabled(false);
  }

  private buildStageOne(
    worldW: number,
    cz: number,
    hull: StandardMaterial,
    clamp: StandardMaterial,
  ) {
    const accent = material(this.scene, 'p27-c14-hecate-stage-1', 0xd48442, 0x77370f, 0.30);
    this.materials.push(accent);
    const root = new TransformNode('p27-c14-hecate-stage-1-sunward-clamp-field', this.scene);
    root.parent = this.root;
    const clampRing = MeshBuilder.CreateTorus(
      'p27-c14-hecate-sunward-clamp-ring',
      { diameter: scaled(160), thickness: scaled(20), tessellation: 30 },
      this.scene,
    );
    clampRing.parent = root;
    clampRing.rotation.x = Math.PI / 2;
    clampRing.position.set(worldW * 0.20, 0.70, cz);
    clampRing.material = accent;
    clampRing.isPickable = false;
    const props: TransformNode[] = [];
    for (let index = 0; index < MAX_STAGE_PROPS; index += 1) {
      const prop = new TransformNode('p27-c14-hecate-stage-1-hull-cradle-' + index, this.scene);
      prop.parent = root;
      box(
        this.scene,
        prop,
        'p27-c14-hecate-stage-1-hull-cradle-mesh-' + index,
        index % 2 === 0 ? clamp : hull,
        worldW * (0.29 + (index % 4) * 0.12),
        0.43,
        scaled(index < 4 ? 360 : 840),
        scaled(20),
        0.60,
        scaled(50),
      );
      props.push(prop);
    }
    this.stageRoots.set(1, root);
    this.stageProps.set(1, props);
  }

  private buildStageTwo(worldW: number, worldH: number, clamp: StandardMaterial) {
    const accent = material(this.scene, 'p27-c14-hecate-stage-2', 0x9e5141, 0x582019, 0.30);
    this.materials.push(accent);
    const root = new TransformNode('p27-c14-hecate-stage-2-crusher-causeway', this.scene);
    root.parent = this.root;
    const props: TransformNode[] = [];
    for (let index = 0; index < MAX_STAGE_PROPS; index += 1) {
      const prop = new TransformNode('p27-c14-hecate-stage-2-crusher-jaw-' + index, this.scene);
      prop.parent = root;
      box(
        this.scene,
        prop,
        'p27-c14-hecate-stage-2-crusher-jaw-mesh-' + index,
        index % 2 === 0 ? clamp : accent,
        worldW * (0.25 + (index % 4) * 0.16),
        0.46,
        worldH * (index < 4 ? 0.30 : 0.70),
        worldW * 0.105,
        0.62,
        scaled(34),
      );
      props.push(prop);
    }
    this.stageRoots.set(2, root);
    this.stageProps.set(2, props);
  }

  private buildStageThree(worldW: number, worldH: number, hull: StandardMaterial) {
    const accent = material(this.scene, 'p27-c14-hecate-stage-3', 0x7a9ca4, 0x294b52, 0.30);
    this.materials.push(accent);
    const root = new TransformNode('p27-c14-hecate-stage-3-wreck-transit', this.scene);
    root.parent = this.root;
    const props: TransformNode[] = [];
    for (let index = 0; index < MAX_STAGE_PROPS; index += 1) {
      const prop = new TransformNode('p27-c14-hecate-stage-3-stripped-hull-' + index, this.scene);
      prop.parent = root;
      const wreck = MeshBuilder.CreateCylinder(
        'p27-c14-hecate-stage-3-stripped-hull-mesh-' + index,
        { diameter: scaled(36), height: scaled(62), tessellation: 10 },
        this.scene,
      );
      wreck.parent = prop;
      wreck.rotation.z = Math.PI / 2;
      wreck.position.set(worldW * (0.25 + (index % 4) * 0.16), 0.52, worldH * (index < 4 ? 0.29 : 0.71));
      wreck.material = index % 2 === 0 ? hull : accent;
      wreck.isPickable = false;
      props.push(prop);
    }
    this.stageRoots.set(3, root);
    this.stageProps.set(3, props);
  }

  private buildStageFour(
    worldW: number,
    worldH: number,
    cz: number,
    truss: StandardMaterial,
    clamp: StandardMaterial,
    cutter: StandardMaterial,
  ) {
    const accent = material(this.scene, 'p27-c14-hecate-stage-4', 0xc0a24c, 0x6c5414, 0.30);
    this.materials.push(accent);
    const root = new TransformNode('p27-c14-hecate-stage-4-yard-control-crown', this.scene);
    root.parent = this.root;
    const props: TransformNode[] = [];
    for (let index = 0; index < MAX_STAGE_PROPS; index += 1) {
      const prop = new TransformNode('p27-c14-hecate-stage-4-control-pylon-' + index, this.scene);
      prop.parent = root;
      box(
        this.scene,
        prop,
        'p27-c14-hecate-stage-4-control-pylon-mesh-' + index,
        index % 2 === 0 ? clamp : truss,
        worldW * (0.25 + (index % 4) * 0.16),
        0.54,
        worldH * (index < 4 ? 0.29 : 0.71),
        scaled(32),
        0.90,
        scaled(50),
      );
      props.push(prop);
    }
    const crown = MeshBuilder.CreateTorus(
      'p27-c14-hecate-yard-control-crown',
      { diameter: scaled(116), thickness: scaled(18), tessellation: 30 },
      this.scene,
    );
    crown.parent = root;
    crown.rotation.x = Math.PI / 2;
    crown.position.set(worldW * 0.78, 0.82, cz);
    crown.material = cutter;
    crown.isPickable = false;
    this.stageRoots.set(4, root);
    this.stageProps.set(4, props);
  }

  sync(state: SimState, renderBudget: RenderBudgetSnapshot, mission: Contract) {
    const stage = hecateStageIdentity(mission);
    if (!stage) {
      this.release('not-hecate');
      return;
    }

    this.released = false;
    this.root.setEnabled(true);
    const profile = hecateRenderProfile(renderBudget.detailScale, this.coarse);
    setEnabledCount(this.trussPairs, profile.trussPairs);
    setEnabledCount(this.cutterDatums, profile.cutterDatums);

    for (const [stageNumber, root] of this.stageRoots) {
      root.setEnabled(stageNumber === stage.stage);
    }
    setEnabledCount(this.stageProps.get(stage.stage) ?? [], profile.stageProps);

    const interactables = state.objects.filter(object => object.active && !!hecateInteractableCue(object.kind));
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
      cue.root.rotation.y = state.time * 0.58 + index * 0.41;
    });

    const yardmaster = state.enemies.find(enemy => enemy.role === 'boss' && enemy.variant === 'hecateYardmaster');
    const bossActive = stage.stage === 4 && !!yardmaster && state.bossActive && yardmaster.active && !yardmaster.dead;
    this.bossRoot.setEnabled(bossActive);
    if (bossActive && yardmaster) {
      this.bossRoot.position.set(scaled(yardmaster.x), 0, scaled(yardmaster.y));
      const phaseScale = yardmaster.bossPhase === 2 ? 1.20 : 1;
      this.bossRoot.scaling.set(phaseScale, phaseScale, phaseScale);
      this.bossRings.forEach((ring, index) => {
        ring.rotation.y = state.time * (0.38 + index * 0.09) * (index % 2 === 0 ? 1 : -1);
      });
    }

    const activeInteractableKinds = [...new Set(interactables.map(object => hecateInteractableCue(object.kind)).filter(Boolean))];
    const activeHazardKinds = [...new Set(activeHazards.map(hazardItem => hecateHazardCue(hazardItem.kind)))];
    this.canvas.dataset.babylonHecateState = 'ready';
    this.canvas.dataset.babylonHecateParity = 'stage-identity+salvage-truss-continuity+stage-props+interactables+hazards+yardmaster-cues+shared-location-foundations';
    this.canvas.dataset.megastructureVisual = 'procedural-hecate-capstone-babylon';
    this.canvas.dataset.megastructureIdentity = BABYLON_HECATE_CAPSTONE_IDENTITY.megastructure;
    this.canvas.dataset.megastructureStage = `${stage.stage}:${stage.code}:${stage.name.toLowerCase().replaceAll(' ', '-')}`;
    this.canvas.dataset.megastructureContinuity = BABYLON_HECATE_CAPSTONE_IDENTITY.continuity;
    this.canvas.dataset.megastructureStageKit = stage.kit.join('+');
    this.canvas.dataset.megastructureStagePurpose = stage.purpose;
    this.canvas.dataset.megastructureStageContinuity = stage.continuity;
    this.canvas.dataset.megastructureStageEvents = stage.eventA + '|' + stage.eventB;
    this.canvas.dataset.megastructureBatching = 'continuity-pairs+pooled-stage-cues';
    this.canvas.dataset.megastructureContinuityDrawCalls = 'babylon-shared-geometry';
    this.canvas.dataset.megastructurePerformanceProfile = `${profile.name}:trusses-${profile.trussPairs}:guides-${profile.cutterDatums}:props-${profile.stageProps}:shadows-${profile.castStructuralShadows ? 'on' : 'off'}`;
    this.canvas.dataset.megastructureReadability = BABYLON_HECATE_CAPSTONE_IDENTITY.readability;
    this.canvas.dataset.megastructureInteractableCues = String(Math.min(interactables.length, this.interactableCues.length));
    this.canvas.dataset.megastructureInteractableLanguage = activeInteractableKinds.join('+') || 'shared-world-cues';
    this.canvas.dataset.megastructureHazardCues = String(Math.min(activeHazards.length, this.hazardCues.length));
    this.canvas.dataset.megastructureHazardLanguage = activeHazardKinds.join('+') || 'shared-world-cues';
    this.canvas.dataset.megastructureBossPresentation = BABYLON_HECATE_CAPSTONE_IDENTITY.boss;
    this.canvas.dataset.megastructureBossCue = 'control-crown+master-clamps+yellow-command-core';
    this.canvas.dataset.megastructureBossCueState = hecateYardmasterCueState(state);
    this.canvas.dataset.megastructurePlayerPosition = `${state.player.x.toFixed(1)},${state.player.y.toFixed(1)}`;
  }

  release(reason: string) {
    if (this.released) return;
    this.released = true;
    this.root.setEnabled(false);
    this.bossRoot.setEnabled(false);
    this.interactableCues.forEach(cue => cue.root.setEnabled(false));
    this.hazardCues.forEach(cue => cue.root.setEnabled(false));
    this.canvas.dataset.babylonHecateState = 'released';
    this.canvas.dataset.babylonHecateRelease = reason;
    for (const key of [
      'babylonHecateParity',
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
