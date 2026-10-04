import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const distRoot = resolve(root, 'dist');
const assetsDir = resolve(distRoot, 'assets');
const apkPath = resolve(root, process.env.P27D9_APK_PATH ?? 'Ironshade-Vector-Android-Debug.apk');
const reportPath = resolve(root, process.env.P27D9_REPORT_PATH ?? 'p27d9-no-three-delivery.json');
const retiredCodecDir = resolve(distRoot, 'assets/codecs/basis');
const babylonCodecManifest = resolve(distRoot, 'assets/codecs/babylon/manifest.json');

const FORBIDDEN_THREE_PATTERNS = [
  'node_modules/three',
  'three/examples/jsm',
  'three/webgpu',
  'three/tsl',
  'three.module.js',
  'three.core.js',
  'webGpuRefineryRenderer',
];
const forbiddenChunkPrefixes = [
  'three-core-',
  'three-webgl-',
  'three.webgpu-',
  'three.tsl-',
  'webGpuRefineryRenderer-',
];

function collectJsFiles(directory) {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...collectJsFiles(path));
    else if (entry.isFile() && entry.name.endsWith('.js')) result.push(path);
  }
  return result.sort();
}

if (!existsSync(assetsDir)) throw new Error(`dist assets are missing: ${assetsDir}`);
if (existsSync(retiredCodecDir)) throw new Error('Retired Three Basis codec directory is still present in dist/assets/codecs/basis');
if (!existsSync(babylonCodecManifest)) throw new Error('Babylon codec manifest is missing from dist/assets/codecs/babylon');

const browserJs = collectJsFiles(assetsDir);
const browserViolations = [];
for (const path of browserJs) {
  const name = basename(path);
  const source = readFileSync(path, 'utf8');
  if (forbiddenChunkPrefixes.some(prefix => name.startsWith(prefix))) {
    browserViolations.push({ file: name, marker: 'retired-chunk-name' });
  }
  for (const marker of FORBIDDEN_THREE_PATTERNS) {
    if (source.includes(marker)) browserViolations.push({ file: name, marker });
  }
}
if (browserViolations.length > 0) {
  throw new Error(`Three runtime evidence is still shipped in browser assets: ${JSON.stringify(browserViolations)}`);
}

if (!existsSync(apkPath)) throw new Error(`APK is missing: ${apkPath}`);
const python = [
  'import json,sys,zipfile',
  'apk=sys.argv[1]',
  'markers=json.loads(sys.argv[2])',
  'prefixes=json.loads(sys.argv[3])',
  'violations=[]',
  'with zipfile.ZipFile(apk) as z:',
  '  names=z.namelist()',
  '  for name in names:',
  '    base=name.rsplit("/",1)[-1]',
  '    if "assets/public/assets/codecs/basis/" in name:',
  '      violations.append({"file":name,"marker":"retired-codec-directory"})',
  '    if any(base.startswith(prefix) for prefix in prefixes):',
  '      violations.append({"file":name,"marker":"retired-chunk-name"})',
  '    if name.endswith(".js") and name.startswith("assets/public/"):',
  '      data=z.read(name).decode("utf-8", "ignore")',
  '      for marker in markers:',
  '        if marker in data:',
  '          violations.append({"file":name,"marker":marker})',
  'print(json.dumps({"violations":violations,"entries":len(names)}))',
].join('\n');
const apkScan = JSON.parse(execFileSync('python3', [
  '-c',
  python,
  apkPath,
  JSON.stringify(FORBIDDEN_THREE_PATTERNS),
  JSON.stringify(forbiddenChunkPrefixes),
], { encoding: 'utf8' }));
if (apkScan.violations.length > 0) {
  throw new Error(`Three runtime evidence is still shipped in APK assets: ${JSON.stringify(apkScan.violations)}`);
}

const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const packageLock = readFileSync(resolve(root, 'package-lock.json'), 'utf8');
if (packageJson.dependencies?.three || packageJson.devDependencies?.three || packageJson.devDependencies?.['@types/three']) {
  throw new Error('Three remains declared in package.json');
}
if (packageLock.includes('node_modules/three') || packageLock.includes('node_modules/@types/three')) {
  throw new Error('Three remains installed in package-lock.json');
}

const report = {
  schema: 'p27-d9-no-three-delivery-v1',
  capturedAt: new Date().toISOString(),
  pass: true,
  browser: {
    jsFilesScanned: browserJs.length,
    violations: browserViolations,
    retiredBasisCodecPresent: false,
    babylonCodecManifestPresent: true,
  },
  androidApk: {
    file: basename(apkPath),
    totalBytes: statSync(apkPath).size,
    entriesScanned: apkScan.entries,
    violations: apkScan.violations,
  },
};
writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`P27D9_NO_THREE_DELIVERY_PASS browserJs=${browserJs.length} apkEntries=${apkScan.entries} apkBytes=${report.androidApk.totalBytes} threeChunks=0 basisCodecs=0 report=${basename(reportPath)}`);
