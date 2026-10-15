import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { buildRoadmapShadowValidationReport as buildBaseReport } from './roadmap-shadow-validation.mjs';

const execFileAsync = promisify(execFile);

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

async function git(repoRoot, args) {
  const { stdout } = await execFileAsync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 8,
  });
  return stdout.trim();
}

export function summarizeIndependentRevisionHits(predictedSurfaces, observations, minimumIndependentHitCount = 2) {
  assert(Array.isArray(predictedSurfaces) && predictedSurfaces.length > 0, 'predictedSurfaces must be non-empty');
  assert(Array.isArray(observations), 'observations must be an array');
  assert(Number.isInteger(minimumIndependentHitCount) && minimumIndependentHitCount >= 2, 'minimumIndependentHitCount must be at least 2');

  return predictedSurfaces.map(path => {
    const hitRevisions = observations
      .filter(observation => observation.predictedSurfaceHits.includes(path))
      .map(observation => observation.revision);
    return {
      path,
      independentHitCount: hitRevisions.length,
      hitRevisions,
      repeatable: hitRevisions.length >= minimumIndependentHitCount,
    };
  });
}

async function measureIndependentRevisionEvidence(repoRoot, baseReport) {
  const revisions = baseReport.surfacePrediction.featureRevisionObservations.map(observation => observation.revision);
  const predictedSurfaces = baseReport.surfacePrediction.normalizedPredictedSurfaces;
  const observations = [];

  for (const revision of revisions) {
    const parent = await git(repoRoot, ['rev-parse', `${revision}^`]);
    const changedText = await git(repoRoot, ['diff', '--name-only', `${parent}..${revision}`]);
    const productionSurfaces = changedText
      ? changedText.split('\n').filter(path => path.startsWith('src/'))
      : [];
    observations.push({
      revision,
      parent,
      productionSurfaces,
      predictedSurfaceHits: predictedSurfaces.filter(path => productionSurfaces.includes(path)),
    });
  }

  const minimumIndependentHitCount = 2;
  const signalEvidence = summarizeIndependentRevisionHits(predictedSurfaces, observations, minimumIndependentHitCount);
  const repeatableSignals = signalEvidence.filter(signal => signal.repeatable);
  const maximumObservedHitCount = signalEvidence.reduce((maximum, signal) => Math.max(maximum, signal.independentHitCount), 0);

  return {
    observationMode: 'per-commit-non-cumulative',
    minimumIndependentHitCount,
    observations,
    signalEvidence,
    repeatableSignals,
    maximumObservedHitCount,
    established: repeatableSignals.length > 0,
  };
}

export async function buildRoadmapShadowValidationReport({ candidateSha, corpus = null, repoRoot = resolve('.') } = {}) {
  const baseReport = await buildBaseReport({ candidateSha, corpus, repoRoot });
  const independentRevisionEvidence = await measureIndependentRevisionEvidence(repoRoot, baseReport);

  const supportedSignals = independentRevisionEvidence.repeatableSignals.map(signal => ({
    id: `expected-surface:${signal.path}`,
    resolvedPath: signal.path,
    independentHitCount: signal.independentHitCount,
    hitRevisions: signal.hitRevisions,
    repeatable: true,
  }));

  const surfacePrediction = {
    ...baseReport.surfacePrediction,
    diagnosticCumulativeFeatureRevisionObservations: baseReport.surfacePrediction.featureRevisionObservations,
    featureRevisionObservations: independentRevisionEvidence.observations,
    independentRevisionEvidence: {
      observationMode: independentRevisionEvidence.observationMode,
      minimumIndependentHitCount: independentRevisionEvidence.minimumIndependentHitCount,
      signalEvidence: independentRevisionEvidence.signalEvidence,
      maximumObservedHitCount: independentRevisionEvidence.maximumObservedHitCount,
      established: independentRevisionEvidence.established,
    },
    supportedSignals,
  };

  const report = {
    ...baseReport,
    schema: 'ironshade-roadmap-shadow-validation-report:v4',
    schemaVersion: 4,
    surfacePrediction,
    supportedSignals,
    repeatability: {
      established: independentRevisionEvidence.established,
      observationMode: independentRevisionEvidence.observationMode,
      minimumIndependentHitCount: independentRevisionEvidence.minimumIndependentHitCount,
      maximumObservedHitCount: independentRevisionEvidence.maximumObservedHitCount,
      blocker: independentRevisionEvidence.established
        ? null
        : 'No frozen EV-7 expected surface was independently re-selected in at least two non-cumulative implementation deltas. A second independent later implementation outcome or other predeclared independent prediction trial is required before EV-19 can claim repeatable predictive value.',
    },
    conclusion: {
      ...baseReport.conclusion,
      repeatablePredictiveValueFound: independentRevisionEvidence.established,
      enforcementEligible: false,
      rationale: independentRevisionEvidence.established
        ? 'At least one frozen EV-7 expected surface has repeatable predictive value across independent non-cumulative implementation deltas.'
        : 'The frozen EV-7 surface forecast is measurable but not repeatable: P28-PLOAD2 produced one predicted-surface hit, one false alarm, and three missed production surfaces, while per-commit deltas contain only one independent hit for the best predicted surface. Cumulative base-to-revision snapshots are retained only as diagnostics and do not count as repeatability evidence. EV-19 therefore remains incomplete and advisory until an independent later outcome or predeclared independent prediction trial provides repeatability evidence.',
    },
  };
  delete report.reportDigest;
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
  assert(!args.includes('--enforce'), 'EV-19 remains calibration-only; no Roadmap Shadow signal is enforcement-ready');
  const repoRoot = resolve(readArg(args, '--repo-root') ?? '.');
  const candidateSha = readArg(args, '--candidate-sha') ?? await git(repoRoot, ['rev-parse', 'HEAD']);
  const output = readArg(args, '--output');
  const report = await buildRoadmapShadowValidationReport({ candidateSha, repoRoot });
  if (output) {
    const outputPath = resolve(repoRoot, output);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, canonicalJson(report), 'utf8');
  }
  console.log(`EV19_ROADMAP_SHADOW_VALIDATION_PASS candidate=${report.candidateSha} useful=${report.surfacePrediction.usefulPredictionCount} fp=${report.surfacePrediction.falseAlarmCount} fn=${report.surfacePrediction.missedIntegrationPressureCount} independentMax=${report.repeatability.maximumObservedHitCount} repeatable=${report.repeatability.established} supported=${report.supportedSignals.map(signal => signal.id).join(',')} enforcement=false digest=${report.reportDigest}`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main().catch(error => {
    console.error(`EV19_ROADMAP_SHADOW_VALIDATION_INVALID ${error.message}`);
    process.exitCode = 1;
  });
}
