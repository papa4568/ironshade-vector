import { readFile, realpath } from 'node:fs/promises';
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
      assertStringArray(rule.allowedTransitiveValueImports ?? rule.allowedValueImports ?? [], `rule ${rule.id}.allowedTransitiveValueImports`);
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

function stripModuleExtension(modulePath) {
  const extension = MODULE_EXTENSIONS.find(candidate => modulePath.endsWith(candidate));
  return extension ? modulePath.slice(0, -extension.length) : modulePath;
}

function canonicalModuleSpecifier(specifier, importerFile) {
  let normalized = specifier.replace(/\\/g, '/');
  if (normalized.startsWith('.')) {
    normalized = stripModuleExtension(normalized);
    normalized = posix.normalize(posix.join(posix.dirname(importerFile), normalized));
    return `local:${normalized}`;
  }
  return `external:${normalized}`;
}

function moduleSpecifierMatches(candidate, configured, candidateFile, configuredFile) {
  return candidate !== null
    && canonicalModuleSpecifier(candidate, candidateFile) === canonicalModuleSpecifier(configured, configuredFile);
}

function matchingForbiddenModule(candidate, modules, candidateFile, configuredFile) {
  return candidate === null
    ? null
    : modules.find(moduleName => moduleSpecifierMatches(candidate, moduleName, candidateFile, configuredFile)) ?? null;
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

function assertNoAlternateModuleLoading(sourceFile, moduleName, fileName, configuredFile) {
  function visit(node) {
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const loadedModule = staticModuleName(node.arguments[0]);
        assert(
          !moduleSpecifierMatches(loadedModule, moduleName, fileName, configuredFile),
          `${fileName}: dynamic import from ${moduleName} is not allowed by named-import architecture rules`,
        );
        assert(loadedModule !== null, `${fileName}: non-literal dynamic import cannot prove the ${moduleName} named-import boundary`);
      }
      if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
        const loadedModule = staticModuleName(node.arguments[0]);
        assert(
          !moduleSpecifierMatches(loadedModule, moduleName, fileName, configuredFile),
          `${fileName}: require() from ${moduleName} is not allowed by named-import architecture rules`,
        );
        assert(loadedModule !== null, `${fileName}: non-literal require() cannot prove the ${moduleName} named-import boundary`);
      }
    }
    if (ts.isImportTypeNode(node)) {
      const loadedModule = importTypeModuleName(node);
      assert(
        !moduleSpecifierMatches(loadedModule, moduleName, fileName, configuredFile),
        `${fileName}: import type from ${moduleName} is not allowed by named-import architecture rules`,
      );
      assert(loadedModule !== null, `${fileName}: non-literal import type cannot prove the ${moduleName} named-import boundary`);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

function parseNamedImports(source, moduleName, fileName, configuredFile) {
  const sourceFile = parseSourceFile(source, fileName);
  assertNoAlternateModuleLoading(sourceFile, moduleName, fileName, configuredFile);

  const imports = [];
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      if (!moduleSpecifierMatches(staticModuleName(statement.moduleSpecifier), moduleName, fileName, configuredFile)) continue;
      const clause = statement.importClause;
      assert(
        clause && !clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings),
        `${fileName}: imports from ${moduleName} must use named imports only`,
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
      if (
        ts.isExternalModuleReference(reference)
        && moduleSpecifierMatches(staticModuleName(reference.expression), moduleName, fileName, configuredFile)
      ) {
        throw new Error(`${fileName}: import-equals from ${moduleName} is not allowed by named-import architecture rules`);
      }
      continue;
    }

    if (
      ts.isExportDeclaration(statement)
      && moduleSpecifierMatches(staticModuleName(statement.moduleSpecifier), moduleName, fileName, configuredFile)
    ) {
      throw new Error(`${fileName}: re-export from ${moduleName} is not allowed by named-import architecture rules`);
    }
  }
  return imports;
}

