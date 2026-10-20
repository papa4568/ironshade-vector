import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { CubeTexture } from '@babylonjs/core/Materials/Textures/cubeTexture';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { getMapNavigationPlan } from './mapNavigation';
import { createBabylonPremiumPbrSurfaceLibrary, type BabylonPremiumPbrSurfaceLibrary } from './babylonPremiumPbrSurfaceLibrary';
import { createRefineryContactDepthAlphaData } from './refineryContactDepth';
import { REFINERY_ACTOR_GROUNDING_PROFILE, refineryActorGroundingScale } from './babylonRefineryLighting';
import type { RenderBudgetSnapshot } from './renderQuality';
import { getWorldSize, type SimState } from './sim';

const WORLD_SCALE = 0.02;
export const BABYLON_ORBITAL_PREMIUM_SURFACES = [
  'deck-plate', 'painted-metal', 'bare-metal', 'polymer-rubber', 'emissive-fixture',
] as const;

export const BABYLON_ORBITAL_STATION_IDENTITY = Object.freeze({
  silhouette: 'radial-spine',
  material: 'clean-industrial',
  lighting: 'neutral-cyan',
  propSet: 'service-cases',
});

export const BABYLON_ORBITAL_STATION_LIGHTING = Object.freeze({
  id: 'neutral-cyan',
  keyColor: 0xd8e8e1,
  rimColor: 0x72a8b2,
  emergencyColor: 0xd97958,
  keyIntensity: 2.35,
  rimIntensity: 1,
  emergencyIntensity: 8.5,
  exposure: 1.06,
});

function scaled(value: number) {
  return value * WORLD_SCALE;
}

