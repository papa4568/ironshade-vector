from pathlib import Path


def replace(path, old, new):
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'missing expected text in {path}: {old[:100]!r}')
    file.write_text(text.replace(old, new))


def write(path, content):
    Path(path).write_text(content)


# Preserve runtime scalability telemetry after the Three renderer is retired.
replace(
    'src/game/babylonCombatRenderer.ts',
    "    const runtimeProfile = runtimeScalabilityProfile(budget.tierName);\n    const refineryScenario = mission.location === 'asteroid-refinery';",
    "    const runtimeProfile = runtimeScalabilityProfile(budget.tierName);\n    this.canvas.dataset.runtimePools = [\n      `damage:${Math.min(state.damageNumbers.length, runtimeProfile.poolRetention.damageNumbers)}/${runtimeProfile.poolRetention.damageNumbers}`,\n      `effects:${Math.min(state.effects.length, runtimeProfile.poolRetention.effects)}/${runtimeProfile.poolRetention.effects}`,\n      `sparks:0/${runtimeProfile.poolRetention.impactSparks}`,\n      `debris:${Math.min(state.debris.length, runtimeProfile.poolRetention.debris)}/${runtimeProfile.poolRetention.debris}`,\n    ].join('|');\n    const refineryScenario = mission.location === 'asteroid-refinery';",
)
replace(
    'src/game/babylonCombatRenderer.ts',
    "    const signature = selected.map(item => item.spec.id).join(':');\n    if (signature === this.enemyCatalogSignature) return;",
    "    const signature = selected.map(item => item.spec.id).join(':');\n    this.canvas.dataset.assetStreaming = `bounded-preload:${selected.length}@${preloadConcurrency}`;\n    if (signature === this.enemyCatalogSignature) return;",
)

# UI regressions validate the shipped Babylon presentation owners.
replace('tests/ui-readability.ts', "const renderer = read('src/game/threeCombatRenderer.ts');", "const renderer = read('src/game/babylonCombatRenderer.ts');\nconst worldRenderer = read('src/game/babylonWorldPresentation.ts');\nconst lifecycleRenderer = read('src/game/babylonEnemyLifecycleVisuals.ts');")
replace('tests/ui-readability.ts', "assert(renderer.includes('groundLootMarkerGeometries') && renderer.includes('visual.marker.geometry = this.groundLootMarkerGeometries[presentation.shape]') && renderer.includes('visual.beam.scale.y = presentation.beaconScale'), 'P7-B Three.js loot markers do not preserve non-color rarity shapes and beacon hierarchy.');", "assert(worldRenderer.includes('this.replaceLootMarker(visual, presentation.shape, count)') && worldRenderer.includes('visual.beam.scaling.y = presentation.beaconScale'), 'P7-B Babylon loot markers must preserve non-color rarity shapes and beacon hierarchy.');")
replace('tests/ui-readability.ts', "assert(renderer.includes(\"enemy.role === 'elite' ? 2.2 : 1.9\"), 'Three.js hostile bars are still too small for mobile readability.');", "assert(lifecycleRenderer.includes(\"enemy.role === 'boss' ? 3.45 : enemy.role === 'elite' ? 2.82 : 2.35\") && lifecycleRenderer.includes('resolveEnemyHudReadability(enemy, this.coarse, focused)'), 'Babylon hostile bars must retain role-aware spacing and the shared mobile readability policy.');")
replace('tests/ui-readability.ts', "assert(renderer.includes('0xff725f') && renderer.includes('0x8ee8ff') && renderer.includes('THREE.AdditiveBlending') && renderer.includes('toneMapped: false'), 'Three.js hostile bars are not using the bright mobile treatment.');", "assert(lifecycleRenderer.includes(\"'p27-b10-health-fill-'\") && lifecycleRenderer.includes(\"'p27-b10-critical-material-'\") && lifecycleRenderer.includes(\"'p27-b10-armor-break-material-'\"), 'Babylon hostile bars must retain health, critical-durability, and armor-break readability channels.');")
replace('tests/ui-readability.ts', "'P8-F Three renderer is missing family stance/recoil/reload/vent/muzzle or shared camera handling.'", "'P8-F Babylon renderer is missing family stance/recoil/reload/vent/muzzle or shared camera handling.'")