function assertNamedImportSet(rule, imports, fileName, { requireExact = false, allowAnyTypes = false } = {}) {
  const values = [...new Set(imports.filter(entry => !entry.typeOnly).map(entry => entry.name))].sort();
  const types = [...new Set(imports.filter(entry => entry.typeOnly).map(entry => entry.name))].sort();
  const allowedValues = [...(fileName === rule.file
    ? rule.allowedValueImports
    : (rule.allowedTransitiveValueImports ?? rule.allowedValueImports))].sort();
  const allowedTypes = [...rule.allowedTypeImports].sort();
  const unexpectedValues = values.filter(name => !allowedValues.includes(name));
  const unexpectedTypes = allowAnyTypes ? [] : types.filter(name => !allowedTypes.includes(name));
  assert(
    unexpectedValues.length === 0,
    `${rule.id}: ${fileName}: unexpected value import(s) from ${rule.module}: ${unexpectedValues.join(', ')}`,
  );
  assert(
    unexpectedTypes.length === 0,
    `${rule.id}: ${fileName}: unexpected type import(s) from ${rule.module}: ${unexpectedTypes.join(', ')}`,
  );
  if (requireExact) {
    assert(
      JSON.stringify(values) === JSON.stringify(allowedValues),
      `${rule.id}: value import set drifted; expected ${allowedValues.join(', ') || 'none'}, found ${values.join(', ') || 'none'}`,
    );
    assert(
      JSON.stringify(types) === JSON.stringify(allowedTypes),
      `${rule.id}: type import set drifted; expected ${allowedTypes.join(', ') || 'none'}, found ${types.join(', ') || 'none'}`,
    );
  }
}

function assertNoForbiddenModuleDependencies(source, modules, fileName, configuredFile) {
  const sourceFile = parseSourceFile(source, fileName);

  function assertAllowed(loadedModule, kind) {
    const forbiddenModule = matchingForbiddenModule(loadedModule, modules, fileName, configuredFile);
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

function collectLiteralModuleDependencies(source, fileName) {
  const sourceFile = parseSourceFile(source, fileName);
  const dependencies = [];

  function add(specifier) {
    if (specifier !== null) dependencies.push(specifier);
  }

  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) add(staticModuleName(node.moduleSpecifier));
    if (ts.isImportEqualsDeclaration(node)) {
      const reference = node.moduleReference;
      if (ts.isExternalModuleReference(reference)) add(staticModuleName(reference.expression));
    }
    if (ts.isImportTypeNode(node)) add(importTypeModuleName(node));
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) add(staticModuleName(node.arguments[0]));
      if (ts.isIdentifier(node.expression) && node.expression.text === 'require') add(staticModuleName(node.arguments[0]));
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return [...new Set(dependencies)];
}

function localModuleSourceCandidates(specifier, importerFile) {
  const normalizedSpecifier = specifier.replace(/\\/g, '/');
  if (!normalizedSpecifier.startsWith('.')) return [];

  const importedPath = posix.normalize(posix.join(posix.dirname(importerFile), normalizedSpecifier));
  assert(
    importedPath !== '..' && !importedPath.startsWith('../'),
    `${importerFile}: local module dependency ${specifier} escapes the architecture root`,
  );

  const explicitExtension = MODULE_EXTENSIONS.find(candidate => importedPath.endsWith(candidate)) ?? null;
  const basePath = explicitExtension ? importedPath.slice(0, -explicitExtension.length) : importedPath;
  const candidates = [];
  if (explicitExtension) candidates.push(importedPath);
  for (const extension of MODULE_EXTENSIONS) candidates.push(`${basePath}${extension}`);
  for (const extension of MODULE_EXTENSIONS) candidates.push(posix.join(basePath, `index${extension}`));
  return [...new Set(candidates)];
}

async function readOptionalSource(root, fileName, sourceCache) {
  if (sourceCache.has(fileName)) return sourceCache.get(fileName);
  try {
    const source = await readFile(resolve(root, fileName), 'utf8');
    sourceCache.set(fileName, source);
    return source;
  } catch (error) {
    if (error && typeof error === 'object' && ['ENOENT', 'ENOTDIR'].includes(error.code)) {
      sourceCache.set(fileName, null);
      return null;
    }
    throw error;
  }
}

