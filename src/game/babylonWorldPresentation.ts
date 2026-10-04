import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import {
  getBabylonGraphicsAssetRuntime,
  type BabylonGraphicsAssetInstance,
} from './babylonGraphicsAssets';
import type { Contract } from './campaign';
import { getNextMissionObjectiveTarget } from './encounters';
import { groundLootPresentation } from './fieldLoot';
import {
  INTERACTABLE_ASSET_FAMILIES,
  PICKUP_ASSET_FAMILY,
} from './graphicsAssetManifest';
import { selectGraphicsAssetSpec } from './graphicsAssets';
import { findNavigationPath } from './mapPathfinding';
import type { CombatObject, Hazard, SimState } from './sim';
import {
  biomeWorldState,
  hazardWorldPresentation,
  interactableWorldPresentation,
  materialWorldResponse,
  worldMaterialQualityProfile,
} from './worldMaterialPolish';

const WORLD_SCALE = 0.02;

type ReadabilityShape = ReturnType<typeof groundLootPresentation>['shape'];

type WorldObjectVisual = {
  mesh: Mesh;
  material: PBRMaterial;
  height: number;
};

type WorldCueVisual = {
  root: TransformNode;
  ring: Mesh;
  glyph: Mesh;
  ringMaterial: StandardMaterial;
  glyphMaterial: StandardMaterial;
  shape: ReadabilityShape;
};

type AuthoredInteractableVisual = {
  instance: BabylonGraphicsAssetInstance;
  mount: TransformNode;
  assetId: string;
};

type GroundLootVisual = {
  root: TransformNode;
  core: Mesh;
  marker: Mesh;
  ring: Mesh;
  beam: Mesh;
  coreMaterial: StandardMaterial;
  markerMaterial: StandardMaterial;
  ringMaterial: StandardMaterial;
  beamMaterial: StandardMaterial;
  markerShape: ReadabilityShape;
  authoredInstance: BabylonGraphicsAssetInstance | null;
  authoredMount: TransformNode | null;
  assetId: string | null;
  assetRequested: boolean;
};

type RingVisual = {
  mesh: Mesh;
  material: StandardMaterial;
};

type ObjectiveVisual = {
  root: TransformNode;
  ring: Mesh;
  diamond: Mesh;
  chevron: Mesh;
  beam: Mesh;
  materials: StandardMaterial[];
};

function scaled(value: number) {
  return value * WORLD_SCALE;
}

