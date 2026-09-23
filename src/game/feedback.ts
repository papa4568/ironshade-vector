import { weaponVariantPresentation, type WeaponVariantId } from './classArsenal';
import type { ProfileSettings } from './meta';
import type { HighTierMutationId } from './t9Mutations';
import type { Enemy } from './sim';
import type { PlayerStatusVisualId } from './statusVisualLanguage';

export type FeedbackCue =
  | 'ui' | 'loot' | 'rareLoot' | 'carbine' | 'breacher' | 'rail' | 'reload'
  | 'impact' | 'armor' | 'damage' | 'ability' | 'dodge' | 'breach' | 'gravity'
  | 'enemy' | 'machinery' | 'targetLock';

export type WeaponCue = Extract<FeedbackCue, 'carbine' | 'breacher' | 'rail'>;
type UtilityCue = Exclude<FeedbackCue, WeaponCue>;

type Tone = { frequency: number; duration: number; type: OscillatorType; sweep?: number };
export type WeaponAudioLayer = {
  frequency: number;
  duration: number;
  type: OscillatorType;
  gain: number;
  sweep?: number;
  delay?: number;
  attack?: number;
  lowpassHz?: number;
};
export type WeaponAudioProfile = {
  mechanical: WeaponAudioLayer[];
  discharge: WeaponAudioLayer[];
  tails: Record<'near' | 'mid' | 'far', WeaponAudioLayer>;
  tailCadence: Record<'near' | 'mid' | 'far', number>;
  repeat: { pitchCents: number; gainVariance: number };
  masterGain: number;
};

export type ImpactSurface = 'armor' | 'machinery' | 'ice' | 'steel' | 'glass' | 'field';
export type AudioPressureState = 'normal' | 'leaking' | 'decompressing' | 'vacuum';
export type AudioEnvironment = { space: 'interior' | 'open'; pressure: AudioPressureState };
export type AcousticTreatment = { gain: number; tailGain: number; lowpassHz: number; tailDelay: number };
export type ImpactAudioProfile = { layers: WeaponAudioLayer[]; masterGain: number };

export type SkillAudioClass = 'vanguard' | 'vector' | 'systems';
export type FoleyAudioAction = 'reload' | 'vent';
export type FoleyAudioPhase = 'start' | 'complete';
export type ThreatAudioCue = 'enemy-telegraph' | 'elite-telegraph' | 'boss-telegraph' | 'boss-phase' | 'enemy-spawn' | 'elite-spawn' | 'boss-spawn' | 'danger-ready' | 'enemy-disable' | 'boss-disable';
export type AudioBusName = 'ui' | 'weapon' | 'impact' | 'foley' | 'skill' | 'threat' | 'utility';
export type CombatAudioPriority = 'background' | 'normal' | 'important' | 'critical';
export type FoleyAudioProfile = { start: WeaponAudioLayer[]; complete: WeaponAudioLayer[]; masterGain: number };
export type SkillAudioProfile = { layers: WeaponAudioLayer[]; masterGain: number; priority: 'important' };
export type ThreatAudioProfile = { layers: WeaponAudioLayer[]; masterGain: number; priority: 'important' | 'critical' };
export type EnemyMutationAudioCue = HighTierMutationId;
export type EnemyMutationAudioProfile = { layers: WeaponAudioLayer[]; masterGain: number; priority: 'background' | 'normal' };
export type EnemyStatusAudioCue = keyof Enemy['statuses'];
export type PlayerStatusAudioCue = PlayerStatusVisualId;
export type StatusAudioProfile = { layers: WeaponAudioLayer[]; masterGain: number; priority: 'background' | 'normal' | 'important' };

export const combatAudioBudget = {
  maxVoices: 18,
  criticalReserveVoices: 3,
  maxTailVoices: 5,
  backgroundVoiceCeiling: 12,
  normalVoiceCeiling: 15,
} as const;

export type CombatAudioVoiceAdmission = {
  admitted: boolean;
  reason: 'available' | 'background-pressure' | 'normal-pressure' | 'tail-pressure' | 'main-ceiling' | 'absolute-ceiling';
};

export function combatAudioVoiceAdmission(
  activeVoices: number,
  activeTailVoices: number,
  role: 'direct' | 'tail',
  priority: CombatAudioPriority,
): CombatAudioVoiceAdmission {
  const criticalCeiling = combatAudioBudget.maxVoices + combatAudioBudget.criticalReserveVoices;
  if (activeVoices >= criticalCeiling) return { admitted: false, reason: 'absolute-ceiling' };
  if (role === 'tail' && activeTailVoices >= combatAudioBudget.maxTailVoices && priority !== 'critical') {
    return { admitted: false, reason: 'tail-pressure' };
  }
  if (priority === 'background' && activeVoices >= combatAudioBudget.backgroundVoiceCeiling) {
    return { admitted: false, reason: 'background-pressure' };
  }
  if (priority === 'normal' && activeVoices >= combatAudioBudget.normalVoiceCeiling) {
    return { admitted: false, reason: 'normal-pressure' };
  }
  if (priority !== 'critical' && activeVoices >= combatAudioBudget.maxVoices) {
    return { admitted: false, reason: 'main-ceiling' };
  }
  return { admitted: true, reason: 'available' };
}

const unityBusGain: Record<AudioBusName, number> = { ui: 1, weapon: 1, impact: 1, foley: 1, skill: 1, threat: 1, utility: 1 };
export const combatMixProfiles: Record<CombatAudioPriority, { holdSeconds: number; busGain: Record<AudioBusName, number> }> = {
  background: { holdSeconds: 0, busGain: { ...unityBusGain } },
  normal: { holdSeconds: 0, busGain: { ...unityBusGain } },
  important: { holdSeconds: .18, busGain: { ui: 1, weapon: .72, impact: .76, foley: .94, skill: 1, threat: 1, utility: .86 } },
  critical: { holdSeconds: .32, busGain: { ui: 1, weapon: .42, impact: .52, foley: .7, skill: .76, threat: 1, utility: .62 } },
};

