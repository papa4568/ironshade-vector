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
 ²È="24°¹½Éµ…±¥é•‘MÁ•¥™¥•È¤¤ì(€…ÍÍ•ÉÐ (€€€¥µÁ½ÉÑ•‘A…Ñ €„ôô€œ¸¸œ€˜˜€…¥µÁ½ÉÑ•‘A…Ñ ¹ÍÑ…ÉÑÍ]¥Ñ  œ¸¸¼œ¤°(€€€€‘í¥µÁ½ÉÑ•É¥±•ôè±½…°µ½‘Õ±”‘•Á•¹‘•¹ä€‘íÍÁ•¥™¥•Éô•Í…Á•ÌÑ¡”…É¡¥Ñ•ÑÕÉ”É½½Ñ€°(€€¤ì((€½¹ÍÐ•áÁ±¥¥ÑáÑ•¹Í¥½¸€ô5=U1}aQ9M%=9L¹™¥¹¡…¹‘¥‘…Ñ”€ôø¥µÁ½ÉÑ•‘A…Ñ ¹•¹‘Í]¥Ñ ¡…¹‘¥‘…Ñ”¤¤€üü¹Õ±°ì(€½¹ÍÐ‰…Í•A…Ñ €ô•áÁ±¥¥ÑáÑ•¹Í¥½¸€ü¥µÁ½ÉÑ•‘A…Ñ ¹Í±¥” À°€µ•áÁ±¥¥ÑáÑ•¹Í¥½¸¹±•¹Ñ ¤€è¥µÁ½ÉÑ•‘A…Ñ ì(€½¹ÍÐ…¹‘¥‘…Ñ•Ì€ômtì(€¥˜€¡•áÁ±¥¥ÑáÑ•¹Í¥½¸¤…¹‘¥‘…Ñ•Ì¹ÁÕÍ ¡¥µÁ½ÉÑ•‘A…Ñ ¤ì(€™½È€¡½¹ÍÐ•áÑ•¹Í¥½¸½˜5=U1}aQ9M%=9L¤…¹‘¥‘…Ñ•Ì¹ÁÕÍ ¡€‘í‰…Í•A…Ñ¡ô‘í•áÑ•¹Í¥½¹õ€¤ì(€™½È€¡½¹ÍÐ•áÑ•¹Í¥½¸½˜5=U1}aQ9M%=9L¤…¹‘¥‘…Ñ•Ì¹ÁÕÍ ¡Á½Í¥à¹©½¥¸¡‰…Í•A…Ñ °¥¹‘•à‘í•áÑ•¹Í¥½¹õ€¤¤ì(€É•ÑÕÉ¸l¸¸¹¹•ÜM•Ð¡…¹‘¥‘…Ñ•Ì¥tì)ô()…Íå¹Œ™Õ¹Ñ¥½¸É•…‘=ÁÑ¥½¹…±M½ÕÉ”¡É½½Ð°™¥±•9…µ”°Í½ÕÉ•…¡”¤ì(€¥˜€¡Í½ÕÉ•…¡”¹¡…Ì¡™¥±•9…µ”¤¤É•ÑÕÉ¸Í½ÕÉ•…¡”¹•Ð¡™¥±•9…µ”¤ì(€ÑÉäì(€€€½¹ÍÐÍ½ÕÉ”€ô…Ý…¥ÐÉ•…‘¥±”¡É•Í½±Ù”¡É½½Ð°™¥±•9…µ”¤°€ÕÑ˜àœ¤ì(€€€Í½ÕÉ•…¡”¹Í•Ð¡™¥±•9…µ”°Í½ÕÉ”¤ì(€€€É•ÑÕÉ¸Í½ÕÉ”ì(€ô…Ñ €¡•ÉÉ½È¤ì(€€€¥˜€¡•ÉÉ½È€˜˜ÑåÁ•½˜•ÉÉ½È€ôôô€½‰©•Ðœ€˜˜l9=9Pœ°€9=Q%Ht¹¥¹±Õ‘•Ì¡•ÉÉ½È¹½‘”¤¤ì(€€€€€Í½ÕÉ•…¡”¹Í•Ð¡™¥±•9…µ”°¹Õ±°¤ì(€€€€€É•ÑÕÉ¸¹Õ±°ì(€€€ô(€€€Ñ¡É½Ü•ÉÉ½Èì(€ô)ô()…Íå¹Œ™Õ¹Ñ¥½¸É•Í½±Ù•1½…±5½‘Õ±•¥±”¡ÍÁ•¥™¥•È°¥µÁ½ÉÑ•É¥±”°É½½Ð°Í½ÕÉ•…¡”¤ì(€™½È€¡½¹ÍÐ…¹‘¥‘…Ñ”½˜±½…±5½‘Õ±•M½ÕÉ•…¹‘¥‘…Ñ•Ì¡ÍÁ•¥™¥•È°¥µÁ½ÉÑ•É¥±”¤¤ì(€€€½¹ÍÐÍ½ÕÉ”€ô…Ý…¥ÐÉ•…‘=ÁÑ¥½¹…±M½ÕÉ”¡É½½Ð°…¹‘¥‘…Ñ”°Í½ÕÉ•…¡”¤ì(€€€¥˜€¡Í½ÕÉ”€„ôô¹Õ±°¤ì(€€€€€É•ÑÕÉ¸ì(€€€€€€€™¥±•9…µ”è…¹‘¥‘…Ñ”°(€€€€€€€Í½ÕÉ”°(€€€€€€€É•…±A…Ñ è…Ý…¥ÐÉ•…±Á…Ñ ¡É•Í½±Ù”¡É½½Ð°…¹‘¥‘…Ñ”¤¤°(€€€€€ôì(€€€ô(€ô(€É•ÑÕÉ¸¹Õ±°ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸•Ù…±Õ…Ñ•9…µ•‘%µÁ½ÉÑ±½ÍÕÉ”¡ÉÕ±”°Í½ÕÉ”°ìÉ½½Ðô¤ì(€½¹ÍÐÅÕ•Õ”€ômÉÕ±”¹™¥±•tì(€½¹ÍÐÙ¥Í¥Ñ•€ô¹•ÜM•Ð ¤ì(€½¹ÍÐÍ½ÕÉ•…¡”€ô¹•Ü5…À¡mmÉÕ±”¹™¥±”°Í½ÕÉ•ut¤ì(€½¹ÍÐÁÉ½Ñ•Ñ•‘5½‘Õ±”€ô…Ý…¥ÐÉ•Í½±Ù•1½…±5½‘Õ±•¥±”¡ÉÕ±”¹µ½‘Õ±”°ÉÕ±”¹™¥±”°É½½Ð°Í½ÕÉ•…¡”¤ì(€±•ÐÉ½½Ñ%µÁ½ÉÑÌ€ô¹Õ±°ì((€Ý¡¥±”€¡ÅÕ•Õ”¹±•¹Ñ €ø€À¤ì(€€€½¹ÍÐ™¥±•9…µ”€ôÅÕ•Õ”¹Í¡¥™Ð ¤ì(€€€¥˜€¡Ù¥Í¥Ñ•¹¡…Ì¡™¥±•9…µ”¤¤½¹Ñ¥¹Õ”ì(€€€Ù¥Í¥Ñ•¹…‘¡™¥±•9…µ”¤ì((€€€½¹ÍÐÕÉÉ•¹ÑM½ÕÉ”€ô…Ý…¥ÐÉ•…‘=ÁÑ¥½¹…±M½ÕÉ”¡É½½Ð°™¥±•9…µ”°Í½ÕÉ•…¡”¤ì(€€€…ÍÍ•ÉÐ¡ÕÉÉ•¹ÑM½ÕÉ”€„ôô¹Õ±°°€‘íÉÕ±”¹¥‘ôè½Õ±¹½ÐÉ•…‘•Á•¹‘•¹ä€‘í™¥±•9…µ•õ€¤ì(€€€½¹ÍÐ¥µÁ½ÉÑÌ€ôÁ…ÉÍ•9…µ•‘%µÁ½ÉÑÌ¡ÕÉÉ•¹ÑM½ÕÉ”°ÉÕ±”¹µ½‘Õ±”°™¥±•9…µ”°ÉÕ±”¹™¥±”¤ì(€€€…ÍÍ•ÉÑ9…µ•‘%µÁ½ÉÑM•Ð¡ÉÕ±”°¥µÁ½ÉÑÌ°™¥±•9…µ”°ì(€€€€€É•ÅÕ¥É•á…Ðè™¥±•9…µ”€ôôôÉÕ±”¹™¥±”€˜˜ÉÕ±”¹É•ÅÕ¥É•á…Ð°(€€€€€…±±½Ý¹åQåÁ•Ìè™¥±•9…µ”€„ôôÉÕ±”¹™¥±”°(€€€ô¤ì(€€€¥˜€¡™¥±•9…µ”€ôôôÉÕ±”¹™¥±”¤É½½Ñ%µÁ½ÉÑÌ€ô¥µÁ½ÉÑÌì((€€€™½È€¡½¹ÍÐ‘•Á•¹‘•¹ä½˜½±±•Ñ1¥Ñ•É…±5½‘Õ±••Á•¹‘•¹¥•Ì¡ÕÉÉ•¹ÑM½ÕÉ”°™¥±•9…µ”¤¤ì(€€€€€¥˜€¡µ½‘Õ±•MÁ•¥™¥•É5…Ñ¡•Ì¡‘•Á•¹‘•¹ä°ÉÕ±”¹µ½‘Õ±”°™¥±•9…µ”°ÉÕ±”¹™¥±”¤¤½¹Ñ¥¹Õ”ì(€€€€€½¹ÍÐÉ•Í½±Ù•‘•Á•¹‘•¹ä€ô…Ý…¥ÐÉ•Í½±Ù•1½…±5½‘Õ±•¥±”¡‘•Á•¹‘•¹ä°™¥±•9…µ”°É½½Ð°Í½ÕÉ•…¡”¤ì(€€€€€¥˜€¡É•Í½±Ù•‘•Á•¹‘•¹ä€˜˜ÁÉ½Ñ•Ñ•‘5½‘Õ±”€˜˜É•Í½±Ù•‘•Á•¹‘•¹ä¹É•…±A…Ñ €ôôôÁÉ½Ñ•Ñ•‘5½‘Õ±”¹É•…±A…Ñ ¤ì(€€€€€€€Ñ¡É½Ü¹•ÜÉÉ½È (€€€€€€€€€€‘íÉÕ±”¹¥‘ôè€‘í™¥±•9…µ•ôèµ½‘Õ±”‘•Á•¹‘•¹ä€‘í‘•Á•¹‘•¹åôÉ•Í½±Ù•ÌÑ¼ÁÉ½Ñ•Ñ•µ½‘Õ±”€‘íÉÕ±”¹µ½‘Õ±•ôÑ¡É½Õ …¸…±Ñ•É¹…Ñ”Á…Ñ¡€°(€€€€€€€€¤ì(€€€€€ô(€€€€€¥˜€¡É•Í½±Ù•‘•Á•¹‘•¹ä€˜˜€…Ù¥Í¥Ñ•¹¡…Ì¡É•Í½±Ù•‘•Á•¹‘•¹ä¹™¥±•9…µ”¤¤ÅÕ•Õ”¹ÁÕÍ ¡É•Í½±Ù•‘•Á•¹‘•¹ä¹™¥±•9…µ”¤ì(€€€ô(€ô((€…ÍÍ•ÉÐ¡É½½Ñ%µÁ½ÉÑÌ€˜˜É½½Ñ%µÁ½ÉÑÌ¹±•¹Ñ €ø€À°€‘íÉÕ±”¹¥‘ôè•áÁ•Ñ•…¸¥µÁ½ÉÐ™É½´€‘íÉÕ±”¹µ½‘Õ±•õ€¤ì(€É•ÑÕÉ¸É½½Ñ%µÁ½ÉÑÌì)ô()…Íå¹Œ™Õ¹Ñ¥½¸…ÍÍ•ÉÑ9½½É‰¥‘‘•¹5½‘Õ±••Á•¹‘•¹å±½ÍÕÉ”¡ÉÕ±”°Í½ÕÉ”°ìÉ½½Ðô¤ì(€½¹ÍÐÅÕ•Õ”€ômÉÕ±”¹™¥±•tì(€½¹ÍÐÙ¥Í¥Ñ•€ô¹•ÜM•Ð ¤ì(€½¹ÍÐÍ½ÕÉ•…¡”€ô¹•Ü5…À¡mmÉÕ±”¹™¥±”°Í½ÕÉ•ut¤ì(€½¹ÍÐ™½É‰¥‘‘•¹I•…±A…Ñ¡Ì€ô¹•Ü5…À ¤ì(€™½È€¡½¹ÍÐµ½‘Õ±•9…µ”½˜ÉÕ±”¹µ½‘Õ±•Ì¤ì(€€€½¹ÍÐÉ•Í½±Ù•‘5½‘Õ±”€ô…Ý…¥ÐÉ•Í½±Ù•1½…±5½‘Õ±•¥±”¡µ½‘Õ±•9…µ”°ÉÕ±”¹™¥±”°É½½Ð°Í½ÕÉ•…¡”¤ì(€€€¥˜€¡É•Í½±Ù•‘5½‘Õ±”¤™½É‰¥‘‘•¹I•…±A…Ñ¡Ì¹Í•Ð¡É•Í½±Ù•‘5½‘Õ±”¹É•…±A…Ñ °µ½‘Õ±•9…µ”¤ì(€ô((€Ý¡¥±”€¡ÅÕ•Õ”¹±•¹Ñ €ø€À¤ì(€€€½¹ÍÐ™¥±•9…µ”€ôÅÕ•Õ”¹Í¡¥™Ð ¤ì(€€€¥˜€¡Ù¥Í¥Ñ•¹¡…Ì¡™¥±•9…µ”¤¤½¹Ñ¥¹Õ”ì(€€€Ù¥Í¥Ñ•¹…‘¡™¥±•9…µ”¤ì((€€€½¹ÍÐÕÉÉ•¹ÑM½ÕÉ”€ô…Ý…¥ÐÉ•…‘=ÁÑ¥½¹…±M½ÕÉ”¡É½½Ð°™¥±•9…µ”°Í½ÕÉ•…¡”¤ì(€€€…ÍÍ•ÉÐ¡ÕÉÉ•¹ÑM½ÕÉ”€„ôô¹Õ±°°€‘íÉÕ±”¹¥‘ôè½Õ±¹½ÐÉ•…‘•Á•¹‘•¹ä€‘í™¥±•9…µ•õ€¤ì(€€€…ÍÍ•ÉÑ9½½É‰¥‘‘•¹5½‘Õ±••Á•¹‘•¹¥•Ì¡ÕÉÉ•¹ÑM½ÕÉ”°ÉÕ±”¹µ½‘Õ±•Ì°™¥±•9…µ”°ÉÕ±”¹™¥±”¤ì((€€€™½È€¡½¹ÍÐ‘•Á•¹‘•¹ä½˜½±±•Ñ1¥Ñ•É…±5½‘Õ±••Á•¹‘•¹¥•Ì¡ÕÉÉ•¹ÑM½ÕÉ”°™¥±•9…µ”¤¤ì(€€€€€¥˜€¡µ…Ñ¡¥¹½É‰¥‘‘•¹5½‘Õ±”¡‘•Á•¹‘•¹ä°ÉÕ±”¹µ½‘Õ±•Ì°™¥±•9…µ”°ÉÕ±”¹™¥±”¤¤½¹Ñ¥¹Õ”ì(€€€€€½¹ÍÐÉ•Í½±Ù•‘•Á•¹‘•¹ä€ô…Ý…¥ÐÉ•Í½±Ù•1½…±5½‘Õ±•¥±”¡‘•Á•¹‘•¹ä°™¥±•9…µ”°É½½Ð°Í½ÕÉ•…¡”¤ì(€€€€€½¹ÍÐ…±¥…Í•‘½É‰¥‘‘•¹5½‘Õ±”€ôÉ•Í½±Ù•‘•Á•¹‘•¹ä€ü™½É‰¥‘‘•¹I•…±A…Ñ¡Ì¹•Ð¡É•Í½±Ù•‘•Á•¹‘•¹ä¹É•…±A…Ñ ¤€è¹Õ±°ì(€€€€€¥˜€¡…±¥…Í•‘½É‰¥‘‘•¹5½‘Õ±”¤ì(€€€€€€€Ñ¡É½Ü¹•ÜÉÉ½È (€€€€€€€€€€‘í™¥±•9…µ•ôèµ½‘Õ±”‘•Á•¹‘•¹ä€‘í‘•Á•¹‘•¹åôÉ•Í½±Ù•ÌÑ¼™½É‰¥‘‘•¸µ½‘Õ±”€‘í…±¥…Í•‘½É‰¥‘‘•¹5½‘Õ±•ôÑ¡É½Õ …¸…±Ñ•É¹…Ñ”Á…Ñ¡€°(€€€€€€€€¤ì(€€€€€ô(€€€€€¥˜€¡É•Í½±Ù•‘•Á•¹‘•¹ä€˜˜€…Ù¥Í¥Ñ•¹¡…Ì¡É•Í½±Ù•‘•Á•¹‘•¹ä¹™¥±•9…µ”¤¤ÅÕ•Õ”¹ÁÕÍ ¡É•Í½±Ù•‘•Á•¹‘•¹ä¹™¥±•9…µ”¤ì(€€€ô(€ô)ô()•áÁ½ÉÐ…Íå¹Œ™Õ¹Ñ¥½¸•Ù…±Õ…Ñ•É¡¥Ñ•ÑÕÉ•%¹Ù…É¥…¹ÑÌ¡½¹™¥œ°ìÉ½½Ð€ôÁÉ½•ÍÌ¹Ý ¤ô€ôíô¤ì(€Ù…±¥‘…Ñ•É¡¥Ñ•ÑÕÉ•%¹Ù…É¥…¹Ñ½¹™¥œ¡½¹™¥œ¤ì(€½¹ÍÐÉ•ÍÕ±ÑÌ€ômtì(€™½È€¡½¹ÍÐÉÕ±”½˜½¹™¥œ¹ÉÕ±•Ì¤ì(€€€½¹ÍÐÍ½ÕÉ”€ô…Ý…¥ÐÉ•…‘¥±”¡É•Í½±Ù”¡É½½Ð°ÉÕ±”¹™¥±”¤°€ÕÑ˜àœ¤ì(€€€¥˜€¡ÉÕ±”¹ÑåÁ”€ôôô€Í½ÕÉ•½¹ÑÉ…Ðœ¤ì(€€€€€½¹ÍÐµ¥ÍÍ¥¹œ€ô€¡ÉÕ±”¹É•ÅÕ¥É•€üümt¤¹™¥±Ñ•È¡±¥Ñ•É…°€ôø€…Í½ÕÉ”¹¥¹±Õ‘•Ì¡±¥Ñ•É…°¤¤ì(€€€€€½¹ÍÐ™½É‰¥‘‘•¹AÉ•Í•¹Ð€ô€¡ÉÕ±”¹™½É‰¥‘‘•¸€üümt¤¹™¥±Ñ•È¡±¥Ñ•É…°€ôøÍ½ÕÉ”¹¥¹±Õ‘•Ì¡±¥Ñ•É…°¤¤ì(€€€€€…ÍÍ•ÉÐ¡µ¥ÍÍ¥¹œ¹±•¹Ñ €ôôô€À°€‘íÉÕ±”¹¥‘ôèµ¥ÍÍ¥¹œÉ•ÅÕ¥É•±¥Ñ•É…°¡Ì¤è€‘íµ¥ÍÍ¥¹œ¹©½¥¸ œ°€œ¥õ€¤ì(€€€€€…ÍÍ•ÉÐ¡™½É‰¥‘‘•¹AÉ•Í•¹Ð¹±•¹Ñ €ôôô€À°€‘íÉÕ±”¹¥‘ôè™½É‰¥‘‘•¸±¥Ñ•É…°¡Ì¤ÁÉ•Í•¹Ðè€‘í™½É‰¥‘‘•¹AÉ•Í•¹Ð¹©½¥¸ œ°€œ¥õ€¤ì(€€€€€É•ÍÕ±ÑÌ¹ÁÕÍ ¡ì¥èÉÕ±”¹¥°ÍÑ…ÑÕÌè€Á…ÍÍ•œ°™¥±”èÉÕ±”¹™¥±”°ÑåÁ”èÉÕ±”¹ÑåÁ”ô¤ì(€€€€€½¹Ñ¥¹Õ”ì(€€€ô((€€€¥˜€¡ÉÕ±”¹ÑåÁ”€ôôô€µ½‘Õ±••Á•¹‘•¹å•¹å±¥ÍÐœ¤ì(€€€€€…Ý…¥Ð…ÍÍ•ÉÑ9½½É‰¥‘‘•¹5½‘Õ±••Á•¹‘•¹å±½ÍÕÉ”¡ÉÕ±”°Í½ÕÉ”°ìÉ½½Ðô¤ì(€€€€€É•ÍÕ±ÑÌ¹ÁÕÍ ¡ì¥èÉÕ±”¹¥°ÍÑ…ÑÕÌè€Á…ÍÍ•œ°™¥±”èÉÕ±”¹™¥±”°ÑåÁ”èÉÕ±”¹ÑåÁ”°µ½‘Õ±•ÌèÉÕ±”¹µ½‘Õ±•Ìô¤ì(€€€€€½¹Ñ¥¹Õ”ì(€€€ô((€€€…Ý…¥Ð•Ù…±Õ…Ñ•9…µ•‘%µÁ½ÉÑ±½ÍÕÉ”¡ÉÕ±”°Í½ÕÉ”°ìÉ½½Ðô¤ì(€€€É•ÍÕ±ÑÌ¹ÁÕÍ ¡ì¥èÉÕ±”¹¥°ÍÑ…ÑÕÌè€Á…ÍÍ•œ°™¥±”èÉÕ±”¹™¥±”°ÑåÁ”èÉÕ±”¹ÑåÁ”°µ½‘Õ±”èÉÕ±”¹µ½‘Õ±”ô¤ì(€ô(€É•ÑÕÉ¸É•ÍÕ±ÑÌì)ô()•áÁ½ÉÐ…Íå¹Œ™Õ¹Ñ¥½¸±½…‘É¡¥Ñ•ÑÕÉ•%¹Ù…É¥…¹Ñ½¹™¥œ¡Á…Ñ €ô€…•¹Ð½…É¡¥Ñ•ÑÕÉ”µ¥¹Ù…É¥…¹ÑÌ¹©Í½¸œ°ìÉ½½Ð€ôÁÉ½•ÍÌ¹Ý ¤ô€ôíô¤ì(€É•ÑÕÉ¸Ù…±¥‘…Ñ•É¡¥Ñ•ÑÕÉ•%¹Ù…É¥…¹Ñ½¹™¥œ¡)M=8¹Á…ÉÍ”¡…Ý…¥ÐÉ•…‘¥±”¡É•Í½±Ù”¡É½½Ð°Á…Ñ ¤°€ÕÑ˜àœ¤¤¤ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸µ…¥¸ ¤ì(€½¹ÍÐ…ÉÌ€ôÁÉ½•ÍÌ¹…ÉØ¹Í±¥” È¤ì(€±•Ð½¹™¥A…Ñ €ô€…•¹Ð½…É¡¥Ñ•ÑÕÉ”µ¥¹Ù…É¥…¹ÑÌ¹©Í½¸œì(€±•Ð©Í½¸€ô™…±Í”ì(€™½È€¡±•Ð¥¹‘•à€ô€Àì¥¹‘•à€ð…ÉÌ¹±•¹Ñ ì¥¹‘•à€¬ô€Ä¤ì(€€€¥˜€¡…ÉÍm¥¹‘•át€ôôô€œ´µ½¹™¥œœ¤½¹™¥A…Ñ €ô…ÉÍl¬­¥¹‘•átì(€€€•±Í”¥˜€¡…ÉÍm¥¹‘•át€ôôô€œ´µ©Í½¸œ¤©Í½¸€ôÑÉÕ”ì(€€€•±Í”Ñ¡É½Ü¹•ÜÉÉ½È¡Õ¹­¹½Ý¸…ÉÕµ•¹Ð€‘í…ÉÍm¥¹‘•áuõ€¤ì(€ô(€½¹ÍÐ½¹™¥œ€ô…Ý…¥Ð±½…‘É¡¥Ñ•ÑÕÉ•%¹Ù…É¥…¹Ñ½¹™¥œ¡½¹™¥A…Ñ ¤ì(€½¹ÍÐÉ•ÍÕ±ÑÌ€ô…Ý…¥Ð•Ù…±Õ…Ñ•É¡¥Ñ•ÑÕÉ•%¹Ù…É¥…¹ÑÌ¡½¹™¥œ¤ì(€¥˜€¡©Í½¸¤½¹Í½±”¹±½œ¡)M=8¹ÍÑÉ¥¹¥™ä¡ìÍÑ…ÑÕÌè€Á…ÍÍ•œ°½Õ¹ÐèÉ•ÍÕ±ÑÌ¹±•¹Ñ °É•ÍÕ±ÑÌô°¹Õ±°°€È¤¤ì(€•±Í”½¹Í½±”¹±½œ¡I!%QQUI}%9YI%9QM}AML½Õ¹Ðô‘íÉ•ÍÕ±ÑÌ¹±•¹Ñ¡ô¥‘Ìô‘íÉ•ÍÕ±ÑÌ¹µ…À¡É•ÍÕ±Ð€ôøÉ•ÍÕ±Ð¹¥¤¹©½¥¸ œ°œ¥õ€¤ì)ô()¥˜€¡¥µÁ½ÉÐ¹µ•Ñ„¹ÕÉ°€ôôôÁ…Ñ¡Q½¥±•UI0¡ÁÉ½•ÍÌ¹…ÉØ¹…Ð Ä¤€üü€œœ¤¹¡É•˜¤ì(€µ…¥¸ ¤¹…Ñ ¡•ÉÉ½È€ôøì(€€€½¹Í½±”¹•ÉÉ½È¡•ÉÉ½È¥¹ÍÑ…¹•½˜ÉÉ½È€ü•ÉÉ½È¹µ•ÍÍ…”€èMÑÉ¥¹œ¡•ÉÉ½È¤¤ì(€€€ÁÉ½•ÍÌ¹•á¥Ñ½‘”€ô€Äì(€ô¤ì)ô(