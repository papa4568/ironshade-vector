# Ironshade Vector — Active Production Roadmap

## New-chat handoff — resume here first

- All previously completed P20–P23 work plus P24-A–P24-D and verified P25 work is preserved in [content-roadmap-archive.md](./content-roadmap-archive.md).
- The 2026-09-29 code audit has been reduced to **release-critical work only**. Non-blocking cleanup/refactor ideas were removed from the active queue.
- Priority order is intentional: **P25 release/platform/security → P26 telemetry scale resilience**.
- **Next executable item: P25-E — Run service validation on service-only pull requests.**

Only active/future executable work lives here. Completed and verified work belongs in [content-roadmap-archive.md](./content-roadmap-archive.md). Stable product rules live in [product-constraints.md](./product-constraints.md).

## Execution contract

- Execute top to bottom. The **first unchecked top-level item is next** unless the user explicitly changes priority.
- One checkbox should fit one realistic **implement → test → build → APK verification** cycle.
- Split an item before coding if it spans independent systems or verification cycles; combine tiny changes only when they touch the same system and can be verified together.
- An item is complete only when its requested behavior works, relevant regression checks pass, the production build succeeds, and the Android deliverable is verified as required by the repository workflow.
- After verified completion, move the completion detail/evidence to the archive and remove the item from this file.
- If repository evidence shows an active item is already complete, verify that evidence before archiving it. If only part is complete, rewrite the item around the remaining work.

## P25 — Release, Platform, and Security Blockers

- [ ] **P25-E — Run service validation on service-only pull requests** — Update PR triggers so changes to `netlify/functions/**`, service configuration, service mocks, and network/service tests run the relevant strict typecheck plus `test:service`/`test:network` before merge, without forcing unnecessary Android work.

- [ ] **P25-F — Align the declared and CI npm toolchain** — Resolve the repository declaration of `npm@10.9.8` versus workflows installing `npm@11.19.1`. Pin one supported version everywhere and verify `npm ci` plus the full production build under that exact version.

## P26 — Telemetry Scale Resilience

These become mandatory before public telemetry volume is allowed to grow materially. They are intentionally after correctness/release blockers because the current game can operate without global metrics.

- [ ] **P26-A — Make healthy Operations metrics reads independent of total ledger size** — Remove the unconditional full accepted-run enumeration from normal `/api/operations` reads. Use the stored aggregate as the fast path with a bounded consistency/version signal so healthy reads remain effectively O(1) as run history grows.

- [ ] **P26-B — Bound telemetry reconciliation work** — Rebuild stale aggregates through explicit pagination/batching rather than serially fetching the entire run ledger in one request. Add large-ledger/multi-page coverage, contention recovery, and no-double-counting verification.
