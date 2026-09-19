import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  GRAPHICS_ASSET_STANDARDS,
  createGraphicsAssetSpec,
  graphicsAssetLodForDetailScale,
  selectGraphicsAssetSpec,
  validateGraphicsAssetSpec,
  type GraphicsAssetFamily,
} from '../src/game/graphicsAssets';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(GRAPHICS_ASSET_STANDARDS.runtimeFormat === 'glb', 'authored runtime models must use GLB');
assert(GRAPHICS_ASSET_STANDARDS.unitScaleMeters === 1, 'asset units must remain meter-based');
assert(GRAPHICS_ASSET_STANDARDS.upAxis === '+Y', 'authored assets must use +Y up');
assert(GRAPHICS_ASSET_STANDARDS.forwardAxis === '+X', 'authored characters and weapons must use +X forward');
assert(GRAPHICS_ASSET_STANDARDS.compression.mesh === 'meshopt', 'meshopt must remain the mobile geometry compression target');
assert(GRAPHICS_ASSET_STANDARDS.compression.texture === 'ktx2', 'KTX2 must remain the mobile texture compression target');
assert(GRAPHICS_ASSET_STANDARDS.maxTextureDimension.operator <= 2048, 'operator texture cap must remain mobile-safe');
assert(GRAPHICS_ASSET_STANDARDS.maxTextureDimension.enemy <= 1024, 'enemy texture cap must remain mobile-safe');

const operator = createGraphicsAssetSpec('operator-meridian-lod0', 'operator', '/assets/models/operators/operator-meridian-lod0.glb');
assert(validateGraphicsAssetSpec(operator).length === 0, 'valid operator GLB contract rejected');
assert(operator.triangleBudget === 45_000, 'operator default triangle budget changed unexpectedly');
assert(operator.compressedByteBudget === 2_500_000, 'operator default payload budget changed unexpectedly');

const invalidName = createGraphicsAssetSpec('Operator Meridian', 'operator', '/assets/models/operators/operator-meridian-lod0.glb');
assert(validateGraphicsAssetSpec(invalidName).some(issue => issue.includes('kebab-case')), 'invalid asset id should be rejected');

const invalidRoot = createGraphicsAssetSpec('operator-meridian-lod0', 'operator', '/models/operator-meridian-lod0.glb');
assert(validateGraphicsAssetSpec(invalidRoot).some(issue => issue.includes('/assets/models/')), 'asset outside model root should be rejected');

const invalidFormat = createGraphicsAssetSpec('operator-meridian-lod0', 'operator', '/assets/models/operators/operator-meridian-lod0.fbx');
assert(validateGraphicsAssetSpec(invalidFormat).some(issue => issue.includes('.glb')), 'non-GLB runtime asset should be rejected');

const mismatchedLod = createGraphicsAssetSpec('operator-meridian-lod1', 'operator', '/assets/models/operators/operator-meridian-lod0.glb', 1);
assert(validateGraphicsAssetSpec(mismatchedLod).some(issue => issue.includes('-lod1.glb')), 'LOD filename mismatch should be rejected');

assert(graphicsAssetLodForDetailScale(1) === 0, 'high detail should request LOD0');
assert(graphicsAssetLodForDetailScale(0.78) === 1, 'balanced detail should request LOD1');
assert(graphicsAssetLodForDetailScale(0.5) === 2, 'performance detail should request LOD2');
assert(graphicsAssetLodForDetailScale(Number.NaN) === 2, 'invalid detail scale should fail safe to LOD2');

const family: GraphicsAssetFamily = {
  id: 'operator-meridian',
  lods: {
    0: operator,
    2: createGraphicsAssetSpec('operator-meridian-lod2', 'operator', '/assets/models/operators/operator-meridian-lod2.glb', 2),
  },
};
assert(selectGraphicsAssetSpec(family, 1)?.lod === 0, 'high tier should choose LOD0 when available');
assert(selectGraphicsAssetSpec(family, 0.78)?.lod === 2, 'balanced tier should prefer a lower-detail fallback over LOD0');
assert(selectGraphicsAssetSpec(family, 0.5)?.lod === 2, 'performance tier should choose LOD2');

