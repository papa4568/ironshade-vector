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
import { solarYardRenderProfile } from './solarYardVisualProfile';
import { getWorldSize, type CombatObject, type SimState } from './sim';

const WORLD_SCALE = 0.02;

export const BABYLON_SOLAR_YARD_IDENTITY = Object.freeze({
  silhouette: 'panel-clamps',
  material: 'heat-shielded-alloy',
  lighting: 'solar-orange',
  propSet: 'fabrication-service',
});

export const BABYLON_SOLAR_YARD_LIGHTING = Object.freeze({
  id: 'solar-orange',
  keyColor: 0xffc89a,
  rimColor: 0xef8f46,
  emergencyColor: 0xe27745,
  keyIntensity: 2.55,
  rimIntensity: 1.14,
  emergencyIntensity: 8.8,
  exposure: 1.1,
});

export function solarYardThermalState(time: number, shutterClosed: boolean) {
  const surge = time >= 10 && time < 18 && !shutterClosed;
  return Object.freeze({
    surge,
    mode: surge ? 'solar-surge' : 'hard-sun',
    protection: shutterClosed ? 'radiant-load-cut' : surge ? 'solar-surge-exposed' : 'shutters-open',
  });
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

function box(scene: Scene, parent: TransformNode, name: string, mat: PBRMaterial | StandardMaterial, x: number, y: number, z: number, width: number, height: number, depth: number) {
  const mesh = MeshBuilder.CreateBox(name, { width, height, depth }, scene);
  mesh.parent = parent;
  mesh.position.set(x, y, z);
  mesh.material = mat;
  mesh.isPickable = false;
  return mesh;
}

function routeSegment(scene: Scene, parent: TransformNode, mat: PBRMaterial, name: string, ax: number, az: number, bx: number, bz: number, width: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const mesh = box(scene, parent, name, mat, (ax + bx) / 2, 0.022, (az + bz) / 2, Math.hypot(dx, dz), 0.04, width);
  mesh.rotation.y = -Math.atan2(dz, dx);
}

function machineryLabel(object: CombatObject) {
  if (object.id === 'solar-shutter') return null;
  if (object.kind === 'powerControl') return 'solar-bus-isolator';
  if (object.kind === 'gravityControl') return 'gantry-mass-trim';
  if (object.id === 'salvage-node-a') return 'mirror-actuator';
  if (object.id === 'salvage-node-b') return 'printer-spindle';
  if (object.kind === 'doorControl') return 'thermal-pressure-lock';
  if (object.kind === 'sealControl') return 'radiator-pressure-manifold';
  return null;
}

type Gantry = { root: TransformNode; trolley: Mesh; phase: number; amplitude: number; speed: number };

export class BabylonSolarYardPresentation {
  private readonly root: TransformNode;
  private readonly materials: PBRMaterial[];
  private readonly shadeMaterial: StandardMaterial;
  private readonly sunMaterial: StandardMaterial;
  private readonly bossCueMaterial: StandardMaterial;
  private readonly routeMaterials: readonly [PBRMaterial, PBRMaterial];
  private readonly ceramicDecks: TransformNode[] = [];
  private readonly trussFrames: TransformNode[] = [];
  private readonly radiatorTowers: TransformNode[] = [];
  private readonly reflectorPylons: TransformNode[] = [];
  private readonly sinterForges: TransformNode[] = [];
  private readonly printerSpindles: TransformNode[] = [];
  private readonly feedstockPresses: TransformNode[] = [];
  private readonly transferRails: Mesh[] = [];
  private readonly gantries: Gantry[] = [];
  private readonly shadePatches: Mesh[] = [];
  private readonly sunPatches: Mesh[] = [];
  private readonly machineryRoot: TransformNode;
  private readonly machineryMaterial: PBRMaterial;
  private readonly machineryCues = new Map<string, Mesh>();
  private readonly shutterRoot: TransformNode;
  private readonly shutterLeft: Mesh;
  private readonly shutterRight: Mesh;
  private readonly bossCueRoot: TransformNode;
  private readonly bossPhaseRing: Mesh;
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

    this.root = new TransformNode('p27-c6-solar-yard-environment', scene);
    const floor = pbr(scene, 'p27-c6-solar-floor', 0x1d1008, 0.58, 0.58);
    const ceramic = pbr(scene, 'p27-c6-solar-ceramic', 0xc9c1ad, 0.42, 0.34);
    const steel = pbr(scene, 'p27-c6-solar-steel', 0x554437, 0.82, 0.38);
    const radiator = pbr(scene, 'p27-c6-solar-radiator', 0x17191a, 0.74, 0.48);
    const gold = pbr(scene, 'p27-c6-solar-gold', 0xbf7a2d, 0.78, 0.26, 0xf2b447, 0.16);
    const amber = pbr(scene, 'p27-c6-solar-hot-work', 0x6f3d20, 0.68, 0.34, 0xef8f46, 0.22);
    const rail = pbr(scene, 'p27-c6-solar-rail', 0x312c29, 0.88, 0.30);
    const routePrimary = pbr(scene, 'p27-c6-solar-route-primary', 0x8a5a2f, 0.34, 0.48, 0xef8f46, 0.16);
    const routeSecondary = pbr(scene, 'p27-c6-solar-route-secondary', 0x493426, 0.48, 0.55, 0x8f5434, 0.08);
    this.materials = [floor, ceramic, steel, radiator, gold, amber, rail, routePrimary, routeSecondary];
    this.routeMaterials = [routePrimary, routeSecondary];
    this.machineryMaterial = amber;
    box(scene, this.root, 'p27-c6-solar-floor-mesh', floor, cx, -0.08, cz, worldW, 0.16, worldH);

    const deckPlacements = [
      [0.24, 0.27, 0, 0.94], [0.50, 0.27, 0, 0.96], [0.76, 0.27, 0, 0.94],
      [0.26, 0.73, Math.PI, 0.94], [0.52, 0.73, Math.PI, 0.96], [0.78, 0.73, Math.PI, 0.94],
    ] as const;
    deckPlacements.forEach(([x, z, rotationY, scale], index) => {
      const root = new TransformNode('p27-c6-solar-ceramic-deck-' + index, scene);
      root.parent = this.root;
      root.position.set(worldW * x, 0, worldH * z);
      root.rotation.y = rotationY;
      root.scaling.set(scale, scale, scale);
      box(scene, root, 'p27-c6-solar-deck-plate-' + index, ceramic, 0, 0.10, 0, 4.0, 0.18, 1.55);
      box(scene, root, 'p27-c6-solar-deck-clamp-a-' + index, steel, -1.66, 0.38, 0, 0.30, 0.64, 1.72);
      box(scene, root, 'p27-c6-solar-deck-clamp-b-' + index, steel, 1.66, 0.38, 0, 0.30, 0.64, 1.72);
      this.ceramicDecks.push(root);
    });

    const trussPlacements = [[0.18, 0.50, 0.92], [0.34, 0.50, 0.96], [0.50, 0.50, 1.04], [0.66, 0.50, 0.96], [0.82, 0.50, 0.92]] as const;
    trussPlacements.forEach(([x, z, scale], index) => {
      const root = new TransformNode('p27-c6-solar-truss-' + index, scene);
      root.parent = this.root;
      root.position.set(worldW * x, 0, worldH * z);
      root.scaling.set(scale, scale, scale);
      box(scene, root, 'p27-c6-solar-truss-left-' + index, steel, -1.18, 1.08, 0, 0.20, 2.16, 0.26);
      box(scene, root, 'p27-c6-solar-truss-right-' + index, steel, 1.18, 1.08, 0, 0.20, 2.16, 0.26);
      box(scene, root, 'p27-c6-solar-truss-top-' + index, steel, 0, 2.06, 0, 2.56, 0.20, 0.28);
      this.trussFrames.push(root);
    });

    const radiatorPlacements = [[0.14, 0.22, 0.86], [0.14, 0.78, 0.86], [0.86, 0.22, 0.90], [0.86, 0.78, 0.90]] as const;
    radiatorPlacements.forEach(([x, z, scale], index) => {
      const root = new TransformNode('p27-c6-solar-radiator-' + index, scene);
      root.parent = this.root;
      root.position.set(worldW * x, 0, worldH * z);
      root.rotation.y = x < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      root.scaling.set(scale, scale, scale);
      box(scene, root, 'p27-c6-solar-radiator-mast-' + index, steel, 0, 1.10, 0, 0.24, 2.20, 0.30);
      for (const side of [-1, 1]) box(scene, root, 'p27-c6-solar-radiator-panel-' + index + '-' + side, radiator, side * 0.90, 1.22, 0, 1.55, 1.05, 0.12);
      this.radiatorTowers.push(root);
    });

    const reflectorPlacements = [[0.72, 0.22, Math.PI / 2, 0.90], [0.82, 0.50, Math.PI / 2, 1.04], [0.72, 0.78, Math.PI / 2, 0.90]] as const;
    reflectorPlacements.forEach(([x, z, rotationY, scale], index) => {
      const root = new TransformNode('p27-c6-solar-reflector-' + index, scene);
      root.parent = this.root;
      root.position.set(worldW * x, 0, worldH * z);
      root.rotation.y = rotationY;
      root.scaling.set(scale, scale, scale);
      box(scene, root, 'p27-c6-solar-reflector-post-' + index, steel, 0, 1.08, 0, 0.22, 2.16, 0.22);
      const panel = box(scene, root, 'p27-c6-solar-reflector-panel-' + index, gold, 0.22, 2.02, 0, 2.25, 0.12, 1.28);
      panel.rotation.z = -0.18;
      this.reflectorPylons.push(root);
    });

    ([[0.40, 0.38, Math.PI / 2, 0.90], [0.58, 0.62, -Math.PI / 2, 0.94]] as const).forEach(([x, z, rotationY, scale], index) => {
      const root = new TransformNode('p27-c6-solar-sinter-' + index, scene);
      root.parent = this.root;
      root.position.set(worldW * x, 0, worldH * z);
      root.rotation.y = rotationY;
      root.scaling.set(scale, scale, scale);
      box(scene, root, 'p27-c6-solar-sinter-base-' + index, steel, 0, 0.24, 0, 1.45, 0.48, 1.05);
      const drum = MeshBuilder.CreateCylinder('p27-c6-solar-sinter-drum-' + index, { height: 1.55, diameter: 0.88, tessellation: 12 }, scene);
      drum.parent = root; drum.position.y = 1.02; drum.material = amber; drum.isPickable = false;
      this.sinterForges.push(root);
    });

    ([[0.26, 0.36, 0, 0.88], [0.50, 0.50, 0, 0.94], [0.74, 0.34, Math.PI, 0.90]] as const).forEach(([x, z, rotationY, scale], index) => {
      const root = new TransformNode('p27-c6-solar-printer-' + index, scene);
      root.parent = this.root;
      root.position.set(worldW * x, 0, worldH * z);
      root.rotation.y = rotationY;
      root.scaling.set(scale, scale, scale);
      box(scene, root, 'p27-c6-solar-printer-frame-' + index, steel, 0, 0.72, 0, 1.22, 1.44, 0.90);
      const spindle = MeshBuilder.CreateCylinder('p27-c6-solar-printer-spindle-' + index, { height: 1.08, diameter: 0.26, tessellation: 10 }, scene);
      spindle.parent = root; spindle.position.set(0, 0.74, -0.48); spindle.material = gold; spindle.isPickable = false;
      this.printerSpindles.push(root);
    });

    ([[0.34, 0.68, Math.PI / 2, 0.88], [0.68, 0.70, -Math.PI / 2, 0.90]] as const).forEach(([x, z, rotationY, scale], index) => {
      const root = new TransformNode('p27-c6-solar-feedstock-' + index, scene);
      root.parent = this.root;
      root.position.set(worldW * x, 0, worldH * z);
      root.rotation.y = rotationY;
      root.scaling.set(scale, scale, scale);
      box(scene, root, 'p27-c6-solar-feedstock-bed-' + index, steel, 0, 0.28, 0, 1.85, 0.56, 1.05);
      box(scene, root, 'p27-c6-solar-feedstock-ram-' + index, amber, 0.35, 0.82, 0, 0.48, 1.05, 0.68);
      this.feedstockPresses.push(root);
    });

    ([[0.22, 0.50, 0.86], [0.50, 0.50, 0.92], [0.78, 0.50, 0.86]] as const).forEach(([x, z, scale], index) => {
      this.transferRails.push(box(scene, this.root, 'p27-c6-solar-transfer-rail-' + index, rail, worldW * x, 0.055, worldH * z, 4.5 * scale, 0.11, 0.34));
    });

    const createGantry = (name: string, x: number, z: number, scale: number, phase: number, amplitude: number, speed: number): Gantry => {
      const root = new TransformNode(name, scene);
      root.parent = this.root; root.position.set(worldW * x, 0, worldH * z); root.scaling.set(scale, scale, scale);
      box(scene, root, name + '-left', steel, -2.15, 1.45, 0, 0.22, 2.90, 0.30);
      box(scene, root, name + '-right', steel, 2.15, 1.45, 0, 0.22, 2.90, 0.30);
      box(scene, root, name + '-beam', gold, 0, 2.74, 0, 4.55, 0.22, 0.32);
      const trolley = box(scene, root, name + '-trolley', amber, 0, 2.48, 0, 0.52, 0.42, 0.74);
      return { root, trolley, phase, amplitude, speed };
    };
    this.gantries.push(
      createGantry('p27-c6-solar-gantry-left', 0.34, 0.50, 0.72, 0, 2.06, 0.48),
      createGantry('p27-c6-solar-gantry-right', 0.66, 0.50, 0.76, Math.PI * 0.72, 1.78, 0.56),
      createGantry('p27-c6-solar-gantry-center', 0.50, 0.50, 0.74, Math.PI * 0.36, 1.92, 0.52),
    );

    this.shutterRoot = new TransformNode('p27-c6-solar-thermal-shutter', scene);
    this.shutterRoot.parent = this.root; this.shutterRoot.rotation.y = Math.PI / 2;
    box(scene, this.shutterRoot, 'p27-c6-solar-shutter-frame-top', steel, 0, 1.72, 0, 4.8, 0.20, 0.28);
    box(scene, this.shutterRoot, 'p27-c6-solar-shutter-frame-left', steel, -2.26, 0.86, 0, 0.20, 1.72, 0.28);
    box(scene, this.shutterRoot, 'p27-c6-solar-shutter-frame-right', steel, 2.26, 0.86, 0, 0.20, 1.72, 0.28);
    this.shutterLeft = box(scene, this.shutterRoot, 'p27-c6-solar-shutter-panel-left', ceramic, -1.18, 0.88, 0, 1.98, 1.56, 0.18);
    this.shutterRight = box(scene, this.shutterRoot, 'p27-c6-solar-shutter-panel-right', ceramic, 1.18, 0.88, 0, 1.98, 1.56, 0.18);

    this.shadeMaterial = new StandardMaterial('p27-c6-solar-shade-material', scene);
    this.shadeMaterial.diffuseColor = colorFromHex(0x07141c); this.shadeMaterial.emissiveColor = colorFromHex(0x07141c).scale(0.08);
    this.shadeMaterial.specularColor = Color3.Black(); this.shadeMaterial.alpha = 0.17; this.shadeMaterial.disableLighting = true;
    const shadePlacements = [[0.22, 0.40, 0.18, 0.52, -0.10], [0.36, 0.66, 0.18, 0.52, -0.10], [0.52, 0.28, 0.13, 0.36, -0.10]] as const;
    shadePlacements.forEach(([x, z, wr, dr, rotation], index) => {
      const patch = box(scene, this.root, 'p27-c6-solar-shade-patch-' + index, this.shadeMaterial, worldW * x, 0.018, worldH * z, worldW * wr, 0.018, worldH * dr);
      patch.rotation.y = rotation; this.shadePatches.push(patch);
    });

    this.sunMaterial = new StandardMaterial('p27-c6-solar-sun-material', scene);
    this.sunMaterial.diffuseColor = colorFromHex(0xffb45d).scale(0.24); this.sunMaterial.emissiveColor = colorFromHex(0xffb45d).scale(0.48);
    this.sunMaterial.specularColor = Color3.Black(); this.sunMaterial.alpha = 0.075; this.sunMaterial.disableLighting = true;
    const sunPlacements = [[0.68, 0.30, 0.20, 0.34, -0.10], [0.78, 0.56, 0.17, 0.30, -0.10], [0.64, 0.78, 0.16, 0.24, -0.10]] as const;
    sunPlacements.forEach(([x, z, wr, dr, rotation], index) => {
      const patch = box(scene, this.root, 'p27-c6-solar-sun-patch-' + index, this.sunMaterial, worldW * x, 0.028, worldH * z, worldW * wr, 0.020, worldH * dr);
      patch.rotation.y = rotation; this.sunPatches.push(patch);
    });

    const navigation = getMapNavigationPlan('solar-yard');
    navigation.routes.forEach(route => {
      const mat = route.kind === 'primary' ? routePrimary : routeSecondary;
      const width = route.kind === 'primary' ? 0.12 : 0.075;
      route.points.slice(0, -1).forEach((point, index) => {
        const next = route.points[index + 1];
        routeSegment(scene, this.root, mat, 'p27-c6-solar-route-' + route.id + '-' + index, scaled(point.x), scaled(point.y), scaled(next.x), scaled(next.y), width);
      });
    });
    navigation.landmarks.forEach((landmark, index) => {
      const x = scaled(landmark.x), z = scaled(landmark.y);
      const beacon = MeshBuilder.CreateCylinder('p27-c6-solar-landmark-' + landmark.id, { height: 2.5, diameterTop: 0.10, diameterBottom: 0.48, tessellation: 6 }, scene);
      beacon.parent = this.root; beacon.position.set(x, 1.25, z); beacon.material = index === 2 ? gold : amber; beacon.isPickable = false;
      box(scene, this.root, 'p27-c6-solar-landmark-bar-' + index, index === 2 ? gold : routePrimary, x, 2.44, z, 1.12, 0.10, 0.30);
    });

    this.machineryRoot = new TransformNode('p27-c6-solar-machinery-cues', scene);
    this.machineryRoot.parent = this.root;
    this.bossCueMaterial = new StandardMaterial('p27-c6-helios-cue-material', scene);
    this.bossCueMaterial.diffuseColor = colorFromHex(0xf2b447).scale(0.18); this.bossCueMaterial.emissiveColor = colorFromHex(0xf2b447).scale(0.84);
    this.bossCueMaterial.specularColor = Color3.Black(); this.bossCueMaterial.alpha = 0.48; this.bossCueMaterial.disableLighting = true; this.bossCueMaterial.backFaceCulling = false;
    this.bossCueRoot = new TransformNode('p27-c6-helios-9-cue', scene); this.bossCueRoot.parent = this.root;
    this.bossPhaseRing = MeshBuilder.CreateTorus('p27-c6-helios-sunshield-crown', { diameter: 4.4, thickness: 0.10, tessellation: 40 }, scene);
    this.bossPhaseRing.parent = this.bossCueRoot; this.bossPhaseRing.position.y = 1.55; this.bossPhaseRing.rotation.x = Math.PI / 2; this.bossPhaseRing.material = this.bossCueMaterial; this.bossPhaseRing.isPickable = false;
    for (const side of [-1, 1]) {
      const wing = box(scene, this.bossCueRoot, 'p27-c6-helios-reflector-wing-' + side, gold, side * 1.48, 0.85, 0, 1.72, 0.10, 0.92);
      wing.rotation.z = side * 0.28;
    }
    this.bossCore = MeshBuilder.CreateSphere('p27-c6-helios-fabricator-core', { diameter: 0.68, segments: 10 }, scene);
    this.bossCore.parent = this.bossCueRoot; this.bossCore.position.y = 0.72; this.bossCore.material = this.bossCueMaterial; this.bossCore.isPickable = false;
    this.bossCueRoot.setEnabled(false);

    this.meshCount = this.root.getChildMeshes(false).length;
    this.root.setEnabled(false);

    const lighting = BABYLON_SOLAR_YARD_LIGHTING;
    this.hemisphere = new HemisphericLight('p27-c6-solar-hemisphere', new Vector3(-0.28, 1, 0.16), scene);
    this.hemisphere.diffuse = colorFromHex(0xc7d6d8); this.hemisphere.groundColor = colorFromHex(0x07141c); this.hemisphere.intensity = 0.28;
    this.keyLight = new DirectionalLight('p27-c6-solar-key', new Vector3(-0.78, -1, 0.46).normalize(), scene);
    this.keyLight.position = new Vector3(worldW * 1.12, 30, worldH * 0.10); this.keyLight.diffuse = colorFromHex(lighting.keyColor); this.keyLight.intensity = lighting.keyIntensity;
    this.rimLight = new DirectionalLight('p27-c6-solar-rim', new Vector3(0.56, -0.82, -0.28).normalize(), scene);
    this.rimLight.position = new Vector3(worldW * 0.08, 13.5, worldH * 0.88); this.rimLight.diffuse = colorFromHex(lighting.rimColor); this.rimLight.intensity = lighting.rimIntensity;
    this.emergencyLight = new PointLight('p27-c6-solar-thermal-warning', new Vector3(cx, 3.0, cz), scene);
    this.emergencyLight.diffuse = colorFromHex(lighting.emergencyColor); this.emergencyLight.range = 11.5;
    this.readabilityLight = new PointLight('p27-c6-solar-readability', new Vector3(cx, 2.7, cz), scene);
    this.readabilityLight.diffuse = colorFromHex(0xd8e3df); this.readabilityLight.range = 9.2;
    this.practicalLights = [
      new PointLight('p27-c6-solar-practical-spine', new Vector3(worldW * 0.50, 3.0, worldH * 0.50), scene),
      new PointLight('p27-c6-solar-practical-sunward', new Vector3(worldW * 0.76, 3.1, worldH * 0.52), scene),
    ] as const;
    this.practicalLights[0].diffuse = colorFromHex(0xef8f46); this.practicalLights[0].range = 8.4;
    this.practicalLights[1].diffuse = colorFromHex(0xf2b447); this.practicalLights[1].range = 7.8;
    this.setLightingEnabled(false);
  }

  sync(state: SimState, renderBudget: RenderBudgetSnapshot, lowVisibility: boolean) {
    this.released = false; this.root.setEnabled(true); this.setLightingEnabled(true);
    const profile = solarYardRenderProfile(renderBudget.detailScale, this.coarse);
    this.ceramicDecks.forEach((item, index) => item.setEnabled(profile.ceramicDeckInstances === 6 || [0, 2, 3, 5].includes(index)));
    this.trussFrames.forEach((item, index) => item.setEnabled(profile.trussFrameInstances === 5 || [0, 2, 4].includes(index)));
    this.radiatorTowers.forEach((item, index) => item.setEnabled(profile.radiatorTowerInstances === 4 || index === 0 || index === 3));
    this.reflectorPylons.forEach(item => item.setEnabled(true));
    this.sinterForges.forEach((item, index) => item.setEnabled(profile.sinterForgeInstances === 2 || index === 0));
    this.printerSpindles.forEach((item, index) => item.setEnabled(profile.printerSpindleInstances === 3 || index === 0 || index === 2));
    this.feedstockPresses.forEach((item, index) => item.setEnabled(profile.feedstockPressInstances === 2 || index === 0));
    this.transferRails.forEach((item, index) => item.setEnabled(profile.transferRailInstances === 3 || index === 0 || index === 2));

    const usePair = profile.gantryCraneInstances === 2;
    this.gantries[0].root.setEnabled(usePair); this.gantries[1].root.setEnabled(usePair); this.gantries[2].root.setEnabled(!usePair);
    const activeGantries = usePair ? this.gantries.slice(0, 2) : [this.gantries[2]];
    const craneOffsets = activeGantries.map(item => {
      const offset = Math.sin(state.time * item.speed + item.phase) * item.amplitude;
      item.trolley.position.z = offset;
      return offset.toFixed(2);
    });
    this.shadePatches.forEach((item, index) => item.setEnabled(index < profile.shadePatchInstances));
    this.sunPatches.forEach((item, index) => item.setEnabled(index < profile.sunPatchInstances));

    const shutter = state.objects.find(object => object.id === 'solar-shutter');
    const shutterClosed = Boolean(shutter?.exposed);
    if (shutter) this.shutterRoot.position.set(scaled(shutter.x + shutter.w / 2), 0, scaled(shutter.y + shutter.h / 2));
    this.shutterLeft.position.x = shutterClosed ? -1.10 : -1.82;
    this.shutterRight.position.x = shutterClosed ? 1.10 : 1.82;
    const thermal = solarYardThermalState(state.time, shutterClosed);
    const radiatorEvent = state.eventT > 0 && state.eventText.includes('RADIATOR SATURATION');
    const craneEvent = state.eventT > 0 && state.eventText.includes('MACHINERY RUNAWAY');
    this.shadeMaterial.alpha = (thermal.surge ? 0.22 : 0.17) * (renderBudget.tierName === 'performance' ? 0.82 : 1);
    this.sunMaterial.alpha = (thermal.surge ? 0.12 : 0.075) * renderBudget.transparencyScale;
    const heatPulse = 0.74 + Math.sin(state.time * (radiatorEvent ? 7.2 : 3.8)) * 0.22;
    this.machineryMaterial.emissiveColor = colorFromHex(radiatorEvent || thermal.surge ? 0xff7d3d : 0xef8f46).scale((radiatorEvent ? 0.48 : thermal.surge ? 0.34 : 0.22) * heatPulse);

    const machineCount = this.syncMachineryCues(state);
    const activeBoss = state.enemies.find(enemy => enemy.active && !enemy.dead && enemy.role === 'boss') ?? null;
    this.bossCueRoot.setEnabled(Boolean(activeBoss));
    if (activeBoss) {
      this.bossCueRoot.position.set(scaled(activeBoss.x), 0.05, scaled(activeBoss.y));
      const phaseTwo = activeBoss.bossPhase === 2;
      const bossHex = phaseTwo ? 0xff6a3d : activeBoss.armor <= 0 ? 0xffd26a : 0xf2b447;
      const bossColor = colorFromHex(bossHex);
      this.bossCueMaterial.diffuseColor = bossColor.scale(0.18); this.bossCueMaterial.emissiveColor = bossColor.scale(phaseTwo ? 0.98 : 0.84); this.bossCueMaterial.alpha = phaseTwo ? 0.62 : 0.48;
      const pulse = 1 + Math.sin(state.time * (phaseTwo ? 6.4 : 3.5) + activeBoss.patternIndex) * (phaseTwo ? 0.12 : 0.06);
      this.bossPhaseRing.scaling.set(pulse, pulse, pulse); this.bossPhaseRing.rotation.z = state.time * (phaseTwo ? 0.92 : 0.46);
      const coreScale = phaseTwo ? 1.18 + Math.sin(state.time * 7.2) * 0.08 : 1;
      this.bossCore.scaling.set(coreScale, coreScale, coreScale);
    }

    const lighting = BABYLON_SOLAR_YARD_LIGHTING;
    const tierScale = renderBudget.tierName === 'high' ? 1 : renderBudget.tierName === 'balanced' ? 0.88 : 0.72;
    this.hemisphere.intensity = 0.28 * (renderBudget.tierName === 'performance' ? 0.82 : 1);
    this.keyLight.intensity = lighting.keyIntensity * tierScale * (lowVisibility ? 0.94 : 1);
    this.rimLight.intensity = lighting.rimIntensity * (renderBudget.tierName === 'performance' ? 0.74 : 1);
    const px = scaled(state.player.x), pz = scaled(state.player.y);
    this.readabilityLight.position.set(px - 0.6, 2.7, pz + 0.7); this.readabilityLight.intensity = (renderBudget.tierName === 'performance' ? 3.8 : 5.6) * tierScale;
    this.emergencyLight.position.set(px + 1.9, 3.0, pz - 1.7);
    this.emergencyLight.intensity = lighting.emergencyIntensity * (renderBudget.tierName === 'performance' ? 0.72 : 1) * (thermal.surge || radiatorEvent || craneEvent ? 1.18 : 0.68) * (activeBoss?.bossPhase === 2 ? 1.12 : 1);
    const practicalCount = renderBudget.tierName === 'performance' || this.coarse ? 1 : 2;
    this.practicalLights.forEach((light, index) => { const enabled = index < practicalCount; light.setEnabled(enabled); light.intensity = enabled ? (index === 0 ? 5.8 : 4.8) * tierScale : 0; });
    const routePulse = 0.86 + Math.sin(state.time * 3.8) * 0.14;
    this.routeMaterials[0].emissiveColor = colorFromHex(0xef8f46).scale(0.16 * routePulse);
    this.routeMaterials[1].emissiveColor = colorFromHex(0x8f5434).scale(0.07 * routePulse);

    this.scene.environmentTexture = null; this.scene.environmentIntensity = 0;
    this.scene.imageProcessingConfiguration.toneMappingEnabled = true;
    this.scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    this.scene.imageProcessingConfiguration.exposure = lighting.exposure * (lowVisibility ? 1.03 : 1);
    this.scene.imageProcessingConfiguration.contrast = 1.05;

    const navigation = getMapNavigationPlan('solar-yard');
    const machineInstances = profile.sinterForgeInstances + profile.printerSpindleInstances + profile.feedstockPressInstances;
    const pbrCount = this.scene.materials.filter(item => item instanceof PBRMaterial).length;
    this.canvas.dataset.babylonEnvironmentState = 'ready';
    this.canvas.dataset.environmentVisual = 'procedural-solar-yard-babylon';
    this.canvas.dataset.environmentKit = 'ceramic-deck,truss-frame,radiator-tower,reflector-pylon,sinter-forge,printer-spindle,feedstock-press,transfer-rail,gantry-crane,thermal-shutter,wayfinding,boss-cue';
    this.canvas.dataset.environmentInstances = String(this.meshCount + this.machineryCues.size);
    this.canvas.dataset.environmentPerformanceProfile = profile.name + ':procedural:structure-shadows-off';
    this.canvas.dataset.environmentInstanceBudget = 'deck:' + profile.ceramicDeckInstances + '+truss:' + profile.trussFrameInstances + '+radiator:' + profile.radiatorTowerInstances + '+reflector:' + profile.reflectorPylonInstances + '+machines:' + machineInstances + '+rail:' + profile.transferRailInstances + '+crane:' + profile.gantryCraneInstances + '+shutter:1';
    this.canvas.dataset.environmentShadowCasters = 'off';
    this.canvas.dataset.environmentLandmark = 'gold-reflector-pylon-row';
    this.canvas.dataset.environmentServiceDetails = 'ceramic-deck:' + profile.ceramicDeckInstances + '+truss-frame:' + profile.trussFrameInstances + '+radiator-tower:' + profile.radiatorTowerInstances + '+thermal-shutter:1';
    this.canvas.dataset.environmentTransport = 'transfer-rail:' + profile.transferRailInstances + '+gantry-crane:' + profile.gantryCraneInstances;
    this.canvas.dataset.environmentSurfaceDetail = 'reflector-pylon:' + profile.reflectorPylonInstances + '+ceramic-deck:' + profile.ceramicDeckInstances;
    this.canvas.dataset.environmentMachineDetail = 'sinter-forge:' + profile.sinterForgeInstances + '+printer-spindle:' + profile.printerSpindleInstances + '+feedstock-press:' + profile.feedstockPressInstances;
    this.canvas.dataset.environmentComposition = 'shade-service-deck+fabrication-spine+sunward-work-yard';
    this.canvas.dataset.environmentMaterials = 'ceramic-shell+scorched-steel+black-radiator+solar-gold+heat-amber';
    this.canvas.dataset.environmentZoneIdentity = 'shade:ceramic-deck+radiator-towers+thermal-shutter|spine:truss-frames+sinter-forges+transfer-rails+gantry-cranes|sunward:reflector-pylons+printer-spindles+feedstock-presses';
    this.canvas.dataset.readabilityLanguage = 'hard-sun-edge+cool-shade-mass+gold-reflectors+amber-hot-work+moving-gantry-cues';
    this.canvas.dataset.environmentSunShadow = 'hard-sun+cool-shade+long-shadow';
    this.canvas.dataset.environmentSunDirection = 'fixed-sunward-east-to-west';
    this.canvas.dataset.environmentSunMode = thermal.mode;
    this.canvas.dataset.environmentSunPatches = 'sun:' + profile.sunPatchInstances + '+shade:' + profile.shadePatchInstances;
    this.canvas.dataset.environmentThermalShutters = 'procedural-babylon:' + (shutterClosed ? 'closed' : 'open');
    this.canvas.dataset.environmentThermalProtection = thermal.protection;
    this.canvas.dataset.environmentThermalShutterControl = 'solar-shutter:state-linked';
    this.canvas.dataset.environmentThermalWindow = '10.0-18.0s:shutter-gated';
    this.canvas.dataset.environmentCraneMotion = 'reciprocating-trolleys:' + profile.gantryCraneInstances;
    this.canvas.dataset.environmentCraneOffsets = craneOffsets.join(',');
    this.canvas.dataset.environmentHazardLanguage = 'shared-hazards+solar-surge+thermal-shutter+radiator-saturation+crane-runaway';
    this.canvas.dataset.environmentHazardMode = radiatorEvent ? 'radiator-saturation' : craneEvent ? 'crane-runaway' : thermal.surge ? 'solar-surge' : 'nominal';
    this.canvas.dataset.environmentVfx = 'sun-patches+shade-mass+thermal-pulse+moving-gantry';
    this.canvas.dataset.locationArt = 'solar-yard:panel-clamps:heat-shielded-alloy';
    this.canvas.dataset.locationArtIdentity = 'panel-clamps|heat-shielded-alloy|solar-orange|fabrication-service';
    this.canvas.dataset.locationProps = 'fabrication-service:procedural-babylon';
    this.canvas.dataset.interactableBiome = 'solar-yard';
    this.canvas.dataset.interactableMode = 'solar-yard-fabrication-machinery+mission-controls';
    this.canvas.dataset.interactableKit = 'solar-bus-isolator+gantry-mass-trim+mirror-actuator+printer-spindle+thermal-pressure-lock+radiator-pressure-manifold';
    this.canvas.dataset.interactableLocationVisual = 'procedural-babylon-fabrication-cues';
    this.canvas.dataset.interactableLocationCueCount = String(machineCount);
    this.canvas.dataset.bossBiome = 'solar-yard';
    this.canvas.dataset.bossPresentation = 'helios-9';
    this.canvas.dataset.bossVisual = 'procedural-babylon';
    this.canvas.dataset.bossAsset = 'procedural-babylon-helios-9-cue';
    this.canvas.dataset.bossSilhouette = 'sunshield-crown+reflector-wings+fabricator-core';
    this.canvas.dataset.bossPalette = 'ceramic-white+solar-gold+heat-amber+overheat-red-phase-two';
    this.canvas.dataset.bossCue = 'sunshield-crown+reflector-wings+fabricator-core';
    this.canvas.dataset.bossCueState = activeBoss ? 'active-phase-' + activeBoss.bossPhase : 'queued';
    this.canvas.dataset.babylonSolarYardParity = 'panel-clamp-architecture+heat-materials+props+interactables+hazards+thermal-shutter+transport+navigation+boss-cues+shared-world-cues';
    this.canvas.dataset.babylonSolarYardPlayerPosition = state.player.x.toFixed(1) + ',' + state.player.y.toFixed(1);
    this.canvas.dataset.babylonSolarYardRoutes = String(navigation.routes.length);
    this.canvas.dataset.babylonSolarYardLandmarks = navigation.landmarks.map(item => item.label).join('|');
    this.canvas.dataset.babylonLightingProfile = lighting.id;
    this.canvas.dataset.babylonMaterialIntent = 'heat-shielded-alloy-pbr+ceramic+black-radiator+solar-gold+shared-world-pbr';
    this.canvas.dataset.babylonLightingBudget = 'tier:' + renderBudget.tierName + '|practical:' + practicalCount + '|shadows:off';
    this.canvas.dataset.environmentIbl = 'off:solar-yard';
    this.canvas.dataset.environmentLighting = 'solar-yard-hard-key+cool-fill+contact:player+enemy+practical:' + practicalCount + '+shadow:off';
    this.canvas.dataset.environmentShadowBudget = 'off:solar-yard-babylon';
    this.canvas.dataset.environmentTone = 'aces-' + this.scene.imageProcessingConfiguration.exposure.toFixed(2) + '+warm-sun+cool-shade';
    this.canvas.dataset.locationLighting = 'solar-yard:solar-orange:aces-' + this.scene.imageProcessingConfiguration.exposure.toFixed(2);
    this.canvas.dataset.babylonPbrMaterials = 'pbr:' + pbrCount + '|solar-yard:' + this.materials.length;
    this.canvas.dataset.renderTier = renderBudget.tierName;
    this.canvas.dataset.graphicsQuality = renderBudget.qualityMode;
  }

  release(reason: string) {
    if (this.released) return;
    this.released = true; this.root.setEnabled(false); this.setLightingEnabled(false); this.canvas.dataset.babylonSolarYardRelease = reason;
  }

  dispose() {
    this.release('renderer-dispose');
    this.root.getChildMeshes(false).forEach(mesh => mesh.dispose()); this.root.dispose();
    this.materials.forEach(item => item.dispose()); this.shadeMaterial.dispose(); this.sunMaterial.dispose(); this.bossCueMaterial.dispose();
    this.hemisphere.dispose(); this.keyLight.dispose(); this.rimLight.dispose(); this.emergencyLight.dispose(); this.readabilityLight.dispose(); this.practicalLights.forEach(light => light.dispose());
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
        mesh = label === 'mirror-actuator' || label === 'printer-spindle'
          ? MeshBuilder.CreateCylinder('p27-c6-' + label + '-' + object.id, { height: 0.72, diameter: 0.44, tessellation: 10 }, this.scene)
          : MeshBuilder.CreateBox('p27-c6-' + label + '-' + object.id, { width: 0.62, height: 0.82, depth: 0.46 }, this.scene);
        mesh.parent = this.machineryRoot; mesh.material = this.machineryMaterial; mesh.isPickable = false; this.machineryCues.set(object.id, mesh);
      }
      mesh.position.set(scaled(object.x + object.w / 2), 0.52, scaled(object.y + object.h / 2));
      mesh.rotation.y = state.time * 0.18 + active * 0.34; mesh.setEnabled(true); active += 1;
    }
    return active;
  }

  private setLightingEnabled(enabled: boolean) {
    this.hemisphere.setEnabled(enabled); this.keyLight.setEnabled(enabled); this.rimLight.setEnabled(enabled);
    this.emergencyLight.setEnabled(enabled); this.readabilityLight.setEnabled(enabled); this.practicalLights.forEach(light => light.setEnabled(enabled));
  }
}
