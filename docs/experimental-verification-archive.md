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

## EV-4 — Repository Immune System

Completed 2026-10-09 in advisory/shadow mode.

### Implemented

- Added `agent/failure-memory.schema.json` and `agent/failure-memory.json` to retain recurring verification failures as compact structured classes with failure signature, root cause, affected domain, escape stages, discovering proofs, fix class, earlier missed proof, historical/synthetic provenance, and a bounded representative sample.
- Added `agent/tools/repository-immune-system.mjs` to deterministically cluster raw failure records, reject incompatible records instead of over-clustering, enforce both per-class sample bounds and a serialized-memory byte budget, and generate concrete reusable antibody proposals only after a class repeats.
- Antibody proposals name one of four reusable check kinds—architecture invariant, impact-map rule, focused regression, or telemetry check—and carry an actionable target/required/forbidden source contract. Proposals remain advisory until an explicit reviewer, timestamp, decision, and rationale accepts them; proposed antibodies cannot enforce and no antibody can grant candidate acceptance.
- Added regressions proving deterministic clustering regardless of input order, explicit-review gating, fail-closed recurrence detection for accepted antibodies, an executable accepted-check contract, unrelated-class isolation, incompatible-class rejection, and compaction of 100 repeated occurrences to three retained samples under a configured byte budget.
- Seeded repository memory with the two historical EV-2 API 36 screenshot-transport timeouts. The repeated class proposes `android-screenshot-capture-contract`, which requires the existing portrait/resized `adb exec-out screencap -p` evidence paths and rejects reintroduction of `Page.captureScreenshot`. The regression explicitly accepts this proposal only inside the test fixture, validates the current hardened source, and proves a deliberately regressed source fails.
- Agent Orchestration now runs the EV-4 regression, binds the repository immune-system report to the exact candidate SHA, and uploads the report as advisory evidence. `AGENTS.md` records that EV-4 proposals require explicit review before enforcement and may never waive, replace, or synthesize an existing exact-SHA proof gate.

### Evidence

Implementation candidate `df9ae394156c23715ef01c2edfc03e15edf632c0` passed Agent Orchestration run `37959065258` and PR Candidate Verification run `37959065836` before this archive closeout.

The EV-4 regression proved two deterministic synthetic classes cluster identically regardless of input order, only the repeated class generates a proposal, an unreviewed proposal cannot enforce, a reviewed antibody rejects a matching recurrence, and 100 repeated failures compact to three samples while preserving the total occurrence count. It also proved the actionable historical screenshot antibody passes against the current hardened `scripts/android-large-screen-smoke.sh` and fails when `Page.captureScreenshot` is deliberately reintroduced.

Advisory evidence artifact `11629801726` (`repository-immune-system-351-df9ae394156c23715ef01c2edfc03e15edf632c0`) is bound to the exact implementation candidate and has GitHub Actions digest `sha256:caf6866997ff57754550a64d445bc34685b49ef028e47be76219e84978270f2f`. The report records one failure class, two historical occurrences, one recurring class, one antibody proposal, two retained samples, `compactBytes=2469` against `maxSerializedBytes=16384`, `acceptedForEnforcement=false`, and `candidatePassGranted=false`; its compact memory digest is `d6f151d1bb399943b959d2ff03f63c69ac1f78414d68ff353de685130aea2254`.

The exact implementation candidate also passed the full repository verification/production build, APK construction/integrity, API 35 product smoke, API 36 large-screen smoke, the aggregate Android gate, and final PR Candidate Verification. Browser E2E was correctly skipped by the repository scope detector because EV-4 changed only verification/governance surfaces. APK artifact `11629898181` is bound to the candidate with Actions digest `sha256:ac09f4fe704ad5cf9133646a29f93cb199e331e6bd2151b6c213f9e368a9df69`. Final candidate evidence artifact `11630093454` has digest `sha256:2b91798489a2b5ea11abd0801098f8a2a0f430c711b73887b0a6ac74ace920b3`.

Two intermediate Agent Orchestration attempts failed closed on EV-4's own contract mismatches: the first exposed missing historical/synthetic provenance in regression records, and the second exposed a repository memory that had not yet adopted the new byte-budget/actionable-check shape. Both were corrected on the same branch without weakening the acceptance goal; the final exact implementation candidate passed the strengthened contract.

### Isolation and rollback

EV-4 does not alter product/runtime behavior and does not automatically edit repository policy. Agent Orchestration runs read-only against repository contents, writes only an ephemeral exact-SHA report into the Actions workspace, and uploads advisory evidence. Explicit review acceptance exists as a tool/test contract only; repository CI does not persist accepted antibodies or turn proposals into blocking gates.

Rollback is to remove the EV-4 regression/report/upload steps from `.github/workflows/agent-orchestration.yml`, remove `agent/failure-memory.json`, `agent/failure-memory.schema.json`, `agent/tests/repository-immune-system.mjs`, and `agent/tools/repository-immune-system.mjs`, and remove the EV-4 advisory rule/source entries from `AGENTS.md`. Existing full verification, exact-SHA candidate evidence, browser/Android validation, APK generation, and the underlying Android screenshot hardening remain intact.

### Promotion status

Not promoted. EV-4 remains advisory/shadow-only; no antibody is persisted as enforced repository policy. AO-6 independent-verifier/mechanical-invariant foundations and the experimental promotion rule remain prerequisites before an immune-system proposal may become a default gate. The next experimental queue item is EV-5.

## EV-5 — Self-Calibrating Impact Map

