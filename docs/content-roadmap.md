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
- [ ] **P9-C Build-defining wave** — Masteries, Keystones, Capstones, major upside/downside mechanics
- [ ] **P9-D Specialization integration** — LV15/LV16+ subgraphs, campaign/boss unlocks, gear/crafting/faction/Singular hooks
- [ ] **P9-E Planner UX** — search, path preview, point cost, before/after math, planned builds, mobile navigation/controller support
- [ ] **P9-F Respec/migration/diversity QA** — fair experimentation, high-level rebuild costs, safe old-node migration/refunds, representative builds

## P10 — Crafting 2.0 // Reconstruction Economy

- [ ] **P10-A Rules foundation** — Core/Systems structure, rarity counts, tiers/grades, compatibility, visible legal pools, base/frame importance
- [ ] **P10-B Verbs/materials** — improve/add/remove/reroute/replace/lock/elevate/socket/extract with distinct common vs chase resources
- [ ] **P10-C Control vs risk** — deterministic premium control, family locking, targeted edits, elevation, optional risky operations/stability
- [ ] **P10-D Build integration** — class-family pools, specialization recipes, quality, augments, Singular rules
- [ ] **P10-E Crafting UX/trust** — exact costs, guaranteed/possible outcomes, exclusions/risk, before/after, history, salvage loop
- [ ] **P10-F Economy + touch QA** — campaign-to-T12 material simulation and controller/mobile workflow

## P11 — Ship Systems 2.0

Target roughly **6 major tiers per system** with sub-milestones.

- [ ] **P11-A Architecture/migration** — tier schema, dependency graph, steep cost curve, campaign/faction/boss/Directive/Trace gates, fair old-tier conversion
- [ ] **P11-B Engineering wave** — Reactor, Vector Drive, Armor Locker, Long-Baseline Sensors
- [ ] **P11-C Support wave** — Cargo Grid, Microforge, Trauma Bay, Support Drone Rack
- [ ] **P11-D Advanced specialization** — mutually exclusive high-tier packages + prerequisite/resource previews
- [ ] **P11-E Physical payoff** — upgraded ship hardware, authored state animation/audio, major-upgrade ceremony
- [ ] **P11-F Economy/balance QA** — aspirational pacing without trivializing class weaknesses or boss mechanics

## P12 — AAA Combat Feel

- [ ] **P12-A Weapon audio** — layered Breacher/Rail/Carbine mechanical action, discharge/body, near/mid/far tails, repeat variation
- [ ] **P12-B Impact/environment audio** — armor/machinery/ice/steel/glass/field impacts + interior/open/vacuum/pressure acoustics
- [ ] **P12-C Information mix** — reload/vent Foley, class skill audio, enemy/boss tells, priority-aware dynamic mixing
- [ ] **P12-D Player handling animation** — class stance, aim offsets, recoil, reload/charge/vent/overheat, dodge weight
- [ ] **P12-E Skill/damage animation** — anticipation/action/recovery/cancel windows, hit/stagger/armor-break reactions
- [ ] **P12-F Enemy/boss animation** — locomotion/attack tells, phase transitions, additive modifier/status layers
- [ ] **P12-G Camera/haptics/perf** — recoil/impact response, accessibility scaling, synchronized haptics, frame-budget profiling

## P13 — Enemy Modifier & Status Visual Language

- [ ] **P13-A Presentation framework** — composable animation/material/VFX/audio tied to deterministic enemy state
- [ ] **P13-B T9 visuals I** — Reinforced Core, Ablative Mantle, Hunter Servo
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

**Next: P9-C — Build-defining wave.**

Build **P9-C — Build-defining wave** on the verified 69-node core: author Masteries, Keystones, Capstones, and explicit major upside/downside mechanics without weakening the P9-A/P9-B routing, save, class-arsenal, or mobile-readability contracts.

After each merged/verified batch: mark complete → archive detail/delivery note → advance to the next smallest coherent batch.

## Latest Verified Delivery

- Android beta: **0.0.1-beta.248**
- Package: `app.ironshade.vector`
- Verified: **P9-B Core node wave complete**
- Gameplay source: `b00883375c3bab17131d1baf471d4d2271b4db2d`
- Browser E2E: `35681851238`
- Level 15 beta smoke: `35681851321`
- Android beta.248: `35681851205`
- APK artifact: `10675054964`
- APK SHA-256: `4bf448363b8c141caf8e48d5bbd3cdfd7491ebbc696ec66d4dd6ffa932754fec`
- Signing: debug-signed beta; permanent signing is P17-A
