# Agent orchestration migration

Ironshade Vector is moving from a purely linear Markdown execution queue toward a proof-graph workflow without interrupting active product work.

## Compatibility rule

`docs/content-roadmap.md` remains the authoritative product/game queue during compatibility mode. `agent/task-graph.json` is authoritative only for task IDs matching the patterns declared in its `authority.authoritativeForPatterns` field, currently `AO-*`.

`agent/roadmap-metadata.json` adds machine-only domains, proof profiles, dependencies, and active ID/order inventory without duplicating roadmap titles or `Done when` acceptance text.

`agent/impact-map.json` maps changed files to focused iteration checks. Unknown or high-risk impact escalates to full verification instead of silently selecting too little testing.

`agent/candidate-manifest.schema.json` and `agent/verification-ledger.schema.json` define exact-candidate evidence. Proof and artifact evidence is valid only for the immutable candidate SHA named by the manifest.

`agent/tools/candidate-artifact.mjs` binds the reusable production `dist/` tree to the exact candidate SHA so Browser E2E and Android can consume the same verified output.

`agent/architecture-invariants.json` contains deterministic architecture boundaries that final PR candidates must satisfy. `agent/INDEPENDENT_VERIFIER.md` defines a separate read-only adversarial verifier role.

## Target model

The repository represents work as:

`task -> dependencies -> affected systems -> proof obligations -> exact-candidate evidence -> reusable artifacts`

The implementation agent remains the single writer for one active task. Independent review is a separate read-only context that attempts to disprove completion; it does not implement fixes or create competing branches.

A task is complete only when its exact candidate revision satisfies all technically available required proofs.

## Progressive rollout

### AO-1 — Task graph foundation

Verified. Added the versioned orchestration graph, semantic validator, deterministic next-task selector, regression tests, and dedicated CI.

### AO-2 — Roadmap compatibility adapter

Verified. Active roadmap items can be materialized from Markdown plus machine-only sidecar metadata without duplicating product acceptance text. CI rejects roadmap/sidecar drift.

### AO-3 — Change-impact verification

Verified. Changed files map to affected domains and focused verification. Unknown/high-risk changes intentionally expand to full verification.

### AO-4 — Candidate manifest and verification ledger

Verified. Candidate manifests bind task, acceptance digest, base/head SHA, changed files, impact, proofs, and external-QA references. Ledgers reject cross-SHA evidence and manifest tampering.

### AO-5 — CI proof reuse

Verified. `.github/workflows/pr-candidate.yml` owns one exact-head full verification/production-build producer. The SHA-bound web artifact fans out to Browser E2E and Android; Android produces one APK reused by API 35 and API 36.

The PR graph is:

`exact PR head -> one full verification/build -> SHA-bound web artifact -> browser + Android -> one APK -> API35/API36 -> final proof ledger`

### AO-6 — Independent verifier and mechanical invariants

Verified.

AO-6 adds two complementary proof layers:

1. **Mechanical architecture invariants.** `agent/architecture-invariants.json` enforces the renderer/simulation import boundary, the renderer-neutral `GameCanvas` entrypoint, and graphics-asset independence from simulation implementation details. `agent/tools/check-architecture-invariants.mjs` runs on every PR final candidate; its regression suite proves the rules fail closed when imports or source boundaries drift.
2. **Independent verifier context.** `agent/tools/independent-review.mjs` creates an exact-SHA packet containing task acceptance criteria, changed files, impact selection, required proofs, passed architecture invariants, and adversarial questions. A separate verifier follows `agent/INDEPENDENT_VERIFIER.md`, has no writer role, and returns a machine-readable pass/fail result. The result validator rejects another candidate SHA and rejects `pass` when any acceptance criterion or required proof is unsupported.

The PR Candidate workflow creates the review context from a checkout with `contents: read` and `persist-credentials: false`. A verifier failure goes back to the implementation owner, who fixes the same branch and produces a new candidate SHA for review.

