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

export const BABYLON_PARALLAX_ARRAY_IDENTITY = Object.freeze({
  silhouette: 'baseline-pylons',
  material: 'metrology-composite',
  lighting: 'reference-violet',
  propSet: 'inertial-reference',
});

export const BABYLON_PARALLAX_ARRAY_LIGHTING = Object.freeze({
  id: 'reference-violet',
  keyColor: 0xe2ddf1,
  rimColor: 0x9a87cf,
  emergencyColor: 0x7864ba,
  keyIntensity: 2.2,
  rimIntensity: 1.15,
  emergencyIntensity: 8.1,
  exposure: 1.06,
});

export type ParallaxArrayRenderProfile = {
  name: 'full' | 'balanced' | 'mobile' | 'performance';
  frameInstances: number;
  carriageInstances: number;
  anchorInstances: number;
  shearInstances: number;
};

export function parallaxArrayRenderProfile(detailScale: number, coarse: boolean): ParallaxArrayRenderProfile {
  if (coarse) return { name: 'mobile', frameInstances: 3, carriageInstances: 2, anchorInstances: 5, shearInstances: 2 };
  if (detailScale < 0.62) return { name: 'performance', frameInstances: 2, carriageInstances: 2, anchorInstances: 4, shearInstances: 1 };
  if (detailScale < 0.9) return { name: 'balanced', frameInstances: 3, carriageInstances: 3, anchorInstances: 6, shearInstances: 2 };
  return { name: 'full', frameInstances: 3, carriageInstances: 3, anchorInstances: 8, shearInstances: 3 };
}

export function parallaxReferenceState(aligned: number, intact: number) {
  if (intact <= 0) return 'offline' as const;
  if (aligned >= intact) return 'aligned' as const;
  if (aligned > 0) return 'partial' as const;
  return 'armed' as const;
}

