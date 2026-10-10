import { readFile, realpath } from 'node:fs/promises';
import { extname, posix, resolve } from 'node:path';
import ts from 'typescript';

const EXTENSIONS = ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx'];
const MUTATORS = new Set(['copyWithin', 'fill', 'pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift', 'add', 'clear', 'delete', 'set']);
const REFLECTIVE = new Map([
  ['Object', new Set(['assign', 'defineProperty', 'defineProperties', 'setPrototypeOf', 'preventExtensions', 'seal', 'freeze'])],
  ['Reflect', new Set(['set', 'defineProperty', 'deleteProperty', 'setPrototypeOf'])],
]);
const CALLBACK_PARAM_POSITIONS = new Map([
  ['forEach', [0, 1]], ['map', [0]], ['flatMap', [0]], ['filter', [0]], ['find', [0]], ['findIndex', [0]],
  ['findLast', [0]], ['findLastIndex', [0]], ['some', [0]], ['every', [0]], ['reduce', [1]], ['reduceRight', [1]],
]);
const ASSIGNMENT_KINDS = new Set([
  ts.SyntaxKind.EqualsToken, ts.SyntaxKind.PlusEqualsToken, ts.SyntaxKind.MinusEqualsToken, ts.SyntaxKind.AsteriskEqualsToken,
  ts.SyntaxKind.AsteriskAsteriskEqualsToken, ts.SyntaxKind.SlashEqualsToken, ts.SyntaxKind.PercentEqualsToken,
  ts.SyntaxKind.LessThanLessThanEqualsToken, ts.SyntaxKind.GreaterThanGreaterThanEqualsToken, ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.AmpersandEqualsToken, ts.SyntaxKind.BarEqualsToken, ts.SyntaxKind.CaretEqualsToken, ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken, ts.SyntaxKind.QuestionQuestionEqualsToken,
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function unwrap(node) {
  let current = node;
  while (current && (
    ts.isParenthesizedExpression(current)
    || ts.isAsExpression(current)
    || ts.isTypeAssertionExpression(current)
    || ts.isNonNullExpression(current)
  )) current = current.expression;
  return current;
}

function literal(node) {
  return node && ts.isStringLiteralLike(node) ? node.text : null;
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
  invariant((parsed.parseDiagnostics ?? []).length === 0, `${fileName}: could not parse renderer alias hardening input`);
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
      invariant(specifier, `${fileName}: non-literal dynamic import cannot prove renderer alias closure`);
      add(specifier);
    } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require') {
      const specifier = literal(node.arguments[0]);
      invariant(specifier, `${fileName}: non-literal require cannot prove renderer alias closure`);
      add(specifier);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return output;
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

function symbolAt(checker, node) {
  if (!node) return null;
  return unalias(checker, checker.getSymbolAtLocation(node));
}

function typeIsProtected(checker, type, protectedSymbols, seen = new Set()) {
  if (!type || seen.has(type)) return false;
  seen.add(type);
  const symbol = unalias(checker, type.symbol);
  const alias = unalias(checker, type.aliasSymbol);
  if ((symbol && protectedSymbols.has(symbol)) || (alias && protectedSymbols.has(alias))) return true;
  if (type.isUnionOrIntersection?.() && type.types.some(entry => typeIsProtected(checker, entry, protectedSymbols, seen))) return true;
  for (const argument of [...(type.typeArguments ?? []), ...(type.aliasTypeArguments ?? [])]) {
    if (typeIsProtected(checker, argument, protectedSymbols, seen)) return true;
  }
  const constraint = checker.getBaseConstraintOfType(type);
  return Boolean(constraint && constraint !== type && typeIsProtected(checker, constraint, protectedSymbols, seen));
}

function bindingSymbols(checker, name, output = new Set()) {
  if (ts.isIdentifier(name)) {
    const symbol = symbolAt(checker, name);
    if (symbol) output.add(symbol);
    return output;
  }
  for (const element of name.elements ?? []) if (ts.isBindingElement(element)) bindingSymbols(checker, element.name, output);
  return output;
}

function declarationForCallable(checker, expression) {
  const value = unwrap(expression);
  if (ts.isArrowFunction(value) || ts.isFunctionExpression(value) || ts.isFunctionDeclaration(value) || ts.isMethodDeclaration(value)) return value;
  const signatures = checker.getSignaturesOfType(checker.getTypeAtLocation(value), ts.SignatureKind.Call);
  return signatures.map(signature => signature.declaration).find(Boolean) ?? null;
}

function propertyKey(element) {
  const key = element.propertyName ?? element.name;
  if (ts.isIdentifier(key) || ts.isStringLiteralLike(key) || ts.isNumericLiteral(key)) return key.text;
  return null;
}

function variableInitializerForSymbol(symbol) {
  for (const declaration of symbol?.declarations ?? []) {
    if (ts.isVariableDeclaration(declaration) && declaration.initializer) return declaration.initializer;
    if (ts.isBindingElement(declaration)) {
      const pattern = declaration.parent;
      const variable = pattern?.parent;
      if (ts.isVariableDeclaration(variable) && variable.initializer) return { binding: declaration, initializer: variable.initializer };
    }
  }
  return null;
}

function makeAnalyzer(checker, protectedSymbols, fileName) {
  const forwardingCache = new Map();
  const forwardingActive = new Set();

  function parameterSymbols(declaration) {
    return (declaration.parameters ?? []).map(parameter => bindingSymbols(checker, parameter.name));
  }

  function parameterProvenance(expression, declaration, seenCalls = new Set()) {
    const value = unwrap(expression);
    const parameters = parameterSymbols(declaration);
    if (!value) return new Set();
    if (ts.isIdentifier(value)) {
      const symbol = symbolAt(checker, value);
      const output = new Set();
      parameters.forEach((symbols, index) => { if (symbol && symbols.has(symbol)) output.add(index); });
      return output;
    }
    if (ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value)) return parameterProvenance(value.expression, declaration, seenCalls);
    if (ts.isAwaitExpression(value)) return parameterProvenance(value.expression, declaration, seenCalls);
    if (ts.isConditionalExpression(value)) {
      return new Set([...parameterProvenance(value.whenTrue, declaration, seenCalls), ...parameterProvenance(value.whenFalse, declaration, seenCalls)]);
    }
    if (ts.isBinaryExpression(value)) {
      if (value.operatorToken.kind === ts.SyntaxKind.CommaToken) return parameterProvenance(value.right, declaration, seenCalls);
      if ([ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.QuestionQuestionToken].includes(value.operatorToken.kind)) {
        return new Set([...parameterProvenance(value.left, declaration, seenCalls), ...parameterProvenance(value.right, declaration, seenCalls)]);
      }
    }
    if (ts.isCallExpression(value)) {
      const signature = checker.getResolvedSignature(value);
      const inner = signature?.declaration;
      if (!inner || seenCalls.has(inner)) return new Set();
      const nextSeen = new Set(seenCalls).add(inner);
      const forwarded = forwardedParameters(inner, nextSeen);
      const output = new Set();
      for (const index of forwarded) {
        const argument = value.arguments[index];
        if (argument) for (const outerIndex of parameterProvenance(argument, declaration, nextSeen)) output.add(outerIndex);
      }
      return output;
    }
    return new Set();
  }

  function forwardedParameters(declaration, seenCalls = new Set()) {
    if (forwardingCache.has(declaration)) return forwardingCache.get(declaration);
    if (forwardingActive.has(declaration)) return new Set();
    forwardingActive.add(declaration);
    const output = new Set();
    if (ts.isArrowFunction(declaration) && !ts.isBlock(declaration.body)) {
      for (const index of parameterProvenance(declaration.body, declaration, seenCalls)) output.add(index);
    } else if (declaration.body) {
      function visit(node) {
        if (node !== declaration && (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node))) return;
        if (ts.isReturnStatement(node) && node.expression) {
          for (const index of parameterProvenance(node.expression, declaration, seenCalls)) output.add(index);
          return;
        }
        ts.forEachChild(node, visit);
      }
      visit(declaration.body);
    }
    forwardingActive.delete(declaration);
    forwardingCache.set(declaration, output);
    return output;
  }

  function bindingElementSource(binding, tainted, seen) {
    const pattern = binding.parent;
    const variable = pattern?.parent;
    if (!ts.isVariableDeclaration(variable) || !variable.initializer) return false;
    if (ts.isObjectBindingPattern(pattern) || ts.isArrayBindingPattern(pattern)) return isProtected(variable.initializer, tainted, seen);
    return false;
  }

  function identifierProtected(identifier, tainted, seen) {
    const symbol = symbolAt(checker, identifier);
    if (!symbol) return false;
    if (tainted.has(symbol)) return true;
    if (typeIsProtected(checker, checker.getTypeAtLocation(identifier), protectedSymbols)) return true;
    if (seen.has(symbol)) return false;
    const nextSeen = new Set(seen).add(symbol);
    for (const declaration of symbol.declarations ?? []) {
      if (ts.isVariableDeclaration(declaration) && declaration.initializer && isProtected(declaration.initializer, tainted, nextSeen)) return true;
      if (ts.isBindingElement(declaration) && bindingElementSource(declaration, tainted, nextSeen)) return true;
      if (ts.isParameter(declaration) && typeIsProtected(checker, checker.getTypeAtLocation(declaration), protectedSymbols)) return true;
      if (ts.isPropertyDeclaration(declaration) && typeIsProtected(checker, checker.getTypeAtLocation(declaration), protectedSymbols)) return true;
    }
    return false;
  }

  function isProtected(expression, tainted = new Set(), seen = new Set()) {
    if (!expression) return false;
    const value = unwrap(expression);
    if (ts.isIdentifier(value)) return identifierProtected(value, tainted, seen);
    if (typeIsProtected(checker, checker.getTypeAtLocation(value), protectedSymbols)) return true;
    if (ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value)) return isProtected(value.expression, tainted, seen);
    if (ts.isAwaitExpression(value)) return isProtected(value.expression, tainted, seen);
    if (ts.isConditionalExpression(value)) return isProtected(value.whenTrue, tainted, seen) || isProtected(value.whenFalse, tainted, seen);
    if (ts.isBinaryExpression(value)) {
      if (value.operatorToken.kind === ts.SyntaxKind.CommaToken) return isProtected(value.right, tainted, seen);
      if ([ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.QuestionQuestionToken].includes(value.operatorToken.kind)) {
        return isProtected(value.left, tainted, seen) || isProtected(value.right, tainted, seen);
      }
    }
    if (ts.isCallExpression(value)) {
      const signature = checker.getResolvedSignature(value);
      const declaration = signature?.declaration;
      if (!declaration) return false;
      for (const index of forwardedParameters(declaration)) {
        if (isProtected(value.arguments[index], tainted, seen)) return true;
      }
    }
    return false;
  }

  function globalObject(expression, seen = new Set()) {
    const value = unwrap(expression);
    if (ts.isIdentifier(value)) {
      if (REFLECTIVE.has(value.text)) return value.text;
      const symbol = symbolAt(checker, value);
      if (!symbol || seen.has(symbol)) return null;
      const next = new Set(seen).add(symbol);
      const declaration = variableInitializerForSymbol(symbol);
      if (declaration && !('binding' in declaration)) return globalObject(declaration, next);
    }
    const name = memberName(value);
    const owner = memberOwner(value);
    if (name && owner && ts.isIdentifier(owner) && owner.text === 'globalThis' && REFLECTIVE.has(name)) return name;
    return null;
  }

  function callableKind(expression, tainted = new Set(), seen = new Set()) {
    const value = unwrap(expression);
    const name = memberName(value);
    const owner = memberOwner(value);
    if (name && owner) {
      const global = globalObject(owner);
      if (global && REFLECTIVE.get(global)?.has(name)) return { kind: 'reflective', name: `${global}.${name}` };
      if (MUTATORS.has(name) && isProtected(owner, tainted)) return { kind: 'instance', name, owner };
    }
    if (ts.isIdentifier(value)) {
      const symbol = symbolAt(checker, value);
      if (!symbol || seen.has(symbol)) return null;
      const nextSeen = new Set(seen).add(symbol);
      for (const declaration of symbol.declarations ?? []) {
        if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
          const init = unwrap(declaration.initializer);
          if (ts.isCallExpression(init) && memberName(init.expression) === 'bind') {
            const inner = callableKind(memberOwner(init.expression), tainted, nextSeen);
            if (inner) return { ...inner, boundThis: init.arguments[0] ?? null, boundArgs: [...init.arguments].slice(1) };
          }
          const direct = callableKind(init, tainted, nextSeen);
          if (direct) return direct;
        }
        if (ts.isBindingElement(declaration)) {
          const pattern = declaration.parent;
          const variable = pattern?.parent;
          if (!ts.isVariableDeclaration(variable) || !variable.initializer || !ts.isObjectBindingPattern(pattern)) continue;
          const key = propertyKey(declaration);
          const global = globalObject(variable.initializer);
          if (global && key && REFLECTIVE.get(global)?.has(key)) return { kind: 'reflective', name: `${global}.${key}` };
          if (key && MUTATORS.has(key) && isProtected(variable.initializer, tainted)) return { kind: 'instance', name: key, owner: variable.initializer };
        }
      }
    }
    return null;
  }

  function packedArgument(expression, index, seen = new Set()) {
    const value = unwrap(expression);
    if (!value) return null;
    if (ts.isArrayLiteralExpression(value)) {
      const element = value.elements[index];
      return element && !ts.isOmittedExpression(element) && !ts.isSpreadElement(element) ? element : null;
    }
    if (ts.isIdentifier(value)) {
      const symbol = symbolAt(checker, value);
      if (!symbol || seen.has(symbol)) return null;
      const next = new Set(seen).add(symbol);
      const declaration = variableInitializerForSymbol(symbol);
      if (declaration && !('binding' in declaration)) return packedArgument(declaration, index, next);
    }
    return null;
  }

  function reflectiveTarget(call, invocationName, callable) {
    const boundArgs = callable.boundArgs ?? [];
    if (boundArgs.length) return boundArgs[0] ?? null;
    if (invocationName === 'call') return call.arguments[1] ?? null;
    if (invocationName === 'apply') return packedArgument(call.arguments[1], 0);
    return call.arguments[0] ?? null;
  }

  function instanceTarget(call, invocationName, callable) {
    if (callable.boundThis) return callable.boundThis;
    if (invocationName === 'call' || invocationName === 'apply') return call.arguments[0] ?? null;
    return callable.owner ?? null;
  }

  function reject(kind) {
    throw new Error(`${fileName}: ${kind} of renderer-reachable protected simulation state is not allowed`);
  }

  const scannedCallbacks = new Set();

  function scanFunction(declaration, tainted) {
    if (!declaration?.body) return;
    const key = `${declaration.pos}:${[...tainted].map(symbol => symbol?.name ?? '').sort().join(',')}`;
    if (scannedCallbacks.has(key)) return;
    scannedCallbacks.add(key);
    scanNode(declaration.body, tainted);
  }

  function scanProtectedCallback(call, expression, tainted) {
    const method = memberName(expression);
    const owner = memberOwner(expression);
    const positions = method ? CALLBACK_PARAM_POSITIONS.get(method) : null;
    if (!owner || !positions || !isProtected(owner, tainted)) return;
    for (const argument of call.arguments) {
      const declaration = declarationForCallable(checker, argument);
      if (!declaration) continue;
      const callbackTaint = new Set(tainted);
      for (const position of positions) {
        const parameter = declaration.parameters?.[position];
        if (parameter) for (const symbol of bindingSymbols(checker, parameter.name)) callbackTaint.add(symbol);
      }
      scanFunction(declaration, callbackTaint);
    }
  }

  function scanNode(node, tainted = new Set()) {
    if (ts.isBinaryExpression(node) && ASSIGNMENT_KINDS.has(node.operatorToken.kind)) {
      const target = unwrap(node.left);
      if ((ts.isPropertyAccessExpression(target) || ts.isElementAccessExpression(target)) && isProtected(target, tainted)) reject('direct mutation');
    }
    if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator)) {
      const target = unwrap(node.operand);
      if ((ts.isPropertyAccessExpression(target) || ts.isElementAccessExpression(target)) && isProtected(target, tainted)) reject('update mutation');
    }
    if (ts.isDeleteExpression(node) && isProtected(node.expression, tainted)) reject('delete mutation');
    if (ts.isForOfStatement(node) && isProtected(node.expression, tainted)) {
      const loopTaint = new Set(tainted);
      if (ts.isVariableDeclarationList(node.initializer)) {
        for (const declaration of node.initializer.declarations) for (const symbol of bindingSymbols(checker, declaration.name)) loopTaint.add(symbol);
      }
      scanNode(node.statement, loopTaint);
      return;
    }
    if (ts.isCallExpression(node)) {
      const expression = unwrap(node.expression);
      const name = memberName(expression);
      const owner = memberOwner(expression);
      if (owner && MUTATORS.has(name) && isProtected(owner, tainted)) reject(`mutating method ${name}()`);

      const invocationName = name === 'call' || name === 'apply' ? name : null;
      const callableExpression = invocationName && owner ? owner : expression;
      const callable = callableKind(callableExpression, tainted);
      if (callable?.kind === 'reflective') {
        const target = reflectiveTarget(node, invocationName, callable);
        if (target && isProtected(target, tainted)) reject(`${callable.name} mutation`);
      }
      if (callable?.kind === 'instance') {
        const target = instanceTarget(node, invocationName, callable);
        if (target && isProtected(target, tainted)) reject(`aliased mutating method ${callable.name}()`);
      }
      scanProtectedCallback(node, expression, tainted);
    }
    ts.forEachChild(node, child => scanNode(child, tainted));
  }

  return { scanNode };
}

