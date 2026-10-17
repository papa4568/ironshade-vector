import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, resolve } from 'node:path';

const SOURCE_EXTENSIONS = ['.mjs', '.cjs', '.js', '.mts', '.cts', '.ts', '.sh', '.py'];
const JS_LIKE_EXTENSIONS = new Set(['.mjs', '.cjs', '.js', '.mts', '.cts', '.ts']);
const REVISION_SUBCOMMANDS = 'checkout|switch|reset|restore|read-tree|worktree';
const DIRECT_GIT_PATTERN = new RegExp(`\\bgit(?:\\.exe)?\\s+(?:-C\\s+\\S+\\s+)?(?:${REVISION_SUBCOMMANDS})\\b`, 'i');
const SPAWN_GIT_PATTERN = new RegExp(`\\b(?:spawn|spawnSync|execFile|execFileSync)\\s*\\(\\s*['\"]git['\"]\\s*,\\s*\\[[\\s\\S]{0,400}?['\"](?:${REVISION_SUBCOMMANDS})['\"]`, 'i');
const DYNAMIC_PROCESS_IMPORT_PATTERN = /(?:from\s*['\"](?:node:)?child_process['\"]|require\s*\(\s*['\"](?:node:)?child_process['\"]\s*\)|from\s*['\"](?:execa|zx|simple-git|isomorphic-git)['\"]|require\s*\(\s*['\"](?:execa|zx|simple-git|isomorphic-git)['\"]\s*\))/i;
const NODE_MODULE_SOURCE_PATTERN = /(?:from\s*['\"](?:node:)?module['\"]|require\s*\(\s*['\"](?:node:)?module['\"]\s*\)|import\s*\(\s*['\"](?:node:)?module['\"]\s*\))/i;
const CREATE_REQUIRE_PATTERN = /\bcreateRequire\b/i;
const GIT_METADATA_MUTATION_PATTERN = /(?:writeFile|writeFileSync|appendFile|appendFileSync|rename|renameSync|copyFile|copyFileSync|rm|rmSync|unlink|unlinkSync)[\s\S]{0,240}['\"][^'\"]*\.git[\\/]HEAD['\"]/i;
const NPM_SCRIPT_REF_PATTERN = /\bnpm\s+(?:run|run-script)\s+([A-Za-z0-9:_-]+)/g;
const LOCAL_FILE_TOKEN_PATTERN = /(?:^|[\s;&|()])(["']?)([^\s;&|()"']+\.(?:mjs|cjs|js|mts|cts|ts|sh|py))\1/g;
const LOCAL_IMPORT_PATTERN = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)['\"](\.{1,2}\/[^'\"]+)['\"]/g;

function stripCodeComments(text) {
  let output = '';
  let single = false;
  let double = false;
  let template = false;
  let lineComment = false;
  let blockComment = false;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (lineComment) {
      if (char === '\n') {
        lineComment = false;
        output += '\n';
      } else output += ' ';
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        output += '  ';
        i += 1;
      } else output += char === '\n' ? '\n' : ' ';
      continue;
    }
    if (!single && !double && !template && char === '/' && next === '/') {
      lineComment = true;
      output += '  ';
      i += 1;
      continue;
    }
    if (!single && !double && !template && char === '/' && next === '*') {
      blockComment = true;
      output += '  ';
      i += 1;
      continue;
    }
    output += char;
    if (escaped) {
      escaped = false;
      continue;
    }
    if ((single || double || template) && char === '\\') {
      escaped = true;
      continue;
    }
    if (!double && !template && char === "'") single = !single;
    else if (!single && !template && char === '"') double = !double;
    else if (!single && !double && char === '`') template = !template;
  }
  return output;
}

function finding(kind, source, evidence) {
  return { kind, source, evidence };
}

function inspectExecutableText(text, source) {
  const active = stripCodeComments(text);
  const findings = [];
  if (DIRECT_GIT_PATTERN.test(active)) findings.push(finding('revision-changing-git-command', source, 'direct git checkout/switch/reset/restore/read-tree/worktree command'));
  if (SPAWN_GIT_PATTERN.test(active)) findings.push(finding('revision-changing-git-process', source, 'child process launches git with a revision-changing subcommand'));
  if (DYNAMIC_PROCESS_IMPORT_PATTERN.test(active)) findings.push(finding('dynamic-process-execution', source, 'reachable build source imports a general process/Git execution library'));
  if (NODE_MODULE_SOURCE_PATTERN.test(active) && CREATE_REQUIRE_PATTERN.test(active)) findings.push(finding('dynamic-process-execution', source, 'reachable build source obtains Node createRequire and can dynamically load process/Git execution libraries'));
  if (GIT_METADATA_MUTATION_PATTERN.test(active)) findings.push(finding('git-metadata-mutation', source, 'reachable build source writes or replaces .git/HEAD'));
  return findings;
}

function resolveLocalImport(root, importerPath, specifier, sourceOverrides) {
  if (!specifier.startsWith('.')) return null;
  const base = resolve(root, dirname(importerPath), specifier);
  const candidates = extname(base)
    ? [base]
    : [base, ...SOURCE_EXTENSIONS.map(extension => `${base}${extension}`), ...SOURCE_EXTENSIONS.map(extension => resolve(base, `index${extension}`))];
  for (const candidate of candidates) {
    const relative = candidate.slice(resolve(root).length + 1).replaceAll('\\', '/');
    if (Object.prototype.hasOwnProperty.call(sourceOverrides, relative) || existsSync(candidate)) return relative;
  }
  return null;
}

function sourceText(root, relativePath, sourceOverrides) {
  if (Object.prototype.hasOwnProperty.call(sourceOverrides, relativePath)) return sourceOverrides[relativePath];
  const absolute = resolve(root, relativePath);
  return existsSync(absolute) ? readFileSync(absolute, 'utf8') : null;
}

function localFileRefs(command, root, sourceOverrides) {
  const refs = new Set();
  for (const match of command.matchAll(LOCAL_FILE_TOKEN_PATTERN)) {
    const token = match[2];
    if (token.startsWith('-') || token.includes('://')) continue;
    const absolute = isAbsolute(token) ? token : resolve(root, token);
    const relative = absolute.slice(resolve(root).length + 1).replaceAll('\\', '/');
    if (relative.startsWith('../')) continue;
    if (Object.prototype.hasOwnProperty.call(sourceOverrides, relative) || existsSync(absolute)) refs.add(relative);
  }
  return [...refs];
}

function packageScriptRefs(command) {
  return [...command.matchAll(NPM_SCRIPT_REF_PATTERN)].map(match => match[1]);
}

function npmIgnoreScriptsEnabled(npmrcText) {
  const active = npmrcText
    .split(/\r?\n/)
    .map(line => line.replace(/\s*[#;].*$/, '').trim())
    .filter(Boolean);
  const settings = active
    .map(line => line.match(/^ignore-scripts\s*=\s*(true|false)$/i))
    .filter(Boolean)
    .map(match => match[1].toLowerCase());
  return settings.length > 0 && settings.at(-1) === 'true';
}

export function analyzePrCandidateBuildSurface({
  root = '.',
  packageJsonText = null,
  npmrcText = null,
  sourceOverrides = {},
} = {}) {
  const absoluteRoot = resolve(root);
  const packageText = packageJsonText ?? readFileSync(resolve(absoluteRoot, 'package.json'), 'utf8');
  const npmrc = npmrcText ?? (existsSync(resolve(absoluteRoot, '.npmrc')) ? readFileSync(resolve(absoluteRoot, '.npmrc'), 'utf8') : '');
  const pkg = JSON.parse(packageText);
  const scripts = pkg.scripts ?? {};
  const findings = [];
  const visitedScripts = new Set();
  const visitedFiles = new Set();
  const scriptQueue = ['build'];
  const fileQueue = [];

  if (!npmIgnoreScriptsEnabled(npmrc)) findings.push(finding('npm-lifecycle-hooks-enabled', '.npmrc', 'ignore-scripts=true is required so npm install and implicit pre/post lifecycle hooks cannot execute hidden revision changes'));
  if (typeof scripts.build !== 'string' || !scripts.build.trim()) findings.push(finding('missing-build-script', 'package.json#scripts.build', 'build script must exist'));

  while (scriptQueue.length) {
    const scriptName = scriptQueue.shift();
    if (visitedScripts.has(scriptName)) continue;
    visitedScripts.add(scriptName);
    const command = scripts[scriptName];
    if (typeof command !== 'string') {
      findings.push(finding('missing-referenced-package-script', `package.json#scripts.${scriptName}`, `reachable package script ${scriptName} is missing`));
      continue;
    }
    findings.push(...inspectExecutableText(command, `package.json#scripts.${scriptName}`));
    for (const ref of packageScriptRefs(command)) if (!visitedScripts.has(ref)) scriptQueue.push(ref);
    for (const ref of localFileRefs(command, absoluteRoot, sourceOverrides)) if (!visitedFiles.has(ref)) fileQueue.push(ref);
  }

  while (fileQueue.length) {
    const relativePath = fileQueue.shift();
    if (visitedFiles.has(relativePath)) continue;
    visitedFiles.add(relativePath);
    const text = sourceText(absoluteRoot, relativePath, sourceOverrides);
    if (text == null) {
      findings.push(finding('missing-reachable-source', relativePath, 'reachable build source is missing'));
      continue;
    }
    findings.push(...inspectExecutableText(text, relativePath));
    if (!JS_LIKE_EXTENSIONS.has(extname(relativePath))) continue;
    const active = stripCodeComments(text);
    for (const match of active.matchAll(LOCAL_IMPORT_PATTERN)) {
      const resolvedImport = resolveLocalImport(absoluteRoot, relativePath, match[1], sourceOverrides);
      if (resolvedImport && !visitedFiles.has(resolvedImport)) fileQueue.push(resolvedImport);
    }
  }

  return {
    schema: 'ironshade-pr-candidate-build-surface:v1',
    npmIgnoreScripts: npmIgnoreScriptsEnabled(npmrc),
    reachablePackageScripts: [...visitedScripts].sort(),
    reachableSourceFiles: [...visitedFiles].sort(),
    findings,
    pass: findings.length === 0,
  };
}

function clonePackageText(packageJsonText, mutate) {
  const pkg = JSON.parse(packageJsonText);
  mutate(pkg);
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

export function calibratePrCandidateBuildSurface({ root = '.', packageJsonText = null, npmrcText = null } = {}) {
  const absoluteRoot = resolve(root);
  const packageText = packageJsonText ?? readFileSync(resolve(absoluteRoot, 'package.json'), 'utf8');
  const npmrc = npmrcText ?? (existsSync(resolve(absoluteRoot, '.npmrc')) ? readFileSync(resolve(absoluteRoot, '.npmrc'), 'utf8') : '');
  const baseline = analyzePrCandidateBuildSurface({ root: absoluteRoot, packageJsonText: packageText, npmrcText: npmrc });
  const sampleSource = baseline.reachableSourceFiles[0] ?? 'scripts/ev9-safe-fixture.mjs';
  const sampleSourceText = sourceText(absoluteRoot, sampleSource, {}) ?? 'export const safe = true;\n';
  const negativeControls = [
    {
      id: 'npmrc-comment-only',
      report: analyzePrCandidateBuildSurface({ root: absoluteRoot, packageJsonText: packageText, npmrcText: `${npmrc.trimEnd()}\n# git checkout is documentation only\n` }),
    },
    {
      id: 'reachable-source-comment-only',
      report: analyzePrCandidateBuildSurface({ root: absoluteRoot, packageJsonText: packageText, npmrcText: npmrc, sourceOverrides: { [sampleSource]: `// git checkout deadbeef is documentation only\n${sampleSourceText}` } }),
    },
  ].map(entry => ({ id: entry.id, passed: entry.report.pass, falsePositive: !entry.report.pass, findings: entry.report.findings }));

  const indirectHelperPackage = clonePackageText(packageText, pkg => {
    pkg.scripts ??= {};
    pkg.scripts['ev9:indirect-switch'] = 'node scripts/ev9-indirect-switch.mjs';
    pkg.scripts.build = `npm run ev9:indirect-switch && ${pkg.scripts.build}`;
  });
  const dynamicHelperPackage = clonePackageText(packageText, pkg => {
    pkg.scripts ??= {};
    pkg.scripts['ev9:dynamic-switch'] = 'node scripts/ev9-dynamic-switch.mjs';
    pkg.scripts.build = `npm run ev9:dynamic-switch && ${pkg.scripts.build}`;
  });
  const createRequireHelperPackage = clonePackageText(packageText, pkg => {
    pkg.scripts ??= {};
    pkg.scripts['ev9:create-require-switch'] = 'node scripts/ev9-create-require-switch.mjs';
    pkg.scripts.build = `npm run ev9:create-require-switch && ${pkg.scripts.build}`;
  });
  const directPackage = clonePackageText(packageText, pkg => {
    pkg.scripts.build = `git checkout deadbeef && ${pkg.scripts.build}`;
  });
  const dishonestMutations = [
    {
      id: 'direct-package-script-revision-switch',
      report: analyzePrCandidateBuildSurface({ root: absoluteRoot, packageJsonText: directPackage, npmrcText: npmrc }),
    },
    {
      id: 'indirect-helper-revision-switch',
      report: analyzePrCandidateBuildSurface({
        root: absoluteRoot,
        packageJsonText: indirectHelperPackage,
        npmrcText: npmrc,
        sourceOverrides: { 'scripts/ev9-indirect-switch.mjs': "import { execSync } from 'node:child_process';\nexecSync('git checkout deadbeef');\n" },
      }),
    },
    {
      id: 'dynamic-helper-process-execution',
      report: analyzePrCandidateBuildSurface({
        root: absoluteRoot,
        packageJsonText: dynamicHelperPackage,
        npmrcText: npmrc,
        sourceOverrides: { 'scripts/ev9-dynamic-switch.mjs': "import { spawnSync } from 'node:child_process';\nconst tool = ['g', 'it'].join('');\nconst command = ['check', 'out'].join('');\nspawnSync(tool, [command, 'deadbeef']);\n" },
      }),
    },
    {
      id: 'create-require-dynamic-process-execution',
      report: analyzePrCandidateBuildSurface({
        root: absoluteRoot,
        packageJsonText: createRequireHelperPackage,
        npmrcText: npmrc,
        sourceOverrides: {
          'scripts/ev9-create-require-switch.mjs': "import { createRequire as makeRequire } from 'node:module';\nconst load = makeRequire(import.meta.url);\nconst processModule = ['node:child', '_process'].join('');\nconst processApi = load(processModule);\nconst tool = ['g', 'it'].join('');\nconst command = ['check', 'out'].join('');\nprocessApi.spawnSync(tool, [command, 'deadbeef']);\n",
        },
      }),
    },
    {
      id: 'npm-lifecycle-hooks-enabled',
      report: analyzePrCandidateBuildSurface({ root: absoluteRoot, packageJsonText: packageText, npmrcText: 'ignore-scripts=false\n' }),
    },
  ].map(entry => ({ id: entry.id, detected: !entry.report.pass, falseNegative: entry.report.pass, findings: entry.report.findings }));

  const falsePositives = negativeControls.filter(entry => entry.falsePositive).length;
  const falseNegatives = dishonestMutations.filter(entry => entry.falseNegative).length;
  return {
    schema: 'ironshade-pr-candidate-build-surface-calibration:v1',
    baselinePass: baseline.pass,
    baseline,
    falsePositiveTrials: negativeControls.length,
    falsePositives,
    falseNegativeTrials: dishonestMutations.length,
    falseNegatives,
    negativeControls,
    dishonestMutations,
    pass: baseline.pass && falsePositives === 0 && falseNegatives === 0,
  };
}
