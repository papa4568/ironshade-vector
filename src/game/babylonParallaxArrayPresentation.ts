import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { CubeTexture } from '@babylonjs/core/Materials/Textures/cubeTexture';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { getMapNavigationPlan } from './mapNavigation';
import { createBabylonPremiumPbrSurfaceLibrary, type BabylonPremiumPbrSurfaceLibrary } from './babylonPremiumPbrSurfaceLibrary';
import { babylonRouteMarkingWidth, BABYLON_ROUTE_MARKING_WIDTHS } from './babylonRouteMarkings';
import type { RenderBudgetSnapshot } from './renderQuality';
import { getWorldSize, type CombatObject, type SimState } from './sim';

const WORLD_SCALE = 0.02;

/** Existing shipped KTX2 base/normal/ORM surfaces reused throughout the metrology facility. */
export const BABYLON_PARALLAX_PREMIUM_SURFACES = [
  'deck-plate', 'painted-metal', 'bare-metal', 'polymer-rubber', 'emissive-fixture',
] as const;

export const BABYLON_PARALLAX_ARRAY_IDENTITY = Object.freeze({
  silhouette: 'baseline-pylons',
  material: 'metrology-composite',
  lighting: 'reference-violet',
  propSet: 'inertial-reference',
});

export const BABYLON_PARALLAX_ARRAY_LIGHTING = Object.freeze({
  id: 'reference-violet',
  keyColor: 0xc3c9e6,
  rimColor: 0x9666dc,
  emergencyColor: 0x7864ba,
  keyIntensity: 2.4,
  rimIntensity: 1.75,
  emergencyIntensity: 7.5,
  exposure: 1.12,
});

export type ParallaxArrayRenderProfile = {
  name: 'full' | 'balanced' | 'mobile' | 'performance';
  frameInstances: number;
  carriageInstances: number;
  anchorInstances: number;
  shearInstances: number;
};

