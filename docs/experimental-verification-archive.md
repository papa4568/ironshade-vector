# Experimental verification archive

Completed experimental verification items live here after their implementation and technically available proof obligations have passed. This file is history, not an executable queue.

## EV-1 — Acceptance Attack Compiler

Completed 2026-10-09 in advisory/shadow mode.

### Implemented

- Added `agent/tools/acceptance-attack-compiler.mjs`, reusing the existing roadmap adapter to compile machine-readable attacks from a real unchecked roadmap task instead of maintaining a parallel task parser.
- Added deterministic templates for false readiness, fake telemetry, skipped quality work, hidden serialization, special-cased test routes, and omitted asset/resource work.
- Added a representative `P28-PLOAD1` attack fixture whose dishonest variants mutate only a disposable detached clone.
- A verifier success on a dishonest variant is classified as `proof-gap`; it can never produce a candidate pass. Reports explicitly set `candidatePassGranted: false`.
- Agent Orchestration runs the regression in shadow mode and persists the attack plan/report as an exact-SHA artifact. No product/runtime gate consumes the advisory verdict.

### Evidence

Implementation candidate `d032290f6b71a205a702dab11d8198b767c3bffe` passed Agent Orchestration run `37929581798` and PR Candidate Verification run `37929582177` before this archive closeout.

The persisted P28 attack plan had digest `a6ac67d8177ab92d70d43381acd6ae43768c4eabb1900c33e2259c1ac8eece2f` and compiled six attacks from the real `P28-PLOAD1` acceptance contract. Multiple attacks challenged the same serialized-placement criterion. The exercise caught the direct hidden-serialization mutation and reported the other five dishonest variants as proof gaps; none became a pass. The report recorded `sourceUnchanged: true` and `candidatePassGranted: false`.

Advisory evidence artifact `11615876636` (`acceptance-attack-shadow-347-d032290f6b71a205a702dab11d8198b767c3bffe`) is SHA-256 bound by GitHub Actions as `9518273da9cf8e637fe441c57d900f8a63b0264114e15e53e4b4e5f4f91ba9bf`.

The exact implementation candidate also passed the full repository verification/production build, generated and validated the installable Android APK, passed API 35 product smoke and API 36 large-screen smoke, and passed the aggregate Android and PR Candidate gates. APK artifact `11615524244` is bound to the same candidate SHA with Actions digest `c555aa1f38d7d4fcd62688999aa1042a46899e18fdcc5bd4c2e4b5caf4b708eb`. Browser E2E was correctly skipped by the repository's scope detector because EV-1 touched no browser/runtime surface.

### Isolation and rollback

Attack execution clones the source repository into temporary disposable state, checks out the exact source HEAD detached, mutates only that clone, resets/cleans it between attacks, removes it afterward, and verifies the source repository fingerprint is unchanged. The Agent Orchestration workflow has read-only repository contents permission, so the shadow run cannot push candidate-branch mutations.

Rollback is to remove the two EV-1 shadow steps from Agent Orchestration and leave/remove the dormant `agent/acceptance-attack-*` tooling and fixture. Because EV-1 does not replace or weaken any existing proof gate, rollback restores the previous verified pipeline without changing product verification behavior.

### Promotion status

Not promoted. EV-1 remains advisory. AO-6 independent-verifier/mechanical-invariant foundations remain a prerequisite before any experimental mechanism becomes default-enforced behavior. The next experimental queue item is EV-2.