function colorFromHex(hex: number) {
  return Color3.FromInts((hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff);
}

function createMaterial(
  scene: Scene,
  name: string,
  color: number,
  metallic: number,
  roughness: number,
  emissive = 0,
  emissiveIntensity = 0,
) {
  const material = new PBRMaterial(name, scene);
  material.albedoColor = colorFromHex(color);
  material.metallic = metallic;
  material.roughness = roughness;
  material.emissiveColor = colorFromHex(emissive).scale(emissiveIntensity);
  return material;
}

function createBox(
  scene: Scene,
  parent: TransformNode,
  name: string,
  material: PBRMaterial,
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
  mesh.material = material;
  mesh.isPickable = false;
  return mesh;
}

function createRouteSegment(
  scene: Scene,
  parent: TransformNode,
  material: PBRMaterial,
  name: string,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  width: number,
  y: number,
) {
  const dx = bx - ax;
  const dz = bz - az;
  const length = Math.hypot(dx, dz);
  const segment = createBox(
    scene,
    parent,
    name,
    material,
    (ax + bx) / 2,
    y,
    (az + bz) / 2,
    length,
    0.035,
    width,
  );
  segment.rotation.y = -Math.atan2(dz, dx);
  return segment;
}

export class BabylonOrbitalStationPresentation {
  private readonly root: TransformNode;
  private readonly materials: PBRMaterial[];
  private readonly routeGlowMaterials: PBRMaterial[] = [];
  private readonly premiumSurfaces: BabylonPremiumPbrSurfaceLibrary;
  private readonly ownedMaterials: PBRMaterial[];
  private readonly premiumBindingCount: number;
  private readonly fixtureMaterial: PBRMaterial;
  private readonly iblTexture: CubeTexture;
  private iblReady = false;
  private readonly groundingTexture: RawTexture;
  private readonly groundingMaterial: StandardMaterial;
  private readonly groundingSource: Mesh;
  private readonly enemyGrounding = new Map<number, InstancedMesh>();
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

    // Bind the shipped P28 texture library to actual station meshes, not telemetry-only assets.
    this.premiumSurfaces = createBabylonPremiumPbrSurfaceLibrary(scene);
    const floor = this.premiumSurfaces.get('deck-plate');
    const structural = this.premiumSurfaces.get('painted-metal');
    const dark = this.premiumSurfaces.get('bare-metal');
    const gasket = this.premiumSurfaces.get('polymer-rubber');
    this.fixtureMaterial = this.premiumSurfaces.get('emissive-fixture');
    const accent = createMaterial(scene, 'p27-c1-orbital-accent-material', 0x7aa99c, 0.58, 0.25, 0x7aa99c, 0.2);
    const routePrimary = createMaterial(scene, 'p27-c1-orbital-route-primary-material', 0x263532, 0.72, 0.36, 0x7aa99c, 0.22);
    const routeSecondary = createMaterial(scene, 'p27-c1-orbital-route-secondary-material', 0x242c2d, 0.74, 0.42, 0x4d6760, 0.08);
    this.ownedMaterials = [accent, routePrimary, routeSecondary];
    this.materials = [floor, structural, dark, ...this.ownedMaterials];
    this.routeGlowMaterials.push(routePrimary, routeSecondary);

    this.root = new TransformNode('p27-c1-orbital-station-environment', scene);
    createBox(scene, this.root, 'p27-c1-orbital-floor', floor, cx, -0.055, cz, worldW, 0.11, worldH);

    const ribCount = Math.max(6, Math.floor(worldW / 5.8));
    for (let index = 0; index <= ribCount; index += 1) {
      const x = worldW * (index / ribCount);
      createBox(scene, this.root, `p27-c1-orbital-rib-top-${index}`, dark, x, 2.4, 0.34, 0.16, 4.8, 0.22);
      createBox(scene, this.root, `p27-c1-orbital-rib-bottom-${index}`, dark, x, 2.4, worldH - 0.34, 0.16, 4.8, 0.22);
      createBox(scene, this.root, `p27-c1-orbital-overhead-${index}`, structural, x, 4.75, cz, 0.18, 0.18, worldH * 0.95);
      for (const edge of [0.65, worldH - 0.65]) {
        createBox(scene, this.root, `p28-g1-rib-housing-${index}-${edge}`, dark, x, 2.84, edge, 0.36, 0.46, 0.27);
        createBox(scene, this.root, `p28-g1-rib-fastener-${index}-${edge}`, structural, x, 2.87, edge, 0.13, 0.13, 0.31);
      }
    }

    for (const z of [1.35, worldH - 1.35]) {
      for (const y of [1.7, 2.28]) {
        const pipe = MeshBuilder.CreateCylinder('p27-c1-orbital-service-pipe', {
          height: worldW * 0.88,
          diameter: 0.164,
          tessellation: 8,
        }, scene);
        pipe.parent = this.root;
        pipe.position.set(cx, y, z);
        pipe.rotation.z = Math.PI / 2;
        pipe.material = structural;
        pipe.isPickable = false;
      }
    }

    const addAirlock = (x: number, z: number, rotation: number, side: string) => {
      const group = new TransformNode(`p27-c1-orbital-airlock-${side}`, scene);
      group.parent = this.root;
      group.position.set(x, 0, z);
      group.rotation.y = rotation;
      createBox(scene, group, `p27-c1-orbital-airlock-${side}-frame`, structural, 0, 1.32, 0, 0.65, 2.65, 2.8);
      createBox(scene, group, `p27-c1-orbital-airlock-${side}-door`, dark, 0.34, 1.22, 0, 0.68, 1.9, 2.18);
      for (const sign of [-1, 1]) {
        createBox(scene, group, `p27-c1-orbital-airlock-${side}-guide-${sign}`, accent, 0.39, 1.22 + sign * 0.68, sign * 0.92, 0.72, 0.09, 0.16);
        createBox(scene, group, `p28-g1-airlock-seal-${side}-${sign}`, gasket, 0.7, 1.25, sign * 1.07, 0.085, 2.1, 0.11);
      }
    };
    addAirlock(0.35, worldH * 0.27, 0, 'port');
    addAirlock(worldW - 0.35, worldH * 0.73, Math.PI, 'starboard');

    for (let index = 0; index < 13; index += 1) {
      const x = 1.7 + (index / 12) * Math.max(1, worldW - 3.4);
      const topEdge = index % 2 === 0;
      const z = topEdge ? 1.1 + (index % 3) * 0.42 : worldH - 1.1 - (index % 3) * 0.42;
      const scale = 0.52 + (index % 4) * 0.1;
      const cargo = createBox(
        scene,
        this.root,
        `p27-c1-orbital-cargo-${index}`,
        index % 4 === 0 ? accent : structural,
        x,
        scale / 2,
        z,
        scale * 1.5,
        scale,
        scale,
      );
      cargo.rotation.y = ((index % 5) - 2) * 0.055;
      createBox(scene, this.root, `p28-g1-cargo-top-recess-${index}`, dark,
        x, scale + 0.022, z, scale * 1.24, 0.044, scale * 0.76);
    }

    for (let index = 0; index < 12; index += 1) {
      const x = 1.7 + ((index * 3.7) % Math.max(2, worldW - 3.4));
      const z = index % 2 === 0 ? 2.35 : worldH - 2.35;
      const scale = 0.82 + (index % 3) * 0.12;
      createBox(
        scene,
        this.root,
        `p27-c1-orbital-service-case-${index}`,
        structural,
        x,
        0.31 * scale,
        z,
        0.92 * scale * (index % 3 === 0 ? 1.25 : 1),
        0.62 * scale,
        0.72 * scale,
      );
    }

    for (let index = 0; index < 8; index += 1) {
      const post = MeshBuilder.CreateCylinder(`p27-c1-orbital-service-post-${index}`, {
        height: 1.5,
        diameterTop: 0.22,
        diameterBottom: 0.28,
        tessellation: 8,
      }, scene);
      post.parent = this.root;
      post.position.set(worldW * (0.12 + (index / 7) * 0.76), 0.75, index % 2 === 0 ? worldH * 0.13 : worldH * 0.87);
      post.material = accent;
      post.isPickable = false;
    }

    for (let index = -4; index <= 4; index += 1) {
      createBox(
        scene,
        this.root,
        `p27-c1-orbital-radial-spine-${index + 4}`,
        structural,
        cx + index * 5.1,
        (3.5 + (index % 3 === 0 ? 1.2 : 0)) / 2,
        cz + (index % 2 ? 7.2 : -7.2),
        0.72,
        3.5 + (index % 3 === 0 ? 1.2 : 0),
        3.8,
      );
    }

    const plan = getMapNavigationPlan('orbital-station');
    plan.routes.forEach(route => {
      for (let index = 0; index < route.points.length - 1; index += 1) {
        const a = route.points[index];
        const b = route.points[index + 1];
        const routeMaterial = route.kind === 'primary' ? routePrimary : routeSecondary;
        const width = scaled(route.kind === 'primary' ? 74 : route.kind === 'secondary' ? 50 : 36);
        createRouteSegment(
          scene,
          this.root,
          routeMaterial,
          `p27-c1-orbital-route-${route.id}-${index}`,
          scaled(a.x),
          scaled(a.y),
          scaled(b.x),
          scaled(b.y),
          width,
          0.018,
        );
      }
    });

    plan.landmarks.forEach((landmark, index) => {
      const x = scaled(landmark.x);
      const z = scaled(landmark.y);
      createBox(scene, this.root, `p27-c1-orbital-landmark-${landmark.id}`, structural, x, 1.65, z, 0.22, 3.3, 0.22);
      createBox(scene, this.root, `p27-c1-orbital-landmark-beacon-${index}`, accent, x, 3.15, z, 1.45, 0.14, 0.4);
    });

    for (const [index, normalizedX] of [0.25, 0.75].entries()) {
      const x = worldW * normalizedX;
      const z = worldH * (index === 0 ? 0.22 : 0.78);
      createBox(scene, this.root, `p28-g1-practical-housing-${index}`, dark, x, 3.74, z, 1.1, 0.21, 0.62);
      createBox(scene, this.root, `p28-g1-practical-emitter-${index}`,
        this.fixtureMaterial, x, 3.61, z, 0.75, 0.045, 0.42);
    }
    const sharedMaterials = new Set(this.premiumSurfaces.materials.values());
    this.premiumBindingCount = this.root.getChildMeshes(false)
      .filter(mesh => mesh.material instanceof PBRMaterial && sharedMaterials.has(mesh.material)).length;

    // Contact decals borrow the proven P28 alpha generator and never touch collision.
    const groundingSize = REFINERY_ACTOR_GROUNDING_PROFILE.alphaTextureSize;
    this.groundingTexture = RawTexture.CreateRGBATexture(
      createRefineryContactDepthAlphaData(groundingSize), groundingSize, groundingSize, scene, false, false,
    );
    this.groundingTexture.hasAlpha = true;
    this.groundingMaterial = new StandardMaterial('p28-g1-orbital-contact-material', scene);
    this.groundingMaterial.diffuseColor = new Color3(0.015, 0.022, 0.023);
    this.groundingMaterial.specularColor = Color3.Black();
    this.groundingMaterial.diffuseTexture = this.groundingTexture;
    this.groundingMaterial.useAlphaFromDiffuseTexture = true;
    this.groundingMaterial.disableLighting = true;
    this.groundingMaterial.disableDepthWrite = true;
    this.groundingMaterial.backFaceCulling = false;
    this.groundingMaterial.alpha = 0.26;
    this.groundingSource = MeshBuilder.CreatePlane('p28-g1-orbital-player-contact',
      { width: 1, height: 1, sideOrientation: Mesh.DOUBLESIDE }, scene);
    this.groundingSource.parent = this.root;
    this.groundingSource.material = this.groundingMaterial;
    this.groundingSource.isPickable = false;
    this.groundingSource.alphaIndex = -300;
    this.groundingSource.rotation.x = Math.PI / 2;
    this.meshCount = this.root.getChildMeshes(false).length;
    this.root.setEnabled(false);

    // Reuse the shipped P28 prefiltered reflection asset at restrained, cool-route intensity.
    this.iblTexture = new CubeTexture('/assets/environments/refinery-prefiltered.env',
      scene, undefined, false, undefined,
      () => { this.iblReady = true; }, () => { this.iblReady = false; }, undefined, true);
    this.iblTexture.name = 'p28-g1-orbital-shared-prefiltered-ibl';
    this.iblTexture.gammaSpace = false;

    const lighting = BABYLON_ORBITAL_STATION_LIGHTING;
    this.hemisphere = new HemisphericLight('p27-c1-orbital-hemisphere', new Vector3(-0.45, 1, 0.32), scene);
    this.hemisphere.diffuse = colorFromHex(0xb8d0ca);
    this.hemisphere.groundColor = colorFromHex(0x17201f);
    this.hemisphere.intensity = 0.54;

    this.keyLight = new DirectionalLight('p27-c1-orbital-key', new Vector3(-0.48, -1, -0.26).normalize(), scene);
    this.keyLight.position = new Vector3(worldW * 0.66, 16, worldH * 0.2);
    this.keyLight.diffuse = colorFromHex(lighting.keyColor);
    this.keyLight.intensity = lighting.keyIntensity;

    this.rimLight = new DirectionalLight('p27-c1-orbital-rim', new Vector3(0.58, -0.8, 0.34).normalize(), scene);
    this.rimLight.position = new Vector3(worldW * 0.22, 10, worldH * 0.78);
    this.rimLight.diffuse = colorFromHex(lighting.rimColor);
    this.rimLight.intensity = lighting.rimIntensity;

    this.emergencyLight = new PointLight('p27-c1-orbital-emergency', new Vector3(cx, 3.1, cz), scene);
    this.emergencyLight.diffuse = colorFromHex(lighting.emergencyColor);
    this.emergencyLight.intensity = 0;
    this.emergencyLight.range = 8.8;

    this.readabilityLight = new PointLight('p27-c1-orbital-readability', new Vector3(cx, 2.7, cz), scene);
    this.readabilityLight.diffuse = colorFromHex(0xcbe4dd);
    this.readabilityLight.intensity = 0;
    this.readabilityLight.range = 9.5;

    this.practicalLights = [0.25, 0.75].map((normalizedX, index) => {
      const light = new PointLight(`p27-c1-orbital-practical-${index}`, new Vector3(worldW * normalizedX, 3.7, worldH * (index === 0 ? 0.22 : 0.78)), scene);
      light.diffuse = colorFromHex(index === 0 ? 0x83c6bd : 0xa6d5cd);
      light.intensity = 0;
      light.range = 8;
      return light;
    }) as unknown as readonly [PointLight, PointLight];

    this.setLightingEnabled(false);
  }

  sync(state: SimState, renderBudget: RenderBudgetSnapshot, lowVisibility: boolean) {
    this.released = false;
    this.root.setEnabled(true);
    this.setLightingEnabled(true);

    const lighting = BABYLON_ORBITAL_STATION_LIGHTING;
    const tierScale = renderBudget.tierName === 'high' ? 1 : renderBudget.tierName === 'balanced' ? 0.88 : 0.72;
    this.hemisphere.intensity = 0.54 * (renderBudget.tierName === 'performance' ? 0.86 : 1);
    this.keyLight.intensity = lighting.keyIntensity * tierScale * (lowVisibility ? 0.92 : 1);
    this.rimLight.intensity = lighting.rimIntensity * (renderBudget.tierName === 'performance' ? 0.76 : 1);

    const px = scaled(state.player.x);
    const pz = scaled(state.player.y);
    this.groundingMaterial.alpha = renderBudget.tierName === 'performance' ? 0.18 : 0.26;
    this.groundingSource.position.set(px, 0.044, pz);
    this.groundingSource.scaling.set(0.98, 0.65, 1);
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
        contact = this.groundingSource.createInstance('p28-g1-orbital-enemy-contact-' + enemy.id);
        contact.parent = this.root;
        contact.isPickable = false;
        contact.alphaIndex = -300;
        this.enemyGrounding.set(enemy.id, contact);
      }
      const size = refineryActorGroundingScale(enemy.role);
      contact.position.set(scaled(enemy.x), 0.043, scaled(enemy.y));
      contact.rotation.x = Math.PI / 2;
      contact.scaling.set(0.98 * size, 0.65 * size, 1);
    }
    for (const [id, contact] of this.enemyGrounding) {
      if (!nearby.has(id)) {
        contact.dispose();
        this.enemyGrounding.delete(id);
      }
    }
    const activeBoss = state.enemies.find(enemy => enemy.active && !enemy.dead && enemy.role === 'boss') ?? null;
    const dangerPulse = activeBoss?.bossPhase === 2 ? 1 + Math.sin(state.time * 4.6) * 0.16 : 1;
    const damagedGrid = state.hazards.some(hazard => hazard.active && hazard.kind === 'shockGrid');
    this.emergencyLight.position.set(px + 2.2, 3.1, pz - 2);
    this.emergencyLight.intensity = (damagedGrid ? lighting.emergencyIntensity * 0.23 : 0.52) * tierScale * dangerPulse;
    this.readabilityLight.position.set(px, 2.6, pz);
    this.readabilityLight.intensity = 1.08 * (renderBudget.tierName === 'performance' ? 0.72 : 1);

    const practicalCount = renderBudget.tierName === 'performance' ? 1 : 2;
    this.practicalLights.forEach((light, index) => {
      const enabled = index < practicalCount;
      light.setEnabled(enabled);
      light.intensity = enabled ? (index === 0 ? 1.55 : 1.28) * tierScale : 0;
    });

    this.fixtureMaterial.emissiveColor = new Color3(0.66, 0.86, 0.81).scale(
      renderBudget.tierName === 'performance' ? 0.62 : tierScale);
    const routePulse = 0.88 + Math.sin(state.time * 3.8) * 0.12;
    this.routeGlowMaterials[0].emissiveColor = colorFromHex(0x7aa99c).scale(0.22 * routePulse);
    this.routeGlowMaterials[1].emissiveColor = colorFromHex(0x4d6760).scale(0.08 * routePulse);

    this.scene.environmentTexture = this.iblReady ? this.iblTexture : null;
    this.scene.environmentIntensity = this.iblReady ? 0.32 * tierScale : 0;
    this.scene.imageProcessingConfiguration.toneMappingEnabled = true;
    this.scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    this.scene.imageProcessingConfiguration.exposure = lighting.exposure * (lowVisibility ? 0.96 : 1);
    this.scene.imageProcessingConfiguration.contrast = 1;

    const pbrCount = this.scene.materials.filter(material => material instanceof PBRMaterial).length;
    this.canvas.dataset.babylonEnvironmentState = 'ready';
    this.canvas.dataset.environmentVisual = 'procedural-orbital-station-babylon';
    this.canvas.dataset.environmentKit = 'floor,radial-spine,ribs,airlocks,pipes,service-cases,wayfinding';
    this.canvas.dataset.environmentInstances = String(this.meshCount);
    this.canvas.dataset.environmentTerminals = String(this.practicalLights.length);
    this.canvas.dataset.environmentLandmark = 'radial-spine';
    this.canvas.dataset.environmentServiceDetails = 'service-cases:12+posts:8';
    this.canvas.dataset.environmentComposition = 'primary-spine+pressure-ribs+airlocks+perimeter-service';
    this.canvas.dataset.locationArtIdentity = 'radial-spine|clean-industrial|neutral-cyan|service-cases';
    this.canvas.dataset.babylonOrbitalParity = 'architecture+materials+lighting+props+navigation+shared-world-cues';
    this.canvas.dataset.babylonOrbitalPlayerPosition = `${state.player.x.toFixed(1)},${state.player.y.toFixed(1)}`;
    this.canvas.dataset.babylonOrbitalRoutes = String(getMapNavigationPlan('orbital-station').routes.length);
    this.canvas.dataset.babylonOrbitalLandmarks = getMapNavigationPlan('orbital-station').landmarks.map(item => item.label).join('|');
    this.canvas.dataset.babylonLightingProfile = lighting.id;
    this.canvas.dataset.babylonMaterialIntent = 'premium-ktx2-pbr+wayfinding-emissives+shared-world-pbr';
    const premiumReady = BABYLON_ORBITAL_PREMIUM_SURFACES.every(id => {
      const material = this.premiumSurfaces.get(id);
      return material.albedoTexture?.isReady() === true
        && material.bumpTexture?.isReady() === true
        && material.metallicTexture?.isReady() === true
        && (!material.emissiveTexture || material.emissiveTexture.isReady());
    });
    this.canvas.dataset.orbitalPremiumAssetState = premiumReady ? 'ready' : 'loading';
    this.canvas.dataset.orbitalPremiumBindings = String(this.premiumBindingCount);
    this.canvas.dataset.orbitalPremiumSurfaces = BABYLON_ORBITAL_PREMIUM_SURFACES.join(',');
    this.canvas.dataset.orbitalGrounding = 'player+enemies:soft-contact';
    this.canvas.dataset.orbitalGroundedEnemies = String(nearby.size);
    this.canvas.dataset.babylonLightingBudget = `tier:${renderBudget.tierName}|practical:${practicalCount}|shadows:off`;
    this.canvas.dataset.environmentIbl = this.iblReady ? 'shared-prefiltered:ready' : 'shared-prefiltered:loading';
    this.canvas.dataset.environmentLighting = `orbital-key+rim+emergency+readability+practical:${practicalCount}`;
    this.canvas.dataset.environmentShadowBudget = 'contact-only:orbital-station';
    this.canvas.dataset.environmentTone = `aces-${this.scene.imageProcessingConfiguration.exposure.toFixed(2)}`;
    this.canvas.dataset.locationLighting = `orbital-station:neutral-cyan:aces-${this.scene.imageProcessingConfiguration.exposure.toFixed(2)}`;
    this.canvas.dataset.babylonPbrMaterials = `pbr:${pbrCount}|station:${this.materials.length}`;
    this.canvas.dataset.renderTier = renderBudget.tierName;
    this.canvas.dataset.graphicsQuality = renderBudget.qualityMode;
  }

  release(reason: string) {
    if (this.released) return;
    this.released = true;
    this.root.setEnabled(false);
    this.setLightingEnabled(false);
    this.canvas.dataset.babylonOrbitalRelease = reason;
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
    this.ownedMaterials.forEach(material => material.dispose());
    this.premiumSurfaces.dispose();
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