write('tests/refinery-bloom.ts', r'''import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { clampRefineryBloomCostScale, isRefineryBloomAssetLabel, REFINERY_BLOOM_PROFILE, refineryBloomResolutionScale, refineryBloomStrengthForCost } from '../src/game/refineryBloomProfile';
function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }
assert(REFINERY_BLOOM_PROFILE.strength > 0 && REFINERY_BLOOM_PROFILE.strength < 0.7, 'bloom strength must stay bounded');
assert(REFINERY_BLOOM_PROFILE.radius > 0 && REFINERY_BLOOM_PROFILE.radius < 0.5, 'bloom radius must stay bounded');
assert(clampRefineryBloomCostScale(-1) === 0 && clampRefineryBloomCostScale(2) === 1, 'bloom cost must clamp to 0..1');
assert(refineryBloomResolutionScale(0) === 0 && refineryBloomResolutionScale(0.35) < refineryBloomResolutionScale(1), 'bloom resolution cost must degrade predictably');
assert(refineryBloomStrengthForCost(0.35) < refineryBloomStrengthForCost(1), 'reduced cost must reduce secondary glow strength');
assert(isRefineryBloomAssetLabel('refinery-terminal') && isRefineryBloomAssetLabel('refinery-processor'), 'authored emissives must remain explicit bloom sources');
for (const excluded of ['refinery-floor', 'refinery-bulkhead', 'refinery-crate', 'objective', 'loot', 'hazard', 'interactable', 'enemy']) assert(!isRefineryBloomAssetLabel(excluded), `protected/non-emissive source leaked into bloom selection: ${excluded}`);
const postSource = readFileSync(resolve(process.cwd(), 'src/game/babylonRefineryPostProcessing.ts'), 'utf8');
const browserSmokeSource = readFileSync(resolve(process.cwd(), 'scripts/browser-runtime-smoke.mjs'), 'utf8');
const androidSmokeSource = readFileSync(resolve(process.cwd(), 'scripts/android-runtime-smoke.mjs'), 'utf8');
assert(postSource.includes("new GlowLayer('p27-b12-refinery-selective-bloom'") && postSource.includes('excludeByDefault: true'), 'Babylon refinery bloom must remain selective rather than full-scene');
assert(postSource.includes('this.glow.isEnabled = bloomEnabled') && postSource.includes('this.glow.intensity = budget.bloomStrength') && postSource.includes('this.glow.blurKernelSize = budget.bloomKernelSize'), 'Babylon bloom must follow adaptive cost controls');
assert(postSource.includes("this.canvas.dataset.environmentBloomExcluded = REFINERY_BLOOM_PROFILE.excludedCueGroups.join('+')"), 'Babylon bloom telemetry must publish protected cue groups');
assert(postSource.includes("qaExplicit && this.canvas.dataset.refineryPostStackQa === 'off'"), 'deterministic post-stack disabling must remain QA-only');
assert(postSource.includes('this.glow.dispose()'), 'Babylon glow resources must dispose with the renderer');
assert(browserSmokeSource.includes('BROWSER_P21C_BLOOM_PASS') && androidSmokeSource.includes('ANDROID_P21C_BLOOM_PASS'), 'historical bloom QA coverage must remain wired to the shipped Babylon path');
console.log(`P21C_REFINERY_BLOOM_PASS owner=babylon strength=${REFINERY_BLOOM_PROFILE.strength.toFixed(2)} radius=${REFINERY_BLOOM_PROFILE.radius.toFixed(2)} protected=${REFINERY_BLOOM_PROFILE.excludedCueGroups.join('+')}`);
''')

