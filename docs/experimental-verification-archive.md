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

## EV-6 — Causal Proof Cache

Completed 2026-10-09 in advisory/shadow mode.

### Implemented

- Added `agent/proof-cache.schema.json`, `agent/proof-cache.json`, and bounded `agent/proof-cache-history.json` to define selected expensive proof classes, their machine-readable repository/runtime closure, and exact-SHA real-rerun observations.
- Added `agent/tools/causal-proof-cache.mjs`. Repository input closure is derived from the exact Git tree objects selected by the proof policy, not from changed-file similarity; retained history is trusted only after recomputing each observation's repository digest from its immutable candidate SHA. Runtime closure binds the configured runner label, Node/npm versions, platform/architecture, and hashed presence/value of selected environment inputs.
- The full-repository build proof uses an `all-tracked-except` closure whose exclusions are limited to repository surfaces that do not feed the existing web build/full verification. Changes to causal source/package inputs invalidate the repository digest, while proof-cache/governance history changes intentionally leave it stable.
- Prediction is shadow-only. The PR candidate workflow predicts before the authoritative full build, always runs that build exactly once, then compares the prediction with the real outcome and uploads exact-SHA advisory evidence. Reports hard-code `acceptedForReuse=false`, `candidatePassGranted=false`, and `proofActuallyRerun=true`.
- If observations with the same closure digest ever disagree, reuse is automatically disabled for that proof class. A prediction that expected success but observes a failing real rerun also disables reuse immediately.
- Added adversarial regressions covering stable excluded changes, causal repository invalidation, runtime/toolchain invalidation, same-closure disagreement, real-rerun disagreement, tampered exact-SHA history, and the explicit absence of changed-file similarity from the reuse decision. Agent Orchestration validates both these regressions and every retained history observation against Git.
- Updated the existing single-producer CI contract and `AGENTS.md` so EV-6 cannot skip, replace, or synthesize the authoritative proof while the experiment is unpromoted.

### Evidence

Baseline candidate `2903be4a83c37cd62c806ea76aa8d656e0d6be14` passed Agent Orchestration run `37969801666` and the authoritative full repository build in PR Candidate Verification run `37969802133`. Advisory artifact `11635501301` (`causal-proof-cache-353-2903be4a83c37cd62c806ea76aa8d656e0d6be14`) has GitHub Actions digest `sha256:e7fa8865dd9e95ab5d76763d06f453167ad21a030a6beecfa6702b8a6db6de18`. With no prior history, the report correctly made no reuse claim and recorded the successful real rerun as the first exact-SHA observation.

The retained baseline had repository digest `35cb57a92c3fe622cb733c7ae3a977e72b3c538711aecb58a72378e8c2ccb0eb`, execution-context digest `4370aa6f3440d92311cfa6aab6c315bc307228dc218761b47e3a8df67c66f52f`, and combined causal-closure digest `24aa90a8838be2ce6a5601605cc0a34cb5055b80e1d88c54d24bbb4f269c078d`.

Second candidate `01eabd2499573b9e663cf230c226c9a74ee6a3aa` changed only excluded proof-cache history. Agent Orchestration run `37970844546` passed the EV-6 regression/history validation and the wider orchestration contract. PR Candidate Verification run `37970844983` independently recomputed the identical repository, runtime, and combined closure digests before the proof ran; it therefore predicted `reuseWouldBeSafe=true` and `expectedOutcome="success"`. The authoritative full build then actually reran and succeeded, producing `comparison.agreement=true`, `disagreement=false`, and `reuseState.disabled=false`. Advisory artifact `11636720127` is bound to that exact SHA with Actions digest `sha256:3107ff90e13b7a34c98e5ade23d48ec6bec01ee83ffe222b3a970aa9e1ab3045`.

The EV-6 regression reports `CAUSAL_PROOF_CACHE_TEST_PASS stableExcluded=pass causalInvalidation=pass runtimeInvalidation=pass realRerunAgreement=pass disagreementDisables=pass historyExactSha=pass changedFileSimilarity=unused mode=shadow`. The single-producer regression simultaneously requires the reuse prediction to precede the real proof, the comparison to follow it, and exactly one authoritative `npm run build` producer to remain. The closeout candidate retains both successful observations so its exact-candidate run provides another prediction-versus-rerun sample before merge.

### Isolation and rollback

EV-6 does not alter product/runtime behavior and cannot currently reuse a cached proof. The workflow only writes prediction/report files into ephemeral CI workspace state and uploads advisory artifacts; all existing full-build, browser, Android, APK, and ledger gates remain authoritative. Stored environment values are represented by SHA-256 fingerprints rather than plaintext values.

