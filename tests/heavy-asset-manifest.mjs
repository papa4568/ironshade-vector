import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildPremiumPbrReferenceGlb } from '../scripts/prepare-premium-pbr-reference.mjs';
import { buildKtx2RgbaZstd } from '../scripts/prepare-premium-pbr-library.mjs';
import { createHeavyManifest, measureGlb, measureKtx2, measureApkFromRows, measureApk, runHeavyAssetManifest } from '../tools/heavy-asset-manifest.mjs';

function mutateGlbJson(bytes, mutation) {
  const jsonSize = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonSize).toString('utf8').trim());
  mutation(gltf);
  const json = Buffer.from(JSON.stringify(gltf));
  const padded = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
  const rest = bytes.subarray(20 + jsonSize);
  const header = Buffer.from(bytes.subarray(0, 20));
  header.writeUInt32LE(20 + padded.length + rest.length, 8);
  header.writeUInt32LE(padded.length, 12);
  return Buffer.concat([header, padded, rest]);
}
const premium = buildPremiumPbrReferenceGlb();
const base = measureGlb(premium, 'reference');
assert(base.vertices > 0 && base.triangles > 0, 'reference geometry telemetry must be present');
assert(base.materialChannels.includes('baseColor') && base.materialChannels.includes('normal') && base.materialChannels.includes('orm'), 'reference material textures missing');
assert(base.embeddedTextures.length === 4, 'must measure embedded reference texture maps');
assert(base.embeddedTextures.every(t => t.dimensions[0] === 4 && t.dimensions[1] === 4), 'must report source image dimensions');
assert(base.meaningfulBytes > 0, 'actual geometry/image payload must be counted');

const inflated = mutateGlbJson(premium, gltf => { gltf.extras = { syntheticPadding: 'x'.repeat(4096) }; });
const padded = measureGlb(inflated, 'padded');
assert(inflated.length > premium.length + 4000, 'padding fixture must increase shipped file bytes');
assert(padded.meaningfulBytes === base.meaningfulBytes, 'synthetic JSON padding must never inflate premium source bytes');
assert.deepEqual(padded.geometryHashes, base.geometryHashes, 'metadata padding must not change geometry content identity');

const missingTexture = mutateGlbJson(premium, gltf => { delete gltf.materials[0].normalTexture; });
const missing = measureGlb(missingTexture, 'missing-normal');
assert(!missing.materialChannels.includes('normal'), 'cannot credit a map merely because an unused image remains in GLB');
assert.throws(() => measureGlb(Buffer.concat([premium, Buffer.from([0])])), /invalid GLB header/, 'trailing padding should violate length integrity');
assert.throws(() => measureGlb(premium.subarray(0, premium.length - 8)), /invalid GLB header/, 'truncation must fail');

const pixels = Buffer.alloc(8 * 8 * 4);
for (let i = 0; i < pixels.length; i += 4) { pixels[i] = i % 251; pixels[i + 1] = i % 255; pixels[i + 2] = 210; pixels[i + 3] = 255; }
const ktx = buildKtx2RgbaZstd(pixels, 8, 8, false);
const texture = measureKtx2(ktx, 'fixture');
assert(texture.width === 8 && texture.height === 8 && texture.mipLevels === 4 && texture.fullChain, 'KTX2 full mip chain must be measured');
assert(texture.uncompressedBytes === (64 + 16 + 4 + 1) * 4, 'KTX2 uncompressed mip byte count incorrect');
assert(texture.mips[0].variedChannels.length > 0, 'authored texture variation must be measured');
const invalid = Buffer.from(ktx);
invalid.writeBigUInt64LE(BigInt(ktx.length + 100), 80);
assert.throws(() => measureKtx2(invalid), /invalid byte range/, 'KTX2 out-of-bounds mip must fail');
const bogusRaw = Buffer.from(ktx);
bogusRaw.writeBigUInt64LE(1n, 96);
assert.throws(() => measureKtx2(bogusRaw), /inflated-byte mismatch/, 'KTX2 fake uncompressed bytes must fail');

const fake = {
  assets: [
    { path: 'assets/models/environments/refinery-floor-panel-lod0.glb', category: 'refinery', fileSha256: 'a', onDiskBytes: 100 },
    { path: 'assets/materials/premium-pbr/painted-metal-normal.ktx2', category: 'refinery', fileSha256: 'b', onDiskBytes: 50 },
  ],
};
const fakeRows = fake.assets.map((a, i) => ({ name: 'assets/public/' + a.path, bytes: a.onDiskBytes, compressedBytes: 30 + i, method: 8, sha256: a.fileSha256 }));
const delivered = measureApkFromRows(fake, fakeRows);
assert(delivered.categories.refinery.compressedBytes === 61, 'APK report must credit real per-entry compressed bytes');
assert(delivered.categories.vfx.compressedBytes === 0 && delivered.categories.decal.compressedBytes === 0, 'unshipped VFX and decals must remain zero');
assert.throws(() => measureApkFromRows(fake, fakeRows.slice(1)), /APK missing required asset/, 'missing APK payload must fail');
assert.throws(() => measureApkFromRows(fake, [...fakeRows, fakeRows[0]]), /duplicate APK entry/, 'duplicate ZIP entries must fail');
assert.throws(() => measureApkFromRows(fake, [{ ...fakeRows[0], sha256: 'different' }, fakeRows[1]]), /bytes mismatch/, 'tampered APK payload must fail');

