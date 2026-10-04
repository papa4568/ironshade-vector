import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  BABYLON_CRYO_RESERVE_IDENTITY,
  BABYLON_CRYO_RESERVE_LIGHTING,
  cryoReservePurgeMode,
  cryoReserveRenderProfile,
  cryoReserveValveState,
} from '../src/game/babylonCryoReservePresentation';
import { getMapNavigationPlan } from '../src/game/mapNavigation';

const babylon = readFileSync('src/game/babylonCombatRenderer.ts', 'utf8');
const presentation = readFileSync('src/game/babylonCryoReservePresentation.ts', 'utf8');
const encounters = readFileSync('src/game/encounters.ts', 'utf8');
const director = readFileSync('src/game/director.ts', 'utf8');
const interdiction = readFileSync('src/game/postKhepriInterdiction.ts', 'utf8');
const smoke = readFileSync('scripts/browser-runtime-smoke.mjs', 'utf8');
const workflow = readFileSync('.github/workflows/browser-e2e.yml', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };

assert.deepEqual(BABYLON_CRYO_RESERVE_IDENTITY, {
  silhouette: 'tank-gallery',
  material: 'vacuum-jacketed-cryogenic',
  lighting: 'cold-blue',
  propSet: 'purge-service',
});
assert.deepEqual(BABYLON_CRYO_RESERVE_LIGHTING, {
  id: 'cold-blue',
  keyColor: 0xd0e3ed,
  rimColor: 0x77c6de,
  emergencyColor: 0x76cde9,
  keyIntensity: 2.0,
  rimIntensity: 1.12,
  emergencyIntensity: 8.4,
  exposure: 1.07,
});

assert.equal(cryoReservePurgeMode(0), 'nominal');
assert.equal(cryoReservePurgeMode(1), 'boiloff-purge');
assert.equal(cryoReserveValveState(0, 2), 'armed');
assert.equal(cryoReserveValveState(1, 2), 'partial');
assert.equal(cryoReserveValveState(2, 2), 'routed');
assert.equal(cryoReserveValveState(0, 0), 'offline');

const full = cryoReserveRenderProfile(1, false);
const mobile = cryoReserveRenderProfile(1, true);
const performance = cryoReserveRenderProfile(0.5, false);
assert.equal(full.name, 'full');
assert.equal(full.tankInstances, 7);
assert.equal(full.galleryFrameInstances, 6);
assert.equal(full.pipeRunInstances, 4);
assert.equal(full.plumeInstances, 3);
assert.equal(mobile.name, 'mobile');
assert.equal(mobile.galleryFrameInstances, 4);
assert.equal(mobile.plumeInstances, 2);
assert.equal(performance.name, 'performance');
assert.equal(performance.pipeRunInstances, 2);
assert.equal(performance.plumeInstances, 1);

const navigation = getMapNavigationPlan('cryo-reserve');
assert.equal(navigation.routes.length, 8);
assert.deepEqual(navigation.landmarks.map(item => item.label), ['SERVICE COLLAR', 'PROPELLANT GALLERY', 'UMBRA TANK FARM']);

assert.ok(encounters.includes("function configureCryoReserve(state: SimState)"));
assert.ok(encounters.includes("coverObject('cryo-tank-a', 'Vacuum-jacket tank A'"));
assert.ok(encounters.includes("coverObject('cryo-tank-b', 'Vacuum-jacket tank B'"));
assert.ok(encounters.includes("coverObject('cryo-tank-c', 'Vacuum-jacket tank C'"));
assert.ok(encounters.includes("addAt('purge-valve-a', 'LH2 purge valve'"));
assert.ok(encounters.includes("addAt('purge-valve-b', 'Methane purge valve'"));
assert.ok(encounters.includes("boss.variant = 'umbraMarshal'"));
assert.ok(encounters.includes("'siphon-node-a'") && encounters.includes("'siphon-node-b'"));
assert.ok(director.includes("state.sectors[0].label = 'SERVICE COLLAR'"));
assert.ok(director.includes("state.sectors[1].label = 'PROPELLANT GALLERY'"));
assert.ok(director.includes("state.sectors[2].label = 'UMBRA TANK FARM'"));
assert.ok(director.includes("deployHazard(state, 980, 520, 'boiloffJet', 6.5)"));
assert.ok(director.includes("deployHazard(state, 1370, 620, 'boiloffJet', 6)"));
assert.ok(director.includes('CRYOGENIC BOILOFF // SERVICE GALLERY PURGE PLUME LIVE'));
assert.ok(director.includes('RESERVE PRESSURE RISE // SECONDARY BOILOFF PURGE'));
assert.ok(interdiction.includes("location: 'cryo-reserve'"));
assert.ok(interdiction.includes("mode: 'thermal-routing'"));
assert.ok(interdiction.includes("deepTarget: 'Umbra Systems Marshal Oren Saal'"));

