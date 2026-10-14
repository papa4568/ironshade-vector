from pathlib import Path
import json


def replace_once(path, old, new):
    text = path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one replacement target, found {count}')
    path.write_text(text.replace(old, new, 1))


selector_path = Path('agent/tools/select-affected-verification.mjs')
replace_once(
    selector_path,
    """export function effectiveRuleRisk(rule, env = process.env) {
  const promotion = rule?.promotion;
  if (promotion && env?.[promotion.disableEnvironmentVariable] === promotion.disabledValue) {
    return promotion.previousRisk;
  }
  return rule.risk;
}

export function validateImpactMap(impactMap) {
""",
    """export function effectiveRuleRisk(rule, env = process.env) {
  const promotion = rule?.promotion;
  if (promotion && env?.[promotion.disableEnvironmentVariable] === promotion.disabledValue) {
    return promotion.previousRisk;
  }
  return rule.risk;
}

export function impactWideningEnforcementEnabled(impactMap, env = process.env) {
  const promotionRules = impactMap.rules.filter(rule => rule.promotion?.taskId === 'EV-16');
  if (promotionRules.length === 0) return false;
  assert(promotionRules.length === 1, `EV-16 selector requires exactly one promoted rule, found ${promotionRules.length}`);
  const promotion = promotionRules[0].promotion;
  return env?.[promotion.disableEnvironmentVariable] !== promotion.disabledValue;
}

export function validateImpactMap(impactMap) {
""",
)
replace_once(
    selector_path,
    """  const matchedRuleIds = new Set();
  const highRiskRules = new Map();
  const unknownFiles = [];
  const fileImpacts = [];
""",
    """  const matchedRuleIds = new Set();
  const highRiskRules = new Map();
  const lowConfidenceRules = new Map();
  const unknownFiles = [];
  const fileImpacts = [];
  const wideningEnforcementEnabled = impactWideningEnforcementEnabled(impactMap, env);
""",
)
replace_once(
    selector_path,
    """      const ruleRisk = effectiveRuleRisk(rule, env);
      if (ruleRisk === 'high') {
        fileRisk = 'high';
        highRiskRules.set(rule.id, rule.reason ?? `${rule.id} is high risk`);
      }
""",
    """      const ruleRisk = effectiveRuleRisk(rule, env);
      if (ruleRisk === 'high') {
        fileRisk = 'high';
        highRiskRules.set(rule.id, rule.reason ?? `${rule.id} is high risk`);
      } else if (wideningEnforcementEnabled && rule.risk === 'normal') {
        if (fileRisk !== 'high') fileRisk = 'low-confidence';
        lowConfidenceRules.set(rule.id, `${rule.id} remains unresolved/low-confidence under EV-16`);
      }
""",
)
replace_once(
    selector_path,
    """  for (const [ruleId, reason] of highRiskRules) {
    escalationReasons.push(`${ruleId}: ${reason}`);
  }

  const escalated = escalationReasons.length > 0;
""",
    """  for (const [ruleId, reason] of highRiskRules) {
    escalationReasons.push(`${ruleId}: ${reason}`);
  }
  for (const [ruleId, reason] of lowConfidenceRules) {
    escalationReasons.push(`${ruleId}: ${reason}`);
  }

  const escalated = escalationReasons.length > 0;
""",
)
replace_once(
    selector_path,
    """      ...(unknownFiles.length > 0 ? impactMap.fallback.unknownVerificationIds : []),
      ...(highRiskRules.size > 0 ? impactMap.fallback.highRiskVerificationIds : []),
""",
    """      ...(unknownFiles.length > 0 ? impactMap.fallback.unknownVerificationIds : []),
      ...(highRiskRules.size > 0 || lowConfidenceRules.size > 0 ? impactMap.fallback.highRiskVerificationIds : []),
""",
)
replace_once(
    selector_path,
    """    matchedRuleIds: [...matchedRuleIds].sort(),
    unknownFiles,
    escalationReasons,
""",
    """    matchedRuleIds: [...matchedRuleIds].sort(),
    lowConfidenceRuleIds: [...lowConfidenceRules.keys()].sort(),
    unknownFiles,
    escalationReasons,
""",
)


