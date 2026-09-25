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

- [ ] **P19-G — Compact-phone typography sweep + device acceptance** — Audit the remaining compact-phone UI outside the earlier batches, especially `menuOverhaul.css` and `readability.css`, and eliminate residual 6–9px user-facing labels by either promoting them to the shared mobile type floor or moving secondary material into the Guide/existing disclosure patterns. Preserve desktop/tablet density where it remains readable; do not solve fit by scaling the entire interface down. Capture representative before/after compact-landscape screenshots and use the finished APK for a 6–7 inch Android landscape pass covering combat, Command, Armory, Progression, Skills, Crafting, Ship, Intel, and Guide. **Done when:** targeted compact-phone surfaces have no user-facing 6–9px text declarations left as a fit workaround, critical/decision/secondary hierarchy remains visually distinct, migrated instructional content remains discoverable through Guide links, no horizontal overflow or safe-area regressions appear with default or Large text, final QA records readable text, thumb reach, playfield occlusion, and remaining eye-travel hotspots on a representative 6–7 inch Android device, the full production build succeeds, and the verified APK completes the established mobile/accessibility/runtime smoke suite.
