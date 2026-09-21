import type { ProfileSettings } from './meta';

export type FeedbackCue =
  | 'ui' | 'loot' | 'rareLoot' | 'carbine' | 'breacher' | 'rail' | 'reload'
  | 'impact' | 'armor' | 'damage' | 'ability' | 'dodge' | 'breach' | 'gravity'
  | 'enemy' | 'machinery';

type Tone = { frequency: number; duration: number; type: OscillatorType; sweep?: number };
const tones: Record<FeedbackCue, Tone> = {
  ui: { frequency: 460, duration: .045, type: 'sine' },
  loot: { frequency: 620, duration: .11, type: 'sine', sweep: 1.18 },
  rareLoot: { frequency: 760, duration: .2, type: 'sine', sweep: 1.45 },
  carbine: { frequency: 185, duration: .035, type: 'square', sweep: .78 },
  breacher: { frequency: 105, duration: .09, type: 'sawtooth', sweep: .62 },
  rail: { frequency: 310, duration: .12, type: 'sawtooth', sweep: 1.45 },
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
};

class FeedbackBus {
  private context: AudioContext | null = null;
  private settings: ProfileSettings | null = null;

  configure(settings: ProfileSettings) { this.settings = settings; }

  unlock() {
    if (typeof window === 'undefined') return;
    try {
      if (!this.context) this.context = new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume();
    } catch { this.context = null; }
  }

  private haptic(cue: FeedbackCue) {
    if (!this.settings?.haptics || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    if (cue === 'rail') navigator.vibrate(18);
    else if (cue === 'breacher') navigator.vibrate(10);
    else if (cue === 'damage') navigator.vibrate(12);
    else if (cue === 'dodge') navigator.vibrate(7);
    else if (cue === 'breach') navigator.vibrate([18, 28, 22]);
    else if (cue === 'rareLoot') navigator.vibrate([8, 18, 12]);
    else if (cue === 'loot') navigator.vibrate(5);
    else if (cue === 'machinery') navigator.vibrate(6);
  }

  private play(cue: FeedbackCue, volume: number) {
    const context = this.context;
    if (!context || context.state !== 'running') return;
    const tone = tones[cue];
    const start = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = tone.type;
    oscillator.frequency.setValueAtTime(tone.frequency, start);
    if (tone.sweep) oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, tone.frequency * tone.sweep), start + tone.duration);
    gain.gain.setValueAtTime(Math.max(.0001, volume), start);
    gain.gain.exponentialRampToValueAtTime(.0001, start + tone.duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + tone.duration + .01);
  }

  cue(cue: FeedbackCue) {
    const settings = this.settings;
    if (!settings) return;
    const uiCue = cue === 'ui' || cue === 'loot' || cue === 'rareLoot';
    const master = uiCue ? settings.uiVolume : settings.effectsVolume;
    const volume = Math.max(0, Math.min(1, master));
    this.haptic(cue);
    if (volume <= 0) return;
    this.unlock();
    const scale = cue === 'rareLoot' ? .26 : cue === 'breacher' || cue === 'rail' || cue === 'breach' ? .2 : cue === 'damage' || cue === 'machinery' ? .16 : .12;
    this.play(cue, volume * scale);
  }
}

export const feedback = new FeedbackBus();