affected_path = Path('agent/tests/affected-verification.mjs')
replace_once(
    affected_path,
    """assert(summary.ruleCount >= 10);
assert(summary.verificationCount >= 10);

""",
    """assert(summary.ruleCount >= 10);
assert(summary.verificationCount >= 10);
const rollbackEnv = { IRONSHADE_IMPACT_WIDENING_ENFORCEMENT: '0' };

""",
)
replace_once(
    affected_path,
    """const graphicsSelection = selectAffectedVerification([
  'src/game/graphicsAssetManifest.ts',
  'scripts/prepare-refinery-premium-surfaces.mjs',
], impactMap);
""",
    """const graphicsSelection = selectAffectedVerification([
  'src/game/graphicsAssetManifest.ts',
  'scripts/prepare-refinery-premium-surfaces.mjs',
], impactMap, { env: rollbackEnv });
""",
)
replace_once(
    affected_path,
    """const refineryPresentationSelection = selectAffectedVerification([
  'src/game/babylonRefineryPresentation.ts',
], impactMap);
""",
    """const refineryPresentationSelection = selectAffectedVerification([
  'src/game/babylonRefineryPresentation.ts',
], impactMap, { env: rollbackEnv });
""",
)
replace_once(
    affected_path,
    """const docsSelection = selectAffectedVerification([
  'docs/content-roadmap-archive.md',
  'docs/product-constraints.md',
], impactMap);
""",
    """const docsSelection = selectAffectedVerification([
  'docs/content-roadmap-archive.md',
  'docs/product-constraints.md',
], impactMap, { env: rollbackEnv });
""",
)
replace_once(
    affected_path,
    """const roadmapSelection = selectAffectedVerification(['docs/content-roadmap.md'], impactMap);
""",
    """const roadmapSelection = selectAffectedVerification(['docs/content-roadmap.md'], impactMap, { env: rollbackEnv });
""",
)
replace_once(
    affected_path,
    """const unknownSelection = selectAffectedVerification(['mystery/new-subsystem.xyz'], impactMap);
""",
    """const graphicsFailSafeSelection = selectAffectedVerification(['src/game/babylonAbilityVfx.ts'], impactMap, { env: {} });
assert.equal(graphicsFailSafeSelection.mode, 'full');
assert.equal(graphicsFailSafeSelection.escalated, true);
assert.deepEqual(graphicsFailSafeSelection.verifications.map(check => check.id), ['verify-full']);
assert.deepEqual(graphicsFailSafeSelection.lowConfidenceRuleIds, ['babylon-ability-vfx']);
assert(graphicsFailSafeSelection.escalationReasons.some(reason => reason.includes('unresolved/low-confidence')));

const docsFailSafeSelection = selectAffectedVerification(['docs/product-constraints.md'], impactMap, { env: {} });
assert.equal(docsFailSafeSelection.mode, 'full');
assert.deepEqual(docsFailSafeSelection.verifications.map(check => check.id), ['verify-full']);
assert.deepEqual(docsFailSafeSelection.lowConfidenceRuleIds, ['documentation-only']);

const unknownSelection = selectAffectedVerification(['mystery/new-subsystem.xyz'], impactMap);
""",
)
replace_once(
    affected_path,
    """  env: { IRONSHADE_IMPACT_WIDENING_ENFORCEMENT: '0' },
""",
    """  env: rollbackEnv,
""",
)
replace_once(
    affected_path,
    """console.log(`AFFECTED_VERIFICATION_TEST_PASS rules=${summary.ruleCount} verifications=${summary.verificationCount} graphicsChecks=${graphicsSelection.verifications.length} refineryChecks=${refineryPresentationSelection.verifications.length} uiPromotion=${uiPromotionSelection.mode} uiRollback=${uiRollbackSelection.mode} unknownMode=${unknownSelection.mode} gitDiff=pass calibration=rollback-pass`);
""",
    """console.log(`AFFECTED_VERIFICATION_TEST_PASS rules=${summary.ruleCount} verifications=${summary.verificationCount} graphicsChecks=${graphicsSelection.verifications.length} refineryChecks=${refineryPresentationSelection.verifications.length} lowConfidenceGraphics=${graphicsFailSafeSelection.mode} lowConfidenceDocs=${docsFailSafeSelection.mode} uiPromotion=${uiPromotionSelection.mode} uiRollback=${uiRollbackSelection.mode} unknownMode=${unknownSelection.mode} gitDiff=pass calibration=rollback-pass`);
""",
)


