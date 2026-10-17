import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import type { RenderBudgetSnapshot } from './renderQuality';
import { getWorldSize } from './sim';

const WORLD_SCALE = 0.02;

export type BabylonAmbientParticleKind = 'dust' | 'sparks' | 'vapor' | 'debris';

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
    const worldW = world.w * WORLD_SCALE;
    const worldH = world.h * WORLD_SCALE;

    this.syncDust(this.pools.get('dust')!, particleBudget.counts.dust, worldW, worldH);
    this.syncSparks(this.pools.get('sparks')!, particleBudget.counts.sparks, worldW, worldH);
    this.syncVapor(this.pools.get('vapor')!, particleBudget.counts.vapor, worldW, worldH);
    this.syncDebris(this.pools.get('debris')!, particleBudget.counts.debris, worldW, worldH);

    canvasTelemetry(this.canvas, particleBudget, this.pools.size, locationKey, budget);
  }

  release(reason: string) {
    if (this.disposed && this.pools.size === 0) return;
    for (const pool of this.pools.values()) {
      pool.particles.forEach(particle => particle.dispose());
      pool.source.dispose();
      pool.material.dispose();
    }
    this.pools.clear();
    this.locationKey = '';
    this.elapsedSeconds = 0;
    this.canvas.dataset.babylonAmbientParticleState = 'released';
    this.canvas.dataset.babylonAmbientParticleCounts = 'dust:0/0|sparks:0/0|vapor:0/0|debris:0/0';
    this.canvas.dataset.babylonAmbientParticlePoolSize = '0';
    this.canvas.dataset.babylonAmbientParticleDrawFamilies = '0';
    this.canvas.dataset.babylonAmbientParticleRelease = reason;
  }

  dispose() {
    if (this.disposed) return;
    this.release('renderer-dispose');
    this.disposed = true;
    this.canvas.dataset.babylonAmbientParticles = 'disposed';
    this.canvas.dataset.babylonAmbientParticleState = 'disposed';
  }

  private ensurePools() {
    if (this.pools.size > 0) return;
    (Object.keys(BABYLON_AMBIENT_FLAGSHIP_COUNTS) as BabylonAmbientParticleKind[]).forEach(kind => {
      this.pools.set(kind, this.createPool(kind, BABYLON_AMBIENT_FLAGSHIP_COUNTS[kind]));
    });
  }

  private createPool(kind: BabylonAmbientParticleKind, count: number): AmbientPool {
    const material = new StandardMaterial(`p28-e1-${kind}-material`, this.scene);
    material.specularColor = Color3.Black();
    material.disableLighting = true;
    material.backFaceCulling = false;

    let source: Mesh;
    if (kind === 'dust') {
      source = MeshBuilder.CreateSphere('p28-e1-dust-source', { diameter: 0.026, segments: 3 }, this.scene);
      material.diffuseColor = colorFromHex(0xb7b09d).scale(0.34);
      material.emissiveColor = colorFromHex(0xb7b09d).scale(0.08);
      material.alpha = 0.14;
    } else if (kind === 'sparks') {
      source = MeshBuilder.CreateBox('p28-e1-sparks-source', { width: 0.018, height: 0.018, depth: 0.12 }, this.scene);
      material.diffuseColor = colorFromHex(0xffb866).scale(0.32);
      material.emissiveColor = colorFromHex(0xff9b4a).scale(0.78);
      material.alpha = 0.72;
    } else if (kind === 'vapor') {
      source = MeshBuilder.CreatePlane('p28-e1-vapor-source', { width: 0.56, height: 0.36 }, this.scene);
      material.diffuseColor = colorFromHex(0xb8c6c7).scale(0.16);
      material.emissiveColor = colorFromHex(0x91a9aa).scale(0.035);
      material.alpha = 0.075;
    } else {
      source = MeshBuilder.CreateBox('p28-e1-debris-source', { width: 0.065, height: 0.025, depth: 0.035 }, this.scene);
      material.diffuseColor = colorFromHex(0x5d554b).scale(0.28);
      material.emissiveColor = colorFromHex(0x2d2925).scale(0.04);
      material.alpha = 0.82;
    }
    source.material = material;
    source.isPickable = false;
    source.position.set(0, -1000, 0);

    const particles: InstancedMesh[] = [];
    for (let index = 0; index < count; index += 1) {
      const particle = source.createInstance(`p28-e1-${kind}-${index}`);
      particle.isPickable = false;
      particle.setEnabled(false);
      if (kind === 'vapor') particle.billboardMode = Mesh.BILLBOARDMODE_ALL;
      particles.push(particle);
    }
    return { source, particles, material };
  }

  private syncDust(pool: AmbientPool, activeCount: number, worldW: number, worldH: number) {
    const time = this.elapsedSeconds;
    pool.particles.forEach((particle, index) => {
      particle.setEnabled(index < activeCount);
      if (index >= activeCount) return;
      const y0 = unitNoise(index, 3);
      particle.position.set(
        wrap01(unitNoise(index, 1) + time * (0.004 + unitNoise(index, 4) * 0.006)) * worldW,
        0.18 + y0 * 1.35 + Math.sin(time * (0.35 + y0 * 0.25) + index) * 0.055,
        wrap01(unitNoise(index, 2) + Math.sin(time * 0.12 + index * 0.71) * 0.018) * worldH,
      );
      const scale = 0.62 + unitNoise(index, 5) * 1.3;
      particle.scaling.setAll(scale);
      particle.rotation.y = time * (0.12 + unitNoise(index, 6) * 0.18) + index;
    });
  }

  private syncSparks(pool: AmbientPool, activeCount: number, worldW: number, worldH: number) {
    const time = this.elapsedSeconds;
    pool.particles.forEach((particle, index) => {
      particle.setEnabled(index < activeCount);
      if (index >= activeCount) return;
      const cycle = wrap01(unitNoise(index, 14) + time * (0.16 + unitNoise(index, 13) * 0.18));
      particle.position.set(
        wrap01(unitNoise(index, 11) + Math.sin(time * 0.65 + index) * 0.012) * worldW,
        0.08 + cycle * 1.15,
        wrap01(unitNoise(index, 12) + Math.cos(time * 0.52 + index * 0.43) * 0.012) * worldH,
      );
      particle.scaling.set(0.75, 0.75, 0.72 + unitNoise(index, 15) * 1.45);
      particle.rotation.set(Math.PI * 0.5, time * (1.2 + unitNoise(index, 16) * 2.4), index * 0.37);
    });
  }

  private syncVapor(pool: AmbientPool, activeCount: number, worldW: number, worldH: number) {
    const time = this.elapsedSeconds;
    pool.particles.forEach((particle, index) => {
      particle.setEnabled(index < activeCount);
      if (index >= activeCount) return;
      const edge = unitNoise(index, 21) < 0.5 ? 0.06 + unitNoise(index, 22) * 0.18 : 0.76 + unitNoise(index, 22) * 0.18;
      const cycle = wrap01(unitNoise(index, 23) + time * (0.025 + unitNoise(index, 24) * 0.022));
      particle.position.set(
        edge * worldW + Math.sin(time * 0.18 + index) * 0.12,
        0.12 + cycle * 1.55,
        unitNoise(index, 25) * worldH + Math.cos(time * 0.13 + index) * 0.18,
      );
      const scale = (0.68 + unitNoise(index, 26) * 0.9) * (0.78 + cycle * 0.55);
      particle.scaling.set(scale * 1.18, scale, scale);
      particle.rotation.z = time * 0.08 + index * 0.61;
    });
  }

  private syncDebris(pool: AmbientPool, activeCount: number, worldW: number, worldH: number) {
    const time = this.elapsedSeconds;
    pool.particles.forEach((particle, index) => {
      particle.setEnabled(index < activeCount);
      if (index >= activeCount) return;
      const drift = 0.002 + unitNoise(index, 31) * 0.004;
      particle.position.set(
        wrap01(unitNoise(index, 32) + time * drift) * worldW,
        0.12 + unitNoise(index, 33) * 0.72,
        wrap01(unitNoise(index, 34) - time * drift * 0.55) * worldH,
      );
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
}
