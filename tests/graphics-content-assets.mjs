import { readFile, readdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { Box3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const MODEL_ROOT = resolve(process.cwd(), 'public/assets/models');
const CLASS_BUDGETS = {
  operators: { maxBytes: 2_500_000, maxTriangles: 45_000 },
  enemies: { maxBytes: 1_500_000, maxTriangles: 30_000 },
  bosses: { maxBytes: 3_500_000, maxTriangles: 60_000 },
  weapons: { maxBytes: 800_000, maxTriangles: 12_000 },
  environments: { maxBytes: 1_200_000, maxTriangles: 20_000 },
  pickups: { maxBytes: 240_000, maxTriangles: 4_000 },
  interactables: { maxBytes: 480_000, maxTriangles: 8_000 },
};

async function collectGlbs(dir) {
  const files = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return files;
    throw error;
  }
  for (const entry of entries) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collectGlbs(path));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.glb')) files.push(path);
  }
  return files.sort();
}

function parseGlb(buffer, label) {
  assert(buffer.byteLength >= 20, `${label}: GLB is too small`);
  assert(buffer.toString('ascii', 0, 4) === 'glTF', `${label}: invalid GLB magic`);
  assert(buffer.readUInt32LE(4) === 2, `${label}: GLB version must be 2`);
  assert(buffer.readUInt32LE(8) === buffer.byteLength, `${label}: declared GLB length does not match file length`);

  let offset = 12;
  let json = null;
  while (offset < buffer.byteLength) {
    assert(offset + 8 <= buffer.byteLength, `${label}: truncated GLB chunk header`);
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    offset += 8;
    assert(offset + length <= buffer.byteLength, `${label}: truncated GLB chunk body`);
    if (type === 0x4e4f534a) {
      const text = buffer.subarray(offset, offset + length).toString('utf8').replace(/[\u0000\u0020]+$/g, '');
      json = JSON.parse(text);
    }
    offset += length;
  }
  assert(json, `${label}: missing JSON chunk`);
  return json;
}

function countTriangles(json, label) {
  const accessors = json.accessors ?? [];
  let triangles = 0;
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const mode = primitive.mode ?? 4;
      assert(mode === 4, `${label}: only TRIANGLES primitives are allowed for authored mobile assets`);
      if (Number.isInteger(primitive.indices)) {
        const accessor = accessors[primitive.indices];
        assert(accessor && Number.isFinite(accessor.count), `${label}: invalid index accessor`);
        triangles += Math.floor(accessor.count / 3);
      } else {
        const positionAccessorIndex = primitive.attributes?.POSITION;
        const accessor = accessors[positionAccessorIndex];
        assert(accessor && Number.isFinite(accessor.count), `${label}: missing POSITION accessor`);
        triangles += Math.floor(accessor.count / 3);
      }
    }
  }
  return triangles;
}

function positionBounds(json, label) {
  const accessors = json.accessors ?? [];
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  let found = false;
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const positionAccessorIndex = primitive.attributes?.POSITION;
      const accessor = accessors[positionAccessorIndex];
      if (!accessor?.min || !accessor?.max) continue;
      found = true;
      for (let axis = 0; axis < 3; axis += 1) {
        min[axis] = Math.min(min[axis], accessor.min[axis]);
        max[axis] = Math.max(max[axis], accessor.max[axis]);
      }
    }
  }
  assert(found, `${label}: POSITION min/max bounds are required`);
  return { min, max };
}

function assetClassFor(path) {
  const relativePath = relative(MODEL_ROOT, path).replaceAll('\\', '/');
  const top = relativePath.split('/')[0];
  const budget = CLASS_BUDGETS[top];
  assert(budget, `${relativePath}: unknown authored asset class directory ${top}`);
  return { relativePath, budget, top };
}

const glbs = await collectGlbs(MODEL_ROOT);
assert(glbs.length > 0, 'no authored GLB assets were found under public/assets/models');

