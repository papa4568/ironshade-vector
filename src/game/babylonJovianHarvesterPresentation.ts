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
import {
  jovianHarvesterRenderProfile,
  jovianHarvesterStormState,
} from './jovianHarvesterVisualLanguage';
import { getMapNavigationPlan } from './mapNavigation';
import type { RenderBudgetSnapshot } from './renderQuality';
import { getWorldSize, type CombatObject, type SimState } from './sim';

const WORLD_SCALE = 0.02;

export const BABYLON_JOVIAN_HARVESTER_IDENTITY = Object.freeze({
  silhouette: 'skimmer-towers',
  material: 'weathered-condenser',
  lighting: 'storm-orange',
  propSet: 'compressor-service',
});

export const BABYLON_JOVIAN_HARVESTER_LIGHTING = Object.freeze({
  id: 'storm-orange',
  keyColor: 0xffc89a,
  rimColor: 0xd59a57,
  emergencyColor: 0xd46b45,
  keyIntensity: 2.5,
  rimIntensity: 1.18,
  emergencyIntensity: 9.5,
  exposure: 1.09,
});

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
  if (object.kind === 'powerControl') return 'storm-bus-isolator';
  if (object.kind === 'gravityControl') return 'deck-mass-trim';
  if (object.id === 'salvage-node-a') return 'skimmer-compressor';
  if (object.id === 'salvage-node-b') return 'separator-package';
  if (object.kind === 'doorControl') return 'storm-pressure-lock';
  if (object.kind === 'sealControl') return 'relief-manifold';
  return null;
}

export class BabylonJovianHarvesterPresentation {
  private readonly root: TransformNode;
  private readonly deckMeshes: Mesh[] = [];
  private readonly towerMeshes: Mesh[] = [];
  private readonly bridgeMeshes: Mesh[] = [];
  private readonly ballastMeshes: Mesh[] = [];
  private readonly materials: PBRMaterial[];
  private readonly routeMaterials: readonly [PBRMaterial, PBRMaterial];
  private readonly machineryMaterial: PBRMaterial;
  private readonly stormRoot: TransformNode;
  private readonly atmosphereRoot: TransformNode;
  private readonly bossCueRoot: TransformNode;
  private readonly machineryRoot: TransformNode;
  private readonly chargeMaterial: StandardMaterial;
  private readonly pressureMaterial: StandardMaterial;
  private readonly reliefMaterial: StandardMaterial;
  private readonly atmosphereMaterial: StandardMaterial;
  private readonly particulateMaterial: StandardMaterial;
  private readonly bossCueMaterial: StandardMaterial;
  private readonly stormChargeSweeps: Mesh[] = [];
  private readonly pressureShearBands: Mesh[] = [];
  private readonly pressureReliefPulse: Mesh;
  private readonly atmosphereClouds: Mesh[] = [];
  private readonly atmosphereCloudBases: Vector3[] = [];
  private readonly atmosphereMotes: Mesh[] = [];
  private readonly atmosphereMoteBases: Vector3[] = [];
  private readonly atmosphereSpineHaze: Mesh;
  private readonly bossPhaseRing: Mesh;
  private readonly bossPhaseHalo: Mesh;
  private readonly machineryCues = new Map<string, Mesh>();
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

    const floor = material(scene, 'p27-c4-jovian-floor-material', 0x1a120c, 0.62, 0.60);
    const weathered = material(scene, 'p27-c4-jovian-weathered-material', 0x6d5138, 0.76, 0.50);
    const tower = material(scene, 'p27-c4-jovian-tower-material', 0x7d5b3d, 0.82, 0.42);
    const truss = material(scene, 'p27-c4-jovian-truss-material', 0x25201c, 0.88, 0.34);
    const ballast = material(scene, 'p27-c4-jovian-ballast-material', 0xb7a88f, 0.72, 0.34, 0x8fb8bd, 0.08);
    const routePrimary = material(scene, 'p27-c4-jovian-route-primary-material', 0x4f3523, 0.62, 0.48, 0xf0aa55, 0.19);
    const routeSecondary = material(scene, 'p27-c4-jovian-route-secondary-material', 0x262a29, 0.68, 0.52, 0x78c9d6, 0.07);
    this.materials = [floor, weathered, tower, truss, ballast, routePrimary, routeSecondary];
    this.routeMaterials = [routePrimary, routeSecondary];
    this.machineryMaterial = weathered;

    this.root = new TransformNode('p27-c4-jovian-harvester-environment', scene);
    box(scene, this.root, 'p27-c4-jovian-floor', floor, cx, -0.055, cz, worldW, 0.11, worldH);

    const deckPlacements = [
      [0.26, 0.26, 0], [0.50, 0.25, 0], [0.74, 0.26, 0],
      [0.28, 0.72, Math.PI], [0.52, 0.74, Math.PI], [0.76, 0.72, Math.PI],
    ] as const;
    deckPlacements.forEach(([fx, fz, rotationY], index) => {
      const deck = box(
        scene,
        this.root,
        'p27-c4-jovian-deck-span-' + index,
        weathered,
        worldW * fx,
        0.34,
        worldH * fz,
        4.6,
        0.34,
        2.1,
      );
      deck.rotation.y = rotationY;
      this.deckMeshes.push(deck);
    });

