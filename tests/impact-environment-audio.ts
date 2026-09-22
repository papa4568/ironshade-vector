import assert from 'node:assert/strict';
import {
  acousticTreatmentFor,
  combatAudioEnvironment,
  impactAudioProfiles,
  impactSurfaceForObject,
  type ImpactSurface,
} from '../src/game/feedback';

const surfaces: ImpactSurface[] = ['armor', 'machinery', 'ice', 'steel', 'glass', 'field'];
const signatures = new Set<number>();

for (const surface of surfaces) {
  const profile = impactAudioProfiles[surface];
  assert.ok(profile.layers.length >= 2, `${surface} needs layered transient/body information`);
  assert.ok(profile.layers.length <= 3, `${surface} exceeds the mobile impact layer budget`);
  assert.ok(profile.masterGain > 0 && profile.masterGain <= .24, `${surface} master gain must remain mobile-safe`);
  for (const layer of profile.layers) {
    assert.ok(layer.duration > 0 && layer.duration <= .14, `${surface} impact layer is too long`);
    assert.ok(layer.gain > 0 && layer.gain <= .55, `${surface} impact layer gain is out of bounds`);
  }
  signatures.add(profile.layers[0]!.frequency);
}
assert.equal(signatures.size, surfaces.length, 'Each impact family needs a distinct leading signature');

assert.equal(impactSurfaceForObject('system', 'conduit', 'damaged-vessel'), 'machinery');
assert.equal(impactSurfaceForObject('industrial', 'cover', 'ice-mine'), 'ice');
assert.equal(impactSurfaceForObject('light', 'cover', 'solar-yard'), 'glass');
assert.equal(impactSurfaceForObject('industrial', 'cover', 'damaged-vessel'), 'steel');
assert.equal(impactSurfaceForObject('bulkhead', 'cover', 'spin-habitat'), 'steel');

const interiorNormal = acousticTreatmentFor(combatAudioEnvironment('damaged-vessel', 'normal'));
const openNormal = acousticTreatmentFor(combatAudioEnvironment('solar-yard', 'normal'));
const leaking = acousticTreatmentFor(combatAudioEnvironment('damaged-vessel', 'leaking'));
const decompressing = acousticTreatmentFor(combatAudioEnvironment('damaged-vessel', 'decompressing'));
const vacuum = acousticTreatmentFor(combatAudioEnvironment('damaged-vessel', 'vacuum'));

assert.equal(combatAudioEnvironment('solar-yard', 'normal').space, 'open');
assert.equal(combatAudioEnvironment('damaged-vessel', 'normal').space, 'interior');
assert.ok(openNormal.tailGain < interiorNormal.tailGain, 'Open spaces should carry less room tail');
assert.ok(interiorNormal.gain > leaking.gain && leaking.gain > decompressing.gain && decompressing.gain > vacuum.gain, 'Pressure loss must progressively attenuate combat audio');
assert.ok(interiorNormal.lowpassHz > leaking.lowpassHz && leaking.lowpassHz > decompressing.lowpassHz && decompressing.lowpassHz > vacuum.lowpassHz, 'Pressure loss must progressively remove airborne high frequency detail');
assert.ok(vacuum.tailGain <= .12, 'Vacuum must reduce airborne tails to structural/suit conduction only');

console.log(`IMPACT_AUDIO_PASS surfaces=${surfaces.length} maxLayers=3 environments=interior/open/pressure/vacuum`);