promotion_tool_path = Path('agent/tools/impact-widening-promotion.mjs')
replace_once(
    promotion_tool_path,
    """    matchedRuleIds: [...selection.matchedRuleIds],
    unknownFiles: [...selection.unknownFiles],
""",
    """    matchedRuleIds: [...selection.matchedRuleIds],
    lowConfidenceRuleIds: [...(selection.lowConfidenceRuleIds ?? [])],
    unknownFiles: [...selection.unknownFiles],
""",
)
replace_once(
    promotion_tool_path,
    """  const positiveTrials = [];
  const negativeTrials = [];
  const rollbackTrials = [];
""",
    """  const positiveTrials = [];
  const lowConfidenceTrials = [];
  const negativeTrials = [];
  const rollbackTrials = [];
""",
)
old_controls = """  const controls = [
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
"""
new_controls = """  const lowConfidenceControls = [
    { id: 'unpromoted-normal-rule', expectedRuleId: 'babylon-ability-vfx', files: ['src/game/babylonAbilityVfx.ts'] },
    { id: 'documentation-only', expectedRuleId: 'documentation-only', files: ['docs/product-constraints.md'] },
  ];
  for (const control of lowConfidenceControls) {
    const baseline = selectAffectedVerification(control.files, baselineMap, { env: activeEnv });
    const active = selectAffectedVerification(control.files, impactMap, { env: activeEnv });
    const rollback = selectAffectedVerification(control.files, impactMap, { env: rollbackEnv });
    const detected = active.mode === 'full'
      && active.verifications.map(entry => entry.id).join(',') === 'verify-full'
      && active.lowConfidenceRuleIds.includes(control.expectedRuleId);
    if (!detected) falseNegatives += 1;
    const rollbackMatches = same(signature(rollback), signature(baseline));
    lowConfidenceTrials.push({ id: control.id, expectedRuleId: control.expectedRuleId, detected, active: signature(active), baseline: signature(baseline) });
    rollbackTrials.push({ id: control.id, rollbackMatches, rollback: signature(rollback), baseline: signature(baseline) });
  }

  const controls = [
    { id: 'already-high-risk', files: ['package.json'] },
    { id: 'unknown-file', files: ['mystery/new-subsystem.xyz'] },
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
"""
replace_once(promotion_tool_path, old_controls, new_controls)
replace_once(
    promotion_tool_path,
    """    positiveTrials,
    negativeTrials,
    rollbackTrials,
""",
    """    positiveTrials,
    lowConfidenceTrials,
    negativeTrials,
    rollbackTrials,
""",
)
replace_once(
    promotion_tool_path,
    """      positiveTrials: calibration.positiveTrials,
      negativeTrials: calibration.negativeTrials,
""",
    """      positiveTrials: calibration.positiveTrials,
      lowConfidenceTrials: calibration.lowConfidenceTrials,
      negativeTrials: calibration.negativeTrials,
""",
)
replace_once(
    promotion_tool_path,
    """    unresolvedNormalRiskRules: impactMap.rules.filter(rule => rule.risk === 'normal').map(rule => rule.id).sort(),
""",
    """    unresolvedNormalRiskRules: impactMap.rules.filter(rule => rule.risk === 'normal').map(rule => rule.id).sort(),
    lowConfidenceFailSafeRuleIds: impactMap.rules.filter(rule => rule.risk === 'normal').map(rule => rule.id).sort(),
""",
)


promotion_test_path = Path('agent/tests/impact-widening-promotion.mjs')
replace_once(
    promotion_test_path,
    """assert.equal(calibration.rollbackPass, true);
assert.equal(calibration.pass, true);

""",
    """assert.equal(calibration.rollbackPass, true);
assert.equal(calibration.pass, true);
assert.equal(calibration.lowConfidenceTrials.length, 2);
assert(calibration.lowConfidenceTrials.every(trial => trial.detected));

""",
)
replace_once(
    promotion_test_path,
    """assert.equal(rollback.mode, 'targeted');
assert.deepEqual(rollback.verifications.map(entry => entry.id), ['ui-readability', 'design-system']);

""",
    """assert.equal(rollback.mode, 'targeted');
assert.deepEqual(rollback.verifications.map(entry => entry.id), ['ui-readability', 'design-system']);

const lowConfidence = selectAffectedVerification(['src/game/babylonAbilityVfx.ts'], impactMap, { env: {} });
assert.equal(lowConfidence.mode, 'full');
assert.deepEqual(lowConfidence.verifications.map(entry => entry.id), ['verify-full']);
assert.deepEqual(lowConfidence.lowConfidenceRuleIds, ['babylon-ability-vfx']);
const lowConfidenceRollback = selectAffectedVerification(['src/game/babylonAbilityVfx.ts'], impactMap, { env: rollbackEnv });
assert.equal(lowConfidenceRollback.mode, 'targeted');
assert.deepEqual(lowConfidenceRollback.verifications.map(entry => entry.id), ['babylon-ability-vfx']);

const docsLowConfidence = selectAffectedVerification(['docs/product-constraints.md'], impactMap, { env: {} });
assert.equal(docsLowConfidence.mode, 'full');
assert.deepEqual(docsLowConfidence.lowConfidenceRuleIds, ['documentation-only']);
const docsRollback = selectAffectedVerification(['docs/product-constraints.md'], impactMap, { env: rollbackEnv });
assert.equal(docsRollback.mode, 'none');

""",
)
replace_once(
    promotion_test_path,
    """const rollback = selectAffectedVerification(['src/components/UiPrimitives.tsx'], impactMap, {
  env: { IRONSHADE_IMPACT_WIDENING_ENFORCEMENT: '0' },
});
""",
    """const rollbackEnv = { IRONSHADE_IMPACT_WIDENING_ENFORCEMENT: '0' };
const rollback = selectAffectedVerification(['src/components/UiPrimitives.tsx'], impactMap, {
  env: rollbackEnv,
});
""",
)
replace_once(
    promotion_test_path,
    """console.log(`EV16_IMPACT_WIDENING_TEST_PASS rule=${contract.rule.id} falsePositives=${calibration.falsePositives} falseNegatives=${calibration.falseNegatives} rollback=${calibration.rollbackPass} scope=single-rule`);
""",
    """console.log(`EV16_IMPACT_WIDENING_TEST_PASS rule=${contract.rule.id} falsePositives=${calibration.falsePositives} falseNegatives=${calibration.falseNegatives} lowConfidence=${calibration.lowConfidenceTrials.length} rollback=${calibration.rollbackPass} scope=single-promoted-rule-plus-fail-safe`);
""",
)


