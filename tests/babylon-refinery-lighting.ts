import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Scene } from '@babylonjs/core/scene';
import {
  BabylonRefineryLighting,
  resolveBabylonRefineryLightingBudget,
} from '../src/game/babylonRefineryLighting';
import { AdaptiveRenderBudget } from '../src/game/renderQuality';
import { createSimulation, neutralCombatBuild } from '../src/game/sim';

const highSnapshot = new AdaptiveRenderBudget(false).sample(1000 / 60, 1, 'flagship');
const balancedSnapshot = new AdaptiveRenderBudget(false).sample(1000 / 60, 0.72, 'adaptive');
const performanceSnapshot = new AdaptiveRenderBudget(false).sample(1000 / 60, 0.5, 'performance');

const high = resolveBabylonRefineryLightingBudget(highSnapshot);
const balanced = resolveBabylonRefineryLightingBudget(balancedSnapshot);
const performance = resolveBabylonRefineryLightingBudget(performanceSnapshot);

assert.deepEqual(
  { tier: high.tierName, shadow: high.shadowMapSize, practical: high.practicalLightCount, lights: high.maxSimultaneousLights },
  { tier: 'high', shadow: 1024, practical: 2, lights: 6 },
  'High Babylon lighting budget must preserve full key shadow, practicals, and material light count.',
);
assert.deepEqual(
  { tier: balanced.tierName, shadow: balanced.shadowMapSize, practical: balanced.practicalLightCount, lights: balanced.maxSimultaneousLights },
  { tier: 'balanced', shadow: 512, practical: 2, lights: 5 },
  'Balanced Babylon lighting budget must reduce shadow resolution without dropping authored practical identity.',
);
assert.deepEqual(
  { tier: performance.tierName, shadow: performance.shadowMapSize, practical: performance.practicalLightCount, lights: performance.maxSimultaneousLights },
  { tier: 'performance', shadow: 0, practical: 1, lights: 3 },
  'Performance Babylon lighting budget must shed shadows and the secondary practical before critical readability.',
);
assert.equal(high.iblEnabled, true);
assert.equal(balanced.iblEnabled, true);
assert.equal(performance.iblEnabled, false);
assert(high.iblIntensity > balanced.iblIntensity && balanced.iblIntensity > performance.iblIntensity);

{
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const canvas = { dataset: {} } as HTMLCanvasElement;
  const material = new PBRMaterial('p27-b11-test-pbr', scene);
  const mesh = MeshBuilder.CreateBox('p27-b11-test-machine', { size: 1 }, scene);
  mesh.material = material;
  const state = createSimulation(structuredClone(neutralCombatBuild));
  const lighting = new BabylonRefineryLighting(scene, canvas);
  try {
    lighting.sync(state, performanceSnapshot);
    assert.equal(scene.imageProcessingConfiguration.toneMappingEnabled, true);
    assert.equal(scene.imageProcessingConfiguration.toneMappingType, ImageProcessingConfiguration.TONEMAPPING_ACES);
    assert.equal(scene.environmentTexture, null, 'Performance adaptive mode should shed refinery IBL.');
    assert.equal(canvas.dataset.environmentIbl, 'off:adaptive-budget');
    assert.equal(canvas.dataset.environmentShadowBudget, 'key:off');
    assert.match(canvas.dataset.babylonLightingBudget ?? '', /^tier:performance\|ibl:0\.38\|shadow:0\|practical:1\|max-lights:3$/);
    assert.match(canvas.dataset.babylonPbrMaterials ?? '', /^pbr:\d+\|standard:\d+\|max-lights:3$/);
    assert.equal(material.maxSimultaneousLights, 3);

    canvas.dataset.graphicsPathSelection = 'qa-explicit';
    canvas.dataset.refineryIblQa = 'on';
    lighting.sync(state, performanceSnapshot);
    assert.equal(scene.environmentTexture?.name, 'p27-b11-refinery-ibl', 'Explicit QA must allow deterministic stack-on capture even under a performance budget.');
    assert.match(canvas.dataset.environmentIbl ?? '', /^raw-cube:furnace-amber\+service-cyan:intensity-0\.26$/);

    canvas.dataset.refineryIblQa = 'off';
    lighting.sync(state, highSnapshot);
    assert.equal(scene.environmentTexture, null);
    assert.equal(canvas.dataset.environmentIbl, 'off:qa-baseline');
  } finally {
    lighting.dispose();
    scene.dispose();
    engine.dispose();
  }
}

const rendererSource = readFileSync('src/game/babylonCombatRenderer.ts', 'utf8');
const worldSource = readFileSync('src/game/babylonWorldPresentation.ts', 'utf8');
const iblSource = readFileSync('src/game/refineryIbl.ts', 'utf8');
const packageSource = readFileSync('package.json', 'utf8');

assert.match(rendererSource, /new AdaptiveRenderBudget\(coarse\)/, 'Babylon lighting must consume the shared adaptive render budget.');
assert.match(rendererSource, /new BabylonRefineryLighting\(scene, canvas\)/, 'Babylon renderer must own the B11 lighting layer.');
assert.match(rendererSource, /this\.refineryLighting\.sync\(state, budget\)/, 'Babylon renderer must synchronize B11 every refinery frame.');
assert.match(rendererSource, /this\.refineryLighting\.dispose\(\)/, 'Babylon renderer must deterministically release B11 GPU resources.');
assert.match(worldSource, /new PBRMaterial\('p27-b5-object-material-'/, 'Babylon refinery world fallback materials must use Babylon PBR.');
assert.match(worldSource, /visual\.material\.metallic =/, 'Babylon world material response must preserve authored metalness.');
assert.match(worldSource, /visual\.material\.roughness =/, 'Babylon world material response must preserve authored roughness.');
assert.match(iblSource, /from '.\/refineryLightingProfile'/, 'Three and Babylon refinery IBL must share the authored environment profile.');
assert.match(packageSource, /test:babylon-refinery-lighting/, 'Production build must execute the B11 regression.');

console.log('P27_B11_BABYLON_PBR_LIGHTING_PASS pbr=authored+procedural ibl=shared-amber-cyan tone=aces shadows=1024>512>off practicals=2>2>1 qa-capture=toggleable adaptive=shared-budget');
