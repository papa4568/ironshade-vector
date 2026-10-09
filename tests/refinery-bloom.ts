import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MISSION_VISUAL_FALLBACK_TIMEOUT_MS, resolveMissionVisualReadiness } from '../src/game/babylonRefineryMissionReadiness';
import { clampRefineryBloomCostScale, isRefineryBloomAssetLabel, REFINERY_BLOOM_PROFILE, refineryBloomResolutionScale, refineryBloomStrengthForCost } from '../src/game/refineryBloomProfile';
function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }
assert(REFINERY_BLOOM_PROFILE.strength > 0 && REFINERY_BLOOM_PROFILE.strength < 0.7, 'bloom strength must stay bounded');
assert(REFINERY_BLOOM_PROFILE.radius > 0 && REFINERY_BLOOM_PROFILE.radius < 0.5, 'bloom radius must stay bounded');
assert(clampRefineryBloomCostScale(-1) === 0 && clampRefineryBloomCostScale(2) === 1, 'bloom cost must clamp to 0..1');
assert(refineryBloomResolutionScale(0) === 0 && refineryBloomResolutionScale(0.35) < refineryBloomResolutionScale(1), 'bloom resolution cost must degrade predictably');
assert(refineryBloomStrengthForCost(0.35) < refineryBloomStrengthForCost(1), 'reduced cost must reduce secondary glow strength');
for (const source of ['refinery-terminal', 'refinery-processor', 'refinery-pipe-rack', 'refinery-cable-tray', 'refinery-service-conduit', 'refinery-smelter-gantry']) assert(isRefineryBloomAssetLabel(source), `authored machinery emissive must remain an explicit bloom source: ${source}`);
for (const excluded of ['refinery-floor', 'refinery-bulkhead', 'refinery-crate', 'objective', 'loot', 'hazard', 'interactable', 'enemy']) assert(!isRefineryBloomAssetLabel(excluded), `protected/non-emissive source leaked into bloom selection: ${excluded}`);

const readinessLoading = resolveMissionVisualReadiness({
  refinery: true,
  elapsedMs: 250,
  environmentState: 'loading',
  environmentError: undefined,
  worldState: 'ready',
  mappedCount: 6,
  authoredCount: 2,
  fallbackCount: 0,
});
assert(readinessLoading.phase === 'loading' && readinessLoading.shell === 'loading' && readinessLoading.world === 'loading', 'P28-PLOAD0 must keep combat gated while either critical shell or mapped world visuals are unresolved.');
const readinessAuthored = resolveMissionVisualReadiness({
  refinery: true,
  elapsedMs: 900,
  environmentState: 'ready',
  environmentError: undefined,
  worldState: 'ready',
  mappedCount: 6,
  authoredCount: 6,
  fallbackCount: 0,
});
assert(readinessAuthored.phase === 'ready' && readinessAuthored.mode === 'authored', 'P28-PLOAD0 must release mission play once authored shell and gameplay-critical world visuals are settled.');
const readinessAssetFailure = resolveMissionVisualReadiness({
  refinery: true,
  elapsedMs: 900,
  environmentState: 'error',
  environmentError: 'authored-shell-load-failed',
  worldState: 'ready',
  mappedCount: 6,
  authoredCount: 5,
  fallbackCount: 1,
});
assert(readinessAssetFailure.phase === 'ready' && readinessAssetFailure.mode === 'fallback' && readinessAssetFailure.reason === 'authored-shell-load-failed', 'P28-PLOAD0 authored failures must deterministically degrade to the fallback field rather than hang deployment.');
const readinessTimeout = resolveMissionVisualReadiness({
  refinery: true,
  elapsedMs: MISSION_VISUAL_FALLBACK_TIMEOUT_MS,
  environmentState: 'loading',
  environmentError: undefined,
  worldState: 'ready',
  mappedCount: 6,
  authoredCount: 1,
  fallbackCount: 0,
});
assert(readinessTimeout.phase === 'ready' && readinessTimeout.mode === 'fallback' && readinessTimeout.reason === 'readiness-timeout', 'P28-PLOAD0 must have a bounded timeout path that exposes only deterministic fallback visuals.');
assert(MISSION_VISUAL_FALLBACK_TIMEOUT_MS > 0 && MISSION_VISUAL_FALLBACK_TIMEOUT_MS <= 10_000, 'P28-PLOAD0 readiness timeout must remain bounded for cold route entry.');