export async function evaluateRendererAliasHardening(rule, { root = process.cwd() } = {}) {
  invariant(rule?.file && rule?.module, 'renderer alias hardening requires renderer file and protected module');
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
  const program = ts.createProgram({
    rootNames: roots,
    options: {
      target: ts.ScriptTarget.Latest,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      allowJs: true,
      checkJs: false,
      noEmit: true,
      skipLibCheck: true,
    },
  });
  const checker = program.getTypeChecker();
  const protectedSource = program.getSourceFile(resolve(root, protectedModule.fileName));
  invariant(protectedSource, `${rule.id}: protected module missing from semantic program`);
  const moduleSymbol = checker.getSymbolAtLocation(protectedSource);
  invariant(moduleSymbol, `${rule.id}: protected module has no semantic symbol`);
  const configured = new Set(rule.readOnlyStateTypes ?? []);
  const protectedSymbols = new Set(checker.getExportsOfModule(moduleSymbol).filter(symbol => configured.has(symbol.name)).map(symbol => unalias(checker, symbol)));
  invariant(protectedSymbols.size === configured.size, `${rule.id}: could not resolve readOnlyStateTypes for alias hardening`);

  for (const fileName of files.keys()) {
    const ast = program.getSourceFile(resolve(root, fileName));
    invariant(ast, `${rule.id}: ${fileName} missing from semantic program`);
    makeAnalyzer(checker, protectedSymbols, fileName).scanNode(ast);
  }
  return { status: 'passed', filesChecked: files.size };
}

export async function checkRendererAliasHardeningFromConfig(configPath = 'agent/architecture-invariants.json', { root = process.cwd() } = {}) {
  const config = JSON.parse(await readFile(resolve(root, configPath), 'utf8'));
  const rule = config.rules?.find(entry => entry.id === 'renderer-sim-import-boundary');
  invariant(rule, 'renderer-sim-import-boundary rule is missing');
  return evaluateRendererAliasHardening(rule, { root });
}