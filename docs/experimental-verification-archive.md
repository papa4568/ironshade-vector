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

The EV-6 regression reports `CAUSAL_PROOF_CACHE_TEST_PASS stableExcluded=pass causalInvalidation=pass runtimeInvalidation=pass realRerunAgreement=pass disagreementDisables=pass historyExactSha=pass changedFileSimilarity=unused mode=shadow`. The single-producer contract simultaneously requires the reuse prediction to precede the real proof, the comparison to follow it, and exactly one authoritative `npm run build` producer to remain. The closeout candidate retains both successful observations so its exact-candidate run provides another prediction-versus-rerun sample before merge.

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
- Policy validation requires every important graph criterion to be either enforced or explicitly excluded with rationale. Unknown criteria, duplicate/overlapping scope, uncovered important criteria, malformed shared-infrastructure claims, exact-SHA mismatch, semantic-observer target redirection, classifier instability, calibration outside the zero-error budgets fail closed.
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

After trusted review run `38400966740` on archive-only candidate `3b70d4d726ed49ffbe7f9af8405e697460a659bb` found that the source-bound build observer could accept required shell commands when they appeared only in comments, the same branch changed the semantic observer to strip active shell comments before command matching and added an explicit `source-bound-build-comment-spoof` dishonest calibration trial. Exact closeout candidate `d391e35766fb51a504318c033b25d0c4438fa600` then passed EV-9 Trusted PR Candidate Observer run `38401712793`, Agent Orchestration run `38401712751`, and every technically available exact-candidate gate in PR Candidate Verification run `38401713386`. The candidate build/full verification, independent-review context, desktop and mobile-landscape browser journeys, APK construction/integrity and delivery checks, API 35 product smoke, API 36 large-screen smoke, aggregate Android verification, architecture invariants, EV-8 enforcement, and EV-9 promoted evidence-independence gate all succeeded. The first API 36 attempt exposed a one-off deploy-touch timing race; a targeted retry on the unchanged exact SHA passed the complete API 36 smoke and Android aggregate. The final candidate job failed only at the expected exact-SHA independent-review decision step before the trusted verdict was published.

Exact-SHA EV-9 artifact `11815043152` (`evidence-independence-gate-368-d391e35766fb51a504318c033b25d0c4438fa600`) has GitHub Actions digest `sha256:f9105e7462b1c3652a9fc63bfe8d4244b9d84510b06708c19a7f8e4c104877b5`. The exact-SHA APK artifact `11815433337` has digest `sha256:d6d909c32407fc5e6777549726c086592a449a9d2a9e52597594a954031aa7c9`; desktop browser artifact `11815843821` has digest `sha256:39211f493c4393742caaae6d88302fe5945cdcb6aaf68242ad18c8ad458596da`; mobile-landscape browser artifact `11817115353` has digest `sha256:4f29f8f05fdcec9df4a436172c2f03faba86f1c1070be57e5d83a71d98fc7de0`; API 35 artifact `11815763200` has digest `sha256:b16a5e8584f444d98e1f869eb06f531e291641cda2434524e3dee8560983e8a3`; and the successful same-SHA API 36 retry artifact `11823348035` has digest `sha256:850e4b047b8e36d74be341c1178545e24c7751661f76c6e755a6f36a992915f6`.

Trusted review run `38414629174` (PR comment `6148048528`) on `d391e35766fb51a504318c033b25d0c4438fa600` marked acceptance criteria 0 through 3 satisfied and every required technical proof credible. It returned `fail` solely because this archive did not yet record the exact closeout candidate and its exact-SHA evidence. This archive-only transition records that immutable evidence without changing EV-9 implementation or workflow semantics; the resulting closeout SHA still requires its own exact-head technical proof and fresh trusted EV-9 review under the self-reference rule.

### Isolation and rollback

EV-9 analyzes repository-local graph/policy/workflow state and writes only ephemeral JSON reports into CI workspaces before artifact upload. The structural semantic observer reads the authoritative PR Candidate workflow without mutating it, ignores YAML comments as evidence, and fails closed on additional or synthetic checkout steps. The authoritative PR producer still performs the same one full repository build and reuses the same SHA-bound web bundle for browser/Android consumers; EV-9 adds a blocking verification decision without becoming a second build or evidence producer.

Rollback is deterministic: set `IRONSHADE_EVIDENCE_INDEPENDENCE_ENFORCEMENT=0` to run the same graph validation, classifier calibration, pinned structural semantic observation/calibration, and exact-SHA report while making only the EV-9 decision advisory. Removing the EV-9 policy/observer/promotion-gate wiring restores the prior EV-2 advisory-only behavior. Existing candidate evidence, full build, browser, Android/APK, architecture-invariant, and trusted-review obligations remain authoritative throughout rollback.

### Promotion status

Promoted only for `candidate-workflows-use-exact-pr-head`. `candidate-evidence-rejects-cross-sha-proof` remains experimental/advisory because its current material path is circular. The next experimental promotion item is EV-10.

## EV-10 — Calibrate EV-3 Behavioral Genome

Completed 2026-10-13 as an advisory calibration of the EV-3 mechanism. The original EV-3 archive record above remains unchanged advisory prototype history.

### Implemented

- Added `agent/behavioral-genome-calibration-corpus.json` with zero false-positive and false-negative budgets, three behavior-preserving controls, and one representative intentional semantic change for each EV-3 domain: simulation, mission, presentation, load, resources, and performance.
- Added `agent/tools/behavioral-genome-calibration.mjs` to reuse the existing canonical behavioral-genome normalizers/digests instead of maintaining a second fingerprint implementation. The analyzer binds evidence to a full exact candidate SHA, reports per-domain semantic trials plus false positives/false negatives, and emits an EV-11 promotion scope containing the reviewed normalizers, exclusions, and unresolved limitations.
- Added `agent/tests/behavioral-genome-calibration.mjs` to prove deterministic repeat calibration, zero-error classification on the representative corpus, a deliberately mislabeled semantic-as-noise trial is counted as a false positive and fails the zero budget, a deliberately normalized-away semantic trial is counted as a false negative and fails the zero budget, exact-SHA binding is mandatory, and prototype/path escapes are rejected.
- Extended `scripts/run-behavioral-genome-shadow.mjs` so the existing exact-SHA EV-3 shadow artifact also writes `calibration.json`; EV-10 does not add a second build, route, product runtime, or blocking gate.
- Documented the EV-10 advisory contract and rollback boundary in `AGENTS.md`. A calibration pass only makes the measured post-normalization domain probes eligible for EV-11 review; the report remains `acceptedForEnforcement=false` and `candidatePassGranted=false`.

### Evidence

Implementation candidate `258b070dbe96fc45d801f92fe5d134b4678238ae` passed Agent Orchestration run `38429490019` and the authoritative candidate-build/full-verification producer in PR Candidate Verification run `38429490090`. The producer passed architecture invariants, independent-review contract regressions, EV-8 acceptance-attack enforcement, EV-9 causal-evidence enforcement, the complete repository verification/production build, source-bound candidate digest generation, the EV-3 repeat route, and EV-10 calibration capture. It also produced and verified the installable Android APK from the same exact-SHA web bundle before this archive-only closeout transition.

