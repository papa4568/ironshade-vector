import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REFINERY_ATMOSPHERE_PROFILE, refineryAtmosphereExposureScale, refineryAtmosphereRange, refineryAtmosphereTelemetry } from '../src/game/refineryAtmosphere';
function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }
const normal=refineryAtmosphereRange(false); const low=refineryAtmosphereRange(true); const balanced=refineryAtmosphereRange(false,0.68);
assert(normal.near >= 16 && normal.far > normal.near + 18, 'refinery fog must preserve the combat foreground');
assert(low.near < normal.near && low.far < normal.far, 'low-visibility contracts must tighten depth range');
assert(balanced.near > normal.near && balanced.far > normal.far, 'reduced atmosphere budget must move fog away from combat');
assert(refineryAtmosphereExposureScale(0.68) > REFINERY_ATMOSPHERE_PROFILE.exposureScale && refineryAtmosphereExposureScale(0.68) < 1, 'reduced atmosphere budget must soften exposure treatment');
assert(refineryAtmosphereTelemetry(false).includes('refinery-depth-atmosphere-v1'), 'atmosphere telemetry must publish deterministic recipe');
const postSource=readFileSync(resolve(process.cwd(),'src/game/babylonRefineryPostProcessing.ts'),'utf8');
const browserSmokeSource=readFileSync(resolve(process.cwd(),'scripts/browser-runtime-smoke.mjs'),'utf8');
const androidSmokeSource=readFileSync(resolve(process.cwd(),'scripts/android-runtime-smoke.mjs'),'utf8');
assert(postSource.includes('this.scene.fogMode = Scene.FOGMODE_LINEAR') && postSource.includes('refineryAtmosphereRange(lowVisibility, budget.atmosphereScale)'), 'Babylon must apply refinery-scoped linear depth fog');
assert(postSource.includes("qaExplicit && this.canvas.dataset.refineryPostStackQa === 'off'"), 'atmosphere QA bypass must remain explicit and deterministic');
assert(postSource.includes("this.canvas.dataset.environmentAtmosphereProtected = REFINERY_ATMOSPHERE_PROFILE.protectedCueGroups.join('+')") && postSource.includes("'environmentAtmosphereProtected'"), 'atmosphere telemetry must publish and clean up protected groups');
assert(browserSmokeSource.includes('BROWSER_P21D2_ATMOSPHERE_PASS') && androidSmokeSource.includes('ANDROID_P21D2_ATMOSPHERE_PASS'), 'atmosphere browser/Android QA must remain present');
console.log(`P21D2_REFINERY_ATMOSPHERE_PASS owner=babylon fog=${refineryAtmosphereTelemetry(false)} protected=${REFINERY_ATMOSPHERE_PROFILE.protectedCueGroups.join('+')}`);