    const towerPlacements = [
      [0.18, 0.38, 0.78], [0.34, 0.54, 0.92], [0.50, 0.42, 1.10], [0.66, 0.57, 0.96], [0.82, 0.40, 0.82],
    ] as const;
    towerPlacements.forEach(([fx, fz, scale], index) => {
      const mast = MeshBuilder.CreateCylinder('p27-c4-jovian-skimmer-tower-' + index, {
        height: 6.4 * scale,
        diameter: 1.25 * scale,
        tessellation: 12,
      }, scene);
      mast.parent = this.root;
      mast.position.set(worldW * fx, 3.2 * scale, worldH * fz);
      mast.material = tower;
      mast.isPickable = false;
      this.towerMeshes.push(mast);

      const crown = MeshBuilder.CreateTorus('p27-c4-jovian-skimmer-crown-' + index, {
        diameter: 1.85 * scale,
        thickness: 0.15 * scale,
        tessellation: 24,
      }, scene);
      crown.parent = this.root;
      crown.position.set(worldW * fx, 6.0 * scale, worldH * fz);
      crown.material = ballast;
      crown.isPickable = false;
      this.towerMeshes.push(crown);
    });

    const bridgePlacements = [
      [0.26, 0.46], [0.42, 0.48], [0.58, 0.49], [0.74, 0.47],
    ] as const;
    bridgePlacements.forEach(([fx, fz], index) => {
      const bridge = box(
        scene,
        this.root,
        'p27-c4-jovian-transfer-bridge-' + index,
        truss,
        worldW * fx,
        0.54,
        worldH * fz,
        4.8,
        0.20,
        0.72,
      );
      this.bridgeMeshes.push(bridge);
    });

    const ballastPlacements = [
      [0.18, 0.22, Math.PI / 2], [0.82, 0.22, -Math.PI / 2],
      [0.20, 0.78, Math.PI / 2], [0.80, 0.78, -Math.PI / 2],
    ] as const;
    ballastPlacements.forEach(([fx, fz, rotationY], index) => {
      const pod = MeshBuilder.CreateCylinder('p27-c4-jovian-ballast-pod-' + index, {
        height: 2.2,
        diameter: 0.92,
        tessellation: 12,
      }, scene);
      pod.parent = this.root;
      pod.position.set(worldW * fx, 1.15, worldH * fz);
      pod.rotation.z = Math.PI / 2;
      pod.rotation.y = rotationY;
      pod.material = ballast;
      pod.isPickable = false;
      this.ballastMeshes.push(pod);
    });

