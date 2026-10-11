# Experimental verification roadmap

This roadmap tracks speculative repository-level engineering intended to make Ironshade Vector's AI development environment improve its own verification quality over time.

These ideas deliberately combine known software-engineering primitives in unusual ways. Treat them as experiments until repository evidence proves they are reliable. EV-1 through EV-7 completed their prototype/shadow phases and are archived in `docs/experimental-verification-archive.md`; the active queue below is the explicit graduation path from experimental mechanisms to normal repository infrastructure.

## Execution contract

- This is **not** the default product queue.
- `docs/content-roadmap.md` remains the authoritative product/game queue unless the user explicitly selects this experimental roadmap.
- `agent/task-graph.json` remains authoritative only for the `AO-*` migration tasks covered by its authority rules.
- Work this roadmap only when the user explicitly asks to execute the experimental verification track or names one of the `EV-*` items below.
- Execute top to bottom unless the user changes priority or an item is blocked by an unmet dependency.
- One checkbox should fit one implementation -> targeted test -> final verification cycle. Split an item before coding if it contains independent experiments.
- Promotion is new engineering work. Never rewrite the archived EV-1 through EV-7 records to imply they were previously enforced.
- Experiments and promotion candidates must fail closed. No promotion may weaken an existing proof gate, exact-SHA evidence, Android/browser coverage, or independent-review requirement.
- Promotion may enforce only behavior supported by measured shadow evidence. If the evidence supports only a narrower deterministic subset, promote that subset and leave the unsupported remainder advisory.
- Every promoted mechanism must have a deterministic rollback/disable path that restores the prior verified pipeline without data or evidence corruption.
- Do not mark a promotion item complete until the exact candidate has passed its technically available required proofs and independent review, and the permanent rule is documented outside this experimental roadmap.

## Prerequisite

The AO-6 independent-verifier and mechanical-invariant foundation must be merged and active before any promotion item below may enable default enforcement. No EV promotion may weaken or bypass AO-6's exact-candidate review gate.

## Active experimental queue

- [ ] **EV-8 — Promote EV-1 Acceptance Attack Compiler**
  - Measure shadow-run outcomes against known dishonest variants and real acceptance failures; record false-positive/false-negative behavior for the scope proposed for enforcement.
  - Define the deterministic enforced scope. A surviving dishonest mutation must block promotion/candidate acceptance for that covered acceptance pattern; unsupported attack templates must remain advisory rather than being treated as proof.
  - Make the promoted scope a normal exact-candidate verification obligation without replacing the underlying tests, build, browser/Android, APK, or independent-review gates.
  - Add/retain regression coverage proving disposable-clone isolation, source immutability, fail-closed mutation handling, and rollback to the pre-promotion pipeline.
  - Update `AGENTS.md` and the relevant `agent/` contracts to describe the permanent enforced behavior, then archive EV-8 with exact-SHA evidence and independent-review result.
  - Promotion candidate scope is intentionally narrow: enforce only `hidden-serialization`, the EV-1 mutation already caught by the representative real P28-PLOAD1 verification path; keep `false-readiness`, `fake-telemetry`, `skipped-quality-work`, `special-cased-test-route`, and `omitted-resource-work` advisory until separate evidence supports promotion.

- [ ] **EV-9 — Promote EV-2 Causal Evidence Independence**
  - Resolve or explicitly exclude every currently important criterion that is circular or unsupported before enabling enforcement for that criterion.
  - Measure classification stability and false-positive/false-negative behavior using representative independent, circular, unsupported, and shared-infrastructure cases.
  - Enforce independence only for criteria with a materially independent observation path; unknown/malformed evidence must fail closed and no independence result may synthesize missing proof.
  - Preserve an explicit rollback path to the current advisory analyzer and verify existing exact-SHA candidate evidence remains authoritative.
  - Update `AGENTS.md` and the evidence-independence contract, then archive EV-9 with exact-SHA evidence and independent-review result.

- [ ] **EV-10 — Promote EV-3 Behavioral Genome**
  - Validate the genome against representative intentional behavioral changes and known non-semantic noise; quantify unexplained-delta false positives and missed semantic-change false negatives for the proposed enforced domains.
  - Define which domain deltas are blocking, which are declaration-required, and which remain informational. A genome match must never replace the tests that produced or independently verify behavior.
  - Enable fail-closed enforcement for unexplained deltas only where the measured evidence supports it, while preserving deterministic normalization/exclusion rules and exact-SHA binding.
  - Verify disabling genome enforcement restores the previous pipeline cleanly and leaves product/runtime behavior unchanged.
  - Update `AGENTS.md` and the behavioral-genome contract, then archive EV-10 with exact-SHA evidence and independent-review result.

