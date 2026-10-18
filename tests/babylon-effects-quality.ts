import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import {
  BABYLON_AMBIENT_FLAGSHIP_COUNTS,
  BABYLON_AMBIENT_WORLD_SCALE,
  BABYLON_REFINERY_AMBIENT_CUE_CLEARANCE,
  BABYLON_REFINERY_AMBIENT_ZONES,
  BabylonAmbientParticles,
  babylonAmbientParticleBudget,
  type BabylonAmbientParticleKind,
} from '../src/game/babylonAmbientParticles';
import { AdaptiveRenderBudget } from '../src/game/renderQuality';
import { getWorldSize } from '../src/game/sim';

const high = new AdaptiveRenderBudget(false).sample(16.7, 1, 'flagship');
const phoneDefault = new AdaptiveRenderBudget(true).sample(16.7, 1, 'adaptive');
const balancedBudget = new AdaptiveRenderBudget(true);
let balanced = balancedBudget.sample(16.7, 1, 'adaptive');
for (let frame = 0; frame < 90 && balanced.tierName === 'high'; frame += 1) {
  balanced = balancedBudget.sample(30, 1, 'adaptive');
}
const performance = new AdaptiveRenderBudget(false).sample(16.7, 1, 'performance');

assert.equal(phoneDefault.tierName, 'high', 'P28-A0 coarse/mobile input must start with the complete Babylon effects stack before measured frame pressure.');
assert.deepEqual(
  {
    tier: high.tierName,
    shadow: high.shadows ? high.shadowMapSize : 0,
    transparency: high.transparencyScale,
    reflection: high.reflectionScale,
    vfx: high.vfxDensity,
    secondary: high.secondaryEffectScale,
    critical: high.gameplayCueScale,
  },
  { tier: 'high', shadow: 1024, transparency: 1, reflection: 1, vfx: 1, secondary: 1, critical: 1 },
  'High must preserve the complete Babylon effects stack.',
);
assert.deepEqual(
  {
    tier: balanced.tierName,
    shadow: balanced.shadows ? balanced.shadowMapSize : 0,
    transparency: balanced.transparencyScale,
    reflection: balanced.reflectionScale,
    vfx: balanced.vfxDensity,
    secondary: balanced.secondaryEffectScale,
    critical: balanced.gameplayCueScale,
  },
  { tier: 'balanced', shadow: 512, transparency: 0.68, reflection: 0.7, vfx: 0.72, secondary: 0.68, critical: 1 },
  'Balanced must reduce Babylon effects cost after measured pressure while keeping gameplay-critical cues full-strength.',
);
assert.deepEqual(
  {
    tier: performance.tierName,
    shadow: performance.shadows ? performance.shadowMapSize : 0,
    transparency: performance.transparencyScale,
    reflection: performance.reflectionScale,
    vfx: performance.vfxDensity,
    secondary: performance.secondaryEffectScale,
    critical: performance.gameplayCueScale,
  },
  { tier: 'performance', shadow: 0, transparency: 0.4, reflection: 0.38, vfx: 0.45, secondary: 0.42, critical: 1 },
  'Performance must shed shadows and aggressively reduce secondary Babylon effects before required combat information.',
);

assert(high.refineryIblScale > balanced.refineryIblScale && balanced.refineryIblScale > performance.refineryIblScale, 'Babylon reflection/IBL cost must decrease by tier.');
assert(high.refineryBloomScale > balanced.refineryBloomScale && balanced.refineryBloomScale > performance.refineryBloomScale, 'Babylon post-processing bloom cost must decrease by tier.');
assert(high.refineryContactDepthScale > balanced.refineryContactDepthScale && balanced.refineryContactDepthScale > performance.refineryContactDepthScale, 'Babylon contact-depth cost must decrease by tier.');
assert(high.refineryAtmosphereScale > balanced.refineryAtmosphereScale && balanced.refineryAtmosphereScale > performance.refineryAtmosphereScale, 'Babylon atmosphere cost must decrease by tier.');

