import json
from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one replacement target, found {count}')
    p.write_text(text.replace(old, new, 1))


impact_path = Path('agent/impact-map.json')
impact = json.loads(impact_path.read_text())
ui = next(rule for rule in impact['rules'] if rule['id'] == 'ui-and-design-system')
if ui['risk'] != 'normal':
    raise SystemExit(f"ui-and-design-system expected normal risk before EV-16, got {ui['risk']}")
ui['risk'] = 'high'
ui['reason'] = 'EV-16 promotes the EV-15-calibrated UI/typecheck miss class to the existing verify-full fail-safe; no other normal-risk rule is widened.'
ui['promotion'] = {
    'taskId': 'EV-16',
    'sourceTaskId': 'EV-15',
    'sourceCorpusPath': 'agent/impact-calibration-corpus.json',
    'sourceCorpusGitBlobSha': '56620952b96eb0711569bc6f01f4aee8fcb58b1f',
    'sourceImpactMapGitBlobSha': '7212e618374cff242fcc992faa260fad328e7026',
    'sourceCandidateSha': '295ec87024e34be6d724cee60fa432b375712a96',
    'sourceWorkflowRunId': 38624196233,
    'sourceArtifactId': 11923980804,
    'sourceArtifactDigest': 'sha256:5acf0a2ab2429a01868bda7de61b846cd6f82f89f29d4eff8c947f4ea093ae53',
    'previousRisk': 'normal',
    'disableEnvironmentVariable': 'IRONSHADE_IMPACT_WIDENING_ENFORCEMENT',
    'disabledValue': '0',
}
impact_path.write_text(json.dumps(impact, indent=2) + '\n')

schema_path = Path('agent/impact-map.schema.json')
schema = json.loads(schema_path.read_text())
schema['$defs']['promotion'] = {
    'type': 'object',
    'required': [
        'taskId', 'sourceTaskId', 'sourceCorpusPath', 'sourceCorpusGitBlobSha',
        'sourceImpactMapGitBlobSha', 'sourceCandidateSha', 'sourceWorkflowRunId',
        'sourceArtifactId', 'sourceArtifactDigest', 'previousRisk',
        'disableEnvironmentVariable', 'disabledValue',
    ],
    'properties': {
        'taskId': {'type': 'string', 'pattern': '^EV-[0-9]+$'},
        'sourceTaskId': {'type': 'string', 'pattern': '^EV-[0-9]+$'},
        'sourceCorpusPath': {'type': 'string', 'minLength': 1},
        'sourceCorpusGitBlobSha': {'type': 'string', 'pattern': '^[a-f0-9]{40}$'},
        'sourceImpactMapGitBlobSha': {'type': 'string', 'pattern': '^[a-f0-9]{40}$'},
        'sourceCandidateSha': {'type': 'string', 'pattern': '^[a-f0-9]{40}$'},
        'sourceWorkflowRunId': {'type': 'integer', 'minimum': 1},
        'sourceArtifactId': {'type': 'integer', 'minimum': 1},
        'sourceArtifactDigest': {'type': 'string', 'pattern': '^sha256:[a-f0-9]{64}$'},
        'previousRisk': {'enum': ['normal']},
        'disableEnvironmentVariable': {'type': 'string', 'minLength': 1},
        'disabledValue': {'type': 'string', 'minLength': 1},
    },
    'additionalProperties': False,
}
schema['$defs']['rule']['properties']['promotion'] = {'$ref': '#/$defs/promotion'}
schema_path.write_text(json.dumps(schema, indent=2) + '\n')