const loader = new GLTFLoader();
const reports = [];
for (const path of glbs) {
  const data = await readFile(path);
  const { relativePath, budget, top } = assetClassFor(path);
  const filename = relativePath.split('/').at(-1);
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*-lod[0-2]\.glb$/.test(filename), `${relativePath}: filename must be kebab-case and end in -lod0/1/2.glb`);
  assert(data.byteLength <= budget.maxBytes, `${relativePath}: payload ${data.byteLength} exceeds ${budget.maxBytes} byte budget`);

  const json = parseGlb(data, relativePath);
  const triangles = countTriangles(json, relativePath);
  assert(triangles > 0, `${relativePath}: asset contains no triangles`);
  assert(triangles <= budget.maxTriangles, `${relativePath}: ${triangles} triangles exceeds ${budget.maxTriangles} triangle budget`);
  assert((json.meshes?.length ?? 0) > 0, `${relativePath}: asset contains no meshes`);
  assert((json.materials?.length ?? 0) > 0, `${relativePath}: asset contains no materials`);
  assert((json.buffers?.length ?? 0) === 1, `${relativePath}: runtime GLB should use a single embedded buffer`);

  const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  const gltf = await loader.parseAsync(arrayBuffer, '');
  assert(gltf.scene, `${relativePath}: GLTFLoader did not produce a scene`);
  const instance = clone(gltf.scene);
  let runtimeMeshes = 0;
  instance.traverse(child => {
    if (child.isMesh) runtimeMeshes += 1;
  });
  assert(runtimeMeshes > 0, `${relativePath}: cloned runtime scene contains no meshes`);

  const authoredBounds = positionBounds(json, relativePath);
  const runtimeBounds = new Box3().setFromObject(instance);
  if (top === 'operators') {
    const height = runtimeBounds.max.y - runtimeBounds.min.y;
    assert(Math.abs(runtimeBounds.min.y) <= 0.03, `${relativePath}: operator feet must rest on authored ground origin; minY=${runtimeBounds.min.y}`);
    assert(height >= 1.5 && height <= 2.6, `${relativePath}: operator height ${height.toFixed(2)}m is outside mobile gameplay scale`);
    if (filename.endsWith('-lod1.glb')) {
      const nodeNames = new Set((json.nodes ?? []).map(node => node.name).filter(Boolean));
      for (const required of ['operator-rig', 'hip', 'torso', 'helmet', 'arm-left', 'arm-right', 'leg-left', 'leg-right', 'backpack', 'weapon-socket']) {
        assert(nodeNames.has(required), `${relativePath}: articulated LOD1 is missing required node ${required}`);
      }
      const classMarker = filename.includes('operator-vanguard')
        ? 'vanguard-ram-plate'
        : filename.includes('operator-vector')
          ? 'vector-stabilizer-left'
          : filename.includes('operator-systems')
            ? 'systems-relay-left'
            : null;
      if (classMarker) assert(nodeNames.has(classMarker), `${relativePath}: class silhouette marker ${classMarker} is missing`);
    }
  }

  if (top === 'environments') {
    const sizeX = runtimeBounds.max.x - runtimeBounds.min.x;
    const sizeY = runtimeBounds.max.y - runtimeBounds.min.y;
    const sizeZ = runtimeBounds.max.z - runtimeBounds.min.z;
    assert(sizeX > 0.05 && sizeY > 0.02 && sizeZ > 0.05, `${relativePath}: authored environment bounds are degenerate`);
    assert(sizeX <= 8 && sizeY <= 6 && sizeZ <= 8, `${relativePath}: authored environment module exceeds modular scale bounds`);
    const nodeNames = new Set((json.nodes ?? []).map(node => node.name).filter(Boolean));
    const materialForNode = (nodeName) => {
      const node = (json.nodes ?? []).find(item => item.name === nodeName);
      const mesh = Number.isInteger(node?.mesh) ? json.meshes?.[node.mesh] : null;
      const materialIndex = mesh?.primitives?.[0]?.material;
      return Number.isInteger(materialIndex) ? (json.materials?.[materialIndex]?.name ?? null) : null;
    };
    assert(nodeNames.has('environment-root'), `${relativePath}: authored environment module is missing environment-root`);
    const marker = filename.includes('damaged-vessel-broken-rib')
      ? 'damaged-vessel-broken-rib-spine'
      : filename.includes('damaged-vessel-breach-frame')
        ? 'damaged-vessel-breach-frame-crown'
        : filename.includes('damaged-vessel-salvage-rack')
          ? 'damaged-vessel-salvage-rack-shell'
          : filename.includes('damaged-vessel-torn-wall-plate')
            ? 'damaged-vessel-torn-wall-plate-shell'
            : filename.includes('damaged-vessel-service-bundle')
              ? 'damaged-vessel-service-bundle-trunk'
            : filename.includes('parallax-baseline-pylon')
              ? 'parallax-baseline-pylon-spine'
              : filename.includes('parallax-reference-frame')
                ? 'parallax-reference-frame-crown'
                : filename.includes('parallax-mass-carriage')
                  ? 'parallax-mass-carriage-body'
                  : filename.includes('parallax-shear-anchor')
                    ? 'parallax-shear-anchor-spine'
                    : filename.includes('parallax-reference-console')
                      ? 'parallax-reference-console-screen'
                      : filename.includes('spin-habitat-ring-segment')
                        ? 'spin-habitat-ring-segment-deck'
                        : filename.includes('spin-habitat-spoke-truss')
                          ? 'spin-habitat-spoke-truss-main'
                          : filename.includes('spin-habitat-axis-hub')
                            ? 'spin-habitat-axis-hub-core'
                            : filename.includes('spin-habitat-service-bay')
                              ? 'spin-habitat-service-bay-shell'
                              : filename.includes('jovian-harvester-deck-span')
                                ? 'jovian-harvester-deck-span-main'
                                : filename.includes('jovian-harvester-skimmer-tower')
                                  ? 'jovian-harvester-skimmer-tower-spine'
                                  : filename.includes('jovian-harvester-transfer-bridge')
                                    ? 'jovian-harvester-transfer-bridge-main'
                                    : filename.includes('jovian-harvester-ballast-pod')
                                      ? 'jovian-harvester-ballast-pod-shell'
                                      : filename.includes('ice-mine-frost-wall')
                                        ? 'ice-mine-frost-wall-rock'
                                        : filename.includes('ice-mine-support-frame')
                                          ? 'ice-mine-support-frame-crown'
                                          : filename.includes('ice-mine-service-deck')
                                            ? 'ice-mine-service-deck-main'
                                            : filename.includes('ice-mine-ice-pillar')
                                              ? 'ice-mine-ice-pillar-core'
                                              : filename.includes('ice-mine-cryo-pump')
                                                ? 'ice-mine-cryo-pump-housing'
                                                : filename.includes('ice-mine-coolant-manifold')
                                                  ? 'ice-mine-coolant-manifold-spine'
                                                  : filename.includes('ice-mine-freeze-compressor')
                                                    ? 'ice-mine-freeze-compressor-body'
          : filename.includes('floor-panel')
            ? 'refinery-floor-panel'
            : filename.includes('floor-service-grate')
              ? 'refinery-floor-service-grate'
              : filename.includes('bulkhead')
                ? 'refinery-bulkhead-left'
                : filename.includes('processor')
                  ? 'refinery-processor-core'
                  : filename.includes('pipe-rack')
                    ? 'refinery-pipe-rack-spine'
                    : filename.includes('wall-service-panel')
                      ? 'refinery-wall-service-panel-shell'
                      : filename.includes('cable-tray')
                        ? 'refinery-cable-tray-spine'
                        : filename.includes('service-conduit')
                          ? 'refinery-service-conduit-trunk'
                          : filename.includes('smelter-gantry')
                            ? 'refinery-smelter-gantry-beam'
                            : filename.includes('crate')
                              ? 'refinery-crate-shell'
                              : 'refinery-terminal-screen';
    assert(nodeNames.has(marker), `${relativePath}: environment silhouette marker ${marker} is missing`);
    if (filename.includes('damaged-vessel-breach-frame') && filename.endsWith('-lod1.glb')) {
      assert(nodeNames.has('damaged-vessel-breach-frame-cable-a'), `${relativePath}: breach landmark is missing exposed cable detail`);
      assert(nodeNames.has('damaged-vessel-breach-frame-scar-cap'), `${relativePath}: breach landmark is missing scar-cap detail`);
    }
    if (filename.includes('damaged-vessel-torn-wall-plate') && filename.endsWith('-lod1.glb')) {
      assert(nodeNames.has('damaged-vessel-torn-wall-plate-lower-flap'), `${relativePath}: torn wall plate is missing damaged silhouette detail`);
      assert(nodeNames.has('damaged-vessel-torn-wall-plate-tooth'), `${relativePath}: torn wall plate is missing jagged edge detail`);
    }
    if (filename.includes('damaged-vessel-service-bundle') && filename.endsWith('-lod1.glb')) {
      assert(nodeNames.has('damaged-vessel-service-bundle-junction'), `${relativePath}: service bundle is missing junction housing`);
      assert(nodeNames.has('damaged-vessel-service-bundle-conduit-a'), `${relativePath}: service bundle is missing exposed conduit detail`);
    }


    if (filename.includes('spin-habitat-ring-segment') && filename.endsWith('-lod1.glb')) {
      assert(nodeNames.has('spin-habitat-ring-segment-rib-left'), `${relativePath}: Spin Habitat ring LOD1 is missing structural rib detail`);
      assert(nodeNames.has('spin-habitat-ring-segment-service-strip'), `${relativePath}: Spin Habitat ring LOD1 is missing service-light detail`);
      assert(materialForNode('spin-habitat-ring-segment-deck') === 'spin-habitat-rim-plating', `${relativePath}: Spin Habitat rim deck lost its dedicated plated material identity`);
      assert(materialForNode('spin-habitat-ring-segment-wayfinding') === 'spin-habitat-green-emissive', `${relativePath}: Spin Habitat rim wayfinding must remain green`);
    }
    if (filename.includes('spin-habitat-spoke-truss') && filename.endsWith('-lod1.glb')) {
      assert(nodeNames.has('spin-habitat-spoke-truss-cross-brace-a'), `${relativePath}: Spin Habitat spoke LOD1 is missing cross-brace detail`);
      assert(materialForNode('spin-habitat-spoke-truss-main') === 'spin-habitat-spoke-structure', `${relativePath}: Spin Habitat spoke truss lost its dark structural material identity`);
      assert(materialForNode('spin-habitat-spoke-truss-status') === 'spin-habitat-spoke-emissive', `${relativePath}: Spin Habitat spoke status strip must remain cyan`);
    }
    if (filename.includes('spin-habitat-axis-hub') && filename.endsWith('-lod1.glb')) {
      assert(nodeNames.has('spin-habitat-axis-hub-service-ring'), `${relativePath}: Spin Habitat axis hub LOD1 is missing service-ring detail`);
      assert(nodeNames.has('spin-habitat-axis-hub-control-screen'), `${relativePath}: Spin Habitat axis hub LOD1 is missing control readout`);
      assert(nodeNames.has('spin-habitat-axis-hub-fin-left') && nodeNames.has('spin-habitat-axis-hub-fin-right'), `${relativePath}: Spin Habitat axis hub LOD1 is missing its tall stationary fin silhouette`);
      assert(materialForNode('spin-habitat-axis-hub-core') === 'spin-habitat-axis-shell', `${relativePath}: Spin Habitat axis hub lost its bright shell identity`);
      assert(materialForNode('spin-habitat-axis-hub-beacon') === 'spin-habitat-axis-emissive', `${relativePath}: Spin Habitat axis beacon must remain bright cool emissive`);
    }

    if (filename.includes('jovian-harvester-deck-span') && filename.endsWith('-lod1.glb')) {
      assert(nodeNames.has('jovian-harvester-deck-span-edge-beam-left'), `${relativePath}: Jovian deck LOD1 is missing edge-beam detail`);
      assert(nodeNames.has('jovian-harvester-deck-span-service-rib'), `${relativePath}: Jovian deck LOD1 is missing service-rib detail`);
      assert(materialForNode('jovian-harvester-deck-span-main') === 'jovian-harvester-deck-plating', `${relativePath}: Jovian deck lost its weathered plated material identity`);
      assert(materialForNode('jovian-harvester-deck-span-wayfinding') === 'jovian-harvester-amber-emissive', `${relativePath}: Jovian deck wayfinding must remain storm amber`);
    }
    if (filename.includes('jovian-harvester-skimmer-tower') && filename.endsWith('-lod1.glb')) {
      assert(nodeNames.has('jovian-harvester-skimmer-tower-lattice-left'), `${relativePath}: Jovian tower LOD1 is missing side lattice detail`);
      assert(nodeNames.has('jovian-harvester-skimmer-tower-crown-light'), `${relativePath}: Jovian tower LOD1 is missing crown light detail`);
      assert(materialForNode('jovian-harvester-skimmer-tower-spine') === 'jovian-harvester-weathered-shell', `${relativePath}: Jovian skimmer tower lost its weathered shell identity`);
    }
    if (filename.includes('jovian-harvester-transfer-bridge') && filename.endsWith('-lod1.glb')) {
      assert(nodeNames.has('jovian-harvester-transfer-bridge-cross-brace-a'), `${relativePath}: Jovian transfer bridge LOD1 is missing cross-brace detail`);
      assert(materialForNode('jovian-harvester-transfer-bridge-main') === 'jovian-harvester-dark-structure', `${relativePath}: Jovian transfer bridge lost its dark truss identity`);
    }
    if (filename.includes('jovian-harvester-ballast-pod') && filename.endsWith('-lod1.glb')) {
      assert(nodeNames.has('jovian-harvester-ballast-pod-keel'), `${relativePath}: Jovian ballast pod LOD1 is missing keel detail`);
      assert(nodeNames.has('jovian-harvester-ballast-pod-strap'), `${relativePath}: Jovian ballast pod LOD1 is missing retention strap detail`);
      assert(materialForNode('jovian-harvester-ballast-pod-shell') === 'jovian-harvester-ballast-shell', `${relativePath}: Jovian ballast pod lost its bright shell identity`);
    }

    if (filename.includes('ice-mine-frost-wall') && filename.endsWith('-lod1.glb')) {
      assert(nodeNames.has('ice-mine-frost-wall-ledge'), `${relativePath}: Ice Mine frost wall LOD1 is missing frozen ledge detail`);
      assert(nodeNames.has('ice-mine-frost-wall-strata'), `${relativePath}: Ice Mine frost wall LOD1 is missing rock strata detail`);
      assert(materialForNode('ice-mine-frost-wall-rock') === 'ice-mine-frozen-rock', `${relativePath}: Ice Mine frost wall lost its frozen-rock identity`);
      assert(materialForNode('ice-mine-frost-wall-cap') === 'ice-mine-frost-ice', `${relativePath}: Ice Mine frost wall cap must remain ice material`);
    }
    if (filename.includes('ice-mine-support-frame') && filename.endsWith('-lod1.glb')) {
      assert(nodeNames.has('ice-mine-support-frame-brace-left'), `${relativePath}: Ice Mine support frame LOD1 is missing brace detail`);
      assert(nodeNames.has('ice-mine-support-frame-frost-sheath'), `${relativePath}: Ice Mine support frame LOD1 is missing frost sheath detail`);
      assert(materialForNode('ice-mine-support-frame-crown') === 'ice-mine-support-steel', `${relativePath}: Ice Mine support frame lost its structural steel identity`);
      assert(materialForNode('ice-mine-support-frame-status') === 'ice-mine-cold-emissive', `${relativePath}: Ice Mine support status must remain cold cyan`);
    }
    if (filename.includes('ice-mine-service-deck') && filename.endsWith('-lod1.glb')) {
      assert(nodeNames.has('ice-mine-service-deck-grate-left'), `${relativePath}: Ice Mine service deck LOD1 is missing grate detail`);
      assert(materialForNode('ice-mine-service-deck-main') === 'ice-mine-service-deck', `${relativePath}: Ice Mine service deck lost its dedicated deck material`);
      assert(materialForNode('ice-mine-service-deck-frost-strip') === 'ice-mine-frost-ice', `${relativePath}: Ice Mine service deck frost strip must remain ice material`);
    }
    if (filename.includes('ice-mine-ice-pillar') && filename.endsWith('-lod1.glb')) {
      assert(nodeNames.has('ice-mine-ice-pillar-shelf'), `${relativePath}: Ice Mine ice pillar LOD1 is missing shelf detail`);
      assert(nodeNames.has('ice-mine-ice-pillar-shard'), `${relativePath}: Ice Mine ice pillar LOD1 is missing shard detail`);
      assert(materialForNode('ice-mine-ice-pillar-core') === 'ice-mine-frost-ice', `${relativePath}: Ice Mine pillar lost its frozen core identity`);
    }
    if (filename.includes('ice-mine-cryo-pump') && filename.endsWith('-lod1.glb')) {
      assert(nodeNames.has('ice-mine-cryo-pump-feed-left'), `${relativePath}: Ice Mine cryo pump LOD1 is missing feed-line detail`);
      assert(nodeNames.has('ice-mine-cryo-pump-frost-collar'), `${relativePath}: Ice Mine cryo pump LOD1 is missing frost collar detail`);
      assert(materialForNode('ice-mine-cryo-pump-housing') === 'ice-mine-support-steel', `${relativePath}: Ice Mine cryo pump housing lost its steel machinery identity`);
      assert(materialForNode('ice-mine-cryo-pump-status') === 'ice-mine-cold-emissive', `${relativePath}: Ice Mine cryo pump status must remain cold cyan`);
    }
    if (filename.includes('ice-mine-coolant-manifold') && filename.endsWith('-lod1.glb')) {
      assert(nodeNames.has('ice-mine-coolant-manifold-branch-left'), `${relativePath}: Ice Mine coolant manifold LOD1 is missing branch detail`);
      assert(nodeNames.has('ice-mine-coolant-manifold-frost-sump'), `${relativePath}: Ice Mine coolant manifold LOD1 is missing frost sump detail`);
      assert(materialForNode('ice-mine-coolant-manifold-spine') === 'ice-mine-support-steel', `${relativePath}: Ice Mine coolant manifold lost its steel spine identity`);
      assert(materialForNode('ice-mine-coolant-manifold-status') === 'ice-mine-cold-emissive', `${relativePath}: Ice Mine coolant manifold status must remain cold cyan`);
    }
    if (filename.includes('ice-mine-freeze-compressor') && filename.endsWith('-lod1.glb')) {
      assert(nodeNames.has('ice-mine-freeze-compressor-drive'), `${relativePath}: Ice Mine freeze compressor LOD1 is missing drive detail`);
      assert(nodeNames.has('ice-mine-freeze-compressor-frost-trap'), `${relativePath}: Ice Mine freeze compressor LOD1 is missing frost trap detail`);
      assert(materialForNode('ice-mine-freeze-compressor-body') === 'ice-mine-support-steel', `${relativePath}: Ice Mine freeze compressor lost its steel body identity`);
      assert(materialForNode('ice-mine-freeze-compressor-status') === 'ice-mine-cold-emissive', `${relativePath}: Ice Mine freeze compressor status must remain cold cyan`);
    }

    if (filename.includes('parallax-baseline-pylon') && filename.endsWith('-lod1.glb')) {
      assert(nodeNames.has('parallax-baseline-pylon-ring-a'), `${relativePath}: Parallax pylon LOD1 is missing calibration ring detail`);
      assert(nodeNames.has('parallax-baseline-pylon-calibration-fin'), `${relativePath}: Parallax pylon LOD1 is missing calibration fin detail`);
    }
    if (filename.includes('parallax-reference-frame') && filename.endsWith('-lod1.glb')) {
      assert(nodeNames.has('parallax-reference-frame-lattice-left'), `${relativePath}: Parallax reference frame LOD1 is missing lattice detail`);
      assert(nodeNames.has('parallax-reference-frame-readout'), `${relativePath}: Parallax reference frame LOD1 is missing readout detail`);
    }
    if (filename.includes('parallax-mass-carriage') && filename.endsWith('-lod1.glb')) {
      assert(nodeNames.has('parallax-mass-carriage-counterweight'), `${relativePath}: Parallax mass carriage LOD1 is missing counterweight silhouette`);
    }
    if (filename.includes('processor') && filename.endsWith('-lod1.glb')) {
      assert(nodeNames.has('refinery-processor-ore-intake'), `${relativePath}: refined processor is missing ore intake silhouette`);
      assert(nodeNames.has('refinery-processor-exhaust-stack'), `${relativePath}: refined processor is missing exhaust stack silhouette`);
      assert(nodeNames.has('refinery-processor-maintenance-screen'), `${relativePath}: refined processor is missing maintenance screen detail`);
    }
    if (filename.includes('terminal')) {
      assert(nodeNames.has('objective-beacon-mount'), `${relativePath}: interactive refinery terminal is missing objective beacon mount`);
    }
  }

  if (top === 'pickups') {
    const height = runtimeBounds.max.y - runtimeBounds.min.y;
    const width = runtimeBounds.max.x - runtimeBounds.min.x;
    assert(height >= 0.35 && height <= 1.2 && width >= 0.4 && width <= 1.4, `${relativePath}: authored pickup is outside mobile gameplay scale`);
    const nodeNames = new Set((json.nodes ?? []).map(node => node.name).filter(Boolean));
    for (const required of ['pickup-root', 'pickup-recovery-shell', 'pickup-recovery-core', 'pickup-recovery-beacon']) {
      assert(nodeNames.has(required), `${relativePath}: authored pickup is missing required node ${required}`);
    }
    if (filename.endsWith('-lod1.glb')) assert(nodeNames.has('pickup-recovery-tag'), `${relativePath}: pickup LOD1 is missing recovery tag detail`);
  }

  if (top === 'interactables') {
    const height = runtimeBounds.max.y - runtimeBounds.min.y;
    const width = runtimeBounds.max.x - runtimeBounds.min.x;
    assert(height >= 0.55 && height <= 2.0 && width >= 0.45 && width <= 1.6, `${relativePath}: authored interactable is outside mobile gameplay scale`);
    const nodeNames = new Set((json.nodes ?? []).map(node => node.name).filter(Boolean));
    assert(nodeNames.has('interactable-root'), `${relativePath}: authored interactable is missing interactable-root`);
    if (filename.includes('control-terminal')) {
      for (const required of ['interactable-control-base', 'interactable-control-console', 'interactable-control-screen']) {
        assert(nodeNames.has(required), `${relativePath}: control terminal is missing required node ${required}`);
      }
      if (filename.endsWith('-lod1.glb')) assert(nodeNames.has('objective-beacon-mount'), `${relativePath}: control LOD1 is missing objective beacon mount`);
    } else if (filename.includes('salvage-tag-node')) {
      for (const required of ['interactable-salvage-base', 'interactable-salvage-case', 'interactable-salvage-tag-emitter']) {
        assert(nodeNames.has(required), `${relativePath}: salvage tag node is missing required node ${required}`);
      }
      if (filename.endsWith('-lod1.glb')) assert(nodeNames.has('interactable-salvage-tag-plate'), `${relativePath}: salvage LOD1 is missing tag plate detail`);
    } else if (filename.includes('spin-habitat-')) {
      const marker = filename.includes('spin-bus-isolator')
        ? 'spin-habitat-spin-bus-isolator-knife'
        : filename.includes('gravity-trim')
          ? 'spin-habitat-gravity-trim-yoke'
          : filename.includes('bearing-control')
            ? 'spin-habitat-bearing-control-spindle'
            : filename.includes('attitude-flywheel')
              ? 'spin-habitat-attitude-flywheel-axle'
              : 'spin-habitat-pressure-lock-wheel';
      assert(nodeNames.has(marker), `${relativePath}: Spin Habitat machinery silhouette marker ${marker} is missing`);
      assert(nodeNames.has('spin-habitat-interactable-status'), `${relativePath}: Spin Habitat machinery is missing its state-readable status emitter`);
      if (filename.endsWith('-lod1.glb')) assert(nodeNames.has('objective-beacon-mount'), `${relativePath}: Spin Habitat machinery LOD1 is missing objective beacon mount`);
    } else {
      const pressureHardware = filename.includes('storm-pressure-lock') || filename.includes('relief-manifold');
      const marker = filename.includes('storm-bus-isolator')
        ? 'jovian-harvester-storm-bus-isolator-knife'
        : filename.includes('deck-mass-trim')
          ? 'jovian-harvester-deck-mass-trim-actuator'
          : filename.includes('skimmer-compressor')
            ? 'jovian-harvester-skimmer-compressor-intake'
            : filename.includes('storm-pressure-lock')
              ? 'jovian-harvester-storm-pressure-lock-wheel'
              : filename.includes('relief-manifold')
                ? 'jovian-harvester-relief-manifold-valve'
                : 'jovian-harvester-separator-package-vessel';
      assert(nodeNames.has(marker), `${relativePath}: Jovian Harvester ${pressureHardware ? 'pressure hardware' : 'machinery' } silhouette marker ${marker} is missing`);
      assert(nodeNames.has(pressureHardware ? 'jovian-harvester-pressure-status' : 'jovian-harvester-interactable-status'), `${relativePath}: Jovian Harvester ${pressureHardware ? 'pressure hardware' : 'machinery' } is missing its state-readable status emitter`);
      if (filename.endsWith('-lod1.glb')) assert(nodeNames.has('objective-beacon-mount'), `${relativePath}: Jovian Harvester authored interactable LOD1 is missing objective beacon mount`);
    }
  }

  if (top === 'weapons') {
    const weaponLength = runtimeBounds.max.x - runtimeBounds.min.x;
    assert(weaponLength >= 0.9 && weaponLength <= 2.4, `${relativePath}: authored weapon length ${weaponLength.toFixed(2)}m is outside gameplay scale`);
    const nodeNames = new Set((json.nodes ?? []).map(node => node.name).filter(Boolean));
    for (const required of ['weapon-root', 'muzzle-socket']) {
      assert(nodeNames.has(required), `${relativePath}: authored weapon is missing required node ${required}`);
    }
    const silhouetteMarker = filename.includes('carbine')
      ? 'carbine-magazine'
      : filename.includes('breacher')
        ? 'breacher-twin-barrel'
        : 'rail-coil';
    assert(nodeNames.has(silhouetteMarker), `${relativePath}: weapon silhouette marker ${silhouetteMarker} is missing`);
  }

  if (top === 'enemies' || top === 'bosses') {
    const height = runtimeBounds.max.y - runtimeBounds.min.y;
    assert(Math.abs(runtimeBounds.min.y) <= 0.05, `${relativePath}: enemy feet must rest near authored ground origin; minY=${runtimeBounds.min.y}`);
    assert(height >= 1.45 && height <= 3.6, `${relativePath}: enemy height ${height.toFixed(2)}m is outside gameplay scale`);
    const nodeNames = new Set((json.nodes ?? []).map(node => node.name).filter(Boolean));
    for (const required of ['enemy-rig', 'hip', 'torso', 'helmet', 'arm-left', 'arm-right', 'leg-left', 'leg-right', 'backpack', 'weapon-socket']) {
      assert(nodeNames.has(required), `${relativePath}: authored enemy is missing required node ${required}`);
    }
    const silhouetteMarker = filename.includes('ice-mine-rhea-kade')
      ? 'ice-mine-rhea-kade-bore-cowl'
      : filename.includes('jovian-harvester-stormline-foreman')
        ? 'jovian-harvester-stormline-foreman-storm-cowl'
      : filename.includes('spin-habitat-sable-voss')
        ? 'spin-habitat-sable-voss-counterspin-mantle'
      : filename.includes('spin-habitat-spoke-marksman')
        ? 'spin-habitat-spoke-marksman-brace'
      : filename.includes('spin-habitat-spin-trim-specialist')
        ? filename.endsWith('-lod1.glb') ? 'spin-habitat-spin-trim-gyro-left' : 'spin-habitat-spin-trim-gyro'
        : filename.includes('spin-habitat-ring-drone-carrier')
          ? 'spin-habitat-ring-drone-rack'
          : filename.includes('spin-habitat-axis-shield-boarder')
            ? 'spin-habitat-axis-shield'
            : filename.includes('assault')
              ? 'assault-ram-plate'
              : filename.includes('suppressor')
                ? 'suppressor-shoulder-left'
                : filename.includes('technician')
                  ? 'technician-mast'
                  : filename.includes('elite')
                    ? 'elite-crest'
                    : 'boss-command-crest';
    assert(nodeNames.has(silhouetteMarker), `${relativePath}: role/local silhouette marker ${silhouetteMarker} is missing`);
  }

  reports.push({ relativePath, bytes: data.byteLength, triangles, meshes: runtimeMeshes, authoredBounds });
}

