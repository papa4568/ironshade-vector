# Agent orchestration files

`task-graph.json` tracks the progressive AO-* migration itself.

`roadmap-metadata.json` is the machine-only sidecar for `docs/content-roadmap.md`. It intentionally does not duplicate product titles, descriptions, or `Done when` acceptance text. Those are parsed from the Markdown roadmap at runtime.

`impact-map.json` maps changed repository paths to affected domains and focused iteration checks. Recognized low-risk changes use targeted verification; unclassified files and high-risk build/dependency/Android/CI changes intentionally escalate to `npm run verify:full`. This selection does not replace final roadmap proof gates.

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
node agent/tests/task-graph.mjs
node agent/tests/roadmap-adapter.mjs
node agent/tests/affected-verification.mjs
```

During compatibility mode, the Markdown roadmap remains authoritative for product task order and acceptance. The roadmap sidecar supplies machine-readable domains, proof profiles, and optional dependencies. The impact map only optimizes implementation-time verification; final build/CI/Android/APK requirements still come from the selected task's proof obligations.