const openAudioLocations = new Set(['asteroid-refinery', 'jovian-harvester', 'solar-yard', 'momentum-exchange']);
const glassAudioLocations = new Set(['spin-habitat', 'solar-yard', 'parallax-array', 'lattice-annex']);
const iceAudioLocations = new Set(['ice-mine', 'cryo-reserve']);
const machineryKinds = new Set(['conduit', 'coolant', 'doorControl', 'gravityControl', 'sealControl', 'powerControl', 'salvageNode', 'anchorNode']);

export function combatAudioEnvironment(location: string, pressure: AudioPressureState): AudioEnvironment {
  return { space: openAudioLocations.has(location) ? 'open' : 'interior', pressure };
}

export function acousticTreatmentFor(environment: AudioEnvironment): AcousticTreatment {
  const pressure = environment.pressure === 'vacuum'
    ? { gain: .34, tail: .12, lowpassHz: 1200, delay: .002 }
    : environment.pressure === 'decompressing'
      ? { gain: .58, tail: .3, lowpassHz: 2450, delay: .006 }
      : environment.pressure === 'leaking'
        ? { gain: .8, tail: .62, lowpassHz: 4300, delay: .012 }
        : { gain: 1, tail: 1, lowpassHz: 7800, delay: .018 };
  const openGain = environment.space === 'open' ? .92 : 1;
  const openTail = environment.space === 'open' ? .52 : 1;
  return {
    gain: pressure.gain * openGain,
    tailGain: pressure.tail * openTail,
    lowpassHz: pressure.lowpassHz,
    tailDelay: pressure.delay * (environment.space === 'open' ? .55 : 1),
  };
}

export function impactSurfaceForObject(material: string, kind: string, location: string): ImpactSurface {
  if (machineryKinds.has(kind) || material === 'system') return 'machinery';
  if (iceAudioLocations.has(location)) return 'ice';
  if (material === 'light' && glassAudioLocations.has(location)) return 'glass';
  return 'steel';
}

export const impactAudioProfiles: Record<ImpactSurface, ImpactAudioProfile> = {
  armor: {
    layers: [
      { frequency: 860, duration: .028, type: 'triangle', gain: .5, sweep: .62, lowpassHz: 5200 },
      { frequency: 176, duration: .075, type: 'square', gain: .38, sweep: .7, lowpassHz: 1900 },
      { frequency: 1220, duration: .045, type: 'sine', gain: .18, sweep: .86, delay: .014, lowpassHz: 4600 },
    ],
    masterGain: .21,
  },
  machinery: {
    layers: [
      { frequency: 510, duration: .045, type: 'square', gain: .42, sweep: .7, lowpassHz: 3600 },
      { frequency: 118, duration: .105, type: 'triangle', gain: .36, sweep: .76, lowpassHz: 1350 },
      { frequency: 980, duration: .055, type: 'triangle', gain: .2, sweep: 1.24, delay: .018, lowpassHz: 4200 },
    ],
    masterGain: .2,
  },
  ice: {
    layers: [
      { frequency: 1780, duration: .032, type: 'triangle', gain: .4, sweep: .56, lowpassHz: 6500 },
      { frequency: 640, duration: .065, type: 'sine', gain: .34, sweep: .62, lowpassHz: 4200 },
      { frequency: 148, duration: .12, type: 'sine', gain: .22, sweep: .82, delay: .022, lowpassHz: 1250 },
    ],
    masterGain: .19,
  },
  steel: {
    layers: [
      { frequency: 930, duration: .03, type: 'square', gain: .44, sweep: .72, lowpassHz: 5600 },
      { frequency: 205, duration: .085, type: 'triangle', gain: .4, sweep: .67, lowpassHz: 1700 },
      { frequency: 1360, duration: .075, type: 'sine', gain: .19, sweep: .9, delay: .018, lowpassHz: 5400 },
    ],
    masterGain: .2,
  },
  glass: {
    layers: [
      { frequency: 2380, duration: .026, type: 'triangle', gain: .38, sweep: .66, lowpassHz: 7600 },
      { frequency: 1460, duration: .06, type: 'sine', gain: .3, sweep: .74, delay: .008, lowpassHz: 6900 },
      { frequency: 430, duration: .09, type: 'triangle', gain: .18, sweep: .7, delay: .026, lowpassHz: 3500 },
    ],
    masterGain: .18,
  },
  field: {
    layers: [
      { frequency: 760, duration: .055, type: 'sine', gain: .42, sweep: 1.72, lowpassHz: 5900 },
      { frequency: 182, duration: .1, type: 'sine', gain: .34, sweep: .58, lowpassHz: 1800 },
      { frequency: 1180, duration: .07, type: 'triangle', gain: .2, sweep: 1.22, delay: .016, lowpassHz: 5200 },
    ],
    masterGain: .19,
  },
};

