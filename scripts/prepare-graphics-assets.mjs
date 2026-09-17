import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), 'public/assets/models');

async function collectSources(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }

  const sources = [];
  for (const entry of entries) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) sources.push(...await collectSources(path));
    else if (entry.isFile() && entry.name.endsWith('.glb.b64')) sources.push(path);
  }
  return sources.sort();
}

function assertValidGlb(buffer, sourcePath) {
  if (buffer.byteLength < 20) throw new Error(`${sourcePath}: decoded GLB is too small`);
  if (buffer.toString('ascii', 0, 4) !== 'glTF') throw new Error(`${sourcePath}: decoded payload has invalid GLB magic`);
  if (buffer.readUInt32LE(4) !== 2) throw new Error(`${sourcePath}: decoded GLB must use version 2`);
  if (buffer.readUInt32LE(8) !== buffer.byteLength) {
    throw new Error(`${sourcePath}: decoded GLB length ${buffer.byteLength} does not match header ${buffer.readUInt32LE(8)}`);
  }
}

const sources = await collectSources(root);
let bytes = 0;
for (const sourcePath of sources) {
  const encoded = (await readFile(sourcePath, 'utf8')).replace(/\s+/g, '');
  const decoded = Buffer.from(encoded, 'base64');
  assertValidGlb(decoded, sourcePath);
  const outputPath = sourcePath.slice(0, -4);
  await writeFile(outputPath, decoded);
  bytes += decoded.byteLength;
}

console.log(`GRAPHICS_ASSET_SOURCES_READY generated=${sources.length} bytes=${bytes}`);