replace_once(
    'agent/tools/select-affected-verification.mjs',
    "function ruleMatchesFile(rule, filePath) {\n  const included = rule.include.some(pattern => matchesGlob(filePath, pattern));\n  if (!included) return false;\n  return !(rule.exclude ?? []).some(pattern => matchesGlob(filePath, pattern));\n}\n\nexport function validateImpactMap(impactMap) {",
    "function ruleMatchesFile(rule, filePath) {\n  const included = rule.include.some(pattern => matchesGlob(filePath, pattern));\n  if (!included) return false;\n  return !(rule.exclude ?? []).some(pattern => matchesGlob(filePath, pattern));\n}\n\nexport function effectiveRuleRisk(rule, env = process.env) {\n  const promotion = rule?.promotion;\n  if (promotion && env?.[promotion.disableEnvironmentVariable] === promotion.disabledValue) {\n    return promotion.previousRisk;\n  }\n  return rule.risk;\n}\n\nexport function validateImpactMap(impactMap) {",
)
replace_once(
    'agent/tools/select-affected-verification.mjs',
    "    assert(['normal', 'high'].includes(rule.risk), `${rule.id}.risk must be normal or high`);\n    if (rule.reason !== undefined) assertString(rule.reason, `${rule.id}.reason`);\n    for (const verificationId of rule.verificationIds) {",
    "    assert(['normal', 'high'].includes(rule.risk), `${rule.id}.risk must be normal or high`);\n    if (rule.reason !== undefined) assertString(rule.reason, `${rule.id}.reason`);\n    if (rule.promotion !== undefined) {\n      const promotion = rule.promotion;\n      assert(promotion && typeof promotion === 'object' && !Array.isArray(promotion), `${rule.id}.promotion must be an object`);\n      for (const field of ['taskId', 'sourceTaskId', 'sourceCorpusPath', 'sourceCorpusGitBlobSha', 'sourceImpactMapGitBlobSha', 'sourceCandidateSha', 'sourceArtifactDigest', 'previousRisk', 'disableEnvironmentVariable', 'disabledValue']) {\n        assertString(promotion[field], `${rule.id}.promotion.${field}`);\n      }\n      assert(/^EV-\\d+$/.test(promotion.taskId), `${rule.id}.promotion.taskId must be an EV task ID`);\n      assert(/^EV-\\d+$/.test(promotion.sourceTaskId), `${rule.id}.promotion.sourceTaskId must be an EV task ID`);\n      assert(/^[a-f0-9]{40}$/.test(promotion.sourceCorpusGitBlobSha), `${rule.id}.promotion.sourceCorpusGitBlobSha must be a full lowercase Git blob SHA`);\n      assert(/^[a-f0-9]{40}$/.test(promotion.sourceImpactMapGitBlobSha), `${rule.id}.promotion.sourceImpactMapGitBlobSha must be a full lowercase Git blob SHA`);\n      assert(/^[a-f0-9]{40}$/.test(promotion.sourceCandidateSha), `${rule.id}.promotion.sourceCandidateSha must be a full lowercase commit SHA`);\n      assert(/^sha256:[a-f0-9]{64}$/.test(promotion.sourceArtifactDigest), `${rule.id}.promotion.sourceArtifactDigest must be a sha256 digest`);\n      assert(Number.isInteger(promotion.sourceWorkflowRunId) && promotion.sourceWorkflowRunId > 0, `${rule.id}.promotion.sourceWorkflowRunId must be positive`);\n      assert(Number.isInteger(promotion.sourceArtifactId) && promotion.sourceArtifactId > 0, `${rule.id}.promotion.sourceArtifactId must be positive`);\n      assert(rule.risk === 'high', `${rule.id}.promotion requires current risk=high`);\n      assert(promotion.previousRisk === 'normal', `${rule.id}.promotion.previousRisk must preserve the previous normal-risk behavior`);\n    }\n    for (const verificationId of rule.verificationIds) {",
)
replace_once(
    'agent/tools/select-affected-verification.mjs',
    "export function selectAffectedVerification(changedFiles, impactMap) {\n  validateImpactMap(impactMap);",
    "export function selectAffectedVerification(changedFiles, impactMap, { env = process.env } = {}) {\n  validateImpactMap(impactMap);",
)
replace_once(
    'agent/tools/select-affected-verification.mjs',
    "      normalVerificationIds.push(...rule.verificationIds);\n      if (rule.risk === 'high') {\n        fileRisk = 'high';\n        highRiskRules.set(rule.id, rule.reason ?? `${rule.id} is high risk`);\n      }",
    "      normalVerificationIds.push(...rule.verificationIds);\n      const ruleRisk = effectiveRuleRisk(rule, env);\n      if (ruleRisk === 'high') {\n        fileRisk = 'high';\n        highRiskRules.set(rule.id, rule.reason ?? `${rule.id} is high risk`);\n      }",
)