export const foleyAudioProfiles: Record<WeaponCue, Record<FoleyAudioAction, FoleyAudioProfile>> = {
  carbine: {
    reload: {
      start: [
        { frequency: 1180, duration: .025, type: 'square', gain: .24, sweep: .72, lowpassHz: 4300 },
        { frequency: 410, duration: .06, type: 'triangle', gain: .32, sweep: .66, delay: .018, lowpassHz: 2400 },
      ],
      complete: [
        { frequency: 760, duration: .035, type: 'square', gain: .28, sweep: .82, lowpassHz: 3600 },
        { frequency: 1320, duration: .024, type: 'triangle', gain: .18, sweep: 1.12, delay: .012, lowpassHz: 5200 },
      ],
      masterGain: .16,
    },
    vent: {
      start: [
        { frequency: 540, duration: .12, type: 'sawtooth', gain: .24, sweep: .54, lowpassHz: 2600 },
        { frequency: 1860, duration: .09, type: 'sine', gain: .16, sweep: .76, delay: .02, lowpassHz: 5600 },
      ],
      complete: [{ frequency: 620, duration: .05, type: 'triangle', gain: .24, sweep: .72, lowpassHz: 3200 }],
      masterGain: .14,
    },
  },
  breacher: {
    reload: {
      start: [
        { frequency: 330, duration: .07, type: 'square', gain: .38, sweep: .62, lowpassHz: 2100 },
        { frequency: 118, duration: .095, type: 'triangle', gain: .32, sweep: .72, delay: .026, lowpassHz: 1200 },
      ],
      complete: [
        { frequency: 470, duration: .055, type: 'square', gain: .36, sweep: .68, lowpassHz: 2600 },
        { frequency: 164, duration: .075, type: 'triangle', gain: .26, sweep: .62, delay: .018, lowpassHz: 1500 },
      ],
      masterGain: .18,
    },
    vent: {
      start: [
        { frequency: 138, duration: .16, type: 'sawtooth', gain: .4, sweep: .48, lowpassHz: 1450 },
        { frequency: 720, duration: .11, type: 'triangle', gain: .18, sweep: .62, delay: .024, lowpassHz: 3000 },
      ],
      complete: [{ frequency: 270, duration: .07, type: 'square', gain: .3, sweep: .66, lowpassHz: 1800 }],
      masterGain: .17,
    },
  },
  rail: {
    reload: {
      start: [
        { frequency: 920, duration: .065, type: 'triangle', gain: .24, sweep: 1.24, lowpassHz: 4600 },
        { frequency: 1520, duration: .075, type: 'sine', gain: .19, sweep: .78, delay: .018, lowpassHz: 6200 },
      ],
      complete: [
        { frequency: 1260, duration: .055, type: 'triangle', gain: .23, sweep: .72, lowpassHz: 5200 },
        { frequency: 520, duration: .07, type: 'sine', gain: .2, sweep: 1.28, delay: .018, lowpassHz: 3200 },
      ],
      masterGain: .16,
    },
    vent: {
      start: [
        { frequency: 1160, duration: .15, type: 'sine', gain: .22, sweep: .56, lowpassHz: 5200 },
        { frequency: 240, duration: .14, type: 'triangle', gain: .28, sweep: .74, delay: .02, lowpassHz: 1900 },
      ],
      complete: [{ frequency: 860, duration: .075, type: 'sine', gain: .22, sweep: 1.18, lowpassHz: 4200 }],
      masterGain: .15,
    },
  },
};

export const classSkillAudioProfiles: Record<SkillAudioClass, readonly [SkillAudioProfile, SkillAudioProfile, SkillAudioProfile]> = {
  vanguard: [
    { layers: [{ frequency: 164, duration: .11, type: 'square', gain: .42, sweep: .58, lowpassHz: 1700 }, { frequency: 520, duration: .07, type: 'triangle', gain: .24, sweep: .7, delay: .016, lowpassHz: 3000 }], masterGain: .2, priority: 'important' },
    { layers: [{ frequency: 118, duration: .15, type: 'sawtooth', gain: .45, sweep: .52, lowpassHz: 1350 }, { frequency: 390, duration: .1, type: 'square', gain: .26, sweep: .66, delay: .022, lowpassHz: 2400 }], masterGain: .21, priority: 'important' },
    { layers: [{ frequency: 210, duration: .13, type: 'triangle', gain: .4, sweep: .64, lowpassHz: 1900 }, { frequency: 680, duration: .09, type: 'square', gain: .22, sweep: 1.18, delay: .02, lowpassHz: 3600 }], masterGain: .2, priority: 'important' },
  ],
  vector: [
    { layers: [{ frequency: 880, duration: .1, type: 'sine', gain: .3, sweep: 1.42, lowpassHz: 5200 }, { frequency: 1760, duration: .08, type: 'triangle', gain: .2, sweep: .7, delay: .018, lowpassHz: 6800 }], masterGain: .18, priority: 'important' },
    { layers: [{ frequency: 620, duration: .13, type: 'triangle', gain: .32, sweep: 1.68, lowpassHz: 4600 }, { frequency: 1420, duration: .11, type: 'sine', gain: .22, sweep: .58, delay: .022, lowpassHz: 6400 }], masterGain: .19, priority: 'important' },
    { layers: [{ frequency: 1040, duration: .12, type: 'sine', gain: .3, sweep: .62, lowpassHz: 5600 }, { frequency: 260, duration: .14, type: 'triangle', gain: .26, sweep: 1.3, delay: .018, lowpassHz: 2200 }], masterGain: .19, priority: 'important' },
  ],
  systems: [
    { layers: [{ frequency: 460, duration: .09, type: 'square', gain: .28, sweep: 1.52, lowpassHz: 4200 }, { frequency: 980, duration: .07, type: 'sine', gain: .22, sweep: .74, delay: .018, lowpassHz: 5600 }], masterGain: .18, priority: 'important' },
    { layers: [{ frequency: 340, duration: .11, type: 'triangle', gain: .3, sweep: .74, lowpassHz: 3200 }, { frequency: 1260, duration: .09, type: 'square', gain: .2, sweep: 1.34, delay: .02, lowpassHz: 6200 }], masterGain: .18, priority: 'important' },
    { layers: [{ frequency: 720, duration: .12, type: 'sine', gain: .28, sweep: 1.26, lowpassHz: 4800 }, { frequency: 1480, duration: .08, type: 'triangle', gain: .2, sweep: .66, delay: .024, lowpassHz: 6800 }], masterGain: .19, priority: 'important' },
  ],
};

