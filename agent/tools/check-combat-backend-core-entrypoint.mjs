import { readFile, readdir, realpath } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const BOUNDARY_ID = 'combat-backend-core-entrypoint';
const SOURCE_ROOT = 'src';
const CORE_FILE = 'src/game/combatGraphicsBackendCore.ts';
const ALLOWED_IMPORTER = 'src/game/combatGraphicsBackend.ts';
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const MODULE_EXTENSIONS = ['.d.mts', '.d.cts', '.d.ts', '.tsx', '.mts', '.cts', '.mjs', '.cjs', '.jsx', '.ts', '.js'];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function slash(value) {
  return value.split(sep).join('/');
}

function scriptKind(fileName) {
  switch (extname(fileName).toLowerCase()) {
    case '.tsx': return ts.ScriptKind.TSX;
    case '.jsx': return ts.ScriptKind.JSX;
    case '.js':
    case '.mjs':
    case '.cjs': return ts.ScriptKind.JS;
    default: return ts.ScriptKind.TS;
  }
}

function parse(source, fileName) {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKind(fileName));
  invariant((sourceFile.parseDiagnostics ?? []).length === 0, `${BOUNDARY_ID}: could not parse ${fileName}`);
  return sourceFile;
}

function literalModule(node) {
  return node && ts.isStringLiteralLike(node) ? node.text : null;
}

function importTypeModule(node) {
  return node.argument && ts.isLiteralTypeNode(node.argument) ? literalModule(node.argument.literal) : null;
}

function importMetaMember(expression) {
  if (
    ts.isPropertyAccessExpression(expression)
    && ts.isMetaProperty(expression.expression)
    && expression.expression.keywordToken === ts.SyntaxKind.ImportKeyword
    && expression.expression.name.text === 'meta'
  ) return expression.name.text;
  if (
    ts.isElementAccessExpression(expression)
    && ts.isMetaProperty(expression.expression)
    && expression.expression.keywordToken === ts.SyntaxKind.ImportKeyword
    && expression.expression.name.text === 'meta'
    && expression.argumentExpression
    && ts.isStringLiteralLike(expression.argumentExpression)
  ) return expression.argumentExpression.text;
  return null;
}

function isImportMetaGlob(node) {
  if (!ts.isCallExpression(node)) return false;
  const member = importMetaMember(node.expression);
  return member === 'glob' || member === 'globEager';
}

async function listSourceFiles(root, directory = SOURCE_ROOT) {
  const entries = await readdir(resolve(root, directory), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fileName = slash(`${directory}/${entry.name}`);
    if (entry.isDirectory()) files.push(...await listSourceFiles(root, fileName));
    else if ((entry.isFile() || entry.isSymbolicLink()) && SOURCE_EXTENSIONS.has(extname(entry.name).toLowerCase())) files.push(fileName);
  }
  return files.sort();
}

function moduleCandidates(specifier, importerFile, root) {
  let absolute;
  if (specifier.startsWith('.')) absolute = resolve(root, dirname(importerFile), specifier);
  else if (specifier.startsWith('/src/')) absolute = resolve(root, `.${specifier}`);
  else return [];

  if (MODULE_EXTENSIONS.some(extension => absolute.endsWith(extension))) return [absolute];
  return [
    absolute,
    ...MODULE_EXTENSIONS.map(extension => `${absolute}${extension}`),
    ...MODULE_EXTENSIONS.map(extension => resolve(absolute, `index${extension}`)),
  ];
}

async function resolveLocalModule(specifier, importerFile, root) {
  for (const candidate of moduleCandidates(specifier, importerFile, root)) {
    try {
      return await realpath(candidate);
    } catch (error) {
      if (error && typeof error === 'object' && ['ENOENT', 'ENOTDIR'].includes(error.code)) continue;
      throw error;
    }
  }
  return null;
}

function collectModuleLoads(sourceFile, fileName) {
  const loads = [];
  function add(specifier, kind) {
    if (specifier !== null) loads.push({ specifier, kind });
  }
  function rejectUnprovable(kind) {
    throw new Error(`${BOUNDARY_ID}: ${fileName}: ${kind} cannot prove the raw graphics core remains behind the snapshot boundary`);
  }
  function visit(node) {
    if (isImportMetaGlob(node)) rejectUnprovable('import.meta.glob');
    if (ts.isImportDeclaration(node)) {
      add(literalModule(node.moduleSpecifier), node.importClause?.isTypeOnly ? 'type import' : 'import');
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      add(literalModule(node.moduleSpecifier), node.isTypeOnly ? 'type re-export' : 're-export');
    } else if (ts.isImportTypeNode(node)) {
      const specifier = importTypeModule(node);
      invariant(specifier !== null, `${BOUNDARY_ID}: ${fileName}: non-literal import type cannot prove the raw graphics core boundary`);
      add(specifier, 'import type');
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      const specifier = literalModule(node.moduleReference.expression);
      invariant(specifier !== null, `${BOUNDARY_ID}: ${fileName}: non-literal import-equals cannot prove the raw graphics core boundary`);
      add(specifier, 'import-equals');
    } else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const specifier = literalModule(node.arguments[0]);
        if (specifier === null) rejectUnprovable('non-literal dynamic import');
        add(specifier, 'dynamic import');
      } else if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
        const specifier = literalModule(node.arguments[0]);
        if (specifier === null) rejectUnprovable('non-literal require()');
        add(specifier, 'require()');
      } else if (ts.isIdentifier(node.expression) && ['eval', 'Function'].includes(node.expression.text)) {
        rejectUnprovable(`${node.expression.text}()`);
      }
    } else if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Function') {
      rejectUnprovable('new Function()');
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return loads;
}

export async function checkCombatBackendCoreEntrypoint({ root = process.cwd() } = {}) {
  const coreRealPath = await realpath(resolve(root, CORE_FILE));
  const files = await listSourceFiles(root);
  let approvedEdges = 0;

  for (const fileName of files) {
    const source = await readFile(resolve(root, fileName), 'utf8');
    const sourceFile = parse(source, fileName);
    for (const { specifier, kind } of collectModuleLoads(sourceFile, fileName)) {
      const target = await resolveLocalModule(specifier, fileName, root);
      if (target !== coreRealPath) continue;
      if (fileName === ALLOWED_IMPORTER) {
        approvedEdges += 1;
        continue;
      }
      throw new Error(
        `${BOUNDARY_ID}: ${fileName}: ${kind} resolves to ${CORE_FILE}; import ${ALLOWED_IMPORTER} instead`,
      );
    }
  }

  invariant(approvedEdges > 0, `${BOUNDARY_ID}: ${ALLOWED_IMPORTER} no longer consumes ${CORE_FILE}`);
  return { checked: files.length, core: CORE_FILE, allowedImporter: ALLOWED_IMPORTER };
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
