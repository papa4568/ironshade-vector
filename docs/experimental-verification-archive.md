# Experimental verification archive

Completed experimental verification items live here after their implementation and technically available proof obligations have passed for the exact completion candidate. This file is history, not an executable queue.

## EV-1 — Acceptance Attack Compiler

Completed 2026-10-09 in advisory/shadow mode.

### Implemented

- Added `agent/tools/acceptance-attack-compiler.mjs`, reusing the existing roadmap adapter to compile a machine-readable attack plan from a real unchecked roadmap task instead of maintaining a parallel task parser.
- Added deterministic templates for false readiness, fake telemetry, skipped quality work, hidden serialization, special-cased test routes, and omitted asset/resource work.
- Added a representative `P28-PLOAD1` attack fixture whose dishonest variants are created only inside a disposable detached clone.
- A verifier success on a dishonest variant is classified as `proof-gap`; it can never produce a candidate pass. Reports explicitly set `candidatePassGranted: false`.
- Hardened isolation after adversarial review: mutation targets must remain lexically and physically inside the disposable clone, symlink/path escape is rejected before write, clone files are not hard-linked to the source, and the clone's `origin` remote is removed before any attack executes.
- Agent Orchestration runs the regression in shadow mode and persists the attack plan/report as exact-SHA advisory evidence. No product/runtime gate consumes the advisory verdict.

### Evidence

Implementation candidate `bd79b1de7c2689ee45278d610ddae2f607d8eca1` passed Agent Orchestration run `37932964656` and PR Candidate Verification run `37932964706` before this archive closeout.

The persisted P28 attack plan had digest `a6ac67d8177ab92d70d43381acd6ae43768c4eabb1900c33e2259c1ac8eece2f` and compiled six attacks from the real `P28-PLOAD1` acceptance contract. Multiple attacks challenged the serialized-placement criterion. The exercise caught the direct hidden-serialization mutation and reported the other five dishonest variants as proof gaps; none became a pass. The report recorded `sourceUnchanged: true`, `sandboxRemoteDetached: true`, and `candidatePassGranted: false`.

Advisory evidence artifact `11617032776` (`acceptance-attack-shadow-347-bd79b1de7c2689ee45278d610ddae2f607d8eca1`) is SHA-256 bound by GitHub Actions as `00e80383af79d99b6be892f4dfda7bc836346f958ad78ce0449fdeeb9cc2b7dd`.

The exact implementation candidate also passed the full repository verification/production build, generated and validated the installable Android APK, passed API 35 product smoke and API 36 large-screen smoke, and passed the aggregate Android and PR Candidate gates. APK artifact `11617099244` is bound to the same candidate SHA with Actions digest `48f04980414b5130ed82572ba24f0216e2d887ae7202326ac57a15d47f94b1a2`. Browser E2E was correctly skipped by the repository's scope detector because EV-1 touched no browser/runtime surface.

### Isolation and rollback

Attack execution clones the source repository into temporary disposable state without local hard links, checks out the exact source HEAD detached, removes the clone's remote back to the source repository, validates mutation targets stay physically inside the clone, resets/cleans the clone between attacks, removes it afterward, and verifies the source repository fingerprint is unchanged. The Agent Orchestration workflow has read-only repository contents permission, so the shadow run cannot push repository changes through GitHub either.

Rollback is to remove the two EV-1 shadow steps from Agent Orchestration and leave/remove the dormant `agent/acceptance-attack-*` tooling and fixture. Because EV-1 does not replace or weaken any existing proof gate, rollback restores the previous verified pipeline without changing product verification behavior.

### Promotion status

Not promoted. EV-1 remains advisory. AO-6 independent-verifier/mechanical-invariant foundations remain a prerequisite before any experimental mechanism becomes default-enforced behavior. The next experimental queue item is EV-2.

## EV-2 — Causal Evidence Independence

Completed 2026-10-09 in advisory/shadow mode.

### Implemented

