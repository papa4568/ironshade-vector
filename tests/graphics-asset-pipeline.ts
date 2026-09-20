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

const pickup = createGraphicsAssetSpec('pickup-recovery-capsule-lod1', 'pickup', '/assets/models/pickups/pickup-recovery-capsule-lod1.glb', 1);
assert(pickup.triangleBudget === 4_000 && pickup.compressedByteBudget === 240_000, 'pickup budget must remain lightweight for mobile');
const interactable = createGraphicsAssetSpec('interactable-control-terminal-lod1', 'interactable', '/assets/models/interactables/interactable-control-terminal-lod1.glb', 1);
assert(interactable.triangleBudget === 8_000 && interactable.compressedByteBudget === 480_000, 'interactable budget must remain bounded for mobile');

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
assert(manifestSource.includes('PICKUP_ASSET_FAMILY'), 'manifest must expose the authored recovery pickup family');
assert(manifestSource.includes('pickup-recovery-capsule-lod1.glb') && manifestSource.includes('pickup-recovery-capsule-lod2.glb'), 'recovery pickup must preserve adaptive LOD coverage');
assert(manifestSource.includes('INTERACTABLE_ASSET_FAMILIES'), 'manifest must expose gameplay interactable families');
for (const interactableAsset of ['interactable-control-terminal', 'interactable-salvage-tag-node']) {
  assert(manifestSource.includes(`${interactableAsset}-lod1.glb`) && manifestSource.includes(`${interactableAsset}-lod2.glb`), `${interactableAsset} must preserve adaptive LOD coverage`);
}

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
assert(rendererSource.includes('void this.loadAuthoredEnemy(visual, enemy, mission)'), 'enemy visuals must load authored assets while retaining procedural fallback');
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
assert(rendererSource.includes('PICKUP_ASSET_FAMILY') && rendererSource.includes('loadAuthoredGroundLoot'), 'ground loot must use the authored recovery pickup family');
assert(rendererSource.includes("'authored-capsule+rarity-ring+beam'"), 'authored loot must retain rarity ring/beam readability support');
assert(rendererSource.includes('INTERACTABLE_ASSET_FAMILIES') && rendererSource.includes('loadAuthoredInteractable'), 'mission controls and salvage nodes must load authored interactable assets');
assert(rendererSource.includes("dataset.interactableMode = 'control-terminal+salvage-tag-node'"), 'runtime QA must expose authored interactable coverage');
assert(rendererSource.includes('this.coarse ? 0.55 : 1'), 'mobile authored props must continue selecting LOD2 on coarse-pointer devices');



assert(rendererSource.includes('JOVIAN_HARVESTER_ASSET_FAMILIES'), 'Jovian Harvester P2.10 must load through authored environment asset families');
for (const asset of ['jovian-harvester-deck-span', 'jovian-harvester-skimmer-tower', 'jovian-harvester-transfer-bridge', 'jovian-harvester-ballast-pod']) {
  assert(manifestSource.includes(`${asset}-lod1.glb`) && manifestSource.includes(`${asset}-lod2.glb`), `Jovian Harvester P2.10 asset ${asset} must preserve adaptive LOD1/LOD2 coverage`);
}
assert(rendererSource.includes('loadAuthoredJovianHarvesterEnvironment(world.w, world.h, budget.detailScale)'), 'Jovian Harvester P2.10 authored overlay must select LOD from the active render tier');
assert(rendererSource.includes("dataset.environmentVisual = 'authored-jovian-harvester'"), 'Jovian Harvester P2.10 authored activation must remain observable');
assert(rendererSource.includes("dataset.environmentKit = 'deck-span,skimmer-tower,transfer-bridge,ballast-pod'"), 'Jovian Harvester P2.10 environment kit identity must remain explicit');
assert(rendererSource.includes("dataset.environmentComposition = 'elevated-skimmer-decks+five-tower-spine+transfer-bridges+ballast-pods'"), 'Jovian Harvester P2.10 screenshot silhouette must preserve the five-tower platform composition');
assert(rendererSource.includes("dataset.environmentZoneIdentity = 'deck:weathered-plate|tower:vertical-skimmer-spine|bridge:dark-transfer-truss|ballast:light-suspended-pod'"), 'Jovian Harvester P2.10 zone identity must remain observable');
assert(rendererSource.includes('this.proceduralRefineryVisuals.push(...jovianVisuals)'), 'Jovian Harvester P2.10 procedural scenery must remain available as an authored-load fallback');
const jovianAssetGeneratorSource = readFileSync(resolve(process.cwd(), 'scripts/prepare-graphics-assets.mjs'), 'utf8');
for (const material of ['jovian-harvester-weathered-shell', 'jovian-harvester-dark-structure', 'jovian-harvester-deck-plating', 'jovian-harvester-amber-emissive', 'jovian-harvester-ballast-shell']) {
  assert(jovianAssetGeneratorSource.includes(`name: '${material}'`), `Jovian Harvester P2.10 material identity ${material} must remain authored`);
}
for (const marker of ['jovian-harvester-deck-span-main', 'jovian-harvester-skimmer-tower-spine', 'jovian-harvester-transfer-bridge-main', 'jovian-harvester-ballast-pod-shell']) {
  assert(jovianAssetGeneratorSource.includes(`name: '${marker}'`), `Jovian Harvester P2.10 silhouette marker ${marker} must remain authored`);
}