write('tests/refinery-contact-depth.ts', r'''import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRefineryContactDepthAlphaData, REFINERY_CONTACT_DEPTH_PROFILE, refineryContactDepthTelemetry } from '../src/game/refineryContactDepth';
function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }
assert(REFINERY_CONTACT_DEPTH_PROFILE.opacity > 0 && REFINERY_CONTACT_DEPTH_PROFILE.opacity <= 0.3, 'contact depth opacity must remain restrained');
assert(REFINERY_CONTACT_DEPTH_PROFILE.alphaTextureSize <= 32, 'contact alpha footprint must remain mobile-conscious');
assert(REFINERY_CONTACT_DEPTH_PROFILE.instanceLimit <= 10 && REFINERY_CONTACT_DEPTH_PROFILE.instanceLimit * REFINERY_CONTACT_DEPTH_PROFILE.trianglesPerInstance <= 20, 'contact geometry must remain bounded');
assert(REFINERY_CONTACT_DEPTH_PROFILE.drawCalls === 1, 'contact depth must remain one instanced draw call');
const alpha = createRefineryContactDepthAlphaData(); const size = REFINERY_CONTACT_DEPTH_PROFILE.alphaTextureSize; const alphaAt=(x:number,y:number)=>alpha[(y*size+x)*4+3];
assert(alpha.length === size * size * 4 && alphaAt(Math.floor(size/2), Math.floor(size/2)) > 220 && alphaAt(0,0) === 0, 'contact alpha must be compact, centered, and feathered');
assert(refineryContactDepthTelemetry(10).includes('instances-10:triangles-20:draws-1'), 'contact telemetry must publish bounded scene cost');
const postSource = readFileSync(resolve(process.cwd(), 'src/game/babylonRefineryPostProcessing.ts'), 'utf8');
const browserSmokeSource = readFileSync(resolve(process.cwd(), 'scripts/browser-runtime-smoke.mjs'), 'utf8');
const androidSmokeSource = readFileSync(resolve(process.cwd(), 'scripts/android-runtime-smoke.mjs'), 'utf8');
assert(postSource.includes('RawTexture.CreateRGBATexture') && postSource.includes('REFINERY_CONTACT_DEPTH_PROFILE.instanceLimit') && postSource.includes('this.contactMeshes.forEach((mesh, index) => mesh.setEnabled(index < contactCount))'), 'Babylon contact depth must remain a bounded ground-plane instance pass');
assert(postSource.includes("qaExplicit && this.canvas.dataset.refineryPostStackQa === 'off'"), 'contact-depth QA bypass must be restricted to explicit QA mode');
assert(postSource.includes("this.canvas.dataset.environmentContactDepthProtected = REFINERY_CONTACT_DEPTH_PROFILE.protectedCueGroups.join('+')"), 'contact-depth telemetry must publish protected gameplay groups');
assert(postSource.includes('this.contactTexture.dispose()') && postSource.includes("'environmentContactDepthProtected'"), 'contact-depth resources and telemetry must tear down cleanly');
assert(browserSmokeSource.includes('BROWSER_P21D1_CONTACT_DEPTH_PASS') && androidSmokeSource.includes('ANDROID_P21D1_CONTACT_DEPTH_PASS'), 'contact-depth browser/Android QA must remain present');
console.log(`P21D1_REFINERY_CONTACT_DEPTH_PASS owner=babylon instances=${REFINERY_CONTACT_DEPTH_PROFILE.instanceLimit} protected=${REFINERY_CONTACT_DEPTH_PROFILE.protectedCueGroups.join('+')}`);
''')

write('tests/refinery-atmosphere.ts', r'''import { readFileSync } from 'node:fs';
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
''')