const adaptive = new AdaptiveRenderBudget(false);
let adaptiveSnapshot = adaptive.sample(16.7, 1, 'adaptive');
for (let index = 0; index < 140; index += 1) adaptiveSnapshot = adaptive.sample(30, 1, 'adaptive');
assert.equal(adaptiveSnapshot.tierName, 'performance', 'sustained representative slow frames must degrade Babylon effects through Balanced to Performance.');
assert.equal(adaptiveSnapshot.runtimeTierName, 'performance', 'sustained representative slow frames must create measured runtime pressure, not merely a requested quality floor.');
assert.equal(adaptiveSnapshot.gameplayCueScale, 1, 'degradation must not weaken gameplay-critical cues.');
const measuredPressure = adaptiveSnapshot;
for (let index = 0; index < 620; index += 1) adaptiveSnapshot = adaptive.sample(16.1, 1, 'adaptive');
assert.equal(adaptiveSnapshot.tierName, 'high', 'sustained recovered frame pacing must deterministically recover Babylon effects to High.');
assert.equal(adaptiveSnapshot.gameplayCueScale, 1, 'recovery must keep the protected gameplay cue scale unchanged.');

const flagshipAmbient = babylonAmbientParticleBudget(high);
const requestedPerformanceAmbient = babylonAmbientParticleBudget(performance);
const measuredPressureAmbient = babylonAmbientParticleBudget(measuredPressure);
assert.equal(flagshipAmbient.scale, 1, 'Flagship ambience must start at the authored density.');
assert.deepEqual(flagshipAmbient.counts, BABYLON_AMBIENT_FLAGSHIP_COUNTS, 'Flagship ambience must expose the complete authored pool.');
assert.equal(performance.tierName, 'performance');
assert.equal(performance.runtimeTierName, 'high');
assert.deepEqual(
  requestedPerformanceAmbient.counts,
  BABYLON_AMBIENT_FLAGSHIP_COUNTS,
  'P28-E1 must not pre-cap ambient density merely because a quality preference selected Performance; reduction is measured-pressure recovery only.',
);
assert.deepEqual(
  measuredPressureAmbient.counts,
  { dust: 54, sparks: 20, vapor: 10, debris: 17 },
  'Measured runtime pressure may reduce ambient instance activity while retaining every ambient family.',
);
assert.equal(measuredPressure.gameplayCueScale, 1, 'Ambient reduction must remain independent of gameplay cue scale.');

const refineryKinds = Object.keys(BABYLON_REFINERY_AMBIENT_ZONES) as BabylonAmbientParticleKind[];
const refineryContexts = new Set(refineryKinds.flatMap(kind => BABYLON_REFINERY_AMBIENT_ZONES[kind].map(zone => zone.context)));
assert.deepEqual(
  [...refineryContexts].sort(),
  ['damaged-service', 'machinery', 'open-industrial', 'vents'],
  'P28-E2 must explicitly cover machinery, vents, damaged service areas, and open industrial spaces.',
);
const refineryZoneCount = refineryKinds.reduce((sum, kind) => sum + BABYLON_REFINERY_AMBIENT_ZONES[kind].length, 0);
assert.equal(refineryZoneCount, 21, 'P28-E2 refinery art direction must retain the complete deterministic 21-zone layout.');
for (const kind of refineryKinds) {
  for (const zone of BABYLON_REFINERY_AMBIENT_ZONES[kind]) {
    const overlapsProtectedCenter = zone.x + zone.radiusX > BABYLON_REFINERY_AMBIENT_CUE_CLEARANCE.xMin
      && zone.x - zone.radiusX < BABYLON_REFINERY_AMBIENT_CUE_CLEARANCE.xMax
      && zone.z + zone.radiusZ > BABYLON_REFINERY_AMBIENT_CUE_CLEARANCE.zMin
      && zone.z - zone.radiusZ < BABYLON_REFINERY_AMBIENT_CUE_CLEARANCE.zMax;
    assert.equal(overlapsProtectedCenter, false, `P28-E2 ${kind}/${zone.id} must stay out of the protected central combat corridor.`);
  }
}

