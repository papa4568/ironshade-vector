import type { ProfileSettings } from './meta';

export type FeedbackCue =
  | 'ui'
  | 'loot'
  | 'rareLoot'
  | 'carbine'
  | 'breacher'
  | 'rail'
  | 'reload'
  | 'impact'
  | 'armor'
  | 'damage'
  | 'ability'
  | 'dodge'
  | 'breach'
  | 'gravity'
  | 'enemy'
  | 'machinery';

const segments: Record<FeedbackCue, { offset: number; duration: number }> = {
  ui: { offset: 0.0, duration: 0.07 },
  loot: { offset: 0.105, duration: 0.24 },
  rareLoot: { offset: 0.105, duration: 0.24 },
  carbine: { offset: 0.38, duration: 0.075 },
  breacher: { offset: 0.49, duration: 0.18 },
  rail: { offset: 0.705, duration: 0.17 },
  reload: { offset: 0.91, duration: 0.16 },
  impact: { offset: 1.105, duration: 0.09 },
  armor: { offset: 1.23, duration: 0.11 },
  damage: { offset: 1.375, duration: 0.16 },
  ability: { offset: 1.57, duration: 0.22 },
  dodge: { offset: 1.825, duration: 0.11 },
  breach: { offset: 1.97, duration: 0.38 },
  gravity: { offset: 2.385, duration: 0.31 },
  enemy: { offset: 2.73, duration: 0.15 },
  machinery: { offset: 2.915, duration: 0.33 },
};

class FeedbackBus {
  private context: AudioContext | null = null;
  private settings: ProfileSettings | null = null;
  private sprite: AudioBuffer | null = null;
  private loading: Promise<void> | null = null;

  configure(settings: ProfileSettings) { this.settings = settings; }

  unlock() {
    if (typeof window === 'undefined') return;
    try {
      if (!this.context) { this.context = new AudioContext(); this.loading = this.loadSprite(); }
      if (this.context.state === 'suspended') void this.context.resume();
    } catch { this.context = null; this.loading = null; }
  }

  private async loadSprite() {
    const context = this.context;
    if (!context) return;
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}audio/ironshade-feedback.wav`);
      if (!response.ok) return;
      this.sprite = await context.decodeAudioData(await response.arrayBuffer());
    } catch { this.sprite = null; }
  }

  private playSample(cue: FeedbackCue, volume: number) {
    const context = this.context;
    if (!context || context.state !== 'running' || !this.sprite) return;
    const segment = segments[cue];
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = this.sprite;
    source.playbackRate.value = cue === 'rareLoot' ? 0.78 : cue === 'carbine' ? 0.985 + Math.random() * 0.03 : cue === 'impact' ? 0.96 + Math.random() * 0.08 : 1;
    gain.gain.value = volume;
    source.connect(gain).connect(context.destination);
    source.start(0, segment.offset, segment.duration);
  }

  private haptic(cue: FeedbackCue) {
    if (!this.settings?.haptics || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    if (cue === 'rail') navigator.vibrate(18);
    else if (cue === 'breacher') navigator.vibrate(10);
    else if (cue === 'damage') navigator.vibrate(12);
    else if (cue === 'dodge') navigator.vibrate(7);
    else if (cue === 'breach') navigator.vibrate([18, 28, 22]);
    else if (cue === 'machinery') navigator.vibrate(6);
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
    if (!this.sprite) { if (!this.loading) this.loading = this.loadSprite(); return; }
    const cueScale = cue === 'rareLoot' ? 0.68 : cue === 'breacher' || cue === 'rail' || cue === 'breach' ? 0.72 : cue === 'damage' || cue === 'machinery' ? 0.58 : 0.48;
    this.playSample(cue, volume * cueScale);
  }
}

export const feedback = new FeedbackBus();
