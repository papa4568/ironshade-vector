# Agent orchestration files

`task-graph.json` tracks the progressive AO-* migration itself.

`roadmap-metadata.json` is the machine-only sidecar for `docs/content-roadmap.md`. It intentionally does not duplicate product titles, descriptions, or `Done when` acceptance text. Those are parsed from the Markdown roadmap at runtime.

Useful commands:

```bash
node agent/tools/validate-task-graph.mjs
node agent/tools/next-task.mjs
node agent/tools/sync-roadmap-metadata.mjs --check
node agent/tools/sync-roadmap-metadata.mjs --write
node agent/tools/roadmap-adapter.mjs --validate-only
node agent/tools/roadmap-adapter.mjs --json
node agent/tests/task-graph.mjs
node agent/tests/roadmap-adapter.mjs
```

During compatibility mode, the Markdown roadmap remains authoritative for product task order and acceptance. The sidecar supplies machine-readable domains, proof profiles, and optional dependencies.
