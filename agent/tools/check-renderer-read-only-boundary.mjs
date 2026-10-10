import { readFile, realpath } from 'node:fs/promises';
import { extname, posix, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const KNOWN_EXTENSIONS = ['.d.mts', '.d.cts', '.d.ts', '.tsx', '.mts', '.cts', '.mjs', '.cjs', '.jsx', '.ts', '.js'];
const RUNTIME_EXTENSIONS = ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx'];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
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
  invariant((sourceFile.parseDiagnostics ?? []).length === 0, `could not parse ${fileName} for renderer read-only boundary`);
  return sourceFile;
}

function literalModule(node) {
  return node && ts.isStringLiteralLike(node) ? node.text : null;
}

function runtimeCandidates(specifier, importerFile) {
  const normalized = specifier.replace(/\\/g, '/');
  if (!normalized.startsWith('.')) return [];
  const importedPath = posix.normalize(posix.join(posix.dirname(importerFile), normalized));
  invariant(importedPath !== '..' && !importedPath.startsWith('../'), `${importerFile}: local dependency ${specifier} escapes the architecture root`);
  if (KNOWN_EXTENSIONS.some(extension => importedPath.endsWith(extension))) return [importedPath];
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

async function resolveLocal(specifier, importerFile, root, cache) {
  for (const candidate of runtimeCandidates(specifier, importerFile)) {
    const source = await readOptional(root, candidate, cache);
    if (source !== null) return { fileName: candidate, source, realPath: await realpath(resolve(root, candidate)) };
  }
  return null;
}

function runtimeDependencies(sourceFile, fileName) {
  const dependencies = [];
  function add(specifier, kind, importedNames = ['*']) {
    if (specifier !== null) dependencies.push({ specifier, kind, importedNames: [...new Set(importedNames)] });
  }
  function importNames(clause) {
    if (!clause) return ['*'];
    const names = [];
    if (clause.name) names.push('default');
    if (clause.namedBindings) {
      if (ts.isNamespaceImport(clause.namedBindings)) names.push('*');
      else for (const element of clause.namedBindings.elements) if (!element.isTypeOnly) names.push((element.propertyName ?? element.name).text);
    }
    return names;
  }
  function visit(node) {
    if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) {
      const names = importNames(node.importClause);
      if (names.length > 0 || !node.importClause) add(literalModule(node.moduleSpecifier), 'import', names.length ? names : ['*']);
    } else if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier) {
      if (!node.exportClause || ts.isNamespaceExport(node.exportClause)) add(literalModule(node.moduleSpecifier), 're-export');
      else add(literalModule(node.moduleSpecifier), 're-export', node.exportClause.elements.filter(element => !element.isTypeOnly).map(element => (element.propertyName ?? element.name).text));
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      add(literalModule(node.moduleReference.expression), 'import-equals');
    } else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const specifier = literalModule(node.arguments[0]);
        invariant(specifier !== null, `${fileName}: non-literal dynamic import cannot prove renderer read-only dependency closure`);
        add(specifier, 'dynamic import');
      }
      if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
        const specifier = literalModule(node.arguments[0]);
        invariant(specifier !== null, `${fileName}: non-literal require() cannot prove renderer read-only dependency closure`);
        add(specifier, 'require()');
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return dependencies;
}

function addBindingNames(name, output) {
  if (ts.isIdentifier(name)) output.add(name.text);
  else for (const element of name.elements ?? []) if (ts.isBindingElement(element)) addBindingNames(element.name, output);
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
  while (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isTypeAssertionExpression(current) || ts.isNonNullExpression(current)) current = current.expression;
  return current;
}

function rootProtectedBinding(expression, bindings) {
  let current = unwrap(expression);
  while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) current = unwrap(current.expression);
  return ts.isIdentifier(current) && bindings.has(current.text);
}

