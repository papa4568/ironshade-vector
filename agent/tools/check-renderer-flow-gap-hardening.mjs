import { readFile, realpath } from 'node:fs/promises';
import { extname, posix, resolve } from 'node:path';
import ts from 'typescript';

const EXT = ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx'];
const ITER = new Map([
  ['forEach', [0, 2]], ['map', [0, 2]], ['flatMap', [0, 2]], ['filter', [0, 2]], ['find', [0, 2]], ['findIndex', [0, 2]],
  ['findLast', [0, 2]], ['findLastIndex', [0, 2]], ['some', [0, 2]], ['every', [0, 2]], ['reduce', [1, 3]], ['reduceRight', [1, 3]],
]);
const MUTATORS = new Set(['copyWithin', 'fill', 'pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift', 'add', 'clear', 'delete', 'set']);
const REFLECT = new Map([['Object', new Set(['assign', 'defineProperty', 'defineProperties', 'setPrototypeOf', 'preventExtensions', 'seal', 'freeze'])], ['Reflect', new Set(['set', 'defineProperty', 'deleteProperty', 'setPrototypeOf'])]]);
const ASSIGN = new Set([ts.SyntaxKind.EqualsToken, ts.SyntaxKind.PlusEqualsToken, ts.SyntaxKind.MinusEqualsToken, ts.SyntaxKind.AsteriskEqualsToken, ts.SyntaxKind.AsteriskAsteriskEqualsToken, ts.SyntaxKind.SlashEqualsToken, ts.SyntaxKind.PercentEqualsToken, ts.SyntaxKind.LessThanLessThanEqualsToken, ts.SyntaxKind.GreaterThanGreaterThanEqualsToken, ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken, ts.SyntaxKind.AmpersandEqualsToken, ts.SyntaxKind.BarEqualsToken, ts.SyntaxKind.CaretEqualsToken, ts.SyntaxKind.BarBarEqualsToken, ts.SyntaxKind.AmpersandAmpersandEqualsToken, ts.SyntaxKind.QuestionQuestionEqualsToken]);

const fail = (condition, message) => { if (!condition) throw new Error(message); };
function unwrap(node) { let value = node; while (value && (ts.isParenthesizedExpression(value) || ts.isAsExpression(value) || ts.isTypeAssertionExpression(value) || ts.isNonNullExpression(value))) value = value.expression; return value; }
function text(node) { return node && ts.isStringLiteralLike(node) ? node.text : null; }
function member(node) { const value = unwrap(node); if (ts.isPropertyAccessExpression(value)) return value.name.text; if (ts.isElementAccessExpression(value) && value.argumentExpression) { const key = unwrap(value.argumentExpression); if (ts.isStringLiteralLike(key) || ts.isNumericLiteral(key)) return key.text; } return null; }
function owner(node) { const value = unwrap(node); return ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value) ? unwrap(value.expression) : null; }
function kind(file) { const ext = extname(file).toLowerCase(); return ext === '.tsx' ? ts.ScriptKind.TSX : ext === '.jsx' ? ts.ScriptKind.JSX : ['.js', '.mjs'].includes(ext) ? ts.ScriptKind.JS : ts.ScriptKind.TS; }
function parse(source, file) { const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind(file)); fail(!(ast.parseDiagnostics ?? []).length, `${file}: could not parse renderer flow-gap hardening input`); return ast; }

