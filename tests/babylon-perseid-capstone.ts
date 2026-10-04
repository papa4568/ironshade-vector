import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  BABYLON_PERSEID_CAPSTONE_IDENTITY,
  perseidHazardCue,
  perseidInteractableCue,
  perseidStewardCueState,
} from '../src/game/babylonPerseidCapstonePresentation';
import { PERSEID_STAGES, perseidRenderProfile } from '../src/game/perseidCapstone';
import { createSimulation } from '../src/game/sim';

const babylon = readFileSync('src/game/babylonCombatRenderer.ts', 'utf8');
const presentation = readFileSync('src/game/babylonPerseidCapstonePresentation.ts', 'utf8');
const campaign = readFileSync('src/game/campaign.ts', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };

assert.deepEqual(BABYLON_PERSEID_CAPSTONE_IDENTITY, {
  megastructure: 'generation-ship:perseid',
  continuity: 'keel-spine+pressure-ribs+green-transit-datum',
  readability: 'green-datum+stage-silhouette+shape-coded-risk',
  boss: 'perseid-steward-core',
});

assert.deepEqual(
  PERSEID_STAGES.map(stage => [stage.stage, stage.code, stage.name, stage.kit.join('+')]),
  [
    [1, 'PS-01', 'Docking Spine', 'docking-collar+pressure-ribs+keel-conduit'],
    [2, 'PS-02', 'Agricultural Drum', 'grow-light-banks+seed-troughs+rotation-datum'],
    [3, 'PS-03', 'Cryogenic Service Deck', 'cryobank-stacks+service-pipe-banks+cold-bus-trunks'],
    [4, 'PS-04', 'Reactor Choir', 'harmonic-pylons+reactor-bus-arches+steward-seal'],
  ],
);
assert.equal(perseidRenderProfile(1, false).name, 'full');
assert.equal(perseidRenderProfile(0.8, false).name, 'balanced');
assert.equal(perseidRenderProfile(0.5, false).name, 'performance');
assert.equal(perseidRenderProfile(1, true).name, 'mobile');

assert.equal(perseidInteractableCue('doorControl'), 'pressure-lock');
assert.equal(perseidInteractableCue('gravityControl'), 'drum-stabilizer');
assert.equal(perseidInteractableCue('powerControl'), 'reactor-bus');
assert.equal(perseidInteractableCue('coolant'), 'service-risk');
assert.equal(perseidInteractableCue('salvageNode'), 'recovery-node');
assert.equal(perseidInteractableCue('cover'), null);
assert.equal(perseidHazardCue('gravityWell'), 'drum-shear');
assert.equal(perseidHazardCue('boiloffJet'), 'cryogenic-jet');
assert.equal(perseidHazardCue('shockGrid'), 'reactor-bus-arc');
assert.equal(perseidHazardCue('vacuumWake'), 'pressure-wake');
assert.equal(perseidHazardCue('vectorWash'), 'keel-vector-shear');

const state = createSimulation();
assert.equal(perseidStewardCueState(state), 'queued');
const steward = state.enemies.find(enemy => enemy.role === 'boss');
assert.ok(steward);
steward.variant = 'perseidSteward';
steward.active = true;
steward.bossPhase = 2;
steward.bossPattern = 'archivePurge';
state.bossActive = true;
assert.equal(perseidStewardCueState(state), 'active-phase-2:archivePurge');
state.bossDefeated = true;
assert.equal(perseidStewardCueState(state), 'defeated');

for (const marker of [
  'procedural-perseid-capstone-babylon',
  'stage-identity+keel-continuity+stage-props+interactables+hazards+steward-cues+shared-location-foundations',
  'p27-c11-perseid-stage-1-docking-spine',
  'p27-c11-perseid-stage-2-agricultural-drum',
  'p27-c11-perseid-stage-3-cryogenic-service-deck',
  'p27-c11-perseid-stage-4-reactor-choir',
  'p27-c11-perseid-steward-seal',
  "enemy.variant === 'perseidSteward'",
  'megastructureInteractableCues',
  'megastructureHazardCues',
  'megastructureBossCueState',
  'steward-seal+phase-rings+command-core',
]) assert.ok(presentation.includes(marker), 'missing Perseid Babylon parity marker: ' + marker);

assert.ok(babylon.includes("import { BabylonPerseidCapstonePresentation } from './babylonPerseidCapstonePresentation';"));
assert.ok(babylon.includes('private readonly perseidCapstonePresentation: BabylonPerseidCapstonePresentation;'));
assert.ok(babylon.includes('this.perseidCapstonePresentation = new BabylonPerseidCapstonePresentation(scene, canvas, coarse);'));
assert.ok(babylon.includes("if (mission.megastructure === 'generation-ship')"));
assert.ok(babylon.includes('this.perseidCapstonePresentation.sync(state, budget, mission);'));
assert.ok(babylon.includes("this.perseidCapstonePresentation.release('scenario-switch');"));
assert.ok(babylon.includes('this.perseidCapstonePresentation.dispose();'));

for (const baseLocation of ['damaged-vessel', 'spin-habitat', 'orbital-station', 'solar-yard']) {
  assert.ok(babylon.includes(`mission.location === '${baseLocation}'`), 'Perseid stage base location must stay on Babylon: ' + baseLocation);
}

assert.ok(pkg.scripts['test:babylon-perseid-capstone']);
assert.ok(pkg.scripts.build.includes('npm run test:babylon-perseid-capstone'));

console.log('BABYLON_PERSEID_CAPSTONE_PASS stages=4 continuity=keel-spine+pressure-ribs+green-transit-datum cues=interactables+hazards+steward');
