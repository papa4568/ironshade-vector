import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateTaskGraph } from './validate-task-graph.mjs';

const PROOF_KINDS = new Set([
  'test',
  'build',
  'ci',
  'artifact',
  'review',
  'invariant',
  'external',
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertString(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`);
}

function assertStringArray(value, label, { minItems = 0, unique = false } = {}) {
  assert(Array.isArray(value), `${label} must be an array`);
  assert(value.length >= minItems, `${label} must contain at least ${minItems} item(s)`);
  value.forEach((entry, index) => assertString(entry, `${label}[${index}]`));
  if (unique) assert(new Set(value).size === value.length, `${label} must not contain duplicates`);
}

function validateProof(proof, label, seenIds) {
  assert(proof && typeof proof === 'object' && !Array.isArray(proof), `${label} must be an object`);
  assertString(proof.id, `${label}.id`);
  assert(!seenIds.has(proof.id), `${label} duplicates proof id ${proof.id}`);
  seenIds.add(proof.id);
  assert(PROOF_KINDS.has(proof.kind), `${label}.${proof.id} has unsupported proof kind ${proof.kind}`);
  assert(typeof proof.required === 'boolean', `${label}.${proof.id}.required must be boolean`);
  assertString(proof.description, `${label}.${proof.id}.description`);
  if (proof.command !== undefined) assertString(proof.command, `${label}.${proof.id}.command`);
}

export function parseRoadmap(markdown) {
  assertString(markdown, 'roadmap markdown');
  const tasks = [];
  const seenIds = new Set();
  const lines = markdown.split(/\r?\n/);

  lines.forEach((line, index) => {
    const match = line.match(/^- \[([ xX])\] \*\*([A-Z][A-Z0-9-]*) — (.+?)\*\* — (.+)$/);
    if (!match) return;
    const [, marker, id, title, body] = match;
    if (marker.toLowerCase() === 'x') return;

    assert(!seenIds.has(id), `roadmap has duplicate unchecked task id ${id}`);
    seenIds.add(id);

    const doneMarker = ' **Done when:** ';
    const doneIndex = body.indexOf(doneMarker);
    assert(doneIndex >= 0, `${id} is missing a **Done when:** acceptance clause`);
    const description = body.slice(0, doneIndex).trim();
    const doneWhen = body.slice(doneIndex + doneMarker.length).trim();
    assertString(description, `${id}.description`);
    assertString(doneWhen, `${id}.doneWhen`);

    tasks.push({
      id,
      title: title.trim(),
      description,
      acceptance: [doneWhen],
      roadmapLine: index + 1,
    });
  });

  return tasks;
}

export function validateRoadmapMetadata(metadata) {
  assert(metadata && typeof metadata === 'object' && !Array.isArray(metadata), 'roadmap metadata must be an object');
  assert(metadata.schemaVersion === 1, 'roadmap metadata schemaVersion must be 1');
  assertString(metadata.roadmap, 'roadmap metadata roadmap');
  assertStringArray(metadata.roadmapIds, 'roadmap metadata roadmapIds', { unique: true });

  assert(metadata.proofProfiles && typeof metadata.proofProfiles === 'object' && !Array.isArray(metadata.proofProfiles),
    'roadmap metadata proofProfiles must be an object');
  const proofProfileNames = Object.keys(metadata.proofProfiles);
  assert(proofProfileNames.length > 0, 'roadmap metadata proofProfiles must contain at least one profile');
  for (const name of proofProfileNames) {
    assertString(name, 'proof profile name');
    const proofs = metadata.proofProfiles[name];
    assert(Array.isArray(proofs) && proofs.length > 0, `proof profile ${name} must contain at least one proof`);
    const seenProofIds = new Set();
    proofs.forEach((proof, index) => validateProof(proof, `proofProfiles.${name}[${index}]`, seenProofIds));
  }

  assert(Array.isArray(metadata.rules) && metadata.rules.length > 0, 'roadmap metadata rules must contain at least one rule');
  const seenPrefixes = new Set();
  metadata.rules.forEach((rule, index) => {
    assert(rule && typeof rule === 'object' && !Array.isArray(rule), `rules[${index}] must be an object`);
    assertString(rule.prefix, `rules[${index}].prefix`);
    assert(!seenPrefixes.has(rule.prefix), `duplicate roadmap metadata rule prefix ${rule.prefix}`);
    seenPrefixes.add(rule.prefix);
    assertStringArray(rule.affectedDomains, `rules[${index}].affectedDomains`, { minItems: 1, unique: true });
    assertString(rule.proofProfile, `rules[${index}].proofProfile`);
    assert(metadata.proofProfiles[rule.proofProfile], `rules[${index}] references unknown proof profile ${rule.proofProfile}`);
  });

  assert(metadata.overrides && typeof metadata.overrides === 'object' && !Array.isArray(metadata.overrides),
    'roadmap metadata overrides must be an object');
  const roadmapIds = new Set(metadata.roadmapIds);
  for (const [taskId, override] of Object.entries(metadata.overrides)) {
    assert(roadmapIds.has(taskId), `roadmap metadata override ${taskId} is not present in roadmapIds`);
    assert(override && typeof override === 'object' && !Array.isArray(override), `override ${taskId} must be an object`);
    if (override.dependsOn !== undefined) assertStringArray(override.dependsOn, `${taskId}.dependsOn`, { unique: true });
    if (override.affectedDomains !== undefined) {
      assertStringArray(override.affectedDomains, `${taskId}.affectedDomains`, { minItems: 1, unique: true });
    }
    if (override.proofProfile !== undefined) {
      assertString(override.proofProfile, `${taskId}.proofProfile`);
      assert(metadata.proofProfiles[override.proofProfile],
        `${taskId} references unknown proof profile ${override.proofProfile}`);
    }
    if (override.externalDependencies !== undefined) {
      assertStringArray(override.externalDependencies, `${taskId}.externalDependencies`, { unique: true });
    }
  }

  return metadata;
}

export function assertRoadmapMetadataInSync(roadmapTasks, metadata) {
  const actual = roadmapTasks.map(task => task.id);
  const expected = metadata.roadmapIds;
  if (actual.length === expected.length && actual.every((id, index) => id === expected[index])) return;

  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = actual.filter(id => !expectedSet.has(id));
  const stale = expected.filter(id => !actualSet.has(id));
  const orderMismatch = missing.length === 0 && stale.length === 0;

  const details = [
    missing.length ? `missing metadata ids=${missing.join(',')}` : null,
    stale.length ? `stale metadata ids=${stale.join(',')}` : null,
    orderMismatch ? 'roadmap order differs from metadata order' : null,
  ].filter(Boolean).join('; ');

  throw new Error(`roadmap metadata drift: ${details}. Run node agent/tools/sync-roadmap-metadata.mjs --write`);
}

function matchingRule(taskId, rules) {
  const matches = rules
    .filter(rule => taskId.startsWith(rule.prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length);
  assert(matches.length > 0, `${taskId} has no matching roadmap metadata rule`);
  if (matches.length > 1 && matches[0].prefix.length === matches[1].prefix.length) {
    throw new Error(`${taskId} matches ambiguous roadmap metadata rules ${matches[0].prefix} and ${matches[1].prefix}`);
  }
  return matches[0];
}

export function materializeRoadmapGraph(roadmapTasks, rawMetadata) {
  const metadata = validateRoadmapMetadata(rawMetadata);
  assertRoadmapMetadataInSync(roadmapTasks, metadata);

  const taskIndexes = new Map(roadmapTasks.map((task, index) => [task.id, index]));
  const tasks = roadmapTasks.map((roadmapTask, index) => {
    const rule = matchingRule(roadmapTask.id, metadata.rules);
    const override = metadata.overrides[roadmapTask.id] ?? {};
    const dependsOn = override.dependsOn ?? [];
    for (const dependencyId of dependsOn) {
      assert(taskIndexes.has(dependencyId),
        `${roadmapTask.id} depends on ${dependencyId}, which is not an active roadmap task; sync metadata after roadmap archival`);
      assert(taskIndexes.get(dependencyId) < index,
        `${roadmapTask.id} depends on ${dependencyId}, but roadmap dependencies must appear earlier than their dependents`);
    }

    const proofProfile = override.proofProfile ?? rule.proofProfile;
    const affectedDomains = override.affectedDomains ?? rule.affectedDomains;
    const proofs = structuredClone(metadata.proofProfiles[proofProfile]);
    const externalDependencies = override.externalDependencies ?? [];

    return {
      id: roadmapTask.id,
      title: roadmapTask.title,
      priority: index,
      status: index === 0 ? 'ready' : 'planned',
      dependsOn,
      acceptance: roadmapTask.acceptance,
      affectedDomains,
      proofs,
      externalDependencies,
      notes: `Derived from ${metadata.roadmap} line ${roadmapTask.roadmapLine}; title and acceptance remain Markdown-authoritative.`,
    };
  });

  const graph = {
    schemaVersion: 1,
    scope: 'product-roadmap-adapter',
    authority: {
      authoritativeForPatterns: ['P*'],
      fallbackQueue: metadata.roadmap,
      notes: 'Compatibility mode: Markdown order is authoritative. Sidecar metadata adds machine-readable domains, proofs, and optional dependencies without duplicating acceptance text.',
    },
    tasks,
  };
  validateTaskGraph(graph);
  return graph;
}

export function synchronizeRoadmapMetadata(rawMetadata, roadmapTasks) {
  const metadata = structuredClone(validateRoadmapMetadata(rawMetadata));
  const activeIds = roadmapTasks.map(task => task.id);
  const activeSet = new Set(activeIds);
  metadata.roadmapIds = activeIds;

  for (const taskId of Object.keys(metadata.overrides)) {
    if (!activeSet.has(taskId)) {
      delete metadata.overrides[taskId];
      continue;
    }
    const override = metadata.overrides[taskId];
    if (override.dependsOn) {
      override.dependsOn = override.dependsOn.filter(dependencyId => activeSet.has(dependencyId));
      if (override.dependsOn.length === 0) delete override.dependsOn;
    }
  }

  return metadata;
}

export function selectNextRoadmapTask(graph) {
  validateTaskGraph(graph);
  return graph.tasks[0] ?? null;
}

export async function loadRoadmapAdapter({
  metadataPath = resolve('agent/roadmap-metadata.json'),
  roadmapPath,
} = {}) {
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
  validateRoadmapMetadata(metadata);
  const resolvedRoadmapPath = roadmapPath ? resolve(roadmapPath) : resolve(metadata.roadmap);
  const roadmap = await readFile(resolvedRoadmapPath, 'utf8');
  const roadmapTasks = parseRoadmap(roadmap);
  const graph = materializeRoadmapGraph(roadmapTasks, metadata);
  return { metadata, roadmapTasks, graph, roadmapPath: resolvedRoadmapPath };
}

async function main() {
  const { roadmapTasks, graph } = await loadRoadmapAdapter();
  const next = selectNextRoadmapTask(graph);
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(graph, null, 2));
    return;
  }
  if (process.argv.includes('--validate-only')) {
    console.log(`ROADMAP_ADAPTER_VALID tasks=${graph.tasks.length} next=${next?.id ?? 'none'}`);
    return;
  }
  if (!next) {
    console.log('ROADMAP_NEXT_TASK none');
    return;
  }
  console.log(`ROADMAP_NEXT_TASK id=${next.id} index=0 title=${JSON.stringify(next.title)} acceptance=${next.acceptance.length} domains=${next.affectedDomains.join(',')} activeTasks=${roadmapTasks.length}`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main().catch(error => {
    console.error(`ROADMAP_ADAPTER_INVALID ${error.message}`);
    process.exitCode = 1;
  });
}
