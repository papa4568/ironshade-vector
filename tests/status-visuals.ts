import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveEnemyPresentation, type EnemyPresentationInput } from '../src/game/enemyPresentation';
import {
  enemyStatusVisualIds,
  enemyStatusVisualSpecFor,
  playerStatusVisualIds,
  playerStatusVisualSpecFor,
  resolvePlayerStatusVisuals,
} from '../src/game/statusVisualLanguage';

const base = (): EnemyPresentationInput => ({
  role: 'elite',
  combatClass: 'enhanced',
  mutations: [],
  protocols: [],
  statuses: {
    armorBreach: 0,
    disrupted: 0,
    marked: 0,
    stagger: 0,
    conductive: 0,
    vacuum: 0,
  },
  telegraph: 0,
  protocolPulse: 0,
  bossPhase: 1,
  dead: false,
  anchored: false,
});

const channels = ['animation', 'material', 'vfx', 'audio'] as const;
assert.deepEqual([...enemyStatusVisualIds].sort(), ['armorBreach', 'conductive', 'disrupted', 'marked', 'stagger', 'vacuum'].sort(), 'P13-E must cover all six enemy status timers');
assert.deepEqual([...playerStatusVisualIds].sort(), ['disrupted', 'pressure-loss', 'thermal', 'vacuum'].sort(), 'operator status language must cover thermal, disruption, pressure loss, and vacuum');

const physicalSignatures = new Set<string>();
const presentationSignatures = new Set<string>();
for (const id of enemyStatusVisualIds) {
  const spec = enemyStatusVisualSpecFor(id);
  physicalSignatures.add([spec.signature, spec.motion, spec.primary, spec.accent, spec.nodeCount, spec.scale].join(':'));
  const input = base();
  input.statuses[id] = 0.75;
  const contract = resolveEnemyPresentation(input);
  for (const channel of channels) {
    assert(contract[channel].some(layer => layer.key === `status:${id}`), `${id} must publish ${channel} through P13-A`);
  }
  presentationSignatures.add(contract.signature);
}
assert.equal(physicalSignatures.size, enemyStatusVisualIds.length, 'every enemy status must have a distinct physical/VFX signature');
assert.equal(presentationSignatures.size, enemyStatusVisualIds.length, 'every enemy status must preserve deterministic P13-A identity');

const layered = base();
layered.statuses.disrupted = 0.9;
layered.statuses.marked = 0.8;
layered.statuses.conductive = 0.7;
layered.telegraph = 0.92;
const layeredContract = resolveEnemyPresentation(layered);
assert.equal(layeredContract.animation[0]?.priority, 4, 'priority-4 combat information must lead animation');
assert(layeredContract.animation.some(layer => layer.key === 'status:disrupted'), 'disruption must remain composed');
assert(layeredContract.animation.some(layer => layer.key === 'status:marked'), 'mark must remain composed');
assert(layeredContract.animation.some(layer => layer.key === 'status:conductive'), 'Arc/conductive state must remain composed');
assert(layeredContract.animation.some(layer => layer.source === 'telegraph'), 'attack telegraph must remain composed above status geometry');

const neutral = resolvePlayerStatusVisuals({ heat: 0.2, disrupted: 0, vacuumExposure: 0, pressureState: 'normal', pressure: 1 });
assert.equal(neutral.length, 0, 'healthy operator must not carry status presentation');

const thermal = resolvePlayerStatusVisuals({ heat: 0.91, disrupted: 0, vacuumExposure: 0, pressureState: 'normal', pressure: 1 });
assert(thermal.some(entry => entry.id === 'thermal' && entry.intensity > 0.7), 'high weapon heat must create thermal presentation');

const pressure = resolvePlayerStatusVisuals({ heat: 0.2, disrupted: 0, vacuumExposure: 0.25, pressureState: 'decompressing', pressure: 0.58 });
assert(pressure.some(entry => entry.id === 'pressure-loss'), 'decompression must create pressure-loss presentation');
assert(!pressure.some(entry => entry.id === 'vacuum'), 'decompression before vacuum must keep a distinct pressure-loss state');

const vacuum = resolvePlayerStatusVisuals({ heat: 0.2, disrupted: 0, vacuumExposure: 0.9, pressureState: 'vacuum', pressure: 0.05 });
assert(vacuum.some(entry => entry.id === 'vacuum'), 'vacuum must create the terminal environmental presentation');

