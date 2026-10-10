import { readFile, realpath } from 'node:fs/promises';
import { extname, posix, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import * as base from './check-architecture-invariants-base.mjs';

const KNOWN_EXTENSIONS = ['.d.mts', '.d.cts', '.d.ts', '.tsx', '.mts', '.cts', '.mjs', '.cjs', '.jsx', '.ts', '.js'];
const RUNTIME_EXTENSIONS = ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx'];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function stringArray(value, label) {
  invariant(Array.isArray(value), `${label} must be an array`);
  for (const entry of value) invariant(typeof entry === 'string' && entry.length > 0, `${label} must contain strings`);
}

export function validateArchitectureInvariantConfig(config) {
  base.validateArchitectureInvariantConfig(config);
  for (const rule of config.rules) {
    if (rule.type === 'namedImportAllowlist') stringArray(rule.protectedMutableTypes ?? [], `rule ${rule.id}.protectedMutableTypes`);
  }
  return config;
}

function scriptKind(fileName) {
  const extension = extname(fileName).toLowerCase();
  if (extension === '.tsx') return ts.ScriptKind.TSX;
  if (extension === '.jsx') return ts.ScriptKind.JSX;
  if (['.js', '.mjs', '.cjs'].includes(extension)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function parse(source, fileName) {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKind(fileName));
  invariant((sourceFile.parseDiagnostics ?? []).length === 0, `could not parse ${fileName} for architecture invariants`);
  return sourceFile;
}

function literalModule(node) {
  return node && ts.isStringLiteralLike(node) ? node.text : null;
}

function stripKnownExtension(value) {
  const extension = KNOWN_EXTENSIONS.find(candidate => value.endsWith(candidate));
  return extension ? value.slice(0, -extension.length) : value;
}

function canonical(specifier, importerFile) {
  const normalized = specifier.replace(/\\/g, '/');
  if (!normalized.startsWith('.')) return `external:${normalized}`;
  return `local:${posix.normalize(posix.join(posix.dirname(importerFile), stripKnownExtension(normalized)))}`;
}

function configuredMatch(specifier, rule, fileName) {
  return specifier !== null && canonical(specifier, fileName) === canonical(rule.module, rule.file);
}

function importMetaMember(expression) {
  if (
    ts.isPropertyAccessExpression(expression)
    && ts.isMetaProperty(expression.expression)
    && expression.expression.keywordToken === ts.SyntaxKind.ImportKeyword
    && expression.expression.name.text === 'meta'
  ) {
    return expression.name.text;
  }
  if (
    ts.isElementAccessExpression(expression)
    && ts.isMetaProperty(expression.expression)
    && expression.expression.keywordToken === ts.SyntaxKind.ImportKeyword
    && expression.expression.name.text === 'meta'
    && expression.argumentExpression
    && ts.isStringLiteralLike(expression.argumentExpression)
  ) {
    return expression.argumentExpression.text;
  }
  return null;
}

function isImportMetaGlob(node) {
  if (!ts.isCallExpression(node)) return false;
  const member = importMetaMember(node.expression);
  return member === 'glob' || member === 'globEager';
}

function runtimeCandidates(specifier, importerFile) {
  const normalized = specifier.replace(/\\/g, '/');
  if (!normalized.startsWith('.')) return [];
  const importedPath = posix.normalize(posix.join(posix.dirname(importerFile), normalized));
  invariant(importedPath !== '..' && !importedPath.startsWith('../'), `${importerFile}: local module dependency ${specifier} escapes the architecture root`);
  const explicit = KNOWN_EXTENSIONS.some(extension => importedPath.endsWith(extension));
  if (explicit) return [importedPath];
  return [
    importedPath,
    ...RUNTIME_EXTENSIONS.map(extension => `${importedPath}${extension}`),
    ...RUNTIME_EXTENSIONS.map(extension => posix.join(importedPath, `index${extension}`)),
  ];
}

async function readOptional(root, fileName, cache) {
  if (cache.has(fileName)) return cache.get(fileName);
  try {
    const source = await readFile(resolve(root, fileName), 'utf8');
    cache.set(fileName, source);
    return source;
  } catch (error) {
    if (error && typeof error === 'object' && ['ENOENT', 'ENOTDIR'].includes(error.code)) {
      cache.set(fileName, null);
      return null;
    }
    throw error;
  }
}

async function resolveRuntime(specifier, importerFile, root, cache) {
  for (const candidate of runtimeCandidates(specifier, importerFile)) {
    const source = await readOptional(root, candidate, cache);
    if (source !== null) {
      return { fileName: candidate, source, realPath: await realpath(resolve(root, candidate)) };
    }
  }
  return null;
}

function runtimeDependencies(sourceFile, fileName) {
  const dependencies = [];
  function add(specifier, kind) {
    if (specifier !== null) dependencies.push({ specifier, kind });
  }
  function visit(node) {
    if (isImportMetaGlob(node)) throw new Error(`${fileName}: import.meta.glob cannot prove the local module dependency closure`);
    if (ts.isImportDeclaration(node)) {
      const specifier = literalModule(node.moduleSpecifier);
      if (!node.importClause?.isTypeOnly) add(specifier, 'import');
    } else if (ts.isExportDeclaration(node)) {
      add(literalModule(node.moduleSpecifier), 're-export');
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      add(literalModule(node.moduleReference.expression), 'import-equals');
    } else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const specifier = literalModule(node.arguments[0]);
        invariant(specifier !== null, `${fileName}: non-literal dynamic import cannot prove the local module dependency closure`);
        add(specifier, 'dynamic import');
      }
      if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
        const specifier = literalModule(node.arguments[0]);
        invariant(specifier !== null, `${fileName}: non-literal require() cannot prove the local module dependency closure`);
        add(specifier, 'require()');
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return dependencies;
}

function typeQueryModule(node) {
  return node.argument && ts.isLiteralTypeNode(node.argument) ? literalModule(node.argument.literal) : null;
}

async function resolvesTo(specifier, importerFile, targetRealPath, root, cache) {
  if (specifier === null) return false;
  const resolved = await resolveRuntime(specifier, importerFile, root, cache);
  return Boolean(resolved && resolved.realPath === targetRealPath);
}

function addBindingNames(name, output) {
  if (ts.isIdentifier(name)) {
    output.add(name.text);
    return;
  }
  for (const element of name.elements ?? []) {
    if (ts.isBindingElement(element)) addBindingNames(element.name, output);
  }
}

function typeReferences(typeNode, names) {
  if (!typeNode || names.size === 0) return false;
  let found = false;
  function visit(node) {
    if (found) return;
    if (ts.isIdentifier(node) && names.has(node.text)) found = true;
    else ts.forEachChild(node, visit);
  }
  visit(typeNode);
  return found;
}

function unwrap(expression) {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current)
    || ts.isAsExpression(current)
    || ts.isTypeAssertionExpression(current)
    || ts.isNonNullExpression(current)
  ) current = current.expression;
  return current;
}

