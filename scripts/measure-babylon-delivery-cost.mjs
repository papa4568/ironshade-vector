import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const distDir = resolve(root, 'dist');
const assetsDir = resolve(distDir, 'assets');
const apkPath = resolve(root, process.env.P27D2_APK_PATH ?? 'Ironshade-Vector-Android-Debug.apk');
const reportPath = resolve(root, process.env.P27D2_REPORT_PATH ?? 'p27d2-babylon-delivery.json');
const chunkPrefixes = ['babylon-core-', 'babylon-post-', 'babylon-loaders-', 'babylon-webgpu-', 'babylonCombatRenderer-'];
const p21Baseline = Object.freeze({
  source: 'P21-F3 Android beta.608',
  apkBytes: 6078104,
  webgpuIncrementalCompressedBytes: 254269,
  webgpuIncrementalUncompressedBytes: 757432,
});

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

const jsChunks = chunkPrefixes.map(prefix => {
  const matches = readdirSync(assetsDir)
    .filter(name => name.endsWith('.js') && name.startsWith(prefix))
    .sort();
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one ${prefix} chunk, found ${matches.length}: ${matches.join(',')}`);
  }
  return matches[0];
});

const codecDir = resolve(assetsDir, 'codecs/babylon');
const codecFiles = listFiles(codecDir).sort();
if (codecFiles.length !== 11) {
  throw new Error(`Expected 11 packaged Babylon codec files, found ${codecFiles.length}.`);
}

const payloadFiles = [
  ...jsChunks.map(name => ({
    category: 'runtime-js',
    name: `assets/${name}`,
    path: resolve(assetsDir, name),
  })),
  ...codecFiles.map(path => ({
    category: 'codec',
    name: relative(distDir, path).replaceAll('\\', '/'),
    path,
  })),
];

const browserPayload = payloadFiles.map(file => {
  const source = readFileSync(file.path);
  return {
    category: file.category,
    name: file.name,
    bytes: source.length,
    gzipBytes: gzipSync(source, { level: 9 }).length,
  };
});

const python = [
  'import json,sys,zipfile',
  'apk=sys.argv[1]',
  'wanted=set(sys.argv[2:])',
  'with zipfile.ZipFile(apk) as z:',
  '  infos=z.infolist()',
  '  rows=[]',
  '  for i in infos:',
  '    normalized=i.filename[len("assets/public/"):] if i.filename.startswith("assets/public/") else i.filename',
  '    if normalized in wanted:',
  '      rows.append({"name":i.filename,"normalized":normalized,"bytes":i.file_size,"compressedBytes":i.compress_size,"method":i.compress_type})',
  '  result={"rows":rows,"totalCompressedPayloadBytes":sum(i.compress_size for i in infos),"totalUncompressedBytes":sum(i.file_size for i in infos)}',
  'print(json.dumps(result))',
].join('\n');
const apkPayload = JSON.parse(execFileSync(
  'python3',
  ['-c', python, apkPath, ...payloadFiles.map(file => file.name)],
  { encoding: 'utf8' },
));
if (apkPayload.rows.length !== payloadFiles.length) {
  const found = new Set(apkPayload.rows.map(entry => entry.normalized));
  const missing = payloadFiles.map(file => file.name).filter(name => !found.has(name));
  throw new Error(`Expected ${payloadFiles.length} Babylon APK payload entries, found ${apkPayload.rows.length}; missing: ${missing.join(',')}`);
}

const browserRawBytes = browserPayload.reduce((sum, file) => sum + file.bytes, 0);
const browserGzipBytes = browserPayload.reduce((sum, file) => sum + file.gzipBytes, 0);
const apkCompressedBytes = apkPayload.rows.reduce((sum, entry) => sum + entry.compressedBytes, 0);
const apkUncompressedBytes = apkPayload.rows.reduce((sum, entry) => sum + entry.bytes, 0);
const apkBytes = statSync(apkPath).size;
const totalDeltaVsP21Bytes = apkBytes - p21Baseline.apkBytes;
const report = {
  schema: 'p27-d2-babylon-delivery-v1',
  capturedAt: new Date().toISOString(),
  interpretation: 'Babylon runtime JS plus its packaged local codecs are measured as the Babylon-specific shipped payload. P21-F3 is retained as the pre-Babylon APK and lazy-WebGPU delivery baseline.',
  baseline: p21Baseline,
  browser: {
    files: browserPayload,
    rawBabylonBytes: browserRawBytes,
    gzipBabylonBytes: browserGzipBytes,
  },
  androidApk: {
    file: basename(apkPath),
    totalBytes: apkBytes,
    totalCompressedPayloadBytes: apkPayload.totalCompressedPayloadBytes,
    totalUncompressedBytes: apkPayload.totalUncompressedBytes,
    babylonEntries: apkPayload.rows,
    babylonCompressedBytes: apkCompressedBytes,
    babylonUncompressedBytes: apkUncompressedBytes,
    babylonCompressedPercentOfApk: Number(((apkCompressedBytes / apkBytes) * 100).toFixed(3)),
    totalBytesDeltaVsP21: totalDeltaVsP21Bytes,
    totalBytesPercentDeltaVsP21: Number(((totalDeltaVsP21Bytes / p21Baseline.apkBytes) * 100).toFixed(3)),
    babylonCompressedDeltaVsP21WebgpuQa: apkCompressedBytes - p21Baseline.webgpuIncrementalCompressedBytes,
    babylonUncompressedDeltaVsP21WebgpuQa: apkUncompressedBytes - p21Baseline.webgpuIncrementalUncompressedBytes,
  },
};
writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(
  `P27D2_BABYLON_DELIVERY_PASS chunks=${jsChunks.join(',')} codecs=${codecFiles.length} ` +
  `browserRawBytes=${browserRawBytes} browserGzipBytes=${browserGzipBytes} ` +
  `apkCompressedBytes=${apkCompressedBytes} apkUncompressedBytes=${apkUncompressedBytes} apkBytes=${apkBytes} ` +
  `p21ApkBytes=${p21Baseline.apkBytes} totalDeltaVsP21=${totalDeltaVsP21Bytes} report=${basename(reportPath)}`,
);
