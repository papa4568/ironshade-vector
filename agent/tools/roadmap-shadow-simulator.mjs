import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { loadRoadmapAdapter } from './roadmap-adapter.mjs';

const execFileAsync = promisify(execFile);
const SHA_PATTERN = /^[a-f0-9]{40}$/;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertObject(value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
}

function assertString(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`);
}

function assertStringArray(value, label, { minItems = 0 } = {}) {
  assert(Array.isArray(value), `${label} must be an array`);
  assert(value.length >= minItems, `${label} must contain at least ${minItems} item(s)`);
  value.forEach((entry, index) => assertString(entry, `${label}[${index}]`));
  assert(new Set(value).size === value.length, `${label} must not contain duplicates`);
}

function canonicalJson(value) {
  const normalize = entry => {
    if (Array.isArray(entry)) return entry.map(normalize);
    if (!entry || typeof entry !== 'object') return entry;
    return Object.fromEntries(Object.keys(entry).sort((a, b) => a.localeCompare(b)).map(key => [key, normalize(entry[key])]));
  };
  return `${JSON.stringify(normalize(value), null, 2)}\n`;
}

function sha256(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : canonicalJson(value)).digest('hex');
}

function validateContainsContract(contract, label) {
  assertObject(contract, label);
  assertString(contract.path, `${label}.path`);
  assertString(contract.contains, `${label}.contains`);
  assertString(contract.description, `${label}.description`);
}

function validateScenario(scenario, label) {
  assertObject(scenario, label);
  assertString(scenario.taskId, `${label}.taskId`);
  assert(/^P[0-9A-Z-]+$/.test(scenario.taskId), `${label}.taskId must be a product roadmap id`);
  assertString(scenario.probeId, `${label}.probeId`);
  assertStringArray(scenario.expectedSurfaces, `${label}.expectedSurfaces`, { minItems: 1 });
  assert(Number.isInteger(scenario.preferredSurfaceCount) && scenario.preferredSurfaceCount >= 1 && scenario.preferredSurfaceCount <= 12,
    `${label}.preferredSurfaceCount must be an integer from 1 to 12`);
  assert(Array.isArray(scenario.extensionPoints) && scenario.extensionPoints.length >= 1, `${label}.extensionPoints must contain at least one entry`);
  scenario.extensionPoints.forEach((contract, index) => validateContainsContract(contract, `${label}.extensionPoints[${index}]`));
  assert(Array.isArray(scenario.forbiddenDependencies), `${label}.forbiddenDependencies must be an array`);
  scenario.forbiddenDependencies.forEach((contract, index) => validateContainsContract(contract, `${label}.forbiddenDependencies[${index}]`));
  assertObject(scenario.probe, `${label}.probe`);
  assert(Array.isArray(scenario.probe.imports) && scenario.probe.imports.length >= 1, `${label}.probe.imports must contain at least one import`);
  scenario.probe.imports.forEach((probeImport, index) => {
    const importLabel = `${label}.probe.imports[${index}]`;
    assertObject(probeImport, importLabel);
    assertString(probeImport.path, `${importLabel}.path`);
    assert(typeof probeImport.typeOnly === 'boolean', `${importLabel}.typeOnly must be boolean`);
    assertStringArray(probeImport.names, `${importLabel}.names`, { minItems: 1 });
  });
  assertStringArray(scenario.probe.body, `${label}.probe.body`, { minItems: 1 });
  return scenario;
}

export function validateRoadmapShadowConfig(config) {
  assertObject(config, 'roadmap shadow simulator config');
  assert(config.schemaVersion === 1, 'roadmap shadow simulator schemaVersion must be 1');
  assert(config.mode === 'advisory', 'roadmap shadow simulator mode must remain advisory until promoted');
  assert(Array.isArray(config.scenarios), 'roadmap shadow simulator scenarios must be an array');
  assert(config.scenarios.length >= 2, 'roadmap shadow simulator must cover at least two future roadmap tasks');
  assert(config.scenarios.length <= 8, 'roadmap shadow simulator scenarios must remain bounded to eight tasks');

  const taskIds = new Set();
  const probeIds = new Set();
  config.scenarios.forEach((scenario, index) => {
    validateScenario(scenario, `scenarios[${index}]`);
    assert(!taskIds.has(scenario.taskId), `scenarios[${index}].taskId duplicates ${scenario.taskId}`);
    taskIds.add(scenario.taskId);
    assert(!probeIds.has(scenario.probeId), `scenarios[${index}].probeId duplicates ${scenario.probeId}`);
    probeIds.add(scenario.probeId);
  });
  return config;
}

export async function loadRoadmapShadowConfig(configPath = resolve('agent/roadmap-shadow-simulator.json')) {
  return validateRoadmapShadowConfig(JSON.parse(await readFile(configPath, 'utf8')));
}

async function sourceForPath(path, sourceOverrides = {}) {
  if (Object.prototype.hasOwnProperty.call(sourceOverrides, path)) return sourceOverrides[path];
  return readFile(resolve(path), 'utf8');
}

export async function analyzeRoadmapShadowScenario(scenario, { sourceOverrides = {}, compileResult = null } = {}) {
  validateScenario(scenario, 'scenario');
  const missingExtensionPoints = [];
  const requiredBoundaryViolations = [];

  for (const extension of scenario.extensionPoints) {
    const source = await sourceForPath(extension.path, sourceOverrides);
    if (!source.includes(extension.contains)) {
      missingExtensionPoints.push({
        path: extension.path,
        contract: extension.contains,
        description: extension.description,
      });
    }
  }

  for (const forbidden of scenario.forbiddenDependencies) {
    const source = await sourceForPath(forbidden.path, sourceOverrides);
    if (source.includes(forbidden.contains)) {
      requiredBoundaryViolations.push({
        path: forbidden.path,
        dependency: forbidden.contains,
        description: forbidden.description,
      });
    }
  }

  const touchedSurfaces = [...scenario.expectedSurfaces].sort((a, b) => a.localeCompare(b));
  const excessSurfaces = Math.max(0, touchedSurfaces.length - scenario.preferredSurfaceCount);
  const compilePenalty = compileResult && compileResult.status === 'failed' ? 6 : 0;
  const frictionScore = Math.max(0, touchedSurfaces.length - 1)
    + excessSurfaces * 3
    + missingExtensionPoints.length * 7
    + requiredBoundaryViolations.length * 9
    + compilePenalty;

  return {
    probeId: scenario.probeId,
    touchedSurfaces,
    requiredBoundaryViolations,
    missingExtensionPoints,
    rewritePressure: {
      surfaceCount: touchedSurfaces.length,
      preferredSurfaceCount: scenario.preferredSurfaceCount,
      excessSurfaces,
      level: excessSurfaces === 0 ? 'low' : excessSurfaces <= 2 ? 'medium' : 'high',
    },
    probeCompilation: compileResult ?? {
      status: 'not-run',
      outsideRepository: true,
      persisted: false,
      diagnostics: null,
    },
    frictionScore,
  };
}

function pathIsInside(parent, child) {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function moduleSpecifier(fromDir, targetPath) {
  let specifier = relative(fromDir, targetPath).replaceAll('\\', '/');
  if (!specifier.startsWith('.')) specifier = `./${specifier}`;
  return specifier;
}

export function synthesizeProbeSource(scenario, probeDir, repoRoot = resolve('.')) {
  validateScenario(scenario, 'scenario');
  const imports = scenario.probe.imports.map(probeImport => {
    const target = resolve(repoRoot, probeImport.path);
    const prefix = probeImport.typeOnly ? 'import type' : 'import';
    return `${prefix} { ${probeImport.names.join(', ')} } from '${moduleSpecifier(probeDir, target)}';`;
  });
  return `${imports.join('\n')}\n\n${scenario.probe.body.join('\n')}\n`;
}

async function repositoryFingerprint(repoRoot) {
  const [{ stdout: head }, { stdout: status }] = await Promise.all([
    execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot }),
    execFileAsync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: repoRoot }),
  ]);
  return { head: head.trim(), status: status.trim() };
}

export async function compileRoadmapShadowProbe(scenario, { repoRoot = resolve('.') } = {}) {
  validateScenario(scenario, 'scenario');
  const before = await repositoryFingerprint(repoRoot);
  const probeRoot = await mkdtemp(resolve(tmpdir(), 'ironshade-roadmap-shadow-'));
  assert(!pathIsInside(repoRoot, probeRoot), 'roadmap shadow probe directory must remain outside the repository');
  const probePath = resolve(probeRoot, `${scenario.probeId}.ts`);
  const tsconfigPath = resolve(probeRoot, 'tsconfig.json');
  const tscPath = resolve(repoRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
  let status = 'passed';
  let diagnostics = null;

  try {
    await access(tscPath);
    await writeFile(probePath, synthesizeProbeSource(scenario, probeRoot, repoRoot), 'utf8');
    await writeFile(tsconfigPath, `${JSON.stringify({
      extends: resolve(repoRoot, 'tsconfig.json'),
      compilerOptions: {
        noUnusedLocals: false,
        noUnusedParameters: false,
      },
      files: [probePath],
      include: [],
    }, null, 2)}\n`, 'utf8');
    try {
      await execFileAsync(tscPath, ['--project', tsconfigPath, '--pretty', 'false'], {
        cwd: repoRoot,
        maxBuffer: 1024 * 1024 * 4,
      });
    } catch (error) {
      status = 'failed';
      diagnostics = `${error.stdout ?? ''}${error.stderr ?? ''}`.trim().slice(0, 8000) || error.message;
    }
  } catch (error) {
    status = 'failed';
    diagnostics = error.message;
  } finally {
    await rm(probeRoot, { recursive: true, force: true });
  }

  const after = await repositoryFingerprint(repoRoot);
  assert(before.head === after.head, 'roadmap shadow probe changed repository HEAD');
  assert(before.status === after.status, 'roadmap shadow probe changed repository working tree state');
  return {
    status,
    outsideRepository: true,
    persisted: false,
    diagnostics,
    repositoryUnchanged: true,
  };
}

export async function buildRoadmapShadowReport({ candidateSha, config = null, compile = false, repoRoot = resolve('.') } = {}) {
  assertString(candidateSha, 'candidateSha');
  assert(SHA_PATTERN.test(candidateSha), 'candidateSha must be a full lowercase SHA');
  const loadedConfig = config
    ? validateRoadmapShadowConfig(config)
    : await loadRoadmapShadowConfig(resolve(repoRoot, 'agent/roadmap-shadow-simulator.json'));
  const { roadmapTasks } = await loadRoadmapAdapter({
    metadataPath: resolve(repoRoot, 'agent/roadmap-metadata.json'),
    roadmapPath: resolve(repoRoot, 'docs/content-roadmap.md'),
  });
  const taskIndexes = new Map(roadmapTasks.map((task, index) => [task.id, index]));
  const scenarios = [];

  for (const scenario of loadedConfig.scenarios) {
    const taskIndex = taskIndexes.get(scenario.taskId);
    assert(taskIndex !== undefined, `roadmap shadow scenario ${scenario.taskId} is not an active roadmap task`);
    assert(taskIndex > 0, `roadmap shadow scenario ${scenario.taskId} must target a later roadmap item, not the current product task`);
    const roadmapTask = roadmapTasks[taskIndex];
    const compileResult = compile ? await compileRoadmapShadowProbe(scenario, { repoRoot }) : null;
    const analysis = await analyzeRoadmapShadowScenario(scenario, { compileResult });
    scenarios.push({
      taskId: roadmapTask.id,
      title: roadmapTask.title,
      roadmapLine: roadmapTask.roadmapLine,
      ...analysis,
    });
  }

  const report = {
    schema: 'ironshade-roadmap-shadow-simulator-report:v1',
    schemaVersion: 1,
    mode: 'advisory',
    candidateSha,
    scenarioCount: scenarios.length,
    scenarios,
    summary: {
      taskIds: scenarios.map(scenario => scenario.taskId),
      maximumFrictionScore: Math.max(...scenarios.map(scenario => scenario.frictionScore)),
      missingExtensionPointCount: scenarios.reduce((sum, scenario) => sum + scenario.missingExtensionPoints.length, 0),
      requiredBoundaryViolationCount: scenarios.reduce((sum, scenario) => sum + scenario.requiredBoundaryViolations.length, 0),
      compiledProbeCount: scenarios.filter(scenario => scenario.probeCompilation.status !== 'not-run').length,
      failedProbeCount: scenarios.filter(scenario => scenario.probeCompilation.status === 'failed').length,
    },
    temporaryProbesPersisted: false,
    validatedAgainstRealLaterWork: false,
    acceptedForEnforcement: false,
    candidatePassGranted: false,
    blocking: false,
  };
  return { ...report, reportDigest: sha256(report) };
}

function readArg(args, name) {
  const index = args.indexOf(name);
  if (index < 0) return null;
  assert(index + 1 < args.length, `${name} requires a value`);
  return args[index + 1];
}

async function main() {
  const args = process.argv.slice(2);
  assert(!args.includes('--enforce'), 'EV-7 enforcement is unavailable until shadow evidence is validated against real later work');
  const repoRoot = resolve(readArg(args, '--repo-root') ?? '.');
  const candidateSha = readArg(args, '--candidate') ?? (await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot })).stdout.trim();
  const outputPath = readArg(args, '--output');
  const report = await buildRoadmapShadowReport({ candidateSha, compile: args.includes('--compile'), repoRoot });
  if (outputPath) {
    const resolvedOutput = resolve(repoRoot, outputPath);
    await mkdir(dirname(resolvedOutput), { recursive: true });
    await writeFile(resolvedOutput, canonicalJson(report), 'utf8');
  }
  console.log(`ROADMAP_SHADOW_SIMULATOR_REPORT candidate=${report.candidateSha} scenarios=${report.scenarioCount} maxFriction=${report.summary.maximumFrictionScore} missingExtensions=${report.summary.missingExtensionPointCount} boundaryViolations=${report.summary.requiredBoundaryViolationCount} failedProbes=${report.summary.failedProbeCount} blocking=false digest=${report.reportDigest}`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main().catch(error => {
    console.error(`ROADMAP_SHADOW_SIMULATOR_INVALID ${error.message}`);
    process.exitCode = 1;
  });
}