assert(manifestSource.includes('ICE_MINE_ASSET_FAMILIES'), 'Ice Mine P3.1 must register a dedicated authored environment asset kit');
for (const asset of ['ice-mine-frost-wall', 'ice-mine-support-frame', 'ice-mine-service-deck', 'ice-mine-ice-pillar']) {
  assert(manifestSource.includes(`${asset}-lod1.glb`) && manifestSource.includes(`${asset}-lod2.glb`), `Ice Mine P3.1 asset ${asset} must preserve adaptive LOD1/LOD2 coverage`);
}
for (const material of ['ice-mine-frozen-rock', 'ice-mine-support-steel', 'ice-mine-service-deck', 'ice-mine-frost-ice', 'ice-mine-cold-emissive']) {
  assert(jovianAssetGeneratorSource.includes(`name: '${material}'`), `Ice Mine P3.1 material identity ${material} must remain authored`);
}
for (const marker of ['ice-mine-frost-wall-rock', 'ice-mine-support-frame-crown', 'ice-mine-service-deck-main', 'ice-mine-ice-pillar-core']) {
  assert(jovianAssetGeneratorSource.includes(`name: '${marker}'`), `Ice Mine P3.1 silhouette marker ${marker} must remain authored`);
}

assert(rendererSource.includes('ICE_MINE_ASSET_FAMILIES'), 'Ice Mine P3.2 must load the authored environment kit at runtime');
assert(rendererSource.includes('loadAuthoredIceMineEnvironment(state, world.w, world.h, budget.detailScale)'), 'Ice Mine P3.2 must route combat rendering through authored bore/tunnel composition');
assert(rendererSource.includes("dataset.environmentVisual = 'authored-ice-mine'"), 'Ice Mine P3.2 authored activation must remain observable');
assert(rendererSource.includes("dataset.environmentKit = 'frost-wall,support-frame,service-deck,ice-pillar'"), 'Ice Mine P3.2 runtime kit identity must remain explicit');
assert(rendererSource.includes("dataset.environmentComposition = 'access-bore+reinforced-extraction-tunnel+subglacial-vault'"), 'Ice Mine P3.2 must preserve the three-zone mine composition');
assert(rendererSource.includes("dataset.environmentTunnelSequence = 'access-bore>extraction-tunnel>subglacial-vault'"), 'Ice Mine P3.2 must preserve the authored bore-to-vault sequence');
assert(rendererSource.includes("dataset.environmentZoneIdentity = 'access-bore:frost-wall-cut|extraction-tunnel:steel-support-frames+service-deck|subglacial-vault:ice-pillar-cluster'"), 'Ice Mine P3.2 zone silhouettes must remain explicit');
assert(rendererSource.includes("dataset.readabilityLanguage = 'frost-wall-corridor+support-frame-rhythm+cyan-service-deck+vault-pillars'"), 'Ice Mine P3.2 screenshot readability language must remain explicit');
assert(rendererSource.includes('this.proceduralRefineryVisuals.push(...iceMineFallback)'), 'Ice Mine P3.2 must retain procedural scenery as an authored-load fallback');
assert(rendererSource.includes('this.coarse ? Math.min(detailScale, 0.55) : detailScale'), 'Ice Mine P3.2 coarse/mobile runtime must force the authored mobile LOD');

