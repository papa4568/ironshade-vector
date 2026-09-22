import assert from 'node:assert/strict';
import {
  classSkillAudioProfiles,
  combatAudioBudget,
  combatMixProfiles,
  foleyAudioProfiles,
  threatAudioProfiles,
  type SkillAudioClass,
  type ThreatAudioCue,
  type WeaponCue,
} from '../src/game/feedback';

const weapons: WeaponCue[] = ['carbine', 'breacher', 'rail'];
const classes: SkillAudioClass[] = ['vanguard', 'vector', 'systems'];
const threats: ThreatAudioCue[] = ['enemy-telegraph', 'elite-telegraph', 'boss-telegraph', 'boss-phase'];

const reloadSignatures = new Set<number>();
const ventSignatures = new Set<number>();
for (const weapon of weapons) {
  for (const action of ['reload', 'vent'] as const) {
    const profile = foleyAudioProfiles[weapon][action];
    assert.ok(profile.start.length >= 1 && profile.start.length <= 3, `${weapon} ${action} start exceeds the mobile layer budget`);
    assert.ok(profile.complete.length >= 1 && profile.complete.length <= 2, `${weapon} ${action} completion exceeds the mobile layer budget`);
    assert.ok(profile.masterGain > 0 && profile.masterGain <= .2, `${weapon} ${action} gain is out of bounds`);
    for (const layer of [...profile.start, ...profile.complete]) {
      assert.ok(layer.duration > 0 && layer.duration <= .18, `${weapon} ${action} Foley layer is too long`);
      assert.ok(layer.gain > 0 && layer.gain <= .5, `${weapon} ${action} Foley layer gain is out of bounds`);
    }
  }
  reloadSignatures.add(foleyAudioProfiles[weapon].reload.start[0]!.frequency);
  ventSignatures.add(foleyAudioProfiles[weapon].vent.start[0]!.frequency);
}
assert.equal(reloadSignatures.size, weapons.length, 'Each class arsenal needs distinct reload Foley');
assert.equal(ventSignatures.size, weapons.length, 'Each class arsenal needs distinct vent Foley');

const classSignatures = new Set<number>();
for (const operatorClass of classes) {
  const profiles = classSkillAudioProfiles[operatorClass];
  assert.equal(profiles.length, 3, `${operatorClass} needs one information mix profile per class skill`);
  const withinClass = new Set<number>();
  for (const profile of profiles) {
    assert.equal(profile.priority, 'important');
    assert.ok(profile.layers.length >= 1 && profile.layers.length <= 3, `${operatorClass} skill exceeds the mobile layer budget`);
    assert.ok(profile.masterGain > 0 && profile.masterGain <= .22, `${operatorClass} skill gain is out of bounds`);
    withinClass.add(profile.layers[0]!.frequency);
  }
  assert.equal(withinClass.size, 3, `${operatorClass} skill slots need distinct signatures`);
  classSignatures.add(profiles[0]!.layers[0]!.frequency);
}
assert.equal(classSignatures.size, classes.length, 'Class skill families need distinct leading audio signatures');

for (const cue of threats) {
  const profile = threatAudioProfiles[cue];
  assert.ok(profile.layers.length >= 1 && profile.layers.length <= 3, `${cue} exceeds the threat layer budget`);
  assert.ok(profile.masterGain > 0 && profile.masterGain <= .22, `${cue} gain is out of bounds`);
}
assert.equal(threatAudioProfiles['enemy-telegraph'].priority, 'important');
assert.equal(threatAudioProfiles['elite-telegraph'].priority, 'important');
assert.equal(threatAudioProfiles['boss-telegraph'].priority, 'critical');
assert.equal(threatAudioProfiles['boss-phase'].priority, 'critical');

assert.equal(combatAudioBudget.maxVoices, 18);
assert.ok(combatAudioBudget.maxTailVoices <= 6, 'Tail voice budget should stay bounded on mobile');
assert.ok(combatAudioBudget.criticalReserveVoices <= 3, 'Critical reserve should remain small and predictable');
assert.equal(combatMixProfiles.normal.busGain.weapon, 1);
assert.ok(combatMixProfiles.important.busGain.weapon < 1, 'Important cues should make space over weapon fire');
assert.ok(combatMixProfiles.critical.busGain.weapon < combatMixProfiles.important.busGain.weapon, 'Critical tells should duck weapon fire harder than important cues');
assert.ok(combatMixProfiles.critical.busGain.impact < combatMixProfiles.important.busGain.impact, 'Critical tells should also make space over impacts');
assert.equal(combatMixProfiles.critical.busGain.threat, 1, 'Threat bus must stay intelligible during priority ducking');
assert.equal(combatMixProfiles.critical.busGain.ui, 1, 'UI confirmation should not be hidden by combat ducking');

console.log(`INFORMATION_AUDIO_PASS foley=${weapons.length * 2} skillProfiles=${classes.length * 3} threats=${threats.length} voices=${combatAudioBudget.maxVoices}+${combatAudioBudget.criticalReserveVoices}`);
