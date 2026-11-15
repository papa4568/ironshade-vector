# Engineering iteration and verification playbook

This rule supplements AGENTS.md and the active roadmap. It accelerates development without weakening exact-candidate acceptance, independent review, or security authorization.

## Diagnose before changing code

1. Reproduce the actual issue, identify the route/runtime and exact failing candidate, and inspect the real evidence. For visuals, include rendered normal, action, enemy warning and touch-control states at the target viewport, not just PNG validity or asset counts.
2. Record the symptom, evidence/artifact, concrete causal hypothesis, and smallest disconfirming test in the active PR. Separate product defects from infrastructure, reviewer, or external-hardware failures.
3. Diagnose related failures together. Before changing shared rendering code, identify affected sibling functionality and **run its focused regression tests**, not only inspect its screenshots; add deterministic sibling regressions when an observed defect is untested. Do not make repeated camera, lighting, geometry or test-assertion guesses without examining what failed.
4. On a failed correction, change the hypothesis based on new evidence. After two unsuccessful revisions for the same symptom, explicitly revisit the reproduction and root cause before another source edit.

## Preflight before expensive CI

The authoritative impact map and affected-verification selector choose focused checks. Do not handpick a smaller list.

```bash
# Plan only; does not run checks.
node tools/iteration-preflight.mjs --base main --head HEAD
# Work-in-progress paths.
node tools/iteration-preflight.mjs --files src/game/example.ts,tests/example.ts --json
# Run selected checks, stopping at first failure.
node tools/iteration-preflight.mjs --files src/game/example.ts,tests/example.ts --run
# For a stable candidate when the selector requires full verification:
node tools/iteration-preflight.mjs --base main --head HEAD --run --allow-full
```

The range-based preflight inventories **added, modified, renamed (both source and destination), and deleted** files, including high-risk removals. When using manual `--files`, supply every changed and deleted path yourself; prefer `--base/--head` for a complete Git change inventory. The preflight refuses implicit full verification and never treats an empty selection as a successful run. It runs repository-declared commands: inspect the impact-map changes before executing commands from an untrusted branch. A plan does not constitute test evidence.

## Visual diagnostics and candidate freeze

Inspect actual high-tier normal/action scene pixels for each affected map before launching full Android visual review. Run focused sibling gameplay/presentation regression tests for each affected completed location before full Android visual acceptance. Check combat warning legibility, objectives, collision/touch overlays, material relief, world-object provenance, clipping, fallbacks, and completed sibling locations. Browser renders are a fast diagnostic aid, **not** a replacement for real Android/APK screenshot review.

Run final full build, architecture/security, browser, API 35/36 and APK, actual high-tier visual acceptance and trusted independent review on one credible exact SHA after focused checks pass. A new source commit invalidates affected proof unless the repository's authenticated proof-reuse rules permit it. Never omit mandatory final gates.

Identify protected-source dependencies before editing them. Request independent owner/security authorization only against a stable exact candidate, preserve unmerged evidence when blocked, and never treat a test or reviewer as owner permission.

Process-only iteration-preflight modifications must be tied to an explicit active/verifying AO orchestration task whose acceptance and proofs describe the actual process change. Do not allow the product-roadmap fallback to label a process candidate as P28-G9 or claim visual acceptance. The fast CI `review-scope` check verifies this mapping for these iteration-preflight paths, while the authoritative trusted reviewer still decides acceptance independently.

### Proof provenance

The exact AO-18 focused tests run inside the **Agent Orchestration / validate-agent-orchestration** job before its partial ledger credits any test proof. They also run independently in Fast Iteration Preflight. For process changes, the fast workflow confirms the real **trusted-base \`pull_request_target\` EV-9 \`verify-pr-candidate\` success and its exact candidate/base log marker, then uploads a read-only receipt. The candidate's \`pull_request\` observer self-test is not trusted observation. The final candidate review must independently validate these exact-head job and log references; generic ledger source attribution is not a substitute for the actual producing checks.

## Completion and measurement

Keep the candidate SHA, focused-check outcomes, real visual findings, causes of expensive reruns, security/review status, APK artifact identity and blockers in the PR discussion. Do not archive/mark the active roadmap task done until actual acceptance passes. Use recurrence evidence to improve deterministic tests instead of weakening standards.