const source = readFileSync(resolve(process.cwd(), 'src/game/graphicsAssets.ts'), 'utf8');
assert(source.includes("import('three/examples/jsm/loaders/GLTFLoader.js')"), 'GLTFLoader must remain a dynamic import');
assert(source.includes("import('three/examples/jsm/libs/meshopt_decoder.module.js')"), 'Meshopt decoder must remain deferred with authored assets');
assert(source.includes("import('three/examples/jsm/loaders/KTX2Loader.js')"), 'KTX2 loader must remain deferred with authored assets');
assert(source.includes("import('three/examples/jsm/utils/SkeletonUtils.js')"), 'rigged asset cloning must use SkeletonUtils');
assert(!source.includes("import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'"), 'GLTFLoader must not become an eager runtime import');
assert(source.includes('gltfCache.delete(spec.url)'), 'failed asset requests must be evicted so they can retry');
assert(source.includes('activeInstances'), 'asset cache must track mounted instances before disposal');
assert(source.includes('texture.dispose()'), 'cached asset eviction must release textures');
assert(source.includes('skeleton.dispose()'), 'asset lifecycle must release skeleton GPU resources');

const manifestSource = readFileSync(resolve(process.cwd(), 'src/game/graphicsAssetManifest.ts'), 'utf8');
assert(manifestSource.includes("operator-field-suit-lod1.glb"), 'operator asset family must reference the articulated authored LOD1 GLB');
assert(manifestSource.includes("operator-field-suit-lod2.glb"), 'operator asset family must retain the lightweight LOD2 fallback');
for (const role of ['assault', 'suppressor', 'technician', 'elite']) {
  assert(manifestSource.includes(`enemy-${role}-lod1.glb`), `enemy manifest must include authored ${role} LOD1`);
  assert(manifestSource.includes(`enemy-${role}-lod2.glb`), `enemy manifest must include mobile ${role} LOD2`);
}
assert(manifestSource.includes("enemy-boss-lod1.glb") && manifestSource.includes("enemy-boss-lod2.glb"), 'enemy manifest must include authored boss LOD1/LOD2 silhouettes');
for (const weapon of ['carbine', 'breacher', 'rail']) {
  assert(manifestSource.includes(`weapon-${weapon}-lod1.glb`), `weapon manifest must include authored ${weapon} LOD1`);
  assert(manifestSource.includes(`weapon-${weapon}-lod2.glb`), `weapon manifest must include mobile ${weapon} LOD2`);
}

for (const operatorClass of ['vanguard', 'vector', 'systems']) {
  assert(manifestSource.includes(`operator-${operatorClass}-lod1.glb`), `operator manifest must include class silhouette LOD1 for ${operatorClass}`);
  assert(manifestSource.includes(`operator-${operatorClass}-lod2.glb`), `operator manifest must include class-preserving mobile LOD2 for ${operatorClass}`);
}
assert(manifestSource.includes('OPERATOR_CLASS_ASSET_FAMILIES'), 'operator manifest must expose class-specific asset families');

for (const asset of ['floor-panel', 'bulkhead', 'processor', 'pipe-rack', 'crate', 'terminal']) {
  assert(manifestSource.includes(`refinery-${asset}-lod1.glb`), `refinery manifest must include authored ${asset} LOD1`);
  assert(manifestSource.includes(`refinery-${asset}-lod2.glb`), `refinery manifest must include authored ${asset} LOD2`);
}

const hardSciFiSource = readFileSync(resolve(process.cwd(), 'src/game/hardSciFiVisuals.ts'), 'utf8');
const campaignLocations = ['orbital-station', 'damaged-vessel', 'asteroid-refinery', 'spin-habitat', 'jovian-harvester', 'ice-mine', 'solar-yard', 'lattice-annex', 'momentum-exchange', 'cryo-reserve'];
for (const location of campaignLocations) {
  assert(hardSciFiSource.includes(`'${location}': { silhouette:`), `location art identity missing for ${location}`);
}
assert(hardSciFiSource.includes('new THREE.InstancedMesh(caseGeometry') && hardSciFiSource.includes('new THREE.InstancedMesh(postGeometry'), 'shared environment prop library must use instancing');
assert(hardSciFiSource.includes('root.userData.sharedPropInstances = 20'), 'shared prop library must expose its bounded instance count');
assert(hardSciFiSource.includes('addSharedPropLibrary(environment, mission.location'), 'every campaign environment must receive the shared prop library');

