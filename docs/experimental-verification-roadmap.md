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
- When enforcement depends on measured evidence, separate calibration/evidence collection from default enforcement into different roadmap items. Calibration items must remain advisory and must not flip default enforcement.
- An enforcement item may promote only the scope justified by already-recorded calibration evidence. Do not expand the calibration corpus, invent a second experiment, or combine unrelated refactoring in the same ownership cycle.
- If a task needs more than one independent verification closure (for example calibration plus enforcement plus rollback), split it before implementation. Keep one active EV implementation PR at a time.
- Promotion is new engineering work. Never rewrite the archived EV-1 through EV-7 records to imply they were previously enforced.
- Experiments and promotion candidates must fail closed. No promotion may weaken an existing proof gate, exact-SHA evidence, Android/browser coverage, or independent-review requirement.
- Promotion may enforce only behavior supported by measured shadow evidence. If the evidence supports only a narrower deterministic subset, promote that subset and leave the unsupported remainder advisory.
- Every promoted mechanism must have a deterministic rollback/disable path that restores the prior verified pipeline without data or evidence corruption.
- Do not mark a promotion item complete until the exact candidate has passed its technically available required proofs and independent review, and the permanent rule is documented outside this experimental roadmap.

## Prerequisite

The AO-6 independent-verifier and mechanical-invariant foundation must be merged and active before any promotion item below may enable default enforcement. No EV promotion may weaken or bypass AO-6's exact-candidate review gate.

## Active experimental queue

- [ ] **EV-18 — Reuse One Validated Proof Class**
  - **Blocked by EV-17 calibration evidence:** no proof class is currently eligible. The real full-repository-build proof depends on a pulled Docker base-image identity and Docker engine version that EV-6 does not bind into its causal execution-context digest. Do not enable reuse until a separately reviewed calibration closes those dynamic inputs.
  - Enable reuse for one proof class justified by EV-17, requiring exact input/context digests, immutable candidate identity, auditable cache provenance, and fail-closed fallback to the real proof for any unknown or inconsistent dependency.
  - Prove cache disablement forces the original proof to rerun and preserves prior acceptance semantics.
  - Done when `AGENTS.md` and proof-cache contracts document the promoted class and rollback, and the exact candidate is archived with required proofs and independent review; further proof classes require separate roadmap items.

- [ ] **EV-19 — Validate EV-7 Roadmap Shadow Predictions**
  - Compare prior shadow-friction predictions with actual implementation outcomes from later roadmap work and quantify useful predictions, false alarms, and missed integration pressure.
  - Keep all roadmap-pressure scoring advisory in this item and confirm disposable probes remain outside product/runtime state.
  - Done when the evidence identifies any signal with repeatable predictive value and records unsupported signals that must remain advisory.

- [ ] **EV-20 — Graduate One Roadmap-Pressure Signal**
  - Using only EV-19 evidence, either convert one validated signal into a deterministic architecture invariant, proof obligation, or roadmap rule, or explicitly record that no signal is ready for enforcement.
  - Do not make a heuristic score authoritative; verify disabling the simulator restores the previous planning/verification path.
  - Done when the permanent rule or no-promotion decision is documented and, if enforcement changes, the exact candidate is archived with required proofs and independent review.

## Intended dependency order

EV-8 through EV-20 should normally execute in order. EV-8 and EV-9 establish stronger acceptance and evidence semantics. EV-10/11, EV-12/13/14, EV-15/16, EV-17/18, and EV-19/20 deliberately separate calibration from governance or enforcement so each ownership cycle has one primary verification closure.

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

Calibration-only items may complete when their measured evidence is recorded and independently reproducible; they must not claim promotion or default enforcement. Their paired promotion item remains responsible for the full promotion completion rule above.

## Research boundary

Known concepts such as mutation testing, architecture fitness functions, predictive test selection, provenance, and adversarial review may be used as primitives. The experimental value here is the repository-specific combination: attacking acceptance semantics, checking causal proof independence, fingerprinting semantic behavior, learning from escaped failures, calibrating change-impact predictions, reusing proofs only from causal input closure, and stress-testing current architecture against future roadmap pressure.
