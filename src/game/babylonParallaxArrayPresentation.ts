import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { CubeTexture } from '@babylonjs/core/Materials/Textures/cubeTexture';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
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
  keyColor: 0xe2ddf1,
  rimColor: 0x9a87cf,
  emergencyColor: 0x7864ba,
  keyIntensity: 2.5,
  rimIntensity: 1.4,
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

type PylonRig = { id: string; root: TransformNode; rings: Mesh[]; core: Mesh };
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
    graphite.albedoColor = colorFromHex(0xa1acba);
    shell.albedoColor = colorFromHex(0x7b8ca0);
    const violet = pbr(scene, 'p27-c10-violet-alignment', 0x665680, 0.44, 0.46, 0x9a87cf, 0.34);
    const cyan = pbr(scene, 'p27-c10-cyan-readout', 0x48767b, 0.38, 0.39, 0x82d7df, 0.44);
    // Pale enamel indices are trim on shipped KTX2 painted/metal structure,
    // not replacement base materials or wide glowing navigation ribbons.
    const etched = pbr(scene, 'p28-g9-etched-datum-enamel', 0x718f9b, 0.48, 0.68, 0x37637b, 0.055);
    const indexed = pbr(scene, 'p28-g9-indexed-violet-enamel', 0x82739c, 0.42, 0.48, 0x7760ba, 0.12);
    // A machined warm-metal standard separates instrument calibration from
    // violet danger cues and cyan status without replacing textured housings.
    const graduation = pbr(scene, 'p28-g9-machined-brass-datum', 0xb39566, 0.76, 0.38);
    const objectiveGold = pbr(scene, 'p28-g9-physical-datum-objective-beacon', 0xd5ab63, 0.38, 0.38, 0xffcd73, 0.82);
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
    etched.albedoTexture = this.datumAlbedoTexture;
    etched.bumpTexture = this.datumNormalTexture;
    indexed.bumpTexture = this.datumNormalTexture;
    graduation.bumpTexture = this.datumNormalTexture;
    // Recessed navigational inlays never compete with vector-wash or boss telegraphs.
    const routePrimary = pbr(scene, 'p27-c10-route-primary', 0x29233b, 0.16, 0.90, 0x655485, 0.026);
    const routeSecondary = pbr(scene, 'p27-c10-route-secondary', 0x192c32, 0.14, 0.94, 0x36626a, 0.014);
    this.ownedMaterials = [violet, cyan, etched, indexed, graduation, objectiveGold, routePrimary, routeSecondary];
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
          graduation, 0, 0.055, side * 0.36, length - 0.34, 0.08, 0.095);
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
      box(scene, root, 'p27-c10-pylon-foot-' + index, graphite, 0, 0.24, 0, 1.40, 0.48, 1.40);
      box(scene, root, 'p27-c10-pylon-spine-' + index, shell, 0, 2.15, 0, 0.90, 4.30, 0.90);
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
          mark % 2 === 0 ? graduation : indexed, 0, 1.16 + mark * 0.41, 1.19,
          mark % 2 === 0 ? 1.35 : 0.80, 0.17, 0.12);
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
      const core = MeshBuilder.CreateSphere('p27-c10-pylon-core-' + index, { diameter: 0.58, segments: 12 }, scene);
      core.parent = root;
      core.position.y = 5.26;
      core.material = cyan;
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
      this.pylonRigs.push({ id, root, rings, core });
    });

    ([[760, 340], [1080, 690], [1370, 390]] as const).forEach(([x, z], index) => {
      const root = new TransformNode('p27-c10-reference-frame-' + index, scene);
      root.parent = this.root;
      root.position.set(scaled(x), 0, scaled(z));
      if (index === 1) root.rotation.y = Math.PI / 2;
      // Open optical survey gantry: a visible engraved datum arch, beam
      // insulators and suspended reticle distinguish this from a dark cuboid.
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
      box(scene, root, 'p27-c10-carriage-mass-' + index, shell, 0, 0.92, 0, 1.34, 0.76, 0.72);
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
          { diameter: 0.92, thickness: 0.14, tessellation: 24 }, scene);
        wheel.parent = root;
        wheel.position.set(side * 0.62, 0.94, 0.52);
        wheel.rotation.x = Math.PI / 2;
        wheel.material = indexed;
        wheel.isPickable = false;
        const gauge = MeshBuilder.CreateCylinder('p28-g9-carriage-mass-gauge-' + index + '-' + side,
          { diameter: 0.40, height: 0.12, tessellation: 20 }, scene);
        gauge.parent = root;
        gauge.position.set(side * 0.62, 0.94, 0.59);
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
        shell, 0, 1.71, 0, 1.82, 0.52, 1.16);
      box(scene, root, 'p28-g9-counterweight-travel-indicator-' + index,
        graduation, 0, 2.02, 0.72, 1.56, 0.18, 0.20);
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
      box(scene, root, 'p27-c10-anchor-base-' + index, graphite, 0, 0.24, 0, 0.78, 0.48, 0.78);
      const fin = box(scene, root, 'p27-c10-anchor-fin-' + index, shell, 0, 0.98, 0, 0.18, 1.52, 0.88);
      fin.rotation.z = index % 2 ? 0.10 : -0.10;
      const marker = MeshBuilder.CreateTorus('p27-c10-anchor-ring-' + index, { diameter: 0.72, thickness: 0.07, tessellation: 20 }, scene);
      marker.parent = root;
      marker.position.y = 1.58;
      marker.rotation.x = Math.PI / 2;
      marker.material = indexed;
      marker.isPickable = false;
      box(scene, root, 'p28-g9-anchor-insulator-' + index,
        insulation, 0, 0.60, 0.34, 0.52, 0.30, 0.24);
      box(scene, root, 'p28-g9-anchor-calibration-face-' + index,
        etched, 0, 1.20, 0.48, 0.18, 0.54, 0.12);
      for (const side of [-1, 1]) {
        const strut = box(scene, root, 'p28-g9-shear-anchor-fork-' + index + '-' + side,
          indexed, side * 0.36, 1.13, 0.18, 0.16, 1.40, 0.20);
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
        box(scene, root, 'p28-g9-shear-anchor-insulated-upright-' + index + '-' + side,
          insulation, side * 0.56, 1.30, 0.52, 0.34, 2.16, 0.32);
        box(scene, root, 'p28-g9-shear-anchor-ceramic-collar-' + index + '-' + side,
          indexed, side * 0.56, 2.18, 0.55, 0.48, 0.25, 0.44);
      }
      box(scene, root, 'p28-g9-shear-anchor-violet-crosshead-' + index,
        indexed, 0, 2.44, 0.52, 1.64, 0.25, 0.34);
      this.anchors.push(root);
    });

    pylonFallback.forEach(([id, x, z], index) => {
      const root = new TransformNode('p27-c10-reference-console-' + index, scene);
      root.parent = this.root;
      root.position.set(scaled(x + (index === 1 ? -92 : 78)), 0, scaled(z + (index === 2 ? -60 : 50)));
      box(scene, root, 'p27-c10-console-body-' + index, graphite, 0, 0.42, 0, 0.82, 0.84, 0.62);
      const screen = box(scene, root, 'p27-c10-console-screen-' + index, cyan, 0, 0.82, -0.30, 0.74, 0.40, 0.06);
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
      const beacon = MeshBuilder.CreateCylinder('p27-c10-landmark-' + landmark.id, { height: 3.40, diameterTop: 0.12, diameterBottom: 0.58, tessellation: 8 }, scene);
      beacon.parent = this.root;
      beacon.position.set(scaled(landmark.x), 1.70, scaled(landmark.y));
      beacon.material = index === 1 ? etched : cyan;
      beacon.isPickable = false;
      const marker = MeshBuilder.CreateTorus('p27-c10-landmark-ring-' + index, { diameter: 1.18, thickness: 0.13, tessellation: 24 }, scene);
      marker.parent = this.root;
      marker.position.set(scaled(landmark.x), 3.18, scaled(landmark.y));
      marker.rotation.x = Math.PI / 2;
      marker.material = etched;
      marker.isPickable = false;
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
    this.hemisphere.diffuse = colorFromHex(0xe7e1f2);
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
    // Retain the real vector-wash extent, but let machined geometry show through.
    this.shearMaterial.alpha = (vectorWashes.length > 0 ? 0.17 : 0.06) * renderBudget.transparencyScale;
    this.shearMaterial.emissiveColor = colorFromHex(0xb195dc).scale(0.64 + Math.sin(state.time * 6.6) * 0.10);

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
      + '+pylon-fiducial:27+frame-scale:30+carriage-stud:18+console-knob:9+anchor-insulator:8+physical-baseline:3+datum-graduation:39+isolator-foot:12+objective-crown:9+side-objective-beacon:9+conductor-bar:6+pylon-large-mark:18+counterweight:3+ceramic-upright:16';
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
    this.ownedMaterials.forEach(item => item.dispose());
    this.premiumSurfaces.dispose();
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