The first producer attempt failed before any EV-10 code ran because isolated `npm ci` omitted the lockfile-declared optional platform package `@esbuild/linux-x64` and Vite/esbuild could not start. The same immutable workflow/lockfile had installed that package on the immediately preceding candidate. A targeted retry of only the failed producer job on the unchanged SHA installed the complete locked dependency set and passed; the one-off environment failure did not recur and no repository rule was weakened or permanently changed.

Exact-SHA advisory artifact `11830304148` (`behavioral-genome-shadow-373-258b070dbe96fc45d801f92fe5d134b4678238ae`) has GitHub Actions digest `sha256:0f4b8de200d670b177a972fc3ee85d1381d981a766b1cf2b8356d41f4ed982c6`. Its calibration report is bound to `258b070dbe96fc45d801f92fe5d134b4678238ae`, has config digest `ee78e5fbdd6013a62452d1a53c761b5319d5c6a79be988bc2207aa1f714e4a9e`, corpus digest `1450d50e1337580e9732cf9a53e22f41a3dcbe1615580da613a923439418b360`, `calibrationPass=true`, `falsePositives=0`, `falseNegatives=0`, `acceptedForEnforcement=false`, and `candidatePassGranted=false`.

Each required domain had exactly one representative semantic trial and exactly one detection, with zero false positives and zero false negatives: `simulation`, `mission`, `presentation`, `load`, `resources`, and `performance`. The three behavior-preserving controls also classified correctly: sub-threshold simulation rounding noise produced no delta, changing excluded `load.loadDurationMs` produced no delta, and sub-bucket performance jitter produced no delta. The real EV-3 route was captured twice on the same SHA; its only volatile load-duration values were `27.497445` and `26.918020999999996` milliseconds, while both normalized genomes retained root digest `d0b8e3b370dcd2892b29fb19c597c3ab166d2f9e5f73798e88a22133499e0e40` and the repeat comparison reported `changedDomains=[]`, `unexplainedDomains=[]`, and `status="pass"`.

EV-11 may review all six measured post-normalization domain probes, but the evidence carries three explicit constraints. `load.loadDurationMs` remains excluded and therefore cannot support a load-latency enforcement claim. Configured rounding/bucketing intentionally hides sub-threshold numeric jitter, so EV-11 must preserve those thresholds unless separately recalibrated. Finally, the representative route proves sensitivity/noise handling for its observed signals rather than completeness over every possible product behavior, so behavioral-genome evidence may supplement but never replace the underlying behavioral tests, browser/Android checks, exact-SHA evidence, APK proof, or independent review.

This archive transition follows the repository's established independent-review self-reference rule: it records the immutable pre-archive implementation candidate and measured artifact, while the resulting closeout SHA cannot literally contain its own Git SHA because that SHA depends on these archive contents. The resulting exact closeout candidate must therefore pass all required technical gates and a fresh trusted EV-10 review; no earlier candidate verdict is inherited and no final evidence is synthesized from the predecessor.

### Isolation and rollback

EV-10 changes verification/governance only. Calibration mutates structured observation clones in memory, runs against the existing EV-3 semantic implementation, writes only ephemeral CI evidence, and does not alter product/runtime state or default candidate acceptance.

Rollback is deterministic: remove the EV-10 calibration invocation from `scripts/run-behavioral-genome-shadow.mjs`, remove `agent/behavioral-genome-calibration-corpus.json`, `agent/tools/behavioral-genome-calibration.mjs`, and `agent/tests/behavioral-genome-calibration.mjs`, and remove the EV-10 calibration rule/source entries from `AGENTS.md`. The pre-EV-10 EV-3 shadow route and all existing build, browser, Android/APK, exact-SHA, EV-8, EV-9, and independent-review gates remain unchanged.

### Promotion status

Calibration complete; no behavioral-genome enforcement was promoted in EV-10. All six measured post-normalization domain probes are eligible for EV-11 review under the recorded exclusions/normalization limits, while load latency, sub-threshold normalized changes, and unobserved product behavior remain outside the claim. The next experimental promotion item is EV-11.

## EV-11 — Enforce Validated Behavioral Genome Scope

Completed 2026-10-13 as a narrow enforced promotion of the EV-3 behavioral genome using only EV-10-calibrated scope. The original EV-3 prototype and EV-10 calibration records above remain unchanged history.

### Implemented

- Added `agent/behavioral-genome-promotion-policy.json`, pinned to the exact EV-10 config digest `ee78e5fbdd6013a62452d1a53c761b5319d5c6a79be988bc2207aa1f714e4a9e`, corpus digest `1450d50e1337580e9732cf9a53e22f41a3dcbe1615580da613a923439418b360`, zero false-positive/false-negative budgets, and the same representative route.
- Promoted only the six EV-10-validated post-normalization domains—`simulation`, `mission`, `presentation`, `load`, `resources`, and `performance`—as declaration-required. A changed promoted-domain digest blocks when undeclared; an exact task-bound declaration keeps the delta visible but does not synthesize a candidate pass.
- Kept the three EV-10 unresolved constraints explicitly informational: excluded `load.loadDurationMs`, sub-threshold values hidden by the pinned rounding/bucketing normalizers, and behavior not observed by the representative route. Any config/corpus/normalizer/promotion-scope drift requires separate recalibration and reviewed policy change.
- Added `agent/tools/behavioral-genome-promotion-gate.mjs`, `agent/tests/behavioral-genome-promotion.mjs`, and `agent/tools/behavioral-genome-promotion-evidence.mjs` for fail-closed policy/declaration validation, exact base/head binding, measured promotion regressions, rollback behavior, and independent exact-evidence recomputation.
- Upgraded `scripts/run-behavioral-genome-shadow.mjs` to capture the representative route on the exact PR base and exact PR head after the authoritative full verification/build, while retaining repeat stability and EV-10 calibration evidence. Same-lockfile base capture reuses only the already locked dependency installation; changed lockfiles force isolated `npm ci`.
- Made the existing trusted EV-3 producer slot blocking in `.github/workflows/pr-candidate.yml` without adding a second full build, and added EV-11 exact-evidence verification to the independent-review context when EV-11 is the selected review task.
- Documented the permanent enforcement, declaration, exclusion, proof-preservation, and rollback contract in `AGENTS.md`.

### Evidence

The first enforcement candidate `b8847f225065e77993b3f05032b01c950c04333e` exposed an existing EV-9 trust-boundary dependency: renaming the two post-build EV-3 workflow slots caused Agent Orchestration run `38445558125` to fail the trusted EV-9 observer bootstrap even though the underlying EV-9 gate itself passed. The same branch restored the exact trusted slot names and the original producer timeout while retaining EV-11's blocking semantics; no EV-9 rule was weakened.

Corrected implementation candidate `07bcba40a1e0881621a5139151d3005d735bd05c` passed Agent Orchestration run `38446044168` and every technically available exact-candidate runtime/build gate in PR Candidate Verification run `38446044202` before this archive transition: the authoritative full repository verification/production build, architecture invariants, EV-8 enforcement, EV-9 enforcement, EV-11 base/head gate, exact candidate bundle, desktop and mobile-landscape browser journeys, APK construction/integrity and delivery, API 35 product smoke, API 36 large-screen smoke, and aggregate Android verification all succeeded.

