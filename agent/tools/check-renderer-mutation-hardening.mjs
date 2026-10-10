import { readFile, realpath } from 'node:fs/promises';
import { extname, posix, resolve } from 'node:path';
import ts from 'typescript';

const EXTENSIONS = ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx'];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function literal(node) {
  return node && ts.isStringLiteralLike(node) ? node.text : null;
}

function unwrap(node) {
  let current = node;
  while (current && (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isTypeAssertionExpression(current) || ts.isNonNullExpression(current))) current = current.expression;
  return current;
}

function memberName(node) {
  const value = unwrap(node);
  if (ts.isPropertyAccessExpression(value)) return value.name.text;
  if (ts.isElementAccessExpression(value) && value.argumentExpression) {
    const key = unwrap(value.argumentExpression);
    if (ts.isStringLiteralLike(key) || ts.isNumericLiteral(key)) return key.text;
  }
  return null;
}

function memberOwner(node) {
  const value = unwrap(node);
  return ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value) ? unwrap(value.expression) : null;
}

function candidates(specifier, importer) {
  const normalized = specifier.replace(/\\/g, '/');
  if (!normalized.startsWith('.')) return [];
  const path = posix.normalize(posix.join(posix.dirname(importer), normalized));
  invariant(path !== '..' && !path.startsWith('../'), `${importer}: dependency ${specifier} escapes architecture root`);
  if (EXTENSIONS.some(extension => path.endsWith(extension))) return [path];
  return [path, ...EXTENSIONS.map(extension => `${path}${extension}`), ...EXTENSIONS.map(extension => posix.join(path, `index${extension}`))];
}

async function resolveLocal(root, specifier, importer) {
  for (const fileName of candidates(specifier, importer)) {
    try {
      const source = await readFile(resolve(root, fileName), 'utf8');
      return { fileName, source, realPath: await realpath(resolve(root, fileName)) };
    } catch (error) {
      if (!error || typeof error !== 'object' || !['ENOENT', 'ENOTDIR'].includes(error.code)) throw error;
    }
  }
  return null;
}

function sourceFile(source, fileName) {
  const extension = extname(fileName).toLowerCase();
  const kind = extension === '.tsx' ? ts.ScriptKind.TSX : extension === '.jsx' ? ts.ScriptKind.JSX : ['.js', '.mjs'].includes(extension) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const parsed = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind);
  invariant((parsed.parseDiagnostics ?? []).length === 0, `${fileName}: could not parse renderer mutation hardening input`);
  return parsed;
}

function dependencies(ast, fileName) {
  const output = [];
  function add(specifier) { if (specifier) output.push(specifier); }
  function visit(node) {
    if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) add(literal(node.moduleSpecifier));
    else if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier) add(literal(node.moduleSpecifier));
    else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) add(literal(node.moduleReference.expression));
    else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const specifier = literal(node.arguments[0]);
      invariant(specifier, `${fileName}: non-literal dynamic import cannot prove renderer mutation closure`);
      add(specifier);
    } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require') {
      const specifier = literal(node.arguments[0]);
      invariant(specifier, `${fileName}: non-literal require cannot prove renderer mutation closure`);
      add(specifier);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return output;
}

function addNames(name, output) {
  if (ts.isIdentifier(name)) output.add(name.text);
  else for (const element of name.elements ?? []) if (ts.isBindingElement(element)) addNames(element.name, output);
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
  const symbol = unalias(checker, type.symbol);
  const alias = unalias(checker, type.aliasSymbol);
  if ((symbol && protectedSymbols.has(symbol)) || (alias && protectedSymbols.has(alias))) return true;
  if (type.isUnionOrIntersection?.() && type.types.some(entry => typeIsProtected(checker, entry, protectedSymbols, seen))) return true;
  for (const argument of [...(type.typeArguments ?? []), ...(type.aliasTypeArguments ?? [])]) if (typeIsProtected(checker, argument, protectedSymbols, seen)) return true;
  const constraint = checker.getBaseConstraintOfType(type);
  return Boolean(constraint && constraint !== type && typeIsProtected(checker, constraint, protectedSymbols, seen));
}

