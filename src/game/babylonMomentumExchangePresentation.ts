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

export const BABYLON_MOMENTUM_EXCHANGE_IDENTITY = Object.freeze({
  silhouette: 'flywheel-lane',
  material: 'magnetic-machinery',
  lighting: 'transfer-blue',
  propSet: 'capture-service',
});

export const BABYLON_MOMENTUM_EXCHANGE_LIGHTING = Object.freeze({
  id: 'transfer-blue',
  keyColor: 0xd4e5ed,
  rimColor: 0x67b5d5,
  emergencyColor: 0x4d90ac,
  keyIntensity: 2.3,
  rimIntensity: 1.16,
  emergencyIntensity: 8.2,
  exposure: 1.06,
});

export type MomentumExchangeRenderProfile = {
  name: 'full' | 'balanced' | 'mobile' | 'performance';
  flywheelInstances: number;
  serviceFrameInstances: number;
  transferRailInstances: number;
  captureCradleInstances: number;
  impulseBandInstances: number;
};

export function momentumExchangeRenderProfile(detailScale: number, _coarse: boolean): MomentumExchangeRenderProfile {
  if (detailScale < 0.62) return { name: 'performance', flywheelInstances: 3, serviceFrameInstances: 3, transferRailInstances: 2, captureCradleInstances: 2, impulseBandInstances: 1 };
  if (detailScale < 0.9) return { name: 'balanced', flywheelInstances: 3, serviceFrameInstances: 5, transferRailInstances: 3, captureCradleInstances: 2, impulseBandInstances: 2 };
  return { name: 'full', flywheelInstances: 3, serviceFrameInstances: 6, transferRailInstances: 4, captureCradleInstances: 3, impulseBandInstances: 3 };
}

export function momentumExchangeWashMode(activeVectorWashes: number) {
  return activeVectorWashes > 0 ? 'countermass-wash' as const : 'nominal' as const;
}

export function momentumExchangeCaptureState(loaded: number, intact: number) {
  if (intact <= 0) return 'offline' as const;
  if (loaded >= intact) return 'loaded' as const;
  if (loaded > 0) return 'partial' as const;
  return 'armed' as const;
}