{
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const canvas = { dataset: {} } as HTMLCanvasElement;
  const ambient = new BabylonAmbientParticles(scene, canvas);
  try {
    ambient.sync(high, 'asteroid-refinery');
    assert.equal(canvas.dataset.babylonAmbientParticleState, 'active');
    assert.equal(canvas.dataset.babylonAmbientParticles, 'pooled:dust+sparks+vapor+debris');
    assert.equal(canvas.dataset.babylonAmbientParticleCounts, 'dust:128/128|sparks:48/48|vapor:24/24|debris:40/40');
    assert.equal(canvas.dataset.babylonAmbientParticlePoolSize, '240');
    assert.equal(scene.textures.filter(texture => texture.name.includes('refinery-local-effects-f5.ktx2')).length, 0,
      'P28-F5 must defer decorative KTX2 decode until the combat frame bootstrap completes.');
    for (let warmup = 0; warmup < 240; warmup += 1) ambient.sync(high, 'asteroid-refinery');
    assert.equal(scene.textures.filter(texture => texture.name.includes('refinery-local-effects-f5.ktx2')).length, 1,
      'P28-F5 four ambient pools must share one GPU texture after staged warmup.');
    assert.equal(canvas.dataset.babylonAmbientParticleDrawFamilies, '4');
    assert.equal(canvas.dataset.babylonAmbientGameplayCuePolicy, 'independent:1.00');
    assert.equal(canvas.dataset.babylonAmbientParticleSimulationOwnership, 'read-only-presentation');
    assert.equal(canvas.dataset.babylonAmbientParticleArtDirection, 'refinery-industrial-v1');
    assert.equal(canvas.dataset.babylonAmbientParticleZones, '21:damaged-service+machinery+open-industrial+vents');
    assert.equal(canvas.dataset.babylonAmbientParticleCueClearance, 'center:x38-62+z38-62+presentation-only');
    const pooledInstances = scene.meshes.filter(mesh => /^p28-e1-(dust|sparks|vapor|debris)-\d+$/.test(mesh.name));
    assert.equal(pooledInstances.length, 240, 'P28-E1 must allocate one reusable flagship pool instead of creating per-frame particle meshes.');
    assert.equal(pooledInstances.filter(mesh => mesh.isEnabled()).length, 240, 'Healthy Flagship rendering must keep the complete ambient pool active.');

    const world = getWorldSize();
    const worldW = world.w * BABYLON_AMBIENT_WORLD_SCALE;
    const worldH = world.h * BABYLON_AMBIENT_WORLD_SCALE;
    for (const kind of refineryKinds) {
      const instances = scene.meshes.filter(mesh => new RegExp(`^p28-e1-${kind}-\\d+$`).test(mesh.name));
      assert.equal(instances.length, BABYLON_AMBIENT_FLAGSHIP_COUNTS[kind]);
      for (const particle of instances) {
        const normalizedX = particle.position.x / worldW;
        const normalizedZ = particle.position.z / worldH;
        const zones = BABYLON_REFINERY_AMBIENT_ZONES[kind];
        assert.ok(
          zones.some(zone => Math.abs(normalizedX - zone.x) <= zone.radiusX + 1e-6
            && Math.abs(normalizedZ - zone.z) <= zone.radiusZ + 1e-6),
          `P28-E2 ${particle.name} escaped its authored ${kind} zones at ${normalizedX.toFixed(3)},${normalizedZ.toFixed(3)}.`,
        );
        const insideProtectedCenter = normalizedX > BABYLON_REFINERY_AMBIENT_CUE_CLEARANCE.xMin
          && normalizedX < BABYLON_REFINERY_AMBIENT_CUE_CLEARANCE.xMax
          && normalizedZ > BABYLON_REFINERY_AMBIENT_CUE_CLEARANCE.zMin
          && normalizedZ < BABYLON_REFINERY_AMBIENT_CUE_CLEARANCE.zMax;
        assert.equal(insideProtectedCenter, false, `P28-E2 ${particle.name} entered the protected central combat corridor.`);
      }
    }

    ambient.sync(performance, 'asteroid-refinery');
    assert.equal(canvas.dataset.babylonAmbientParticleHostTier, 'performance');
    assert.equal(canvas.dataset.babylonAmbientParticleRuntimeTier, 'high');
    assert.equal(canvas.dataset.babylonAmbientParticleScale, '1.00');
    assert.equal(canvas.dataset.babylonAmbientParticleCounts, 'dust:128/128|sparks:48/48|vapor:24/24|debris:40/40');
    assert.equal(canvas.dataset.babylonAmbientParticleArtDirection, 'refinery-industrial-v1');

    ambient.sync(measuredPressure, 'asteroid-refinery');
    assert.equal(canvas.dataset.babylonAmbientParticleRuntimeTier, 'performance');
    assert.equal(canvas.dataset.babylonAmbientParticleScale, '0.42');
    assert.equal(canvas.dataset.babylonAmbientParticleCounts, 'dust:54/128|sparks:20/48|vapor:10/24|debris:17/40');
    assert.equal(
      pooledInstances.filter(mesh => mesh.isEnabled()).length,
      101,
      'Measured pressure must deactivate pooled ambient instances without reallocating the pool.',
    );

    const firstDust = scene.getMeshByName('p28-e1-dust-0');
    assert.ok(firstDust);
    ambient.sync(high, 'orbital-station');
    assert.equal(firstDust.isDisposed(), true, 'Location switches must release the previous ambient pool before rebuilding for another location owner.');
    assert.notEqual(scene.getMeshByName('p28-e1-dust-0'), firstDust, 'A released location pool must not leak stale Babylon instances.');
    assert.equal(canvas.dataset.babylonAmbientParticleArtDirection, 'shared-world-default');
    assert.equal(canvas.dataset.babylonAmbientParticleCueClearance, 'gameplay-cues-independent');

    ambient.release('scenario-exit');
    assert.equal(canvas.dataset.babylonAmbientParticleState, 'released');
    assert.equal(canvas.dataset.babylonAmbientParticlePoolSize, '0');
    assert.equal(scene.textures.filter(texture => texture.name.includes('refinery-local-effects-f5.ktx2')).length, 0,
      'P28-F5 refinery exit must release the shared atlas exactly once.');
    assert.equal(scene.meshes.some(mesh => mesh.name.startsWith('p28-e1-')), false, 'Scenario release must reclaim every ambient source and instance mesh.');
    assert.equal(scene.materials.some(material => material.name.startsWith('p28-e1-')), false, 'Scenario release must reclaim every ambient material.');

    ambient.sync(high, 'asteroid-refinery');
    assert.equal(canvas.dataset.babylonAmbientParticlePoolSize, '240', 'Re-entry must rebuild a complete pool after deterministic teardown.');
    assert.equal(canvas.dataset.babylonAmbientParticleArtDirection, 'refinery-industrial-v1');
  } finally {
    // Production renderer teardown calls the refinery owner's release first, then dispose.
    ambient.release('renderer-dispose');
    ambient.dispose();
    assert.equal(canvas.dataset.babylonAmbientParticleState, 'disposed');
    assert.equal(scene.meshes.some(mesh => mesh.name.startsWith('p28-e1-')), false, 'Renderer disposal must leave no ambient mesh resources behind.');
    assert.equal(scene.materials.some(material => material.name.startsWith('p28-e1-')), false, 'Renderer disposal must leave no ambient material resources behind.');
    scene.dispose();
    engine.dispose();
  }
}

