# Agent orchestration files

`task-graph.json` tracks the progressive AO-* migration itself.

`roadmap-metadata.json` is the machine-only sidecar for `docs/content-roadmap.md`. It intentionally does not duplicate product titles, descriptions, or `Done when` acceptance text. Those are parsed from the Markdown roadmap at runtime.

`impact-map.json` maps changed repository paths to affected domains and focused iteration checks. Recognized low-risk changes use targeted verification; unclassified files and high-risk build/dependency/Android/CI changes intentionally escalate to `npm run verify:full`. This selection does not replace final roadmap proof gates.

`candidate-manifest.schema.json` and `verification-ledger.schema.json` define exact-candidate evidence. `candidate-evidence.mjs` generates manifests from a real git base/head range, hashes the task acceptance and canonical manifest, records proof/artifact/external-QA evidence, and rejects evidence from a different candidate revision.

`candidate-artifact.mjs` creates and verifies deterministic manifests for reusable candidate web bundles. The manifest binds every `dist/` file, byte count, file SHA-256, aggregate tree SHA-256, and producing candidate SHA. Browser and Android consumers validate this record before trusting the artifact.

`architecture-invariants.json` stores deterministic architecture rules that are intended to fail closed when stable boundaries drift. `check-architecture-invariants.mjs` currently protects the renderer/simulation import boundary, the renderer-neutral `GameCanvas` entrypoint, and graphics-asset independence from simulation implementation details.

`INDEPENDENT_VERIFIER.md` defines the separate read-only verifier role. `independent-review.mjs` creates an exact-SHA review packet containing acceptance criteria, changed files, impact selection, required proofs, architecture results, and adversarial questions. It also validates a verifier result and rejects wrong-SHA results or a `pass` verdict with unsupported acceptance/proof claims.

Useful commands:

```bash
node agent/tools/validate-task-graph.mjs
node agent/tools/next-task.mjs
node agent/tools/sync-roadmap-metadata.mjs --check
node agent/tools/sync-roadmap-metadata.mjs --write
node agent/tools/roadmap-adapter.mjs --validate-only
node agent/tools/roadmap-adapter.mjs --json
node agent/tools/select-affected-verification.mjs --validate-only
node agent/tools/select-affected-verification.mjs --files src/game/graphicsAssetManifest.ts,scripts/prepare-refinery-premium-surfaces.mjs
node agent/tools/select-affected-verification.mjs --base main --head HEAD --json
node agent/tools/candidate-evidence.mjs manifest --task active --base main --head HEAD --branch "$(git branch --show-current)" --output .agent-evidence/candidate-manifest.json
node agent/tools/candidate-evidence.mjs validate --manifest .agent-evidence/candidate-manifest.json --verify-git
node agent/tools/candidate-artifact.mjs create --candidate "$(git rev-parse HEAD)" --root dist --output .candidate-artifact/candidate-web.json
node agent/tools/candidate-artifact.mjs validate --candidate "$(git rev-parse HEAD)" --root dist --manifest .candidate-artifact/candidate-web.json
node agent/tools/check-architecture-invariants.mjs
node agent/tools/independent-review.mjs packet --manifest .agent-evidence/candidate-manifest.json --output .independent-review/review-packet.json --verify-git
node agent/tools/independent-review.mjs validate-result --packet .independent-review/review-packet.json --result .independent-review/review-result.json
node agent/tests/task-graph.mjs
node agent/tests/roadmap-adapter.mjs
node agent/tests/affected-verification.mjs
node agent/tests/candidate-evidence.mjs
node agent/tests/candidate-artifact.mjs
node agent/tests/ci-proof-reuse.mjs
node agent/tests/architecture-invariants.mjs
node agent/tests/independent-review.mjs
```

During compatibility mode, the Markdown roadmap remains authoritative for product task order and acceptance. The roadmap sidecar supplies machine-readable domains, proof profiles, and optional dependencies. The impact map only optimizes implementation-time verification; final build/CI/Android/APK requirements still come from the selected task's proof obligations.

For PR final verification, `.github/workflows/pr-candidate.yml` is the single producer. It checks out the exact PR head, enforces the architecture invariants, runs the audit and full repository verification/production build once, emits the SHA-bound candidate web artifact, then fans that same bundle out to reusable Browser E2E and Android workflows. Android then emits one APK artifact consumed by the API 35 and API 36 jobs.

The PR Candidate workflow also creates a separate exact-SHA independent-review context when an AO task is active. Its checkout uses read-only repository permissions with persisted credentials disabled. The packet is evidence for a separate verifier; it is not permission for the verifier to edit the implementation. A failed verifier result goes back to the single implementation owner on the same branch.

Agent Orchestration CI may upload a partial evidence ledger containing only proofs that job actually observed. Downstream CI/review proofs remain pending. The PR Candidate workflow creates complete active-AO evidence only after the candidate build, independent-review context, browser gate when required, and Android gates actually pass.
