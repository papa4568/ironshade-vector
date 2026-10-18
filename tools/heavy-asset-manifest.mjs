import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative, dirname, extname } from 'node:path';
import { zstdDecompressSync } from 'node:zlib';

const ROOT = process.cwd();
const CATEGORIES = ['refinery', 'operator', 'enemy', 'boss', 'decal', 'vfx'];
const KTX_IDENTIFIER = Buffer.from([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]);
const SHA = data => createHash('sha256').update(data).digest('hex');
const sort = values => [...values].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
function check(ok, message) { if (!ok) throw new Error('P28-F0 ' + message); }
function checkedRange(bytes, start, length, name) {
  check(Number.isSafeInteger(start) && Number.isSafeInteger(length) && start >= 0 && length > 0 && start + length <= bytes.length, name + ': invalid byte range');
  return bytes.subarray(start, start + length);
}
function pngInfo(bytes, name) {
  check(bytes.length >= 33 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), name + ': invalid PNG');
  check(bytes.toString('ascii', 12, 16) === 'IHDR', name + ': missing PNG IHDR');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  check(width > 0 && height > 0 && bytes[24] === 8, name + ': invalid 8-bit PNG dimensions');
  return { width, height, mipLevels: 1, decodedBytes: width * height * (bytes[25] === 6 ? 4 : bytes[25] === 2 ? 3 : 1) };
}

export function measureKtx2(bytes, name = 'KTX2') {
  check(bytes.length >= 104 && bytes.subarray(0, 12).equals(KTX_IDENTIFIER), name + ': invalid KTX2 identifier');
  const width = bytes.readUInt32LE(20), height = bytes.readUInt32LE(24);
  const format = bytes.readUInt32LE(12), levels = bytes.readUInt32LE(40), compression = bytes.readUInt32LE(44);
  check(width > 0 && height > 0 && levels >= 1 && levels <= 32 && (format === 37 || format === 43), name + ': unsupported KTX2 dimensions/format');
  check(compression === 2, name + ': expected Zstandard-compressed KTX2');
  check(80 + 24 * levels <= bytes.length, name + ': truncated mip index');
  const mips = [];
  for (let level = 0; level < levels; level++) {
    const offset = 80 + 24 * level;
    const start = Number(bytes.readBigUInt64LE(offset)), size = Number(bytes.readBigUInt64LE(offset + 8));
    const rawSize = Number(bytes.readBigUInt64LE(offset + 16));
    const pixels = zstdDecompressSync(checkedRange(bytes, start, size, name + ' mip ' + level));
    const w = Math.max(1, width >> level), h = Math.max(1, height >> level);
    check(rawSize === w * h * 4 && pixels.length === rawSize, name + ': mip ' + level + ' inflated-byte mismatch');
    const activeChannels = [];
    for (let c = 0; c < 4; c++) {
      let first = pixels[c], varied = false;
      for (let p = c + 4; p < pixels.length; p += 4) if (pixels[p] !== first) { varied = true; break; }
      if (varied) activeChannels.push(c);
    }
    mips.push({ width: w, height: h, compressedBytes: size, uncompressedBytes: rawSize, contentHash: SHA(pixels), variedChannels: activeChannels });
  }
  const fullChain = levels === Math.floor(Math.log2(Math.max(width, height))) + 1 && mips.at(-1).width === 1 && mips.at(-1).height === 1;
  return { width, height, format: format === 43 ? 'rgba8-srgb' : 'rgba8-unorm', mipLevels: levels, fullChain, mips, uncompressedBytes: mips.reduce((n, m) => n + m.uncompressedBytes, 0) };
}