Exact-SHA EV-11 artifact `11839225028` (`behavioral-genome-shadow-374-07bcba40a1e0881621a5139151d3005d735bd05c`) has GitHub Actions digest `sha256:131570f1462bb1bf381c9e9e8ffa261eb2e1c3ecd2307debfdbc6de5621924ae`. Its promotion report is bound to base `97d1303aa1f43fafdd7f7751c7260baa5bfa219e` and candidate `07bcba40a1e0881621a5139151d3005d735bd05c`, has policy digest `c26634340c7a94078c28d1871d25b205ea641dbb7afbceba8b58e812d27c6a30`, report digest `13ab25b9342d303d4dd9140a2647358476bcdca68825e46d35755385fd126d62`, `mode="enforced"`, `verdict="pass"`, `blocking=false`, `wouldBlock=false`, `changedDomains=[]`, `blockingDomains=[]`, and `candidatePassGranted=false`. The exact base and candidate normalized root digests both equal `d0b8e3b370dcd2892b29fb19c597c3ab166d2f9e5f73798e88a22133499e0e40`.

The EV-11 promotion regression re-ran the EV-10 corpus under the pinned policy and measured zero false positives across all three behavior-preserving controls (`0/3`) and zero false negatives across the six representative semantic domain trials (`0/6`). Each calibrated semantic trial blocks when undeclared and becomes non-blocking only when its exact changed domain is explicitly declared; the three noise/unresolved controls remain outside promoted semantic resolution. The rollback regression proves a calibrated undeclared delta still reports `wouldBlock=true` while enforcement disabled produces `blocking=false` and `verdict="disabled-advisory"`.

APK artifact `11839710202` is bound to the same implementation candidate with GitHub Actions digest `sha256:18762f8b6250de52d5c8fa01bb86aac34cc18e0bea88965d81481384d5a48cc5`. Desktop browser artifact `11839416077` has digest `sha256:98e55f8d8497364eaf80963220d9297f8e8b70062a20914c13997c1681203f7c`; mobile-landscape browser artifact `11839306358` has digest `sha256:bea407c90c3b5115abf146fe2cd0b8ffbfdb5fb533c6c488d6fab4c23b0e4ca0`; API 35 artifact `11839515963` has digest `sha256:007082489cc17761ca06084ca8e7825e1c589531169bf348572f376b185c2492`; and API 36 large-screen artifact `11838757125` has digest `sha256:266ad6bb99ac3696407e23579eed88fe3c389c5be39217d58f1317acb1bad377`.

This archive transition follows the repository's independent-review self-reference rule. It records the immutable pre-archive implementation candidate and measured exact-SHA proof set. The resulting closeout SHA cannot literally contain its own Git SHA because that SHA depends on these archive contents, so it must pass all technically available exact-head gates and a fresh trusted EV-11 review; no predecessor review is inherited and no final evidence is synthesized from `07bcba40a1e0881621a5139151d3005d735bd05c`.

### Isolation and rollback

EV-11 changes verification/governance only. Base capture is created from an exact `git archive` into disposable temporary state, candidate route evidence is written only into the CI workspace, and the gate compares canonical post-normalization domain digests without mutating product/runtime state. Existing full-build, browser, Android/APK, exact-SHA, EV-8, EV-9, architecture-invariant, and independent-review gates remain authoritative.

Rollback is deterministic: set `IRONSHADE_BEHAVIORAL_GENOME_ENFORCEMENT=0` to run the same exact-base/exact-head route captures, EV-10 calibration, declaration parsing, and evidence generation while removing only the EV-11 blocking decision. Removing the EV-11 policy/gate/evidence wiring restores the pre-EV-11 advisory EV-3/EV-10 behavior; product/runtime behavior and every pre-existing proof obligation remain unchanged.

### Promotion status

Promoted for the six EV-10-validated post-normalization domains as declaration-required candidate evidence. Load latency via excluded `load.loadDurationMs`, sub-threshold normalized changes, and unobserved product behavior remain advisory/outside the claim. EV-4 failure recurrence and antibody governance remain experimental; the next experimental task is EV-12.

## EV-12 — Calibrate EV-4 Failure Recurrence

Completed 2026-10-13 as an advisory calibration of the EV-4 repository immune-system mechanism. The original EV-4 prototype record above remains unchanged advisory history.

### Implemented

- Added `agent/failure-recurrence-calibration-corpus.json` with reviewed ground-truth recurrence groups deliberately independent of the current `failureClass` clustering key. The corpus combines the two historical EV-2 Android screenshot-transport timeouts with representative synthetic recurrence, ambiguity, aliasing, rejection, and bounded-compaction controls.
- Added `agent/tools/failure-recurrence-calibration.mjs` and `agent/tests/failure-recurrence-calibration.mjs` to measure pairwise over-clustering/under-clustering plus recurrence false-positive/false-negative behavior while reusing EV-4's real clustering and antibody proposal implementation.
- The reviewed global baseline intentionally records one over-clustered pair, one under-clustered pair, two recurrence false-positive records, and two recurrence false-negative records. Those known limitations remain visible and advisory instead of being normalized away.
- The governance-candidate scope uses a zero-error budget. `android-screenshot-capture-transport-timeout` and `candidate-artifact-integrity-drift` each measure zero over-clustering, zero under-clustering, zero recurrence false positives, and zero recurrence false negatives and are therefore eligible only for EV-13 governance review. The artifact-upload detail ambiguity and Android ready-state aliasing controls remain advisory.
- Added an incompatible same-label identity rejection control and a deterministic compaction probe that feeds 100 repeated observations through EV-4, retains only three representative samples, preserves the total occurrence count, produces the same digest under reversed input order, stays inside the configured byte budget, and fails closed when the byte budget is deliberately too small.
- Added `agent/tools/failure-recurrence-calibration-evidence.mjs` plus `.github/workflows/ev12-failure-recurrence-calibration.yml` to bind the report to the exact PR head, independently recompute it from the committed corpus and `agent/failure-memory.json`, and upload exact-SHA evidence. The workflow is read-only and the report hard-codes `mode="advisory"`, `blocking=false`, `acceptedForEnforcement=false`, and `candidatePassGranted=false`.
- Documented the permanent EV-12 advisory boundary in `AGENTS.md`. EV-12 cannot accept or enable an antibody; EV-13 owns governance and EV-14 owns any later enforcement promotion.

### Evidence

The first exact-head implementation candidate `e089eafa7e06c69802cf188b857c73bf2af491b1` failed EV-12's own workflow because the rollback report referenced `sourceFailureMemoryUnchanged` instead of the computed `sourceMemoryUnchanged` local. The same branch corrected that implementation defect without changing the calibration goal, corpus, measured budgets, or advisory semantics.

Corrected implementation candidate `1a03cf7e0da37ef96935acb59903807d48deaee7` passed EV-12 Failure Recurrence Calibration run `38462667535`. Exact-SHA artifact `11846586283` (`failure-recurrence-calibration-375-1a03cf7e0da37ef96935acb59903807d48deaee7`) has GitHub Actions digest `sha256:1a36dc567d2ddd9dbd1ba4c123b338b7f2792d41089885fca08b331022c10fc3`.