const rendererSource = readFileSync(resolve(process.cwd(), 'src/game/threeCombatRenderer.ts'), 'utf8');
assert(rendererSource.includes('OPERATOR_ASSET_FAMILY') && rendererSource.includes('OPERATOR_CLASS_ASSET_FAMILIES') && rendererSource.includes("from './graphicsAssetManifest'"), 'combat renderer must consume generic and class-specific authored operator manifests');
assert(rendererSource.includes('configureGraphicsAssetRenderer(this.renderer)'), 'combat renderer must configure authored texture support lazily at runtime');
assert(rendererSource.includes('void this.loadAuthoredOperator(state.build.operatorClass)'), 'authored operator loading must wait for simulation class identity before requesting a mobile model');
assert(rendererSource.includes('await instantiateGraphicsAsset(spec)'), 'combat renderer must instantiate the cached authored operator GLB');
assert(rendererSource.includes("dataset.operatorVisual = 'procedural-fallback'"), 'authored operator load failures must keep the procedural fallback active');
assert(rendererSource.includes('dataset.operatorClassAsset'), 'runtime QA must expose which class-specific operator asset was requested');
assert(rendererSource.includes('this.proceduralOperatorVisuals.forEach'), 'procedural body visuals must only be hidden after authored load succeeds');
assert(rendererSource.includes('material.color.setHex(suitColor)'), 'authored operator materials must preserve faction color identity');
assert(rendererSource.includes('this.operatorAssetInstance?.release()'), 'combat renderer disposal must release the authored operator lease');
assert(rendererSource.includes("root.getObjectByName('weapon-socket')"), 'authored operator integration must require the weapon socket');
assert(rendererSource.includes('syncAuthoredOperatorAnimation(state)'), 'authored operator must receive simulation-driven animation poses');
assert(rendererSource.includes("dataset.operatorRig = 'articulated'"), 'runtime QA must expose articulated-rig activation');
assert(rendererSource.includes("dataset.operatorAnimation = mode"), 'runtime QA must expose the active animation state');
assert(rendererSource.includes('operatorHitUntil'), 'authored operator must track visual-only hit reactions');
assert(rendererSource.includes("dataset.operatorBlend"), 'operator animation blending telemetry must remain available for QA');

assert(rendererSource.includes('ENEMY_ASSET_FAMILIES[enemy.role]'), 'enemy rendering must select authored assets by combat role');
assert(rendererSource.includes('void this.loadAuthoredEnemy(visual, enemy)'), 'enemy visuals must load authored assets while retaining procedural fallback');
assert(rendererSource.includes('syncAuthoredEnemyAnimation(visual, enemy, state)'), 'enemy animation must derive from deterministic simulation state');
assert(rendererSource.includes("dataset.enemyVisual = 'authored'"), 'runtime QA must expose authored enemy activation');
assert(rendererSource.includes('visual.proceduralVisuals.forEach'), 'procedural enemy bodies must only hide after authored loading succeeds');
assert(rendererSource.includes('WEAPON_ASSET_FAMILIES[id]'), 'player weapon loading must use authored weapon families');
assert((rendererSource.match(/this\.coarse \? 0\.55 : 1/g) ?? []).length >= 3, 'coarse-pointer devices must select mobile LOD2 for operator, enemy, and weapon assets');
assert(rendererSource.includes('void this.loadAuthoredWeapons()'), 'authored player weapons must load through the shared asset pipeline');
assert(rendererSource.includes("root.getObjectByName('muzzle-socket')"), 'authored weapons must expose muzzle sockets');
assert(rendererSource.includes('syncAuthoredWeapon(state, operatorFaction)'), 'authored weapons must receive visual-only simulation state');
assert(rendererSource.includes("dataset.weaponVisual = loaded.length === 3 ? 'authored'"), 'runtime QA must expose authored weapon readiness');
assert(rendererSource.includes("dataset.weaponFx = player.currentWeapon === 'rail' ? 'lance'"), 'weapon-specific combat readability language must remain explicit');
assert(rendererSource.includes("'armor-spark'") && rendererSource.includes("'metal-spark'") && rendererSource.includes("'electrical-flash'"), 'impact effects must preserve target/surface-specific visual language');
assert(rendererSource.includes('dataset.impactFx'), 'impact FX classification must remain observable for runtime QA');

