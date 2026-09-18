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
}
assert(manifestSource.includes("enemy-boss-lod1.glb"), 'enemy manifest must include the authored boss silhouette');
for (const weapon of ['carbine', 'breacher', 'rail']) {
  assert(manifestSource.includes(`weapon-${weapon}-lod1.glb`), `weapon manifest must include authored ${weapon} LOD1`);
}

for (const asset of ['floor-panel', 'bulkhead', 'processor', 'pipe-rack', 'crate', 'terminal']) {
  assert(manifestSource.includes(`refinery-${asset}-lod1.glb`), `refinery manifest must include authored ${asset} LOD1`);
  assert(manifestSource.includes(`refinery-${asset}-lod2.glb`), `refinery manifest must include authored ${asset} LOD2`);
}

const rendererSource = readFileSync(resolve(process.cwd(), 'src/game/threeCombatRenderer.ts'), 'utf8');
assert(rendererSource.includes('OPERATOR_ASSET_FAMILY') && rendererSource.includes("from './graphicsAssetManifest'"), 'combat renderer must consume the authored operator manifest');
assert(rendererSource.includes('configureGraphicsAssetRenderer(this.renderer)'), 'combat renderer must configure authored texture support lazily at runtime');
assert(rendererSource.includes('void this.loadAuthoredOperator()'), 'authored operator loading must start only after the combat renderer is constructed');
assert(rendererSource.includes('await instantiateGraphicsAsset(spec)'), 'combat renderer must instantiate the cached authored operator GLB');
assert(rendererSource.includes("dataset.operatorVisual = 'procedural-fallback'"), 'authored operator load failures must keep the procedural fallback active');
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
assert(rendererSource.includes('void this.loadAuthoredWeapons()'), 'authored player weapons must load through the shared asset pipeline');
assert(rendererSource.includes("root.getObjectByName('muzzle-socket')"), 'authored weapons must expose muzzle sockets');
assert(rendererSource.includes('syncAuthoredWeapon(state, operatorFaction)'), 'authored weapons must receive visual-only simulation state');
assert(rendererSource.includes("dataset.weaponVisual = loaded.length === 3 ? 'authored'"), 'runtime QA must expose authored weapon readiness');
assert(rendererSource.includes("dataset.weaponFx = player.currentWeapon === 'rail' ? 'lance'"), 'weapon-specific combat readability language must remain explicit');
assert(rendererSource.includes("'armor-spark'") && rendererSource.includes("'metal-spark'") && rendererSource.includes("'electrical-flash'"), 'impact effects must preserve target/surface-specific visual language');
assert(rendererSource.includes('dataset.impactFx'), 'impact FX classification must remain observable for runtime QA');

assert(rendererSource.includes('REFINERY_ASSET_FAMILIES'), 'showcase environment must load through authored refinery asset families');
assert(rendererSource.includes('loadAuthoredRefineryEnvironment(state, world.w, world.h)'), 'Asteroid Refinery must start authored environment loading from the combat scene');
assert(rendererSource.includes('new THREE.InstancedMesh'), 'repeated refinery props must use instancing');
assert(rendererSource.includes("dataset.environmentVisual = 'authored-refinery'"), 'runtime QA must expose authored refinery activation');
assert(rendererSource.includes("dataset.environmentKit = 'floor,bulkhead,processor,pipe-rack,crate,terminal'"), 'runtime QA must expose the complete refinery kit');
assert(rendererSource.includes('this.proceduralRefineryVisuals.forEach'), 'procedural refinery scenery must remain as a load-failure fallback');



console.log('GRAPHICS_ASSET_PIPELINE_PASS format=glb mesh=meshopt textures=ktx2 loader=deferred lifecycle=leased lod=adaptive operator=articulated+hit-blend enemies=role-authored weapons=authored+surface-impacts environment=refinery-instanced sockets=muzzle animation=state-driven operatorTriangles=45000 enemyTriangles=30000 weaponTriangles=12000 environmentTriangles=20000');