export function parallaxShearMode(activeVectorWashes: number, gravitySpread: number) {
  if (activeVectorWashes > 0) return 'reference-shear' as const;
  if (gravitySpread >= 0.3) return 'gravity-split' as const;
  return 'nominal' as const;
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

function parallaxCueLabel(object: CombatObject) {
  if (object.id.startsWith('reference-node-')) return 'reference-pylon';
  if (object.id.startsWith('parallax-frame-')) return 'reference-frame';
  if (object.id.startsWith('baseline-anchor-')) return 'live-baseline-servo';
  if (object.id === 'bulkhead-a') return 'near-baseline-mass-carriage';
  if (object.id === 'bulkhead-b') return 'reference-interferometer';
  if (object.id === 'arena-cover') return 'deep-reference-carriage';
  if (object.id === 'conduit-a' || object.id === 'arena-conduit') return 'baseline-timing-bus';
  if (object.id === 'coolant-a') return 'inertial-standard-loop';
  if (object.id === 'service-plate') return 'reference-service-hatch';
  if (object.id === 'gravity-control') return 'cross-track-mass-trim';
  if (object.id === 'crate-a' || object.id === 'crate-b') return 'calibration-package';
  if (object.kind === 'gravityControl') return 'reference-control';
  if (object.kind === 'anchorNode') return 'reference-servo';
  return null;
}

function enableCount<T extends { setEnabled(value: boolean): void }>(items: readonly T[], count: number) {
  items.forEach((item, index) => item.setEnabled(index < count));
}

type PylonRig = { id: string; root: TransformNode; rings: Mesh[]; core: Mesh };
type ShearRig = { root: TransformNode; disc: Mesh; ring: Mesh };

export class BabylonParallaxArrayPresentation {
  private readonly root: TransformNode;
  private readonly materials: PBRMaterial[];
  private readonly routeMaterials: readonly [PBRMaterial, PBRMaterial];
  private readonly pylonRigs: PylonRig[] = [];
  private readonly frames: TransformNode[] = [];
  private readonly carriages: TransformNode[] = [];
  private readonly anchors: TransformNode[] = [];
  private readonly consoles: TransformNode[] = [];
  private readonly objectCueRoot: TransformNode;
  private readonly objectCues = new Map<string, Mesh>();
  private readonly shearMaterial: StandardMaterial;
  private readonly shearRigs: ShearRig[] = [];
  private readonly bossCueMaterial: StandardMaterial;
  private readonly bossCueRoot: TransformNode;
  private readonly bossCrown: Mesh[] = [];
  private readonly bossCore: Mesh;
  private readonly bossForks: Mesh[] = [];
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

    this.root = new TransformNode('p27-c10-parallax-array-environment', scene);
    const floor = pbr(scene, 'p27-c10-parallax-floor', 0x12101b, 0.64, 0.50);
    const graphite = pbr(scene, 'p27-c10-graphite-structure', 0x191724, 0.82, 0.32);
    const shell = pbr(scene, 'p27-c10-reference-shell', 0x4a405f, 0.68, 0.30, 0x665a82, 0.06);
    const violet = pbr(scene, 'p27-c10-violet-alignment', 0x665a82, 0.44, 0.30, 0x9a87cf, 0.32);
    const cyan = pbr(scene, 'p27-c10-cyan-readout', 0x315d66, 0.38, 0.28, 0x82d7df, 0.34);
    const routePrimary = pbr(scene, 'p27-c10-route-primary', 0x4c4168, 0.42, 0.42, 0x9a87cf, 0.22);
    const routeSecondary = pbr(scene, 'p27-c10-route-secondary', 0x263b45, 0.46, 0.48, 0x69b7c1, 0.13);
    this.materials = [floor, graphite, shell, violet, cyan, routePrimary, routeSecondary];
    this.routeMaterials = [routePrimary, routeSecondary];
    box(scene, this.root, 'p27-c10-parallax-floor-mesh', floor, cx, -0.08, cz, worldW, 0.16, worldH);

    const pylonFallback = [
      ['reference-node-a', 500, 300],
      ['reference-node-b', 980, 760],
      ['reference-node-c', 1400, 300],
    ] as const;
    pylonFallback.forEach(([id, x, z], index) => {
      const root = new TransformNode('p27-c10-baseline-pylon-' + index, scene);
      root.parent = this.root;
      root.position.set(scaled(x), 0, scaled(z));
      box(scene, root, 'p27-c10-pylon-foot-' + index, graphite, 0, 0.24, 0, 1.40, 0.48, 1.40);
      box(scene, root, 'p27-c10-pylon-spine-' + index, shell, 0, 2.15, 0, 0.72, 4.30, 0.72);
      const rings: Mesh[] = [];
      for (const [ringIndex, y] of [1.15, 2.25, 3.35].entries()) {
        const ring = MeshBuilder.CreateTorus('p27-c10-pylon-ring-' + index + '-' + ringIndex, { diameter: 2.16, thickness: 0.10, tessellation: 30 }, scene);
        ring.parent = root;
        ring.position.y = y;
        ring.rotation.x = Math.PI / 2;
        ring.material = ringIndex === 1 ? cyan : violet;
        ring.isPickable = false;
        rings.push(ring);
      }
      const core = MeshBuilder.CreateSphere('p27-c10-pylon-core-' + index, { diameter: 0.58, segments: 12 }, scene);
      core.parent = root;
      core.position.y = 4.12;
      core.material = cyan;
      core.isPickable = false;
      this.pylonRigs.push({ id, root, rings, core });
    });

    ([[760, 340], [1080, 690], [1370, 390]] as const).forEach(([x, z], index) => {
      const root = new TransformNode('p27-c10-reference-frame-' + index, scene);
      root.parent = this.root;
      root.position.set(scaled(x), 0, scaled(z));
      if (index === 1) root.rotation.y = Math.PI / 2;
      box(scene, root, 'p27-c10-frame-left-' + index, graphite, -0.72, 1.48, 0, 0.22, 2.96, 0.32);
      box(scene, root, 'p27-c10-frame-right-' + index, graphite, 0.72, 1.48, 0, 0.22, 2.96, 0.32);
      box(scene, root, 'p27-c10-frame-top-' + index, shell, 0, 2.82, 0, 1.66, 0.22, 0.36);
      box(scene, root, 'p27-c10-frame-readout-' + index, cyan, 0, 1.68, 0, 1.10, 0.10, 0.20);
      this.frames.push(root);
    });

    ([[0.18, 0.53, Math.PI / 2], [0.50, 0.22, 0], [0.82, 0.58, -Math.PI / 2]] as const).forEach(([x, z, rotationY], index) => {
      const root = new TransformNode('p27-c10-mass-carriage-' + index, scene);
      root.parent = this.root;
      root.position.set(worldW * x, 0, worldH * z);
      root.rotation.y = rotationY;
      box(scene, root, 'p27-c10-carriage-base-' + index, graphite, 0, 0.30, 0, 2.30, 0.60, 1.10);
      box(scene, root, 'p27-c10-carriage-mass-' + index, shell, 0, 0.92, 0, 1.34, 0.76, 0.72);
      const rail = box(scene, root, 'p27-c10-carriage-rail-' + index, violet, 0, 0.09, 0, 3.40, 0.08, 0.14);
      rail.position.y = 0.08;
      this.carriages.push(root);
    });

    const anchorPlacements = [
      [0.10, 0.18, 0], [0.10, 0.50, 0], [0.10, 0.82, 0],
      [0.90, 0.18, Math.PI], [0.90, 0.50, Math.PI], [0.90, 0.82, Math.PI],
      [0.32, 0.10, Math.PI / 2], [0.68, 0.90, -Math.PI / 2],
    ] as const;
    anchorPlacements.forEach(([x, z, rotationY], index) => {
      const root = new TransformNode('p27-c10-shear-anchor-' + index, scene);
      root.parent = this.root;
      root.position.set(worldW * x, 0, worldH * z);
      root.rotation.y = rotationY;
      box(scene, root, 'p27-c10-anchor-base-' + index, graphite, 0, 0.24, 0, 0.78, 0.48, 0.78);
      const fin = box(scene, root, 'p27-c10-anchor-fin-' + index, shell, 0, 0.98, 0, 0.18, 1.52, 0.88);
      fin.rotation.z = index % 2 ? 0.10 : -0.10;
      const marker = MeshBuilder.CreateTorus('p27-c10-anchor-ring-' + index, { diameter: 0.72, thickness: 0.07, tessellation: 20 }, scene);
      marker.parent = root;
      marker.position.y = 1.58;
      marker.rotation.x = Math.PI / 2;
      marker.material = violet;
      marker.isPickable = false;
      this.anchors.push(root);
    });

    pylonFallback.forEach(([id, x, z], index) => {
      const root = new TransformNode('p27-c10-reference-console-' + index, scene);
      root.parent = this.root;
      root.position.set(scaled(x + (index === 1 ? -92 : 78)), 0, scaled(z + (index === 2 ? -60 : 50)));
      box(scene, root, 'p27-c10-console-body-' + index, graphite, 0, 0.42, 0, 0.82, 0.84, 0.62);
      const screen = box(scene, root, 'p27-c10-console-screen-' + index, cyan, 0, 0.82, -0.30, 0.56, 0.34, 0.06);
      screen.rotation.x = -0.18;
      root.metadata = { referenceNode: id };
      this.consoles.push(root);
    });

    const navigation = getMapNavigationPlan('parallax-array');
    navigation.routes.forEach(route => {
      const material = route.kind === 'primary' ? routePrimary : routeSecondary;
      const width = route.kind === 'primary' ? 0.12 : 0.076;
      route.points.slice(0, -1).forEach((point, index) => {
        const next = route.points[index + 1];
        routeSegment(scene, this.root, material, 'p27-c10-route-' + route.id + '-' + index, scaled(point.x), scaled(point.y), scaled(next.x), scaled(next.y), width);
      });
    });
    navigation.landmarks.forEach((landmark, index) => {
      const beacon = MeshBuilder.CreateCylinder('p27-c10-landmark-' + landmark.id, { height: 2.70, diameterTop: 0.12, diameterBottom: 0.52, tessellation: 8 }, scene);
      beacon.parent = this.root;
      beacon.position.set(scaled(landmark.x), 1.35, scaled(landmark.y));
      beacon.material = index === 1 ? cyan : shell;
      beacon.isPickable = false;
      const marker = MeshBuilder.CreateTorus('p27-c10-landmark-ring-' + index, { diameter: 0.88, thickness: 0.07, tessellation: 24 }, scene);
      marker.parent = this.root;
      marker.position.set(scaled(landmark.x), 2.56, scaled(landmark.y));
      marker.rotation.x = Math.PI / 2;
      marker.material = violet;
      marker.isPickable = false;
    });

    this.shearMaterial = new StandardMaterial('p27-c10-reference-shear-material', scene);
    this.shearMaterial.diffuseColor = colorFromHex(0x9a87cf).scale(0.20);
    this.shearMaterial.emissiveColor = colorFromHex(0x9a87cf).scale(0.70);
    this.shearMaterial.specularColor = Color3.Black();
    this.shearMaterial.alpha = 0.18;
    this.shearMaterial.disableLighting = true;
    this.shearMaterial.backFaceCulling = false;
    for (let index = 0; index < 3; index += 1) {
      const root = new TransformNode('p27-c10-reference-shear-' + index, scene);
      root.parent = this.root;
      const disc = MeshBuilder.CreateCylinder('p27-c10-shear-disc-' + index, { height: 0.04, diameter: 4.80, tessellation: 40 }, scene);
      disc.parent = root;
      disc.position.y = 0.04;
      disc.material = this.shearMaterial;
      disc.isPickable = false;
      const ring = MeshBuilder.CreateTorus('p27-c10-shear-ring-' + index, { diameter: 5.20, thickness: 0.10, tessellation: 40 }, scene);
      ring.parent = root;
      ring.position.y = 0.08;
      ring.material = this.shearMaterial;
      ring.isPickable = false;
      root.setEnabled(false);
      this.shearRigs.push({ root, disc, ring });
    }

    this.objectCueRoot = new TransformNode('p27-c10-reference-object-cues', scene);
    this.objectCueRoot.parent = this.root;

    this.bossCueMaterial = new StandardMaterial('p27-c10-baseline-keeper-cue-material', scene);
    this.bossCueMaterial.diffuseColor = colorFromHex(0x9a87cf).scale(0.22);
    this.bossCueMaterial.emissiveColor = colorFromHex(0x9a87cf).scale(0.88);
    this.bossCueMaterial.specularColor = Color3.Black();
    this.bossCueMaterial.alpha = 0.58;
    this.bossCueMaterial.disableLighting = true;
    this.bossCueMaterial.backFaceCulling = false;
    this.bossCueRoot = new TransformNode('p27-c10-baseline-keeper-cue', scene);
    this.bossCueRoot.parent = this.root;
    for (let index = -1; index <= 1; index += 1) {
      const crown = MeshBuilder.CreateTorus('p27-c10-boss-reference-crown-' + index, { diameter: 2.46 + Math.abs(index) * 0.34, thickness: 0.10, tessellation: 36 }, scene);
      crown.parent = this.bossCueRoot;
      crown.position.set(index * 0.52, 1.62 + Math.abs(index) * 0.16, 0);
      crown.rotation.x = Math.PI / 2;
      crown.rotation.y = index * 0.28;
      crown.material = this.bossCueMaterial;
      crown.isPickable = false;
      this.bossCrown.push(crown);
    }
    for (const side of [-1, 1]) {
      const fork = box(scene, this.bossCueRoot, 'p27-c10-boss-baseline-fork-' + side, this.bossCueMaterial, side * 1.10, 1.05, 0, 0.16, 1.82, 0.16);
      fork.rotation.z = side * 0.24;
      this.bossForks.push(fork);
    }
    this.bossCore = MeshBuilder.CreateSphere('p27-c10-boss-baseline-core', { diameter: 0.76, segments: 12 }, scene);
    this.bossCore.parent = this.bossCueRoot;
    this.bossCore.position.y = 0.78;
    this.bossCore.material = this.bossCueMaterial;
    this.bossCore.isPickable = false;
    this.bossCueRoot.setEnabled(false);

    this.meshCount = this.root.getChildMeshes(false).length;
    this.root.setEnabled(false);

    const lighting = BABYLON_PARALLAX_ARRAY_LIGHTING;
    this.hemisphere = new HemisphericLight('p27-c10-parallax-hemisphere', new Vector3(-0.10, 1, 0.14), scene);
    this.hemisphere.diffuse = colorFromHex(0xe7e1f2);
    this.hemisphere.groundColor = colorFromHex(0x05040a);
    this.hemisphere.intensity = 0.28;
    this.keyLight = new DirectionalLight('p27-c10-parallax-key', new Vector3(-0.52, -1, 0.30).normalize(), scene);
    this.keyLight.position = new Vector3(worldW * 0.84, 24, worldH * 0.16);
    this.keyLight.diffuse = colorFromHex(lighting.keyColor);
    this.keyLight.intensity = lighting.keyIntensity;
    this.rimLight = new DirectionalLight('p27-c10-parallax-rim', new Vector3(0.42, -0.82, -0.34).normalize(), scene);
    this.rimLight.position = new Vector3(worldW * 0.16, 15, worldH * 0.84);
    this.rimLight.diffuse = colorFromHex(lighting.rimColor);
    this.rimLight.intensity = lighting.rimIntensity;
    this.emergencyLight = new PointLight('p27-c10-reference-shear-warning', new Vector3(cx, 3.0, cz), scene);
    this.emergencyLight.diffuse = colorFromHex(lighting.emergencyColor);
    this.emergencyLight.range = 12.4;
    this.readabilityLight = new PointLight('p27-c10-parallax-readability', new Vector3(cx, 2.8, cz), scene);
    this.readabilityLight.diffuse = colorFromHex(0xd7eff2);
    this.readabilityLight.range = 9.6;
    this.practicalLights = [
      new PointLight('p27-c10-practical-baseline', new Vector3(worldW * 0.42, 2.8, worldH * 0.36), scene),
      new PointLight('p27-c10-practical-deep-reference', new Vector3(worldW * 0.78, 2.8, worldH * 0.42), scene),
    ] as const;
    this.practicalLights[0].diffuse = colorFromHex(0x9a87cf);
    this.practicalLights[0].range = 8.8;
    this.practicalLights[1].diffuse = colorFromHex(0x82d7df);
    this.practicalLights[1].range = 8.2;
    this.setLightingEnabled(false);
  }

  sync(state: SimState, renderBudget: RenderBudgetSnapshot, lowVisibility: boolean) {
    this.released = false;
    this.root.setEnabled(true);
    this.setLightingEnabled(true);
    const profile = parallaxArrayRenderProfile(renderBudget.detailScale, this.coarse);
    enableCount(this.frames, profile.frameInstances);
    enableCount(this.carriages, profile.carriageInstances);
    enableCount(this.anchors, profile.anchorInstances);

    const referenceNodes = state.objects.filter(object => object.active && object.id.startsWith('reference-node-')).slice(0, 3);
    const intactNodes = referenceNodes.filter(object => object.hp > 0);
    const alignedNodes = intactNodes.filter(object => object.exposed);
    const referenceState = parallaxReferenceState(alignedNodes.length, intactNodes.length);
    this.pylonRigs.forEach((rig, index) => {
      const object = referenceNodes.find(item => item.id === rig.id);
      if (object) rig.root.position.set(scaled(object.x + object.w / 2), 0, scaled(object.y + object.h / 2));
      const aligned = Boolean(object?.exposed && object.hp > 0);
      const pulse = aligned ? 1.08 + Math.sin(state.time * 5.8 + index) * 0.08 : 0.96 + Math.sin(state.time * 2.5 + index) * 0.035;
      rig.rings.forEach((ring, ringIndex) => {
        ring.scaling.set(pulse, pulse, pulse);
        ring.rotation.z = state.time * (aligned ? 0.66 : 0.18) * (ringIndex % 2 ? -1 : 1);
      });
      const coreScale = aligned ? 1.20 + Math.sin(state.time * 6.4 + index) * 0.08 : 0.96;
      rig.core.scaling.set(coreScale, coreScale, coreScale);
    });

    this.frames.forEach((root, index) => {
      const object = state.objects.find(item => item.id === 'parallax-frame-' + String.fromCharCode(97 + index));
      if (object) root.position.set(scaled(object.x + object.w / 2), 0, scaled(object.y + object.h / 2));
    });

    const vectorWashes = state.hazards.filter(hazard => hazard.active && hazard.kind === 'vectorWash');
    this.shearRigs.forEach((rig, index) => {
      const enabled = index < profile.shearInstances && index < vectorWashes.length;
      rig.root.setEnabled(enabled);
      if (!enabled) return;
      const hazard = vectorWashes[index];
      rig.root.position.set(scaled(hazard.x), 0, scaled(hazard.y));
      const radiusScale = Math.max(0.65, scaled(hazard.radius) / 2.6);
      const pulse = radiusScale * (0.94 + Math.sin(state.time * 7.2 + index) * 0.12);
      rig.disc.scaling.set(pulse, 1, pulse);
      rig.ring.scaling.set(pulse, pulse, pulse);
      rig.ring.rotation.y = state.time * (index % 2 ? -0.72 : 0.72);
    });
    this.shearMaterial.alpha = (vectorWashes.length > 0 ? 0.24 : 0.08) * renderBudget.transparencyScale;
    this.shearMaterial.emissiveColor = colorFromHex(0x9a87cf).scale(0.64 + Math.sin(state.time * 6.6) * 0.12);

    const gravityValues = state.sectors.slice(0, 3).map(sector => sector.gravity);
    const gravitySpread = gravityValues.length > 0 ? Math.max(...gravityValues) - Math.min(...gravityValues) : 0;
    const shearMode = parallaxShearMode(vectorWashes.length, gravitySpread);
    const cueCount = this.syncObjectCues(state);
    const configuredBoss = state.enemies.find(enemy => !enemy.dead && enemy.role === 'boss') ?? null;
    const activeBoss = configuredBoss?.active ? configuredBoss : null;
    const baselineKeeper = configuredBoss?.variant === 'baselineKeeper';
    this.bossCueRoot.setEnabled(Boolean(activeBoss));
    if (activeBoss) {
      this.bossCueRoot.position.set(scaled(activeBoss.x), 0.05, scaled(activeBoss.y));
      const phaseTwo = activeBoss.bossPhase === 2;
      const patternHot = ['baselineFork', 'parallaxSweep', 'shearCollapse'].includes(activeBoss.bossPattern);
      const bossColor = colorFromHex(phaseTwo ? 0xc7f3f5 : patternHot ? 0xb5a6df : 0x9a87cf);
      this.bossCueMaterial.diffuseColor = bossColor.scale(0.22);
      this.bossCueMaterial.emissiveColor = bossColor.scale(phaseTwo ? 1.02 : 0.86);
      this.bossCueMaterial.alpha = phaseTwo ? 0.72 : 0.58;
      const pulse = 1 + Math.sin(state.time * (patternHot ? 7.4 : phaseTwo ? 5.8 : 3.8) + activeBoss.patternIndex) * (patternHot ? 0.14 : 0.07);
      this.bossCrown.forEach((ring, index) => {
        ring.scaling.set(pulse, pulse, pulse);
        ring.rotation.z = state.time * (phaseTwo ? 0.82 : 0.38) * (index % 2 ? -1 : 1);
      });
      this.bossForks.forEach((fork, index) => { fork.scaling.y = 1 + Math.sin(state.time * 4.8 + index * Math.PI) * (patternHot ? 0.18 : 0.06); });
      const coreScale = patternHot ? 1.24 + Math.sin(state.time * 6.9) * 0.08 : phaseTwo ? 1.14 : 1;
      this.bossCore.scaling.set(coreScale, coreScale, coreScale);
    }

    const bossPattern = activeBoss?.bossPattern ?? 'none';
    const hazardMode = bossPattern === 'baselineFork' ? 'baseline-fork'
      : bossPattern === 'parallaxSweep' ? 'parallax-sweep'
        : bossPattern === 'shearCollapse' ? 'shear-collapse'
          : shearMode;

    const lighting = BABYLON_PARALLAX_ARRAY_LIGHTING;
    const tierScale = renderBudget.tierName === 'high' ? 1 : renderBudget.tierName === 'balanced' ? 0.88 : 0.72;
    this.hemisphere.intensity = 0.28 * (renderBudget.tierName === 'performance' ? 0.82 : 1);
    this.keyLight.intensity = lighting.keyIntensity * tierScale * (lowVisibility ? 0.94 : 1);
    this.rimLight.intensity = lighting.rimIntensity * (renderBudget.tierName === 'performance' ? 0.74 : 1);
    const px = scaled(state.player.x);
    const pz = scaled(state.player.y);
    this.readabilityLight.position.set(px - 0.4, 2.8, pz + 0.7);
    this.readabilityLight.intensity = (renderBudget.tierName === 'performance' ? 3.8 : 5.3) * tierScale;
    this.emergencyLight.position.set(px + 1.4, 3.0, pz - 1.2);
    this.emergencyLight.intensity = lighting.emergencyIntensity * (renderBudget.tierName === 'performance' ? 0.72 : 1)
      * (hazardMode === 'nominal' ? 0.46 : hazardMode === 'gravity-split' ? 0.72 : 1.16)
      * (activeBoss?.bossPhase === 2 ? 1.10 : 1);
    const practicalCount = renderBudget.tierName === 'performance' || this.coarse ? 1 : 2;
    this.practicalLights.forEach((light, index) => {
      const enabled = index < practicalCount;
      light.setEnabled(enabled);
      light.intensity = enabled ? (index === 0 ? 5.1 : 4.6) * tierScale : 0;
    });
    const routePulse = 0.86 + Math.sin(state.time * 3.5) * 0.14;
    this.routeMaterials[0].emissiveColor = colorFromHex(0x9a87cf).scale(0.22 * routePulse);
    this.routeMaterials[1].emissiveColor = colorFromHex(0x69b7c1).scale(0.13 * routePulse);

    this.scene.environmentTexture = null;
    this.scene.environmentIntensity = 0;
    this.scene.imageProcessingConfiguration.toneMappingEnabled = true;
    this.scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    this.scene.imageProcessingConfiguration.exposure = lighting.exposure * (lowVisibility ? 1.04 : 1);
    this.scene.imageProcessingConfiguration.contrast = 1.06;

    const navigation = getMapNavigationPlan('parallax-array');
    const gravity = gravityValues.map(value => value.toFixed(2)).join('>');
    const baselineServos = state.objects.filter(object => object.id.startsWith('baseline-anchor-') && object.active && object.hp > 0).length;
    const pbrCount = this.scene.materials.filter(item => item instanceof PBRMaterial).length;
    this.canvas.dataset.babylonEnvironmentState = 'ready';
    this.canvas.dataset.environmentVisual = 'procedural-parallax-array-babylon';
    this.canvas.dataset.environmentKit = 'baseline-pylon,reference-frame,mass-carriage,shear-anchor,reference-console,reference-shear,wayfinding,boss-cue';
    this.canvas.dataset.environmentInstances = String(this.meshCount + this.objectCues.size);
    this.canvas.dataset.environmentPerformanceProfile = profile.name + ':procedural:structure-shadows-off';
    this.canvas.dataset.environmentInstanceBudget = 'pylon:3+frame:' + profile.frameInstances + '+carriage:' + profile.carriageInstances + '+anchor:' + profile.anchorInstances + '+shear:' + profile.shearInstances + '+console:3';
    this.canvas.dataset.environmentShadowCasters = 'off';
    this.canvas.dataset.environmentLandmark = 'three-point-long-baseline';
    this.canvas.dataset.environmentServiceDetails = 'reference-console:3+mass-carriage:' + profile.carriageInstances;
    this.canvas.dataset.environmentSurfaceDetail = 'reference-frame:' + profile.frameInstances + '+shear-anchor:' + profile.anchorInstances;
    this.canvas.dataset.environmentMachineDetail = 'baseline-pylon:3+mass-carriage:3+live-baseline-servo:' + baselineServos;
    this.canvas.dataset.environmentComposition = 'three-point-baseline+cross-track-frames+perimeter-shear-anchors';
    this.canvas.dataset.environmentMaterials = 'graphite-structure+reference-shell+violet-alignment+cyan-readout';
    this.canvas.dataset.environmentZoneIdentity = 'near-baseline:reference-pylon+mass-carriage|cross-track:reference-frame+timing-bus|deep-reference:baseline-pylon+shear-anchor';
    this.canvas.dataset.readabilityLanguage = 'baseline-silhouette+violet-cyan+luminance';
    this.canvas.dataset.environmentReferenceNodes = referenceState + ':' + alignedNodes.length + '/' + intactNodes.length;
    this.canvas.dataset.environmentReferenceNodeIds = 'reference-node-a,reference-node-b,reference-node-c';
    this.canvas.dataset.environmentReferenceShear = String(vectorWashes.length);
    this.canvas.dataset.environmentShearTimeline = '8.0s:first-shear>19.0s:deep-reference-reversal';
    this.canvas.dataset.environmentGravityProfile = gravity;
    this.canvas.dataset.environmentHazardLanguage = 'shared-hazards+reference-shear+gravity-split+physical-baseline-alignment';
    this.canvas.dataset.environmentHazardMode = hazardMode;
    this.canvas.dataset.environmentVfx = 'reference-shear-discs+pylon-ring-pulse+violet-cyan-route-pulse+baseline-keeper-crown';
    this.canvas.dataset.locationArt = 'parallax-array:baseline-pylons:metrology-composite';
    this.canvas.dataset.locationArtIdentity = 'baseline-pylons|metrology-composite|reference-violet|inertial-reference';
    this.canvas.dataset.locationProps = 'inertial-reference:procedural-babylon';
    this.canvas.dataset.interactableBiome = 'parallax-array';
    this.canvas.dataset.interactableMode = 'reference-alignment+mission-controls';
    this.canvas.dataset.interactableKit = 'reference-pylon+reference-frame+mass-carriage+timing-bus+mass-trim+baseline-servo';
    this.canvas.dataset.interactableLocationVisual = 'procedural-babylon-parallax-cues';
    this.canvas.dataset.interactableLocationCueCount = String(cueCount);
    this.canvas.dataset.bossBiome = 'parallax-array';
    this.canvas.dataset.bossPresentation = baselineKeeper ? 'sera-nox' : 'array-command';
    this.canvas.dataset.bossVisual = 'procedural-babylon';
    this.canvas.dataset.bossAsset = baselineKeeper ? 'procedural-babylon-baseline-keeper-cue' : 'procedural-babylon-parallax-command-cue';
    this.canvas.dataset.bossSilhouette = 'triple-reference-crown+baseline-forks+shear-core';
    this.canvas.dataset.bossPalette = 'graphite+reference-violet+cyan-readout+phase-two-pale-cyan';
    this.canvas.dataset.bossCue = 'baseline-fork+parallax-sweep+shear-collapse';
    this.canvas.dataset.bossCueState = activeBoss ? 'active-phase-' + activeBoss.bossPhase + ':' + bossPattern : 'queued';
    this.canvas.dataset.babylonParallaxArrayParity = 'baseline-pylon-architecture+metrology-reference+props+interactables+hazards+reference-shear+physical-alignment+navigation+boss-cues+shared-world-cues';
    this.canvas.dataset.babylonParallaxArrayPlayerPosition = state.player.x.toFixed(1) + ',' + state.player.y.toFixed(1);
    this.canvas.dataset.babylonParallaxArrayRoutes = String(navigation.routes.length);
    this.canvas.dataset.babylonParallaxArrayLandmarks = navigation.landmarks.map(item => item.label).join('|');
    this.canvas.dataset.babylonLightingProfile = lighting.id;
    this.canvas.dataset.babylonMaterialIntent = 'metrology-composite-pbr+graphite-structure+reference-violet+cyan-readout+shared-world-pbr';
    this.canvas.dataset.babylonLightingBudget = 'tier:' + renderBudget.tierName + '|practical:' + practicalCount + '|shadows:off';
    this.canvas.dataset.environmentIbl = 'off:parallax-array';
    this.canvas.dataset.environmentLighting = 'parallax-array-violet-key+cyan-rim+contact:player+enemy+practical:' + practicalCount + '+shadow:off';
    this.canvas.dataset.environmentShadowBudget = 'off:parallax-array-babylon';
    this.canvas.dataset.environmentTone = 'aces-' + this.scene.imageProcessingConfiguration.exposure.toFixed(2) + '+graphite-neutral+reference-violet';
    this.canvas.dataset.locationLighting = 'parallax-array:reference-violet:aces-' + this.scene.imageProcessingConfiguration.exposure.toFixed(2);
    this.canvas.dataset.babylonPbrMaterials = 'pbr:' + pbrCount + '|parallax-array:' + this.materials.length;
    this.canvas.dataset.renderTier = renderBudget.tierName;
    this.canvas.dataset.graphicsQuality = renderBudget.qualityMode;
  }

  release(reason: string) {
    if (this.released) return;
    this.released = true;
    this.root.setEnabled(false);
    this.setLightingEnabled(false);
    this.canvas.dataset.babylonParallaxArrayRelease = reason;
  }

  dispose() {
    this.release('renderer-dispose');
    this.root.getChildMeshes(false).forEach(mesh => mesh.dispose());
    this.root.dispose();
    this.materials.forEach(item => item.dispose());
    this.shearMaterial.dispose();
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
      const label = parallaxCueLabel(object);
      if (!label) continue;
      let mesh = this.objectCues.get(object.id);
      if (!mesh) {
        mesh = label.includes('pylon') || label.includes('servo') || label.includes('interferometer')
          ? MeshBuilder.CreateCylinder('p27-c10-' + label + '-' + object.id, { height: 0.92, diameter: 0.46, tessellation: 12 }, this.scene)
          : MeshBuilder.CreateBox('p27-c10-' + label + '-' + object.id, { width: 0.70, height: 0.82, depth: 0.52 }, this.scene);
        mesh.parent = this.objectCueRoot;
        mesh.material = label.includes('pylon') || label.includes('servo') ? this.materials[3] : this.materials[4];
        mesh.isPickable = false;
        this.objectCues.set(object.id, mesh);
      }
      mesh.position.set(scaled(object.x + object.w / 2), 0.54, scaled(object.y + object.h / 2));
      const aligned = object.id.startsWith('reference-node-') && object.exposed;
      mesh.rotation.y = state.time * (aligned ? 0.68 : 0.16) + active * 0.23;
      const pulse = aligned ? 1.18 + Math.sin(state.time * 5.4 + active) * 0.10 : 1;
      mesh.scaling.set(pulse, pulse, pulse);
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
