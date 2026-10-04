import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  BABYLON_HECATE_CAPSTONE_IDENTITY,
  hecateHazardCue,
  hecateInteractableCue,
  hecateYardmasterCueState,
} from '../src/game/babylonHecateCapstonePresentation';
import { HECATE_STAGES, hecateRenderProfile } from '../src/game/hecateCapstone';
import type { Enemy, SimState } from '../src/game/sim';

const babylon = readFileSync('src/game/babylonCombatRenderer.ts', 'utf8');
const presentation = readFileSync('src/game/babylonHecateCapstonePresentation.ts', 'utf8');
const campaign = readFileSync('src/game/campaign.ts', 'utf8');
const encounters = readFileSync('src/game/encounters.ts', 'utf8');
const sim = readFileSync('src/game/sim.ts', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };

assert.deepEqual(BABYLON_HECATE_CAPSTONE_IDENTITY, {
  megastructure: 'shipbreaking-yard:hecate',
  continuity: 'salvage-truss-spine+red-clamp-arms+yellow-cutter-datum',
  readability: 'red-clamp+yellow-cutter+shape-coded-risk',
  boss: 'hecate-yardmaster-null',
});

assert.deepEqual(
  HECATE_STAGES.map(stage => [stage.stage, stage.code, stage.name, stage.kit.join('+')]),
  [
    [1, 'HY-01', 'Sunward Clamp Field', 'sunward-clamps+hull-cradles+thermal-cutter-datum'],
    [2, 'HY-02', 'Crusher Causeway', 'crusher-jaws+scrap-conveyors+cutter-gantries'],
    [3, 'HY-03', 'Wreck Transit', 'stripped-hulls+pressure-bridges+registry-frames'],
    [4, 'HY-04', 'Yard Control Crown', 'control-crown+master-clamps+salvage-ledger'],
  ],
);
assert.equal(hecateRenderProfile(1, false).name, 'full');
assert.equal(hecateRenderProfile(0.8, false).name, 'balanced');
assert.equal(hecateRenderProfile(0.5, false).name, 'performance');
assert.deepEqual(hecateRenderProfile(1, true), hecateRenderProfile(1, false), 'Coarse input alone must preserve the full Hecate capstone profile.');

assert.equal(hecateInteractableCue('doorControl'), 'yard-clamp-lock');
assert.equal(hecateInteractableCue('gravityControl'), 'crane-authority');
assert.equal(hecateInteractableCue('powerControl'), 'cutter-grid');
assert.equal(hecateInteractableCue('coolant'), 'pressure-route');
assert.equal(hecateInteractableCue('salvageNode'), 'salvage-ledger');
assert.equal(hecateInteractableCue('cover'), null);
assert.equal(hecateHazardCue('gravityWell'), 'crane-lock');
assert.equal(hecateHazardCue('shockGrid'), 'cutter-grid-arc');
assert.equal(hecateHazardCue('vacuumWake'), 'wreck-pressure-purge');
assert.equal(hecateHazardCue('vectorWash'), 'clamp-sweep');
assert.equal(hecateHazardCue('boiloffJet'), 'thermal-cutter');

const yardmaster = {
  role: 'boss',
  variant: 'hecateYardmaster',
  active: true,
  dead: false,
  bossPhase: 1,
  bossPattern: 'craneLock',
} as Enemy;
const yardmasterState = {
  bossActive: true,
  bossDefeated: false,
  enemies: [yardmaster],
} as Pick<SimState, 'bossActive' | 'bossDefeated' | 'enemies'>;
assert.equal(hecateYardmasterCueState(yardmasterState), 'active-phase-1:craneLock');
yardmaster.bossPhase = 2;
yardmaster.bossPattern = 'thermalCascade';
assert.equal(hecateYardmasterCueState(yardmasterState), 'active-phase-2:thermalCascade');
yardmasterState.bossActive = false;
assert.equal(hecateYardmasterCueState(yardmasterState), 'queued');
yardmasterState.bossDefeated = true;
assert.equal(hecateYardmasterCueState(yardmasterState), 'defeated');

for (const marker of [
  'procedural-hecate-capstone-babylon',
  'stage-identity+salvage-truss-continuity+stage-props+interactables+hazards+yardmaster-cues+shared-location-foundations',
  'p27-c14-hecate-stage-1-sunward-clamp-field',
  'p27-c14-hecate-stage-2-crusher-causeway',
  'p27-c14-hecate-stage-3-wreck-transit',
  'p27-c14-hecate-stage-4-yard-control-crown',
  'p27-c14-hecate-yard-control-crown',
  'p27-c14-hecate-yardmaster-cue',
  'megastructureInteractableCues',
  'megastructureHazardCues',
  'megastructureBossCueState',
  'control-crown+master-clamps+yellow-command-core',
]) assert.ok(presentation.includes(marker), 'missing Hecate Babylon parity marker: ' + marker);

assert.ok(babylon.includes("import { BabylonHecateCapstonePresentation } from './babylonHecateCapstonePresentation';"));
assert.ok(babylon.includes('private readonly hecateCapstonePresentation: BabylonHecateCapstonePresentation;'));
assert.ok(babylon.includes('this.hecateCapstonePresentation = new BabylonHecateCapstonePresentation(scene, canvas, coarse);'));
assert.ok(babylon.includes("mission.megastructure === 'shipbreaking-yard'"));
assert.ok(babylon.includes('this.hecateCapstonePresentation.sync(state, budget, mission);'));
assert.ok(babylon.includes("this.hecateCapstonePresentation.release('scenario-switch');"));
assert.ok(babylon.includes('this.hecateCapstonePresentation.dispose();'));

for (const baseLocation of ['solar-yard', 'asteroid-refinery', 'damaged-vessel', 'jovian-harvester']) {
  assert.ok(babylon.includes(`mission.location === '${baseLocation}'`), 'Hecate stage base location must stay on Babylon: ' + baseLocation);
}

assert.ok(pkg.scripts['test:babylon-hecate-capstone']);
assert.ok(pkg.scripts.build.includes('npm run test:babylon-hecate-capstone'));

console.log('BABYLON_HECATE_CAPSTONE_PASS stages=4 continuity=salvage-truss-spine+red-clamp-arms+yellow-cutter-datum cues=interactables+hazards+yardmaster');