- Added `agent/evidence-independence.schema.json` plus `agent/evidence-independence.json` to represent important acceptance criteria, proof records, material/supporting observed signals, implementation sources, observer sources, and explicitly declared shared infrastructure.
- Added `agent/tools/evidence-independence.mjs`, a deterministic analyzer that classifies each criterion as `independent`, `circular`, or `unsupported`, records the concrete observation paths, and exposes a fail-closed `--enforce` mode without enabling that mode in repository CI.
- Added validation that shared-infrastructure exemptions can only reference sources whose kind is actually `shared-infrastructure`; implementation or observer sources cannot be relabeled to disguise circularity.
- Added regressions proving a material signal derived from the implementation under test is rejected for enforcement, a separate observer path passes, unchanged graphs analyze deterministically, and the repository graph intentionally surfaces one circular and one independent important criterion.
- Added compatibility coverage proving an EV-2 report can be attached to the existing candidate verification ledger as a SHA-bound artifact while cross-SHA independence evidence is still rejected by the existing exact-candidate contract.
- Agent Orchestration now emits and uploads the advisory independence report for the exact PR head. The report cannot grant a candidate pass and does not replace any existing candidate, browser, Android, APK, or ledger gate.

### Evidence

Implementation candidate `5173070628bd0bf5e9e1a379b505c424362cbc7f` passed Agent Orchestration run `37943299781` and PR Candidate Verification run `37943300285` before this archive closeout.

The EV-2 regressions reported `circularRejected=1`, `independentAccepted=1`, `sharedInfrastructureDistinguished=1`, `repositoryAdvisory=true`, and `candidateReference=exact-sha`. The exact-candidate repository report recorded two important criteria: one independent and one circular, with `acceptedForEnforcement=false`. That advisory failure is intentional evidence that the mechanism exposes a real proof-independence gap instead of silently treating the repository as enforcement-ready.

Advisory evidence artifact `11622531843` (`causal-evidence-independence-348-5173070628bd0bf5e9e1a379b505c424362cbc7f`) is bound to the candidate SHA and has GitHub Actions digest `9509e5235785fb4435651cf96515acfe636194caa92c944721043a546b4ebe58`. The final candidate evidence artifact `11622128534` has digest `04a8e6fd4724cc81479d1506717b16b48687bd6b4206d8a7ba640563a5f8d8ef`.

Exact-candidate verification also passed the full repository verification/production build, desktop and mobile-landscape browser E2E, APK construction/integrity, API 35 product smoke, API 36 large-screen smoke, the aggregate Android gate, and final PR Candidate Verification. APK artifact `11621947710` is bound to the same candidate SHA with Actions digest `337739f0799b77748029479f2b397cbbd534e597e4a2ebc848c30df8d1031d17`.

The first implementation candidate exposed a separate verification defect: API 36 reached the ready Babylon large-screen state but twice timed out waiting for the CDP `Page.captureScreenshot` RPC. The closeout candidate preserves all semantic CDP assertions and captures screenshots with the repository's existing `adb exec-out screencap -p` pattern instead. API 36 then passed and uploaded complete large-screen evidence, showing the correction hardened evidence capture rather than weakening the gate.

### Isolation and rollback

EV-2 has no write path into product/runtime state. The graph and analyzer are repository-local, Agent Orchestration runs with read-only repository contents permission, and the workflow only writes an ephemeral report into the Actions workspace before artifact upload.

Rollback is to remove the EV-2 regression/report/upload steps from Agent Orchestration and remove `agent/evidence-independence.json`, `agent/evidence-independence.schema.json`, `agent/tests/evidence-independence.mjs`, and `agent/tools/evidence-independence.mjs`. Existing exact-SHA candidate evidence, browser/Android verification, APK generation, and candidate acceptance behavior remain intact. The Android screenshot-capture hardening is independent gate maintenance discovered during exact-candidate verification and is not required to roll back the EV-2 experiment itself.

### Promotion status

Not promoted. The repository report remains advisory and currently identifies one important criterion without a materially independent observation path. AO-6 independent-verifier/mechanical-invariant foundations and the experimental promotion rule remain prerequisites before any EV-2 enforcement can become a default gate. The next experimental queue item is EV-3.

## EV-3 — Behavioral Genome

Completed 2026-10-09 in advisory/shadow mode.

### Implemented

