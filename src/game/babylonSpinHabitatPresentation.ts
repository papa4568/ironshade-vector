import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { CubeTexture } from '@babylonjs/core/Materials/Textures/cubeTexture';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { getMapNavigationPlan } from './mapNavigation';
import { babylonRouteMarkingWidth, BABYLON_ROUTE_MARKING_WIDTHS } from './babylonRouteMarkings';
import { createBabylonPremiumPbrSurfaceLibrary, type BabylonPremiumPbrSurfaceLibrary } from './babylonPremiumPbrSurfaceLibrary';
import { createRefineryContactDepthAlphaData } from './refineryContactDepth';
import { REFINERY_ACTOR_GROUNDING_PROFILE, refineryActorGroundingScale } from './babylonRefineryLighting';
import type { RenderBudgetSnapshot } from './renderQuality';
import {
  spinHabitatArchitectureState,
  spinHabitatSpindownState,
} from './spinHabitatArchitecture';
import { getWorldSize, type CombatObject, type SimState } from './sim';

const WORLD_SCALE = 0.02;
export const BABYLON_SPIN_PREMIUM_SURFACES = [
  'deck-plate', 'painted-metal', 'bare-metal', 'polymer-rubber', 'emissive-fixture',
] as const;

export const BABYLON_SPIN_HABITAT_IDENTITY = Object.freeze({
  silhouette: 'ring-and-spokes',
  material: 'habitat-alloy',
  lighting: 'cool-green',
  propSet: 'habitat-service',
});