# World material/IBL ownership.
path = Path('tests/world-material-polish.ts')
text = path.read_text()
start = text.index("const rendererSource = readFileSync(resolve(process.cwd(), 'src/game/threeCombatRenderer.ts'), 'utf8');")
end = text.index('const browserSource =', start)
text = text[:start] + """const worldSource = readFileSync(resolve(process.cwd(), 'src/game/babylonWorldPresentation.ts'), 'utf8');
const lightingSource = readFileSync(resolve(process.cwd(), 'src/game/babylonRefineryLighting.ts'), 'utf8');
assert(worldSource.includes("dataset.interactableReadability = 'shape-coded+state-emissive+floor-cue:quality-safe'"), 'Babylon runtime QA must expose priority-interactable readability');
assert(worldSource.includes("dataset.hazardReadability = 'shape-coded+floor-bound+quality-safe'"), 'Babylon runtime QA must expose hazard readability');
assert(worldSource.includes("dataset.worldReadability = 'interactables:shape+state|hazards:shape+motion|loot:shape+rarity'"), 'Babylon runtime QA must expose shared world readability');
assert(worldSource.includes('quality.pickupBeamScale') && worldSource.includes('quality.materialDepthScale') && worldSource.includes('biomeState.motionHz * quality.stateMotionScale'), 'Babylon world presentation must consume adaptive world-material quality');
assert(lightingSource.includes('createBabylonRefineryIblTexture(scene)') && lightingSource.includes('this.scene.environmentTexture = iblEnabled ? this.iblTexture : null'), 'Babylon refinery lighting must own a reusable refinery-scoped IBL texture');
assert(lightingSource.includes('REFINERY_IBL_PROFILE.intensity * budget.refineryIblScale'), 'Babylon refinery IBL intensity must follow adaptive reflection budget');
assert(lightingSource.includes("qaExplicit && this.canvas.dataset.refineryIblQa === 'off'") && lightingSource.includes("'off:qa-baseline'"), 'Babylon refinery lighting must retain deterministic IBL-off QA evidence');
assert(lightingSource.includes('this.iblTexture.dispose()'), 'Babylon refinery IBL resources must dispose with the renderer');

""" + text[end:]
path.write_text(text)