export const threatAudioProfiles: Record<ThreatAudioCue, ThreatAudioProfile> = {
  'enemy-telegraph': {
    layers: [{ frequency: 310, duration: .09, type: 'square', gain: .3, sweep: .72, lowpassHz: 2800 }],
    masterGain: .15,
    priority: 'important',
  },
  'elite-telegraph': {
    layers: [{ frequency: 250, duration: .12, type: 'square', gain: .34, sweep: .66, lowpassHz: 2400 }, { frequency: 720, duration: .08, type: 'triangle', gain: .2, sweep: .78, delay: .018, lowpassHz: 4200 }],
    masterGain: .18,
    priority: 'important',
  },
  'boss-telegraph': {
    layers: [{ frequency: 184, duration: .17, type: 'sawtooth', gain: .42, sweep: .58, lowpassHz: 1900 }, { frequency: 520, duration: .13, type: 'square', gain: .26, sweep: .72, delay: .024, lowpassHz: 3200 }, { frequency: 1040, duration: .08, type: 'triangle', gain: .17, sweep: .64, delay: .045, lowpassHz: 5000 }],
    masterGain: .2,
    priority: 'critical',
  },
  'boss-phase': {
    layers: [{ frequency: 96, duration: .24, type: 'sawtooth', gain: .48, sweep: .52, lowpassHz: 1250 }, { frequency: 360, duration: .18, type: 'square', gain: .3, sweep: 1.18, delay: .035, lowpassHz: 2600 }, { frequency: 880, duration: .12, type: 'triangle', gain: .2, sweep: .7, delay: .07, lowpassHz: 4800 }],
    masterGain: .22,
    priority: 'critical',
  },
  'enemy-spawn': {
    layers: [{ frequency: 220, duration: .11, type: 'triangle', gain: .3, sweep: 1.48, lowpassHz: 2400 }, { frequency: 660, duration: .08, type: 'sine', gain: .16, sweep: 1.2, delay: .026, lowpassHz: 4200 }],
    masterGain: .13,
    priority: 'important',
  },
  'elite-spawn': {
    layers: [{ frequency: 154, duration: .16, type: 'sawtooth', gain: .34, sweep: 1.38, lowpassHz: 1900 }, { frequency: 520, duration: .11, type: 'triangle', gain: .2, sweep: 1.28, delay: .03, lowpassHz: 3600 }],
    masterGain: .17,
    priority: 'important',
  },
  'boss-spawn': {
    layers: [{ frequency: 82, duration: .28, type: 'sawtooth', gain: .48, sweep: 1.32, lowpassHz: 1200 }, { frequency: 246, duration: .2, type: 'square', gain: .28, sweep: 1.18, delay: .04, lowpassHz: 2300 }, { frequency: 740, duration: .13, type: 'triangle', gain: .17, sweep: .88, delay: .08, lowpassHz: 4300 }],
    masterGain: .21,
    priority: 'critical',
  },
  'danger-ready': {
    layers: [{ frequency: 132, duration: .2, type: 'square', gain: .4, sweep: 1.42, lowpassHz: 1700 }, { frequency: 396, duration: .13, type: 'sawtooth', gain: .24, sweep: .76, delay: .035, lowpassHz: 2900 }, { frequency: 940, duration: .08, type: 'triangle', gain: .16, sweep: .64, delay: .07, lowpassHz: 4700 }],
    masterGain: .19,
    priority: 'critical',
  },
  'enemy-disable': {
    layers: [{ frequency: 260, duration: .12, type: 'triangle', gain: .28, sweep: .48, lowpassHz: 2100 }, { frequency: 110, duration: .18, type: 'sine', gain: .24, sweep: .62, delay: .03, lowpassHz: 1000 }],
    masterGain: .12,
    priority: 'important',
  },
  'boss-disable': {
    layers: [{ frequency: 118, duration: .26, type: 'sawtooth', gain: .42, sweep: .42, lowpassHz: 1300 }, { frequency: 55, duration: .34, type: 'sine', gain: .34, sweep: .58, delay: .04, lowpassHz: 760 }, { frequency: 420, duration: .12, type: 'triangle', gain: .17, sweep: .5, delay: .08, lowpassHz: 2600 }],
    masterGain: .2,
    priority: 'critical',
  },
};

export const enemyMutationAudioProfiles: Record<EnemyMutationAudioCue, EnemyMutationAudioProfile> = {
  'reinforced-core': {
    layers: [
      { frequency: 92, duration: .32, type: 'sine', gain: .34, sweep: .94, attack: .05, lowpassHz: 820 },
      { frequency: 184, duration: .2, type: 'triangle', gain: .18, sweep: .82, delay: .035, lowpassHz: 1250 },
    ],
    masterGain: .075,
    priority: 'background',
  },
  'ablative-mantle': {
    layers: [
      { frequency: 720, duration: .055, type: 'triangle', gain: .28, sweep: .68, lowpassHz: 3100 },
      { frequency: 1180, duration: .045, type: 'square', gain: .16, sweep: .72, delay: .028, lowpassHz: 4200 },
      { frequency: 430, duration: .08, type: 'triangle', gain: .2, sweep: .62, delay: .054, lowpassHz: 2400 },
    ],
    masterGain: .068,
    priority: 'background',
  },
  'hunter-servo': {
    layers: [
      { frequency: 520, duration: .16, type: 'sine', gain: .26, sweep: 1.62, attack: .018, lowpassHz: 3800 },
      { frequency: 1040, duration: .1, type: 'triangle', gain: .16, sweep: .78, delay: .025, lowpassHz: 5200 },
    ],
    masterGain: .072,
    priority: 'background',
  },
  'redline-bus': {
    layers: [
      { frequency: 146, duration: .22, type: 'sawtooth', gain: .28, sweep: 1.5, attack: .025, lowpassHz: 2100 },
      { frequency: 584, duration: .12, type: 'triangle', gain: .18, sweep: 1.22, delay: .03, lowpassHz: 3600 },
      { frequency: 292, duration: .16, type: 'square', gain: .12, sweep: .82, delay: .065, lowpassHz: 2600 },
    ],
    masterGain: .074,
    priority: 'background',
  },
  'countermass-rig': {
    layers: [
      { frequency: 74, duration: .34, type: 'sine', gain: .38, sweep: .92, attack: .045, lowpassHz: 760 },
      { frequency: 222, duration: .22, type: 'triangle', gain: .2, sweep: .78, delay: .04, lowpassHz: 1450 },
    ],
    masterGain: .078,
    priority: 'background',
  },
  'relay-reflex': {
    layers: [
      { frequency: 1320, duration: .038, type: 'square', gain: .2, sweep: 1.32, lowpassHz: 5400 },
      { frequency: 1760, duration: .032, type: 'triangle', gain: .16, sweep: .72, delay: .035, lowpassHz: 6800 },
      { frequency: 880, duration: .052, type: 'sine', gain: .14, sweep: 1.44, delay: .07, lowpassHz: 4700 },
    ],
    masterGain: .064,
    priority: 'background',
  },
};