const rendererSource = readFileSync('src/game/babylonCombatRenderer.ts', 'utf8');
const weaponSource = readFileSync('src/game/babylonWeaponVfx.ts', 'utf8');
const abilitySource = readFileSync('src/game/babylonAbilityVfx.ts', 'utf8');
const lightingSource = readFileSync('src/game/babylonRefineryLighting.ts', 'utf8');
const postSource = readFileSync('src/game/babylonRefineryPostProcessing.ts', 'utf8');
const ambientSource = readFileSync('src/game/babylonAmbientParticles.ts', 'utf8');
const browserSource = readFileSync('scripts/browser-runtime-smoke.mjs', 'utf8');
const packageSource = readFileSync('package.json', 'utf8');

assert(rendererSource.includes('this.syncEffectsRuntimeBudget(budget)'), 'Babylon renderer must expose one effects budget every combat frame.');
assert(rendererSource.includes('this.abilityVfx.sync(state, budget.vfxDensity, budget.transparencyScale)'), 'Babylon ability secondary VFX must consume VFX-density and transparency budgets.');
assert(rendererSource.includes('this.weaponVfx.sync(state, muzzlePosition, budget.vfxDensity, budget.transparencyScale)'), 'Babylon weapon secondary VFX must consume VFX-density and transparency budgets.');
assert(rendererSource.includes('this.enemyTelegraphs.sync(state, quality)'), 'Enemy attack telegraphs must stay on the protected gameplay-information path.');
assert(rendererSource.includes('this.protocolStatusVisuals.sync(state, quality)'), 'Protocol/status readability must stay on the protected gameplay-information path.');
assert(rendererSource.includes('this.enemyLifecycleVisuals.sync(state, mobileTargetId, quality, reducedTargetMotion)'), 'Lifecycle/readiness cues must stay on the protected gameplay-information path.');

