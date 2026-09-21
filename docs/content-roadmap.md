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

- [x] **P7-A Rarity contract** — one source of truth for Field/Refined/Prototype/Singular meaning, order, tokens, text/icon/shape accessibility
- [ ] **P7-B World loot** — rarity-readable silhouette/beacon, distance readability, pickup feedback/audio
- [ ] **P7-C Menu consistency** — equipped, storage, crafting, comparison, rewards, loot feed, debrief all use the same rarity language
- [ ] **P7-D Inspector/tools** — frame/base identity, quality, recovery level, modifier grades, augments, compatibility, source, build-changing effects, filters/sorts
- [ ] **P7-E Singular + touch QA** — premium Singular treatment, no hover-only data, regression across every item surface

## P8 — Targeting & Class Arsenal Identity

- [ ] **P8-A Target acquisition** — focus-before-fire/skill, legal target filtering, aim/range/visibility/threat/mark/boss scoring, deterministic resolution
- [ ] **P8-B Target control** — stickiness, occlusion grace, invalidation, manual override, self/ground/mobility exceptions
- [ ] **P8-C Target feedback/QA** — reticle, audio/haptic cue, accessibility, touch/controller tests
- [ ] **P8-D Hard arsenal lock + migration** — one active class-family armament slot; safely move incompatible equipped weapons to storage and guarantee a valid starter
- [ ] **P8-E Loot/UI/tutorial ownership** — prevent useless off-class weapon outcomes, explain compatibility, teach each family
- [ ] **P8-F Handling identity** — family-specific stance, recoil, reload/vent, muzzle behavior, movement interaction, camera response, stat budgets
- [ ] **P8-G Class-owned skill migration** — family-aware skills without binding to a specific item; variants influence skills via frames/affixes/progression/Singulars
- [ ] **P8-H Skill UI + regression** — Class Skill → Weapon Family → Lens/Evolution → Specialization/Capstone; verify saves/equipment/touch/campaign

## P9 — Progression 2.0 // Deep Operator Network

Target roughly **120–180 authored nodes**, delivered in bounded waves.

- [ ] **P9-A Graph architecture** — data model, prerequisites, path cost, node hierarchy, three class starts, shared outer network, save schema
- [ ] **P9-B Core node wave** — travel/standard/Notable nodes, offense/defense/resource clusters, class weapon sectors
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

**P6 → P7 → P8 → P9 → P10 → P11 → P12 → P13 → P14 → P15 → P16 → P17**

## Immediate Queue

**Next: P7-B — World loot.**

After each merged/verified batch: mark complete → archive detail/delivery note → advance to the next smallest coherent batch.

## Latest Verified Delivery

- Android beta: **0.0.1-beta.211**
- Package: `app.ironshade.vector`
- Verified: **P7-A Rarity contract complete**
- Gameplay source: `0486cf45b17f2cd45bcb3d88385cd78e5c32b998`
- PR Browser E2E: `35561188093`
- Merged-main Browser E2E: `35561313627`
- Level 15 beta smoke: `35561313621`
- Android beta.211: `35561313599`
- APK artifact: `10622107759`
- APK SHA-256: `d42b0e563f2c8ebf1d3ff2a5dca5fdd7dea7b69d994e68ac11f335e0a2af1339`
- Signing: debug-signed beta; permanent signing is P17-A