Rollback is to remove the EV-6 prediction/comparison/upload steps from `.github/workflows/pr-candidate.yml`, remove the EV-6 regression/history-validation steps from `.github/workflows/agent-orchestration.yml`, restore the prior EV-5-only assertions in `agent/tests/ci-proof-reuse.mjs`, and remove `agent/proof-cache.json`, `agent/proof-cache-history.json`, `agent/proof-cache.schema.json`, `agent/tests/causal-proof-cache.mjs`, `agent/tools/causal-proof-cache.mjs`, and the EV-6 source/rule entries from `AGENTS.md`. The previous verified pipeline then runs unchanged, with the authoritative full proof still executed exactly once.

### Promotion status

Not promoted. EV-6 remains advisory/shadow-only; no proof is skipped and no cached result is accepted. AO-6 independent-verifier/mechanical-invariant foundations plus the roadmap promotion rule remain prerequisites before causal proof reuse can become a default optimization. The next experimental queue item is EV-7.

## EV-7 — Roadmap Shadow Simulator

Completed 2026-10-09 in advisory/shadow mode.

### Implemented

- Added `agent/roadmap-shadow-simulator.schema.json`, `agent/roadmap-shadow-simulator.json`, and `agent/tools/roadmap-shadow-simulator.mjs` to pressure-test current architecture against real later product-roadmap items while reusing the existing roadmap adapter rather than duplicating roadmap parsing or task order.
- Configured two representative later tasks: `P28-PLOAD2` probes the shared mission-visual-readiness boundary, while `P28-G1` probes the orbital-station presentation lifecycle and renderer ownership boundary.
- The simulator reports touched surfaces, required boundary violations, missing extension points, rewrite pressure, probe-compilation status, and a deterministic future-friction score. Clean extension points remain low-friction; missing shared contracts, forbidden renderer back-dependencies, broad rewrite pressure, and failed probe compilation all increase the score.
- Temporary TypeScript probes are synthesized only under the operating system temp directory, type-checked against the current candidate with the repository TypeScript toolchain, deleted afterward, and guarded by before/after Git HEAD plus working-tree fingerprints. Probe source never reaches the implementation branch.
- Added regressions that deliberately hide the shared readiness contract, inject a forbidden renderer back-dependency, broaden the required surface set, and simulate a compile failure. Each mutation raises advisory friction without mutating product code.
- Integrated the regressions into Agent Orchestration and exact-SHA compiled probe capture into the existing PR Candidate producer. Reports hard-code `validatedAgainstRealLaterWork=false`, `acceptedForEnforcement=false`, `candidatePassGranted=false`, and `blocking=false`; `--enforce` is rejected until a future validated promotion.

### Evidence

Implementation candidate `6bf7adb411cfa9ad6e00e0627d97d06b10a9d512` passed Agent Orchestration run `37977243358` and PR Candidate Verification run `37977244710` before this archive closeout.

The EV-7 regressions proved the clean readiness and orbital-presentation scenarios each score `1`; removing the shared readiness extension point raises that scenario to `8`; injecting the forbidden renderer back-dependency raises the orbital scenario to `10`; and expanding the orbital task across three additional core surfaces raises rewrite pressure to `high` with score `13`. These mutations are in-memory test fixtures only and never alter the candidate branch.

Advisory evidence artifact `11639107889` (`roadmap-shadow-simulator-354-6bf7adb411cfa9ad6e00e0627d97d06b10a9d512`) is bound to the exact implementation candidate with GitHub Actions digest `sha256:6d6c2c1a5be95038315a783c4cef9f2e7178ed0e7b97e1fd1a2540c817a7e0cd`. Its exact-SHA report compiled both disposable probes successfully, recorded `missingExtensionPointCount=0`, `requiredBoundaryViolationCount=0`, `failedProbeCount=0`, `maximumFrictionScore=1`, and confirmed `outsideRepository=true`, `persisted=false`, and `repositoryUnchanged=true` for both probes. The report remained `validatedAgainstRealLaterWork=false`, `acceptedForEnforcement=false`, `candidatePassGranted=false`, and `blocking=false`.

The exact implementation candidate also passed the authoritative full repository verification/production build, desktop and mobile-landscape browser E2E, APK construction/integrity and delivery checks, API 35 product smoke, API 36 large-screen smoke, the aggregate Android gate, and final PR Candidate Verification. APK artifact `11638664615` is bound to the same candidate with Actions digest `sha256:fa3dcb5a390f123b0240063e3f6e2ce0a9afc4d517c3180e51dc9fcebe56b560`. Final candidate evidence artifact `11639564046` has digest `sha256:b8d008cb02fd450b2f06ae81136829535fea785f49687e959f3b58e3bacc6166`.

