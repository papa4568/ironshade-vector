# Ironshade Vector — Active Production Roadmap

Only active/future executable work lives here. Completed and verified work belongs in [content-roadmap-archive.md](./content-roadmap-archive.md). Stable product rules live in [product-constraints.md](./product-constraints.md).

## Execution contract

- Execute top to bottom. The **first unchecked top-level item is next** unless the user explicitly changes priority.
- One checkbox should fit one realistic **implement → test → build → APK verification** cycle.
- Split an item before coding if it spans independent systems or verification cycles; combine tiny changes when they touch the same system and can be verified together.
- An item is complete only when its requested behavior works, relevant regression checks pass, the production build succeeds, and the Android deliverable is verified as required by the repository workflow.
- After verified completion, move the completion detail/evidence to the archive and remove the item from this file.
- If repository evidence shows an active item is already complete, verify that evidence before archiving it. If only part is complete, rewrite the item around the remaining work.

## P16 — Performance Without Compromise

- [ ] **P16-E — Soak/stress QA** — run 30-minute thermal soak, worst-case T12 stress, frame-pacing, memory, and leak checks. **Done when:** the defined stress scenarios complete without unacceptable thermal/memory/frame-pacing degradation or unresolved leaks/crashes.
- [ ] **P16-F — Quality modes/device QA** — finalize richer flagship mode and mechanics-preserving performance mode, then verify across representative Android device tiers. **Done when:** quality modes visibly differ, performance scaling preserves mechanics/readability, settings persist correctly, and device-tier playthrough QA passes.

## P17 — External Beta / Delivery

- [ ] **P17-A — Signing/upgrade path** — establish permanent Android signing credentials/process and verify clean install plus upgrade. **Done when:** a release-signed build installs cleanly, upgrades an existing supported build without data loss, signing identity is verified, and the documented process is reproducible.
- [ ] **P17-B — Durable distribution** — create the GitHub Release workflow for a non-expiring APK plus release notes/changelog. **Done when:** a tagged release produces the intended durable downloadable APK and release metadata through the repository workflow.
- [ ] **P17-C — Save/release policy** — define and implement migration, rollback, recovery, and compatibility expectations for external releases. **Done when:** supported upgrade/recovery paths are documented and covered by the relevant save/migration verification.
- [ ] **P17-D — External beta candidate** — perform final install/upgrade/package/runtime/touch/campaign QA on the release candidate. **Done when:** all release gates pass on the candidate artifact and no unresolved release-blocking defects remain.
