import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { BABYLON_SOLAR_YARD_IDENTITY, BABYLON_SOLAR_YARD_LIGHTING, solarYardThermalState } from '../src/game/babylonSolarYardPresentation';
import { getMapNavigationPlan } from '../src/game/mapNavigation';
import { solarYardRenderProfile } from '../src/game/solarYardVisualProfile';

const babylon = readFileSync('src/game/babylonCombatRenderer.ts', 'utf8');
const presentation = readFileSync('src/game/babylonSolarYardPresentation.ts', 'utf8');
const smoke = readFileSync('scripts/browser-runtime-smoke.mjs', 'utf8');
const workflow = readFileSync('.github/workflows/browser-e2e.yml', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };

assert.deepEqual(BABYLON_SOLAR_YARD_IDENTITY, {
  silhouette: 'panel-clamps',
  material: 'heat-shielded-alloy',
  lighting: 'solar-orange',
  propSet: 'fabrication-service',
});
assert.deepEqual(BABYLON_SOLAR_YARD_LIGHTING, {
  id: 'solar-orange',
  keyColor: 0xffc89a,
  rimColor: 0xef8f46,
  emergencyColor: 0xe27745,
  keyIntensity: 2.55,
  rimIntensity: 1.14,
  emergencyIntensity: 8.8,
  exposure: 1.1,
});

assert.deepEqual(solarYardThermalState(12, false), { surge: true, mode: 'solar-surge', protection: 'solar-surge-exposed' });
assert.deepEqual(solarYardThermalState(12, true), { surge: false, mode: 'hard-sun', protection: 'radiant-load-cut' });
assert.deepEqual(solarYardThermalState(8, false), { surge: false, mode: 'hard-sun', protection: 'shutters-open' });

const full = solarYardRenderProfile(1, false);
const mobile = solarYardRenderProfile(1, true);
const performance = solarYardRenderProfile(0.5, false);
assert.equal(full.name, 'full');
assert.equal(full.ceramicDeckInstances, 6);
assert.equal(full.trussFrameInstances, 5);
assert.equal(full.radiatorTowerInstances, 4);
assert.equal(full.gantryCraneInstances, 2);
assert.equal(full.sunPatchInstances, 3);
assert.equal(mobile.name, 'mobile');
assert.equal(mobile.ceramicDeckInstances, 4);
assert.equal(mobile.gantryCraneInstances, 2);
assert.equal(mobile.sunPatchInstances, 2);
assert.equal(performance.name, 'performance');
assert.equal(performance.gantryCraneInstances, 1);
assert.equal(performance.sunPatchInstances, 1);

const navigation = getMapNavigationPlan('solar-yard');
assert.equal(navigation.routes.length, 8);
assert.deepEqual(navigation.landmarks.map(item => item.label), ['SHADE GANTRY', 'FABRICATION SPINE', 'SUNWARD YARD']);

for (const marker of [
  "environmentVisual = 'procedural-solar-yard-babylon'",
  "environmentComposition = 'shade-service-deck+fabrication-spine+sunward-work-yard'",
  "environmentZoneIdentity = 'shade:ceramic-deck+radiator-towers+thermal-shutter|spine:truss-frames+sinter-forges+transfer-rails+gantry-cranes|sunward:reflector-pylons+printer-spindles+feedstock-presses'",
  "environmentMaterials = 'ceramic-shell+scorched-steel+black-radiator+solar-gold+heat-amber'",
  "environmentSunShadow = 'hard-sun+cool-shade+long-shadow'",
  "environmentSunDirection = 'fixed-sunward-east-to-west'",
  "environmentThermalShutterControl = 'solar-shutter:state-linked'",
  "environmentThermalWindow = '10.0-18.0s:shutter-gated'",
  "environmentHazardLanguage = 'shared-hazards+solar-surge+thermal-shutter+radiator-saturation+crane-runaway'",
  "interactableBiome = 'solar-yard'",
  "bossPresentation = 'helios-9'",
  "bossSilhouette = 'sunshield-crown+reflector-wings+fabricator-core'",
  "bossPalette = 'ceramic-white+solar-gold+heat-amber+overheat-red-phase-two'",
  "babylonSolarYardParity = 'panel-clamp-architecture+heat-materials+props+interactables+hazards+thermal-shutter+transport+navigation+boss-cues+shared-world-cues'",
]) assert.ok(presentation.includes(marker), 'missing Solar Yard parity marker: ' + marker);

assert.ok(presentation.includes("state.eventText.includes('RADIATOR SATURATION')"));
assert.ok(presentation.includes("state.eventText.includes('MACHINERY RUNAWAY')"));
assert.ok(presentation.includes('Math.sin(state.time * item.speed + item.phase) * item.amplitude'));
assert.ok(babylon.includes("import { BabylonSolarYardPresentation } from './babylonSolarYardPresentation';"));
assert.ok(babylon.includes("const solarYardScenario = mission.location === 'solar-yard';"));
assert.ok(babylon.includes("this.solarYardPresentation.sync(state, budget, mission.conditions.includes('low-visibility'));"));
assert.ok(babylon.includes("ported:asteroid-refinery,orbital-station,damaged-vessel,spin-habitat,jovian-harvester,ice-mine,solar-yard"));
assert.ok(babylon.includes('this.worldPresentation.sync(state, mission, budget.detailScale);'));
assert.ok(smoke.includes('async function p27C6BabylonSolarYardAudit()'));
assert.ok(smoke.includes('BROWSER_P27C6_BABYLON_SOLAR_YARD_PASS'));
assert.ok(smoke.includes("else if (targetLocation === 'solar-yard') await p27C6BabylonSolarYardAudit();"));
assert.ok(workflow.includes('BROWSER_E2E_GRAPHICS_PATH=babylon BROWSER_E2E_LOCATION=solar-yard'));
assert.ok(workflow.includes('p27c6-solar-yard.png'));
assert.ok(pkg.scripts['test:babylon-solar-yard']);
assert.ok(pkg.scripts.build.includes('npm run test:babylon-solar-yard'));

console.log('BABYLON_SOLAR_YARD_PASS identity=panel-clamps|heat-shielded-alloy|solar-orange|fabrication-service routes=' + navigation.routes.length + ' landmarks=' + navigation.landmarks.map(item => item.label).join('|') + ' thermal=shutter-gated transport=gantry-cranes boss=helios-9');
