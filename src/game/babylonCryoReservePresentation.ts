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

export const BABYLON_CRYO_RESERVE_IDENTITY = Object.freeze({
  silhouette: 'tank-gallery',
  material: 'vacuum-jacketed-cryogenic',
  lighting: 'cold-blue',
  propSet: 'purge-service',
});

export const BABYLON_CRYO_RESERVE_LIGHTING = Object.freeze({
  id: 'cold-blue',
  keyColor: 0xd0e3ed,
  rimColor: 0x77c6de,
  emergencyColor: 0x76cde9,
  keyIntensity: 2.0,
  rimIntensity: 1.12,
  emergencyIntensity: 8.4,
  exposure: 1.07,
});

export type CryoReserveRenderProfile = {
  name: 'full' | 'balanced' | 'mobile' | 'performance';
  tankInstances: number;
  galleryFrameInstances: number;
  pipeRunInstances: number;
  saddleInstances: number;
  plumeInstances: number;
};

export function cryoReserveRenderProfile(detailScale: number, _coarse: boolean): CryoReserveRenderProfile {
  if (detailScale < 0.62) return { name: 'performance', tankInstances: 7, galleryFrameInstances: 3, pipeRunInstances: 2, saddleInstances: 2, plumeInstances: 1 };
  if (detailScale < 0.9) return { name: 'balanced', tankInstances: 7, galleryFrameInstances: 5, pipeRunInstances: 3, saddleInstances: 3, plumeInstances: 2 };
  return { name: 'full', tankInstances: 7, galleryFrameInstances: 6, pipeRunInstances: 4, saddleInstances: 4, plumeInstances: 3 };
}

export function cryoReservePurgeMode(activeBoiloffJets: number) {
  return activeBoiloffJets > 0 ? 'boiloff-purge' as const : 'nominal' as const;
}

