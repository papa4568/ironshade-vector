import { createHash } from 'node:crypto';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { parseRoadmap } from './roadmap-adapter.mjs';

const PLAN_SCHEMA = 'ironshade-acceptance-attack-plan:v1';
const REPORT_SCHEMA = 'ironshade-acceptance-attack-report:v1';
const DEFAULT_ROADMAP = 'docs/content-roadmap.md';
const DEFAULT_TEMPLATES = 'agent/acceptance-attack-templates.json';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

function runGit(args, cwd, { allowFailure = false } = {}) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (!allowFailure && result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result;
}

function runCommand(command, cwd) {
  const result = spawnSync(command, {
    cwd,
    encoding: 'utf8',
    shell: true,
    env: { ...process.env, IRONSHADE_ACCEPTANCE_ATTACK: '1' },
  });
  return {
    exitCode: result.status ?? 1,
    signal: result.signal ?? null,
    stdout: (result.stdout ?? '').slice(-6000),
    stderr: (result.stderr ?? '').slice(-6000),
  };
}

function normalizeText(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function splitAcceptanceCriteria(acceptance) {
  assert(typeof acceptance === 'string' && acceptance.trim(), 'acceptance text must be non-empty');
  const raw = acceptance
    .split(/;|,(?=\s*(?:and\s+)?[a-z0-9])/i)
    .map(entry => entry.trim().replace(/^and\s+/i, ''))
    .filter(Boolean);
  return raw.length > 0 ? raw : [acceptance.trim()];
}

function validateTemplates(raw) {
  assert(raw && raw.schemaVersion === 1, 'attack templates schemaVersion must be 1');
  assert(Array.isArray(raw.templates) && raw.templates.length > 0, 'attack templates must be non-empty');
  const ids = new Set();
  for (const [index, template] of raw.templates.entries()) {
    assert(template && typeof template === 'object', `templates[${index}] must be an object`);
    for (const key of ['id', 'class', 'intent', 'mutationStrategy', 'proofExpectation']) {
      assert(typeof template[key] === 'string' && template[key].trim(), `templates[${index}].${key} must be non-empty`);
    }
    assert(!ids.has(template.id), `duplicate attack template ${template.id}`);
    ids.add(template.id);
    assert(Array.isArray(template.keywords) && template.keywords.length > 0, `${template.id}.keywords must be non-empty`);
    template.keywords.forEach((keyword, keywordIndex) => {
      assert(typeof keyword === 'string' && keyword.trim(), `${template.id}.keywords[${keywordIndex}] must be non-empty`);
    });
  }
  return raw.templates;
}

function chooseCriterion(template, criteria, task) {
  const descriptionText = normalizeText(`${task.title} ${task.description}`);
  let best = null;
  criteria.forEach((criterion, index) => {
    const criterionText = normalizeText(criterion.text);
    const direct = template.keywords.filter(keyword => criterionText.includes(normalizeText(keyword))).length;
    const contextual = template.keywords.filter(keyword => descriptionText.includes(normalizeText(keyword))).length;
    const score = direct * 3 + contextual;
    const candidate = { criterion, index, score, direct, contextual };
    if (!best || score > best.score || (score === best.score && index < best.index)) best = candidate;
  });
  return best;
}

export async function compileAttackPlan({
  taskId,
  roadmapPath = DEFAULT_ROADMAP,
  templatesPath = DEFAULT_TEMPLATES,
  repoRoot = process.cwd(),
} = {}) {
  assert(typeof taskId === 'string' && taskId.trim(), 'taskId is required');
  const resolvedRoadmap = resolve(repoRoot, roadmapPath);
  const resolvedTemplates = resolve(repoRoot, templatesPath);
  const roadmap = await readFile(resolvedRoadmap, 'utf8');
  const tasks = parseRoadmap(roadmap);
  const task = tasks.find(entry => entry.id === taskId);
  assert(task, `task ${taskId} was not found as an unchecked executable roadmap item in ${roadmapPath}`);
  assert(Array.isArray(task.acceptance) && task.acceptance.length === 1, `${taskId} must expose exactly one authoritative acceptance clause`);
  const templates = validateTemplates(JSON.parse(await readFile(resolvedTemplates, 'utf8')));
  const criteria = splitAcceptanceCriteria(task.acceptance[0]).map((text, index) => ({
    id: `${task.id}:criterion:${index + 1}`,
    text,
  }));
  const attacks = templates.map(template => {
    const choice = chooseCriterion(template, criteria, task);
    const matchedKeywords = template.keywords.filter(keyword => {
      const needle = normalizeText(keyword);
      return normalizeText(`${choice.criterion.text} ${task.title} ${task.description}`).includes(needle);
    });
    return {
      id: `${task.id}:${template.id}`,
      templateId: template.id,
      class: template.class,
      criterionId: choice.criterion.id,
      intent: template.intent,
      semanticViolation: template.mutationStrategy,
      expectedProofBehavior: template.proofExpectation,
      relevance: {
        score: choice.score,
        matchedKeywords: [...matchedKeywords].sort(),
      },
    };
  });
  const taskContract = {
    id: task.id,
    title: task.title,
    description: task.description,
    acceptance: task.acceptance,
    roadmapLine: task.roadmapLine,
  };
  const planCore = {
    schema: PLAN_SCHEMA,
    mode: 'advisory',
    task: taskContract,
    criteria,
    attacks,
    isolation: {
      required: true,
      strategy: 'disposable-clone',
      candidateBranchMutationAllowed: false,
    },
    outcomeContract: {
      caught: 'verification rejected the dishonest variant',
      proofGap: 'verification accepted the dishonest variant; this is a gap and never a pass',
      survivorCanPass: false,
    },
    source: {
      roadmap: roadmapPath,
      templates: templatesPath,
    },
  };
  return {
    ...planCore,
    taskDigest: digest(taskContract),
    planDigest: digest(planCore),
  };
}

function validateFixture(raw, taskId) {
  assert(raw && raw.schemaVersion === 1, 'attack fixture schemaVersion must be 1');
  assert(raw.taskId === taskId, `attack fixture taskId ${raw.taskId} does not match ${taskId}`);
  assert(typeof raw.verifyCommand === 'string' && raw.verifyCommand.trim(), 'attack fixture verifyCommand must be non-empty');
  assert(typeof raw.targetFile === 'string' && raw.targetFile.trim(), 'attack fixture targetFile must be non-empty');
  assert(raw.attacks && typeof raw.attacks === 'object' && !Array.isArray(raw.attacks), 'attack fixture attacks must be an object');
  for (const [templateId, attack] of Object.entries(raw.attacks)) {
    assert(attack && typeof attack === 'object' && !Array.isArray(attack), `fixture attack ${templateId} must be an object`);
    assert(Array.isArray(attack.replacements) && attack.replacements.length > 0, `fixture attack ${templateId} replacements must be non-empty`);
    for (const [index, replacement] of attack.replacements.entries()) {
      assert(typeof replacement.find === 'string' && replacement.find.length > 0, `${templateId}.replacements[${index}].find must be non-empty`);
      assert(typeof replacement.replace === 'string', `${templateId}.replacements[${index}].replace must be a string`);
    }
  }
  return raw;
}

function snapshotSourceRepository(repoRoot) {
  const head = runGit(['rev-parse', 'HEAD'], repoRoot).stdout.trim();
  const branchResult = runGit(['symbolic-ref', '--short', '-q', 'HEAD'], repoRoot, { allowFailure: true });
  const branch = branchResult.status === 0 ? branchResult.stdout.trim() : null;
  const branchRef = branch ? runGit(['rev-parse', `refs/heads/${branch}`], repoRoot).stdout.trim() : null;
  const status = runGit(['status', '--porcelain=v1', '--untracked-files=all'], repoRoot).stdout;
  return { head, branch, branchRef, statusDigest: digest(status) };
}

function assertSourceRepositoryUnchanged(before, after) {
  assert(after.head === before.head, `source HEAD changed during attack exercise: ${before.head} -> ${after.head}`);
  assert(after.branch === before.branch, `source branch changed during attack exercise: ${before.branch} -> ${after.branch}`);
  assert(after.branchRef === before.branchRef, `source branch ref changed during attack exercise: ${before.branchRef} -> ${after.branchRef}`);
  assert(after.statusDigest === before.statusDigest, 'source working tree changed during attack exercise');
}

export async function resolveSandboxMutationTarget(sandbox, targetFile) {
  assert(typeof targetFile === 'string' && targetFile.trim(), 'attack targetFile must be non-empty');
  assert(!isAbsolute(targetFile), `attack targetFile must be repository-relative: ${targetFile}`);
  const lexicalRoot = resolve(sandbox);
  const lexicalTarget = resolve(lexicalRoot, targetFile);
  const lexicalRelative = relative(lexicalRoot, lexicalTarget);
  assert(
    lexicalRelative && lexicalRelative !== '..' && !lexicalRelative.startsWith(`..${sep}`) && !isAbsolute(lexicalRelative),
    `attack targetFile escapes disposable clone: ${targetFile}`,
  );
  const [physicalRoot, physicalTarget] = await Promise.all([realpath(lexicalRoot), realpath(lexicalTarget)]);
  const physicalRelative = relative(physicalRoot, physicalTarget);
  assert(
    physicalRelative && physicalRelative !== '..' && !physicalRelative.startsWith(`..${sep}`) && !isAbsolute(physicalRelative),
    `attack targetFile resolves outside disposable clone: ${targetFile}`,
  );
  return physicalTarget;
}

async function applyMutation(filePath, replacements) {
  let content = await readFile(filePath, 'utf8');
  for (const [index, replacement] of replacements.entries()) {
    const first = content.indexOf(replacement.find);
    assert(first >= 0, `mutation anchor ${index + 1} was not found in ${filePath}`);
    const second = content.indexOf(replacement.find, first + replacement.find.length);
    assert(second < 0, `mutation anchor ${index + 1} is ambiguous in ${filePath}`);
    content = `${content.slice(0, first)}${replacement.replace}${content.slice(first + replacement.find.length)}`;
  }
  await writeFile(filePath, content);
}

export function classifyAttackOutcome(verification) {
  assert(verification && Number.isInteger(verification.exitCode), 'verification exitCode must be an integer');
  return verification.exitCode === 0 ? 'proof-gap' : 'caught';
}

export async function exerciseAttackPlan({
  taskId,
  fixturePath,
  roadmapPath = DEFAULT_ROADMAP,
  templatesPath = DEFAULT_TEMPLATES,
  repoRoot = process.cwd(),
} = {}) {
  assert(typeof fixturePath === 'string' && fixturePath.trim(), 'fixturePath is required');
  const resolvedRoot = resolve(repoRoot);
  const plan = await compileAttackPlan({ taskId, roadmapPath, templatesPath, repoRoot: resolvedRoot });
  const fixture = validateFixture(JSON.parse(await readFile(resolve(resolvedRoot, fixturePath), 'utf8')), taskId);
  const sourceBefore = snapshotSourceRepository(resolvedRoot);
  const tempRoot = await mkdtemp(join(tmpdir(), 'ironshade-acceptance-attack-'));
  const sandbox = join(tempRoot, 'sandbox');
  const results = [];
  let baseline;
  try {
    const clone = runGit(['clone', '--quiet', '--no-local', '--no-hardlinks', resolvedRoot, sandbox], dirname(resolvedRoot), { allowFailure: true });
    assert(clone.status === 0, `unable to create disposable attack clone: ${(clone.stderr || clone.stdout).trim()}`);
    runGit(['checkout', '--quiet', '--detach', sourceBefore.head], sandbox);
    baseline = runCommand(fixture.verifyCommand, sandbox);
    assert(baseline.exitCode === 0, `attack fixture baseline verification failed: ${baseline.stderr || baseline.stdout}`);

    for (const attack of plan.attacks) {
      const mutation = fixture.attacks[attack.templateId];
      if (!mutation) continue;
      runGit(['reset', '--hard', '--quiet', sourceBefore.head], sandbox);
      runGit(['clean', '-fdx', '--quiet'], sandbox);
      const mutationTarget = await resolveSandboxMutationTarget(sandbox, fixture.targetFile);
      await applyMutation(mutationTarget, mutation.replacements);
      const verification = runCommand(fixture.verifyCommand, sandbox);
      const outcome = classifyAttackOutcome(verification);
      results.push({
        attackId: attack.id,
        templateId: attack.templateId,
        criterionId: attack.criterionId,
        semanticViolation: attack.semanticViolation,
        outcome,
        verification,
      });
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
  const sourceAfter = snapshotSourceRepository(resolvedRoot);
  assertSourceRepositoryUnchanged(sourceBefore, sourceAfter);
  assert(results.length > 0, `fixture ${fixturePath} did not exercise any compiled attacks`);
  const summary = {
    total: results.length,
    caught: results.filter(result => result.outcome === 'caught').length,
    proofGaps: results.filter(result => result.outcome === 'proof-gap').length,
  };
  assert(summary.total === summary.caught + summary.proofGaps, 'attack outcomes must be caught or proof-gap only');
  return {
    schema: REPORT_SCHEMA,
    mode: 'advisory',
    taskId,
    planDigest: plan.planDigest,
    fixture: fixturePath,
    baseline,
    results,
    summary,
    isolation: {
      strategy: 'disposable-clone',
      sourceHead: sourceBefore.head,
      sourceBranch: sourceBefore.branch,
      sourceBranchRef: sourceBefore.branchRef,
      sourceUnchanged: true,
    },
    verdict: summary.proofGaps > 0 ? 'proof-gap' : 'attacks-caught',
    candidatePassGranted: false,
  };
}

function optionValue(args, name, fallback = null) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  assert(index + 1 < args.length, `${name} requires a value`);
  return args[index + 1];
}

async function writeJsonOutput(value, outputPath) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (!outputPath) {
    process.stdout.write(text);
    return;
  }
  await writeFile(resolve(outputPath), text);
  console.log(`ACCEPTANCE_ATTACK_OUTPUT path=${outputPath}`);
}

async function main() {
  const [, , command, ...args] = process.argv;
  assert(command === 'plan' || command === 'exercise', 'usage: acceptance-attack-compiler.mjs <plan|exercise> --task <id> [options]');
  const taskId = optionValue(args, '--task');
  const roadmapPath = optionValue(args, '--roadmap', DEFAULT_ROADMAP);
  const templatesPath = optionValue(args, '--templates', DEFAULT_TEMPLATES);
  const output = optionValue(args, '--output');
  if (command === 'plan') {
    const plan = await compileAttackPlan({ taskId, roadmapPath, templatesPath });
    await writeJsonOutput(plan, output);
    return;
  }
  const fixturePath = optionValue(args, '--fixture');
  const report = await exerciseAttackPlan({ taskId, fixturePath, roadmapPath, templatesPath });
  await writeJsonOutput(report, output);
  console.log(`ACCEPTANCE_ATTACK_ADVISORY task=${taskId} caught=${report.summary.caught} proofGaps=${report.summary.proofGaps} candidatePassGranted=false`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main().catch(error => {
    console.error(`ACCEPTANCE_ATTACK_ERROR ${error.message}`);
    process.exitCode = 1;
  });
}