export const BABYLON_SPIN_HABITAT_LIGHTING = Object.freeze({
  id: 'cool-green',
  keyColor: 0xd2e4dc,
  rimColor: 0x6fb2ac,
  emergencyColor: 0x6ba89f,
  keyIntensity: 2.2,
  rimIntensity: 1.06,
  emergencyIntensity: 7.8,
  exposure: 1.07,
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
  if (object.kind === 'powerControl') return 'spin-bus-isolator';
  if (object.kind === 'gravityControl') return 'gravity-trim';
  if (object.id === 'salvage-node-a') return 'bearing-control';
  if (object.id === 'salvage-node-b') return 'attitude-flywheel';
  if (object.kind === 'doorControl' || object.kind === 'sealControl') return 'pressure-lock';
  return null;
}

export class BabylonSpinHabitatPresentation {
  private readonly root: TransformNode;
  private readonly rotorRoot: TransformNode;
  private readonly ambientRoot: TransformNode;
  private readonly spindownRoot: TransformNode;
  private readonly machineryRoot: TransformNode;
  private readonly bossCueRoot: TransformNode;
  private readonly materials: PBRMaterial[];
  private readonly ownedMaterials: PBRMaterial[];
  private readonly premiumSurfaces: BabylonPremiumPbrSurfaceLibrary;
  private readonly premiumBindingCount: number;
  private readonly staticPropGroundingCount: number;
  private readonly iblTexture: CubeTexture;
  private iblReady = false;
  private readonly groundingTexture: RawTexture;
  private readonly groundingMaterial: StandardMaterial;
  private readonly groundingSource: Mesh;
  private readonly enemyGrounding = new Map<number, InstancedMesh>();
  private readonly routeMaterials: readonly [PBRMaterial, PBRMaterial];
  private readonly machineryMaterial: PBRMaterial;
  private readonly warningMaterial: StandardMaterial;
  private readonly ambientMaterial: StandardMaterial;
  private readonly bossCueMaterial: StandardMaterial;
  private readonly ambientBands: Mesh[] = [];
  private readonly ambientDust: Mesh[] = [];
  private readonly spindownArcs: Mesh[] = [];
  private readonly spindownBeacon: Mesh;
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
  private rotationY = 0;
  private lastSimTime = Number.NaN;

  constructor(
    private readonly scene: Scene,
    private readonly canvas: HTMLCanvasElement,
    _coarse: boolean,
  ) {
    const world = getWorldSize();
    const worldW = scaled(world.w);
    const worldH = scaled(world.h);
    const cx = worldW / 2;
    const cz = worldH / 2;

    // Spin, spoke and bearing meshes use the same shipped KTX2 PBR families
    // as the earlier premium locations, with no synthetic diffuse-only stand-ins.
    this.premiumSurfaces = createBabylonPremiumPbrSurfaceLibrary(scene);
    const floor = this.premiumSurfaces.get('deck-plate');
    const rim = this.premiumSurfaces.get('painted-metal');
    const spoke = this.premiumSurfaces.get('bare-metal');
    const axis = this.premiumSurfaces.get('bare-metal');
    const service = this.premiumSurfaces.get('polymer-rubber');
    const fixture = this.premiumSurfaces.get('emissive-fixture');
    const routePrimary = material(scene, 'p27-c3-spin-route-primary-material', 0x17302f, 0.64, 0.50, 0x79d8c8, 0.18);
    const routeSecondary = material(scene, 'p27-c3-spin-route-secondary-material', 0x112328, 0.70, 0.54, 0x8dc7d0, 0.07);
    this.ownedMaterials = [routePrimary, routeSecondary];
    this.materials = [...this.premiumSurfaces.materials.values(), ...this.ownedMaterials];
    this.routeMaterials = [routePrimary, routeSecondary];
    this.machineryMaterial = service;

    this.warningMaterial = new StandardMaterial('p27-c3-spin-warning-material', scene);
    this.warningMaterial.diffuseColor = colorFromHex(0xff9b5a).scale(0.24);
    this.warningMaterial.emissiveColor = colorFromHex(0xff9b5a).scale(0.82);
    this.warningMaterial.specularColor = Color3.Black();
    this.warningMaterial.alpha = 0.2;
    this.warningMaterial.disableLighting = true;
    this.warningMaterial.backFaceCulling = false;

    this.ambientMaterial = new StandardMaterial('p27-c3-spin-ambient-material', scene);
    this.ambientMaterial.diffuseColor = colorFromHex(0x83dfd4).scale(0.12);
    this.ambientMaterial.emissiveColor = colorFromHex(0x83dfd4).scale(0.48);
    this.ambientMaterial.specularColor = Color3.Black();
    this.ambientMaterial.alpha = 0.14;
    this.ambientMaterial.disableLighting = true;
    this.ambientMaterial.backFaceCulling = false;

    this.bossCueMaterial = new StandardMaterial('p27-c3-spin-boss-cue-material', scene);
    this.bossCueMaterial.diffuseColor = colorFromHex(0x72f1d0).scale(0.18);
    this.bossCueMaterial.emissiveColor = colorFromHex(0x72f1d0).scale(0.82);
    this.bossCueMaterial.specularColor = Color3.Black();
    this.bossCueMaterial.alpha = 0.42;
    this.bossCueMaterial.disableLighting = true;
    this.bossCueMaterial.backFaceCulling = false;

    this.root = new TransformNode('p27-c3-spin-habitat-environment', scene);
    box(scene, this.root, 'p27-c3-spin-floor', floor, cx, -0.055, cz, worldW, 0.11, worldH);

    this.rotorRoot = new TransformNode('p27-c3-spin-rotating-frame', scene);
    this.rotorRoot.parent = this.root;
    this.rotorRoot.position.set(cx, 0.12, cz);

    for (const [index, radius] of [5.5, 8.5, 11.5].entries()) {
      const ring = MeshBuilder.CreateTorus('p27-c3-spin-ring-' + index, {
        diameter: radius * 2,
        thickness: 0.22,
        tessellation: 48,
      }, scene);
      ring.parent = this.rotorRoot;
      ring.material = rim;
      ring.isPickable = false;
      // Two inset torque rails and regularly spaced joint shoes give the
      // silhouette actual depth at combat zoom, not another flat ring decal.
      for (const [railIndex, inset] of [0.28, -0.28].entries()) {
        const rail = MeshBuilder.CreateTorus('p28-g3-spin-torque-rail-' + index + '-' + railIndex, {
          diameter: (radius + inset) * 2, thickness: 0.075, tessellation: 72,
        }, scene);
        rail.parent = this.rotorRoot;
        rail.position.y = railIndex === 0 ? 0.12 : -0.09;
        rail.material = spoke;
        rail.isPickable = false;
      }
      for (let shoe = 0; shoe < 12; shoe += 1) {
        const angle = shoe / 12 * Math.PI * 2;
        const joint = box(scene, this.rotorRoot, 'p28-g3-spin-ring-joint-' + index + '-' + shoe,
          shoe % 3 === 0 ? fixture : rim,
          Math.cos(angle) * radius, 0.19, Math.sin(angle) * radius, 0.46, 0.18, 0.22);
        joint.rotation.y = -angle;
      }
    }

    const spokeLengths = [22, 22, 18, 18];
    const spokeRotations = [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4];
    for (let index = 0; index < 4; index += 1) {
      const arm = box(scene, this.rotorRoot, 'p27-c3-spin-spoke-' + index, spoke, 0, 0.06, 0, spokeLengths[index], 0.20, 0.20);
      arm.rotation.y = spokeRotations[index];
      for (const [ribIndex, distance] of [-7, -3.5, 3.5, 7].entries()) {
        const rib = box(scene, this.rotorRoot, 'p28-g3-spin-spoke-cross-rib-' + index + '-' + ribIndex,
          ribIndex % 2 ? rim : spoke,
          Math.cos(spokeRotations[index]) * distance, 0.18,
          -Math.sin(spokeRotations[index]) * distance, 0.19, 0.26, 0.82);
        rib.rotation.y = spokeRotations[index];
      }
    }

    const rotationWitness = box(scene, this.rotorRoot, 'p27-c3-spin-rotation-witness', service, 8.5, 0.36, 0, 0.72, 0.52, 0.72);
    rotationWitness.rotation.y = Math.PI / 6;

    const servicePlacements = [
      [-8.0, -5.8, Math.PI / 2],
      [8.2, -5.2, -Math.PI / 2],
      [-7.6, 5.6, Math.PI / 2],
      [8.0, 5.4, -Math.PI / 2],
    ] as const;
    servicePlacements.forEach(([x, z, rotationY], index) => {
      const bay = box(scene, this.rotorRoot, 'p27-c3-spin-service-bay-' + index, service, x, 0.54, z, 1.45, 1.08, 0.74);
      bay.rotation.y = rotationY;
      box(scene, this.rotorRoot, 'p27-c3-spin-service-status-' + index, fixture, x, 1.10, z, 0.46, 0.12, 0.50).rotation.y = rotationY;
      for (const side of [-1, 1]) {
        const rail = box(scene, this.rotorRoot, 'p28-g3-spin-service-brace-' + index + '-' + side,
          rim, x + side * 0.47, 0.72, z, 0.11, 1.28, 0.79);
        rail.rotation.y = rotationY;
      }
      const hatch = box(scene, this.rotorRoot, 'p28-g3-spin-service-hatch-' + index,
        spoke, x, 1.16, z, 0.66, 0.08, 0.58);
      hatch.rotation.y = rotationY;
    });

    const axisHub = MeshBuilder.CreateCylinder('p27-c3-spin-axis-hub', {
      height: 4.8,
      diameter: 2.5,
      tessellation: 16,
    }, scene);
    axisHub.parent = this.root;
    axisHub.position.set(cx, 2.4, cz);
    axisHub.material = axis;
    axisHub.isPickable = false;

    const axisCollar = MeshBuilder.CreateTorus('p27-c3-spin-axis-collar', {
      diameter: 3.5,
      thickness: 0.18,
      tessellation: 36,
    }, scene);
    axisCollar.parent = this.root;
    axisCollar.position.set(cx, 3.25, cz);
    axisCollar.material = axis;
    axisCollar.isPickable = false;
    for (let index = 0; index < 8; index += 1) {
      const angle = index / 8 * Math.PI * 2;
      const foot = box(scene, this.root, 'p28-g3-spin-axis-bearing-foot-' + index, rim,
        cx + Math.cos(angle) * 1.75, 0.24, cz + Math.sin(angle) * 1.75,
        0.54, 0.48, 0.30);
      foot.rotation.y = -angle;
      const bolt = box(scene, this.root, 'p28-g3-spin-axis-bearing-bolt-' + index, fixture,
        cx + Math.cos(angle) * 1.75, 0.5, cz + Math.sin(angle) * 1.75,
        0.16, 0.08, 0.14);
      bolt.rotation.y = -angle;
    }

    const navigation = getMapNavigationPlan('spin-habitat');
    navigation.routes.forEach(route => {
      for (let index = 0; index < route.points.length - 1; index += 1) {
        const a = route.points[index];
        const b = route.points[index + 1];
        routeSegment(
          scene,
          this.root,
          route.kind === 'primary' ? routePrimary : routeSecondary,
          'p27-c3-spin-route-' + route.id + '-' + index,
          scaled(a.x),
          scaled(a.y),
          scaled(b.x),
          scaled(b.y),
          babylonRouteMarkingWidth(route.kind),
        );
      }
    });
    navigation.landmarks.forEach((landmark, index) => {
      const x = scaled(landmark.x);
      const z = scaled(landmark.y);
      box(scene, this.root, 'p27-c3-spin-landmark-' + landmark.id, axis, x, 1.34, z, 0.22, 2.68, 0.22);
      box(scene, this.root, 'p27-c3-spin-landmark-beacon-' + index, service, x, 2.54, z, 1.20, 0.10, 0.34);
    });

    this.ambientRoot = new TransformNode('p27-c3-spin-ambient-effects', scene);
    this.ambientRoot.parent = this.root;
    this.ambientRoot.position.set(cx, 0.08, cz);
    for (let index = 0; index < 4; index += 1) {
      const band = MeshBuilder.CreateTorus('p27-c3-spin-ambient-band-' + index, {
        diameter: 6.2 + index * 4.4,
        thickness: 0.035,
        tessellation: 40,
      }, scene);
      band.parent = this.ambientRoot;
      band.position.y = 0.01 + index * 0.006;
      band.material = this.ambientMaterial;
      band.isPickable = false;
      this.ambientBands.push(band);
    }
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let index = 0; index < 24; index += 1) {
      const angle = index * goldenAngle;
      const radius = 2.8 + (index % 12) / 11 * 8.4;
      const mote = MeshBuilder.CreateSphere('p27-c3-spin-dust-' + index, {
        diameter: 0.08 + (index % 3) * 0.025,
        segments: 4,
      }, scene);
      mote.parent = this.ambientRoot;
      mote.position.set(Math.cos(angle) * radius, 0.18 + ((index * 7) % 13) / 12 * 1.2, Math.sin(angle) * radius);
      mote.material = this.ambientMaterial;
      mote.isPickable = false;
      this.ambientDust.push(mote);
    }

    this.spindownRoot = new TransformNode('p27-c3-spin-spindown-vfx', scene);
    this.spindownRoot.parent = this.root;
    this.spindownRoot.position.set(cx, 0.075, cz);
    for (let index = 0; index < 6; index += 1) {
      const angle = index / 6 * Math.PI * 2;
      const radius = 10.2;
      const arc = MeshBuilder.CreateBox('p27-c3-spin-brake-arc-' + index, {
        width: 3.2,
        height: 0.028,
        depth: 0.12,
      }, scene);
      arc.parent = this.spindownRoot;
      arc.position.set(Math.cos(angle) * radius, index % 2 === 0 ? 0 : 0.012, Math.sin(angle) * radius);
      arc.rotation.y = -angle;
      arc.material = this.warningMaterial;
      arc.isPickable = false;
      this.spindownArcs.push(arc);
    }
    this.spindownBeacon = MeshBuilder.CreateTorus('p27-c3-spin-axis-warning-pulse', {
      diameter: 4.1,
      thickness: 0.10,
      tessellation: 36,
    }, scene);
    this.spindownBeacon.parent = this.spindownRoot;
    this.spindownBeacon.material = this.warningMaterial;
    this.spindownBeacon.isPickable = false;
    this.spindownRoot.setEnabled(false);

    this.machineryRoot = new TransformNode('p27-c3-spin-machinery-cues', scene);
    this.machineryRoot.parent = this.root;

    this.bossCueRoot = new TransformNode('p27-c3-spin-sable-voss-cue', scene);
    this.bossCueRoot.parent = this.root;
    this.bossPhaseRing = MeshBuilder.CreateTorus('p27-c3-spin-sable-voss-phase-ring', {
      diameter: 3.8,
      thickness: 0.10,
      tessellation: 40,
    }, scene);
    this.bossPhaseRing.parent = this.bossCueRoot;
    this.bossPhaseRing.material = this.bossCueMaterial;
    this.bossPhaseRing.isPickable = false;
    this.bossPhaseHalo = MeshBuilder.CreateTorus('p27-c3-spin-sable-voss-phase-halo', {
      diameter: 4.8,
      thickness: 0.055,
      tessellation: 40,
    }, scene);
    this.bossPhaseHalo.parent = this.bossCueRoot;
    this.bossPhaseHalo.position.y = 0.045;
    this.bossPhaseHalo.material = this.bossCueMaterial;
    this.bossPhaseHalo.isPickable = false;
    for (const [index, angle] of [0, Math.PI / 2, Math.PI, Math.PI * 1.5].entries()) {
      const tower = box(
        scene,
        this.bossCueRoot,
        'p27-c3-spin-sable-voss-governor-' + index,
        service,
        Math.cos(angle) * 1.55,
        0.42,
        Math.sin(angle) * 1.55,
        0.16,
        0.84,
        0.16,
      );
      tower.rotation.y = angle;
    }
    this.bossCueRoot.setEnabled(false);

    const sharedMaterials = new Set(this.premiumSurfaces.materials.values());
    this.premiumBindingCount = this.root.getChildMeshes(false)
      .filter(mesh => mesh.material instanceof PBRMaterial && sharedMaterials.has(mesh.material)).length;

    // A single shared contact atlas grounds the player, nearby enemies and
    // rotating service bays, retaining the existing gameplay transform owners.
    const groundingSize = REFINERY_ACTOR_GROUNDING_PROFILE.alphaTextureSize;
    this.groundingTexture = RawTexture.CreateRGBATexture(
      createRefineryContactDepthAlphaData(groundingSize), groundingSize, groundingSize, scene, false, false,
    );
    this.groundingTexture.hasAlpha = true;
    this.groundingMaterial = new StandardMaterial('p28-g3-spin-contact-material', scene);
    this.groundingMaterial.diffuseColor = new Color3(0.012, 0.027, 0.025);
    this.groundingMaterial.specularColor = Color3.Black();
    this.groundingMaterial.diffuseTexture = this.groundingTexture;
    this.groundingMaterial.useAlphaFromDiffuseTexture = true;
    this.groundingMaterial.disableLighting = true;
    this.groundingMaterial.disableDepthWrite = true;
    this.groundingMaterial.backFaceCulling = false;
    this.groundingMaterial.alpha = 0.28;
    this.groundingSource = MeshBuilder.CreatePlane('p28-g3-spin-player-contact',
      { width: 1, height: 1, sideOrientation: Mesh.DOUBLESIDE }, scene);
    this.groundingSource.parent = this.root;
    this.groundingSource.material = this.groundingMaterial;
    this.groundingSource.isPickable = false;
    this.groundingSource.alphaIndex = -300;
    this.groundingSource.rotation.x = Math.PI / 2;
    servicePlacements.forEach(([x, z], index) => {
      const shadow = this.groundingSource.createInstance('p28-g3-spin-service-contact-' + index);
      shadow.parent = this.rotorRoot;
      shadow.position.set(x, -0.078, z);
      shadow.rotation.x = Math.PI / 2;
      shadow.scaling.set(1.75, 1.04, 1);
      shadow.isPickable = false;
      shadow.alphaIndex = -300;
    });
    this.staticPropGroundingCount = servicePlacements.length;
    this.meshCount = this.root.getChildMeshes(false).length;
    this.root.setEnabled(false);

    this.iblTexture = new CubeTexture('/assets/environments/refinery-prefiltered.env',
      scene, undefined, false, undefined,
      () => { this.iblReady = true; }, () => { this.iblReady = false; }, undefined, true);
    this.iblTexture.name = 'p28-g3-spin-shared-prefiltered-ibl';
    this.iblTexture.gammaSpace = false;

    const lighting = BABYLON_SPIN_HABITAT_LIGHTING;
    this.hemisphere = new HemisphericLight('p27-c3-spin-hemisphere', new Vector3(-0.28, 1, 0.24), scene);
    this.hemisphere.diffuse = colorFromHex(0xa7bbb4);
    this.hemisphere.groundColor = colorFromHex(0x071112);
    this.hemisphere.intensity = 0.38;

    this.keyLight = new DirectionalLight('p27-c3-spin-key', new Vector3(-0.42, -1, -0.20).normalize(), scene);
    this.keyLight.position = new Vector3(worldW * 0.64, 15, worldH * 0.18);
    this.keyLight.diffuse = colorFromHex(lighting.keyColor);
    this.keyLight.intensity = lighting.keyIntensity;

    this.rimLight = new DirectionalLight('p27-c3-spin-rim', new Vector3(0.56, -0.82, 0.30).normalize(), scene);
    this.rimLight.position = new Vector3(worldW * 0.18, 10, worldH * 0.76);
    this.rimLight.diffuse = colorFromHex(lighting.rimColor);
    this.rimLight.intensity = lighting.rimIntensity;

    this.emergencyLight = new PointLight('p27-c3-spin-emergency', new Vector3(cx, 3.0, cz), scene);
    this.emergencyLight.diffuse = colorFromHex(lighting.emergencyColor);
    this.emergencyLight.range = 10.5;

    this.readabilityLight = new PointLight('p27-c3-spin-readability', new Vector3(cx, 2.7, cz), scene);
    this.readabilityLight.diffuse = colorFromHex(0xdaf2e9);
    this.readabilityLight.range = 8.4;

    this.practicalLights = [
      new PointLight('p27-c3-spin-practical-axis', new Vector3(cx, 3.3, cz), scene),
      new PointLight('p27-c3-spin-practical-rim', new Vector3(cx + 7.8, 2.5, cz), scene),
    ] as const;
    this.practicalLights[0].diffuse = colorFromHex(0x83dfd4);
    this.practicalLights[0].range = 8.2;
    this.practicalLights[1].diffuse = colorFromHex(0xd49a59);
    this.practicalLights[1].range = 7.2;
    this.setLightingEnabled(false);
  }

  sync(state: SimState, renderBudget: RenderBudgetSnapshot, lowVisibility: boolean) {
    this.released = false;
    this.root.setEnabled(true);
    this.setLightingEnabled(true);

    const spinSector = state.sectors.find(sector => sector.id === 'A') ?? state.sectors[0];
    const transferSector = state.sectors.find(sector => sector.id === 'B');
    const motion = spinHabitatArchitectureState(spinSector?.gravity ?? 1);
    const spindown = spinHabitatSpindownState(transferSector?.gravity ?? 0.42);
    const previousTime = this.lastSimTime;
    this.lastSimTime = state.time;
    const delta = Number.isFinite(previousTime) ? Math.max(0, Math.min(0.25, state.time - previousTime)) : 0;
    this.rotationY = (this.rotationY + motion.angularSpeed * delta) % (Math.PI * 2);
    this.rotorRoot.rotation.y = this.rotationY;

    const tierScale = renderBudget.tierName === 'high' ? 1 : renderBudget.tierName === 'balanced' ? 0.88 : 0.72;
    const visibleBands = renderBudget.tierName === 'performance' ? 2 : renderBudget.tierName === 'balanced' ? 3 : 4;
    const visibleDust = renderBudget.tierName === 'performance' ? 12 : renderBudget.tierName === 'balanced' ? 18 : 24;
    const ambientPulse = 0.5 + Math.sin(state.time * 1.35) * 0.5;
    const ambientAlpha = (0.08 + ambientPulse * 0.08) * renderBudget.transparencyScale;
    this.ambientRoot.rotation.y = this.rotationY * 0.72 + state.time * 0.022;
    this.ambientBands.forEach((band, index) => band.setEnabled(index < visibleBands));
    this.ambientDust.forEach((mote, index) => {
      mote.setEnabled(index < visibleDust);
      if (index < visibleDust) {
        mote.position.y = 0.22 + ((index * 7) % 13) / 12 * 1.2 + Math.sin(state.time * 0.8 + index) * 0.08;
      }
    });
    this.ambientMaterial.alpha = ambientAlpha;

    const reducedSpindownDetail = renderBudget.vfxDensity < 0.55;
    const pulse = 0.5 + Math.sin(state.time * (4.2 + spindown.intensity * 2.6)) * 0.5;
    this.spindownRoot.setEnabled(spindown.active);
    this.spindownRoot.rotation.y = -this.rotationY * 0.32 + state.time * (0.08 + spindown.intensity * 0.16);
    this.spindownArcs.forEach((arc, index) => {
      const enabled = spindown.active && (!reducedSpindownDetail || index % 2 === 0);
      arc.setEnabled(enabled);
      if (enabled) {
        const scale = 1 + spindown.intensity * 0.035 + Math.sin(state.time * 2.1 + index) * 0.008;
        arc.scaling.set(scale, scale, scale);
      }
    });
    this.warningMaterial.alpha = spindown.active
      ? (0.15 + pulse * 0.34) * Math.max(0.2, spindown.intensity) * renderBudget.transparencyScale
      : 0;
    const beaconScale = 0.92 + spindown.intensity * 0.16 + pulse * 0.08;
    this.spindownBeacon.scaling.set(beaconScale, beaconScale, beaconScale);

    const machineCount = this.syncMachineryCues(state);
    const activeBoss = state.enemies.find(enemy => enemy.active && !enemy.dead && enemy.role === 'boss') ?? null;
    this.bossCueRoot.setEnabled(Boolean(activeBoss));
    if (activeBoss) {
      this.bossCueRoot.position.set(scaled(activeBoss.x), 0.065, scaled(activeBoss.y));
      const phaseTwo = activeBoss.bossPhase === 2;
      const bossColor = colorFromHex(phaseTwo ? 0xffb15b : 0x72f1d0);
      this.bossCueMaterial.diffuseColor = bossColor.scale(0.18);
      this.bossCueMaterial.emissiveColor = bossColor.scale(phaseTwo ? 0.92 : 0.78);
      this.bossCueMaterial.alpha = phaseTwo ? 0.56 : 0.42;
      const bossPulse = 1 + Math.sin(state.time * (phaseTwo ? 5.8 : 3.2) + activeBoss.patternIndex) * (phaseTwo ? 0.10 : 0.06);
      this.bossPhaseRing.scaling.set(bossPulse, bossPulse, bossPulse);
      this.bossPhaseRing.rotation.y = state.time * (phaseTwo ? 1.1 : 0.55);
      this.bossPhaseHalo.setEnabled(phaseTwo || activeBoss.armor <= 0);
      this.bossPhaseHalo.rotation.y = -state.time * (phaseTwo ? 0.8 : 0.4);
    }

    const lighting = BABYLON_SPIN_HABITAT_LIGHTING;
    this.hemisphere.intensity = 0.38 * (renderBudget.tierName === 'performance' ? 0.82 : 1);
    this.keyLight.intensity = lighting.keyIntensity * tierScale * (lowVisibility ? 0.94 : 1);
    this.rimLight.intensity = lighting.rimIntensity * (renderBudget.tierName === 'performance' ? 0.74 : 1);

    const px = scaled(state.player.x);
    const pz = scaled(state.player.y);
    this.groundingMaterial.alpha = renderBudget.tierName === 'performance' ? 0.19 : 0.28;
    this.groundingSource.position.set(px, 0.044, pz);
    this.groundingSource.scaling.set(1.06, 0.72, 1);
    const nearby = new Set<number>();
    const radiusSq = REFINERY_ACTOR_GROUNDING_PROFILE.nearbyRadius ** 2;
    for (const enemy of state.enemies) {
      if (!enemy.active || enemy.dead) continue;
      const dx = enemy.x - state.player.x;
      const dz = enemy.y - state.player.y;
      if (dx * dx + dz * dz > radiusSq) continue;
      nearby.add(enemy.id);
      let contact = this.enemyGrounding.get(enemy.id);
      if (!contact) {
        contact = this.groundingSource.createInstance('p28-g3-spin-enemy-contact-' + enemy.id);
        contact.parent = this.root;
        contact.isPickable = false;
        contact.alphaIndex = -300;
        this.enemyGrounding.set(enemy.id, contact);
      }
      const size = refineryActorGroundingScale(enemy.role);
      contact.position.set(scaled(enemy.x), 0.043, scaled(enemy.y));
      contact.rotation.x = Math.PI / 2;
      contact.scaling.set(1.06 * size, 0.72 * size, 1);
    }
    for (const [id, contact] of this.enemyGrounding) {
      if (!nearby.has(id)) {
        contact.dispose();
        this.enemyGrounding.delete(id);
      }
    }
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
    this.readabilityLight.intensity = (renderBudget.tierName === 'performance' ? 3.6 : 5.3) * tierScale;

    const bossPhaseTwo = activeBoss?.bossPhase === 2;
    const spindownBoost = spindown.active ? 0.7 + spindown.intensity * 0.8 : 0.46;
    this.emergencyLight.position.set(px + 1.9, 3.0, pz - 1.8);
    this.emergencyLight.intensity = lighting.emergencyIntensity
      * (renderBudget.tierName === 'performance' ? 0.72 : 1)
      * spindownBoost
      * (bossPhaseTwo ? 1.22 : 1);

    const practicalCount = renderBudget.tierName === 'performance' ? 1 : 2;
    this.practicalLights.forEach((light, index) => {
      const enabled = index < practicalCount;
      light.setEnabled(enabled);
      light.intensity = enabled ? (index === 0 ? 5.8 : 4.3) * tierScale : 0;
    });

    const routePulse = 0.86 + Math.sin(state.time * 4.0) * 0.14;
    this.routeMaterials[0].emissiveColor = colorFromHex(0x79d8c8).scale(0.18 * routePulse);
    this.routeMaterials[1].emissiveColor = colorFromHex(0x8dc7d0).scale(0.07 * routePulse);

    this.scene.environmentTexture = this.iblReady ? this.iblTexture : null;
    this.scene.environmentIntensity = this.iblReady ? 0.28 * tierScale : 0;
    this.scene.imageProcessingConfiguration.toneMappingEnabled = true;
    this.scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    this.scene.imageProcessingConfiguration.exposure = lighting.exposure * (lowVisibility ? 1.03 : 1);
    this.scene.imageProcessingConfiguration.contrast = 1.03;

    const navigation = getMapNavigationPlan('spin-habitat');
    const pbrCount = this.scene.materials.filter(item => item instanceof PBRMaterial).length;
    this.canvas.dataset.babylonEnvironmentState = 'ready';
    this.canvas.dataset.environmentVisual = 'procedural-spin-habitat-babylon';
    this.canvas.dataset.environmentKit = 'floor,ring-segment,spoke-truss,axis-hub,service-bay,wayfinding,spindown,ambient,boss-cue';
    this.canvas.dataset.environmentInstances = String(this.meshCount + this.machineryCues.size);
    this.canvas.dataset.environmentLandmark = 'central-axis-hub';
    this.canvas.dataset.environmentServiceDetails = 'service-bay:4+machinery-cues:' + machineCount;
    this.canvas.dataset.environmentSurfaceDetail = 'ring:3+torque-rails:6+joint-shoes:36+cross-ribs:16+axis-feet:8+ambient-bands:' + visibleBands;
    this.canvas.dataset.environmentComposition = 'rotating-ring-arc+rotating-cross-spokes+stationary-axis+service-bays';
    this.canvas.dataset.environmentMotion = 'gravity-coupled-rigid-rotation';
    this.canvas.dataset.environmentSpinMode = motion.mode;
    this.canvas.dataset.environmentSpinRpm = motion.rpm.toFixed(2);
    this.canvas.dataset.environmentSpinPhase = this.rotationY.toFixed(3);
    this.canvas.dataset.environmentSpinSource = 'sector-A-gravity';
    this.canvas.dataset.environmentSpindown = spindown.active ? 'active' : 'idle';
    this.canvas.dataset.environmentSpindownIntensity = spindown.intensity.toFixed(2);
    this.canvas.dataset.environmentSpindownSource = 'sector-B-transfer-gravity';
    this.canvas.dataset.environmentSpindownDetail = reducedSpindownDetail ? '3-arcs+axis-pulse' : '6-arcs+axis-pulse';
    this.canvas.dataset.environmentVfx = 'spindown-brake-arcs+axis-warning-pulse';
    this.canvas.dataset.environmentAmbient = 'rim-light-sweep+spin-dust+axis-haze';
    this.canvas.dataset.environmentAmbientMotion = 'gravity-coupled-sweep+counterspin-drift+stationary-axis-pulse';
    this.canvas.dataset.environmentAmbientDetail = visibleBands + '-bands+' + visibleDust + '-motes+axis-haze';
    this.canvas.dataset.environmentAmbientIntensity = ambientAlpha.toFixed(2);
    this.canvas.dataset.environmentMaterials = 'rim-green-plating+spoke-dark-cyan+axis-bright-cool+service-amber';
    this.canvas.dataset.environmentZoneIdentity = 'rim:plated-green-deck|spoke:skeletal-cyan-truss|axis:bright-stationary-tower';
    this.canvas.dataset.readabilityLanguage = 'rim-plated-green+spoke-skeletal-cyan+axis-bright-stationary';
    this.canvas.dataset.environmentPerformanceProfile = renderBudget.tierName + ':procedural:rotor-shadows-off';
    this.canvas.dataset.environmentInstanceBudget = 'ring:3+spoke:4+axis:2+service:4';
    this.canvas.dataset.environmentShadowCasters = 'off-babylon-p27c3';
    this.canvas.dataset.locationArt = 'spin-habitat:ring-and-spokes:habitat-alloy';
    this.canvas.dataset.locationArtIdentity = 'ring-and-spokes|habitat-alloy|cool-green|habitat-service';
    this.canvas.dataset.locationProps = 'habitat-service:procedural-babylon';
    this.canvas.dataset.interactableBiome = 'spin-habitat';
    this.canvas.dataset.interactableMode = 'spin-habitat-machinery+mission-controls';
    this.canvas.dataset.interactableKit = 'spin-bus-isolator+gravity-trim+bearing-control+attitude-flywheel+pressure-lock';
    this.canvas.dataset.interactableLocationVisual = 'procedural-babylon-machinery-cues';
    this.canvas.dataset.interactableLocationCueCount = String(machineCount);
    this.canvas.dataset.bossBiome = 'spin-habitat';
    this.canvas.dataset.bossPresentation = 'sable-voss';
    this.canvas.dataset.bossVisual = 'procedural-babylon';
    this.canvas.dataset.bossAsset = 'procedural-babylon-sable-voss-cue';
    this.canvas.dataset.bossSilhouette = 'counterspin-mantle+governor-towers+command-visor';
    this.canvas.dataset.bossPalette = 'recovery-green+cyan-command+amber-phase-two';
    this.canvas.dataset.bossCue = 'counterspin-ring+governor-towers+phase-halo';
    this.canvas.dataset.bossCueState = activeBoss ? 'active-phase-' + activeBoss.bossPhase : 'queued';
    this.canvas.dataset.babylonSpinHabitatParity = 'architecture+spindown+props+interactables+navigation+boss-cues+shared-world-cues';
    this.canvas.dataset.babylonSpinPlayerPosition = state.player.x.toFixed(1) + ',' + state.player.y.toFixed(1);
    this.canvas.dataset.babylonSpinRoutes = String(navigation.routes.length);
    this.canvas.dataset.babylonRouteMarkingProfile = 'spin-recessed-deck-inlay';
    this.canvas.dataset.babylonRouteMarkingMaxWidth = String(BABYLON_ROUTE_MARKING_WIDTHS.primary);
    this.canvas.dataset.babylonSpinLandmarks = navigation.landmarks.map(item => item.label).join('|');
    this.canvas.dataset.babylonLightingProfile = lighting.id;
    this.canvas.dataset.babylonMaterialIntent = 'premium-ktx2-habitat-alloy-pbr+shared-world-pbr';
    const premiumReady = BABYLON_SPIN_PREMIUM_SURFACES.every(id => {
      const pbr = this.premiumSurfaces.get(id);
      return pbr.albedoTexture?.isReady() === true
        && pbr.bumpTexture?.isReady() === true
        && pbr.metallicTexture?.isReady() === true
        && (!pbr.emissiveTexture || pbr.emissiveTexture.isReady());
    });
    this.canvas.dataset.spinPremiumAssetState = premiumReady ? 'ready' : 'loading';
    this.canvas.dataset.spinPremiumBindings = String(this.premiumBindingCount);
    this.canvas.dataset.spinPremiumSurfaces = BABYLON_SPIN_PREMIUM_SURFACES.join(',');
    this.canvas.dataset.spinGrounding = 'player+enemies:soft-contact';
    this.canvas.dataset.spinGroundedEnemies = String(nearby.size);
    this.canvas.dataset.spinGroundedProps = String(this.staticPropGroundingCount);
    this.canvas.dataset.babylonLightingBudget = 'tier:' + renderBudget.tierName + '|practical:' + practicalCount + '|shadows:off';
    this.canvas.dataset.environmentIbl = this.iblReady ? 'shared-prefiltered:ready' : 'shared-prefiltered:loading';
    this.canvas.dataset.environmentLighting = 'spin-habitat-cool-green:axis+rim+contact:player+enemy+practical:' + practicalCount + '+shadow:off';
    this.canvas.dataset.environmentShadowBudget = 'off:spin-habitat-babylon';
    this.canvas.dataset.environmentTone = 'aces-' + this.scene.imageProcessingConfiguration.exposure.toFixed(2);
    this.canvas.dataset.locationLighting = 'spin-habitat:cool-green:aces-' + this.scene.imageProcessingConfiguration.exposure.toFixed(2);
    this.canvas.dataset.babylonPbrMaterials = 'pbr:' + pbrCount + '|spin:' + this.materials.length;
    this.canvas.dataset.renderTier = renderBudget.tierName;
    this.canvas.dataset.graphicsQuality = renderBudget.qualityMode;
  }

  release(reason: string) {
    if (this.released) return;
    this.released = true;
    this.root.setEnabled(false);
    this.setLightingEnabled(false);
    this.lastSimTime = Number.NaN;
    this.canvas.dataset.babylonSpinRelease = reason;
  }

  dispose() {
    this.release('renderer-dispose');
    for (const contact of this.enemyGrounding.values()) contact.dispose();
    this.enemyGrounding.clear();
    this.root.getChildMeshes(false).forEach(mesh => mesh.dispose());
    this.root.dispose();
    this.groundingMaterial.dispose();
    this.groundingTexture.dispose();
    if (this.scene.environmentTexture === this.iblTexture) this.scene.environmentTexture = null;
    this.iblTexture.dispose();
    this.ownedMaterials.forEach(item => item.dispose());
    this.premiumSurfaces.dispose();
    this.warningMaterial.dispose();
    this.ambientMaterial.dispose();
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
        if (label === 'gravity-trim' || label === 'attitude-flywheel') {
          mesh = MeshBuilder.CreateTorus('p27-c3-' + label + '-' + object.id, {
            diameter: label === 'gravity-trim' ? 0.9 : 1.15,
            thickness: label === 'gravity-trim' ? 0.13 : 0.16,
            tessellation: 24,
          }, this.scene);
        } else if (label === 'bearing-control') {
          mesh = MeshBuilder.CreateCylinder('p27-c3-' + label + '-' + object.id, {
            height: 0.32,
            diameter: 0.92,
            tessellation: 16,
          }, this.scene);
        } else {
          mesh = MeshBuilder.CreateBox('p27-c3-' + label + '-' + object.id, {
            width: 0.58,
            height: 0.84,
            depth: 0.48,
          }, this.scene);
        }
        mesh.parent = this.machineryRoot;
        mesh.material = this.machineryMaterial;
        mesh.isPickable = false;
        this.machineryCues.set(object.id, mesh);
      }
      mesh.position.set(scaled(object.x + object.w / 2), label === 'pressure-lock' ? 0.48 : 0.16, scaled(object.y + object.h / 2));
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
