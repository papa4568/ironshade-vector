import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { OperatorClassId } from './classSkills';
import { resolvePlayerSkillAnimation } from './skillDamageAnimation';
import type { Effect, SimState } from './sim';

const WORLD_SCALE = 0.02;

export type BabylonClassSkillVfxProfile = {
  id: string;
  language: string;
  color: number;
  scaleX: number;
  scaleZ: number;
  forwardOffset: number;
  glyphLength: number;
  glyphWidth: number;
};

export type BabylonMobilityVfxProfile = {
  language: string;
  color: number;
  length: number;
  width: number;
  spread: number;
};

type EffectProfile = {
  color: number;
  scaleX: number;
  scaleZ: number;
  rotationSpeed: number;
  glyphScaleX: number;
  glyphScaleZ: number;
};

type EffectVisual = {
  root: TransformNode;
  ring: Mesh;
  glyph: Mesh;
  ringMaterial: StandardMaterial;
  glyphMaterial: StandardMaterial;
};

const CLASS_SKILL_PROFILES: Record<OperatorClassId, readonly [BabylonClassSkillVfxProfile, BabylonClassSkillVfxProfile, BabylonClassSkillVfxProfile]> = {
  vanguard: [
    { id: 'vanguard-breach-rush', language: 'breach-wedge', color: 0xbd8a64, scaleX: 1.48, scaleZ: 0.72, forwardOffset: 46, glyphLength: 1.32, glyphWidth: 1.15 },
    { id: 'vanguard-fracture-tag', language: 'fracture-bracket', color: 0xf0a36d, scaleX: 0.88, scaleZ: 1.12, forwardOffset: 34, glyphLength: 0.82, glyphWidth: 1.28 },
    { id: 'vanguard-bulwark-pulse', language: 'bulwark-burst', color: 0xe7c18c, scaleX: 1.18, scaleZ: 1.18, forwardOffset: 8, glyphLength: 0.92, glyphWidth: 1.65 },
  ],
  vector: [
    { id: 'vector-shift', language: 'shift-streak', color: 0x74a6c7, scaleX: 1.72, scaleZ: 0.52, forwardOffset: 58, glyphLength: 1.55, glyphWidth: 0.72 },
    { id: 'vector-deadeye-lock', language: 'deadeye-reticle', color: 0x9ad9ff, scaleX: 0.76, scaleZ: 0.76, forwardOffset: 52, glyphLength: 1.08, glyphWidth: 0.7 },
    { id: 'vector-splitshot', language: 'split-fan', color: 0x8bc7ef, scaleX: 1.34, scaleZ: 0.82, forwardOffset: 42, glyphLength: 1.38, glyphWidth: 1.7 },
  ],
  systems: [
    { id: 'systems-polarity-well', language: 'polarity-field', color: 0x9b87bd, scaleX: 1.22, scaleZ: 1.22, forwardOffset: 38, glyphLength: 0.84, glyphWidth: 1.82 },
    { id: 'systems-relay-hack', language: 'relay-node', color: 0xb8a4df, scaleX: 0.82, scaleZ: 1.28, forwardOffset: 46, glyphLength: 0.72, glyphWidth: 1.45 },
    { id: 'systems-cascade-arc', language: 'cascade-lattice', color: 0x84caeb, scaleX: 1.08, scaleZ: 1.46, forwardOffset: 34, glyphLength: 1.18, glyphWidth: 1.22 },
  ],
};

const MOBILITY_PROFILES: Record<OperatorClassId, BabylonMobilityVfxProfile> = {
  vanguard: { language: 'vanguard-mass-trail', color: 0xbd8a64, length: 1.02, width: 1.32, spread: 0.18 },
  vector: { language: 'vector-slipstream', color: 0x74a6c7, length: 1.58, width: 0.68, spread: 0.11 },
  systems: { language: 'systems-vector-grid', color: 0x9b87bd, length: 1.22, width: 0.94, spread: 0.24 },
};