AO-6 was proven on exact implementation candidate `6e12bec8b2a4b80b3a5fe1034462cff818fd6453` by Agent Orchestration run `37638419687` and PR Candidate Verification run `37638420943`. The candidate passed the architecture invariant checker and its failure-mode regressions, independent-review contract regressions, one full repository verification/build, desktop and mobile browser journeys, Android packaging, API 35 smoke, API 36 large-screen smoke, and the final aggregate gate. Artifact `independent-review-context-324-6e12bec8b2a4b80b3a5fe1034462cff818fd6453` contains the read-only AO-6 review packet, and artifact `agent-candidate-evidence-324-6e12bec8b2a4b80b3a5fe1034462cff818fd6453` contains a strict ledger with all five AO-6 proof obligations passed and no unresolved external QA. The review proof records that the exact-SHA read-only review context and result-validation contract were exercised; it does not claim that CI itself ran a second AI reviewer.

After every verified defect or meaningful workflow failure, the implementation owner evaluates whether it exposes a reusable repository improvement: a regression test, architecture invariant, impact-map rule, proof obligation, CI safeguard, or agent instruction. Implement that improvement as part of the same task when the lesson is deterministic, generalizable, and likely to prevent future mistakes. Do not create permanent rules for one-off, flaky, external, or highly task-specific failures.

When a failure class recurs and can be made deterministic, promote it into `agent/architecture-invariants.json`, `agent/impact-map.json`, or another focused repository test rather than adding another prose reminder.

With AO-1 through AO-6 verified, the orchestration migration has no remaining AO task. Product/game development therefore continues from `docs/content-roadmap.md` under the compatibility rule unless a future explicit migration changes that authority.

## Commands

Validate/select orchestration work:

```bash
node agent/tools/validate-task-graph.mjs
node agent/tools/next-task.mjs --json
node agent/tests/task-graph.mjs
```

Validate roadmap compatibility:

```bash
node agent/tools/sync-roadmap-metadata.mjs --check
node agent/tools/roadmap-adapter.mjs --validate-only
node agent/tests/roadmap-adapter.mjs
```

Select affected verification:

```bash
node agent/tools/select-affected-verification.mjs --files src/game/graphicsAssetManifest.ts,scripts/prepare-refinery-premium-surfaces.mjs --json
node agent/tools/select-affected-verification.mjs --base main --head HEAD --json
node agent/tests/affected-verification.mjs
```

Generate exact-candidate evidence:

```bash
node agent/tools/candidate-evidence.mjs manifest \
  --task active \
  --base main \
  --head HEAD \
  --branch "$(git branch --show-current)" \
  --output .agent-evidence/candidate-manifest.json

node agent/tools/candidate-evidence.mjs validate \
  --manifest .agent-evidence/candidate-manifest.json \
  --verify-git
```

Validate reusable candidate artifacts:

```bash
node agent/tools/candidate-artifact.mjs create \
  --candidate "$(git rev-parse HEAD)" \
  --root dist \
  --output .candidate-artifact/candidate-web.json

node agent/tools/candidate-artifact.mjs validate \
  --candidate "$(git rev-parse HEAD)" \
  --root dist \
  --manifest .candidate-artifact/candidate-web.json
```

Run architecture proofs:

```bash
node agent/tools/check-architecture-invariants.mjs
node agent/tests/architecture-invariants.mjs
```

Create a read-only independent review packet and validate a verifier result:

```bash
node agent/tools/independent-review.mjs packet \
  --manifest .agent-evidence/candidate-manifest.json \
  --output .independent-review/review-packet.json \
  --verify-git

node agent/tools/independent-review.mjs validate-result \
  --packet .independent-review/review-packet.json \
  --result .independent-review/review-result.json

node agent/tests/independent-review.mjs
```

## State model

- `planned` — known work whose dependencies may not yet be complete.
- `ready` — explicitly ready and all dependencies are complete.
- `active` — the single writer-owned task currently being implemented.
- `verifying` — implementation is complete enough for final proof collection.
- `failed_retryable` — verification failed but a concrete technical next action exists.
- `blocked_external` — progress requires unavailable input, credentials, permissions, hardware, or an external service.
- `verified` — required technically available proofs passed.
- `archived` — verified work retained only as history.

The graph validator rejects dependency cycles, unknown dependencies, multiple active tasks, and invalid blocker states. The roadmap adapter rejects duplicate IDs, missing acceptance clauses, sidecar drift, and invalid dependencies. Impact selection rejects malformed mappings and fails safe to full verification. Candidate evidence rejects cross-SHA evidence and incomplete strict ledgers. Candidate artifacts reject wrong-SHA or modified bundles. Architecture invariants reject boundary drift. Independent review rejects wrong-SHA results and unsupported pass verdicts.
