import { weaponHandlingProfiles, type ImpactEvent, type WeaponId } from './sim';
import type { EffectIntensity } from './meta';

export type CombatCameraFeedbackMode = 'off' | 'reduced' | 'full';

export type CombatCameraFeedbackInput = {
  time: number;
  deltaSeconds: number;
  weaponFlash: number;
  weapon: WeaponId;
  impactEvent: ImpactEvent | null;
  damageTaken: number;
  screenShake: boolean;
  effectIntensity: EffectIntensity;
};

export type CombatCameraFeedbackSample = {
  mode: CombatCameraFeedbackMode;
  recoil: number;
  impact: number;
  damage: number;
  magnitude: number;
  canvasOffsetX: number;
  canvasOffsetY: number;
  worldOffsetX: number;
  worldOffsetZ: number;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export class CombatCameraFeedbackRuntime {
  private lastImpactSerial = 0;
  private lastDamageTaken = 0;
  private impactKick = 0;
  private damageKick = 0;

  reset(input?: Pick<CombatCameraFeedbackInput, 'impactEvent' | 'damageTaken'>) {
    this.lastImpactSerial = input?.impactEvent?.serial ?? 0;
    this.lastDamageTaken = input?.damageTaken ?? 0;
    this.impactKick = 0;
    this.damageKick = 0;
  }

  sample(input: CombatCameraFeedbackInput): CombatCameraFeedbackSample {
    const deltaSeconds = Math.max(0, Math.min(0.05, Number.isFinite(input.deltaSeconds) ? input.deltaSeconds : 0));
    const impactEvent = input.impactEvent;

    if (impactEvent && impactEvent.serial > this.lastImpactSerial) {
      this.impactKick = Math.max(this.impactKick, impactEvent.heavy ? 0.62 : impactEvent.target === 'object' ? 0.24 : 0.18);
      this.lastImpactSerial = impactEvent.serial;
    } else if (impactEvent) {
      this.lastImpactSerial = Math.max(this.lastImpactSerial, impactEvent.serial);
    }

    if (input.damageTaken > this.lastDamageTaken) {
      const delta = input.damageTaken - this.lastDamageTaken;
      this.damageKick = Math.max(this.damageKick, Math.min(1, 0.46 + delta / 90));
    }
    this.lastDamageTaken = input.damageTaken;

    this.impactKick = Math.max(0, this.impactKick - deltaSeconds * 4.8);
    this.damageKick = Math.max(0, this.damageKick - deltaSeconds * 3.9);

    const mode: CombatCameraFeedbackMode = !input.screenShake
      ? 'off'
      : input.effectIntensity === 'reduced'
        ? 'reduced'
        : 'full';
    const accessibilityScale = mode === 'off' ? 0 : mode === 'reduced' ? 0.42 : 1;
    const recoil = input.weaponFlash > 0
      ? clamp01(weaponHandlingProfiles[input.weapon].cameraKick / weaponHandlingProfiles.rail.cameraKick)
      : 0;
    const impact = clamp01(this.impactKick);
    const damage = clamp01(this.damageKick);
    const magnitude = accessibilityScale * Math.min(1.75, recoil * 0.72 + impact * 0.48 + damage * 0.82);

    const impactPhase = this.lastImpactSerial * 0.73;
    const phaseX = input.time * 103 + impactPhase;
    const phaseY = input.time * 83 + impactPhase * 1.37;
    const canvasOffsetX = Math.sin(phaseX) * magnitude * 3.6;
    const canvasOffsetY = Math.cos(phaseY) * magnitude * 3.1;

    return {
      mode,
      recoil,
      impact,
      damage,
      magnitude,
      canvasOffsetX,
      canvasOffsetY,
      worldOffsetX: canvasOffsetX * 0.045,
      worldOffsetZ: canvasOffsetY * 0.045,
    };
  }
}