### Isolation and rollback

EV-7 does not implement either future product task and does not alter runtime behavior. The only synthesized integration files live in disposable OS temp storage during verification; the tool removes them in a `finally` path and rejects any repository-state change. The committed configuration contains only task IDs, expected surfaces, boundary contracts, and probe source templates. Candidate acceptance continues to depend exclusively on the pre-existing full-build, browser, Android, APK, and exact-SHA evidence gates.

Rollback is to remove the EV-7 capture/upload steps from `.github/workflows/pr-candidate.yml`, remove the EV-7 regression step from `.github/workflows/agent-orchestration.yml`, remove `agent/roadmap-shadow-simulator.json`, `agent/roadmap-shadow-simulator.schema.json`, `agent/tests/roadmap-shadow-simulator.mjs`, and `agent/tools/roadmap-shadow-simulator.mjs`, and remove the EV-7 source/rule entries from `AGENTS.md`. The previous verified pipeline then runs unchanged.

### Promotion status

Not promoted. EV-7 remains advisory because its predictions have not yet been compared with the actual later implementation work. AO-6 remains a prerequisite for default-enforced experimental behavior, and no Roadmap Shadow Simulator score can currently block a candidate. No additional EV item is queued.

## EV-8 — Promote EV-1 Acceptance Attack Compiler

Completed 2026-10-11 as a narrow enforced promotion of the EV-1 mechanism. The original EV-1 archive record above remains unchanged prototype history.

### Implemented

- Added `agent/acceptance-attack-policy.json` and `agent/tools/acceptance-attack-gate.mjs` to make one measured EV-1 mutation family a normal fail-closed exact-candidate gate.
- Promoted only `hidden-serialization`. The remaining EV-1 templates—`false-readiness`, `fake-telemetry`, `skipped-quality-work`, `special-cased-test-route`, and `omitted-resource-work`—remain advisory and cannot block or synthesize a candidate pass.
- Added `agent/tools/acceptance-attack-runtime-calibration.mjs` so promotion evidence exercises the real `src/game/babylonCombatRenderer.ts` P28-PLOAD1 path in disposable detached clones and runs the dedicated 73-placement runtime verifier rather than a parallel synthetic runtime.
- The calibration measures a behavior-preserving negative control (`4 -> 2 + 2`) and the dishonest serialization mutation (`4 -> 1`). A dishonest trial counts as detected only when the verifier fails and its output matches the expected batching-criterion failure, so an unrelated nonzero verifier exit is not credited as a catch.
- Added promotion regressions for the real runtime baseline/control/attack, an unrelated verifier crash, surviving promoted attacks, rejected benign controls, invalid policy, source immutability, detached remotes, dependency-write isolation, dependency symlink escape rejection, ignored-workspace isolation, and deterministic rollback.
- Wired the gate into Agent Orchestration and the authoritative PR candidate producer without replacing the full repository build, browser E2E, Android/APK validation, exact-SHA evidence, or independent review.
- Documented the permanent rule in `AGENTS.md`: the promoted gate may only block, never waive or synthesize proof, and `IRONSHADE_ACCEPTANCE_ATTACK_ENFORCEMENT=0` must restore advisory-only behavior while retaining evidence.

### Evidence

The first promotion candidate `89b6122bf585e678bc8e131f05bae8aa974df818` passed its technical gates but trusted review run `38161904280` correctly rejected it because it still calibrated against a synthetic four-placement fixture and hard-coded the false-positive result. Those findings were fixed on the same branch without weakening the promotion criterion.

Corrected implementation candidate `f916982260c88b104def36a3ab7edc68bd86ab4e` passed Agent Orchestration run `38163152438` and every technically available gate in PR Candidate Verification run `38163152650`: the authoritative full repository verification/production build, desktop and mobile-landscape browser E2E, APK construction/integrity and delivery checks, API 35 product smoke, API 36 large-screen smoke, and the aggregate Android gate all succeeded. The final candidate job then failed only at the expected missing-review step before trusted review was requested.