const reportByPath = new Map(reports.map(report => [report.relativePath, report]));
for (const operatorClass of ['vanguard', 'vector', 'systems']) {
  const lod1 = reportByPath.get(`operators/operator-${operatorClass}-lod1.glb`);
  const lod2 = reportByPath.get(`operators/operator-${operatorClass}-lod2.glb`);
  assert(lod1 && lod2, `${operatorClass}: class operator LOD1/LOD2 pair missing`);
  assert(lod2.bytes < lod1.bytes && lod2.meshes < lod1.meshes, `${operatorClass}: mobile operator LOD2 must reduce payload and draw surfaces`);
}
for (const role of ['assault', 'suppressor', 'technician', 'elite']) {
  const lod1 = reportByPath.get(`enemies/enemy-${role}-lod1.glb`);
  const lod2 = reportByPath.get(`enemies/enemy-${role}-lod2.glb`);
  assert(lod1 && lod2, `${role}: enemy LOD1/LOD2 pair missing`);
  assert(lod2.bytes < lod1.bytes && lod2.meshes < lod1.meshes, `${role}: mobile enemy LOD2 must reduce payload and draw surfaces`);
}
for (const asset of ['spin-habitat-spoke-marksman', 'spin-habitat-spin-trim-specialist', 'spin-habitat-ring-drone-carrier', 'spin-habitat-axis-shield-boarder']) {
  const lod1 = reportByPath.get(`enemies/${asset}-lod1.glb`);
  const lod2 = reportByPath.get(`enemies/${asset}-lod2.glb`);
  assert(lod1 && lod2, `${asset}: Spin Habitat local enemy LOD1/LOD2 pair missing`);
  assert(lod2.bytes < lod1.bytes && lod2.meshes < lod1.meshes, `${asset}: Spin Habitat local enemy mobile LOD2 must reduce payload and draw surfaces`);
}
{
  const lod1 = reportByPath.get('bosses/enemy-boss-lod1.glb');
  const lod2 = reportByPath.get('bosses/enemy-boss-lod2.glb');
  assert(lod1 && lod2 && lod2.bytes < lod1.bytes && lod2.meshes < lod1.meshes, 'boss mobile LOD2 must reduce payload and draw surfaces');
}
{
  const lod1 = reportByPath.get('bosses/spin-habitat-sable-voss-lod1.glb');
  const lod2 = reportByPath.get('bosses/spin-habitat-sable-voss-lod2.glb');
  assert(lod1 && lod2, 'Sable Voss: authored Spin Habitat boss LOD1/LOD2 pair missing');
  assert(lod2.bytes < lod1.bytes && lod2.meshes < lod1.meshes, 'Sable Voss: mobile boss LOD2 must reduce payload and draw surfaces');
}
{
  const lod1 = reportByPath.get('bosses/jovian-harvester-stormline-foreman-lod1.glb');
  const lod2 = reportByPath.get('bosses/jovian-harvester-stormline-foreman-lod2.glb');
  assert(lod1 && lod2, 'Stormline Foreman: authored Jovian Harvester boss LOD1/LOD2 pair missing');
  assert(lod2.bytes < lod1.bytes && lod2.meshes < lod1.meshes, 'Stormline Foreman: mobile boss LOD2 must reduce payload and draw surfaces');
}
{
  const lod1 = reportByPath.get('bosses/ice-mine-rhea-kade-lod1.glb');
  const lod2 = reportByPath.get('bosses/ice-mine-rhea-kade-lod2.glb');
  assert(lod1 && lod2, 'Rhea Kade: authored Ice Mine boss LOD1/LOD2 pair missing');
  assert(lod2.bytes < lod1.bytes && lod2.meshes < lod1.meshes, 'Rhea Kade: mobile boss LOD2 must reduce payload and draw surfaces');
}
for (const weapon of ['carbine', 'breacher', 'rail']) {
  const lod1 = reportByPath.get(`weapons/weapon-${weapon}-lod1.glb`);
  const lod2 = reportByPath.get(`weapons/weapon-${weapon}-lod2.glb`);
  assert(lod1 && lod2, `${weapon}: weapon LOD1/LOD2 pair missing`);
  assert(lod2.bytes < lod1.bytes && lod2.meshes < lod1.meshes, `${weapon}: mobile weapon LOD2 must reduce payload and draw surfaces`);
}