export function measureGlb(bytes, name = 'GLB') {
  check(bytes.length >= 28 && bytes.toString('ascii', 0, 4) === 'glTF' && bytes.readUInt32LE(4) === 2 && bytes.readUInt32LE(8) === bytes.length, name + ': invalid GLB header');
  let offset = 12, json, binary;
  while (offset < bytes.length) {
    check(offset + 8 <= bytes.length, name + ': truncated chunk header');
    const size = bytes.readUInt32LE(offset), kind = bytes.readUInt32LE(offset + 4);
    offset += 8;
    const chunk = checkedRange(bytes, offset, size, name + ' chunk');
    if (kind === 0x4e4f534a) { check(!json, name + ': repeated JSON chunk'); json = JSON.parse(chunk.toString('utf8').trim()); }
    if (kind === 0x004e4942) { check(!binary, name + ': repeated BIN chunk'); binary = chunk; }
    offset += size;
  }
  check(json?.asset?.version === '2.0' && binary, name + ': missing glTF JSON/BIN');
  const views = json.bufferViews ?? [], accessors = json.accessors ?? [];
  const used = new Set(), content = new Map(), geometry = new Set(), embedded = [];
  const readView = (index, label) => {
    const v = views[index];
    check(v && v.buffer === 0, name + ': invalid ' + label + ' buffer view');
    used.add(index);
    return checkedRange(binary, v.byteOffset ?? 0, v.byteLength, name + ' ' + label);
  };
  let vertices = 0, triangles = 0, primitiveCount = 0, unitCubePrimitives = 0;
  for (const mesh of json.meshes ?? []) for (const primitive of mesh.primitives ?? []) {
    check((primitive.mode ?? 4) === 4, name + ': non-triangle mesh');
    const pos = accessors[primitive.attributes?.POSITION];
    check(pos && Number.isInteger(pos.count) && pos.count > 0, name + ': missing POSITION accessor');
    vertices += pos.count;
    const count = primitive.indices === undefined ? pos.count : accessors[primitive.indices]?.count;
    check(Number.isInteger(count) && count > 0 && count % 3 === 0, name + ': invalid index count');
    triangles += count / 3;
    primitiveCount++;
    if (pos.count <= 8 && count === 36 && JSON.stringify(pos.min) === '[-0.5,-0.5,-0.5]' && JSON.stringify(pos.max) === '[0.5,0.5,0.5]') unitCubePrimitives++;
    for (const accessorId of [...Object.values(primitive.attributes ?? {}), primitive.indices].filter(Number.isInteger)) {
      const accessor = accessors[accessorId];
      check(accessor && Number.isInteger(accessor.bufferView), name + ': accessor lacks buffer view');
      const payload = readView(accessor.bufferView, 'geometry');
      const digest = SHA(payload);
      if (!content.has(digest)) content.set(digest, payload.length);
      geometry.add(digest);
    }
  }
  for (const img of json.images ?? []) {
    if (Number.isInteger(img.bufferView)) {
      const payload = readView(img.bufferView, 'texture');
      const info = img.mimeType === 'image/png' ? pngInfo(payload, name + ' embedded ' + (img.name ?? 'image')) : null;
      embedded.push({ name: img.name ?? '', mimeType: img.mimeType, dimensions: info ? [info.width, info.height] : null, mipLevels: info?.mipLevels ?? null, compressedBytes: payload.length, uncompressedBytes: info?.decodedBytes ?? null, contentHash: SHA(payload) });
      if (!content.has(SHA(payload))) content.set(SHA(payload), payload.length);
    } else if (img.uri) embedded.push({ name: img.name ?? '', uri: img.uri, mimeType: img.mimeType ?? null, external: true });
  }
  const channelSet = new Set();
  for (const material of json.materials ?? []) {
    const pbr = material.pbrMetallicRoughness ?? {};
    if (pbr.baseColorTexture) channelSet.add('baseColor');
    if (pbr.metallicRoughnessTexture) channelSet.add('orm');
    if (material.occlusionTexture) channelSet.add('occlusion');
    if (material.normalTexture) channelSet.add('normal');
    if (material.emissiveTexture) channelSet.add('emissive');
  }
  const channels = sort(channelSet);
  const legacyCube = primitiveCount > 0 && unitCubePrimitives === primitiveCount;
  const allocated = views.reduce((n, view, index) => n + (used.has(index) ? 0 : view.byteLength), 0);
  const meaningfulBytes = [...content.values()].reduce((n, bytes) => n + bytes, 0);
  return { vertices, triangles, primitiveCount, legacyCube, geometryHashes: sort(geometry), materialChannels: channels, embeddedTextures: embedded, meaningfulBytes, unusedBufferViewBytes: allocated, uncompressedBytes: binary.length + embedded.reduce((n, t) => n + (t.uncompressedBytes ?? 0), 0) };
}

