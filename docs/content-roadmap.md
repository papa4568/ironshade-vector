# Ironshade Vector — Active Production Roadmap

Only active/future executable work lives here. Completed and verified work belongs in [content-roadmap-archive.md](./content-roadmap-archive.md). Stable product rules live in [product-constraints.md](./product-constraints.md).

## Execution contract

- Execute top to bottom. The **first unchecked top-level item is next** unless the user explicitly changes priority.
- One checkbox should fit one realistic **implement → test → build → APK verification** cycle.
- Split an item before coding if it spans independent systems or verification cycles; combine tiny changes when they touch the same system and can be verified together.
- An item is complete only when its requested behavior works, relevant regression checks pass, the production build succeeds, and the Android deliverable is verified as required by the repository workflow.
- After verified completion, move the completion detail/evidence to the archive and remove the item from this file.
- If repository evidence shows an active item is already complete, verify that evidence before archiving it. If only part is complete, rewrite the item around the remaining work.

## P17 — External Beta / Delivery

- [ ] **P17-A — Provision permanent signing + upgrade proof** — create and securely back up the permanent Android release keystore, configure all four signing secrets documented in `docs/android-release-signing.md`, then run **Build Android APK** with `require_release_signing=true`. **Done when:** that release-required run succeeds, its release-signed APK clean-installs, its signed baseline upgrades in place without data loss, and the recorded signer SHA-256 identity is retained for future release continuity.
- [ ] **P17-B — Durable distribution** — create the GitHub Release workflow for a non-expiring APK plus release notes/changelog. **Done when:** a tagged release produces the intended durable downloadable APK and release metadata through the repository workflow.
- [ ] **P17-C — Save/release policy** — define and implement migration, rollback, recovery, and compatibility expectations for external releases. **Done when:** supported upgrade/recovery paths are documented and covered by the relevant save/migration verification.
- [ ] **P17-D — External beta candidate** — perform final install/upgrade/package/runtime/touch/campaign QA on the release candidate. **Done when:** all release gates pass on the candidate artifact and no unresolved release-blocking defects remain.
