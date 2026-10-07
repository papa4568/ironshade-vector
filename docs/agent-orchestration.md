# Agent orchestration migration

Ironshade Vector is moving from a purely linear Markdown execution queue toward a proof-graph workflow without interrupting active product work.

## Compatibility rule

`docs/content-roadmap.md` remains the authoritative product/game queue until an explicit migration phase changes that rule. The machine-readable graph in `agent/task-graph.json` is authoritative only for `AO-*` orchestration-migration tasks during compatibility mode.

`agent/roadmap-metadata.json` is a sidecar, not a duplicate roadmap. It stores only machine-oriented information: the active unchecked ID/order inventory, affected-domain rules, proof profiles, and optional dependency overrides. Product task titles, descriptions, and `Done when` acceptance text are parsed directly from `docs/content-roadmap.md` and are not copied into the sidecar.

`agent/impact-map.json` is the implementation-time change-impact map. It maps changed paths to affected domains and verification commands. It is conservative by design: unknown paths and high-risk build/dependency/Android/CI paths expand to `npm run verify:full` instead of silently selecting too little verification.

`agent/candidate-manifest.schema.json` and `agent/verification-ledger.schema.json` define exact-candidate evidence. A candidate manifest binds a task to its real base/head SHA range, changed files, impact selection, acceptance digest, required proofs, and external-QA references. A verification ledger is cryptographically bound to the canonical manifest and may only credit proof evidence or artifacts carrying that same candidate SHA.

Do not select P28 or other product work from `agent/task-graph.json` during compatibility mode. The roadmap adapter may materialize product tasks as a graph for inspection and validation, but Markdown order remains authoritative until cutover.

Affected-verification output optimizes the inspect/implement/test loop only. It does not waive a selected roadmap item's final production build, candidate CI, Android/APK, visual, or other proof obligations.

## Target model

The finished system will represent work as a graph of:

`task -> dependencies -> affected systems -> proof obligations -> verification evidence -> candidate artifact`

The implementation agent remains the single writer for one active task. Independent analysis and review may run separately, but they must not create competing implementations for the same task.

A task is complete only when the exact candidate revision satisfies its required proof obligations.

## Progressive rollout

### AO-1 — Task graph foundation

Verified. Added the versioned orchestration graph, semantic validator, deterministic next-task selector, focused regression tests, and dedicated CI without changing product-roadmap authority.

### AO-2 — Roadmap compatibility adapter

Verified. Active roadmap items are materialized from Markdown plus machine-only sidecar metadata without duplicating product acceptance text. Exact unchecked ID/order drift is CI-enforced, and Markdown ordering remains authoritative during compatibility mode.

The adapter reads unchecked top-level roadmap checkboxes, extracts their title and `Done when` acceptance directly from Markdown, merges machine-only metadata from `agent/roadmap-metadata.json`, and validates the resulting task graph. The first unchecked Markdown item remains the next product task.

When roadmap IDs are added, removed, or reordered, synchronize the sidecar in the same change:

```bash
node agent/tools/sync-roadmap-metadata.mjs --write
```

CI runs the same command in check mode and fails if the sidecar is stale.

### AO-3 — Change-impact verification

Verified. `agent/impact-map.json` defines repository path rules, affected domains, reusable verification commands, and explicit high-risk fallbacks. `agent/tools/select-affected-verification.mjs` accepts either a comma-separated changed-file list or a git base/head range and emits deterministic human- or machine-readable selection output.

Selection modes:

- `none` — recognized documentation-only impact; no runtime iteration check is selected.
- `targeted` — recognized low-risk impact; run the listed focused checks first.
- `full` — at least one changed file is unclassified or matches a high-risk rule; run `npm run verify:full` rather than guessing narrowly.

The selector de-duplicates overlapping rules. Representative P28 asset-generation changes resolve to `npm run test:graphics:content` plus `npm run test:graphics:babylon`; refinery presentation changes retain the refinery renderer checks. Unknown, build/dependency, Android, and CI impact escalates instead of silently under-testing.

### AO-4 — Candidate manifest and verification ledger

Active. `agent/tools/candidate-evidence.mjs` generates exact-candidate manifests from a real git base/head range and validates that the manifest changed-file inventory still matches that range. The manifest records the task, acceptance digest, base/head commit SHAs, branch, changed files, impact selection, required proofs, and external-QA references.

The verification ledger records proof status, CI/command/review/artifact source identity, artifact name/digest/location when available, and unresolved external QA. The ledger stores a SHA-256 digest of the canonical manifest. Validation rejects:

- a ledger whose task or candidate SHA differs from the manifest;
- proof evidence attached to another candidate SHA;
- artifacts attached to another candidate SHA;
- edited manifests whose canonical digest no longer matches the ledger;
- duplicate or unknown proof evidence;
- incomplete required proofs unless explicitly validating an in-progress ledger.