function rejectProtectedMutations(sourceFile, fileName, protectedTypeNames, seedBindings = new Set()) {
  if (protectedTypeNames.size === 0 && seedBindings.size === 0) return;
  let changed = true;
  while (changed) {
    changed = false;
    for (const statement of sourceFile.statements) {
      if (ts.isTypeAliasDeclaration(statement) && !protectedTypeNames.has(statement.name.text) && typeReferences(statement.type, protectedTypeNames)) {
        protectedTypeNames.add(statement.name.text);
        changed = true;
      }
    }
  }

  const bindings = new Set(seedBindings);
  function collect(node) {
    if ((ts.isParameter(node) || ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node)) && node.type && typeReferences(node.type, protectedTypeNames)) addBindingNames(node.name, bindings);
    ts.forEachChild(node, collect);
  }
  collect(sourceFile);

  function carries(expression) {
    if (!expression) return false;
    if (rootProtectedBinding(expression, bindings)) return true;
    return (ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression)) && typeReferences(expression.type, protectedTypeNames);
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
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && carries(node.right)) {
        const before = bindings.size;
        if (ts.isIdentifier(node.left)) bindings.add(node.left.text);
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
    ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken, ts.SyntaxKind.AmpersandEqualsToken, ts.SyntaxKind.BarEqualsToken,
    ts.SyntaxKind.CaretEqualsToken, ts.SyntaxKind.BarBarEqualsToken, ts.SyntaxKind.AmpersandAmpersandEqualsToken,
    ts.SyntaxKind.QuestionQuestionEqualsToken,
  ]);
  const mutators = new Set(['copyWithin', 'fill', 'pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift', 'add', 'clear', 'delete', 'set']);
  const reflectiveMutators = new Map([
    ['Object', new Set(['assign', 'defineProperty', 'defineProperties', 'setPrototypeOf', 'preventExtensions', 'seal', 'freeze'])],
    ['Reflect', new Set(['set', 'defineProperty', 'deleteProperty', 'setPrototypeOf'])],
  ]);
  const propertyTarget = expression => {
    const target = unwrap(expression);
    return (ts.isPropertyAccessExpression(target) || ts.isElementAccessExpression(target)) && rootProtectedBinding(target, bindings);
  };
  const reject = kind => { throw new Error(`${fileName}: ${kind} of renderer-reachable protected simulation state is not allowed`); };

  function visit(node) {
    if (ts.isBinaryExpression(node) && assignmentKinds.has(node.operatorToken.kind) && propertyTarget(node.left)) reject('direct mutation');
    if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator) && propertyTarget(node.operand)) reject('update mutation');
    if (ts.isDeleteExpression(node) && propertyTarget(node.expression)) reject('delete mutation');
    if (ts.isCallExpression(node)) {
      const expression = unwrap(node.expression);
      if (ts.isPropertyAccessExpression(expression) && mutators.has(expression.name.text) && rootProtectedBinding(expression.expression, bindings)) reject(`mutating method ${expression.name.text}()`);
      if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)) {
        const globalMutators = reflectiveMutators.get(expression.expression.text);
        if (globalMutators?.has(expression.name.text) && carries(node.arguments[0])) reject(`${expression.expression.text}.${expression.name.text} mutation`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

async function protectedTypeBindings(sourceFile, fileName, rule, protectedModule, root, cache) {
  const names = new Set();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause?.namedBindings || !ts.isNamedImports(statement.importClause.namedBindings)) continue;
    const specifier = literalModule(statement.moduleSpecifier);
    const resolved = specifier ? await resolveLocal(specifier, fileName, root, cache) : null;
    if (!resolved || resolved.realPath !== protectedModule.realPath) continue;
    for (const element of statement.importClause.namedBindings.elements) {
      const imported = (element.propertyName ?? element.name).text;
      if ((rule.readOnlyStateTypes ?? []).includes(imported)) names.add(element.name.text);
    }
  }
  return names;
}

function unalias(checker, symbol) {
  let current = symbol;
  const seen = new Set();
  while (current && (current.flags & ts.SymbolFlags.Alias) && !seen.has(current)) {
    seen.add(current);
    current = checker.getAliasedSymbol(current);
  }
  return current;
}

function typeIsProtected(checker, type, protectedSymbols, seen = new Set()) {
  if (!type || seen.has(type)) return false;
  seen.add(type);
  const aliasSymbol = unalias(checker, type.aliasSymbol);
  const symbol = unalias(checker, type.symbol);
  if ((aliasSymbol && protectedSymbols.has(aliasSymbol)) || (symbol && protectedSymbols.has(symbol))) return true;
  if (type.isUnionOrIntersection?.() && type.types.some(entry => typeIsProtected(checker, entry, protectedSymbols, seen))) return true;
  for (const argument of type.aliasTypeArguments ?? []) if (typeIsProtected(checker, argument, protectedSymbols, seen)) return true;
  for (const argument of type.typeArguments ?? []) if (typeIsProtected(checker, argument, protectedSymbols, seen)) return true;
  const constraint = checker.getBaseConstraintOfType(type);
  return Boolean(constraint && constraint !== type && typeIsProtected(checker, constraint, protectedSymbols, seen));
}

function semanticProtectedBindings(sourceFile, checker, protectedSymbols) {
  const bindings = new Set();
  function collect(node) {
    if (ts.isParameter(node) || ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node)) {
      const type = checker.getTypeAtLocation(node);
      if (typeIsProtected(checker, type, protectedSymbols)) addBindingNames(node.name, bindings);
    }
    ts.forEachChild(node, collect);
  }
  collect(sourceFile);
  return bindings;
}

function sourceFileFromProgram(program, root, fileName) {
  const expected = resolve(root, fileName);
  return program.getSourceFile(expected) ?? program.getSourceFiles().find(sourceFile => resolve(sourceFile.fileName) === expected) ?? null;
}