function colorFromHex(hex: number) {
  return Color3.FromInts((hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff);
}

function panelObject(object: CombatObject) {
  return object.kind === 'doorControl'
    || object.kind === 'gravityControl'
    || object.kind === 'sealControl'
    || object.kind === 'powerControl'
    || object.kind === 'salvageNode';
}

function objectColor(object: CombatObject) {
  if (object.kind === 'conduit') return object.exposed ? 0x8c6538 : 0x304b46;
  if (object.kind === 'coolant') return 0x356777;
  if (object.kind === 'breachPlate') return 0x584c43;
  if (object.kind === 'doorControl') return 0x4b8476;
  if (object.kind === 'gravityControl') return 0x5f83ad;
  if (object.kind === 'sealControl') return 0x966d4e;
  if (object.kind === 'powerControl') return 0x775d91;
  if (object.kind === 'salvageNode') return 0x868454;
  if (object.kind === 'anchorNode') return 0x87507f;
  if (object.material === 'light') return 0x485650;
  if (object.material === 'industrial') return 0x394542;
  return 0x293331;
}

function worldQualityName(detailScale: number): 'high' | 'balanced' | 'performance' {
  if (detailScale < 0.55) return 'performance';
  if (detailScale < 0.8) return 'balanced';
  return 'high';
}

function lerp(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}

export class BabylonRefineryWorldPresentation {
  private readonly scene: Scene;
  private readonly canvas: HTMLCanvasElement;
  private readonly objectVisuals = new Map<string, WorldObjectVisual>();
  private readonly interactableCues = new Map<string, WorldCueVisual>();
  private readonly authoredInteractables = new Map<string, AuthoredInteractableVisual>();
  private readonly interactableRequests = new Set<string>();
  private readonly hazards: WorldCueVisual[] = [];
  private readonly breaches: RingVisual[] = [];
  private readonly loot: GroundLootVisual[] = [];
  private objective: ObjectiveVisual | null = null;
  private readonly objectiveGuide: Mesh[] = [];
  private objectiveGuideTargetId = '';
  private objectiveGuideRefreshAt = -1;
  private objectiveGuidePoints: Array<{ x: number; y: number }> = [];
  private worldState: RingVisual | null = null;
  private loadGeneration = 0;
  private active = false;
  private disposed = false;

  constructor(scene: Scene, canvas: HTMLCanvasElement, _coarse: boolean) {
    this.scene = scene;
    this.canvas = canvas;
    canvas.dataset.babylonWorldState = 'idle';
    canvas.dataset.interactableVisual = 'procedural-loading-babylon';
    canvas.dataset.lootVisual = 'procedural-ready-babylon';
    canvas.dataset.worldReadability = 'loading';
  }

  sync(state: SimState, mission: Contract, detailScale: number) {
    if (this.disposed) return;
    this.active = true;
    this.syncObjects(state, detailScale);
    this.syncObjective(state, mission);
    this.syncGroundLoot(state, detailScale);
    this.syncHazards(state, detailScale);
    this.syncBreaches(state);
    this.syncWorldState(state, mission, detailScale);
    const stats = getBabylonGraphicsAssetRuntime(this.scene).stats();
    this.canvas.dataset.babylonWorldState = 'ready';
    this.canvas.dataset.worldPresentationMode = 'scene-meshes-not-hud';
    this.canvas.dataset.babylonWorldRuntime = [
      'cached:' + stats.cachedAssets,
      'active:' + stats.activeInstances,
      'bytes:' + stats.estimatedCachedCompressedBytes,
    ].join('|');
    this.canvas.dataset.babylonSceneTelemetry = [
      'meshes:' + this.scene.meshes.length,
      'materials:' + this.scene.materials.length,
      'textures:' + this.scene.textures.length,
      'roots:' + this.scene.rootNodes.length,
    ].join('|');
  }

  release(reason: string) {
    if (!this.active
      && this.objectVisuals.size === 0
      && this.authoredInteractables.size === 0
      && this.loot.length === 0) {
      return;
    }
    this.active = false;
    this.loadGeneration += 1;

    for (const visual of this.authoredInteractables.values()) {
      visual.instance.release();
      visual.mount.dispose();
    }
    this.authoredInteractables.clear();
    this.interactableRequests.clear();

    for (const visual of this.objectVisuals.values()) {
      visual.mesh.dispose();
      visual.material.dispose();
    }
    this.objectVisuals.clear();
    for (const visual of this.interactableCues.values()) this.disposeCue(visual);
    this.interactableCues.clear();

    for (const visual of this.hazards.splice(0)) this.disposeCue(visual);
    for (const visual of this.breaches.splice(0)) {
      visual.mesh.dispose();
      visual.material.dispose();
    }
    for (const visual of this.loot.splice(0)) {
      visual.authoredInstance?.release();
      visual.authoredMount?.dispose();
      visual.core.dispose();
      visual.marker.dispose();
      visual.ring.dispose();
      visual.beam.dispose();
      visual.coreMaterial.dispose();
      visual.markerMaterial.dispose();
      visual.ringMaterial.dispose();
      visual.beamMaterial.dispose();
      visual.root.dispose();
    }

    if (this.objective) {
      this.objective.ring.dispose();
      this.objective.diamond.dispose();
      this.objective.chevron.dispose();
      this.objective.beam.dispose();
      this.objective.materials.forEach(material => material.dispose());
      this.objective.root.dispose();
      this.objective = null;
    }
    for (const marker of this.objectiveGuide.splice(0)) {
      const material = marker.material;
      marker.dispose();
      material?.dispose();
    }
    if (this.worldState) {
      this.worldState.mesh.dispose();
      this.worldState.material.dispose();
      this.worldState = null;
    }

    this.objectiveGuideTargetId = '';
    this.objectiveGuideRefreshAt = -1;
    this.objectiveGuidePoints = [];
    this.canvas.dataset.babylonWorldState = 'released';
    this.canvas.dataset.worldObjectCount = '0';
    this.canvas.dataset.interactableActive = '0';
    this.canvas.dataset.interactableAuthoredCount = '0';
    this.canvas.dataset.hazardActive = '0';
    this.canvas.dataset.lootActive = '0';
    this.canvas.dataset.breachActive = '0';
    this.canvas.dataset.babylonWorldRelease = reason + ':deterministic';
  }

  dispose() {
    if (this.disposed) return;
    this.release('renderer-dispose');
    this.disposed = true;
  }

  private createSignalMaterial(name: string, color: number, alpha: number) {
    const material = new StandardMaterial(name, this.scene);
    material.diffuseColor = colorFromHex(color).scale(0.22);
    material.emissiveColor = colorFromHex(color);
    material.specularColor = Color3.Black();
    material.alpha = alpha;
    material.disableLighting = true;
    material.backFaceCulling = false;
    return material;
  }

  private createGlyph(name: string, shape: ReadabilityShape, material: StandardMaterial) {
    let mesh: Mesh;
    if (shape === 'bar') {
      mesh = MeshBuilder.CreateBox(name, { width: 0.46, height: 0.08, depth: 0.18 }, this.scene);
    } else if (shape === 'hexagon') {
      mesh = MeshBuilder.CreateCylinder(name, { height: 0.08, diameter: 0.36, tessellation: 6 }, this.scene);
    } else if (shape === 'star') {
      mesh = MeshBuilder.CreateCylinder(name, { height: 0.08, diameter: 0.40, tessellation: 5 }, this.scene);
      mesh.scaling.set(1.08, 1, 0.82);
    } else {
      mesh = MeshBuilder.CreateBox(name, { width: 0.26, height: 0.08, depth: 0.26 }, this.scene);
      mesh.rotation.y = Math.PI / 4;
    }
    mesh.material = material;
    mesh.isPickable = false;
    return mesh;
  }

  private replaceCueGlyph(visual: WorldCueVisual, shape: ReadabilityShape, name: string) {
    if (visual.shape === shape) return;
    const previous = visual.glyph;
    const next = this.createGlyph(name, shape, visual.glyphMaterial);
    next.parent = visual.root;
    next.position.copyFrom(previous.position);
    next.rotation.copyFrom(previous.rotation);
    next.scaling.copyFrom(previous.scaling);
    previous.dispose();
    visual.glyph = next;
    visual.shape = shape;
  }

  private ensureInteractableCue(object: CombatObject) {
    const presentation = interactableWorldPresentation(object.kind);
    if (!presentation) return null;
    const existing = this.interactableCues.get(object.id);
    if (existing) {
      this.replaceCueGlyph(existing, presentation.shape, 'p27-b5-interactable-glyph-' + object.id);
      return existing;
    }
    const root = new TransformNode('p27-b5-interactable-cue-' + object.id, this.scene);
    const ringMaterial = this.createSignalMaterial('p27-b5-interactable-ring-material-' + object.id, presentation.color, 0.24);
    const glyphMaterial = this.createSignalMaterial('p27-b5-interactable-glyph-material-' + object.id, presentation.color, 0.72);
    const ring = MeshBuilder.CreateTorus('p27-b5-interactable-ring-' + object.id, {
      diameter: 1,
      thickness: 0.07,
      tessellation: 28,
    }, this.scene);
    ring.parent = root;
    ring.position.y = 0.035;
    ring.material = ringMaterial;
    ring.isPickable = false;
    const glyph = this.createGlyph('p27-b5-interactable-glyph-' + object.id, presentation.shape, glyphMaterial);
    glyph.parent = root;
    glyph.position.y = 0.92;
    const visual = { root, ring, glyph, ringMaterial, glyphMaterial, shape: presentation.shape };
    this.interactableCues.set(object.id, visual);
    return visual;
  }

  private async loadInteractable(object: CombatObject, detailScale: number) {
    if (this.interactableRequests.has(object.id)) return;
    const family = object.kind === 'salvageNode'
      ? INTERACTABLE_ASSET_FAMILIES.salvage
      : panelObject(object)
        ? INTERACTABLE_ASSET_FAMILIES.control
        : null;
    if (!family) return;
    const spec = selectGraphicsAssetSpec(family, detailScale);
    if (!spec) return;
    this.interactableRequests.add(object.id);
    const generation = this.loadGeneration;
    try {
      const instance = await getBabylonGraphicsAssetRuntime(this.scene).instantiate(spec);
      if (this.disposed || !this.active || generation !== this.loadGeneration) {
        instance.release();
        return;
      }
      const mount = new TransformNode('p27-b5-authored-interactable-' + object.id, this.scene);
      mount.setEnabled(false);
      instance.rootNodes.forEach(root => {
        root.parent = mount;
      });
      this.authoredInteractables.set(object.id, { instance, mount, assetId: spec.id });
      const loaded = new Set((this.canvas.dataset.interactableAssets ?? '').split(',').filter(Boolean));
      loaded.add(spec.id);
      this.canvas.dataset.interactableAssets = [...loaded].sort().join(',');
      this.canvas.dataset.interactableVisual = 'authored-babylon';
      this.canvas.dataset.interactableMode = 'control-terminal+salvage-tag-node';
    } catch (error) {
      if (this.disposed || generation !== this.loadGeneration) return;
      const fallback = new Set((this.canvas.dataset.interactableFallback ?? '').split(',').filter(Boolean));
      fallback.add(object.kind === 'salvageNode' ? 'salvage' : 'control');
      this.canvas.dataset.interactableFallback = [...fallback].sort().join(',');
      this.canvas.dataset.interactableVisual = 'procedural-fallback-babylon';
      console.warn('Babylon authored interactable failed for ' + object.id + '; keeping procedural fallback.', error);
    }
  }

  private syncObjects(state: SimState, detailScale: number) {
    const quality = worldMaterialQualityProfile(worldQualityName(detailScale));
    const activeIds = new Set<string>();
    let activeCount = 0;
    let interactableCount = 0;
    for (const object of state.objects) {
      activeIds.add(object.id);
      let visual = this.objectVisuals.get(object.id);
      if (!visual) {
        const height = panelObject(object) ? 0.7 : object.kind === 'cover' ? 1.25 : 1.05;
        const material = new PBRMaterial('p27-b5-object-material-' + object.id, this.scene);
        material.albedoColor = colorFromHex(objectColor(object));
        material.metallic = 0.55;
        material.roughness = 0.48;
        const mesh = MeshBuilder.CreateBox('p27-b5-object-' + object.id, {
          width: Math.max(0.15, scaled(object.w)),
          height,
          depth: Math.max(0.15, scaled(object.h)),
        }, this.scene);
        mesh.material = material;
        mesh.isPickable = false;
        visual = { mesh, material, height };
        this.objectVisuals.set(object.id, visual);
        if (panelObject(object)) void this.loadInteractable(object, detailScale);
      }

      if (object.active) activeCount += 1;
      const authored = this.authoredInteractables.get(object.id);
      visual.mesh.setEnabled(object.active && !authored);
      visual.mesh.position.set(scaled(object.x + object.w / 2), visual.height / 2, scaled(object.y + object.h / 2));
      const response = materialWorldResponse(object.material);
      visual.material.albedoColor = colorFromHex(objectColor(object));
      visual.material.alpha = object.kind === 'cover'
        && Math.hypot(object.x + object.w / 2 - state.player.x, object.y + object.h / 2 - state.player.y) < 155
        ? 0.48
        : 1;
      visual.material.emissiveColor = object.exposed ? colorFromHex(0xd69b4d).scale(0.32) : Color3.Black();
      visual.material.metallic = lerp(0.32, response.metalness, quality.materialDepthScale);
      visual.material.roughness = lerp(0.62, response.roughness, quality.materialDepthScale);
      const hpRatio = object.maxHp > 0 ? Math.max(0.18, Math.min(1, object.hp / object.maxHp)) : 1;
      visual.mesh.scaling.y = object.destructible && object.maxHp < 9000 ? 0.72 + hpRatio * 0.28 : 1;

      const presentation = interactableWorldPresentation(object.kind);
      const cue = this.ensureInteractableCue(object);
      if (cue && presentation) {
        if (object.active) interactableCount += 1;
        const centerX = object.x + object.w / 2;
        const centerY = object.y + object.h / 2;
        const footprintScale = Math.max(0.68, Math.min(1.18, scaled(Math.max(object.w, object.h)) * 0.78));
        const statusColor = object.exposed ? 0x8bd29a : presentation.color;
        const pulse = 0.88 + Math.sin(state.time * presentation.pulseHz + centerX * 0.012) * 0.12 * quality.stateMotionScale;
        cue.root.setEnabled(object.active);
        cue.root.position.set(scaled(centerX), 0, scaled(centerY));
        cue.ringMaterial.diffuseColor = colorFromHex(statusColor).scale(0.2);
        cue.ringMaterial.emissiveColor = colorFromHex(statusColor);
        cue.ringMaterial.alpha = (0.18 + (object.exposed ? 0.09 : 0.04)) * quality.interactableCueOpacity;
        cue.ring.scaling.set(footprintScale * presentation.scaleX * pulse, 1, footprintScale * presentation.scaleZ * pulse);
        cue.glyphMaterial.diffuseColor = colorFromHex(statusColor).scale(0.2);
        cue.glyphMaterial.emissiveColor = colorFromHex(statusColor);
        cue.glyphMaterial.alpha = quality.interactableCueOpacity;
        const glyphScale = 0.86 + (object.exposed ? 0.08 : 0);
        cue.glyph.scaling.set(glyphScale * presentation.scaleX, 1, glyphScale * presentation.scaleZ);
        cue.glyph.rotation.y = (presentation.shape === 'diamond' ? Math.PI / 4 : 0)
          + state.time * 0.22 * quality.stateMotionScale;
      }

      if (authored) {
        authored.mount.setEnabled(object.active);
        authored.mount.position.set(scaled(object.x + object.w / 2), 0, scaled(object.y + object.h / 2));
        const footprintScale = Math.max(0.72, Math.min(1.08, scaled(Math.max(object.w, object.h)) * 0.82));
        const authoredScale = object.kind === 'salvageNode' ? Math.max(0.82, footprintScale) : footprintScale;
        authored.mount.scaling.set(authoredScale, authoredScale, authoredScale);
      }
    }

    for (const [id, visual] of this.objectVisuals) if (!activeIds.has(id)) visual.mesh.setEnabled(false);
    for (const [id, visual] of this.interactableCues) if (!activeIds.has(id)) visual.root.setEnabled(false);
    for (const [id, visual] of this.authoredInteractables) if (!activeIds.has(id)) visual.mount.setEnabled(false);

    this.canvas.dataset.worldObjectCount = String(activeCount);
    this.canvas.dataset.interactableActive = String(interactableCount);
    this.canvas.dataset.interactableAuthoredCount = String(
      [...this.authoredInteractables.values()].filter(visual => visual.mount.isEnabled()).length,
    );
    this.canvas.dataset.interactableReadability = 'shape-coded+state-emissive+floor-cue:quality-safe';
  }

  private ensureObjective() {
    if (this.objective) return this.objective;
    const root = new TransformNode('p27-b5-objective-root', this.scene);
    const ringMaterial = this.createSignalMaterial('p27-b5-objective-ring-material', 0xc8e87f, 0.92);
    const diamondMaterial = this.createSignalMaterial('p27-b5-objective-diamond-material', 0xc8e87f, 0.96);
    const chevronMaterial = this.createSignalMaterial('p27-b5-objective-chevron-material', 0xf4f0bf, 0.9);
    const beamMaterial = this.createSignalMaterial('p27-b5-objective-beam-material', 0xc8e87f, 0.34);
    const ring = MeshBuilder.CreateTorus('p27-b5-objective-ring', { diameter: 1.24, thickness: 0.13, tessellation: 36 }, this.scene);
    ring.parent = root;
    ring.position.y = 0.08;
    ring.material = ringMaterial;
    ring.isPickable = false;
    const diamond = this.createGlyph('p27-b5-objective-diamond', 'diamond', diamondMaterial);
    diamond.parent = root;
    diamond.position.y = 1.75;
    diamond.scaling.set(1.35, 1.35, 1.35);
    const chevron = MeshBuilder.CreateCylinder('p27-b5-objective-chevron', {
      height: 0.30,
      diameterTop: 0,
      diameterBottom: 0.34,
      tessellation: 3,
    }, this.scene);
    chevron.parent = root;
    chevron.position.y = 2.16;
    chevron.rotation.z = Math.PI;
    chevron.material = chevronMaterial;
    chevron.isPickable = false;
    const beam = MeshBuilder.CreateCylinder('p27-b5-objective-beam', {
      height: 1.28,
      diameter: 0.045,
      tessellation: 6,
    }, this.scene);
    beam.parent = root;
    beam.position.y = 1.05;
    beam.material = beamMaterial;
    beam.isPickable = false;
    this.objective = { root, ring, diamond, chevron, beam, materials: [ringMaterial, diamondMaterial, chevronMaterial, beamMaterial] };
    return this.objective;
  }

  private ensureGuideMarker(index: number) {
    while (this.objectiveGuide.length <= index) {
      const markerIndex = this.objectiveGuide.length;
      const material = this.createSignalMaterial('p27-b5-objective-guide-material-' + markerIndex, 0xc8e87f, 0.56);
      const marker = MeshBuilder.CreateBox('p27-b5-objective-guide-' + markerIndex, {
        width: 0.28,
        height: 0.035,
        depth: 0.28,
      }, this.scene);
      marker.material = material;
      marker.isPickable = false;
      marker.rotation.y = Math.PI / 4;
      marker.setEnabled(false);
      this.objectiveGuide.push(marker);
    }
    return this.objectiveGuide[index];
  }

  private syncObjective(state: SimState, mission: Contract) {
    const target = getNextMissionObjectiveTarget(state, mission);
    const visual = this.ensureObjective();
    if (!target) {
      visual.root.setEnabled(false);
      this.objectiveGuide.forEach(marker => marker.setEnabled(false));
      this.canvas.dataset.objectiveTarget = 'complete';
      this.canvas.dataset.objectiveWorldCue = 'complete';
      this.canvas.dataset.objectiveGuideCount = '0';
      return;
    }

    visual.root.setEnabled(true);
    visual.root.position.set(scaled(target.x + target.w / 2), 0, scaled(target.y + target.h / 2));
    const pulse = 1 + Math.sin(state.time * 6.5) * 0.08;
    visual.root.scaling.set(pulse, pulse, pulse);
    visual.ring.rotation.y = state.time * 0.9;
    visual.diamond.rotation.y = Math.PI / 4 + state.time * 1.8;
    visual.diamond.position.y = 1.75 + Math.sin(state.time * 4.2) * 0.08;
    visual.chevron.rotation.y = state.time * 1.1;
    visual.chevron.position.y = 2.18 + Math.sin(state.time * 4.2 + 0.8) * 0.12;

    if (this.objectiveGuideTargetId !== target.id || state.time >= this.objectiveGuideRefreshAt) {
      const result = findNavigationPath(state, target);
      this.objectiveGuideTargetId = target.id;
      this.objectiveGuideRefreshAt = state.time + 0.55;
      const markers: Array<{ x: number; y: number }> = [];
      for (let index = 0; index < result.points.length - 1; index += 1) {
        const a = result.points[index];
        const b = result.points[index + 1];
        const distance = Math.hypot(b.x - a.x, b.y - a.y);
        const count = Math.max(1, Math.floor(distance / 125));
        for (let step = 1; step <= count; step += 1) {
          const amount = step / (count + 1);
          markers.push({ x: a.x + (b.x - a.x) * amount, y: a.y + (b.y - a.y) * amount });
        }
      }
      this.objectiveGuidePoints = markers.slice(0, 28);
    }

    for (let index = 0; index < this.objectiveGuide.length; index += 1) {
      this.objectiveGuide[index].setEnabled(index < this.objectiveGuidePoints.length);
    }
    for (let index = 0; index < this.objectiveGuidePoints.length; index += 1) {
      const point = this.objectiveGuidePoints[index];
      const marker = this.ensureGuideMarker(index);
      const markerPulse = 0.82 + Math.sin(state.time * 6.5 + index * 0.7) * 0.14;
      marker.setEnabled(true);
      marker.position.set(scaled(point.x), 0.075, scaled(point.y));
      marker.scaling.set(markerPulse, markerPulse, markerPulse);
      const material = marker.material as StandardMaterial;
      material.alpha = 0.56 + Math.sin(state.time * 5.4 + index * 0.2) * 0.1;
    }

    this.canvas.dataset.objectiveTarget = target.id;
    this.canvas.dataset.objectiveWorldCue = 'beacon+navigation-path';
    this.canvas.dataset.objectiveGuideCount = String(this.objectiveGuidePoints.length);
  }

  private ensureLoot(index: number, detailScale: number) {
    while (this.loot.length <= index) {
      const visualIndex = this.loot.length;
      const root = new TransformNode('p27-b5-loot-root-' + visualIndex, this.scene);
      const coreMaterial = this.createSignalMaterial('p27-b5-loot-core-material-' + visualIndex, 0xffffff, 1);
      coreMaterial.disableLighting = false;
      const markerMaterial = this.createSignalMaterial('p27-b5-loot-marker-material-' + visualIndex, 0xffffff, 0.92);
      const ringMaterial = this.createSignalMaterial('p27-b5-loot-ring-material-' + visualIndex, 0xffffff, 0.75);
      const beamMaterial = this.createSignalMaterial('p27-b5-loot-beam-material-' + visualIndex, 0xffffff, 0.22);
      const core = MeshBuilder.CreateCylinder('p27-b5-loot-core-' + visualIndex, {
        height: 0.32,
        diameter: 0.34,
        tessellation: 4,
      }, this.scene);
      core.parent = root;
      core.position.y = 0.52;
      core.rotation.y = Math.PI / 4;
      core.material = coreMaterial;
      core.isPickable = false;
      const marker = this.createGlyph('p27-b5-loot-marker-' + visualIndex, 'diamond', markerMaterial);
      marker.parent = root;
      marker.position.y = 1.16;
      const ring = MeshBuilder.CreateTorus('p27-b5-loot-ring-' + visualIndex, { diameter: 1, thickness: 0.065, tessellation: 28 }, this.scene);
      ring.parent = root;
      ring.position.y = 0.06;
      ring.material = ringMaterial;
      ring.isPickable = false;
      const beam = MeshBuilder.CreateCylinder('p27-b5-loot-beam-' + visualIndex, { height: 1.7, diameter: 0.055, tessellation: 6 }, this.scene);
      beam.parent = root;
      beam.position.y = 0.9;
      beam.material = beamMaterial;
      beam.isPickable = false;
      const visual: GroundLootVisual = {
        root,
        core,
        marker,
        ring,
        beam,
        coreMaterial,
        markerMaterial,
        ringMaterial,
        beamMaterial,
        markerShape: 'diamond',
        authoredInstance: null,
        authoredMount: null,
        assetId: null,
        assetRequested: false,
      };
      this.loot.push(visual);
      void this.loadGroundLoot(visual, detailScale, visualIndex);
    }
    return this.loot[index];
  }

  private replaceLootMarker(visual: GroundLootVisual, shape: ReadabilityShape, index: number) {
    if (visual.markerShape === shape) return;
    const previous = visual.marker;
    const next = this.createGlyph('p27-b5-loot-marker-' + index, shape, visual.markerMaterial);
    next.parent = visual.root;
    next.position.copyFrom(previous.position);
    next.rotation.copyFrom(previous.rotation);
    next.scaling.copyFrom(previous.scaling);
    previous.dispose();
    visual.marker = next;
    visual.markerShape = shape;
  }

  private async loadGroundLoot(visual: GroundLootVisual, detailScale: number, index: number) {
    if (visual.assetRequested) return;
    visual.assetRequested = true;
    const spec = selectGraphicsAssetSpec(PICKUP_ASSET_FAMILY, detailScale);
    if (!spec) return;
    const generation = this.loadGeneration;
    try {
      const instance = await getBabylonGraphicsAssetRuntime(this.scene).instantiate(spec);
      if (this.disposed || !this.active || generation !== this.loadGeneration) {
        instance.release();
        return;
      }
      const mount = new TransformNode('p27-b5-authored-loot-' + index, this.scene);
      mount.parent = visual.root;
      instance.rootNodes.forEach(root => {
        root.parent = mount;
      });
      visual.authoredInstance = instance;
      visual.authoredMount = mount;
      visual.assetId = spec.id;
      visual.core.setEnabled(false);
      this.canvas.dataset.lootVisual = 'authored-babylon';
      this.canvas.dataset.lootAsset = spec.id;
    } catch (error) {
      if (this.disposed || generation !== this.loadGeneration) return;
      visual.core.setEnabled(true);
      this.canvas.dataset.lootVisual = 'procedural-fallback-babylon';
      console.warn('Babylon authored recovery pickup failed; keeping procedural fallback.', error);
    }
  }

  private syncGroundLoot(state: SimState, detailScale: number) {
    const quality = worldMaterialQualityProfile(worldQualityName(detailScale));
    let count = 0;
    for (const drop of state.groundLoot) {
      if (!drop.active || drop.collected) continue;
      const visual = this.ensureLoot(count, detailScale);
      const presentation = groundLootPresentation(drop.rarity);
      this.replaceLootMarker(visual, presentation.shape, count);
      const color = colorFromHex(presentation.color);
      visual.root.setEnabled(true);
      visual.root.position.set(scaled(drop.x), 0, scaled(drop.y));
      visual.root.rotation.y = state.time * 0.8 + drop.enemyId;
      visual.core.setEnabled(!visual.authoredInstance);
      visual.coreMaterial.diffuseColor = color.scale(0.45);
      visual.coreMaterial.emissiveColor = color.scale(0.8);
      visual.markerMaterial.diffuseColor = color.scale(0.3);
      visual.markerMaterial.emissiveColor = color;
      visual.ringMaterial.diffuseColor = color.scale(0.2);
      visual.ringMaterial.emissiveColor = color;
      visual.beamMaterial.diffuseColor = color.scale(0.15);
      visual.beamMaterial.emissiveColor = color;
      const pulse = 1 + Math.sin(state.time * 7 + drop.enemyId) * 0.12;
      visual.core.scaling.set(
        presentation.markerScale * pulse,
        presentation.markerScale * pulse,
        presentation.markerScale * pulse,
      );
      const markerPulse = presentation.markerScale * (0.96 + Math.sin(state.time * 6 + drop.enemyId) * 0.06);
      visual.marker.scaling.set(markerPulse, markerPulse, markerPulse);
      visual.marker.position.y = 1.14 + Math.sin(state.time * 4.5 + drop.enemyId) * 0.08;
      visual.marker.rotation.y = (presentation.shape === 'diamond' ? Math.PI / 4 : 0)
        + (presentation.shape === 'bar' ? 0 : state.time * 0.55);
      if (visual.authoredMount) {
        const authoredScale = 1 + presentation.rank * 0.055;
        const authoredPulse = authoredScale * (0.98 + Math.sin(state.time * 5 + drop.enemyId) * 0.025);
        visual.authoredMount.scaling.set(authoredPulse, authoredPulse, authoredPulse);
        visual.authoredMount.position.y = 0.10 + Math.sin(state.time * 4.5 + drop.enemyId) * 0.035;
      }
      visual.ring.scaling.set(presentation.ringScale, 1, presentation.ringScale);
      visual.beam.scaling.y = presentation.beaconScale;
      visual.beam.position.y = 0.85 * presentation.beaconScale;
      visual.beamMaterial.alpha = (0.14 + presentation.rank * 0.11) * quality.pickupBeamScale;
      count += 1;
    }
    for (let index = count; index < this.loot.length; index += 1) this.loot[index].root.setEnabled(false);
    this.canvas.dataset.lootActive = String(count);
    this.canvas.dataset.lootReadability = 'authored-capsule+rarity-shape+ring+beam';
  }

  private ensureHazard(index: number, kind: Hazard['kind']) {
    while (this.hazards.length <= index) {
      const visualIndex = this.hazards.length;
      const presentation = hazardWorldPresentation(kind);
      const root = new TransformNode('p27-b5-hazard-root-' + visualIndex, this.scene);
      const ringMaterial = this.createSignalMaterial('p27-b5-hazard-ring-material-' + visualIndex, presentation.color, 0.62);
      const glyphMaterial = this.createSignalMaterial('p27-b5-hazard-glyph-material-' + visualIndex, presentation.color, 0.76);
      const ring = MeshBuilder.CreateTorus('p27-b5-hazard-ring-' + visualIndex, { diameter: 2, thickness: 0.09, tessellation: 36 }, this.scene);
      ring.parent = root;
      ring.material = ringMaterial;
      ring.isPickable = false;
      const glyph = this.createGlyph('p27-b5-hazard-glyph-' + visualIndex, presentation.shape, glyphMaterial);
      glyph.parent = root;
      glyph.position.y = 0.13;
      this.hazards.push({ root, ring, glyph, ringMaterial, glyphMaterial, shape: presentation.shape });
    }
    const visual = this.hazards[index];
    const presentation = hazardWorldPresentation(kind);
    this.replaceCueGlyph(visual, presentation.shape, 'p27-b5-hazard-glyph-' + index);
    return visual;
  }

  private syncHazards(state: SimState, detailScale: number) {
    const quality = worldMaterialQualityProfile(worldQualityName(detailScale));
    let count = 0;
    for (const hazard of state.hazards) {
      if (!hazard.active) continue;
      const presentation = hazardWorldPresentation(hazard.kind);
      const visual = this.ensureHazard(count, hazard.kind);
      const radius = Math.max(0.2, scaled(hazard.radius));
      const pulse = 1 + Math.sin(state.time * presentation.pulseHz) * 0.08 * quality.stateMotionScale;
      const color = colorFromHex(presentation.color);
      visual.root.setEnabled(true);
      visual.root.position.set(scaled(hazard.x), 0.08, scaled(hazard.y));
      visual.ringMaterial.diffuseColor = color.scale(0.18);
      visual.ringMaterial.emissiveColor = color;
      visual.ringMaterial.alpha = (0.4 + Math.sin(state.time * presentation.pulseHz) * 0.1) * quality.hazardCueOpacity;
      visual.ring.scaling.set(radius * presentation.scaleX * pulse, 1, radius * presentation.scaleZ * pulse);
      visual.ring.rotation.y = state.time * presentation.rotationSpeed * quality.stateMotionScale;
      visual.glyphMaterial.diffuseColor = color.scale(0.2);
      visual.glyphMaterial.emissiveColor = color;
      visual.glyphMaterial.alpha = quality.hazardCueOpacity;
      const glyphScale = Math.max(0.34, Math.min(0.86, radius * 0.28));
      visual.glyph.scaling.set(glyphScale * presentation.scaleX, 1, glyphScale * presentation.scaleZ);
      visual.glyph.rotation.y = state.time * presentation.rotationSpeed * 0.7 * quality.stateMotionScale;
      count += 1;
    }
    for (let index = count; index < this.hazards.length; index += 1) this.hazards[index].root.setEnabled(false);
    this.canvas.dataset.hazardActive = String(count);
    this.canvas.dataset.hazardReadability = 'shape-coded+floor-bound+quality-safe';
  }

  private ensureBreach(index: number) {
    while (this.breaches.length <= index) {
      const visualIndex = this.breaches.length;
      const material = this.createSignalMaterial('p27-b5-breach-material-' + visualIndex, 0xde9a52, 0.62);
      const mesh = MeshBuilder.CreateTorus('p27-b5-breach-' + visualIndex, { diameter: 2, thickness: 0.11, tessellation: 36 }, this.scene);
      mesh.material = material;
      mesh.isPickable = false;
      mesh.setEnabled(false);
      this.breaches.push({ mesh, material });
    }
    return this.breaches[index];
  }

  private syncBreaches(state: SimState) {
    let count = 0;
    for (const breach of state.breaches) {
      if (!breach.active) continue;
      const visual = this.ensureBreach(count);
      const color = breach.boss ? 0xef6f4e : 0xde9a52;
      const pulse = Math.max(0.38, scaled(breach.radius) * (1 + Math.sin(state.time * 3.4) * 0.07));
      visual.mesh.setEnabled(true);
      visual.mesh.position.set(scaled(breach.x), 0.1, scaled(breach.y));
      visual.mesh.scaling.set(pulse, 1, pulse);
      visual.mesh.rotation.y = state.time * 0.38;
      visual.material.diffuseColor = colorFromHex(color).scale(0.2);
      visual.material.emissiveColor = colorFromHex(color);
      visual.material.alpha = 0.55 + Math.sin(state.time * 5.2 + count) * 0.16;
      count += 1;
    }
    for (let index = count; index < this.breaches.length; index += 1) this.breaches[index].mesh.setEnabled(false);
    this.canvas.dataset.breachActive = String(count);
    this.canvas.dataset.breachReadability = 'pressure-state+floor-ring+boss-priority';
  }

  private ensureWorldState() {
    if (this.worldState) return this.worldState;
    const material = this.createSignalMaterial('p27-b5-world-state-material', 0xdc9a55, 0);
    const mesh = MeshBuilder.CreateTorus('p27-b5-world-state-floor-signal', { diameter: 3.2, thickness: 0.055, tessellation: 48 }, this.scene);
    mesh.material = material;
    mesh.isPickable = false;
    mesh.setEnabled(false);
    this.worldState = { mesh, material };
    return this.worldState;
  }

  private syncWorldState(state: SimState, mission: Contract, detailScale: number) {
    const qualityName = worldQualityName(detailScale);
    const quality = worldMaterialQualityProfile(qualityName);
    const biomeState = biomeWorldState(mission.location, state);
    const visual = this.ensureWorldState();
    visual.mesh.setEnabled(biomeState.severity > 0);
    if (biomeState.severity > 0) {
      const pulse = 1 + Math.sin(state.time * Math.max(1, biomeState.motionHz)) * 0.06 * quality.stateMotionScale;
      const scale = pulse * (1 + biomeState.severity * 0.24);
      visual.mesh.position.set(scaled(state.player.x), 0.028, scaled(state.player.y));
      visual.mesh.scaling.set(scale, 1, scale);
      visual.material.diffuseColor = colorFromHex(biomeState.color).scale(0.16);
      visual.material.emissiveColor = colorFromHex(biomeState.color);
      visual.material.alpha = (0.12 + biomeState.severity * 0.12) * quality.stateMotionScale;
    }
    this.canvas.dataset.worldReadability = 'interactables:shape+state|hazards:shape+motion|loot:shape+rarity';
    this.canvas.dataset.worldMaterialDepth = qualityName + ':material-response+state-emissive+quality-safe';
    this.canvas.dataset.biomeState = biomeState.id;
    this.canvas.dataset.biomeStateSeverity = biomeState.severity.toFixed(2);
    this.canvas.dataset.biomeStateAnimation = biomeState.motionHz > 0
      ? 'state-coupled:' + (biomeState.motionHz * quality.stateMotionScale).toFixed(2) + 'hz'
      : 'nominal-static';
    this.canvas.dataset.biomeStateAudio = biomeState.audioCue ?? 'nominal';
    this.canvas.dataset.worldStateVisual = 'floor-signal+breach-rings';
  }

  private disposeCue(visual: WorldCueVisual) {
    visual.ring.dispose();
    visual.glyph.dispose();
    visual.ringMaterial.dispose();
    visual.glyphMaterial.dispose();
    visual.root.dispose();
  }
}
