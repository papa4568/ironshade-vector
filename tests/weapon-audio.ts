import assert from 'node:assert/strict';
import { weaponAudioProfiles, weaponRepeatVariation, type WeaponCue } from '../src/game/feedback';

const weaponCues: WeaponCue[] = ['carbine', 'breacher', 'rail'];
const signatureFrequencies = new Set<number>();
let maxLayersPerShot = 0;

for (const cue of weaponCues) {
  const profile = weaponAudioProfiles[cue];
  assert.ok(profile.mechanical.length >= 1, `${cue} must have a mechanical action layer`);
  assert.ok(profile.discharge.length >= 1, `${cue} must have a discharge/body layer`);
  assert.deepEqual(Object.keys(profile.tails).sort(), ['far', 'mid', 'near']);
  assert.ok(profile.tails.near.delay! < profile.tails.mid.delay!, `${cue} near tail should arrive before mid tail`);
  assert.ok(profile.tails.mid.delay! < profile.tails.far.delay!, `${cue} mid tail should arrive before far tail`);
  assert.ok(profile.tailCadence.near >= 1 && profile.tailCadence.mid >= 1 && profile.tailCadence.far >= 1);
  assert.ok(profile.masterGain > 0 && profile.masterGain <= .35, `${cue} master gain must stay mobile-safe`);

  const layerBudget = profile.mechanical.length + profile.discharge.length + 3;
  maxLayersPerShot = Math.max(maxLayersPerShot, layerBudget);
  assert.ok(layerBudget <= 7, `${cue} schedules too many per-shot audio layers`);

  const pitchValues = new Set<number>();
  for (let shot = 0; shot < 32; shot += 1) {
    const variation = weaponRepeatVariation(cue, shot);
    pitchValues.add(Number(variation.pitchCents.toFixed(4)));
    assert.ok(Math.abs(variation.pitchCents) <= profile.repeat.pitchCents + 1e-9, `${cue} pitch variation escaped its bound`);
    assert.ok(variation.gainMultiplier >= 1 - profile.repeat.gainVariance - 1e-9, `${cue} gain variation fell below its bound`);
    assert.ok(variation.gainMultiplier <= 1 + profile.repeat.gainVariance + 1e-9, `${cue} gain variation exceeded its bound`);
  }
  assert.ok(pitchValues.size >= 6, `${cue} repeat variation should avoid obvious two-shot alternation`);
  assert.deepEqual(weaponRepeatVariation(cue, 0), weaponRepeatVariation(cue, 8), `${cue} variation cycle must remain deterministic`);

  signatureFrequencies.add(profile.discharge[0]!.frequency);
}

assert.equal(signatureFrequencies.size, 3, 'Each class-owned weapon family needs a distinct primary discharge signature');
assert.equal(weaponAudioProfiles.carbine.tailCadence.near, 1);
assert.ok(weaponAudioProfiles.carbine.tailCadence.mid >= 2, 'Rapid Carbine mid tails should be decimated');
assert.ok(weaponAudioProfiles.carbine.tailCadence.far >= 4, 'Rapid Carbine far tails should be aggressively decimated');
assert.deepEqual(weaponAudioProfiles.breacher.tailCadence, { near: 1, mid: 1, far: 1 });
assert.deepEqual(weaponAudioProfiles.rail.tailCadence, { near: 1, mid: 1, far: 1 });

console.log(`WEAPON_AUDIO_PASS families=${weaponCues.length} maxLayers=${maxLayersPerShot} tails=near/mid/far repeat=bounded carbine=decimated`);
