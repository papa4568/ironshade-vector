import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createRefineryContactDepthAlphaData,
  REFINERY_CONTACT_DEPTH_PROFILE,
  refineryContactDepthTelemetry,
} from '../src/game/refineryContactDepth';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(REFINERY_CONTACT_DEPTH_PROFILE.opacity > 0 && REFINERY_CONTACT_DEPTH_PROFILE.opacity <= 0.3, 'P21-D1 contact depth must stay restrained enough to avoid muddying combat reads.');
assert(REFINERY_CONTACT_DEPTH_PROFILE.alphaTextureSize <= 32, 'P21-D1 alpha footprint must remain mobile-conscious.');
assert(REFINERY_CONTACT_DEPTH_PROFILE.instanceLimit <= 10, 'P21-D1 contact instances must remain tightly bounded.');
assert(REFINERY_CONTACT_DEPTH_PROFILE.instanceLimit * REFINERY_CONTACT_DEPTH_PROFILE.trianglesPerInstance <= 20, 'P21-D1 contact geometry must remain bounded to 20 triangles.');
assert(REFINERY_CONTACT_DEPTH_PROFILE.drawCalls === 1, 'P21-D1 contact depth must remain one instanced draw call.');

const alpha = createRefineryContactDepthAlphaData();
const size = REFINERY_CONTACT_DEPTH_PROFILE.alphaTextureSize;
const alphaAt = (x: number, y: number) => alpha[(y * size + x) * 4 + 3];
assert(alpha.length === size * size * 4, 'P21-D1 contact alpha texture must stay at its bounded RGBA size.');
assert(alphaAt(Math.floor(size / 2), Math.floor(size / 2)) > 220, 'P21-D1 contact alpha must stay strongest at machinery contact centers.');
assert(alphaAt(0, 0) === 0 && alphaAt(size - 1, size - 1) === 0, 'P21-D1 contact alpha must feather fully out at the quad corners.');
assert(
  refineryContactDepthTelemetry(10) === 'grounding:refinery-contact-grounding-v1:instances-10:triangles-20:draws-1:alpha-32:opacity-0.26',
  'P21-D1 runtime telemetry must publish the bounded scene cost.',
);

const rendererSource = readFileSync(resolve(process.cwd(), 'src/game/threeCombatRenderer.ts'), 'utf8');
const browserSmokeSource = readFileSync(resolve(process.cwd(), 'scripts/browser-runtime-smoke.mjs'), 'utf8');
const androidSmokeSource = readFileSync(resolve(process.cwd(), 'scripts/android-runtime-smoke.mjs'), 'utf8');

assert(
  rendererSource.includes('new THREE.DataTexture(')
    && rendererSource.includes('this.authoredEnvironmentRoot.add(contactShadows)')
    && rendererSource.includes('REFINERY_CONTACT_DEPTH_PROFILE.instanceLimit')
    && rendererSource.includes('refineryContactDepthTelemetry(this.refineryContactShadows.count)'),
  'P21-D1 must remain a refinery-scoped instanced soft-grounding pass instead of a full-screen post-process.',
);
assert(
  rendererSource.includes("this.renderer.domElement.dataset.graphicsPathSelection === 'qa-explicit'")
    && rendererSource.includes("this.renderer.domElement.dataset.refineryContactDepthQa === 'off'")
    && rendererSource.includes('environmentContactDepth = qaDisabled')
    && rendererSource.includes("'off:qa-baseline'"),
  'P21-D1 deterministic disabling must be restricted to explicit graphics QA mode.',
);
assert(
  rendererSource.includes("REFINERY_CONTACT_DEPTH_PROFILE.protectedCueGroups.join('+')")
    && REFINERY_CONTACT_DEPTH_PROFILE.protectedCueGroups.join('+') === 'hud+enemies+hazards+objectives+loot+interactables',
  'P21-D1 must publish the gameplay/UI groups that stay outside the scene grounding pass.',
);
assert(
  rendererSource.includes('this.refineryContactDepthTexture.dispose()')
    && rendererSource.includes('delete this.renderer.domElement.dataset.environmentContactDepth')
    && rendererSource.includes('delete this.renderer.domElement.dataset.environmentContactDepthProtected'),
  'P21-D1 contact-depth resources and telemetry must cleanly tear down with the authored refinery environment.',
);
assert(
  browserSmokeSource.includes('BROWSER_P21D1_CONTACT_DEPTH_PASS')
    && browserSmokeSource.includes("canvas.dataset.refineryContactDepthQa = 'off'")
    && browserSmokeSource.includes('p21d1-contact-off')
    && browserSmokeSource.includes('p21d1-contact-on'),
  'P21-D1 Browser E2E must capture deterministic contact-depth off/on evidence.',
);
assert(
  androidSmokeSource.includes('ANDROID_P21D1_CONTACT_DEPTH_PASS')
    && androidSmokeSource.includes('ANDROID_P21D1_CONTACT_DEPTH_RESUME_PASS'),
  'P21-D1 Android fast smoke must cover production contact depth and pause/resume stability.',
);

console.log(`P21D1_REFINERY_CONTACT_DEPTH_PASS technique=${REFINERY_CONTACT_DEPTH_PROFILE.technique} instances=${REFINERY_CONTACT_DEPTH_PROFILE.instanceLimit} triangles=${REFINERY_CONTACT_DEPTH_PROFILE.instanceLimit * REFINERY_CONTACT_DEPTH_PROFILE.trianglesPerInstance} draws=${REFINERY_CONTACT_DEPTH_PROFILE.drawCalls} alpha=${REFINERY_CONTACT_DEPTH_PROFILE.alphaTextureSize} opacity=${REFINERY_CONTACT_DEPTH_PROFILE.opacity.toFixed(2)} protected=${REFINERY_CONTACT_DEPTH_PROFILE.protectedCueGroups.join('+')}`);
