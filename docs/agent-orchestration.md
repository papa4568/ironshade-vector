# Agent orchestration migration

Ironshade Vector is moving from a purely linear Markdown execution queue toward a proof-graph workflow without interrupting active product work.

## Compatibility rule

`docs/content-roadmap.md` remains the authoritative product/game queue until an explicit migration phase changes that rule. The machine-readable graph in `agent/task-graph.json` is initially authoritative only for `AO-*` orchestration-migration tasks.

Do not select P28 or other product work from `agent/task-graph.json` during compatibility mode.

## Target model

The finished system will represent work as a graph of:

`task -> dependencies -> affected systems -> proof obligations -> verification evidence -> candidate artifact`

The implementation agent remains the single writer for one active task. Independent analysis and review may run separately, but they must not create competing implementations for the same task.

A task is complete only when the exact candidate revision satisfies its required proof obligations.

## Progressive rollout

### AO-1 — Task graph foundation

Add the versioned graph format, semantic validator, deterministic next-task selector, focused regression tests, and a CI gate. Keep product-roadmap behavior unchanged.

### AO-2 — Roadmap compatibility adapter

Connect active roadmap IDs to sidecar graph metadata without duplicating roadmap acceptance text. Validate drift and preserve existing roadmap ordering until cutover.

### AO-3 — Change-impact verification

Map changed files and affected domains to the narrowest useful tests. Unknown or high-risk impact must expand verification instead of silently under-testing.

### AO-4 — Candidate manifest and verification ledger

Bind proof evidence to an exact task/base/head SHA and record changed files, tests, CI runs, artifacts, APK identity, and unresolved external QA in a compact machine-readable record.

### AO-5 — CI proof reuse

Restructure final verification so expensive repository-wide work is not repeated independently by every downstream environment when the same exact candidate evidence can be reused safely.

### AO-6 — Independent verifier and mechanical invariants

Add a separate completion-review contract and promote stable architectural assumptions and recurring failure classes into deterministic checks where practical.

## Phase-1 commands

Validate the graph:

```bash
node scripts/agent/validate-task-graph.mjs
```

Show the currently selected orchestration task:

```bash
node scripts/agent/next-task.mjs
node scripts/agent/next-task.mjs --json
```

Run focused regressions:

```bash
node tests/agent-task-graph.mjs
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

The validator rejects cycles, unknown dependencies, multiple active tasks, actionable tasks whose dependencies are incomplete, and external blockers without named external dependencies.