- [ ] **EV-11 — Promote EV-4 Repository Immune System**
  - Validate recurrence clustering and accepted-antibody behavior against representative historical and synthetic failures; measure over-clustering, under-clustering, and recurrence-detection errors.
  - Define the permanent review/ownership process for accepting, updating, or retiring antibodies. Unreviewed proposals must remain non-enforcing.
  - Promote accepted deterministic antibodies into normal repository checks using the narrowest appropriate mechanism (regression, architecture invariant, impact-map rule, or telemetry contract) without creating a second competing source of truth.
  - Prove bounded memory/compaction remains deterministic and that rollback removes enforcement without losing unrelated repository history.
  - Update `AGENTS.md` and failure-memory/antibody contracts, then archive EV-11 with exact-SHA evidence and independent-review result.

- [ ] **EV-12 — Promote EV-5 Change-Impact Calibration**
  - Compare historical/current affected-verification predictions with full-verification outcomes and quantify miss/over-selection rates for each promotable rule class.
  - Promote calibration only as preserve-or-widen logic: it may add checks or escalate to `verify:full`, but it must never narrow existing required checks or final proof gates.
  - Require deterministic, reviewed impact-map updates for learned widenings; unknown or low-confidence change classes must fail safe to broader verification.
  - Verify rollback restores the existing static impact-map behavior and that no candidate evidence is reused across SHAs.
  - Update `AGENTS.md`, `agent/impact-map.json` policy, and calibration contracts, then archive EV-12 with exact-SHA evidence and independent-review result.

- [ ] **EV-13 — Promote EV-6 Causal Proof Cache**
  - Measure cache prediction agreement across repeated exact-closure runs and representative invalidation changes; record false-hit, false-miss, and same-closure disagreement behavior for each proof class considered for reuse.
  - Enable proof reuse only for proof classes with demonstrated deterministic causal closure and zero unresolved same-closure disagreements in the promotion evidence set.
  - Require exact input/context digests, immutable candidate identity, auditable cache provenance, and fail-closed fallback to the real proof whenever any dependency, environment input, or cache record is unknown or inconsistent.
  - Prove cache disablement forces the original proof to rerun and yields the previous verified pipeline without changing acceptance semantics.
  - Update `AGENTS.md` and proof-cache contracts, then archive EV-13 with exact-SHA evidence and independent-review result.

- [ ] **EV-14 — Promote EV-7 Roadmap Shadow Simulator**
  - Validate prior shadow-friction predictions against the actual implementation outcomes of later roadmap work and quantify useful predictions, false alarms, and missed integration pressure.
  - Define the permanent role of roadmap pressure signals. Only signals with validated predictive value may become normal planning/architecture obligations; unvalidated scoring must remain advisory and must not block product candidates.
  - Where evidence supports enforcement, convert the validated signal into a deterministic architecture invariant, proof obligation, or roadmap rule rather than making a heuristic score itself authoritative.
  - Verify disposable probes remain outside product/runtime state and that disabling the simulator restores the previous planning/verification path.
  - Update `AGENTS.md` and the roadmap-shadow contract, then archive EV-14 with exact-SHA evidence and independent-review result.

## Intended dependency order

EV-8 through EV-14 should normally execute in order. EV-8 through EV-10 establish stronger acceptance/evidence/behavior semantics; EV-11 and EV-12 learn reusable checks and verification widening from observed failures; EV-13 may reuse expensive proofs only after those proof dependencies are trustworthy; EV-14 graduates future-pressure signals only after they can be compared with real later implementation outcomes.

EV-1 through EV-7 remain verified prototype history in `docs/experimental-verification-archive.md`. Completing a promotion item does not rewrite that history; the promotion itself receives a new archived record.

This order is conservative, not absolute. The user may reprioritize independent promotion work, but only one implementation writer should own a given EV item at a time.

## Promotion completion rule

A promotion item may leave this roadmap only after:

1. the underlying mechanism has sufficient shadow/advisory evidence for the exact scope being promoted;
2. repository evidence shows that it detects real defects, safely widens verification, or safely avoids redundant work as claimed;
3. false-positive and false-negative behavior is measured for the promoted scope;
4. disabling the promoted mechanism restores the previous verified pipeline cleanly;
5. all existing exact-candidate proof obligations remain intact unless the promotion itself proves and documents an explicitly approved replacement;
6. the exact promotion candidate passes the independent verifier;
7. the permanent behavior is documented in `AGENTS.md`, the relevant `agent/` contract, architecture/impact policy, or active product verification policy; and
8. the promotion evidence and rollback history are moved to `docs/experimental-verification-archive.md`.

## Research boundary

Known concepts such as mutation testing, architecture fitness functions, predictive test selection, provenance, and adversarial review may be used as primitives. The experimental value here is the repository-specific combination: attacking acceptance semantics, checking causal proof independence, fingerprinting semantic behavior, learning from escaped failures, calibrating change-impact predictions, reusing proofs only from causal input closure, and stress-testing current architecture against future roadmap pressure.