The exact report records the reviewed global known-limit errors as `overClusteringPairs=1`, `underClusteringPairs=1`, `recurrenceFalsePositiveRecords=2`, and `recurrenceFalseNegativeRecords=2`, while the EV-13-eligible scope records zero for all four metrics. Historical screenshot calibration records bind to the existing EV-4 failure-memory identity and occurrence count. All measured antibody proposals remain `acceptedForEnforcement=false`.

The deterministic compaction probe records `occurrences=100`, `retainedSamples=3`, identical forward/reverse digests, and a passing configured byte budget; the deliberately undersized budget is rejected rather than silently discarding evidence. The incompatible same-label identity control is also rejected as required.

This archive transition follows the repository's independent-review self-reference rule. It records the immutable pre-archive implementation candidate and measured exact-SHA calibration artifact. The resulting closeout SHA cannot literally contain its own Git SHA because that SHA depends on these archive contents, so it must pass the repository's exact-head technical gates and a fresh trusted EV-12 review; no predecessor verdict is inherited.

### Isolation and rollback

EV-12 changes verification/governance only. The analyzer reads the committed calibration corpus and EV-4 failure memory, clusters cloned records in process memory, writes only ephemeral CI evidence, and does not mutate `agent/failure-memory.json`, product/runtime state, or candidate acceptance.

Rollback is deterministic: remove `.github/workflows/ev12-failure-recurrence-calibration.yml`, `agent/failure-recurrence-calibration-corpus.json`, `agent/tools/failure-recurrence-calibration.mjs`, `agent/tools/failure-recurrence-calibration-evidence.mjs`, `agent/tests/failure-recurrence-calibration.mjs`, and the EV-12 calibration entries from `AGENTS.md`. The pre-EV-12 EV-4 memory/proposal semantics, failure history, product/runtime behavior, and all existing exact-SHA proof gates remain unchanged.

### Promotion status

Calibration complete; no antibody was accepted or promoted. Only the two zero-error measured signatures named above are eligible for EV-13 governance review. The known artifact-upload ambiguity and ready-state aliasing limitations remain advisory. The next experimental promotion item is EV-13.

## EV-13 — Define Antibody Governance

Completed 2026-10-13 as a governance-only graduation of the EV-4/EV-12 antibody mechanism. No antibody enforcement was enabled.

### Implemented

- Added `agent/antibody-governance-policy.json` and `agent/antibody-governance.schema.json` as the permanent reviewed lifecycle contract. The policy keeps `enforcementEnabled=false`, requires trusted review for `accept`, `update`, and `retire`, and requires update/retire transitions to bind the exact prior decision digest.
- Pinned governance admission to the EV-12 corpus digest `ab1be48150edfad5f16f97339f7e5c62a8d8eb6f56382b47749a1ac008c2c493` and EV-4 failure-memory digest `d6f151d1bb399943b959d2ff03f63c69ac1f78414d68ff353de685130aea2254`. Only `android-screenshot-capture-transport-timeout` and `candidate-artifact-integrity-drift` are eligible for governance review; all EV-12 advisory/ambiguous groups remain ineligible until separately recalibrated.
- Mapped accepted antibody kinds to the existing canonical source of truth instead of a second executable registry: architecture invariants to `agent/architecture-invariants.json`, impact-map rules to `agent/impact-map.json`, and focused regressions/telemetry checks to existing repository check files. Governance decisions under `agent/antibody-decisions/` are audit pointers only and cannot serve as the executable check source.
- Added `agent/antibody-governance-calibration-corpus.json`, `agent/tools/antibody-governance.mjs`, `agent/tools/antibody-governance-evidence.mjs`, and `agent/tests/antibody-governance.mjs`. The corpus covers reviewed valid acceptance for both eligible signatures, unreviewed rejection, advisory-scope rejection, wrong-source rejection, duplicate-registry rejection, exact-digest update, stale-digest rejection, and reviewed retirement.
- Added `.github/workflows/ev13-antibody-governance.yml` to run the governance regression and independently recompute both active and rollback reports from the exact PR head. EV-13 commits no accepted decision record, leaves `acceptedForEnforcement=false` and `candidatePassGranted=false`, and reserves the first narrow promotion for EV-14.
- Documented the permanent ownership, source-of-truth, lifecycle, proof-preservation, and rollback rules in `AGENTS.md`.

### Evidence

Implementation candidate `14c11716f3e6f5882e4159a59625e84acae76f34` passed EV-13 Antibody Governance run `38480296094`. Exact-SHA artifact `11855848379` (`antibody-governance-381-14c11716f3e6f5882e4159a59625e84acae76f34`) has GitHub Actions digest `sha256:3338c1072cb40bffb3e2e574ebd555292b0ee6a9402ab9f17fd2a9b9c9e36485`.

The active report records `governancePass=true`, `governanceEnabled=true`, `enforcementEnabled=false`, `acceptedForEnforcement=false`, `candidatePassGranted=false`, and exactly the two EV-12 zero-error truth IDs. Across the reviewed lifecycle corpus it measured `transitionFalsePositives=0`, `transitionFalseNegatives=0`, `promotionFalsePositives=0`, and `promotionFalseNegatives=0`, all within zero budgets. The same exact head also passed EV-12 Failure Recurrence Calibration run `38480295579`, re-establishing the pinned eligibility boundary independently of EV-13's governance logic.

The rollback report for the same candidate ran with `IRONSHADE_ANTIBODY_GOVERNANCE=0`, remained `governancePass=true`, recomputed the same calibration evidence, authorized zero promotions, preserved `agent/failure-memory.json` unchanged, kept EV-4 advisory, and reported `existingEnforcementChanged=false`. No accepted governance decision was committed.

This archive transition follows the repository's independent-review self-reference rule. It records the immutable pre-archive implementation candidate and exact-SHA governance artifact. The resulting closeout SHA cannot literally contain its own Git SHA because that SHA depends on these archive contents, so it must pass all technically available exact-head gates and a fresh trusted EV-13 review; no predecessor review is inherited and no final evidence is synthesized from `14c11716f3e6f5882e4159a59625e84acae76f34`.

### Isolation and rollback

EV-13 changes verification/governance only. The validator reads committed EV-12/EV-4 evidence and governance contracts, evaluates cloned decision fixtures in memory, writes only ephemeral exact-SHA reports in CI, and cannot alter product/runtime state or any existing candidate-acceptance gate. Decision history is review metadata and never replaces the canonical executable check.

Rollback is deterministic: set `IRONSHADE_ANTIBODY_GOVERNANCE=0` to recompute the same eligibility and lifecycle calibration while authorizing zero future promotions. Removing the EV-13 policy/schema/calibration/tool/test/workflow restores the pre-EV-13 advisory EV-4/EV-12 state. Existing full verification, architecture invariants, EV-8/EV-9/EV-11 enforcement, browser/Android/APK, exact-SHA evidence, and trusted independent review remain authoritative throughout rollback.

### Promotion status

Governance promoted as permanent repository policy, but no antibody was accepted for enforcement and no executable gate was added. The two EV-12 zero-error signatures remain the only governance-eligible candidates, and EV-14 must select and promote at most one of them through its existing canonical check surface. The next experimental promotion item is EV-14.

### Trusted review hardening

