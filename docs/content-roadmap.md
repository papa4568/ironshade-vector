# Ironshade Vector — Active Production Roadmap

Only active/future work lives here. Completed work is moved to [content-roadmap-archive.md](./content-roadmap-archive.md) after merge + verification.

## Execution Rules

- **One checkbox = one realistic implementation/test/merge cycle.**
- **Combine small tasks** when they touch the same system/files and can be verified together without turning into a long-running task.
- **Split long tasks first.** If a task spans several major systems, large asset work, or independent QA cycles, divide it into smaller batches before coding.
- **Archive on completion.** Move completed checklist detail and delivery notes to `docs/content-roadmap-archive.md`; keep this file lean.
- **Research when uncertain.** If the best path is unclear after inspecting Ironshade's existing code/patterns, do focused **Path of Exile 2** research for inspiration before choosing a direction. Prefer current official/first-party sources when available, supplement with strong community analysis when useful, adapt the design lesson instead of copying it, and stop researching once the implementation question is answered.
- Build the premium version first; solve device differences with adaptive quality, LODs, pooling, streaming, code splitting, and measured budgets before cutting mechanics.
- Protect frame pacing, input latency, memory/thermal stability, save integrity, deterministic QA, readable combat tells, and touch/controller usability.

## AAA Production Standard

Target: **premium console/PC-quality ARPG presentation on modern phones**.

- World state should communicate rarity, modifiers, status, boss phases, hazards, and interactions through model/animation/material/VFX/audio before HUD text.
- Major combat actions synchronize targeting, animation, sound, VFX, camera response, and haptics where supported.
- Performance scaling removes secondary cost before enemy mechanics, class identity, boss complexity, or encounter density.
- High-end devices get a visibly richer quality mode.

## Locked Design Decisions

- Vanguard = **Breacher**
- Vector = **Rail Lance**
- Systems = **Carbine**
- No cross-family runtime weapon swapping.
- No per-item skill linking; skills belong to the class kit.
- FIRE and targeted skills acquire/focus first, then execute; manual aim and explicit ground/self/mobility skills remain authoritative exceptions.
- Progression becomes a large layered graph with routing costs, major tradeoffs, specialization integration, planning/search tools, and build-defining nodes.
- Crafting uses visible affix rules, meaningful bases, distinct verbs, escalating control, rare deterministic options, and optional high-risk operations.
- Current two-tier ship systems are prototypes; final systems are much harder to finish and much more beneficial.

## P6 — T9–T12 Directive Expansion

P6.1–P6.3 and P6-A/P6-B/P6-C/P6-D/P6-E are archived.

## P7 — Loot Rarity & Equipment Presentation

P7-A/P7-B/P7-C/P7-D/P7-E are archived after merge + verification.

## P8 — Targeting & Class Arsenal Identity

- [x] **P8-A Target acquisition** — archived after merge + verification
- [x] **P8-B Target control** — archived after merge + verification
- [x] **P8-C Target feedback/QA** — archived after merge + verification
- [x] **P8-D Hard arsenal lock + migration** — archived after merge + verification
- [x] **P8-E Loot/UI/tutorial ownership** — archived after merge + verification
- [x] **P8-F Handling identity** — archived after merge + verification
- [x] **P8-G Class-owned skill migration** — archived after merge + verification
- [x] **P8-H Skill UI + regression** — archived after merge + verification

## P8.5 — Gear 2.0 // Build-Defining Itemization

Goal: make equipment answer **“What could I build around this?”** instead of acting like a stack of overlapping gear-score multipliers. Preserve Ironshade's hard-sci-fi identity and existing strong concepts while consolidating them into one data-driven item system.

- [x] **P8.5-A Gear architecture audit + target schema** — archived after merge + verification
- [x] **P8.5-B Power-axis consolidation** — archived after merge + verification
- [x] **P8.5-C Meaningful base-frame families** — archived after merge + verification
- [x] **P8.5-D Stat registry + local/global scope + build tags** — archived after merge + verification
- [x] **P8.5-E Affix pools + conflicts + rarity budgets** — archived after merge + verification
- [x] **P8.5-F Loot generation + anti-junk rules** — archived after merge + verification
- [x] **P8.5-G Class/specialization gear integration** — archived after merge + verification
- [x] **P8.5-H Quality + Augment responsibility pass** — archived after merge + verification
- [x] **P8.5-I Singular chase-item audit** — archived after merge + verification
- [x] **P8.5-J Mobile Armory + build-link comparison** — archived after merge + verification
- [x] **P8.5-K Save/data migration + compatibility** — archived after merge + verification
- [x] **P8.5-L Balance/diversity/regression gate** — archived after merge + verification