function candidates(specifier, importer) {
  const normalized = specifier.replace(/\\/g, '/');
  if (!normalized.startsWith('.')) return [];
  const base = posix.normalize(posix.join(posix.dirname(importer), normalized));
  fail(base !== '..' && !base.startsWith('../'), `${importer}: dependency ${specifier} escapes architecture root`);
  return EXT.some(ext => base.endsWith(ext)) ? [base] : [base, ...EXT.map(ext => `${base}${ext}`), ...EXT.map(ext => posix.join(base, `index${ext}`))];
}
async function resolveLocal(root, specifier, importer) {
  for (const file of candidates(specifier, importer)) try { return { file, source: await readFile(resolve(root, file), 'utf8'), real: await realpath(resolve(root, file)) }; } catch (error) { if (!error || typeof error !== 'object' || !['ENOENT', 'ENOTDIR'].includes(error.code)) throw error; }
  return null;
}
function dependencies(ast, file) {
  const output = [];
  const add = value => { if (value) output.push(value); };
  function visit(node) {
    if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) add(text(node.moduleSpecifier));
    else if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier) add(text(node.moduleSpecifier));
    else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) add(text(node.moduleReference.expression));
    else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) { const value = text(node.arguments[0]); fail(value, `${file}: non-literal dynamic import cannot prove renderer flow-gap closure`); add(value); }
    else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require') { const value = text(node.arguments[0]); fail(value, `${file}: non-literal require cannot prove renderer flow-gap closure`); add(value); }
    ts.forEachChild(node, visit);
  }
  visit(ast); return output;
}
function unalias(checker, symbol) { let value = symbol; const seen = new Set(); while (value && (value.flags & ts.SymbolFlags.Alias) && !seen.has(value)) { seen.add(value); value = checker.getAliasedSymbol(value); } return value; }
const symbolAt = (checker, node) => node ? unalias(checker, checker.getSymbolAtLocation(node)) : null;
function bindingSymbols(checker, name, output = new Set()) { if (ts.isIdentifier(name)) { const symbol = symbolAt(checker, name); if (symbol) output.add(symbol); } else for (const element of name.elements ?? []) if (ts.isBindingElement(element)) bindingSymbols(checker, element.name, output); return output; }
function protectedType(checker, type, protectedSymbols, seen = new Set()) {
  if (!type || seen.has(type)) return false; seen.add(type);
  if (protectedSymbols.has(unalias(checker, type.symbol)) || protectedSymbols.has(unalias(checker, type.aliasSymbol))) return true;
  if (type.isUnionOrIntersection?.() && type.types.some(item => protectedType(checker, item, protectedSymbols, seen))) return true;
  for (const item of [...(type.typeArguments ?? []), ...(type.aliasTypeArguments ?? [])]) if (protectedType(checker, item, protectedSymbols, seen)) return true;
  const constraint = checker.getBaseConstraintOfType(type); return Boolean(constraint && constraint !== type && protectedType(checker, constraint, protectedSymbols, seen));
}

