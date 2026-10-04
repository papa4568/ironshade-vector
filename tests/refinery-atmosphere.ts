import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  REFINERY_ATMOSPHERE_PROFILE,
  refineryAtmosphereExposureScale,
  refineryAtmosphereRange,
  refineryAtmosphereTelemetry,
} from '../src/game/refineryAtmosphere';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const normal = refineryAtmosphereRange(false);
const lowVisibility = refineryAtmosphereRange(true);
const balanced = refineryAtmosphereRange(false, 0.68);
assert(normal.near >= 16, 'P21-D2 refinery fog must leave the foreground combat plane substantially clear.');
assert(normal.far > normal.near + 18, 'P21-D2 refinery fog must create a bounded background depth band rather than a near-field wash.');
assert(lowVisibility.near < normal.near && lowVisibility.far < normal.far, 'P21-D2 low-visibility contracts must tighten the authored depth range.');
assert(balanced.near > normal.near && balanced.far > normal.far, 'P21-E reduced atmosphere budgets must move fog depth away from the combat foreground.');
assert(refineryAtmosphereExposureScale(0.68) > REFINERY_ATMOSPHERE_PROFILE.exposureScale && refineryAtmosphereExposureScale(0.68) < 1, 'P21-E reduced atmosphere budgets must soften the authored exposure treatment without changing critical cues.');
assert(REFINERY_ATMOSPHERE_PROFILE.exposureScale >= 0.95 && REFINERY_ATMOSPHERE_PROFILE.exposureScale <= 1, 'P21-D2 color treatment must remain restrained.');
assert(
  refineryAtmosphereTelemetry(false) === 'fog:refinery-depth-atmosphere-v1:near-18.0:far-42.0:color-160d08:exposure-0.98',
  'P21-D2 runtime telemetry must publish the deterministic refinery atmosphere recipe.',
);
assert(
  REFINERY_ATMOSPHERE_PROFILE.protectedCueGroups.join('+') === 'hud+enemies+hazards+objectives+loot+interactables',
  'P21-D2 must preserve the established gameplay/UI readability groups.',
);
const browserSmokeSource = readFileSync(resolve(process.cwd(), 'scripts/browser-runtime-smoke.mjs'), 'utf8');
const androidSmokeSource = readFileSync(resolve(process.cwd(), 'scripts/android-runtime-smoke.mjs'), 'utf8');
const browserWorkflowSource = readFileSync(resolve(process.cwd(), '.github/workflows/browser-e2e.yml'), 'utf8');
assert(
  browserSmokeSource.includes('BROWSER_P21D2_ATMOSPHERE_PASS')
    && browserSmokeSource.includes("canvas.dataset.refineryAtmosphereQa = 'off'")
    && browserSmokeSource.includes('p21d2-atmosphere-off')
    && browserSmokeSource.includes('p21d2-atmosphere-on'),
  'P21-D2 historical Browser E2E helpers must remain available until P27-D9 removes the dormant Three implementation.',
);
assert(
  androidSmokeSource.includes('ANDROID_P21D2_ATMOSPHERE_PASS')
    && androidSmokeSource.includes('ANDROID_P21D2_ATMOSPHERE_RESUME_PASS'),
  'P21-D2 Android fast smoke must cover production atmosphere and lifecycle stability.',
);
assert(
  !browserWorkflowSource.includes('browser-e2e-${{ matrix.viewport }}-p21d2-atmosphere-*.png'),
  'P27-D8 Browser E2E must not publish Three-only atmosphere comparison evidence after the Three QA runtime path is retired.',
);

console.log(`P21D2_REFINERY_ATMOSPHERE_PASS fog=${refineryAtmosphereTelemetry(false)} lowVisibility=${lowVisibility.near.toFixed(1)}-${lowVisibility.far.toFixed(1)} protected=${REFINERY_ATMOSPHERE_PROFILE.protectedCueGroups.join('+')}`);