write('tests/runtime-scalability.ts', r'''import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { combatAudioBudget, combatAudioVoiceAdmission } from '../src/game/feedback';
import { RUNTIME_SCALABILITY_PROFILES, runtimeAnimationStride, runtimeAssetPreloadReady, runtimePoolTrimTarget } from '../src/game/runtimeScalability';
function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }
const high=RUNTIME_SCALABILITY_PROFILES.high, balanced=RUNTIME_SCALABILITY_PROFILES.balanced, performance=RUNTIME_SCALABILITY_PROFILES.performance;
assert(high.preloadConcurrency===2 && balanced.preloadConcurrency===1 && performance.preloadConcurrency===1,'mobile/performance preload must serialize while high keeps bounded parallelism');
assert(high.preloadAssetLimit>balanced.preloadAssetLimit && balanced.preloadAssetLimit>performance.preloadAssetLimit,'asset preload residency must shrink under pressure');
assert(!runtimeAssetPreloadReady(3.6,balanced) && runtimeAssetPreloadReady(4.0,balanced),'engine-neutral deferred preload policy must remain bounded');
assert(runtimeAnimationStride({tier:'performance',role:'boss',distance:80,targeted:false,criticalCue:false})===1,'boss animation must never be throttled');
assert(runtimeAnimationStride({tier:'performance',role:'assault',distance:80,targeted:true,criticalCue:false})===1,'targeted enemies must animate every frame');
assert(runtimeAnimationStride({tier:'balanced',role:'assault',distance:80,targeted:false,criticalCue:false})===2,'balanced far enemies should halve authored rig work');
assert(runtimeAnimationStride({tier:'performance',role:'assault',distance:80,targeted:false,criticalCue:false})===3,'performance far enemies should third-rate authored rig work');
assert(runtimePoolTrimTarget(120,8,36)===36 && runtimePoolTrimTarget(42,8,36)===42 && runtimePoolTrimTarget(120,60,36)===60,'pool trimming must be bounded and never remove active visuals');
assert(combatAudioVoiceAdmission(8,2,'tail','background').admitted && !combatAudioVoiceAdmission(combatAudioBudget.backgroundVoiceCeiling,2,'direct','background').admitted,'background audio virtualization must remain pressure-aware');
assert(combatAudioVoiceAdmission(combatAudioBudget.maxVoices,combatAudioBudget.maxTailVoices,'direct','critical').admitted,'critical audio must keep reserved voices');
const rendererSource=readFileSync(resolve(process.cwd(),'src/game/babylonCombatRenderer.ts'),'utf8');
const graphicsSource=readFileSync(resolve(process.cwd(),'src/game/babylonGraphicsAssets.ts'),'utf8');
const canvasSource=readFileSync(resolve(process.cwd(),'src/components/GameCanvas.tsx'),'utf8');
const androidSmokeSource=readFileSync(resolve(process.cwd(),'scripts/android-runtime-smoke.mjs'),'utf8');
assert(rendererSource.includes('runtimeAnimationStride({') && rendererSource.includes('dataset.runtimeAnimationLod'),'Babylon renderer must apply and expose enemy animation LOD');
assert(rendererSource.includes('dataset.runtimePools = [') && rendererSource.includes('runtimeProfile.poolRetention.damageNumbers'),'Babylon renderer must expose bounded runtime-pool pressure');
assert(rendererSource.includes('dataset.assetStreaming = `bounded-preload:') && rendererSource.includes('runtime.preload(selected.map(item => item.spec), preloadConcurrency)'),'Babylon renderer must expose bounded asset streaming');
assert(graphicsSource.includes('async preload(specs: readonly GraphicsAssetSpec[]') && graphicsSource.includes('workerCount'),'Babylon asset runtime must implement bounded-concurrency preload');
assert(graphicsSource.includes('entry.activeInstances === 0') && graphicsSource.includes('maxCachedCompressedBytes'),'Babylon cache eviction must protect mounted instances and honor memory budgets');
assert(canvasSource.includes('feedback.performanceStats()') && canvasSource.includes('dataset.audioVirtualization'),'runtime QA must expose audio virtualization pressure');
assert(androidSmokeSource.includes('runtimeAnimationLod') && androidSmokeSource.includes('runtimePools') && androidSmokeSource.includes('assetStreaming') && androidSmokeSource.includes('audioVirtualization'),'Android smoke must verify Babylon runtime scalability telemetry');
console.log('RUNTIME_SCALABILITY_PASS owner=babylon pools=bounded animation=lod audio=virtualized assets=bounded-preload mechanics=preserved');
''')