function categoryFor(path) {
  if (path.endsWith('.png') && path.includes('decal')) return 'decal';
  if (path.includes('/materials/') || path.includes('premium-pbr')) return 'refinery';
  if (path.includes('/operators/')) return 'operator';
  if (path.includes('/enemies/')) return 'enemy';
  if (path.includes('/bosses/')) return 'boss';
  if (path.includes('/vfx/') || path.includes('/effects/')) return 'vfx';
  if (path.includes('decal') || path.includes('trim-atlas')) return 'decal';
  return 'refinery';
}
function mapChannel(path) {
  return path.includes('-base-color.') ? 'baseColor' : path.includes('-normal.') ? 'normal' : path.includes('-orm.') ? 'orm' : path.includes('-emissive.') ? 'emissive' : null;
}
async function allFiles(root) {
  const found = [];
  async function walk(path) {
    let entries;
    try { entries = await readdir(path, { withFileTypes: true }); }
    catch (e) { if (e.code === 'ENOENT') return; throw e; }
    for (const e of entries) {
      const child = resolve(path, e.name);
      if (e.isDirectory()) await walk(child);
      else if (e.isFile() && ['.glb', '.ktx2', '.png'].includes(extname(e.name).toLowerCase())) found.push(child);
    }
  }
  await walk(root);
  return sort(found);
}
function flagsFor(record) {
  const flags = [];
  if (record.lod === 0 && record.type === 'glb') {
    if (record.geometry.legacyCube) flags.push('box-derived-lod0');
    if (record.geometry.vertices < 24 || record.geometry.triangles < 12) flags.push('placeholder-scale-geometry');
    for (const channel of ['baseColor', 'normal', 'orm']) if (!record.materialChannels.includes(channel)) flags.push('missing-' + channel + '-map');
  }
  if (record.type === 'ktx2') {
    if (!record.texture.fullChain) flags.push('incomplete-mip-chain');
    if ((record.texture.mips[0]?.variedChannels?.length ?? 0) === 0) flags.push('flat-texture-content');
  }
  if (record.geometry?.unusedBufferViewBytes > 0) flags.push('unreferenced-binary-payload');
  if (!record.runtimeReferenced) flags.push('not-runtime-manifest-referenced');
  return flags;
}