// Actual ZIP central-directory and local-header integrity: test both stored and deflated APK entries.
function buildZip(entries) {
  const locals = [], centrals = [];
  let nextOffset = 0;
  for (const item of entries) {
    const name = Buffer.from(item.name);
    const payload = item.method === 8 ? deflateRawSync(item.data) : item.data;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(item.method, 8);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(item.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, payload);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(item.method, 10);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(item.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(nextOffset, 42);
    centrals.push(central, name);
    nextOffset += local.length + name.length + payload.length;
  }
  const centralBytes = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(nextOffset, 16);
  return Buffer.concat([...locals, centralBytes, end]);
}
const zipDir = await mkdtemp(join(tmpdir(), 'ironshade-p28-f0-zip-'));
try {
  const fixtures = [
    { name: 'assets/public/assets/models/environments/floor.glb', data: Buffer.from('gltf content a'), method: 0, category: 'refinery' },
    { name: 'assets/public/assets/materials/premium-pbr/steel-normal.ktx2', data: Buffer.from('texture content b repeated'.repeat(100)), method: 8, category: 'refinery' },
  ];
  const archive = resolve(zipDir, 'fixture.apk');
  await writeFile(archive, buildZip(fixtures));
  const records = fixtures.map(item => ({ path: item.name.slice('assets/public/'.length), category: item.category, fileSha256: createHash('sha256').update(item.data).digest('hex'), onDiskBytes: item.data.length }));
  const checked = await measureApk({ assets: records }, archive);
  assert(checked.assets.length === 2 && checked.assets.some(a => a.zipMethod === 8), 'stored and deflated APK assets must be measured');
  assert(checked.categories.refinery.uncompressedBytes === fixtures.reduce((n, item) => n + item.data.length, 0), 'APK ZIP entry accounting must use measured source bytes');
  await writeFile(archive, buildZip(fixtures.slice(0, 1)));
  await assert.rejects(measureApk({ assets: records }, archive), /APK missing required asset/, 'missing APK ZIP entry must fail');
  await writeFile(archive, buildZip([fixtures[0], fixtures[0], fixtures[1]]));
  await assert.rejects(measureApk({ assets: records }, archive), /duplicate APK entry/, 'duplicate central entries must fail');
} finally { await rm(zipDir, { recursive: true, force: true }); }

const temp = await mkdtemp(join(tmpdir(), 'ironshade-p28-f0-'));
try {
  const src = resolve(temp, 'src/game');
  const model = resolve(temp, 'public/assets/models/environments');
  await mkdir(src, { recursive: true });
  await mkdir(model, { recursive: true });
  await writeFile(resolve(src, 'graphicsAssetManifest.ts'), [
    "createGraphicsAssetSpec('one', 'environment-module', '/assets/models/environments/refinery-floor-lod0.glb', 0)",
    "createGraphicsAssetSpec('two', 'environment-module', '/assets/models/environments/refinery-duplicate-lod0.glb', 0)",
  ].join('\n'));
  await writeFile(resolve(model, 'refinery-floor-lod0.glb'), premium);
  await writeFile(resolve(model, 'refinery-duplicate-lod0.glb'), premium);
  const duplicate = await createHeavyManifest({ root: temp });
  assert(duplicate.assets.length === 2, 'both registered GLBs must be inventoried');
  assert(duplicate.assets[1].duplicateOf === duplicate.assets[0].path, 'identical files cannot be credited twice');
  assert(duplicate.assets[1].uniqueMeaningfulBytes === 0, 'duplicate geometry cannot increase premium source bytes');
  assert(duplicate.categories.refinery.assetCount === 2 && duplicate.categories.refinery.shippedBytes === premium.length * 2, 'shipped and qualified bytes must be separate');
  await rm(resolve(model, 'refinery-duplicate-lod0.glb'));
  await assert.rejects(createHeavyManifest({ root: temp }), /registered runtime assets missing/, 'missing registered asset must fail');
} finally { await rm(temp, { recursive: true, force: true }); }

await runHeavyAssetManifest('write');
const first = await runHeavyAssetManifest('verify');
const second = await runHeavyAssetManifest('verify');
assert.deepEqual(first, second, 'heavy-art report must be deterministic');
for (const category of ['refinery', 'operator', 'enemy', 'boss', 'decal', 'vfx']) assert(category in first.categories, 'missing heavy-art category ' + category);
assert(first.assets.some(a => a.lod === 0 && a.type === 'glb'), 'must audit production LOD0 models');
assert(first.assets.some(a => a.type === 'ktx2'), 'must audit shipped compressed texture sources');
assert(first.assets.some(a => a.type === 'png' && a.category === 'decal'), 'must audit refinery decal PNG');
assert(first.assets.every(a => a.uniqueMeaningfulBytes <= a.meaningfulBytes), 'must not credit more unique meaningful content than measured');
console.log('P28_F0_HEAVY_ART_TEST_PASS fixtures=padding+channels+ktx2+duplication+missing+apk verifiedAssets=' + first.assets.length);