    const navigation = getMapNavigationPlan('jovian-harvester');
    navigation.routes.forEach(route => {
      for (let index = 0; index < route.points.length - 1; index += 1) {
        const a = route.points[index];
        const b = route.points[index + 1];
        routeSegment(
          scene,
          this.root,
          route.kind === 'primary' ? routePrimary : routeSecondary,
          'p27-c4-jovian-route-' + route.id + '-' + index,
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
      box(scene, this.root, 'p27-c4-jovian-landmark-' + landmark.id, tower, x, 1.55, z, 0.24, 3.10, 0.24);
      box(scene, this.root, 'p27-c4-jovian-landmark-beacon-' + index, routePrimary, x, 2.90, z, 1.25, 0.12, 0.34);
    });

    this.chargeMaterial = new StandardMaterial('p27-c4-jovian-charge-material', scene);
    this.chargeMaterial.diffuseColor = colorFromHex(0xf0aa55).scale(0.18);
    this.chargeMaterial.emissiveColor = colorFromHex(0xf0aa55).scale(0.82);
    this.chargeMaterial.specularColor = Color3.Black();
    this.chargeMaterial.alpha = 0.08;
    this.chargeMaterial.disableLighting = true;
    this.chargeMaterial.backFaceCulling = false;

    this.pressureMaterial = new StandardMaterial('p27-c4-jovian-pressure-material', scene);
    this.pressureMaterial.diffuseColor = colorFromHex(0x78c9d6).scale(0.16);
    this.pressureMaterial.emissiveColor = colorFromHex(0x78c9d6).scale(0.78);
    this.pressureMaterial.specularColor = Color3.Black();
    this.pressureMaterial.alpha = 0.07;
    this.pressureMaterial.disableLighting = true;
    this.pressureMaterial.backFaceCulling = false;

    this.reliefMaterial = new StandardMaterial('p27-c4-jovian-relief-material', scene);
    this.reliefMaterial.diffuseColor = colorFromHex(0xff8a50).scale(0.18);
    this.reliefMaterial.emissiveColor = colorFromHex(0xff8a50).scale(0.84);
    this.reliefMaterial.specularColor = Color3.Black();
    this.reliefMaterial.alpha = 0.08;
    this.reliefMaterial.disableLighting = true;
    this.reliefMaterial.backFaceCulling = false;

    this.stormRoot = new TransformNode('p27-c4-jovian-storm-pressure-language', scene);
    this.stormRoot.parent = this.root;
    for (let index = 0; index < 4; index += 1) {
      const sweep = MeshBuilder.CreateBox('p27-c4-jovian-storm-charge-sweep-' + index, {
        width: worldW * 0.58,
        height: 0.018,
        depth: 0.07,
      }, scene);
      sweep.parent = this.stormRoot;
      sweep.position.set(worldW * 0.50, 0.048 + index * 0.004, worldH * (0.22 + index * 0.18));
      sweep.rotation.y = index % 2 === 0 ? 0.06 : -0.06;
      sweep.material = this.chargeMaterial;
      sweep.isPickable = false;
      this.stormChargeSweeps.push(sweep);
    }
    for (let index = 0; index < 3; index += 1) {
      const band = MeshBuilder.CreateBox('p27-c4-jovian-pressure-shear-band-' + index, {
        width: 0.10,
        height: 0.02,
        depth: worldH * 0.66,
      }, scene);
      band.parent = this.stormRoot;
      band.position.set(worldW * [0.33, 0.50, 0.67][index], 0.056 + index * 0.004, worldH * 0.50);
      band.material = this.pressureMaterial;
      band.isPickable = false;
      this.pressureShearBands.push(band);
    }
    this.pressureReliefPulse = MeshBuilder.CreateTorus('p27-c4-jovian-relief-manifold-pulse', {
      diameter: 2.84,
      thickness: 0.09,
      tessellation: 40,
    }, scene);
    this.pressureReliefPulse.parent = this.stormRoot;
    this.pressureReliefPulse.position.set(scaled(1450), 0.07, scaled(220));
    this.pressureReliefPulse.material = this.reliefMaterial;
    this.pressureReliefPulse.isPickable = false;

    this.atmosphereMaterial = new StandardMaterial('p27-c4-jovian-atmosphere-material', scene);
    this.atmosphereMaterial.diffuseColor = colorFromHex(0xb8ba93).scale(0.12);
    this.atmosphereMaterial.emissiveColor = colorFromHex(0xb8ba93).scale(0.40);
    this.atmosphereMaterial.specularColor = Color3.Black();
    this.atmosphereMaterial.alpha = 0.05;
    this.atmosphereMaterial.disableLighting = true;
    this.atmosphereMaterial.backFaceCulling = false;

    this.particulateMaterial = new StandardMaterial('p27-c4-jovian-particulate-material', scene);
    this.particulateMaterial.diffuseColor = colorFromHex(0xe4c77f).scale(0.10);
    this.particulateMaterial.emissiveColor = colorFromHex(0xe4c77f).scale(0.62);
    this.particulateMaterial.specularColor = Color3.Black();
    this.particulateMaterial.alpha = 0.18;
    this.particulateMaterial.disableLighting = true;

    this.atmosphereRoot = new TransformNode('p27-c4-jovian-atmospheric-effects', scene);
    this.atmosphereRoot.parent = this.root;
    const cloudRows = [0.14, 0.31, 0.48, 0.66, 0.82];
    cloudRows.forEach((row, index) => {
      const cloud = MeshBuilder.CreateBox('p27-c4-jovian-pressure-cloud-' + index, {
        width: worldW * 0.50,
        height: 0.012,
        depth: 0.42,
      }, scene);
      cloud.parent = this.atmosphereRoot;
      cloud.position.set(worldW * 0.50, 0.032 + index * 0.003, worldH * row);
      cloud.rotation.y = index % 2 === 0 ? 0.025 : -0.025;
      cloud.material = this.atmosphereMaterial;
      cloud.isPickable = false;
      this.atmosphereClouds.push(cloud);
      this.atmosphereCloudBases.push(cloud.position.clone());
    });

    for (let index = 0; index < 56; index += 1) {
      const xPhase = ((index * 17) % 53) / 52;
      const zPhase = ((index * 29) % 55) / 54;
      const mote = MeshBuilder.CreateSphere('p27-c4-jovian-charged-particulate-' + index, {
        diameter: 0.055 + (index % 3) * 0.018,
        segments: 4,
      }, scene);
      mote.parent = this.atmosphereRoot;
      mote.position.set(
        worldW * (0.16 + xPhase * 0.68),
        0.10 + (((index * 11) % 9) / 8) * 0.22,
        worldH * (0.10 + zPhase * 0.80),
      );
      mote.material = this.particulateMaterial;
      mote.isPickable = false;
      this.atmosphereMotes.push(mote);
      this.atmosphereMoteBases.push(mote.position.clone());
    }

    this.atmosphereSpineHaze = MeshBuilder.CreateTorus('p27-c4-jovian-skimmer-spine-haze', {
      diameter: 4.4,
      thickness: 0.10,
      tessellation: 48,
    }, scene);
    this.atmosphereSpineHaze.parent = this.atmosphereRoot;
    this.atmosphereSpineHaze.position.set(worldW * 0.50, 0.055, worldH * 0.48);
    this.atmosphereSpineHaze.material = this.atmosphereMaterial;
    this.atmosphereSpineHaze.isPickable = false;

    this.machineryRoot = new TransformNode('p27-c4-jovian-machinery-cues', scene);
    this.machineryRoot.parent = this.root;

    this.bossCueMaterial = new StandardMaterial('p27-c4-jovian-boss-cue-material', scene);
    this.bossCueMaterial.diffuseColor = colorFromHex(0xf0ae69).scale(0.18);
    this.bossCueMaterial.emissiveColor = colorFromHex(0xf0ae69).scale(0.82);
    this.bossCueMaterial.specularColor = Color3.Black();
    this.bossCueMaterial.alpha = 0.42;
    this.bossCueMaterial.disableLighting = true;
    this.bossCueMaterial.backFaceCulling = false;

    this.bossCueRoot = new TransformNode('p27-c4-jovian-stormline-ilex-cue', scene);
    this.bossCueRoot.parent = this.root;
    this.bossPhaseRing = MeshBuilder.CreateTorus('p27-c4-jovian-ilex-phase-ring', {
      diameter: 4.0,
      thickness: 0.10,
      tessellation: 40,
    }, scene);
    this.bossPhaseRing.parent = this.bossCueRoot;
    this.bossPhaseRing.material = this.bossCueMaterial;
    this.bossPhaseRing.isPickable = false;
    this.bossPhaseHalo = MeshBuilder.CreateTorus('p27-c4-jovian-ilex-pressure-crown', {
      diameter: 5.1,
      thickness: 0.06,
      tessellation: 40,
    }, scene);
    this.bossPhaseHalo.parent = this.bossCueRoot;
    this.bossPhaseHalo.position.y = 0.05;
    this.bossPhaseHalo.material = this.bossCueMaterial;
    this.bossPhaseHalo.isPickable = false;
    for (const [index, angle] of [0, Math.PI / 2, Math.PI, Math.PI * 1.5].entries()) {
      const stack = MeshBuilder.CreateCylinder('p27-c4-jovian-ilex-relief-stack-' + index, {
        height: 0.92,
        diameter: 0.18,
        tessellation: 8,
      }, scene);
      stack.parent = this.bossCueRoot;
      stack.position.set(Math.cos(angle) * 1.65, 0.46, Math.sin(angle) * 1.65);
      stack.material = weathered;
      stack.isPickable = false;
    }
    this.bossCueRoot.setEnabled(false);

    this.meshCount = this.root.getChildMeshes(false).length;
    this.root.setEnabled(false);

    const lighting = BABYLON_JOVIAN_HARVESTER_LIGHTING;
    this.hemisphere = new HemisphericLight('p27-c4-jovian-hemisphere', new Vector3(-0.32, 1, 0.22), scene);
    this.hemisphere.diffuse = colorFromHex(0xb99c7e);
    this.hemisphere.groundColor = colorFromHex(0x120b05);
    this.hemisphere.intensity = 0.34;

    this.keyLight = new DirectionalLight('p27-c4-jovian-key', new Vector3(-0.45, -1, -0.20).normalize(), scene);
    this.keyLight.position = new Vector3(worldW * 0.64, 15, worldH * 0.18);
    this.keyLight.diffuse = colorFromHex(lighting.keyColor);
    this.keyLight.intensity = lighting.keyIntensity;

    this.rimLight = new DirectionalLight('p27-c4-jovian-rim', new Vector3(0.58, -0.82, 0.28).normalize(), scene);
    this.rimLight.position = new Vector3(worldW * 0.18, 10, worldH * 0.76);
    this.rimLight.diffuse = colorFromHex(lighting.rimColor);
    this.rimLight.intensity = lighting.rimIntensity;

    this.emergencyLight = new PointLight('p27-c4-jovian-emergency', new Vector3(cx, 3.0, cz), scene);
    this.emergencyLight.diffuse = colorFromHex(lighting.emergencyColor);
    this.emergencyLight.range = 10.8;

    this.readabilityLight = new PointLight('p27-c4-jovian-readability', new Vector3(cx, 2.7, cz), scene);
    this.readabilityLight.diffuse = colorFromHex(0xf1dfc7);
    this.readabilityLight.range = 8.6;

    this.practicalLights = [
      new PointLight('p27-c4-jovian-practical-spine', new Vector3(cx, 3.4, worldH * 0.48), scene),
      new PointLight('p27-c4-jovian-practical-relief', new Vector3(scaled(1450), 2.6, scaled(220)), scene),
    ] as const;
    this.practicalLights[0].diffuse = colorFromHex(0xd59a57);
    this.practicalLights[0].range = 8.4;
    this.practicalLights[1].diffuse = colorFromHex(0x78c9d6);
    this.practicalLights[1].range = 7.4;
    this.setLightingEnabled(false);
  }

  sync(
    state: SimState,
    renderBudget: RenderBudgetSnapshot,
    lowVisibility: boolean,
    unstablePressure: boolean,
    damagedGrid: boolean,
  ) {
    this.released = false;
    this.root.setEnabled(true);
    this.setLightingEnabled(true);

    const profile = jovianHarvesterRenderProfile(renderBudget.detailScale, this.coarse);
    const deckCount = profile.deckInstances;
    const bridgeCount = profile.bridgeInstances;
    const ballastCount = profile.ballastInstances;
    this.deckMeshes.forEach((mesh, index) => mesh.setEnabled(deckCount === 6 || [0, 2, 3, 5].includes(index)));
    this.bridgeMeshes.forEach((mesh, index) => mesh.setEnabled(bridgeCount === 4 || index === 0 || index === 3));
    this.ballastMeshes.forEach((mesh, index) => mesh.setEnabled(ballastCount === 4 || index === 0 || index === 3));
    this.towerMeshes.forEach(mesh => mesh.setEnabled(true));

    const serviceBreach = state.breaches.find(breach => breach.id === 'service-breach');
    const storm = jovianHarvesterStormState(
      state.sectors.map(sector => sector.pressure),
      state.sectors.map(sector => sector.pressureState),
      Boolean(serviceBreach?.active && !serviceBreach.sealed),
      unstablePressure,
      damagedGrid,
    );
    const reducedStormDetail = this.coarse || renderBudget.vfxDensity < 0.55;
    const sweepCount = reducedStormDetail ? 2 : 4;
    const bandCount = reducedStormDetail ? 2 : 3;
    const pulse = 0.5 + Math.sin(state.time * (2.6 + storm.intensity * 2.8)) * 0.5;

    this.stormChargeSweeps.forEach((sweep, index) => {
      const enabled = index < sweepCount;
      sweep.setEnabled(enabled);
      if (!enabled) return;
      const baseZ = scaled(getWorldSize().h) * (0.22 + index * 0.18);
      sweep.position.z = baseZ + Math.sin(state.time * (0.52 + storm.stormCharge * 0.72) + index * 1.61) * (0.16 + storm.intensity * 0.44);
      sweep.scaling.x = 0.92 + storm.stormCharge * 0.16 + pulse * 0.025;
    });
    this.chargeMaterial.alpha = (0.035 + storm.stormCharge * 0.12 + pulse * 0.035) * renderBudget.transparencyScale;

    const bandHex = storm.venting ? 0xff7e52 : storm.pressureShear > 0.42 ? 0xe4aa62 : 0x78c9d6;
    const bandColor = colorFromHex(bandHex);
    this.pressureMaterial.diffuseColor = bandColor.scale(0.16);
    this.pressureMaterial.emissiveColor = bandColor.scale(0.78);
    this.pressureMaterial.alpha = (0.025 + storm.pressureShear * 0.22 + (storm.venting ? 0.08 : 0)) * renderBudget.transparencyScale;
    this.pressureShearBands.forEach((band, index) => {
      const enabled = index < bandCount;
      band.setEnabled(enabled);
      if (!enabled) return;
      const baseX = scaled(getWorldSize().w) * [0.33, 0.50, 0.67][index];
      band.position.x = baseX + Math.sin(state.time * 1.1 + index * 2.2) * storm.pressureShear * 0.11;
      band.scaling.z = 0.94 + storm.pressureShear * 0.16 + pulse * storm.pressureShear * 0.04;
    });

    const reliefHex = storm.venting ? 0xff6f45 : 0xffa75f;
    const reliefColor = colorFromHex(reliefHex);
    this.reliefMaterial.diffuseColor = reliefColor.scale(0.18);
    this.reliefMaterial.emissiveColor = reliefColor.scale(0.84);
    this.reliefMaterial.alpha = (
      storm.activeBreach
        ? 0.18 + pulse * 0.40
        : 0.035 + storm.intensity * 0.08 + pulse * 0.025
    ) * renderBudget.transparencyScale;
    const reliefScale = storm.activeBreach
      ? 0.90 + storm.intensity * 0.18 + pulse * 0.14
      : 0.92 + pulse * 0.05;
    this.pressureReliefPulse.scaling.set(reliefScale, reliefScale, reliefScale);
    this.pressureReliefPulse.rotation.y = state.time * (0.18 + storm.intensity * 0.44);

    const atmosphereDensity = this.coarse || renderBudget.vfxDensity < 0.55
      ? 'reduced'
      : renderBudget.vfxDensity < 0.85
        ? 'balanced'
        : 'full';
    const visibleClouds = atmosphereDensity === 'reduced' ? 2 : atmosphereDensity === 'balanced' ? 3 : 5;
    const visibleMotes = atmosphereDensity === 'reduced' ? 20 : atmosphereDensity === 'balanced' ? 36 : 56;
    const atmospherePulse = 0.5 + Math.sin(state.time * 0.42) * 0.5;
    const atmosphereIntensity = (
      0.38
      + atmospherePulse * 0.12
      + storm.stormCharge * 0.22
      + storm.pressureShear * 0.12
    ) * renderBudget.transparencyScale;

    this.atmosphereClouds.forEach((cloud, index) => {
      const enabled = index < visibleClouds;
      cloud.setEnabled(enabled);
      if (!enabled) return;
      const base = this.atmosphereCloudBases[index];
      cloud.position.x = base.x + Math.sin(state.time * 0.09 + index * 1.4) * (0.14 + storm.pressureShear * 0.24);
      cloud.position.z = base.z + Math.cos(state.time * 0.07 + index * 1.8) * (0.08 + storm.pressureShear * 0.08);
      cloud.scaling.x = 0.96 + atmospherePulse * 0.05 + storm.pressureShear * 0.04;
    });
    this.atmosphereMaterial.alpha = (0.024 + atmospherePulse * 0.020 + storm.stormCharge * 0.026) * renderBudget.transparencyScale;
    this.atmosphereMotes.forEach((mote, index) => {
      const enabled = index < visibleMotes;
      mote.setEnabled(enabled);
      if (!enabled) return;
      const base = this.atmosphereMoteBases[index];
      mote.position.x = base.x + Math.sin(state.time * 0.12 + index * 0.73) * (0.04 + storm.pressureShear * 0.08);
      mote.position.z = base.z + Math.cos(state.time * 0.08 + index * 0.51) * (0.03 + storm.stormCharge * 0.06);
    });
    this.particulateMaterial.alpha = (0.08 + atmospherePulse * 0.05 + storm.stormCharge * 0.08) * renderBudget.transparencyScale;
    const hazeScale = 0.95 + atmospherePulse * 0.08 + storm.pressureShear * 0.04;
    this.atmosphereSpineHaze.scaling.set(hazeScale, hazeScale, hazeScale);
    this.atmosphereSpineHaze.rotation.y = state.time * 0.018;

    const machineCount = this.syncMachineryCues(state);
    const activeBoss = state.enemies.find(enemy => enemy.active && !enemy.dead && enemy.role === 'boss') ?? null;
    this.bossCueRoot.setEnabled(Boolean(activeBoss));
    if (activeBoss) {
      this.bossCueRoot.position.set(scaled(activeBoss.x), 0.065, scaled(activeBoss.y));
      const phaseTwo = activeBoss.bossPhase === 2;
      const bossHex = phaseTwo ? 0xff7357 : activeBoss.armor <= 0 ? 0x7fd9e8 : 0xf0ae69;
      const bossColor = colorFromHex(bossHex);
      this.bossCueMaterial.diffuseColor = bossColor.scale(0.18);
      this.bossCueMaterial.emissiveColor = bossColor.scale(phaseTwo ? 0.94 : 0.80);
      this.bossCueMaterial.alpha = phaseTwo ? 0.58 : 0.42;
      const bossPulse = 1 + Math.sin(state.time * (phaseTwo ? 5.8 : 3.2) + activeBoss.patternIndex) * (phaseTwo ? 0.10 : 0.06);
      this.bossPhaseRing.scaling.set(bossPulse, bossPulse, bossPulse);
      this.bossPhaseRing.rotation.y = state.time * (phaseTwo ? 1.1 : 0.55);
      this.bossPhaseHalo.setEnabled(phaseTwo || activeBoss.armor <= 0);
      this.bossPhaseHalo.rotation.y = -state.time * (phaseTwo ? 0.86 : 0.42);
    }

    const lighting = BABYLON_JOVIAN_HARVESTER_LIGHTING;
    const tierScale = renderBudget.tierName === 'high' ? 1 : renderBudget.tierName === 'balanced' ? 0.88 : 0.72;
    this.hemisphere.intensity = 0.34 * (renderBudget.tierName === 'performance' ? 0.82 : 1);
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
    this.readabilityLight.intensity = (renderBudget.tierName === 'performance' ? 3.8 : 5.6) * tierScale;

    this.emergencyLight.position.set(px + 2.0, 3.1, pz - 1.8);
    this.emergencyLight.intensity = lighting.emergencyIntensity
      * (renderBudget.tierName === 'performance' ? 0.72 : 1)
      * (0.62 + storm.intensity * 0.52)
      * (activeBoss?.bossPhase === 2 ? 1.20 : 1);

    const practicalCount = renderBudget.tierName === 'performance' || this.coarse ? 1 : 2;
    this.practicalLights.forEach((light, index) => {
      const enabled = index < practicalCount;
      light.setEnabled(enabled);
      light.intensity = enabled ? (index === 0 ? 6.2 : 4.6) * tierScale : 0;
    });

    const routePulse = 0.86 + Math.sin(state.time * 4.0) * 0.14;
    this.routeMaterials[0].emissiveColor = colorFromHex(0xf0aa55).scale(0.19 * routePulse);
    this.routeMaterials[1].emissiveColor = colorFromHex(0x78c9d6).scale(0.07 * routePulse);

    this.scene.environmentTexture = null;
    this.scene.environmentIntensity = 0;
    this.scene.imageProcessingConfiguration.toneMappingEnabled = true;
    this.scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    this.scene.imageProcessingConfiguration.exposure = lighting.exposure * (lowVisibility ? 1.03 : 1);
    this.scene.imageProcessingConfiguration.contrast = 1.04;

    const pressureSector = state.sectors.find(sector => sector.id === 'B') ?? state.sectors[0];
    const pressureDoor = state.links.find(link => link.id === 'door-ab');
    const pressureState = serviceBreach?.active && !serviceBreach.sealed
      ? 'venting'
      : pressureSector?.pressureState ?? 'normal';
    const navigation = getMapNavigationPlan('jovian-harvester');
    const pbrCount = this.scene.materials.filter(item => item instanceof PBRMaterial).length;
    const activeStructureCount = deckCount + profile.towerInstances + bridgeCount + ballastCount;

    this.canvas.dataset.babylonEnvironmentState = 'ready';
    this.canvas.dataset.environmentVisual = 'procedural-jovian-harvester-babylon';
    this.canvas.dataset.environmentKit = 'floor,deck-span,skimmer-tower,transfer-bridge,ballast-pod,wayfinding,storm-language,atmosphere,boss-cue';
    this.canvas.dataset.environmentInstances = String(this.meshCount + this.machineryCues.size);
    this.canvas.dataset.environmentActiveStructures = String(activeStructureCount);
    this.canvas.dataset.environmentPerformanceProfile = profile.name + ':procedural:structure-shadows-off';
    this.canvas.dataset.environmentInstanceBudget = 'deck:' + deckCount + '+tower:' + profile.towerInstances + '+bridge:' + bridgeCount + '+ballast:' + ballastCount;
    this.canvas.dataset.environmentShadowCasters = 'off';
    this.canvas.dataset.environmentLandmark = 'five-skimmer-tower-spine';
    this.canvas.dataset.environmentServiceDetails = 'transfer-bridge:' + bridgeCount + '+ballast-pod:' + ballastCount + '+machinery-cues:' + machineCount;
    this.canvas.dataset.environmentSurfaceDetail = 'deck-span:' + deckCount + '+skimmer-tower:' + profile.towerInstances;
    this.canvas.dataset.environmentComposition = 'elevated-skimmer-decks+five-tower-spine+transfer-bridges+ballast-pods';
    this.canvas.dataset.environmentMaterials = 'weathered-shell+dark-truss+amber-wayfinding+bright-ballast-shell';
    this.canvas.dataset.environmentZoneIdentity = 'deck:weathered-plate|tower:vertical-skimmer-spine|bridge:dark-transfer-truss|ballast:light-suspended-pod';
    this.canvas.dataset.readabilityLanguage = 'tower-height+bridge-lines+amber-wayfinding+pressure-shear+storm-charge';
    this.canvas.dataset.environmentStormLanguage = 'storm-charge-sweeps+pressure-shear-bands+relief-pulse';
    this.canvas.dataset.environmentStormMode = storm.mode;
    this.canvas.dataset.environmentStormIntensity = storm.intensity.toFixed(2);
    this.canvas.dataset.environmentPressureShear = storm.pressureShear.toFixed(2);
    this.canvas.dataset.environmentPressureRange = storm.minPressure.toFixed(2) + '-' + storm.maxPressure.toFixed(2);
    this.canvas.dataset.environmentStormSource = 'live-sector-pressure+service-breach+contract-conditions';
    this.canvas.dataset.environmentStormDetail = reducedStormDetail ? '2-sweeps+2-bands+relief-pulse' : '4-sweeps+3-bands+relief-pulse';
    this.canvas.dataset.environmentVfx = 'storm-charge-sweeps+pressure-shear-bands+relief-pulse';
    this.canvas.dataset.environmentAmbient = 'upper-haze+pressure-clouds+charged-particulate';
    this.canvas.dataset.environmentAmbientMotion = 'crosswind-drift+pressure-breath+charged-drift';
    this.canvas.dataset.environmentAmbientDetail = visibleClouds + '-clouds+' + visibleMotes + '-motes+spine-haze';
    this.canvas.dataset.environmentAmbientIntensity = atmosphereIntensity.toFixed(2);
    this.canvas.dataset.environmentStormTone = storm.venting ? 'storm-orange+pressure-cyan+vent-red' : 'storm-orange+pressure-cyan';
    this.canvas.dataset.locationArt = 'jovian-harvester:skimmer-towers:weathered-condenser';
    this.canvas.dataset.locationArtIdentity = 'skimmer-towers|weathered-condenser|storm-orange|compressor-service';
    this.canvas.dataset.locationProps = 'compressor-service:procedural-babylon';
    this.canvas.dataset.interactableBiome = 'jovian-harvester';
    this.canvas.dataset.interactableMode = 'jovian-gas-machinery+mission-controls';
    this.canvas.dataset.interactableKit = 'storm-bus-isolator+deck-mass-trim+skimmer-compressor+separator-package';
    this.canvas.dataset.interactablePressureKit = 'storm-pressure-lock+relief-manifold';
    this.canvas.dataset.interactablePressureSource = 'live-pressure-links+breach-state+sector-pressure';
    this.canvas.dataset.interactablePressureState = pressureState;
    this.canvas.dataset.interactablePressureDoor = pressureDoor?.open ? 'open' : 'sealed';
    this.canvas.dataset.interactableLocationVisual = 'procedural-babylon-gas-machinery-cues';
    this.canvas.dataset.interactableLocationCueCount = String(machineCount);
    this.canvas.dataset.bossBiome = 'jovian-harvester';
    this.canvas.dataset.bossPresentation = 'stormline-foreman-ilex';
    this.canvas.dataset.bossVisual = 'procedural-babylon';
    this.canvas.dataset.bossAsset = 'procedural-babylon-stormline-foreman-cue';
    this.canvas.dataset.bossSilhouette = 'storm-cowl+pressure-crown+relief-stacks';
    this.canvas.dataset.bossPalette = 'storm-orange+pressure-cyan+vent-red-phase-two';
    this.canvas.dataset.bossCue = 'storm-ring+pressure-crown+relief-stacks';
    this.canvas.dataset.bossCueState = activeBoss ? 'active-phase-' + activeBoss.bossPhase : 'queued';
    this.canvas.dataset.babylonJovianParity = 'architecture+weather+storm-pressure+props+interactables+navigation+boss-cues+shared-world-cues';
    this.canvas.dataset.babylonJovianPlayerPosition = state.player.x.toFixed(1) + ',' + state.player.y.toFixed(1);
    this.canvas.dataset.babylonJovianRoutes = String(navigation.routes.length);
    this.canvas.dataset.babylonJovianLandmarks = navigation.landmarks.map(item => item.label).join('|');
    this.canvas.dataset.babylonLightingProfile = lighting.id;
    this.canvas.dataset.babylonMaterialIntent = 'procedural-weathered-condenser-pbr+shared-world-pbr';
    this.canvas.dataset.babylonLightingBudget = 'tier:' + renderBudget.tierName + '|practical:' + practicalCount + '|shadows:off';
    this.canvas.dataset.environmentIbl = 'off:jovian-harvester';
    this.canvas.dataset.environmentLighting = 'jovian-harvester-storm-orange:tower+relief+contact:player+enemy+practical:' + practicalCount + '+shadow:off';
    this.canvas.dataset.environmentShadowBudget = 'off:jovian-harvester-babylon';
    this.canvas.dataset.environmentTone = 'aces-' + this.scene.imageProcessingConfiguration.exposure.toFixed(2);
    this.canvas.dataset.locationLighting = 'jovian-harvester:storm-orange:aces-' + this.scene.imageProcessingConfiguration.exposure.toFixed(2);
    this.canvas.dataset.babylonPbrMaterials = 'pbr:' + pbrCount + '|jovian:' + this.materials.length;
    this.canvas.dataset.renderTier = renderBudget.tierName;
    this.canvas.dataset.graphicsQuality = renderBudget.qualityMode;
  }

  release(reason: string) {
    if (this.released) return;
    this.released = true;
    this.root.setEnabled(false);
    this.setLightingEnabled(false);
    this.canvas.dataset.babylonJovianRelease = reason;
  }

  dispose() {
    this.release('renderer-dispose');
    this.root.getChildMeshes(false).forEach(mesh => mesh.dispose());
    this.root.dispose();
    this.materials.forEach(item => item.dispose());
    this.chargeMaterial.dispose();
    this.pressureMaterial.dispose();
    this.reliefMaterial.dispose();
    this.atmosphereMaterial.dispose();
    this.particulateMaterial.dispose();
    this.bossCueMaterial.dispose();
    this.hemisphere.dispose();
    this.keyLight.dispose();
    this.rimLight.dispose();
    this.emergencyLight.dispose();
    this.readabilityLight.dispose();
    this.practicalLights.forEach(light => light.dispose());
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
        if (label === 'deck-mass-trim') {
          mesh = MeshBuilder.CreateTorus('p27-c4-' + label + '-' + object.id, {
            diameter: 0.94,
            thickness: 0.13,
            tessellation: 24,
          }, this.scene);
        } else if (label === 'skimmer-compressor' || label === 'separator-package') {
          mesh = MeshBuilder.CreateCylinder('p27-c4-' + label + '-' + object.id, {
            height: 0.42,
            diameter: label === 'skimmer-compressor' ? 0.94 : 0.76,
            tessellation: 16,
          }, this.scene);
        } else if (label === 'relief-manifold') {
          mesh = MeshBuilder.CreateTorus('p27-c4-' + label + '-' + object.id, {
            diameter: 0.82,
            thickness: 0.12,
            tessellation: 20,
          }, this.scene);
        } else {
          mesh = MeshBuilder.CreateBox('p27-c4-' + label + '-' + object.id, {
            width: 0.58,
            height: 0.86,
            depth: 0.48,
          }, this.scene);
        }
        mesh.parent = this.machineryRoot;
        mesh.material = this.machineryMaterial;
        mesh.isPickable = false;
        this.machineryCues.set(object.id, mesh);
      }
      const tall = label === 'storm-pressure-lock' || label === 'storm-bus-isolator';
      mesh.position.set(scaled(object.x + object.w / 2), tall ? 0.48 : 0.18, scaled(object.y + object.h / 2));
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
