import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  BABYLON_ORPHELINE_CAPSTONE_IDENTITY,
  orphelineHazardCue,
  orphelineInteractableCue,
  orphelineWardenCueState,
} from '../src/game/babylonOrphelineCapstonePresentation';
import { ORPHELINE_STAGES, orphelineRenderProfile } from '../src/game/orphelineCapstone';
import type { Enemy, SimState } from '../src/game/sim';

const babylon = readFileSync('src/game/babylonCombatRenderer.ts', 'utf8');
const presentation = readFileSync('src/game/babylonOrphelineCapstonePresentation.ts', 'utf8');
const campaign = readFileSync('src/game/campaign.ts', 'utf8');
const encounters = readFileSync('src/game/encounters.ts', 'utf8');
const sim = readFileSync('src/game/sim.ts', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };

assert.deepEqual(BABYLON_ORPHELINE_CAPSTONE_IDENTITY, {
  megastructure: 'hidden-habitat:orpheline',
  continuity: 'rock-cut-spine+violet-utility-trunk+white-occupancy-marks',
  readability: 'violet-datum+white-occupancy+shape-coded-risk',
  boss: 'orpheline-habitat-warden',
});

assert.deepEqual(
  ORPHELINE_STAGES.map(stage => [stage.stage, stage.code, stage.name, stage.kit.join('+')]),
  [
    [1, 'OR-01', 'Ice Access Bore', 'thermal-cut-bore+concealment-shutters+transit-ledger-niches'],
    [2, 'OR-02', 'Industrial Commons', 'fabrication-stalls+salvage-gantries+commons-partitions'],
    [3, 'OR-03', 'Residential Spin Ring', 'hab-pod-stacks+pressure-curtains+shelter-spokes'],
    [4, 'OR-04', 'Buried Control Vault', 'charter-archive-walls+warden-pylons+founder-seal'],
  ],
);
assert.equal(orphelineRenderProfile(1, false).name, 'full');
assert.equal(orphelineRenderProfile(0.8, false).name, 'balanced');
assert.equal(orphelineRenderProfile(0.5, false).name, 'performance');
assert.equal(orphelineRenderProfile(1, true).name, 'mobile');

assert.equal(orphelineInteractableCue('doorControl'), 'concealment-lock');
assert.equal(orphelineInteractableCue('gravityControl'), 'spin-authority');
assert.equal(orphelineInteractableCue('powerControl'), 'utility-bus');
assert.equal(orphelineInteractableCue('coolant'), 'pressure-route');
assert.equal(orphelineInteractableCue('salvageNode'), 'archive-recovery');
assert.equal(orphelineInteractableCue('cover'), null);
assert.equal(orphelineHazardCue('gravityWell'), 'warden-gravity-override');
assert.equal(orphelineHazardCue('shockGrid'), 'archive-shutter-grid');
assert.equal(orphelineHazardCue('vacuumWake'), 'shelter-pressure-purge');
assert.equal(orphelineHazardCue('vectorWash'), 'habitat-vector-shear');
assert.equal(orphelineHazardCue('boiloffJet'), 'service-vent');

const warden = {
  role: 'boss',
  variant: 'orphelineWarden',
  active: true,
  dead: false,
  bossPhase: 1,
  bossPattern: 'pressureCascade',
} as Enemy;
const wardenState = {
  bossActive: true,
  bossDefeated: false,
  enemies: [warden],
} as Pick<SimState, 'bossActive' | 'bossDefeated' | 'enemies'>;
assert.equal(orphelineWardenCueState(wardenState), 'active-phase-1:pressureCascade');
warden.bossPhase = 2;
warden.bossPattern = 'gravityOverride';
assert.equal(orphelineWardenCueState(wardenState), 'active-phase-2:gravityOverride');
wardenState.bossActive = false;
assert.equal(orphelineWardenCueState(wardenState), 'queued');
wardenState.bossDefeated = true;
assert.equal(orphelineWardenCueState(wardenState), 'defeated');

for (const marker of [
  'procedural-orpheline-capstone-babylon',
  'stage-identity+rock-cut-continuity+stage-props+interactables+hazards+warden-cues+shared-location-foundations',
  'p27-c13-orpheline-stage-1-ice-access-bore',
  'p27-c13-orpheline-stage-2-industrial-commons',
  'p27-c13-orpheline-stage-3-residential-spin-ring',
  'p27-c13-orpheline-stage-4-buried-control-vault',
  'p27-c13-orpheline-founder-seal',
  'p27-c13-orpheline-warden-cue',
  'megastructureInteractableCues',
  'megastructureHazardCues',
  'megastructureBossCueState',
  'founder-seal+warden-authority-rings+violet-command-core',
]) assert.ok(presentation.includes(marker), 'missing Orpheline Babylon parity marker: ' + marker);

assert.ok(babylon.includes("import { BabylonOrphelineCapstonePresentation } from './babylonOrphelineCapstonePresentation';"));
assert.ok(babylon.includes('private readonly orphelineCapstonePresentation: BabylonOrphelineCapstonePresentation;'));
assert.ok(babylon.includes('this.orphelineCapstonePresentation = new BabylonOrphelineCapstonePresentation(scene, canvas, coarse);'));
assert.ok(babylon.includes("mission.megastructure === 'hidden-habitat'"));
assert.ok(babylon.includes('this.orphelineCapstonePresentation.sync(state, budget, mission);'));
assert.ok(babylon.includes("this.orphelineCapstonePresentation.release('scenario-switch');"));
assert.ok(babylon.includes('this.orphelineCapstonePresentation.dispose();'));

for (const baseLocation of ['ice-mine', 'asteroid-refinery', 'spin-habitat', 'orbital-station']) {
  assert.ok(babylon.includes(`mission.location === '${baseLocation}'`), 'Orpheline stage base location must stay on Babylon: ' + baseLocation);
}

assert.ok(pkg.scripts['test:babylon-orpheline-capstone']);
assert.ok(pkg.scripts.build.includes('npm run test:babylon-orpheline-capstone'));

console.log('BABYLON_ORPHELINE_CAPSTONE_PASS stages=4 continuity=rock-cut-spine+violet-utility-trunk+white-occupancy-marks cues=interactables+hazards+warden');
