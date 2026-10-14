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

archive = archive_path.read_text().rstrip()
heading = '## EV-16 — Enforce Validated Change-Impact Widenings'
if heading in archive:
    raise SystemExit('EV-16 archive record already exists')
entry = r'''

## EV-16 — Enforce Validated Change-Impact Widenings

Completed 2026-10-14 as a permanent fail-closed widening of affected-verification policy using only the EV-15-calibrated promotion plus conservative handling for the EV-15-unresolved remainder. The archived EV-5 and EV-15 calibration history remains unchanged.

### Implemented

- Promoted only `ui-and-design-system` in `agent/impact-map.json` from `risk: normal` to `risk: high`. The two EV-15-calibrated UI/TypeScript miss classes therefore use the existing `verify-full` fallback instead of only `ui-readability` and `design-system`.
- Pinned the formal promotion to the immutable EV-15 corpus blob `56620952b96eb0711569bc6f01f4aee8fcb58b1f`, pre-promotion impact-map blob `7212e618374cff242fcc992faa260fad328e7026`, EV-15 implementation candidate `295ec87024e34be6d724cee60fa432b375712a96`, run `38624196233`, artifact `11923980804`, and digest `sha256:5acf0a2ab2429a01868bda7de61b846cd6f82f89f29d4eff8c947f4ea093ae53`.
- Kept every other EV-15-unmeasured normal-risk rule unchanged in the map, but made those matched rules explicitly unresolved/low-confidence while EV-16 enforcement is active. Any such match now fails safe to the existing `verify-full` fallback. Unknown files and pre-existing high-risk rules keep their prior fail-safe behavior.
- Added promotion metadata, `agent/tools/impact-widening-promotion.mjs`, `agent/tests/impact-widening-promotion.mjs`, and affected-verification regressions. The promotion gate rejects drift in the pinned EV-15 evidence, rejects unreviewed rule-map widening, exercises the two EV-15 positive probes, representative low-confidence normal-risk probes, already-high-risk and unknown-file controls, and reports `candidatePassGranted=false` so it can only block/report.
- Added deterministic rollback through `IRONSHADE_IMPACT_WIDENING_ENFORCEMENT=0`. Rollback restores the exact pre-EV-16 static selector behavior: the promoted UI rule returns to targeted `ui-readability` + `design-system`, unresolved normal-risk rules return to their historical targeted/none outcomes, and every unrelated final proof gate remains unchanged.
- Kept EV-15 independently reproducible after promotion by running its calibration workflow under the EV-16 rollback switch. The legacy EV-5 historical calibration regression likewise resolves the pinned pre-EV-16 impact-map blob instead of pretending the historical selector already contained the promotion.
- Added `.github/workflows/ev16-impact-widening.yml` plus Agent Orchestration coverage so the exact candidate publishes promotion-specific enforcement/rollback evidence in addition to the repository's existing full candidate verification.

### Review-driven correction

The first technically complete implementation candidate `22e9557819efbd655d916d9a27c4595fb2fb6db2` correctly promoted the measured UI rule but left mapped unmeasured normal-risk rules on targeted verification. Trusted review run `38639343255` (PR comment `6178765803`) returned `fail`: acceptance required unknown **or low-confidence** change classes to fail safe to broader verification, and the original promotion tests did not exercise that boundary.

The same branch reopened EV-16, removed its premature archive state, and corrected the selector rather than weakening the criterion. Active EV-16 enforcement now distinguishes matched unresolved normal-risk rules as low-confidence and escalates them to `verify-full`; rollback still restores the exact historical static selector. Promotion regressions now exercise representative `babylon-ability-vfx` and `documentation-only` low-confidence classes in addition to the calibrated UI probes and fail-safe controls.

### Exact implementation evidence

Corrected implementation candidate `5a10d987d35828788e9892bab67f2cf1a575ae85` passed EV-16 Impact Widening Promotion run `38654940771`. Exact-SHA artifact `11936098699` (`impact-widening-ev16-384-5a10d987d35828788e9892bab67f2cf1a575ae85`) has GitHub Actions digest `sha256:bd475e1af225c7c44784105d7c1c1bac7cefd22a7e69408424a776f398df0612`. The promotion evidence records zero false positives and zero false negatives for the measured promotion/low-confidence scope and confirms rollback matches the pinned pre-promotion selector.

The same candidate passed EV-15 Impact Calibration run `38654940778` under rollback mode and Agent Orchestration run `38654940742`, including roadmap/task regressions, EV-8/EV-9 promoted enforcement, affected-verification regressions, EV-16 scope/rollback enforcement, candidate-artifact checks, CI proof-reuse contract, architecture invariants, and independent-review contract regressions.

PR Candidate Verification run `38654940814` passed every technically available producer/device gate for the exact implementation SHA: the authoritative full repository verification/production build, exact candidate web bundle, architecture invariants, promoted acceptance/evidence-independence gates, APK construction/integrity/delivery, API 35 product smoke, API 36 large-screen smoke, and aggregate Android verification all succeeded. Browser E2E was correctly scope-skipped because EV-16 changes verification/governance rather than browser/runtime behavior. The generic final packet still selected the normal product queue while EV-16 remained active, as required by compatibility-mode task-selection rules; that pre-closeout product-task result is not credited as EV-16 completion evidence.

Exact candidate web artifact `11936391629` has digest `sha256:29c8344aea4654fa9a993001103727489d885437e380097bb4a9d016397f35b8`. APK artifact `11937250511` has digest `sha256:cae0a7ec32d5de7da4ee9b6a622e43361e39f93a1fa633428fec50660fc180cb`; API 35 artifact `11937530368` has digest `sha256:5ccaeeda6dea20f88ebb92a28a7478f6c4292ac69d69efb6eea82c5fdf8e3f3c`; API 36 large-screen artifact `11937365806` has digest `sha256:a4103c70c982cc55687e76b9df25a0654f5d38409be955ba8186f974381770b0`; and independent-review context artifact `11935944460` has digest `sha256:c002c4e057bb1441016ff1a359c8f49a15432a5f473ca6a8439e0edee1a3eb2d`.

Fresh trusted review run `38656305340` (PR comment `6181043039`) on `5a10d987d35828788e9892bab67f2cf1a575ae85` returned `verdict="pass"` with all EV-16 acceptance checks satisfied, every required proof class credible, and no findings. The review explicitly confirmed that only the EV-15-calibrated UI rule is formally promoted, unresolved normal-risk classes fail safe while enforcement is active, rollback covers calibrated misses plus low-confidence/high-risk/unknown controls, and existing proof obligations remain intact. Trusted-review artifact `11937620457` has digest `sha256:0d074c1b17db7178385ba31e4e42227be8183dd862e6f31307ee7279597400f1`.

### Isolation and rollback

EV-16 changes verification selection/governance only. It does not alter product/runtime state, candidate artifact identity, browser/Android proof semantics, architecture invariants, or independent-review requirements. The formal rule-map promotion remains limited to the single EV-15-supported UI rule; conservative `verify-full` treatment of unresolved normal-risk classes prevents unsupported targeted selection from being treated as trustworthy evidence.

Rollback is deterministic: set `IRONSHADE_IMPACT_WIDENING_ENFORCEMENT=0` to restore the pinned pre-EV-16 static selector behavior for both the promoted UI rule and unresolved normal-risk rules. The promotion-specific gate still validates provenance, measured scope, and rollback evidence; disabling enforcement removes only EV-16's escalation behavior and does not erase calibration history or weaken any repository final-proof gate.

This archive transition follows the repository's established independent-review self-reference rule. It records the immutable reviewed pre-archive implementation candidate and its exact-SHA evidence. The resulting closeout SHA cannot literally contain its own Git SHA because that SHA depends on these archive contents, so it must pass fresh exact-head technical gates and a fresh trusted EV-16 independent review. Removing only EV-16 from the first active experimental position makes `agent/tools/select-review-task.mjs` resolve that candidate as `EV-16 / experimental-closeout`; no proof or verdict is inherited from `5a10d987d35828788e9892bab67f2cf1a575ae85`.

### Promotion status

Promoted only `ui-and-design-system -> risk: high / verify-full` as a map-policy widening justified by EV-15. All other EV-15-unmeasured normal-risk classes remain unresolved in the map and conservatively fail safe to `verify-full` while EV-16 enforcement is enabled; existing high-risk and unknown classes remain fail-safe. EV-6 proof-cache reuse remains experimental/advisory. The next experimental task is EV-17 — Calibrate EV-6 Proof-Cache Closure.
'''
archive_path.write_text(archive + entry.rstrip() + '\n')

Path('agent/ev16-closeout-final.py').unlink()
Path('.github/workflows/ev16-final-closeout-authoring.yml').unlink()
