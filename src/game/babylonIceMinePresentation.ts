import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { getMapNavigationPlan } from './mapNavigation';
import type { RenderBudgetSnapshot } from './renderQuality';
import { getWorldSize, type CombatObject, type SimState } from './sim';

const WORLD_SCALE = 0.02;
const BRITTLE_SUPPORT_IDS = ['ice-brittle-gate-a', 'ice-brittle-gate-b'] as const;

export const BABYLON_ICE_MINE_IDENTITY = Object.freeze({
  silhouette: 'bore-crystals',
  material: 'frosted-industrial',
  lighting: 'ice-cyan',
  propSet: 'drill-service',
});

export const BABYLON_ICE_MINE_LIGHTING = Object.freeze({
  id: 'ice-cyan',
  keyColor: 0xd2e7ef,
  rimColor: 0x7ec9df,
  emergencyColor: 0x76cde9,
  keyIntensity: 2.1,
  rimIntensity: 1.1,
  emergencyIntensity: 8,
  exposure: 1.08,
});

export function iceMineFractureBudget(coarse: boolean, vfxDensity: number) {
  const reduced = coarse || vfxDensity < 0.55;
  return Object.freeze({
    shardBudget: reduced ? 4 : 8,
    crackBudget: reduced ? 2 : 3,
    detail: reduced ? '4-shards+2-cracks+frost-pulse' : '8-shards+3-cracks+frost-pulse',
  });
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
  metallic: number,
  roughness: number,
  emissive = 0,
  emissiveIntensity = 0,
) {
  const result = new PBRMaterial(name, scene);
  result.albedoColor = colorFromHex(color);
  result.metallic = metallic;
  result.roughness = roughness;
  result.emissiveColor = colorFromHex(emissive).scale(emissiveIntensity);
  return result;
}

function box(
  scene: Scene,
  parent: TransformNode,
  name: string,
  mat: PBRMaterial,
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
  mesh.material = mat;
  mesh.isPickable = false;
  return mesh;
}

function routeSegment(
  scene: Scene,
  parent: TransformNode,
  mat: PBRMaterial,
  name: string,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  width: number,
) {
  const dx = bx - ax;
  const dz = bz - az;
  const mesh = box(scene, parent, name, mat, (ax + bx) / 2, 0.018, (az + bz) / 2, Math.hypot(dx, dz), 0.035, width);
  mesh.rotation.y = -Math.atan2(dz, dx);
}

function machineryLabel(object: CombatObject) {
  if (object.kind === 'powerControl') return 'freeze-compressor-control';
  if (object.kind === 'gravityControl') return 'bore-stabilizer';
  if (object.id === 'salvage-node-a') return 'cryo-pump';
  if (object.id === 'salvage-node-b') return 'drill-service';
  if (object.kind === 'doorControl') return 'bore-pressure-lock';
  if (object.kind === 'sealControl') return 'coolant-manifold';
  return null;
}

function createSupportFrame(
  scene: Scene,
  parent: TransformNode,
  name: string,
  support: PBRMaterial,
  width = 2.18,
) {
  const root = new TransformNode(name, scene);
  root.parent = parent;
  box(scene, root, name + '-left', support, -width / 2, 1.18, 0, 0.22, 2.36, 0.32);
  box(scene, root, name + '-right', support, width / 2, 1.18, 0, 0.22, 2.36, 0.32);
  box(scene, root, name + '-header', support, 0, 2.28, 0, width + 0.22, 0.24, 0.34);
  return root;
}

export class BabylonIceMinePresentation {
  private readonly root: TransformNode;
  private readonly materials: PBRMaterial[];
  private readonly routeMaterials: readonly [PBRMaterial, PBRMaterial];
  private readonly machineryMaterial: PBRMaterial;
  private readonly machineryRoot: TransformNode;
  private readonly machineryCues = new Map<string, Mesh>();
  private readonly brittleSupportRoots = new Map<string, TransformNode>();
  private readonly fractureRoots = new Map<string, TransformNode>();
  private readonly fractureCracks = new Map<string, Mesh[]>();
  private readonly fractureShards = new Map<string, Mesh[]>();
  private readonly fracturePulses = new Map<string, Mesh>();
  private readonly supportLastActive = new Map<string, boolean>();
  private readonly collapseStartedAt = new Map<string, number>();
  private readonly fractureMaterial: StandardMaterial;
  private readonly fractureShardMaterial: StandardMaterial;
  private readonly bossCueRoot: TransformNode;
  private readonly bossCueMaterial: StandardMaterial;
  private readonly bossPhaseRing: Mesh;
  private readonly bossPhaseHalo: Mesh;
  private readonly frostMotes: Mesh[] = [];
  private readonly frostMoteBases: Vector3[] = [];
  private readonly frostMoteMaterial: StandardMaterial;
  private readonly hemisphere: HemisphericLight;
  private readonly keyLight: DirectionalLight;
  private readonly rimLight: DirectionalLight;
  private readonly emergencyLight: PointLight;
  private readonly readabilityLight: PointLight;
  private readonly practicalLights: readonly [PointLight, PointLight];
  private readonly meshCount: number;
  private released = true;