assert(rendererSource.includes('iceMineBrittleSupportVisuals = new Map'), 'Ice Mine P3.3 must keep authored brittle support visuals addressable by gameplay object id');
assert(rendererSource.includes("this.iceMineBrittleSupportVisuals.set(support.id, root)"), 'Ice Mine P3.3 must bind brittle gameplay supports to authored support-frame roots');
assert(rendererSource.includes('syncIceMineBrittleSupports(state, mission)'), 'Ice Mine P3.3 must synchronize authored support visibility from live simulation state');
assert(rendererSource.includes('dataset.environmentBrittleSupports'), 'Ice Mine P3.3 support destruction must expose deterministic runtime QA telemetry');
assert(rendererSource.includes('dataset.environmentBrittleSupportState'), 'Ice Mine P3.3 must expose intact/partial/cleared support state');
assert(rendererSource.includes("mission.location === 'ice-mine' && this.iceMineBrittleSupportVisuals.has(object.id)"), 'Ice Mine P3.3 authored supports must suppress duplicate procedural collision-box visuals once loaded');

assert(rendererSource.includes('JOVIAN_HARVESTER_INTERACTABLE_ASSET_FAMILIES'), 'Jovian Harvester P2.11 must select dedicated authored gas machinery families');
for (const asset of ['jovian-harvester-storm-bus-isolator', 'jovian-harvester-deck-mass-trim', 'jovian-harvester-skimmer-compressor', 'jovian-harvester-separator-package']) {
  assert(manifestSource.includes(`${asset}-lod1.glb`) && manifestSource.includes(`${asset}-lod2.glb`), `Jovian Harvester P2.11 machinery asset ${asset} must preserve adaptive LOD1/LOD2 coverage`);
}
assert(rendererSource.includes('JOVIAN_HARVESTER_INTERACTABLE_ASSET_FAMILIES.stormBusIsolator'), 'Jovian P2.11 electrostatic harvesting branches must use the storm-bus isolator machinery');
assert(rendererSource.includes('JOVIAN_HARVESTER_INTERACTABLE_ASSET_FAMILIES.deckMassTrim'), 'Jovian P2.11 gravity calibration must use the deck mass-trim machinery');
assert(rendererSource.includes("mission.objectiveMode === 'machinery-recovery' && object.id === 'salvage-node-a'"), 'Jovian P2.11 skimmer compressor must bind to the first live machinery-recovery target');
assert(rendererSource.includes('JOVIAN_HARVESTER_INTERACTABLE_ASSET_FAMILIES.skimmerCompressor'), 'Jovian P2.11 skimmer compressor family must bind to live recovery gameplay');
assert(rendererSource.includes('JOVIAN_HARVESTER_INTERACTABLE_ASSET_FAMILIES.separatorPackage'), 'Jovian P2.11 separator package family must bind to live recovery gameplay');
assert(rendererSource.includes("dataset.interactableBiome = 'jovian-harvester'"), 'Jovian P2.11 authored machinery activation must remain observable for QA');
assert(rendererSource.includes("dataset.interactableMode = 'jovian-gas-machinery+mission-controls'"), 'Jovian P2.11 must expose its gameplay-specific machinery mode');
assert(rendererSource.includes("dataset.interactableKit = 'storm-bus-isolator+deck-mass-trim+skimmer-compressor+separator-package'"), 'Jovian P2.11 must expose the complete gas machinery kit');
for (const marker of ['jovian-harvester-storm-bus-isolator-knife', 'jovian-harvester-deck-mass-trim-actuator', 'jovian-harvester-skimmer-compressor-intake', 'jovian-harvester-separator-package-vessel']) {
  assert(jovianAssetGeneratorSource.includes(`name: '${marker}'`), `Jovian Harvester P2.11 machinery silhouette marker ${marker} must remain authored`);
}