- Added `agent/tools/behavioral-genome.mjs`, a deterministic hierarchical semantic-fingerprint contract with six behavior domains: simulation, mission progression, renderer state, asset/load readiness, resource ownership, and performance bands.
- Canonical observations sort object keys, normalize finite numeric values to four decimal places, and record explicitly excluded nondeterministic observations with reasons instead of silently tolerating runner noise.
- Each domain receives its own SHA-256 digest and the ordered domain digests form a root genome digest. The emitted report records the immutable candidate SHA without mixing that SHA into the semantic digest, so behavior can be compared across candidates while evidence provenance remains exact.
- Added a declared-domain comparator: changed domains are accepted only when every changed domain is explicitly declared. An undeclared semantic delta is mechanically rejected by `assertExplainedBehavioralDelta`.
- Added deterministic regressions proving stable repeats, narrow renderer/load declarations, four-decimal noise normalization, exact-SHA binding, and an injected simulation mutation that produces an unexplained `simulation` delta and fails.
- Added `tests/behavioral-genome-observer.ts`, which exercises real deterministic repository contracts: fixed-step simulation, generated campaign contracts and mission objectives, renderer-path selection, mission visual readiness, Babylon asset-runtime ownership/release behavior, and adaptive render-budget pressure/recovery.
- PR Candidate Verification runs the observer twice after the one full repository build, creates two exact-SHA genomes, requires their semantic comparison to have no changed domains, and uploads the result as advisory evidence before the existing browser/Android consumers proceed. EV-3 does not compare a candidate against a previous baseline as a normal product gate.

### Evidence

Implementation candidate `f0e1d1a97ed8a37611739bbddd2e9a59d3220c0a` passed Agent Orchestration run `37955027585` and PR Candidate Verification run `37955028121` before this archive closeout.

The real route `ev3-core-route-v1` produced root genome digest `10623d5d173a492299f302870ca22af71006e85882f446c1c072ffe87105f00a` on both independent executions of the exact implementation candidate. The repeat comparison recorded `changedDomains: []`, `unexplainedDomains: []`, and `accepted: true`. The persisted genome records candidate SHA `f0e1d1a97ed8a37611739bbddd2e9a59d3220c0a`, six domain digests, four-decimal numeric normalization, and explicit exclusions for host wall-clock timing and NullEngine frame timing.

The dedicated regression independently proves the negative cases required by the experiment: a renderer/loading mutation changes exactly `rendererState` and `assetLoadReadiness` and is accepted only when those domains are declared; an injected simulation `playerHp` mutation changes `simulation`, remains unexplained when only presentation/load domains are declared, and throws in enforcement mode. A meaningful normalized performance-band change also changes that domain digest, while sub-precision jitter does not.

Advisory evidence artifact `11627403694` (`behavioral-genome-shadow-350-f0e1d1a97ed8a37611739bbddd2e9a59d3220c0a`) is SHA-256 bound by GitHub Actions as `61288b65d10b32d6a701ff1279bd9928f49aa2efc577fcf16505f89e413b8cd2`. The exact implementation candidate also passed full repository verification/production build, desktop and mobile-landscape browser E2E, APK construction and delivery validation, API 35 product smoke, API 36 large-screen smoke, the aggregate Android gate, and final PR Candidate Verification. APK artifact `11627732377` has Actions digest `ae7ce768e833535afe94d2bf9ad6df00b1eef4dc45d2cad60720c8ec3c690488`; final candidate evidence artifact `11628595433` has digest `5bbd4978897585c4e8aecf6ba709829fbcb45759a4cf3e1af9c17cd35037fd0e`.

### Isolation and rollback

EV-3 remains advisory. Its repository write effects are limited to ephemeral CI workspaces and Actions artifacts; the observer reads or instantiates deterministic runtime contracts but does not mutate repository state or user data. The fail-closed comparator is used to validate the experiment itself, not to waive any existing proof obligation or to grant normal candidate acceptance.

Rollback is to remove the EV-3 regression/capture/upload steps from PR Candidate Verification and remove `agent/tools/behavioral-genome.mjs`, `agent/tests/behavioral-genome.mjs`, and `tests/behavioral-genome-observer.ts`. Existing full verification, web-bundle identity, browser journeys, Android/API 35/API 36 verification, APK generation, and exact-candidate evidence remain unchanged.

### Promotion status

Not promoted. EV-3 remains advisory and has only established deterministic same-candidate repeatability plus controlled mutation behavior; it has not yet accumulated cross-candidate false-positive/false-negative evidence sufficient for normal blocking enforcement. AO-6 and the experimental promotion rule remain prerequisites before any Behavioral Genome comparison can become a default repository gate. The next experimental queue item is EV-4.