Exact-SHA promotion artifact `11710828125` (`acceptance-attack-gate-367-f916982260c88b104def36a3ab7edc68bd86ab4e`) has GitHub Actions digest `sha256:1ebb40099050272970a0a0467f366686a4b18bafebfad55c7d8d0d3d890cc522`. Its gate report digest is `7ad624b852efceb0223826088e0a8f8d6585d7a41bc581b095920ae2f73528ff`, runtime report digest is `1cb618519732f112b443d8d2b29c37ad2e719ad3775b3b20c65b290de88ae62f`, and policy digest is `0d37776a61e433a944e4659acf22d4c36ef4d1b30cb52d74aa189ae0aedb9ec8`.

The real-runtime calibration recorded one benign control with zero false positives (`1` trial, `0` false positives, rate `0`) and one dishonest promoted trial with zero false negatives (`1` trial, `0` false negatives, rate `0`). The dishonest `4 -> 1` mutation was detected for the required runtime batching failure, while the shadow compiler continued to report the other five attacks as advisory survivors. Both the shadow compiler and runtime calibration reported source state unchanged and detached sandbox remotes.

APK artifact `11710529038` is bound to `f916982260c88b104def36a3ab7edc68bd86ab4e` with GitHub Actions digest `sha256:022b37d48d0c675bfcd4fd52d0e0f217fd3ae52836c0fb0d9cb31fef4d6ed839`.

Trusted implementation review run `38163977255` (PR comment `6112312995`) independently marked the runtime calibration, enforced scope, rollback, technical CI, APK/Android proof, and architecture invariants satisfied. It returned `fail` solely because this EV-8 archive entry did not yet exist; that fail-closed result triggered this closeout transition rather than being waived. A later exact-SHA review found that inherited source-workspace environment paths could still expose ignored source files; the closeout hardening now redirects verifier workspace/path bindings into disposable state and fault-tests that ignored-source path explicitly. The exact closeout candidate must still pass a fresh trusted EV-8 review before merge.

### Isolation and rollback

Both compiler attacks and runtime calibration execute only in disposable clones created without local hard links, at the exact source revision, with their repository remote removed before mutation. Runtime calibration materializes a fresh isolated dependency copy for every trial, rejects dependency symlinks that escape disposable state, and runs verifier subprocesses with workspace/path bindings redirected into the clone rather than the source checkout. Regression faults prove writes through cloned dependencies and an ignored `GITHUB_WORKSPACE` path do not mutate source state; tracked source HEAD/ref/status fingerprints are also checked unchanged before disposable state is removed.

Rollback is deterministic: set `IRONSHADE_ACCEPTANCE_ATTACK_ENFORCEMENT=0` to retain the same shadow/runtime evidence while making the gate non-blocking. Removing the EV-8 policy/gate/runtime-calibration wiring entirely restores the pre-promotion pipeline; the original full build, browser, Android/APK, exact-SHA, and trusted-review gates remain authoritative throughout.

### Promotion status

Promoted only for `hidden-serialization` on the measured real P28-PLOAD1 runtime batching pattern. The five unsupported EV-1 attack templates remain experimental/advisory. The next experimental promotion item is EV-9.

## EV-9 — Promote EV-2 Causal Evidence Independence

Completed 2026-10-11 as a narrow enforced promotion of the EV-2 mechanism. The original EV-2 archive record above remains unchanged advisory prototype history.

### Implemented

