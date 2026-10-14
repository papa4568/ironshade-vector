from pathlib import Path

roadmap_path = Path('docs/experimental-verification-roadmap.md')
archive_path = Path('docs/experimental-verification-archive.md')

roadmap = roadmap_path.read_text()
ev16_block = """- [ ] **EV-16 — Enforce Validated Change-Impact Widenings**
  - Apply only EV-15-supported deterministic, reviewed widenings to `agent/impact-map.json` policy; unknown or low-confidence change classes must fail safe to broader verification.
  - Preserve exact-SHA evidence isolation and verify rollback restores the previous static impact-map behavior.
  - Done when policy/contracts are documented and the exact candidate is archived with required proofs and independent review.

"""
if roadmap.count(ev16_block) != 1:
    raise SystemExit(f'expected exactly one active EV-16 block, found {roadmap.count(ev16_block)}')
roadmap = roadmap.replace(ev16_block, '', 1)
if '- [ ] **EV-17 — Calibrate EV-6 Proof-Cache Closure**' not in roadmap:
    raise SystemExit('EV-17 must remain the next active experimental item')
roadmap_path.write_text(roadmap)

archive = archive_path.read_text()
heading = '## EV-16 — Enforce Validated Change-Impact Widenings'
if heading in archive:
    raise SystemExit('EV-16 archive record already exists')
