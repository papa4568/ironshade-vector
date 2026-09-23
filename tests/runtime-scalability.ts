import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { combatAudioBudget, combatAudioVoiceAdmission } from '../src/game/feedback';
import {
  RUNTIME_SCALABILITY_PROFILES,
  runtimeAnimationStride,
  runtimeAssetPreloadReady,
  runtimePoolTrimTarget,
} from '../src/game/runtimeScalability';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const high = RUNTIME_SCALABILITY_PROFILES.high;
const balanced = RUNTIME_SCALABILITY_PROFILES.balanced;
const performance = RUNTIME_SCALABILITY_PROFILES.performance;

assert(high.preloadConcurrency === 2 && balanced.preloadConcurrency === 1 && performance.preloadConcurrency === 1, 'mobile/performance preload must serialize while high tier keeps bounded parallelism');
assert(high.preloadAssetLimit > balanced.preloadAssetLimit && balanced.preloadAssetLimit > performance.preloadAssetLimit, 'asset preload residency must shrink with runtime pressure');
assert(high.preloadDelaySeconds < balanced.preloadDelaySeconds && balanced.preloadDelaySeconds < performance.preloadDelaySeconds, 'preload startup deferral must grow with runtime pressure');
assert(!runtimeAssetPreloadReady(3.6, balanced) && runtimeAssetPreloadReady(4.0, balanced), 'balanced/mobile preload must yield through the 3.6s deployment presentation window');
assert(!runtimeAssetPreloadReady(4.0, performance) && runtimeAssetPreloadReady(4.5, performance), 'performance preload must defer longer than balanced');
assert(high.poolRetention.effects > balanced.poolRetention.effects && balanced.poolRetention.effects > performance.poolRetention.effects, 'secondary visual pool retention must shrink by runtime tier');
assert(performance.poolRetention.damageNumbers >= 20, 'performance mode must retain enough pooled damage-number capacity for combat readability');

assert(runtimeAnimationStride({ tier: 'performance', role: 'boss', distance: 80, targeted: false, criticalCue: false }) === 1, 'boss animation must never be cadence-throttled');
assert(runtimeAnimationStride({ tier: 'performance', role: 'assault', distance: 80, targeted: true, criticalCue: false }) === 1, 'targeted enemies must animate every frame');
assert(runtimeAnimationStride({ tier: 'performance', role: 'assault', distance: 80, targeted: false, criticalCue: true }) === 1, 'telegraphs/status/damage lifecycle cues must animate every frame');
assert(runtimeAnimationStride({ tier: 'balanced', role: 'assault', distance: 80, targeted: false, criticalCue: false }) === 2, 'balanced mode should halve far standard-enemy authored rig work');
assert(runtimeAnimationStride({ tier: 'performance', role: 'assault', distance: 80, targeted: false, criticalCue: false }) === 3, 'performance mode should third-rate far standard-enemy authored rig work');
assert(runtimeAnimationStride({ tier: 'performance', role: 'elite', distance: 80, targeted: false, criticalCue: false }) === 2, 'far elite animation may only reduce to half cadence');

assert(runtimePoolTrimTarget(120, 8, 36) === 36, 'burst-grown secondary pools should trim back to tier retention');
assert(runtimePoolTrimTarget(42, 8, 36) === 42, 'small pool overshoot should be retained to avoid allocation thrash');
assert(runtimePoolTrimTarget(120, 60, 36) === 60, 'pool trimming must never remove active visuals');

assert(combatAudioVoiceAdmission(8, 2, 'tail', 'background').admitted, 'background audio should play while voice pressure is low');
assert(!combatAudioVoiceAdmission(combatAudioBudget.backgroundVoiceCeiling, 2, 'direct', 'background').admitted, 'background voices should virtualize before the main ceiling');
assert(!combatAudioVoiceAdmission(combatAudioBudget.normalVoiceCeiling, 2, 'direct', 'normal').admitted, 'normal voices should virtualize before important cues');
assert(combatAudioVoiceAdmission(combatAudioBudget.normalVoiceCeiling, 2, 'direct', 'important').admitted, 'important cues should retain the main voice budget');
assert(combatAudioVoiceAdmission(combatAudioBudget.maxVoices, combatAudioBudget.maxTailVoices, 'direct', 'critical').admitted, 'critical cues should use reserved voices above the main ceiling');
assert(!combatAudioVoiceAdmission(combatAudioBudget.maxVoices + combatAudioBudget.criticalReserveVoices, 0, 'direct', 'critical').admitted, 'critical voices must still obey the absolute ceiling');

const rendererSource = readFileSync(resolve(process.cwd(), 'src/game/threeCombatRenderer.ts'), 'utf8');
const graphicsSource = readFileSync(resolve(process.cwd(), 'src/game/graphicsAssets.ts'), 'utf8');
const canvasSource = readFileSync(resolve(process.cwd(), 'src/components/GameCanvas.tsx'), 'utf8');
const androidSmokeSource = readFileSync(resolve(process.cwd(), 'scripts/android-runtime-smoke.mjs'), 'utf8');

assert(rendererSource.includes('runtimeAnimationStride({') && rendererSource.includes('dataset.runtimeAnimationLod'), 'renderer must apply and expose authored enemy animation LOD');
assert(rendererSource.includes('runtimePoolTrimTarget(') && rendererSource.includes('dataset.runtimePools'), 'renderer must trim and expose burst-grown secondary pools');
assert(rendererSource.includes('runtimeAssetPreloadReady(state.time, profile)') && rendererSource.includes('dataset.assetStreaming = `startup-deferred:'), 'renderer must defer noncritical preload during combat startup');
assert(rendererSource.includes('preloadGraphicsAssets(') && rendererSource.includes('dataset.assetStreaming'), 'renderer must run bounded mission asset preload/streaming');
assert(graphicsSource.includes('export async function preloadGraphicsAssets') && graphicsSource.includes('workerCount'), 'graphics runtime must implement bounded-concurrency preload');
assert(canvasSource.includes('feedback.performanceStats()') && canvasSource.includes('dataset.audioVirtualization'), 'runtime QA must expose audio virtualization pressure');
assert(androidSmokeSource.includes('runtimeAnimationLod') && androidSmokeSource.includes('audioVirtualization') && androidSmokeSource.includes('assetStreaming') && androidSmokeSource.includes('runtimePools'), 'Android smoke must verify P16-C runtime telemetry');

console.log('RUNTIME_SCALABILITY_PASS pools=bounded animation=lod audio=virtualized assets=preloaded mechanics=preserved');