- Added `agent/evidence-independence-policy.json`, the EV-2 classifier gate, `agent/tools/pr-candidate-head-observer.mjs`, and `agent/tools/evidence-independence-promotion-gate.mjs` to promote a reviewed subset of the EV-2 graph into a fail-closed exact-candidate obligation backed by direct semantic observation.
- Promoted only `candidate-workflows-use-exact-pr-head`. Its graph path must classify `independent`, and the policy-pinned semantic observer must structurally parse `.github/workflows/pr-candidate.yml` itself: authoritative producer checkout, exact candidate identity/runtime assertion, review/browser/Android SHA propagation, final evidence checkout, and rejection of synthetic merge/event SHA identity. Comments do not count as workflow evidence, and the producer/final jobs must each have exactly one checkout so a later checkout cannot override an earlier valid one.
- Explicitly excluded `candidate-evidence-rejects-cross-sha-proof` from enforcement because its current material observation executes `agent/tools/candidate-evidence.mjs` itself; EV-2 correctly classifies that path as circular, so the criterion remains advisory until a materially independent observer is added and reviewed.
- Policy validation requires every important graph criterion to be either enforced or explicitly excluded with rationale. Unknown criteria, duplicate/overlapping scope, uncovered important criteria, malformed shared-infrastructure claims, exact-SHA mismatch, semantic-observer target redirection, classifier instability, or calibration outside the zero-error budgets fail closed.
- Added representative independent, circular, unsupported/supporting-only, and independent-with-shared-infrastructure classifier cases. Each is analyzed twice and must remain stable. The structural semantic observer separately calibrates three behavior-preserving controls and five dishonest exact-head mutations, including comment-spoofed refs, a later overriding checkout, and a commented-out runtime identity assertion. Both classifier and semantic-observer budgets are zero false positives and zero false negatives.
- Added regressions proving the real repository exact-head criterion and structural observer pass, circular and unsupported variants block, dishonest exact-head mutations block even when graph labels still say independent, benign observer controls remain accepted, observer target redirection/uncovered/unknown criteria fail closed, malformed dependency claims fail validation, exact-SHA evidence cannot be rebound, and rollback preserves both analyses/calibrations while removing only the EV-9 blocking decision.
- After trusted review identified that a standalone workflow could be bypassed by the repository's authoritative candidate path, the standalone workflow was removed. After a later trusted review identified that the graph-labelled observer only observed Agent Orchestration's own checkout rather than the PR Candidate workflow property, EV-9 added the direct semantic observer and wrapper gate. After a further review demonstrated that ordered substring checks could be spoofed by comments or later checkout steps, the observer was upgraded to structural job/step parsing and the bypasses became required dishonest calibration trials. `agent/tools/evidence-independence-promotion-gate.mjs` runs inside both Agent Orchestration and the authoritative `candidate-build` in `.github/workflows/pr-candidate.yml`.
- Documented the permanent policy in `AGENTS.md`: EV-9 may only block/report; it cannot grant, waive, replace, or synthesize existing build, browser, Android/APK, exact-SHA evidence, or independent-review proof.

### Evidence

Implementation candidate `b30b7b59155a1bf8d3bae7717947861ffcf4da6a` passed Agent Orchestration run `38174481204` and every technically available runtime/build gate in PR Candidate Verification run `38174481802`: the authoritative full repository verification/production build, APK construction/integrity and delivery checks, API 35 product smoke, API 36 large-screen smoke, and aggregate Android verification all succeeded. Browser E2E was correctly skipped because that implementation candidate changed only verification/governance surfaces. The final candidate job failed only at the expected missing-review gate before trusted review evidence existed.

The initial exact-SHA promotion run `38174481297` produced artifact `11715550669` (`evidence-independence-gate-368-b30b7b59155a1bf8d3bae7717947861ffcf4da6a`) with GitHub Actions digest `sha256:0021b4d716214c233b245c588c87f7456e8282d6841eca5501c19ef281eae376`. Its gate report digest is `0a45dbe6bf225e7f37a33c327dd141c9d129518b969038065b394cfb7b785f2f`, policy digest is `e57aa69bafe2b80e5abd40840e1d74d16b5c95988c522c8686bed92a6970accf`, and graph digest is `04e2a5ee591ee4450bb0cbc1d4e778eadcfd1895a5bed928b11ca4d9755efcbd`. That standalone run is retained as development/calibration evidence only; trusted review correctly rejected it as insufficient proof that the candidate acceptance path itself required EV-9, which is why the closeout moves the same gate into the authoritative producers.

Calibration on `b30b7b59155a1bf8d3bae7717947861ffcf4da6a` recorded four stable cases over two runs each, zero classification/stability mismatches, zero false positives across two negative trials (`0/2`, rate `0`), and zero false negatives across two positive trials (`0/2`, rate `0`). The real promoted criterion classified `independent`; the explicitly excluded cross-SHA criterion remained `circular`. The decision recorded `existingExactShaEvidenceRemainsAuthoritative=true`, `proofSynthesisAllowed=false`, and `candidatePassGranted=false`.

APK artifact `11715397213` is bound to the same implementation candidate with GitHub Actions digest `sha256:3f6033c36af375945c5b4530ccc754eabefd1f14c3c697be55bacfa98e76328f`.

Trusted implementation review run `38175248179` (PR comment `6113802218`) independently marked the narrow scope, representative zero-error calibration, rollback semantics, full build, candidate CI, Android/APK proof, architecture invariants, and independent-review proof credible. It returned `fail` for two fail-closed closeout findings: the then-standalone EV-9 workflow was not authoritative for candidate acceptance, and EV-9 had not yet been archived. This closeout resolves both findings by integrating the gate into Agent Orchestration plus `candidate-build`, removing the standalone workflow, recording this archive entry, and removing EV-9 from the active roadmap.