  constructor(
    private readonly scene: Scene,
    private readonly canvas: HTMLCanvasElement,
    private readonly coarse: boolean,
  ) {
    const world = getWorldSize();
    const worldW = scaled(world.w);
    const worldH = scaled(world.h);
    const cx = worldW / 2;
    const cz = worldH / 2;

    const floor = material(scene, 'p27-c5-ice-floor-material', 0x0b1820, 0.40, 0.72);
    const frost = material(scene, 'p27-c5-ice-frost-material', 0x719baa, 0.08, 0.34, 0x7ec9df, 0.08);
    const support = material(scene, 'p27-c5-ice-support-material', 0x465864, 0.82, 0.44);
    const service = material(scene, 'p27-c5-ice-service-material', 0x355f6e, 0.68, 0.42, 0x76cde9, 0.07);
    const ice = material(scene, 'p27-c5-ice-crystal-material', 0x8fc8d8, 0.04, 0.20, 0x7ec9df, 0.16);
    const machinery = material(scene, 'p27-c5-ice-machinery-material', 0x4d7888, 0.76, 0.38, 0x76cde9, 0.06);
    const routePrimary = material(scene, 'p27-c5-ice-route-primary-material', 0x244551, 0.58, 0.48, 0x8fdcf0, 0.18);
    const routeSecondary = material(scene, 'p27-c5-ice-route-secondary-material', 0x1b2930, 0.64, 0.54, 0x608f9f, 0.07);
    this.materials = [floor, frost, support, service, ice, machinery, routePrimary, routeSecondary];
    this.routeMaterials = [routePrimary, routeSecondary];
    this.machineryMaterial = machinery;

    this.root = new TransformNode('p27-c5-ice-mine-environment', scene);
    box(scene, this.root, 'p27-c5-ice-floor', floor, cx, -0.055, cz, worldW, 0.11, worldH);

    const frostWallPlacements = [
      [0.12, 0.15, 1.04], [0.28, 0.14, 0.96], [0.46, 0.14, 0.94], [0.64, 0.14, 0.96], [0.82, 0.15, 1.04],
      [0.12, 0.85, 1.04], [0.28, 0.86, 0.96], [0.46, 0.86, 0.94], [0.64, 0.86, 0.96], [0.82, 0.85, 1.04],
    ] as const;
    frostWallPlacements.forEach(([fx, fz, scale], index) => {
      const wall = box(
        scene,
        this.root,
        'p27-c5-ice-frost-wall-' + index,
        frost,
        worldW * fx,
        0.92 * scale,
        worldH * fz,
        4.6 * scale,
        1.84 * scale,
        0.64,
      );
      wall.rotation.y = index < 5 ? 0.015 : -0.015;
    });

    const supportPlacements = [
      [0.20, 0.50, 0.98], [0.44, 0.50, 0.94], [0.68, 0.50, 0.94], [0.78, 0.50, 0.98],
    ] as const;
    supportPlacements.forEach(([fx, fz, scale], index) => {
      const frame = createSupportFrame(scene, this.root, 'p27-c5-ice-support-frame-' + index, support);
      frame.position.set(worldW * fx, 0, worldH * fz);
      frame.scaling.set(scale, scale, scale);
    });

    BRITTLE_SUPPORT_IDS.forEach((id, index) => {
      const frame = createSupportFrame(scene, this.root, 'p27-c5-ice-brittle-support-' + id, support);
      frame.position.set(worldW * (index === 0 ? 0.32 : 0.56), 0, worldH * 0.45);
      frame.scaling.set(0.94, 0.94, 0.94);
      this.brittleSupportRoots.set(id, frame);

      const fractureRoot = new TransformNode('p27-c5-ice-fracture-' + id, scene);
      fractureRoot.parent = this.root;
      fractureRoot.position.copyFrom(frame.position);
      this.fractureRoots.set(id, fractureRoot);
    });

    const serviceDeckPlacements = [0.25, 0.40, 0.55, 0.70] as const;
    serviceDeckPlacements.forEach((fx, index) => {
      box(scene, this.root, 'p27-c5-ice-service-deck-' + index, service, worldW * fx, 0.16, worldH * 0.50, 5.0, 0.26, 1.62);
    });

    const cryoPumpPlacements = [
      [0.36, 0.34, Math.PI / 2, 0.88],
      [0.58, 0.66, -Math.PI / 2, 0.92],
    ] as const;
    cryoPumpPlacements.forEach(([fx, fz, rotationY, scale], index) => {
      const pump = MeshBuilder.CreateCylinder('p27-c5-ice-cryo-pump-' + index, {
        height: 1.50 * scale,
        diameter: 1.02 * scale,
        tessellation: 16,
      }, scene);
      pump.parent = this.root;
      pump.position.set(worldW * fx, 0.76, worldH * fz);
      pump.rotation.z = Math.PI / 2;
      pump.rotation.y = rotationY;
      pump.material = machinery;
      pump.isPickable = false;
    });

    const manifoldPlacements = [
      [0.46, 0.32, 0.86], [0.62, 0.50, 0.90], [0.74, 0.70, 0.84],
    ] as const;
    manifoldPlacements.forEach(([fx, fz, scale], index) => {
      const manifold = MeshBuilder.CreateTorus('p27-c5-ice-coolant-manifold-' + index, {
        diameter: 1.20 * scale,
        thickness: 0.18,
        tessellation: 24,
      }, scene);
      manifold.parent = this.root;
      manifold.position.set(worldW * fx, 0.48, worldH * fz);
      manifold.rotation.x = Math.PI / 2;
      manifold.material = machinery;
      manifold.isPickable = false;
    });

    const compressorPlacements = [
      [0.72, 0.34, 0.94], [0.80, 0.60, 0.90],
    ] as const;
    compressorPlacements.forEach(([fx, fz, scale], index) => {
      const compressor = box(
        scene,
        this.root,
        'p27-c5-ice-freeze-compressor-' + index,
        machinery,
        worldW * fx,
        0.60,
        worldH * fz,
        1.22 * scale,
        1.20 * scale,
        1.72 * scale,
      );
      compressor.rotation.y = index === 0 ? Math.PI / 2 : -Math.PI / 2;
    });

    const icePillarPlacements = [
      [0.82, 0.30, -0.18, 0.92], [0.87, 0.42, 0.12, 1.08], [0.90, 0.56, -0.10, 1.18],
      [0.84, 0.69, 0.20, 0.96], [0.76, 0.64, -0.22, 0.82],
    ] as const;
    icePillarPlacements.forEach(([fx, fz, rotationZ, scale], index) => {
      const pillar = MeshBuilder.CreateCylinder('p27-c5-ice-pillar-' + index, {
        height: 3.2 * scale,
        diameterTop: 0.18 * scale,
        diameterBottom: 1.22 * scale,
        tessellation: 7,
      }, scene);
      pillar.parent = this.root;
      pillar.position.set(worldW * fx, 1.58 * scale, worldH * fz);
      pillar.rotation.z = rotationZ;
      pillar.rotation.y = index * 0.41;
      pillar.material = ice;
      pillar.isPickable = false;
    });

    const navigation = getMapNavigationPlan('ice-mine');
    navigation.routes.forEach(route => {
      for (let index = 0; index < route.points.length - 1; index += 1) {
        const a = route.points[index];
        const b = route.points[index + 1];
        routeSegment(
          scene,
          this.root,
          route.kind === 'primary' ? routePrimary : routeSecondary,
          'p27-c5-ice-route-' + route.id + '-' + index,
          scaled(a.x),
          scaled(a.y),
          scaled(b.x),
          scaled(b.y),
          scaled(route.kind === 'primary' ? 72 : route.kind === 'secondary' ? 48 : 34),
        );
      }
    });
    navigation.landmarks.forEach((landmark, index) => {
      const x = scaled(landmark.x);
      const z = scaled(landmark.y);
      const beacon = MeshBuilder.CreateCylinder('p27-c5-ice-landmark-' + landmark.id, {
        height: 2.8,
        diameterTop: 0.10,
        diameterBottom: 0.52,
        tessellation: 6,
      }, scene);
      beacon.parent = this.root;
      beacon.position.set(x, 1.4, z);
      beacon.material = index === 2 ? ice : service;
      beacon.isPickable = false;
      box(scene, this.root, 'p27-c5-ice-landmark-bar-' + index, routePrimary, x, 2.72, z, 1.18, 0.10, 0.32);
    });

    this.fractureMaterial = new StandardMaterial('p27-c5-ice-fracture-material', scene);
    this.fractureMaterial.diffuseColor = colorFromHex(0x8ad9ec).scale(0.16);
    this.fractureMaterial.emissiveColor = colorFromHex(0x8ad9ec).scale(0.86);
    this.fractureMaterial.specularColor = Color3.Black();
    this.fractureMaterial.alpha = 0.48;
    this.fractureMaterial.disableLighting = true;
    this.fractureMaterial.backFaceCulling = false;

    this.fractureShardMaterial = new StandardMaterial('p27-c5-ice-fracture-shard-material', scene);
    this.fractureShardMaterial.diffuseColor = colorFromHex(0x9bd8e8).scale(0.24);
    this.fractureShardMaterial.emissiveColor = colorFromHex(0x76cde9).scale(0.46);
    this.fractureShardMaterial.specularColor = Color3.Black();

    BRITTLE_SUPPORT_IDS.forEach((id, supportIndex) => {
      const root = this.fractureRoots.get(id)!;
      const cracks: Mesh[] = [];
      for (let crackIndex = 0; crackIndex < 3; crackIndex += 1) {
        const crack = MeshBuilder.CreateTorus('p27-c5-ice-fracture-crack-' + id + '-' + crackIndex, {
          diameter: 0.76 + crackIndex * 0.13,
          thickness: 0.045,
          tessellation: 20,
        }, scene);
        crack.parent = root;
        crack.position.set((crackIndex - 1) * 0.16, 0.82 + crackIndex * 0.36, 0.02);
        crack.rotation.y = crackIndex % 2 === 0 ? 0.18 : -0.22;
        crack.rotation.z = (crackIndex - 1) * 0.46;
        crack.scaling.set(0.72 + crackIndex * 0.10, 1.12 - crackIndex * 0.08, 1);
        crack.material = this.fractureMaterial;
        crack.isPickable = false;
        crack.setEnabled(false);
        cracks.push(crack);
      }
      this.fractureCracks.set(id, cracks);

      const pulse = MeshBuilder.CreateTorus('p27-c5-ice-collapse-frost-pulse-' + id, {
        diameter: 2.6,
        thickness: 0.075,
        tessellation: 32,
      }, scene);
      pulse.parent = root;
      pulse.rotation.x = Math.PI / 2;
      pulse.position.y = 0.06;
      pulse.material = this.fractureMaterial;
      pulse.isPickable = false;
      pulse.setEnabled(false);
      this.fracturePulses.set(id, pulse);

      const shards: Mesh[] = [];
      for (let shardIndex = 0; shardIndex < 8; shardIndex += 1) {
        const shard = MeshBuilder.CreateBox('p27-c5-ice-collapse-shard-' + id + '-' + shardIndex, {
          width: 0.16 + (shardIndex % 2) * 0.05,
          height: 0.36 + (shardIndex % 3) * 0.08,
          depth: 0.14,
        }, scene);
        shard.parent = root;
        const angle = (shardIndex / 8) * Math.PI * 2 + supportIndex * 0.31;
        const speed = 0.42 + (shardIndex % 3) * 0.13;
        shard.metadata = {
          velocity: [Math.cos(angle) * speed, 0.78 + (shardIndex % 4) * 0.12, Math.sin(angle) * speed],
        };
        shard.position.set(0, 0.92, 0);
        shard.rotation.set(shardIndex * 0.31, shardIndex * 0.47, shardIndex * 0.23);
        shard.material = this.fractureShardMaterial;
        shard.isPickable = false;
        shard.setEnabled(false);
        shards.push(shard);
      }
      this.fractureShards.set(id, shards);
    });

    this.frostMoteMaterial = new StandardMaterial('p27-c5-ice-frost-mote-material', scene);
    this.frostMoteMaterial.diffuseColor = colorFromHex(0xa6dceb).scale(0.16);
    this.frostMoteMaterial.emissiveColor = colorFromHex(0xa6dceb).scale(0.62);
    this.frostMoteMaterial.specularColor = Color3.Black();
    this.frostMoteMaterial.alpha = 0.18;
    this.frostMoteMaterial.disableLighting = true;
    for (let index = 0; index < 32; index += 1) {
      const xPhase = ((index * 17) % 31) / 30;
      const zPhase = ((index * 13) % 29) / 28;
      const mote = MeshBuilder.CreateSphere('p27-c5-ice-frost-mote-' + index, {
        diameter: 0.045 + (index % 3) * 0.012,
        segments: 4,
      }, scene);
      mote.parent = this.root;
      mote.position.set(worldW * (0.12 + xPhase * 0.76), 0.16 + (index % 7) * 0.08, worldH * (0.16 + zPhase * 0.68));
      mote.material = this.frostMoteMaterial;
      mote.isPickable = false;
      this.frostMotes.push(mote);
      this.frostMoteBases.push(mote.position.clone());
    });

