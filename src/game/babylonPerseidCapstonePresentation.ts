import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { Contract } from './campaign';
import {
  perseidRenderProfile,
  perseidStageIdentity,
  type PerseidStageNumber,
} from './perseidCapstone';
import type { RenderBudgetSnapshot } from './renderQuality';
import { getWorldSize, type CombatObject, type Hazard, type SimState } from './sim';

const WORLD_SCALE = 0.02;
const MAX_STAGE_PROPS = 7;

export const BABYLON_PERSEID_CAPSTONE_IDENTITY = Object.freeze({
  megastructure: 'generation-ship:perseid',
  continuity: 'keel-spine+pressure-ribs+green-transit-datum',
  readability: 'green-datum+stage-silhouette+shape-coded-risk',
  boss: 'perseid-steward-core',
});

export function perseidInteractableCue(kind: CombatObject['kind']) {
  if (kind === 'doorControl' || kind === 'sealControl') return 'pressure-lock' as const;
  if (kind === 'gravityControl') return 'drum-stabilizer' as const;
  if (kind === 'powerControl' || kind === 'conduit') return 'reactor-bus' as const;
  if (kind === 'coolant' || kind === 'breachPlate') return 'service-risk' as const;
  if (kind === 'salvageNode' || kind === 'anchorNode') return 'recovery-node' as const;
  return null;
}

export function perseidHazardCue(kind: Hazard['kind']) {
  if (kind === 'gravityWell') return 'drum-shear' as const;
  if (kind === 'coolantJet' || kind === 'boiloffJet') return 'cryogenic-jet' as const;
  if (kind === 'shockGrid') return 'reactor-bus-arc' as const;
  if (kind === 'vacuumWake') return 'pressure-wake' as const;
  return 'keel-vector-shear' as const;
}

export function perseidStewardCueState(state: Pick<SimState, 'bossActive' | 'bossDefeated' | 'enemies'>) {
  if (state.bossDefeated) return 'defeated' as const;
  const steward = state.enemies.find(enemy => enemy.role === 'boss' && enemy.variant === 'perseidSteward');
  if (!steward || !state.bossActive || !steward.active || steward.dead) return 'queued' as const;
  return `active-phase-${steward.bossPhase}:${steward.bossPattern}`;
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
  result.specularColor = colorFromHex(0x20272b);
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
  const stem = box(scene, root, name + '-stem', meshMaterial, 0, 0.66, 0, 0.08, 1.18, 0.08);
  root.setEnabled(false);
  return { root, ring, stem };
}

export class BabylonPerseidCapstonePresentation {
  private readonly root: TransformNode;
  private readonly continuityRoot: TransformNode;
  private readonly ribPairs: TransformNode[] = [];
  private readonly guideLights: TransformNode[] = [];
  private readonly stageRoots = new Map<PerseidStageNumber, TransformNode>();
  private readonly stageProps = new Map<PerseidStageNumber, TransformNode[]>();
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

    this.root = new TransformNode('p27-c11-perseid-capstone', scene);
    this.continuityRoot = new TransformNode('p27-c11-perseid-continuity', scene);
    this.continuityRoot.parent = this.root;

    const structural = material(scene, 'p27-c11-perseid-structural', 0x43525a);
    const dark = material(scene, 'p27-c11-perseid-dark', 0x111a1f);
    const guide = material(scene, 'p27-c11-perseid-guide', 0x6aa88b, 0x4baf7f, 0.50);
    const interactable = material(scene, 'p27-c11-perseid-interactable', 0x72d7a6, 0x54c794, 0.72, 0.72);
    const hazard = material(scene, 'p27-c11-perseid-hazard', 0xd69c54, 0xe0a65e, 0.82, 0.62);
    const steward = material(scene, 'p27-c11-perseid-steward', 0xd2a35e, 0xd7923e, 0.92, 0.68);
    this.materials.push(structural, dark, guide, interactable, hazard, steward);

    box(scene, this.continuityRoot, 'p27-c11-perseid-keel', structural, cx, 0.28, cz, worldW * 0.72, 0.18, scaled(18));

    for (let index = 0; index < 7; index += 1) {
      const pair = new TransformNode('p27-c11-perseid-rib-pair-' + index, scene);
      pair.parent = this.continuityRoot;
      const t = index / 6;
      const x = worldW * (0.18 + t * 0.64);
      box(scene, pair, 'p27-c11-perseid-rib-port-' + index, dark, x, 0.36, worldH * 0.17, scaled(10), 0.72, worldH * 0.18);
      box(scene, pair, 'p27-c11-perseid-rib-starboard-' + index, dark, x, 0.36, worldH * 0.83, scaled(10), 0.72, worldH * 0.18);
      this.ribPairs.push(pair);
    }