Corrected closeout candidate `5829f4e12cca12155d50ebfff6cfd95b73f81f6c` passed Agent Orchestration run `38175712611` and all technically available exact-candidate gates in PR Candidate Verification run `38175712713`: the authoritative full repository verification/production build, both desktop and mobile-landscape browser journeys, APK construction/integrity and delivery checks, API 35 product smoke, API 36 large-screen smoke, aggregate Android verification, mechanical architecture invariants, EV-8 enforcement, and the EV-9 policy gate all succeeded. The final candidate job failed only at the expected independent-review decision step.

Exact-SHA EV-9 artifact `11715981791` (`evidence-independence-gate-368-5829f4e12cca12155d50ebfff6cfd95b73f81f6c`) has GitHub Actions digest `sha256:d906df0a33d570105c9183db6a7df23b61645c588141d3a625fe6c2810c4536d`. The exact-SHA APK artifact `11715474850` has digest `sha256:2a8762696c3abdbf6385ebc5ed4bcdb9b6730a345ab8faf8bfe1265a39190f00`.

Trusted closeout review run `38176677177` (PR comment `6114004299`) marked acceptance criteria 0 through 3 satisfied and every required proof credible. It returned `fail` solely because the archive still named the earlier implementation candidate rather than this technically complete exact closeout candidate. That archive transition recorded `5829f4e12cca12155d50ebfff6cfd95b73f81f6c` and its exact-SHA evidence, but the resulting candidate still required a fresh review rather than inheriting that verdict.

Fresh trusted review run `38178016091` (PR comment `6114200823`) on candidate `3d605888cfc7f4558d61d441fd257001ad398cdc` accepted the scope/exclusion decision, rollback, archive state, build/candidate CI, Android/APK proof, architecture invariants, and the review mechanism itself, but correctly returned `fail` on a major semantic-independence defect: the graph declared Agent Orchestration as the observer of `candidate-workflows-use-exact-pr-head`, while that workflow only proved its own checkout and did not observe the authoritative PR Candidate workflow. The same-branch correction added `agent/tools/pr-candidate-head-observer.mjs`, pinned its target to `.github/workflows/pr-candidate.yml`, and made `agent/tools/evidence-independence-promotion-gate.mjs` combine graph classification with direct semantic observation.

Semantic-observer candidate `6a945731bb953f7cddf93f1b975722ca8385e63f` passed Agent Orchestration run `38179803899` and every technically available exact-candidate gate in PR Candidate Verification run `38179804060`: the authoritative full repository verification/production build, desktop and mobile-landscape browser E2E, APK construction/integrity and delivery checks, API 35 product smoke, API 36 large-screen smoke, aggregate Android verification, architecture invariants, EV-8 enforcement, and the EV-9 semantic promotion gate all succeeded. The final candidate job failed only at the expected missing-review step before the fresh trusted verdict existed.

Exact-SHA EV-9 artifact `11716984465` for `6a945731bb953f7cddf93f1b975722ca8385e63f` has GitHub Actions digest `sha256:9142909b86c6a1f680b827a3dd8029c58187db1234f70e662643b56fbd3b6721`. Its exact-SHA APK artifact `11717780280` has Actions digest `sha256:88f2b7a09b0db7046caadf01c034d6f62a36039f69a5289ed0cdd7a7393c30d5`.

Trusted review run `38180663773` (PR comment `6114622388`) on `6a945731bb953f7cddf93f1b975722ca8385e63f` accepted the narrow scope/exclusion decision, measured zero-error calibration results, deterministic rollback, production build, candidate CI, Android/APK proof, architecture invariants, and the trusted-review mechanism. It returned `fail` for two concrete closeout defects: the semantic observer was still implemented with ordered substring checks that could be spoofed by comments or a later checkout, and the archive had not yet recorded this exact candidate/evidence.

The same branch then upgraded the semantic observer to schema v2 with structural `jobs`/`steps` parsing, YAML-comment removal, unique checkout requirements, structural reusable-workflow input checks, and an identity assertion tied to the actual unconditional `id: identity` step. The semantic calibration now contains three benign controls and five dishonest mutations; comment-spoofed refs, a later overriding checkout, and a commented-out runtime identity assertion are explicit required attacks. Candidate `91e97bd9598a31f633aed2843b1dbfccade5f24d` passed the complete Agent Orchestration run `38181189985`, including the structural EV-9 regression and blocking promotion gate. Its exact-SHA causal-evidence artifact `11717896738` has GitHub Actions digest `sha256:65c9d2c242485d437ade70323373f509fa20bd7e67b3241094e602b1e39806c9`. The authoritative PR producer for the same SHA also passed the structural EV-9 regression and promotion gate before this archive-only transition; its superseded downstream build/runtime work is not credited as final closeout proof.