{
  const lod1 = reportByPath.get('pickups/pickup-recovery-capsule-lod1.glb');
  const lod2 = reportByPath.get('pickups/pickup-recovery-capsule-lod2.glb');
  assert(lod1 && lod2 && lod2.bytes < lod1.bytes && lod2.meshes < lod1.meshes, 'recovery pickup mobile LOD2 must reduce payload and draw surfaces');
}
for (const interactableAsset of ['interactable-control-terminal', 'interactable-salvage-tag-node']) {
  const lod1 = reportByPath.get(`interactables/${interactableAsset}-lod1.glb`);
  const lod2 = reportByPath.get(`interactables/${interactableAsset}-lod2.glb`);
  assert(lod1 && lod2, `${interactableAsset}: authored LOD1/LOD2 pair missing`);
  assert(lod2.bytes < lod1.bytes && lod2.meshes < lod1.meshes, `${interactableAsset}: mobile LOD2 must reduce payload and draw surfaces`);
}

for (const interactableAsset of ['spin-habitat-spin-bus-isolator', 'spin-habitat-gravity-trim', 'spin-habitat-bearing-control', 'spin-habitat-attitude-flywheel', 'spin-habitat-pressure-lock']) {
  const lod1 = reportByPath.get(`interactables/${interactableAsset}-lod1.glb`);
  const lod2 = reportByPath.get(`interactables/${interactableAsset}-lod2.glb`);
  assert(lod1 && lod2, `${interactableAsset}: Spin Habitat machinery LOD1/LOD2 pair missing`);
  assert(lod2.bytes < lod1.bytes && lod2.meshes < lod1.meshes, `${interactableAsset}: Spin Habitat mobile machinery LOD2 must reduce payload and draw surfaces`);
}