function scaled(value: number) { return value * WORLD_SCALE; }
function colorFromHex(hex: number) { return Color3.FromInts((hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff); }

function pbr(scene: Scene, name: string, color: number, metallic: number, roughness: number, emissive = 0, emissiveIntensity = 0) {
  const result = new PBRMaterial(name, scene);
  result.albedoColor = colorFromHex(color);
  result.metallic = metallic;
  result.roughness = roughness;
  result.emissiveColor = colorFromHex(emissive).scale(emissiveIntensity);
  return result;
}

function box(scene: Scene, parent: TransformNode, name: string, material: PBRMaterial | StandardMaterial, x: number, y: number, z: number, width: number, height: number, depth: number) {
  const mesh = MeshBuilder.CreateBox(name, { width, height, depth }, scene);
  mesh.parent = parent;
  mesh.position.set(x, y, z);
  mesh.material = material;
  mesh.isPickable = false;
  return mesh;
}

function routeSegment(scene: Scene, parent: TransformNode, material: PBRMaterial, name: string, ax: number, az: number, bx: number, bz: number, width: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const mesh = box(scene, parent, name, material, (ax + bx) / 2, 0.022, (az + bz) / 2, Math.hypot(dx, dz), 0.04, width);
  mesh.rotation.y = -Math.atan2(dz, dx);
}

function momentumCueLabel(object: CombatObject) {
  if (object.id === 'capture-drum-a') return 'inbound-capture-drum';
  if (object.id === 'capture-drum-b') return 'outbound-capture-drum';
  if (object.id === 'door-control') return 'inbound-capture-collar';
  if (object.id === 'gravity-control') return 'outbound-mass-trim';
  if (object.id === 'crate-a') return 'capture-collar-pallet';
  if (object.id === 'crate-b') return 'transfer-cradle-dolly';
  if (object.id === 'coolant-a') return 'flywheel-bearing-loop';
  if (object.id === 'conduit-a' || object.id === 'arena-conduit') return 'countermass-reference-bus';
  if (object.id === 'arena-cover') return 'deep-counterweight-cradle';
  if (object.id.startsWith('momentum-rail')) return 'electromagnetic-transfer-rail';
  if (object.id === 'momentum-baffle') return 'countermass-service-baffle';
  if (object.kind === 'gravityControl') return 'mass-trim-control';
  if (object.kind === 'salvageNode') return 'exchange-ledger';
  return null;
}

function enableCount<T extends { setEnabled(value: boolean): void }>(items: readonly T[], count: number) {
  items.forEach((item, index) => item.setEnabled(index < count));
}

type FlywheelRig = { root: TransformNode; rotor: Mesh; hub: Mesh };
type CaptureRig = { id: string; root: TransformNode; ring: Mesh; core: Mesh };

export class BabylonMomentumExchangePresentation {
  private readonly root: TransformNode;
  private readonly materials: PBRMaterial[];
  private readonly cueMaterial: PBRMaterial;
  private readonly routeMaterials: readonly [PBRMaterial, PBRMaterial];
  private readonly impulseMaterial: StandardMaterial;
  private readonly bossCueMaterial: StandardMaterial;
  private readonly flywheels: FlywheelRig[] = [];
  private readonly serviceFrames: TransformNode[] = [];
  private readonly transferRails: Mesh[] = [];
  private readonly captureCradles: TransformNode[] = [];
  private readonly impulseBands: Mesh[] = [];
  private readonly captureRigs: CaptureRig[] = [];
  private readonly objectCueRoot: TransformNode;
  private readonly objectCues = new Map<string, Mesh>();
  private readonly bossCueRoot: TransformNode;
  private readonly bossCrown: Mesh;
  private readonly bossCore: Mesh;
  private readonly hemisphere: HemisphericLight;
  private readonly keyLight: DirectionalLight;
  private readonly rimLight: DirectionalLight;
  private readonly emergencyLight: PointLight;
  private readonly readabilityLight: PointLight;
  private readonly practicalLights: readonly [PointLight, PointLight];
  private readonly meshCount: number;
  private released = true;

  constructor(private readonly scene: Scene, private readonly canvas: HTMLCanvasElement, private readonly coarse: boolean) {
    const world = getWorldSize();
    const worldW = scaled(world.w);
    const worldH = scaled(world.h);
    const cx = worldW * 0.5;
    const cz = worldH * 0.5;

    this.root = new TransformNode('p27-c8-momentum-exchange-environment', scene);
    const floor = pbr(scene, 'p27-c8-momentum-floor', 0x07161d, 0.58, 0.44);
    const machinery = pbr(scene, 'p27-c8-magnetic-machinery', 0x23343c, 0.86, 0.27);
    const structural = pbr(scene, 'p27-c8-transfer-structure', 0x354d58, 0.72, 0.34);
    const capture = pbr(scene, 'p27-c8-capture-service', 0x47798c, 0.48, 0.30, 0x67b5d5, 0.22);
    const reference = pbr(scene, 'p27-c8-reference-blue', 0x10252f, 0.42, 0.23, 0x67b5d5, 0.34);
    const routePrimary = pbr(scene, 'p27-c8-route-primary', 0x31586a, 0.42, 0.44, 0x67b5d5, 0.18);
    const routeSecondary = pbr(scene, 'p27-c8-route-secondary', 0x1d3540, 0.50, 0.54, 0x3f758d, 0.10);
    this.materials = [floor, machinery, structural, capture, reference, routePrimary, routeSecondary];
    this.cueMaterial = capture;
    this.routeMaterials = [routePrimary, routeSecondary];
    box(scene, this.root, 'p27-c8-momentum-floor-mesh', floor, cx, -0.08, cz, worldW, 0.16, worldH);

    const flywheelPlacements = [
      [0.28, 0.68, -1],
      [0.50, 0.32, 1],
      [0.72, 0.68, -1],
    ] as const;
    flywheelPlacements.forEach(([x, z, direction], index) => {
      const root = new TransformNode('p27-c8-flywheel-rig-' + index, scene);
      root.parent = this.root;
      root.position.set(worldW * x, 0, worldH * z);
      box(scene, root, 'p27-c8-flywheel-plinth-' + index, structural, 0, 0.26, 0, 2.35, 0.52, 1.45);
      box(scene, root, 'p27-c8-flywheel-bearing-a-' + index, machinery, 0, 1.92, -1.36, 0.58, 2.65, 0.48);
      box(scene, root, 'p27-c8-flywheel-bearing-b-' + index, machinery, 0, 1.92, 1.36, 0.58, 2.65, 0.48);
      const rotor = MeshBuilder.CreateTorus('p27-c8-flywheel-rotor-' + index, { diameter: 5.4, thickness: 0.52, tessellation: 52 }, scene);
      rotor.parent = root;
      rotor.position.y = 3.25;
      rotor.rotation.y = Math.PI / 2;
      rotor.material = machinery;
      rotor.isPickable = false;
      const hub = MeshBuilder.CreateCylinder('p27-c8-flywheel-hub-' + index, { height: 1.02, diameter: 1.32, tessellation: 18 }, scene);
      hub.parent = root;
      hub.position.y = 3.25;
      hub.rotation.x = Math.PI / 2;
      hub.material = capture;
      hub.isPickable = false;
      for (const spokeRotation of [0, Math.PI / 2]) {
        const spoke = box(scene, root, 'p27-c8-flywheel-spoke-' + index + '-' + spokeRotation.toFixed(2), structural, 0, 3.25, 0, 0.20, 4.35, 0.22);
        spoke.rotation.x = Math.PI / 2;
        spoke.rotation.y = spokeRotation;
      }
      rotor.metadata = { direction };
      this.flywheels.push({ root, rotor, hub });
    });

    const framePlacements = [
      [0.14, 0.18], [0.27, 0.82], [0.40, 0.18],
      [0.60, 0.82], [0.73, 0.18], [0.86, 0.82],
    ] as const;
    framePlacements.forEach(([x, z], index) => {
      const root = new TransformNode('p27-c8-transfer-frame-' + index, scene);
      root.parent = this.root;
      root.position.set(worldW * x, 0, worldH * z);
      box(scene, root, 'p27-c8-frame-left-' + index, structural, -0.88, 1.24, 0, 0.20, 2.48, 0.26);
      box(scene, root, 'p27-c8-frame-right-' + index, structural, 0.88, 1.24, 0, 0.20, 2.48, 0.26);
      box(scene, root, 'p27-c8-frame-top-' + index, machinery, 0, 2.42, 0, 1.96, 0.20, 0.30);
      const coil = MeshBuilder.CreateTorus('p27-c8-frame-coil-' + index, { diameter: 0.92, thickness: 0.08, tessellation: 24 }, scene);
      coil.parent = root;
      coil.position.y = 1.42;
      coil.rotation.x = Math.PI / 2;
      coil.material = capture;
      coil.isPickable = false;
      this.serviceFrames.push(root);
    });

    const railData = [
      [0.25, 0.43, 8.5, -0.08],
      [0.43, 0.57, 9.6, 0.04],
      [0.61, 0.43, 9.6, -0.04],
      [0.79, 0.57, 8.5, 0.08],
    ] as const;
    railData.forEach(([x, z, length, rotation], index) => {
      const rail = box(scene, this.root, 'p27-c8-transfer-rail-' + index, reference, worldW * x, 0.09, worldH * z, length, 0.18, 0.30);
      rail.rotation.y = rotation;
      this.transferRails.push(rail);
    });

    const cradlePositions = [[520, 710], [980, 280], [1390, 720]] as const;
    cradlePositions.forEach(([x, y], index) => {
      const root = new TransformNode('p27-c8-capture-cradle-' + index, scene);
      root.parent = this.root;
      root.position.set(scaled(x), 0, scaled(y));
      box(scene, root, 'p27-c8-cradle-base-' + index, machinery, 0, 0.22, 0, 1.72, 0.44, 1.02);
      box(scene, root, 'p27-c8-cradle-saddle-' + index, structural, 0, 0.58, 0, 1.20, 0.28, 0.72);
      const ring = MeshBuilder.CreateTorus('p27-c8-cradle-ring-' + index, { diameter: 1.08, thickness: 0.09, tessellation: 24 }, scene);
      ring.parent = root;
      ring.position.y = 0.92;
      ring.rotation.x = Math.PI / 2;
      ring.material = capture;
      ring.isPickable = false;
      this.captureCradles.push(root);
    });

    for (const [id, x, z] of [['capture-drum-a', 520, 710], ['capture-drum-b', 1390, 720]] as const) {
      const root = new TransformNode('p27-c8-' + id, scene);
      root.parent = this.root;
      root.position.set(scaled(x), 0, scaled(z));
      box(scene, root, id + '-pedestal', machinery, 0, 0.34, 0, 0.92, 0.68, 0.92);
      const core = MeshBuilder.CreateCylinder(id + '-core', { height: 1.36, diameter: 0.62, tessellation: 16 }, scene);
      core.parent = root;
      core.position.y = 1.28;
      core.material = reference;
      core.isPickable = false;
      const ring = MeshBuilder.CreateTorus(id + '-ring', { diameter: 1.62, thickness: 0.11, tessellation: 30 }, scene);
      ring.parent = root;
      ring.position.y = 1.34;
      ring.rotation.x = Math.PI / 2;
      ring.material = capture;
      ring.isPickable = false;
      this.captureRigs.push({ id, root, ring, core });
    }

    this.impulseMaterial = new StandardMaterial('p27-c8-countermass-wash-material', scene);
    this.impulseMaterial.diffuseColor = colorFromHex(0x67b5d5).scale(0.18);
    this.impulseMaterial.emissiveColor = colorFromHex(0x67b5d5).scale(0.62);
    this.impulseMaterial.specularColor = Color3.Black();
    this.impulseMaterial.alpha = 0.16;
    this.impulseMaterial.disableLighting = true;
    this.impulseMaterial.backFaceCulling = false;
    ([[0.44, 0.50, 0.16, 0.88], [0.58, 0.50, 0.16, 0.88], [0.72, 0.50, 0.15, 0.84]] as const).forEach(([x, z, wr, dr], index) => {
      const band = box(scene, this.root, 'p27-c8-countermass-band-' + index, this.impulseMaterial, worldW * x, 0.035, worldH * z, worldW * wr, 0.025, worldH * dr);
      band.setEnabled(false);
      this.impulseBands.push(band);
    });

    const navigation = getMapNavigationPlan('momentum-exchange');
    navigation.routes.forEach(route => {
      const material = route.kind === 'primary' ? routePrimary : routeSecondary;
      const width = route.kind === 'primary' ? 0.12 : 0.076;
      route.points.slice(0, -1).forEach((point, index) => {
        const next = route.points[index + 1];
        routeSegment(scene, this.root, material, 'p27-c8-route-' + route.id + '-' + index, scaled(point.x), scaled(point.y), scaled(next.x), scaled(next.y), width);
      });
    });
    navigation.landmarks.forEach((landmark, index) => {
      const x = scaled(landmark.x);
      const z = scaled(landmark.y);
      const beacon = MeshBuilder.CreateCylinder('p27-c8-landmark-' + landmark.id, { height: 2.54, diameterTop: 0.10, diameterBottom: 0.46, tessellation: 8 }, scene);
      beacon.parent = this.root;
      beacon.position.set(x, 1.27, z);
      beacon.material = index === 1 ? capture : structural;
      beacon.isPickable = false;
      const marker = MeshBuilder.CreateTorus('p27-c8-landmark-ring-' + index, { diameter: 0.82, thickness: 0.07, tessellation: 24 }, scene);
      marker.parent = this.root;
      marker.position.set(x, 2.42, z);
      marker.rotation.x = Math.PI / 2;
      marker.material = capture;
      marker.isPickable = false;
    });

    this.objectCueRoot = new TransformNode('p27-c8-capture-service-cues', scene);
    this.objectCueRoot.parent = this.root;

    this.bossCueMaterial = new StandardMaterial('p27-c8-exchange-boss-cue-material', scene);
    this.bossCueMaterial.diffuseColor = colorFromHex(0x67b5d5).scale(0.22);
    this.bossCueMaterial.emissiveColor = colorFromHex(0x67b5d5).scale(0.82);
    this.bossCueMaterial.specularColor = Color3.Black();
    this.bossCueMaterial.alpha = 0.54;
    this.bossCueMaterial.disableLighting = true;
    this.bossCueMaterial.backFaceCulling = false;
    this.bossCueRoot = new TransformNode('p27-c8-exchange-interdictor-cue', scene);
    this.bossCueRoot.parent = this.root;
    this.bossCrown = MeshBuilder.CreateTorus('p27-c8-boss-brake-crown', { diameter: 3.55, thickness: 0.12, tessellation: 40 }, scene);
    this.bossCrown.parent = this.bossCueRoot;
    this.bossCrown.position.y = 1.62;
    this.bossCrown.rotation.x = Math.PI / 2;
    this.bossCrown.material = this.bossCueMaterial;
    this.bossCrown.isPickable = false;
    for (const side of [-1, 1]) {
      const counterweight = MeshBuilder.CreateCylinder('p27-c8-boss-counterweight-' + side, { height: 1.55, diameter: 0.34, tessellation: 12 }, scene);
      counterweight.parent = this.bossCueRoot;
      counterweight.position.set(side * 1.03, 1.02, 0);
      counterweight.material = this.bossCueMaterial;
      counterweight.isPickable = false;
    }
    this.bossCore = MeshBuilder.CreateSphere('p27-c8-boss-transfer-core', { diameter: 0.68, segments: 12 }, scene);
    this.bossCore.parent = this.bossCueRoot;
    this.bossCore.position.y = 0.78;
    this.bossCore.material = this.bossCueMaterial;
    this.bossCore.isPickable = false;
    this.bossCueRoot.setEnabled(false);

    this.meshCount = this.root.getChildMeshes(false).length;
    this.root.setEnabled(false);

    const lighting = BABYLON_MOMENTUM_EXCHANGE_LIGHTING;
    this.hemisphere = new HemisphericLight('p27-c8-momentum-hemisphere', new Vector3(-0.16, 1, 0.10), scene);
    this.hemisphere.diffuse = colorFromHex(0xc4d5dc);
    this.hemisphere.groundColor = colorFromHex(0x041019);
    this.hemisphere.intensity = 0.30;
    this.keyLight = new DirectionalLight('p27-c8-momentum-key', new Vector3(-0.54, -1, 0.30).normalize(), scene);
    this.keyLight.position = new Vector3(worldW * 0.88, 24, worldH * 0.16);
    this.keyLight.diffuse = colorFromHex(lighting.keyColor);
    this.keyLight.intensity = lighting.keyIntensity;
    this.rimLight = new DirectionalLight('p27-c8-momentum-rim', new Vector3(0.42, -0.84, -0.34).normalize(), scene);
    this.rimLight.position = new Vector3(worldW * 0.12, 14, worldH * 0.84);
    this.rimLight.diffuse = colorFromHex(lighting.rimColor);
    this.rimLight.intensity = lighting.rimIntensity;
    this.emergencyLight = new PointLight('p27-c8-countermass-warning', new Vector3(cx, 3.0, cz), scene);
    this.emergencyLight.diffuse = colorFromHex(lighting.emergencyColor);
    this.emergencyLight.range = 11.6;
    this.readabilityLight = new PointLight('p27-c8-momentum-readability', new Vector3(cx, 2.8, cz), scene);
    this.readabilityLight.diffuse = colorFromHex(0xd4e5ed);
    this.readabilityLight.range = 9.2;
    this.practicalLights = [
      new PointLight('p27-c8-practical-transfer', new Vector3(worldW * 0.50, 2.9, worldH * 0.50), scene),
      new PointLight('p27-c8-practical-cradle', new Vector3(worldW * 0.80, 2.9, worldH * 0.58), scene),
    ] as const;
    this.practicalLights[0].diffuse = colorFromHex(0x67b5d5);
    this.practicalLights[0].range = 8.4;
    this.practicalLights[1].diffuse = colorFromHex(0x86cade);
    this.practicalLights[1].range = 7.6;
    this.setLightingEnabled(false);
  }

  sync(state: SimState, renderBudget: RenderBudgetSnapshot, lowVisibility: boolean) {
    this.released = false;
    this.root.setEnabled(true);
    this.setLightingEnabled(true);
    const profile = momentumExchangeRenderProfile(renderBudget.detailScale, this.coarse);
    enableCount(this.flywheels.map(item => item.root), profile.flywheelInstances);
    enableCount(this.serviceFrames, profile.serviceFrameInstances);
    enableCount(this.transferRails, profile.transferRailInstances);
    enableCount(this.captureCradles, profile.captureCradleInstances);

    this.flywheels.forEach((rig, index) => {
      const direction = Number(rig.rotor.metadata?.direction ?? (index % 2 ? 1 : -1));
      rig.rotor.rotation.z = state.time * (0.56 + index * 0.08) * direction;
      rig.hub.rotation.z = -state.time * (0.34 + index * 0.05) * direction;
    });

    const vectorWashes = state.hazards.filter(hazard => hazard.active && hazard.kind === 'vectorWash');
    const washMode = momentumExchangeWashMode(vectorWashes.length);
    this.impulseBands.forEach((band, index) => {
      const enabled = washMode === 'countermass-wash' && index < profile.impulseBandInstances;
      band.setEnabled(enabled);
      if (enabled && vectorWashes.length > 0) {
        const hazard = vectorWashes[index % vectorWashes.length];
        band.position.x = scaled(hazard.x + index * 72 - 72);
        band.position.z = scaled(hazard.y);
      }
    });
    const washPulse = 0.76 + Math.sin(state.time * 7.2) * 0.22;
    this.impulseMaterial.alpha = (washMode === 'countermass-wash' ? 0.24 : 0.07) * renderBudget.transparencyScale;
    this.impulseMaterial.emissiveColor = colorFromHex(0x67b5d5).scale(0.56 * washPulse);

    const captureObjects = state.objects.filter(object => object.id === 'capture-drum-a' || object.id === 'capture-drum-b');
    const intactCapture = captureObjects.filter(object => object.hp > 0);
    const loadedCapture = intactCapture.filter(object => object.exposed);
    const captureState = momentumExchangeCaptureState(loadedCapture.length, intactCapture.length);
    for (const rig of this.captureRigs) {
      const object = captureObjects.find(item => item.id === rig.id);
      const intact = Boolean(object && object.hp > 0);
      const loaded = Boolean(object?.exposed && intact);
      rig.root.setEnabled(intact);
      if (object) rig.root.position.set(scaled(object.x + object.w / 2), 0, scaled(object.y + object.h / 2));
      const pulse = loaded ? 1.08 + Math.sin(state.time * 5.8 + rig.id.length) * 0.10 : 0.92 + Math.sin(state.time * 2.8) * 0.04;
      rig.ring.scaling.set(pulse, pulse, pulse);
      rig.ring.rotation.z = state.time * (loaded ? 0.74 : 0.28);
      rig.core.scaling.y = loaded ? 1.14 : 0.94;
    }

    const cueCount = this.syncObjectCues(state);
    const configuredBoss = state.enemies.find(enemy => !enemy.dead && enemy.role === 'boss') ?? null;
    const activeBoss = configuredBoss?.active ? configuredBoss : null;
    const adjudicator = configuredBoss?.variant === 'transferAdjudicator';
    this.bossCueRoot.setEnabled(Boolean(activeBoss));
    if (activeBoss) {
      this.bossCueRoot.position.set(scaled(activeBoss.x), 0.05, scaled(activeBoss.y));
      const phaseTwo = activeBoss.bossPhase === 2;
      const patternHot = ['brakeWave', 'partitionSweep', 'recoilVector'].includes(activeBoss.bossPattern);
      const bossColor = colorFromHex(phaseTwo ? 0xaee9f5 : patternHot ? 0x86cade : 0x67b5d5);
      this.bossCueMaterial.diffuseColor = bossColor.scale(0.22);
      this.bossCueMaterial.emissiveColor = bossColor.scale(phaseTwo ? 1.0 : 0.84);
      this.bossCueMaterial.alpha = phaseTwo ? 0.70 : 0.54;
      const pulse = 1 + Math.sin(state.time * (patternHot ? 7.4 : phaseTwo ? 5.8 : 3.9) + activeBoss.patternIndex) * (patternHot ? 0.14 : 0.07);
      this.bossCrown.scaling.set(pulse, pulse, pulse);
      this.bossCrown.rotation.z = state.time * (phaseTwo ? 0.92 : 0.46);
      const coreScale = patternHot ? 1.22 + Math.sin(state.time * 7.0) * 0.08 : phaseTwo ? 1.12 : 1;
      this.bossCore.scaling.set(coreScale, coreScale, coreScale);
    }

    const bossPattern = activeBoss?.bossPattern ?? 'none';
    const hazardMode = bossPattern === 'brakeWave' ? 'brake-wave'
      : bossPattern === 'partitionSweep' ? 'partition-sweep'
        : bossPattern === 'recoilVector' ? 'recoil-vector'
          : washMode;

    const lighting = BABYLON_MOMENTUM_EXCHANGE_LIGHTING;
    const tierScale = renderBudget.tierName === 'high' ? 1 : renderBudget.tierName === 'balanced' ? 0.88 : 0.72;
    this.hemisphere.intensity = 0.30 * (renderBudget.tierName === 'performance' ? 0.82 : 1);
    this.keyLight.intensity = lighting.keyIntensity * tierScale * (lowVisibility ? 0.94 : 1);
    this.rimLight.intensity = lighting.rimIntensity * (renderBudget.tierName === 'performance' ? 0.74 : 1);
    const px = scaled(state.player.x);
    const pz = scaled(state.player.y);
    this.readabilityLight.position.set(px - 0.5, 2.8, pz + 0.7);
    this.readabilityLight.intensity = (renderBudget.tierName === 'performance' ? 3.7 : 5.3) * tierScale;
    this.emergencyLight.position.set(px + 1.6, 3.0, pz - 1.4);
    this.emergencyLight.intensity = lighting.emergencyIntensity * (renderBudget.tierName === 'performance' ? 0.72 : 1) * (hazardMode === 'nominal' ? 0.54 : 1.16) * (activeBoss?.bossPhase === 2 ? 1.10 : 1);
    const practicalCount = renderBudget.tierName === 'performance' ? 1 : 2;
    this.practicalLights.forEach((light, index) => {
      const enabled = index < practicalCount;
      light.setEnabled(enabled);
      light.intensity = enabled ? (index === 0 ? 5.3 : 4.5) * tierScale : 0;
    });
    const routePulse = 0.86 + Math.sin(state.time * 3.6) * 0.14;
    this.routeMaterials[0].emissiveColor = colorFromHex(0x67b5d5).scale(0.18 * routePulse);
    this.routeMaterials[1].emissiveColor = colorFromHex(0x3f758d).scale(0.10 * routePulse);

    this.scene.environmentTexture = null;
    this.scene.environmentIntensity = 0;
    this.scene.imageProcessingConfiguration.toneMappingEnabled = true;
    this.scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    this.scene.imageProcessingConfiguration.exposure = lighting.exposure * (lowVisibility ? 1.04 : 1);
    this.scene.imageProcessingConfiguration.contrast = 1.05;

    const navigation = getMapNavigationPlan('momentum-exchange');
    const transferGravity = state.sectors[1]?.gravity ?? 0;
    const pbrCount = this.scene.materials.filter(item => item instanceof PBRMaterial).length;
    this.canvas.dataset.babylonEnvironmentState = 'ready';
    this.canvas.dataset.environmentVisual = 'procedural-momentum-exchange-babylon';
    this.canvas.dataset.environmentKit = 'flywheel-rig,transfer-frame,electromagnetic-rail,capture-cradle,capture-drum,countermass-band,wayfinding,boss-cue';
    this.canvas.dataset.environmentInstances = String(this.meshCount + this.objectCues.size);
    this.canvas.dataset.environmentPerformanceProfile = profile.name + ':procedural:structure-shadows-off';
    this.canvas.dataset.environmentInstanceBudget = 'flywheel:' + profile.flywheelInstances + '+frame:' + profile.serviceFrameInstances + '+rail:' + profile.transferRailInstances + '+cradle:' + profile.captureCradleInstances + '+band:' + profile.impulseBandInstances + '+drum:2';
    this.canvas.dataset.environmentShadowCasters = 'off';
    this.canvas.dataset.environmentLandmark = 'counter-rotating-flywheel-transfer-lane';
    this.canvas.dataset.environmentServiceDetails = 'transfer-frame:' + profile.serviceFrameInstances + '+capture-cradle:' + profile.captureCradleInstances;
    this.canvas.dataset.environmentSurfaceDetail = 'flywheel-rig:' + profile.flywheelInstances + '+electromagnetic-rail:' + profile.transferRailInstances;
    this.canvas.dataset.environmentMachineDetail = 'counter-rotating-flywheel:3+capture-drum:2+countermass-bus:1';
    this.canvas.dataset.environmentComposition = 'brake-deck+near-zero-g-transfer-tunnel+countermass-cradle';
    this.canvas.dataset.environmentMaterials = 'magnetic-machinery+brushed-ferrous+transfer-blue+capture-cyan';
    this.canvas.dataset.environmentZoneIdentity = 'brake:flywheel-housings+capture-collar|tunnel:electromagnetic-rails+near-zero-g+countermass-wash|cradle:counterweight-cradle+reference-bus';
    this.canvas.dataset.readabilityLanguage = 'counter-rotating-flywheels+blue-transfer-rails+cyan-capture-rings+impulse-front-bands';
    this.canvas.dataset.environmentFlywheels = 'procedural-babylon:' + profile.flywheelInstances + ':counter-rotating';
    this.canvas.dataset.environmentTransferGravity = transferGravity.toFixed(2);
    this.canvas.dataset.environmentCaptureDrums = captureState + ':' + loadedCapture.length + '/' + intactCapture.length;
    this.canvas.dataset.environmentCaptureDrumIds = 'capture-drum-a,capture-drum-b';
    this.canvas.dataset.environmentCountermassWashes = String(vectorWashes.length);
    this.canvas.dataset.environmentCountermassTimeline = '9.0s:first-wash>20.0s:transfer-reversal';
    this.canvas.dataset.environmentHazardLanguage = 'shared-hazards+countermass-wash+vector-wash+near-zero-g+magnetic-transfer';
    this.canvas.dataset.environmentHazardMode = hazardMode;
    this.canvas.dataset.environmentVfx = 'flywheel-spin+transfer-rail-pulse+countermass-bands+capture-ring-pulse';
    this.canvas.dataset.locationArt = 'momentum-exchange:flywheel-lane:magnetic-machinery';
    this.canvas.dataset.locationArtIdentity = 'flywheel-lane|magnetic-machinery|transfer-blue|capture-service';
    this.canvas.dataset.locationProps = 'capture-service:procedural-babylon';
    this.canvas.dataset.interactableBiome = 'momentum-exchange';
    this.canvas.dataset.interactableMode = 'momentum-exchange-capture-service+mission-controls';
    this.canvas.dataset.interactableKit = 'capture-drum+capture-collar+mass-trim+flywheel-bearing-loop+countermass-reference-bus';
    this.canvas.dataset.interactableLocationVisual = 'procedural-babylon-capture-cues';
    this.canvas.dataset.interactableLocationCueCount = String(cueCount);
    this.canvas.dataset.bossBiome = 'momentum-exchange';
    this.canvas.dataset.bossPresentation = adjudicator ? 'iona-vale' : 'neris-vane';
    this.canvas.dataset.bossVisual = 'procedural-babylon';
    this.canvas.dataset.bossAsset = adjudicator ? 'procedural-babylon-transfer-adjudicator-cue' : 'procedural-babylon-exchange-interdictor-cue';
    this.canvas.dataset.bossSilhouette = 'brake-crown+counterweights+transfer-core';
    this.canvas.dataset.bossPalette = 'magnetic-black+transfer-blue+capture-cyan+phase-two-pale-blue';
    this.canvas.dataset.bossCue = 'brake-wave+partition-sweep+recoil-vector';
    this.canvas.dataset.bossCueState = activeBoss ? 'active-phase-' + activeBoss.bossPhase + ':' + bossPattern : 'queued';
    this.canvas.dataset.babylonMomentumExchangeParity = 'flywheel-transfer-architecture+magnetic-machinery+props+interactables+hazards+countermass-washes+capture-drums+navigation+boss-cues+shared-world-cues';
    this.canvas.dataset.babylonMomentumExchangePlayerPosition = state.player.x.toFixed(1) + ',' + state.player.y.toFixed(1);
    this.canvas.dataset.babylonMomentumExchangeRoutes = String(navigation.routes.length);
    this.canvas.dataset.babylonMomentumExchangeLandmarks = navigation.landmarks.map(item => item.label).join('|');
    this.canvas.dataset.babylonLightingProfile = lighting.id;
    this.canvas.dataset.babylonMaterialIntent = 'magnetic-machinery-pbr+transfer-structure+capture-service+shared-world-pbr';
    this.canvas.dataset.babylonLightingBudget = 'tier:' + renderBudget.tierName + '|practical:' + practicalCount + '|shadows:off';
    this.canvas.dataset.environmentIbl = 'off:momentum-exchange';
    this.canvas.dataset.environmentLighting = 'momentum-exchange-cool-key+transfer-blue-rim+contact:player+enemy+practical:' + practicalCount + '+shadow:off';
    this.canvas.dataset.environmentShadowBudget = 'off:momentum-exchange-babylon';
    this.canvas.dataset.environmentTone = 'aces-' + this.scene.imageProcessingConfiguration.exposure.toFixed(2) + '+magnetic-neutral+transfer-blue';
    this.canvas.dataset.locationLighting = 'momentum-exchange:transfer-blue:aces-' + this.scene.imageProcessingConfiguration.exposure.toFixed(2);
    this.canvas.dataset.babylonPbrMaterials = 'pbr:' + pbrCount + '|momentum-exchange:' + this.materials.length;
    this.canvas.dataset.renderTier = renderBudget.tierName;
    this.canvas.dataset.graphicsQuality = renderBudget.qualityMode;
  }

  release(reason: string) {
    if (this.released) return;
    this.released = true;
    this.root.setEnabled(false);
    this.setLightingEnabled(false);
    this.canvas.dataset.babylonMomentumExchangeRelease = reason;
  }

  dispose() {
    this.release('renderer-dispose');
    this.root.getChildMeshes(false).forEach(mesh => mesh.dispose());
    this.root.dispose();
    this.materials.forEach(item => item.dispose());
    this.impulseMaterial.dispose();
    this.bossCueMaterial.dispose();
    this.hemisphere.dispose();
    this.keyLight.dispose();
    this.rimLight.dispose();
    this.emergencyLight.dispose();
    this.readabilityLight.dispose();
    this.practicalLights.forEach(light => light.dispose());
  }

  private syncObjectCues(state: SimState) {
    this.objectCues.forEach(mesh => mesh.setEnabled(false));
    let active = 0;
    for (const object of state.objects) {
      if (!object.active || object.hp <= 0) continue;
      const label = momentumCueLabel(object);
      if (!label) continue;
      let mesh = this.objectCues.get(object.id);
      if (!mesh) {
        mesh = label.includes('drum') || label.includes('trim') || label.includes('loop')
          ? MeshBuilder.CreateCylinder('p27-c8-' + label + '-' + object.id, { height: 0.78, diameter: 0.44, tessellation: 12 }, this.scene)
          : MeshBuilder.CreateBox('p27-c8-' + label + '-' + object.id, { width: 0.68, height: 0.82, depth: 0.50 }, this.scene);
        mesh.parent = this.objectCueRoot;
        mesh.material = this.cueMaterial;
        mesh.isPickable = false;
        this.objectCues.set(object.id, mesh);
      }
      mesh.position.set(scaled(object.x + object.w / 2), 0.52, scaled(object.y + object.h / 2));
      mesh.rotation.y = state.time * 0.14 + active * 0.26;
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
  }
}