export async function createHeavyManifest({ root = ROOT, assetRoot = resolve(root, 'public/assets') } = {}) {
  const registry = await readFile(resolve(root, 'src/game/graphicsAssetManifest.ts'), 'utf8');
  const referenced = new Set([...registry.matchAll(/['"](\/assets\/models\/[^'"]+\.glb)['"]/g)].map(m => m[1].slice(1)));
  const files = await allFiles(assetRoot);
  const assets = [];
  for (const file of files) {
    const path = relative(assetRoot, file).replaceAll('\\', '/');
    const assetPath = 'assets/' + path;
    const bytes = await readFile(file);
    const ext = extname(file).toLowerCase();
    const type = ext === '.glb' ? 'glb' : ext === '.ktx2' ? 'ktx2' : 'png';
    const lod = /-lod([012])\.glb$/.exec(path)?.[1];
    const geometry = type === 'glb' ? measureGlb(bytes, path) : null;
    const texture = type === 'ktx2' ? measureKtx2(bytes, path) : type === 'png' ? pngInfo(bytes, path) : null;
    const runtimeReferenced = type !== 'glb' || referenced.has(assetPath);
    const record = {
      path: assetPath, category: categoryFor(assetPath), type, lod: lod === undefined ? null : Number(lod),
      runtimeReferenced, fileSha256: SHA(bytes), onDiskBytes: bytes.length,
      uncompressedSourceBytes: geometry?.uncompressedBytes ?? texture?.uncompressedBytes ?? texture?.decodedBytes ?? null,
      meaningfulBytes: geometry?.meaningfulBytes ?? (texture?.mips?.reduce((n, m) => n + m.uncompressedBytes, 0) ?? texture?.decodedBytes ?? 0),
      vertices: geometry?.vertices ?? 0, triangles: geometry?.triangles ?? 0,
      geometry: geometry ? { legacyCube: geometry.legacyCube, primitiveCount: geometry.primitiveCount, unusedBufferViewBytes: geometry.unusedBufferViewBytes, geometryHashes: geometry.geometryHashes, embeddedTextures: geometry.embeddedTextures } : null,
      materialChannels: geometry?.materialChannels ?? (mapChannel(assetPath) ? [mapChannel(assetPath)] : []),
      texture: texture ? { width: texture.width, height: texture.height, mipLevels: texture.mipLevels, fullChain: texture.fullChain ?? false, format: texture.format ?? 'png', mips: texture.mips ?? [] } : null,
    };
    record.qualityFlags = flagsFor(record);
    record.premiumQualified = record.runtimeReferenced && record.qualityFlags.length === 0 && (record.lod === 0 || record.type === 'ktx2');
    assets.push(record);
  }
  const missing = sort([...referenced].filter(p => !assets.some(a => a.path === p)));
  check(missing.length === 0, 'registered runtime assets missing: ' + missing.join(', '));
  const seenFiles = new Set(), seenSemantics = new Set();
  for (const asset of assets) {
    asset.duplicateOf = seenFiles.has(asset.fileSha256) ? assets.find(a => a.fileSha256 === asset.fileSha256).path : null;
    seenFiles.add(asset.fileSha256);
    const hashes = asset.geometry?.geometryHashes ?? (asset.texture?.mips?.map(m => m.contentHash) ?? [asset.fileSha256]);
    const unique = hashes.filter(hash => !seenSemantics.has(hash));
    hashes.forEach(hash => seenSemantics.add(hash));
    asset.uniqueMeaningfulBytes = asset.premiumQualified && !asset.duplicateOf
      ? asset.type === 'glb' ? (unique.length / Math.max(1, hashes.length)) * asset.meaningfulBytes
        : asset.type === 'ktx2' ? asset.texture.mips.filter(m => unique.includes(m.contentHash)).reduce((n, m) => n + m.uncompressedBytes, 0)
        : 0 : 0;
  }
  const categories = Object.fromEntries(CATEGORIES.map(cat => {
    const matched = assets.filter(a => a.category === cat);
    return [cat, {
      assetCount: matched.length, shippedBytes: matched.reduce((n, a) => n + a.onDiskBytes, 0),
      premiumQualifiedCount: matched.filter(a => a.premiumQualified && !a.duplicateOf).length,
      uniquePremiumSourceBytes: Math.round(matched.reduce((n, a) => n + a.uniqueMeaningfulBytes, 0)),
      flaggedLod0: matched.filter(a => a.lod === 0 && a.qualityFlags.some(f => f !== 'not-runtime-manifest-referenced')).map(a => ({ path: a.path, flags: a.qualityFlags })),
      coverage: matched.length ? 'measured' : 'no-shipped-asset',
    }];
  }));
  return { schema: 'ironshade-heavy-art-v1', interpretation: 'Reported bytes are measured; only referenced, nonduplicate, texture-complete, non-box LOD0 and validated KTX2 contribute to qualified premium source bytes. Missing/procedural VFX is recorded as zero, never projected. Flags are a baseline for P28-F1 through F7, not an assertion that existing placeholder LOD0 art is already premium.', categories, assets };
}