Trusted review run `38482346916` (PR comment `6157129450`) on closeout candidate `a5708c82183c5b15065adbbafa191f743bfbcb70` accepted the exact-SHA technical proof as credible but returned `fail` on two trust-boundary defects: decision review fields were self-attested rather than authenticated against a trusted repository review, and the exported decision evaluator could bypass the policy-pinned EV-12 scope while source validation proved only an allowed file/path rather than the named canonical check entry.

The same branch corrected both findings without enabling enforcement. The raw decision evaluator is now private; the public authorization path fetches the exact PR and PR comments from GitHub and reuses `agent/tools/review-comment-gate.mjs` to authenticate review provenance. Every authorization revalidates the policy-pinned EV-12 corpus and EV-4 failure-memory digests, reruns the exact zero-error eligible scope, and verifies the named canonical check entry exists in the referenced source-of-truth file. The governance corpus now includes explicit self-attested-review and missing-canonical-entry attacks; both are rejected while the two legitimate eligible signatures remain accepted within the zero false-positive/false-negative budgets.

Corrected implementation candidate `fe852b0bd0d619ff328609f58f9b4b6ea1888245` passed EV-13 Antibody Governance run `38491675575`. Exact-SHA artifact `11861897427` (`antibody-governance-381-fe852b0bd0d619ff328609f58f9b4b6ea1888245`) has GitHub Actions digest `sha256:0a348d3f70e9b72954fc62f8575eb7ab0e1e0862142d63e92a2d402e0c05fcea`. The same candidate passed Agent Orchestration run `38491675580`.

PR Candidate Verification run `38491675759` on the same exact SHA passed the authoritative full repository verification/production build, mechanical architecture invariants, exact candidate bundle/evidence producers, APK construction/integrity/delivery, API 35 product smoke, API 36 large-screen smoke, and aggregate Android verification. Browser E2E was correctly skipped by scope because EV-13 changes only verification/governance. Exact-SHA APK artifact `11861578768` has digest `sha256:2b69a6605940cd4d8482b46515b013c2b16091ca4bc8d3143268c10244a1fd90`; API 35 artifact `11862870515` has digest `sha256:5fa92aab9b320943ec8de1ad4f38d643f7cad33e64e83d4f95345d721d24604e`; API 36 artifact `11862905737` has digest `sha256:291136fd79d649259f36fef3fc1bd6b080a40991b8459218e2ac8c7437e974af`.

This archive-only transition records the immutable corrected candidate and the failed trusted-review finding that caused the hardening. The resulting closeout SHA cannot contain its own Git SHA because it depends on these archive contents, so it must pass fresh exact-head technical gates and a fresh trusted EV-13 review; no verdict or technical proof from `fe852b0bd0d619ff328609f58f9b4b6ea1888245` is inherited.

### Subsequent trusted-review hardening

Trusted review run `38492918694` (PR comment `6158467789`) on `fe852b0bd0d619ff328609f58f9b4b6ea1888245` returned `fail` because an allowed focused-regression file could satisfy canonical-source validation merely by containing the proposed check ID. The same branch bound existing-check decisions to the EV-4 proposal's exact target path and required/forbidden contract instead of accepting a phantom same-ID check.

Trusted review run `38495218877` (PR comment `6158769764`) on candidate `766ff81ecb0593255eae149b57413e73730a7a75` returned `fail` because trusted review was not yet bound to the exact committed decision payload, governance inputs could still be caller supplied rather than loaded from the reviewed candidate, and authorization did not prove the complete PR review history beyond the first comment page. The public authorization path was hardened to fetch the exact candidate policy, EV-12 corpus, failure memory, and committed decision from GitHub, bind trusted review to that decision path/digest, and paginate the full PR conversation.

Trusted review run `38497509277` (PR comment `6159063231`) on candidate `0ee95f7b1385d6ba48f29467e121cb420c366a16` returned `fail` because `IRONSHADE_ANTIBODY_GOVERNANCE=0` disabled the assessment report but not the public authorization API. The same branch made the documented rollback environment value disable promotion authorization in the public path while preserving the same validation evidence.

Trusted review run `38499308229` (PR comment `6159297347`) on candidate `3def35711b14520f7ddcf52a639dec74502bdf7f` returned `fail` because authorization still trusted a caller-supplied review packet, allowing a valid same-task/same-SHA result to be replayed against altered acceptance content. The public path now reconstructs the exact candidate review task, complete changed-file set, impact selection, and architecture-invariant packet internally and requires canonical equality with the supplied packet.

Trusted review run `38503495518` (PR comment `6159849919`) on candidate `dbf3bf3200403887c5111ea8fa4bc21abc9f9237` returned `fail` because fixed-file source checks proved only a matching rule ID rather than the EV-4 semantic contract, and review-packet reconstruction synthesized passed architecture-invariant statuses rather than executing the invariant evaluator. The same branch bound architecture/impact-map entries to the proposal contract and made packet reconstruction run the real architecture evaluator from the exact clean candidate checkout.

Trusted review run `38505879516` (PR comment `6160169184`) on candidate `04c4a0bdb27ae24e9a6869371c039d4631f89382` accepted the exact-SHA technical gates as credible but returned `fail` on two remaining EV-14-readiness defects: update/retire could extend a caller-selected stale prior decision instead of proving the latest committed lifecycle head, and focused-regression/telemetry source checks could be satisfied by inert constants or log markers rather than executable behavior.

The final same-branch correction keeps decision records append-only, enumerates the complete exact-candidate `agent/antibody-decisions/` history, validates a single contiguous lifecycle chain, rejects continuation after retirement, and permits update/retire only from the repository-derived latest active head. Existing focused-regression/telemetry sources are now parsed as executable check surfaces: test-file contracts must be present in assertions, logging and constant declarations do not count, shell comments/assignments/logging do not count, and the exact EV-4 target/required/forbidden contract remains authoritative. `agent/tests/candidate-artifact.mjs` binds `candidate-artifact-integrity` / `candidate-sha-match` directly to the wrong-SHA rejection assertion. Regressions now reject a correctly digested stale-parent fork after a newer update and reject an inert marker-only candidate-artifact fixture.

Corrected implementation candidate `e742e71366cb2dcb3c1fca7c76b7fa865dad0efb` passed EV-13 Antibody Governance run `38507344879`, EV-12 Failure Recurrence Calibration run `38507344889`, and Agent Orchestration run `38507344882`. Exact-SHA EV-13 artifact `11868416697` (`antibody-governance-381-e742e71366cb2dcb3c1fca7c76b7fa865dad0efb`) has GitHub Actions digest `sha256:cd6408370e19d9aa3fba3c81405f43c67d5ff81073bf13a668e4e0333431c047`.

PR Candidate Verification run `38507344885` on the same exact SHA passed the authoritative full repository verification/production build, promoted trust-boundary gates, mechanical architecture invariants, exact candidate web bundle, independent-review context generation, APK construction/integrity/delivery, API 35 product smoke, API 36 large-screen smoke, and aggregate Android verification. Browser E2E was correctly skipped by scope because the final implementation changes are verification/governance-only. The final candidate job failed only at the expected missing exact-SHA independent-review pass before this archive-only closeout. Exact-SHA APK artifact `11868054623` has digest `sha256:93b6fd7afc95abedcddc26a552f26afd931db18f2c6e4c11ad6f87571e7822e5`; API 35 artifact `11868428238` has digest `sha256:fdb18f01a68241958c4170a5af91075ba89db4b24fd34c5ba3c1587f243a4102`; API 36 large-screen artifact `11868169339` has digest `sha256:bbf12b5eda4a39bd5a549fc0f8a3b4a9e2776b98c6214a868dbbb301b0df6a5a`; and independent-review context artifact `11867899804` has digest `sha256:cdda8e94fa00e79f6787276b491068206d4a0ef89d92213ddb38786b9407571d`.