## P9 — Progression 2.0 // Deep Operator Network

Target roughly **120–180 authored nodes**, delivered in bounded waves.

- [x] **P9-A Graph architecture** — archived after merge + verification
- [x] **P9-B Core node wave** — archived after merge + verification
- [x] **P9-C Build-defining wave** — archived after merge + verification
- [x] **P9-D Specialization integration** — archived after merge + verification
- [x] **P9-E Planner UX** — archived after merge + verification
- [x] **P9-F Respec/migration/diversity QA** — archived after merge + verification

## P10 — Crafting 2.0 // Reconstruction Economy

- [x] **P10-A Rules foundation** — archived after merge + verification
- [x] **P10-B Verbs/materials** — archived after merge + verification
- [x] **P10-C Control vs risk** — archived after merge + verification
- [x] **P10-D Build integration** — archived after merge + verification
- [x] **P10-E Crafting UX/trust** — completed and verified; confirm-first exact-cost/outcome/risk review, before/after state, persistent craft receipts, and salvage-loop context are archived in `docs/content-roadmap-archive.md`.
- [x] **P10-F Economy + touch QA** — completed and verified; campaign-to-T12 material pacing, chase-resource pressure, Reconstruction affordability, D-pad/A/B crafting navigation, and 48px coarse-pointer targets are archived in `docs/content-roadmap-archive.md`.

## P11 — Ship Systems 2.0

Target roughly **6 major tiers per system** with sub-milestones.

- [x] **P11-A Architecture/migration** — completed, merged, verified, and archived in `docs/content-roadmap-archive.md`
- [x] **P11-B Engineering wave** — completed, merged, verified, and archived in `docs/content-roadmap-archive.md`
- [x] **P11-C Support wave** — completed, merged, verified, and archived in `docs/content-roadmap-archive.md`
- [x] **P11-D Advanced specialization** — completed, merged, verified, and archived in `docs/content-roadmap-archive.md`
- [x] **P11-E Physical payoff** — completed, merged, verified, and archived in `docs/content-roadmap-archive.md`
- [x] **P11-F Economy/balance QA** — completed, merged, verified, and archived in `docs/content-roadmap-archive.md`

## P12 — AAA Combat Feel

- [x] **P12-A Weapon audio** — completed, merged, verified, and archived in `docs/content-roadmap-archive.md`
- [x] **P12-B Impact/environment audio** — completed, merged, verified, and archived in `docs/content-roadmap-archive.md`
- [x] **P12-C Information mix** — completed, merged, verified, and archived in `docs/content-roadmap-archive.md`
- [x] **P12-D Player handling animation** — completed, merged, verified, and archived in `docs/content-roadmap-archive.md`
- [x] **P12-E Skill/damage animation** — completed, merged, verified, and archived in `docs/content-roadmap-archive.md`
- [x] **P12-F Enemy/boss animation** — completed, merged, verified, and archived in `docs/content-roadmap-archive.md`
- [x] **P12-G Camera/haptics/perf** — completed, merged, verified, and archived in `docs/content-roadmap-archive.md`

## P13 — Enemy Modifier & Status Visual Language

- [x] **P13-A Presentation framework** — completed, merged, verified, and archived in `docs/content-roadmap-archive.md`
- [x] **P13-B T9 visuals I** — completed, merged, verified, and archived in `docs/content-roadmap-archive.md`
- [ ] **P13-C T9 visuals II** — Redline Bus, Countermass Rig, Relay Reflex
- [ ] **P13-D Protocol visuals** — physical/animated tells for elite protocols + enhanced variants
- [ ] **P13-E Player statuses** — mark, armor break, Arc/disruption, thermal, vacuum/pressure, stagger
- [ ] **P13-F Boss/spawn/death language** — phase transitions, dangerous-combo readiness cues, disable/death persistence
- [ ] **P13-G Mobile readability/HUD reduction** — preserve tells at LOD2; remove redundant tags only after screenshot/video QA