assert(rendererSource.includes("from './jovianHarvesterVisualLanguage'"), 'Jovian P2.12 must derive its storm/pressure state through the dedicated gameplay visual helper');
assert(rendererSource.includes("stormRoot.name = 'jovian-harvester-storm-pressure-language'"), 'Jovian P2.12 must keep storm/pressure geometry as an explicit biome visual layer');
assert(rendererSource.includes('sweep.name = `jovian-harvester-storm-charge-sweep-${index}`'), 'Jovian P2.12 must preserve electrostatic storm-charge sweep markers');
assert(rendererSource.includes('band.name = `jovian-harvester-pressure-shear-band-${index}`'), 'Jovian P2.12 must preserve unequal-pressure shear band markers');
assert(rendererSource.includes("reliefPulse.name = 'jovian-harvester-relief-manifold-pulse'"), 'Jovian P2.12 must preserve a dedicated relief-manifold pulse marker');
assert(rendererSource.includes("dataset.environmentStormLanguage = 'storm-charge-sweeps+pressure-shear-bands+relief-pulse'"), 'Jovian P2.12 storm/pressure language must remain explicit for runtime QA');
assert(rendererSource.includes("dataset.environmentStormSource = 'live-sector-pressure+service-breach+contract-conditions'"), 'Jovian P2.12 must bind visual intensity to live mission state rather than decorative randomness');
assert(rendererSource.includes("dataset.environmentVfx = 'storm-charge-sweeps+pressure-shear-bands+relief-pulse'"), 'Jovian P2.12 must expose its visual-language VFX identity');
assert(rendererSource.includes("dataset.readabilityLanguage = 'tower-height+bridge-lines+amber-wayfinding+pressure-shear+storm-charge'"), 'Jovian P2.12 screenshot readability must include storm charge and pressure shear');

for (const asset of ['jovian-harvester-storm-pressure-lock', 'jovian-harvester-relief-manifold']) {
  assert(manifestSource.includes(`${asset}-lod1.glb`) && manifestSource.includes(`${asset}-lod2.glb`), `Jovian Harvester P2.13 pressure asset ${asset} must preserve adaptive LOD1/LOD2 coverage`);
}
assert(rendererSource.includes('JOVIAN_HARVESTER_INTERACTABLE_ASSET_FAMILIES.stormPressureLock'), 'Jovian P2.13 pressure doors must use the storm-rated pressure-lock asset');
assert(rendererSource.includes('JOVIAN_HARVESTER_INTERACTABLE_ASSET_FAMILIES.reliefManifold'), 'Jovian P2.13 seal controls must use the relief-manifold asset');
assert(rendererSource.includes("dataset.interactablePressureKit = 'storm-pressure-lock+relief-manifold'"), 'Jovian P2.13 pressure hardware kit must remain explicit for runtime QA');
assert(rendererSource.includes("dataset.interactablePressureSource = 'live-pressure-links+breach-state+sector-pressure'"), 'Jovian P2.13 pressure hardware must expose its live gameplay state source');
assert(rendererSource.includes("dataset.interactablePressureState = serviceBreach?.active && !serviceBreach.sealed"), 'Jovian P2.13 relief manifold state must follow the live service breach');
assert(rendererSource.includes("dataset.interactablePressureDoor = pressureDoor?.open ? 'open' : 'sealed'"), 'Jovian P2.13 pressure-lock state must follow the live pressure link');
for (const marker of ['jovian-harvester-storm-pressure-lock-wheel', 'jovian-harvester-relief-manifold-valve']) {
  assert(jovianAssetGeneratorSource.includes(`name: '${marker}'`), `Jovian Harvester P2.13 pressure silhouette marker ${marker} must remain authored`);
}