function scanMutations(ast, fileName, checker, protectedSymbols) {
  const bindings = new Set();
  const taintedFunctions = new Set();
  const globals = new Map([['Object', 'Object'], ['Reflect', 'Reflect']]);
  const reflectiveAliases = new Map();
  const prototypeAliases = new Map();
  const mutators = new Set(['copyWithin', 'fill', 'pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift', 'add', 'clear', 'delete', 'set']);
  const reflective = new Map([
    ['Object', new Set(['assign', 'defineProperty', 'defineProperties', 'setPrototypeOf', 'preventExtensions', 'seal', 'freeze'])],
    ['Reflect', new Set(['set', 'defineProperty', 'deleteProperty', 'setPrototypeOf'])],
  ]);
  const callbackPositions = new Map([
    ['forEach', [0, 1]], ['map', [0]], ['flatMap', [0]], ['filter', [0]], ['find', [0]], ['findIndex', [0]],
    ['findLast', [0]], ['findLastIndex', [0]], ['some', [0]], ['every', [0]], ['reduce', [1]], ['reduceRight', [1]],
  ]);

  function seed(node) {
    if (ts.isParameter(node) || ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node)) {
      if (typeIsProtected(checker, checker.getTypeAtLocation(node), protectedSymbols)) addNames(node.name, bindings);
    }
    ts.forEachChild(node, seed);
  }
  seed(ast);

  function carries(node, seen = new Set()) {
    if (!node) return false;
    const value = unwrap(node);
    if (seen.has(value)) return false;
    seen.add(value);
    if (ts.isIdentifier(value)) return bindings.has(value.text);
    if (ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value)) return carries(value.expression, seen);
    if (ts.isCallExpression(value) || ts.isNewExpression(value)) {
      if (typeIsProtected(checker, checker.getTypeAtLocation(value), protectedSymbols)) return true;
      if (ts.isIdentifier(value.expression) && taintedFunctions.has(value.expression.text)) return true;
      return false;
    }
    if (ts.isAwaitExpression(value)) return carries(value.expression, seen);
    if (ts.isConditionalExpression(value)) return carries(value.whenTrue, seen) || carries(value.whenFalse, seen);
    if (ts.isBinaryExpression(value) && value.operatorToken.kind === ts.SyntaxKind.CommaToken) return carries(value.right, seen);
    return false;
  }

  function globalName(node) {
    const value = unwrap(node);
    if (ts.isIdentifier(value)) return globals.get(value.text) ?? null;
    const name = memberName(value);
    const owner = memberOwner(value);
    if (name && owner && ts.isIdentifier(owner) && owner.text === 'globalThis' && reflective.has(name)) return name;
    return null;
  }

  function reflectiveName(node) {
    const name = memberName(node);
    const owner = memberOwner(node);
    const global = owner ? globalName(owner) : null;
    return global && name && reflective.get(global)?.has(name) ? `${global}.${name}` : null;
  }

  function prototypeMutator(node) {
    const name = memberName(node);
    const owner = memberOwner(node);
    return name && mutators.has(name) && owner && memberName(owner) === 'prototype' ? name : null;
  }

  function functionReturnsProtected(node) {
    if (ts.isArrowFunction(node) && !ts.isBlock(node.body)) return carries(node.body);
    let found = false;
    function visit(child) {
      if (found || (child !== node && (ts.isFunctionDeclaration(child) || ts.isFunctionExpression(child) || ts.isArrowFunction(child)))) return;
      if (ts.isReturnStatement(child) && child.expression && carries(child.expression)) found = true;
      else ts.forEachChild(child, visit);
    }
    if (node.body) visit(node.body);
    return found;
  }

  let changed = true;
  while (changed) {
    changed = false;
    const addBinding = name => { const before = bindings.size; addNames(name, bindings); if (bindings.size !== before) changed = true; };
    const addAlias = (map, name, value) => { if (ts.isIdentifier(name) && map.get(name.text) !== value) { map.set(name.text, value); changed = true; } };
    function propagate(node) {
      if (ts.isVariableDeclaration(node) && node.initializer) {
        if (carries(node.initializer)) addBinding(node.name);
        const global = globalName(node.initializer);
        if (global) addAlias(globals, node.name, global);
        const reflection = reflectiveName(node.initializer);
        if (reflection) addAlias(reflectiveAliases, node.name, reflection);
        const prototype = prototypeMutator(node.initializer);
        if (prototype) addAlias(prototypeAliases, node.name, prototype);
        const init = unwrap(node.initializer);
        if (ts.isIdentifier(init)) {
          if (taintedFunctions.has(init.text) && ts.isIdentifier(node.name) && !taintedFunctions.has(node.name.text)) { taintedFunctions.add(node.name.text); changed = true; }
          if (reflectiveAliases.has(init.text)) addAlias(reflectiveAliases, node.name, reflectiveAliases.get(init.text));
          if (prototypeAliases.has(init.text)) addAlias(prototypeAliases, node.name, prototypeAliases.get(init.text));
        }
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(node.left) && carries(node.right)) addBinding(node.left);
      if (ts.isFunctionDeclaration(node) && node.name && functionReturnsProtected(node) && !taintedFunctions.has(node.name.text)) { taintedFunctions.add(node.name.text); changed = true; }
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) && functionReturnsProtected(node.initializer) && !taintedFunctions.has(node.name.text)) { taintedFunctions.add(node.name.text); changed = true; }
      if (ts.isCallExpression(node)) {
        const expression = unwrap(node.expression);
        const method = memberName(expression);
        const owner = memberOwner(expression);
        const positions = method ? callbackPositions.get(method) : null;
        if (owner && positions && carries(owner)) {
          for (const argument of node.arguments) {
            if (!ts.isArrowFunction(argument) && !ts.isFunctionExpression(argument)) continue;
            for (const position of positions) if (argument.parameters[position]) addBinding(argument.parameters[position].name);
          }
        }
      }
      ts.forEachChild(node, propagate);
    }
    propagate(ast);
  }

  const assignmentKinds = new Set([
    ts.SyntaxKind.EqualsToken, ts.SyntaxKind.PlusEqualsToken, ts.SyntaxKind.MinusEqualsToken, ts.SyntaxKind.AsteriskEqualsToken,
    ts.SyntaxKind.AsteriskAsteriskEqualsToken, ts.SyntaxKind.SlashEqualsToken, ts.SyntaxKind.PercentEqualsToken,
    ts.SyntaxKind.LessThanLessThanEqualsToken, ts.SyntaxKind.GreaterThanGreaterThanEqualsToken, ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
    ts.SyntaxKind.AmpersandEqualsToken, ts.SyntaxKind.BarEqualsToken, ts.SyntaxKind.CaretEqualsToken, ts.SyntaxKind.BarBarEqualsToken,
    ts.SyntaxKind.AmpersandAmpersandEqualsToken, ts.SyntaxKind.QuestionQuestionEqualsToken,
  ]);
  const reject = kind => { throw new Error(`${fileName}: ${kind} of renderer-reachable protected simulation state is not allowed`); };
  const propertyTarget = node => {
    const value = unwrap(node);
    return (ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value)) && carries(value);
  };

  function visit(node) {
    if (ts.isBinaryExpression(node) && assignmentKinds.has(node.operatorToken.kind) && propertyTarget(node.left)) reject('direct mutation');
    if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator) && propertyTarget(node.operand)) reject('update mutation');
    if (ts.isDeleteExpression(node) && propertyTarget(node.expression)) reject('delete mutation');
    if (ts.isCallExpression(node)) {
      const expression = unwrap(node.expression);
      const name = memberName(expression);
      const owner = memberOwner(expression);
      if (owner && mutators.has(name) && carries(owner)) reject(`mutating method ${name}()`);
      if (owner && ts.isElementAccessExpression(expression) && name === null && carries(owner)) reject('computed method call cannot prove read-only access');
      const reflection = reflectiveName(expression);
      if (reflection && carries(node.arguments[0])) reject(`${reflection} mutation`);
      if (ts.isIdentifier(expression) && reflectiveAliases.has(expression.text) && carries(node.arguments[0])) reject(`${reflectiveAliases.get(expression.text)} mutation`);
      if (owner && (name === 'call' || name === 'apply')) {
        const reflectionTarget = reflectiveName(owner) ?? (ts.isIdentifier(owner) ? reflectiveAliases.get(owner.text) : null);
        if (reflectionTarget && carries(node.arguments[1])) reject(`${reflectionTarget} mutation`);
        const prototype = prototypeMutator(owner) ?? (ts.isIdentifier(owner) ? prototypeAliases.get(owner.text) : null);
        if (prototype && carries(node.arguments[0])) reject(`prototype mutating method ${prototype}()`);
      }
      if (ts.isIdentifier(expression) && prototypeAliases.has(expression.text) && carries(node.arguments[0])) reject(`prototype mutating method ${prototypeAliases.get(expression.text)}()`);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}