const EFFECT_PROFILES: Record<Exclude<Effect['kind'], 'impact'>, EffectProfile> = {
  pulse: { color: 0x9debd8, scaleX: 1.2, scaleZ: 1.2, rotationSpeed: 0.8, glyphScaleX: 1.1, glyphScaleZ: 1.1 },
  arc: { color: 0x84caeb, scaleX: 0.72, scaleZ: 1.28, rotationSpeed: -2.8, glyphScaleX: 0.62, glyphScaleZ: 1.55 },
  breach: { color: 0xf07d4d, scaleX: 1.08, scaleZ: 1.08, rotationSpeed: 1.4, glyphScaleX: 1.4, glyphScaleZ: 0.54 },
  mark: { color: 0xd0e07a, scaleX: 0.78, scaleZ: 0.78, rotationSpeed: 0.7, glyphScaleX: 0.7, glyphScaleZ: 0.7 },
  vanguard: { color: 0xbd8a64, scaleX: 1.38, scaleZ: 0.88, rotationSpeed: 0.55, glyphScaleX: 1.55, glyphScaleZ: 0.62 },
  vector: { color: 0x74a6c7, scaleX: 1.62, scaleZ: 0.58, rotationSpeed: -1.25, glyphScaleX: 1.78, glyphScaleZ: 0.48 },
  systems: { color: 0x9b87bd, scaleX: 1.0, scaleZ: 1.18, rotationSpeed: 1.8, glyphScaleX: 0.82, glyphScaleZ: 1.5 },
};