export const enemyStatusAudioProfiles: Record<EnemyStatusAudioCue, StatusAudioProfile> = {
  armorBreach: {
    layers: [{ frequency: 410, duration: .07, type: 'square', gain: .28, sweep: .54, lowpassHz: 2500 }, { frequency: 1180, duration: .04, type: 'triangle', gain: .16, sweep: .64, delay: .018, lowpassHz: 4300 }],
    masterGain: .09,
    priority: 'normal',
  },
  disrupted: {
    layers: [{ frequency: 920, duration: .07, type: 'square', gain: .22, sweep: 1.7, lowpassHz: 5200 }, { frequency: 1480, duration: .045, type: 'triangle', gain: .16, sweep: .55, delay: .026, lowpassHz: 6500 }],
    masterGain: .085,
    priority: 'important',
  },
  marked: {
    layers: [{ frequency: 760, duration: .045, type: 'sine', gain: .2, sweep: 1.34, lowpassHz: 4900 }, { frequency: 1140, duration: .032, type: 'triangle', gain: .14, sweep: .82, delay: .035, lowpassHz: 6200 }],
    masterGain: .07,
    priority: 'background',
  },
  stagger: {
    layers: [{ frequency: 122, duration: .09, type: 'square', gain: .35, sweep: .58, lowpassHz: 1400 }, { frequency: 360, duration: .06, type: 'triangle', gain: .2, sweep: .66, delay: .014, lowpassHz: 2500 }],
    masterGain: .1,
    priority: 'important',
  },
  conductive: {
    layers: [{ frequency: 1280, duration: .06, type: 'square', gain: .22, sweep: 1.45, lowpassHz: 6100 }, { frequency: 640, duration: .08, type: 'sine', gain: .18, sweep: .72, delay: .022, lowpassHz: 4200 }],
    masterGain: .078,
    priority: 'normal',
  },
  vacuum: {
    layers: [{ frequency: 220, duration: .16, type: 'sine', gain: .2, sweep: .58, lowpassHz: 1800 }, { frequency: 1280, duration: .09, type: 'triangle', gain: .12, sweep: .72, delay: .03, lowpassHz: 4500 }],
    masterGain: .07,
    priority: 'normal',
  },
};

export const playerStatusAudioProfiles: Record<PlayerStatusAudioCue, StatusAudioProfile> = {
  thermal: {
    layers: [{ frequency: 180, duration: .15, type: 'sawtooth', gain: .24, sweep: 1.32, lowpassHz: 2200 }, { frequency: 720, duration: .08, type: 'triangle', gain: .14, sweep: .72, delay: .025, lowpassHz: 3900 }],
    masterGain: .085,
    priority: 'normal',
  },
  disrupted: {
    layers: [{ frequency: 1020, duration: .08, type: 'square', gain: .24, sweep: 1.62, lowpassHz: 5600 }, { frequency: 360, duration: .1, type: 'triangle', gain: .16, sweep: .58, delay: .02, lowpassHz: 2800 }],
    masterGain: .095,
    priority: 'important',
  },
  'pressure-loss': {
    layers: [{ frequency: 320, duration: .18, type: 'sine', gain: .2, sweep: .62, lowpassHz: 2100 }, { frequency: 980, duration: .08, type: 'triangle', gain: .12, sweep: .76, delay: .04, lowpassHz: 4300 }],
    masterGain: .075,
    priority: 'normal',
  },
  vacuum: {
    layers: [{ frequency: 148, duration: .22, type: 'sine', gain: .24, sweep: .52, lowpassHz: 1300 }, { frequency: 620, duration: .11, type: 'triangle', gain: .12, sweep: .68, delay: .035, lowpassHz: 3100 }],
    masterGain: .085,
    priority: 'important',
  },
};

const tones: Record<UtilityCue, Tone> = {
  ui: { frequency: 460, duration: .045, type: 'sine' },
  loot: { frequency: 620, duration: .11, type: 'sine', sweep: 1.18 },
  rareLoot: { frequency: 760, duration: .2, type: 'sine', sweep: 1.45 },
  reload: { frequency: 250, duration: .055, type: 'triangle' },
  impact: { frequency: 130, duration: .035, type: 'square', sweep: .72 },
  armor: { frequency: 540, duration: .055, type: 'triangle', sweep: .86 },
  damage: { frequency: 90, duration: .08, type: 'sawtooth', sweep: .65 },
  ability: { frequency: 690, duration: .13, type: 'sine', sweep: 1.32 },
  dodge: { frequency: 390, duration: .055, type: 'triangle', sweep: 1.2 },
  breach: { frequency: 70, duration: .18, type: 'sawtooth', sweep: .62 },
  gravity: { frequency: 145, duration: .15, type: 'sine', sweep: .72 },
  enemy: { frequency: 220, duration: .075, type: 'square', sweep: .82 },
  machinery: { frequency: 280, duration: .09, type: 'triangle', sweep: .9 },
  targetLock: { frequency: 520, duration: .065, type: 'triangle', sweep: 1.16 },
};

