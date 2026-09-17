import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const threePackagePath = resolve(root, 'node_modules/three/package.json');
const sourceDir = resolve(root, 'node_modules/three/examples/jsm/libs/basis');
const targetDir = resolve(root, 'public/assets/codecs/basis');
const codecFiles = ['basis_transcoder.js', 'basis_transcoder.wasm'];

const threePackage = JSON.parse(await readFile(threePackagePath, 'utf8'));
await rm(targetDir, { recursive: true, force: true });
await mkdir(targetDir, { recursive: true });

const files = [];
for (const name of codecFiles) {
  const source = resolve(sourceDir, name);
  const destination = resolve(targetDir, name);
  const sourceStat = await stat(source);
  if (!sourceStat.isFile() || sourceStat.size <= 0) throw new Error(`Missing Three.js Basis transcoder asset: ${source}`);
  await copyFile(source, destination);
  files.push({ name, bytes: sourceStat.size });
}

const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
const manifest = {
  threeVersion: threePackage.version,
  codec: 'basis-universal',
  generated: true,
  files,
  totalBytes,
};
await writeFile(resolve(targetDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`GRAPHICS_CODECS_READY three=${threePackage.version} files=${files.length} bytes=${totalBytes}`);
