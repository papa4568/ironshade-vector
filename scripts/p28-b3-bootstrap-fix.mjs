import { readFile, writeFile, unlink } from 'node:fs/promises';

const path = 'scripts/p28-b3-bootstrap.mjs';
let source = await readFile(path, 'utf8');
const before = "            const bumper = MeshBuilder.CreateBox(`p28-b3-cover-polymer-\\${side > 0 ? 'front' : 'back'}-\\${object.id}`, {";
const after = "            const bumper = MeshBuilder.CreateBox('p28-b3-cover-polymer-' + (side > 0 ? 'front' : 'back') + '-' + object.id, {";
if (!source.includes(before)) throw new Error('Expected nested bumper template literal was not found');
source = source.replace(before, after);
await writeFile(path, source);
await unlink('scripts/p28-b3-bootstrap-fix.mjs');
console.log('P28_B3_BOOTSTRAP_QUOTING_FIXED');
