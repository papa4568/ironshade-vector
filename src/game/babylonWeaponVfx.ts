import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { weaponVariantPresentation } from './classArsenal';
import { weaponHandlingProfiles, type ImpactEvent, type SimState, type WeaponId } from './sim';

const WORLD_SCALE = 0.02;
const PLAYER_PROJECTILE_Y = 0.72;
const ENEMY_PROJECTILE_COLOR = 0xef8a6e;
const WEAPON_COLORS: Record<WeaponId, number> = {
  carbine: 0xd9f3c6,
  breacher: 0xffddb3,
  rail: 0xb9e8ff,
};

export type BabylonWeaponProjectileProfile = {
  mode: 'tracer' | 'scatter-slug' | 'beam-lance' | 'enemy-bolt';
  coreScaleX: number;
  coreScaleY: number;
  coreScaleZ: number;
  trailScaleX: number;
  trailScaleY: number;
  trailScaleZ: number;
  trailAlpha: number;
  emissive: number;
};

export type BabylonWeaponImpactProfile = {
  language: 'armor-spark' | 'hull-spall' | 'field-flash' | 'metal-spark' | 'electrical-flash' | 'industrial-spall' | 'generic-spark';
  color: number;
  scale: number;
  heavyScale: number;
};

type ProjectileVisual = {
  root: TransformNode;
  core: Mesh;
  trail: Mesh;
  coreMaterial: StandardMaterial;
  trailMaterial: StandardMaterial;
};

type ImpactVisual = {
  root: TransformNode;
  ring: Mesh;
  core: Mesh;
  sparks: Mesh[];
  ringMaterial: StandardMaterial;
  coreMaterial: StandardMaterial;
  sparkMaterial: StandardMaterial;
};

function scaled(value: number) {
  return value * WORLD_SCALE;
}