replace_once(
    'agent/tests/affected-verification.mjs',
    "const mixedHighRiskSelection = selectAffectedVerification([\n  'src/game/graphicsAssetManifest.ts',\n  '.github/workflows/browser-e2e.yml',\n], impactMap);",
    "const uiPromotionSelection = selectAffectedVerification(['src/components/AppErrorBoundary.tsx'], impactMap);\nassert.equal(uiPromotionSelection.mode, 'full');\nassert.equal(uiPromotionSelection.escalated, true);\nassert.deepEqual(uiPromotionSelection.verifications.map(check => check.id), ['verify-full']);\nassert(uiPromotionSelection.matchedRuleIds.includes('ui-and-design-system'));\n\nconst uiRollbackSelection = selectAffectedVerification(['src/components/AppErrorBoundary.tsx'], impactMap, {\n  env: { IRONSHADE_IMPACT_WIDENING_ENFORCEMENT: '0' },\n});\nassert.equal(uiRollbackSelection.mode, 'targeted');\nassert.equal(uiRollbackSelection.escalated, false);\nassert.deepEqual(uiRollbackSelection.verifications.map(check => check.id), ['ui-readability', 'design-system']);\n\nconst mixedHighRiskSelection = selectAffectedVerification([\n  'src/game/graphicsAssetManifest.ts',\n  '.github/workflows/browser-e2e.yml',\n], impactMap);",
)
replace_once(
    'agent/tests/affected-verification.mjs',
    "console.log(`AFFECTED_VERIFICATION_TEST_PASS rules=${summary.ruleCount} verifications=${summary.verificationCount} graphicsChecks=${graphicsSelection.verifications.length} refineryChecks=${refineryPresentationSelection.verifications.length} unknownMode=${unknownSelection.mode} gitDiff=pass calibration=pass`);",
    "console.log(`AFFECTED_VERIFICATION_TEST_PASS rules=${summary.ruleCount} verifications=${summary.verificationCount} graphicsChecks=${graphicsSelection.verifications.length} refineryChecks=${refineryPresentationSelection.verifications.length} uiPromotion=${uiPromotionSelection.mode} uiRollback=${uiRollbackSelection.mode} unknownMode=${unknownSelection.mode} gitDiff=pass calibration=pass`);",
)

replace_once(
    'agent/tests/impact-calibration-evidence.mjs',
    "assert.equal(uiRule.risk, 'normal', 'EV-15 must not promote the UI widening itself');\nassert.deepEqual(uiRule.verificationIds, ['ui-readability', 'design-system']);",
    "assert.equal(uiRule.risk, 'high', 'EV-16 must leave the promoted UI widening visible in the committed impact map');\nassert.equal(uiRule.promotion?.taskId, 'EV-16', 'EV-15 post-promotion reproduction must identify EV-16 as the owner of the widening');\nassert.equal(process.env.IRONSHADE_IMPACT_WIDENING_ENFORCEMENT, '0', 'EV-15 post-promotion reproduction must run with EV-16 rollback enabled');\nassert.deepEqual(uiRule.verificationIds, ['ui-readability', 'design-system']);",
)
replace_once(
    'agent/tests/impact-calibration-evidence.mjs',
    "console.log(`EV15_IMPACT_CALIBRATION_TEST_PASS probes=${corpus.executableMissProbes.length} historical=${corpus.historicalObservations.length} wideningThreshold=${corpus.minimumIndependentMissesForWidening} uiDefault=${uiRule.risk} observer=measured historyAuth=run+git-range noNarrowing=pass`);",
    "console.log(`EV15_IMPACT_CALIBRATION_TEST_PASS probes=${corpus.executableMissProbes.length} historical=${corpus.historicalObservations.length} wideningThreshold=${corpus.minimumIndependentMissesForWidening} uiCommitted=${uiRule.risk} rollbackCalibration=enabled observer=measured historyAuth=run+git-range noNarrowing=pass`);",
)

replace_once(
    '.github/workflows/ev15-impact-calibration.yml',
    "    timeout-minutes: 30\n    steps:",
    "    timeout-minutes: 30\n    env:\n      IRONSHADE_IMPACT_WIDENING_ENFORCEMENT: '0'\n    steps:",
)