function analyzer(checker, protectedSymbols, file, ast) {
  const forwardCache = new Map(); const forwardActive = new Set(); const scanned = new Set();
  function sources(symbol) {
    const result = [];
    for (const declaration of symbol?.declarations ?? []) if (ts.isVariableDeclaration(declaration) && declaration.initializer) result.push(declaration.initializer);
    function visit(node) { if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(unwrap(node.left)) && symbolAt(checker, unwrap(node.left)) === symbol) result.push(node.right); ts.forEachChild(node, visit); }
    visit(ast); return result;
  }
  const params = declaration => (declaration.parameters ?? []).map(parameter => bindingSymbols(checker, parameter.name));
  function provenance(expression, declaration, seenSymbols = new Set()) {
    const value = unwrap(expression); if (!value) return new Set(); const parameterSets = params(declaration);
    if (ts.isIdentifier(value)) {
      const symbol = symbolAt(checker, value); const output = new Set(); parameterSets.forEach((set, index) => { if (symbol && set.has(symbol)) output.add(index); });
      if (!symbol || seenSymbols.has(symbol)) return output; const next = new Set(seenSymbols).add(symbol);
      for (const source of sources(symbol)) for (const index of provenance(source, declaration, next)) output.add(index); return output;
    }
    if (ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value) || ts.isAwaitExpression(value)) return provenance(value.expression, declaration, seenSymbols);
    if (ts.isConditionalExpression(value)) return new Set([...provenance(value.whenTrue, declaration, seenSymbols), ...provenance(value.whenFalse, declaration, seenSymbols)]);
    if (ts.isBinaryExpression(value) && value.operatorToken.kind === ts.SyntaxKind.CommaToken) return provenance(value.right, declaration, seenSymbols);
    if (ts.isCallExpression(value)) { const inner = checker.getResolvedSignature(value)?.declaration; const output = new Set(); if (!inner) return output; for (const index of forwarded(inner)) if (value.arguments[index]) for (const outer of provenance(value.arguments[index], declaration, seenSymbols)) output.add(outer); return output; }
    return new Set();
  }
  function forwarded(declaration) {
    if (forwardCache.has(declaration)) return forwardCache.get(declaration); if (forwardActive.has(declaration)) return new Set(); forwardActive.add(declaration); const output = new Set();
    const collect = expression => { for (const index of provenance(expression, declaration)) output.add(index); };
    if (ts.isArrowFunction(declaration) && !ts.isBlock(declaration.body)) collect(declaration.body); else if (declaration.body) { function visit(node) { if (node !== declaration && (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node))) return; if (ts.isReturnStatement(node) && node.expression) collect(node.expression); else ts.forEachChild(node, visit); } visit(declaration.body); }
    forwardActive.delete(declaration); forwardCache.set(declaration, output); return output;
  }
  function isProtected(expression, tainted = new Set(), seen = new Set()) {
    const value = unwrap(expression); if (!value) return false;
    if (ts.isIdentifier(value)) { const symbol = symbolAt(checker, value); if (!symbol) return false; if (tainted.has(symbol) || protectedType(checker, checker.getTypeAtLocation(value), protectedSymbols)) return true; if (seen.has(symbol)) return false; return sources(symbol).some(source => isProtected(source, tainted, new Set(seen).add(symbol))); }
    if (protectedType(checker, checker.getTypeAtLocation(value), protectedSymbols)) return true;
    if (ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value) || ts.isAwaitExpression(value)) return isProtected(value.expression, tainted, seen);
    if (ts.isCallExpression(value)) { const declaration = checker.getResolvedSignature(value)?.declaration; return Boolean(declaration && [...forwarded(declaration)].some(index => isProtected(value.arguments[index], tainted, seen))); }
    return false;
  }
  function rootSymbol(expression) { let value = unwrap(expression); while (ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value)) value = unwrap(value.expression); return ts.isIdentifier(value) ? symbolAt(checker, value) : null; }
  function aliases(symbol) {
    const result = new Set([symbol]); let changed = true;
    while (changed) { changed = false; function visit(node) { let left = null; let right = null; if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) { left = node.name; right = node.initializer; } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(unwrap(node.left))) { left = unwrap(node.left); right = node.right; } const leftSymbol = left ? symbolAt(checker, left) : null; const rightSymbol = right ? rootSymbol(right) : null; if (leftSymbol && rightSymbol && result.has(rightSymbol) && !result.has(leftSymbol)) { result.add(leftSymbol); changed = true; } ts.forEachChild(node, visit); } visit(ast); }
    return result;
  }
  function hasWrites(symbol) {
    const names = aliases(symbol); let found = false;
    function visit(node) { if (found) return; if (ts.isBinaryExpression(node) && ASSIGN.has(node.operatorToken.kind)) { const target = unwrap(node.left); const targetSymbol = rootSymbol(target); const aliasCreation = node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(target) && rootSymbol(node.right) && names.has(rootSymbol(node.right)); if (targetSymbol && names.has(targetSymbol) && !aliasCreation) { found = true; return; } } if (ts.isCallExpression(node)) { const name = member(node.expression); const target = owner(node.expression); if (target && name && MUTATORS.has(name) && names.has(rootSymbol(target))) { found = true; return; } } ts.forEachChild(node, visit); }
    visit(ast); return found;
  }
  function stablePack(expression, seen = new Set()) {
    const value = unwrap(expression); if (!value) return false;
    if (ts.isArrayLiteralExpression(value)) return value.elements.every(element => !ts.isSpreadElement(element) || stablePack(element.expression, seen));
    if (!ts.isIdentifier(value)) return false; const symbol = symbolAt(checker, value); if (!symbol || seen.has(symbol) || hasWrites(symbol)) return false;
    const declaration = (symbol.declarations ?? []).find(item => ts.isVariableDeclaration(item) && item.initializer); return Boolean(declaration && stablePack(declaration.initializer, new Set(seen).add(symbol)));
  }
  function packFirst(expression, seen = new Set()) {
    const value = unwrap(expression); if (ts.isArrayLiteralExpression(value)) { const first = value.elements[0]; return first && !ts.isSpreadElement(first) && !ts.isOmittedExpression(first) ? first : null; }
    if (!ts.isIdentifier(value)) return null; const symbol = symbolAt(checker, value); if (!symbol || seen.has(symbol) || hasWrites(symbol)) return null; const declaration = (symbol.declarations ?? []).find(item => ts.isVariableDeclaration(item) && item.initializer); return declaration ? packFirst(declaration.initializer, new Set(seen).add(symbol)) : null;
  }
  function globalObject(expression, seen = new Set()) { const value = unwrap(expression); if (ts.isIdentifier(value)) { if (REFLECT.has(value.text)) return value.text; const symbol = symbolAt(checker, value); if (!symbol || seen.has(symbol)) return null; for (const source of sources(symbol)) { const result = globalObject(source, new Set(seen).add(symbol)); if (result) return result; } return null; } const name = member(value); const target = owner(value); return name && target && ts.isIdentifier(target) && target.text === 'globalThis' && REFLECT.has(name) ? name : null; }
  function reflective(expression, seen = new Set()) { const value = unwrap(expression); const name = member(value); const target = owner(value); if (name && target) { const global = globalObject(target); if (global && REFLECT.get(global)?.has(name)) return `${global}.${name}`; } if (!ts.isIdentifier(value)) return null; const symbol = symbolAt(checker, value); if (!symbol || seen.has(symbol)) return null; for (const source of sources(symbol)) { const result = reflective(source, new Set(seen).add(symbol)); if (result) return result; } return null; }
  function iteration(expression, tainted, seen = new Set()) {
    const value = unwrap(expression); const name = member(value); const target = owner(value); if (name && target && ITER.has(name) && isProtected(target, tainted)) return { method: name, receiver: target, bound: false };
    if (!ts.isIdentifier(value)) return null; const symbol = symbolAt(checker, value); if (!symbol || seen.has(symbol)) return null;
    for (const source of sources(symbol)) { const item = unwrap(source); if (ts.isCallExpression(item) && member(item.expression) === 'bind') { const inner = iteration(owner(item.expression), tainted, new Set(seen).add(symbol)); if (inner && item.arguments[0] && isProtected(item.arguments[0], tainted)) return { ...inner, receiver: item.arguments[0], bound: true }; } const direct = iteration(item, tainted, new Set(seen).add(symbol)); if (direct) return direct; }
    return null;
  }
  function callable(expression) { const value = unwrap(expression); if (ts.isArrowFunction(value) || ts.isFunctionExpression(value) || ts.isFunctionDeclaration(value) || ts.isMethodDeclaration(value)) return value; return checker.getSignaturesOfType(checker.getTypeAtLocation(value), ts.SignatureKind.Call).map(signature => signature.declaration).find(Boolean) ?? null; }
  function scanCallback(declaration, tainted) { if (!declaration?.body) return; const key = `${declaration.pos}:${[...tainted].map(symbol => symbol?.name ?? '').sort().join(',')}`; if (scanned.has(key)) return; scanned.add(key); scan(declaration.body, tainted); }
  function scanIteration(call, tainted) {
    const expression = unwrap(call.expression); const invocation = member(expression); const invocationOwner = owner(expression); let info = null; let callback = null;
    if ((invocation === 'call' || invocation === 'apply') && invocationOwner) { info = iteration(invocationOwner, tainted); const receiver = call.arguments[0]; if (!info || !receiver || !isProtected(receiver, tainted)) return; if (invocation === 'call') callback = call.arguments[1]; else { fail(stablePack(call.arguments[1]), `${file}: aliased ${info.method}.apply argument pack cannot be proven stable`); callback = packFirst(call.arguments[1]); fail(callback, `${file}: aliased ${info.method}.apply callback cannot be proven`); } }
    else { info = iteration(expression, tainted); if (!info?.bound) return; callback = call.arguments[0]; }
    const declaration = callback ? callable(callback) : null; if (!declaration) return; const next = new Set(tainted); for (const index of ITER.get(info.method) ?? []) { const parameter = declaration.parameters?.[index]; if (parameter) for (const symbol of bindingSymbols(checker, parameter.name)) next.add(symbol); } scanCallback(declaration, next);
  }
  const reject = kind => { throw new Error(`${file}: ${kind} of renderer-reachable protected simulation state is not allowed`); };
  function scan(node, tainted = new Set()) {
    if (ts.isBinaryExpression(node) && ASSIGN.has(node.operatorToken.kind)) { const target = unwrap(node.left); if ((ts.isPropertyAccessExpression(target) || ts.isElementAccessExpression(target)) && isProtected(target, tainted)) reject('direct mutation'); }
    if (ts.isCallExpression(node)) { const name = member(node.expression); const target = owner(node.expression); if (target && name && MUTATORS.has(name) && isProtected(target, tainted)) reject(`mutating method ${name}()`); if (name === 'apply' && target) { const method = reflective(target); if (method) fail(stablePack(node.arguments[1]), `${file}: ${method}.apply argument pack cannot be proven stable`); } scanIteration(node, tainted); }
    ts.forEachChild(node, child => scan(child, tainted));
  }
  return scan;
}