assert(weaponSource.includes('profile.trailAlpha * secondaryScale * transparencyScale'), 'Projectile trails must scale secondary transparency.');
assert(weaponSource.includes('visual.coreMaterial.alpha = 1'), 'Projectile cores must stay fully readable while trail transparency sheds cost.');
assert(weaponSource.includes("effectsMode === 'reduced' ? 0 : 0.78 * fade * transparencyScale"), 'Impact sparks must shed secondary transparency and disappear at reduced VFX density.');

assert(abilitySource.includes('dodging ? 0.72 : (0.26 + speedScale * 0.16) * transparencyScale'), 'Non-dodge mobility trails must scale transparency while the dodge cue remains protected.');
assert(abilitySource.includes('0.62 * fade * (criticalGlyph ? 1 : transparencyScale)'), 'Ability secondary glyph transparency must scale without weakening critical class/mark glyphs.');
assert(abilitySource.includes('this.syncSkill(state)') && abilitySource.includes('this.syncPulse(state)'), 'Core class-skill and pulse cues must stay outside the secondary VFX scaler.');

assert(lightingSource.includes("shadowMapSize: !budget.shadows || tierName === 'performance' ? 0 : tierName === 'high' ? 2048 : 1024"), 'Babylon refinery shadows must preserve adaptive tier shedding while allowing the P28-A4 flagship quality uplift.');
assert(lightingSource.includes('iblEnabled: budget.refineryIblScale >= 0.5'), 'Babylon reflection/IBL cost must follow the adaptive contract.');
assert(postSource.includes('refineryBloomScale') && postSource.includes('refineryContactDepthScale') && postSource.includes('refineryAtmosphereScale'), 'Babylon post-processing components must consume the adaptive secondary-effect scales.');
assert(postSource.includes('gameplayCueScale: budget.gameplayCueScale'), 'Babylon post-processing must preserve the protected gameplay cue scale.');
assert(postSource.includes("this.ambientParticles.sync(renderBudget, 'asteroid-refinery')"), 'The refinery owner must synchronize shared ambient particles with the same measured render budget.');
assert(postSource.includes('this.ambientParticles.release(reason)'), 'Location teardown must release the ambient pool through the established refinery lifecycle.');
assert(postSource.includes('this.ambientParticles.dispose()'), 'Renderer teardown must dispose the ambient presentation owner.');
assert(ambientSource.includes('RUNTIME_PRESSURE_SCALE[budget.runtimeTierName]'), 'Ambient density reduction must be driven by measured runtime pressure, not a fixed requested tier cap.');
assert(ambientSource.includes("const refinery = this.locationKey === 'asteroid-refinery'"), 'P28-E2 must apply refinery-specific presentation art direction only to the refinery location.');
assert(ambientSource.includes("context: 'machinery'") && ambientSource.includes("context: 'vents'") && ambientSource.includes("context: 'damaged-service'") && ambientSource.includes("context: 'open-industrial'"), 'P28-E2 source must retain every authored refinery ambience context.');
assert(!ambientSource.includes('SimState'), 'Ambient animation must remain presentation-owned and must not read or mutate simulation state.');