For AO migration PRs, Agent Orchestration CI now explicitly checks out `github.event.pull_request.head.sha` instead of relying on GitHub's synthetic pull-request merge ref. After the exact-head validation job succeeds, a dependent evidence job regenerates the same manifest, creates a strict ledger for the test/CI proofs it just observed, validates the pair against git, and uploads both as a compact `agent-candidate-evidence-*` artifact.

This avoids a self-reference problem: the evidence files do not need to be committed into the candidate they describe. The immutable candidate SHA is data inside the manifest and ledger; AO-5 will build on these records to reuse expensive proof/artifact outputs across CI environments.

### AO-5 — CI proof reuse

Restructure final verification so expensive repository-wide work is not repeated independently by every downstream environment when the same exact candidate evidence can be reused safely.

### AO-6 — Independent verifier and mechanical invariants

Add a separate completion-review contract and promote stable architectural assumptions and recurring failure classes into deterministic checks where practical.

## Orchestration commands

Validate the AO migration graph:

```bash
node agent/tools/validate-task-graph.mjs
```

Show the currently selected orchestration task:

```bash
node agent/tools/next-task.mjs
node agent/tools/next-task.mjs --json
```

Run AO graph regressions:

```bash
node agent/tests/task-graph.mjs
```

## Roadmap compatibility commands

Require exact active-ID/order synchronization between Markdown and the sidecar:

```bash
node agent/tools/sync-roadmap-metadata.mjs --check
```

Materialize and validate the active product roadmap as a machine-readable graph:

```bash
node agent/tools/roadmap-adapter.mjs --validate-only
node agent/tools/roadmap-adapter.mjs
node agent/tools/roadmap-adapter.mjs --json
```

Run roadmap-adapter regressions:

```bash
node agent/tests/roadmap-adapter.mjs
```

## Affected-verification commands

Validate the impact map without selecting checks:

```bash
node agent/tools/select-affected-verification.mjs --validate-only
```

Select checks for explicit changed files:

```bash
node agent/tools/select-affected-verification.mjs --files src/game/graphicsAssetManifest.ts,scripts/prepare-refinery-premium-surfaces.mjs
node agent/tools/select-affected-verification.mjs --files src/game/graphicsAssetManifest.ts,scripts/prepare-refinery-premium-surfaces.mjs --json
```

Select checks from a git diff:

```bash
node agent/tools/select-affected-verification.mjs --base main --head HEAD --json
```

Run affected-verification regressions:

```bash
node agent/tests/affected-verification.mjs
```

## Candidate evidence commands

Generate a manifest for the current active AO migration task:

```bash
node agent/tools/candidate-evidence.mjs manifest \
  --task active \
  --base main \
  --head HEAD \
  --branch "$(git branch --show-current)" \
  --output .agent-evidence/candidate-manifest.json
```

Validate that manifest against the exact git diff:

```bash
node agent/tools/candidate-evidence.mjs validate \
  --manifest .agent-evidence/candidate-manifest.json \
  --verify-git
```

Build a CI-backed ledger after the candidate checks pass, then validate it strictly:

```bash
node agent/tools/candidate-evidence.mjs ledger \
  --manifest .agent-evidence/candidate-manifest.json \
  --pass-kinds test,ci \
  --workflow 'Agent Orchestration' \
  --run-id "$GITHUB_RUN_ID" \
  --job 'validate-agent-orchestration' \
  --output .agent-evidence/verification-ledger.json

node agent/tools/candidate-evidence.mjs validate \
  --manifest .agent-evidence/candidate-manifest.json \
  --ledger .agent-evidence/verification-ledger.json \
  --verify-git
```

Run candidate-evidence regressions:

```bash
node agent/tests/candidate-evidence.mjs
```

## State model

- `planned` — known work whose dependencies may not yet be complete.
- `ready` — explicitly ready and all dependencies are complete.
- `active` — the single writer-owned task currently being implemented.
- `verifying` — implementation is complete enough for final proof collection.
- `failed_retryable` — a verification attempt failed but a concrete technical next action exists.
- `blocked_external` — progress requires unavailable input, credentials, permissions, hardware, or an external service.
- `verified` — required technically available proofs passed.
- `archived` — verified work retained only as history.

The AO task-graph validator rejects cycles, unknown dependencies, multiple active tasks, actionable tasks whose dependencies are incomplete, and external blockers without named external dependencies. The roadmap adapter separately rejects duplicate unchecked IDs, missing `Done when` clauses, sidecar drift, unknown proof profiles/rules, and dependencies that point to a later active roadmap task. The impact-map validator rejects duplicate rules, unknown verification references, malformed path rules, and invalid fallback configuration. Candidate-evidence validation rejects cross-SHA evidence, manifest tampering, unknown/duplicate proof evidence, invalid artifact identities, and incomplete required proofs in strict mode.