assert(rendererSource.includes('REFINERY_ASSET_FAMILIES'), 'showcase environment must load through authored refinery asset families');
assert(rendererSource.includes('DAMAGED_VESSEL_ASSET_FAMILIES'), 'Damaged Vessel second pass must load through authored asset families');
assert(manifestSource.includes('damaged-vessel-broken-rib-lod1.glb') && manifestSource.includes('damaged-vessel-broken-rib-lod2.glb'), 'Damaged Vessel broken ribs must preserve adaptive LOD coverage');
assert(manifestSource.includes('damaged-vessel-breach-frame-lod1.glb') && manifestSource.includes('damaged-vessel-breach-frame-lod2.glb'), 'Damaged Vessel breach landmark must preserve adaptive LOD coverage');
assert(manifestSource.includes('damaged-vessel-salvage-rack-lod1.glb') && manifestSource.includes('damaged-vessel-salvage-rack-lod2.glb'), 'Damaged Vessel salvage racks must preserve adaptive LOD coverage');
assert(manifestSource.includes('damaged-vessel-torn-wall-plate-lod1.glb') && manifestSource.includes('damaged-vessel-torn-wall-plate-lod2.glb'), 'Damaged Vessel torn wall plates must preserve adaptive LOD coverage');
assert(manifestSource.includes('damaged-vessel-service-bundle-lod1.glb') && manifestSource.includes('damaged-vessel-service-bundle-lod2.glb'), 'Damaged Vessel service bundles must preserve adaptive LOD coverage');
assert(rendererSource.includes('loadAuthoredDamagedVesselEnvironment(world.w, world.h, budget.detailScale)'), 'Damaged Vessel authored overlay must select LOD from the active render tier');
assert(rendererSource.includes("dataset.environmentVisual = 'authored-damaged-vessel'"), 'runtime QA must expose Damaged Vessel authored overlay activation');
assert(rendererSource.includes("dataset.environmentLandmark = 'starboard-hull-breach'"), 'Damaged Vessel second pass must expose its breach landmark');
assert(rendererSource.includes("dataset.environmentComposition = 'broken-rib-corridor+starboard-breach+torn-shell+perimeter-salvage'"), 'Damaged Vessel authored composition contract must remain explicit');
assert(rendererSource.includes("dataset.environmentVfx = 'breach-vapor:18+scorch:6'"), 'Damaged Vessel bounded decompression VFX must remain observable for QA');
assert(rendererSource.includes('buildDamagedVesselAtmospherics(width, height)'), 'Damaged Vessel authored pass must mount its bounded atmospheric layer');
assert(rendererSource.includes('syncDamagedVesselAtmospherics(state'), 'Damaged Vessel atmosphere must scale with the adaptive render budget');
assert(rendererSource.includes('damaged-vessel-emergency:breach+salvage+contact:player+enemy+practical:'), 'Damaged Vessel must expose its emergency practical-lighting recipe');
const syncCameraSource = rendererSource.slice(rendererSource.indexOf('private syncCamera'), rendererSource.lastIndexOf('\n}'));
assert(!syncCameraSource.includes('this.keyLight.intensity = 2.4;'), 'camera sync must not overwrite authored location key-light intensity');
assert(!syncCameraSource.includes('this.renderer.toneMappingExposure = 1.08;'), 'camera sync must not overwrite authored location exposure');
assert(rendererSource.includes('loadAuthoredRefineryEnvironment(state, world.w, world.h, budget.detailScale)'), 'Asteroid Refinery authored environment must select LOD from the active render tier');
assert(rendererSource.includes('new THREE.InstancedMesh'), 'repeated refinery props must use instancing');
assert(rendererSource.includes("dataset.environmentVisual = 'authored-refinery'"), 'runtime QA must expose authored refinery activation');
assert(rendererSource.includes("dataset.environmentKit = 'floor,floor-grate,bulkhead,processor,pipe-rack,wall-panel,cable-tray,service-conduit,gantry,crate,terminal'"), 'runtime QA must expose the complete refinery kit');
assert(manifestSource.includes('refinery-floor-service-grate-lod1.glb') && manifestSource.includes('refinery-floor-service-grate-lod2.glb'), 'refinery floor variation must preserve adaptive LOD coverage');
assert(manifestSource.includes('refinery-wall-service-panel-lod1.glb') && manifestSource.includes('refinery-wall-service-panel-lod2.glb'), 'refinery wall panels must preserve adaptive LOD coverage');
assert(manifestSource.includes('refinery-cable-tray-lod1.glb') && manifestSource.includes('refinery-cable-tray-lod2.glb'), 'refinery cable trays must preserve adaptive LOD coverage');
assert(manifestSource.includes('refinery-service-conduit-lod1.glb') && manifestSource.includes('refinery-service-conduit-lod2.glb'), 'refinery second-pass service conduit must preserve adaptive LOD coverage');
assert(manifestSource.includes('refinery-smelter-gantry-lod1.glb') && manifestSource.includes('refinery-smelter-gantry-lod2.glb'), 'refinery landmark gantry must preserve adaptive LOD coverage');
assert(rendererSource.includes("dataset.environmentLandmark = 'ore-smelter-gantry'"), 'refinery second pass must expose the bespoke landmark for runtime QA');
assert(rendererSource.includes('dataset.environmentServiceDetails') && rendererSource.includes('service-conduit:'), 'refinery second pass must expose secondary service-detail coverage');
assert(rendererSource.includes('dataset.environmentSurfaceDetail') && rendererSource.includes('wall-panel:') && rendererSource.includes('cable-tray:') && rendererSource.includes('contact-darkening:10'), 'refinery wall/cable/contact detail coverage must remain observable for runtime QA');
assert(rendererSource.includes('dataset.environmentMachineDetail') && rendererSource.includes('processor-functional:3+floor-grate:'), 'refinery processor/floor refinement coverage must remain observable for runtime QA');
assert(rendererSource.includes("dataset.environmentComposition = 'clear-center-lane+processor-triangle+gantry-focal+perimeter-clutter'"), 'refinery final composition must preserve the clear combat lane and focal hierarchy');
assert(rendererSource.includes('safetyLaneMarkers') && rendererSource.includes('steamStacks'), 'refinery final polish must align decals and atmosphere with composition instead of the center lane');
assert(rendererSource.includes('world.w * 0.50') && rendererSource.includes('world.h * 0.23'), 'refinery practical lighting must emphasize the north processing/gantry focal zone');
assert(rendererSource.includes('this.proceduralRefineryVisuals.forEach'), 'procedural refinery scenery must remain as a load-failure fallback');
assert(rendererSource.includes('playerReadabilityLight') && rendererSource.includes('nearestEnemyDistanceSq') && rendererSource.includes('refineryPracticalLights'), 'lighting pass must preserve player/enemy contact light and bounded practical lights');
assert(rendererSource.includes('cloneRefineryMaterial') && rendererSource.includes("'pbr-bounded+emissive+decals:safety+grime+contact-darkening'"), 'refinery materials must use bounded PBR tuning plus controlled safety/grime/contact detail');
assert(rendererSource.includes("'steam+sparse-sparks+debris+breach+objective'"), 'refinery VFX telemetry must cover atmosphere, impacts, debris, breaches, and objectives');
assert(rendererSource.includes('impactSparkPool') && rendererSource.includes("'shape-coded+surface-impacts+ability-pulses'"), 'combat VFX must keep shape-coded impact/ability language');
assert(rendererSource.includes("dataset.effectsMode = reducedEffects ? 'reduced' : 'full'"), 'reduced-effects mode must remain explicit for runtime QA');
assert(rendererSource.includes("'shape+silhouette+luminance'"), 'gameplay-significant visual language must not rely on hue alone');
assert(rendererSource.includes("'objective-chevron'"), 'objective effects must retain a shape-coded high-contrast beacon');
assert(rendererSource.includes('mesh.material.emissiveIntensity = speed > 240 ? 0.18 : 0'), 'debris readability polish must remain bounded and quality-aware');
assert(rendererSource.includes('syncHardSciFiBreaches(this.dynamicRoot, state, WORLD_SCALE, quality * budget.vfxDensity)'), 'breach particles must follow the adaptive VFX-density budget');
assert(rendererSource.includes("'boss-signature-root'") && rendererSource.includes("'boss-phase-ring'") && rendererSource.includes('boss-signature-pylon-'), 'boss visual must add a bespoke silhouette assembly beyond ordinary enemy presentation');
assert(rendererSource.includes("'boss-telegraph-wedge'") && rendererSource.includes('enemy.telegraph > 0'), 'boss attack telegraphs must use a shape-coded directional wedge');
assert(rendererSource.includes("'armor-break+phase-emissive+low-hp-pulse'") && rendererSource.includes('enemy.bossPhase === 2'), 'boss phase/damage state must drive authored material and signature VFX changes');
assert(rendererSource.includes("'phase2-practical-pulse'") && rendererSource.includes('bossPulse'), 'boss phase must trigger a bounded environment lighting reaction');
for (const location of campaignLocations) {
  assert(rendererSource.includes(`'${location}': { id:`), `location lighting profile missing for ${location}`);
}
assert(rendererSource.includes('dataset.locationArt') && rendererSource.includes('dataset.locationProps'), 'runtime QA must expose location art identity and shared prop telemetry');
assert(rendererSource.includes('lightingProfile.keyColor') && rendererSource.includes('lightingProfile.rimColor') && rendererSource.includes('lightingProfile.exposure'), 'location lighting identity must drive color, intensity, and exposure');
assert(rendererSource.includes('dataset.renderTier = budget.tierName') && rendererSource.includes('dataset.renderBudget'), 'runtime QA must expose adaptive render-tier budgets');
assert(rendererSource.includes('budget.shadowMapSize') && rendererSource.includes('budget.vfxDensity') && rendererSource.includes('budget.transparencyScale'), 'renderer must apply explicit shadow, VFX-density, and transparency budgets');
assert(rendererSource.includes('syncHardSciFiEnvironment(this.environmentRoot, state, mission, budget.detailScale, budget.transparencyScale)'), 'environment atmosphere must follow detail/transparency budgets');
assert(rendererSource.includes('this.syncProjectiles(state, budget.transparencyScale)'), 'projectile trails must follow the transparency budget');
assert(rendererSource.includes('this.syncEffects(state, quality * budget.detailScale, budget.vfxDensity, budget.transparencyScale)'), 'combat effects must follow detail, VFX-density, and transparency budgets');



console.log('GRAPHICS_ASSET_PIPELINE_PASS format=glb mesh=meshopt textures=ktx2 loader=deferred lifecycle=leased lod=adaptive+mobile-lod2 operator=articulated+class-silhouette enemies=role-authored+mobile-lod2 weapons=authored+mobile-lod2+surface-impacts environment=refinery-instanced+phase6 lighting=key+rim+contact+practical materials=pbr-bounded+emissive+decals:safety+grime vfx=shape-coded+debris+reduced-effects readability=shape+silhouette+luminance boss=signature+phase+telegraph locations=10+shared-instancing render-tiers=high+balanced+performance sockets=muzzle animation=state-driven operatorTriangles=45000 enemyTriangles=30000 weaponTriangles=12000 environmentTriangles=20000');
