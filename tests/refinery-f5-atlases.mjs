import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
  REFINERY_F5_DECAL_ATLAS,
  REFINERY_F5_EFFECT_ATLAS,
  createRefineryF5DecalPng,
  createRefineryF5EffectPixels,
  createRefineryF5DecalPixels,
} from '../tools/prepare-refinery-f5-atlases.mjs';
import { REFINERY_DECAL_TARGETS } from '../scripts/prepare-refinery-decal-atlas.mjs';
import { REFINERY_ROUTE_DECAL_TARGETS } from '../scripts/prepare-refinery-route-decals.mjs';

const at = path => resolve(process.cwd(), path);
const sourcePng = await readFile(at(REFINERY_F5_DECAL_ATLAS.path));
assert(sourcePng.equals(createRefineryF5DecalPng()), 'P28-F5 production decal atlas must regenerate byte-for-byte');
assert(sourcePng.length > 100_000, 'P28-F5 decal artwork must not be an empty/flat placeholder');
assert(sourcePng.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
assert.equal(sourcePng.readUInt32BE(16), 1024);
assert.equal(sourcePng.readUInt32BE(20), 1024);

// Compare actual source alpha * shipped floor-decal opacity against the
// Babylon attack-ring minimum rather than trusting GLB metadata markers.
const telegraphSource = await readFile(at('src/game/babylonEnemyTelegraphs.ts'), 'utf8');
assert(telegraphSource.includes('material.emissiveColor = signal;')
  && telegraphSource.includes('0.66 + Math.sin(state.time * 10 + enemy.id * 0.73) * 0.1'),
  'P28-F5 ground-cue comparison must be recalibrated if the real attack-ring opacity changes');
const cueMinimumAlpha = 0.66 - 0.10;
const pixels = createRefineryF5DecalPixels();
let maxAlpha = 0;
for (let i = 3; i < pixels.length; i += 4) maxAlpha = Math.max(maxAlpha, pixels[i]);
const maxAtlasAlpha = maxAlpha / 255;
let minGroundCueMargin = 1;
for (const target of REFINERY_ROUTE_DECAL_TARGETS.filter(t => t.cards.some(card => card.plane === 'xz'))) {
  const glb = await readFile(at('public/assets/models/' + target.relativePath));
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8').trim());
  const ground = json.materials.find(material => material.name === 'refinery-route-detail-atlas');
  assert(ground?.alphaMode === 'BLEND' && ground.emissiveFactor === undefined && ground.emissiveTexture === undefined,
    target.relativePath + ': ground decoration must not emit over gameplay attacks');
  const effectiveGroundAlpha = ground.pbrMetallicRoughness.baseColorFactor[3] * maxAtlasAlpha;
  const margin = cueMinimumAlpha - effectiveGroundAlpha;
  assert(margin >= 0.10, target.relativePath + ': measured ground decal may obscure attack: margin=' + margin);
  minGroundCueMargin = Math.min(minGroundCueMargin, margin);
}
console.log('P28_F5_TELEGRAPH_MARGIN_PASS min=' + minGroundCueMargin.toFixed(3)
  + ' cueMin=' + cueMinimumAlpha.toFixed(2) + ' groundMax=' + (cueMinimumAlpha - minGroundCueMargin).toFixed(3));

const effect = await readFile(at(REFINERY_F5_EFFECT_ATLAS.path));
assert(effect.subarray(0, 12).equals(Buffer.from([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a])));
assert.equal(effect.readUInt32LE(20), 1024, 'P28-F5 effect source width must be 1024');
assert.equal(effect.readUInt32LE(24), 1024, 'P28-F5 effect source height must be 1024');
assert.equal(effect.readUInt32LE(40), 11, 'P28-F5 effect atlas needs its full 11-level mip chain');
assert.equal(effect.readUInt32LE(44), 2, 'P28-F5 effect atlas must use KTX2 Zstandard compression');
assert(effect.length > 25_000, 'P28-F5 effect atlas must carry real nontrivial artwork');
const effectPixels = createRefineryF5EffectPixels();
const hashes = [];
for (let row = 0; row < 2; row += 1) {
  for (let column = 0; column < 2; column += 1) {
    const hash = createHash('sha256');
    let nonzero = 0;
    for (let y = row * 512; y < (row + 1) * 512; y += 1) {
      const start = (y * 1024 + column * 512) * 4;
      const tileRow = effectPixels.subarray(start, start + 512 * 4);
      hash.update(tileRow);
      for (let i = 3; i < tileRow.length; i += 4) if (tileRow[i] > 16) nonzero += 1;
    }
    assert(nonzero > 4_000, 'P28-F5 ' + REFINERY_F5_EFFECT_ATLAS.kinds[row * 2 + column] + ' effect tile is unused/empty');
    hashes.push(hash.digest('hex'));
  }
}
assert.equal(new Set(hashes).size, 4, 'P28-F5 particle families must not reuse duplicate atlas imagery');

const targets = [...new Set([...REFINERY_DECAL_TARGETS, ...REFINERY_ROUTE_DECAL_TARGETS].map(target => target.relativePath))];
assert(targets.length >= 15, 'P28-F5 must reach machinery and route decal LODs, not one showpiece');
for (const target of targets) {
  const glb = await readFile(at('public/assets/models/' + target));
  assert(glb.subarray(0, 4).toString() === 'glTF');
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8').trim());
  const images = json.images ?? [];
  assert(images.some(image => image.uri === REFINERY_F5_DECAL_ATLAS.file), target + ': P28-F5 atlas is not bound');
  assert(!images.some(image => image.uri === 'refinery-decal-atlas.png'), target + ': legacy low-resolution atlas is still on the live material');
  assert.equal(json.extras?.ironshadeP28F5Atlases?.originalUvLayoutPreserved, true, target + ': authored UVs changed');
  const decals = (json.materials ?? []).filter(material => /detail-atlas/.test(material.name));
  assert(decals.length > 0, target + ': no visible deco material');
  assert(decals.every(material => material.alphaMode === 'BLEND' && !material.emissiveTexture && !material.emissiveFactor),
    target + ': decorative atlas must not mask/bloom over gameplay cues');
}

const source = await readFile(at('src/game/babylonAmbientParticles.ts'), 'utf8');
assert(source.includes("REFINERY_LOCAL_FX_ATLAS_URL = '/assets/effects/refinery-local-effects-f5.ktx2'"),
  'P28-F5 effect atlas must be bound by the live ambient renderer, not merely shipped');
assert(source.includes('pool.material.diffuseTexture = atlas') && source.includes('this.localFxAtlas?.dispose()')
  && source.includes('source.setVerticesData(VertexBuffer.UVKind, uv)'),
  'P28-F5 ambient effects must mount and relinquish their local atlas textures');
const manifest = JSON.parse(await readFile(at('public/assets/heavy-asset-manifest.json'), 'utf8'));
const lookup = new Map(manifest.assets.map(asset => [asset.path, asset]));
const fxAsset = lookup.get('assets/effects/refinery-local-effects-f5.ktx2');
assert(fxAsset?.runtimeReferenced && fxAsset.texture?.fullChain && fxAsset.premiumQualified,
  'P28-F5 effect atlas must be locally inventoried, runtime bound and source-qualified');
const decalAsset = lookup.get('assets/models/environments/refinery-decal-atlas-f5.png');
assert(decalAsset?.runtimeReferenced, 'P28-F5 high resolution decal atlas must be bound by a registered GLB');
console.log('P28_F5_ATLAS_PASS decals=' + sourcePng.length + ' effects=' + effect.length
  + ' activeModels=' + targets.length + ' uniqueFxTiles=' + hashes.length + ' mipLevels=11');
