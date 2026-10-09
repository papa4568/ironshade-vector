# Ironshade Vector — Agent Map

Keep always-on context small. Read only the documents relevant to the current task.

## Sources of truth

- `docs/content-roadmap.md` — active/future executable product work. Unless the user gives a different task, the first unchecked executable item is next.
- `agent/task-graph.json` — machine-readable orchestration graph. During compatibility mode it is authoritative only for task IDs matching the patterns declared in its `authority.authoritativeForPatterns` field (currently `AO-*`); it does not replace product-roadmap selection yet.
- `agent/roadmap-metadata.json` — machine-only sidecar for the active product roadmap: active ID/order inventory, affected-domain rules, proof profiles, and optional dependency overrides. Product titles/descriptions/acceptance remain authoritative only in `docs/content-roadmap.md`.
- `agent/impact-map.json` — machine-readable change-impact map for selecting focused iteration checks from changed files. Unknown or high-risk impact escalates to `npm run verify:full`; affected-verification selection never replaces a roadmap item's required final proof gates.
- `agent/candidate-manifest.schema.json` and `agent/verification-ledger.schema.json` — exact-candidate evidence contracts. A ledger is valid only when its task, candidate SHA, canonical manifest digest, proof evidence, and artifact identities agree.
- `agent/tools/candidate-artifact.mjs` — exact-SHA web-bundle manifest and integrity verifier used before browser/Android consumers trust a reusable `dist/` artifact.
- `.github/workflows/pr-candidate.yml` — authoritative PR final-candidate orchestrator: one full verification/build producer fans the same verified web bundle out to browser and Android validation.
- `docs/agent-orchestration.md` — migration contract and phased rollout for proof-graph orchestration.
- `docs/experimental-verification-roadmap.md` — opt-in speculative verification-engineering queue (`EV-*`). Never select it automatically; work it only when the user explicitly requests the experimental track or names an `EV-*` item.
- `docs/external-qa.md` — validation that requires unavailable physical hardware, manual inspection, credentials, permissions, or other external access. Do not execute this file as the normal coding queue.
- `docs/content-roadmap-archive.md` — completed work and verification history. Do not execute work from this file.
- `docs/product-constraints.md` — stable product, design, platform, and performance constraints.
- `docs/design-system.md` — shared UI rules for presentation work.
- `docs/android-release-signing.md` — release-signing guidance when Android signing/distribution is relevant.
- `docs/save-release-policy.md` — save compatibility, migration, recovery, and rollback rules for external releases.
- `package.json` — authoritative build and test scripts.

## Execution

- User instructions override roadmap selection.
- During agent-orchestration compatibility mode, normal product/game work still comes from `docs/content-roadmap.md`; do not select P28 or other product work from `agent/task-graph.json` until `docs/agent-orchestration.md` explicitly records the cutover.
- Do not select `docs/experimental-verification-roadmap.md` as fallback or default work. It is an explicit opt-in queue and must not displace product work merely because it contains unchecked items.
- For product-roadmap work, `node agent/tools/roadmap-adapter.mjs` may be used to materialize the Markdown task into machine-readable domains, dependencies, and proof obligations; it must not override Markdown queue order or acceptance text during compatibility mode.
- Work on one roadmap item at a time.
- One roadmap checkbox should fit one focused implementation → targeted test → final verification → APK cycle.
- Split an item before coding when it contains independent implementation or verification cycles.
- Inspect only the code, tests, docs, dependencies, git state, CI evidence, and artifacts needed for the selected task.
- Preserve unrelated changes and existing user data.
- Prefer established project patterns over new abstractions or dependencies.
- During implementation, use `node agent/tools/select-affected-verification.mjs` with the current changed-file set when its map covers the task. Run the selected focused checks first. If the selector reports `mode=full`, treat that as an intentional escalation rather than overriding it manually.
- Affected-verification selection is an iteration aid only. Run the roadmap item's required final production/CI/Android/APK proof gates after the implementation is a credible completion candidate even when the selector recommended a narrower iteration set.
- For PR final verification, do not independently rerun the full repository suite in browser or Android jobs. `.github/workflows/pr-candidate.yml` owns the one exact-head full verification/production build, publishes the SHA-bound candidate web bundle, and downstream browser/Android jobs must validate and consume that artifact.
- When exact-candidate evidence is enabled for the task, generate the candidate manifest from the real base/head commit range and validate it against git before crediting proof evidence. Never reuse proof evidence or artifact identity from a different candidate SHA.
- Do not credit downstream CI proofs before the producing jobs pass. Partial ledgers may record already-proven test/invariant evidence; the complete ledger must be emitted only after all required candidate gates actually succeed.
- A technical failure is work, not a blocker while a concrete next technical action exists. Diagnose from evidence, make the smallest reasonable correction, and change the hypothesis if a fix does not work.
- Do not mark or archive a roadmap item until implementation and all technically available required verification evidence exist.
- If an active item appears already implemented, verify it from code/tests/commit/CI evidence before archiving it.
- If an item is partially complete, keep it active and narrow it to the remaining work rather than marking it done.
- Never treat cancelled, obsolete, superseded, or externally waiting work as completed.

## Git workflow

- One roadmap item normally uses one implementation branch and one pull request.
- Keep implementation fixes, test fixes, CI fixes, and verification corrections on that same branch/PR rather than creating competing implementations or temporary QA PRs.
- The PR head revision is the candidate revision for final verification.
- Candidate-proof CI must explicitly check out that PR head SHA; a synthetic pull-request merge ref is not exact-candidate evidence.
- Evidence records may be produced after successful candidate checks, but every recorded proof and artifact must name the immutable candidate SHA it actually verified.
- The reusable browser and Android workflows are consumers under PR orchestration. Do not re-add independent `pull_request` triggers that would duplicate candidate verification.
- Do not push unfinished implementation directly to `main`.
- Merge only after the required checks for that item pass.
- Create additional branches/PRs only when work is genuinely independent or the existing branch cannot safely represent the change.

## External QA

- Work that cannot be completed with repository/tool access belongs in `docs/external-qa.md`, not in the executable queue.
- External QA may block release acceptance, but it does not block later independent engineering work unless an explicit dependency says otherwise.
- If external QA reveals a code defect or optimization need, create a focused executable roadmap item for that engineering work.

## Roadmap hygiene

- The active roadmap contains only unchecked executable engineering work.
- Checklist order is authoritative; do not maintain a duplicate "next task" section.
- Move verified completion detail to the archive and remove it from the active roadmap.
- Whenever unchecked roadmap IDs or their order change, run `node agent/tools/sync-roadmap-metadata.mjs --write` and commit the resulting `agent/roadmap-metadata.json` change with the roadmap update. CI treats unsynchronized metadata as a failure.
- The experimental verification roadmap has its own opt-in ordering and must not be included in product-roadmap metadata synchronization unless a future explicit migration changes that rule.
- Move hardware/manual/external-only acceptance work to `docs/external-qa.md`.
- Keep permanent rules in `docs/product-constraints.md`, not in the active queue.