This archive-only transition records the complete failed-review/fix chain and immutable technically complete candidate `e742e71366cb2dcb3c1fca7c76b7fa865dad0efb`. Because the resulting closeout SHA depends on these archive contents, it cannot literally cite itself as its predecessor proof. The resulting exact closeout candidate must pass fresh exact-head technical gates and a fresh trusted EV-13 review; no verdict or final candidate evidence is inherited from `e742e71366cb2dcb3c1fca7c76b7fa865dad0efb`.

Trusted review run `38510340514` (PR comment `6160755342`) on archive-only candidate `e0be5300d2edaa2ff756b19376db36f120fa75fa` accepted the exact-SHA technical proof as credible but returned `fail` on two remaining governance trust-boundary defects. First, trusted-main machine review could still be self-requested by the pull-request author and later satisfy antibody authorization. Second, focused-regression/telemetry source validation could accept a vacuous always-true assertion that merely carried the required check ID/contract marker text.

The same branch hardened both boundaries without changing the repository-wide trusted-review workflow or enabling antibody enforcement. Antibody authorization now records the trusted-main source run requester and, specifically for governance decisions, requires the machine-review requester or human reviewer to differ from the PR author. Existing test-source checks now require behavior-bearing assertion subjects: literal-only or marker-only assertions do not count, while the real wrong-SHA rejection assertion in `agent/tests/candidate-artifact.mjs` remains valid. The zero-error EV-13 calibration corpus now includes explicit self-requested trusted-main-review and vacuous-assertion attacks, both of which must be rejected.

Corrected implementation candidate `20ae4ca9bf61cd2c91200c2796a0fc6c4dde3ff6` passed EV-13 Antibody Governance run `38511935042`, EV-12 Failure Recurrence Calibration run `38511934961`, and Agent Orchestration run `38511934860`. Exact-SHA EV-13 artifact `11870541304` (`antibody-governance-381-20ae4ca9bf61cd2c91200c2796a0fc6c4dde3ff6`) has GitHub Actions digest `sha256:1de5c294b6ba53c7e9528c2850b9e88d2125afc86ba41678264bb7159e17a050`.

PR Candidate Verification run `38511934973` on the same exact SHA passed the authoritative full repository verification/production build, promoted trust-boundary gates, mechanical architecture invariants, exact candidate web bundle, independent-review context generation, APK construction/integrity/delivery, API 35 product smoke, API 36 large-screen smoke, and aggregate Android verification. Browser E2E was correctly skipped by scope because this hardening changes only verification/governance. The final candidate job failed only at the expected missing exact-SHA independent-review pass before this archive-only transition. Exact-SHA APK artifact `11870561862` has digest `sha256:c393f380ead6e4c51171a3d9726f1bbcebb484baf339112d353092628807fff0`; API 35 artifact `11870627391` has digest `sha256:b194bf546d2efb8a1c0784ea2f3c60f1871d9ec94adb09ea7a4e4dd8bcdff403`; API 36 large-screen artifact `11870538179` has digest `sha256:3ced52103517520ab7d4897918a316970e771c0f5a34792025d71f3cdfc17e9f`; and independent-review context artifact `11870710984` has digest `sha256:235616bfc20efb2ac9e4c0daa47c8ca7fb4adda7a89aa161b5486403d89cf3e1`.

This archive-only transition records trusted review `38510340514`, both trust-boundary fixes, and immutable technically complete candidate `20ae4ca9bf61cd2c91200c2796a0fc6c4dde3ff6`. Because the resulting closeout SHA depends on these archive contents, it cannot literally cite itself as its predecessor proof. The resulting exact closeout candidate must pass fresh exact-head technical gates and a fresh trusted EV-13 review; no verdict or final candidate evidence is inherited from `20ae4ca9bf61cd2c91200c2796a0fc6c4dde3ff6`.

Trusted review run `38549407923` (PR comment `6166249949`) on archive-only candidate `86f4a4b252ddeb804b6b16b3c0e2b670a01944a5` accepted the exact-SHA production build, candidate CI, Android/APK proof, architecture invariants, and reviewer-independence hardening as credible, but returned `fail` on one remaining EV-14-readiness defect: canonical executable-check validation still admitted a synthetic rejected promise that never exercised the proposed candidate-artifact check because the required check ID/contract marker could live only in the assertion message.

The same branch tightened test-source proof from assertion-shaped syntax to assertion-outcome binding. `agent/tools/antibody-governance.mjs` now extracts only outcome-bearing assertion arguments, excludes assertion messages from source-contract evidence, and requires the named canonical entry plus every EV-4 required contract substring to occur in that behavior subject. `agent/tests/candidate-artifact.mjs` binds `candidate-artifact-integrity` and `candidate-sha-match` into the actual wrong-SHA `validateCandidateArtifact` invocation via a named binding map. EV-13's calibration and direct regression now reproduce `assert.rejects(Promise.reject(new Error('wrong sha')), /wrong sha/, 'candidate-artifact-integrity candidate-sha-match')` and require it to be rejected.

Corrected implementation candidate `d4db62f625e3cd34a69b1c6933c40c289b766965` passed EV-13 Antibody Governance run `38551221268`, EV-12 Failure Recurrence Calibration run `38551221258`, and Agent Orchestration run `38551221233`. Exact-SHA EV-13 artifact `11886199300` (`antibody-governance-381-d4db62f625e3cd34a69b1c6933c40c289b766965`) has GitHub Actions digest `sha256:978e53032cf52bd713f62a63c1671c8b756857dfa3511e90e65a264aafe52681`.

PR Candidate Verification run `38551221264` on the same exact SHA passed the authoritative full repository verification/production build, promoted trust-boundary gates, mechanical architecture invariants, exact candidate web bundle, independent-review context generation, APK construction/integrity/delivery, API 35 product smoke, API 36 large-screen smoke, and aggregate Android verification. Browser E2E was correctly skipped by scope because this hardening is verification/governance-only. The final candidate job failed only at the expected missing exact-SHA independent-review pass before this archive-only transition. Exact-SHA APK artifact `11887152223` has digest `sha256:a65b20676ad3bcd263d15f9cd5642e2d7daf85ed302fa9960adc96637940d28f`; API 35 artifact `11887212729` has digest `sha256:c5a9ec6e8455697cb86c567f7d77e32c32c02bfbcee9397ba29e4c98b1e86d26`; API 36 large-screen artifact `11886823667` has digest `sha256:f23b47803e1e9468d63bd8cfa5773f696021870f2fbda94d5ea7696c834983d5`; and independent-review context artifact `11887206831` has digest `sha256:07c9e5a7849d9beb65e04875ccfe52cb404a36be0cdff85391a3270cbdb8b157`.