function rootProtectedBinding(expression, bindings) {
  let current = unwrap(expression);
  while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) current = unwrap(current.expression);
  return ts.isIdentifier(current) && bindings.has(current.text);
}

function assertNoProtectedMutation(sourceFile, rule, fileName, protectedTypeNames) {
  if (protectedTypeNames.size === 0) return;

  let changed = true;
  while (changed) {
    changed = false;
    for (const statement of sourceFile.statements) {
      if (
        ts.isTypeAliasDeclaration(statement)
        && !protectedTypeNames.has(statement.name.text)
        && typeReferences(statement.type, protectedTypeNames)
      ) {
        protectedTypeNames.add(statement.name.text);
        changed = true;
      }
    }
  }

  const bindings = new Set();
  function collect(node) {
    if (
      (ts.isParameter(node) || ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node))
      && node.type
      && typeReferences(node.type, protectedTypeNames)
    ) addBindingNames(node.name, bindings);
    ts.forEachChild(node, collect);
  }
  collect(sourceFile);

  function carries(expression) {
    if (!expression) return false;
    if (rootProtectedBinding(expression, bindings)) return true;
    return (
      (ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression))
      && typeReferences(expression.type, protectedTypeNames)
    );
  }

  changed = true;
  while (changed) {
    changed = false;
    function propagate(node) {
      if (ts.isVariableDeclaration(node) && node.initializer && carries(node.initializer)) {
        const before = bindings.size;
        addBindingNames(node.name, bindings);
        if (bindings.size !== before) changed = true;
      }
      ts.forEachChild(node, propagate);
    }
    propagate(sourceFile);
  }

  const assignmentKinds = new Set([
    ts.SyntaxKind.EqualsToken, ts.SyntaxKind.PlusEqualsToken, ts.SyntaxKind.MinusEqualsToken,
    ts.SyntaxKind.AsteriskEqualsToken, ts.SyntaxKind.AsteriskAsteriskEqualsToken, ts.SyntaxKind.SlashEqualsToken,
    ts.SyntaxKind.PercentEqualsToken, ts.SyntaxKind.LessThanLessThanEqualsToken, ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
    ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken, ts.SyntaxKind.AmpersandEqualsToken,
    ts.SyntaxKind.BarEqualsToken, ts.SyntaxKind.CaretEqualsToken, ts.SyntaxKind.BarBarEqualsToken,
    ts.SyntaxKind.AmpersandAmpersandEqualsToken, ts.SyntaxKind.QuestionQuestionEqualsToken,
  ]);
  const mutators = new Set(['copyWithin', 'fill', 'pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift', 'add', 'clear', 'delete', 'set']);

  function propertyTarget(expression) {
    const target = unwrap(expression);
    return (ts.isPropertyAccessExpression(target) || ts.isElementAccessExpression(target)) && rootProtectedBinding(target, bindings);
  }
  function reject(kind) {
    throw new Error(`${rule.id}: ${fileName}: ${kind} of protected mutable simulation type(s) ${(rule.protectedMutableTypes ?? []).join(', ')} is not allowed`);
  }
  function visit(node) {
    if (ts.isBinaryExpression(node) && assignmentKinds.has(node.operatorToken.kind) && propertyTarget(node.left)) reject('direct mutation');
    if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node))
      && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator)
      && propertyTarget(node.operand)
    ) reject('update mutation');
    if (ts.isDeleteExpression(node) && propertyTarget(node.expression)) reject('delete mutation');
    if (ts.isCallExpression(node)) {
      const expression = unwrap(node.expression);
      if (
        ts.isPropertyAccessExpression(expression)
        && mutators.has(expression.name.text)
        && rootProtectedBinding(expression.expression, bindings)
      ) reject(`mutating method ${expression.name.text}()`);
      if (
        ts.isPropertyAccessExpression(expression)
        && ts.isIdentifier(expression.expression)
        && expression.expression.text === 'Object'
        && expression.name.text === 'assign'
        && carries(node.arguments[0])
      ) reject('Object.assign mutation');
      if (
        ts.isPropertyAccessExpression(expression)
        && ts.isIdentifier(expression.expression)
        && expression.expression.text === 'Reflect'
        && expression.name.text === 'set'
        && carries(node.arguments[0])
      ) reject('Reflect.set mutation');
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

async function inspectNamedFile(rule, sourceFile, fileName, protectedModule, root, cache) {
  const values = [];
  const types = [];
  const protectedTypeNames = new Set();
  const protectedMutableTypes = new Set(rule.protectedMutableTypes ?? []);

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      const specifier = literalModule(statement.moduleSpecifier);
      if (!await resolvesTo(specifier, fileName, protectedModule.realPath, root, cache)) continue;
      if (!configuredMatch(specifier, rule, fileName)) {
        throw new Error(`${rule.id}: ${fileName}: module dependency ${specifier} resolves to protected module ${rule.module} through an alternate path`);
      }
      const clause = statement.importClause;
      invariant(clause && !clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings), `${fileName}: imports from ${rule.module} must use named imports only`);
      for (const element of clause.namedBindings.elements) {
        const imported = (element.propertyName ?? element.name).text;
        const typeOnly = Boolean(clause.isTypeOnly || element.isTypeOnly);
        (typeOnly ? types : values).push(imported);
        if (protectedMutableTypes.has(imported)) protectedTypeNames.add(element.name.text);
      }
    }
    if (ts.isExportDeclaration(statement)) {
      const specifier = literalModule(statement.moduleSpecifier);
      if (await resolvesTo(specifier, fileName, protectedModule.realPath, root, cache)) {
        throw new Error(`${fileName}: re-export from ${rule.module} is not allowed by named-import architecture rules`);
      }
    }
    if (ts.isImportEqualsDeclaration(statement) && ts.isExternalModuleReference(statement.moduleReference)) {
      const specifier = literalModule(statement.moduleReference.expression);
      if (await resolvesTo(specifier, fileName, protectedModule.realPath, root, cache)) {
        throw new Error(`${fileName}: import-equals from ${rule.module} is not allowed by named-import architecture rules`);
      }
    }
  }

  const asyncChecks = [];
  function visit(node) {
    if (isImportMetaGlob(node)) throw new Error(`${fileName}: import.meta.glob cannot prove the ${rule.module} named-import boundary`);
    if (ts.isImportTypeNode(node)) {
      const specifier = typeQueryModule(node);
      invariant(specifier !== null, `${fileName}: non-literal import type cannot prove the ${rule.module} named-import boundary`);
      asyncChecks.push(resolvesTo(specifier, fileName, protectedModule.realPath, root, cache).then(matches => {
        if (matches) throw new Error(`${fileName}: import type from ${rule.module} is not allowed by named-import architecture rules`);
      }));
    }
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const specifier = literalModule(node.arguments[0]);
        invariant(specifier !== null, `${fileName}: non-literal dynamic import cannot prove the ${rule.module} named-import boundary`);
        asyncChecks.push(resolvesTo(specifier, fileName, protectedModule.realPath, root, cache).then(matches => {
          if (matches) throw new Error(`${fileName}: dynamic import from ${rule.module} is not allowed by named-import architecture rules`);
        }));
      }
      if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
        const specifier = literalModule(node.arguments[0]);
        invariant(specifier !== null, `${fileName}: non-literal require() cannot prove the ${rule.module} named-import boundary`);
        asyncChecks.push(resolvesTo(specifier, fileName, protectedModule.realPath, root, cache).then(matches => {
          if (matches) throw new Error(`${fileName}: require() from ${rule.module} is not allowed by named-import architecture rules`);
        }));
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  await Promise.all(asyncChecks);

  const uniqueValues = [...new Set(values)].sort();
  const uniqueTypes = [...new Set(types)].sort();
  const allowedValues = [...(fileName === rule.file ? rule.allowedValueImports : (rule.allowedTransitiveValueImports ?? rule.allowedValueImports))].sort();
  const allowedTypes = [...rule.allowedTypeImports].sort();
  const unexpectedValues = uniqueValues.filter(name => !allowedValues.includes(name));
  const unexpectedTypes = fileName === rule.file ? uniqueTypes.filter(name => !allowedTypes.includes(name)) : [];
  invariant(unexpectedValues.length === 0, `${rule.id}: ${fileName}: unexpected value import(s) from ${rule.module}: ${unexpectedValues.join(', ')}`);
  invariant(unexpectedTypes.length === 0, `${rule.id}: ${fileName}: unexpected type import(s) from ${rule.module}: ${unexpectedTypes.join(', ')}`);

  if (fileName === rule.file && rule.requireExact) {
    invariant(JSON.stringify(uniqueValues) === JSON.stringify(allowedValues), `${rule.id}: value import set drifted; expected ${allowedValues.join(', ') || 'none'}, found ${uniqueValues.join(', ') || 'none'}`);
    invariant(JSON.stringify(uniqueTypes) === JSON.stringify(allowedTypes), `${rule.id}: type import set drifted; expected ${allowedTypes.join(', ') || 'none'}, found ${uniqueTypes.join(', ') || 'none'}`);
  }

  assertNoProtectedMutation(sourceFile, rule, fileName, protectedTypeNames);
  return values.length + types.length;
}