assert(manifestSource.includes("id: 'jovian-harvester-stormline-foreman'"), 'Jovian Harvester P2.14 must register a dedicated Stormline Foreman boss asset family');
assert(manifestSource.includes('/assets/models/bosses/jovian-harvester-stormline-foreman-lod1.glb') && manifestSource.includes('/assets/models/bosses/jovian-harvester-stormline-foreman-lod2.glb'), 'Stormline Foreman must preserve adaptive LOD1/LOD2 coverage');
assert(rendererSource.includes("mission.deepTarget !== 'Stormline Foreman Ilex'"), 'Stormline Foreman authored presentation must remain scoped to the Chapter 2 Jovian contract');
assert(rendererSource.includes("dataset.bossPresentation = 'stormline-foreman-ilex'"), 'Stormline Foreman authored presentation must be observable for runtime QA');
assert(rendererSource.includes("dataset.bossSilhouette = 'storm-cowl+pressure-crown+relief-stacks'"), 'Stormline Foreman must expose his authored pressure-work silhouette');
assert(rendererSource.includes("visual.authoredAssetId === 'jovian-harvester-stormline-foreman'"), 'Stormline Foreman must receive a dedicated phase-aware presentation palette');
assert(jovianAssetGeneratorSource.includes("name: 'jovian-harvester-stormline-foreman-storm-cowl'"), 'Stormline Foreman P2.14 must preserve the authored storm-cowl silhouette marker');

assert(rendererSource.includes("atmosphereRoot.name = 'jovian-harvester-atmospheric-effects'"), 'Jovian P2.15 must retain a dedicated atmospheric effects layer');
assert(rendererSource.includes('cloud.name = `jovian-harvester-pressure-cloud-${index}`'), 'Jovian P2.15 must retain broad pressure-cloud filaments');
assert(rendererSource.includes("particulate.name = 'jovian-harvester-charged-particulate'"), 'Jovian P2.15 must retain persistent charged particulate');
assert(rendererSource.includes("spineHaze.name = 'jovian-harvester-skimmer-spine-haze'"), 'Jovian P2.15 must retain the skimmer-spine atmosphere haze');
assert(rendererSource.includes("dataset.environmentAmbient = 'upper-haze+pressure-clouds+charged-particulate'"), 'Jovian P2.15 ambient identity must remain observable for QA');
assert(rendererSource.includes("dataset.environmentAmbientMotion = 'crosswind-drift+pressure-breath+charged-drift'"), 'Jovian P2.15 atmospheric motion language must remain explicit');
assert(rendererSource.includes("visibleClouds = atmosphereDensity === 'reduced' ? 2 : atmosphereDensity === 'balanced' ? 3 : 5"), 'Jovian P2.15 cloud density must scale through the existing adaptive VFX budget');
assert(rendererSource.includes("visibleMotes = atmosphereDensity === 'reduced' ? 20 : atmosphereDensity === 'balanced' ? 36 : 56"), 'Jovian P2.15 particulate density must scale through the existing adaptive VFX budget');

assert(rendererSource.includes('SPIN_HABITAT_ASSET_FAMILIES'), 'Spin Habitat must load through authored environment asset families');
for (const asset of ['spin-habitat-ring-segment', 'spin-habitat-spoke-truss', 'spin-habitat-axis-hub', 'spin-habitat-service-bay']) {
  assert(manifestSource.includes(`${asset}-lod1.glb`) && manifestSource.includes(`${asset}-lod2.glb`), `Spin Habitat asset ${asset} must preserve adaptive LOD1/LOD2 coverage`);
}
assert(rendererSource.includes('loadAuthoredSpinHabitatEnvironment(world.w, world.h, budget.detailScale)'), 'Spin Habitat authored overlay must select LOD from the active render tier');
assert(rendererSource.includes("dataset.environmentVisual = 'authored-spin-habitat'"), 'runtime QA must expose Spin Habitat authored overlay activation');
assert(rendererSource.includes("dataset.environmentKit = 'ring-segment,spoke-truss,axis-hub,service-bay'"), 'Spin Habitat authored kit identity must remain explicit');
assert(rendererSource.includes("dataset.environmentComposition = 'rotating-ring-arc+rotating-cross-spokes+stationary-axis'"), 'Spin Habitat P2.2 must preserve rotating ring/spoke architecture around a stationary axis');
assert(rendererSource.includes("dataset.environmentMotion = 'gravity-coupled-rigid-rotation'"), 'Spin Habitat P2.2 must expose gravity-coupled rigid rotation');
assert(rendererSource.includes("dataset.environmentSpinSource = 'sector-A-gravity'"), 'Spin Habitat P2.2 must derive visual rotation from the gameplay gravity state');
assert(rendererSource.includes("rotorRoot.name = 'spin-habitat-rotating-frame'"), 'Spin Habitat authored ring/spoke/service geometry must share a rotating structural frame');
assert(rendererSource.includes("rotationWitness.name = 'spin-habitat-rotation-witness'"), 'Spin Habitat procedural fallback must retain an asymmetric rotation witness');
const spinAssetGeneratorSource = readFileSync(resolve(process.cwd(), 'scripts/prepare-graphics-assets.mjs'), 'utf8');
for (const material of ['spin-habitat-rim-plating', 'spin-habitat-spoke-structure', 'spin-habitat-spoke-emissive', 'spin-habitat-axis-shell', 'spin-habitat-axis-emissive']) {
  assert(spinAssetGeneratorSource.includes(`name: '${material}'`), `Spin Habitat P2.3 material identity ${material} must remain authored`);
}
assert(spinAssetGeneratorSource.includes("{ name: 'spin-habitat-ring-segment-deck', mesh: 4"), 'Spin Habitat rim deck must use its dedicated plated material');
assert(spinAssetGeneratorSource.includes("{ name: 'spin-habitat-spoke-truss-main', mesh: 5"), 'Spin Habitat spoke truss must use its dedicated dark structural material');
assert(spinAssetGeneratorSource.includes("{ name: 'spin-habitat-axis-hub-core', mesh: 7"), 'Spin Habitat stationary axis must use its brighter dedicated shell material');
assert(rendererSource.includes("dataset.environmentZoneIdentity = 'rim:plated-green-deck|spoke:skeletal-cyan-truss|axis:bright-stationary-tower'"), 'Spin Habitat P2.3 zone identity must remain observable for QA');
assert(rendererSource.includes("axisHub.name = 'spin-habitat-procedural-axis-hub'"), 'Spin Habitat procedural fallback must retain a stationary axis landmark distinct from the rotating frame');