function colorFromHex(hex: number) {
  return Color3.FromInts((hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff);
}

export function babylonWeaponProjectileProfile(weapon: WeaponId | 'enemy'): BabylonWeaponProjectileProfile {
  if (weapon === 'rail') {
    return {
      mode: 'beam-lance',
      coreScaleX: 0.72,
      coreScaleY: 0.72,
      coreScaleZ: 0.72,
      trailScaleX: 3.25,
      trailScaleY: 0.72,
      trailScaleZ: 0.72,
      trailAlpha: 0.88,
      emissive: 2.1,
    };
  }
  if (weapon === 'breacher') {
    return {
      mode: 'scatter-slug',
      coreScaleX: 1.22,
      coreScaleY: 0.92,
      coreScaleZ: 1.22,
      trailScaleX: 0.62,
      trailScaleY: 1.35,
      trailScaleZ: 1.35,
      trailAlpha: 0.4,
      emissive: 1.45,
    };
  }
  if (weapon === 'enemy') {
    return {
      mode: 'enemy-bolt',
      coreScaleX: 0.92,
      coreScaleY: 0.92,
      coreScaleZ: 0.92,
      trailScaleX: 1.15,
      trailScaleY: 0.9,
      trailScaleZ: 0.9,
      trailAlpha: 0.56,
      emissive: 1.5,
    };
  }
  return {
    mode: 'tracer',
    coreScaleX: 0.88,
    coreScaleY: 0.88,
    coreScaleZ: 0.88,
    trailScaleX: 1.5,
    trailScaleY: 0.92,
    trailScaleZ: 0.92,
    trailAlpha: 0.62,
    emissive: 1.65,
  };
}

export function babylonWeaponFireFxName(weapon: WeaponId, variantId: string | null) {
  if (weapon === 'rail') {
    if (variantId === 'rail-charge') return 'charge-lance';
    if (variantId === 'rail-repeater') return 'repeater-lance';
    return 'lance';
  }
  if (weapon === 'breacher') {
    if (variantId === 'breacher-slug') return 'slug-impact';
    if (variantId === 'breacher-rapid') return 'rapid-scatter';
    return 'scatter';
  }
  if (variantId === 'carbine-burst') return 'burst-tracer';
  if (variantId === 'carbine-precision') return 'precision-tracer';
  return 'tracer';
}

export function babylonWeaponImpactProfile(impactEvent: ImpactEvent | null): BabylonWeaponImpactProfile {
  if (!impactEvent) {
    return { language: 'generic-spark', color: 0xc2ddd3, scale: 1, heavyScale: 1 };
  }
  const heavyScale = impactEvent.heavy ? 1.24 : 1;
  if (impactEvent.target === 'enemy') {
    if (impactEvent.surface === 'armor') {
      return { language: 'armor-spark', color: 0x8ee8ff, scale: 1.2, heavyScale };
    }
    if (impactEvent.surface === 'field') {
      return { language: 'field-flash', color: 0xa9c8ff, scale: 1.12, heavyScale };
    }
    return { language: 'hull-spall', color: 0xff8a68, scale: 0.95, heavyScale };
  }
  if (impactEvent.material === 'bulkhead') {
    return { language: 'metal-spark', color: 0xf0b164, scale: 1.15, heavyScale };
  }
  if (impactEvent.material === 'system') {
    return { language: 'electrical-flash', color: 0x82d8df, scale: 1.1, heavyScale };
  }
  return { language: 'industrial-spall', color: 0xc9a878, scale: 0.88, heavyScale };
}

export function babylonWeaponEffectsMode(detailScale: number, coarse: boolean) {
  const effectiveDetail = coarse ? Math.min(detailScale, 0.55) : detailScale;
  return effectiveDetail < 0.58 ? 'reduced' as const : 'full' as const;
}

export class BabylonWeaponVfx {
  private readonly scene: Scene;
  private readonly canvas: HTMLCanvasElement;
  private readonly coarse: boolean;
  private readonly muzzleRoot: TransformNode;
  private readonly muzzleFlash: Mesh;
  private readonly muzzleCore: Mesh;
  private readonly muzzleMaterial: StandardMaterial;
  private readonly muzzleCoreMaterial: StandardMaterial;
  private readonly projectiles: ProjectileVisual[] = [];
  private readonly impacts: ImpactVisual[] = [];
  private disposed = false;

  constructor(scene: Scene, canvas: HTMLCanvasElement, coarse: boolean) {
    this.scene = scene;
    this.canvas = canvas;
    this.coarse = coarse;

    this.muzzleRoot = new TransformNode('p27-b6-muzzle-root', scene);
    this.muzzleMaterial = this.createSignalMaterial('p27-b6-muzzle-material', WEAPON_COLORS.carbine, 0);
    this.muzzleCoreMaterial = this.createSignalMaterial('p27-b6-muzzle-core-material', WEAPON_COLORS.carbine, 0);
    this.muzzleFlash = MeshBuilder.CreateSphere('p27-b6-muzzle-flash', { diameter: 0.22, segments: 8 }, scene);
    this.muzzleFlash.parent = this.muzzleRoot;
    this.muzzleFlash.material = this.muzzleMaterial;
    this.muzzleFlash.isPickable = false;
    this.muzzleCore = MeshBuilder.CreateBox('p27-b6-muzzle-core', { width: 0.34, height: 0.07, depth: 0.07 }, scene);
    this.muzzleCore.parent = this.muzzleRoot;
    this.muzzleCore.position.x = 0.16;
    this.muzzleCore.material = this.muzzleCoreMaterial;
    this.muzzleCore.isPickable = false;
    this.muzzleRoot.setEnabled(false);

    this.canvas.dataset.babylonWeaponVfx = 'ready';
    this.canvas.dataset.babylonWeaponVfxFamilies = 'breacher,carbine,rail';
    this.canvas.dataset.babylonWeaponDamageFeedback = 'impact-ring+surface-language+shared-camera-kick';
    this.canvas.dataset.babylonWeaponEffectsMode = babylonWeaponEffectsMode(1, coarse);
    this.canvas.dataset.babylonWeaponProjectileCount = '0';
    this.canvas.dataset.babylonWeaponImpactCount = '0';
  }

  sync(state: SimState, muzzlePosition: Vector3 | null, vfxDensity: number, transparencyScale = 1) {
    if (this.disposed) return;
    const effectsMode = babylonWeaponEffectsMode(vfxDensity, this.coarse);
    const secondaryTransparency = Math.max(0, Math.min(1, transparencyScale));
    this.syncMuzzle(state, muzzlePosition);
    this.syncProjectiles(state, effectsMode, secondaryTransparency);
    this.syncImpacts(state, effectsMode, secondaryTransparency);

    const shots = state.telemetry.weaponShots;
    this.canvas.dataset.babylonWeaponShotCounts = `carbine:${shots.carbine}|breacher:${shots.breacher}|rail:${shots.rail}`;
    this.canvas.dataset.babylonWeaponShotCount = String(shots[state.player.currentWeapon]);
    this.canvas.dataset.babylonWeaponEffectsMode = effectsMode;
    this.canvas.dataset.babylonWeaponTransparencyScale = secondaryTransparency.toFixed(2);
    this.canvas.dataset.babylonWeaponVfx = 'muzzle+projectiles+impact';
  }

  release(reason: string) {
    if (this.disposed) return;
    this.muzzleRoot.setEnabled(false);
    this.projectiles.forEach(visual => visual.root.setEnabled(false));
    this.impacts.forEach(visual => visual.root.setEnabled(false));
    this.canvas.dataset.babylonWeaponProjectileCount = '0';
    this.canvas.dataset.babylonWeaponImpactCount = '0';
    this.canvas.dataset.babylonWeaponMuzzleFx = 'idle';
    this.canvas.dataset.babylonWeaponVfxRelease = reason;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const visual of this.projectiles) {
      visual.coreMaterial.dispose();
      visual.trailMaterial.dispose();
      visual.root.dispose();
    }
    this.projectiles.length = 0;
    for (const visual of this.impacts) {
      visual.ringMaterial.dispose();
      visual.coreMaterial.dispose();
      visual.sparkMaterial.dispose();
      visual.root.dispose();
    }
    this.impacts.length = 0;
    this.muzzleMaterial.dispose();
    this.muzzleCoreMaterial.dispose();
    this.muzzleRoot.dispose();
    this.canvas.dataset.babylonWeaponVfx = 'disposed';
  }

  private createSignalMaterial(name: string, color: number, alpha: number) {
    const material = new StandardMaterial(name, this.scene);
    const signal = colorFromHex(color);
    material.diffuseColor = signal.scale(0.25);
    material.emissiveColor = signal;
    material.specularColor = Color3.Black();
    material.alpha = alpha;
    material.disableLighting = true;
    return material;
  }

  private syncMuzzle(state: SimState, muzzlePosition: Vector3 | null) {
    const weapon = state.player.currentWeapon;
    const variantId = state.weapons[weapon].variantId;
    const flash = Math.max(0, Math.min(1, state.weaponFlash * 8));
    const enabled = Boolean(muzzlePosition) && !state.player.dead && flash > 0.001;
    this.muzzleRoot.setEnabled(enabled);
    this.canvas.dataset.babylonWeaponFireFx = babylonWeaponFireFxName(weapon, variantId);
    this.canvas.dataset.babylonWeaponMuzzleFx = enabled ? 'authored-socket-live' : 'idle';
    if (!enabled || !muzzlePosition) return;

    const handling = weaponHandlingProfiles[weapon];
    const variant = weaponVariantPresentation(variantId);
    const color = colorFromHex(WEAPON_COLORS[weapon]);
    const length = handling.muzzleLength * (variant?.muzzleLengthMul ?? 1) * (1.05 + flash * 0.72);
    const width = handling.muzzleWidth * (variant?.muzzleWidthMul ?? 1) * (0.92 + flash * 0.32);

    this.muzzleRoot.position.copyFrom(muzzlePosition);
    this.muzzleRoot.rotation.y = Math.atan2(-state.player.aim.y, state.player.aim.x);
    this.muzzleFlash.scaling.set(length, width, width);
    this.muzzleCore.scaling.set(Math.max(0.55, length * 0.84), Math.max(0.7, width * 0.72), Math.max(0.7, width * 0.72));
    this.muzzleMaterial.diffuseColor.copyFrom(color.scale(0.3));
    this.muzzleMaterial.emissiveColor.copyFrom(color);
    this.muzzleMaterial.alpha = 0.3 + flash * 0.68;
    this.muzzleCoreMaterial.diffuseColor.copyFrom(color.scale(0.38));
    this.muzzleCoreMaterial.emissiveColor.copyFrom(color.scale(1.16));
    this.muzzleCoreMaterial.alpha = 0.22 + flash * 0.62;
  }

  private ensureProjectile(index: number) {
    while (this.projectiles.length <= index) {
      const visualIndex = this.projectiles.length;
      const root = new TransformNode(`p27-b6-projectile-root-${visualIndex}`, this.scene);
      const coreMaterial = this.createSignalMaterial(`p27-b6-projectile-core-material-${visualIndex}`, 0xffffff, 1);
      coreMaterial.disableLighting = false;
      const trailMaterial = this.createSignalMaterial(`p27-b6-projectile-trail-material-${visualIndex}`, 0xffffff, 0.6);
      const core = MeshBuilder.CreateSphere(`p27-b6-projectile-core-${visualIndex}`, { diameter: 0.22, segments: 8 }, this.scene);
      core.parent = root;
      core.material = coreMaterial;
      core.isPickable = false;
      const trail = MeshBuilder.CreateBox(`p27-b6-projectile-trail-${visualIndex}`, { width: 0.62, height: 0.035, depth: 0.035 }, this.scene);
      trail.parent = root;
      trail.position.x = -0.32;
      trail.material = trailMaterial;
      trail.isPickable = false;
      root.setEnabled(false);
      this.projectiles.push({ root, core, trail, coreMaterial, trailMaterial });
    }
    return this.projectiles[index];
  }

  private syncProjectiles(state: SimState, effectsMode: 'full' | 'reduced', transparencyScale: number) {
    let count = 0;
    const activeFamilies = new Set<string>();
    for (const projectile of state.projectiles) {
      if (!projectile.active) continue;
      const visual = this.ensureProjectile(count);
      const profile = babylonWeaponProjectileProfile(projectile.weapon);
      const colorHex = projectile.owner === 'player' && projectile.weapon !== 'enemy'
        ? WEAPON_COLORS[projectile.weapon]
        : ENEMY_PROJECTILE_COLOR;
      const color = colorFromHex(colorHex);
      const size = Math.max(0.55, projectile.radius * 0.18);
      const secondaryScale = effectsMode === 'reduced' ? 0.78 : 1;

      visual.root.setEnabled(true);
      visual.root.position.set(scaled(projectile.x), PLAYER_PROJECTILE_Y, scaled(projectile.y));
      visual.root.rotation.y = Math.atan2(-projectile.vy, projectile.vx);
      visual.core.scaling.set(
        size * profile.coreScaleX,
        size * profile.coreScaleY,
        size * profile.coreScaleZ,
      );
      visual.trail.scaling.set(
        profile.trailScaleX * secondaryScale,
        profile.trailScaleY,
        profile.trailScaleZ,
      );
      visual.coreMaterial.diffuseColor.copyFrom(color.scale(0.28));
      visual.coreMaterial.emissiveColor.copyFrom(color.scale(profile.emissive));
      visual.coreMaterial.alpha = 1;
      visual.trailMaterial.diffuseColor.copyFrom(color.scale(0.2));
      visual.trailMaterial.emissiveColor.copyFrom(color);
      visual.trailMaterial.alpha = profile.trailAlpha * secondaryScale * transparencyScale;

      if (projectile.owner === 'player' && projectile.weapon !== 'enemy') activeFamilies.add(projectile.weapon);
      count += 1;
    }
    for (let index = count; index < this.projectiles.length; index += 1) {
      this.projectiles[index].root.setEnabled(false);
    }
    this.canvas.dataset.babylonWeaponProjectileCount = String(count);
    this.canvas.dataset.babylonWeaponProjectileFamilies = [...activeFamilies].sort().join(',') || 'idle';
    this.canvas.dataset.babylonWeaponProjectileLanguage = 'carbine:tracer|breacher:scatter-slug|rail:beam-lance|enemy:bolt';
  }

  private ensureImpact(index: number) {
    while (this.impacts.length <= index) {
      const visualIndex = this.impacts.length;
      const root = new TransformNode(`p27-b6-impact-root-${visualIndex}`, this.scene);
      const ringMaterial = this.createSignalMaterial(`p27-b6-impact-ring-material-${visualIndex}`, 0xffffff, 0.72);
      const coreMaterial = this.createSignalMaterial(`p27-b6-impact-core-material-${visualIndex}`, 0xffffff, 0.8);
      const sparkMaterial = this.createSignalMaterial(`p27-b6-impact-spark-material-${visualIndex}`, 0xffffff, 0.72);
      const ring = MeshBuilder.CreateTorus(`p27-b6-impact-ring-${visualIndex}`, {
        diameter: 0.9,
        thickness: 0.06,
        tessellation: 28,
      }, this.scene);
      ring.parent = root;
      ring.material = ringMaterial;
      ring.isPickable = false;
      const core = MeshBuilder.CreateSphere(`p27-b6-impact-core-${visualIndex}`, { diameter: 0.18, segments: 7 }, this.scene);
      core.parent = root;
      core.position.y = 0.06;
      core.material = coreMaterial;
      core.isPickable = false;
      const sparks: Mesh[] = [];
      for (let sparkIndex = 0; sparkIndex < 4; sparkIndex += 1) {
        const spark = MeshBuilder.CreateBox(`p27-b6-impact-spark-${visualIndex}-${sparkIndex}`, {
          width: 0.34,
          height: 0.025,
          depth: 0.025,
        }, this.scene);
        spark.parent = root;
        spark.position.y = 0.08 + sparkIndex * 0.012;
        spark.rotation.y = sparkIndex * Math.PI / 2 + Math.PI / 4;
        spark.material = sparkMaterial;
        spark.isPickable = false;
        sparks.push(spark);
      }
      root.setEnabled(false);
      this.impacts.push({ root, ring, core, sparks, ringMaterial, coreMaterial, sparkMaterial });
    }
    return this.impacts[index];
  }

  private syncImpacts(state: SimState, effectsMode: 'full' | 'reduced', transparencyScale: number) {
    let count = 0;
    const impactProfile = babylonWeaponImpactProfile(state.impactEvent);
    const color = colorFromHex(impactProfile.color);
    for (const effect of state.effects) {
      if (!effect.active || effect.kind !== 'impact') continue;
      const visual = this.ensureImpact(count);
      const progress = 1 - effect.life / Math.max(0.01, effect.maxLife);
      const fade = Math.max(0, 1 - progress);
      const baseScale = Math.max(0.18, scaled(effect.radius) * (0.42 + progress * 0.85))
        * impactProfile.scale
        * impactProfile.heavyScale;

      visual.root.setEnabled(true);
      visual.root.position.set(scaled(effect.x), 0.12 + progress * 0.24, scaled(effect.y));
      visual.root.rotation.y = state.time * 2.2 + progress * Math.PI;
      visual.ring.scaling.set(baseScale, 1, baseScale);
      visual.core.scaling.setAll(Math.max(0.55, baseScale * (0.62 + progress * 0.35)));
      visual.ringMaterial.diffuseColor.copyFrom(color.scale(0.22));
      visual.ringMaterial.emissiveColor.copyFrom(color);
      visual.ringMaterial.alpha = 0.76 * fade;
      visual.coreMaterial.diffuseColor.copyFrom(color.scale(0.3));
      visual.coreMaterial.emissiveColor.copyFrom(color.scale(1.12));
      visual.coreMaterial.alpha = 0.68 * fade;
      visual.sparkMaterial.diffuseColor.copyFrom(color.scale(0.25));
      visual.sparkMaterial.emissiveColor.copyFrom(color);
      visual.sparkMaterial.alpha = effectsMode === 'reduced' ? 0 : 0.78 * fade * transparencyScale;
      visual.sparks.forEach((spark, sparkIndex) => {
        spark.setEnabled(effectsMode === 'full');
        const sparkScale = 0.75 + progress * 1.9;
        spark.scaling.set(sparkScale, 1, 1);
        spark.rotation.y = state.time * (1.4 + sparkIndex * 0.16) + sparkIndex * Math.PI / 2 + progress;
      });
      count += 1;
    }
    for (let index = count; index < this.impacts.length; index += 1) {
      this.impacts[index].root.setEnabled(false);
    }

    this.canvas.dataset.babylonWeaponImpactCount = String(count);
    this.canvas.dataset.babylonWeaponImpactFx = impactProfile.language;
    this.canvas.dataset.babylonWeaponImpactSerial = String(state.impactEvent?.serial ?? 0);
    this.canvas.dataset.babylonWeaponImpactHeavy = state.impactEvent?.heavy ? 'true' : 'false';
    this.canvas.dataset.babylonWeaponDamageFeedback = effectsMode === 'reduced'
      ? 'impact-ring+surface-language+shared-camera-kick:sparks-suppressed'
      : 'impact-ring+surface-language+shared-camera-kick:sparks-enabled';
  }
}