export function cryoReserveValveState(routed: number, intact: number) {
  if (intact <= 0) return 'offline' as const;
  if (routed >= intact) return 'routed' as const;
  if (routed > 0) return 'partial' as const;
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

function cryoCueLabel(object: CombatObject) {
  if (object.id === 'purge-valve-a') return 'lh2-purge-valve';
  if (object.id === 'purge-valve-b') return 'methane-purge-valve';
  if (object.id === 'door-control') return 'service-collar-lock';
  if (object.id === 'gravity-control') return 'tank-farm-mass-trim';
  if (object.id === 'crate-a') return 'valve-service-cassette';
  if (object.id === 'crate-b') return 'insulation-repair-rack';
  if (object.id === 'coolant-a') return 'boiloff-return-header';
  if (object.id === 'conduit-a') return 'cryopump-power-trunk';
  if (object.id === 'arena-cover') return 'umbra-transfer-manifold';
  if (object.id === 'arena-conduit') return 'reserve-pump-bus';
  if (object.id.startsWith('cryo-tank-')) return 'vacuum-jacket-tank';
  if (object.id === 'cryo-insulation') return 'brittle-insulation-screen';
  if (object.id.includes('siphon')) return 'capacitor-siphon-relay';
  if (object.kind === 'doorControl') return 'purge-service-control';
  if (object.kind === 'anchorNode') return 'cold-relay-node';
  return null;
}

function enableCount<T extends { setEnabled(value: boolean): void }>(items: readonly T[], count: number) {
  items.forEach((item, index) => item.setEnabled(index < count));
}

type TankRig = { root: TransformNode; shell: Mesh; frostRing: Mesh };
type ValveRig = { id: string; root: TransformNode; ring: Mesh; stem: Mesh };

export class BabylonCryoReservePresentation {
  private readonly root: TransformNode;
  private readonly materials: PBRMaterial[];
  private readonly cueMaterial: PBRMaterial;
  private readonly routeMaterials: readonly [PBRMaterial, PBRMaterial];
  private readonly plumeMaterial: StandardMaterial;
  private readonly bossCueMaterial: StandardMaterial;
  private readonly tanks: TankRig[] = [];
  private readonly galleryFrames: TransformNode[] = [];
  private readonly pipeRuns: Mesh[] = [];
  private readonly saddles: TransformNode[] = [];
  private readonly purgePlumes: Mesh[] = [];
  private readonly valveRigs: ValveRig[] = [];
  private readonly objectCueRoot: TransformNode;
  private readonly objectCues = new Map<string, Mesh>();
  private readonly bossCueRoot: TransformNode;
  private readonly bossCrown: Mesh;
  private readonly bossCore: Mesh;
  private readonly bossSpines: Mesh[] = [];
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

    this.root = new TransformNode('p27-c9-cryo-reserve-environment', scene);
    const floor = pbr(scene, 'p27-c9-cryo-floor', 0x07151c, 0.54, 0.46);
    const jacket = pbr(scene, 'p27-c9-vacuum-jacket-steel', 0x34515e, 0.86, 0.24);
    const structural = pbr(scene, 'p27-c9-cold-structure', 0x273b45, 0.72, 0.34);
    const frost = pbr(scene, 'p27-c9-frosted-insulation', 0x9ab7c2, 0.20, 0.62, 0x77c6de, 0.08);
    const purge = pbr(scene, 'p27-c9-cold-blue-purge', 0x31576a, 0.48, 0.30, 0x77c6de, 0.25);
    const routePrimary = pbr(scene, 'p27-c9-route-primary', 0x31576a, 0.42, 0.44, 0x77c6de, 0.18);
    const routeSecondary = pbr(scene, 'p27-c9-route-secondary', 0x213743, 0.50, 0.54, 0x466f83, 0.10);
    this.materials = [floor, jacket, structural, frost, purge, routePrimary, routeSecondary];
    this.cueMaterial = purge;
    this.routeMaterials = [routePrimary, routeSecondary];
    box(scene, this.root, 'p27-c9-cryo-floor-mesh', floor, cx, -0.08, cz, worldW, 0.16, worldH);

    const tankPlacements = [
      [0.18, 0.30], [0.29, 0.69], [0.40, 0.31], [0.51, 0.69],
      [0.62, 0.31], [0.73, 0.69], [0.84, 0.31],
    ] as const;
    tankPlacements.forEach(([x, z], index) => {
      const root = new TransformNode('p27-c9-tank-rig-' + index, scene);
      root.parent = this.root;
      root.position.set(worldW * x, 0, worldH * z);
      box(scene, root, 'p27-c9-tank-saddle-base-' + index, structural, 0, 0.22, 0, 2.05, 0.44, 1.52);
      const shell = MeshBuilder.CreateCylinder('p27-c9-vacuum-jacket-tank-' + index, { height: 4.20, diameter: 1.80, tessellation: 20 }, scene);
      shell.parent = root;
      shell.position.y = 2.54;
      shell.material = jacket;
      shell.isPickable = false;
      const cap = MeshBuilder.CreateSphere('p27-c9-tank-cap-' + index, { diameter: 1.66, segments: 12 }, scene);
      cap.parent = root;
      cap.position.y = 4.55;
      cap.scaling.y = 0.36;
      cap.material = frost;
      cap.isPickable = false;
      const frostRing = MeshBuilder.CreateTorus('p27-c9-tank-frost-ring-' + index, { diameter: 1.98, thickness: 0.08, tessellation: 28 }, scene);
      frostRing.parent = root;
      frostRing.position.y = 3.34;
      frostRing.rotation.x = Math.PI / 2;
      frostRing.material = purge;
      frostRing.isPickable = false;
      this.tanks.push({ root, shell, frostRing });
    });

    const framePlacements = [[0.12, 0.50], [0.26, 0.50], [0.40, 0.50], [0.60, 0.50], [0.74, 0.50], [0.88, 0.50]] as const;
    framePlacements.forEach(([x, z], index) => {
      const root = new TransformNode('p27-c9-gallery-frame-' + index, scene);
      root.parent = this.root;
      root.position.set(worldW * x, 0, worldH * z);
      box(scene, root, 'p27-c9-frame-left-' + index, structural, -1.02, 1.40, 0, 0.20, 2.80, 0.28);
      box(scene, root, 'p27-c9-frame-right-' + index, structural, 1.02, 1.40, 0, 0.20, 2.80, 0.28);
      box(scene, root, 'p27-c9-frame-top-' + index, jacket, 0, 2.70, 0, 2.20, 0.20, 0.32);
      this.galleryFrames.push(root);
    });

    const pipeData = [[0.28, 0.48, 9.0], [0.46, 0.52, 10.4], [0.64, 0.48, 10.4], [0.82, 0.52, 9.0]] as const;
    pipeData.forEach(([x, z, length], index) => {
      const pipe = MeshBuilder.CreateCylinder('p27-c9-boiloff-header-' + index, { height: length, diameter: 0.22, tessellation: 12 }, scene);
      pipe.parent = this.root;
      pipe.position.set(worldW * x, 2.16, worldH * z);
      pipe.rotation.z = Math.PI / 2;
      pipe.material = purge;
      pipe.isPickable = false;
      this.pipeRuns.push(pipe);
    });

    ([[500, 280], [980, 760], [1390, 300], [1900, 560]] as const).forEach(([x, y], index) => {
      const root = new TransformNode('p27-c9-tank-saddle-' + index, scene);
      root.parent = this.root;
      root.position.set(scaled(x), 0, scaled(y));
      box(scene, root, 'p27-c9-saddle-' + index, structural, 0, 0.30, 0, 1.72, 0.60, 1.08);
      const ring = MeshBuilder.CreateTorus('p27-c9-saddle-ring-' + index, { diameter: 1.12, thickness: 0.09, tessellation: 24 }, scene);
      ring.parent = root;
      ring.position.y = 0.94;
      ring.rotation.x = Math.PI / 2;
      ring.material = frost;
      ring.isPickable = false;
      this.saddles.push(root);
    });

    for (const [id, x, z] of [['purge-valve-a', 500, 280], ['purge-valve-b', 1390, 300]] as const) {
      const root = new TransformNode('p27-c9-' + id, scene);
      root.parent = this.root;
      root.position.set(scaled(x), 0, scaled(z));
      box(scene, root, id + '-pedestal', structural, 0, 0.34, 0, 0.92, 0.68, 0.92);
      const stem = MeshBuilder.CreateCylinder(id + '-stem', { height: 1.28, diameter: 0.34, tessellation: 14 }, scene);
      stem.parent = root;
      stem.position.y = 1.20;
      stem.material = jacket;
      stem.isPickable = false;
      const ring = MeshBuilder.CreateTorus(id + '-ring', { diameter: 1.48, thickness: 0.11, tessellation: 28 }, scene);
      ring.parent = root;
      ring.position.y = 1.30;
      ring.rotation.x = Math.PI / 2;
      ring.material = purge;
      ring.isPickable = false;
      this.valveRigs.push({ id, root, ring, stem });
    }

    this.plumeMaterial = new StandardMaterial('p27-c9-boiloff-plume-material', scene);
    this.plumeMaterial.diffuseColor = colorFromHex(0x77c6de).scale(0.18);
    this.plumeMaterial.emissiveColor = colorFromHex(0x77c6de).scale(0.62);
    this.plumeMaterial.specularColor = Color3.Black();
    this.plumeMaterial.alpha = 0.16;
    this.plumeMaterial.disableLighting = true;
    this.plumeMaterial.backFaceCulling = false;
    for (let index = 0; index < 3; index += 1) {
      const plume = MeshBuilder.CreateCylinder('p27-c9-boiloff-plume-' + index, { height: 0.08, diameterTop: 1.2, diameterBottom: 3.2, tessellation: 28 }, scene);
      plume.parent = this.root;
      plume.position.y = 0.06;
      plume.material = this.plumeMaterial;
      plume.isPickable = false;
      plume.setEnabled(false);
      this.purgePlumes.push(plume);
    }

    const navigation = getMapNavigationPlan('cryo-reserve');
    navigation.routes.forEach(route => {
      const material = route.kind === 'primary' ? routePrimary : routeSecondary;
      const width = route.kind === 'primary' ? 0.12 : 0.076;
      route.points.slice(0, -1).forEach((point, index) => {
        const next = route.points[index + 1];
        routeSegment(scene, this.root, material, 'p27-c9-route-' + route.id + '-' + index, scaled(point.x), scaled(point.y), scaled(next.x), scaled(next.y), width);
      });
    });
    navigation.landmarks.forEach((landmark, index) => {
      const beacon = MeshBuilder.CreateCylinder('p27-c9-landmark-' + landmark.id, { height: 2.54, diameterTop: 0.10, diameterBottom: 0.46, tessellation: 8 }, scene);
      beacon.parent = this.root;
      beacon.position.set(scaled(landmark.x), 1.27, scaled(landmark.y));
      beacon.material = index === 2 ? frost : structural;
      beacon.isPickable = false;
      const marker = MeshBuilder.CreateTorus('p27-c9-landmark-ring-' + index, { diameter: 0.82, thickness: 0.07, tessellation: 24 }, scene);
      marker.parent = this.root;
      marker.position.set(scaled(landmark.x), 2.42, scaled(landmark.y));
      marker.rotation.x = Math.PI / 2;
      marker.material = purge;
      marker.isPickable = false;
    });

    this.objectCueRoot = new TransformNode('p27-c9-purge-service-cues', scene);
    this.objectCueRoot.parent = this.root;
    this.bossCueMaterial = new StandardMaterial('p27-c9-umbra-marshal-cue-material', scene);
    this.bossCueMaterial.diffuseColor = colorFromHex(0x77c6de).scale(0.22);
    this.bossCueMaterial.emissiveColor = colorFromHex(0x77c6de).scale(0.82);
    this.bossCueMaterial.specularColor = Color3.Black();
    this.bossCueMaterial.alpha = 0.54;
    this.bossCueMaterial.disableLighting = true;
    this.bossCueMaterial.backFaceCulling = false;
    this.bossCueRoot = new TransformNode('p27-c9-umbra-marshal-cue', scene);
    this.bossCueRoot.parent = this.root;
    this.bossCrown = MeshBuilder.CreateTorus('p27-c9-boss-purge-manifold', { diameter: 3.45, thickness: 0.12, tessellation: 40 }, scene);
    this.bossCrown.parent = this.bossCueRoot;
    this.bossCrown.position.y = 1.62;
    this.bossCrown.rotation.x = Math.PI / 2;
    this.bossCrown.material = this.bossCueMaterial;
    this.bossCrown.isPickable = false;
    for (const side of [-1, 1]) {
      const spine = MeshBuilder.CreateCylinder('p27-c9-boss-siphon-spine-' + side, { height: 1.68, diameter: 0.30, tessellation: 12 }, scene);
      spine.parent = this.bossCueRoot;
      spine.position.set(side * 1.04, 1.02, 0);
      spine.material = this.bossCueMaterial;
      spine.isPickable = false;
      this.bossSpines.push(spine);
    }
    this.bossCore = MeshBuilder.CreateSphere('p27-c9-boss-cold-core', { diameter: 0.72, segments: 12 }, scene);
    this.bossCore.parent = this.bossCueRoot;
    this.bossCore.position.y = 0.78;
    this.bossCore.material = this.bossCueMaterial;
    this.bossCore.isPickable = false;
    this.bossCueRoot.setEnabled(false);

    this.meshCount = this.root.getChildMeshes(false).length;
    this.root.setEnabled(false);

    const lighting = BABYLON_CRYO_RESERVE_LIGHTING;
    this.hemisphere = new HemisphericLight('p27-c9-cryo-hemisphere', new Vector3(-0.12, 1, 0.12), scene);
    this.hemisphere.diffuse = colorFromHex(0xc8dbe5);
    this.hemisphere.groundColor = colorFromHex(0x041019);
    this.hemisphere.intensity = 0.29;
    this.keyLight = new DirectionalLight('p27-c9-cryo-key', new Vector3(-0.50, -1, 0.28).normalize(), scene);
    this.keyLight.position = new Vector3(worldW * 0.86, 24, worldH * 0.18);
    this.keyLight.diffuse = colorFromHex(lighting.keyColor);
    this.keyLight.intensity = lighting.keyIntensity;
    this.rimLight = new DirectionalLight('p27-c9-cryo-rim', new Vector3(0.38, -0.82, -0.36).normalize(), scene);
    this.rimLight.position = new Vector3(worldW * 0.14, 14, worldH * 0.84);
    this.rimLight.diffuse = colorFromHex(lighting.rimColor);
    this.rimLight.intensity = lighting.rimIntensity;
    this.emergencyLight = new PointLight('p27-c9-boiloff-warning', new Vector3(cx, 3.0, cz), scene);
    this.emergencyLight.diffuse = colorFromHex(lighting.emergencyColor);
    this.emergencyLight.range = 11.8;
    this.readabilityLight = new PointLight('p27-c9-cryo-readability', new Vector3(cx, 2.8, cz), scene);
    this.readabilityLight.diffuse = colorFromHex(0xd0e3ed);
    this.readabilityLight.range = 9.2;
    this.practicalLights = [
      new PointLight('p27-c9-practical-gallery', new Vector3(worldW * 0.50, 2.9, worldH * 0.50), scene),
      new PointLight('p27-c9-practical-tank-farm', new Vector3(worldW * 0.80, 2.9, worldH * 0.56), scene),
    ] as const;
    this.practicalLights[0].diffuse = colorFromHex(0x77c6de);
    this.practicalLights[0].range = 8.4;
    this.practicalLights[1].diffuse = colorFromHex(0x9edff0);
    this.practicalLights[1].range = 7.8;
    this.setLightingEnabled(false);
  }

  sync(state: SimState, renderBudget: RenderBudgetSnapshot, lowVisibility: boolean) {
    this.released = false;
    this.root.setEnabled(true);
    this.setLightingEnabled(true);
    const profile = cryoReserveRenderProfile(renderBudget.detailScale, this.coarse);
    enableCount(this.tanks.map(item => item.root), profile.tankInstances);
    enableCount(this.galleryFrames, profile.galleryFrameInstances);
    enableCount(this.pipeRuns, profile.pipeRunInstances);
    enableCount(this.saddles, profile.saddleInstances);

    this.tanks.forEach((rig, index) => {
      const frostPulse = 0.94 + Math.sin(state.time * 1.6 + index * 0.72) * 0.04;
      rig.frostRing.scaling.set(frostPulse, frostPulse, frostPulse);
      rig.frostRing.rotation.z = state.time * (index % 2 ? -0.12 : 0.12);
      rig.shell.scaling.y = 1 + Math.sin(state.time * 0.72 + index) * 0.006;
    });

    const boiloffJets = state.hazards.filter(hazard => hazard.active && hazard.kind === 'boiloffJet');
    const purgeMode = cryoReservePurgeMode(boiloffJets.length);
    this.purgePlumes.forEach((plume, index) => {
      const enabled = purgeMode === 'boiloff-purge' && index < profile.plumeInstances && boiloffJets.length > 0;
      plume.setEnabled(enabled);
      if (enabled) {
        const hazard = boiloffJets[index % boiloffJets.length];
        plume.position.x = scaled(hazard.x + index * 42 - 42);
        plume.position.z = scaled(hazard.y);
        const pulse = 0.88 + Math.sin(state.time * 6.4 + index) * 0.18;
        plume.scaling.set(pulse, 1, pulse);
      }
    });
    const plumePulse = 0.76 + Math.sin(state.time * 7.0) * 0.20;
    this.plumeMaterial.alpha = (purgeMode === 'boiloff-purge' ? 0.24 : 0.06) * renderBudget.transparencyScale;
    this.plumeMaterial.emissiveColor = colorFromHex(0x77c6de).scale(0.58 * plumePulse);

    const valves = state.objects.filter(object => object.id === 'purge-valve-a' || object.id === 'purge-valve-b');
    const intactValves = valves.filter(object => object.hp > 0);
    const routedValves = intactValves.filter(object => object.exposed);
    const valveState = cryoReserveValveState(routedValves.length, intactValves.length);
    for (const rig of this.valveRigs) {
      const object = valves.find(item => item.id === rig.id);
      const intact = Boolean(object && object.hp > 0);
      const routed = Boolean(object?.exposed && intact);
      rig.root.setEnabled(intact);
      if (object) rig.root.position.set(scaled(object.x + object.w / 2), 0, scaled(object.y + object.h / 2));
      const pulse = routed ? 1.08 + Math.sin(state.time * 5.4 + rig.id.length) * 0.10 : 0.94 + Math.sin(state.time * 2.6) * 0.04;
      rig.ring.scaling.set(pulse, pulse, pulse);
      rig.ring.rotation.z = state.time * (routed ? 0.78 : 0.24);
      rig.stem.scaling.y = routed ? 1.10 : 0.96;
    }

    const cueCount = this.syncObjectCues(state);
    const configuredBoss = state.enemies.find(enemy => !enemy.dead && enemy.role === 'boss') ?? null;
    const activeBoss = configuredBoss?.active ? configuredBoss : null;
    const umbraMarshal = configuredBoss?.variant === 'umbraMarshal';
    this.bossCueRoot.setEnabled(Boolean(activeBoss));
    if (activeBoss) {
      this.bossCueRoot.position.set(scaled(activeBoss.x), 0.05, scaled(activeBoss.y));
      const phaseTwo = activeBoss.bossPhase === 2;
      const patternHot = ['purgeLance', 'busSiphon', 'busReroute'].includes(activeBoss.bossPattern);
      const bossColor = colorFromHex(phaseTwo ? 0xc4f1fb : patternHot ? 0x9edff0 : 0x77c6de);
      this.bossCueMaterial.diffuseColor = bossColor.scale(0.22);
      this.bossCueMaterial.emissiveColor = bossColor.scale(phaseTwo ? 1.0 : 0.84);
      this.bossCueMaterial.alpha = phaseTwo ? 0.70 : 0.54;
      const pulse = 1 + Math.sin(state.time * (patternHot ? 7.2 : phaseTwo ? 5.6 : 3.7) + activeBoss.patternIndex) * (patternHot ? 0.14 : 0.07);
      this.bossCrown.scaling.set(pulse, pulse, pulse);
      this.bossCrown.rotation.z = state.time * (phaseTwo ? 0.88 : 0.42);
      this.bossSpines.forEach((spine, index) => { spine.scaling.y = 1 + Math.sin(state.time * 4.6 + index * Math.PI) * (patternHot ? 0.16 : 0.06); });
      const coreScale = patternHot ? 1.22 + Math.sin(state.time * 6.8) * 0.08 : phaseTwo ? 1.12 : 1;
      this.bossCore.scaling.set(coreScale, coreScale, coreScale);
    }

    const bossPattern = activeBoss?.bossPattern ?? 'none';
    const hazardMode = bossPattern === 'purgeLance' ? 'purge-lance'
      : bossPattern === 'busSiphon' ? 'bus-siphon'
        : bossPattern === 'busReroute' ? 'bus-reroute'
          : purgeMode;

    const lighting = BABYLON_CRYO_RESERVE_LIGHTING;
    const tierScale = renderBudget.tierName === 'high' ? 1 : renderBudget.tierName === 'balanced' ? 0.88 : 0.72;
    this.hemisphere.intensity = 0.29 * (renderBudget.tierName === 'performance' ? 0.82 : 1);
    this.keyLight.intensity = lighting.keyIntensity * tierScale * (lowVisibility ? 0.94 : 1);
    this.rimLight.intensity = lighting.rimIntensity * (renderBudget.tierName === 'performance' ? 0.74 : 1);
    const px = scaled(state.player.x);
    const pz = scaled(state.player.y);
    this.readabilityLight.position.set(px - 0.5, 2.8, pz + 0.7);
    this.readabilityLight.intensity = (renderBudget.tierName === 'performance' ? 3.6 : 5.1) * tierScale;
    this.emergencyLight.position.set(px + 1.5, 3.0, pz - 1.3);
    this.emergencyLight.intensity = lighting.emergencyIntensity * (renderBudget.tierName === 'performance' ? 0.72 : 1) * (hazardMode === 'nominal' ? 0.52 : 1.18) * (activeBoss?.bossPhase === 2 ? 1.10 : 1);
    const practicalCount = renderBudget.tierName === 'performance' ? 1 : 2;
    this.practicalLights.forEach((light, index) => {
      const enabled = index < practicalCount;
      light.setEnabled(enabled);
      light.intensity = enabled ? (index === 0 ? 5.0 : 4.4) * tierScale : 0;
    });
    const routePulse = 0.86 + Math.sin(state.time * 3.4) * 0.14;
    this.routeMaterials[0].emissiveColor = colorFromHex(0x77c6de).scale(0.18 * routePulse);
    this.routeMaterials[1].emissiveColor = colorFromHex(0x466f83).scale(0.10 * routePulse);

    this.scene.environmentTexture = null;
    this.scene.environmentIntensity = 0;
    this.scene.imageProcessingConfiguration.toneMappingEnabled = true;
    this.scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    this.scene.imageProcessingConfiguration.exposure = lighting.exposure * (lowVisibility ? 1.04 : 1);
    this.scene.imageProcessingConfiguration.contrast = 1.05;

    const navigation = getMapNavigationPlan('cryo-reserve');
    const pressure = state.sectors.slice(0, 3).map(sector => sector.pressure.toFixed(2)).join('>');
    const siphonNodes = state.objects.filter(object => object.id.includes('siphon') && object.active && object.hp > 0).length;
    const pbrCount = this.scene.materials.filter(item => item instanceof PBRMaterial).length;
    this.canvas.dataset.babylonEnvironmentState = 'ready';
    this.canvas.dataset.environmentVisual = 'procedural-cryo-reserve-babylon';
    this.canvas.dataset.environmentKit = 'vacuum-jacket-tank,gallery-frame,boiloff-header,tank-saddle,purge-valve,boiloff-plume,wayfinding,boss-cue';
    this.canvas.dataset.environmentInstances = String(this.meshCount + this.objectCues.size);
    this.canvas.dataset.environmentPerformanceProfile = profile.name + ':procedural:structure-shadows-off';
    this.canvas.dataset.environmentInstanceBudget = 'tank:' + profile.tankInstances + '+frame:' + profile.galleryFrameInstances + '+pipe:' + profile.pipeRunInstances + '+saddle:' + profile.saddleInstances + '+plume:' + profile.plumeInstances + '+valve:2';
    this.canvas.dataset.environmentShadowCasters = 'off';
    this.canvas.dataset.environmentLandmark = 'staggered-vacuum-jacket-tank-gallery';
    this.canvas.dataset.environmentServiceDetails = 'gallery-frame:' + profile.galleryFrameInstances + '+tank-saddle:' + profile.saddleInstances + '+purge-valve:2';
    this.canvas.dataset.environmentSurfaceDetail = 'vacuum-jacket-tank:' + profile.tankInstances + '+boiloff-header:' + profile.pipeRunInstances;
    this.canvas.dataset.environmentMachineDetail = 'vacuum-jacket-tank:7+purge-valve:2+siphon-relay:' + siphonNodes;
    this.canvas.dataset.environmentComposition = 'service-collar+propellant-gallery+umbra-tank-farm';
    this.canvas.dataset.environmentMaterials = 'vacuum-jacketed-steel+frosted-insulation+cold-blue-purge+cold-cyan-service';
    this.canvas.dataset.environmentZoneIdentity = 'service-collar:valve-service+vacuum-jacket|gallery:staggered-tanks+boiloff-headers+purge-plumes|tank-farm:tank-saddles+umbra-manifold+siphon-bus';
    this.canvas.dataset.readabilityLanguage = 'staggered-tank-silhouette+cold-blue-headers+cyan-valve-rings+shape-coded-boiloff-plumes';
    this.canvas.dataset.environmentPurgeValves = valveState + ':' + routedValves.length + '/' + intactValves.length;
    this.canvas.dataset.environmentPurgeValveIds = 'purge-valve-a,purge-valve-b';
    this.canvas.dataset.environmentBoiloffJets = String(boiloffJets.length);
    this.canvas.dataset.environmentPurgeTimeline = '10.0s:first-boiloff>21.0s:secondary-purge';
    this.canvas.dataset.environmentPressureProfile = pressure;
    this.canvas.dataset.environmentHazardLanguage = 'shared-hazards+boiloff-jet+limited-atmosphere+damaged-grid+purge-routing';
    this.canvas.dataset.environmentHazardMode = hazardMode;
    this.canvas.dataset.environmentVfx = 'tank-frost-pulse+header-pulse+boiloff-plumes+purge-valve-ring';
    this.canvas.dataset.locationArt = 'cryo-reserve:tank-gallery:vacuum-jacketed-cryogenic';
    this.canvas.dataset.locationArtIdentity = 'tank-gallery|vacuum-jacketed-cryogenic|cold-blue|purge-service';
    this.canvas.dataset.locationProps = 'purge-service:procedural-babylon';
    this.canvas.dataset.interactableBiome = 'cryo-reserve';
    this.canvas.dataset.interactableMode = 'cryo-reserve-purge-routing+mission-controls';
    this.canvas.dataset.interactableKit = 'purge-valve+service-collar+tank-mass-trim+cryopump-bus+boiloff-header+siphon-relay';
    this.canvas.dataset.interactableLocationVisual = 'procedural-babylon-cryo-cues';
    this.canvas.dataset.interactableLocationCueCount = String(cueCount);
    this.canvas.dataset.bossBiome = 'cryo-reserve';
    this.canvas.dataset.bossPresentation = umbraMarshal ? 'oren-saal' : 'reserve-command';
    this.canvas.dataset.bossVisual = 'procedural-babylon';
    this.canvas.dataset.bossAsset = umbraMarshal ? 'procedural-babylon-umbra-marshal-cue' : 'procedural-babylon-cryo-command-cue';
    this.canvas.dataset.bossSilhouette = 'purge-manifold+cold-siphon-spines+marshal-core';
    this.canvas.dataset.bossPalette = 'vacuum-steel+cold-blue+frost-cyan+phase-two-pale-cyan';
    this.canvas.dataset.bossCue = 'purge-lance+bus-siphon+bus-reroute';
    this.canvas.dataset.bossCueState = activeBoss ? 'active-phase-' + activeBoss.bossPhase + ':' + bossPattern : 'queued';
    this.canvas.dataset.babylonCryoReserveParity = 'tank-gallery-architecture+cryogenic-materials+props+interactables+hazards+boiloff-purges+purge-valves+siphon-relays+navigation+boss-cues+shared-world-cues';
    this.canvas.dataset.babylonCryoReservePlayerPosition = state.player.x.toFixed(1) + ',' + state.player.y.toFixed(1);
    this.canvas.dataset.babylonCryoReserveRoutes = String(navigation.routes.length);
    this.canvas.dataset.babylonCryoReserveLandmarks = navigation.landmarks.map(item => item.label).join('|');
    this.canvas.dataset.babylonLightingProfile = lighting.id;
    this.canvas.dataset.babylonMaterialIntent = 'vacuum-jacket-pbr+cryogenic-structure+purge-service+shared-world-pbr';
    this.canvas.dataset.babylonLightingBudget = 'tier:' + renderBudget.tierName + '|practical:' + practicalCount + '|shadows:off';
    this.canvas.dataset.environmentIbl = 'off:cryo-reserve';
    this.canvas.dataset.environmentLighting = 'cryo-reserve-cool-key+cold-blue-rim+contact:player+enemy+practical:' + practicalCount + '+shadow:off';
    this.canvas.dataset.environmentShadowBudget = 'off:cryo-reserve-babylon';
    this.canvas.dataset.environmentTone = 'aces-' + this.scene.imageProcessingConfiguration.exposure.toFixed(2) + '+vacuum-neutral+cold-blue';
    this.canvas.dataset.locationLighting = 'cryo-reserve:cold-blue:aces-' + this.scene.imageProcessingConfiguration.exposure.toFixed(2);
    this.canvas.dataset.babylonPbrMaterials = 'pbr:' + pbrCount + '|cryo-reserve:' + this.materials.length;
    this.canvas.dataset.renderTier = renderBudget.tierName;
    this.canvas.dataset.graphicsQuality = renderBudget.qualityMode;
  }

  release(reason: string) {
    if (this.released) return;
    this.released = true;
    this.root.setEnabled(false);
    this.setLightingEnabled(false);
    this.canvas.dataset.babylonCryoReserveRelease = reason;
  }

  dispose() {
    this.release('renderer-dispose');
    this.root.getChildMeshes(false).forEach(mesh => mesh.dispose());
    this.root.dispose();
    this.materials.forEach(item => item.dispose());
    this.plumeMaterial.dispose();
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
      const label = cryoCueLabel(object);
      if (!label) continue;
      let mesh = this.objectCues.get(object.id);
      if (!mesh) {
        mesh = label.includes('tank') || label.includes('valve') || label.includes('siphon') || label.includes('header')
          ? MeshBuilder.CreateCylinder('p27-c9-' + label + '-' + object.id, { height: 0.82, diameter: 0.44, tessellation: 12 }, this.scene)
          : MeshBuilder.CreateBox('p27-c9-' + label + '-' + object.id, { width: 0.68, height: 0.82, depth: 0.50 }, this.scene);
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