replace_once(
    '.github/workflows/agent-orchestration.yml',
    "      - name: Run affected-verification regressions\n        run: node agent/tests/affected-verification.mjs\n\n      - name: Run candidate evidence regressions",
    "      - name: Run affected-verification regressions\n        run: node agent/tests/affected-verification.mjs\n\n      - name: Run promoted impact-widening regressions\n        run: node agent/tests/impact-widening-promotion.mjs\n\n      - name: Enforce EV-16 impact-widening scope and rollback contract\n        env:\n          CANDIDATE_SHA: ${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}\n        run: |\n          mkdir -p .agent-impact-widening\n          node agent/tools/impact-widening-promotion.mjs \\\n            --candidate-sha \"$CANDIDATE_SHA\" \\\n            --output .agent-impact-widening/promotion.json\n\n      - name: Upload exact-SHA EV-16 impact-widening evidence\n        uses: actions/upload-artifact@v7\n        with:\n          name: impact-widening-ev16-${{ github.event_name == 'pull_request' && github.event.pull_request.number || 'push' }}-${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}\n          path: .agent-impact-widening/promotion.json\n          if-no-files-found: error\n          include-hidden-files: true\n          retention-days: 30\n\n      - name: Run candidate evidence regressions",
)

replace_once(
    'AGENTS.md',
    "- `agent/impact-calibration-corpus.json`, `agent/tools/impact-calibration-evidence.mjs`, `agent/tests/impact-calibration-evidence.mjs`, and `.github/workflows/ev15-impact-calibration.yml` — EV-15 exact-SHA advisory calibration contract for EV-5. It combines immutable historical successful full-verification controls with independent executable miss probes, measures selector misses and over-selection by rule class plus zero-budget widening-decision false positives/false negatives, records confidence limits and unresolved classes, restores all probe mutations to the exact candidate state, and names only preserve-or-widen candidates for EV-16 without editing `agent/impact-map.json`.\n",
    "- `agent/impact-calibration-corpus.json`, `agent/tools/impact-calibration-evidence.mjs`, `agent/tests/impact-calibration-evidence.mjs`, and `.github/workflows/ev15-impact-calibration.yml` — EV-15 exact-SHA advisory calibration contract for EV-5. It combines immutable historical successful full-verification controls with independent executable miss probes, measures selector misses and over-selection by rule class plus zero-budget widening-decision false positives/false negatives, records confidence limits and unresolved classes, restores all probe mutations to the exact candidate state, and names only preserve-or-widen candidates for EV-16 without editing `agent/impact-map.json`. After EV-16 promotion, this workflow runs with the EV-16 rollback switch so the archived pre-promotion selector behavior remains reproducible without rewriting EV-15 evidence.\n- `agent/impact-map.json`, `agent/impact-map.schema.json`, `agent/tools/select-affected-verification.mjs`, `agent/tools/impact-widening-promotion.mjs`, `agent/tests/impact-widening-promotion.mjs`, and `.github/workflows/ev16-impact-widening.yml` — EV-16 permanent change-impact widening contract. Only the EV-15-calibrated `ui-and-design-system` rule is promoted from normal to high risk, forcing the existing `verify-full` fail-safe; the contract pins EV-15 corpus/baseline/evidence identity, measures promotion false positives/false negatives at zero budget, and proves the rollback switch restores the exact pre-promotion static selector behavior.\n",
)
replace_once(
    'AGENTS.md',
    "- EV-15 remains calibration-only. Its exact-SHA evidence must bind to the committed EV-15 corpus and current impact map, require at least two independent executable misses before naming a widening candidate, measure widening-decision false positives and false negatives at a zero-error budget, report selector miss/over-selection rates plus confidence limits, and preserve every unmeasured normal-risk class as unresolved. The EV-15 calibration identifies only `ui-and-design-system` as an EV-16-safe widening candidate (`risk: high` / `verify-full`); it does not change default impact-map behavior. Probe execution must restore the exact tracked candidate state, and removing the EV-15 calibration-only corpus/tool/test/workflow restores the pre-EV-15 pipeline without changing product/runtime state or existing proof gates.\n",
    "- EV-15 remains calibration-only. Its exact-SHA evidence must bind to the committed EV-15 corpus and the selector state under EV-16 rollback, require at least two independent executable misses before naming a widening candidate, measure widening-decision false positives and false negatives at a zero-error budget, report selector miss/over-selection rates plus confidence limits, and preserve every unmeasured normal-risk class as unresolved. The archived EV-15 calibration identifies only `ui-and-design-system` as an EV-16-safe widening candidate (`risk: high` / `verify-full`); it never grants candidate acceptance or justifies any other widening. Probe execution must restore the exact tracked candidate state.\n- EV-16 permanently widens only `ui-and-design-system` from `risk: normal` to `risk: high`, routing matching changes through the existing `verify-full` fallback. The promotion metadata must stay pinned to the archived EV-15 corpus Git blob `56620952b96eb0711569bc6f01f4aee8fcb58b1f`, pre-promotion impact-map blob `7212e618374cff242fcc992faa260fad328e7026`, candidate `295ec87024e34be6d724cee60fa432b375712a96`, workflow run `38624196233`, artifact `11923980804`, and artifact digest `sha256:5acf0a2ab2429a01868bda7de61b846cd6f82f89f29d4eff8c947f4ea093ae53`. Promotion calibration must retain zero false positives and zero false negatives: both EV-15 UI miss probes must escalate to `verify-full`, while unrelated normal-risk/documentation controls retain their prior selector behavior. All other normal-risk impact classes remain unresolved and unpromoted.\n- EV-16 rollback is deterministic: setting `IRONSHADE_IMPACT_WIDENING_ENFORCEMENT=0` makes the promoted rule use its recorded previous `normal` risk while preserving its original `ui-readability` and `design-system` targeted checks. The EV-16 promotion verifier compares rollback selections against the pinned pre-promotion impact-map blob and must reject drift. Rollback changes only this promoted escalation; full verification/build, browser/Android/APK proof, exact-SHA evidence, architecture invariants, independent review, existing high-risk classes, and the archived EV-15 evidence remain authoritative and unchanged.\n",
)

