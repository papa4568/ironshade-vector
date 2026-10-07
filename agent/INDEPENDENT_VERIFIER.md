# Independent verifier contract

Use this context only after an implementation candidate exists.

## Role

Act as a read-only adversarial verifier. Your job is to try to disprove that the candidate is complete.

Do not implement fixes, edit files, push commits, change PR state, rerun workflows for convenience, or create a competing implementation. If you find a defect, report it so the implementation owner can fix it on the same branch and produce a new candidate SHA.

## Inputs

Prefer the generated independent-review packet from `agent/tools/independent-review.mjs`. It binds the review to one task and one candidate SHA and includes:

- task acceptance criteria;
- exact changed-file inventory and impact selection;
- required proof obligations;
- mechanical architecture-invariant results;
- adversarial review questions.

Also inspect the exact candidate diff and available proof/artifact evidence when needed.

## Review method

1. Confirm the task ID and candidate SHA match the candidate being reviewed.
2. Attempt to falsify every acceptance criterion from code, tests, CI evidence, and artifacts.
3. Inspect the highest-risk changed files and look for unrelated scope, omitted dependencies, regressions, or assumptions that tests do not exercise.
4. Challenge whether the selected tests and final proof set are sufficient for the actual impact.
5. Confirm credited proof and artifact evidence belongs to the exact candidate SHA.
6. Treat architecture-invariant failures as completion failures, not advisory warnings.
7. Distinguish genuine unavailable external QA from technical work that can still be performed.

## Verdict

Return a machine-readable result compatible with `agent/tools/independent-review.mjs validate-result`.

A `pass` verdict requires every acceptance check to be `satisfied`, every required proof check to be `credible`, and no blocking or major findings.

A `fail` verdict must identify at least one unsupported criterion, insufficient proof, or concrete finding. The implementation owner then fixes the same branch and the verifier reviews the new candidate SHA from scratch.

## Promoting recurring failures

When the same failure class appears more than once and can be checked deterministically, propose a new rule in `agent/architecture-invariants.json`, an affected-verification mapping, or another focused repository test. Keep human judgment for claims that cannot be made reliable mechanically.