async function resolveLocalModuleFile(specifier, importerFile, root, sourceCache) {
  for (const candidate of localModuleSourceCandidates(specifier, importerFile)) {
    const source = await readOptionalSource(root, candidate, sourceCache);
    if (source !== null) {
      return {
        fileName: candidate,
        source,
        realPath: await realpath(resolve(root, candidate)),
      };
    }
  }
  return null;
}

async function evaluateNamedImportClosure(rule, source, { root }) {
  const queue = [rule.file];
  const visited = new Set();
  const sourceCache = new Map([[rule.file, source]]);
  const protectedModule = await resolveLocalModuleFile(rule.module, rule.file, root, sourceCache);
  let rootImports = null;

  while (queue.length > 0) {
    const fileName = queue.shift();
    if (visited.has(fileName)) continue;
    visited.add(fileName);

    const currentSource = await readOptionalSource(root, fileName, sourceCache);
    assert(currentSource !== null, `${rule.id}: could not read dependency ${fileName}`);
    const imports = parseNamedImports(currentSource, rule.module, fileName, rule.file);
    assertNamedImportSet(rule, imports, fileName, {
      requireExact: fileName === rule.file && rule.requireExact,
      allowAnyTypes: fileName !== rule.file,
    });
    if (fileName === rule.file) rootImports = imports;

    for (const dependency of collectLiteralModuleDependencies(currentSource, fileName)) {
      if (moduleSpecifierMatches(dependency, rule.module, fileName, rule.file)) continue;
      const resolvedDependency = await resolveLocalModuleFile(dependency, fileName, root, sourceCache);
      if (resolvedDependency && protectedModule && resolvedDependency.realPath === protectedModule.realPath) {
        throw new Error(
          `${rule.id}: ${fileName}: module dependency ${dependency} resolves to protected module ${rule.module} through an alternate path`,
        );
      }
      if (resolvedDependency && !visited.has(resolvedDependency.fileName)) queue.push(resolvedDependency.fileName);
    }
  }

  assert(rootImports && rootImports.length > 0, `${rule.id}: expected an import from ${rule.module}`);
  return rootImports;
}

async function assertNoForbiddenModuleDependencyClosure(rule, source, { root }) {
  const queue = [rule.file];
  const visited = new Set();
  const sourceCache = new Map([[rule.file, source]]);
  const forbiddenRealPaths = new Map();
  for (const moduleName of rule.modules) {
    const resolvedModule = await resolveLocalModuleFile(moduleName, rule.file, root, sourceCache);
    if (resolvedModule) forbiddenRealPaths.set(resolvedModule.realPath, moduleName);
  }

  while (queue.length > 0) {
    const fileName = queue.shift();
    if (visited.has(fileName)) continue;
    visited.add(fileName);

    const currentSource = await readOptionalSource(root, fileName, sourceCache);
    assert(currentSource !== null, `${rule.id}: could not read dependency ${fileName}`);
    assertNoForbiddenModuleDependencies(currentSource, rule.modules, fileName, rule.file);

    for (const dependency of collectLiteralModuleDependencies(currentSource, fileName)) {
      if (matchingForbiddenModule(dependency, rule.modules, fileName, rule.file)) continue;
      const resolvedDependency = await resolveLocalModuleFile(dependency, fileName, root, sourceCache);
      const aliasedForbiddenModule = resolvedDependency ? forbiddenRealPaths.get(resolvedDependency.realPath) : null;
      if (aliasedForbiddenModule) {
        throw new Error(
          `${fileName}: module dependency ${dependency} resolves to forbidden module ${aliasedForbiddenModule} through an alternate path`,
        );
      }
      if (resolvedDependency && !visited.has(resolvedDependency.fileName)) queue.push(resolvedDependency.fileName);
    }
  }
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
      await assertNoForbiddenModuleDependencyClosure(rule, source, { root });
      results.push({ id: rule.id, status: 'passed', file: rule.file, type: rule.type, modules: rule.modules });
      continue;
    }

    await evaluateNamedImportClosure(rule, source, { root });
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
