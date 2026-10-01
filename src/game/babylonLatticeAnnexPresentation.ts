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

export const BABYLON_LATTICE_ANNEX_IDENTITY = Object.freeze({
  silhouette: 'reference-pylons',
  material: 'survey-ceramic',
  lighting: 'metrology-teal',
  propSet: 'calibration-service',
});

export const BABYLON_LATTICE_ANNEX_LIGHTING = Object.freeze({
  id: 'metrology-teal',
  keyColor: 0xd9e6e2,
  rimColor: 0x88b8ad,
  emergencyColor: 0x629d93,
  keyIntensity: 2.25,
  rimIntensity: 1.0,
  emergencyIntensity: 7.6,
  exposure: 1.05,
});

export type LatticeAnnexRenderProfile = {
  name: 'full' | 'balanced' | 'mobile' | 'performance';
  referencePylonInstances: number;
  surveyFrameInstances: number;
  metrologyPlinthInstances: number;
  sampleCradleInstances: number;
  calibrationRailInstances: number;
  massBandInstances: number;
};

export function latticeAnnexRenderProfile(detailScale: number, coarse: boolean): LatticeAnnexRenderProfile {
  if (coarse) return { name: 'mobile', referencePylonInstances: 7, surveyFrameInstances: 4, metrologyPlinthInstances: 2, sampleCradleInstances: 2, calibrationRailInstances: 2, massBandInstances: 2 };
  if (detailScale < 0.62) return { name: 'performance', referencePylonInstances: 5, surveyFrameInstances: 3, metrologyPlinthInstances: 2, sampleCradleInstances: 1, calibrationRailInstances: 2, massBandInstances: 1 };
  if (detailScale < 0.9) return { name: 'balanced', referencePylonInstances: 7, surveyFrameInstances: 5, metrologyPlinthInstances: 3, sampleCradleInstances: 2, calibrationRailInstances: 3, massBandInstances: 2 };
  return { name: 'full', referencePylonInstances: 9, surveyFrameInstances: 6, metrologyPlinthInstances: 3, sampleCradleInstances: 3, calibrationRailInstances: 3, massBandInstances: 3 };
}

export function latticeAnnexCalibrationMode(galleryGravity: number, vaultGravity: number) {
  return galleryGravity <= 0.04 && vaultGravity <= 0.03 ? 'near-zero-g' as const : 'nominal' as const;
}