for (const interactableAsset of ['jovian-harvester-storm-bus-isolator', 'jovian-harvester-deck-mass-trim', 'jovian-harvester-skimmer-compressor', 'jovian-harvester-separator-package', 'jovian-harvester-storm-pressure-lock', 'jovian-harvester-relief-manifold']) {
  const lod1 = reportByPath.get(`interactables/${interactableAsset}-lod1.glb`);
  const lod2 = reportByPath.get(`interactables/${interactableAsset}-lod2.glb`);
  assert(lod1 && lod2, `${interactableAsset}: Jovian Harvester machinery LOD1/LOD2 pair missing`);
  assert(lod2.bytes < lod1.bytes && lod2.meshes < lod1.meshes, `${interactableAsset}: Jovian Harvester mobile machinery LOD2 must reduce payload and draw surfaces`);
}



for (const asset of ['spin-habitat-ring-segment', 'spin-habitat-spoke-truss', 'spin-habitat-axis-hub', 'spin-habitat-service-bay']) {
  const lod1 = reportByPath.get(`environments/${asset}-lod1.glb`);
  const lod2 = reportByPath.get(`environments/${asset}-lod2.glb`);
  assert(lod1 && lod2, `${asset}: Spin Habitat LOD1/LOD2 pair missing`);
  assert(lod2.bytes < lod1.bytes && lod2.meshes < lod1.meshes, `${asset}: Spin Habitat mobile LOD2 must reduce payload and draw surfaces`);
}