export async function evaluateRendererMutationHardening(rule, { root = process.cwd() } = {}) {
  invariant(rule?.file && rule?.module, 'renderer mutation hardening requires renderer file and protected module');
  const protectedModule = await resolveLocal(root, rule.module, rule.file);
  invariant(protectedModule, `${rule.id}: protected module ${rule.module} could not be resolved`);
  const owners = new Set(Object.keys(rule.mutableStateOwnerFiles ?? {}));
  const queue = [rule.file];
  const files = new Map();
  while (queue.length) {
    const fileName = queue.shift();
    if (files.has(fileName)) continue;
    const source = await readFile(resolve(root, fileName), 'utf8');
    const ast = sourceFile(source, fileName);
    files.set(fileName, ast);
    for (const specifier of dependencies(ast, fileName)) {
      const resolved = await resolveLocal(root, specifier, fileName);
      if (!resolved || resolved.realPath === protectedModule.realPath || owners.has(resolved.fileName)) continue;
      if (!files.has(resolved.fileName)) queue.push(resolved.fileName);
    }
  }
  const roots = [...files.keys(), protectedModule.fileName].map(fileName => resolve(root, fileName));
  const program = ts.createProgram({ rootNames: roots, options: { target: ts.ScriptTarget.Latest, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, allowJs: true, checkJs: false, noEmit: true, skipLibCheck: true } });
  const checker = program.getTypeChecker();
  const protectedSource = program.getSourceFile(resolve(root, protectedModule.fileName));
  invariant(protectedSource, `${rule.id}: protected module missing from semantic program`);
  const moduleSymbol = checker.getSymbolAtLocation(protectedSource);
  invariant(moduleSymbol, `${rule.id}: protected module has no semantic symbol`);
  const configured = new Set(rule.readOnlyStateTypes ?? []);
  const protectedSymbols = new Set(checker.getExportsOfModule(moduleSymbol).filter(symbol => configured.has(symbol.name)).map(symbol => unalias(checker, symbol)));
  invariant(protectedSymbols.size === configured.size, `${rule.id}: could not resolve readOnlyStateTypes for mutation hardening`);
  for (const fileName of files.keys()) {
    const ast = program.getSourceFile(resolve(root, fileName));
    invariant(ast, `${rule.id}: ${fileName} missing from semantic program`);
    scanMutations(ast, fileName, checker, protectedSymbols);
  }
  return { status: 'passed', filesChecked: files.size };
}

export async function checkRendererMutationHardeningFromConfig(configPath = 'agent/architecture-invariants.json', { root = process.cwd() } = {}) {
  const config = JSON.parse(await readFile(resolve(root, configPath), 'utf8'));
  const rule = config.rules?.find(entry => entry.id === 'renderer-sim-import-boundary');
  invariant(rule, 'renderer-sim-import-boundary rule is missing');
  return evaluateRendererMutationHardening(rule, { root });
}