export const weaponAudioProfiles: Record<WeaponCue, WeaponAudioProfile> = {
  carbine: {
    mechanical: [
      { frequency: 1320, duration: .018, type: 'square', gain: .18, sweep: .76, lowpassHz: 4200 },
      { frequency: 760, duration: .026, type: 'triangle', gain: .12, sweep: .68, delay: .009, lowpassHz: 3200 },
    ],
    discharge: [
      { frequency: 210, duration: .045, type: 'square', gain: .48, sweep: .68, lowpassHz: 2100 },
      { frequency: 420, duration: .032, type: 'triangle', gain: .2, sweep: .74, lowpassHz: 3000 },
    ],
    tails: {
      near: { frequency: 145, duration: .075, type: 'sawtooth', gain: .2, sweep: .58, delay: .012, lowpassHz: 1500 },
      mid: { frequency: 104, duration: .13, type: 'sine', gain: .13, sweep: .7, delay: .034, lowpassHz: 980 },
      far: { frequency: 74, duration: .2, type: 'sine', gain: .075, sweep: .82, delay: .072, lowpassHz: 680 },
    },
    tailCadence: { near: 1, mid: 2, far: 4 },
    repeat: { pitchCents: 22, gainVariance: .045 },
    masterGain: .23,
  },
  breacher: {
    mechanical: [
      { frequency: 620, duration: .032, type: 'square', gain: .2, sweep: .7, lowpassHz: 2600 },
      { frequency: 360, duration: .052, type: 'triangle', gain: .16, sweep: .56, delay: .016, lowpassHz: 1900 },
    ],
    discharge: [
      { frequency: 92, duration: .105, type: 'sawtooth', gain: .68, sweep: .52, lowpassHz: 1250 },
      { frequency: 178, duration: .072, type: 'square', gain: .31, sweep: .61, lowpassHz: 1750 },
    ],
    tails: {
      near: { frequency: 78, duration: .14, type: 'sawtooth', gain: .3, sweep: .54, delay: .018, lowpassHz: 1000 },
      mid: { frequency: 62, duration: .24, type: 'sine', gain: .2, sweep: .7, delay: .052, lowpassHz: 720 },
      far: { frequency: 48, duration: .36, type: 'sine', gain: .12, sweep: .86, delay: .11, lowpassHz: 520 },
    },
    tailCadence: { near: 1, mid: 1, far: 1 },
    repeat: { pitchCents: 16, gainVariance: .04 },
    masterGain: .27,
  },
  rail: {
    mechanical: [
      { frequency: 1080, duration: .028, type: 'triangle', gain: .16, sweep: .82, lowpassHz: 4200 },
      { frequency: 690, duration: .05, type: 'square', gain: .11, sweep: 1.18, delay: .014, lowpassHz: 3600 },
    ],
    discharge: [
      { frequency: 520, duration: .105, type: 'sawtooth', gain: .45, sweep: .46, lowpassHz: 3300 },
      { frequency: 152, duration: .13, type: 'sine', gain: .38, sweep: 1.82, attack: .006, lowpassHz: 2200 },
    ],
    tails: {
      near: { frequency: 315, duration: .13, type: 'triangle', gain: .22, sweep: .62, delay: .02, lowpassHz: 2600 },
      mid: { frequency: 210, duration: .23, type: 'sine', gain: .15, sweep: .74, delay: .058, lowpassHz: 1600 },
      far: { frequency: 132, duration: .34, type: 'sine', gain: .095, sweep: .9, delay: .12, lowpassHz: 980 },
    },
    tailCadence: { near: 1, mid: 1, far: 1 },
    repeat: { pitchCents: 12, gainVariance: .035 },
    masterGain: .25,
  },
};

const repeatSequence = [-1, -.42, .18, .72, -.68, .37, .91, -.16] as const;
const weaponOffsets: Record<WeaponCue, number> = { carbine: 0, breacher: 3, rail: 5 };

export function weaponRepeatVariation(cue: WeaponCue, shotIndex: number) {
  const profile = weaponAudioProfiles[cue];
  const index = Math.max(0, Math.floor(shotIndex));
  const pitchUnit = repeatSequence[(index + weaponOffsets[cue]) % repeatSequence.length]!;
  const gainUnit = repeatSequence[(index * 3 + weaponOffsets[cue] + 2) % repeatSequence.length]!;
  return {
    pitchCents: pitchUnit * profile.repeat.pitchCents,
    gainMultiplier: 1 + gainUnit * profile.repeat.gainVariance,
  };
}

export function weaponVariantAudioTuning(id: WeaponVariantId | null | undefined) {
  const presentation = weaponVariantPresentation(id);
  return {
    pitchCents: presentation?.audioPitchCents ?? 0,
    gainMultiplier: presentation?.audioGainMul ?? 1,
    mechanicalGainMultiplier: presentation?.mechanicalGainMul ?? 1,
    tailGainMultiplier: presentation?.tailGainMul ?? 1,
  };
}

function isWeaponCue(cue: FeedbackCue): cue is WeaponCue {
  return cue === 'carbine' || cue === 'breacher' || cue === 'rail';
}

class FeedbackBus {
  private context: AudioContext | null = null;
  private output: DynamicsCompressorNode | null = null;
  private buses: Partial<Record<AudioBusName, GainNode>> = {};
  private activeVoices = 0;
  private activeTailVoices = 0;
  private virtualizedVoices = 0;
  private virtualizedTailVoices = 0;
  private lastVirtualizationReason: CombatAudioVoiceAdmission['reason'] = 'available';
  private mixPriority: CombatAudioPriority = 'normal';
  private mixPriorityUntil = 0;
  private settings: ProfileSettings | null = null;
  private environment: AudioEnvironment = { space: 'interior', pressure: 'normal' };
  private weaponShotIndex: Record<WeaponCue, number> = { carbine: 0, breacher: 0, rail: 0 };

  configure(settings: ProfileSettings) { this.settings = settings; }
  setEnvironment(environment: AudioEnvironment) { this.environment = environment; }

  unlock() {
    if (typeof window === 'undefined') return;
    try {
      if (!this.context) {
        this.context = new AudioContext({ latencyHint: 'interactive' });
        this.output = this.context.createDynamicsCompressor();
        this.output.threshold.setValueAtTime(-12, this.context.currentTime);
        this.output.knee.setValueAtTime(12, this.context.currentTime);
        this.output.ratio.setValueAtTime(4, this.context.currentTime);
        this.output.attack.setValueAtTime(.003, this.context.currentTime);
        this.output.release.setValueAtTime(.12, this.context.currentTime);
        this.output.connect(this.context.destination);
        for (const name of ['ui', 'weapon', 'impact', 'foley', 'skill', 'threat', 'utility'] as AudioBusName[]) {
          const bus = this.context.createGain();
          bus.gain.value = 1;
          bus.connect(this.output);
          this.buses[name] = bus;
        }
      }
      if (this.context.state === 'suspended') void this.context.resume();
    } catch {
      this.output = null;
      this.buses = {};
      this.activeVoices = 0;
      this.activeTailVoices = 0;
      this.context = null;
    }
  }