This archive-only transition records trusted review `38549407923`, the assertion-outcome hardening, and immutable technically complete candidate `d4db62f625e3cd34a69b1c6933c40c289b766965`. Because the resulting closeout SHA depends on these archive contents, it cannot inherit any verdict or proof from `d4db62f625e3cd34a69b1c6933c40c289b766965`; the new exact closeout candidate must pass fresh exact-head technical gates and a fresh trusted EV-13 review before merge.

## EV-14 — Promote One Accepted Antibody

Completed 2026-10-14 as the first narrow enforced promotion of an EV-4 repository-immune-system antibody. The original EV-4 prototype, EV-12 recurrence calibration, and EV-13 governance records above remain unchanged history.

### Implemented

- Selected only `candidate-artifact-integrity-drift`, one of EV-12's two zero-error governance-eligible recurrence signatures. `android-screenshot-capture-transport-timeout` remains governance-eligible but unpromoted and requires a separate promotion item before it may block.
- Added `agent/antibody-promotion-policy.json`, pinned to EV-13 governance policy digest `500ccf844b7e00b609960ffb61633b63d7dd456bbf8adab2f161008e4d58dcd2`, EV-12 corpus digest `ab1be48150edfad5f16f97339f7e5c62a8d8eb6f56382b47749a1ac008c2c493`, EV-4 failure-memory digest `d6f151d1bb399943b959d2ff03f63c69ac1f78414d68ff353de685130aea2254`, and selected EV-4 proposal digest `aa1baf06adc51206a4faf015420c3c1c45462d5388eeb8f0d41c0354704fcd1e`.
- Added append-only acceptance-intent record `agent/antibody-decisions/candidate-artifact-integrity-drift-r1.json`. The decision remains an audit pointer; executable enforcement stays in the existing `agent/tests/candidate-artifact.mjs` `candidate-artifact-integrity` / `candidate-sha-match` wrong-SHA rejection contract rather than creating a second check registry.
- Added `agent/tools/antibody-promotion.mjs` and `agent/tests/antibody-promotion.mjs`. The gate independently recomputes the selected EV-4 proposal from EV-12 truth, validates the exact committed decision intent and canonical source, and calibrates one behavior-preserving source control plus two dishonest source-contract mutations.
- The measured calibration budget is zero false positives and zero false negatives. The behavior-preserving appended-comment control is accepted; removal of the required `candidate-sha-match` outcome binding and injection of forbidden `accept-cross-sha-artifact` behavior are both detected. A deliberately regressed canonical source is blocking in enforced mode.
- Added `.github/workflows/ev14-antibody-promotion.yml` to emit exact-SHA promotion/rollback evidence and, only after a trusted exact-SHA EV-14 review exists, authorize the committed decision through EV-13's GitHub-backed governance path. `candidatePassGranted` remains false throughout.
- The initial EV-14 compatibility attempt modeled EV-13's historical zero-decision closeout by injecting `decisionRecordCount=0` while EV-14 authorization separately validated live decision history. Trusted review later rejected that production override because it hid the newly committed EV-14 decision from EV-13 current-state evidence; the corrected live-history behavior is recorded below.
- Documented EV-14's permanent enforcement, source-of-truth, proof-preservation, independent-review, and rollback rules in `AGENTS.md`.

### Evidence

Immutable implementation candidate `155284dc1ca13cf2d86af9bf9a0d127ad7840604` passed EV-12 Failure Recurrence Calibration run `38575027310`, EV-13 Antibody Governance run `38575027418`, and Agent Orchestration run `38575027474`.

EV-14 Antibody Promotion run `38575027357` passed its `promotion-gate` job. Exact-SHA artifact `11899656942` (`antibody-promotion-382-155284dc1ca13cf2d86af9bf9a0d127ad7840604`) has GitHub Actions digest `sha256:a4d657a2dae4ff4a4946886ae1ba61a37538738b4fced2120562485b0a2a81f2`. The evidence records the selected truth/proposal and exact pinned governance inputs, `falsePositives=0`, `falseNegatives=0`, a passing canonical baseline, both dishonest mutations detected, and rollback recomputation with the EV-14 blocking decision disabled.

PR Candidate Verification run `38575027173` on the same exact implementation SHA passed the authoritative full repository verification/production build, promoted verification gates, mechanical architecture invariants, exact candidate web bundle, independent-review context generation, APK construction/integrity/delivery, API 35 product smoke, API 36 large-screen smoke, and aggregate Android verification. Browser E2E was correctly skipped by scope because EV-14 changes only verification/governance surfaces. The final candidate job failed only at the expected missing exact-SHA independent-review decision step before this closeout transition.

Exact-SHA web-bundle artifact `11900087313` has digest `sha256:46b3ae35dda0e9f10dc76e9a136f4d7f87a8d58212b88d25d37ddcfe98e6f31e`. Independent-review context artifact `11900485646` has digest `sha256:df69b46550aea4239e1da580d163cc07240cdd6073f188814aca8a2029b11a6e`. APK artifact `11899393513` has digest `sha256:3a1f83388fb53d49ce0dc27e214f2908856949afd4128618d1c0e7b73044b3d8`. API 35 artifact `11899753936` has digest `sha256:423b25ea0736657e54205749d68fea2276a9d9d147e80adfc143ce40acf28153`; API 36 large-screen artifact `11901710725` has digest `sha256:6bd94660fd4333c546b3263a733f40537d2381375d32230055b1f2d3dc4e7465`.

The first EV-14 authorization attempt on predecessor `edb4a6626ad4ac9e5512adb4bd207b3e2faa094d` failed closed because authorization scratch files were created inside the exact-candidate checkout; EV-13 correctly rejected the dirty workspace. The same branch moved reconstructed review inputs into `$RUNNER_TEMP`. On `155284dc1ca13cf2d86af9bf9a0d127ad7840604`, authorization then reached the trusted-review lookup and failed only because no EV-14 review existed yet, proving the clean-checkout defect was corrected without weakening governance.

This archive transition follows the repository's independent-review self-reference rule. It records the immutable technically complete pre-archive implementation candidate and its measured exact-SHA proof set. The resulting closeout SHA cannot literally contain its own Git SHA because that SHA depends on these archive contents, so it must pass all technically available exact-head gates, receive a fresh trusted EV-14 review from an authorized reviewer/requester independent of the PR author, and pass EV-14 governance authorization before merge. No review verdict or final candidate proof is inherited from `155284dc1ca13cf2d86af9bf9a0d127ad7840604`.

### Isolation and rollback

EV-14 changes verification/governance only. It reuses the existing candidate-artifact regression rather than changing product/runtime behavior or creating a parallel proof producer. The promotion gate reads committed policy/governance/calibration/failure-memory/decision state, mutates source text only in in-memory calibration strings, writes ephemeral exact-SHA CI reports, and cannot grant candidate acceptance.

Rollback is deterministic: set `IRONSHADE_ANTIBODY_ENFORCEMENT=0` to run the same pinned policy, decision-intent, canonical-source, and calibration checks while removing only EV-14's blocking decision. The original candidate-artifact wrong-SHA/tamper/file-inventory checks remain required, EV-4 failure history and EV-13 append-only governance history remain intact, and unrelated full-build, browser, Android/APK, exact-SHA, architecture-invariant, and independent-review acceptance semantics are unchanged.

### Promotion status

