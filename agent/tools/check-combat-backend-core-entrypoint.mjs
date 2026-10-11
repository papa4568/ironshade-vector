import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
const CORE_FILE = 'src/game/combatGraphicsBackendCore.ts';
const ALLOWED_IMPORTER = 'src/game/combatGraphicsBackend.ts';
const CORE_TOKEN = 'combatGraphicsBackendCore';

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function slash(value) {
  return value.replace(/\\/g, '/');
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error && typeof error === 'object' && ['ENOENT', 'ENOTDIR'].includes(error.code)) return false;
    throw error;
  }
}

async function listSourceFiles(directory, root, output = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await listSourceFiles(fullPath, root, output);
      continue;
    }
    if (!entry.isFile() || !SOURCE_EXTENSIONS.has(extname(entry.name))) continue;
    output.push(slash(relative(root, fullPath)));
  }
  return output;
}

function literalModuleSpecifiers(source) {
  const specifiers = new Set();
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+(?:type\s+)?(?:\*(?:\s+as\s+[A-Za-z_$][\w$]*)?|\{[\s\S]*?\})\s+from\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.add(match[1]);
  }
  return [...specifiers];
}

async function resolveLocalModule(specifier, importerFile, root) {
  if (!specifier.startsWith('.')) return null;
  const importerDir = dirname(resolve(root, importerFile));
  const base = resolve(importerDir, specifier);
  const candidates = [base];
  if (!RESOLVE_EXTENSIONS.some(extension => base.endsWith(extension))) {
    for (const extension of RESOLVE_EXTENSIONS) candidates.push(`${base}${extension}`);
    for (const extension of RESOLVE_EXTENSIONS) candidates.push(resolve(base, `index${extension}`));
  }
  for (const candidate of candidates) {
    if (await exists(candidate)) return realpath(candidate);
  }
  return null;
}

export async function checkCombatBackendCoreEntrypoint({ root = process.cwd() } = {}) {
  const sourceRoot = resolve(root, 'src');
  const coreRealPath = await realpath(resolve(root, CORE_FILE));
  const files = await listSourceFiles(sourceRoot, root);
  let checked = 0;

  for (const file of files) {
    if (file === CORE_FILE || file === ALLOWED_IMPORTER) continue;
    const source = await readFile(resolve(root, file), 'utf8');
    checked += 1;

    invariant(
      !source.includes(CORE_TOKEN),
      `${file}: direct reference to ${CORE_TOKEN} is forbidden; import ${ALLOWED_IMPORTER} instead`,
    );

    for (const specifier of literalModuleSpecifiers(source)) {
      const resolved = await resolveLocalModule(specifier, file, root);
      invariant(
        resolved !== coreRealPath,
        `${file}: module dependency ${specifier} resolves to ${CORE_FILE}; import ${ALLOWED_IMPORTER} instead`,
      );
    }
  }

  return { checked, core: CORE_FILE, allowedImporter: ALLOWED_IMPORTER };
}

async function main() {
  const result = await checkCombatBackendCoreEntrypoint();
  console.log(`COMBAT_BACKEND_CORE_ENTRYPOINT_PASS checked=${result.checked} core=${result.core} allowed=${result.allowedImporter}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
