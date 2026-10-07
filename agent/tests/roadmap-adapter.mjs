import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  materializeRoadmapGraph,
  parseRoadmap,
  selectNextRoadmapTask,
  synchronizeRoadmapMetadata,
  validateRoadmapMetadata,
} from '../tools/roadmap-adapter.mjs';

function clone(value) {
  return structuredClone(value);
}

const fixture = `# Roadmap

- [x] **P1-A0 — Completed item** — Historical work. **Done when:** it is done.
- [ ] **P1-A1 — First active item** — Implement the first item. **Done when:** behavior one passes.
- [ ] **P1-A2 — Second active item** — Implement the second item. **Done when:** behavior two passes.
`;

const parsedFixture = parseRoadmap(fixture);
assert.deepEqual(parsedFixture.map(task => task.id), ['P1-A1', 'P1-A2']);
assert.equal(parsedFixture[0].title, 'First active item');
assert.deepEqual(parsedFixture[0].acceptance, ['behavior one passes.']);
assert.equal(parsedFixture[0].roadmapLine, 4);

assert.throws(
  () => parseRoadmap('- [ ] **P1-A1 — Missing acceptance** — No acceptance marker.'),
  /missing a \*\*Done when:\*\* acceptance clause/,
);

const metadataPath = resolve('agent/roadmap-metadata.json');
const roadmapPath = resolve('docs/content-roadmap.md');
const metadataRaw = await readFile(metadataPath, 'utf8');
const metadata = JSON.parse(metadataRaw);
const roadmap = await readFile(roadmapPath, 'utf8');
const roadmapTasks = parseRoadmap(roadmap);

validateRoadmapMetadata(metadata);
assert.equal(metadata.roadmap, 'docs/content-roadmap.md');
assert.equal(roadmapTasks.length, 40);
assert.equal(roadmapTasks[0].id, 'P28-C4');
assert.equal(roadmapTasks.at(-1).id, 'P28-H4');
assert(!metadataRaw.includes('Add LOD0 refinery conduit and gantry modules'));
assert(!metadataRaw.includes('Flagship uses the new assets'));

const graph = materializeRoadmapGraph(roadmapTasks, metadata);
assert.equal(graph.tasks.length, roadmapTasks.length);
assert.equal(graph.tasks[0].id, 'P28-C4');
assert.equal(graph.tasks[0].status, 'ready');
assert.equal(graph.tasks[1].status, 'planned');
assert.equal(graph.tasks[0].title, roadmapTasks[0].title);
assert.deepEqual(graph.tasks[0].acceptance, roadmapTasks[0].acceptance);
assert.deepEqual(graph.tasks[0].affectedDomains, ['graphics', 'refinery', 'assets']);
assert.equal(graph.tasks[0].proofs.find(proof => proof.id === 'production-build')?.command, 'npm run build:prod');
assert.equal(selectNextRoadmapTask(graph)?.id, 'P28-C4');

const driftMissing = clone(metadata);
driftMissing.roadmapIds.shift();
assert.throws(() => materializeRoadmapGraph(roadmapTasks, driftMissing), /roadmap metadata drift/);

const driftOrder = clone(metadata);
[driftOrder.roadmapIds[0], driftOrder.roadmapIds[1]] = [driftOrder.roadmapIds[1], driftOrder.roadmapIds[0]];
assert.throws(() => materializeRoadmapGraph(roadmapTasks, driftOrder), /roadmap order differs from metadata order/);

const lateDependency = clone(metadata);
lateDependency.overrides['P28-C4'] = { dependsOn: ['P28-C5'] };
assert.throws(
  () => materializeRoadmapGraph(roadmapTasks, lateDependency),
  /roadmap dependencies must appear earlier than their dependents/,
);

const staleDependencyMetadata = clone(metadata);
staleDependencyMetadata.overrides['P28-C5'] = { dependsOn: ['P28-C4'] };
const synchronized = synchronizeRoadmapMetadata(staleDependencyMetadata, roadmapTasks.slice(1));
assert.equal(synchronized.roadmapIds[0], 'P28-C5');
assert(!synchronized.roadmapIds.includes('P28-C4'));
assert.equal(synchronized.overrides['P28-C5']?.dependsOn, undefined);

const unknownRuleMetadata = clone(metadata);
const unknownRuleTasks = clone(roadmapTasks);
unknownRuleTasks[0].id = 'P29-X1';
unknownRuleMetadata.roadmapIds[0] = 'P29-X1';
assert.throws(() => materializeRoadmapGraph(unknownRuleTasks, unknownRuleMetadata), /has no matching roadmap metadata rule/);

console.log(`ROADMAP_ADAPTER_TEST_PASS tasks=${graph.tasks.length} first=${graph.tasks[0].id} last=${graph.tasks.at(-1).id} profiles=${Object.keys(metadata.proofProfiles).length}`);
