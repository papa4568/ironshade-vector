import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  BABYLON_MOMENTUM_EXCHANGE_IDENTITY,
  BABYLON_MOMENTUM_EXCHANGE_LIGHTING,
  momentumExchangeCaptureState,
  momentumExchangeRenderProfile,
  momentumExchangeWashMode,
} from '../src/game/babylonMomentumExchangePresentation';
import { getMapNavigationPlan } from '../src/game/mapNavigation';

const three = readFileSync('src/game/threeCombatRenderer.ts', 'utf8');
const babylon = readFileSync('src/game/babylonCombatRenderer.ts', 'utf8');
const presentation = readFileSync('src/game/babylonMomentumExchangePresentation.ts', 'utf8');
const encounters = readFileSync('src/game/encounters.ts', 'utf8');
const director = readFileSync('src/game/director.ts', 'utf8');
const campaign = readFileSync('src/game/campaign.ts', 'utf8');
const smoke = readFileSync('scripts/browser-runtime-smoke.mjs', 'utf8');
const workflow = readFileSync('.github/workflows/browser-e2e.yml', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };

assert.deepEqual(BABYLON_MOMENTUM_EXCHANGE_IDENTITY, {
  silhouette: 'flywheel-lane',
  material: 'magnetic-machinery',
  lighting: 'transfer-blue',
  propSet: 'capture-service',
});
assert.ok(three.includes("'momentum-exchange': { id: 'transfer-blue', keyColor: 0xd4e5ed, rimColor: 0x67b5d5, emergencyColor: 0x4d90ac, keyIntensity: 2.3, rimIntensity: 1.16, emergencyIntensity: 8.2, exposure: 1.06 }"));
assert.deepEqual(BABYLON_MOMENTUM_EXCHANGE_LIGHTING, {
  id: 'transfer-blue',
  keyColor: 0xd4e5ed,
  rimColor: 0x67b5d5,
  emergencyColor: 0x4d90ac,
  keyIntensity: 2.3,
  rimIntensity: 1.16,
  emergencyIntensity: 8.2,
  exposure: 1.06,
});

assert.equal(momentumExchangeWashMode(0), 'nominal');
assert.equal(momentumExchangeWashMode(1), 'countermass-wash');
assert.equal(momentumExchangeCaptureState(0, 2), 'armed');
assert.equal(momentumExchangeCaptureState(1, 2), 'partial');
assert.equal(momentumExchangeCaptureState(2, 2), 'loaded');
assert.equal(momentumExchangeCaptureState(0, 0), 'offline');

const full = momentumExchangeRenderProfile(1, false);
const mobile = momentumExchangeRenderProfile(1, true);
const performance = momentumExchangeRenderProfile(0.5, false);
assert.equal(full.name, 'full');
assert.equal(full.flywheelInstances, 3);
assert.equal(full.serviceFrameInstances, 6);
assert.equal(full.transferRailInstances, 4);
assert.equal(full.impulseBandInstances, 3);
assert.equal(mobile.name, 'mobile');
assert.equal(mobile.serviceFrameInstances, 4);
assert.equal(mobile.impulseBandInstances, 2);
assert.equal(performance.name, 'performance');
assert.equal(performance.transferRailInstances, 2);
assert.equal(performance.impulseBandInstances, 1);

const navigation = getMapNavigationPlan('momentum-exchange');
assert.equal(navigation.routes.length, 8);
assert.deepEqual(navigation.landmarks.map(item => item.label), ['BRAKE DECK', 'TRANSFER TUNNEL', 'COUNTERMASS CRADLE']);

assert.ok(encounters.includes("addObject(state, coverObject('momentum-rail-a', 'Electromagnetic transfer rail A'"));
assert.ok(encounters.includes("addObject(state, coverObject('momentum-baffle', 'Countermass service baffle'"));
assert.ok(encounters.includes("addAt('capture-drum-a', 'Inbound capture drum'"));
assert.ok(encounters.includes("addAt('capture-drum-b', 'Outbound capture drum'"));
assert.ok(director.includes("state.sectors[1].gravity = 0.05"));
assert.ok(director.includes("deployHazard(state, 1050, 520, 'vectorWash', 6)"));
assert.ok(director.includes('COUNTERMASS WASH // TRANSFER LANE IMPULSE FRONT LIVE'));
assert.ok(director.includes('TRANSFER REVERSAL // SECOND COUNTERMASS WASH CROSSING LANE'));
assert.ok(campaign.includes('The cislunar exchange uses long electromagnetic transfer lanes and counter-rotating flywheels'));

