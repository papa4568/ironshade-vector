import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const FAMILIES = ['refinery', 'operator', 'enemy', 'boss', 'decal', 'vfx'];
const BASELINE_SHA = '01bfb938d02e2c7a2dbb8053156cf843c1f7e373';
const REQUIRED_LOD0 = { refinery: 19, operator: 3, enemy: 4, boss: 1 };
const sum = (items, field) => items.reduce((total, item) => total + item[field], 0);
function verify(ok, message) { assert(ok, 'P28-F7 ' + message); }
function nonnegative(value) { return Number.isSafeInteger(value) && value >= 0; }

/** Read-only audit of the F0 historical source manifest versus actual delivered art. */
export function auditHeavySource(baseline, manifest) {
  verify(baseline.schema === 'ironshade-p28-f7-baseline-v1'
    && baseline.source?.candidateSha === BASELINE_SHA
    && baseline.source?.manifestSha256 === 'a191f9b94212476f712b5eb66c75a5c782942503fd9e88e22771a1d17e6bdbd1'
    && baseline.source?.apkAuditSha256 === '91a89cbb7876a681d506cd14561d5666514024dbd7b0a17298504d7dcac9af99',
  'historical F0 provenance changed');
  verify(manifest.schema === 'ironshade-heavy-art-v1', 'invalid delivered source manifest');
  verify(Array.isArray(manifest.assets) && manifest.assets.length > baseline.assetCount,
    'shipped art inventory did not grow since F0');
  verify(Object.keys(baseline.families).sort().join(',') === [...FAMILIES].sort().join(','),
    'F0 category baseline incomplete');
  verify(sum(Object.values(baseline.families), 'assetCount') === baseline.assetCount,
    'historical F0 category inventory disagrees with baseline total');
  const paths = new Set(), digests = new Set();
  for (const asset of manifest.assets) {
    verify(!paths.has(asset.path), 'duplicate manifest path ' + asset.path);
    paths.add(asset.path);
    verify(FAMILIES.includes(asset.category) && nonnegative(asset.onDiskBytes)
      && nonnegative(asset.vertices) && nonnegative(asset.triangles)
      && /^[0-9a-f]{64}$/.test(asset.fileSha256), 'malformed asset ' + asset.path);
    verify(Array.isArray(asset.qualityFlags) && typeof asset.runtimeReferenced === 'boolean'
      && typeof asset.premiumQualified === 'boolean', 'incomplete source qualification ' + asset.path);
    if (asset.runtimeReferenced) {
      verify(!asset.duplicateOf && !digests.has(asset.fileSha256),
        'duplicated runtime art cannot count as growth ' + asset.path);
      digests.add(asset.fileSha256);
    }
    if (asset.runtimeReferenced && asset.lod === 0 && asset.type === 'glb') {
      verify(!asset.geometry?.legacyCube && asset.vertices > 24 && asset.triangles > 12
        && asset.geometry?.unusedBufferViewBytes === 0
        && !asset.qualityFlags.includes('box-derived-lod0')
        && !asset.qualityFlags.includes('placeholder-scale-geometry'),
        'mapped runtime hero/refinery LOD0 still has box/placeholder/dead geometry ' + asset.path);
    }
  }
  const families = {};
  for (const name of FAMILIES) {
    const group = manifest.assets.filter(asset => asset.category === name);
    const bound = group.filter(asset => asset.runtimeReferenced);
    const source = manifest.categories?.[name];
    const before = baseline.families[name];
    verify(source && source.assetCount === group.length
      && source.shippedBytes === sum(group, 'onDiskBytes'),
      'delivered manifest family accounting mismatch ' + name);
    verify(nonnegative(source.uniquePremiumSourceBytes)
      && (name === 'decal' ? source.uniquePremiumSourceBytes === 0
        : source.uniquePremiumSourceBytes > before.uniquePremiumSourceBytes),
      'no increase in non-duplicate, qualified authored source content: ' + name);
    verify(bound.length > 0 && bound.every(asset => !asset.duplicateOf),
      'category has no unique runtime-bound art: ' + name);
    if (name in REQUIRED_LOD0) {
      const lod0 = bound.filter(asset => asset.lod === 0 && asset.type === 'glb');
      verify(lod0.length >= REQUIRED_LOD0[name],
        'runtime production LOD0 family coverage lost: ' + name);
    }
    families[name] = {
      baselineAssets: before.assetCount, currentAssets: group.length,
      baselineUniquePremiumSourceBytes: before.uniquePremiumSourceBytes,
      currentUniquePremiumSourceBytes: source.uniquePremiumSourceBytes,
      boundAssets: bound.length,
      boundBytes: sum(bound, 'onDiskBytes'),
      runtimeLod0: bound.filter(asset => asset.type === 'glb' && asset.lod === 0).length,
    };
  }
  // External PNG atlases are runtime-bound through live GLB texture references;
  // they do not qualify as KTX2 source mips. Validate them separately.
  const decals = manifest.assets.filter(asset => asset.category === 'decal');
  verify(decals.some(asset => asset.path === 'assets/models/environments/refinery-decal-atlas-f5.png'
    && asset.runtimeReferenced && asset.type === 'png' && !asset.duplicateOf),
  'F5 heavy route-decal atlas is not a unique runtime-used texture');
  // The decal category has zero "premium-qualified" bytes by F0 schema design.
  // Account for useful decal growth through its actual runtime-bound ZIP entries.
  families.decal.currentUniquePremiumSourceBytes = 0;
  families.decal.baselineUniquePremiumSourceBytes = 0;
  const effects = manifest.assets.filter(asset => asset.category === 'vfx');
  verify(effects.some(asset => asset.path === 'assets/effects/refinery-local-effects-f5.ktx2'
    && asset.runtimeReferenced && asset.premiumQualified && asset.texture?.fullChain
    && asset.texture?.mipLevels === 10 && !asset.duplicateOf),
  'local-effects atlas is not actual runtime-bound compressed art');
  const textures = manifest.assets.filter(asset => asset.category === 'refinery'
    && asset.path.startsWith('assets/materials/premium-pbr/p28f1/') && asset.type === 'ktx2');
  verify(textures.length === 16 && textures.every(asset => asset.runtimeReferenced
    && asset.premiumQualified && !asset.duplicateOf && asset.texture?.width === 2048
    && asset.texture?.height === 2048 && asset.texture?.fullChain),
  'high-resolution authored refinery texture set is not wholly delivered and bound');
  return { schema: 'ironshade-p28-f7-source-audit-v1',
    baselineSha: BASELINE_SHA, baselineAssetCount: baseline.assetCount,
    currentAssetCount: manifest.assets.length, families,
    zeroMappedBoxPlaceholders: true,
    delivered2kRefineryTextures: textures.length,
    flagshipVisualCapture: 'separate-exact-sha-CI-proof-required' };
}

