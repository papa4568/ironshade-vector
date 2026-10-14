import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { selectAffectedVerification, validateImpactMap } from './select-affected-verification.mjs';

const SHA_PATTERN = /^[a-f0-9]{40}$/;

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

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function signature(selection) {
  return {
    mode: selection.mode,
    escalated: selection.escalated,
    verificationIds: selection.verifications.map(entry => entry.id),
    matchedRuleIds: [...selection.matchedRuleIds],
    unknownFiles: [...selection.unknownFiles],
  };
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function decisionCalibration(corpus) {
  const threshold = corpus.minimumIndependentMissesForWidening;
  let falsePositives = 0;
  let falseNegatives = 0;
  const cases = [];
  for (const [kind, entries] of Object.entries({ positive: corpus.decisionCalibration?.positive ?? [], negative: corpus.decisionCalibration?.negative ?? [] })) {
    for (const entry of entries) {
      const observedRecommend = entry.missCount >= threshold && entry.independentTargetCount >= threshold;
      const pass = observedRecommend === entry.expectedRecommend;
      if (!pass && entry.expectedRecommend) falseNegatives += 1;
      if (!pass && !entry.expectedRecommend) falsePositives += 1;
      cases.push({ id: entry.id, kind, expectedRecommend: entry.expectedRecommend, observedRecommend, pass });
    }
  }
  return { cases, falsePositives, falseNegatives, pass: falsePositives === 0 && falseNegatives === 0 };
}

function compareMaps(currentMap, baselineMap, promotedRuleId) {
  assert(same(currentMap.fallback, baselineMap.fallback), 'EV-16 may not change impact-map fallback semantics');
  assert(same(currentMap.verifications, baselineMap.verifications), 'EV-16 may not change verification command definitions');
  const currentById = new Map(currentMap.rules.map(rule => [rule.id, rule]));
  const baselineById = new Map(baselineMap.rules.map(rule => [rule.id, rule]));
  assert(currentById.size === baselineById.size, 'EV-16 may not add or remove impact-map rules');
  for (const [ruleId, baselineRule] of baselineById) {
    const currentRule = currentById.get(ruleId);
    assert(currentRule, `EV-16 removed impact rule ${ruleId}`);
    if (ruleId !== promotedRuleId) {
      assert(same(currentRule, baselineRule), `EV-16 changed unpromoted impact rule ${ruleId}`);
      continue;
    }
    const currentComparable = structuredClone(currentRule);
    const baselineComparable = structuredClone(baselineRule);
    delete currentComparable.promotion;
    delete currentComparable.reason;
    delete baselineComparable.reason;
    currentComparable.risk = baselineComparable.risk;
    assert(same(currentComparable, baselineComparable), 'EV-16 changed UI rule semantics beyond risk/reason/promotion metadata');
    assert(baselineRule.risk === 'normal', 'EV-16 baseline UI rule must be normal risk');
    assert(currentRule.risk === 'high', 'EV-16 promoted UI rule must be high risk');
  }
}

export function validateImpactWideningContract({ impactMap, baselineMap, corpus, corpusGitBlobSha }) {
  validateImpactMap(impactMap);
  validateImpactMap(baselineMap);
  assert(corpus?.schemaVersion === 1 && corpus.mode === 'advisory' && corpus.promotionTarget === 'EV-16', 'EV-16 requires the archived EV-15 advisory corpus');
  assert(corpus.errorBudget?.falsePositiveWidenings === 0 && corpus.errorBudget?.falseNegativeWidenings === 0, 'EV-15 widening decision budgets must remain zero');
  assert(corpus.minimumIndependentMissesForWidening >= 2, 'EV-15 widening threshold must remain at least two independent misses');

  const promoted = impactMap.rules.filter(rule => rule.promotion?.taskId === 'EV-16');
  assert(promoted.length === 1, `EV-16 must promote exactly one impact rule, found ${promoted.length}`);
  const rule = promoted[0];
  assert(rule.id === 'ui-and-design-system', `EV-16 may promote only ui-and-design-system, found ${rule.id}`);
  const promotion = rule.promotion;
  assert(promotion.sourceTaskId === 'EV-15', 'EV-16 promotion must cite EV-15');
  assert(promotion.sourceCorpusPath === 'agent/impact-calibration-corpus.json', 'EV-16 promotion corpus path drifted');
  assert(promotion.sourceCorpusGitBlobSha === corpusGitBlobSha, 'EV-16 source corpus Git blob does not match the committed EV-15 corpus');
  assert(promotion.sourceImpactMapGitBlobSha === '7212e618374cff242fcc992faa260fad328e7026', 'EV-16 pre-promotion impact-map blob drifted');
  assert(promotion.sourceCandidateSha === '295ec87024e34be6d724cee60fa432b375712a96', 'EV-16 EV-15 source candidate drifted');
  assert(promotion.sourceWorkflowRunId === 38624196233, 'EV-16 EV-15 source workflow run drifted');
  assert(promotion.sourceArtifactId === 11923980804, 'EV-16 EV-15 source artifact drifted');
  assert(promotion.sourceArtifactDigest === 'sha256:5acf0a2ab2429a01868bda7de61b846cd6f82f89f29d4eff8c947f4ea093ae53', 'EV-16 EV-15 source artifact digest drifted');
  assert(promotion.previousRisk === 'normal', 'EV-16 previous risk must remain normal');
  assert(promotion.disableEnvironmentVariable === 'IRONSHADE_IMPACT_WIDENING_ENFORCEMENT' && promotion.disabledValue === '0', 'EV-16 rollback switch drifted');

  const probes = corpus.executableMissProbes ?? [];
  assert(probes.length >= 2, 'EV-16 requires at least two EV-15 executable miss probes');
  assert(probes.every(probe => probe.expectedRuleId === rule.id && probe.wideningAction === 'escalate-rule-to-full'), 'EV-16 corpus contains an unsupported widening scope');
  assert(new Set(probes.map(probe => probe.targetPath)).size >= 2, 'EV-16 requires independent EV-15 probe targets');
  const decision = decisionCalibration(corpus);
  assert(decision.pass, 'EV-16 source widening-decision calibration exceeds zero-error budget');

  compareMaps(impactMap, baselineMap, rule.id);
  return { rule, promotion, probes, decision };
}

export function calibrateImpactWidening({ impactMap, baselineMap, corpus }) {
  const promotedRule = impactMap.rules.find(rule => rule.promotion?.taskId === 'EV-16');
  assert(promotedRule, 'EV-16 promoted rule is missing');
  const promotion = promotedRule.promotion;
  const activeEnv = {};
  const rollbackEnv = { [promotion.disableEnvironmentVariable]: promotion.disabledValue };
  let falsePositives = 0;
  let falseNegatives = 0;
  const positiveTrials = [];
  const negativeTrials = [];
  const rollbackTrials = [];

  for (const probe of corpus.executableMissProbes) {
    const baseline = selectAffectedVerification(probe.changedFiles, baselineMap, { env: activeEnv });
    const active = selectAffectedVerification(probe.changedFiles, impactMap, { env: activeEnv });
    const rollback = selectAffectedVerification(probe.changedFiles, impactMap, { env: rollbackEnv });
    const detected = active.mode === 'full' && active.verifications.map(entry => entry.id).join(',') === 'verify-full';
    if (!detected) falseNegatives += 1;
    const rollbackMatches = same(signature(rollback), signature(baseline));
    positiveTrials.push({ id: probe.id, detected, active: signature(active) });
    rollbackTrials.push({ id: probe.id, rollbackMatches, rollback: signature(rollback), baseline: signature(baseline) });
  }

  const controls = [
    { id: 'unpromoted-normal-rule', files: ['src/game/babylonAbilityVfx.ts'] },
    { id: 'documentation-only', files: ['docs/product-constraints.md'] },
  ];
  for (const control of controls) {
    const baseline = selectAffectedVerification(control.files, baselineMap, { env: activeEnv });
    const active = selectAffectedVerification(control.files, impactMap, { env: activeEnv });
    const rollback = selectAffectedVerification(control.files, impactMap, { env: rollbackEnv });
    const unchanged = same(signature(active), signature(baseline));
    if (!unchanged) falsePositives += 1;
    const rollbackMatches = same(signature(rollback), signature(baseline));
    negativeTrials.push({ id: control.id, unchanged, active: signature(active), baseline: signature(baseline) });
    rollbackTrials.push({ id: control.id, rollbackMatches, rollback: signature(rollback), baseline: signature(baseline) });
  }

  return {
    falsePositives,
    falseNegatives,
    positiveTrials,
    negativeTrials,
    rollbackTrials,
    rollbackPass: rollbackTrials.every(trial => trial.rollbackMatches),
    pass: falsePositives === 0 && falseNegatives === 0 && rollbackTrials.every(trial => trial.rollbackMatches),
  };
}

export async function generateImpactWideningReport({ candidateSha }) {
  assert(SHA_PATTERN.test(candidateSha ?? ''), 'candidateSha must be a full lowercase commit SHA');
  const head = git(['rev-parse', 'HEAD']);
  assert(head === candidateSha, `candidateSha ${candidateSha} does not match checked-out HEAD ${head}`);
  const impactMap = JSON.parse(await readFile(resolve('agent/impact-map.json'), 'utf8'));
  const corpus = JSON.parse(await readFile(resolve('agent/impact-calibration-corpus.json'), 'utf8'));
  const corpusGitBlobSha = git(['hash-object', 'agent/impact-calibration-corpus.json']);
  const baselineBlob = impactMap.rules.find(rule => rule.promotion?.taskId === 'EV-16')?.promotion?.sourceImpactMapGitBlobSha;
  assert(SHA_PATTERN.test(baselineBlob ?? ''), 'EV-16 baseline impact-map blob is missing');
  const baselineMap = JSON.parse(execFileSync('git', ['cat-file', '-p', baselineBlob], { encoding: 'utf8' }));
  const contract = validateImpactWideningContract({ impactMap, baselineMap, corpus, corpusGitBlobSha });
  const calibration = calibrateImpactWidening({ impactMap, baselineMap, corpus });
  assert(calibration.pass, `EV-16 promotion calibration failed fp=${calibration.falsePositives} fn=${calibration.falseNegatives} rollback=${calibration.rollbackPass}`);
  return {
    schemaVersion: 1,
    taskId: 'EV-16',
    candidateSha,
    mode: 'enforced-impact-widening',
    selectedRuleId: contract.rule.id,
    resultingVerification: 'verify-full',
    sourceEvidence: {
      taskId: contract.promotion.sourceTaskId,
      corpusPath: contract.promotion.sourceCorpusPath,
      corpusGitBlobSha,
      prePromotionImpactMapGitBlobSha: contract.promotion.sourceImpactMapGitBlobSha,
      candidateSha: contract.promotion.sourceCandidateSha,
      workflowRunId: contract.promotion.sourceWorkflowRunId,
      artifactId: contract.promotion.sourceArtifactId,
      artifactDigest: contract.promotion.sourceArtifactDigest,
      wideningDecisionFalsePositives: contract.decision.falsePositives,
      wideningDecisionFalseNegatives: contract.decision.falseNegatives,
    },
    calibration: {
      errorBudget: { falsePositives: 0, falseNegatives: 0 },
      measuredErrors: { falsePositives: calibration.falsePositives, falseNegatives: calibration.falseNegatives },
      positiveTrials: calibration.positiveTrials,
      negativeTrials: calibration.negativeTrials,
    },
    rollback: {
      environmentVariable: contract.promotion.disableEnvironmentVariable,
      disabledValue: contract.promotion.disabledValue,
      restoresPreviousStaticBehavior: calibration.rollbackPass,
      trials: calibration.rollbackTrials,
    },
    unresolvedNormalRiskRules: impactMap.rules.filter(rule => rule.risk === 'normal').map(rule => rule.id).sort(),
    acceptedForEnforcement: true,
    blocking: true,
    candidatePassGranted: false,
  };
}

function parseArguments(argv) {
  const options = { candidateSha: null, output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--candidate-sha') options.candidateSha = argv[++index] ?? null;
    else if (argument === '--output') options.output = argv[++index] ?? null;
    else throw new Error(`unknown argument ${argument}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const report = await generateImpactWideningReport({ candidateSha: options.candidateSha });
  if (options.output) {
    const outputPath = resolve(options.output);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, canonicalJson(report), 'utf8');
  }
  console.log(`EV16_IMPACT_WIDENING_PASS candidate=${report.candidateSha} rule=${report.selectedRuleId} fp=${report.calibration.measuredErrors.falsePositives} fn=${report.calibration.measuredErrors.falseNegatives} rollback=${report.rollback.restoresPreviousStaticBehavior}`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main().catch(error => {
    console.error(`EV16_IMPACT_WIDENING_ERROR ${error.message}`);
    process.exitCode = 1;
  });
}
