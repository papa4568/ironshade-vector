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

const rendererSource = readFileSync(resolve(process.cwd(), 'src/game/threeCombatRenderer.ts'), 'utf8');
const browserSmokeSource = readFileSync(resolve(process.cwd(), 'scripts/browser-runtime-smoke.mjs'), 'utf8');
const androidSmokeSource = readFileSync(resolve(process.cwd(), 'scripts/android-runtime-smoke.mjs'), 'utf8');
const browserWorkflowSource = readFileSync(resolve(process.cwd(), '.github/workflows/browser-e2e.yml'), 'utf8');

assert(
  rendererSource.includes("dataset.refineryAtmosphereQa === 'off'")
    && rendererSource.includes('new THREE.Fog(REFINERY_ATMOSPHERE_PROFILE.fogColor, range.near, range.far)')
    && rendererSource.includes('refineryAtmosphereTelemetry(lowVisibility, budget.refineryAtmosphereScale)')
    && rendererSource.includes("'off:qa-baseline'")
    && rendererSource.includes("'off:adaptive-budget'"),
  'P21-D2 must apply a refinery-scoped linear depth fog with an explicit deterministic QA bypass.',
);
assert(
  rendererSource.includes("dataset.refineryContactDepthQa === 'off'")
    && rendererSource.includes("dataset.refineryAtmosphereQa === 'off'")
    && !rendererSource.includes("dataset.refineryAtmosphereQa = this.renderer.domElement.dataset.refineryContactDepthQa"),
  'P21-D2 atmosphere control must remain independent from the P21-D1 contact-grounding toggle.',
);
assert(
  rendererSource.includes("REFINERY_ATMOSPHERE_PROFILE.protectedCueGroups.join('+')")
    && rendererSource.includes("delete this.renderer.domElement.dataset.environmentAtmosphere")
    && rendererSource.includes("delete this.renderer.domElement.dataset.environmentAtmosphereProtected"),
  'P21-D2 must publish and clean up its readability telemetry with the refinery environment lifecycle.',
);
assert(
  browserSmokeSource.includes('BROWSER_P21D2_ATMOSPHERE_PASS')
    && browserSmokeSource.includes("canvas.dataset.refineryAtmosphereQa = 'off'")
    && browserSmokeSource.includes('p21d2-atmosphere-off')
    && browserSmokeSource.includes('p21d2-atmosphere-on'),
  'P21-D2 Browser E2E must capture deterministic atmosphere off/on evidence.',
);
assert(
  androidSmokeSource.includes('ANDROID_P21D2_ATMOSPHERE_PASS')
    && androidSmokeSource.includes('ANDROID_P21D2_ATMOSPHERE_RESUME_PASS'),
  'P21-D2 Android fast smoke must cover production atmosphere and lifecycle stability.',
);
assert(
  browserWorkflowSource.includes('browser-e2e-${{ matrix.viewport }}-p21d2-atmosphere-*.png'),
  'P21-D2 Browser E2E must retain the deterministic off/on screenshots as workflow evidence.',
);

console.log(`P21D2_REFINERY_ATMOSPHERE_PASS fog=${refineryAtmosphereTelemetry(false)} lowVisibility=${lowVisibility.near.toFixed(1)}-${lowVisibility.far.toFixed(1)} protected=${REFINERY_ATMOSPHERE_PROFILE.protectedCueGroups.join('+')}`);
