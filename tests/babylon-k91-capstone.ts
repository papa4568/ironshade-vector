import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  BABYLON_K91_CAPSTONE_IDENTITY,
  k91BlackboxCueState,
  k91HazardCue,
  k91InteractableCue,
} from '../src/game/babylonK91CapstonePresentation';
import { K91_STAGES, k91RenderProfile } from '../src/game/k91Capstone';
import type { CombatObject, SimState } from '../src/game/sim';

const babylon = readFileSync('src/game/babylonCombatRenderer.ts', 'utf8');
const presentation = readFileSync('src/game/babylonK91CapstonePresentation.ts', 'utf8');
const campaign = readFileSync('src/game/campaign.ts', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };

assert.deepEqual(BABYLON_K91_CAPSTONE_IDENTITY, {
  megastructure: 'counterweight:k-91',
  continuity: 'load-spine+countermass-rails+amber-inertial-datum',
  readability: 'amber-datum+opposed-mass-rails+shape-coded-risk',
  capstone: 'ballast-telemetry-blackbox',
});

assert.deepEqual(
  K91_STAGES.map(stage => [stage.stage, stage.code, stage.name, stage.kit.join('+')]),
  [
    [1, 'CW-01', 'Capture Collar', 'capture-jaws+tether-drums+inertial-datum'],
    [2, 'CW-02', 'Mass Transit Spine', 'mass-carriages+countermass-rails+trim-derotors'],
    [3, 'CW-03', 'Power Transfer Gallery', 'lift-bus-bars+transfer-isolators+service-trusses'],
    [4, 'CW-04', 'Ballast Vault', 'ballast-blocks+mass-locks+vault-ribs'],
  ],
);
assert.equal(k91RenderProfile(1, false).name, 'full');
assert.equal(k91RenderProfile(0.8, false).name, 'balanced');
assert.equal(k91RenderProfile(0.5, false).name, 'performance');
assert.equal(k91RenderProfile(1, true).name, 'mobile');

assert.equal(k91InteractableCue('doorControl'), 'capture-lock');
assert.equal(k91InteractableCue('gravityControl'), 'mass-trim');
assert.equal(k91InteractableCue('powerControl'), 'lift-bus');
assert.equal(k91InteractableCue('coolant'), 'service-risk');
assert.equal(k91InteractableCue('salvageNode'), 'telemetry-recovery');
assert.equal(k91InteractableCue('cover'), null);
assert.equal(k91HazardCue('gravityWell'), 'tumble-shear');
assert.equal(k91HazardCue('shockGrid'), 'lift-bus-arc');
assert.equal(k91HazardCue('vacuumWake'), 'pressure-wake');
assert.equal(k91HazardCue('vectorWash'), 'countermass-recoil');
assert.equal(k91HazardCue('boiloffJet'), 'service-vent');

const blackbox = {
  active: true,
  kind: 'salvageNode',
  exposed: false,
  hp: 100,
  maxHp: 100,
} as CombatObject;
const cueState = { objects: [blackbox] } as Pick<SimState, 'objects'>;
assert.equal(k91BlackboxCueState(cueState, 2), 'transit-stage-2');
assert.equal(k91BlackboxCueState(cueState, 4), 'blackbox-locked');
blackbox.hp = 50;
assert.equal(k91BlackboxCueState(cueState, 4), 'blackbox-damaged');
blackbox.exposed = true;
assert.equal(k91BlackboxCueState(cueState, 4), 'blackbox-exposed');
cueState.objects.length = 0;
assert.equal(k91BlackboxCueState(cueState, 4), 'ballast-vault-ready');

for (const marker of [
  'procedural-k91-capstone-babylon',
  'stage-identity+load-spine+countermass-rails+stage-props+interactables+hazards+blackbox-capstone+shared-location-foundations',
  'p27-c12-k91-stage-1-capture-collar',
  'p27-c12-k91-stage-2-mass-transit-spine',
  'p27-c12-k91-stage-3-power-transfer-gallery',
  'p27-c12-k91-stage-4-ballast-vault',
  'p27-c12-k91-blackbox-cue',
  'megastructureInteractableCues',
  'megastructureHazardCues',
  'megastructureCapstoneCueState',
  'blackbox-beacon+mass-lock-rings+amber-recovery-core',
]) assert.ok(presentation.includes(marker), 'missing K91 Babylon parity marker: ' + marker);

assert.ok(babylon.includes("import { BabylonK91CapstonePresentation } from './babylonK91CapstonePresentation';"));
assert.ok(babylon.includes('private readonly k91CapstonePresentation: BabylonK91CapstonePresentation;'));
assert.ok(babylon.includes('this.k91CapstonePresentation = new BabylonK91CapstonePresentation(scene, canvas, coarse);'));
assert.ok(babylon.includes("mission.megastructure === 'counterweight'"));
assert.ok(babylon.includes('this.k91CapstonePresentation.sync(state, budget, mission);'));
assert.ok(babylon.includes("this.k91CapstonePresentation.release('scenario-switch');"));
assert.ok(babylon.includes('this.k91CapstonePresentation.dispose();'));

for (const baseLocation of ['orbital-station', 'spin-habitat', 'solar-yard', 'asteroid-refinery']) {
  assert.ok(babylon.includes(`mission.location === '${baseLocation}'`), 'K91 stage base location must stay on Babylon: ' + baseLocation);
}

assert.ok(pkg.scripts['test:babylon-k91-capstone']);
assert.ok(pkg.scripts.build.includes('npm run test:babylon-k91-capstone'));

console.log('BABYLON_K91_CAPSTONE_PASS stages=4 continuity=load-spine+countermass-rails+amber-inertial-datum cues=interactables+hazards+blackbox');
