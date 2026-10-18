import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import '@babylonjs/core/Meshes/instancedMesh';
import type { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import type { RenderBudgetSnapshot } from './renderQuality';
import { getWorldSize } from './sim';

export const BABYLON_AMBIENT_WORLD_SCALE = 0.02;
const AMBIENT_RESOURCE_PREFIX = 'p28-e1-';
const REFINERY_ART_DIRECTION_ID = 'refinery-industrial-v1';
// A single locally packaged and mipmapped KTX2 atlas for decorative particles.
export const REFINERY_LOCAL_FX_ATLAS_URL = '/assets/effects/refinery-local-effects-f5.ktx2';

export type BabylonAmbientParticleKind = 'dust' | 'sparks' | 'vapor' | 'debris';
export type BabylonAmbientParticleContext = 'machinery' | 'vents' | 'damaged-service' | 'open-industrial';

export type BabylonAmbientParticleZone = Readonly<{
  id: string;
  context: BabylonAmbientParticleContext;
  x: number;
  z: number;
  radiusX: number;
  radiusZ: number;
  yMin: number;
  yMax: number;
}>;

export const BABYLON_REFINERY_AMBIENT_CUE_CLEARANCE = Object.freeze({
  xMin: 0.38,
  xMax: 0.62,
  zMin: 0.38,
  zMax: 0.62,
});

export const BABYLON_REFINERY_AMBIENT_ZONES = Object.freeze({
  dust: Object.freeze([
    { id: 'open-bay-north-west', context: 'open-industrial', x: 0.22, z: 0.31, radiusX: 0.12, radiusZ: 0.11, yMin: 0.28, yMax: 1.55 },
    { id: 'open-bay-north-east', context: 'open-industrial', x: 0.78, z: 0.31, radiusX: 0.12, radiusZ: 0.11, yMin: 0.28, yMax: 1.55 },
    { id: 'open-bay-south-west', context: 'open-industrial', x: 0.22, z: 0.72, radiusX: 0.12, radiusZ: 0.10, yMin: 0.22, yMax: 1.42 },
    { id: 'open-bay-south-east', context: 'open-industrial', x: 0.78, z: 0.72, radiusX: 0.12, radiusZ: 0.10, yMin: 0.22, yMax: 1.42 },
  ] satisfies readonly BabylonAmbientParticleZone[]),
  sparks: Object.freeze([
    { id: 'processor-west', context: 'machinery', x: 0.29, z: 0.67, radiusX: 0.045, radiusZ: 0.052, yMin: 0.12, yMax: 1.24 },
    { id: 'processor-north', context: 'machinery', x: 0.50, z: 0.26, radiusX: 0.050, radiusZ: 0.040, yMin: 0.12, yMax: 1.30 },
    { id: 'processor-east', context: 'machinery', x: 0.71, z: 0.67, radiusX: 0.045, radiusZ: 0.052, yMin: 0.12, yMax: 1.24 },
    { id: 'smelter-gantry', context: 'machinery', x: 0.50, z: 0.09, radiusX: 0.090, radiusZ: 0.035, yMin: 0.48, yMax: 1.78 },
    { id: 'damaged-service-west', context: 'damaged-service', x: 0.10, z: 0.53, radiusX: 0.040, radiusZ: 0.105, yMin: 0.10, yMax: 0.96 },
    { id: 'damaged-service-east', context: 'damaged-service', x: 0.90, z: 0.74, radiusX: 0.040, radiusZ: 0.085, yMin: 0.10, yMax: 0.96 },
  ] satisfies readonly BabylonAmbientParticleZone[]),
  vapor: Object.freeze([
    { id: 'pipe-vent-west', context: 'vents', x: 0.26, z: 0.14, radiusX: 0.070, radiusZ: 0.035, yMin: 0.10, yMax: 1.68 },
    { id: 'pipe-vent-center', context: 'vents', x: 0.50, z: 0.14, radiusX: 0.070, radiusZ: 0.035, yMin: 0.10, yMax: 1.68 },
    { id: 'pipe-vent-east', context: 'vents', x: 0.74, z: 0.14, radiusX: 0.070, radiusZ: 0.035, yMin: 0.10, yMax: 1.68 },
    { id: 'service-vent-west-north', context: 'vents', x: 0.08, z: 0.24, radiusX: 0.025, radiusZ: 0.060, yMin: 0.08, yMax: 1.42 },
    { id: 'service-vent-west-south', context: 'vents', x: 0.08, z: 0.76, radiusX: 0.025, radiusZ: 0.060, yMin: 0.08, yMax: 1.42 },
    { id: 'service-vent-east-north', context: 'vents', x: 0.92, z: 0.24, radiusX: 0.025, radiusZ: 0.060, yMin: 0.08, yMax: 1.42 },
    { id: 'service-vent-east-south', context: 'vents', x: 0.92, z: 0.76, radiusX: 0.025, radiusZ: 0.060, yMin: 0.08, yMax: 1.42 },
  ] satisfies readonly BabylonAmbientParticleZone[]),
  debris: Object.freeze([
    { id: 'service-debris-west', context: 'damaged-service', x: 0.12, z: 0.54, radiusX: 0.070, radiusZ: 0.130, yMin: 0.10, yMax: 0.72 },
    { id: 'service-debris-east', context: 'damaged-service', x: 0.88, z: 0.72, radiusX: 0.070, radiusZ: 0.105, yMin: 0.10, yMax: 0.72 },
    { id: 'open-debris-north-west', context: 'open-industrial', x: 0.23, z: 0.27, radiusX: 0.105, radiusZ: 0.080, yMin: 0.12, yMax: 0.78 },
    { id: 'open-debris-south-east', context: 'open-industrial', x: 0.77, z: 0.75, radiusX: 0.105, radiusZ: 0.080, yMin: 0.12, yMax: 0.78 },
  ] satisfies readonly BabylonAmbientParticleZone[]),
} satisfies Readonly<Record<BabylonAmbientParticleKind, readonly BabylonAmbientParticleZone[]>>);

export const BABYLON_AMBIENT_FLAGSHIP_COUNTS = Object.freeze({
  dust: 128,
  sparks: 48,
  vapor: 24,
  debris: 40,
} satisfies Record<BabylonAmbientParticleKind, number>);

const RUNTIME_PRESSURE_SCALE: Record<RenderBudgetSnapshot['runtimeTierName'], number> = {
  high: 1,
  balanced: 0.72,
  performance: 0.42,
};

export type BabylonAmbientParticleBudget = {
  scale: number;
  counts: Record<BabylonAmbientParticleKind, number>;
  pooled: Record<BabylonAmbientParticleKind, number>;
};

type AmbientPool = {
  source: Mesh;
  particles: InstancedMesh[];
  material: StandardMaterial;
};

function colorFromHex(hex: number) {
  return Color3.FromInts((hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff);
}

function unitNoise(index: number, salt: number) {
  let value = Math.imul(index + 1, 0x45d9f3b) ^ Math.imul(salt + 17, 0x27d4eb2d);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value ^= value >>> 16;
  return (value >>> 0) / 0x1_0000_0000;
}

function wrap01(value: number) {
  return value - Math.floor(value);
}

function refineryZone(kind: BabylonAmbientParticleKind, index: number) {
  const zones = BABYLON_REFINERY_AMBIENT_ZONES[kind];
  return zones[index % zones.length];
}

function refineryAxis(center: number, radius: number, index: number, salt: number, time: number, rate: number) {
  return center + (wrap01(unitNoise(index, salt) + time * rate) * 2 - 1) * radius;
}

function refineryHeight(zone: BabylonAmbientParticleZone, cycle: number) {
  return zone.yMin + (zone.yMax - zone.yMin) * cycle;
}

function refineryArtDirectionTelemetry() {
  const contexts = new Set<BabylonAmbientParticleContext>();
  const zoneCount = (Object.keys(BABYLON_REFINERY_AMBIENT_ZONES) as BabylonAmbientParticleKind[])
    .reduce((count, kind) => {
      for (const zone of BABYLON_REFINERY_AMBIENT_ZONES[kind]) contexts.add(zone.context);
      return count + BABYLON_REFINERY_AMBIENT_ZONES[kind].length;
    }, 0);
  return {
    id: REFINERY_ART_DIRECTION_ID,
    zoneCount,
    contexts: [...contexts].sort().join('+'),
  };
}

export function babylonAmbientParticleBudget(budget: RenderBudgetSnapshot): BabylonAmbientParticleBudget {
  const scale = RUNTIME_PRESSURE_SCALE[budget.runtimeTierName];
  const counts = Object.fromEntries(
    (Object.keys(BABYLON_AMBIENT_FLAGSHIP_COUNTS) as BabylonAmbientParticleKind[])
      .map(kind => [kind, Math.max(1, Math.round(BABYLON_AMBIENT_FLAGSHIP_COUNTS[kind] * scale))]),
  ) as Record<BabylonAmbientParticleKind, number>;
  return { scale, counts, pooled: { ...BABYLON_AMBIENT_FLAGSHIP_COUNTS } };
}

export class BabylonAmbientParticles {
  private readonly pools = new Map<BabylonAmbientParticleKind, AmbientPool>();
  private locationKey = '';
  private elapsedSeconds = 0;
  private disposed = false;

  constructor(
    private readonly scene: Scene,
    private readonly canvas: HTMLCanvasElement,
  ) {
    canvas.dataset.babylonAmbientParticles = 'ready';
    canvas.dataset.babylonAmbientParticleState = 'idle';
    canvas.dataset.babylonAmbientParticleSimulationOwnership = 'read-only-presentation';
    canvas.dataset.babylonAmbientGameplayCuePolicy = 'independent:1.00';
    canvas.dataset.babylonAmbientParticleCounts = 'dust:0/128|sparks:0/48|vapor:0/24|debris:0/40';
    canvas.dataset.babylonAmbientParticleArtDirection = 'unassigned';
    canvas.dataset.babylonAmbientParticleCueClearance = 'unassigned';
  }

  sync(budget: RenderBudgetSnapshot, locationKey: string) {
    if (this.disposed) return;
    if (this.locationKey && this.locationKey !== locationKey) this.release('location-switch');
    this.locationKey = locationKey;
    this.ensurePools();

    const deltaMs = this.scene.getEngine().getDeltaTime();
    this.elapsedSeconds += (Number.isFinite(deltaMs) && deltaMs > 0 ? Math.min(deltaMs, 50) : 1000 / 60) / 1000;
    const particleBudget = babylonAmbientParticleBudget(budget);
    const world = getWorldSize();
    const worldW = world.w * BABYLON_AMBIENT_WORLD_SCALE;
    const worldH = world.h * BABYLON_AMBIENT_WORLD_SCALE;

    this.syncDust(this.pools.get('dust')!, particleBudget.counts.dust, worldW, worldH);
    this.syncSparks(this.pools.get('sparks')!, particleBudget.counts.sparks, worldW, worldH);
    this.syncVapor(this.pools.get('vapor')!, particleBudget.counts.vapor, worldW, worldH);
    this.syncDebris(this.pools.get('debris')!, particleBudget.counts.debris, worldW, worldH);

    canvasTelemetry(this.canvas, particleBudget, this.pools.size, locationKey, budget);
  }

  release(reason: string) {
    if (this.disposed && this.pools.size === 0) return;
    for (const pool of this.pools.values()) {
      pool.particles.forEach(particle => this.disposeMesh(particle));
      this.disposeMesh(pool.source);
      pool.material.diffuseTexture?.dispose();
      pool.material.dispose();
    }
    this.pools.clear();
    this.releaseOwnedSceneRegistrations();
    this.locationKey = '';
    this.elapsedSeconds = 0;
    this.canvas.dataset.babylonAmbientParticleState = 'released';
    this.canvas.dataset.babylonAmbientParticleCounts = 'dust:0/0|sparks:0/0|vapor:0/0|debris:0/0';
    this.canvas.dataset.babylonAmbientParticlePoolSize = '0';
    this.canvas.dataset.babylonAmbientParticleDrawFamilies = '0';
    this.canvas.dataset.babylonAmbientParticleRelease = reason;
    this.canvas.dataset.babylonAmbientParticleArtDirection = 'released';
    this.canvas.dataset.babylonAmbientParticleCueClearance = 'released';
  }

  dispose() {
    if (this.disposed) return;
    this.release('renderer-dispose');
    this.disposed = true;
    this.canvas.dataset.babylonAmbientParticles = 'disposed';
    this.canvas.dataset.babylonAmbientParticleState = 'disposed';
  }

  private disposeMesh(mesh: AbstractMesh) {
    mesh.dispose();
    if (this.scene.meshes.includes(mesh)) this.scene.removeMesh(mesh);
  }

  private releaseOwnedSceneRegistrations() {
    for (const mesh of [...this.scene.meshes]) {
      if (mesh.name.startsWith(AMBIENT_RESOURCE_PREFIX)) this.disposeMesh(mesh);
    }
    for (const material of [...this.scene.materials]) {
      if (!material.name.startsWith(AMBIENT_RESOURCE_PREFIX)) continue;
      material.dispose();
      if (this.scene.materials.includes(material)) this.scene.removeMaterial(material);
    }
  }

  private ensurePools() {
    if (this.pools.size > 0) return;
    (Object.keys(BABYLON_AMBIENT_FLAGSHIP_COUNTS) as BabylonAmbientParticleKind[]).forEach(kind => {
      this.pools.set(kind, this.createPool(kind, BABYLON_AMBIENT_FLAGSHIP_COUNTS[kind]));
    });
  }

  private createPool(kind: BabylonAmbientParticleKind, count: number): AmbientPool {
    const material = new StandardMaterial(`${AMBIENT_RESOURCE_PREFIX}${kind}-material`, this.scene);
    material.specularColor = Color3.Black();
    material.disableLighting = true;
    material.backFaceCulling = false;
    const atlas = new Texture(REFINERY_LOCAL_FX_ATLAS_URL, this.scene);
    const cell = { dust: [0, 0], sparks: [1, 0], vapor: [0, 1], debris: [1, 1] }[kind];
    atlas.uScale = 0.5;
    atlas.vScale = 0.5;
    atlas.uOffset = cell[0] * 0.5;
    atlas.vOffset = cell[1] * 0.5;
    atlas.wrapU = Texture.CLAMP_ADDRESSMODE;
    atlas.wrapV = Texture.CLAMP_ADDRESSMODE;
    atlas.hasAlpha = true;
    material.diffuseTexture = atlas;
    material.useAlphaFromDiffuseTexture = true;

    let source: Mesh;
    if (kind === 'dust') {
      source = MeshBuilder.CreateSphere(`${AMBIENT_RESOURCE_PREFIX}dust-source`, { diameter: 0.026, segments: 3 }, this.scene);
      material.diffuseColor = colorFromHex(0xb7b09d).scale(0.34);
      material.emissiveColor = colorFromHex(0xb7b09d).scale(0.08);
      material.alpha = 0.14;
    } else if (kind === 'sparks') {
      source = MeshBuilder.CreateBox(`${AMBIENT_RESOURCE_PREFIX}sparks-source`, { width: 0.018, height: 0.018, depth: 0.12 }, this.scene);
      material.diffuseColor = colorFromHex(0xffb866).scale(0.32);
      material.emissiveColor = colorFromHex(0xff9b4a).scale(0.78);
      material.alpha = 0.72;
    } else if (kind === 'vapor') {
      source = MeshBuilder.CreatePlane(`${AMBIENT_RESOURCE_PREFIX}vapor-source`, { width: 0.56, height: 0.36 }, this.scene);
      material.diffuseColor = colorFromHex(0xb8c6c7).scale(0.16);
      material.emissiveColor = colorFromHex(0x91a9aa).scale(0.035);
      material.alpha = 0.075;
    } else {
      source = MeshBuilder.CreateBox(`${AMBIENT_RESOURCE_PREFIX}debris-source`, { width: 0.065, height: 0.025, depth: 0.035 }, this.scene);
      material.diffuseColor = colorFromHex(0x5d554b).scale(0.28);
      material.emissiveColor = colorFromHex(0x2d2925).scale(0.04);
      material.alpha = 0.82;
    }
    source.material = material;
    source.isPickable = false;
    source.position.set(0, -1000, 0);

    const particles: InstancedMesh[] = [];
    for (let index = 0; index < count; index += 1) {
      const particle = source.createInstance(`${AMBIENT_RESOURCE_PREFIX}${kind}-${index}`);
      particle.isPickable = false;
      particle.setEnabled(false);
      if (kind === 'vapor') particle.billboardMode = Mesh.BILLBOARDMODE_ALL;
      particles.push(particle);
    }
    return { source, particles, material };
  }

  private syncDust(pool: AmbientPool, activeCount: number, worldW: number, worldH: number) {
    const time = this.elapsedSeconds;
    const refinery = this.locationKey === 'asteroid-refinery';
    pool.particles.forEach((particle, index) => {
      particle.setEnabled(index < activeCount);
      if (index >= activeCount) return;
      if (refinery) {
        const zone = refineryZone('dust', index);
        const cycle = wrap01(unitNoise(index, 3) + time * (0.012 + unitNoise(index, 4) * 0.008));
        particle.position.set(
          refineryAxis(zone.x, zone.radiusX, index, 1, time, 0.004 + unitNoise(index, 4) * 0.004) * worldW,
          refineryHeight(zone, cycle) + Math.sin(time * 0.38 + index) * 0.04,
          refineryAxis(zone.z, zone.radiusZ, index, 2, time, 0.0025 + unitNoise(index, 7) * 0.003) * worldH,
        );
      } else {
        const y0 = unitNoise(index, 3);
        particle.position.set(
          wrap01(unitNoise(index, 1) + time * (0.004 + unitNoise(index, 4) * 0.006)) * worldW,
          0.18 + y0 * 1.35 + Math.sin(time * (0.35 + y0 * 0.25) + index) * 0.055,
          wrap01(unitNoise(index, 2) + Math.sin(time * 0.12 + index * 0.71) * 0.018) * worldH,
        );
      }
      const scale = 0.62 + unitNoise(index, 5) * 1.3;
      particle.scaling.setAll(scale);
      particle.rotation.y = time * (0.12 + unitNoise(index, 6) * 0.18) + index;
    });
  }

  private syncSparks(pool: AmbientPool, activeCount: number, worldW: number, worldH: number) {
    const time = this.elapsedSeconds;
    const refinery = this.locationKey === 'asteroid-refinery';
    pool.particles.forEach((particle, index) => {
      particle.setEnabled(index < activeCount);
      if (index >= activeCount) return;
      const cycle = wrap01(unitNoise(index, 14) + time * (0.16 + unitNoise(index, 13) * 0.18));
      if (refinery) {
        const zone = refineryZone('sparks', index);
        particle.position.set(
          refineryAxis(zone.x, zone.radiusX, index, 11, time, 0.018 + unitNoise(index, 16) * 0.012) * worldW,
          refineryHeight(zone, cycle),
          refineryAxis(zone.z, zone.radiusZ, index, 12, time, 0.014 + unitNoise(index, 17) * 0.010) * worldH,
        );
      } else {
        particle.position.set(
          wrap01(unitNoise(index, 11) + Math.sin(time * 0.65 + index) * 0.012) * worldW,
          0.08 + cycle * 1.15,
          wrap01(unitNoise(index, 12) + Math.cos(time * 0.52 + index * 0.43) * 0.012) * worldH,
        );
      }
      particle.scaling.set(0.75, 0.75, 0.72 + unitNoise(index, 15) * 1.45);
      particle.rotation.set(Math.PI * 0.5, time * (1.2 + unitNoise(index, 16) * 2.4), index * 0.37);
    });
  }

  private syncVapor(pool: AmbientPool, activeCount: number, worldW: number, worldH: number) {
    const time = this.elapsedSeconds;
    const refinery = this.locationKey === 'asteroid-refinery';
    pool.particles.forEach((particle, index) => {
      particle.setEnabled(index < activeCount);
      if (index >= activeCount) return;
      const cycle = wrap01(unitNoise(index, 23) + time * (0.025 + unitNoise(index, 24) * 0.022));
      if (refinery) {
        const zone = refineryZone('vapor', index);
        particle.position.set(
          refineryAxis(zone.x, zone.radiusX, index, 21, time, 0.006 + unitNoise(index, 26) * 0.004) * worldW,
          refineryHeight(zone, cycle),
          refineryAxis(zone.z, zone.radiusZ, index, 22, time, 0.004 + unitNoise(index, 27) * 0.003) * worldH,
        );
      } else {
        const edge = unitNoise(index, 21) < 0.5 ? 0.06 + unitNoise(index, 22) * 0.18 : 0.76 + unitNoise(index, 22) * 0.18;
        particle.position.set(
          edge * worldW + Math.sin(time * 0.18 + index) * 0.12,
          0.12 + cycle * 1.55,
          unitNoise(index, 25) * worldH + Math.cos(time * 0.13 + index) * 0.18,
        );
      }
      const scale = (0.68 + unitNoise(index, 26) * 0.9) * (0.78 + cycle * 0.55);
      particle.scaling.set(scale * 1.18, scale, scale);
      particle.rotation.z = time * 0.08 + index * 0.61;
    });
  }

  private syncDebris(pool: AmbientPool, activeCount: number, worldW: number, worldH: number) {
    const time = this.elapsedSeconds;
    const refinery = this.locationKey === 'asteroid-refinery';
    pool.particles.forEach((particle, index) => {
      particle.setEnabled(index < activeCount);
      if (index >= activeCount) return;
      const drift = 0.002 + unitNoise(index, 31) * 0.004;
      if (refinery) {
        const zone = refineryZone('debris', index);
        const cycle = wrap01(unitNoise(index, 33) + time * drift * 0.9);
        particle.position.set(
          refineryAxis(zone.x, zone.radiusX, index, 32, time, drift) * worldW,
          refineryHeight(zone, cycle),
          refineryAxis(zone.z, zone.radiusZ, index, 34, time, -drift * 0.55) * worldH,
        );
      } else {
        particle.position.set(
          wrap01(unitNoise(index, 32) + time * drift) * worldW,
          0.12 + unitNoise(index, 33) * 0.72,
          wrap01(unitNoise(index, 34) - time * drift * 0.55) * worldH,
        );
      }
      const scale = 0.48 + unitNoise(index, 35) * 1.18;
      particle.scaling.set(scale, scale * (0.5 + unitNoise(index, 36) * 0.55), scale);
      particle.rotation.set(
        time * (0.18 + unitNoise(index, 37) * 0.35) + index,
        time * (0.15 + unitNoise(index, 38) * 0.28) + index * 0.33,
        time * 0.11 + index * 0.17,
      );
    });
  }
}

function canvasTelemetry(
  canvas: HTMLCanvasElement,
  particleBudget: BabylonAmbientParticleBudget,
  drawFamilies: number,
  locationKey: string,
  budget: RenderBudgetSnapshot,
) {
  canvas.dataset.babylonAmbientParticles = 'pooled:dust+sparks+vapor+debris';
  canvas.dataset.babylonAmbientParticleState = 'active';
  canvas.dataset.babylonAmbientParticleLocation = locationKey;
  canvas.dataset.babylonAmbientParticleRuntimeTier = budget.runtimeTierName;
  canvas.dataset.babylonAmbientParticleHostTier = budget.tierName;
  canvas.dataset.babylonAmbientParticleScale = particleBudget.scale.toFixed(2);
  canvas.dataset.babylonAmbientParticleCounts = (Object.keys(particleBudget.counts) as BabylonAmbientParticleKind[])
    .map(kind => `${kind}:${particleBudget.counts[kind]}/${particleBudget.pooled[kind]}`)
    .join('|');
  canvas.dataset.babylonAmbientParticlePoolSize = String(
    Object.values(BABYLON_AMBIENT_FLAGSHIP_COUNTS).reduce((sum, count) => sum + count, 0),
  );
  canvas.dataset.babylonAmbientParticleDrawFamilies = String(drawFamilies);
  canvas.dataset.babylonAmbientGameplayCuePolicy = `independent:${budget.gameplayCueScale.toFixed(2)}`;
  if (locationKey === 'asteroid-refinery') {
    const artDirection = refineryArtDirectionTelemetry();
    canvas.dataset.babylonAmbientParticleArtDirection = artDirection.id;
    canvas.dataset.babylonAmbientParticleZones = `${artDirection.zoneCount}:${artDirection.contexts}`;
    canvas.dataset.babylonAmbientParticleCueClearance = 'center:x38-62+z38-62+presentation-only';
  } else {
    canvas.dataset.babylonAmbientParticleArtDirection = 'shared-world-default';
    canvas.dataset.babylonAmbientParticleZones = 'world-distributed';
    canvas.dataset.babylonAmbientParticleCueClearance = 'gameplay-cues-independent';
  }
}
