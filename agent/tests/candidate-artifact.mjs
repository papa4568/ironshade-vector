import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildCandidateArtifactManifest,
  inspectArtifactTree,
  validateCandidateArtifact,
  validateCandidateArtifactManifestShape,
} from '../tools/candidate-artifact.mjs';

const CANDIDATE = '1111111111111111111111111111111111111111';
const OTHER = '2222222222222222222222222222222222222222';
const root = await mkdtemp(join(tmpdir(), 'ironshade-candidate-artifact-'));
const dist = join(root, 'dist');

try {
  await mkdir(join(dist, 'assets'), { recursive: true });
  await writeFile(join(dist, 'index.html'), '<!doctype html><title>Ironshade</title>\n');
  await writeFile(join(dist, 'assets', 'app.js'), 'console.log("candidate");\n');
  await writeFile(join(dist, 'assets', 'app.css'), 'body { margin: 0; }\n');

  const inspected = await inspectArtifactTree(dist);
  assert.equal(inspected.fileCount, 3);
  assert.deepEqual(inspected.files.map(file => file.path), ['assets/app.css', 'assets/app.js', 'index.html']);

  const manifest = await buildCandidateArtifactManifest({
    candidateSha: CANDIDATE,
    artifactRoot: dist,
  });
  validateCandidateArtifactManifestShape(manifest);
  assert.equal(manifest.candidateSha, CANDIDATE);
  assert.equal(manifest.fileCount, 3);
  assert.match(manifest.treeSha256, /^[a-f0-9]{64}$/);

  const valid = await validateCandidateArtifact({
    manifest,
    artifactRoot: dist,
    expectedCandidateSha: CANDIDATE,
  });
  assert.equal(valid.treeSha256, manifest.treeSha256);

  await assert.rejects(
    validateCandidateArtifact({ manifest, artifactRoot: dist, expectedCandidateSha: OTHER }),
    /belongs to .* expected/,
  );

  await writeFile(join(dist, 'assets', 'app.js'), 'console.log("tampered");\n');
  await assert.rejects(
    validateCandidateArtifact({ manifest, artifactRoot: dist, expectedCandidateSha: CANDIDATE }),
    /tree digest changed|byte count changed|file inventory changed/,
  );

  await writeFile(join(dist, 'assets', 'app.js'), 'console.log("candidate");\n');
  await writeFile(join(dist, 'extra.txt'), 'unexpected\n');
  await assert.rejects(
    validateCandidateArtifact({ manifest, artifactRoot: dist, expectedCandidateSha: CANDIDATE }),
    /file count changed/,
  );

  const malformed = structuredClone(manifest);
  malformed.files.reverse();
  assert.throws(() => validateCandidateArtifactManifestShape(malformed), /strictly sorted/);

  console.log(`CANDIDATE_ARTIFACT_TEST_PASS files=${manifest.fileCount} treeSha256=${manifest.treeSha256} wrongSha=reject tamper=reject extraFile=reject`);
} finally {
  await rm(root, { recursive: true, force: true });
}