    for (let index = 0; index < 10; index += 1) {
      const guideRoot = new TransformNode('p27-c11-perseid-guide-' + index, scene);
      guideRoot.parent = this.continuityRoot;
      const t = index / 9;
      box(scene, guideRoot, 'p27-c11-perseid-guide-mesh-' + index, guide, worldW * (0.2 + t * 0.6), 0.42, cz, scaled(8), 0.06, scaled(3.5));
      this.guideLights.push(guideRoot);
    }

    this.buildStageOne(worldW, cz, structural);
    this.buildStageTwo(worldW, worldH, guide, dark);
    this.buildStageThree(worldW, worldH);
    this.buildStageFour(worldW, worldH, cz);

    const cueRoot = new TransformNode('p27-c11-perseid-interactable-cues', scene);
    cueRoot.parent = this.root;
    for (let index = 0; index < 12; index += 1) {
      this.interactableCues.push(buildCueRig(scene, cueRoot, 'p27-c11-perseid-interactable-' + index, interactable));
    }

    const hazardRoot = new TransformNode('p27-c11-perseid-hazard-cues', scene);
    hazardRoot.parent = this.root;
    for (let index = 0; index < 12; index += 1) {
      this.hazardCues.push(buildCueRig(scene, hazardRoot, 'p27-c11-perseid-hazard-' + index, hazard));
    }

    this.bossRoot = new TransformNode('p27-c11-perseid-steward-cue', scene);
    this.bossRoot.parent = this.root;
    for (let index = 0; index < 3; index += 1) {
      const ring = MeshBuilder.CreateTorus(
        'p27-c11-perseid-steward-ring-' + index,
        { diameter: 2.18 + index * 0.42, thickness: 0.10, tessellation: 32 },
        scene,
      );
      ring.parent = this.bossRoot;
      ring.position.y = 1.08 + index * 0.24;
      ring.rotation.x = Math.PI / 2;
      ring.rotation.y = index * 0.26;
      ring.material = steward;
      ring.isPickable = false;
      this.bossRings.push(ring);
    }
    const bossCore = MeshBuilder.CreateSphere('p27-c11-perseid-steward-core', { diameter: 0.72, segments: 12 }, scene);
    bossCore.parent = this.bossRoot;
    bossCore.position.y = 0.82;
    bossCore.material = steward;
    bossCore.isPickable = false;
    this.bossRoot.setEnabled(false);

