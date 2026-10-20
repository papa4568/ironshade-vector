import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { auditHeavySource, auditHeavyApk } from '../tools/p28-f7-heavy-acceptance.mjs';

const baseline = JSON.parse(await readFile(resolve('tools/p28-f7-baseline.json'), 'utf8'));
const manifest = JSON.parse(await readFile(resolve('dist/assets/heavy-asset-manifest.json'), 'utf8'));
const source = auditHeavySource(baseline, manifest);
const mutated = action => { const copy = structuredClone(manifest); action(copy); return copy; };
const rejectSource = (action, reason) => assert.throws(() => auditHeavySource(baseline, mutated(action)), /P28-F7/, reason);
rejectSource(m => { m.categories.refinery.uniquePremiumSourceBytes = 0; }, 'non-meaningful bytes cannot pass source growth');
rejectSource(m => { m.assets.find(a => a.category === 'operator' && a.runtimeReferenced && a.lod === 0).geometry.legacyCube = true; }, 'box-derived runtime hero must fail');
rejectSource(m => { m.assets.find(a => a.category === 'refinery' && a.runtimeReferenced && a.lod === 0).geometry.unusedBufferViewBytes = 20; }, 'dead binary cannot purchase authored LOD0 acceptance');
rejectSource(m => { m.assets.find(a => a.path === 'assets/models/environments/refinery-decal-atlas-f5.png').runtimeReferenced = false; }, 'unbound huge PNG decal must fail');
rejectSource(m => { m.assets.find(a => a.path === 'assets/effects/refinery-local-effects-f5.ktx2').runtimeReferenced = false; }, 'unbound VFX must fail');
rejectSource(m => { m.assets.find(a => a.path.startsWith('assets/materials/premium-pbr/p28f1/')).premiumQualified = false; }, 'unused premium texture must fail');
rejectSource(m => { m.assets[0].path = m.assets[1].path; }, 'duplicate source path must fail');
rejectSource(m => { m.categories.operator.shippedBytes++; }, 'source category accounting must be exact');
assert.throws(() => auditHeavySource({ ...baseline, source: { ...baseline.source, manifestSha256: 'forged' } }, manifest),
  /historical F0 provenance changed/, 'untrusted historical comparison must fail');
if (process.argv[2] === 'apk') {
  const apk = JSON.parse(await readFile('p28-f0-heavy-asset-apk.json', 'utf8'));
  const report = auditHeavyApk(baseline, manifest, apk, source);
  const rejectApk = (action, reason) => {
    const altered = structuredClone(apk);
    action(altered);
    assert.throws(() => auditHeavyApk(baseline, manifest, altered, source), /P28-F7/, reason);
  };
  rejectApk(a => { a.categories.refinery.compressedBytes = baseline.families.refinery.apkCompressedBytes; },
    'forged compressed growth must fail');
  rejectApk(a => { a.assets[0].uncompressedBytes++; }, 'source/APK drift must fail');
  rejectApk(a => { a.assets.push({ ...a.assets[0] }); }, 'duplicated APK assets must fail');
  rejectApk(a => { a.runtimeFiles.length = 0; }, 'packaged offline decoder loss must fail');
  assert(report.totalArtCompressedGrowthBytes > 0 && report.candidateApkSha256 === apk.apkSha256,
    'final audited package identity must match measured APK');
  console.log('P28_F7_APK_NEGATIVE_CONTROLS_PASS genuineFamilies=6 tampered=4');
} else {
  console.log('P28_F7_SOURCE_NEGATIVE_CONTROLS_PASS genuineFamilies=6 tampered=9');
}
