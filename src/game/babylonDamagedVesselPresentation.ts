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
import { getWorldSize, type SimState } from './sim';

const WORLD_SCALE = 0.02;
export const BABYLON_DAMAGED_PREMIUM_SURFACES = [
  'deck-plate', 'painted-metal', 'bare-metal', 'polymer-rubber', 'emissive-fixture',
] as const;

export const BABYLON_DAMAGED_VESSEL_IDENTITY = Object.freeze({
  silhouette: 'broken-ribs',
  material: 'scarred-hull',
  lighting: 'emergency-amber',
  propSet: 'salvage-cases',
});

export const BABYLON_DAMAGED_VESSEL_LIGHTING = Object.freeze({
  id: 'emergency-amber',
  keyColor: 0xd8c6b2,
  rimColor: 0xa65d48,
  emergencyColor: 0xf0754f,
  keyIntensity: 1.8,
  rimIntensity: 0.92,
  emergencyIntensity: 12,
  exposure: 1,
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

export class BabylonDamagedVesselPresentation {
  private readonly root: TransformNode;
  private readonly materials: PBRMaterial[];
  private readonly routeMaterials: readonly [PBRMaterial, PBRMaterial];
  private readonly premiumSurfaces: BabylonPremiumPbrSurfaceLibrary;
  private readonly ownedMaterials: PBRMaterial[];
  private readonly premiumBindingCount: number;
  private readonly staticPropGroundingCount: number;
  private readonly iblTexture: CubeTexture;
  private iblReady = false;
  private readonly groundingTexture: RawTexture;
  private readonly groundingMaterial: StandardMaterial;
  private readonly groundingSource: Mesh;
  private readonly enemyGrounding = new Map<number, InstancedMesh>();
  private readonly vaporMaterial: StandardMaterial;
  private readonly vaporMeshes: ReturnType<typeof MeshBuilder.CreateSphere>[] = [];
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
    _coarse: boolean,
  ) {
    const world = getWorldSize();
    const worldW = scaled(world.w);
    const worldH = scaled(world.h);
    const cx = worldW / 2;
    const cz = worldH / 2;
    const staticPropContacts: { x: number; z: number; width: number; depth: number }[] = [];

    // Keep the original damaged-hull silhouette, but bind shipped KTX2 normal
    // and ORM artwork to its actual floor, braces, seals and exposed edges.
    this.premiumSurfaces = createBabylonPremiumPbrSurfaceLibrary(scene);
    const floor = this.premiumSurfaces.get('deck-plate');
    const structural = this.premiumSurfaces.get('painted-metal');
    const scarred = this.premiumSurfaces.get('polymer-rubber');
    const tornEdge = this.premiumSurfaces.get('bare-metal');
    const fixture = this.premiumSurfaces.get('emissive-fixture');
    const warning = material(scene, 'p27-c2-damaged-warning-material', 0x5c241c, 0.50, 0.38, 0xf0754f, 0.72);
    const routePrimary = material(scene, 'p27-c2-damaged-route-primary-material', 0x382c28, 0.68, 0.50, 0xf0754f, 0.17);
    const routeSecondary = material(scene, 'p27-c2-damaged-route-secondary-material', 0x252a29, 0.72, 0.56, 0x6bc6c1, 0.06);
    this.ownedMaterials = [warning, routePrimary, routeSecondary];
    this.materials = [floor, structural, scarred, tornEdge, fixture, ...this.ownedMaterials];
    this.routeMaterials = [routePrimary, routeSecondary];

    this.root = new TransformNode('p27-c2-damaged-vessel-environment', scene);
    box(scene, this.root, 'p27-c2-damaged-floor', floor, cx, -0.055, cz, worldW, 0.11, worldH);

    for (let index = 0; index < 5; index += 1) {
      const rib = box(
        scene,
        this.root,
        'p27-c2-damaged-broken-rib-' + index,
        index === 2 ? tornEdge : scarred,
        worldW * (0.82 + (index % 3) * 0.015),
        2.25,
        worldH * (0.22 + index * 0.14),
        0.24,
        4.4 - (index % 2) * 0.7,
        2.5,
      );
      rib.rotation.z = -0.14 + index * 0.055;
      rib.rotation.y = Math.PI * 0.5 + (index - 2) * 0.03;
      // Torn reinforcement flanges cast readable relief at gameplay zoom.
      box(scene, this.root, 'p28-g2-damaged-rib-flange-' + index,
        tornEdge, worldW * (0.82 + (index % 3) * 0.015) - 0.19,
        3.08, worldH * (0.22 + index * 0.14), 0.11, 0.18, 2.15);
      box(scene, this.root, 'p28-g2-damaged-rib-gasket-' + index,
        scarred, worldW * (0.82 + (index % 3) * 0.015) - 0.23,
        1.65, worldH * (0.22 + index * 0.14), 0.14, 0.22, 1.85);
    }

    for (let index = 0; index < 6; index += 1) {
      const plate = box(
        scene,
        this.root,
        'p27-c2-damaged-torn-plate-' + index,
        index % 2 === 0 ? tornEdge : structural,
        worldW * (0.88 - (index % 3) * 0.02),
        1.2 + (index % 2) * 0.5,
        worldH * (0.26 + index * 0.09),
        1.7 + (index % 3) * 0.35,
        0.18,
        1.1 + (index % 2) * 0.55,
      );
      plate.rotation.y = Math.PI / 2 + (index - 2) * 0.06;
      plate.rotation.z = 0.16 + index * 0.025;
      box(scene, this.root, 'p28-g2-damaged-plate-edge-' + index,
        tornEdge, worldW * (0.88 - (index % 3) * 0.02) - 0.14,
        1.27 + (index % 2) * 0.5, worldH * (0.26 + index * 0.09),
        0.15, 0.31, 1.22);
    }

    const salvageX = [0.16, 0.17, 0.16, 0.38, 0.56, 0.72];
    const salvageZ = [0.24, 0.40, 0.72, 0.86, 0.86, 0.84];
    for (let index = 0; index < 6; index += 1) {
      const x = worldW * salvageX[index];
      const z = worldH * salvageZ[index];
      box(scene, this.root, 'p27-c2-damaged-salvage-rack-' + index, structural, x, 0.58, z, 1.35, 1.16, 0.68);
      box(scene, this.root, 'p27-c2-damaged-salvage-status-' + index, warning, x, 1.18, z, 0.42, 0.12, 0.50);
      box(scene, this.root, 'p28-g2-damaged-salvage-rail-' + index, tornEdge,
        x, 0.93, z, 1.17, 0.12, 0.12);
      box(scene, this.root, 'p28-g2-damaged-salvage-lock-' + index, fixture,
        x, 1.22, z + 0.18, 0.11, 0.08, 0.08);
      staticPropContacts.push({ x, z, width: 1.35, depth: 0.68 });
    }

    const serviceX = [0.86, 0.87, 0.14, 0.34, 0.68];
    const serviceZ = [0.35, 0.63, 0.50, 0.12, 0.88];
    for (let index = 0; index < 5; index += 1) {
      const x = worldW * serviceX[index];
      const z = worldH * serviceZ[index];
      box(scene, this.root, 'p27-c2-damaged-service-bundle-' + index, scarred, x, 0.34, z, 1.10, 0.68, 0.66);
      const pipe = MeshBuilder.CreateCylinder('p27-c2-damaged-service-pipe-' + index, {
        height: 1.36,
        diameter: 0.12,
        tessellation: 8,
      }, scene);
      pipe.parent = this.root;
      pipe.position.set(x, 0.48, z);
      pipe.rotation.z = Math.PI / 2;
      pipe.material = tornEdge;
      pipe.isPickable = false;
      staticPropContacts.push({ x, z, width: 1.10, depth: 0.66 });
    }

    const breach = MeshBuilder.CreateTorus('p27-c2-damaged-breach-frame', {
      diameter: 5.9,
      thickness: 0.24,
      tessellation: 28,
    }, scene);
    breach.parent = this.root;
    breach.position.set(worldW * 0.91, 2.8, cz);
    breach.rotation.y = Math.PI / 2;
    breach.material = warning;
    breach.isPickable = false;

    for (let index = 0; index < 6; index += 1) {
      const scorch = MeshBuilder.CreateCylinder('p27-c2-damaged-scorch-' + index, {
        height: 0.016,
        diameter: 0.72 + (index % 3) * 0.18,
        tessellation: 16,
      }, scene);
      scorch.parent = this.root;
      scorch.position.set(
        worldW * (0.62 + (index % 3) * 0.085),
        0.01,
        worldH * (0.31 + Math.floor(index / 3) * 0.36),
      );
      scorch.scaling.z = 0.62 + (index % 2) * 0.22;
      scorch.material = scarred;
      scorch.isPickable = false;
    }

    this.vaporMaterial = new StandardMaterial('p27-c2-damaged-vapor-material', scene);
    this.vaporMaterial.diffuseColor = colorFromHex(0x8fa9a6).scale(0.16);
    this.vaporMaterial.emissiveColor = colorFromHex(0x8fa9a6).scale(0.22);
    this.vaporMaterial.specularColor = Color3.Black();
    this.vaporMaterial.alpha = 0.12;
    this.vaporMaterial.disableLighting = true;
    this.vaporMaterial.backFaceCulling = false;
    for (let index = 0; index < 18; index += 1) {
      const vapor = MeshBuilder.CreateSphere('p27-c2-damaged-breach-vapor-' + index, {
        diameter: 0.38 + (index % 5) * 0.08,
        segments: 6,
      }, scene);
      vapor.parent = this.root;
      vapor.material = this.vaporMaterial;
      vapor.isPickable = false;
      this.vaporMeshes.push(vapor);
    }

    const navigation = getMapNavigationPlan('damaged-vessel');
    navigation.routes.forEach(route => {
      for (let index = 0; index < route.points.length - 1; index += 1) {
        const a = route.points[index];
        const b = route.points[index + 1];
        routeSegment(
          scene,
          this.root,
          route.kind === 'primary' ? routePrimary : routeSecondary,
          'p27-c2-damaged-route-' + route.id + '-' + index,
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
      box(scene, this.root, 'p27-c2-damaged-landmark-' + landmark.id, structural, x, 1.45, z, 0.24, 2.90, 0.24);
      box(scene, this.root, 'p27-c2-damaged-landmark-beacon-' + index, warning, x, 2.75, z, 1.28, 0.12, 0.36);
    });

    const sharedMaterials = new Set(this.premiumSurfaces.materials.values());
    this.premiumBindingCount = this.root.getChildMeshes(false)
      .filter(mesh => mesh.material instanceof PBRMaterial && sharedMaterials.has(mesh.material)).length;

    const groundingSize = REFINERY_ACTOR_GROUNDING_PROFILE.alphaTextureSize;
    this.groundingTexture = RawTexture.CreateRGBATexture(
      createRefineryContactDepthAlphaData(groundingSize), groundingSize, groundingSize, scene, false, false,
    );
    this.groundingTexture.hasAlpha = true;
    this.groundingMaterial = new StandardMaterial('p28-g2-damaged-contact-material', scene);
    this.groundingMaterial.diffuseColor = new Color3(0.022, 0.013, 0.011);
    this.groundingMaterial.specularColor = Color3.Black();
    this.groundingMaterial.diffuseTexture = this.groundingTexture;
    this.groundingMaterial.useAlphaFromDiffuseTexture = true;
    this.groundingMaterial.disableLighting = true;
    this.groundingMaterial.disableDepthWrite = true;
    this.groundingMaterial.backFaceCulling = false;
    this.groundingMaterial.alpha = 0.28;
    this.groundingSource = MeshBuilder.CreatePlane('p28-g2-damaged-player-contact',
      { width: 1, height: 1, sideOrientation: Mesh.DOUBLESIDE }, scene);
    this.groundingSource.parent = this.root;
    this.groundingSource.material = this.groundingMaterial;
    this.groundingSource.isPickable = false;
    this.groundingSource.alphaIndex = -300;
    this.groundingSource.rotation.x = Math.PI / 2;
    staticPropContacts.forEach(({ x, z, width, depth }, index) => {
      const contact = this.groundingSource.createInstance('p28-g2-damaged-prop-contact-' + index);
      contact.parent = this.root;
      contact.position.set(x, 0.042, z);
      contact.rotation.x = Math.PI / 2;
      contact.scaling.set(width * 1.26, depth * 1.26, 1);
      contact.isPickable = false;
      contact.alphaIndex = -300;
    });
    this.staticPropGroundingCount = staticPropContacts.length;
    this.meshCount = this.root.getChildMeshes(false).length;
    this.root.setEnabled(false);

    this.iblTexture = new CubeTexture('/assets/environments/refinery-prefiltered.env',
      scene, undefined, false, undefined,
      () => { this.iblReady = true; }, () => { this.iblReady = false; }, undefined, true);
    this.iblTexture.name = 'p28-g2-damaged-shared-prefiltered-ibl';
    this.iblTexture.gammaSpace = false;

    const lighting = BABYLON_DAMAGED_VESSEL_LIGHTING;
    this.hemisphere = new HemisphericLight('p27-c2-damaged-hemisphere', new Vector3(-0.38, 1, 0.28), scene);
    this.hemisphere.diffuse = colorFromHex(0x9e948a);
    this.hemisphere.groundColor = colorFromHex(0x171311);
    this.hemisphere.intensity = 0.36;

    this.keyLight = new DirectionalLight('p27-c2-damaged-key', new Vector3(-0.44, -1, -0.22).normalize(), scene);
    this.keyLight.position = new Vector3(worldW * 0.64, 15, worldH * 0.18);
    this.keyLight.diffuse = colorFromHex(lighting.keyColor);
    this.keyLight.intensity = lighting.keyIntensity;

    this.rimLight = new DirectionalLight('p27-c2-damaged-rim', new Vector3(0.58, -0.82, 0.30).normalize(), scene);
    this.rimLight.position = new Vector3(worldW * 0.18, 10, worldH * 0.76);
    this.rimLight.diffuse = colorFromHex(lighting.rimColor);
    this.rimLight.intensity = lighting.rimIntensity;

    this.emergencyLight = new PointLight('p27-c2-damaged-emergency', new Vector3(worldW * 0.86, 3.05, cz), scene);
    this.emergencyLight.diffuse = colorFromHex(lighting.emergencyColor);
    this.emergencyLight.range = 9.4;

    this.readabilityLight = new PointLight('p27-c2-damaged-readability', new Vector3(cx, 2.7, cz), scene);
    this.readabilityLight.diffuse = colorFromHex(0xe1d7cb);
    this.readabilityLight.range = 8.2;

    this.practicalLights = [
      new PointLight('p27-c2-damaged-practical-breach', new Vector3(worldW * 0.86, 3.05, worldH * 0.50), scene),
      new PointLight('p27-c2-damaged-practical-salvage', new Vector3(worldW * 0.18, 2.65, worldH * 0.40), scene),
    ] as const;
    this.practicalLights[0].diffuse = colorFromHex(0xf0754f);
    this.practicalLights[0].range = 9.2;
    this.practicalLights[1].diffuse = colorFromHex(0x6bc6c1);
    this.practicalLights[1].range = 7.4;
    this.setLightingEnabled(false);
  }

  sync(state: SimState, renderBudget: RenderBudgetSnapshot, lowVisibility: boolean) {
    this.released = false;
    this.root.setEnabled(true);
    this.setLightingEnabled(true);

    const lighting = BABYLON_DAMAGED_VESSEL_LIGHTING;
    const tierScale = renderBudget.tierName === 'high' ? 1 : renderBudget.tierName === 'balanced' ? 0.88 : 0.72;
    this.hemisphere.intensity = 0.36 * (renderBudget.tierName === 'performance' ? 0.82 : 1);
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
        contact = this.groundingSource.createInstance('p28-g2-damaged-enemy-contact-' + enemy.id);
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
    this.readabilityLight.intensity = (renderBudget.tierName === 'performance' ? 3.5 : 5.2) * tierScale;

    const activeBoss = state.enemies.find(enemy => enemy.active && !enemy.dead && enemy.role === 'boss') ?? null;
    const bossPulse = activeBoss?.bossPhase === 2 ? 1 + Math.sin(state.time * 4.6) * 0.16 : 1;
    this.emergencyLight.position.set(px + 2.4, 3.2, pz - 2.2);
    this.emergencyLight.intensity = lighting.emergencyIntensity
      * (renderBudget.tierName === 'performance' ? 0.72 : 1)
      * bossPulse;

    const practicalCount = renderBudget.tierName === 'performance' ? 1 : 2;
    this.practicalLights.forEach((light, index) => {
      const enabled = index < practicalCount;
      light.setEnabled(enabled);
      light.intensity = enabled ? (index === 0 ? 8.6 : 4.8) * tierScale * bossPulse : 0;
    });

    const routePulse = 0.86 + Math.sin(state.time * 4.2) * 0.14;
    this.routeMaterials[0].emissiveColor = colorFromHex(0xf0754f).scale(0.17 * routePulse);
    this.routeMaterials[1].emissiveColor = colorFromHex(0x6bc6c1).scale(0.06 * routePulse);

    this.vaporMaterial.alpha = (0.08 + renderBudget.transparencyScale * 0.08) * (lowVisibility ? 1.25 : 1);
    const world = getWorldSize();
    const worldW = scaled(world.w);
    const worldH = scaled(world.h);
    this.vaporMeshes.forEach((mesh, index) => {
      const row = Math.floor(index / 6);
      const column = index % 6;
      const drift = (state.time * (0.34 + row * 0.05) + column * 0.23) % 1;
      mesh.position.set(
        worldW * (0.895 + row * 0.008) - drift * (0.70 + row * 0.16),
        0.72 + column * 0.34 + Math.sin(state.time * 1.8 + index) * 0.13,
        worldH * (0.43 + column * 0.024) + Math.sin(state.time * 0.9 + index * 0.7) * 0.18,
      );
      const scale = 0.62 + drift * 0.82;
      mesh.scaling.set(scale, scale * 0.76, scale);
    });

    this.scene.environmentTexture = this.iblReady ? this.iblTexture : null;
    this.scene.environmentIntensity = this.iblReady ? 0.26 * tierScale : 0;
    this.scene.imageProcessingConfiguration.toneMappingEnabled = true;
    this.scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    this.scene.imageProcessingConfiguration.exposure = lighting.exposure * (lowVisibility ? 1.04 : 1);
    this.scene.imageProcessingConfiguration.contrast = 1.03;

    const navigation = getMapNavigationPlan('damaged-vessel');
    const pbrCount = this.scene.materials.filter(item => item instanceof PBRMaterial).length;
    this.canvas.dataset.babylonEnvironmentState = 'ready';
    this.canvas.dataset.environmentVisual = 'procedural-damaged-vessel-babylon';
    this.canvas.dataset.environmentKit = 'floor,broken-rib,breach-frame,salvage-rack,torn-plate,service-bundle,wayfinding,breach-vapor,scorch';
    this.canvas.dataset.environmentInstances = String(this.meshCount);
    this.canvas.dataset.environmentLandmark = 'starboard-hull-breach';
    this.canvas.dataset.environmentServiceDetails = 'salvage-rack:6+service-bundle:5';
    this.canvas.dataset.environmentSurfaceDetail = 'broken-rib:5+torn-plate:6+scorch:6';
    this.canvas.dataset.environmentComposition = 'broken-rib-corridor+starboard-breach+torn-shell+perimeter-salvage';
    this.canvas.dataset.environmentMaterials = 'scarred-hull+torn-edge+warning-emissive+salvage-status';
    this.canvas.dataset.environmentVfx = 'breach-vapor:18+scorch:6';
    this.canvas.dataset.readabilityLanguage = 'silhouette+damage-edge+breach-vapor+luminance';
    this.canvas.dataset.locationArt = 'damaged-vessel:broken-ribs:scarred-hull';
    this.canvas.dataset.locationArtIdentity = 'broken-ribs|scarred-hull|emergency-amber|salvage-cases';
    this.canvas.dataset.locationProps = 'salvage-cases:procedural-babylon';
    this.canvas.dataset.babylonDamagedParity = 'architecture+scarred-hull+breach-effects+props+navigation+shared-world-cues';
    this.canvas.dataset.babylonDamagedPlayerPosition = state.player.x.toFixed(1) + ',' + state.player.y.toFixed(1);
    this.canvas.dataset.babylonDamagedRoutes = String(navigation.routes.length);
    this.canvas.dataset.babylonRouteMarkingProfile = 'damaged-recessed-deck-inlay';
    this.canvas.dataset.babylonRouteMarkingMaxWidth = String(BABYLON_ROUTE_MARKING_WIDTHS.primary);
    this.canvas.dataset.babylonDamagedLandmarks = navigation.landmarks.map(item => item.label).join('|');
    this.canvas.dataset.babylonLightingProfile = lighting.id;
    this.canvas.dataset.babylonMaterialIntent = 'premium-ktx2-scarred-hull-pbr+shared-world-pbr';
    const premiumReady = BABYLON_DAMAGED_PREMIUM_SURFACES.every(id => {
      const pbr = this.premiumSurfaces.get(id);
      return pbr.albedoTexture?.isReady() === true
        && pbr.bumpTexture?.isReady() === true
        && pbr.metallicTexture?.isReady() === true
        && (!pbr.emissiveTexture || pbr.emissiveTexture.isReady());
    });
    this.canvas.dataset.damagedPremiumAssetState = premiumReady ? 'ready' : 'loading';
    this.canvas.dataset.damagedPremiumBindings = String(this.premiumBindingCount);
    this.canvas.dataset.damagedPremiumSurfaces = BABYLON_DAMAGED_PREMIUM_SURFACES.join(',');
    this.canvas.dataset.damagedGrounding = 'player+enemies:soft-contact';
    this.canvas.dataset.damagedGroundedEnemies = String(nearby.size);
    this.canvas.dataset.damagedGroundedProps = String(this.staticPropGroundingCount);
    this.canvas.dataset.babylonLightingBudget = 'tier:' + renderBudget.tierName + '|practical:' + practicalCount + '|shadows:off';
    this.canvas.dataset.environmentIbl = this.iblReady ? 'shared-prefiltered:ready' : 'shared-prefiltered:loading';
    this.canvas.dataset.environmentLighting = 'damaged-vessel-emergency:breach+salvage+contact:player+enemy+practical:' + practicalCount + '+shadow:off';
    this.canvas.dataset.environmentShadowBudget = 'off:damaged-vessel-babylon';
    this.canvas.dataset.environmentTone = 'aces-' + this.scene.imageProcessingConfiguration.exposure.toFixed(2);
    this.canvas.dataset.locationLighting = 'damaged-vessel:emergency-amber:aces-' + this.scene.imageProcessingConfiguration.exposure.toFixed(2);
    this.canvas.dataset.babylonPbrMaterials = 'pbr:' + pbrCount + '|damaged:' + this.materials.length;
    this.canvas.dataset.renderTier = renderBudget.tierName;
    this.canvas.dataset.graphicsQuality = renderBudget.qualityMode;
  }

  release(reason: string) {
    if (this.released) return;
    this.released = true;
    this.root.setEnabled(false);
    this.setLightingEnabled(false);
    this.canvas.dataset.babylonDamagedRelease = reason;
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
    this.vaporMaterial.dispose();
    this.hemisphere.dispose();
    this.keyLight.dispose();
    this.rimLight.dispose();
    this.emergencyLight.dispose();
    this.readabilityLight.dispose();
    this.practicalLights.forEach(light => light.dispose());
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