entry = r'''

## EV-16 — Enforce Validated Change-Impact Widenings

Completed 2026-10-14 as a permanent, narrowly calibrated widening of affected-verification policy. The archived EV-5 and EV-15 calibration history remains unchanged; EV-16 promotes only the single deterministic rule class supported by EV-15 evidence.

### Implemented

- Promoted only `ui-and-design-system` in `agent/impact-map.json` from `risk: normal` to `risk: high`. Matching UI/design-system changes now use the existing high-risk `verify-full` fallback rather than only `ui-readability` and `design-system` during affected-verification selection.
- Pinned the promotion to the immutable EV-15 corpus blob `56620952b96eb0711569bc6f01f4aee8fcb58b1f`, pre-promotion impact-map blob `7212e618374cff242fcc992faa260fad328e7026`, EV-15 implementation candidate `295ec87024e34be6d724cee60fa432b375712a96`, workflow run `38624196233`, artifact `11923980804`, and artifact digest `sha256:5acf0a2ab2429a01868bda7de61b846cd6f82f89f29d4eff8c947f4ea093ae53`.
- Added promotion metadata to the impact-map schema plus `agent/tools/impact-widening-promotion.mjs` and `agent/tests/impact-widening-promotion.mjs`. The gate requires the promoted rule to be the sole policy widening, rejects drift in the pinned EV-15 evidence, rejects changes to unrelated rules/verifications/fallback behavior, and reports `candidatePassGranted=false` so the mechanism can only block/report rather than synthesize candidate acceptance.
- Added representative positive trials for both EV-15 UI TypeScript misses and negative controls for an unrelated normal-risk graphics rule plus documentation-only selection. The measured EV-16 promotion result is zero false positives and zero false negatives under the zero-error budget.
- Added deterministic rollback through `IRONSHADE_IMPACT_WIDENING_ENFORCEMENT=0`. Rollback preserves the committed promotion record but makes the selector use the pinned previous `normal` risk for the promoted rule, restoring the prior targeted `ui-readability` + `design-system` selection while leaving every unrelated rule and final proof gate unchanged.
- Kept EV-15 independently reproducible after promotion by running its calibration workflow under the EV-16 rollback switch. The legacy EV-5 historical calibration regression similarly resolves the pinned pre-EV-16 impact-map blob rather than pretending the historical selector already contained the promotion.
- Added `.github/workflows/ev16-impact-widening.yml` plus Agent Orchestration coverage so the exact candidate publishes promotion-specific enforcement/rollback evidence in addition to the repository's existing full candidate verification.

### Measured evidence

The first PR implementation candidate exposed a compatibility defect rather than a promotion failure: the legacy EV-5 synthetic calibration regression asserted that a UI change selected `targeted`, while the newly promoted live selector correctly returned `full`. The same branch fixed the regression to load the exact pre-EV-16 impact-map blob named by the promotion metadata. Live affected-verification tests still require `full`, so the compatibility fix cannot hide or waive the promoted behavior.

Exact implementation candidate `22e9557819efbd655d916d9a27c4595fb2fb6db2` passed EV-16 Impact Widening Promotion run `38637000609`. Exact-SHA artifact `11928382188` (`impact-widening-ev16-384-22e9557819efbd655d916d9a27c4595fb2fb6db2`) has GitHub Actions digest `sha256:a149ba367c0e1922b217bb8aa9898eba3f218c3672d82f359a4c24293f554316`. The promotion report selected only `ui-and-design-system`, required `verify-full` for both EV-15 positive probes, preserved both unrelated negative controls, recorded `falsePositives=0`, `falseNegatives=0`, and verified every rollback trial matched the pinned pre-promotion selector.

The same candidate passed Agent Orchestration run `38637000299`, including the promoted acceptance-attack and evidence-independence gates, affected-verification regressions, EV-16 promotion enforcement, candidate-artifact checks, CI proof-reuse contract, mechanical architecture invariants, independent-review contract regressions, and the trusted EV-9 observer bootstrap. EV-15 Impact Calibration run `38636999980` also passed on the promoted repository under the rollback switch, proving the archived calibration remains reproducible without changing the default EV-16 policy.

PR Candidate Verification run `38637000170` passed every technically available exact-candidate gate before the independent-review decision: the authoritative full repository verification/production build, exact candidate web artifact, Android APK construction/integrity/delivery, API 35 product smoke, API 36 large-screen smoke, aggregate Android verification, architecture invariants, EV-8 acceptance enforcement, and EV-9 evidence-independence enforcement all succeeded. Browser E2E was correctly scope-skipped because EV-16 changes verification/governance rather than browser/runtime behavior. The final candidate job failed only at `Require actual exact-SHA independent-review pass`, because this pre-archive implementation SHA intentionally had not yet received a trusted EV-16 closeout review.

APK artifact `11929621962` is bound to the implementation candidate with Actions digest `sha256:92f1295ba98c6b2405f26190850c4901adb2497ca71a18b90c084b5f28969db0`. API 35 evidence artifact `11929542659` has digest `sha256:c575e45b317f4f0c0ca0e0bcb4893d1d56dd5042c99d475d5cee8b57d3cd2580`; API 36 large-screen evidence artifact `11929078105` has digest `sha256:5f02197b2eb382079765427ebd2666141f702e4454489048f819ff789ae758ab`.

### Isolation and rollback

EV-16 changes only verification selection/governance. It does not alter product/runtime state, candidate artifact identity, browser/Android proof semantics, architecture invariants, or independent-review requirements. Unknown files and pre-existing high-risk rules still fail safe to `verify-full`; all normal-risk rules not supported by EV-15 remain unchanged and unresolved rather than being silently widened or narrowed.

Rollback is deterministic: set `IRONSHADE_IMPACT_WIDENING_ENFORCEMENT=0` to use the promoted rule's pinned previous `normal` risk. The selector then returns the same targeted `ui-readability` and `design-system` checks as the pre-EV-16 impact map for the measured UI paths. The promotion-specific gate still validates provenance, calibration, and rollback evidence; disabling enforcement removes only EV-16's blocking escalation and does not erase calibration history or weaken any final repository proof gate.

This archive transition follows the repository's established independent-review self-reference rule. It records the immutable pre-archive implementation candidate and its exact-SHA technical evidence. The resulting closeout SHA cannot literally contain its own Git SHA because that SHA depends on these archive contents, so it must pass fresh exact-head technical gates and a fresh trusted EV-16 independent review; no proof or verdict is inherited from `22e9557819efbd655d916d9a27c4595fb2fb6db2`.

### Promotion status

Promoted only `ui-and-design-system -> risk: high / verify-full`. Every other EV-15-unmeasured normal-risk impact class remains unresolved and retains its prior behavior; existing high-risk classes remain fail-safe. EV-6 proof-cache reuse remains experimental/advisory. The next experimental task is EV-17 — Calibrate EV-6 Proof-Cache Closure.
'''
archive_path.write_text(archive.rstrip() + entry + '\n')

Path('agent/ev16-closeout.py').unlink()