export function latticeAnnexShutterState(alive: number, active: number) {
  if (alive <= 0) return 'destroyed' as const;
  if (active <= 0) return 'retracted' as const;
  if (active >= alive) return 'indexed' as const;
  return 'partial' as const;
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

function latticeCueLabel(object: CombatObject) {
  if (object.id.startsWith('lattice-shutter') || object.id.startsWith('lattice-reference')) return null;
  if (object.id.startsWith('khepri-plinth')) return 'reference-plinth';
  if (object.id === 'door-control') return 'reference-gallery-interlock';
  if (object.id === 'gravity-control') return 'calibration-mass-trim';
  if (object.id === 'crate-a') return 'reference-sample-trolley';
  if (object.id === 'crate-b') return 'survey-archive-rack';
  if (object.id === 'coolant-a') return 'cryogenic-reference-loop';
  if (object.id === 'conduit-a' || object.id === 'arena-conduit') return 'metrology-timing-bus';
  if (object.id === 'arena-cover') return 'sample-vault-carriage';
  if (object.kind === 'powerControl') return 'archive-isolator';
  if (object.kind === 'gravityControl') return 'calibration-mass-trim';
  if (object.kind === 'salvageNode') return 'metrology-archive';
  return null;
}

type ShutterRig = { id: string; root: TransformNode; left: Mesh; right: Mesh };
type ReferenceRig = { id: string; root: TransformNode; ring: Mesh; core: Mesh };

function enableCount<T extends { setEnabled(value: boolean): void }>(items: readonly T[], count: number) {
  items.forEach((item, index) => item.setEnabled(index < count));
}

export class BabylonLatticeAnnexPresentation {
  private readonly root: TransformNode;
  private readonly materials: PBRMaterial[];
  private readonly cueMaterial: PBRMaterial;
  private readonly routeMaterials: readonly [PBRMaterial, PBRMaterial];
  private readonly shutterMaterial: StandardMaterial;
  private readonly referenceMaterial: StandardMaterial;
  private readonly massShiftMaterial: StandardMaterial;
  private readonly bossCueMaterial: StandardMaterial;
  private readonly referencePylons: TransformNode[] = [];
  private readonly surveyFrames: TransformNode[] = [];
  private readonly metrologyPlinths: TransformNode[] = [];
  private readonly sampleCradles: TransformNode[] = [];
  private readonly calibrationRails: Mesh[] = [];
  private readonly massBands: Mesh[] = [];
  private readonly shutterRigs: ShutterRig[] = [];
  private readonly referenceRigs: ReferenceRig[] = [];
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

    this.root = new TransformNode('p27-c7-lattice-annex-environment', scene);
    const floor = pbr(scene, 'p27-c7-lattice-floor', 0x111818, 0.36, 0.62);
    const ceramic = pbr(scene, 'p27-c7-lattice-survey-ceramic', 0xb9c8c5, 0.24, 0.42);
    const structural = pbr(scene, 'p27-c7-lattice-metrology-steel', 0x34423f, 0.78, 0.34);
    const referenceGlass = pbr(scene, 'p27-c7-lattice-reference-glass', 0x0b1414, 0.52, 0.20, 0x88b8ad, 0.12);
    const teal = pbr(scene, 'p27-c7-lattice-teal', 0x3f5a58, 0.44, 0.30, 0x88b8ad, 0.26);
    const routePrimary = pbr(scene, 'p27-c7-lattice-route-primary', 0x496764, 0.35, 0.48, 0x88b8ad, 0.14);
    const routeSecondary = pbr(scene, 'p27-c7-lattice-route-secondary', 0x293c3a, 0.45, 0.56, 0x546c68, 0.07);
    this.materials = [floor, ceramic, structural, referenceGlass, teal, routePrimary, routeSecondary];
    this.cueMaterial = teal;
    this.routeMaterials = [routePrimary, routeSecondary];
    box(scene, this.root, 'p27-c7-lattice-floor-mesh', floor, cx, -0.08, cz, worldW, 0.16, worldH);

    const pylonFractions = [0.50, 0.35, 0.65, 0.20, 0.80, 0.11, 0.89, 0.275, 0.725] as const;
    pylonFractions.forEach((fraction, index) => {
      const root = new TransformNode('p27-c7-reference-pylon-' + index, scene);
      root.parent = this.root;
      const phase = (index - 4) * 1.2;
      const height = 3.7 + (index % 3) * 0.72;
      root.position.set(worldW * fraction, 0, cz + Math.sin(phase) * 3.0);
      box(scene, root, 'p27-c7-pylon-foot-' + index, structural, 0, 0.14, 0, 1.08, 0.28, 1.08);
      box(scene, root, 'p27-c7-pylon-ceramic-' + index, ceramic, 0, height * 0.46, 0, 0.70, height * 0.86, 0.70);
      box(scene, root, 'p27-c7-pylon-reference-core-' + index, referenceGlass, 0, height * 0.52, 0, 0.24, height * 0.72, 0.24);
      for (const ringY of [height * 0.30, height * 0.58, height * 0.82]) {
        const ring = MeshBuilder.CreateTorus('p27-c7-pylon-ring-' + index + '-' + ringY.toFixed(2), { diameter: 1.06, thickness: 0.055, tessellation: 24 }, scene);
        ring.parent = root; ring.position.y = ringY; ring.rotation.x = Math.PI / 2; ring.material = teal; ring.isPickable = false;
      }
      this.referencePylons.push(root);
    });

    const framePlacements = [
      [0.13, 0.17, 0.08], [0.26, 0.83, -0.10], [0.40, 0.17, 0.12],
      [0.60, 0.83, -0.12], [0.74, 0.17, 0.10], [0.87, 0.83, -0.08],
    ] as const;
    framePlacements.forEach(([x, z, rotation], index) => {
      const root = new TransformNode('p27-c7-survey-frame-' + index, scene);
      root.parent = this.root; root.position.set(worldW * x, 0, worldH * z); root.rotation.y = rotation;
      box(scene, root, 'p27-c7-frame-left-' + index, structural, -0.78, 1.22, 0, 0.16, 2.44, 0.18);
      box(scene, root, 'p27-c7-frame-right-' + index, structural, 0.78, 1.22, 0, 0.16, 2.44, 0.18);
      const top = box(scene, root, 'p27-c7-frame-top-' + index, ceramic, 0, 2.34, 0, 1.72, 0.16, 0.20);
      top.rotation.z = index % 2 ? -0.10 : 0.10;
      const diamond = MeshBuilder.CreateCylinder('p27-c7-frame-reference-' + index, { height: 0.16, diameter: 0.76, tessellation: 4 }, scene);
      diamond.parent = root; diamond.position.set(0, 1.46, 0); diamond.rotation.x = Math.PI / 2; diamond.rotation.z = Math.PI / 4; diamond.material = index % 2 ? teal : referenceGlass; diamond.isPickable = false;
      this.surveyFrames.push(root);
    });

    const plinthPositions = [[610, 470], [1030, 690], [1450, 390]] as const;
    plinthPositions.forEach(([x, y], index) => {
      const root = new TransformNode('p27-c7-metrology-plinth-' + index, scene);
      root.parent = this.root; root.position.set(scaled(x + 58), 0, scaled(y + 32));
      box(scene, root, 'p27-c7-plinth-base-' + index, structural, 0, 0.22, 0, 1.56, 0.44, 0.92);
      box(scene, root, 'p27-c7-plinth-top-' + index, ceramic, 0, 0.52, 0, 1.16, 0.18, 0.72);
      const reference = MeshBuilder.CreateCylinder('p27-c7-plinth-standard-' + index, { height: 0.58, diameter: 0.34, tessellation: 8 }, scene);
      reference.parent = root; reference.position.y = 0.90; reference.material = referenceGlass; reference.isPickable = false;
      this.metrologyPlinths.push(root);
    });

    const cradlePositions = [[520, 300], [1120, 520], [1930, 650]] as const;
    cradlePositions.forEach(([x, y], index) => {
      const root = new TransformNode('p27-c7-sample-cradle-' + index, scene);
      root.parent = this.root; root.position.set(scaled(x), 0, scaled(y));
      box(scene, root, 'p27-c7-cradle-bed-' + index, structural, 0, 0.25, 0, 1.76, 0.50, 0.94);
      box(scene, root, 'p27-c7-cradle-sample-' + index, referenceGlass, 0, 0.62, 0, 0.88, 0.24, 0.52);
      for (const side of [-1, 1]) box(scene, root, 'p27-c7-cradle-clamp-' + index + '-' + side, ceramic, side * 0.66, 0.72, 0, 0.16, 0.72, 0.66);
      this.sampleCradles.push(root);
    });

    ([[0.28, 0.46, 7.2], [0.52, 0.54, 9.0], [0.76, 0.46, 7.4]] as const).forEach(([x, z, length], index) => {
      const rail = box(scene, this.root, 'p27-c7-calibration-rail-' + index, structural, worldW * x, 0.07, worldH * z, length, 0.14, 0.30);
      rail.rotation.y = index === 1 ? 0 : index === 0 ? -0.12 : 0.12;
      this.calibrationRails.push(rail);
    });

    this.massShiftMaterial = new StandardMaterial('p27-c7-mass-shift-material', scene);
    this.massShiftMaterial.diffuseColor = colorFromHex(0x88b8ad).scale(0.18); this.massShiftMaterial.emissiveColor = colorFromHex(0x88b8ad).scale(0.38);
    this.massShiftMaterial.specularColor = Color3.Black(); this.massShiftMaterial.alpha = 0.14; this.massShiftMaterial.disableLighting = true; this.massShiftMaterial.backFaceCulling = false;
    ([[0.47, 0.50, 0.18, 0.86], [0.64, 0.50, 0.16, 0.82], [0.80, 0.50, 0.15, 0.78]] as const).forEach(([x, z, wr, dr], index) => {
      const band = box(scene, this.root, 'p27-c7-mass-shift-band-' + index, this.massShiftMaterial, worldW * x, 0.025, worldH * z, worldW * wr, 0.018, worldH * dr);
      band.setEnabled(false); this.massBands.push(band);
    });

    const navigation = getMapNavigationPlan('lattice-annex');
    navigation.routes.forEach(route => {
      const material = route.kind === 'primary' ? routePrimary : routeSecondary;
      const width = route.kind === 'primary' ? 0.115 : 0.072;
      route.points.slice(0, -1).forEach((point, index) => {
        const next = route.points[index + 1];
        routeSegment(scene, this.root, material, 'p27-c7-route-' + route.id + '-' + index, scaled(point.x), scaled(point.y), scaled(next.x), scaled(next.y), width);
      });
    });
    navigation.landmarks.forEach((landmark, index) => {
      const x = scaled(landmark.x), z = scaled(landmark.y);
      const beacon = MeshBuilder.CreateCylinder('p27-c7-landmark-' + landmark.id, { height: 2.65, diameterTop: 0.08, diameterBottom: 0.42, tessellation: 6 }, scene);
      beacon.parent = this.root; beacon.position.set(x, 1.33, z); beacon.material = index === 1 ? teal : ceramic; beacon.isPickable = false;
      const marker = MeshBuilder.CreateTorus('p27-c7-landmark-ring-' + index, { diameter: 0.76, thickness: 0.06, tessellation: 20 }, scene);
      marker.parent = this.root; marker.position.set(x, 2.54, z); marker.rotation.x = Math.PI / 2; marker.material = teal; marker.isPickable = false;
    });

    this.shutterMaterial = new StandardMaterial('p27-c7-shutter-material', scene);
    this.shutterMaterial.diffuseColor = colorFromHex(0x4f6662); this.shutterMaterial.emissiveColor = colorFromHex(0x88b8ad).scale(0.22);
    this.shutterMaterial.specularColor = Color3.Black();
    for (const [id, x, z] of [['lattice-shutter-a', 1709, 390], ['lattice-shutter-b', 2059, 780]] as const) {
      const root = new TransformNode('p27-c7-' + id, scene); root.parent = this.root; root.position.set(scaled(x), 0, scaled(z));
      box(scene, root, id + '-header', structural, 0, 1.95, 0, 1.42, 0.20, 0.26);
      box(scene, root, id + '-post-a', structural, -0.55, 0.98, 0, 0.18, 1.96, 0.22);
      box(scene, root, id + '-post-b', structural, 0.55, 0.98, 0, 0.18, 1.96, 0.22);
      const left = box(scene, root, id + '-panel-a', this.shutterMaterial, 0, 0.96, -1.15, 1.02, 1.78, 1.34);
      const right = box(scene, root, id + '-panel-b', this.shutterMaterial, 0, 0.96, 1.15, 1.02, 1.78, 1.34);
      this.shutterRigs.push({ id, root, left, right });
    }

    this.referenceMaterial = new StandardMaterial('p27-c7-reference-material', scene);
    this.referenceMaterial.diffuseColor = colorFromHex(0x88b8ad).scale(0.22); this.referenceMaterial.emissiveColor = colorFromHex(0x88b8ad).scale(0.78);
    this.referenceMaterial.specularColor = Color3.Black(); this.referenceMaterial.alpha = 0.32; this.referenceMaterial.disableLighting = true; this.referenceMaterial.backFaceCulling = false;
    for (const [id, x, z] of [['lattice-reference-a', 1767, 277], ['lattice-reference-b', 1997, 527], ['lattice-reference-c', 2187, 772]] as const) {
      const root = new TransformNode('p27-c7-' + id, scene); root.parent = this.root; root.position.set(scaled(x), 0, scaled(z));
      box(scene, root, id + '-pedestal', ceramic, 0, 0.38, 0, 0.70, 0.76, 0.70);
      const core = MeshBuilder.CreateCylinder(id + '-core', { height: 1.58, diameter: 0.26, tessellation: 8 }, scene);
      core.parent = root; core.position.y = 1.30; core.material = this.referenceMaterial; core.isPickable = false;
      const ring = MeshBuilder.CreateTorus(id + '-ring', { diameter: 1.22, thickness: 0.075, tessellation: 28 }, scene);
      ring.parent = root; ring.position.y = 1.50; ring.rotation.x = Math.PI / 2; ring.material = this.referenceMaterial; ring.isPickable = false;
      this.referenceRigs.push({ id, root, ring, core });
    }

    this.objectCueRoot = new TransformNode('p27-c7-calibration-service-cues', scene); this.objectCueRoot.parent = this.root;

    this.bossCueMaterial = new StandardMaterial('p27-c7-veyra-cue-material', scene);
    this.bossCueMaterial.diffuseColor = colorFromHex(0x88b8ad).scale(0.20); this.bossCueMaterial.emissiveColor = colorFromHex(0x88b8ad).scale(0.86);
    this.bossCueMaterial.specularColor = Color3.Black(); this.bossCueMaterial.alpha = 0.52; this.bossCueMaterial.disableLighting = true; this.bossCueMaterial.backFaceCulling = false;
    this.bossCueRoot = new TransformNode('p27-c7-veyra-senn-cue', scene); this.bossCueRoot.parent = this.root;
    this.bossCrown = MeshBuilder.CreateTorus('p27-c7-veyra-survey-crown', { diameter: 3.7, thickness: 0.09, tessellation: 40 }, scene);
    this.bossCrown.parent = this.bossCueRoot; this.bossCrown.position.y = 1.60; this.bossCrown.rotation.x = Math.PI / 2; this.bossCrown.material = this.bossCueMaterial; this.bossCrown.isPickable = false;
    for (const side of [-1, 0, 1]) {
      const spine = box(scene, this.bossCueRoot, 'p27-c7-veyra-reference-spine-' + side, ceramic, side * 0.82, 1.10 + (side === 0 ? 0.30 : 0), 0, 0.14, side === 0 ? 2.30 : 1.76, 0.18);
      spine.rotation.z = side * 0.11;
    }
    this.bossCore = MeshBuilder.CreateSphere('p27-c7-veyra-archive-core', { diameter: 0.62, segments: 10 }, scene);
    this.bossCore.parent = this.bossCueRoot; this.bossCore.position.y = 0.78; this.bossCore.material = this.bossCueMaterial; this.bossCore.isPickable = false;
    this.bossCueRoot.setEnabled(false);

    this.meshCount = this.root.getChildMeshes(false).length;
    this.root.setEnabled(false);

    const lighting = BABYLON_LATTICE_ANNEX_LIGHTING;
    this.hemisphere = new HemisphericLight('p27-c7-lattice-hemisphere', new Vector3(-0.18, 1, 0.08), scene);
    this.hemisphere.diffuse = colorFromHex(0xc4d2cf); this.hemisphere.groundColor = colorFromHex(0x091010); this.hemisphere.intensity = 0.32;
    this.keyLight = new DirectionalLight('p27-c7-lattice-key', new Vector3(-0.58, -1, 0.34).normalize(), scene);
    this.keyLight.position = new Vector3(worldW * 0.90, 25, worldH * 0.18); this.keyLight.diffuse = colorFromHex(lighting.keyColor); this.keyLight.intensity = lighting.keyIntensity;
    this.rimLight = new DirectionalLight('p27-c7-lattice-rim', new Vector3(0.44, -0.86, -0.30).normalize(), scene);
    this.rimLight.position = new Vector3(worldW * 0.12, 14, worldH * 0.82); this.rimLight.diffuse = colorFromHex(lighting.rimColor); this.rimLight.intensity = lighting.rimIntensity;
    this.emergencyLight = new PointLight('p27-c7-lattice-calibration-warning', new Vector3(cx, 3.0, cz), scene);
    this.emergencyLight.diffuse = colorFromHex(lighting.emergencyColor); this.emergencyLight.range = 11.2;
    this.readabilityLight = new PointLight('p27-c7-lattice-readability', new Vector3(cx, 2.8, cz), scene);
    this.readabilityLight.diffuse = colorFromHex(0xd9e6e2); this.readabilityLight.range = 9.0;
    this.practicalLights = [
      new PointLight('p27-c7-lattice-practical-gallery', new Vector3(worldW * 0.52, 2.8, worldH * 0.50), scene),
      new PointLight('p27-c7-lattice-practical-vault', new Vector3(worldW * 0.82, 2.8, worldH * 0.52), scene),
    ] as const;
    this.practicalLights[0].diffuse = colorFromHex(0x88b8ad); this.practicalLights[0].range = 8.0;
    this.practicalLights[1].diffuse = colorFromHex(0xa8c7c0); this.practicalLights[1].range = 7.4;
    this.setLightingEnabled(false);
  }

  sync(state: SimState, renderBudget: RenderBudgetSnapshot, lowVisibility: boolean) {
    this.released = false; this.root.setEnabled(true); this.setLightingEnabled(true);
    const profile = latticeAnnexRenderProfile(renderBudget.detailScale, this.coarse);
    enableCount(this.referencePylons, profile.referencePylonInstances);
    enableCount(this.surveyFrames, profile.surveyFrameInstances);
    enableCount(this.metrologyPlinths, profile.metrologyPlinthInstances);
    enableCount(this.sampleCradles, profile.sampleCradleInstances);
    enableCount(this.calibrationRails, profile.calibrationRailInstances);

    const galleryGravity = state.sectors[1]?.gravity ?? 0;
    const vaultGravity = state.sectors[2]?.gravity ?? 0;
    const calibrationMode = latticeAnnexCalibrationMode(galleryGravity, vaultGravity);
    this.massBands.forEach((band, index) => band.setEnabled(calibrationMode === 'near-zero-g' && index < profile.massBandInstances));
    const massPulse = 0.78 + Math.sin(state.time * 5.2) * 0.18;
    this.massShiftMaterial.alpha = (calibrationMode === 'near-zero-g' ? 0.18 : 0.06) * renderBudget.transparencyScale;
    this.massShiftMaterial.emissiveColor = colorFromHex(0x88b8ad).scale(0.34 * massPulse);

    const shutters = state.objects.filter(object => object.id.startsWith('lattice-shutter'));
    const aliveShutters = shutters.filter(object => object.hp > 0);
    const activeShutters = aliveShutters.filter(object => object.active);
    const shutterState = latticeAnnexShutterState(aliveShutters.length, activeShutters.length);
    for (const rig of this.shutterRigs) {
      const object = shutters.find(item => item.id === rig.id);
      const alive = Boolean(object && object.hp > 0);
      const active = Boolean(object?.active && alive);
      rig.root.setEnabled(alive);
      if (object) rig.root.position.set(scaled(object.x + object.w / 2), 0, scaled(object.y + object.h / 2));
      rig.left.position.z = active ? -0.44 : -1.22;
      rig.right.position.z = active ? 0.44 : 1.22;
    }
    const shutterPulse = shutterState === 'indexed' || shutterState === 'partial' ? 0.34 + Math.sin(state.time * 6.4) * 0.10 : 0.16;
    this.shutterMaterial.emissiveColor = colorFromHex(shutterState === 'indexed' ? 0xa8c7c0 : 0x88b8ad).scale(shutterPulse);

    const referenceObjects = state.objects.filter(object => object.id.startsWith('lattice-reference'));
    const intactReferences = referenceObjects.filter(object => object.hp > 0);
    const activeReferences = intactReferences.filter(object => object.active);
    this.referenceMaterial.alpha = activeReferences.length > 0 ? 0.68 : 0.30;
    this.referenceMaterial.emissiveColor = colorFromHex(activeReferences.length > 0 ? 0xa8d3ca : 0x88b8ad).scale(activeReferences.length > 0 ? 0.92 : 0.42);
    for (const rig of this.referenceRigs) {
      const object = referenceObjects.find(item => item.id === rig.id);
      const intact = Boolean(object && object.hp > 0);
      const active = Boolean(object?.active && intact);
      rig.root.setEnabled(intact);
      if (object) rig.root.position.set(scaled(object.x + object.w / 2), 0, scaled(object.y + object.h / 2));
      const pulse = active ? 1 + Math.sin(state.time * 5.6 + rig.id.length) * 0.12 : 0.88;
      rig.ring.scaling.set(pulse, pulse, pulse);
      rig.core.scaling.y = active ? 1.08 + Math.sin(state.time * 4.8) * 0.05 : 0.92;
    }

    const cueCount = this.syncObjectCues(state);
    const activeBoss = state.enemies.find(enemy => enemy.active && !enemy.dead && enemy.role === 'boss') ?? null;
    const veyra = activeBoss?.variant === 'latticeCustodian';
    this.bossCueRoot.setEnabled(Boolean(activeBoss));
    if (activeBoss) {
      this.bossCueRoot.position.set(scaled(activeBoss.x), 0.05, scaled(activeBoss.y));
      const phaseTwo = activeBoss.bossPhase === 2;
      const patternHot = ['surveySweep', 'referenceLock', 'archivePurge'].includes(activeBoss.bossPattern);
      const bossHex = phaseTwo ? 0xb8eee1 : patternHot ? 0xa8d3ca : 0x88b8ad;
      const bossColor = colorFromHex(bossHex);
      this.bossCueMaterial.diffuseColor = bossColor.scale(0.20); this.bossCueMaterial.emissiveColor = bossColor.scale(phaseTwo ? 1.0 : 0.86); this.bossCueMaterial.alpha = phaseTwo ? 0.68 : 0.52;
      const pulse = 1 + Math.sin(state.time * (patternHot ? 7.0 : phaseTwo ? 5.8 : 3.8) + activeBoss.patternIndex) * (patternHot ? 0.14 : 0.07);
      this.bossCrown.scaling.set(pulse, pulse, pulse); this.bossCrown.rotation.z = state.time * (phaseTwo ? 0.86 : 0.42);
      const coreScale = patternHot ? 1.20 + Math.sin(state.time * 7.4) * 0.08 : phaseTwo ? 1.12 : 1;
      this.bossCore.scaling.set(coreScale, coreScale, coreScale);
    }

    const bossPattern = activeBoss?.bossPattern ?? 'none';
    const hazardMode = bossPattern === 'surveySweep' ? 'survey-sweep'
      : bossPattern === 'referenceLock' ? 'reference-lock'
        : bossPattern === 'archivePurge' ? 'archive-purge'
          : calibrationMode === 'near-zero-g' ? 'calibration-mass-shift'
            : shutterState === 'indexed' ? 'shutter-index'
              : 'nominal';

    const lighting = BABYLON_LATTICE_ANNEX_LIGHTING;
    const tierScale = renderBudget.tierName === 'high' ? 1 : renderBudget.tierName === 'balanced' ? 0.88 : 0.72;
    this.hemisphere.intensity = 0.32 * (renderBudget.tierName === 'performance' ? 0.82 : 1);
    this.keyLight.intensity = lighting.keyIntensity * tierScale * (lowVisibility ? 0.94 : 1);
    this.rimLight.intensity = lighting.rimIntensity * (renderBudget.tierName === 'performance' ? 0.74 : 1);
    const px = scaled(state.player.x), pz = scaled(state.player.y);
    this.readabilityLight.position.set(px - 0.5, 2.8, pz + 0.7); this.readabilityLight.intensity = (renderBudget.tierName === 'performance' ? 3.6 : 5.2) * tierScale;
    this.emergencyLight.position.set(px + 1.7, 3.0, pz - 1.5);
    this.emergencyLight.intensity = lighting.emergencyIntensity * (renderBudget.tierName === 'performance' ? 0.72 : 1) * (hazardMode === 'nominal' ? 0.58 : 1.14) * (activeBoss?.bossPhase === 2 ? 1.10 : 1);
    const practicalCount = renderBudget.tierName === 'performance' || this.coarse ? 1 : 2;
    this.practicalLights.forEach((light, index) => { const enabled = index < practicalCount; light.setEnabled(enabled); light.intensity = enabled ? (index === 0 ? 5.2 : 4.4) * tierScale : 0; });
    const routePulse = 0.86 + Math.sin(state.time * 3.4) * 0.14;
    this.routeMaterials[0].emissiveColor = colorFromHex(0x88b8ad).scale(0.15 * routePulse);
    this.routeMaterials[1].emissiveColor = colorFromHex(0x546c68).scale(0.07 * routePulse);

    this.scene.environmentTexture = null; this.scene.environmentIntensity = 0;
    this.scene.imageProcessingConfiguration.toneMappingEnabled = true;
    this.scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    this.scene.imageProcessingConfiguration.exposure = lighting.exposure * (lowVisibility ? 1.04 : 1);
    this.scene.imageProcessingConfiguration.contrast = 1.04;

    const navigation = getMapNavigationPlan('lattice-annex');
    const pbrCount = this.scene.materials.filter(item => item instanceof PBRMaterial).length;
    this.canvas.dataset.babylonEnvironmentState = 'ready';
    this.canvas.dataset.environmentVisual = 'procedural-lattice-annex-babylon';
    this.canvas.dataset.environmentKit = 'reference-pylon,survey-frame,metrology-plinth,sample-cradle,calibration-rail,calibration-shutter,reference-node,wayfinding,boss-cue';
    this.canvas.dataset.environmentInstances = String(this.meshCount + this.objectCues.size);
    this.canvas.dataset.environmentPerformanceProfile = profile.name + ':procedural:structure-shadows-off';
    this.canvas.dataset.environmentInstanceBudget = 'pylon:' + profile.referencePylonInstances + '+frame:' + profile.surveyFrameInstances + '+plinth:' + profile.metrologyPlinthInstances + '+cradle:' + profile.sampleCradleInstances + '+rail:' + profile.calibrationRailInstances + '+band:' + profile.massBandInstances + '+shutter:2+reference:3';
    this.canvas.dataset.environmentShadowCasters = 'off';
    this.canvas.dataset.environmentLandmark = 'long-reference-pylon-gallery';
    this.canvas.dataset.environmentServiceDetails = 'survey-frame:' + profile.surveyFrameInstances + '+metrology-plinth:' + profile.metrologyPlinthInstances + '+calibration-rail:' + profile.calibrationRailInstances;
    this.canvas.dataset.environmentSurfaceDetail = 'reference-pylon:' + profile.referencePylonInstances + '+sample-cradle:' + profile.sampleCradleInstances;
    this.canvas.dataset.environmentMachineDetail = 'sample-cradle:' + profile.sampleCradleInstances + '+calibration-shutter:2+reference-node:3';
    this.canvas.dataset.environmentComposition = 'cold-metrology-ring+long-reference-gallery+sample-vault';
    this.canvas.dataset.environmentMaterials = 'survey-ceramic+brushed-metrology-steel+black-reference-glass+metrology-teal';
    this.canvas.dataset.environmentZoneIdentity = 'ring:survey-ceramic+metrology-plinths|gallery:reference-pylon-row+calibration-rails+mass-shift-bands|vault:sample-cradles+calibration-shutters+reference-network';
    this.canvas.dataset.readabilityLanguage = 'tall-reference-pylons+teal-calibration-rings+white-survey-ceramic+floor-reference-lines+shutter-panels';
    this.canvas.dataset.environmentReferencePylons = 'procedural-babylon:' + profile.referencePylonInstances;
    this.canvas.dataset.environmentReferenceNetwork = 'active:' + activeReferences.length + '+intact:' + intactReferences.length;
    this.canvas.dataset.environmentCalibrationMass = calibrationMode;
    this.canvas.dataset.environmentGalleryGravity = galleryGravity.toFixed(2) + ',' + vaultGravity.toFixed(2);
    this.canvas.dataset.environmentCalibrationShutters = shutterState + ':' + activeShutters.length;
    this.canvas.dataset.environmentCalibrationShutterIds = 'lattice-shutter-a,lattice-shutter-b';
    this.canvas.dataset.environmentCalibrationTimeline = '10.0s:near-zero-g>20.0s:shutter-index';
    this.canvas.dataset.environmentHazardLanguage = 'shared-hazards+calibration-mass-shift+gravity-well+calibration-shutters+reference-network';
    this.canvas.dataset.environmentHazardMode = hazardMode;
    this.canvas.dataset.environmentVfx = 'metrology-rings+mass-shift-bands+shutter-index-pulse+reference-network-pulse';
    this.canvas.dataset.locationArt = 'lattice-annex:reference-pylons:survey-ceramic';
    this.canvas.dataset.locationArtIdentity = 'reference-pylons|survey-ceramic|metrology-teal|calibration-service';
    this.canvas.dataset.locationProps = 'calibration-service:procedural-babylon';
    this.canvas.dataset.interactableBiome = 'lattice-annex';
    this.canvas.dataset.interactableMode = 'lattice-annex-calibration-service+mission-controls';
    this.canvas.dataset.interactableKit = 'reference-gallery-interlock+calibration-mass-trim+precision-carriage+cryogenic-reference+metrology-archives';
    this.canvas.dataset.interactableLocationVisual = 'procedural-babylon-calibration-cues';
    this.canvas.dataset.interactableLocationCueCount = String(cueCount);
    this.canvas.dataset.bossBiome = 'lattice-annex';
    this.canvas.dataset.bossPresentation = veyra ? 'veyra-senn' : 'khepri-recovery-marshal';
    this.canvas.dataset.bossVisual = 'procedural-babylon';
    this.canvas.dataset.bossAsset = veyra ? 'procedural-babylon-veyra-senn-cue' : 'procedural-babylon-khepri-marshal-cue';
    this.canvas.dataset.bossSilhouette = veyra ? 'survey-crown+reference-spines+archive-core' : 'survey-crown+archive-core';
    this.canvas.dataset.bossPalette = 'survey-ceramic+metrology-teal+reference-black+phase-two-pale-cyan';
    this.canvas.dataset.bossCue = 'survey-sweep+reference-lock+archive-purge';
    this.canvas.dataset.bossCueState = activeBoss ? 'active-phase-' + activeBoss.bossPhase + ':' + bossPattern : 'queued';
    this.canvas.dataset.babylonLatticeAnnexParity = 'reference-pylon-architecture+survey-materials+props+interactables+hazards+calibration-mass-shift+shutters+reference-network+navigation+boss-cues+shared-world-cues';
    this.canvas.dataset.babylonLatticeAnnexPlayerPosition = state.player.x.toFixed(1) + ',' + state.player.y.toFixed(1);
    this.canvas.dataset.babylonLatticeAnnexRoutes = String(navigation.routes.length);
    this.canvas.dataset.babylonLatticeAnnexLandmarks = navigation.landmarks.map(item => item.label).join('|');
    this.canvas.dataset.babylonLightingProfile = lighting.id;
    this.canvas.dataset.babylonMaterialIntent = 'survey-ceramic-pbr+metrology-steel+reference-glass+shared-world-pbr';
    this.canvas.dataset.babylonLightingBudget = 'tier:' + renderBudget.tierName + '|practical:' + practicalCount + '|shadows:off';
    this.canvas.dataset.environmentIbl = 'off:lattice-annex';
    this.canvas.dataset.environmentLighting = 'lattice-annex-soft-key+teal-reference-fill+contact:player+enemy+practical:' + practicalCount + '+shadow:off';
    this.canvas.dataset.environmentShadowBudget = 'off:lattice-annex-babylon';
    this.canvas.dataset.environmentTone = 'aces-' + this.scene.imageProcessingConfiguration.exposure.toFixed(2) + '+survey-neutral+metrology-teal';
    this.canvas.dataset.locationLighting = 'lattice-annex:metrology-teal:aces-' + this.scene.imageProcessingConfiguration.exposure.toFixed(2);
    this.canvas.dataset.babylonPbrMaterials = 'pbr:' + pbrCount + '|lattice-annex:' + this.materials.length;
    this.canvas.dataset.renderTier = renderBudget.tierName;
    this.canvas.dataset.graphicsQuality = renderBudget.qualityMode;
  }

  release(reason: string) {
    if (this.released) return;
    this.released = true; this.root.setEnabled(false); this.setLightingEnabled(false); this.canvas.dataset.babylonLatticeAnnexRelease = reason;
  }

  dispose() {
    this.release('renderer-dispose');
    this.root.getChildMeshes(false).forEach(mesh => mesh.dispose()); this.root.dispose();
    this.materials.forEach(item => item.dispose());
    this.massShiftMaterial.dispose(); this.shutterMaterial.dispose(); this.referenceMaterial.dispose(); this.bossCueMaterial.dispose();
    this.hemisphere.dispose(); this.keyLight.dispose(); this.rimLight.dispose(); this.emergencyLight.dispose(); this.readabilityLight.dispose(); this.practicalLights.forEach(light => light.dispose());
  }

  private syncObjectCues(state: SimState) {
    this.objectCues.forEach(mesh => mesh.setEnabled(false));
    let active = 0;
    for (const object of state.objects) {
      if (!object.active || object.hp <= 0) continue;
      const label = latticeCueLabel(object);
      if (!label) continue;
      let mesh = this.objectCues.get(object.id);
      if (!mesh) {
        mesh = label.includes('trim') || label.includes('loop')
          ? MeshBuilder.CreateCylinder('p27-c7-' + label + '-' + object.id, { height: 0.76, diameter: 0.42, tessellation: 10 }, this.scene)
          : MeshBuilder.CreateBox('p27-c7-' + label + '-' + object.id, { width: 0.64, height: 0.82, depth: 0.48 }, this.scene);
        mesh.parent = this.objectCueRoot; mesh.material = this.cueMaterial; mesh.isPickable = false; this.objectCues.set(object.id, mesh);
      }
      mesh.position.set(scaled(object.x + object.w / 2), 0.52, scaled(object.y + object.h / 2));
      mesh.rotation.y = state.time * 0.12 + active * 0.28; mesh.setEnabled(true); active += 1;
    }
    return active;
  }

  private setLightingEnabled(enabled: boolean) {
    this.hemisphere.setEnabled(enabled); this.keyLight.setEnabled(enabled); this.rimLight.setEnabled(enabled);
    this.emergencyLight.setEnabled(enabled); this.readabilityLight.setEnabled(enabled); this.practicalLights.forEach(light => light.setEnabled(enabled));
  }
}