write('tests/graphics-asset-pipeline.ts', r'''import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GRAPHICS_ASSET_STANDARDS, createGraphicsAssetSpec, graphicsAssetLodForDetailScale, selectGraphicsAssetSpec, validateGraphicsAssetSpec, type GraphicsAssetFamily } from '../src/game/graphicsAssets';
function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }
assert(GRAPHICS_ASSET_STANDARDS.runtimeFormat==='glb' && GRAPHICS_ASSET_STANDARDS.unitScaleMeters===1 && GRAPHICS_ASSET_STANDARDS.upAxis==='+Y' && GRAPHICS_ASSET_STANDARDS.forwardAxis==='+X','authored runtime asset coordinate/format contract changed');
assert(GRAPHICS_ASSET_STANDARDS.compression.mesh==='meshopt' && GRAPHICS_ASSET_STANDARDS.compression.texture==='ktx2','mobile compression targets must remain meshopt+ktx2');
assert(GRAPHICS_ASSET_STANDARDS.maxTextureDimension.operator<=2048 && GRAPHICS_ASSET_STANDARDS.maxTextureDimension.enemy<=1024,'texture caps must remain mobile-safe');
const operator=createGraphicsAssetSpec('operator-meridian-lod0','operator','/assets/models/operators/operator-meridian-lod0.glb');
assert(validateGraphicsAssetSpec(operator).length===0 && operator.triangleBudget===45000 && operator.compressedByteBudget===2500000,'valid operator GLB contract rejected or budget drifted');
assert(validateGraphicsAssetSpec(createGraphicsAssetSpec('Operator Meridian','operator','/assets/models/operators/operator-meridian-lod0.glb')).some(issue=>issue.includes('kebab-case')),'invalid asset id should be rejected');
assert(validateGraphicsAssetSpec(createGraphicsAssetSpec('operator-meridian-lod0','operator','/models/operator-meridian-lod0.glb')).some(issue=>issue.includes('/assets/models/')),'asset outside model root should be rejected');
assert(graphicsAssetLodForDetailScale(1)===0 && graphicsAssetLodForDetailScale(0.72)===1 && graphicsAssetLodForDetailScale(0.5)===2,'adaptive LOD thresholds changed');
const family:GraphicsAssetFamily={id:'test',lods:{1:createGraphicsAssetSpec('test-lod1','enemy','/assets/models/enemies/test-lod1.glb',1),2:createGraphicsAssetSpec('test-lod2','enemy','/assets/models/enemies/test-lod2.glb',2)}};
assert(selectGraphicsAssetSpec(family,1)?.lod===1 && selectGraphicsAssetSpec(family,0.5)?.lod===2,'LOD selection fallback must remain deterministic');
const contractSource=readFileSync(resolve(process.cwd(),'src/game/graphicsAssets.ts'),'utf8');
const runtimeSource=readFileSync(resolve(process.cwd(),'src/game/babylonGraphicsAssets.ts'),'utf8');
const loaderSource=readFileSync(resolve(process.cwd(),'src/game/babylonGltfLoader.ts'),'utf8');
const manifestSource=readFileSync(resolve(process.cwd(),'src/game/graphicsAssetManifest.ts'),'utf8');
const rendererSource=readFileSync(resolve(process.cwd(),'src/game/babylonCombatRenderer.ts'),'utf8');
const prepareCodecs=readFileSync(resolve(process.cwd(),'scripts/prepare-graphics-codecs.mjs'),'utf8');
assert(!contractSource.includes("from 'three'") && !contractSource.includes('@babylonjs/'),'shared graphics asset contract must remain renderer-neutral');
assert(runtimeSource.includes("import('./babylonGltfLoader')") && loaderSource.includes("import '@babylonjs/loaders/glTF/2.0/glTFLoader'"),'Babylon GLB loader must remain deferred and scoped to glTF 2.0');
assert(runtimeSource.includes('BABYLON_GRAPHICS_CODEC_PATHS') && !runtimeSource.includes('cdn.babylonjs.com') && !runtimeSource.includes('preview.babylonjs.com'),'Babylon decoder configuration must stay local');
assert(runtimeSource.includes('async preload(specs: readonly GraphicsAssetSpec[]') && runtimeSource.includes('instantiateModelsToScene') && runtimeSource.includes('entry.activeInstances === 0'),'Babylon runtime must provide bounded preload, instantiation, and safe cache eviction');
assert(prepareCodecs.includes("public/assets/codecs/babylon") && !prepareCodecs.includes('node_modules/three'),'codec preparation must be Babylon-only');
for (const token of ['OPERATOR_ASSET_FAMILY','OPERATOR_CLASS_ASSET_FAMILIES','ENEMY_ASSET_FAMILIES','WEAPON_ASSET_FAMILIES','REFINERY_ASSET_FAMILIES','PICKUP_ASSET_FAMILY','INTERACTABLE_ASSET_FAMILIES']) assert(manifestSource.includes(token),`graphics manifest missing ${token}`);
assert(rendererSource.includes("from './graphicsAssetManifest'") && rendererSource.includes("from './graphicsAssets'") && rendererSource.includes("from './babylonGraphicsAssets'"),'Babylon combat renderer must consume shared manifest/contract through Babylon runtime');
assert(rendererSource.includes('runtime.preload(') && rendererSource.includes('runtime.instantiate('),'Babylon combat renderer must use the shared cached asset runtime');
assert(rendererSource.includes("dataset.operatorVisual = 'procedural-fallback'") && rendererSource.includes("dataset.environmentVisual = 'authored-fallback-babylon'"),'authored asset failures must preserve procedural fallbacks');
console.log('GRAPHICS_ASSET_PIPELINE_PASS contract=renderer-neutral runtime=babylon codecs=local lod=adaptive cache=bounded fallbacks=preserved');
''')