/** Compare source-accounted art with independently measured real APK ZIP entries. */
export function auditHeavyApk(baseline, manifest, apk, sourceResult = auditHeavySource(baseline, manifest)) {
  verify(apk.schema === 'ironshade-heavy-art-apk-v1'
    && Array.isArray(apk.assets) && apk.assets.length === manifest.assets.length,
    'candidate APK inventory differs from delivered source');
  verify(nonnegative(apk.apkBytes) && /^[0-9a-f]{64}$/.test(apk.apkSha256),
    'candidate lacks real APK byte count and SHA-256 identity');
  verify(Array.isArray(apk.runtimeFiles) && apk.runtimeFiles.length > 0,
    'offline Android graphics codecs were not packaged');
  const byPath = new Map();
  for (const item of apk.assets) {
    verify(!byPath.has(item.path) && nonnegative(item.uncompressedBytes)
      && nonnegative(item.compressedBytes) && [0, 8].includes(item.zipMethod),
    'invalid/duplicate APK art entry ' + item.path);
    byPath.set(item.path, item);
  }
  const families = {};
  for (const name of FAMILIES) {
    const group = manifest.assets.filter(asset => asset.category === name);
    const rows = group.map(asset => {
      const row = byPath.get(asset.path);
      verify(row && row.category === name && row.uncompressedBytes === asset.onDiskBytes,
        'APK content/source accounting mismatch ' + asset.path);
      return row;
    });
    const zip = apk.categories?.[name];
    const before = baseline.families[name];
    verify(zip && zip.uncompressedBytes === sum(rows, 'uncompressedBytes')
      && zip.compressedBytes === sum(rows, 'compressedBytes'),
      'reported APK category bytes differ from entries: ' + name);
    verify(zip.compressedBytes > before.apkCompressedBytes
      && zip.uncompressedBytes > before.apkUncompressedBytes,
      'APK art family did not gain real compressed and source bytes: ' + name);
    const bound = group.filter(asset => asset.runtimeReferenced);
    const boundZipBytes = sum(bound.map(asset => byPath.get(asset.path)), 'compressedBytes');
    verify(boundZipBytes > before.apkCompressedBytes,
      'runtime-bound compressed artwork did not exceed the entire F0 family: ' + name);
    families[name] = {
      ...sourceResult.families[name],
      baselineApkUncompressedBytes: before.apkUncompressedBytes,
      currentApkUncompressedBytes: zip.uncompressedBytes,
      baselineApkCompressedBytes: before.apkCompressedBytes,
      currentApkCompressedBytes: zip.compressedBytes,
      compressedGrowthBytes: zip.compressedBytes - before.apkCompressedBytes,
      runtimeBoundApkCompressedBytes: boundZipBytes,
    };
  }
  verify(apk.totals?.artUncompressedBytes === sum(apk.assets, 'uncompressedBytes')
    && apk.totals?.artCompressedBytes === sum(apk.assets, 'compressedBytes'),
    'candidate real ZIP art totals are inconsistent');
  return { schema: 'ironshade-p28-f7-acceptance-v1',
    baselineSha: BASELINE_SHA,
    candidateSha: process.env.CANDIDATE_SHA ?? null,
    baselineEvidence: baseline.source,
    candidateApkBytes: apk.apkBytes,
    candidateApkSha256: apk.apkSha256,
    totalArtCompressedGrowthBytes: sum(Object.values(families), 'compressedGrowthBytes'),
    currentAssetCount: sourceResult.currentAssetCount,
    baselineAssetCount: sourceResult.baselineAssetCount,
    families,
    zeroMappedBoxPlaceholders: true,
    flagshipVisualCapture: 'separate-exact-sha-CI-proof-required',
    separateBrowserAndroidCiIndependentReview: 'required-before-roadmap-closeout' };
}

