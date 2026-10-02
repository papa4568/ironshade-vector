import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AdaptiveRenderBudget } from '../src/game/renderQuality';

const high = new AdaptiveRenderBudget(false).sample(16.7, 1, 'flagship');
const balanced = new AdaptiveRenderBudget(true).sample(16.7, 1, 'adaptive');
const performance = new AdaptiveRenderBudget(false).sample(16.7, 1, 'performance');

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
  'Balanced must reduce Babylon effects cost while keeping gameplay-critical cues full-strength.',
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
assert.equal(adaptiveSnapshot.gameplayCueScale, 1, 'degradation must not weaken gameplay-critical cues.');
for (let index = 0; index < 620; index += 1) adaptiveSnapshot = adaptive.sample(16.1, 1, 'adaptive');
assert.equal(adaptiveSnapshot.tierName, 'high', 'sustained recovered frame pacing must deterministically recover Babylon effects to High.');
assert.equal(adaptiveSnapshot.gameplayCueScale, 1, 'recovery must keep the protected gameplay cue scale unchanged.');

const rendererSource = readFileSync('src/game/babylonCombatRenderer.ts', 'utf8');
const weaponSource = readFileSync('src/game/babylonWeaponVfx.ts', 'utf8');
const abilitySource = readFileSync('src/game/babylonAbilityVfx.ts', 'utf8');
const lightingSource = readFileSync('src/game/babylonRefineryLighting.ts', 'utf8');
const postSource = readFileSync('src/game/babylonRefineryPostProcessing.ts', 'utf8');
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
assert(weaponSource.includes('effectsMode === \'reduced\' ? 0 : 0.78 * fade * transparencyScale'), 'Impact sparks must shed secondary transparency and disappear at reduced VFX density.');

assert(abilitySource.includes('dodging ? 0.72 : (0.26 + speedScale * 0.16) * transparencyScale'), 'Non-dodge mobility trails must scale transparency while the dodge cue remains protected.');
assert(abilitySource.includes('0.62 * fade * (criticalGlyph ? 1 : transparencyScale)'), 'Ability secondary glyph transparency must scale without weakening critical class/mark glyphs.');
assert(abilitySource.includes('this.syncSkill(state)') && abilitySource.includes('this.syncPulse(state)'), 'Core class-skill and pulse cues must stay outside the secondary VFX scaler.');

assert(lightingSource.includes('shadowMapSize: budget.shadows ? budget.shadowMapSize : 0'), 'Babylon shadow cost must follow the adaptive contract.');
assert(lightingSource.includes('iblEnabled: budget.refineryIblScale >= 0.5'), 'Babylon reflection/IBL cost must follow the adaptive contract.');
assert(postSource.includes('refineryBloomScale') && postSource.includes('refineryContactDepthScale') && postSource.includes('refineryAtmosphereScale'), 'Babylon post-processing components must consume the adaptive secondary-effect scales.');
assert(postSource.includes('gameplayCueScale: budget.gameplayCueScale'), 'Babylon post-processing must preserve the protected gameplay cue scale.');

assert(browserSource.includes('BROWSER_P27D4_BABYLON_EFFECTS_QUALITY_PASS'), 'Browser QA must record measured D4 frame-time/effects evidence.');
assert(packageSource.includes('test:babylon-effects-quality'), 'The production build must execute the D4 targeted regression.');

console.log(
  'P27_D4_BABYLON_EFFECTS_QUALITY_PASS tiers=high>balanced>performance shadows=1024>512>off transparency=1.00>0.68>0.40 reflection=1.00>0.70>0.38 vfx=1.00>0.72>0.45 secondary=1.00>0.68>0.42 critical=1.00 degrade=performance recover=high frame-evidence=browser-runtime',
);
