import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertString(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`);
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort((a, b) => a.localeCompare(b)).map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256Buffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function normalizePath(path) {
  return path.split(sep).join('/');
}

async function listFiles(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = resolve(current, entry.name);
    const stats = await lstat(absolute);
    assert(!stats.isSymbolicLink(), `candidate artifact cannot contain symbolic link ${normalizePath(relative(root, absolute))}`);
    if (stats.isDirectory()) {
      files.push(...await listFiles(root, absolute));
    } else if (stats.isFile()) {
      files.push(absolute);
    } else {
      throw new Error(`candidate artifact contains unsupported entry ${normalizePath(relative(root, absolute))}`);
    }
  }
  return files;
}

export async function inspectArtifactTree(rootPath) {
  const root = resolve(rootPath);
  const rootStats = await lstat(root).catch(() => null);
  assert(rootStats?.isDirectory(), `candidate artifact root does not exist or is not a directory: ${rootPath}`);

  const absoluteFiles = await listFiles(root);
  assert(absoluteFiles.length > 0, 'candidate artifact root must contain at least one file');

  const files = [];
  let totalBytes = 0;
  for (const absolute of absoluteFiles) {
    const data = await readFile(absolute);
    const path = normalizePath(relative(root, absolute));
    totalBytes += data.byteLength;
    files.push({
      path,
      bytes: data.byteLength,
      sha256: sha256Buffer(data),
    });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));

  const treeSha256 = sha256Buffer(Buffer.from(canonicalJson(files)));
  return {
    fileCount: files.length,
    totalBytes,
    treeSha256,
    files,
  };
}

export async function buildCandidateArtifactManifest({ candidateSha, artifactRoot, buildCommand = 'npm run build' }) {
  assert(SHA_PATTERN.test(candidateSha), 'candidateSha must be a full lowercase 40-character commit SHA');
  assertString(buildCommand, 'buildCommand');
  const tree = await inspectArtifactTree(artifactRoot);
  return {
    schemaVersion: 1,
    candidateSha,
    artifactRoot: normalizePath(artifactRoot),
    buildCommand,
    fileCount: tree.fileCount,
    totalBytes: tree.totalBytes,
    treeSha256: tree.treeSha256,
    files: tree.files,
  };
}

export function validateCandidateArtifactManifestShape(manifest) {
  assert(manifest && typeof manifest === 'object' && !Array.isArray(manifest), 'candidate artifact manifest must be an object');
  assert(manifest.schemaVersion === 1, 'candidate artifact manifest schemaVersion must be 1');
  assert(SHA_PATTERN.test(manifest.candidateSha), 'candidate artifact manifest candidateSha must be a full lowercase SHA');
  assertString(manifest.artifactRoot, 'candidate artifact manifest artifactRoot');
  assertString(manifest.buildCommand, 'candidate artifact manifest buildCommand');
  assert(Number.isInteger(manifest.fileCount) && manifest.fileCount > 0, 'candidate artifact manifest fileCount must be a positive integer');
  assert(Number.isInteger(manifest.totalBytes) && manifest.totalBytes >= 0, 'candidate artifact manifest totalBytes must be a non-negative integer');
  assert(SHA256_PATTERN.test(manifest.treeSha256), 'candidate artifact manifest treeSha256 must be SHA-256');
  assert(Array.isArray(manifest.files) && manifest.files.length === manifest.fileCount, 'candidate artifact manifest files must match fileCount');

  const paths = new Set();
  let bytes = 0;
  let previousPath = null;
  for (const file of manifest.files) {
    assert(file && typeof file === 'object' && !Array.isArray(file), 'candidate artifact file entry must be an object');
    assertString(file.path, 'candidate artifact file path');
    assert(!file.path.startsWith('/') && !file.path.includes('..'), `candidate artifact file path must be relative: ${file.path}`);
    assert(!paths.has(file.path), `duplicate candidate artifact file path ${file.path}`);
    paths.add(file.path);
    if (previousPath !== null) assert(previousPath.localeCompare(file.path) < 0, 'candidate artifact files must be strictly sorted by path');
    previousPath = file.path;
    assert(Number.isInteger(file.bytes) && file.bytes >= 0, `candidate artifact file ${file.path} bytes must be non-negative integer`);
    assert(SHA256_PATTERN.test(file.sha256), `candidate artifact file ${file.path} sha256 must be SHA-256`);
    bytes += file.bytes;
  }
  assert(bytes === manifest.totalBytes, 'candidate artifact manifest totalBytes does not match file entries');
  const expectedTreeSha256 = sha256Buffer(Buffer.from(canonicalJson(manifest.files)));
  assert(expectedTreeSha256 === manifest.treeSha256, 'candidate artifact manifest treeSha256 does not match file entries');
  return manifest;
}

export async function validateCandidateArtifact({ manifest, artifactRoot, expectedCandidateSha }) {
  validateCandidateArtifactManifestShape(manifest);
  assert(SHA_PATTERN.test(expectedCandidateSha), 'expected candidate SHA must be a full lowercase 40-character commit SHA');
  assert(manifest.candidateSha === expectedCandidateSha, `candidate artifact belongs to ${manifest.candidateSha}, expected ${expectedCandidateSha}`);

  const actual = await inspectArtifactTree(artifactRoot);
  assert(actual.fileCount === manifest.fileCount, `candidate artifact file count changed: expected ${manifest.fileCount}, got ${actual.fileCount}`);
  assert(actual.totalBytes === manifest.totalBytes, `candidate artifact byte count changed: expected ${manifest.totalBytes}, got ${actual.totalBytes}`);
  assert(actual.treeSha256 === manifest.treeSha256, `candidate artifact tree digest changed: expected ${manifest.treeSha256}, got ${actual.treeSha256}`);
  assert(canonicalJson(actual.files) === canonicalJson(manifest.files), 'candidate artifact file inventory changed');

  return {
    candidateSha: manifest.candidateSha,
    fileCount: actual.fileCount,
    totalBytes: actual.totalBytes,
    treeSha256: actual.treeSha256,
  };
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) throw new Error(`unexpected argument ${arg}`);
    const key = arg.slice(2);
    const value = args[index + 1];
    assert(value !== undefined && !value.startsWith('--'), `${arg} requires a value`);
    options[key] = value;
    index += 1;
  }
  return options;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const options = parseArgs(rest);
  if (command === 'create') {
    assertString(options.candidate, '--candidate');
    assertString(options.root, '--root');
    assertString(options.output, '--output');
    const manifest = await buildCandidateArtifactManifest({
      candidateSha: options.candidate,
      artifactRoot: options.root,
      buildCommand: options['build-command'] ?? 'npm run build',
    });
    await mkdir(dirname(resolve(options.output)), { recursive: true });
    await writeFile(resolve(options.output), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`CANDIDATE_ARTIFACT_CREATED candidate=${manifest.candidateSha} files=${manifest.fileCount} bytes=${manifest.totalBytes} treeSha256=${manifest.treeSha256}`);
    return;
  }

  if (command === 'validate') {
    assertString(options.candidate, '--candidate');
    assertString(options.root, '--root');
    assertString(options.manifest, '--manifest');
    const manifest = JSON.parse(await readFile(resolve(options.manifest), 'utf8'));
    const summary = await validateCandidateArtifact({
      manifest,
      artifactRoot: options.root,
      expectedCandidateSha: options.candidate,
    });
    console.log(`CANDIDATE_ARTIFACT_VALID candidate=${summary.candidateSha} files=${summary.fileCount} bytes=${summary.totalBytes} treeSha256=${summary.treeSha256}`);
    return;
  }

  throw new Error('usage: candidate-artifact.mjs <create|validate> --candidate <sha> --root <dir> --manifest/--output <file>');
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main().catch(error => {
    console.error(`CANDIDATE_ARTIFACT_INVALID ${error.message}`);
    process.exitCode = 1;
  });
}