assert(rendererSource.includes("spindownVfx.name = 'spin-habitat-spindown-vfx'"), 'Spin Habitat P2.4 must retain a dedicated spindown VFX root');
assert(rendererSource.includes("`spin-habitat-brake-arc-${index}`"), 'Spin Habitat P2.4 must retain readable rim braking arcs');
assert(rendererSource.includes("spindownBeacon.name = 'spin-habitat-axis-warning-pulse'"), 'Spin Habitat P2.4 must retain a stationary-axis warning pulse');
assert(rendererSource.includes("dataset.environmentSpindownSource = 'sector-B-transfer-gravity'"), 'Spin Habitat P2.4 VFX must follow the gameplay transfer-gravity state');
assert(rendererSource.includes("dataset.environmentSpindownDetail = reducedSpindownDetail ? '3-arcs+axis-pulse' : '6-arcs+axis-pulse'"), 'Spin Habitat P2.4 must preserve reduced mobile/performance VFX detail');

assert(rendererSource.includes('SPIN_HABITAT_INTERACTABLE_ASSET_FAMILIES'), 'Spin Habitat P2.5 must select dedicated authored machinery families');
for (const asset of ['spin-habitat-spin-bus-isolator', 'spin-habitat-gravity-trim', 'spin-habitat-bearing-control', 'spin-habitat-attitude-flywheel', 'spin-habitat-pressure-lock']) {
  assert(manifestSource.includes(`${asset}-lod1.glb`) && manifestSource.includes(`${asset}-lod2.glb`), `Spin Habitat P2.5 machinery asset ${asset} must preserve adaptive LOD1/LOD2 coverage`);
}
assert(rendererSource.includes("mission.objectiveMode === 'machinery-recovery' && object.id === 'salvage-node-a'"), 'Spin Habitat P2.5 bearing-control machinery must bind to the real recovery objective');
assert(rendererSource.includes("mission.objectiveMode === 'machinery-recovery' && object.id === 'salvage-node-b'"), 'Spin Habitat P2.5 attitude-flywheel machinery must bind to the real recovery objective');
assert(rendererSource.includes("dataset.interactableBiome = 'spin-habitat'"), 'Spin Habitat P2.5 authored machinery activation must remain observable for QA');
assert(rendererSource.includes("dataset.interactableMode = 'spin-habitat-machinery+mission-controls'"), 'Spin Habitat P2.5 must expose its gameplay-specific interactable mode');
assert(rendererSource.includes("dataset.interactableKit = 'spin-bus-isolator+gravity-trim+bearing-control+attitude-flywheel+pressure-lock'"), 'Spin Habitat P2.5 must expose the complete machinery kit');