export function parallaxArrayRenderProfile(detailScale: number, _coarse: boolean): ParallaxArrayRenderProfile {
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

// Project the center of the tall optical ornament into the real gameplay
// viewport. A partly cropped holographic ring reads like a broken objective
// marker at the bottom edge; hide only that ornament when its center is in the
// lower edge zone, keeping the grounded PBR column and physical amber target.
export function parallaxReferenceRingFitsFrame(projectedY: number, viewportTop: number, viewportHeight: number): boolean {
  return Number.isFinite(projectedY) && Number.isFinite(viewportTop)
    && Number.isFinite(viewportHeight) && viewportHeight > 0
    && projectedY <= viewportTop + viewportHeight * 0.80;
}

type PylonRig = { id: string; root: TransformNode; rings: Mesh[]; core: Mesh; gauge: TransformNode; gaugeFace: Mesh };
type ShearRig = { root: TransformNode; disc: Mesh; ring: Mesh };

export class BabylonParallaxArrayPresentation {
  private readonly root: TransformNode;
  private readonly materials: PBRMaterial[];
  private readonly ownedMaterials: PBRMaterial[];
  private readonly premiumSurfaces: BabylonPremiumPbrSurfaceLibrary;
  private readonly premiumBindingCount: number;
  private readonly iblTexture: CubeTexture;
  private readonly datumAlbedoTexture: DynamicTexture;
  private readonly datumNormalTexture: DynamicTexture;
  private readonly calibrationDisplayTexture: DynamicTexture;
  private readonly calibrationDisplayMaterial: StandardMaterial;
  private readonly pylonVernierTexture: DynamicTexture;
  private readonly pylonVernierMaterial: StandardMaterial;
  // One small, camera-readable engraved identity plate per real standard.
  // Owned once per route and released with the presentation; never HUD text.
  private readonly pylonIndexTextures: DynamicTexture[] = [];
  private readonly pylonIndexMaterials: StandardMaterial[] = [];
  private iblReady = false;
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
  private readonly eliteTellMaterial: StandardMaterial;
  private readonly objectiveSignalMaterial: StandardMaterial;
  private readonly eliteTellRing: Mesh;
  private readonly eliteContactBeacon: Mesh;
  private readonly bossCueRoot: TransformNode;
  private readonly bossCrown: Mesh[] = [];
  private readonly bossCore: Mesh;
  private readonly bossWarning: Mesh;
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
    this.premiumSurfaces = createBabylonPremiumPbrSurfaceLibrary(scene);
    const floor = this.premiumSurfaces.get('deck-plate');
    const graphite = this.premiumSurfaces.get('bare-metal');
    const shell = this.premiumSurfaces.get('painted-metal');
    const insulation = this.premiumSurfaces.get('polymer-rubber');
    const fixture = this.premiumSurfaces.get('emissive-fixture');
    // These subtle tint multipliers preserve shipped KTX2 base/normal/ORM relief.
    // Distinct dark machine pockets give raised brass indices and objective signals
    // actual contrast instead of a wall of cream-colored fixture blocks.
    graphite.albedoColor = colorFromHex(0x617d90);
    shell.albedoColor = colorFromHex(0x708897);
    const violet = pbr(scene, 'p27-c10-violet-alignment', 0x665680, 0.44, 0.46, 0x9a87cf, 0.34);
    const cyan = pbr(scene, 'p27-c10-cyan-readout', 0x48767b, 0.38, 0.39, 0x82d7df, 0.44);
    // Pale enamel indices are trim on shipped KTX2 painted/metal structure,
    // not replacement base materials or wide glowing navigation ribbons.
    const etched = pbr(scene, 'p28-g9-etched-datum-enamel', 0x718f9b, 0.48, 0.68, 0x37637b, 0.055);
    const indexed = pbr(scene, 'p28-g9-indexed-violet-enamel', 0x49336e, 0.16, 0.87, 0xa16be2, 0.24);
    // A machined warm-metal standard separates instrument calibration from
    // violet danger cues and cyan status without replacing textured housings.
    const graduation = pbr(scene, 'p28-g9-machined-brass-datum', 0x856747, 0.35, 0.76);
    const fiducialBrass = pbr(scene, 'p28-g9-bold-graduated-brass', 0x816a50, 0.54, 0.78, 0x8f7654, 0.025);
    const calibrationInk = pbr(scene, 'p28-g9-contrasting-machined-scale-graduations', 0xc6ad84, 0.58, 0.86, 0xb98f56, 0.21);
    const counterweightMetal = pbr(scene, 'p28-g9-moving-inertial-counterweight', 0x344c59, 0.22, 0.94, 0x1b3641, 0.035);
    const shearCeramic = pbr(scene, 'p28-g9-insulated-violet-shear-ceramic', 0x45345f, 0.08, 0.92, 0x7862b7, 0.36);
    const referenceScreen = pbr(scene, 'p28-g9-calibration-console-screen', 0x163849, 0.18, 0.48, 0x72d1c7, 0.28);
    // Physically rough, warm metal is structural trim; do not let strong PBR
    // key light wash active objective lamps into ambiguous cream rings.
    const objectiveGold = pbr(scene, 'p28-g9-physical-datum-objective-beacon', 0x815733, 0.40, 0.75, 0xa76c34, 0.16);
    // A saturated physical instrument target needs a stable, actual rendered
    // orange surface even under the many white PBR survey work lights.
    // Keep it bolted to the pylon, never to the camera or HUD overlay.
    this.objectiveSignalMaterial = new StandardMaterial('p28-g9-amber-mechanical-target-signal', scene);
    this.objectiveSignalMaterial.diffuseColor = colorFromHex(0xc4550b);
    this.objectiveSignalMaterial.emissiveColor = colorFromHex(0xff861b).scale(0.84);
    this.objectiveSignalMaterial.specularColor = Color3.Black();
    this.objectiveSignalMaterial.disableLighting = true;
    this.datumAlbedoTexture = new DynamicTexture('p28-g9-metrology-machined-etched-atlas',
      { width: 128, height: 128 }, scene, false);
    this.datumNormalTexture = new DynamicTexture('p28-g9-metrology-etched-normal-atlas',
      { width: 128, height: 128 }, scene, false);
    const datumPaint = this.datumAlbedoTexture.getContext();
    const datumNormal = this.datumNormalTexture.getContext();
    datumPaint.fillStyle = '#a3b3bc'; datumPaint.fillRect(0, 0, 128, 128);
    datumNormal.fillStyle = '#8080ff'; datumNormal.fillRect(0, 0, 128, 128);
    // Longitudinal machine-scored relief and alternating major/minor fiducial
    // ticks are real albedo+normal material channels, not decorative HUD text.
    for (let graduationIndex = 0; graduationIndex < 128; graduationIndex += 4) {
      const major = graduationIndex % 16 === 0;
      datumPaint.fillStyle = major ? '#4a606b' : '#748995';
      datumPaint.fillRect(graduationIndex, 0, major ? 2 : 1, 128);
      datumNormal.fillStyle = major ? '#6980ef' : '#987ff5';
      datumNormal.fillRect(graduationIndex, 0, major ? 2 : 1, 128);
      if (major) {
        datumPaint.fillStyle = '#d6d0b2';
        datumPaint.fillRect(graduationIndex + 1, 14, 4, 3);
        datumPaint.fillRect(graduationIndex + 1, 78, 4, 3);
      }
    }
    this.datumAlbedoTexture.update();
    this.datumNormalTexture.update();
    // Large instrument-grade top-facing engraving, not more tiny cuboid
    // notches. The actual overhead phone camera can resolve its numbered
    // reference scale and pointer while mechanical rails remain KTX2 PBR.
    this.calibrationDisplayTexture = new DynamicTexture('p28-g9-physical-datum-numbered-display',
      { width: 512, height: 256 }, scene, false);
    const displayInk = this.calibrationDisplayTexture.getContext();
    displayInk.fillStyle = '#0b1a23';
    displayInk.fillRect(0, 0, 512, 256);
    displayInk.strokeStyle = '#627d85';
    displayInk.lineWidth = 9;
    displayInk.strokeRect(8, 8, 496, 240);
    displayInk.fillStyle = '#e2d3a5';
    displayInk.font = 'bold 65px monospace';
    displayInk.fillText('DATUM', 34, 79);
    displayInk.fillStyle = '#61b8c6';
    displayInk.fillRect(34, 96, 445, 7);
    for (let station = 0; station <= 12; station++) {
      const major = station % 3 === 0;
      const x = 39 + station * 35;
      displayInk.fillStyle = major ? '#e1c48d' : '#8cb9bb';
      displayInk.fillRect(x, 116, major ? 10 : 6, major ? 66 : 37);
      if (major) {
        displayInk.font = 'bold 28px monospace';
        displayInk.fillText(String(station).padStart(2, '0'), x - 8, 217);
      }
    }
    displayInk.fillStyle = '#ff9a38';
    displayInk.beginPath();
    displayInk.moveTo(274, 109);
    displayInk.lineTo(252, 143);
    displayInk.lineTo(296, 143);
    displayInk.closePath();
    displayInk.fill();
    this.calibrationDisplayTexture.update();
    this.calibrationDisplayMaterial = new StandardMaterial('p28-g9-actual-engraved-metrology-display', scene);
    this.calibrationDisplayMaterial.diffuseTexture = this.calibrationDisplayTexture;
    this.calibrationDisplayMaterial.emissiveTexture = this.calibrationDisplayTexture;
    this.calibrationDisplayMaterial.emissiveColor = Color3.White().scale(0.56);
    this.calibrationDisplayMaterial.specularColor = Color3.Black();
    this.calibrationDisplayMaterial.disableLighting = true;
    this.calibrationDisplayMaterial.backFaceCulling = false;
    // Real vertical optical vernier, physically bolted beside each spindle:
    // large numbered major stations and readable intermediate tick lengths.
    // A narrow dark instrument window avoids another full-width billboard.
    this.pylonVernierTexture = new DynamicTexture('p28-g9-vertical-vernier-etched-metal-atlas',
      { width: 256, height: 512 }, scene, false);
    const vernierInk = this.pylonVernierTexture.getContext();
    vernierInk.fillStyle = '#14222b';
    vernierInk.fillRect(0, 0, 256, 512);
    vernierInk.fillStyle = '#354c56';
    vernierInk.fillRect(102, 36, 5, 432);
    for (let station = 0; station < 9; station++) {
      const y = 52 + station * 49;
      const major = station % 4 === 0;
      vernierInk.fillStyle = major ? '#f0d8a8' : '#8cc4cb';
      vernierInk.fillRect(112, y, major ? 107 : 61, major ? 9 : 5);
      if (major) {
        vernierInk.font = 'bold 34px monospace';
        vernierInk.fillText(String(station).padStart(2, '0'), 19, y + 11);
      }
    }
    this.pylonVernierTexture.update();
    this.pylonVernierMaterial = new StandardMaterial('p28-g9-vertical-vernier-instrument-glass', scene);
    this.pylonVernierMaterial.diffuseTexture = this.pylonVernierTexture;
    this.pylonVernierMaterial.emissiveTexture = this.pylonVernierTexture;
    this.pylonVernierMaterial.emissiveColor = Color3.White().scale(0.52);
    this.pylonVernierMaterial.specularColor = Color3.Black();
    this.pylonVernierMaterial.disableLighting = true;
    this.pylonVernierMaterial.backFaceCulling = false;

    etched.albedoTexture = this.datumAlbedoTexture;
    etched.bumpTexture = this.datumNormalTexture;
    indexed.bumpTexture = this.datumNormalTexture;
    graduation.bumpTexture = this.datumNormalTexture;
    counterweightMetal.albedoTexture = this.datumAlbedoTexture;
    counterweightMetal.bumpTexture = this.datumNormalTexture;
    fiducialBrass.bumpTexture = this.datumNormalTexture;
    // Recessed navigational inlays never compete with vector-wash or boss telegraphs.
    const routePrimary = pbr(scene, 'p27-c10-route-primary', 0x29233b, 0.16, 0.90, 0x655485, 0.026);
    const routeSecondary = pbr(scene, 'p27-c10-route-secondary', 0x192c32, 0.14, 0.94, 0x36626a, 0.014);
    this.ownedMaterials = [violet, cyan, etched, indexed, graduation, fiducialBrass, calibrationInk, counterweightMetal, shearCeramic, referenceScreen, objectiveGold, routePrimary, routeSecondary];
    this.materials = [...this.premiumSurfaces.materials.values(), ...this.ownedMaterials];
    this.routeMaterials = [routePrimary, routeSecondary];
    // Diffuse bounced fill lifts dark floor relief without replacing KTX2 channels.
    floor.emissiveColor = colorFromHex(0x42566f).scale(0.10);
    // Distant, textured maintenance-hall floor is set down below the sealed
    // mission boundary. The real game deck remains clearly bounded by rails,
    // while camera corners show a built laboratory rather than empty void.
    box(scene, this.root, 'p28-g9-outboard-metrology-hall-deck', floor,
      cx, -0.56, cz, worldW + 32, 0.20, worldH + 32);
    box(scene, this.root, 'p27-c10-parallax-floor-mesh', floor, cx, -0.08, cz, worldW, 0.16, worldH);
    // Frame the survey deck against space without opaque walls or blocking
    // collision/pathing. These low, contrasting edge rails provide scale and a
    // visible termination for the otherwise black surrounding environment.
    for (const side of [-1, 1]) {
      box(scene, this.root, 'p28-g9-perimeter-long-rail-' + side,
        shell, cx + side * (worldW / 2 - 0.26), 0.19, cz, 0.26, 0.38, worldH - 0.6);
      box(scene, this.root, 'p28-g9-perimeter-cross-rail-' + side,
        graphite, cx, 0.19, cz + side * (worldH / 2 - 0.26), worldW - 0.6, 0.38, 0.26);
    }

    // The inertial array is a pressurized survey facility, not a platform
    // suspended in an empty black void. Service aprons, calibration gantries,
    // column shoes and suspended conduits live OUTSIDE the playable floor:
    // purely visual depth with no new collision, route or interaction state.
    for (const side of [-1, 1]) {
      box(scene, this.root, 'p28-g9-survey-apron-long-' + side,
        floor, cx, -0.35, cz + side * (worldH / 2 + 1.65),
        worldW + 6.3, 0.26, 3.3);
      box(scene, this.root, 'p28-g9-survey-apron-cross-' + side,
        floor, cx + side * (worldW / 2 + 1.65), -0.35, cz,
        3.3, 0.26, worldH + 6.3);
      box(scene, this.root, 'p28-g9-exterior-survey-truss-' + side,
        shell, cx, 4.55, cz + side * (worldH / 2 + 2.6),
        worldW + 3.4, 0.36, 0.52);
      for (let bay = 0; bay < 6; bay++) {
        const x = worldW * (bay + 0.5) / 6;
        const z = cz + side * (worldH / 2 + 2.35);
        box(scene, this.root, 'p28-g9-survey-truss-leg-' + side + '-' + bay,
          graphite, x, 2.30, z, 0.46, 4.55, 0.60);
        box(scene, this.root, 'p28-g9-survey-truss-foot-' + side + '-' + bay,
          shell, x, 0.28, z, 1.02, 0.56, 1.15);
        box(scene, this.root, 'p28-g9-survey-truss-reference-' + side + '-' + bay,
          graduation, x, 3.85, z - side * 0.38, 0.28, 0.72, 0.14);
        box(scene, this.root, 'p28-g9-survey-truss-violet-service-' + side + '-' + bay,
          indexed, x, 4.80, z - side * 0.38, 0.65, 0.12, 0.14);
      }
      // Parallel instrument-feed pipes run along the service apron, not
      // through the navigable mission route or live hazard warning lanes.
      for (const offset of [0, 0.44]) {
        box(scene, this.root, 'p28-g9-survey-apron-feed-' + side + '-' + offset,
          offset ? insulation : graphite, cx, 0.20,
          cz + side * (worldH / 2 + 0.84 + offset),
          worldW - 1.8, 0.18, 0.14);
      }
    }

    // Non-navigable exterior survey rooms and lit precision-wall ribs frame
    // the platform. They are rendered with the shared KTX2 metals and never
    // added to game state, collision, navigation, objectives or enemy logic.
    for (const side of [-1, 1]) {
      box(scene, this.root, 'p28-g9-service-hall-back-wall-' + side,
        shell, cx, 1.50, cz + side * (worldH / 2 + 11.8), worldW + 31, 3.00, 0.45);
      box(scene, this.root, 'p28-g9-service-hall-side-wall-' + side,
        shell, cx + side * (worldW / 2 + 11.8), 1.50, cz, 0.45, 3.00, worldH + 31);
      for (let bay = 0; bay < 6; bay++) {
        const bayX = cx + (bay - 2.5) * (worldW + 22) / 6;
        const bayZ = cz + side * (worldH / 2 + 10.9);
        box(scene, this.root, 'p28-g9-service-hall-panel-' + side + '-' + bay,
          graphite, bayX, 1.48, bayZ, 2.5, 2.40, 0.24);
        box(scene, this.root, 'p28-g9-service-hall-survey-window-' + side + '-' + bay,
          indexed, bayX, 2.20, bayZ - side * 0.19, 1.66, 0.42, 0.10);
        box(scene, this.root, 'p28-g9-service-hall-calibration-ruler-' + side + '-' + bay,
          graduation, bayX, 0.66, bayZ - side * 0.19, 1.40, 0.12, 0.12);
      }
    }
        const pylonFallback = [
      ['reference-node-a', 500, 300],
      ['reference-node-b', 980, 760],
      ['reference-node-c', 1400, 300],
    ] as const;
    // Physical long-baseline datum bars tie the actual three reference
    // stations together. Low, dark, rough housings carry separate warm
    // engraved pitch marks: these are steel metrology instruments, not cyan
    // luminous navigation ribbons or new collision geometry.
    const baselineVectors = [
      [500, 300, 980, 760],
      [980, 760, 1400, 300],
      [500, 300, 1400, 300],
    ] as const;
    baselineVectors.forEach(([ax, az, bx, bz], baseline) => {
      const dx = scaled(bx - ax);
      const dz = scaled(bz - az);
      const length = Math.hypot(dx, dz);
      const rotationY = -Math.atan2(dz, dx);
      const centerX = scaled((ax + bx) / 2);
      const centerZ = scaled((az + bz) / 2);
      const datum = box(scene, this.root, 'p28-g9-physical-reference-baseline-' + baseline,
        graphite, centerX, 0.10, centerZ, length, 0.18, 0.26);
      datum.rotation.y = rotationY;
      for (let index = 1; index < 14; index++) {
        const fraction = index / 14 - 0.5;
        const localX = fraction * length;
        const tick = box(scene, datum, 'p28-g9-physical-datum-graduation-' + baseline + '-' + index,
          index % 5 === 0 ? graduation : etched, localX, 0.11, 0, 0.16, 0.045,
          index % 5 === 0 ? 0.60 : 0.36);
        tick.isPickable = false;
      }
      // Paired shielded conductor bars make this a working interferometer
      // reference, not a dotted route painted on the floor.
      for (const side of [-1, 1]) {
        box(scene, datum, 'p28-g9-calibrated-baseline-conductor-' + baseline + '-' + side,
          fiducialBrass, 0, 0.055, side * 0.36, length - 0.34, 0.06, 0.065);
      }
      for (let foot = 1; foot < 5; foot++) {
        const support = box(scene, datum, 'p28-g9-reference-isolator-foot-' + baseline + '-' + foot,
          insulation, (foot / 5 - 0.5) * length, -0.04, 0, 0.36, 0.18, 0.42);
        support.isPickable = false;
      }
    });

    pylonFallback.forEach(([id, x, z], index) => {
      const root = new TransformNode('p27-c10-baseline-pylon-' + index, scene);
      root.parent = this.root;
      root.position.set(scaled(x), 0, scaled(z));
      // An anchored steel survey island separates each objective from the
      // uniform diamond-plate floor. Its broad dark plinth, corner anchors,
      // numbered gold scales and open objective frame are actual deck hardware,
      // not a floating marker or a new simulation collider.
      box(scene, root, 'p28-g9-pylon-machined-service-plinth-' + index,
        graphite, 0, 0.14, 0, 5.40, 0.28, 4.65);
      box(scene, root, 'p28-g9-pylon-plinth-center-ceramic-' + index,
        shell, 0, 0.30, 0, 3.25, 0.06, 2.45);
      for (const side of [-1, 1]) {
        box(scene, root, 'p28-g9-pylon-plinth-long-guide-' + index + '-' + side,
          insulation, side * 2.43, 0.34, 0, 0.32, 0.20, 4.02);
        box(scene, root, 'p28-g9-pylon-plinth-objective-rail-' + index + '-' + side,
          objectiveGold, side * 2.38, 0.43, 0, 0.20, 0.12, 3.36);
        for (const front of [-1, 1]) {
          const foot = box(scene, root, 'p28-g9-pylon-plinth-bolted-shoe-' + index + '-' + side + '-' + front,
            shell, side * 2.25, 0.35, front * 1.80, 0.52, 0.25, 0.70);
          foot.isPickable = false;
          box(scene, root, 'p28-g9-pylon-plinth-objective-corner-' + index + '-' + side + '-' + front,
            objectiveGold, side * 2.42, 0.53, front * 1.83, 0.40, 0.16, 0.45);
        }
      }
      // The large, raised gold scale is perpendicular to the darker rails;
      // major and minor stations can be counted in overhead real gameplay.
      box(scene, root, 'p28-g9-pylon-large-front-scale-bed-' + index,
        insulation, 0, 0.44, 2.04, 3.85, 0.18, 0.46);
      for (let graduation = 0; graduation < 9; graduation++) {
        box(scene, root, 'p28-g9-pylon-large-scale-tick-' + index + '-' + graduation,
          graduation % 4 === 0 ? objectiveGold : fiducialBrass,
          (graduation - 4) * 0.43, 0.55, 2.04, graduation % 4 === 0 ? 0.24 : 0.13, 0.11,
          graduation % 4 === 0 ? 0.74 : 0.42);
      }
      // Triplet of unmistakable objective lamps on a real bolted pedestal.
      // Unlike the pale rotary calibration rings, they use warm amber boxes.
      for (let lamp = 0; lamp < 3; lamp++) {
        box(scene, root, 'p28-g9-pylon-physical-align-target-' + index + '-' + lamp,
          objectiveGold, -0.66 + lamp * 0.66, 1.12, 2.17, 0.42, 0.65, 0.34);
      }
      // Real APK detail review: the three distant reference pylons still
      // read as dark stacked crates, because sub-pixel front labels and a
      // single pale top ring conceal the metrology profile. Expose a textured,
      // faceted radial micrometer and *large* machined station marks on
      // each physical column. All components are bolted to the real pylon,
      // never the camera, HUD, navigation or simulation collision geometry.
      const micrometerDrum = MeshBuilder.CreateCylinder('p28-g9-pylon-machined-faceted-micrometer-' + index,
        { diameter: 2.76, height: 0.52, tessellation: 20 }, scene);
      micrometerDrum.parent = root;
      micrometerDrum.position.set(0, 3.67, 0);
      micrometerDrum.material = counterweightMetal;
      micrometerDrum.isPickable = false;
      for (let station = 0; station < 12; station++) {
        const angle = station * Math.PI / 6;
        const major = station % 3 === 0;
        const segment = box(scene, root,
          'p28-g9-pylon-rotary-micrometer-engraved-station-' + index + '-' + station,
          major ? calibrationInk : fiducialBrass,
          Math.cos(angle) * 1.27, 3.99, Math.sin(angle) * 1.27,
          major ? 0.32 : 0.18, 0.11, major ? 0.48 : 0.29);
        segment.rotation.y = -angle;
      }
      // A physically linked, two-axis conductor pair and five-step bronze
      // calibration comb distinguish an instrumented standard from plinth
      // blocks at combat zoom. Tubular conductors retain round highlights;
      // the rough metal drum retains the authored KTX2 machined atlas.
      for (const side of [-1, 1]) {
        const conductor = MeshBuilder.CreateTube(
          'p28-g9-pylon-exposed-rounded-survey-conductor-' + index + '-' + side, {
            path: [new Vector3(side * 1.43, 0.55, -1.38),
              new Vector3(side * 1.43, 3.67, -1.38),
              new Vector3(side * 0.90, 4.35, -0.82)],
            radius: 0.17, tessellation: 12,
          }, scene);
        conductor.parent = root;
        conductor.material = calibrationInk;
        conductor.isPickable = false;
        for (const level of [1.1, 2.22, 3.35]) {
          box(scene, root, 'p28-g9-pylon-external-conductor-insulator-' + index + '-' + side + '-' + level,
            insulation, side * 1.43, level, -1.38, 0.54, 0.22, 0.54);
        }
      }
      const calibratedBed = box(scene, root, 'p28-g9-pylon-top-ruled-analog-bed-' + index,
        graphite, -1.42, 4.52, -0.96, 1.92, 0.22, 2.36);
      calibratedBed.isPickable = false;
      for (let step = 0; step < 5; step++) {
        const major = step % 2 === 0;
        box(scene, root, 'p28-g9-pylon-top-readable-analog-notch-' + index + '-' + step,
          major ? calibrationInk : fiducialBrass,
          -1.42 + (step - 2) * 0.37, 4.68, -0.96,
          major ? 0.21 : 0.12, 0.12, major ? 1.52 : 0.95);
      }
      // At the real Android overhead zoom the former floor-level scale
      // resolved as unlabelled cream flecks. Mount a bold, countable vernier
      // on the actual near face of each standard, with paired insulated
      // conductors and a distinct amber diamond attached to the steel body.
      // All parts are world geometry; no HUD or simulation target is added.
      box(scene, root, 'p28-g9-pylon-front-fiducial-bracket-' + index,
        graphite, 0, 2.35, 1.54, 0.64, 2.78, 1.48);
      box(scene, root, 'p28-g9-pylon-front-graduated-ruler-bed-' + index,
        graphite, 0, 2.28, 2.36, 0.90, 3.08, 0.22);
      for (let station = 0; station < 8; station++) {
        const major = station % 3 === 0;
        box(scene, root, 'p28-g9-pylon-front-readable-graduation-' + index + '-' + station,
          major ? calibrationInk : etched, 0, 1.02 + station * 0.36, 2.51,
          major ? 0.82 : 0.48, major ? 0.17 : 0.12, 0.13);
      }
      for (const side of [-1, 1]) {
        box(scene, root, 'p28-g9-pylon-front-isolated-conductor-' + index + '-' + side,
          calibrationInk, side * 0.76, 2.28, 2.31, 0.24, 2.92, 0.28);
        for (const terminal of [1.12, 3.42]) {
          box(scene, root, 'p28-g9-pylon-front-conductor-terminal-' + index + '-' + side + '-' + terminal,
            insulation, side * 0.76, terminal, 2.48, 0.36, 0.20, 0.31);
        }
      }
      // The mobile camera resolves the previous fine relief as dark
      // blocks. Frame an open vertical metrology comb with real cast cheek
      // rails and wide stepped brass notches attached to each datum column.
      // The four counted stations remain below the high objective optic,
      // clear of the enemy tell and all unmodified simulation colliders.
      for (const side of [-1, 1]) {
        box(scene, root, 'p28-g9-pylon-survey-open-cheek-' + index + '-' + side,
          shell, side * 1.27, 2.31, 2.68, 0.26, 3.40, 0.42);
        box(scene, root, 'p28-g9-pylon-survey-brass-conductor-' + index + '-' + side,
          calibrationInk, side * 1.27, 2.31, 2.94, 0.20, 3.08, 0.14);
      }
      for (let station = 0; station < 4; station++) {
        const major = station % 2 === 0;
        box(scene, root, 'p28-g9-pylon-macro-cross-vernier-' + index + '-' + station,
          major ? calibrationInk : fiducialBrass,
          0, 1.23 + station * 0.75, 3.01,
          major ? 2.05 : 1.52, major ? 0.23 : 0.16, 0.22);
        box(scene, root, 'p28-g9-pylon-open-scale-notch-' + index + '-' + station,
          graphite, station % 2 ? -0.65 : 0.65, 1.23 + station * 0.75, 3.16,
          0.13, 0.14, 0.13);
      }
      // Backed amber diamond is a bolted reference-node objective, distinct
      // from both pale rotary dials and the violet vector-shear hazard.
      const beaconBacking = box(scene, root, 'p28-g9-pylon-front-objective-beacon-backing-' + index,
        graphite, 0, 3.82, 2.57, 1.38, 1.38, 0.24);
      beaconBacking.rotation.z = Math.PI / 4;
      const beaconFace = box(scene, root, 'p28-g9-pylon-front-objective-beacon-amber-' + index,
        objectiveGold, 0, 3.82, 2.75, 0.98, 0.98, 0.18);
      beaconFace.rotation.z = Math.PI / 4;
      box(scene, root, 'p28-g9-pylon-front-objective-beacon-crosshair-' + index,
        graphite, 0, 3.82, 2.88, 0.26, 0.26, 0.12);
      // Raised dual-plane optical ruler. The earlier faint face marks rendered
      // as cream pin-dots on the exact-APK phone; broad alternating graduations
      // face both visible camera axes and sit on a real braced steel housing.
      box(scene, root, 'p28-g9-pylon-macro-ruler-housing-' + index,
        graphite, 1.35, 2.35, 1.56, 1.50, 2.96, 0.36);
      box(scene, root, 'p28-g9-pylon-macro-ruler-side-housing-' + index,
        graphite, 1.87, 2.35, 0.92, 0.36, 2.96, 1.40);
      box(scene, root, 'p28-g9-pylon-macro-ruler-brace-' + index,
        shell, 0.83, 2.48, 0.84, 1.70, 0.18, 1.60);
      for (let station = 0; station < 8; station++) {
        const major = station % 3 === 0;
        const y = 1.18 + station * 0.34;
        box(scene, root, 'p28-g9-pylon-macro-face-index-' + index + '-' + station,
          major ? calibrationInk : etched,
          1.35, y, 1.82, major ? 1.20 : 0.72, major ? 0.16 : 0.10, 0.16);
        box(scene, root, 'p28-g9-pylon-macro-side-index-' + index + '-' + station,
          major ? calibrationInk : etched,
          2.14, y, 0.92, 0.16, major ? 0.16 : 0.10, major ? 1.09 : 0.66);
      }
      // Physical objective: a dark-backed top-facing amber diamond, carried by
      // the calibrated pylon itself. It is not a floor route, HUD overlay or
      // orange combat telegraph, and it stays distinct from violet survey rings.
      const referenceStem = MeshBuilder.CreateTube('p28-g9-reference-diamond-cantilever-' + index,
        { path: [new Vector3(0.50, 3.86, 0.40), new Vector3(1.46, 5.17, 1.30)], radius: 0.11, tessellation: 8 }, scene);
      referenceStem.parent = root;
      referenceStem.material = graphite;
      referenceStem.isPickable = false;
      const referenceDiamondBacking = MeshBuilder.CreateCylinder('p28-g9-objective-top-diamond-backing-' + index,
        { diameter: 1.86, height: 0.16, tessellation: 4 }, scene);
      referenceDiamondBacking.parent = root;
      referenceDiamondBacking.position.set(1.46, 5.24, 1.30);
      referenceDiamondBacking.rotation.y = Math.PI / 4;
      referenceDiamondBacking.material = graphite;
      referenceDiamondBacking.isPickable = false;
      const referenceDiamond = MeshBuilder.CreateCylinder('p28-g9-objective-top-amber-diamond-' + index,
        { diameter: 1.16, height: 0.18, tessellation: 4 }, scene);
      referenceDiamond.parent = root;
      referenceDiamond.position.set(1.46, 5.41, 1.30);
      referenceDiamond.rotation.y = Math.PI / 4;
      referenceDiamond.material = objectiveGold;
      referenceDiamond.isPickable = false;
      const referenceCenter = MeshBuilder.CreateCylinder('p28-g9-objective-top-diamond-aperture-' + index,
        { diameter: 0.34, height: 0.09, tessellation: 12 }, scene);
      referenceCenter.parent = root;
      referenceCenter.position.set(1.46, 5.55, 1.30);
      referenceCenter.material = graphite;
      referenceCenter.isPickable = false;
      // The orange objective must survive the top-down combat camera as a
      // *different silhouette* from all pale circular survey dials. A black
      // four-sided mounting saddle and a bright, dark-aperture diamond sit
      // on a short two-strut bracket outside the pylon's rotating yoke.
      // These are scene meshes fixed to each genuine objective, not HUD art
      // or simulation targets. Their color never invents an attack phase.
      for (const side of [-1, 1]) {
        const brace = MeshBuilder.CreateTube('p28-g9-pylon-objective-signal-fork-' + index + '-' + side, {
          path: [new Vector3(side * 0.46, 3.44, -0.62),
            new Vector3(-1.32 + side * 0.63, 4.87, -1.34)],
          radius: 0.14, tessellation: 10,
        }, scene);
        brace.parent = root;
        brace.material = graphite;
        brace.isPickable = false;
      }
      const signalBacking = MeshBuilder.CreateCylinder('p28-g9-pylon-objective-diamond-shroud-' + index,
        { diameter: 2.17, height: 0.23, tessellation: 4 }, scene);
      signalBacking.parent = root;
      signalBacking.position.set(-1.32, 4.95, -1.34);
      signalBacking.rotation.y = Math.PI / 4;
      signalBacking.material = graphite;
      signalBacking.isPickable = false;
      const signalFace = MeshBuilder.CreateCylinder('p28-g9-pylon-objective-diamond-visible-' + index,
        { diameter: 1.43, height: 0.17, tessellation: 4 }, scene);
      signalFace.parent = root;
      signalFace.position.set(-1.32, 5.15, -1.34);
      signalFace.rotation.y = Math.PI / 4;
      signalFace.material = objectiveGold;
      signalFace.isPickable = false;
      const signalAperture = MeshBuilder.CreateCylinder('p28-g9-pylon-objective-diamond-dark-aperture-' + index,
        { diameter: 0.39, height: 0.095, tessellation: 12 }, scene);
      signalAperture.parent = root;
      signalAperture.position.set(-1.32, 5.29, -1.34);
      signalAperture.material = graphite;
      signalAperture.isPickable = false;
      // A flat, numbered reference scale is actually visible from the
      // high-angle mobile game camera. The machined bracket reaches back into
      // the physical standard; the lit surface is intentionally instrument
      // glass, not a world-sized navigation HUD slab.
      box(scene, root, 'p28-g9-pylon-engraved-display-bracket-' + index,
        graphite, 1.50, 3.53, 0.90, 3.45, 0.24, 1.87);
      const pylonReadout = MeshBuilder.CreatePlane('p28-g9-pylon-top-facing-numbered-calibration-' + index,
        { width: 3.14, height: 1.58 }, scene);
      pylonReadout.parent = root;
      pylonReadout.rotation.x = -Math.PI / 2;
      pylonReadout.position.set(1.50, 3.675, 0.90);
      pylonReadout.material = this.calibrationDisplayMaterial;
      pylonReadout.isPickable = false;

      // The face of every actual datum standard needs a recognizable numeric
      // scale at 3120×1440 phone resolution. Orient a mechanical enamel
      // sight-glass toward the diagonal overhead camera, with a physical
      // support arm back to the vertical spindle. Unlike the former top-only
      // plate, this upright face cannot disappear behind the upper yoke.
      // Stand the numbered plate proud of the cast column and tilt it toward
      // the actual +X/+Z overhead phone camera. On the previous exact APK the
      // opaque machine housing and pale clamp blocks hid the marked face.
      // This is a bolted physical scale, not an overlay or gameplay object.
      const sidePanelBracket = box(scene, root, 'p28-g9-pylon-vertical-numbered-sight-glass-bracket-' + index,
        graphite, 1.22, 3.16, 1.08, 2.36, 1.40, 0.22);
      sidePanelBracket.rotation.y = Math.PI / 4;
      const uprightScale = MeshBuilder.CreatePlane('p28-g9-pylon-vertical-numbered-sight-glass-' + index,
        { width: 2.02, height: 1.10 }, scene);
      uprightScale.parent = root;
      uprightScale.position.set(1.39, 3.22, 1.29);
      uprightScale.rotation.y = Math.PI / 4;
      uprightScale.material = this.calibrationDisplayMaterial;
      uprightScale.isPickable = false;
      // The universal DATUM ruler has many graduations, but its numerals
      // projected below readable phone size on the individual pylons. A large
      // engraved 01/02/03 identity is physically mounted beside that ruler
      // so each actual alignment standard can be identified in the scene.
      const indexTexture = new DynamicTexture('p28-g9-pylon-numbered-engraving-' + index,
        { width: 256, height: 128 }, scene, false);
      const indexInk = indexTexture.getContext();
      indexInk.fillStyle = '#101a22';
      indexInk.fillRect(0, 0, 256, 128);
      indexInk.strokeStyle = '#a98a5e';
      indexInk.lineWidth = 8;
      indexInk.strokeRect(6, 6, 244, 116);
      indexInk.fillStyle = '#f1d49b';
      indexInk.font = 'bold 100px monospace';
      indexInk.fillText(String(index + 1).padStart(2, '0'), 20, 99);
      // Label the *actual alignment target*, not a navigation landmark or
      // generic service console. This inscription is part of each machine's
      // scene-owned engraved texture, shown on its bolted physical cassette.
      indexInk.fillStyle = '#ffd88a';
      indexInk.font = 'bold 23px monospace';
      indexInk.fillText('ALIGN', 18, 117);
      // Coarse five-station ruling on the actual physical ID glass. These
      // deliberately resolve into countable strokes at 3120px Android zoom.
      for (let graduation = 0; graduation < 5; graduation++) {
        const major = graduation % 2 === 0;
        indexInk.fillStyle = major ? '#e4c48a' : '#8fbcc4';
        indexInk.fillRect(153, 19 + graduation * 23, major ? 79 : 48, major ? 7 : 5);
      }
      indexTexture.update();
      const indexMaterial = new StandardMaterial('p28-g9-pylon-numbered-plate-material-' + index, scene);
      indexMaterial.diffuseTexture = indexTexture;
      indexMaterial.emissiveTexture = indexTexture;
      indexMaterial.emissiveColor = Color3.White().scale(0.62);
      indexMaterial.specularColor = Color3.Black();
      indexMaterial.disableLighting = true;
      indexMaterial.backFaceCulling = false;
      this.pylonIndexTextures.push(indexTexture);
      this.pylonIndexMaterials.push(indexMaterial);
      const indexPlaqueBracket = box(scene, root, 'p28-g9-pylon-numbered-plate-bracket-' + index,
        graphite, 2.03, 2.32, 1.34, 1.10, 0.78, 0.14);
      indexPlaqueBracket.rotation.y = Math.PI / 4;
      const indexPlaque = MeshBuilder.CreatePlane('p28-g9-pylon-numbered-plate-' + index,
        { width: 1.00, height: 0.62 }, scene);
      indexPlaque.parent = root;
      indexPlaque.position.set(2.13, 2.34, 1.49);
      indexPlaque.rotation.y = Math.PI / 4;
      indexPlaque.material = indexMaterial;
      indexPlaque.isPickable = false;
      // Exact-APK normal/action/device pixel review showed readable ticks on
      // the separate central instrument, but the *three actual objective
      // pylons* still appeared as dark blocks with cream studs. Give each real
      // pylon a single large, camera-facing mechanical ID/vernier cassette.
      // Its broad dark enamel field, counted brass graduations and 01/02/03
      // plate are integrated into the machine silhouette; there is no HUD
      // overlay, virtual objective, route line, or simulation collision.
      const standardCassette = new TransformNode('p28-g9-pylon-body-mounted-vernier-cassette-' + index, scene);
      standardCassette.parent = root;
      // The full-size in-scene plate blocked the operator's sightline to
      // the mass standard in all three accepted-origin device screenshots.
      // Retain its real numbered/ticked geometry but restore the open
      // machine silhouette by setting it alongside the frame at 80% scale.
      standardCassette.position.set(2.18, 2.35, 2.10);
      standardCassette.rotation.y = Math.PI / 4;
      standardCassette.scaling.set(0.80, 0.80, 0.80);
      box(scene, standardCassette, 'p28-g9-pylon-body-vernier-enamel-bed-' + index,
        graphite, 0, 0, 0, 2.42, 3.20, 0.24);
      for (const side of [-1, 1]) {
        box(scene, standardCassette, 'p28-g9-pylon-body-vernier-machined-rail-' + index + '-' + side,
          shell, side * 1.12, 0, 0.17, 0.19, 3.08, 0.25);
        const fastener = MeshBuilder.CreateTube(
          'p28-g9-pylon-body-vernier-braced-mount-' + index + '-' + side, {
            path: [new Vector3(side * 0.78 - 0.78, 0, -1.95),
              new Vector3(side * 0.88, 0, -0.22)],
            radius: 0.14, tessellation: 10,
          }, scene);
        fastener.parent = standardCassette;
        fastener.material = shell;
        fastener.isPickable = false;
      }
      const standardNumber = MeshBuilder.CreatePlane('p28-g9-pylon-body-vernier-number-' + index,
        { width: 1.92, height: 0.96 }, scene);
      standardNumber.parent = standardCassette;
      standardNumber.position.set(0, 0.97, 0.16);
      standardNumber.material = indexMaterial;
      standardNumber.isPickable = false;
      for (let graduation = 0; graduation < 5; graduation++) {
        const major = graduation % 2 === 0;
        box(scene, standardCassette,
          'p28-g9-pylon-body-vernier-countable-tick-' + index + '-' + graduation,
          major ? calibrationInk : fiducialBrass,
          major ? 0 : -0.18, 0.25 - graduation * 0.34, 0.21,
          major ? 1.78 : 1.22, major ? 0.17 : 0.13, 0.11);
      }
      // A single unmistakable *world-space* diamond target crowns the
      // numbered calibration cassette. Earlier amber caps blended into the
      // other warm machine heads and tall ring-topped navigation landmarks
      // were mistaken for the objectives in actual Android screenshots.
      // The layered dark silhouette, pale machined perimeter, amber
      // diamond and dark aperture together mean ALIGN, not a combat tell.
      // This brace is fixed to each real reference-node root; no HUD plane,
      // invented target, collision, or timer is introduced.
      // Independent Android review showed that the huge overhead ruler and
      // multiple orange caps obscured the actual operator and combat floor.
      // A single compact alignment optic sits on each live reference-node
      // spindle, while a readable five-station scale is grounded to its base.
      // These are real, non-pickable world meshes, not HUD or attack signals.
      for (const side of [-1, 1]) {
        const opticSupport = MeshBuilder.CreateTube(
          'p28-g9-pylon-high-optic-steel-strut-' + index + '-' + side, {
            path: [new Vector3(side * 0.67, 3.82, -0.42),
              new Vector3(1.70 + side * 0.45, 5.45, -1.56)],
            radius: 0.11, tessellation: 10,
          }, scene);
        opticSupport.parent = root;
        opticSupport.material = shell;
        opticSupport.isPickable = false;
      }
      const alignShroud = MeshBuilder.CreateCylinder('p28-g9-pylon-align-objective-shroud-' + index,
        { diameter: 1.56, height: 0.18, tessellation: 4 }, scene);
      alignShroud.parent = root;
      alignShroud.position.set(1.70, 5.50, -1.56);
      alignShroud.rotation.y = Math.PI / 4;
      alignShroud.material = graphite;
      alignShroud.isPickable = false;
      const alignPerimeter = MeshBuilder.CreateTorus('p28-g9-pylon-align-machined-contrast-perimeter-' + index,
        { diameter: 1.66, thickness: 0.14, tessellation: 4 }, scene);
      alignPerimeter.parent = root;
      alignPerimeter.position.set(1.70, 5.63, -1.56);
      alignPerimeter.rotation.y = Math.PI / 4;
      alignPerimeter.material = cyan;
      alignPerimeter.isPickable = false;
      const alignSignal = MeshBuilder.CreateCylinder('p28-g9-pylon-align-distinct-amber-diamond-' + index,
        { diameter: 1.06, height: 0.15, tessellation: 4 }, scene);
      alignSignal.parent = root;
      alignSignal.position.set(1.70, 5.75, -1.56);
      alignSignal.rotation.y = Math.PI / 4;
      alignSignal.material = this.objectiveSignalMaterial;
      alignSignal.isPickable = false;
      const alignReticle = MeshBuilder.CreateCylinder('p28-g9-pylon-align-dark-target-aperture-' + index,
        { diameter: 0.33, height: 0.09, tessellation: 12 }, scene);
      alignReticle.parent = root;
      alignReticle.position.set(1.70, 5.88, -1.56);
      alignReticle.material = graphite;
      alignReticle.isPickable = false;
      // The broad numbered ruler formerly floated above the combat lane.
      // Its five major/minor graduations now sit on the real machine plinth,
      // physically below the operator's line of sight and with no collision.
      const deckScaleBed = box(scene, root, 'p28-g9-pylon-deck-five-station-scale-bed-' + index,
        graphite, 1.26, 0.52, -1.60, 2.54, 0.12, 0.68);
      deckScaleBed.isPickable = false;
      for (let station = 0; station < 5; station++) {
        box(scene, root, 'p28-g9-pylon-deck-visible-station-tick-' + index + '-' + station,
          station % 2 === 0 ? calibrationInk : cyan,
          1.26 + (station - 2) * 0.46, 0.66, -1.60,
          station % 2 === 0 ? 0.24 : 0.14, 0.10, station % 2 === 0 ? 0.56 : 0.33);
      }
      // Raise the engraved optical instrument above the rotary cap, so all
      // three genuine pylon gauges face the overhead camera. The previous
      // lower cantilever vanished behind distant yokes and cropped the near
      // Android edge. The smaller, bolted housing remains genuine world-space
      // machinery, never a HUD label or independent objective.
      const gauge = new TransformNode('p28-g9-pylon-overhead-calibrated-rig-' + index, scene);
      gauge.parent = root;
      gauge.position.set(-1.20, 6.12, 0.78);
      box(scene, gauge, 'p28-g9-pylon-overhead-engraved-head-' + index,
        graphite, 0, 0, 0, 2.30, 0.23, 1.36);
      const gaugeFace = MeshBuilder.CreatePlane('p28-g9-pylon-overhead-vernier-label-' + index,
        { width: 2.06, height: 1.14 }, scene);
      gaugeFace.parent = gauge;
      gaugeFace.position.set(0, 0.14, 0);
      gaugeFace.rotation.x = -Math.PI / 2;
      gaugeFace.material = indexMaterial;
      gaugeFace.isPickable = false;
      for (const side of [-1, 1]) {
        const headBrace = MeshBuilder.CreateTube('p28-g9-pylon-overhead-vernier-brace-' + index + '-' + side,
          { path: [new Vector3(1.20 + side * 0.54, -2.55, -0.50),
            new Vector3(side * 0.76, -0.14, 0)],
            radius: 0.12, tessellation: 10 }, scene);
        headBrace.parent = gauge;
        headBrace.material = side === -1 ? graphite : fiducialBrass;
        headBrace.isPickable = false;
      }
      // One narrow legible external vernier on each genuine pylon.
      // A short bolted strut joins it to the machine, not to camera/HUD.
      const verticalRulerBed = box(scene, root, 'p28-g9-pylon-camera-vernier-bolted-case-' + index,
        graphite, 2.57, 2.32, 2.17, 1.34, 3.30, 0.19);
      verticalRulerBed.rotation.y = Math.PI / 4;
      const verticalRuler = MeshBuilder.CreatePlane('p28-g9-pylon-camera-vernier-indexed-scale-' + index,
        { width: 1.12, height: 3.06 }, scene);
      verticalRuler.parent = root;
      verticalRuler.position.set(2.69, 2.32, 2.30);
      verticalRuler.rotation.y = Math.PI / 4;
      verticalRuler.material = this.pylonVernierMaterial;
      verticalRuler.isPickable = false;
      for (const station of [0.82, 3.86]) {
        box(scene, root, 'p28-g9-pylon-camera-vernier-fastener-' + index + '-' + station,
          fiducialBrass, 2.69, station, 2.38, 0.27, 0.20, 0.16);
      }
      const rulerBrace = MeshBuilder.CreateTube('p28-g9-pylon-camera-vernier-steel-mount-' + index,
        { path: [new Vector3(0.96, 2.38, 0.64), new Vector3(2.55, 2.38, 2.07)],
          radius: 0.10, tessellation: 8 }, scene);
      rulerBrace.parent = root;
      rulerBrace.material = graphite;
      rulerBrace.isPickable = false;
      for (const side of [-1, 1]) {
        const panelAnchor = MeshBuilder.CreateTube('p28-g9-pylon-sight-glass-support-' + index + '-' + side,
          { path: [new Vector3(side * 0.38, 2.20, 0.39),
            new Vector3(2.12 + side * 0.64, 2.98, 2.06)], radius: 0.12, tessellation: 10 }, scene);
        panelAnchor.parent = root;
        panelAnchor.material = graphite;
        panelAnchor.isPickable = false;
      }

      box(scene, root, 'p27-c10-pylon-foot-' + index, graphite, 0, 0.24, 0, 1.40, 0.48, 1.40);
      // The primary reference standard is a tapered, ten-sided machine column,
      // not a rectangular crate. The shipped KTX2 painted-metal PBR/normal/ORM
      // channels remain on the substantial faceted body.
      const spindle = MeshBuilder.CreateCylinder('p27-c10-pylon-spine-' + index,
        { height: 4.30, diameterTop: 0.92, diameterBottom: 1.54, tessellation: 10 }, scene);
      spindle.parent = root;
      spindle.position.y = 2.15;
      spindle.material = shell;
      spindle.isPickable = false;
      // Five measured stations are engraved on the real faceted column,
      // not only on the separate camera-facing service cassette. The wide
      // major/notch profile reads as a vernier when the small panel is
      // partly hidden by the nearby mass assembly.
      for (let station = 0; station < 5; station++) {
        const major = station % 2 === 0;
        const notch = box(scene, root, 'p28-g9-pylon-spindle-exposed-datum-notch-' + index + '-' + station,
          major ? calibrationInk : fiducialBrass,
          -0.32, 1.04 + station * 0.67, 1.03,
          major ? 1.30 : 0.82, major ? 0.21 : 0.14, 0.15);
        notch.rotation.y = Math.PI / 8;
      }
      // These raised machined bearing collars and long flutes have actual
      // silhouette/contact depth at Android camera distance, unlike tiny
      // surface stickers on a flat cuboid.
      for (const height of [0.96, 2.02, 3.10, 3.92]) {
        const collar = MeshBuilder.CreateCylinder('p28-g9-pylon-machined-bearing-collar-' + index + '-' + height,
          { height: 0.24, diameter: 1.84, tessellation: 10 }, scene);
        collar.parent = root;
        collar.position.y = height;
        collar.material = height === 2.02 ? fiducialBrass : graphite;
        collar.isPickable = false;
      }
      for (let flute = 0; flute < 6; flute++) {
        const angle = flute * Math.PI / 3;
        const rail = MeshBuilder.CreateCylinder('p28-g9-pylon-ribbed-metal-flute-' + index + '-' + flute,
          { height: 3.07, diameter: 0.13, tessellation: 7 }, scene);
        rail.parent = root;
        rail.position.set(Math.cos(angle) * 0.65, 2.28, Math.sin(angle) * 0.65);
        rail.material = flute % 2 ? graphite : etched;
        rail.isPickable = false;
      }
      // A real rotary vernier cap over the ten-sided standard replaces the
      // silhouette of stacked pale cuboids with an exposed machined instrument.
      // The 16 graduated radial notches are actual top-face relief, not a HUD
      // reticle or a textured decal. Active orange remains objective-only.
      const vernier = MeshBuilder.CreateCylinder('p28-g9-pylon-machined-vernier-sleeve-' + index,
        { height: 0.38, diameterTop: 2.26, diameterBottom: 2.46, tessellation: 24 }, scene);
      vernier.parent = root;
      vernier.position.y = 3.26;
      vernier.material = graphite;
      vernier.isPickable = false;
      const vernierRim = MeshBuilder.CreateTorus('p28-g9-pylon-vernier-brass-race-' + index,
        { diameter: 2.48, thickness: 0.13, tessellation: 36 }, scene);
      vernierRim.parent = root;
      vernierRim.position.y = 3.49;
      vernierRim.material = graduation;
      vernierRim.isPickable = false;
      for (let mark = 0; mark < 16; mark++) {
        const angle = mark * Math.PI / 8;
        const notch = box(scene, root, 'p28-g9-pylon-vernier-radial-calibration-' + index + '-' + mark,
          mark % 4 === 0 ? fiducialBrass : etched,
          Math.cos(angle) * 1.10, 3.49, Math.sin(angle) * 1.10,
          mark % 4 === 0 ? 0.19 : 0.09, 0.065, mark % 4 === 0 ? 0.46 : 0.28);
        notch.rotation.y = -angle;
      }
      // Large physical survey instruments face the overhead gameplay camera.
      // Indexed brass quadrants and a dark upright measuring yoke distinguish
      // an actual metrology standard from repeated crate-like silhouettes.
      const dialFace = MeshBuilder.CreateCylinder('p28-g9-pylon-precision-dial-face-' + index,
        { height: 0.20, diameter: 2.86, tessellation: 32 }, scene);
      dialFace.parent = root;
      dialFace.position.set(0, 4.17, 0);
      dialFace.material = graphite;
      dialFace.isPickable = false;
      const dialRim = MeshBuilder.CreateTorus('p28-g9-pylon-precision-dial-rim-' + index,
        { diameter: 2.94, thickness: 0.23, tessellation: 36 }, scene);
      dialRim.parent = root;
      dialRim.position.set(0, 4.30, 0);
      dialRim.rotation.x = Math.PI / 2;
      dialRim.material = fiducialBrass;
      dialRim.isPickable = false;
      for (let station = 0; station < 12; station++) {
        const angle = station * Math.PI / 6;
        const major = station % 3 === 0;
        const tick = box(scene, root, 'p28-g9-pylon-precision-dial-index-' + index + '-' + station,
          major ? graduation : etched, Math.cos(angle) * 1.12, 4.31, Math.sin(angle) * 1.12,
          major ? 0.38 : 0.22, 0.10, major ? 0.22 : 0.13);
        tick.rotation.y = -angle;
      }
      const pointer = box(scene, root, 'p28-g9-pylon-precision-needle-' + index,
        fiducialBrass, 0.42, 4.34, 0.24, 0.92, 0.13, 0.14);
      pointer.rotation.y = -0.29;
      const measuringYoke = MeshBuilder.CreateTorus('p28-g9-pylon-upright-measuring-yoke-' + index,
        { diameter: 3.48, thickness: 0.24, tessellation: 36 }, scene);
      measuringYoke.parent = root;
      measuringYoke.position.set(0, 2.40, 1.07);
      measuringYoke.rotation.x = Math.PI / 2;
      measuringYoke.material = graphite;
      measuringYoke.isPickable = false;
      for (const side of [-1, 1]) {
        const brace = MeshBuilder.CreateTube('p28-g9-pylon-yoke-triangulation-' + index + '-' + side, {
          path: [new Vector3(side * 1.65, 0.38, 1.22),
            new Vector3(side * 1.50, 2.35, 1.07),
            new Vector3(side * 0.82, 4.02, 0.60)],
          radius: 0.12, tessellation: 10,
        }, scene);
        brace.parent = root;
        brace.material = graphite;
        brace.isPickable = false;
      }
      // The overhead camera also sees a full-diameter *front* metrology dial,
      // not just a top cap partially hidden behind the roof objective. The
      // dark precision face, radial graduation stations and brass gnomon are
      // bolted to the same KTX2 metal column, never projected into the HUD.
      box(scene, root, 'p28-g9-pylon-front-dial-bearing-' + index,
        graphite, 0, 2.46, 1.03, 1.50, 0.38, 0.88);
      const frontDial = MeshBuilder.CreateCylinder('p28-g9-pylon-front-precision-face-' + index,
        { diameter: 3.42, height: 0.24, tessellation: 36 }, scene);
      frontDial.parent = root;
      frontDial.position.set(0, 2.46, 1.54);
      frontDial.rotation.x = Math.PI / 2;
      frontDial.material = counterweightMetal;
      frontDial.isPickable = false;
      const frontRim = MeshBuilder.CreateTorus('p28-g9-pylon-front-precision-race-' + index,
        { diameter: 3.58, thickness: 0.24, tessellation: 40 }, scene);
      frontRim.parent = root;
      frontRim.position.set(0, 2.46, 1.70);
      frontRim.rotation.x = Math.PI / 2;
      frontRim.material = fiducialBrass;
      frontRim.isPickable = false;
      for (let station = 0; station < 16; station++) {
        const angle = station * Math.PI / 8;
        const major = station % 4 === 0;
        const tick = box(scene, root, 'p28-g9-pylon-front-macro-graduation-' + index + '-' + station,
          major ? calibrationInk : indexed, Math.cos(angle) * 1.38,
          2.46 + Math.sin(angle) * 1.38, 1.75,
          major ? 0.54 : 0.27, major ? 0.23 : 0.14, 0.17);
        tick.rotation.z = angle + Math.PI / 2;
      }
      const gnomon = box(scene, root, 'p28-g9-pylon-front-vernier-pointer-' + index,
        fiducialBrass, 0.46, 2.72, 1.81, 1.02, 0.16, 0.15);
      gnomon.rotation.z = 0.46;
      // Three unmistakable high-value metrology pillars, not dark cubic
      // placeholders: exposed etched datum rails and graduated bidirectional
      // scales sit *outside* the textured PBR structural shell.
      for (const side of [-1, 1]) {
        box(scene, root, 'p28-g9-pylon-conductor-' + index + '-' + side,
          etched, side * 0.58, 2.20, 0.47, 0.16, 3.60, 0.21);
        box(scene, root, 'p28-g9-pylon-insulator-' + index + '-' + side,
          insulation, side * 0.60, 0.72, 0.55, 0.38, 0.34, 0.24);
        box(scene, root, 'p28-g9-pylon-readout-' + index + '-' + side,
          cyan, side * 0.59, 3.57, 0.60, 0.20, 0.32, 0.12);
        for (const yokeY of [1.15, 3.46]) {
          box(scene, root, 'p28-g9-pylon-endshoe-' + index + '-' + side + '-' + yokeY,
            indexed, side * 1.03, yokeY, 0.25, 0.30, 0.28, 0.42);
        }
      }
      for (const yokeY of [1.15, 3.46]) {
        box(scene, root, 'p28-g9-pylon-survey-yoke-' + index + '-' + yokeY,
          shell, 0, yokeY, 0.18, 2.25, 0.16, 0.44);
      }
      // These paired external conductors read as actual calibrated rails at
      // the overhead gameplay camera distance. Dark insulating saddles break
      // the brass into separate, mechanically anchored metrology channels,
      // rather than adding another floating luminous game-route stripe.
      for (const side of [-1, 1]) {
        box(scene, root, 'p28-g9-exposed-survey-conductor-' + index + '-' + side,
          fiducialBrass, side * 1.14, 2.26, 0.96, 0.26, 2.84, 0.24);
        for (const station of [1.12, 3.32]) {
          box(scene, root, 'p28-g9-survey-conductor-isolator-' + index + '-' + side + '-' + station,
            insulation, side * 1.14, station, 1.01, 0.51, 0.26, 0.41);
          box(scene, root, 'p28-g9-survey-conductor-bolt-' + index + '-' + side + '-' + station,
            fiducialBrass, side * 1.14, station + 0.16, 1.04, 0.17, 0.12, 0.18);
        }
      }
      // Recess the scales into dark PBR panels so alternating brass/cyan
      // graduations remain physically distinct instead of white bar stacks.
      for (const face of [-1, 1]) {
        box(scene, root, 'p28-g9-pylon-meter-recess-' + index + '-' + face,
          graphite, 0, 2.25, face * 0.60, 0.94, 3.10, 0.16);
      }
      for (let tick = 0; tick < 9; tick++) {
        box(scene, root, 'p28-g9-pylon-fiducial-' + index + '-' + tick,
          tick % 3 === 0 ? graduation : etched,
          0, 0.96 + tick * 0.36, 0.86, tick % 3 === 0 ? 1.24 : 0.70, 0.14, 0.18);
        box(scene, root, 'p28-g9-pylon-rear-scale-' + index + '-' + tick,
          tick % 3 === 0 ? graduation : etched,
          0, 0.96 + tick * 0.36, -0.86, tick % 3 === 0 ? 1.24 : 0.70, 0.14, 0.18);
      }
      // Distinct raised dual-color depth scale, readable above deck grating.
      box(scene, root, 'p28-g9-pylon-exposed-metrology-ruler-' + index,
        graphite, 0, 2.18, 1.02, 1.58, 3.46, 0.22);
      for (let mark = 0; mark < 6; mark++) {
        box(scene, root, 'p28-g9-pylon-datum-large-mark-' + index + '-' + mark,
          mark % 2 === 0 ? fiducialBrass : indexed, 0, 1.16 + mark * 0.41, 1.19,
          mark % 2 === 0 ? 1.35 : 0.80, 0.17, 0.12);
      }
      // Full-size ruled surface faces the actual overhead gameplay camera.
      // Six visible 0.3-world-unit marks on graphite make the reference ruler
      // readable without relying on sub-pixel painted texture lines.
      box(scene, root, 'p28-g9-pylon-top-metrology-ruler-bed-' + index,
        graphite, 0, 0.51, -1.85, 4.55, 0.23, 0.92);
      for (let station = 0; station < 7; station++) {
        box(scene, root, 'p28-g9-pylon-top-metrology-station-' + index + '-' + station,
          station % 3 === 0 ? fiducialBrass : cyan,
          (station - 3) * 0.60, 0.67, -1.85,
          station % 3 === 0 ? 0.31 : 0.18, 0.11,
          station % 3 === 0 ? 0.83 : 0.47);
      }
      // A bolted survey beacon with a standalone orange mechanical diamond
      // stands above the deck at the pylon's accessible side. The vertical
      // dark mast, diamond backing, and center bullseye are a different
      // silhouette from pale circular calibration rings or violet hazards.
      box(scene, root, 'p28-g9-objective-side-signal-foundation-' + index,
        graphite, -2.24, 0.43, 1.32, 1.16, 0.85, 1.10);
      const signalMast = MeshBuilder.CreateCylinder('p28-g9-objective-side-signal-mast-' + index,
        { height: 2.20, diameter: 0.23, tessellation: 8 }, scene);
      signalMast.parent = root;
      signalMast.position.set(-2.24, 1.65, 1.32);
      signalMast.material = shell;
      signalMast.isPickable = false;
      const diamondBack = box(scene, root, 'p28-g9-objective-standalone-diamond-backing-' + index,
        graphite, -2.24, 2.80, 1.36, 2.08, 2.08, 0.38);
      diamondBack.rotation.z = Math.PI / 4;
      const diamondFace = box(scene, root, 'p28-g9-objective-standalone-diamond-signal-' + index,
        objectiveGold, -2.24, 2.80, 1.62, 1.65, 1.65, 0.24);
      diamondFace.rotation.z = Math.PI / 4;
      box(scene, root, 'p28-g9-objective-standalone-dark-bullseye-' + index,
        graphite, -2.24, 2.80, 1.79, 0.78, 0.78, 0.18);
      // A real top-facing calibrated target, separate from the pale rotary
      // interferometer rings, identifies the physical objective in the
      // overhead camera even when the tall crown is obscured by the HUD.
      // The dark metal backing preserves a crisp amber-on-graphite edge.
      const objectiveDialBack = MeshBuilder.CreateCylinder('p28-g9-objective-deck-dial-backing-' + index,
        { diameter: 2.74, height: 0.18, tessellation: 8 }, scene);
      objectiveDialBack.parent = root;
      objectiveDialBack.position.set(-1.58, 0.64, 1.58);
      objectiveDialBack.material = graphite;
      objectiveDialBack.isPickable = false;
      const objectiveDial = MeshBuilder.CreateCylinder('p28-g9-objective-deck-diamond-' + index,
        { diameter: 1.54, height: 0.24, tessellation: 4 }, scene);
      objectiveDial.parent = root;
      objectiveDial.position.set(-1.58, 0.86, 1.58);
      objectiveDial.rotation.y = Math.PI / 4;
      objectiveDial.material = objectiveGold;
      objectiveDial.isPickable = false;
      // Four dark-backed outer stations make the diamond a countable
      // calibration target rather than another cream-colored circular rotor.
      for (const quadrant of [-1, 1]) {
        box(scene, root, 'p28-g9-objective-dial-index-rail-' + index + '-' + quadrant,
          graphite, -1.58 + quadrant * 1.33, 0.70, 1.58, 0.34, 0.16, 1.15);
        box(scene, root, 'p28-g9-objective-dial-index-lamp-' + index + '-' + quadrant,
          objectiveGold, -1.58 + quadrant * 1.33, 0.84, 1.58, 0.18, 0.12, 0.43);
      }
      // A broad near-deck objective fiducial remains visible even when the
      // high mast/crown are behind the top status HUD on the phone.
      // Station plaque is matte bronze, not a second giant solid orange
      // rectangle competing with the real hazardous amber telegraphs.
      box(scene, root, 'p28-g9-pylon-near-deck-objective-plate-' + index,
        objectiveGold, 0, 0.84, 1.36, 1.58, 0.45, 0.22);
      for (const side of [-1, 1]) {
        box(scene, root, 'p28-g9-pylon-near-deck-target-wing-' + index + '-' + side,
          fiducialBrass, side * 1.30, 0.88, 1.10, 0.34, 0.90, 0.30);
      }
      const footReticle = MeshBuilder.CreateTorus('p28-g9-reference-foot-datum-' + index,
        { diameter: 2.34, thickness: 0.085, tessellation: 32 }, scene);
      footReticle.parent = root;
      footReticle.position.y = 0.26;
      footReticle.rotation.x = Math.PI / 2;
      footReticle.material = indexed;
      footReticle.isPickable = false;
      // Instrument-scale lateral clamps, conductor terminals and machine
      // engraving are larger than the per-pixel shimmer of a smooth box edge.
      for (let tier = 0; tier < 4; tier++) {
        const y = 1.08 + tier * 0.76;
        box(scene, root, 'p28-g9-pylon-calibration-clamp-' + index + '-' + tier,
          graphite, 0, y, 0.76, 1.44, 0.18, 0.18);
        box(scene, root, 'p28-g9-pylon-calibration-index-' + index + '-' + tier,
          graduation, 0, y + 0.10, 0.87, tier % 2 ? 0.42 : 0.70, 0.13, 0.17);
        for (const side of [-1, 1]) {
          box(scene, root, 'p28-g9-pylon-servo-coupler-' + index + '-' + tier + '-' + side,
            shell, side * 0.78, y, 0.60, 0.26, 0.34, 0.44);
        }
      }
      const lens = MeshBuilder.CreateCylinder('p28-g9-pylon-interferometer-lens-' + index,
        { diameter: 0.78, height: 0.17, tessellation: 24 }, scene);
      lens.parent = root;
      lens.position.set(0, 2.63, 0.75);
      lens.rotation.x = Math.PI / 2;
      lens.material = graduation;
      lens.isPickable = false;
      // A tall lit objective mast is directly attached to each *physical*
      // reference node; the violet rotary rings still indicate alignment.
      const mast = MeshBuilder.CreateCylinder('p28-g9-reference-objective-mast-' + index,
        { height: 1.16, diameterTop: 0.10, diameterBottom: 0.42, tessellation: 8 }, scene);
      mast.parent = root;
      mast.position.y = 4.68;
      mast.material = shell;
      mast.isPickable = false;
      const halo = MeshBuilder.CreateTorus('p28-g9-reference-objective-halo-' + index,
        { diameter: 1.62, thickness: 0.13, tessellation: 32 }, scene);
      halo.parent = root;
      halo.position.y = 4.95;
      halo.rotation.x = Math.PI / 2;
      halo.material = cyan;
      halo.isPickable = false;
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
      // The previous cyan dot disappeared inside the pale calibration halo
      // on the source-bound phone image. A machined, top-facing amber diamond
      // now identifies the real objective, with the actual alignment pulse
      // still controlled by the live reference-node simulation state.
      const core = MeshBuilder.CreateCylinder('p27-c10-pylon-core-' + index,
        { diameter: 1.38, height: 0.24, tessellation: 4 }, scene);
      core.parent = root;
      core.position.y = 5.26;
      core.rotation.y = Math.PI / 4;
      core.material = objectiveGold;
      core.isPickable = false;
      // A conspicuous side-mounted fiducial is positioned below the top HUD,
      // unlike the tiny upper mast that can sit behind tactical alerts.
      const beaconRig = new TransformNode('p28-g9-objective-beacon-rig-' + index, scene);
      beaconRig.parent = root;
      beaconRig.position.set(1.58, 0, 1.12);
      box(scene, beaconRig, 'p28-g9-beacon-foot-' + index,
        graphite, 0, 0.32, 0, 1.34, 0.64, 1.24);
      box(scene, beaconRig, 'p28-g9-beacon-stem-' + index,
        graduation, 0, 1.46, 0, 0.26, 2.10, 0.26);
      for (let level = 0; level < 3; level++) {
        const target = MeshBuilder.CreateTorus('p28-g9-objective-side-beacon-' + index + '-' + level,
          { diameter: 1.85 - level * 0.24, thickness: 0.16, tessellation: 28 }, scene);
        target.parent = beaconRig;
        target.position.set(0, 2.24 + level * 0.35, 0);
        target.rotation.x = Math.PI / 2;
        // Calibrated alignment is an active amber status signal, not pale
        // metal like the surrounding inactive interferometer rotor.
        target.material = objectiveGold;
        target.isPickable = false;
      }
      box(scene, beaconRig, 'p28-g9-physical-objective-index-' + index,
        objectiveGold, 0, 2.94, 0.66, 1.04, 0.26, 0.18);
      // Unique warm-gold, tiered active-objective light over each real node.
      // It is deliberately separate from the violet shear/rings and cyan
      // navigation, and its base is bolted to the metrology tower.
      const objectiveBase = box(scene, root, 'p28-g9-objective-datum-base-' + index,
        graphite, 0, 4.10, 0.08, 1.22, 0.20, 0.96);
      objectiveBase.isPickable = false;
      for (let level = 0; level < 3; level++) {
        const crown = MeshBuilder.CreateTorus('p28-g9-objective-datum-beacon-crown-' + index + '-' + level,
          { diameter: 1.10 - level * 0.18, thickness: 0.12, tessellation: 28 }, scene);
        crown.parent = root;
        crown.position.set(0, 4.34 + level * 0.26, 0.08);
        crown.rotation.x = Math.PI / 2;
        crown.material = objectiveGold;
        crown.isPickable = false;
      }
      box(scene, root, 'p28-g9-objective-calibration-chevron-' + index,
        objectiveGold, 0, 4.68, 0.92, 0.72, 0.17, 0.20);
      this.pylonRigs.push({ id, root, rings, core, gauge, gaugeFace });
    });

    // Coarse top-surface metal panel islands and enclosed service lanes
    // interrupt the otherwise continuous repeated deck texture. They are
    // grounded near actual machines, below hit/route logic and non-pickable.
    for (const [zone, x, z, width, depth] of [
      ['near-datum', worldW * 0.20, worldH * 0.54, 7.0, 4.0],
      ['deep-datum', worldW * 0.79, worldH * 0.48, 6.4, 4.2],
      ['cross-track', worldW * 0.51, worldH * 0.29, 9.0, 3.4],
    ] as const) {
      box(scene, this.root, 'p28-g9-survey-machine-floor-island-' + zone,
        shell, x, 0.018, z, width, 0.055, depth);
      box(scene, this.root, 'p28-g9-survey-machine-floor-inset-' + zone,
        graphite, x, 0.054, z, width - 0.42, 0.018, depth - 0.42);
      for (const edge of [-1, 1]) {
        box(scene, this.root, 'p28-g9-survey-machine-floor-joint-' + zone + '-' + edge,
          insulation, x, 0.072, z + edge * (depth / 2 - 0.31),
          width - 0.50, 0.075, 0.18);
        for (let bolt = 0; bolt < 5; bolt++) {
          box(scene, this.root, 'p28-g9-survey-machine-floor-bolt-' + zone + '-' + edge + '-' + bolt,
            graduation, x + (bolt - 2) * (width - 1.10) / 5, 0.119,
            z + edge * (depth / 2 - 0.29), 0.17, 0.045, 0.16);
        }
      }
    }

    // Matte instrument service bays break up the repeating crosshatched
    // floor at actual gameplay zoom. They remain lower than world objects,
    // non-pickable and independent of navigation and combat hitboxes.
    for (const [zone, x, z, width, depth] of [
      ['service', worldW * 0.27, worldH * 0.29, 4.8, 3.4],
      ['transfer', worldW * 0.62, worldH * 0.73, 5.6, 3.8],
      ['reference', worldW * 0.73, worldH * 0.23, 4.6, 3.0],
    ] as const) {
      box(scene, this.root, 'p28-g9-calibration-floor-bay-' + zone,
        graphite, x, 0.018, z, width, 0.035, depth);
      box(scene, this.root, 'p28-g9-calibration-floor-centerplate-' + zone,
        shell, x, 0.048, z, width - 0.42, 0.032, depth - 0.55);
      for (let rail = -2; rail <= 2; rail++) {
        box(scene, this.root, 'p28-g9-calibration-floor-ruled-track-' + zone + '-' + rail,
          rail === 0 ? graduation : insulation,
          x + rail * (width - 0.90) / 5, 0.068, z,
          rail === 0 ? 0.22 : 0.10, 0.025, depth - 0.70);
      }
    }

    ([[760, 340], [1080, 690], [1370, 390]] as const).forEach(([x, z], index) => {
      const root = new TransformNode('p27-c10-reference-frame-' + index, scene);
      root.parent = this.root;
      root.position.set(scaled(x), 0, scaled(z));
      if (index === 1) root.rotation.y = Math.PI / 2;
      // Open optical survey gantry: a visible engraved datum arch, beam
      // insulators and suspended reticle distinguish this from a dark cuboid.
      box(scene, root, 'p28-g9-optical-frame-mounted-service-plate-' + index,
        graphite, 0, 0.16, 0, 3.60, 0.31, 2.00);
      box(scene, root, 'p27-c10-frame-left-' + index, shell, -0.98, 1.72, 0, 0.28, 3.44, 0.38);
      box(scene, root, 'p27-c10-frame-right-' + index, shell, 0.98, 1.72, 0, 0.28, 3.44, 0.38);
      box(scene, root, 'p27-c10-frame-top-' + index, etched, 0, 3.24, 0, 2.24, 0.22, 0.40);
      box(scene, root, 'p27-c10-frame-readout-' + index, cyan, 0, 1.68, 0.31, 1.65, 0.14, 0.24);
      box(scene, root, 'p28-g9-frame-isolator-' + index, insulation, 0, 2.87, 0.12, 1.88, 0.16, 0.27);
      const reticle = MeshBuilder.CreateTorus('p28-g9-frame-optical-reticle-' + index,
        { diameter: 1.34, thickness: 0.13, tessellation: 32 }, scene);
      reticle.parent = root;
      reticle.position.set(0, 2.38, 0.44);
      reticle.rotation.x = Math.PI / 2;
      reticle.material = indexed;
      reticle.isPickable = false;
      // Triangulated tube stays visibly open behind the calibrated reticle;
      // actual metal members, unlike another solid placeholder panel, keep
      // the cross-track optical axis mechanically legible at phone zoom.
      for (const side of [-1, 1]) {
        const tie = MeshBuilder.CreateTube('p28-g9-cross-track-triangulated-guy-' + index + '-' + side, {
          path: [new Vector3(side * 0.94, 0.38, 0.56), new Vector3(-side * 0.94, 3.09, 0.56)],
          radius: 0.095, tessellation: 10,
        }, scene);
        tie.parent = root;
        tie.material = graphite;
        tie.isPickable = false;
      }
      box(scene, root, 'p28-g9-frame-reticle-index-' + index, etched,
        0, 2.38, 0.52, 0.11, 1.32, 0.14);
      for (const side of [-1, 1]) {
        box(scene, root, 'p28-g9-frame-guide-' + index + '-' + side,
          graduation, side * 0.78, 1.58, 0.25, 0.20, 2.70, 0.16);
        for (let tick = 0; tick < 5; tick++) {
          box(scene, root, 'p28-g9-frame-scale-' + index + '-' + side + '-' + tick,
            tick === 2 ? graduation : etched, side * 0.98, 0.58 + tick * 0.54, 0.27,
            0.28, 0.09, 0.13);
        }
      }
      for (const sign of [-1, 1]) {
        box(scene, root, 'p28-g9-optical-gantry-cross-brace-' + index + '-' + sign,
          shell, sign * 0.74, 0.65, 0.36, 0.31, 0.20, 0.46);
        box(scene, root, 'p28-g9-optical-gantry-datum-foot-' + index + '-' + sign,
          graduation, sign * 0.94, 0.23, 0.46, 0.38, 0.18, 0.22);
      }
      this.frames.push(root);
    });

    ([[0.18, 0.53, Math.PI / 2], [0.50, 0.22, 0], [0.82, 0.58, -Math.PI / 2]] as const).forEach(([x, z, rotationY], index) => {
      const root = new TransformNode('p27-c10-mass-carriage-' + index, scene);
      root.parent = this.root;
      root.position.set(worldW * x, 0, worldH * z);
      root.rotation.y = rotationY;
      box(scene, root, 'p27-c10-carriage-base-' + index, graphite, 0, 0.30, 0, 2.90, 0.60, 1.48);
      // A real horizontal reference weight and coaxial gauge rings, not a
      // generic cuboid that reads like cargo cover at phone gameplay zoom.
      const massDrum = MeshBuilder.CreateCylinder('p27-c10-carriage-mass-' + index,
        { height: 1.52, diameter: 1.62, tessellation: 24 }, scene);
      massDrum.parent = root;
      massDrum.position.set(0, 0.98, 0);
      massDrum.rotation.z = Math.PI / 2;
      massDrum.material = counterweightMetal;
      massDrum.isPickable = false;
      for (const side of [-1, 1]) {
        const massBand = MeshBuilder.CreateTorus('p28-g9-carriage-coaxial-reference-race-' + index + '-' + side,
          { diameter: 1.70, thickness: 0.16, tessellation: 28 }, scene);
        massBand.parent = root;
        massBand.position.set(side * 0.79, 0.98, 0);
        massBand.rotation.z = Math.PI / 2;
        massBand.material = calibrationInk;
        massBand.isPickable = false;
      }
      const rail = box(scene, root, 'p27-c10-carriage-rail-' + index, violet, 0, 0.09, 0, 3.40, 0.08, 0.14);
      rail.position.y = 0.08;
      for (const side of [-1, 1]) {
        box(scene, root, 'p28-g9-carriage-suspension-' + index + '-' + side,
          insulation, side * 0.86, 0.39, 0.0, 0.24, 0.22, 0.94);
        box(scene, root, 'p28-g9-carriage-readout-' + index + '-' + side,
          etched, side * 0.66, 1.06, 0.45, 0.36, 0.15, 0.10);
        // Twin exposed mass gauges and circular races make this a measured
        // moving carriage rather than a generic rectangular cover block.
        const wheel = MeshBuilder.CreateTorus('p28-g9-carriage-mass-wheel-' + index + '-' + side,
          { diameter: 1.64, thickness: 0.26, tessellation: 24 }, scene);
        wheel.parent = root;
        wheel.position.set(side * 0.62, 1.04, 0.76);
        wheel.rotation.x = Math.PI / 2;
        wheel.material = counterweightMetal;
        wheel.isPickable = false;
        const gauge = MeshBuilder.CreateCylinder('p28-g9-carriage-mass-gauge-' + index + '-' + side,
          { diameter: 0.86, height: 0.16, tessellation: 20 }, scene);
        gauge.parent = root;
        gauge.position.set(side * 0.62, 1.04, 0.88);
        gauge.rotation.x = Math.PI / 2;
        gauge.material = graduation;
        gauge.isPickable = false;
        for (let bolt = 0; bolt < 3; bolt++) {
          const stud = MeshBuilder.CreateCylinder('p28-g9-carriage-stud-' + index + '-' + side + '-' + bolt,
            { height: 0.12, diameter: 0.12, tessellation: 12 }, scene);
          stud.parent = root;
          stud.position.set(side * 0.98, 0.64, (bolt - 1) * 0.36);
          stud.material = graphite;
          stud.isPickable = false;
        }
      }
      for (let tick = 0; tick < 5; tick++) {
        box(scene, root, 'p28-g9-carriage-graduation-' + index + '-' + tick,
          tick % 2 ? etched : graduation, (tick - 2) * 0.25, 1.34, 0.30,
          0.12, 0.08, 0.12);
      }
      // The mass carriage is a rail-guided counterweight, not two loose
      // decorative wheels. Expose its shaft, service bearing and indexed head.
      const shaft = MeshBuilder.CreateCylinder('p28-g9-carriage-coupling-shaft-' + index,
        { diameter: 0.24, height: 2.25, tessellation: 16 }, scene);
      shaft.parent = root;
      shaft.position.set(0, 0.93, 0.43);
      shaft.rotation.z = Math.PI / 2;
      shaft.material = graduation;
      shaft.isPickable = false;
      box(scene, root, 'p28-g9-carriage-machined-head-' + index,
        graphite, 0, 1.37, 0, 1.74, 0.22, 0.82);
      box(scene, root, 'p28-g9-carriage-index-plate-' + index,
        graduation, 0, 1.50, 0, 1.38, 0.06, 0.52);
      for (const side of [-1, 1]) {
        box(scene, root, 'p28-g9-carriage-rail-shoe-' + index + '-' + side,
          shell, side * 1.32, 0.24, 0.15, 0.58, 0.22, 0.87);
      }
      // Counterweight mass and orange-brass travel scale are a different
      // silhouette from the pylons' loop coils and the anchor's split fork.
      box(scene, root, 'p28-g9-instrumented-moving-counterweight-' + index,
        counterweightMetal, 0, 1.71, 0, 1.60, 0.82, 1.05);
      // Wide exposed top face: machined ruler, high-contrast gauge sectors
      // and travel stops remain visible when the front dial faces away.
      box(scene, root, 'p28-g9-counterweight-hardened-upper-deck-' + index,
        shell, 0, 2.18, 0, 2.18, 0.14, 1.18);
      box(scene, root, 'p28-g9-counterweight-top-measuring-channel-' + index,
        insulation, 0, 2.30, 0, 1.80, 0.10, 0.74);
      // A true machined top bearing and concentric calibrated race break
      // the crate silhouette of the moving counterweight. This is grounded
      // on the top housing; the real simulated travel range is unchanged.
      const massBearing = MeshBuilder.CreateCylinder('p28-g9-carriage-top-machined-bearing-' + index,
        { diameter: 1.42, height: 0.24, tessellation: 24 }, scene);
      massBearing.parent = root;
      massBearing.position.y = 2.59;
      massBearing.material = counterweightMetal;
      massBearing.isPickable = false;
      const bearingRace = MeshBuilder.CreateTorus('p28-g9-carriage-top-indexed-bearing-race-' + index,
        { diameter: 1.69, thickness: 0.17, tessellation: 30 }, scene);
      bearingRace.parent = root;
      bearingRace.position.y = 2.73;
      bearingRace.material = fiducialBrass;
      bearingRace.isPickable = false;
      for (let station = 0; station < 8; station++) {
        const angle = station * Math.PI / 4;
        const tick = box(scene, root, 'p28-g9-carriage-top-vernier-notch-' + index + '-' + station,
          station % 2 === 0 ? etched : graduation,
          Math.cos(angle) * 0.70, 2.75, Math.sin(angle) * 0.70, 0.13, 0.065, 0.30);
        tick.rotation.y = -angle;
      }
      // Broad cobalt gauge steps and a transverse forked yoke establish a
      // movable weight profile distinct from pylons and perimeter anchors.
      for (const side of [-1, 1]) {
        box(scene, root, 'p28-g9-counterweight-arched-fork-' + index + '-' + side,
          counterweightMetal, side * 1.07, 2.02, -0.36, 0.30, 0.88, 0.70);
        box(scene, root, 'p28-g9-counterweight-top-flight-rule-' + index + '-' + side,
          cyan, side * 1.05, 2.51, -0.36, 0.30, 0.12, 0.62);
      }
      for (let mark = 0; mark < 9; mark++) {
        box(scene, root, 'p28-g9-counterweight-macro-top-graduation-' + index + '-' + mark,
          mark % 4 === 0 ? objectiveGold : fiducialBrass, (mark - 4) * 0.24, 2.40, 0.04,
          mark % 4 === 0 ? 0.14 : 0.08, 0.075, mark % 4 === 0 ? 0.88 : 0.49);
      }
      for (const side of [-1, 1]) {
        box(scene, root, 'p28-g9-counterweight-axle-bearing-housing-' + index + '-' + side,
          graphite, side * 1.22, 1.28, 0.10, 0.46, 0.95, 1.26);
      }
      box(scene, root, 'p28-g9-counterweight-travel-indicator-' + index,
        fiducialBrass, 0, 2.20, 0.80, 1.78, 0.24, 0.26);
      for (const side of [-1, 1]) {
        const axle = MeshBuilder.CreateCylinder('p28-g9-carriage-exposed-axle-' + index + '-' + side,
          { height: 0.64, diameter: 0.46, tessellation: 20 }, scene);
        axle.parent = root;
        axle.position.set(side * 1.12, 1.06, 0.44);
        axle.rotation.z = Math.PI / 2;
        axle.material = graduation;
        axle.isPickable = false;
      }
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
      // Each real shear fork now grows out of a bolted floor socket with
      // visible vertical mounting saddles. The violet ceramic no longer reads
      // as a free-floating lavender rectangle at the gameplay camera angle.
      box(scene, root, 'p28-g9-shear-anchor-bolted-floor-foundation-' + index,
        graphite, 0, 0.18, 0.25, 2.40, 0.35, 2.10);
      box(scene, root, 'p28-g9-shear-anchor-foundation-recess-' + index,
        insulation, 0, 0.38, 0.28, 1.94, 0.12, 1.55);
      for (const side of [-1, 1]) {
        box(scene, root, 'p28-g9-shear-anchor-grounded-saddle-' + index + '-' + side,
          shell, side * 0.56, 0.79, 0.42, 0.62, 1.38, 0.81);
        box(scene, root, 'p28-g9-shear-anchor-mount-bolt-' + index + '-' + side,
          fiducialBrass, side * 0.95, 0.50, 0.86, 0.24, 0.25, 0.25);
      }
      box(scene, root, 'p27-c10-anchor-base-' + index, graphite, 0, 0.24, 0, 1.70, 0.48, 1.50);
      const fin = box(scene, root, 'p27-c10-anchor-fin-' + index, shearCeramic, 0, 0.98, 0, 0.28, 1.68, 0.98);
      fin.rotation.z = index % 2 ? 0.10 : -0.10;
      const marker = MeshBuilder.CreateTorus('p27-c10-anchor-ring-' + index, { diameter: 0.56, thickness: 0.09, tessellation: 6 }, scene);
      marker.parent = root;
      marker.position.y = 1.58;
      marker.rotation.x = Math.PI / 2;
      marker.material = shearCeramic;
      marker.isPickable = false;
      box(scene, root, 'p28-g9-anchor-insulator-' + index,
        insulation, 0, 0.60, 0.34, 0.52, 0.30, 0.24);
      box(scene, root, 'p28-g9-anchor-calibration-face-' + index,
        etched, 0, 1.20, 0.48, 0.18, 0.54, 0.12);
      for (const side of [-1, 1]) {
        const strut = box(scene, root, 'p28-g9-shear-anchor-fork-' + index + '-' + side,
          shearCeramic, side * 0.48, 1.13, 0.18, 0.29, 1.78, 0.28);
        strut.rotation.z = side * 0.18;
      }
      // Every baseline shear anchor has its own exposed optical index dial
      // and powered conductor bars, instead of only a plain U silhouette.
      // This is decorative presentation; the simulation retains all hitboxes.
      const anchorDial = MeshBuilder.CreateTorus('p28-g9-anchor-indexed-dial-' + index,
        { diameter: 1.32, thickness: 0.15, tessellation: 32 }, scene);
      anchorDial.parent = root;
      anchorDial.position.set(0, 1.20, 0.72);
      anchorDial.rotation.x = Math.PI / 2;
      anchorDial.material = indexed;
      anchorDial.isPickable = false;
      const anchorHub = MeshBuilder.CreateCylinder('p28-g9-anchor-measuring-hub-' + index,
        { diameter: 0.40, height: 0.15, tessellation: 20 }, scene);
      anchorHub.parent = root;
      anchorHub.position.set(0, 1.20, 0.81);
      anchorHub.rotation.x = Math.PI / 2;
      anchorHub.material = graduation;
      anchorHub.isPickable = false;
      for (const side of [-1, 1]) {
        box(scene, root, 'p28-g9-anchor-etched-conductor-' + index + '-' + side,
          etched, side * 0.38, 1.15, 0.46, 0.13, 1.48, 0.16);
        box(scene, root, 'p28-g9-anchor-metal-footshoe-' + index + '-' + side,
          shell, side * 0.36, 0.32, 0.55, 0.31, 0.20, 0.34);
      }
      for (let tick = 0; tick < 8; tick++) {
        const angle = tick * Math.PI / 4;
        box(scene, root, 'p28-g9-anchor-index-mark-' + index + '-' + tick,
          tick % 2 ? etched : graduation,
          Math.sin(angle) * 0.64, 1.20 + Math.cos(angle) * 0.64, 0.81,
          0.20, 0.16, 0.15);
      }
      // The insulated split mast is a physical shear-anchor signifier, not
      // another pale circular survey coil. A continuous purple ceramic bridge
      // over two dark polymer sleeves makes the difference visible at zoom.
      for (const side of [-1, 1]) {
        const prong = MeshBuilder.CreateCylinder('p28-g9-shear-anchor-insulated-upright-' + index + '-' + side,
          { height: 2.16, diameterTop: 0.34, diameterBottom: 0.58, tessellation: 6 }, scene);
        prong.parent = root;
        prong.position.set(side * 0.56, 1.30, 0.52);
        prong.material = insulation;
        prong.isPickable = false;
        box(scene, root, 'p28-g9-shear-anchor-ceramic-collar-' + index + '-' + side,
          indexed, side * 0.56, 2.18, 0.55, 0.48, 0.25, 0.44);
      }
      box(scene, root, 'p28-g9-shear-anchor-violet-crosshead-' + index,
        shearCeramic, 0, 2.44, 0.52, 1.82, 0.32, 0.38);
      // The anchor is an insulated steel interferometer fork, not a flat
      // lavender monolith. A narrow ceramic hazard channel sits between
      // two KTX2 metal prongs, with top-facing index pins and bolted knuckles.
      box(scene, root, 'p28-g9-shear-anchor-violet-inset-' + index,
        shearCeramic, 0, 2.65, 0.52, 1.45, 0.14, 0.21);
      // A single exposed split-jaw dial sits above the steel saddle. Its
      // dark top-facing hexagonal spindle and violet ceramic index visibly
      // identify shear hardware without painting the whole fork lavender.
      const jawDial = MeshBuilder.CreateCylinder('p28-g9-shear-anchor-hex-dial-' + index,
        { diameter: 1.15, height: 0.26, tessellation: 6 }, scene);
      jawDial.parent = root;
      jawDial.position.set(0, 2.87, 0.52);
      jawDial.material = graphite;
      jawDial.isPickable = false;
      box(scene, root, 'p28-g9-shear-anchor-index-window-' + index,
        indexed, 0, 3.04, 0.52, 0.52, 0.11, 0.43);
      for (const side of [-1, 1]) {
        box(scene, root, 'p28-g9-shear-anchor-metal-prong-' + index + '-' + side,
          graphite, side * 0.77, 1.61, 0.26, 0.24, 2.18, 0.48);
        box(scene, root, 'p28-g9-shear-anchor-machined-jaw-' + index + '-' + side,
          fiducialBrass, side * 0.78, 2.73, 0.35, 0.40, 0.24, 0.46);
        // Three restrained fasteners, not a ladder of pale cuboid teeth.
        for (let notch = 0; notch < 3; notch++) {
          box(scene, root, 'p28-g9-shear-anchor-brass-station-' + index + '-' + side + '-' + notch,
            fiducialBrass, side * 1.01, 0.90 + notch * 0.56, 0.39,
            0.12, 0.10, 0.23);
        }
      }
      // An exposed instrument head crowns the split steel fork. Twelve
      // faceted sidewalls and a recessed violet readout replace another
      // anonymous pale stepped box at Android gameplay scale.
      const transducer = MeshBuilder.CreateCylinder('p28-g9-shear-anchor-optical-transducer-' + index,
        { height: 0.36, diameterTop: 0.65, diameterBottom: 0.92, tessellation: 12 }, scene);
      transducer.parent = root;
      transducer.position.set(0, 3.18, 0.52);
      transducer.material = shearCeramic;
      transducer.isPickable = false;
      // A pale, round top race made these eight *shear anchors* resemble
      // the three true reference pylons in actual Android pixels. Keep the
      // optical readout but make the silhouette a dark faceted violet key,
      // with a transverse ceramic bridge joining the powered split prongs.
      const transducerRim = MeshBuilder.CreateTorus('p28-g9-shear-anchor-transducer-index-ring-' + index,
        { diameter: 0.90, thickness: 0.14, tessellation: 6 }, scene);
      transducerRim.parent = root;
      transducerRim.position.set(0, 3.38, 0.52);
      transducerRim.rotation.y = Math.PI / 6;
      transducerRim.material = shearCeramic;
      transducerRim.isPickable = false;
      box(scene, root, 'p28-g9-shear-anchor-violet-powered-crosshead-' + index,
        indexed, 0, 3.52, 0.52, 1.32, 0.17, 0.34);
      this.anchors.push(root);
    });

    pylonFallback.forEach(([id, x, z], index) => {
      const root = new TransformNode('p27-c10-reference-console-' + index, scene);
      root.parent = this.root;
      root.position.set(scaled(x + (index === 1 ? -92 : 78)), 0, scaled(z + (index === 2 ? -60 : 50)));
      box(scene, root, 'p27-c10-console-body-' + index, graphite, 0, 0.42, 0, 0.82, 0.84, 0.62);
      const screen = box(scene, root, 'p27-c10-console-screen-' + index, referenceScreen, 0, 0.82, -0.30, 0.74, 0.40, 0.06);
      screen.rotation.x = -0.18;
      box(scene, root, 'p28-g9-console-bezel-' + index,
        insulation, 0, 0.78, -0.25, 0.85, 0.50, 0.10);
      // Move the illuminated readout in front of the recessed bezel.
      screen.position.z = -0.32;
      for (let dial = 0; dial < 3; dial++) {
        const knob = MeshBuilder.CreateCylinder('p28-g9-console-knob-' + index + '-' + dial,
          { height: 0.12, diameter: 0.10, tessellation: 12 }, scene);
        knob.parent = root;
        knob.position.set((dial - 1) * 0.20, 0.51, -0.36);
        knob.rotation.x = Math.PI / 2;
        knob.material = fixture;
        knob.isPickable = false;
      }
      box(scene, root, 'p28-g9-console-engraved-base-' + index,
        shell, 0, 0.22, -0.14, 1.26, 0.24, 1.18);
      for (let tick = 0; tick < 4; tick++) {
        box(scene, root, 'p28-g9-console-readout-scale-' + index + '-' + tick,
          tick === 0 ? graduation : etched,
          -0.27 + tick * 0.18, 0.91, -0.39, 0.11, 0.18, 0.10);
      }
      // Distinct three-channel metrology console: cyan analysis screen in a
      // dark tilted housing and an amber frequency/range scale tall enough
      // to remain visible from the actual player camera.
      const raisedConsole = box(scene, root, 'p28-g9-console-large-angled-housing-' + index,
        graphite, 0, 1.38, 0.12, 2.00, 1.10, 0.52);
      raisedConsole.rotation.x = -0.20;
      box(scene, root, 'p28-g9-console-large-metric-screen-' + index,
        referenceScreen, 0, 1.45, 0.45, 1.72, 0.76, 0.13);
      for (let channel = 0; channel < 3; channel++) {
        box(scene, root, 'p28-g9-console-calibration-channel-' + index + '-' + channel,
          channel === 1 ? fiducialBrass : etched, -0.45 + channel * 0.45, 1.49, 0.56,
          0.22, 0.54, 0.10);
      }
      // Sloped cyan readout and numbered brass channels also face up toward
      // the overhead Android camera, not only toward the local console front.
      box(scene, root, 'p28-g9-console-overhead-metric-glass-' + index,
        referenceScreen, 0, 2.02, 0.12, 1.75, 0.10, 1.02);
      const consoleCalibration = MeshBuilder.CreatePlane('p28-g9-console-numbered-readout-' + index,
        { width: 1.58, height: 0.80 }, scene);
      consoleCalibration.parent = root;
      consoleCalibration.rotation.x = -Math.PI / 2;
      consoleCalibration.position.set(0, 2.085, 0.12);
      consoleCalibration.material = this.calibrationDisplayMaterial;
      consoleCalibration.isPickable = false;
      for (let channel = 0; channel < 4; channel++) {
        box(scene, root, 'p28-g9-console-overhead-readout-graduation-' + index + '-' + channel,
          channel === 0 ? objectiveGold : fiducialBrass,
          -0.57 + channel * 0.38, 2.11, 0.12, 0.16, 0.08, 0.78);
      }
      const consoleLens = MeshBuilder.CreateTorus('p28-g9-console-optical-port-' + index,
        { diameter: 0.40, thickness: 0.08, tessellation: 24 }, scene);
      consoleLens.parent = root;
      consoleLens.position.set(0, 0.44, -0.44);
      consoleLens.rotation.x = Math.PI / 2;
      consoleLens.material = graduation;
      consoleLens.isPickable = false;
      root.metadata = { referenceNode: id };
      this.consoles.push(root);
    });

    const navigation = getMapNavigationPlan('parallax-array');
    navigation.routes.forEach(route => {
      const material = route.kind === 'primary' ? routePrimary : routeSecondary;
      const width = Math.min(babylonRouteMarkingWidth(route.kind), route.kind === 'primary' ? 0.10 : 0.065);
      route.points.slice(0, -1).forEach((point, index) => {
        const next = route.points[index + 1];
        routeSegment(scene, this.root, material, 'p27-c10-route-' + route.id + '-' + index, scaled(point.x), scaled(point.y), scaled(next.x), scaled(next.y), width);
      });
    });
    navigation.landmarks.forEach((landmark, index) => {
      // These three wayfinding beacons are NOT the three live alignment
      // standards. Their former 3.4m ring-topped spires resembled pylons in
      // actual phone pixels and made the objective appear unidentifiable.
      // Retain the same grounded navigation points but use low cyan bollards,
      // unmistakably shorter than each instrumented amber ALIGN target.
      const beacon = MeshBuilder.CreateCylinder('p27-c10-landmark-' + landmark.id,
        { height: 1.10, diameterTop: 0.26, diameterBottom: 0.76, tessellation: 8 }, scene);
      beacon.parent = this.root;
      beacon.position.set(scaled(landmark.x), 0.55, scaled(landmark.y));
      beacon.material = graphite;
      beacon.isPickable = false;
      const marker = MeshBuilder.CreateTorus('p27-c10-landmark-ring-' + index,
        { diameter: 0.70, thickness: 0.11, tessellation: 20 }, scene);
      marker.parent = this.root;
      marker.position.set(scaled(landmark.x), 1.08, scaled(landmark.y));
      marker.rotation.x = Math.PI / 2;
      marker.material = cyan;
      marker.isPickable = false;
      const shoe = MeshBuilder.CreateCylinder('p28-g9-wayfinding-grounded-bollard-shoe-' + index,
        { diameter: 1.02, height: 0.12, tessellation: 12 }, scene);
      shoe.parent = this.root;
      shoe.position.set(scaled(landmark.x), 0.07, scaled(landmark.y));
      shoe.material = shell;
      shoe.isPickable = false;
    });

    this.shearMaterial = new StandardMaterial('p27-c10-reference-shear-material', scene);
    this.shearMaterial.diffuseColor = colorFromHex(0xac87e7).scale(0.22);
    this.shearMaterial.emissiveColor = colorFromHex(0xc2a0ff).scale(0.85);
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
      const ring = MeshBuilder.CreateTorus('p27-c10-shear-ring-' + index, { diameter: 5.20, thickness: 0.19, tessellation: 40 }, scene);
      ring.parent = root;
      ring.position.y = 0.08;
      ring.material = this.shearMaterial;
      ring.isPickable = false;
      // Detached sector ticks turn a live vector wash into a bounded,
      // unmistakeable violet hazard, never a navigation ribbon.
      for (let mark = 0; mark < 8; mark++) {
        const angle = mark * Math.PI / 4;
        const tick = box(scene, root, 'p28-g9-shear-perimeter-threat-tick-' + index + '-' + mark,
          this.shearMaterial, Math.cos(angle) * 2.50, 0.12,
          Math.sin(angle) * 2.50, 0.46, 0.08, 0.20);
        tick.rotation.y = -angle;
      }
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
    // Display the real boss pattern wind-up as a grounded amber ring. Violet
    // indicates world shear; amber signals this actor's attack specifically.
    this.bossWarning = MeshBuilder.CreateTorus('p28-g9-boss-attack-warning-ring',
      { diameter: 3.90, thickness: 0.22, tessellation: 40 }, scene);
    this.bossWarning.parent = this.bossCueRoot;
    this.bossWarning.position.y = 0.18;
    this.bossWarning.rotation.x = Math.PI / 2;
    this.bossWarning.material = this.bossCueMaterial;
    this.bossWarning.isPickable = false;
    this.bossWarning.setEnabled(false);
    this.bossCueRoot.setEnabled(false);

    // The real senior baseline controller is an elite, not the later
    // Baseline Keeper boss. Ground a separate status/tell at the actual elite
    // position; intensify the amber outline only during a real telegraph.
    this.eliteTellMaterial = new StandardMaterial('p28-g9-baseline-controller-tell-material', scene);
    this.eliteTellMaterial.diffuseColor = colorFromHex(0x8b572d).scale(0.18);
    this.eliteTellMaterial.emissiveColor = colorFromHex(0x52bed8).scale(0.68);
    this.eliteTellMaterial.alpha = 0.50;
    this.eliteTellMaterial.disableLighting = true;
    // A raised, physically attached amber contact reticle must remain
    // visible over dark grid joints, even when the elite's body is tiny.
    // Actual attack wind-ups still exclusively control the brighter state.
    this.eliteTellRing = MeshBuilder.CreateTorus('p28-g9-elite-controller-contact-warning',
      { diameter: 2.48, thickness: 0.16, tessellation: 40 }, scene);
    this.eliteTellRing.parent = this.root;
    // The elite warning must hug the deck, not read as a giant opaque arc
    // crossing actors and mechanical contacts at Android gameplay zoom.
    this.eliteTellRing.rotation.x = 0;
    this.eliteTellRing.material = this.eliteTellMaterial;
    this.eliteTellRing.isPickable = false;
    this.eliteTellRing.setEnabled(false);
    // Separate contact identity from amber alignment fixtures: only an
    // actual enemy telegraph turns this world-space optic red.
    this.eliteContactBeacon = MeshBuilder.CreateCylinder('p28-g9-elite-controller-optical-sight',
      { height: 1.46, diameterTop: 0.17, diameterBottom: 1.26, tessellation: 8 }, scene);
    this.eliteContactBeacon.parent = this.root;
    this.eliteContactBeacon.material = this.eliteTellMaterial;
    this.eliteContactBeacon.isPickable = false;
    this.eliteContactBeacon.setEnabled(false);

    const shared = new Set(this.premiumSurfaces.materials.values());
    this.premiumBindingCount = this.root.getChildMeshes(false)
      .filter(mesh => mesh.material instanceof PBRMaterial && shared.has(mesh.material)).length;
    this.meshCount = this.root.getChildMeshes(false).length;
    this.root.setEnabled(false);
    this.iblTexture = new CubeTexture('/assets/environments/refinery-prefiltered.env',
      scene, undefined, false, undefined,
      () => { this.iblReady = true; }, () => { this.iblReady = false; }, undefined, true);
    this.iblTexture.name = 'p28-g9-parallax-shared-prefiltered-ibl';
    this.iblTexture.gammaSpace = false;

    const lighting = BABYLON_PARALLAX_ARRAY_LIGHTING;
    this.hemisphere = new HemisphericLight('p27-c10-parallax-hemisphere', new Vector3(-0.10, 1, 0.14), scene);
    this.hemisphere.diffuse = colorFromHex(0xd8d0f1);
    this.hemisphere.groundColor = colorFromHex(0x242331);
    this.hemisphere.intensity = 0.90;
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
    this.practicalLights[0].diffuse = colorFromHex(0x9e70e2);
    this.practicalLights[0].range = 8.8;
    this.practicalLights[1].diffuse = colorFromHex(0x72d9e7);
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
      // A prominent pale calibration orb clipped by the camera's lower edge
      // was mistaken for an incomplete objective beacon in actual phone PNGs.
      // Suppress only the projected bright rings/core at that edge. The live
      // reference station, PBR silhouette and physically attached amber
      // objective diamond remain rendered and interactive without moving the
      // gameplay camera or affecting any simulation state.
      const camera = this.scene.activeCamera;
      let ringFitsFrame = true;
      if (camera) {
        const engine = this.scene.getEngine();
        const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
        rig.core.computeWorldMatrix(true);
        const projected = Vector3.Project(rig.core.getAbsolutePosition(), Matrix.Identity(),
          this.scene.getTransformMatrix(), viewport);
        ringFitsFrame = parallaxReferenceRingFitsFrame(projected.y, viewport.y, viewport.height);
        // The full corner-hull guard rejected genuine distant instruments
        // whose bracing crossed an edge while their face was fully onscreen.
        // Gate only the world-space *face center* against the camera's safe
        // top/bottom frame. This preserves real pylon scales at gameplay zoom
        // and suppresses ornamental numbers approaching the lower touch HUD,
        // never hiding the simulation object, objective or boss telegraph.
        rig.gaugeFace.computeWorldMatrix(true);
        const faceCenter = Vector3.Project(rig.gaugeFace.getAbsolutePosition(),
          Matrix.Identity(), this.scene.getTransformMatrix(), viewport);
        const gaugeFitsFrame = Number.isFinite(faceCenter.x) && Number.isFinite(faceCenter.y)
          && faceCenter.x >= viewport.x + viewport.width * 0.04
          && faceCenter.x <= viewport.x + viewport.width * 0.96
          && faceCenter.y >= viewport.y + viewport.height * 0.06
          && faceCenter.y <= viewport.y + viewport.height * 0.66;
        rig.gauge.setEnabled(gaugeFitsFrame);
      }
      const aligned = Boolean(object?.exposed && object.hp > 0);
      const pulse = aligned ? 1.08 + Math.sin(state.time * 5.8 + index) * 0.08 : 0.96 + Math.sin(state.time * 2.5 + index) * 0.035;
      rig.rings.forEach((ring, ringIndex) => {
        ring.setEnabled(ringFitsFrame);
        ring.scaling.set(pulse, pulse, pulse);
        ring.rotation.z = state.time * (aligned ? 0.66 : 0.18) * (ringIndex % 2 ? -1 : 1);
      });
      const coreScale = aligned ? 1.20 + Math.sin(state.time * 6.4 + index) * 0.08 : 0.96;
      rig.core.setEnabled(ringFitsFrame);
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
    // Retain the real vector-wash extent, but let machined geometry show through.
    this.shearMaterial.alpha = (vectorWashes.length > 0 ? 0.23 : 0.06) * renderBudget.transparencyScale;
    this.shearMaterial.emissiveColor = colorFromHex(0xc9a0ff).scale(0.82 + Math.sin(state.time * 6.6) * 0.08);

    const gravityValues = state.sectors.slice(0, 3).map(sector => sector.gravity);
    const gravitySpread = gravityValues.length > 0 ? Math.max(...gravityValues) - Math.min(...gravityValues) : 0;
    const shearMode = parallaxShearMode(vectorWashes.length, gravitySpread);
    const cueCount = this.syncObjectCues(state);
    const baselineController = state.enemies.find(enemy => enemy.active && !enemy.dead
      && enemy.role === 'elite' && enemy.label.includes('Baseline Controller')) ?? null;
    this.eliteTellRing.setEnabled(Boolean(baselineController));
    this.eliteContactBeacon.setEnabled(Boolean(baselineController));
    if (baselineController) {
      this.eliteTellRing.position.set(scaled(baselineController.x), 0.13, scaled(baselineController.y));
      this.eliteContactBeacon.position.set(scaled(baselineController.x), 3.20, scaled(baselineController.y));
      const telegraphActive = baselineController.telegraph > 0;
      this.eliteTellMaterial.alpha = telegraphActive ? 0.82 : 0.42;
      this.eliteTellMaterial.emissiveColor = colorFromHex(telegraphActive ? 0xff6649 : 0x52c7df)
        .scale(telegraphActive ? 1.15 : 0.86);
      const pulse = telegraphActive ? 1 + Math.sin(state.time * 12) * 0.08 : 1;
      this.eliteTellRing.scaling.set(pulse, pulse, pulse);
    }
    const configuredBoss = state.enemies.find(enemy => !enemy.dead && enemy.role === 'boss') ?? null;
    const activeBoss = configuredBoss?.active ? configuredBoss : null;
    const baselineKeeper = configuredBoss?.variant === 'baselineKeeper';
    this.bossCueRoot.setEnabled(Boolean(activeBoss));
    if (activeBoss) {
      this.bossCueRoot.position.set(scaled(activeBoss.x), 0.05, scaled(activeBoss.y));
      const phaseTwo = activeBoss.bossPhase === 2;
      const patternHot = ['baselineFork', 'parallaxSweep', 'shearCollapse'].includes(activeBoss.bossPattern);
      const bossColor = colorFromHex(patternHot ? 0xf2a35e : phaseTwo ? 0xc7f3f5 : 0x9a87cf);
      this.bossCueMaterial.diffuseColor = bossColor.scale(0.22);
      this.bossCueMaterial.emissiveColor = bossColor.scale(patternHot ? 1.25 : phaseTwo ? 1.02 : 0.86);
      this.bossCueMaterial.alpha = phaseTwo ? 0.72 : 0.58;
      const pulse = 1 + Math.sin(state.time * (patternHot ? 7.4 : phaseTwo ? 5.8 : 3.8) + activeBoss.patternIndex) * (patternHot ? 0.14 : 0.07);
      this.bossWarning.setEnabled(patternHot);
      this.bossWarning.scaling.set(pulse, pulse, pulse);
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
    this.hemisphere.intensity = 0.90 * (renderBudget.tierName === 'performance' ? 0.82 : 1);
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
    const practicalCount = renderBudget.tierName === 'performance' ? 1 : 2;
    this.practicalLights.forEach((light, index) => {
      const enabled = index < practicalCount;
      light.setEnabled(enabled);
      light.intensity = enabled ? (index === 0 ? 5.1 : 4.6) * tierScale : 0;
    });
    const routePulse = 0.86 + Math.sin(state.time * 3.5) * 0.14;
    this.routeMaterials[0].emissiveColor = colorFromHex(0x655485).scale(0.026 * routePulse);
    this.routeMaterials[1].emissiveColor = colorFromHex(0x36626a).scale(0.014 * routePulse);

    this.scene.environmentTexture = this.iblReady ? this.iblTexture : null;
    this.scene.environmentIntensity = this.iblReady
      ? (renderBudget.tierName === 'performance' ? 0.64 : 0.94) : 0;
    this.scene.imageProcessingConfiguration.toneMappingEnabled = true;
    this.scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    this.scene.imageProcessingConfiguration.exposure = lighting.exposure * (lowVisibility ? 1.04 : 1);
    this.scene.imageProcessingConfiguration.contrast = 1.03;

    const navigation = getMapNavigationPlan('parallax-array');
    const gravity = gravityValues.map(value => value.toFixed(2)).join('>');
    const baselineServos = state.objects.filter(object => object.id.startsWith('baseline-anchor-') && object.active && object.hp > 0).length;
    const pbrCount = this.scene.materials.filter(item => item instanceof PBRMaterial).length;
    const premiumReady = BABYLON_PARALLAX_PREMIUM_SURFACES.every(id => {
      const material = this.premiumSurfaces.get(id);
      return material.albedoTexture?.isReady() === true
        && material.bumpTexture?.isReady() === true
        && material.metallicTexture?.isReady() === true
        && (!material.emissiveTexture || material.emissiveTexture.isReady());
    });
    this.canvas.dataset.parallaxPremiumAssetState = premiumReady ? 'ready' : 'loading';
    this.canvas.dataset.parallaxPremiumBindings = String(this.premiumBindingCount);
    this.canvas.dataset.parallaxPremiumSurfaces = BABYLON_PARALLAX_PREMIUM_SURFACES.join(',');
    this.canvas.dataset.babylonRouteMarkingProfile = 'parallax-recessed-metrology-inlay';
    this.canvas.dataset.babylonRouteMarkingMaxWidth = String(BABYLON_ROUTE_MARKING_WIDTHS.primary);
    this.canvas.dataset.babylonEnvironmentState = premiumReady && this.iblReady ? 'ready' : 'loading';
    this.canvas.dataset.environmentVisual = 'procedural-parallax-array-babylon';
    this.canvas.dataset.environmentKit = 'baseline-pylon,reference-frame,mass-carriage,shear-anchor,reference-console,reference-shear,wayfinding,boss-cue';
    this.canvas.dataset.environmentInstances = String(this.meshCount + this.objectCues.size);
    this.canvas.dataset.environmentPerformanceProfile = profile.name + ':procedural:structure-shadows-off';
    this.canvas.dataset.environmentInstanceBudget = 'pylon:3+frame:' + profile.frameInstances + '+carriage:' + profile.carriageInstances + '+anchor:' + profile.anchorInstances + '+shear:' + profile.shearInstances + '+console:3';
    this.canvas.dataset.environmentShadowCasters = 'off';
    this.canvas.dataset.environmentLandmark = 'three-point-long-baseline';
    this.canvas.dataset.environmentServiceDetails = 'reference-console:3+mass-carriage:' + profile.carriageInstances;
    this.canvas.dataset.environmentSurfaceDetail = 'reference-frame:' + profile.frameInstances + '+shear-anchor:' + profile.anchorInstances
      + '+pylon-fiducial:27+frame-scale:30+carriage-stud:18+console-knob:9+anchor-insulator:8+physical-baseline:3+datum-graduation:39+isolator-foot:12+objective-crown:9+side-objective-beacon:9+conductor-bar:6+pylon-large-mark:18+counterweight:3+ceramic-upright:16+survey-floor-island:3+pylon-plinth:3+grounded-anchor:8+macro-ruler:3+carriage-top-meter:3+console-top-screen:3+vernier-sleeve:3+cross-track-tie:6+counterweight-bearing:3';
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
    this.canvas.dataset.babylonMaterialIntent = 'shared-ktx2-pbr+metrology-composite+graphite-structure+reference-violet+cyan-readout+shared-world-pbr';
    this.canvas.dataset.babylonLightingBudget = 'tier:' + renderBudget.tierName + '|practical:' + practicalCount + '|shadows:off';
    this.canvas.dataset.environmentIbl = this.iblReady ? 'shared-prefiltered:ready' : 'shared-prefiltered:loading';
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
    if (this.scene.environmentTexture === this.iblTexture) this.scene.environmentTexture = null;
    this.canvas.dataset.babylonParallaxArrayRelease = reason;
  }

  dispose() {
    this.release('renderer-dispose');
    this.root.getChildMeshes(false).forEach(mesh => mesh.dispose());
    this.root.dispose();
    if (this.scene.environmentTexture === this.iblTexture) this.scene.environmentTexture = null;
    this.iblTexture.dispose();
    this.datumAlbedoTexture.dispose();
    this.datumNormalTexture.dispose();
    this.calibrationDisplayMaterial.dispose();
    this.calibrationDisplayTexture.dispose();
    this.pylonVernierMaterial.dispose();
    this.pylonVernierTexture.dispose();
    this.pylonIndexMaterials.forEach(material => material.dispose());
    this.pylonIndexTextures.forEach(texture => texture.dispose());
    this.ownedMaterials.forEach(item => item.dispose());
    this.premiumSurfaces.dispose();
    this.shearMaterial.dispose();
    this.bossCueMaterial.dispose();
    this.eliteTellMaterial.dispose();
    this.objectiveSignalMaterial.dispose();
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
        mesh.material = label.includes('pylon') || label.includes('servo') ? this.premiumSurfaces.get('emissive-fixture') : this.premiumSurfaces.get('painted-metal');
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