Fully hardened implementation candidate `dd8629ec561be44bdcd33a69094b3ff1091bbdb5` passed Agent Orchestration run `38204656724` and every technically available exact-candidate gate in PR Candidate Verification run `38204656820`. The isolated producer-environment preflight ran immediately after exact checkout and before Node/npm setup; the EV-9 environment-preload attack regressions and blocking promotion gate passed; the authoritative full repository verification/production build, desktop and mobile-landscape browser E2E, APK construction/integrity and delivery checks, API 35 product smoke, API 36 large-screen smoke, aggregate Android verification, and architecture invariants all succeeded. The final candidate job failed only at the expected exact-SHA independent-review decision step before a passing review existed.

Exact-SHA EV-9 artifact `11727041829` (`evidence-independence-gate-368-dd8629ec561be44bdcd33a69094b3ff1091bbdb5`) has GitHub Actions digest `sha256:cc74cbd53087fb67146eaf64948fbc3b8e7d05ac873c532484c5854c94e13e86`. The exact-SHA APK artifact `11726324763` has digest `sha256:caa6e4c979987217e1dd5f2a3b7e0626be5a7960871e3e7ae8d4453415839316`. Desktop browser artifact `11726737746` has digest `sha256:52351be2d11a8bcfe2ad6d14603dd3ea96db76b8c2231186eb2ba9eff2948cf4`; mobile-landscape browser artifact `11727196496` has digest `sha256:a60ac391e487f288e2a5b0dabf8670d303f2e83c750c5c7d079d06a1f4fd7109`; API 35 artifact `11726803679` has digest `sha256:e301047c79a4f490ac60ae65c4e94430cf40bc73f67540c39bd5d2458f9db9d7`; and API 36 large-screen artifact `11726589353` has digest `sha256:9bdb74af1bdc5cc52e8feecb2c5ca5d1c01ba5cfe3c6d46bb6f93d35539444b7`.

Trusted review run `38205473692` (PR comment `6117984729`) on `dd8629ec561be44bdcd33a69094b3ff1091bbdb5` accepted the enforced/excluded scope, zero-error calibration, fail-closed enforcement, rollback semantics, production build, candidate CI, Android/APK proof, and architecture invariants. It returned `fail` solely because this archive still named `91e97bd9598a31f633aed2843b1dbfccade5f24d` rather than the technically complete `dd8629ec561be44bdcd33a69094b3ff1091bbdb5` proof set. This archive-only transition records that immutable exact-SHA evidence and the trusted finding without treating the predecessor's verdict as a pass.

After rebasing onto the merged trusted AO-8/AO-9 observer boundary, implementation candidate `9eebecbc5bd57bdfc3398ee4822a79e182c35c02` passed EV-9 Trusted PR Candidate Observer run `38383613792`, Agent Orchestration run `38383613785`, and every technically available exact-candidate gate in PR Candidate Verification run `38383615087`. The candidate build/full verification, independent-review context, desktop and mobile-landscape browser journeys, APK construction/integrity and delivery checks, API 35 product smoke, API 36 large-screen smoke, aggregate Android verification, architecture invariants, EV-8 enforcement, and EV-9 promoted evidence-independence gate all succeeded; the final candidate job failed only at the expected exact-SHA independent-review decision step before the trusted verdict was published.

Exact-SHA EV-9 artifact `11804354144` (`evidence-independence-gate-368-9eebecbc5bd57bdfc3398ee4822a79e182c35c02`) has GitHub Actions digest `sha256:050bf68517d1712ac8b2c2c3dc5f388859f84a0ff13586069d6f6a82218da1f6`. The exact-SHA APK artifact `11805295087` has digest `sha256:b48509132b0117bfab2ba86486848a4667622e6438e630cc76b1425be7270b40`; desktop browser artifact `11805041623` has digest `sha256:40a77857db6c8d009e05bdde33d5f25d8b4d17bbefca0e3279baac8e1c110663`; mobile-landscape browser artifact `11805520490` has digest `sha256:95bcb07fd299434ad2243cd20558758f5205a81cc40f3b2f0cef932b4177b404`; API 35 artifact `11805635007` has digest `sha256:3905353348cc3ae322fdabcdd4bdeda8224b4339b48136af8d9fc82e480e42d6`; and API 36 large-screen artifact `11804784550` has digest `sha256:569ef18b55ad4da7447c38156a7606b2d6531652a93384185846a753fb4f9723`.