function scaled(value: number) {
  return value * WORLD_SCALE;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function colorFromHex(hex: number) {
  return Color3.FromInts((hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff);
}

export function babylonClassSkillVfxProfile(operatorClass: OperatorClassId | null, abilityIndex: number) {
  if (!operatorClass || abilityIndex < 0 || abilityIndex > 2) return null;
  return CLASS_SKILL_PROFILES[operatorClass][abilityIndex];
}

export function babylonMobilityVfxProfile(operatorClass: OperatorClassId | null) {
  return operatorClass ? MOBILITY_PROFILES[operatorClass] : null;
}

export function babylonAbilityEffectsMode(detailScale: number, coarse: boolean) {
  const effectiveDetail = coarse ? Math.min(detailScale, 0.55) : detailScale;
  return effectiveDetail < 0.58 ? 'reduced' as const : 'full' as const;
}

export class BabylonAbilityVfx {
  private readonly scene: Scene;
  private readonly canvas: HTMLCanvasElement;
  private readonly coarse: boolean;
  private readonly skillRoot: TransformNode;
  private readonly skillRing: Mesh;
  private readonly skillGlyph: Mesh;
  private readonly skillRingMaterial: StandardMaterial;
  private readonly skillGlyphMaterial: StandardMaterial;
  private readonly mobilityRoot: TransformNode;
  private readonly mobilityStreaks: Mesh[] = [];
  private readonly mobilityMaterial: StandardMaterial;
  private readonly pulseRoot: TransformNode;
  private readonly pulseRing: Mesh;
  private readonly pulseMaterial: StandardMaterial;
  private readonly effects: EffectVisual[] = [];
  private disposed = false;

  constructor(scene: Scene, canvas: HTMLCanvasElement, coarse: boolean) {
    this.scene = scene;
    this.canvas = canvas;
    this.coarse = coarse;

    this.skillRoot = new TransformNode('p27-b7-skill-root', scene);
    this.skillRingMaterial = this.createSignalMaterial('p27-b7-skill-ring-material', 0xffffff, 0);
    this.skillGlyphMaterial = this.createSignalMaterial('p27-b7-skill-glyph-material', 0xffffff, 0);
    this.skillRing = MeshBuilder.CreateTorus('p27-b7-skill-ring', { diameter: 1.25, thickness: 0.065, tessellation: 32 }, scene);
    this.skillRing.parent = this.skillRoot;
    this.skillRing.material = this.skillRingMaterial;
    this.skillRing.isPickable = false;
    this.skillGlyph = MeshBuilder.CreateBox('p27-b7-skill-glyph', { width: 0.9, height: 0.035, depth: 0.14 }, scene);
    this.skillGlyph.parent = this.skillRoot;
    this.skillGlyph.position.y = 0.06;
    this.skillGlyph.material = this.skillGlyphMaterial;
    this.skillGlyph.isPickable = false;
    this.skillRoot.setEnabled(false);

    this.mobilityRoot = new TransformNode('p27-b7-mobility-root', scene);
    this.mobilityMaterial = this.createSignalMaterial('p27-b7-mobility-material', 0xffffff, 0);
    for (let index = 0; index < 3; index += 1) {
      const streak = MeshBuilder.CreateBox('p27-b7-mobility-streak-' + index, { width: 0.62, height: 0.025, depth: 0.045 }, scene);
      streak.parent = this.mobilityRoot;
      streak.position.y = 0.18 + index * 0.035;
      streak.material = this.mobilityMaterial;
      streak.isPickable = false;
      this.mobilityStreaks.push(streak);
    }
    this.mobilityRoot.setEnabled(false);

    this.pulseRoot = new TransformNode('p27-b7-pulse-root', scene);
    this.pulseMaterial = this.createSignalMaterial('p27-b7-pulse-material', 0x9debd8, 0);
    this.pulseRing = MeshBuilder.CreateTorus('p27-b7-pulse-ring', { diameter: 2, thickness: 0.055, tessellation: 36 }, scene);
    this.pulseRing.parent = this.pulseRoot;
    this.pulseRing.material = this.pulseMaterial;
    this.pulseRing.isPickable = false;
    this.pulseRoot.setEnabled(false);

    this.canvas.dataset.babylonAbilityVfx = 'ready';
    this.canvas.dataset.babylonAbilityVfxClasses = 'vanguard,vector,systems';
    this.canvas.dataset.babylonAbilitySkill = 'idle';
    this.canvas.dataset.babylonMobilityFx = 'idle';
    this.canvas.dataset.babylonAbilityEffectCount = '0';
    this.canvas.dataset.babylonAbilityFieldCount = '0';
    this.canvas.dataset.babylonAbilityFieldRenderer = 'babylon-world-presentation';
  }

  sync(state: SimState, vfxDensity: number, transparencyScale = 1) {
    if (this.disposed) return;
    const effectsMode = babylonAbilityEffectsMode(vfxDensity, this.coarse);
    const secondaryTransparency = Math.max(0, Math.min(1, transparencyScale));
    this.syncSkill(state);
    this.syncMobility(state, effectsMode, secondaryTransparency);
    this.syncPulse(state);
    this.syncEffects(state, effectsMode, secondaryTransparency);
    this.syncFieldTelemetry(state);
    this.canvas.dataset.babylonAbilityEffectsMode = effectsMode;
    this.canvas.dataset.babylonAbilityTransparencyScale = secondaryTransparency.toFixed(2);
    this.canvas.dataset.babylonAbilityVfx = 'skill+mobility+effects+shared-player-fields';
    this.canvas.dataset.babylonAbilitySimulationOwnership = 'read-only-presentation';
  }

  release(reason: string) {
    if (this.disposed) return;
    this.skillRoot.setEnabled(false);
    this.mobilityRoot.setEnabled(false);
    this.pulseRoot.setEnabled(false);
    this.effects.forEach(visual => visual.root.setEnabled(false));
    this.canvas.dataset.babylonAbilitySkill = 'idle';
    this.canvas.dataset.babylonMobilityFx = 'idle';
    this.canvas.dataset.babylonAbilityEffectCount = '0';
    this.canvas.dataset.babylonAbilityFieldCount = '0';
    this.canvas.dataset.babylonAbilityVfxRelease = reason;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const visual of this.effects) {
      visual.ringMaterial.dispose();
      visual.glyphMaterial.dispose();
      visual.root.dispose();
    }
    this.effects.length = 0;
    this.skillRingMaterial.dispose();
    this.skillGlyphMaterial.dispose();
    this.mobilityMaterial.dispose();
    this.pulseMaterial.dispose();
    this.skillRoot.dispose();
    this.mobilityRoot.dispose();
    this.pulseRoot.dispose();
    this.canvas.dataset.babylonAbilityVfx = 'disposed';
  }

  private createSignalMaterial(name: string, color: number, alpha: number) {
    const material = new StandardMaterial(name, this.scene);
    const signal = colorFromHex(color);
    material.diffuseColor = signal.scale(0.2);
    material.emissiveColor = signal;
    material.specularColor = Color3.Black();
    material.alpha = alpha;
    material.disableLighting = true;
    return material;
  }

  private syncSkill(state: SimState) {
    const player = state.player;
    const skill = resolvePlayerSkillAnimation({
      operatorClass: state.build.operatorClass,
      abilityIndex: state.lastAbilityIndex,
      elapsed: state.time - state.lastAbilityAt,
      dodge: player.dodgeTime,
      reload: player.reloadT,
      vent: player.ventT,
      hit: 0,
      dead: player.dead,
    });
    const profile = babylonClassSkillVfxProfile(state.build.operatorClass, state.lastAbilityIndex);
    const active = Boolean(profile && skill.profile && skill.phase !== 'idle' && !skill.interrupted && !player.dead);
    this.skillRoot.setEnabled(active);
    if (!active || !profile) {
      this.canvas.dataset.babylonAbilitySkill = 'idle';
      this.canvas.dataset.babylonAbilitySkillCue = 'idle';
      return;
    }

    const color = colorFromHex(profile.color);
    const phaseScale = skill.phase === 'anticipation'
      ? 0.72 + skill.weight * 0.22
      : skill.phase === 'action'
        ? 0.98 + skill.impulse * 0.24
        : 0.88 + skill.weight * 0.12;
    const alpha = Math.max(0.18, (0.26 + skill.weight * 0.58 + skill.impulse * 0.12) * (skill.phase === 'recovery' ? 0.72 : 1));
    this.skillRoot.position.set(
      scaled(player.x + player.aim.x * profile.forwardOffset),
      0.1,
      scaled(player.y + player.aim.y * profile.forwardOffset),
    );
    this.skillRoot.rotation.y = Math.atan2(-player.aim.y, player.aim.x);
    this.skillRing.scaling.set(profile.scaleX * phaseScale, 1, profile.scaleZ * phaseScale);
    this.skillGlyph.scaling.set(
      profile.glyphLength * (0.76 + skill.weight * 0.24),
      1,
      profile.glyphWidth * (0.78 + skill.impulse * 0.24),
    );
    this.skillGlyph.position.x = 0.2 + skill.impulse * 0.12;
    this.skillRingMaterial.diffuseColor.copyFrom(color.scale(0.22));
    this.skillRingMaterial.emissiveColor.copyFrom(color);
    this.skillRingMaterial.alpha = alpha;
    this.skillGlyphMaterial.diffuseColor.copyFrom(color.scale(0.28));
    this.skillGlyphMaterial.emissiveColor.copyFrom(color.scale(1.12));
    this.skillGlyphMaterial.alpha = Math.min(0.9, alpha + 0.08);
    this.canvas.dataset.babylonAbilitySkill = profile.id + ':' + skill.phase;
    this.canvas.dataset.babylonAbilitySkillCue = profile.language;
    this.canvas.dataset.babylonAbilitySkillBlend = [
      'weight:' + skill.weight.toFixed(2),
      'impulse:' + skill.impulse.toFixed(2),
      'recovery:' + skill.recovery.toFixed(2),
      'cancel:' + (skill.interrupted ? 'interrupted' : skill.cancelReady ? 'ready' : 'locked'),
    ].join(',');
  }

  private syncMobility(state: SimState, effectsMode: 'full' | 'reduced', transparencyScale: number) {
    const player = state.player;
    const profile = babylonMobilityVfxProfile(state.build.operatorClass);
    const speed = Math.hypot(player.vx, player.vy);
    const dodging = player.dodgeTime > 0;
    const moving = speed > 80;
    const active = Boolean(profile && !player.dead && (dodging || moving));
    this.mobilityRoot.setEnabled(active);
    if (!active || !profile) {
      this.canvas.dataset.babylonMobilityFx = 'idle';
      this.canvas.dataset.babylonMobilitySpeed = speed.toFixed(1);
      return;
    }

    const directionLength = speed > 1 ? speed : 1;
    const dirX = speed > 1 ? player.vx / directionLength : player.aim.x;
    const dirY = speed > 1 ? player.vy / directionLength : player.aim.y;
    const speedScale = Math.max(0.35, Math.min(1.35, speed / 560));
    const dodgeScale = dodging ? 1 + clamp01(player.dodgeTime / 0.18) * 0.42 : 1;
    const color = colorFromHex(profile.color);
    this.mobilityRoot.position.set(scaled(player.x), 0.1, scaled(player.y));
    this.mobilityRoot.rotation.y = Math.atan2(-dirY, dirX);
    this.mobilityMaterial.diffuseColor.copyFrom(color.scale(0.18));
    this.mobilityMaterial.emissiveColor.copyFrom(color);
    this.mobilityMaterial.alpha = dodging ? 0.72 : (0.26 + speedScale * 0.16) * transparencyScale;

    this.mobilityStreaks.forEach((streak, index) => {
      const secondarySuppressed = effectsMode === 'reduced' && index === 2;
      streak.setEnabled(!secondarySuppressed);
      const taper = 1 - index * 0.16;
      streak.position.x = -profile.length * (0.42 + index * 0.34) * dodgeScale;
      streak.position.z = (index - 1) * profile.spread;
      streak.scaling.set(
        profile.length * (0.72 + speedScale * 0.46) * dodgeScale * taper,
        1,
        profile.width * (dodging ? 1.12 : 0.8) * taper,
      );
    });
    this.canvas.dataset.babylonMobilityFx = (state.build.operatorClass ?? 'generic') + (dodging ? '-dodge-trail' : '-motion-trail');
    this.canvas.dataset.babylonMobilityLanguage = profile.language;
    this.canvas.dataset.babylonMobilitySpeed = speed.toFixed(1);
  }

  private syncPulse(state: SimState) {
    const active = state.pulse > 0 && !state.player.dead;
    this.pulseRoot.setEnabled(active);
    if (!active) {
      this.canvas.dataset.babylonAbilityPulse = 'idle';
      return;
    }
    const radius = Math.max(0.15, (0.36 - state.pulse) / 0.36 * 5.7);
    const alpha = Math.max(0, Math.min(0.85, state.pulse / 0.36));
    this.pulseRoot.position.set(scaled(state.player.x), 0.11, scaled(state.player.y));
    this.pulseRing.scaling.set(radius, 1, radius);
    this.pulseMaterial.alpha = alpha;
    this.canvas.dataset.babylonAbilityPulse = 'shared-state-pulse';
  }

  private ensureEffect(index: number) {
    while (this.effects.length <= index) {
      const visualIndex = this.effects.length;
      const root = new TransformNode('p27-b7-effect-root-' + visualIndex, this.scene);
      const ringMaterial = this.createSignalMaterial('p27-b7-effect-ring-material-' + visualIndex, 0xffffff, 0);
      const glyphMaterial = this.createSignalMaterial('p27-b7-effect-glyph-material-' + visualIndex, 0xffffff, 0);
      const ring = MeshBuilder.CreateTorus('p27-b7-effect-ring-' + visualIndex, { diameter: 2, thickness: 0.055, tessellation: 32 }, this.scene);
      ring.parent = root;
      ring.material = ringMaterial;
      ring.isPickable = false;
      const glyph = MeshBuilder.CreateBox('p27-b7-effect-glyph-' + visualIndex, { width: 0.62, height: 0.025, depth: 0.12 }, this.scene);
      glyph.parent = root;
      glyph.position.y = 0.055;
      glyph.material = glyphMaterial;
      glyph.isPickable = false;
      root.setEnabled(false);
      this.effects.push({ root, ring, glyph, ringMaterial, glyphMaterial });
    }
    return this.effects[index];
  }

  private syncEffects(state: SimState, effectsMode: 'full' | 'reduced', transparencyScale: number) {
    let count = 0;
    const kinds = new Set<string>();
    for (const effect of state.effects) {
      if (!effect.active || effect.kind === 'impact') continue;
      const profile = EFFECT_PROFILES[effect.kind];
      const visual = this.ensureEffect(count);
      const progress = 1 - effect.life / Math.max(0.01, effect.maxLife);
      const fade = Math.max(0, 1 - progress);
      const baseScale = Math.max(0.18, scaled(effect.radius) * (0.42 + progress * 0.85));
      const pulse = effect.kind === 'systems' ? 0.86 + Math.sin((state.time + progress) * 18) * 0.12 : 1;
      const color = colorFromHex(profile.color);
      const criticalGlyph = effect.kind === 'mark' || effect.kind === 'vanguard' || effect.kind === 'vector' || effect.kind === 'systems';

      visual.root.setEnabled(true);
      visual.root.position.set(scaled(effect.x), 0.12 + progress * 0.35, scaled(effect.y));
      visual.root.rotation.y = state.time * profile.rotationSpeed + progress * Math.PI * 0.5;
      visual.ring.scaling.set(baseScale * profile.scaleX * pulse, 1, baseScale * profile.scaleZ * pulse);
      visual.glyph.scaling.set(
        Math.max(0.35, baseScale * profile.glyphScaleX),
        1,
        Math.max(0.35, baseScale * profile.glyphScaleZ),
      );
      visual.glyph.rotation.y = effect.kind === 'mark' ? Math.PI / 4 : 0;
      visual.glyph.setEnabled(effectsMode === 'full' || criticalGlyph);
      visual.ringMaterial.diffuseColor.copyFrom(color.scale(0.2));
      visual.ringMaterial.emissiveColor.copyFrom(color);
      visual.ringMaterial.alpha = (effect.kind === 'mark' ? 0.58 : 0.76) * fade;
      visual.glyphMaterial.diffuseColor.copyFrom(color.scale(0.24));
      visual.glyphMaterial.emissiveColor.copyFrom(color.scale(1.08));
      visual.glyphMaterial.alpha = effectsMode === 'reduced' && !criticalGlyph
        ? 0
        : 0.62 * fade * (criticalGlyph ? 1 : transparencyScale);
      kinds.add(effect.kind);
      count += 1;
    }

    for (let index = count; index < this.effects.length; index += 1) this.effects[index].root.setEnabled(false);
    this.canvas.dataset.babylonAbilityEffectCount = String(count);
    this.canvas.dataset.babylonAbilityEffectKinds = [...kinds].sort().join(',') || 'idle';
    this.canvas.dataset.babylonAbilityEffectPriority = effectsMode === 'reduced'
      ? 'critical-rings+class-mark-glyphs:secondary-glyphs-suppressed'
      : 'critical-rings+class-mark-glyphs+secondary-glyphs';
  }

  private syncFieldTelemetry(state: SimState) {
    const fields = state.hazards.filter(hazard => hazard.active && hazard.owner === 'player');
    this.canvas.dataset.babylonAbilityFieldCount = String(fields.length);
    this.canvas.dataset.babylonAbilityFieldKinds = [...new Set(fields.map(hazard => hazard.kind))].sort().join(',') || 'idle';
    this.canvas.dataset.babylonAbilityFieldRenderer = 'babylon-world-presentation';
  }
}
