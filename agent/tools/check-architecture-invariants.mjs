import { readFile } from 'node:fs/promises';
import { extname, posix, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const MODULE_EXTENSIONS = ['.d.ts', '.tsx', '.mts', '.cts', '.mjs', '.cjs', '.jsx', '.ts', '.js'];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertString(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`);
}

function assertStringArray(value, label) {
  assert(Array.isArray(value), `${label} must be an array`);
  value.forEach((entry, index) => assertString(entry, `${label}[${index}]`));
  assert(new Set(value).size === value.length, `${label} must not contain duplicates`);
}

export function validateArchitectureInvariantConfig(config) {
  assert(config && typeof config === 'object' && !Array.isArray(config), 'architecture invariant config must be an object');
  assert(config.schemaVersion === 1, 'architecture invariant schemaVersion must be 1');
  assert(Array.isArray(config.rules) && config.rules.length > 0, 'architecture invariant config must contain rules');
  const ids = new Set();
  for (const rule of config.rules) {
    assert(rule && typeof rule === 'object' && !Array.isArray(rule), 'architecture invariant rule must be an object');
    assertString(rule.id, 'rule.id');
    assert(!ids.has(rule.id), `duplicate architecture invariant id ${rule.id}`);
    ids.add(rule.id);
    assertString(rule.description, `rule ${rule.id}.description`);
    assertString(rule.file, `rule ${rule.id}.file`);
    assert(['sourceContract', 'namedImportAllowlist', 'moduleDependencyDenylist'].includes(rule.type), `rule ${rule.id} has unsupported type ${rule.type}`);
    if (rule.type === 'sourceContract') {
      assertStringArray(rule.required ?? [], `rule ${rule.id}.required`);
      assertStringArray(rule.forbidden ?? [], `rule ${rule.id}.forbidden`);
      assert((rule.required?.length ?? 0) + (rule.forbidden?.length ?? 0) > 0, `rule ${rule.id} must require or forbid at least one literal`);
    }
    if (rule.type === 'namedImportAllowlist') {
      assertString(rule.module, `rule ${rule.id}.module`);
      assertStringArray(rule.allowedValueImports ?? [], `rule ${rule.id}.allowedValueImports`);
      assertStringArray(rule.allowedTypeImports ?? [], `rule ${rule.id}.allowedTypeImports`);
      assert(typeof rule.requireExact === 'boolean', `rule ${rule.id}.requireExact must be boolean`);
    }
    if (rule.type === 'moduleDependencyDenylist') {
      assertStringArray(rule.modules ?? [], `rule ${rule.id}.modules`);
      assert((rule.modules?.length ?? 0) > 0, `rule ${rule.id}.modules must contain at least one module`);
    }
  }
  return config;
}

function scriptKindFor(fileName) {
  switch (extname(fileName).toLowerCase()) {
    case '.tsx': return ts.ScriptKind.TSX;
    case '.jsx': return ts.ScriptKind.JSX;
    case '.js':
    case '.mjs':
    case '.cjs': return ts.ScriptKind.JS;
    default: return ts.ScriptKind.TS;
  }
}

function staticModuleName(node) {
  return node && ts.isStringLiteralLike(node) ? node.text : null;
}

function importTypeModuleName(node) {
  const argument = node?.argument;
  return argument && ts.isLiteralTypeNode(argument) ? staticModuleName(argument.literal) : null;
}

function canonicalModuleSpecifier(specifier) {
  let normalized = specifier.replace(/\\/g, '/');
  if (normalized.startsWith('.')) normalized = posix.normalize(normalized);
  const extension = MODULE_EXTENSIONS.find(candidate => normalized.endsWith(candidate));
  return extension ? normalized.slice(0, -extension.length) : normalized;
}

function moduleSpecifierMatches(candidate, configured) {
  return candidate !== null && canonicalModuleSpecifier(candidate) === canonicalModuleSpecifier(configured);
}

function matchingForbiddenModule(candidate, modules) {
  return candidate === null ? null : modules.find(moduleName => moduleSpecifierMatches(candidate, moduleName)) ?? null;
}

function parseSourceFile(source, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(fileName),
  );
  assert((sourceFile.parseDiagnostics ?? []).length === 0, `could not parse ${fileName} for architecture invariants`);
  return sourceFile;
}

function assertNoAlternateModuleLoading(sourceFile, moduleName) {
  function visit(node) {
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const loadedModule = staticModuleName(node.arguments[0]);
        assert(!moduleSpecifierMatches(loadedModule, moduleName), `dynamic import from ${moduleName} is not allowed by named-import architecture rules`);
        assert(loadedModule !== null, `non-literal dynamic import cannot prove the ${moduleName} named-import boundary`);
      }
      if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
        const loadedModule = staticModuleName(node.arguments[0]);
        assert(!moduleSpecifierMatches(loadedModule, moduleName), `require() from ${moduleName} is not allowed by named-import architecture rules`);
        assert(loadedModule !== null, `non-literal require() cannot prove the ${moduleName} named-import boundary`);
      }
    }
    if (ts.isImportTypeNode(node)) {
      const loadedModule = importTypeModuleName(node);
      assert(!moduleSpecifierMatches(loadedModule, moduleName), `import type from ${moduleName} is not allowed by named-import architecture rules`);
      assert(loadedModule !== null, `non-literal import type cannot prove the ${moduleName} named-import boundary`);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

function parseNamedImports(source, moduleName, fileName) {
  const sourceFile = parseSourceFile(source, fileName);
  assertNoAlternateModuleLoading(sourceFile, moduleName);

  const imports = [];
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      if (!moduleSpecifierMatches(staticModuleName(statement.moduleSpecifier), moduleName)) continue;
      const clause = statement.importClause;
      assert(
        clause && !clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings),
        `imports from ${moduleName} must use named imports only`,
      );
      for (const element of clause.namedBindings.elements) {
        const importedName = (element.propertyName ?? element.name).text;
        assertString(importedName, `import from ${moduleName}`);
        imports.push({
          name: importedName,
          typeOnly: Boolean(clause.isTypeOnly || element.isTypeOnly),
        });
      }
      continue;
    }

    if (ts.isImportEqualsDeclaration(statement)) {
      const reference = statement.moduleReference;
      if (ts.isExternalModuleReference(reference) && moduleSpecifierMatches(staticModuleName(reference.expression), moduleName)) {
        throw new Error(`import-equals from ${moduleName} is not allowed by named-import architecture rules`);
      }
      continue;
    }

    if (ts.isExportDeclaration(statement) && moduleSpecifierMatches(staticModuleName(statement.moduleSpecifier), moduleName)) {
      throw new Error(`re-export from ${moduleName} is not allowed by named-import architecture rules`);
    }
  }
  return imports;
}

function assertNoForbiddenModuleDependencies(source, modules, fileName) {
  const sourceFile = parseSourceFile(source, fileName);

  function assertAllowed(loadedModule, kind) {
    const forbiddenModule = matchingForbiddenModule(loadedModule, modules);
    assert(!forbiddenModule, `${fileName}: ${kind} from forbidden module ${forbiddenModule} is not allowed`);
    assert(loadedModule !== null, `${fileName}: non-literal ${kind} cannot prove the module dependency denylist`);
  }

  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const loadedModule = staticModuleName(node.moduleSpecifier);
      if (loadedModule !== null) assertAllowed(loadedModule, ts.isImportDeclaration(node) ? 'import' : 're-export');
    }
    if (ts.isImportEqualsDeclaration(node)) {
      const reference = node.moduleReference;
      if (ts.isExternalModuleReference(reference)) assertAllowed(staticModuleName(reference.expression), 'import-equals');
    }
    if (ts.isImportTypeNode(node)) assertAllowed(importTypeModuleName(node), 'import type');
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) assertAllowed(staticModuleName(node.arguments[0]), 'dynamic import');
      if (ts.isIdentifier(node.expression) && node.expression.text === 'require') assertAllowed(staticModuleName(node.arguments[0]), 'require()');
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

export async function evaluateArchitectureInvariants(config, { root = process.cwd() } = {}) {
  validateArchitectureInvariantConfig(config);
  const results = [];
  for (const rule of config.rules) {
    const source = await readFile(resolve(root, rule.file), 'utf8');
    if (rule.type === 'sourceContract') {
      const missing = (rule.required ?? []).filter(literal => !source.includes(literal));
      const forbiddenPresent = (rule.forbidden ?? []).filter(literal => source.includes(literal));
      assert(missing.length === 0, `${rule.id}: missing required literal(s): ${missing.join(', ')}`);
      assert(forbiddenPresent.length === 0, `${rule.id}: forbidden literal(s) present: ${forbiddenPresent.join(', ')}`);
      results.push({ id: rule.id, status: 'passed', file: rule.file, type: rule.type });
      continue;
    }

    if (rule.type === 'moduleDependencyDenylist') {
      assertNoForbiddenModuleDependencies(source, rule.modules, rule.file);
      results.push({ id: rule.id, status: 'passed', file: rule.file, type: rule.type, modules: rule.modules });
      continue;
    }

    const imports = parseNamedImports(source, rule.module, rule.file);
    assert(imports.length > 0, `${rule.id}: expected an import from ${rule.module}`);
    const values = [...new Set(imports.filter(entry => !entry.typeOnly).map(entry => entry.name))].sort();
    const types = [...new Set(imports.filter(entry => entry.typeOnly).map(entry => entry.name))].sort();
    const allowedValues = [...rule.allowedValueImports].sort();
    const allowedTypes = [...rule.allowedTypeImports].sort();
    const unexpectedValues = values.filter(name => !allowedValues.includes(name));
    const unexpectedTypes = types.filter(name => !allowedTypes.includes(name));
    assert(unexpectedValues.length === 0, `${rule.id}: unexpected value import(s) from ${rule.module}: ${unexpectedValues.join(', ')}`);
    assert(unexpectedTypes.length === 0, `${rule.id}: unexpected type import(s) from ${rule.module}: ${unexpectedTypes.join(', ')}`);
    if (rule.requireExact) {
      assert(JSON.stringify(values) === JSON.stringify(allowedValues), `${rule.id}: value import set drifted; expected ${allowedValues.join(', ') || 'none'}, found ${values.join(', ') || 'none'}`);
      assert(JSON.stringify(types) === JSON.stringify(allowedTypes), `${rule.id}: type import set drifted; expected ${allowedTypes.join(', ') || 'none'}, found ${types.join(', ') || 'none'}`);
    }
    results.push({ id: rule.id, status: 'passed', file: rule.file, type: rule.type, module: rule.module });
  }
  return results;
}

export async function loadArchitectureInvariantConfig(path = 'agent/architecture-invariants.json', { root = process.cwd() } = {}) {
  return validateArchitectureInvariantConfig(JSON.parse(await readFile(resolve(root, path), 'utf8')));
}

async function main() {
  const args = process.argv.slice(2);
  let configPath = 'agent/architecture-invariants.json';
  let json = false;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--config') configPath = args[++index];
    else if (args[index] === '--json') json = true;
    else throw new Error(`unknown argument ${args[index]}`);
  }
  const config = await loadArchitectureInvariantConfig(configPath);
  const results = await evaluateArchitectureInvariants(config);
  if (json) console.log(JSON.stringify({ status: 'passed', count: results.length, results }, null, 2));
  else console.log(`ARCHITECTURE_INVARIANTS_PASS count=${results.length} ids=${results.map(result => result.id).join(',')}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