tool = r'''import { execFileSync } from 'node:child_process';
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
'''
Path('agent/tools/impact-widening-promotion.mjs').write_text(tool)

test = r'''import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { selectAffectedVerification } from '../tools/select-affected-verification.mjs';
import { calibrateImpactWidening, validateImpactWideningContract } from '../tools/impact-widening-promotion.mjs';

const impactMap = JSON.parse(await readFile(resolve('agent/impact-map.json'), 'utf8'));
const corpus = JSON.parse(await readFile(resolve('agent/impact-calibration-corpus.json'), 'utf8'));
const corpusGitBlobSha = execFileSync('git', ['hash-object', 'agent/impact-calibration-corpus.json'], { encoding: 'utf8' }).trim();
const promotion = impactMap.rules.find(rule => rule.promotion?.taskId === 'EV-16')?.promotion;
assert(promotion, 'EV-16 promotion metadata must exist');
const baselineMap = JSON.parse(execFileSync('git', ['cat-file', '-p', promotion.sourceImpactMapGitBlobSha], { encoding: 'utf8' }));

const contract = validateImpactWideningContract({ impactMap, baselineMap, corpus, corpusGitBlobSha });
assert.equal(contract.rule.id, 'ui-and-design-system');
assert.equal(contract.decision.falsePositives, 0);
assert.equal(contract.decision.falseNegatives, 0);

const calibration = calibrateImpactWidening({ impactMap, baselineMap, corpus });
assert.equal(calibration.falsePositives, 0);
assert.equal(calibration.falseNegatives, 0);
assert.equal(calibration.rollbackPass, true);
assert.equal(calibration.pass, true);

const active = selectAffectedVerification(['src/components/UiPrimitives.tsx'], impactMap, { env: {} });
assert.equal(active.mode, 'full');
assert.deepEqual(active.verifications.map(entry => entry.id), ['verify-full']);
const rollback = selectAffectedVerification(['src/components/UiPrimitives.tsx'], impactMap, {
  env: { IRONSHADE_IMPACT_WIDENING_ENFORCEMENT: '0' },
});
assert.equal(rollback.mode, 'targeted');
assert.deepEqual(rollback.verifications.map(entry => entry.id), ['ui-readability', 'design-system']);

const extraPromotion = structuredClone(impactMap);
extraPromotion.rules.find(rule => rule.id === 'babylon-ability-vfx').promotion = structuredClone(promotion);
extraPromotion.rules.find(rule => rule.id === 'babylon-ability-vfx').risk = 'high';
assert.throws(
  () => validateImpactWideningContract({ impactMap: extraPromotion, baselineMap, corpus, corpusGitBlobSha }),
  /must promote exactly one impact rule/,
  'EV-16 must reject silent scope expansion',
);

const corpusDrift = structuredClone(impactMap);
corpusDrift.rules.find(rule => rule.id === 'ui-and-design-system').promotion.sourceCorpusGitBlobSha = 'f'.repeat(40);
assert.throws(
  () => validateImpactWideningContract({ impactMap: corpusDrift, baselineMap, corpus, corpusGitBlobSha }),
  /source corpus Git blob does not match/,
  'EV-16 must reject source-calibration drift',
);

const unrelatedDrift = structuredClone(impactMap);
unrelatedDrift.rules.find(rule => rule.id === 'babylon-ability-vfx').risk = 'high';
assert.throws(
  () => validateImpactWideningContract({ impactMap: unrelatedDrift, baselineMap, corpus, corpusGitBlobSha }),
  /changed unpromoted impact rule/,
  'EV-16 must reject unrelated impact-map changes inside the promotion contract',
);

console.log(`EV16_IMPACT_WIDENING_TEST_PASS rule=${contract.rule.id} falsePositives=${calibration.falsePositives} falseNegatives=${calibration.falseNegatives} rollback=${calibration.rollbackPass} scope=single-rule`);
'''
Path('agent/tests/impact-widening-promotion.mjs').write_text(test)