for (const asset of ['jovian-harvester-deck-span', 'jovian-harvester-skimmer-tower', 'jovian-harvester-transfer-bridge', 'jovian-harvester-ballast-pod']) {
  const lod1 = reportByPath.get(`environments/${asset}-lod1.glb`);
  const lod2 = reportByPath.get(`environments/${asset}-lod2.glb`);
  assert(lod1 && lod2, `${asset}: Jovian Harvester LOD1/LOD2 pair missing`);
  assert(lod2.bytes < lod1.bytes && lod2.meshes < lod1.meshes, `${asset}: Jovian Harvester mobile LOD2 must reduce payload and draw surfaces`);
}

for (const asset of ['ice-mine-frost-wall', 'ice-mine-support-frame', 'ice-mine-service-deck', 'ice-mine-ice-pillar']) {
  const lod1 = reportByPath.get(`environments/${asset}-lod1.glb`);
  const lod2 = reportByPath.get(`environments/${asset}-lod2.glb`);
  assert(lod1 && lod2, `${asset}: Ice Mine P3.1 LOD1/LOD2 pair missing`);
  assert(lod2.bytes < lod1.bytes && lod2.meshes < lod1.meshes, `${asset}: Ice Mine mobile LOD2 must reduce payload and draw surfaces`);
}

for (const asset of ['parallax-baseline-pylon', 'parallax-reference-frame', 'parallax-mass-carriage', 'parallax-shear-anchor', 'parallax-reference-console']) {
  const lod1 = reportByPath.get(`environments/${asset}-lod1.glb`);
  const lod2 = reportByPath.get(`environments/${asset}-lod2.glb`);
  assert(lod1 && lod2, `${asset}: Parallax LOD1/LOD2 pair missing`);
  assert(lod2.bytes < lod1.bytes && lod2.meshes < lod1.meshes, `${asset}: Parallax mobile LOD2 must reduce payload and draw surfaces`);
}

const totalBytes = reports.reduce((sum, report) => sum + report.bytes, 0);
const totalTriangles = reports.reduce((sum, report) => sum + report.triangles, 0);
console.log(`GRAPHICS_CONTENT_PASS assets=${reports.length} bytes=${totalBytes} triangles=${totalTriangles} ${reports.map(report => `${report.relativePath}:${report.triangles}t`).join(' ')}`);