replace('tests/babylon-graphics-assets.ts', "const threeRuntimeSource = readFileSync(resolve(process.cwd(), 'src/game/graphicsAssets.ts'), 'utf8');", "const assetContractSource = readFileSync(resolve(process.cwd(), 'src/game/graphicsAssets.ts'), 'utf8');")
replace('tests/babylon-graphics-assets.ts', "assert(!threeRuntimeSource.includes('babylonGraphicsAssets'), 'Three asset runtime must remain independent of the Babylon asset path');", "assert(!assetContractSource.includes(\"from 'three'\") && !assetContractSource.includes('@babylonjs/'), 'shared graphics asset contract must remain renderer-neutral');")

# Content validation loads/instantiates every GLB through Babylon.
path = Path('tests/graphics-content-assets.mjs')
text = path.read_text()
text = text.replace("import { Box3 } from 'three';\nimport { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';\nimport { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';", "import { NullEngine } from '@babylonjs/core/Engines/nullEngine';\nimport { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';\nimport { Scene } from '@babylonjs/core/scene';\nimport '@babylonjs/loaders/glTF/2.0/glTFLoader';")
text = text.replace("const loader = new GLTFLoader();", """const engine = new NullEngine();
const scene = new Scene(engine);

function boundsForRoots(rootNodes) {
  let found = false;
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const root of rootNodes) {
    for (const node of [root, ...root.getDescendants(false)]) {
      if (typeof node.getBoundingInfo !== 'function') continue;
      node.computeWorldMatrix(true);
      const box = node.getBoundingInfo().boundingBox;
      for (const axis of ['x', 'y', 'z']) { min[axis] = Math.min(min[axis], box.minimumWorld[axis]); max[axis] = Math.max(max[axis], box.maximumWorld[axis]); }
      found = true;
    }
  }
  assert(found, 'Babylon instance must contain bounded renderable meshes');
  return { min, max };
}""")
old = """  const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  const gltf = await loader.parseAsync(arrayBuffer, '');
  assert(gltf.scene, `${relativePath}: GLTFLoader did not produce a scene`);
  const instance = clone(gltf.scene);
  let runtimeMeshes = 0;
  instance.traverse(child => {
    if (child.isMesh) runtimeMeshes += 1;
  });
  assert(runtimeMeshes > 0, `${relativePath}: cloned runtime scene contains no meshes`);

  const authoredBounds = positionBounds(json, relativePath);
  const runtimeBounds = new Box3().setFromObject(instance);"""
new = """  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const container = await LoadAssetContainerAsync(bytes, scene, { pluginExtension: '.glb', name: relativePath });
  const instance = container.instantiateModelsToScene(name => `content-test:${name}`, false, { doNotInstantiate: false });
  const runtimeMeshes = instance.rootNodes.flatMap(root => [root, ...root.getDescendants(false)]).filter(node => typeof node.getBoundingInfo === 'function');
  assert(runtimeMeshes.length > 0, `${relativePath}: Babylon runtime scene contains no meshes`);

  const authoredBounds = positionBounds(json, relativePath);
  const runtimeBounds = boundsForRoots(instance.rootNodes);"""
if old not in text:
    raise SystemExit('graphics content Three loader block not found')