impact_map_path = Path('agent/impact-map.json')
impact_map = json.loads(impact_map_path.read_text())
ui_rule = next((rule for rule in impact_map['rules'] if rule['id'] == 'ui-and-design-system'), None)
if ui_rule is None:
    raise SystemExit('ui-and-design-system rule missing')
ui_rule['reason'] = 'EV-16 promotes the EV-15-calibrated UI/typecheck miss class to the existing verify-full fail-safe; unpromoted normal-risk rules remain unchanged in the map and fail safe as low-confidence while enforcement is active.'
impact_map_path.write_text(json.dumps(impact_map, indent=2) + '\n')


agents_path = Path('AGENTS.md')
agents_lines = agents_path.read_text().splitlines()
matches = [index for index, line in enumerate(agents_lines) if '— EV-16 permanent change-impact widening contract.' in line]
if len(matches) != 1:
    raise SystemExit(f'AGENTS.md: expected one EV-16 source bullet, found {len(matches)}')
agents_lines[matches[0]] = "- `agent/impact-map.json`, `agent/impact-map.schema.json`, `agent/tools/select-affected-verification.mjs`, `agent/tools/impact-widening-promotion.mjs`, `agent/tests/impact-widening-promotion.mjs`, and `.github/workflows/ev16-impact-widening.yml` — EV-16 permanent change-impact widening contract. Only the EV-15-calibrated `ui-and-design-system` rule is promoted from normal to high risk. Every other normal-risk rule remains unchanged in the map but is explicitly unresolved/low-confidence, so while EV-16 enforcement is active any matched low-confidence class fails safe to `verify-full`; unknown files and existing high-risk rules remain fail-safe as before. `IRONSHADE_IMPACT_WIDENING_ENFORCEMENT=0` restores the exact pre-EV-16 static selector behavior for both the promoted UI rule and unresolved normal-risk classes."
agents_path.write_text('\n'.join(agents_lines) + '\n')


roadmap_path = Path('docs/experimental-verification-roadmap.md')
roadmap = roadmap_path.read_text()
ev16_block = """- [ ] **EV-16 — Enforce Validated Change-Impact Widenings**
  - Apply only EV-15-supported deterministic, reviewed widenings to `agent/impact-map.json` policy; unknown or low-confidence change classes must fail safe to broader verification.
  - Preserve exact-SHA evidence isolation and verify rollback restores the previous static impact-map behavior.
  - Done when policy/contracts are documented and the exact candidate is archived with required proofs and independent review.

"""
if ev16_block in roadmap:
    raise SystemExit('EV-16 is already active')
marker = '- [ ] **EV-17 — Calibrate EV-6 Proof-Cache Closure**'
if roadmap.count(marker) != 1:
    raise SystemExit('expected exactly one EV-17 marker')
roadmap_path.write_text(roadmap.replace(marker, ev16_block + marker, 1))


archive_path = Path('docs/experimental-verification-archive.md')
archive = archive_path.read_text()
heading = '\n## EV-16 — Enforce Validated Change-Impact Widenings\n'
if archive.count(heading) != 1:
    raise SystemExit(f'expected one premature EV-16 archive record, found {archive.count(heading)}')
archive_path.write_text(archive.split(heading, 1)[0].rstrip() + '\n')


Path('agent/ev16-review-fix.py').unlink()