assert(rendererSource.includes('SPIN_HABITAT_ENEMY_ASSET_FAMILIES'), 'Spin Habitat P2.6 must select dedicated local enemy asset families');
for (const asset of ['spin-habitat-spoke-marksman', 'spin-habitat-spin-trim-specialist', 'spin-habitat-ring-drone-carrier', 'spin-habitat-axis-shield-boarder']) {
  assert(manifestSource.includes(`${asset}-lod1.glb`) && manifestSource.includes(`${asset}-lod2.glb`), `Spin Habitat P2.6 local enemy asset ${asset} must preserve adaptive LOD1/LOD2 coverage`);
}
for (const variant of ['marksman', 'gravitySpecialist', 'droneCarrier', 'shieldBoarder']) {
  assert(rendererSource.includes(`enemy.variant === '${variant}'`), `Spin Habitat P2.6 must bind authored identity to gameplay variant ${variant}`);
}
assert(rendererSource.includes("mission.location !== 'spin-habitat' || enemy.role === 'boss'"), 'Spin Habitat P2.6 must stay biome-local and leave Sable Voss boss presentation for P2.7');
assert(rendererSource.includes("dataset.enemyBiome = 'spin-habitat'"), 'Spin Habitat P2.6 local enemy activation must remain observable for QA');
assert(rendererSource.includes("dataset.enemyLocalVisual = 'authored'"), 'Spin Habitat P2.6 must expose authored local enemy activation');
assert(rendererSource.includes("dataset.enemyLocalKit = 'spoke-marksman+spin-trim-specialist+ring-drone-carrier+axis-shield-boarder'"), 'Spin Habitat P2.6 must expose its complete local enemy kit');
assert(rendererSource.includes('visual.authoredAssetId?.startsWith(\'spin-habitat-\') ? spinHabitatEnemyColor(enemy)'), 'Spin Habitat P2.6 must preserve its cool-green local palette instead of generic role tinting');

assert(manifestSource.includes("id: 'spin-habitat-sable-voss'"), 'Spin Habitat P2.7 must register a dedicated Sable Voss boss asset family');
assert(manifestSource.includes('/assets/models/bosses/spin-habitat-sable-voss-lod1.glb') && manifestSource.includes('/assets/models/bosses/spin-habitat-sable-voss-lod2.glb'), 'Sable Voss must preserve adaptive LOD1/LOD2 coverage');
assert(rendererSource.includes("mission.deepTarget !== 'Recovery Commander Sable Voss'"), 'Sable Voss authored presentation must remain scoped to her Spin Habitat boss contract');
assert(rendererSource.includes("dataset.bossPresentation = 'sable-voss'"), 'Sable Voss authored presentation must be observable for runtime QA');
assert(rendererSource.includes("dataset.bossSilhouette = 'counterspin-mantle+governor-towers+command-visor'"), 'Sable Voss must expose her authored command silhouette identity');
assert(rendererSource.includes("visual.authoredAssetId === 'spin-habitat-sable-voss'"), 'Sable Voss must receive a dedicated phase-aware presentation palette');

assert(rendererSource.includes("ambientRoot.name = 'spin-habitat-ambient-effects'"), 'Spin Habitat P2.8 must retain a dedicated ambient effects layer');
assert(rendererSource.includes("`spin-habitat-rim-light-band-${index}`"), 'Spin Habitat P2.8 must retain rotating rim light bands');
assert(rendererSource.includes("ambientDust.name = 'spin-habitat-spin-dust'"), 'Spin Habitat P2.8 must retain gravity-coupled drifting particulate');
assert(rendererSource.includes("axisHaze.name = 'spin-habitat-axis-haze'"), 'Spin Habitat P2.8 must retain a stationary-axis haze cue');
assert(rendererSource.includes("dataset.environmentAmbient = 'rim-light-sweep+spin-dust+axis-haze'"), 'Spin Habitat P2.8 ambient identity must remain observable for QA');
assert(rendererSource.includes("dataset.environmentAmbientMotion = 'gravity-coupled-sweep+counterspin-drift+stationary-axis-pulse'"), 'Spin Habitat P2.8 ambient motion language must remain explicit');
assert(rendererSource.includes("visibleBands = density === 'reduced' ? 2 : density === 'balanced' ? 3 : 4"), 'Spin Habitat P2.8 ambient effects must respect the existing adaptive VFX budget');
assert(rendererSource.includes("visibleDust = density === 'reduced' ? 20 : density === 'balanced' ? 34 : 48"), 'Spin Habitat P2.8 dust density must scale with the render tier');