for (const marker of [
  "environmentVisual = 'procedural-cryo-reserve-babylon'",
  "environmentLandmark = 'staggered-vacuum-jacket-tank-gallery'",
  "environmentComposition = 'service-collar+propellant-gallery+umbra-tank-farm'",
  "environmentZoneIdentity = 'service-collar:valve-service+vacuum-jacket|gallery:staggered-tanks+boiloff-headers+purge-plumes|tank-farm:tank-saddles+umbra-manifold+siphon-bus'",
  "environmentMaterials = 'vacuum-jacketed-steel+frosted-insulation+cold-blue-purge+cold-cyan-service'",
  "environmentPurgeTimeline = '10.0s:first-boiloff>21.0s:secondary-purge'",
  "environmentHazardLanguage = 'shared-hazards+boiloff-jet+limited-atmosphere+damaged-grid+purge-routing'",
  "locationArtIdentity = 'tank-gallery|vacuum-jacketed-cryogenic|cold-blue|purge-service'",
  "interactableBiome = 'cryo-reserve'",
  "bossPresentation = umbraMarshal ? 'oren-saal' : 'reserve-command'",
  "bossSilhouette = 'purge-manifold+cold-siphon-spines+marshal-core'",
  "bossCue = 'purge-lance+bus-siphon+bus-reroute'",
  "babylonCryoReserveParity = 'tank-gallery-architecture+cryogenic-materials+props+interactables+hazards+boiloff-purges+purge-valves+siphon-relays+navigation+boss-cues+shared-world-cues'",
]) assert.ok(presentation.includes(marker), 'missing Cryo Reserve parity marker: ' + marker);

assert.ok(presentation.includes("object.id === 'purge-valve-a'"));
assert.ok(presentation.includes("object.id === 'purge-valve-b'"));
assert.ok(presentation.includes("hazard.active && hazard.kind === 'boiloffJet'"));
assert.ok(presentation.includes("['purgeLance', 'busSiphon', 'busReroute'].includes(activeBoss.bossPattern)"));
assert.ok(babylon.includes("import { BabylonCryoReservePresentation } from './babylonCryoReservePresentation';"));
assert.ok(babylon.includes("const cryoReserveScenario = mission.location === 'cryo-reserve';"));
assert.ok(babylon.includes("this.cryoReservePresentation.sync(state, budget, mission.conditions.includes('low-visibility'));"));
assert.ok(babylon.includes('momentum-exchange,cryo-reserve'));
assert.ok(babylon.includes('this.worldPresentation.sync(state, mission, budget.detailScale);'));
assert.ok(smoke.includes('async function p27C9BabylonCryoReserveAudit()'));
assert.ok(smoke.includes('BROWSER_P27C9_BABYLON_CRYO_RESERVE_PASS'));
assert.ok(smoke.includes("else if (targetLocation === 'cryo-reserve') await p27C9BabylonCryoReserveAudit();"));
assert.ok(workflow.includes("interdiction.step = 1"));
assert.ok(workflow.includes('BROWSER_E2E_GRAPHICS_PATH=babylon BROWSER_E2E_LOCATION=cryo-reserve'));
assert.ok(workflow.includes('p27c9-cryo-reserve.png'));
assert.ok(pkg.scripts['test:babylon-cryo-reserve']);
assert.ok(pkg.scripts.build.includes('npm run test:babylon-cryo-reserve'));

console.log('BABYLON_CRYO_RESERVE_PASS identity=tank-gallery|vacuum-jacketed-cryogenic|cold-blue|purge-service routes=' + navigation.routes.length + ' landmarks=' + navigation.landmarks.map(item => item.label).join('|') + ' purge=10s>21s valves=2');
