import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const assetsDir = resolve(root, 'dist/assets');
const apkPath = resolve(root, process.env.P21F3_APK_PATH ?? 'Ironshade-Vector-Android-Beta.apk');
const reportPath = resolve(root, process.env.P21F3_REPORT_PATH ?? 'p21f3-webgpu-delivery.json');
const prefixes = ['three.webgpu-', 'three.tsl-', 'webGpuRefineryRenderer-'];

const chunks = readdirSync(assetsDir)
  .filter(name => name.endsWith('.js') && prefixes.some(prefix => name.startsWith(prefix)))
  .sort();
if (chunks.length !== prefixes.length) {
  throw new Error(`Expected ${prefixes.length} WebGPU QA chunks, found ${chunks.length}: ${chunks.join(',')}`);
}

const browserChunks = chunks.map(name => {
  const path = resolve(assetsDir, name);
  const source = readFileSync(path);
  return { name, bytes: source.length, gzipBytes: gzipSync(source, { level: 9 }).length };
});

const python = [
  'import json,sys,zipfile',
  'apk=sys.argv[1]',
  'names=set(sys.argv[2:])',
  'with zipfile.ZipFile(apk) as z:',
  '  rows=[{"name":i.filename,"basename":i.filename.rsplit("/",1)[-1],"bytes":i.file_size,"compressedBytes":i.compress_size,"method":i.compress_type} for i in z.infolist() if i.filename.rsplit("/",1)[-1] in names]',
  'print(json.dumps(rows))',
].join('\n');
const apkEntries = JSON.parse(execFileSync('python3', ['-c', python, apkPath, ...chunks], { encoding: 'utf8' }));
if (apkEntries.length !== chunks.length) {
  throw new Error(`Expected ${chunks.length} WebGPU QA APK entries, found ${apkEntries.length}: ${apkEntries.map(entry => entry.name).join(',')}`);
}

const browserBytes = browserChunks.reduce((sum, chunk) => sum + chunk.bytes, 0);
const browserGzipBytes = browserChunks.reduce((sum, chunk) => sum + chunk.gzipBytes, 0);
const apkCompressedBytes = apkEntries.reduce((sum, entry) => sum + entry.compressedBytes, 0);
const apkUncompressedBytes = apkEntries.reduce((sum, entry) => sum + entry.bytes, 0);
const apkBytes = statSync(apkPath).size;
const report = {
  schema: 'p21-f3-webgpu-delivery-v1',
  capturedAt: new Date().toISOString(),
  interpretation: 'The three QA-only lazy WebGPU/TSL chunks are the incremental shipped delivery cost while production WebGL2 remains the default path.',
  browser: {
    chunks: browserChunks,
    rawIncrementalBytes: browserBytes,
    gzipIncrementalBytes: browserGzipBytes,
  },
  androidApk: {
    file: basename(apkPath),
    totalBytes: apkBytes,
    webgpuEntries: apkEntries,
    incrementalCompressedBytes: apkCompressedBytes,
    incrementalUncompressedBytes: apkUncompressedBytes,
    compressedPercentOfApk: Number(((apkCompressedBytes / apkBytes) * 100).toFixed(3)),
  },
};
writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(
  `P21F3_WEBGPU_DELIVERY_PASS chunks=${chunks.join(',')} browserRawBytes=${browserBytes} browserGzipBytes=${browserGzipBytes} apkCompressedBytes=${apkCompressedBytes} apkUncompressedBytes=${apkUncompressedBytes} apkBytes=${apkBytes} apkPercent=${report.androidApk.compressedPercentOfApk} report=${basename(reportPath)}`,
);