export async function runP28F7(mode = 'source', root = process.cwd()) {
  verify(['source', 'apk'].includes(mode), 'unknown audit mode ' + mode);
  const [baseline, manifest] = await Promise.all([
    readFile(resolve(root, 'tools/p28-f7-baseline.json'), 'utf8').then(JSON.parse),
    readFile(resolve(root, 'dist/assets/heavy-asset-manifest.json'), 'utf8').then(JSON.parse),
  ]);
  const source = auditHeavySource(baseline, manifest);
  if (mode === 'source') {
    console.log('P28_F7_SOURCE_ACCEPTANCE_PASS assets=' + source.currentAssetCount
      + ' mappedBoxPlaceholders=0 textures=' + source.delivered2kRefineryTextures);
    return source;
  }
  const apk = JSON.parse(await readFile(resolve(root, 'p28-f0-heavy-asset-apk.json'), 'utf8'));
  const result = auditHeavyApk(baseline, manifest, apk, source);
  const output = resolve(root, 'p28-f7-heavy-asset-acceptance.json');
  await writeFile(output, JSON.stringify(result, null, 2) + '\n');
  console.log('P28_F7_EXACT_APK_ACCEPTANCE_PASS apkSha=' + result.candidateApkSha256
    + ' artCompressedGrowthBytes=' + result.totalArtCompressedGrowthBytes
    + ' mappedBoxPlaceholders=0 report=' + output);
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runP28F7(process.argv[2] ?? 'source');
}