Promoted only for `candidate-artifact-integrity-drift` through its existing canonical candidate-artifact regression. `android-screenshot-capture-transport-timeout` and all EV-12 advisory/ambiguous recurrence classes remain unpromoted. The next experimental task is EV-15.


### EV-14 trusted-review hardening

Trusted review run `38582693230` (PR comment `6171010931`) on exact candidate `3d0c06d33ddf82faa065ff3bb93c08eec85a6714` accepted the selected antibody scope, zero-error promotion calibration, rollback isolation, full production build, Agent Orchestration, architecture invariants, installable APK, API 35 smoke, API 36 large-screen smoke, and aggregate Android proof. It returned `fail` for one major trust-boundary defect: the EV-13 evidence workflow hard-coded `decisionRecordCount=0`, causing post-EV-13 current-state evidence to hide the committed EV-14 decision and synthesize EV-13's historical closeout predicate.

The same branch removed that production override. EV-13 current-state evidence now enumerates the actual committed `agent/antibody-decisions/` directory, requires later decision history to remain visible, preserves `allowCommittedDecisionsInEv13=false` as the historical EV-13 rule, and explicitly reports that the old EV-13 closeout predicate no longer applies once a later decision exists. `agent/tests/antibody-governance-current-state.mjs` reproduces the rejected zero-count spoof and requires current-state verification to reject it. Historical EV-13 zero-decision fixtures remain test/archive evidence only and cannot override live repository history.

This review-driven correction changes the candidate SHA, so no proof or verdict from `3d0c06d33ddf82faa065ff3bb93c08eec85a6714` is inherited. The exact corrected closeout candidate must rerun every technically available EV-14 proof and receive a fresh trusted EV-14 independent review and governance authorization before merge.

## EV-15 — Calibrate EV-5 Change-Impact Predictions

Completed 2026-10-14 as an advisory calibration of the EV-5 affected-verification mechanism. The original EV-5 prototype record above remains unchanged advisory history.

### Implemented

- Added reviewed `agent/impact-calibration-corpus.json` with two immutable exact-SHA successful full-verification controls, two independent executable UI miss probes, a minimum of two independent target misses before any widening may be named, and zero false-positive/false-negative widening-decision budgets.
- Added `agent/tools/impact-calibration-evidence.mjs` and `agent/tests/impact-calibration-evidence.mjs`. The evidence path reuses the existing `agent/impact-map.json` selector, proves the predicted focused commands first, then injects a disposable client-TypeScript type error and runs authoritative `npm run verify:full` to expose any missed proof. Every probe restores the exact candidate tracked state before the next probe or report is accepted.
- Added `.github/workflows/ev15-impact-calibration.yml` with exact-head checkout, full Git history for historical-SHA validation, deterministic contract regressions, executable calibration, fail-closed report validation, and exact-SHA artifact upload.
- Kept `agent/impact-map.json` unchanged. EV-15 remains `mode="advisory"`, `acceptedForEnforcement=false`, and `candidatePassGranted=false`; EV-16 owns any reviewed default widening.
- Documented the permanent EV-15 calibration, confidence, unresolved-class, no-narrowing, exact-rollback, and EV-16 handoff contract in `AGENTS.md`.

### Evidence

The first exact-head calibration attempt on candidate `566f9cbe313dde4e50ff434d87ac91029f3b0ca7` passed the pure contract regression but failed its own executable rollback assertion because authoritative full verification generated tracked build artifacts after the disposable source mutation. The same branch corrected the evidence runner to restore the entire tracked worktree from exact `HEAD` in a `finally` path and then require byte-identical target content plus the original clean tracked status. The calibration goal, selector expectations, zero-error budgets, and advisory boundary were unchanged.

Corrected implementation candidate `295ec87024e34be6d724cee60fa432b375712a96` passed EV-15 Impact Calibration run `38624196233` and Agent Orchestration run `38624196209`. Exact-SHA EV-15 artifact `11923980804` (`impact-calibration-ev15-383-295ec87024e34be6d724cee60fa432b375712a96`) has GitHub Actions digest `sha256:5acf0a2ab2429a01868bda7de61b846cd6f82f89f29d4eff8c947f4ea093ae53`.

Both independent UI probes were predicted as `mode="targeted"` by `ui-and-design-system`, selecting only `ui-readability` and `design-system`. Both selected focused commands succeeded, while `npm run verify:full` then failed in the unpredicted `test:beta` TypeScript proof on the injected mismatch. The measured selector scope therefore records `falseNegativeCount=2/2`, false-negative rate `1.0`, and trial over-selection rate `1.0` for these two typecheck defects because neither selected focused check detected the mutation. This result is a calibration of this measured rule/defect class, not a claim about unmeasured UI failures.

The widening-decision calibration itself recorded `falsePositiveWidenings=0` and `falseNegativeWidenings=0` under zero-error budgets. With two independent target misses, the single safe widening candidate is `ui-and-design-system -> risk: high`, which reuses the existing fail-safe `verify-full` path. Its observed miss rate is `1.0`; the Wilson 95% interval is approximately `0.34238–1.0`, so the evidence supports widening but not narrowing or a completeness claim. The two historical successful-full-verification controls remain no-narrowing evidence only: P28-PLOAD1 (`207274334514594547afe5eca8530cdea02f3687`, run `38115851910`) and EV-10 (`7f0628b23a0127d59eae081ef61d7a51a6ae2402`, run `38440867525`).

Every other normal-risk impact-map rule remains unresolved because EV-15 did not establish two independent executable misses for it. Existing high-risk build/dependency, Android, and CI classes remain already fail-safe and were not narrowed. The exact report records `defaultImpactMapChanged=false`, `enforcementEnabled=false`, and `sourceMutationsRestored=true`.

This archive transition follows the repository's independent-review self-reference rule. It records the immutable pre-archive implementation candidate and measured exact-SHA calibration evidence. The resulting closeout SHA cannot literally contain its own Git SHA because that SHA depends on these archive contents, so it must pass fresh exact-head technical gates and a fresh trusted EV-15 independent review before merge; no predecessor verdict or candidate proof is inherited from `295ec87024e34be6d724cee60fa432b375712a96`.

### Isolation and rollback

EV-15 changes verification/governance only. Executable probes mutate one tracked component at a time inside the exact GitHub Actions checkout, run the current selector's focused commands and the authoritative full verifier, then restore the complete tracked worktree from exact `HEAD` and prove the source digest/status match the pre-probe candidate. Historical observations are immutable exact-SHA references, and the workflow writes only ephemeral report state before artifact upload.

Rollback is deterministic: remove `.github/workflows/ev15-impact-calibration.yml`, `agent/impact-calibration-corpus.json`, `agent/tools/impact-calibration-evidence.mjs`, `agent/tests/impact-calibration-evidence.mjs`, and the EV-15 entries in `AGENTS.md`. The pre-EV-15 EV-5 advisory observer, static `agent/impact-map.json`, product/runtime state, full build, browser/Android/APK, exact-SHA evidence, architecture invariants, and trusted independent-review gates remain unchanged.

### Promotion status

Calibration complete; no default enforcement was promoted in EV-15. Only the measured `ui-and-design-system -> risk: high / verify-full` widening is eligible for EV-16 review. All other normal-risk classes remain unresolved/experimental, existing high-risk classes remain fail-safe, and the next experimental task is EV-16.