    this.machineryRoot = new TransformNode('p27-c5-ice-machinery-cues', scene);
    this.machineryRoot.parent = this.root;

    this.bossCueMaterial = new StandardMaterial('p27-c5-ice-rhea-cue-material', scene);
    this.bossCueMaterial.diffuseColor = colorFromHex(0x7ec9df).scale(0.18);
    this.bossCueMaterial.emissiveColor = colorFromHex(0x7ec9df).scale(0.82);
    this.bossCueMaterial.specularColor = Color3.Black();
    this.bossCueMaterial.alpha = 0.44;
    this.bossCueMaterial.disableLighting = true;
    this.bossCueMaterial.backFaceCulling = false;

    this.bossCueRoot = new TransformNode('p27-c5-ice-rhea-kade-cue', scene);
    this.bossCueRoot.parent = this.root;
    this.bossPhaseRing = MeshBuilder.CreateTorus('p27-c5-ice-rhea-fracture-ring', {
      diameter: 4.1,
      thickness: 0.10,
      tessellation: 40,
    }, scene);
    this.bossPhaseRing.parent = this.bossCueRoot;
    this.bossPhaseRing.material = this.bossCueMaterial;
    this.bossPhaseRing.isPickable = false;

    this.bossPhaseHalo = MeshBuilder.CreateTorus('p27-c5-ice-rhea-cryo-halo', {
      diameter: 5.0,
      thickness: 0.06,
      tessellation: 40,
    }, scene);
    this.bossPhaseHalo.parent = this.bossCueRoot;
    this.bossPhaseHalo.position.y = 0.08;
    this.bossPhaseHalo.material = this.bossCueMaterial;
    this.bossPhaseHalo.isPickable = false;

