import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  formatLocationFrameCostSignature,
  LOCATION_FRAME_COST_ROUTES,
  LOCATION_FRAME_COST_SIGNATURE_VERSION,
  normalizeProductionRenderQuality,
  resolveRenderDowngradeReason,
} from '../src/game/combatGraphicsBackend';
import { AdaptiveRenderBudget, MAX_MEASURED_FRAME_MS, SUSPEND_GAP_MS } from '../src/game/renderQuality';
import { spinHabitatRenderProfile } from '../src/game/spinHabitatArchitecture';
import { jovianHarvesterRenderProfile } from '../src/game/jovianHarvesterVisualLanguage';
import { solarYardRenderProfile } from '../src/game/solarYardVisualProfile';
import { perseidRenderProfile } from '../src/game/perseidCapstone';
import { k91RenderProfile } from '../src/game/k91Capstone';
import { orphelineRenderProfile } from '../src/game/orphelineCapstone';
import { hecateRenderProfile } from '../src/game/hecateCapstone';
function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }
const gameCanvasSource=readFileSync(resolve(process.cwd(),'src/components/GameCanvas.tsx'),'utf8');
const armorySource=readFileSync(resolve(process.cwd(),'src/components/Armory.tsx'),'utf8');
const boundarySource=readFileSync(resolve(process.cwd(),'src/game/combatGraphicsBackend.ts'),'utf8')+readFileSync(resolve(process.cwd(),'src/game/combatGraphicsBackendCore.ts'),'utf8');
const rendererSource=readFileSync(resolve(process.cwd(),'src/game/babylonCombatRenderer.ts'),'utf8');
const assetsSource=readFileSync(resolve(process.cwd(),'src/game/babylonGraphicsAssets.ts'),'utf8');
const worldSource=readFileSync(resolve(process.cwd(),'src/game/babylonWorldPresentation.ts'),'utf8');
const postSource=readFileSync(resolve(process.cwd(),'src/game/babylonRefineryPostProcessing.ts'),'utf8');
const externalQaSource=readFileSync(resolve(process.cwd(),'docs/external-qa.md'),'utf8');
const recoveryFloorBytes=readFileSync(resolve(process.cwd(),'public/assets/models/environments/refinery-floor-panel-lod2.glb'));
const recoveryFloorJsonLength=recoveryFloorBytes.readUInt32LE(12);
const recoveryFloorGltf=JSON.parse(recoveryFloorBytes.subarray(20,20+recoveryFloorJsonLength).toString('utf8').trim()) as { materials?: { name?: string }[]; meshes?: { primitives?: { material?: number }[] }[]; nodes?: { mesh?: number }[] };
const recoveryFloorShellMaterial=recoveryFloorGltf.materials?.findIndex(material=>material.name==='refinery-shell') ?? -1;
const recoveryFloorShellMeshes=new Set((recoveryFloorGltf.meshes??[]).flatMap((mesh,index)=>(mesh.primitives??[]).some(primitive=>primitive.material===recoveryFloorShellMaterial)?[index]:[]));
assert(recoveryFloorShellMaterial>=0 && (recoveryFloorGltf.nodes??[]).some(node=>typeof node.mesh==='number' && recoveryFloorShellMeshes.has(node.mesh)),'performance-tier refinery floor LOD2 must keep a mounted refinery-shell premium surface');
assert(!gameCanvasSource.includes('useRef<SimState>(createMissionState(firstMission))') && gameCanvasSource.includes('useState(() => createMissionState(firstMission))'),'GameCanvas simulation must use lazy one-time initialization');
assert(gameCanvasSource.includes('profileSettingsRef.current.graphicsQuality') && gameCanvasSource.includes('canvas.dataset.graphicsQuality = selectedQuality'),'combat loop must consume/expose graphics quality mode');
assert(armorySource.includes('aria-label="Graphics quality"') && armorySource.includes('<option value="flagship">Flagship</option>') && armorySource.includes('<option value="performance">Performance</option>'),'settings must expose Flagship and Performance');
assert(MAX_MEASURED_FRAME_MS===250 && SUSPEND_GAP_MS===1000,'catastrophic active frames must remain measurable while multi-second suspend gaps are excluded');
const desktop=new AdaptiveRenderBudget(false); let snapshot=desktop.sample(16.7,1);
assert(snapshot.tierName==='high' && snapshot.shadowMapSize===1024 && snapshot.vfxDensity===1 && snapshot.transparencyScale===1,'desktop must start at high quality');
assert(snapshot.refineryIblScale===1 && snapshot.refineryBloomScale===1 && snapshot.refineryContactDepthScale===1 && snapshot.refineryAtmosphereScale===1 && snapshot.gameplayCueScale===1,'high tier must retain full secondary and critical cue budgets');
for(let i=0;i<180;i+=1) snapshot=desktop.sample(30,1);
assert(snapshot.tierName==='performance' && !snapshot.shadows && snapshot.shadowMapSize===256 && snapshot.vfxDensity===0.45 && snapshot.transparencyScale===0.4,'sustained slow frames must reach performance tier');
assert(snapshot.detailScale===0.5,'sustained slow frames must keep resource detail aligned with the Performance tier');
assert(snapshot.refineryIblScale<0.5 && snapshot.refineryBloomScale<0.5 && snapshot.refineryContactDepthScale<0.5 && snapshot.refineryAtmosphereScale<0.5 && snapshot.gameplayCueScale===1,'performance tier must shed secondary effects while preserving critical cues');
for(let i=0;i<700;i+=1) snapshot=desktop.sample(16.4,1); assert(snapshot.tierName==='high','healthy frames must recover desktop quality');
assert(snapshot.detailScale===1,'healthy recovery must restore flagship resource detail');
const startupPressure=new AdaptiveRenderBudget(false); let startupSnapshot=startupPressure.sample(16.7,1);
for(let i=0;i<18;i+=1) startupSnapshot=startupPressure.sample(250,1);
assert(startupSnapshot.runtimeTierName==='high' && startupSnapshot.tierTransitionCount===0,'the first nineteen measured frames must not downshift authored presentation during startup pressure');
startupSnapshot=startupPressure.sample(250,1);
assert(startupSnapshot.runtimeTierName==='performance' && startupSnapshot.lastTierTransition==='high->performance' && startupSnapshot.detailScale===0.5,'catastrophic startup pressure must downshift directly to Performance on the twentieth measured sample');
for(const severeFrameMs of [90,160,250]) {
  const severeBudget=new AdaptiveRenderBudget(false);
  let severeSnapshot=severeBudget.sample(16.7,1);
  const transitions:string[]=[];
  let severeSamples=0;
  while(severeSamples<60 && severeSnapshot.runtimeTierName!=='performance') {
    const previousTransitionCount=severeSnapshot.tierTransitionCount;
    severeSnapshot=severeBudget.sample(severeFrameMs,1);
    severeSamples+=1;
    if(severeSnapshot.tierTransitionCount>previousTransitionCount) transitions.push(severeSnapshot.lastTierTransition);
  }
  assert(severeSnapshot.runtimeTierName==='performance' && severeSamples*severeFrameMs<=5000,`sustained ${severeFrameMs}ms frames must reach performance tier within a bounded five-second pressure window`);
  const expectedTransitions=severeFrameMs>=150?'high->performance':'high->balanced,balanced->performance';
  assert(transitions.join(',')===expectedTransitions,`sustained ${severeFrameMs}ms frames must expose the expected adaptive tier transition path`);
  assert(severeSnapshot.rawFrameMs===severeFrameMs && severeSnapshot.measuredFrameMs===severeFrameMs && severeSnapshot.frameSampleState==='measured',`sustained ${severeFrameMs}ms frames must remain first-class measured telemetry`);
}
const locationCostFields=['p28-p2-v1','route','resolution','pixelRatio','rawMs','smoothMs','tier','transition','transitionCount','drawCalls','triangles','activeMeshes','shadowMap','shadowCasters','ssao','bloom','ibl','assetInstances','cachedAssets'];
const locationCostSignatures:string[]=[];
for(const [routeIndex,route] of LOCATION_FRAME_COST_ROUTES.entries()) {
  const routeBudget=new AdaptiveRenderBudget(false); let routeSnapshot=routeBudget.sample(16.7,1); let pressureSamples=0;
  while(pressureSamples<60 && routeSnapshot.runtimeTierName!=='performance') { routeSnapshot=routeBudget.sample(160,1); pressureSamples+=1; }
  assert(routeSnapshot.runtimeTierName==='performance' && pressureSamples*160<=5000,`${route} severe-pressure harness must reach the Performance recovery tier within five seconds`);
  const signature=formatLocationFrameCostSignature({route,renderWidth:1920,renderHeight:1080,pixelRatio:1.5,rawFrameMs:160,smoothedFrameMs:routeSnapshot.smoothedFrameMs,tier:routeSnapshot.runtimeTierName,transition:routeSnapshot.lastTierTransition,transitionCount:routeSnapshot.tierTransitionCount,drawCalls:120+routeIndex,triangles:42000+routeIndex,activeMeshes:200+routeIndex,shadowMap:0,shadowCasters:0,ssao:'off',bloom:'off',ibl:'off',assetInstances:12+routeIndex,cachedAssets:18+routeIndex});
  const fields=signature.split('|').map((segment,index)=>index===0?segment:segment.slice(0,segment.indexOf(':')));
  assert(fields.join(',')===locationCostFields.join(','),`${route} must emit the common P28-P2 frame-cost signature`);
  assert(signature.includes(`route:${route}|resolution:1920x1080|pixelRatio:1.50|rawMs:160.00|`) && signature.includes('|tier:performance|transition:high->performance|'),`${route} signature must retain route/raster/frame/tier recovery evidence`);
  locationCostSignatures.push(signature);
}
assert(LOCATION_FRAME_COST_SIGNATURE_VERSION==='p28-p2-v1' && locationCostSignatures.length===11 && new Set(LOCATION_FRAME_COST_ROUTES).size===11,'P28-P2 must cover the eleven currently ported deterministic location routes with one versioned signature');
const gapBudget=new AdaptiveRenderBudget(false); const beforeGap=gapBudget.sample(16.7,1); let gapSnapshot=beforeGap;
for(let i=0;i<8;i+=1) gapSnapshot=gapBudget.sample(5000,1);
assert(gapSnapshot.runtimeTierName==='high' && gapSnapshot.tierTransitionCount===0,'background/suspend gaps must not trigger adaptive downgrades');
assert(gapSnapshot.frameSampleState==='ignored-suspend-gap' && gapSnapshot.rawFrameMs===5000 && gapSnapshot.measuredFrameMs===0 && gapSnapshot.smoothedFrameMs===beforeGap.smoothedFrameMs,'suspend-gap telemetry must preserve the raw gap without contaminating measured frame pressure');
const catastrophicRecovery=new AdaptiveRenderBudget(false); let recoverySnapshot=catastrophicRecovery.sample(16.7,1);
while(recoverySnapshot.runtimeTierName!=='performance') recoverySnapshot=catastrophicRecovery.sample(250,1);
for(let i=0;i<700;i+=1) recoverySnapshot=catastrophicRecovery.sample(16.4,1);
assert(recoverySnapshot.runtimeTierName==='high' && recoverySnapshot.lastTierTransition==='balanced->high' && recoverySnapshot.tierTransitionCount===3,'healthy-frame hysteresis must recover a direct catastrophic downshift through performance->balanced->high');
const coarse=new AdaptiveRenderBudget(true); snapshot=coarse.sample(16.7,1);
assert(snapshot.tierName==='high' && snapshot.pixelRatioScale===1 && snapshot.detailScale===1 && snapshot.shadows && snapshot.shadowMapSize===1024 && snapshot.reflectionScale===1 && snapshot.vfxDensity===1 && snapshot.transparencyScale===1 && snapshot.textureAnisotropy===4 && snapshot.assetCacheEntryBudget===32,'coarse input must not impose a pre-emptive production quality ceiling');
assert(normalizeProductionRenderQuality(0.72,'adaptive',false)===1,'adaptive mobile layout hints must normalize to the richest production input');
assert(normalizeProductionRenderQuality(0.4464,'adaptive',true)===0.62,'explicit reduced effects must survive adaptive quality normalization without inheriting compact-layout ceilings');
assert(resolveRenderDowngradeReason('high','adaptive',false)==='none','healthy adaptive rendering must report no downgrade');
assert(resolveRenderDowngradeReason('balanced','adaptive',false)==='sustained-frame-pressure','adaptive downgrade telemetry must name sustained frame pressure');
assert(resolveRenderDowngradeReason('performance','performance',false)==='performance-mode','explicit performance mode must be distinguishable from runtime pressure');
assert(resolveRenderDowngradeReason('balanced','adaptive',true)==='reduced-effects','reduced effects must be distinguishable from runtime pressure');
assert(resolveRenderDowngradeReason('performance','adaptive',true)==='sustained-frame-pressure','additional runtime pressure must be the dominant downgrade cause when reduced effects are already selected');
const flagship=new AdaptiveRenderBudget(true).sample(16.7,1,'flagship'); const perf=new AdaptiveRenderBudget(true).sample(16.7,1,'performance');
assert(flagship.tierName==='high' && perf.tierName==='performance' && flagship.gameplayCueScale===1 && perf.gameplayCueScale===1,'explicit quality modes must alter cost without scaling critical cues');
assert(perf.detailScale===0.5,'explicit Performance mode must apply Performance resource detail immediately');
assert(boundarySource.includes("return reducedEffects ? 0.62 : 1") && boundarySource.includes("renderDeviceClassPolicy = coarse ? 'flagship-default:coarse-hint-ignored' : 'flagship-default'"),'production Babylon boundary must neutralize legacy mobile/coarse ceilings while preserving explicit reduced effects');
assert(boundarySource.includes('dataset.renderDowngradeReason = resolveRenderDowngradeReason(') && boundarySource.includes('dataset.renderQualityInput = `requested:'),'production QA must expose effective quality and downgrade cause');
assert(boundarySource.includes('dataset.renderRawFrameMs = rawFrameMs.toFixed(2)') && boundarySource.includes("dataset.renderSmoothedFrameMs = this.canvas.dataset.renderFrameMs ?? ''") && boundarySource.includes('dataset.renderTierTransition = `${this.lastObservedRenderTier}->${observedTier}`') && boundarySource.includes('dataset.renderTierTransitionCount = String(this.renderTierTransitionCount)'),'production runtime telemetry must expose raw/smoothed frame time and observed tier transitions');
assert(boundarySource.includes('dataset.renderLocationCost = formatLocationFrameCostSignature({') && boundarySource.includes('getActiveMeshes?.().length') && boundarySource.includes("renderLocationCostCaveat = 'runtime-frame-cost-not-physical-phone-fps'") && boundarySource.includes("const refinery = route === 'asteroid-refinery'"),'production route telemetry must expose comparable raster/geometry/effect/asset cost channels without treating runtime timing as physical-phone FPS');
assert(externalQaSource.includes('P28-P2') && externalQaSource.includes('physical target-phone FPS') && externalQaSource.includes('thermal'),'P28-P2 physical-phone FPS and thermal acceptance must remain external QA rather than emulator/runtime claims');
assert(rendererSource.includes('const budget = this.renderBudget.sample(frameMs, quality, qualityMode)') && rendererSource.includes('budget.vfxDensity') && rendererSource.includes('budget.transparencyScale'),'Babylon renderer must consume adaptive visual budgets');
assert(rendererSource.includes('getBabylonGraphicsAssetRuntime(this.scene).configureBudget({') && rendererSource.includes('dataset.renderMemoryBudget'),'Babylon renderer must apply/expose asset cache budget');
assert(rendererSource.includes('dataset.renderTier = budget.tierName') && rendererSource.includes('dataset.renderFrameMs = budget.smoothedFrameMs.toFixed(2)') && rendererSource.includes('dataset.renderBudget = ['),'Babylon runtime QA must expose tier/frame/budget telemetry');
assert(rendererSource.includes('const drawCalls = this.engine._drawCalls.current') && rendererSource.includes('this.scene.getActiveIndices()'),'Babylon renderer must expose real draw/triangle performance stats');
assert(assetsSource.includes('entry.activeInstances === 0') && assetsSource.includes('maxCachedCompressedBytes') && assetsSource.includes('maxCachedAssets'),'asset cache pressure must evict only idle entries and honor count/byte budgets');
assert(worldSource.includes('quality.materialDepthScale') && worldSource.includes('quality.pickupBeamScale'),'world material/pickup cost must follow adaptive quality');
assert(postSource.includes('renderBudget.refineryBloomScale') && postSource.includes('renderBudget.refineryContactDepthScale') && postSource.includes('renderBudget.refineryAtmosphereScale'),'refinery post stack must consume adaptive secondary-effect scales');
const profiles=[spinHabitatRenderProfile(0.5,true),jovianHarvesterRenderProfile(0.5,true),solarYardRenderProfile(0.5,true),perseidRenderProfile(0.5,true),k91RenderProfile(0.5,true),orphelineRenderProfile(0.5,true),hecateRenderProfile(0.5,true)];
assert(profiles.every(profile=>profile.name==='performance'),'all authored environment/capstone profiles must expose a performance tier');
const worst=new AdaptiveRenderBudget(true); let worstSnapshot=worst.sample(16.7,1); for(let i=0;i<180;i+=1) worstSnapshot=worst.sample(45,1);
assert(worstSnapshot.tierName==='performance' && worstSnapshot.pixelRatioScale<=0.68 && worstSnapshot.detailScale<=0.5 && !worstSnapshot.shadows,'worst-case pressure must reduce raster/detail/shadow cost');
assert(worstSnapshot.gameplayCueScale===1,'worst-case rendering must preserve gameplay-critical information');
console.log(`P28_P2_LOCATION_FRAME_COST_PASS routes=${LOCATION_FRAME_COST_ROUTES.length} signature=${LOCATION_FRAME_COST_SIGNATURE_VERSION} recovery=all-performance telemetry=cpu+gpu+assets physical-fps=external-qa`);
console.log('RENDER_PERFORMANCE_PASS owner=babylon flagship-default=phone+desktop sustained=degrade+recover startup=20-sample-warmup catastrophic=90-250ms<=5s suspend-gaps=ignored telemetry=raw+smoothed+transitions+location-cost cache=bounded post=adaptive');