    this.root.setEnabled(false);
  }

  private buildStageOne(worldW: number, cz: number, structural: StandardMaterial) {
    const accent = material(this.scene, 'p27-c11-perseid-stage-1', 0x6b927d, 0x315f4a, 0.28);
    this.materials.push(accent);
    const root = new TransformNode('p27-c11-perseid-stage-1-docking-spine', this.scene);
    root.parent = this.root;
    const collar = MeshBuilder.CreateTorus('p27-c11-perseid-docking-collar', { diameter: scaled(160), thickness: scaled(18), tessellation: 32 }, this.scene);
    collar.parent = root;
    collar.rotation.x = Math.PI / 2;
    collar.position.set(worldW * 0.20, 0.62, cz);
    collar.material = accent;
    collar.isPickable = false;
    const props: TransformNode[] = [];
    for (let index = 0; index < MAX_STAGE_PROPS; index += 1) {
      const prop = new TransformNode('p27-c11-perseid-stage-1-rail-' + index, this.scene);
      prop.parent = root;
      box(this.scene, prop, 'p27-c11-perseid-stage-1-rail-mesh-' + index, accent, worldW * (0.24 + index * 0.055), 0.34, cz + (index % 2 === 0 ? scaled(54) : -scaled(54)), worldW * 0.12, 0.14, scaled(6));
      props.push(prop);
    }
    box(this.scene, root, 'p27-c11-perseid-stage-1-pressure-node', structural, worldW * 0.29, 0.54, cz, scaled(18), 0.58, scaled(24));
    this.stageRoots.set(1, root);
    this.stageProps.set(1, props);
  }

  private buildStageTwo(worldW: number, worldH: number, guide: StandardMaterial, dark: StandardMaterial) {
    const accent = material(this.scene, 'p27-c11-perseid-stage-2', 0x6b927d, 0x315f4a, 0.28);
    this.materials.push(accent);
    const root = new TransformNode('p27-c11-perseid-stage-2-agricultural-drum', this.scene);
    root.parent = this.root;
    const props: TransformNode[] = [];
    for (let index = 0; index < MAX_STAGE_PROPS; index += 1) {
      const prop = new TransformNode('p27-c11-perseid-stage-2-grow-bank-' + index, this.scene);
      prop.parent = root;
      box(
        this.scene,
        prop,
        'p27-c11-perseid-stage-2-grow-bank-mesh-' + index,
        index % 2 === 0 ? guide : dark,
        worldW * (0.26 + (index % 4) * 0.15),
        0.30,
        worldH * (index < 4 ? 0.31 : 0.69),
        worldW * 0.14,
        0.20,
        scaled(18),
      );
      props.push(prop);
    }
    const drum = MeshBuilder.CreateTorus('p27-c11-perseid-stage-2-rotation-datum', { diameter: Math.min(worldW, worldH) * 0.38, thickness: 0.12, tessellation: 40 }, this.scene);
    drum.parent = root;
    drum.position.set(worldW * 0.53, 0.32, worldH * 0.50);
    drum.rotation.x = Math.PI / 2;
    drum.material = accent;
    drum.isPickable = false;
    this.stageRoots.set(2, root);
    this.stageProps.set(2, props);
  }

  private buildStageThree(worldW: number, worldH: number) {
    const accent = material(this.scene, 'p27-c11-perseid-stage-3', 0x75b7c8, 0x2e778a, 0.28);
    this.materials.push(accent);
    const root = new TransformNode('p27-c11-perseid-stage-3-cryogenic-service-deck', this.scene);
    root.parent = this.root;
    const props: TransformNode[] = [];
    for (let index = 0; index < MAX_STAGE_PROPS; index += 1) {
      const prop = new TransformNode('p27-c11-perseid-stage-3-cryobank-' + index, this.scene);
      prop.parent = root;
      const bank = MeshBuilder.CreateCylinder(
        'p27-c11-perseid-stage-3-cryobank-mesh-' + index,
        { diameter: scaled(32), height: scaled(62), tessellation: 10 },
        this.scene,
      );
      bank.parent = prop;
      bank.rotation.z = Math.PI / 2;
      bank.position.set(worldW * (0.26 + (index % 4) * 0.15), 0.50, worldH * (index < 4 ? 0.30 : 0.70));
      bank.material = accent;
      bank.isPickable = false;
      props.push(prop);
    }
    this.stageRoots.set(3, root);
    this.stageProps.set(3, props);
  }

  private buildStageFour(worldW: number, worldH: number, cz: number) {
    const accent = material(this.scene, 'p27-c11-perseid-stage-4', 0xd2a35e, 0x8a5c25, 0.34);
    this.materials.push(accent);
    const root = new TransformNode('p27-c11-perseid-stage-4-reactor-choir', this.scene);
    root.parent = this.root;
    const props: TransformNode[] = [];
    for (let index = 0; index < MAX_STAGE_PROPS; index += 1) {
      const prop = new TransformNode('p27-c11-perseid-stage-4-harmonic-pylon-' + index, this.scene);
      prop.parent = root;
      const pylon = MeshBuilder.CreateCylinder(
        'p27-c11-perseid-stage-4-harmonic-pylon-mesh-' + index,
        { diameterTop: scaled(14), diameterBottom: scaled(24), height: scaled(90), tessellation: 8 },
        this.scene,
      );
      pylon.parent = prop;
      pylon.position.set(worldW * (0.28 + (index % 4) * 0.14), scaled(45), worldH * (index < 4 ? 0.29 : 0.71));
      pylon.material = accent;
      pylon.isPickable = false;
      props.push(prop);
    }
    const seal = MeshBuilder.CreateTorus('p27-c11-perseid-steward-seal', { diameter: scaled(116), thickness: scaled(16), tessellation: 28 }, this.scene);
    seal.parent = root;
    seal.rotation.x = Math.PI / 2;
    seal.position.set(worldW * 0.78, 0.78, cz);
    seal.material = accent;
    seal.isPickable = false;
    this.stageRoots.set(4, root);
    this.stageProps.set(4, props);
  }

  sync(state: SimState, renderBudget: RenderBudgetSnapshot, mission: Contract) {
    const stage = perseidStageIdentity(mission);
    if (!stage) {
      this.release('not-perseid');
      return;
    }

    this.released = false;
    this.root.setEnabled(true);
    const profile = perseidRenderProfile(renderBudget.detailScale, this.coarse);
    setEnabledCount(this.ribPairs, profile.ribPairs);
    setEnabledCount(this.guideLights, profile.guideLights);

    for (const [stageNumber, root] of this.stageRoots) {
      root.setEnabled(stageNumber === stage.stage);
    }
    setEnabledCount(this.stageProps.get(stage.stage) ?? [], profile.stageProps);

    const interactables = state.objects.filter(object => object.active && !!perseidInteractableCue(object.kind));
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
      cue.root.rotation.y = state.time * 0.48 + index * 0.41;
    });

    const steward = state.enemies.find(enemy => enemy.role === 'boss' && enemy.variant === 'perseidSteward');
    const bossActive = !!steward && state.bossActive && steward.active && !steward.dead;
    this.bossRoot.setEnabled(bossActive);
    if (bossActive && steward) {
      this.bossRoot.position.set(scaled(steward.x), 0, scaled(steward.y));
      const phaseScale = steward.bossPhase === 2 ? 1.18 : 1;
      this.bossRoot.scaling.set(phaseScale, phaseScale, phaseScale);
      this.bossRings.forEach((ring, index) => {
        ring.rotation.y = state.time * (0.34 + index * 0.08) * (index % 2 === 0 ? 1 : -1);
      });
    }

    const activeInteractableKinds = [...new Set(interactables.map(object => perseidInteractableCue(object.kind)).filter(Boolean))];
    const activeHazardKinds = [...new Set(activeHazards.map(hazardItem => perseidHazardCue(hazardItem.kind)))];
    this.canvas.dataset.babylonPerseidState = 'ready';
    this.canvas.dataset.babylonPerseidParity = 'stage-identity+keel-continuity+stage-props+interactables+hazards+steward-cues+shared-location-foundations';
    this.canvas.dataset.megastructureVisual = 'procedural-perseid-capstone-babylon';
    this.canvas.dataset.megastructureIdentity = BABYLON_PERSEID_CAPSTONE_IDENTITY.megastructure;
    this.canvas.dataset.megastructureStage = `${stage.stage}:${stage.code}:${stage.name.toLowerCase().replaceAll(' ', '-')}`;
    this.canvas.dataset.megastructureContinuity = BABYLON_PERSEID_CAPSTONE_IDENTITY.continuity;
    this.canvas.dataset.megastructureStageKit = stage.kit.join('+');
    this.canvas.dataset.megastructureStagePurpose = stage.purpose;
    this.canvas.dataset.megastructureStageContinuity = stage.continuity;
    this.canvas.dataset.megastructureStageEvents = stage.eventA + '|' + stage.eventB;
    this.canvas.dataset.megastructureBatching = 'continuity-pairs+pooled-stage-cues';
    this.canvas.dataset.megastructureContinuityDrawCalls = 'babylon-shared-geometry';
    this.canvas.dataset.megastructurePerformanceProfile = `${profile.name}:ribs-${profile.ribPairs}:guides-${profile.guideLights}:props-${profile.stageProps}:shadows-${profile.castStructuralShadows ? 'on' : 'off'}`;
    this.canvas.dataset.megastructureReadability = BABYLON_PERSEID_CAPSTONE_IDENTITY.readability;
    this.canvas.dataset.megastructureInteractableCues = String(Math.min(interactables.length, this.interactableCues.length));
    this.canvas.dataset.megastructureInteractableLanguage = activeInteractableKinds.join('+') || 'shared-world-cues';
    this.canvas.dataset.megastructureHazardCues = String(Math.min(activeHazards.length, this.hazardCues.length));
    this.canvas.dataset.megastructureHazardLanguage = activeHazardKinds.join('+') || 'shared-world-cues';
    this.canvas.dataset.megastructureBossPresentation = BABYLON_PERSEID_CAPSTONE_IDENTITY.boss;
    this.canvas.dataset.megastructureBossCue = 'steward-seal+phase-rings+command-core';
    this.canvas.dataset.megastructureBossCueState = perseidStewardCueState(state);
    this.canvas.dataset.megastructurePlayerPosition = `${state.player.x.toFixed(1)},${state.player.y.toFixed(1)}`;
  }

  release(reason: string) {
    if (this.released) return;
    this.released = true;
    this.root.setEnabled(false);
    this.bossRoot.setEnabled(false);
    this.interactableCues.forEach(cue => cue.root.setEnabled(false));
    this.hazardCues.forEach(cue => cue.root.setEnabled(false));
    this.canvas.dataset.babylonPerseidState = 'released';
    this.canvas.dataset.babylonPerseidRelease = reason;
    for (const key of [
      'babylonPerseidParity',
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