## P14 — Class Arsenal Expansion

- [ ] **P14-A Systems Carbine pair** — Burst + Precision Carbine
- [ ] **P14-B Vanguard Breacher pair** — Slug + Rapid Breacher
- [ ] **P14-C Vector Rail pair** — Charge + Repeater Rail
- [ ] **P14-D Build integration** — progression, crafting/affixes, skills, Singulars, class-owned loot
- [ ] **P14-E Presentation/playtest** — silhouettes, handling animation, layered audio, sustained-fire thermal QA, same-family variety
- [ ] **P14-F Fourth-family gate** — add only with a future class or genuinely distinct combat role

## P15 — AAA UI / World / Cinematic Polish

- [ ] **P15-A Design system** — typography, spacing, iconography, focus, rarity tokens, panels/tooltips, responsive rules
- [ ] **P15-B Build/menu presentation** — class selection, progression/crafting/systems coherence, fast transitions, optional 3D gear inspection
- [ ] **P15-C Mission/boss/debrief** — deployment sequence, concise in-engine boss transitions, highlights/loot/progression/next unlock
- [ ] **P15-D World/material polish** — consoles/doors/machinery/pickups/hazards, lighting/material depth, biome state animation/audio
- [ ] **P15-E Accessibility/mobile/screenshot gate** — scalable text, contrast, reduced motion, effect/audio/assist controls, safe areas/orientation

## P16 — Performance Without Compromise

- [ ] **P16-A Measurement** — device tiers + separate CPU/render/GPU/UI/animation/audio/GC budgets
- [ ] **P16-B Rendering scalability** — dynamic resolution, instancing, texture/material memory, shadow/reflection/effect priority
- [ ] **P16-C Runtime scalability** — pooling, animation LOD, audio virtualization, asset streaming/preload
- [ ] **P16-D Boot architecture** — split feature/presentation data; track boot cost diagnostically without hard bundle/chunk byte-size caps
- [ ] **P16-E Soak/stress QA** — 30-minute thermal soak, worst-case T12 scene, frame pacing, memory/leak soak
- [ ] **P16-F Quality modes/device QA** — richer flagship mode, mechanics-preserving performance mode, Android device-tier playthrough

## P17 — External Beta / Delivery

- [ ] **P17-A Signing/upgrade path** — permanent credentials, release-signed APK, clean/upgrade verification
- [ ] **P17-B Durable distribution** — GitHub Release workflow, non-expiring APK, release notes/changelog
- [ ] **P17-C Save/release policy** — migration/rollback/recovery expectations
- [ ] **P17-D External beta candidate** — final install/upgrade/package/runtime/touch/campaign QA

## Execution Order

**P6 → P7 → P8 → P8.5 → P9 → P10 → P11 → P12 → P13 → P14 → P15 → P16 → P17**

## Immediate Queue

**Next: P13-C — T9 visuals II.**

Run **P13-C — T9 visuals II** as the next Enemy Modifier & Status Visual Language batch: use the P13-A presentation contract to give Redline Bus, Countermass Rig, and Relay Reflex distinct authored/fallback animation, material, VFX, and audio reads while preserving attack/status tell priority and mobile readability.

After each merged/verified batch: mark complete → archive detail/delivery note → advance to the next smallest coherent batch.

## Latest Verified Delivery

- Android beta: **0.0.1-beta.278**
- Package: `app.ironshade.vector`
- Verified: **P13-B Enemy Modifier & Status Visual Language T9 visuals I complete**
- Gameplay source: `2ec4374fc99100ba5c7d2bd6fbaa1d81707bfda2`
- PR Browser E2E: `35801722190` (caught stale graphics integration assertion before final merge)
- Browser E2E: `35802067788`
- Level 15 beta smoke: `35802067844`
- Android beta.278: `35802067794`
- APK artifact: `10726617221`
- APK SHA-256: `2255ea57332bd34153ca8659a8c7aced7d351b816cf5bcba21075ab1150cdb73`
- Signing: debug-signed beta; permanent signing is P17-A