const postSource = readFileSync(resolve(process.cwd(), 'src/game/babylonRefineryPostProcessing.ts'), 'utf8');
const backendSource = readFileSync(resolve(process.cwd(), 'src/game/combatGraphicsBackend.ts'), 'utf8');
const readinessSource = readFileSync(resolve(process.cwd(), 'src/game/babylonRefineryMissionReadiness.ts'), 'utf8');
const gateSource = readFileSync(resolve(process.cwd(), 'src/game/missionVisualReadinessGate.ts'), 'utf8');
const browserSmokeSource = readFileSync(resolve(process.cwd(), 'scripts/browser-runtime-smoke.mjs'), 'utf8');
const androidSmokeSource = readFileSync(resolve(process.cwd(), 'scripts/android-runtime-smoke.mjs'), 'utf8');
assert(postSource.includes("new GlowLayer('p27-b12-refinery-selective-bloom'") && postSource.includes('excludeByDefault: true'), 'Babylon refinery bloom must remain selective rather than full-scene');
assert(postSource.includes('this.glow.isEnabled = bloomEnabled') && postSource.includes('this.glow.intensity = budget.bloomStrength') && postSource.includes('this.glow.blurKernelSize = budget.bloomKernelSize'), 'Babylon bloom must follow adaptive cost controls');
assert(postSource.includes("this.canvas.dataset.environmentBloomExcluded = REFINERY_BLOOM_PROFILE.excludedCueGroups.join('+')"), 'Babylon bloom telemetry must publish protected cue groups');
assert(postSource.includes("qaExplicit && this.canvas.dataset.refineryPostStackQa === 'off'"), 'deterministic post-stack disabling must remain QA-only');
assert(postSource.includes('this.glow.dispose()'), 'Babylon glow resources must dispose with the renderer');
assert(backendSource.includes('createMissionVisualFrameGate(canvas)') && backendSource.includes("this.missionVisualGate.block('backend-fallback')"), 'P28-PLOAD0 must install the freeze gate before async Babylon readiness and re-arm it during backend recovery.');
assert(gateSource.includes('view.requestAnimationFrame = patched') && gateSource.includes('callback(this.frozenTimestamp)'), 'P28-PLOAD0 must keep rendering frames while freezing the fixed-step animation clock.');
assert(gateSource.includes("addEventListener('keydown', this.onBlockedKeyDown, true)") && gateSource.includes('getGamepads'), 'P28-PLOAD0 must suppress direct keyboard/gamepad combat input while the mission field is gated.');
assert(gateSource.includes("'pointerdown', 'pointermove', 'pointerup', 'pointercancel'") && gateSource.includes('this.onBlockedPointerInput') && gateSource.includes("pointerEvents: 'none'"), 'P28-PLOAD0 must suppress covered pointer/touch input at capture time without making the opaque loading cover corrupt control hit-geometry inspection.');
assert(gateSource.includes("new URLSearchParams(search).get('graphicsCompare') === '1'") && gateSource.includes('if (!event.isTrusted || this.qaPointerObservation) return;') && gateSource.includes('event.stopImmediatePropagation()'), 'P28-PLOAD0 must keep trusted production pointer/touch input blocked while allowing observation probes only in explicit graphics-comparison QA mode.');
assert(gateSource.includes('missionVisualLoadingOverlay') && gateSource.includes('COMBAT INPUT HELD UNTIL THE PLAYABLE FIELD IS READABLE'), 'P28-PLOAD0 must cover the interactive HUD with an explicit deterministic loading presentation.');
assert(readinessSource.includes('missionKey !== this.missionKey') && readinessSource.includes("this.visualGate.block(reentry ? 'route-transition' : 'authored-assets')"), 'P28-PLOAD0 route transition/re-entry must reset readiness instead of leaking a stale ready generation.');
assert(readinessSource.includes("this.canvas.dataset.missionVisualGuard = 'active-loading';\n      this.visualGate.block('authored-assets');"), 'P28-PLOAD0 must re-arm the visual gate if adaptive runtime changes make a previously ready shell incomplete again.');
assert(readinessSource.includes('p28-pload0-readiness-floor') && readinessSource.includes('refineryWorldObjectFamilyKey(object)'), 'P28-PLOAD0 timeout/failure fallback must retain a visible floor shell and gameplay-critical mapped-object landmarks.');
assert(readinessSource.includes('p28-pload0-player-fallback-body') && readinessSource.includes('babylonPlayerAuthoredState') && readinessSource.includes("'procedural-fallback-babylon'"), 'P28-PLOAD0 must keep a deterministic visible player proxy across post-readiness authored LOD swaps instead of exposing a partial field.');
assert(browserSmokeSource.includes('BROWSER_P21C_BLOOM_PASS') && androidSmokeSource.includes('ANDROID_P21C_BLOOM_PASS'), 'historical bloom QA coverage must remain wired to the shipped Babylon path');
console.log(`P21C_REFINERY_BLOOM_PASS owner=babylon strength=${REFINERY_BLOOM_PROFILE.strength.toFixed(2)} radius=${REFINERY_BLOOM_PROFILE.radius.toFixed(2)} protected=${REFINERY_BLOOM_PROFILE.excludedCueGroups.join('+')}`);
console.log(`P28_PLOAD0_MISSION_VISUAL_READINESS_PASS timeoutMs=${MISSION_VISUAL_FALLBACK_TIMEOUT_MS} authored=${readinessAuthored.mode} fallback=${readinessAssetFailure.mode}`);