Trusted review run `38385149118` (PR comment `6143797067`) on `9eebecbc5bd57bdfc3398ee4822a79e182c35c02` marked acceptance criteria 0 through 3 satisfied and every required proof credible. It returned `fail` solely because the archive did not yet record this reviewed candidate and its exact-SHA evidence. This archive-only transition records that immutable evidence without changing EV-9 implementation or workflow semantics; the resulting closeout SHA still requires its own exact-head technical proof and fresh trusted EV-9 review.

Archive-only closeout candidate `fba37a2026a83a56c04c442776f56c093968d166` passed EV-9 Trusted PR Candidate Observer run `38388533244`, Agent Orchestration run `38388533175`, and every technically available exact-candidate gate in PR Candidate Verification run `38388533553`. The candidate build/full verification, independent-review context, desktop and mobile-landscape browser journeys, APK construction/integrity and delivery checks, API 35 product smoke, API 36 large-screen smoke, aggregate Android verification, architecture invariants, EV-8 enforcement, and EV-9 promoted evidence-independence gate all succeeded; the final candidate job failed only at the expected exact-SHA independent-review decision step before the trusted verdict was published.

Exact-SHA EV-9 artifact `11807384430` (`evidence-independence-gate-368-fba37a2026a83a56c04c442776f56c093968d166`) has GitHub Actions digest `sha256:45204cedab7597ac0b29302cc8fabb2586189bf901263f2c78ece981789ee6a6`. The exact-SHA APK artifact `11807970927` has digest `sha256:5827fd4c6e4341343311085d6c19fbc02d07a43e951842e64559e0fddc71050c`; desktop browser artifact `11808606064` has digest `sha256:18e689c36a0b3927054e53c0affc42d804f9e299d0fe08f91b4991dfac0e5c89`; mobile-landscape browser artifact `11808371656` has digest `sha256:abec9e6194d2e857b351d07995a3e82e97423672b2b89b1ab30b5b57a3bfeaaa`; API 35 artifact `11808740633` has digest `sha256:0d4f3c3e39825e1b41c740443ecffc45e82a1336463f3227a3d4253d22d0e727`; and API 36 large-screen artifact `11808950826` has digest `sha256:dc2cc723bf7b81ce2bed8f46653b776264409d9d03bd00a666c4efb41f89d29c`.

Trusted review run `38390100227` (PR comment `6144503375`) on `fba37a2026a83a56c04c442776f56c093968d166` marked acceptance criteria 0 through 3 satisfied and every required proof credible. It returned `fail` solely because the archive did not yet record this reviewed candidate and its exact-SHA evidence. This archive-only transition records that immutable evidence without changing EV-9 implementation or workflow semantics; the resulting closeout SHA still requires its own exact-head technical proof and fresh trusted EV-9 review under the self-reference rule.

This archive transition follows the repository's established independent-review self-reference rule used during EV-8 closeout: the archive records the last immutable pre-archive candidate and the trusted finding that caused the transition, while the resulting archive-only closeout candidate cannot literally contain its own Git SHA because that SHA depends on the archive contents. The resulting exact closeout SHA must therefore pass all required technical gates and a fresh trusted EV-9 review; no earlier verdict is inherited and no final evidence is synthesized from the predecessor.

### Isolation and rollback

EV-9 analyzes repository-local graph/policy/workflow state and writes only ephemeral JSON reports into CI workspaces before artifact upload. The structural semantic observer reads the authoritative PR Candidate workflow without mutating it, ignores YAML comments as evidence, and fails closed on additional or synthetic checkout steps. The authoritative PR producer still performs the same one full repository build and reuses the same SHA-bound web bundle for browser/Android consumers; EV-9 adds a blocking verification decision without becoming a second build or evidence producer.

Rollback is deterministic: set `IRONSHADE_EVIDENCE_INDEPENDENCE_ENFORCEMENT=0` to run the same graph validation, classifier calibration, pinned structural semantic observation/calibration, and exact-SHA report while making only the EV-9 decision advisory. Removing the EV-9 policy/observer/promotion-gate wiring restores the prior EV-2 advisory-only behavior. Existing candidate evidence, full build, browser, Android/APK, architecture-invariant, and trusted-review obligations remain authoritative throughout rollback.

### Promotion status

Promoted only for `candidate-workflows-use-exact-pr-head`. `candidate-evidence-rejects-cross-sha-proof` remains experimental/advisory because its current material path is circular. The next experimental promotion item is EV-10.
