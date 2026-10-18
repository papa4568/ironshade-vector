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
const roadmapIds = roadmapTasks.map(task => task.id);
const firstTask = roadmapTasks[0];
const secondTask = roadmapTasks[1];

validateRoadmapMetadata(metadata);
assert.equal(metadata.roadmap, 'docs/content-roadmap.md');
// Queue cardinality intentionally follows the live roadmap so closing a verified item cannot make this adapter test stale.
assert(roadmapTasks.length > 0, 'active roadmap should contain at least one executable task');
assert.deepEqual(metadata.roadmapIds, roadmapIds);
assert(!metadataRaw.includes(firstTask.title));
assert(!metadataRaw.includes(firstTask.acceptance[0]));

const graph = materializeRoadmapGraph(roadmapTasks, metadata);
const firstRule = metadata.rules.find(rule => firstTask.id.startsWith(rule.prefix));
assert(firstRule, `missing metadata rule for ${firstTask.id}`);
assert.equal(graph.tasks.length, roadmapTasks.length);
assert.equal(graph.tasks[0].id, firstTask.id);
assert.equal(graph.tasks[0].status, 'ready');
if (graph.tasks[1]) assert.equal(graph.tasks[1].status, 'planned');
assert.equal(graph.tasks[0].title, firstTask.title);
assert.deepEqual(graph.tasks[0].acceptance, firstTask.acceptance);
assert.deepEqual(graph.tasks[0].affectedDomains, firstRule.affectedDomains);
assert.equal(graph.tasks[0].proofs.find(proof => proof.id === 'production-build')?.command, 'npm run build:prod');
assert.equal(selectNextRoadmapTask(graph)?.id, firstTask.id);

const driftMissing = clone(metadata);
driftMissing.roadmapIds.shift();
assert.throws(() => materializeRoadmapGraph(roadmapTasks, driftMissing), /roadmap metadata drift/);

if (secondTask) {
  const driftOrder = clone(metadata);
  [driftOrder.roadmapIds[0], driftOrder.roadmapIds[1]] = [driftOrder.roadmapIds[1], driftOrder.roadmapIds[0]];
  assert.throws(() => materializeRoadmapGraph(roadmapTasks, driftOrder), /roadmap order differs from metadata order/);

  const lateDependency = clone(metadata);
  lateDependency.overrides[firstTask.id] = { dependsOn: [secondTask.id] };
  assert.throws(
    () => materializeRoadmapGraph(roadmapTasks, lateDependency),
    /roadmap dependencies must appear earlier than their dependents/,
  );

  const staleDependencyMetadata = clone(metadata);
  staleDependencyMetadata.overrides[secondTask.id] = { dependsOn: [firstTask.id] };
  const synchronized = synchronizeRoadmapMetadata(staleDependencyMetadata, roadmapTasks.slice(1));
  assert.equal(synchronized.roadmapIds[0], secondTask.id);
  assert(!synchronized.roadmapIds.includes(firstTask.id));
  assert.equal(synchronized.overrides[secondTask.id]?.dependsOn, undefined);
}

const unknownRuleMetadata = clone(metadata);
const unknownRuleTasks = clone(roadmapTasks);
unknownRuleTasks[0].id = 'P29-X1';
unknownRuleMetadata.roadmapIds[0] = 'P29-X1';
assert.throws(() => materializeRoadmapGraph(unknownRuleTasks, unknownRuleMetadata), /has no matching roadmap metadata rule/);

console.log(`ROADMAP_ADAPTER_TEST_PASS tasks=${graph.tasks.length} first=${graph.tasks[0].id} last=${graph.tasks.at(-1).id} profiles=${Object.keys(metadata.proofProfiles).length}`);

// Ensure every production campaign location has a named P28 rollout, even after tasks move to the archive.
// This independent location inventory catches newly added zones omitted from future visual planning.
const campaignSource = await readFile(resolve('src/game/campaign.ts'), 'utf8');
const locationType = campaignSource.match(/export type LocationId = ([^;]+);/)?.[1];
assert(locationType, 'campaign LocationId type must remain discoverable for graphics rollout coverage');
const campaignLocationIds = [...locationType.matchAll(/'([^']+)'/g)].map(match => match[1]);

const plannedLocationRefreshes = {
  'asteroid-refinery': ['P28-F7', 'Pass the P28 heavy-asset acceptance gate before broad rollout'],
  'orbital-station': ['P28-G1', 'Refresh Orbital Station visuals'],
  'damaged-vessel': ['P28-G2', 'Refresh Damaged Vessel visuals'],
  'spin-habitat': ['P28-G3', 'Refresh Spin Habitat visuals'],
  'jovian-harvester': ['P28-G4', 'Refresh Jovian Harvester visuals'],
  'ice-mine': ['P28-G5', 'Refresh Ice Mine visuals'],
  'solar-yard': ['P28-G10', 'Refresh Solar Fabrication Yard visuals'],
  'lattice-annex': ['P28-G6', 'Refresh Lattice Annex visuals'],
  'momentum-exchange': ['P28-G7', 'Refresh Momentum Exchange visuals'],
  'cryo-reserve': ['P28-G8', 'Refresh Cryo Reserve visuals'],
  'parallax-array': ['P28-G9', 'Refresh Parallax Array visuals'],
};
assert.deepEqual(
  [...campaignLocationIds].sort(),
  Object.keys(plannedLocationRefreshes).sort(),
  'every playable campaign location must be assigned to an explicit flagship-art rollout task',
);

const roadmapArchive = await readFile(resolve('docs/content-roadmap-archive.md'), 'utf8');
const rolloutTaskText = roadmap + '\n' + roadmapArchive;
for (const [location, [taskId, title]] of Object.entries(plannedLocationRefreshes)) {
  assert(
    rolloutTaskText.includes('**' + taskId + ' — ' + title + '**'),
    location + ' must have an explicit current or archived P28 flagship-art rollout task',
  );
}
for (const [taskId, title] of [
  ['P28-H1', 'Refresh Perseid capstone visuals'],
  ['P28-H2', 'Refresh K-91 capstone visuals'],
  ['P28-H3', 'Refresh Orpheline capstone visuals'],
  ['P28-H4', 'Refresh Hecate capstone visuals'],
]) {
  assert(rolloutTaskText.includes('**' + taskId + ' — ' + title + '**'),
    taskId + ' capstone must have a current or archived flagship-art rollout task');
}
const currentOrArchived = rolloutTaskText;
assert(
  currentOrArchived.includes('**P28-I1 — Verify complete P28 asset adoption in every playable location and capstone**'),
  'campaign-wide premium asset coverage needs a final verification gate',
);
const productConstraints = await readFile(resolve('docs/product-constraints.md'), 'utf8');
assert(
  productConstraints.includes('**Cross-location premium asset propagation:**'),
  'future shared asset creation must carry a permanent all-route propagation policy',
);
console.log('P28_ROLLOUT_COVERAGE_PASS campaignLocations=' + campaignLocationIds.length + ' capstones=4 assetAudit=P28-I1');
