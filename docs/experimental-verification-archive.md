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

- Added `agent/behavioral-genome.config.json` and `agent/tools/behavioral-genome.mjs` to create canonical SHA-256 behavior fingerprints for six required domains: simulation, mission progression, presentation, load readiness, resource ownership, and performance.
- Genome creation is bound to a full exact candidate SHA while semantic domain/root digests intentionally exclude the candidate SHA so behavior can be compared across revisions. Every report remains advisory with `acceptedForEnforcement: false` and `candidatePassGranted: false`.
- Added explicit per-path normalization and exclusion rules. Floating simulation/render/performance observations are rounded or bucketed as configured; volatile measured load duration is preserved in raw observations but excluded from semantic comparison.
- Added deterministic regression coverage proving noisy repeat observations preserve the same semantic genome, a declared renderer/loading mutation changes only the `presentation` and `load` branches, and an injected simulation mutation creates an unexplained `simulation` delta that fail-closed comparison rejects.
- Added `tests/behavioral-genome-route.ts`, a representative real route that reuses the existing simulation, campaign/director, adaptive render budget, graphics-asset selection, Babylon `NullEngine`, real GLB loading/cache, and resource-release contracts instead of maintaining a parallel fake runtime.
- Added `scripts/run-behavioral-genome-shadow.mjs` and integrated it into the existing PR candidate producer after the full repository build. It captures the same real route twice on the exact PR head, generates both genomes, compares them with no declared changes, and uploads advisory evidence. The step is `continue-on-error` and cannot grant, waive, replace, or synthesize any existing candidate/browser/Android/APK gate.

### Evidence

Implementation candidate `a05d1b5c7856c28b8017104a6973f0ef5c4a8043` passed Agent Orchestration run `37952118288` and PR Candidate Verification run `37952118863` before this archive closeout.

The EV-3 semantic regressions reported `repeat=stable`, `declared=presentation+load`, `unexplained-simulation=rejected`, `noise=excluded+normalized`, `exact-sha=bound`, and `mode=advisory`. The intentional presentation/load mutation changed exactly those two domain digests; adding the simulation HP mutation produced `unexplainedDomains=["simulation"]` and the enforcement helper rejected it.

Advisory evidence artifact `11626915465` (`behavioral-genome-shadow-349-a05d1b5c7856c28b8017104a6973f0ef5c4a8043`) is bound to that candidate with GitHub Actions digest `fa220701e0460759de6ee572a40fd0fd636a1c73d867719c9451527fa5c85f20`. Its two real-route raw captures differed only in `domains.load.loadDurationMs` (`29.86488` versus `31.074582000000007` milliseconds). After configured noise handling, both produced the identical semantic root digest `d0b8e3b370dcd2892b29fb19c597c3ab166d2f9e5f73798e88a22133499e0e40`; the repeat comparison reported `changedDomains=[]`, `unexplainedDomains=[]`, `status="pass"`, `acceptedForEnforcement=false`, and `candidatePassGranted=false`.

The exact implementation candidate also passed the full repository verification/production build, mobile-landscape browser E2E, APK construction/integrity, API 35 product smoke, API 36 large-screen smoke, the aggregate Android gate, and final PR Candidate Verification. The first desktop browser attempt reached the loaded class-selection flow but timed out in the existing CDP `Page.captureScreenshot` evidence call; a targeted retry of that failed job on the unchanged exact candidate passed the entire desktop journey, confirming no implementation change was needed. APK artifact `11626452332` is bound to the candidate with Actions digest `b5f3cfa3ab44e3ec216fd493553deed950ddb0abb49e35d6284df937418ae39e`. Final candidate evidence artifact `11627561173` has digest `19d6802a75849a7593e09031793e1d432aa032e042361d0f15d2effec555765a`.

### Isolation and rollback

EV-3 does not alter product/runtime behavior. The real route runs only in verification, uses deterministic fixed-step inputs, writes observations/genomes into ephemeral CI workspace state, and uploads advisory artifacts. The existing full build, browser, Android, APK, and exact-candidate ledger remain authoritative and unchanged as acceptance gates.

Rollback is to remove the EV-3 capture/upload steps from `.github/workflows/pr-candidate.yml` and remove `agent/behavioral-genome.config.json`, `agent/tools/behavioral-genome.mjs`, `agent/tests/behavioral-genome.mjs`, `tests/behavioral-genome-route.ts`, and `scripts/run-behavioral-genome-shadow.mjs`. That restores the previous verified pipeline without changing product behavior or weakening any pre-existing proof obligation.

### Promotion status

Not promoted. EV-3 remains advisory/shadow-only. AO-6 independent-verifier/mechanical-invariant foundations plus the experimental promotion rule remain prerequisites before behavioral-genome results may become a default blocking gate. The next experimental queue item is EV-4.
