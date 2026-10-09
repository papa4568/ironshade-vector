import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

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
    assert(['sourceContract', 'namedImportAllowlist'].includes(rule.type), `rule ${rule.id} has unsupported type ${rule.type}`);
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
  }
  return config;
}

function parseNamedImports(source, moduleName) {
  const imports = [];
  const importPattern = /import\s+(type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]\s*;/g;
  for (const match of source.matchAll(importPattern)) {
    if (match[3] !== moduleName) continue;
    const wholeTypeOnly = Boolean(match[1]);
    const clause = match[2].trim();
    assert(clause.startsWith('{') && clause.endsWith('}'), `imports from ${moduleName} must use named imports only`);
    const inside = clause.slice(1, -1).trim();
    if (!inside) continue;
    for (const rawPart of inside.split(',')) {
      let part = rawPart.trim();
      if (!part) continue;
      const typeOnly = wholeTypeOnly || part.startsWith('type ');
      if (part.startsWith('type ')) part = part.slice(5).trim();
      const importedName = part.split(/\s+as\s+/)[0].trim();
      assertString(importedName, `import from ${moduleName}`);
      imports.push({ name: importedName, typeOnly });
    }
  }
  const escapedModule = moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const dynamicImportPattern = new RegExp(`import\\s*\\(\\s*['"]${escapedModule}['"]\\s*\\)`);
  assert(!dynamicImportPattern.test(source), `dynamic import from ${moduleName} is not allowed by named-import architecture rules`);
  return imports;
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

    const imports = parseNamedImports(source, rule.module);
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