assert(browserSource.includes('BROWSER_P27D4_BABYLON_EFFECTS_QUALITY_PASS'), 'Browser QA must record measured D4 frame-time/effects evidence.');
assert(packageSource.includes('test:babylon-effects-quality'), 'The production build must execute the D4/P28-E1/P28-E2 targeted regression.');


const reflectionSource = readFileSync('src/game/babylonRefineryReflectionProbes.ts', 'utf8');
const reflectionRendererSource = readFileSync('src/game/babylonCombatRenderer.ts', 'utf8');
assert(reflectionSource.includes('REFINERY_REFLECTION_PROFILE')
  && reflectionSource.includes("['processor', 'gantry', 'terminal']"),
  'P28-E4 localized probes must follow authored focal machinery families rather than a fixed global count.');
assert(reflectionSource.includes('this.scene.customRenderTargets.push(record.probe.cubeTexture)')
  && reflectionSource.includes('this.scene.customRenderTargets.splice(targetIndex, 1)'),
  'P28-E4 six-face captures must register with and release from the real Babylon render-target lifecycle.');
assert(reflectionSource.includes("budget.tierName !== 'performance'")
  && reflectionSource.includes("this.canvas.dataset.refineryReflectionQa === 'capture'")
  && reflectionSource.includes("'active-materials:' + activeMaterials"),
  'P28-E4 must expose measured-pressure fallback, explicit QA capture, and actual local-PBR bindings.');
assert(reflectionRendererSource.includes('this.refineryReflectionProbes.sync(budget)')
  && reflectionRendererSource.includes('this.refineryReflectionProbes.configure(reflectionAnchors, loadRoot)')
  && reflectionRendererSource.includes('this.refineryReflectionProbes.release()'),
  'P28-E4 must connect static refinery capture, frame budgets and teardown to the real renderer.');

// P28-F4 visual regression: make the image-grade workflow exercise the actual
// refinery prop content, not only the ambience that happens to surround it.
const dressingManifest = readFileSync('src/game/graphicsAssetManifest.ts', 'utf8');
const dressingFamilies = ['valveSkid', 'junctionBox', 'ventBank', 'toolCart', 'canisterRack', 'guardRail', 'hoseReel', 'serviceCabinet'];
const dressingIds = ['valve-skid', 'junction-box', 'vent-bank', 'tool-cart', 'canister-rack', 'guard-rail', 'hose-reel', 'service-cabinet'];
assert.equal(new Set(dressingIds).size, 8, 'P28-F4 must supply eight different authored visual prop assets.');
for (const [index, family] of dressingFamilies.entries()) {
  const id = dressingIds[index];
  assert(dressingManifest.includes("'/assets/models/environments/refinery-dressing-" + id + "-lod0.glb'"), family + ' must be packaged in the Flagship refinery presentation.');
  assert(reflectionRendererSource.includes(family + ': ['), family + ' must have a deterministic Deep Salvage placement.');
}
assert(reflectionRendererSource.includes('this.canvas.dataset.refineryDressingInstances')
  && reflectionRendererSource.includes('this.applyRefineryDressingSurfaces(instance)')
  && reflectionRendererSource.includes('node.isPickable = false'),
  'P28-F4 must expose concrete model placements and non-pickable premium PBR presentation without taking combat cues.');

console.log(
  'P27_D4_BABYLON_EFFECTS_QUALITY_PASS phoneDefault=high tiers=high>balanced>performance shadows=1024>512>off transparency=1.00>0.68>0.40 reflection=1.00>0.70>0.38 vfx=1.00>0.72>0.45 secondary=1.00>0.68>0.42 critical=1.00 degrade=performance recover=high ambient=240-pooled measured-pressure=101 refinery-art-direction=21-zones contexts=machinery+vents+damaged-service+open-industrial center-clearance=x38-62+z38-62 gameplay-independent=1.00 teardown=clean frame-evidence=browser-runtime',
);
