# Agent orchestration files

`task-graph.json` tracks the progressive AO-* migration itself.

`roadmap-metadata.json` is the machine-only sidecar for `docs/content-roadmap.md`. It intentionally does not duplicate product titles, descriptions, or `Done when` acceptance text. Those are parsed from the Markdown roadmap at runtime.

`impact-map.json` maps changed repository paths to affected domains and focused iteration checks. Recognized low-risk changes use targeted verification; unclassified files and high-risk build/dependency/Android/CI changes intentionally escalate to `npm run verify:full`. This selection does not replace final roadmap proof gates.

`candidate-manifest.schema.json` and `verification-ledger.schema.json` define exact-candidate evidence. `candidate-evidence.mjs` generates manifests from a real git base/head range, hashes the task acceptance and canonical manifest, records proof/artifact/external-QA evidence, and rejects evidence from a different candidate revision.

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
node agent/tests/task-graph.mjs
node agent/tests/roadmap-adapter.mjs
node agent/tests/affected-verification.mjs
node agent/tests/candidate-evidence.mjs
```

During compatibility mode, the Markdown roadmap remains authoritative for product task order and acceptance. The roadmap sidecar supplies machine-readable domains, proof profiles, and optional dependencies. The impact map only optimizes implementation-time verification; final build/CI/Android/APK requirements still come from the selected task's proof obligations.

For an AO migration PR with an `active`/`verifying` task, Agent Orchestration CI explicitly checks out the pull request head SHA, generates the exact candidate manifest, validates it against git, and—after the validation job passes—uploads a manifest + strict verification ledger artifact. Evidence from another SHA is invalid even if the branch name or task ID matches.