for (const marker of [
  "environmentVisual = 'procedural-momentum-exchange-babylon'",
  "environmentComposition = 'brake-deck+near-zero-g-transfer-tunnel+countermass-cradle'",
  "environmentZoneIdentity = 'brake:flywheel-housings+capture-collar|tunnel:electromagnetic-rails+near-zero-g+countermass-wash|cradle:counterweight-cradle+reference-bus'",
  "environmentMaterials = 'magnetic-machinery+brushed-ferrous+transfer-blue+capture-cyan'",
  "environmentCountermassTimeline = '9.0s:first-wash>20.0s:transfer-reversal'",
  "environmentHazardLanguage = 'shared-hazards+countermass-wash+vector-wash+near-zero-g+magnetic-transfer'",
  "locationArtIdentity = 'flywheel-lane|magnetic-machinery|transfer-blue|capture-service'",
  "interactableBiome = 'momentum-exchange'",
  "bossPresentation = adjudicator ? 'iona-vale' : 'neris-vane'",
  "bossSilhouette = 'brake-crown+counterweights+transfer-core'",
  "bossCue = 'brake-wave+partition-sweep+recoil-vector'",
  "babylonMomentumExchangeParity = 'flywheel-transfer-architecture+magnetic-machinery+props+interactables+hazards+countermass-washes+capture-drums+navigation+boss-cues+shared-world-cues'",
]) assert.ok(presentation.includes(marker), 'missing Momentum Exchange parity marker: ' + marker);

assert.ok(presentation.includes("object.id === 'capture-drum-a'"));
assert.ok(presentation.includes("object.id === 'capture-drum-b'"));
assert.ok(presentation.includes("hazard.active && hazard.kind === 'vectorWash'"));
assert.ok(presentation.includes("['brakeWave', 'partitionSweep', 'recoilVector'].includes(activeBoss.bossPattern)"));
assert.ok(babylon.includes("import { BabylonMomentumExchangePresentation } from './babylonMomentumExchangePresentation';"));
assert.ok(babylon.includes("const momentumExchangeScenario = mission.location === 'momentum-exchange';"));
assert.ok(babylon.includes("this.momentumExchangePresentation.sync(state, budget, mission.conditions.includes('low-visibility'));"));
assert.ok(babylon.includes("ported:asteroid-refinery,orbital-station,damaged-vessel,spin-habitat,jovian-harvester,ice-mine,solar-yard,lattice-annex,momentum-exchange"));
assert.ok(babylon.includes('this.worldPresentation.sync(state, mission, quality);'));
assert.ok(smoke.includes('async function p27C8BabylonMomentumExchangeAudit()'));
assert.ok(smoke.includes('BROWSER_P27C8_BABYLON_MOMENTUM_EXCHANGE_PASS'));
assert.ok(smoke.includes("else if (targetLocation === 'momentum-exchange') await p27C8BabylonMomentumExchangeAudit();"));
assert.ok(workflow.includes("interdiction.status = 'active'"));
assert.ok(workflow.includes('BROWSER_E2E_GRAPHICS_PATH=babylon BROWSER_E2E_LOCATION=momentum-exchange'));
assert.ok(workflow.includes('p27c8-momentum-exchange.png'));
assert.ok(pkg.scripts['test:babylon-momentum-exchange']);
assert.ok(pkg.scripts.build.includes('npm run test:babylon-momentum-exchange'));

console.log('BABYLON_MOMENTUM_EXCHANGE_PASS identity=flywheel-lane|magnetic-machinery|transfer-blue|capture-service routes=' + navigation.routes.length + ' landmarks=' + navigation.landmarks.map(item => item.label).join('|') + ' washes=9s>20s capture=2');