Completed 2026-10-09 in advisory/shadow mode.

### Implemented

- Added `agent/impact-calibration.schema.json` and `agent/impact-calibration.json` for bounded trusted calibration history, a minimum trusted-failure sample size, and an explicit confidence threshold. Candidate observations remain untrusted by default so a successful PR cannot self-certify the model that selected its checks.
- Added `agent/tools/impact-map-calibration.mjs` to compare the existing `agent/impact-map.json` affected-verification prediction with the authoritative full-verification result, map failing npm scripts back to verification IDs/domains, group changed paths into deterministic path families, measure false-negative rate/confidence, and build conservative expansion proposals.
- Expansion proposals are widen-only high-risk `verify-full` rules. They never edit `agent/impact-map.json` automatically, cannot narrow verification, and remain `acceptedForEnforcement=false` until a future reviewed promotion.
- Added fail-closed selection behavior: once enough trusted failure observations exist, calibration confidence below the configured `0.8` threshold can only escalate the existing selection to `verify:full`; healthy calibration preserves the current selection and never removes checks.
- Added deterministic regression coverage for a synthetic graphics miss, repeated misses converging on the same proposal, low-confidence full-verification fallback, healthy-confidence no-narrowing behavior, exact-SHA candidate shadow reports, and root-level path-family normalization such as `agent/impact-calibration.json -> agent/**`.
- Integrated EV-5 into the existing PR candidate producer without adding a second full build. The one authoritative `npm run build` is observed through `tee` under `set -o pipefail`, preserving the producer's failure status while making its log available to the calibration observer. The advisory observe/upload steps run after that producer and cannot waive browser, Android, APK, ledger, or full-build gates.
- Updated the existing single-producer CI regression and `AGENTS.md` so EV-5 is mechanically constrained to advisory, preserve-or-widen behavior.

### Evidence

Implementation candidate `c0527f25dea2d69dc8d7b7ab2ac5b54a61840fad` passed Agent Orchestration run `37964161844` and PR Candidate Verification run `37964162313` before this archive closeout.

The affected-verification regression reported `IMPACT_MAP_CALIBRATION_TEST_PASS syntheticMiss=proposal repeatedMiss=deterministic confidence=0.333 failClosed=full noNarrowing=pass candidateShadow=advisory rootFamily=pass`. The single-producer contract simultaneously reported `CI_PROOF_REUSE_TEST_PASS prFullBuilds=1 fullBuildLogging=pipefail`, proving EV-5 observes the authoritative producer rather than creating a parallel full-verification path.

Advisory evidence artifact `11631939442` (`impact-map-calibration-352-c0527f25dea2d69dc8d7b7ab2ac5b54a61840fad`) is bound to the exact implementation candidate with GitHub Actions digest `sha256:a37aea8266a63c229f8ccd329d1f0b759ba77ba4adec0682998f58b6d736ee4b`. Its real candidate report predicted `mode="full"` for the verification/CI/governance changes, observed a successful authoritative full verification, recorded `falseNegativeCount=0`, `falseNegativeRate=0`, no expansion proposals, `acceptedForEnforcement=false`, and `candidatePassGranted=false`.

The exact implementation candidate also passed the full repository verification/production build, desktop and mobile-landscape browser E2E, APK construction/integrity, API 35 product smoke, API 36 large-screen smoke, the aggregate Android gate, and final PR Candidate Verification. APK artifact `11632459297` is bound to the same candidate with Actions digest `sha256:37439af96120b45930b1880d31fe420830f78fc1143960b7e1c338d369322d6d`. Final candidate evidence artifact `11633148276` has digest `sha256:ee530ceff430ee19be772523e524f7e2e6ddaab4d17ed0e75aefcead21c13035`.

Verification also exposed an orchestration race while the PR head was moving: a retry of the superseded `06c9826b9f3385a013c81822d60f5c90628acb5c` run started while API 36 for `c0527f25dea2d69dc8d7b7ab2ac5b54a61840fad` was active. The reusable Android workflow's PR-scoped `cancel-in-progress` policy correctly cancelled the competing newer API 36 job after its smoke/evidence steps had succeeded. After the stale retry fully drained, rerunning only the failed current-head jobs on the unchanged exact candidate passed API 36, Android aggregation, and the final ledger. No verification rule was weakened and no workflow change was required.

### Isolation and rollback

EV-5 does not alter product/runtime behavior and has no automatic write path into `agent/impact-map.json`. Candidate observations and calibration reports are written only to ephemeral CI workspace state and uploaded as advisory artifacts. The configuration starts with no trusted observations, so the experiment cannot manufacture confidence from the candidate currently under test.

Rollback is to remove the EV-5 observe/upload steps and full-build log tee from `.github/workflows/pr-candidate.yml`, restore the single-producer regression to the previous direct build shape, remove the EV-5 import from `agent/tests/affected-verification.mjs`, remove `agent/tests/impact-map-calibration.mjs`, `agent/tools/impact-map-calibration.mjs`, `agent/impact-calibration.json`, and `agent/impact-calibration.schema.json`, and remove the EV-5 source/rule entries from `AGENTS.md`. Existing affected-verification selection and all full candidate/browser/Android/APK/ledger gates remain intact.

### Promotion status

Not promoted. EV-5 remains advisory/shadow-only and cannot edit or narrow the impact map. AO-6 independent-verifier/mechanical-invariant foundations and the experimental promotion rule remain prerequisites before calibration can become a default blocking or self-updating mechanism. The next experimental queue item is EV-6.
