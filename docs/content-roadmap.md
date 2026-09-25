# Ironshade Vector — Active Production Roadmap

Only active/future executable work lives here. Completed and verified work belongs in [content-roadmap-archive.md](./content-roadmap-archive.md). Stable product rules live in [product-constraints.md](./product-constraints.md).

## Execution contract

- Execute top to bottom. The **first unchecked top-level item is next** unless the user explicitly changes priority.
- One checkbox should fit one realistic **implement → test → build → APK verification** cycle.
- Split an item before coding if it spans independent systems or verification cycles; combine tiny changes when they touch the same system and can be verified together.
- An item is complete only when its requested behavior works, relevant regression checks pass, the production build succeeds, and the Android deliverable is verified as required by the repository workflow.
- After verified completion, move the completion detail/evidence to the archive and remove the item from this file.
- If repository evidence shows an active item is already complete, verify that evidence before archiving it. If only part is complete, rewrite the item around the remaining work.

## P19 — Glance-First Adaptive UI

- [x] **P19-I — Dedicated item info popup** — Make every Loadout and Ship Storage item card open its comparison/details in a dedicated modal window layered above the Armory instead of an inline or side inspector. The modal must be visibly separate from the storage layout, include its own backdrop, preserve the existing quick comparison, Details disclosure, equip/unequip/discard actions, requirement states, Escape/Back to storage dismissal, and restore the player's storage context after closing. Use the same popup model on desktop and compact/coarse-pointer Android layouts. **Done when:** tapping/clicking an item always opens an immediately visible dedicated item-info popup, Browser E2E verifies modal/dialog semantics and preserved context on desktop + mobile-landscape, existing Android inspector behavior passes with explicit modal verification, production build passes, and a verified APK is delivered.