workflow = r'''name: EV-16 Impact Widening Promotion

on:
  pull_request:
    branches:
      - main
  push:
    branches:
      - main
    paths:
      - 'agent/impact-map.json'
      - 'agent/impact-map.schema.json'
      - 'agent/impact-calibration-corpus.json'
      - 'agent/tools/select-affected-verification.mjs'
      - 'agent/tools/impact-widening-promotion.mjs'
      - 'agent/tests/affected-verification.mjs'
      - 'agent/tests/impact-widening-promotion.mjs'
      - '.github/workflows/ev15-impact-calibration.yml'
      - '.github/workflows/ev16-impact-widening.yml'
      - 'AGENTS.md'
      - 'docs/experimental-verification-roadmap.md'
      - 'docs/experimental-verification-archive.md'

permissions:
  contents: read

jobs:
  promotion-gate:
    name: Exact Candidate Impact Widening
    runs-on: ubuntu-24.04
    timeout-minutes: 8
    steps:
      - name: Check out exact candidate revision
        uses: actions/checkout@v7
        with:
          ref: ${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}
          fetch-depth: 0
          persist-credentials: false

      - uses: actions/setup-node@v7
        with:
          node-version: '22.23.2'

      - name: Run EV-16 promotion regressions
        run: |
          node agent/tests/affected-verification.mjs
          node agent/tests/impact-widening-promotion.mjs

      - name: Generate exact-SHA EV-16 promotion evidence
        env:
          CANDIDATE_SHA: ${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}
        run: |
          set -euo pipefail
          test "$(git rev-parse HEAD)" = "$CANDIDATE_SHA"
          mkdir -p .agent-impact-widening-ev16
          node agent/tools/impact-widening-promotion.mjs \
            --candidate-sha "$CANDIDATE_SHA" \
            --output .agent-impact-widening-ev16/promotion.json
          node --input-type=module <<'NODE'
          import { readFileSync } from 'node:fs';
          const report = JSON.parse(readFileSync('.agent-impact-widening-ev16/promotion.json', 'utf8'));
          const fail = message => { throw new Error(`EV16_EXACT_EVIDENCE_FAIL ${message}`); };
          if (report.taskId !== 'EV-16' || report.candidateSha !== process.env.CANDIDATE_SHA) fail('task/candidate binding mismatch');
          if (report.selectedRuleId !== 'ui-and-design-system' || report.resultingVerification !== 'verify-full') fail('promoted scope drifted');
          if (report.calibration.measuredErrors.falsePositives !== 0 || report.calibration.measuredErrors.falseNegatives !== 0) fail('promotion error budget exceeded');
          if (report.rollback.restoresPreviousStaticBehavior !== true) fail('rollback no longer restores the prior selector behavior');
          if (report.acceptedForEnforcement !== true || report.blocking !== true || report.candidatePassGranted !== false) fail('promotion enforcement semantics drifted');
          console.log(`EV16_EXACT_EVIDENCE_PASS candidate=${report.candidateSha} rule=${report.selectedRuleId} falsePositives=0 falseNegatives=0 rollback=verified`);
          NODE

      - name: Upload exact-SHA EV-16 promotion evidence
        uses: actions/upload-artifact@v7
        with:
          name: impact-widening-ev16-${{ github.event_name == 'pull_request' && github.event.pull_request.number || 'push' }}-${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}
          path: .agent-impact-widening-ev16/promotion.json
          if-no-files-found: error
          include-hidden-files: true
          retention-days: 30
'''
Path('.github/workflows/ev16-impact-widening.yml').write_text(workflow)

Path('.github/workflows/ev16-authoring.yml').unlink()
Path('agent/ev16-authoring.py').unlink()