export function measureApkFromRows(manifest, rows) {
  const byPath = new Map();
  for (const row of rows) {
    check(row.name.startsWith('assets/public/'), 'unexpected APK asset path ' + row.name);
    const path = row.name.slice('assets/public/'.length);
    check(!byPath.has(path), 'duplicate APK entry for ' + path);
    byPath.set(path, row);
  }
  const assets = manifest.assets.map(asset => {
    const row = byPath.get(asset.path);
    check(row, 'APK missing required asset ' + asset.path);
    check(row.sha256 === asset.fileSha256 && row.bytes === asset.onDiskBytes, 'APK asset bytes mismatch ' + asset.path);
    return { path: asset.path, category: asset.category, uncompressedBytes: row.bytes, compressedBytes: row.compressedBytes, zipMethod: row.method };
  });
  return {
    schema: 'ironshade-heavy-art-apk-v1',
    assets,
    categories: Object.fromEntries(CATEGORIES.map(c => [c, {
      uncompressedBytes: assets.filter(a => a.category === c).reduce((n, a) => n + a.uncompressedBytes, 0),
      compressedBytes: assets.filter(a => a.category === c).reduce((n, a) => n + a.compressedBytes, 0),
    }])),
  };
}

export async function measureApk(manifest, apkPath) {
  const python = [
    'import hashlib,json,sys,zipfile',
    'with zipfile.ZipFile(sys.argv[1]) as z:',
    '  result=[]',
    '  for name in json.loads(sys.argv[2]):',
    '    path="assets/public/"+name',
    '    entries=[i for i in z.infolist() if i.filename==path]',
    '    if len(entries)!=1: raise RuntimeError("missing or duplicate APK asset: "+path)',
    '    i=entries[0]; data=z.read(i)',
    '    result.append(dict(name=path,bytes=i.file_size,compressedBytes=i.compress_size,method=i.compress_type,sha256=hashlib.sha256(data).hexdigest()))',
    'print(json.dumps(result))',
  ].join('\n');
  const rows = JSON.parse(execFileSync('python3', ['-c', python, apkPath, JSON.stringify(manifest.assets.map(a => a.path))], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
  return measureApkFromRows(manifest, rows);
}

export async function runHeavyAssetManifest(mode = 'write', { root = ROOT, apkPath, output } = {}) {
  const generated = await createHeavyManifest({ root, assetRoot: resolve(root, mode === 'verify-dist' || mode === 'apk' ? 'dist/assets' : 'public/assets') });
  const sourceManifest = resolve(root, 'public/assets/heavy-asset-manifest.json');
  if (mode === 'write') {
    await mkdir(dirname(sourceManifest), { recursive: true });
    await writeFile(sourceManifest, JSON.stringify(generated, null, 2) + '\n');
  } else {
    const path = mode === 'verify-dist' || mode === 'apk' ? resolve(root, 'dist/assets/heavy-asset-manifest.json') : sourceManifest;
    const recorded = JSON.parse(await readFile(path, 'utf8'));
    check(JSON.stringify(recorded) === JSON.stringify(generated), mode + ': generated manifest differs from delivered file');
    if (mode === 'apk') {
      const apkReport = await measureApk(generated, apkPath ?? resolve(root, 'Ironshade-Vector-Android-Debug.apk'));
      const reportPath = output ?? resolve(root, 'p28-f0-heavy-asset-apk.json');
      await writeFile(reportPath, JSON.stringify(apkReport, null, 2) + '\n');
      console.log('P28_F0_APK_ART_PASS assets=' + apkReport.assets.length + ' report=' + reportPath);
      return apkReport;
    }
  }
  console.log('P28_F0_ART_MANIFEST_PASS assets=' + generated.assets.length + ' qualified=' + generated.assets.filter(a => a.premiumQualified).length + ' mode=' + mode);
  return generated;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const mode = process.argv[2] ?? 'write';
  check(['write', 'verify', 'verify-dist', 'apk'].includes(mode), 'unknown mode ' + mode);
  await runHeavyAssetManifest(mode);
}