  private applyPriorityMix(priority: CombatAudioPriority) {
    const context = this.context;
    if (!context || context.state !== 'running' || priority === 'background' || priority === 'normal') return;
    const rank: Record<CombatAudioPriority, number> = { background: 0, normal: 1, important: 2, critical: 3 };
    const now = context.currentTime;
    if (now < this.mixPriorityUntil && rank[priority] < rank[this.mixPriority]) return;
    const profile = combatMixProfiles[priority];
    this.mixPriority = priority;
    this.mixPriorityUntil = now + profile.holdSeconds;
    for (const [name, target] of Object.entries(profile.busGain) as [AudioBusName, number][]) {
      const bus = this.buses[name];
      if (!bus) continue;
      bus.gain.cancelScheduledValues(now);
      bus.gain.setTargetAtTime(target, now, .008);
      bus.gain.setTargetAtTime(1, now + profile.holdSeconds, .075);
    }
  }

  private haptic(cue: FeedbackCue, intensity = 1) {
    if (!this.settings?.haptics || typeof navigator === 'undefined') return;
    const accessibilityScale = this.settings.effectIntensity === 'reduced' ? .55 : 1;
    const hapticScale = Math.max(0, Math.min(1, intensity)) * accessibilityScale;
    if (hapticScale <= 0) return;
    const vibration = cue === 'rail' ? 18
      : cue === 'breacher' ? 12
      : cue === 'carbine' ? 4
      : cue === 'impact' ? 10
      : cue === 'damage' ? 12
      : cue === 'dodge' ? 7
      : cue === 'breach' ? [18, 28, 22]
      : cue === 'rareLoot' ? [8, 18, 12]
      : cue === 'loot' ? 5
      : cue === 'machinery' ? 6
      : cue === 'targetLock' ? 8
      : 0;
    const scaledVibration = Array.isArray(vibration)
      ? vibration.map(value => Math.max(1, Math.round(value * hapticScale)))
      : Math.max(0, Math.round(vibration * hapticScale));
    if (scaledVibration && typeof navigator.vibrate === 'function') navigator.vibrate(scaledVibration);

    const gamepad = typeof navigator.getGamepads === 'function' ? [...navigator.getGamepads()].find(Boolean) : null;
    const actuator = gamepad ? (gamepad as Gamepad & { vibrationActuator?: { playEffect?: (type: string, params: { duration: number; startDelay: number; strongMagnitude: number; weakMagnitude: number }) => Promise<unknown> } }).vibrationActuator : undefined;
    if (!actuator?.playEffect || !vibration) return;
    const durationBase = Array.isArray(vibration) ? vibration.reduce((total, value) => total + value, 0) : vibration;
    const duration = Math.max(1, Math.round(durationBase * hapticScale));
    const strongBase = cue === 'breacher' ? .58 : cue === 'rail' ? .5 : cue === 'breach' || cue === 'damage' ? .46 : cue === 'impact' ? .34 : cue === 'carbine' ? .12 : cue === 'targetLock' ? .12 : .24;
    const weakBase = cue === 'carbine' ? .22 : cue === 'rail' ? .34 : cue === 'impact' ? .38 : cue === 'targetLock' ? .28 : .42;
    void actuator.playEffect('dual-rumble', { duration, startDelay: 0, strongMagnitude: strongBase * hapticScale, weakMagnitude: weakBase * hapticScale }).catch(() => undefined);
  }

  private playLayer(layer: WeaponAudioLayer, volume: number, pitchCents = 0, gainMultiplier = 1, role: 'direct' | 'tail' = 'direct', applyAcoustics = true, busName: AudioBusName = 'utility', priority: CombatAudioPriority = 'normal') {
    const context = this.context;
    if (!context || context.state !== 'running') return;
    const admission = combatAudioVoiceAdmission(this.activeVoices, this.activeTailVoices, role, priority);
    if (!admission.admitted) {
      this.virtualizedVoices += 1;
      if (role === 'tail') this.virtualizedTailVoices += 1;
      this.lastVirtualizationReason = admission.reason;
      return;
    }

    const treatment = applyAcoustics ? acousticTreatmentFor(this.environment) : null;
    const environmentalDelay = treatment && role === 'tail' ? treatment.tailDelay : 0;
    const start = context.currentTime + (layer.delay ?? 0) + environmentalDelay;
    const end = start + layer.duration;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const lowpassHz = Math.min(layer.lowpassHz ?? 24000, treatment?.lowpassHz ?? 24000);
    const filter = lowpassHz < 22000 ? context.createBiquadFilter() : null;

    oscillator.type = layer.type;
    oscillator.frequency.setValueAtTime(layer.frequency, start);
    oscillator.detune.setValueAtTime(pitchCents, start);
    if (layer.sweep) oscillator.frequency.exponentialRampToValueAtTime(Math.max(36, layer.frequency * layer.sweep), end);

    const acousticGain = treatment ? (role === 'tail' ? treatment.tailGain : treatment.gain) : 1;
    const peak = Math.max(.0001, volume * layer.gain * gainMultiplier * acousticGain);
    const attack = Math.min(layer.duration * .35, Math.max(0, layer.attack ?? 0));
    if (attack > 0) {
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + attack);
    } else {
      gain.gain.setValueAtTime(peak, start);
    }
    gain.gain.exponentialRampToValueAtTime(.0001, end);

    if (filter) {
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(lowpassHz, start);
      oscillator.connect(filter).connect(gain);
    } else {
      oscillator.connect(gain);
    }
    gain.connect(this.buses[busName] ?? this.output ?? context.destination);
    this.activeVoices += 1;
    if (role === 'tail') this.activeTailVoices += 1;