const disrupted = resolvePlayerStatusVisuals({ heat: 0.86, disrupted: 0.8, vacuumExposure: 0.2, pressureState: 'leaking', pressure: 0.72 });
assert.equal(disrupted[0]?.id, 'disrupted', 'operator disruption must outrank thermal and pressure-loss presentation');

for (const id of playerStatusVisualIds) {
  const spec = playerStatusVisualSpecFor(id);
  assert(spec.primary !== spec.accent, `${id} must have readable primary/accent separation`);
}

const rendererSource = readFileSync(resolve(process.cwd(), 'src/game/threeCombatRenderer.ts'), 'utf8');
const canvasSource = readFileSync(resolve(process.cwd(), 'src/components/GameCanvas.tsx'), 'utf8');
const feedbackSource = readFileSync(resolve(process.cwd(), 'src/game/feedback.ts'), 'utf8');
const visualSource = readFileSync(resolve(process.cwd(), 'src/game/statusVisualLanguage.ts'), 'utf8');

assert(rendererSource.includes('createEnemyStatusVisuals'), 'Three.js must build enemy status geometry');
assert(rendererSource.includes('syncEnemyStatusPresentation'), 'Three.js must animate enemy status presentation');
assert(rendererSource.includes('createPlayerStatusVisuals'), 'Three.js must build operator status geometry');
assert(rendererSource.includes('syncPlayerStatusPresentation'), 'Three.js must animate operator thermal/environment states');
assert(rendererSource.includes('dataset.enemyStatusPresentation'), 'Three.js must expose enemy status QA telemetry');
assert(rendererSource.includes('dataset.playerStatusDominant'), 'Three.js must expose operator status QA telemetry');
assert(rendererSource.includes("enemy.telegraph > 0 ? 0x7a3327 : dominantStatusSpec?.accent"), 'attack telegraph material must stay authoritative over status emissive');
assert(rendererSource.includes('const markerCount = reducedEffects ? 2'), 'operator secondary status detail must reduce in reduced-effects mode');
assert(rendererSource.includes('const nodeCount = reducedEffects ? Math.min(3, spec.nodeCount)'), 'enemy secondary status detail must reduce in reduced-effects mode');

assert(canvasSource.includes('drawEnemyStatusPresentation'), 'Canvas fallback must render enemy statuses');
assert(canvasSource.includes('drawOperatorStatusPresentation'), 'Canvas fallback must render operator thermal/environment states');
assert(
  /drawEnemySilhouette\(ctx,[\s\S]{0,180}drawEnemyStatusPresentation\(ctx,[\s\S]{0,180}drawEnemyTelegraph\(ctx/.test(canvasSource),
  'Canvas attack telegraph must draw after enemy status presentation',
);
assert(canvasSource.includes('feedback.status(freshStatus.cue)'), 'enemy status audio must fire on fresh activation');
assert(canvasSource.includes('feedback.playerStatus(freshPlayerStatus.id)'), 'operator status audio must fire on fresh activation');
assert(canvasSource.includes('dataset.enemyStatusPresentation') && canvasSource.includes('dataset.playerStatusPresentation'), 'Canvas runtime must expose status QA telemetry');

assert(feedbackSource.includes('enemyStatusAudioProfiles'), 'enemy statuses must own distinct audio profiles');
assert(feedbackSource.includes('playerStatusAudioProfiles'), 'operator thermal/environment statuses must own distinct audio profiles');
assert(feedbackSource.includes('status(cue: EnemyStatusAudioCue)'), 'feedback bus must expose enemy status audio');
assert(feedbackSource.includes('playerStatus(cue: PlayerStatusAudioCue)'), 'feedback bus must expose operator status audio');

for (const forbidden of ['stepSimulation(', 'dealEnemyDamage(', 'stepEnemy(']) {
  assert(!visualSource.includes(forbidden), `status visual language must not mutate gameplay through ${forbidden}`);
}

console.log('STATUS_VISUALS_PASS enemy=6 operator=thermal+disrupted+pressure+vacuum channels=animation+material+vfx+audio authored+fallback=1 priority=tells-first reduced-effects=preserved simulationMutation=0');
