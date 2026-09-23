# Ironshade Vector — Active Production Roadmap

Only active/future executable work lives here. Completed and verified work belongs in [content-roadmap-archive.md](./content-roadmap-archive.md). Stable product rules live in [product-constraints.md](./product-constraints.md).

## Execution contract

- Execute top to bottom. The **first unchecked top-level item is next** unless the user explicitly changes priority.
- One checkbox should fit one realistic **implement → test → build → APK verification** cycle.
- Split an item before coding if it spans independent systems or verification cycles; combine tiny changes when they touch the same system and can be verified together.
- An item is complete only when its requested behavior works, relevant regression checks pass, the production build succeeds, and the Android deliverable is verified as required by the repository workflow.
- After verified completion, move the completion detail/evidence to the archive and remove the item from this file.
- If repository evidence shows an active item is already complete, verify that evidence before archiving it. If only part is complete, rewrite the item around the remaining work.