    for (const side of [-1, 1]) {
      const tank = MeshBuilder.CreateCylinder('p27-c5-ice-rhea-cryo-tank-' + side, {
        height: 1.28,
        diameter: 0.30,
        tessellation: 10,
      }, scene);
      tank.parent = this.bossCueRoot;
      tank.position.set(side * 1.48, 0.64, 0.15);
      tank.material = support;
      tank.isPickable = false;
    }
    const ram = box(scene, this.bossCueRoot, 'p27-c5-ice-rhea-fracture-ram', machinery, 0, 0.24, -1.74, 0.38, 0.42, 1.15);
    ram.rotation.x = -0.08;
    this.bossCueRoot.setEnabled(false);

    this.meshCount = this.root.getChildMeshes(false).length;
    this.root.setEnabled(false);

    const lighting = BABYLON_ICE_MINE_LIGHTING;
    this.hemisphere = new HemisphericLight('p27-c5-ice-hemisphere', new Vector3(-0.28, 1, 0.18), scene);
    this.hemisphere.diffuse = colorFromHex(0xb8d5df);
    this.hemisphere.groundColor = colorFromHex(0x06111a);
    this.hemisphere.intensity = 0.32;

    this.keyLight = new DirectionalLight('p27-c5-ice-key', new Vector3(-0.42, -1, -0.18).normalize(), scene);
    this.keyLight.position = new Vector3(worldW * 0.70, 14, worldH * 0.22);
    this.keyLight.diffuse = colorFromHex(lighting.keyColor);
    this.keyLight.intensity = lighting.keyIntensity;

