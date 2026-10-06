import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  REFINERY_ATMOSPHERE_PROFILE,
  refineryAtmosphereContrast,
  refineryAtmosphereExposureScale,
  refineryAtmosphereRange,
  refineryAtmosphereTelemetry,
} from '../src/game/refineryAtmosphere';
function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }
const normal=refineryAtmosphereRange(false); const low=refineryAtmosphereRange(true); const balanced=refineryAtmosphereRange(false,0.68);
assert(normal.near >= 16 && normal.far > normal.near + 18, 'refinery fog must preserve the combat foreground');
assert(low.near < normal.near && low.far < normal.far, 'low-visibility contracts must tighten depth range');
assert(balanced.near > normal.near && balanced.far > normal.far, 'reduced atmosphere budget must move fog away from combat');
const normalExposure=refineryAtmosphereExposureScale(); const balancedExposure=refineryAtmosphereExposureScale(0.68); const lowExposure=refineryAtmosphereExposureScale(1,true);
assert(normalExposure === REFINERY_ATMOSPHERE_PROFILE.exposureScale && normalExposure > 1 && normalExposure <= 1.055, 'Flagship atmosphere must gently lift exposure while remaining bounded');
assert(balancedExposure < normalExposure && balancedExposure > 1, 'reduced atmosphere budget must soften the exposure lift toward neutral');
assert(lowExposure > normalExposure && lowExposure <= 1.08, 'low-visibility atmosphere must expose additional dark form without an unbounded highlight lift');
const normalContrast=refineryAtmosphereContrast(); const balancedContrast=refineryAtmosphereContrast(false,0.68); const lowContrast=refineryAtmosphereContrast(true);
assert(normalContrast === REFINERY_ATMOSPHERE_PROFILE.contrast && normalContrast < 1, 'Flagship atmosphere must ease contrast to retain dark-value separation');
assert(balancedContrast > normalContrast && balancedContrast < 1, 'reduced atmosphere budget must move contrast toward neutral');
assert(lowContrast < normalContrast && lowContrast >= 0.965, 'low-visibility atmosphere must preserve additional shadow separation');
const telemetry=refineryAtmosphereTelemetry(false);
assert(telemetry.includes('refinery-depth-atmosphere-v1') && telemetry.includes('grade-p28-a5-dark-separation-v1'), 'atmosphere telemetry must publish deterministic recipe and grade identity');
const postSource=readFileSync(resolve(process.cwd(),'src/game/babylonRefineryPostProcessing.ts'),'utf8');
const browserSmokeSource=readFileSync(resolve(process.cwd(),'scripts/browser-runtime-smoke.mjs'),'utf8');
const androidSmokeSource=readFileSync(resolve(process.cwd(),'scripts/android-runtime-smoke.mjs'),'utf8');
assert(postSource.includes('const atmosphere = refineryAtmosphereRange(lowVisibility, budget.refineryAtmosphereScale)') && postSource.includes('this.scene.fogMode = Scene.FOGMODE_LINEAR') && postSource.includes('this.scene.fogStart = budget.atmosphereNear') && postSource.includes('this.scene.fogEnd = budget.atmosphereFar'), 'Babylon must derive and apply refinery-scoped adaptive linear depth fog');
assert(postSource.includes('refineryAtmosphereContrast(lowVisibility, budget.refineryAtmosphereScale)') && postSource.includes('this.captureUpstreamImageProcessing()') && postSource.includes('this.restoreUpstreamImageProcessing()'), 'P28-A5 must keep the image grade stable and reversible around upstream scene processing');
assert(postSource.includes("qaExplicit && this.canvas.dataset.refineryPostStackQa === 'off'"), 'atmosphere QA bypass must remain explicit and deterministic');
assert(postSource.includes("this.canvas.dataset.environmentAtmosphereProtected = REFINERY_ATMOSPHERE_PROFILE.protectedCueGroups.join('+')") && postSource.includes("'environmentAtmosphereProtected'"), 'atmosphere telemetry must publish and clean up protected groups');
assert(browserSmokeSource.includes('BROWSER_P21D2_ATMOSPHERE_PASS') && androidSmokeSource.includes('ANDROID_P21D2_ATMOSPHERE_PASS'), 'atmosphere browser/Android QA must remain present');
console.log(`P21D2_REFINERY_ATMOSPHERE_PASS owner=babylon fog=${telemetry} protected=${REFINERY_ATMOSPHERE_PROFILE.protectedCueGroups.join('+')}`);
console.log(`P28_A5_REFINERY_ATMOSPHERE_GRADE_PASS exposure=${normalExposure.toFixed(3)} lowExposure=${lowExposure.toFixed(3)} contrast=${normalContrast.toFixed(3)} lowContrast=${lowContrast.toFixed(3)} adaptive=neutralward`);