    oscillator.addEventListener('ended', () => {
      oscillator.disconnect();
      filter?.disconnect();
      gain.disconnect();
      this.activeVoices = Math.max(0, this.activeVoices - 1);
      if (role === 'tail') this.activeTailVoices = Math.max(0, this.activeTailVoices - 1);
    }, { once: true });
    oscillator.start(start);
    oscillator.stop(end + .01);
  }

  private playTone(cue: UtilityCue, volume: number, applyAcoustics: boolean) {
    const tone = tones[cue];
    this.playLayer({ ...tone, gain: 1 }, volume, 0, 1, 'direct', applyAcoustics, applyAcoustics ? 'utility' : 'ui');
  }

  private playWeapon(cue: WeaponCue, volume: number, variantId?: WeaponVariantId | null) {
    const profile = weaponAudioProfiles[cue];
    const shotIndex = this.weaponShotIndex[cue]++;
    const variation = weaponRepeatVariation(cue, shotIndex);
    const variant = weaponVariantAudioTuning(variantId);
    const weaponVolume = volume * profile.masterGain * variant.gainMultiplier;
    const pitchCents = variation.pitchCents + variant.pitchCents;

    for (const layer of profile.mechanical) {
      this.playLayer(layer, weaponVolume * variant.mechanicalGainMultiplier, pitchCents * .65, variation.gainMultiplier, 'direct', true, 'weapon');
    }
    for (const layer of profile.discharge) this.playLayer(layer, weaponVolume, pitchCents, variation.gainMultiplier, 'direct', true, 'weapon');

    for (const distance of ['near', 'mid', 'far'] as const) {
      if (shotIndex % profile.tailCadence[distance] !== 0) continue;
      this.playLayer(profile.tails[distance], weaponVolume * variant.tailGainMultiplier, pitchCents * .45, variation.gainMultiplier, 'tail', true, 'weapon', 'background');
    }
  }

  impact(surface: ImpactSurface, heavy = false) {
    const settings = this.settings;
    if (!settings) return;
    this.haptic('impact', heavy ? 1 : .55);
    const volume = Math.max(0, Math.min(1, settings.effectsVolume));
    if (volume <= 0) return;
    this.unlock();
    const profile = impactAudioProfiles[surface];
    const weight = heavy ? 1.15 : 1;
    profile.layers.forEach((layer, index) => {
      const role = index === profile.layers.length - 1 ? 'tail' : 'direct';
      this.playLayer(layer, volume * profile.masterGain * weight, heavy ? -10 : 0, 1, role, true, 'impact');
    });
  }

  foley(action: FoleyAudioAction, weapon: WeaponCue, phase: FoleyAudioPhase = 'start') {
    const settings = this.settings;
    if (!settings) return;
    const volume = Math.max(0, Math.min(1, settings.effectsVolume));
    if (volume <= 0) return;
    this.unlock();
    const profile = foleyAudioProfiles[weapon][action];
    const priority: CombatAudioPriority = action === 'vent' && phase === 'start' ? 'important' : 'normal';
    if (priority === 'important') this.applyPriorityMix(priority);
    for (const layer of profile[phase]) this.playLayer(layer, volume * profile.masterGain, 0, 1, 'direct', true, 'foley', priority);
  }

  skill(operatorClass: SkillAudioClass, index: number) {
    const settings = this.settings;
    if (!settings) return;
    const profile = classSkillAudioProfiles[operatorClass][Math.max(0, Math.min(2, Math.floor(index)))]!;
    const volume = Math.max(0, Math.min(1, settings.effectsVolume));
    if (volume <= 0) return;
    this.unlock();
    this.applyPriorityMix(profile.priority);
    for (const layer of profile.layers) this.playLayer(layer, volume * profile.masterGain, 0, 1, 'direct', true, 'skill', profile.priority);
  }

  threat(cue: ThreatAudioCue) {
    const settings = this.settings;
    if (!settings) return;
    const profile = threatAudioProfiles[cue];
    const volume = Math.max(0, Math.min(1, settings.effectsVolume));
    if (volume <= 0) return;
    this.unlock();
    this.applyPriorityMix(profile.priority);
    for (const layer of profile.layers) this.playLayer(layer, volume * profile.masterGain, 0, 1, 'direct', true, 'threat', profile.priority);
  }

  mutation(cue: EnemyMutationAudioCue) {
    const settings = this.settings;
    if (!settings) return;
    const volume = Math.max(0, Math.min(1, settings.effectsVolume));
    if (volume <= 0) return;
    this.unlock();
    const profile = enemyMutationAudioProfiles[cue];
    for (const layer of profile.layers) {
      this.playLayer(layer, volume * profile.masterGain, 0, 1, 'direct', true, 'utility', profile.priority);
    }
  }

  status(cue: EnemyStatusAudioCue) {
    const settings = this.settings;
    if (!settings) return;
    const volume = Math.max(0, Math.min(1, settings.effectsVolume));
    if (volume <= 0) return;
    this.unlock();
    const profile = enemyStatusAudioProfiles[cue];
    this.applyPriorityMix(profile.priority);
    for (const layer of profile.layers) this.playLayer(layer, volume * profile.masterGain, 0, 1, 'direct', true, 'utility', profile.priority);
  }

  playerStatus(cue: PlayerStatusAudioCue) {
    const settings = this.settings;
    if (!settings) return;
    const volume = Math.max(0, Math.min(1, settings.effectsVolume));
    if (volume <= 0) return;
    this.unlock();
    const profile = playerStatusAudioProfiles[cue];
    this.applyPriorityMix(profile.priority);
    for (const layer of profile.layers) this.playLayer(layer, volume * profile.masterGain, 0, 1, 'direct', true, 'utility', profile.priority);
  }

  performanceStats() {
    return {
      activeVoices: this.activeVoices,
      activeTailVoices: this.activeTailVoices,
      virtualizedVoices: this.virtualizedVoices,
      virtualizedTailVoices: this.virtualizedTailVoices,
      lastVirtualizationReason: this.lastVirtualizationReason,
    };
  }

  cue(cue: FeedbackCue, variantId?: WeaponVariantId | null) {
    const settings = this.settings;
    if (!settings) return;
    const uiCue = cue === 'ui' || cue === 'loot' || cue === 'rareLoot';
    const master = uiCue ? settings.uiVolume : settings.effectsVolume;
    const volume = Math.max(0, Math.min(1, master));
    this.haptic(cue);
    if (volume <= 0) return;
    this.unlock();
    if (isWeaponCue(cue)) {
      this.playWeapon(cue, volume, variantId);
      return;
    }
    const scale = cue === 'rareLoot' ? .26 : cue === 'breach' ? .2 : cue === 'damage' || cue === 'machinery' ? .16 : cue === 'targetLock' ? .1 : .12;
    this.playTone(cue, volume * scale, !uiCue);
  }
}

export const feedback = new FeedbackBus();