text = text.replace(old, new)
text = text.replace("reports.push({ relativePath, bytes: data.byteLength, triangles, meshes: runtimeMeshes, authoredBounds });", "reports.push({ relativePath, bytes: data.byteLength, triangles, meshes: runtimeMeshes.length, authoredBounds });\n  instance.dispose();\n  container.dispose();")
text = text.replace('const totalBytes =', 'scene.dispose();\nengine.dispose();\n\nconst totalBytes =')
path.write_text(text)

write('tests/render-performance.ts', r'''import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AdaptiveRenderBudget } from '../src/game/renderQuality';
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
const rendererSource=readFileSync(resolve(process.cwd(),'src/game/babylonCombatRenderer.ts'),'utf8');
const assetsSource=readFileSync(resolve(process.cwd(),'src/game/babylonGraphicsAssets.ts'),'utf8');
const worldSource=readFileSync(resolve(process.cwd(),'src/game/babylonWorldPresentation.ts'),'utf8');
const postSource=readFileSync(resolve(process.cwd(),'src/game/babylonRefineryPostProcessing.ts'),'utf8');
assert(!gameCanvasSource.includes('useRef<SimState>(createMissionState(firstMission))') && gameCanvasSource.includes('useState(() => createMissionState(firstMission))'),'GameCanvas simulation must use lazy one-time initialization');
assert(gameCanvasSource.includes('profileSettingsRef.current.graphicsQuality') && gameCanvasSource.includes('canvas.dataset.graphicsQuality = selectedQuality'),'combat loop must consume/expose graphics quality mode');
assert(armorySource.includes('aria-label="Graphics quality"') && armorySource.includes('<option value="flagship">Flagship</option>') && armorySource.includes('<option value="performance">Performance</option>'),'settings must expose Flagship and Performance');
const desktop=new AdaptiveRenderBudget(false); let snapshot=desktop.sample(16.7,1);
assert(snapshot.tierName==='high' && snapshot.shadowMapSize===1024 && snapshot.vfxDensity===1 && snapshot.transparencyScale===1,'desktop must start at high quality');
assert(snapshot.refineryIblScale===1 && snapshot.refineryBloomScale===1 && snapshot.refineryContactDepthScale===1 && snapshot.refineryAtmosphereScale===1 && snapshot.gameplayCueScale===1,'high tier must retain full secondary and critical cue budgets');
for(let i=0;i<180;i+=1) snapshot=desktop.sample(30,1);
assert(snapshot.tierName==='performance' && !snapshot.shadows && snapshot.shadowMapSize===256 && snapshot.vfxDensity===0.45 && snapshot.transparencyScale===0.4,'sustained slow frames must reach performance tier');
assert(snapshot.refineryIblScale<0.5 && snapshot.refineryBloomScale<0.5 && snapshot.refineryContactDepthScale<0.5 && snapshot.refineryAtmosphereScale<0.5 && snapshot.gameplayCueScale===1,'performance tier must shed secondary effects while preserving critical cues');
for(let i=0;i<700;i+=1) snapshot=desktop.sample(16.4,1); assert(snapshot.tierName==='high','healthy frames must recover desktop quality');
const coarse=new AdaptiveRenderBudget(true); snapshot=coarse.sample(16.7,1); assert(snapshot.tierName==='balanced' && snapshot.shadowMapSize===512 && snapshot.assetCacheEntryBudget===24,'coarse devices must start Balanced');
const flagship=new AdaptiveRenderBudget(true).sample(16.7,1,'flagship'); const perf=new AdaptiveRenderBudget(true).sample(16.7,1,'performance');
assert(flagship.tierName==='high' && perf.tierName==='performance' && flagship.gameplayCueScale===1 && perf.gameplayCueScale===1,'explicit quality modes must alter cost without scaling critical cues');
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
console.log('RENDER_PERFORMANCE_PASS owner=babylon sustained=degrade+recover cache=bounded post=adaptive quality-modes=flagship+performance');
''')

print('P27_D9_REMAINING_GRAPHICS_REGRESSIONS_MIGRATED')
