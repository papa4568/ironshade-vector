# Experimental verification roadmap

This roadmap tracks speculative repository-level engineering intended to make Ironshade Vector's AI development environment improve its own verification quality over time.

These ideas deliberately combine known software-engineering primitives in unusual ways. Treat them as experiments until repository evidence proves they are reliable.

## Execution contract

- This is **not** the default product queue.
- `docs/content-roadmap.md` remains the authoritative product/game queue unless the user explicitly selects this experimental roadmap.
- `agent/task-graph.json` remains authoritative only for the `AO-*` migration tasks covered by its authority rules.
- Work this roadmap only when the user explicitly asks to execute the experimental verification track or names one of the `EV-*` items below.
- Execute top to bottom unless the user changes priority or an item is blocked by an unmet dependency.
- One checkbox should fit one implementation -> targeted test -> final verification cycle. Split an item before coding if it contains independent experiments.
- Experiments must fail closed. A prototype may observe or report first, but it must not weaken an existing proof gate until shadow-mode evidence shows the replacement is at least as reliable.
- Never let an experiment silently reduce product verification, exact-SHA evidence, Android/browser coverage, or independent review requirements.
- Prefer shadow mode before enforcement whenever a new mechanism predicts, reuses, infers, or synthesizes proof.
- Every experiment must define a rollback path and preserve deterministic operation when its experimental feature is disabled.

## Prerequisite

The independent-verifier and mechanical-invariant foundation from AO-6 should be merged before these experiments become default-enforced behavior. Planning and isolated prototypes may begin earlier, but no EV item should weaken or bypass AO-6's exact-candidate review gate.

## Active experimental queue

No EV item is currently queued.

## Intended dependency order

EV-1 through EV-7 are verified and archived in `docs/experimental-verification-archive.md`. No additional experimental item is currently queued.

This order is conservative, not absolute. Advisory prototypes may continue under the prerequisite language above, but only one implementation writer should own a given experimental item at a time.

## Promotion rule

An experimental mechanism may become part of the normal product pipeline only after:

1. it has run in shadow/advisory mode where applicable;
2. repository evidence shows that it detects real defects or safely avoids redundant work;
3. false-positive and false-negative behavior is measured;
4. disabling it restores the previous verified pipeline cleanly;
5. the independent verifier reviews the promotion candidate; and
6. the permanent rule is documented in `AGENTS.md`, the relevant `agent/` contract, or the active product verification policy.

## Research boundary

Known concepts such as mutation testing, architecture fitness functions, predictive test selection, provenance, and adversarial review may be used as primitives. The experimental value here is the repository-specific combination: attacking acceptance semantics, checking causal proof independence, fingerprinting semantic behavior, learning from escaped failures, calibrating change-impact predictions, reusing proofs only from causal input closure, and stress-testing current architecture against future roadmap pressure.