    this.rimLight = new DirectionalLight('p27-c5-ice-rim', new Vector3(0.56, -0.82, 0.30).normalize(), scene);
    this.rimLight.position = new Vector3(worldW * 0.18, 10, worldH * 0.76);
    this.rimLight.diffuse = colorFromHex(lighting.rimColor);
    this.rimLight.intensity = lighting.rimIntensity;

    this.emergencyLight = new PointLight('p27-c5-ice-fracture-warning', new Vector3(cx, 3.0, cz), scene);
    this.emergencyLight.diffuse = colorFromHex(lighting.emergencyColor);
    this.emergencyLight.range = 10.4;

    this.readabilityLight = new PointLight('p27-c5-ice-readability', new Vector3(cx, 2.7, cz), scene);
    this.readabilityLight.diffuse = colorFromHex(0xe0f1f5);
    this.readabilityLight.range = 8.8;

    this.practicalLights = [
      new PointLight('p27-c5-ice-practical-tunnel', new Vector3(worldW * 0.48, 3.0, worldH * 0.50), scene),
      new PointLight('p27-c5-ice-practical-vault', new Vector3(worldW * 0.84, 3.2, worldH * 0.52), scene),
    ] as const;
    this.practicalLights[0].diffuse = colorFromHex(0x7ec9df);
    this.practicalLights[0].range = 8.2;
    this.practicalLights[1].diffuse = colorFromHex(0xa9e4ef);
    this.practicalLights[1].range = 7.6;
    this.setLightingEnabled(false);
  }

  sync(state: SimState, renderBudget: RenderBudgetSnapshot, lowVisibility: boolean) {
    this.released = false;
    this.root.setEnabled(true);
    this.setLightingEnabled(true);

    const fracture = this.syncBrittleSupports(state, renderBudget);
    const machineCount = this.syncMachineryCues(state);

    const frostDensity = this.coarse || renderBudget.vfxDensity < 0.55
      ? 16
      : renderBudget.vfxDensity < 0.85
        ? 24
        : 32;
    const frostPulse = 0.5 + Math.sin(state.time * 0.58) * 0.5;
    this.frostMotes.forEach((mote, index) => {
      const enabled = index < frostDensity;
      mote.setEnabled(enabled);
      if (!enabled) return;
      const base = this.frostMoteBases[index];
      mote.position.x = base.x + Math.sin(state.time * 0.11 + index * 0.73) * 0.05;
      mote.position.y = base.y + Math.sin(state.time * 0.18 + index * 0.51) * 0.035;
      mote.position.z = base.z + Math.cos(state.time * 0.09 + index * 0.61) * 0.04;
    });
    this.frostMoteMaterial.alpha = (0.08 + frostPulse * 0.07) * renderBudget.transparencyScale;

    const activeBoss = state.enemies.find(enemy => enemy.active && !enemy.dead && enemy.role === 'boss') ?? null;
    this.bossCueRoot.setEnabled(Boolean(activeBoss));
    if (activeBoss) {
      this.bossCueRoot.position.set(scaled(activeBoss.x), 0.065, scaled(activeBoss.y));
      const phaseTwo = activeBoss.bossPhase === 2;
      const bossHex = phaseTwo ? 0xe69a58 : activeBoss.armor <= 0 ? 0xa9edf3 : 0x7ec9df;
      const bossColor = colorFromHex(bossHex);
      this.bossCueMaterial.diffuseColor = bossColor.scale(0.18);
      this.bossCueMaterial.emissiveColor = bossColor.scale(phaseTwo ? 0.94 : 0.82);
      this.bossCueMaterial.alpha = phaseTwo ? 0.60 : 0.44;
      const bossPulse = 1 + Math.sin(state.time * (phaseTwo ? 6.0 : 3.4) + activeBoss.patternIndex) * (phaseTwo ? 0.11 : 0.06);
      this.bossPhaseRing.scaling.set(bossPulse, bossPulse, bossPulse);
      this.bossPhaseRing.rotation.y = state.time * (phaseTwo ? 1.12 : 0.58);
      this.bossPhaseHalo.setEnabled(phaseTwo || activeBoss.armor <= 0);
      this.bossPhaseHalo.rotation.y = -state.time * (phaseTwo ? 0.88 : 0.44);
    }

    const lighting = BABYLON_ICE_MINE_LIGHTING;
    const tierScale = renderBudget.tierName === 'high' ? 1 : renderBudget.tierName === 'balanced' ? 0.88 : 0.72;
    this.hemisphere.intensity = 0.32 * (renderBudget.tierName === 'performance' ? 0.82 : 1);
    this.keyLight.intensity = lighting.keyIntensity * tierScale * (lowVisibility ? 0.94 : 1);
    this.rimLight.intensity = lighting.rimIntensity * (renderBudget.tierName === 'performance' ? 0.74 : 1);

    const px = scaled(state.player.x);
    const pz = scaled(state.player.y);
    let readabilityX = px;
    let readabilityZ = pz;
    let nearestDistanceSq = Number.POSITIVE_INFINITY;
    for (const enemy of state.enemies) {
      if (!enemy.active || enemy.dead) continue;
      const dx = enemy.x - state.player.x;
      const dy = enemy.y - state.player.y;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq >= nearestDistanceSq || distanceSq > 650 * 650) continue;
      nearestDistanceSq = distanceSq;
      readabilityX = scaled(state.player.x + dx * 0.42);
      readabilityZ = scaled(state.player.y + dy * 0.42);
    }
    this.readabilityLight.position.set(readabilityX, 2.7, readabilityZ);
    this.readabilityLight.intensity = (renderBudget.tierName === 'performance' ? 3.7 : 5.4) * tierScale;

    this.emergencyLight.position.set(px + 1.8, 3.0, pz - 1.6);
    this.emergencyLight.intensity = lighting.emergencyIntensity
      * (renderBudget.tierName === 'performance' ? 0.72 : 1)
      * (fracture.state === 'collapsing' ? 1.20 : fracture.state === 'cracking' ? 1.05 : 0.72)
      * (activeBoss?.bossPhase === 2 ? 1.18 : 1);

    const practicalCount = renderBudget.tierName === 'performance' || this.coarse ? 1 : 2;
    this.practicalLights.forEach((light, index) => {
      const enabled = index < practicalCount;
      light.setEnabled(enabled);
      light.intensity = enabled ? (index === 0 ? 5.8 : 4.8) * tierScale : 0;
    });

    const routePulse = 0.86 + Math.sin(state.time * 3.8) * 0.14;
    this.routeMaterials[0].emissiveColor = colorFromHex(0x8fdcf0).scale(0.18 * routePulse);
    this.routeMaterials[1].emissiveColor = colorFromHex(0x608f9f).scale(0.07 * routePulse);

    this.scene.environmentTexture = null;
    this.scene.environmentIntensity = 0;
    this.scene.imageProcessingConfiguration.toneMappingEnabled = true;
    this.scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    this.scene.imageProcessingConfiguration.exposure = lighting.exposure * (lowVisibility ? 1.03 : 1);
    this.scene.imageProcessingConfiguration.contrast = 1.04;

    const navigation = getMapNavigationPlan('ice-mine');
    const pbrCount = this.scene.materials.filter(item => item instanceof PBRMaterial).length;
    const profileName = this.coarse ? 'mobile' : renderBudget.tierName;

    this.canvas.dataset.babylonEnvironmentState = 'ready';
    this.canvas.dataset.environmentVisual = 'procedural-ice-mine-babylon';
    this.canvas.dataset.environmentKit = 'floor,frost-wall,support-frame,service-deck,ice-pillar,cryo-pump,coolant-manifold,freeze-compressor,wayfinding,fracture-vfx,boss-cue';
    this.canvas.dataset.environmentInstances = String(this.meshCount + this.machineryCues.size);
    this.canvas.dataset.environmentActiveStructures = '32';
    this.canvas.dataset.environmentPerformanceProfile = profileName + ':procedural:structure-shadows-off';
    this.canvas.dataset.environmentInstanceBudget = 'frost-wall:10+support-frame:6+service-deck:4+ice-pillar:5+cryo-machinery:7';
    this.canvas.dataset.environmentShadowCasters = 'off';
    this.canvas.dataset.environmentLandmark = 'subglacial-vault-ice-pillars';
    this.canvas.dataset.environmentServiceDetails = 'support-frame:6+service-deck:4+cryo-machinery:7+machinery-cues:' + machineCount;
    this.canvas.dataset.environmentMachineDetail = 'cryo-pump:2+coolant-manifold:3+freeze-compressor:2';
    this.canvas.dataset.environmentSurfaceDetail = 'frost-wall:10+ice-pillar:5';
    this.canvas.dataset.environmentComposition = 'access-bore+reinforced-extraction-tunnel+subglacial-vault';
    this.canvas.dataset.environmentTunnelSequence = 'access-bore>extraction-tunnel>subglacial-vault';
    this.canvas.dataset.environmentMaterials = 'frozen-rock+support-steel+frost-ice+cold-cyan';
    this.canvas.dataset.environmentZoneIdentity = 'access-bore:frost-wall-cut|extraction-tunnel:steel-support-frames+service-deck+cryo-pumps|subglacial-vault:ice-pillar-cluster+coolant-manifolds+freeze-compressors';
    this.canvas.dataset.readabilityLanguage = 'frost-wall-corridor+support-frame-rhythm+cyan-service-deck+vault-pillars+cold-cyan-machinery';
    this.canvas.dataset.environmentAmbient = 'frost-motes+cold-service-haze';
    this.canvas.dataset.environmentAmbientDetail = frostDensity + '-frost-motes';
    this.canvas.dataset.environmentHazardLanguage = 'shared-hazards+brittle-support-fracture';
    this.canvas.dataset.environmentBrittleSupports = fracture.supports;
    this.canvas.dataset.environmentBrittleSupportState = fracture.supportState;
    this.canvas.dataset.environmentBrittleSupportIds = BRITTLE_SUPPORT_IDS.join(',');
    this.canvas.dataset.environmentFractureVfx = 'support-cracks+shard-burst+frost-pulse';
    this.canvas.dataset.environmentFractureState = fracture.state;
    this.canvas.dataset.environmentFractureDetail = fracture.detail;
    this.canvas.dataset.environmentFractureSupports = fracture.fractureSupports;
    this.canvas.dataset.environmentVfx = 'support-cracks+shard-burst+frost-pulse+frost-motes';
    this.canvas.dataset.locationArt = 'ice-mine:bore-crystals:frosted-industrial';
    this.canvas.dataset.locationArtIdentity = 'bore-crystals|frosted-industrial|ice-cyan|drill-service';
    this.canvas.dataset.locationProps = 'drill-service:procedural-babylon';
    this.canvas.dataset.interactableBiome = 'ice-mine';
    this.canvas.dataset.interactableMode = 'ice-mine-cryo-machinery+mission-controls';
    this.canvas.dataset.interactableKit = 'freeze-compressor-control+bore-stabilizer+cryo-pump+drill-service+bore-pressure-lock+coolant-manifold';
    this.canvas.dataset.interactableLocationVisual = 'procedural-babylon-cryo-machinery-cues';
    this.canvas.dataset.interactableLocationCueCount = String(machineCount);
    this.canvas.dataset.bossBiome = 'ice-mine';
    this.canvas.dataset.bossPresentation = 'rhea-kade';
    this.canvas.dataset.bossVisual = 'procedural-babylon';
    this.canvas.dataset.bossAsset = 'procedural-babylon-rhea-kade-cue';
    this.canvas.dataset.bossSilhouette = 'bore-cowl+cryo-tanks+fracture-ram';
    this.canvas.dataset.bossPalette = 'mine-steel+frost-cyan+fracture-amber-phase-two';
    this.canvas.dataset.bossCue = 'fracture-ring+cryo-halo+fracture-ram';
    this.canvas.dataset.bossCueState = activeBoss ? 'active-phase-' + activeBoss.bossPhase : 'queued';
    this.canvas.dataset.babylonIceMineParity = 'architecture+frost-materials+props+interactables+hazards+fracture+navigation+boss-cues+shared-world-cues';
    this.canvas.dataset.babylonIceMinePlayerPosition = state.player.x.toFixed(1) + ',' + state.player.y.toFixed(1);
    this.canvas.dataset.babylonIceMineRoutes = String(navigation.routes.length);
    this.canvas.dataset.babylonIceMineLandmarks = navigation.landmarks.map(item => item.label).join('|');
    this.canvas.dataset.babylonLightingProfile = lighting.id;
    this.canvas.dataset.babylonMaterialIntent = 'procedural-frosted-industrial-pbr+shared-world-pbr';
    this.canvas.dataset.babylonLightingBudget = 'tier:' + renderBudget.tierName + '|practical:' + practicalCount + '|shadows:off';
    this.canvas.dataset.environmentIbl = 'off:ice-mine';
    this.canvas.dataset.environmentLighting = 'ice-mine-ice-cyan:tunnel+vault+contact:player+enemy+practical:' + practicalCount + '+shadow:off';
    this.canvas.dataset.environmentShadowBudget = 'off:ice-mine-babylon';
    this.canvas.dataset.environmentTone = 'aces-' + this.scene.imageProcessingConfiguration.exposure.toFixed(2);
    this.canvas.dataset.locationLighting = 'ice-mine:ice-cyan:aces-' + this.scene.imageProcessingConfiguration.exposure.toFixed(2);
    this.canvas.dataset.babylonPbrMaterials = 'pbr:' + pbrCount + '|ice-mine:' + this.materials.length;
    this.canvas.dataset.renderTier = renderBudget.tierName;
    this.canvas.dataset.graphicsQuality = renderBudget.qualityMode;
  }

  release(reason: string) {
    if (this.released) return;
    this.released = true;
    this.root.setEnabled(false);
    this.setLightingEnabled(false);
    this.canvas.dataset.babylonIceMineRelease = reason;
  }

  dispose() {
    this.release('renderer-dispose');
    this.root.getChildMeshes(false).forEach(mesh => mesh.dispose());
    this.root.dispose();
    this.materials.forEach(item => item.dispose());
    this.fractureMaterial.dispose();
    this.fractureShardMaterial.dispose();
    this.frostMoteMaterial.dispose();
    this.bossCueMaterial.dispose();
    this.hemisphere.dispose();
    this.keyLight.dispose();
    this.rimLight.dispose();
    this.emergencyLight.dispose();
    this.readabilityLight.dispose();
    this.practicalLights.forEach(light => light.dispose());
  }

  private syncBrittleSupports(state: SimState, renderBudget: RenderBudgetSnapshot) {
    const budget = iceMineFractureBudget(this.coarse, renderBudget.vfxDensity);
    let intact = 0;
    let failed = 0;
    let damaged = 0;
    let cracking = 0;
    let collapsing = 0;
    let settled = 0;

    for (const id of BRITTLE_SUPPORT_IDS) {
      const object = state.objects.find(item => item.id === id);
      const visual = this.brittleSupportRoots.get(id);
      const fractureRoot = this.fractureRoots.get(id);
      const active = Boolean(object?.active);
      const previousActive = this.supportLastActive.get(id);
      if (previousActive === true && !active) this.collapseStartedAt.set(id, state.time);
      else if (previousActive === undefined && !active && !this.collapseStartedAt.has(id)) this.collapseStartedAt.set(id, state.time);
      this.supportLastActive.set(id, active);

      if (object && visual && fractureRoot) {
        const x = scaled(object.x + object.w / 2);
        const z = scaled(object.y + object.h / 2);
        visual.position.set(x, 0, z);
        fractureRoot.position.set(x, 0, z);
      }
      visual?.setEnabled(active);

      const hpRatio = object && object.maxHp > 0 ? Math.max(0, Math.min(1, object.hp / object.maxHp)) : 1;
      const supportDamaged = active && hpRatio < 0.999;
      const cracks = this.fractureCracks.get(id) ?? [];
      for (let index = 0; index < cracks.length; index += 1) {
        const crack = cracks[index];
        const enabled = supportDamaged && index < budget.crackBudget;
        crack.setEnabled(enabled);
        if (enabled) {
          const severity = 1 - hpRatio;
          const pulse = 0.96 + Math.sin(state.time * (4.2 + severity * 3.4) + index) * 0.045;
          crack.scaling.z = pulse;
          crack.rotation.z += 0.0025 * (index % 2 === 0 ? 1 : -1);
        }
      }

      const pulse = this.fracturePulses.get(id);
      const shards = this.fractureShards.get(id) ?? [];
      if (active) {
        pulse?.setEnabled(false);
        shards.forEach(shard => shard.setEnabled(false));
        this.collapseStartedAt.delete(id);
        intact += 1;
        if (supportDamaged) {
          damaged += 1;
          cracking += 1;
        }
      } else {
        failed += 1;
        const startedAt = this.collapseStartedAt.get(id) ?? state.time;
        const elapsed = Math.max(0, state.time - startedAt);
        const inBurst = elapsed < 1.35;
        if (inBurst) collapsing += 1;
        else settled += 1;

        if (pulse) {
          pulse.setEnabled(inBurst);
          if (inBurst) {
            const pulseScale = 0.72 + Math.min(1, elapsed / 0.85) * 1.9;
            pulse.scaling.set(pulseScale, pulseScale, pulseScale);
            pulse.rotation.z = state.time * 0.42;
          }
        }

        shards.forEach((shard, index) => {
          const keepRubble = !inBurst && index < Math.min(2, budget.shardBudget);
          const enabled = (inBurst && index < budget.shardBudget) || keepRubble;
          shard.setEnabled(enabled);
          if (!enabled) return;
          const velocity = (shard.metadata?.velocity as [number, number, number] | undefined) ?? [0, 0.9, 0];
          const travelT = Math.min(1.2, elapsed);
          const groundY = 0.05 + (index % 2) * 0.025;
          shard.position.set(
            velocity[0] * travelT,
            Math.max(groundY, 0.92 + velocity[1] * travelT - 2.25 * travelT * travelT),
            velocity[2] * travelT,
          );
          shard.rotation.set(
            index * 0.31 + travelT * (1.2 + index * 0.08),
            index * 0.47 + travelT * (0.9 + index * 0.05),
            index * 0.23 + travelT * (1.4 + index * 0.06),
          );
          const shardScale = keepRubble ? 0.78 : 1;
          shard.scaling.set(shardScale, shardScale, shardScale);
        });
      }
    }

    return {
      supports: 'intact:' + intact + '+failed:' + failed + '+damaged:' + damaged,
      supportState: failed === BRITTLE_SUPPORT_IDS.length
        ? 'cleared'
        : failed > 0
          ? 'partial'
          : damaged > 0
            ? 'damaged'
            : 'intact',
      state: collapsing > 0 ? 'collapsing' : cracking > 0 ? 'cracking' : settled > 0 ? 'settled' : 'idle',
      detail: budget.detail,
      fractureSupports: 'cracking:' + cracking + '+collapsing:' + collapsing + '+settled:' + settled,
    };
  }

  private syncMachineryCues(state: SimState) {
    this.machineryCues.forEach(mesh => mesh.setEnabled(false));
    let active = 0;
    for (const object of state.objects) {
      if (!object.active) continue;
      const label = machineryLabel(object);
      if (!label) continue;
      let mesh = this.machineryCues.get(object.id);
      if (!mesh) {
        if (label === 'cryo-pump') {
          mesh = MeshBuilder.CreateCylinder('p27-c5-' + label + '-' + object.id, {
            height: 0.44,
            diameter: 0.92,
            tessellation: 16,
          }, this.scene);
        } else if (label === 'coolant-manifold' || label === 'bore-stabilizer') {
          mesh = MeshBuilder.CreateTorus('p27-c5-' + label + '-' + object.id, {
            diameter: 0.84,
            thickness: 0.12,
            tessellation: 20,
          }, this.scene);
        } else {
          mesh = MeshBuilder.CreateBox('p27-c5-' + label + '-' + object.id, {
            width: 0.58,
            height: label === 'bore-pressure-lock' ? 0.92 : 0.68,
            depth: 0.48,
          }, this.scene);
        }
        mesh.parent = this.machineryRoot;
        mesh.material = this.machineryMaterial;
        mesh.isPickable = false;
        this.machineryCues.set(object.id, mesh);
      }
      const tall = label === 'bore-pressure-lock' || label === 'freeze-compressor-control';
      mesh.position.set(scaled(object.x + object.w / 2), tall ? 0.48 : 0.22, scaled(object.y + object.h / 2));
      mesh.setEnabled(true);
      active += 1;
    }
    return active;
  }

  private setLightingEnabled(enabled: boolean) {
    this.hemisphere.setEnabled(enabled);
    this.keyLight.setEnabled(enabled);
    this.rimLight.setEnabled(enabled);
    this.emergencyLight.setEnabled(enabled);
    this.readabilityLight.setEnabled(enabled);
    this.practicalLights.forEach(light => light.setEnabled(enabled));
    if (!enabled) {
      this.emergencyLight.intensity = 0;
      this.readabilityLight.intensity = 0;
      this.practicalLights.forEach(light => { light.intensity = 0; });
    }
  }
}