function semanticProgram(root, fileNames) {
  return ts.createProgram({
    rootNames: [...new Set(fileNames)].map(fileName => resolve(root, fileName)),
    options: {
      target: ts.ScriptTarget.Latest,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.Preserve,
      allowJs: true,
      checkJs: false,
      allowImportingTsExtensions: true,
      skipLibCheck: true,
      noEmit: true,
      strict: false,
    },
  });
}

function protectedTypeSymbols(program, checker, root, protectedModule, rule) {
  const sourceFile = sourceFileFromProgram(program, root, protectedModule.fileName);
  invariant(sourceFile, `${rule.id}: protected module ${protectedModule.fileName} is missing from semantic program`);
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  invariant(moduleSymbol, `${rule.id}: protected module ${protectedModule.fileName} has no module symbol`);
  const configured = new Set(rule.readOnlyStateTypes ?? []);
  const symbols = new Set();
  for (const exported of checker.getExportsOfModule(moduleSymbol)) {
    if (configured.has(exported.name)) symbols.add(unalias(checker, exported));
  }
  invariant(symbols.size === configured.size, `${rule.id}: could not resolve every readOnlyStateTypes export from ${protectedModule.fileName}`);
  return symbols;
}

function assertOwnerEdge(rule, resolvedFile, dependency, importerFile) {
  const allowed = rule.mutableStateOwnerFiles?.[resolvedFile];
  if (!allowed) return false;
  const unexpected = dependency.importedNames.filter(name => name === '*' || name === 'default' || !allowed.includes(name));
  invariant(unexpected.length === 0, `${importerFile}: ${dependency.kind} from mutable simulation owner ${resolvedFile} must use approved read-only export(s); unexpected ${unexpected.join(', ')}`);
  return true;
}

export async function evaluateRendererReadOnlyBoundary(rule, { root = process.cwd() } = {}) {
  invariant(rule && rule.type === 'namedImportAllowlist', 'renderer read-only boundary requires a namedImportAllowlist rule');
  invariant(Array.isArray(rule.readOnlyStateTypes) && rule.readOnlyStateTypes.length > 0, `${rule.id}: readOnlyStateTypes must be configured`);
  invariant(rule.mutableStateOwnerFiles && typeof rule.mutableStateOwnerFiles === 'object', `${rule.id}: mutableStateOwnerFiles must be configured`);

  const cache = new Map();
  const protectedModule = await resolveLocal(rule.module, rule.file, root, cache);
  invariant(protectedModule, `${rule.id}: could not resolve protected module ${rule.module}`);
  const queue = [rule.file];
  const visited = new Set();

  while (queue.length) {
    const fileName = queue.shift();
    if (visited.has(fileName)) continue;
    visited.add(fileName);
    const source = await readOptional(root, fileName, cache);
    invariant(source !== null, `${rule.id}: could not read dependency ${fileName}`);
    const sourceFile = parse(source, fileName);
    const protectedNames = await protectedTypeBindings(sourceFile, fileName, rule, protectedModule, root, cache);
    rejectProtectedMutations(sourceFile, fileName, protectedNames);

    for (const dependency of runtimeDependencies(sourceFile, fileName)) {
      const resolved = await resolveLocal(dependency.specifier, fileName, root, cache);
      if (!resolved || resolved.realPath === protectedModule.realPath) continue;
      if (assertOwnerEdge(rule, resolved.fileName, dependency, fileName)) continue;
      if (!visited.has(resolved.fileName)) queue.push(resolved.fileName);
    }
  }

  const program = semanticProgram(root, [...visited, protectedModule.fileName]);
  const checker = program.getTypeChecker();
  const protectedSymbols = protectedTypeSymbols(program, checker, root, protectedModule, rule);
  for (const fileName of visited) {
    const sourceFile = sourceFileFromProgram(program, root, fileName);
    invariant(sourceFile, `${rule.id}: ${fileName} is missing from semantic program`);
    const bindings = semanticProtectedBindings(sourceFile, checker, protectedSymbols);
    rejectProtectedMutations(sourceFile, fileName, new Set(), bindings);
  }

  return { status: 'passed', ruleId: rule.id, filesChecked: visited.size };
}

export async function checkRendererReadOnlyBoundaryFromConfig(configPath = 'agent/architecture-invariants.json', { root = process.cwd() } = {}) {
  const config = JSON.parse(await readFile(resolve(root, configPath), 'utf8'));
  const rule = config.rules?.find(entry => entry.id === 'renderer-sim-import-boundary');
  invariant(rule, 'renderer-sim-import-boundary rule is missing');
  return evaluateRendererReadOnlyBoundary(rule, { root });
}

async function main() {
  const result = await checkRendererReadOnlyBoundaryFromConfig();
  console.log(`RENDERER_READ_ONLY_BOUNDARY_PASS rule=${result.ruleId} files=${result.filesChecked}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
