import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { CombatCameraFeedbackRuntime } from '../src/game/combatCameraFeedback';

const runtime = new CombatCameraFeedbackRuntime();

const base = {
  time: 1,
  deltaSeconds: 1 / 60,
  weaponFlash: 0,
  weapon: 'carbine' as const,
  impactEvent: null,
  damageTaken: 0,
  screenShake: true,
  effectIntensity: 'full' as const,
};

let sample = runtime.sample(base);
assert.equal(sample.mode, 'full');
assert.equal(sample.magnitude, 0, 'idle combat should not move the camera');

sample = runtime.sample({ ...base, time: 1.02, weaponFlash: 0.07, weapon: 'rail' });
assert(sample.recoil > 0.99, 'rail firing should resolve the strongest normalized recoil impulse');
assert(sample.magnitude > 0.6, 'rail firing should produce a readable camera response');

const fullMagnitude = sample.magnitude;
sample = runtime.sample({ ...base, time: 1.04, weaponFlash: 0.07, weapon: 'rail', effectIntensity: 'reduced' });
assert.equal(sample.mode, 'reduced');
assert(sample.magnitude < fullMagnitude * 0.5, 'reduced effects must substantially scale camera motion');

sample = runtime.sample({ ...base, time: 1.06, weaponFlash: 0.07, weapon: 'rail', screenShake: false });
assert.equal(sample.mode, 'off');
assert.equal(sample.magnitude, 0, 'screen-shake accessibility toggle must fully disable combat camera motion');

runtime.reset();
sample = runtime.sample({
  ...base,
  time: 2,
  impactEvent: { serial: 1, target: 'enemy', surface: 'armor', heavy: true },
});
assert(sample.impact > 0.5, 'heavy impacts should add a distinct impact impulse');
assert(sample.magnitude > 0.2, 'heavy impacts should produce a visible response even without weapon flash');

sample = runtime.sample({
  ...base,
  time: 2.02,
  impactEvent: { serial: 1, target: 'enemy', surface: 'armor', heavy: true },
  damageTaken: 45,
});
assert(sample.damage > 0.5, 'new player damage should add a stronger camera impulse');
assert(sample.magnitude > 0.5, 'damage response should be stronger than a light ambient impact');

for (let i = 0; i < 120; i += 1) {
  sample = runtime.sample({
    ...base,
    time: 2.04 + i / 60,
    deltaSeconds: 1 / 60,
    impactEvent: { serial: 1, target: 'enemy', surface: 'armor', heavy: true },
    damageTaken: 45,
  });
}
assert(sample.impact < 0.01 && sample.damage < 0.01, 'impact and damage camera impulses must decay instead of becoming permanent');

const gameCanvasSource = readFileSync(resolve(process.cwd(), 'src/components/GameCanvas.tsx'), 'utf8');
const rendererSource = readFileSync(resolve(process.cwd(), 'src/game/threeCombatRenderer.ts'), 'utf8');
const feedbackSource = readFileSync(resolve(process.cwd(), 'src/game/feedback.ts'), 'utf8');
assert(gameCanvasSource.includes('cameraFeedbackRef.current.sample') && gameCanvasSource.includes('syncCombatFeedback(state'), 'combat loop must sample camera and audio/haptics from the same frame');
assert(gameCanvasSource.includes('firingIntent, cameraFeedback'), 'Three.js renderer must receive the shared combat-camera response');
assert(rendererSource.includes('cameraFeedback?.worldOffsetX') && rendererSource.includes('dataset.cameraFeedback'), 'Three.js camera must consume and expose shared combat feedback');
assert(feedbackSource.includes("this.haptic('impact', heavy ? 1 : .55)"), 'impact audio path must dispatch synchronized impact haptics');
console.log('COMBAT_FEEL_PASS recoil+impact+damage+haptics+accessibility');
