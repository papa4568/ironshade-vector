# Agent orchestration files

`task-graph.json` tracks the progressive AO-* migration itself.

`roadmap-metadata.json` is the machine-only sidecar for `docs/content-roadmap.md`. It intentionally does not duplicate product titles, descriptions, or `Done when` acceptance text. Those are parsed from the Markdown roadmap at runtime.

`impact-map.json` maps changed repository paths to affected domains and focused iteration checks. Recognized low-risk changes use targeted verification; unclassified files and high-risk build/dependency/Android/CI changes intentionally escalate to `npm run verify:full`. This selection does not replace final roadmap proof gates.

`candidate-manifest.schema.json` and `verification-ledger.schema.json` define exact-candidate evidence. `candidate-evidence.mjs` generates manifests from a real git base/head range, hashes the task acceptance and canonical manifest, records proof/artifact/external-QA evidence, and rejects evidence from a different candidate revision.

`candidate-artifact.mjs` creates and verifies deterministic manifests for reusable candidate web bundles. The manifest binds every `dist/` file, byte count, file SHA-256, aggregate tree SHA-256, and producing candidate SHA. Browser and Android consumers validate this record before trusting the artifact.

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
node agent/tests/task-graph.mjs
node agent/tests/roadmap-adapter.mjs
node agent/tests/affected-verification.mjs
node agent/tests/candidate-evidence.mjs
node agent/tests/candidate-artifact.mjs
node agent/tests/ci-proof-reuse.mjs
```

During compatibility mode, the Markdown roadmap remains authoritative for product task order and acceptance. The roadmap sidecar supplies machine-readable domains, proof profiles, and optional dependencies. The impact map only optimizes implementation-time verification; final build/CI/Android/APK requirements still come from the selected task's proof obligations.

For PR final verification, `.github/workflows/pr-candidate.yml` is the single producer. It checks out the exact PR head, runs the audit and full repository verification/production build once, emits the SHA-bound candidate web artifact, then fans that same bundle out to reusable Browser E2E and Android workflows. Android then emits one APK artifact consumed by the API 35 and API 36 jobs.

Agent Orchestration CI may upload a partial evidence ledger containing only proofs that job actually observed. Downstream CI proofs remain pending. The PR Candidate workflow emits the complete AO-5 ledger only after browser and Android gates actually pass, preventing premature proof credit.
