# Engineering iteration and verification playbook

This rule supplements AGENTS.md and the active roadmap. It accelerates development without weakening exact-candidate acceptance, independent review, or security authorization.

## Diagnose before changing code

1. Reproduce the actual issue, identify the route/runtime and exact failing candidate, and inspect the real evidence. For visuals, include rendered normal, action, enemy warning and touch-control states at the target viewport, not just PNG validity or asset counts.
2. Record the symptom, evidence/artifact, concrete causal hypothesis, and smallest disconfirming test in the active PR. Separate product defects from infrastructure, reviewer, or external-hardware failures.
3. Diagnose related failures together and inspect affected siblings before changing shared rendering code. Do not make repeated camera, lighting, geometry or test-assertion guesses without examining what failed.
4. On a failed correction, change the hypothesis based on new evidence. After two unsuccessful revisions for the same symptom, explicitly revisit the reproduction and root cause before another source edit.

## Preflight before expensive CI

The authoritative impact map and affected-verification selector choose focused checks. Do not handpick a smaller list.

```bash
# Plan only; does not run checks.
node agent/tools/iteration-preflight.mjs --base main --head HEAD
# Work-in-progress paths.
node agent/tools/iteration-preflight.mjs --files src/game/example.ts,tests/example.ts --json
# Run selected checks, stopping at first failure.
node agent/tools/iteration-preflight.mjs --files src/game/example.ts,tests/example.ts --run
# For a stable candidate when the selector requires full verification:
node agent/tools/iteration-preflight.mjs --base main --head HEAD --run --allow-full
```

The preflight refuses implicit full verification and never treats an empty selection as a successful run. It runs repository-declared commands: inspect the impact-map changes before executing commands from an untrusted branch. A plan does not constitute test evidence.

## Visual diagnostics and candidate freeze

Inspect actual high-tier normal/action scene pixels for each affected map before launching full Android visual review. Check combat warning legibility, objectives, collision/touch overlays, material relief, world-object provenance, clipping, fallbacks, and completed sibling locations. Browser renders are a fast diagnostic aid, **not** a replacement for real Android/APK screenshot review.

Run final full build, architecture/security, browser, API 35/36 and APK, actual high-tier visual acceptance and trusted independent review on one credible exact SHA after focused checks pass. A new source commit invalidates affected proof unless the repository's authenticated proof-reuse rules permit it. Never omit mandatory final gates.

Identify protected-source dependencies before editing them. Request independent owner/security authorization only against a stable exact candidate, preserve unmerged evidence when blocked, and never treat a test or reviewer as owner permission.

## Completion and measurement

Keep the candidate SHA, focused-check outcomes, real visual findings, causes of expensive reruns, security/review status, APK artifact identity and blockers in the PR discussion. Do not archive/mark the active roadmap task done until actual acceptance passes. Use recurrence evidence to improve deterministic tests instead of weakening standards.