async function evaluateNamed(rule, source, root) {
  const cache = new Map([[rule.file, source]]);
  const protectedModule = await resolveRuntime(rule.module, rule.file, root, cache);
  invariant(protectedModule, `${rule.id}: could not resolve protected module ${rule.module}`);
  const queue = [rule.file];
  const visited = new Set();
  let rootImportCount = 0;

  while (queue.length) {
    const fileName = queue.shift();
    if (visited.has(fileName)) continue;
    visited.add(fileName);
    const currentSource = await readOptional(root, fileName, cache);
    invariant(currentSource !== null, `${rule.id}: could not read dependency ${fileName}`);
    const sourceFile = parse(currentSource, fileName);
    const count = await inspectNamedFile(rule, sourceFile, fileName, protectedModule, root, cache);
    if (fileName === rule.file) rootImportCount = count;

    for (const { specifier } of runtimeDependencies(sourceFile, fileName)) {
      if (configuredMatch(specifier, rule, fileName)) continue;
      const resolved = await resolveRuntime(specifier, fileName, root, cache);
      if (resolved && resolved.realPath === protectedModule.realPath) {
        throw new Error(`${rule.id}: ${fileName}: module dependency ${specifier} resolves to protected module ${rule.module} through an alternate path`);
      }
      if (resolved && !visited.has(resolved.fileName)) queue.push(resolved.fileName);
    }
  }
  invariant(rootImportCount > 0, `${rule.id}: expected an import from ${rule.module}`);
  return { id: rule.id, status: 'passed', file: rule.file, type: rule.type, module: rule.module };
}