export async function evaluateRendererFlowGapHardening(rule, { root = process.cwd() } = {}) {
  fail(rule?.file && rule?.module, 'renderer flow-gap hardening requires renderer file and protected module');
  const protectedModule = await resolveLocal(root, rule.module, rule.file); fail(protectedModule, `${rule.id}: protected module ${rule.module} could not be resolved`);
  const owners = new Set(Object.keys(rule.mutableStateOwnerFiles ?? {})); const queue = [rule.file]; const files = new Map();
  while (queue.length) { const file = queue.shift(); if (files.has(file)) continue; const source = await readFile(resolve(root, file), 'utf8'); const ast = parse(source, file); files.set(file, ast); for (const specifier of dependencies(ast, file)) { const resolved = await resolveLocal(root, specifier, file); if (resolved && resolved.real !== protectedModule.real && !owners.has(resolved.file) && !files.has(resolved.file)) queue.push(resolved.file); } }
  const program = ts.createProgram({ rootNames: [...files.keys(), protectedModule.file].map(file => resolve(root, file)), options: { target: ts.ScriptTarget.Latest, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, allowJs: true, checkJs: false, noEmit: true, skipLibCheck: true } });
  const checker = program.getTypeChecker(); const protectedSource = program.getSourceFile(resolve(root, protectedModule.file)); fail(protectedSource, `${rule.id}: protected module missing from semantic program`); const moduleSymbol = checker.getSymbolAtLocation(protectedSource); fail(moduleSymbol, `${rule.id}: protected module has no semantic symbol`);
  const configured = new Set(rule.readOnlyStateTypes ?? []); const protectedSymbols = new Set(checker.getExportsOfModule(moduleSymbol).filter(symbol => configured.has(symbol.name)).map(symbol => unalias(checker, symbol))); fail(protectedSymbols.size === configured.size, `${rule.id}: could not resolve readOnlyStateTypes for flow-gap hardening`);
  for (const file of files.keys()) { const ast = program.getSourceFile(resolve(root, file)); fail(ast, `${rule.id}: ${file} missing from semantic program`); analyzer(checker, protectedSymbols, file, ast)(ast); }
  return { status: 'passed', filesChecked: files.size };
}

export async function checkRendererFlowGapHardeningFromConfig(configPath = 'agent/architecture-invariants.json', { root = process.cwd() } = {}) {
  const config = JSON.parse(await readFile(resolve(root, configPath), 'utf8')); const rule = config.rules?.find(entry => entry.id === 'renderer-sim-import-boundary'); fail(rule, 'renderer-sim-import-boundary rule is missing'); return evaluateRendererFlowGapHardening(rule, { root });
}
