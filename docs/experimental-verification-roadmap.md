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

- [ ] **EV-4 — Repository Immune System** — Record recurring verification failures as structured failure memories containing failure signature, root cause, affected domain, escape stage, discovering proof, fix class, and the earlier proof that should ideally have caught it. Cluster repeated deterministic failure classes and generate proposed permanent antibodies as architecture invariants, impact-map rules, focused regressions, or telemetry checks. **Done when:** multiple historical/synthetic failure records can be clustered deterministically; the system proposes a concrete reusable check for a repeated class; proposals require explicit review before enforcement; an accepted antibody catches recurrence of the same class; and failure-memory growth remains compact enough for future agents to consume without replaying PR history.

- [ ] **EV-5 — Self-Calibrating Impact Map** — Compare `agent/impact-map.json` predictions against the actual failures and affected domains observed during full verification. Record false-negative impact predictions and automatically propose conservative rule expansion; do not automatically reduce coverage. Add calibration metrics so the repository can detect when its change-impact model is becoming unreliable. **Done when:** each candidate can emit predicted versus observed impact; a synthetic miss produces a proposed wider rule; repeated misses in the same path/domain family converge on a deterministic expansion proposal; no automatic change can narrow verification; and CI can fail closed to `verify:full` when calibration confidence falls below a defined threshold.

- [ ] **EV-6 — Causal Proof Cache** — Define a proof-input-closure digest for selected expensive proofs so the repository can determine whether every input capable of affecting that proof is unchanged between candidate SHAs. Begin in shadow mode: always rerun the proof while independently predicting whether reuse would have been safe, then compare prediction to reality over many candidates. **Done when:** at least one expensive proof has an explicit machine-readable input closure; unchanged closures produce stable digests; changed causal inputs invalidate the digest; shadow-mode reuse predictions agree with real reruns across a meaningful sample; disagreement automatically disables reuse for that proof class; and no cached proof is ever accepted solely because two candidates share similar changed-file lists.

- [ ] **EV-7 — Roadmap Shadow Simulator** — Use upcoming roadmap items as architectural pressure tests for today's candidate. For selected future tasks, synthesize temporary minimal integration probes that do not implement the feature but test whether the current architecture exposes the expected extension points without forbidden dependencies, broad rewrites, or boundary violations. Score future friction only as advisory evidence until the signal proves stable. **Done when:** a current candidate can be tested against at least two later roadmap items; the simulator reports touched surfaces, required boundary violations, missing extension points, and rewrite pressure; deliberately coupling the current implementation increases the future-friction score; clean extension points reduce it; temporary probes never reach the implementation branch; and the score cannot block a candidate until validated against real later work.

## Intended dependency order

EV-1 through EV-3 are verified and archived in `docs/experimental-verification-archive.md`. Remaining default-enforcement work proceeds conservatively as:

`AO-6 -> EV-4 -> EV-5 -> EV-6 -> EV-7`

This order is conservative, not absolute. Advisory prototypes may continue under the prerequisite language above; EV-4 and EV-5 may partially prototype in parallel after EV-2 establishes structured proof data, but only one implementation writer should own a given experimental item at a time.

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