assert(rendererSource.includes('const profile = spinHabitatRenderProfile(detailScale, this.coarse)'), 'Spin Habitat P2.9 must apply a biome-specific mobile/performance profile');
assert(rendererSource.includes('selectGraphicsAssetSpec(SPIN_HABITAT_ASSET_FAMILIES[key], profile.assetDetailScale)'), 'Spin Habitat P2.9 mobile profile must force authored environment LOD2');
assert(rendererSource.includes('profile.ringInstances === 6 || [0, 2, 3, 5].includes(index)'), 'Spin Habitat P2.9 must trim redundant mobile ring instances without losing the rim silhouette');
assert(rendererSource.includes('profile.serviceInstances === 4 || index === 0 || index === 3'), 'Spin Habitat P2.9 must trim non-critical mobile service bays');
assert(rendererSource.includes('rotorRoot, profile.movingShadows'), 'Spin Habitat P2.9 must suppress moving authored shadow casters outside the full profile');
assert(rendererSource.includes('spinProfile.proceduralRingSegments'), 'Spin Habitat P2.9 procedural fallback must scale ring tessellation');
assert(rendererSource.includes('dataset.environmentPerformanceProfile'), 'Spin Habitat P2.9 runtime QA must expose the active environment performance profile');
assert(rendererSource.includes('dataset.environmentInstanceBudget'), 'Spin Habitat P2.9 runtime QA must expose the reduced placement budget');
assert(rendererSource.includes("dataset.environmentShadowCasters = profile.movingShadows ? 'rotor+axis' : 'axis-only'"), 'Spin Habitat P2.9 runtime QA must expose moving-shadow suppression');

assert(rendererSource.includes('PARALLAX_ASSET_FAMILIES'), 'Cislunar Parallax Array must load through authored environment asset families');
for (const asset of ['parallax-baseline-pylon', 'parallax-reference-frame', 'parallax-mass-carriage', 'parallax-shear-anchor', 'parallax-reference-console']) {
  assert(manifestSource.includes(`${asset}-lod1.glb`) && manifestSource.includes(`${asset}-lod2.glb`), `Parallax asset ${asset} must preserve adaptive LOD1/LOD2 coverage`);
}
assert(rendererSource.includes('loadAuthoredParallaxEnvironment(state, world.w, world.h, budget.detailScale)'), 'Parallax authored overlay must select LOD from the active render tier');
assert(rendererSource.includes("dataset.environmentVisual = 'authored-parallax-array'"), 'runtime QA must expose Parallax authored overlay activation');
assert(rendererSource.includes("dataset.environmentLandmark = 'three-point-long-baseline'"), 'Parallax authored kit must expose the long-baseline landmark');
assert(rendererSource.includes("dataset.environmentComposition = 'three-point-baseline+cross-track-frames+perimeter-shear-anchors'"), 'Parallax authored composition must remain explicit for mobile readability');

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



console.log('GRAPHICS_ASSET_PIPELINE_PASS format=glb mesh=meshopt textures=ktx2 loader=deferred lifecycle=leased lod=adaptive+mobile-lod2 operator=articulated+class-silhouette enemies=role-authored+mobile-lod2 weapons=authored+mobile-lod2+surface-impacts loot=authored+rarity-readable interactables=authored+mobile-lod2 environment=refinery-instanced+phase6 lighting=key+rim+contact+practical materials=pbr-bounded+emissive+decals:safety+grime vfx=shape-coded+debris+reduced-effects readability=shape+silhouette+luminance boss=signature+phase+telegraph locations=10+shared-instancing render-tiers=high+balanced+performance sockets=muzzle animation=state-driven operatorTriangles=45000 enemyTriangles=30000 weaponTriangles=12000 environmentTriangles=20000');