async function evaluateDenylist(rule, source, root) {
  const cache = new Map([[rule.file, source]]);
  const forbidden = new Map();
  for (const moduleName of rule.modules) {
    const resolved = await resolveRuntime(moduleName, rule.file, root, cache);
    if (resolved) forbidden.set(resolved.realPath, moduleName);
  }
  const queue = [rule.file];
  const visited = new Set();

  while (queue.length) {
    const fileName = queue.shift();
    if (visited.has(fileName)) continue;
    visited.add(fileName);
    const currentSource = await readOptional(root, fileName, cache);
    invariant(currentSource !== null, `${rule.id}: could not read dependency ${fileName}`);
    const sourceFile = parse(currentSource, fileName);

    const checks = [];
    function inspect(node) {
      if (isImportMetaGlob(node)) throw new Error(`${fileName}: import.meta.glob cannot prove the module dependency denylist`);
      let specifier = null;
      let kind = null;
      if (ts.isImportDeclaration(node)) { specifier = literalModule(node.moduleSpecifier); kind = 'import'; }
      else if (ts.isExportDeclaration(node)) { specifier = literalModule(node.moduleSpecifier); kind = 're-export'; }
      else if (ts.isImportTypeNode(node)) { specifier = typeQueryModule(node); kind = 'import type'; }
      else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) { specifier = literalModule(node.moduleReference.expression); kind = 'import-equals'; }
      else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) { specifier = literalModule(node.arguments[0]); kind = 'dynamic import'; }
      else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require') { specifier = literalModule(node.arguments[0]); kind = 'require()'; }

      if (kind) {
        invariant(specifier !== null, `${fileName}: non-literal ${kind} cannot prove the module dependency denylist`);
        checks.push(resolveRuntime(specifier, fileName, root, cache).then(resolved => {
          if (!resolved) return;
          const forbiddenModule = forbidden.get(resolved.realPath);
          if (!forbiddenModule) return;
          if (canonical(specifier, fileName) === canonical(forbiddenModule, rule.file)) {
            throw new Error(`${fileName}: ${kind} from forbidden module ${forbiddenModule} is not allowed`);
          }
          throw new Error(`${fileName}: module dependency ${specifier} resolves to forbidden module ${forbiddenModule} through an alternate path`);
        }));
      }
      ts.forEachChild(node, inspect);
    }
    inspect(sourceFile);
    await Promise.all(checks);

    for (const { specifier } of runtimeDependencies(sourceFile, fileName)) {
      const resolved = await resolveRuntime(specifier, fileName, root, cache);
      if (resolved && !forbidden.has(resolved.realPath) && !visited.has(resolved.fileName)) queue.push(resolved.fileName);
    }
  }
  return { id: rule.id, status: 'passed', file: rule.file, type: rule.type, modules: rule.modules };
}

export async function evaluateArchitectureInvariants(config, { root = process.cwd() } = {}) {
  validateArchitectureInvariantConfig(config);
  const results = new Map();
  const sourceRules = config.rules.filter(rule => rule.type === 'sourceContract');
  if (sourceRules.length) {
    const baseResults = await base.evaluateArchitectureInvariants({ schemaVersion: config.schemaVersion, rules: sourceRules }, { root });
    for (const result of baseResults) results.set(result.id, result);
  }
  for (const rule of config.rules) {
    if (rule.type === 'sourceContract') continue;
    const source = await readFile(resolve(root, rule.file), 'utf8');
    const result = rule.type === 'namedImportAllowlist'
      ? await evaluateNamed(rule, source, root)
      : await evaluateDenylist(rule, source, root);
    results.set(rule.id, result);
  }
  return config.rules.map(rule => results.get(rule.id));
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
