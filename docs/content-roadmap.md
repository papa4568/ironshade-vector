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

Preserve Ironshade's existing hard-sci-fi art direction, rarity language, panel treatment, class control scheme, accessibility foundation, progressive-disclosure primitives, and requirement-state system. This phase changes information priority and compact-phone composition rather than reskinning the game.

- [ ] **P19-H — Armory inspector opens in the current viewport** — Fix Loadout item selection so clicking/tapping an equipped or Ship Storage card immediately presents the comparison inspector from the player's current Armory scroll position, including wide fine-pointer layouts that currently shrink the storage grid and leave an empty comparison column until the player scrolls upward. Use a viewport-anchored sheet/side-panel or equivalent established inspector behavior rather than moving the player to the top; preserve the selected card and outer storage scroll position for dismissal, and retain existing Back to storage, backdrop, Details disclosure, requirement-state, keyboard/controller, and coarse-pointer behavior. Add desktop Browser E2E coverage that scrolls Ship Storage, selects a visible item, proves the inspector header/quick read/action dock are immediately onscreen without a forced outer-scroll jump, closes it, and confirms the storage context is preserved; keep the existing Android inspector/runtime coverage passing. **Done when:** selection from a scrolled Armory position opens a usable inspector immediately on wide desktop and compact/coarse-pointer layouts, no blank reserved comparison column or manual scroll-up is required, dismissal preserves context, and targeted regression, production build, Browser E2E, and Android APK/runtime verification all pass.
