# Ironshade Vector — Content Roadmap

Repository checklist for the current content plan. Keep this file synchronized with merged work on `main`.

## P0 — Foundation ✅ COMPLETE

- [x] Three classes: Vanguard / Vector / Systems
- [x] Unique LV1 class skill kits
- [x] Class-specific gameplay mechanics
- [x] Class selection/onboarding
- [x] Class-specific mobile assets
- [x] Gear resonance
- [x] LV15 specializations
- [x] LV16 specialization overclocks
- [x] Network/passive progression
- [x] Reconstruction/crafting
- [x] Faction gear
- [x] Singular chase loot
- [x] T1–T12 Directives
- [x] Elite protocols
- [x] Environmental events
- [x] Multi-stage megastructures
- [x] Mobile combat/UI pass
- [x] Authored combat models
- [x] Authored loot/interactables
- [x] Browser + Android automated QA

## P1 — Chapter 3: LV15–18 Campaign ✅ COMPLETE

### Chapter Foundation

- [x] **P1.1** Define Chapter 3 story premise — **Parallax Debt**
- [x] **P1.2** Create one completely new location — **Cislunar Parallax Array**
- [x] **P1.3** Create unique environmental gameplay mechanic — **Reference Shear / shifting gravity**
- [x] **P1.4** Create bespoke mobile-friendly Parallax environment GLB assets
  - [x] Baseline pylons
  - [x] Reference frames
  - [x] Mass carriages
  - [x] Shear anchors
  - [x] Reference consoles
  - [x] Mobile LOD1/LOD2 coverage
  - [x] Runtime integration with Chapter 3 objective geometry
  - [x] Procedural fallback
  - [x] Graphics/content regression coverage
- [x] **P1.5** Add unique environment props/interactables — baseline frames, pylons, mass carriages, reference machinery

### Missions

- [x] **P1.6** Add new mission objective — **Reference Alignment**
- [x] Add three-pylon physical alignment loop
- [x] Add Parallax Debt opening sequence
  - [x] Baseline Zero
  - [x] Return Vector
  - [x] Blind Meridian
- [x] Expand Chapter 3 beyond the opening sequence toward full LV15–18 progression
  - [x] LV16 — Kepler Wake
  - [x] LV16 — Ledger of Least Action
  - [x] LV16 — Residual Frame
  - [x] LV17 — Null Transit
  - [x] LV17 — Counterfactual Burn
  - [x] LV18 — False Horizon
  - [x] Explicit LV16/LV17/LV18 progression gates
  - [x] T9 → T12 Chapter 3 encounter scaling
  - [x] Legacy three-contract completion migration
  - [x] Final decision branch + final three Chapter 3 operations
    - [x] Expose route — Common Reference → Witness Transit → Released Vector
    - [x] Keep route dark — Dark Baseline → Ghost Transit → Private Vector

### Enemies

- [x] **P1.7** Add 2–3 new enemy variants
  - [x] Parallax Shear Runner
  - [x] Reference Shear Technician
  - [x] Long-Baseline Marksman
- [x] **P1.8** Add explicit class-specific counters/interactions for Chapter 3 enemies
  - [x] Review P1.17 specialization mechanics first and avoid duplicating specialization-specific interactions
  - [x] Add clear Vanguard-specific enemy counterplay
  - [x] Add clear Vector-specific enemy counterplay
  - [x] Add clear Systems-specific enemy counterplay
  - [x] Add deterministic regression coverage for all three class interactions

### Boss

- [x] **P1.9** Add major multi-phase boss — **Baseline Keeper Sera Nox**
- [x] **P1.10** Add boss arena mechanics
  - [x] Baseline Fork
  - [x] Parallax Sweep
  - [x] Shear Collapse
  - [x] Phase-two gravity reconfiguration
- [x] Add further boss tuning after Chapter 3 playtest

### Narrative / Choice

- [x] **P1.11** Add meaningful campaign decision/branch
  - [x] Expose the route — independent witnesses, Meridian reputation, disrupted support stack
  - [x] Keep the route dark — Long Arc reputation, preserved covert route access
- [x] **P1.12** Add evidence/intel progression
  - [x] Baseline Offset
  - [x] Return Vector
  - [x] Blind Meridian
  - [x] Kepler Wake
  - [x] Service Ledger
  - [x] Residual Frame
  - [x] Null Transit
  - [x] Counterfactual Burn
  - [x] False Horizon
- [x] Expand full Intel UI presentation for Parallax Debt

### Loot

- [x] **P1.13** Add at least 3 boss-specific Singulars
  - [x] Nox Parallax R-7
  - [x] Baseline Debt Rig
  - [x] Blind Meridian Link
- [x] **P1.14** Add 4–6 Parallax location chase Singulars
- [x] **P1.15** Add new normal/Prototype Chapter 3 gear identities where useful
  - [x] Six Parallax Debt slot identities across weapons, suit, rig, and implant
  - [x] Prototype signature-affix identity on Chapter 3 recoveries
  - [x] Chapter-scoped recovery routing without leaking into shared locations
  - [x] Loot regression coverage

### Progression / Builds

- [x] **P1.16** Tune XP progression across LV15–18
  - [x] Authored safe-extraction XP floors carry the 12-operation campaign through the LV16/LV17/LV18 gates without unrelated side-contract grinding
  - [x] LV18 closing operations continue meaningful progression instead of dropping back to generic recovery pacing
  - [x] Chapter-specific reward multipliers rise with late-campaign pressure while deep extraction can still exceed the XP floor
  - [x] Authored encounter patterns/reserve counts survive operation scaling; late operations add explicit threat-budget pressure
- [x] **P1.17** Make specializations materially affect Chapter 3 encounters
  - [x] Pressure Diver converts hostile reference shear into vacuum wakes that disrupt Parallax specialists
  - [x] Momentum Broker recovers additional recoil energy inside live reference fields
  - [x] Grid Weaver collapses nearby reference shear through machinery-routed Arc
  - [x] Survey Deadeye gains stronger precision interruption against Parallax reference enemies
  - [x] Redline Pilot overclock dodges punch through nearby shear fields
  - [x] Breach Vanguard armor breaks suppress Parallax specialist hardware
  - [x] Capacitor Conductor three-link cycles short nearby reference fields and disrupt reference enemies
- [x] Campaign progression unlocks at LV15 after Interdiction
- [x] Chapter 3 continuation is level-gated at LV16, LV17, and LV18
- [x] Existing saves migrate safely into expanded Parallax Debt state

### UI / Integration

- [x] Contract-board integration
- [x] Debrief integration
- [x] Campaign status integration
- [x] Dedicated Chapter 3 campaign progress card with level-gate/readiness state
- [x] **P1.18** Finish dedicated Intel/campaign presentation
  - [x] LV15–18 phase timeline with current/gated/banked operation states
  - [x] Evidence-bank count and readable physical findings
  - [x] False Horizon route decision and closing-branch presentation
  - [x] Explicit unresolved-evidence boundary
  - [x] Mobile-landscape responsive coverage
  - [x] Gameplay/UI regression coverage keeps dossier metadata synchronized

### QA

- [x] **P1.19** Progression/save migration regression coverage
- [x] Navigation/pathfinding coverage for Parallax Array
- [x] Full production regression/build green
- [x] Desktop Browser E2E green
- [x] Mobile-landscape Browser E2E green
- [x] Android APK package/version/signature verification
- [x] Android emulator runtime smoke
- [x] **P1.20** Dedicated full Chapter 3 browser/mobile campaign playthrough
- [x] **P1.21** Full Chapter 3 Android hands-on playtest
  - [x] Packaged APK Chapter 3 LV15–18 checkpoint coverage in the native Android WebView
  - [x] Touch-driven Intel, contract-open, and False Horizon route-decision interaction
  - [x] Both Chapter 3 completion branches verified at mobile-landscape viewport width
  - [x] Android Chapter 3 screenshot/report retained with the APK QA artifact
- [x] **P1.22** Tune rewards, boss difficulty, enemy pressure, and completion pacing
  - [x] Smooth Chapter 3 pressure bonuses across all 12 operations while preserving T9 → T12 escalation
  - [x] Split boss durability by campaign role: Blind Meridian opening finale vs. true Chapter 3 closing finale
  - [x] Increase late-operation/finale material premiums while preserving the proven LV16/LV17/LV18 XP gates
  - [x] Exercise scaled rewards/pressure and boss budgets in the dedicated two-route Chapter 3 regression
  - [x] Re-verify desktop/mobile browser E2E and packaged Android beta.134 emulator/Chapter 3 touch QA

### P1 Completion Gate

- [x] Substantial LV15–18 campaign sequence
- [x] Visually distinct new location foundation
- [x] New mission mechanic
- [x] New enemy roster
- [x] Major boss
- [x] New build-defining Singular loot
- [x] Bespoke authored Parallax environment assets
- [x] Campaign branch/choice
- [x] Final three Chapter 3 operations
- [x] Full LV15–18 progression/balance pass
- [x] Complete Chapter 3 playtest

## P2 — Authored Biomes Pack I ✅ COMPLETE

### Spin Habitat
- [x] P2.1 Unique environment kit
- [x] P2.2 Rotating habitat architecture
- [x] P2.3 Rim / spoke / axis visual differences
- [x] P2.4 Spindown VFX
- [x] P2.5 Machinery/interactables
- [x] P2.6 Local enemy visual identity
- [x] P2.7 Sable Voss presentation
- [x] P2.8 Biome ambient effects
- [x] P2.9 Mobile LOD/performance

### Jovian Harvester
- [x] P2.10 Environment kit
- [x] P2.11 Gas-harvester machinery
- [x] P2.12 Storm/pressure visual language
- [x] P2.13 Pressure props/interactables
- [x] P2.14 Stormline Foreman presentation
- [x] P2.15 Atmospheric effects
- [x] P2.16 Mobile LOD/performance

**Gate:** recognizable from screenshots without HUD text.

## P3 — Authored Biomes Pack II ✅ COMPLETE

### Ice Mine
- [x] P3.1 Assets
- [x] P3.2 Bore/tunnel geometry
- [x] P3.3 Brittle support destruction
- [x] P3.4 Cryogenic machinery
- [x] P3.5 Collapse/fracture effects
- [x] P3.6 Rhea Kade presentation

### Solar Yard
- [x] P3.7 Assets
- [x] P3.8 Fabrication machinery
- [x] P3.9 Sun/shadow identity
- [x] P3.10 Thermal shutters
- [x] P3.11 Cranes/rails/motion
- [x] P3.12 HELIOS-9 presentation
- [x] P3.13 Mobile optimization

## P4 — Megastructure Capstone Pass ✅ COMPLETE

- [x] P4.1 Perseid generation-ship continuity layer
- [x] P4.2 Perseid stage-specific encounter/event identity
- [x] P4.3 Perseid Steward Core finale
- [x] P4.4 Perseid adaptive render/regression coverage
- [x] P4.5 K-91 counterweight continuity layer
- [x] P4.6 K-91 stage-specific encounter/event identity
- [x] P4.7 K-91 bossless Ballast Vault traverse finale
- [x] P4.8 K-91 adaptive render/regression coverage
- [x] P4.9 Orpheline hidden-habitat continuity layer
- [x] P4.10 Orpheline stage-specific encounter/event identity
- [x] P4.11 Orpheline Habitat Warden finale + adaptive render/regression coverage
- [x] P4.12 Hecate shipbreaking-yard continuity layer
- [x] P4.13 Hecate stage-specific encounter/event identity
- [x] P4.14 Hecate Yardmaster Null finale + adaptive render/regression coverage
- [x] P4.15 Stage transitions
- [x] P4.16 Environmental continuity
- [x] P4.17 Debrief improvements
- [x] P4.18 Mobile performance

## P5 — Class Capstones ✅ COMPLETE

- [x] P5.1 Vanguard third specialization
- [x] P5.2 Vanguard skill evolution
- [x] P5.3 Vanguard capstone interactions
- [x] P5.4 Deepen Vector specializations
- [x] P5.5 Vector skill evolutions
- [x] P5.6 Systems third specialization
- [x] P5.7 Systems skill evolution
- [x] P5.8 Systems capstone interactions
- [x] P5.9 Same-class builds feel different at LV16+
- [x] P5.10 Specialization gear synergies
- [x] P5.11 Visual combat feedback
- [x] P5.12 Regression coverage
- [x] P5.13 Mobile playtesting

## AAA Production Standard — ACTIVE DIRECTION

The target is no longer "good for mobile." The target is a **premium, console/PC-quality ARPG that happens to run on modern phones**. Mobile constraints should be handled with scalable rendering, asset/animation LODs, streaming, pooling, code splitting, dynamic quality, and measured budgets before cutting gameplay or presentation.

### Production principles

- [ ] Build the high-quality version first, then scale expensive presentation by device capability instead of designing to the weakest device.
- [ ] Protect sustained frame pacing, input latency, memory stability, thermal behavior, save integrity, and readability as hard quality gates.
- [ ] Do not relax bundle/runtime budgets just to make a feature fit; first split boot-critical code, lazy-load presentation data, stream assets, pool effects, instance repeated geometry, and reduce duplicate work.
- [ ] Prefer visible world-state communication over HUD clutter: equipment rarity, enemy modifiers, boss phases, status effects, and interactables should read through silhouette, animation, material, audio, and VFX.
- [ ] Preserve deterministic encounter generation and reproducible combat state for QA even as presentation becomes richer.
- [ ] Every major combat action should have synchronized targeting, animation, audio, VFX, camera response, and haptics where supported.
- [ ] New systems must be understandable on touch/controller without removing build depth.

### Current design decisions

- **Class weapons:** use a hard class-to-weapon-family identity. Vanguard = **Breacher**, Vector = **Rail Lance**, Systems = **Carbine**. Each family can contain multiple dramatically different weapons, but classes do not swap to another family in combat.
- **Skill/weapon relationship:** do **not** copy PoE2's per-skill weapon-set assignment or automatic weapon swapping. Skills belong to the class kit; weapon-dependent skills validate the class weapon family, not a specific individual weapon item.
- **Targeting:** FIRE and targeted skills acquire/focus a legal target first, then execute. Manual aim remains authoritative when deliberately aiming away or when a skill is ground/self-targeted.
- **Progression inspiration:** borrow PoE2's layered depth—large passive graph, meaningful class starting identity, major nodes, specialization layers, build-defining tradeoffs, searchable planning—but keep one active combat weapon family per class.
- **Crafting inspiration:** borrow the clarity of distinct crafting verbs, item bases, affix structure, modifier tiers, scarce high-control resources, and chase outcomes. Avoid making endgame crafting pure opaque gambling; expensive deterministic control should exist.
- **Performance philosophy:** visual ambition is allowed to exceed mid-range mobile capability. Adaptive quality should remove secondary cost before changing core encounter design.

## P6 — T9–T12 Directive Expansion

- [x] P6.1 Exclusive protocol combinations
- [x] P6.2 Enhanced protocol variants
- [x] P6.3 T9+ mutations
- [ ] P6.4 Boss phase mutations
- [ ] P6.5 Command Target mutations
- [ ] P6.6 Dangerous environmental combinations
- [ ] P6.7 Exclusive Singular pool
- [ ] P6.8 Risk/reward modifiers
- [ ] P6.9 Reward previews
- [ ] P6.10 Deterministic simulations
- [ ] P6.11 High-tier worst-case stress testing + adaptive-quality escape hatches before cutting encounter design

## P7 — Loot Rarity & Equipment Presentation

- [ ] **P7.1 Canonical rarity contract** — Field / Refined / Prototype / Singular names, order, semantic meaning, and one source of truth
- [ ] **P7.2 Shared rarity tokens** — consistent color, border, icon/shape, typography, glow intensity, and accessibility-safe text labels
- [ ] **P7.3 World-drop presentation** — rarity-readable pickup silhouette, beacon/beam, audio sting, and distance readability
- [ ] **P7.4 Inventory cards** — same hierarchy in storage, equipped slots, comparison, crafting, rewards, and debrief
- [ ] **P7.5 Item inspector overhaul** — base/frame identity, rarity, quality, recovery level, modifier grades, augments, class compatibility, and source
- [ ] **P7.6 Comparison clarity** — important deltas first, build-changing mechanics separated from small numeric changes
- [ ] **P7.7 Sorting/filtering** — rarity, class compatibility, weapon family, build affinity, modifier family, quality, newest, and upgrade value
- [ ] **P7.8 Singular presentation** — dedicated named-item treatment without making normal Prototype gear unreadable
- [ ] **P7.9 Loot-feed/debrief consistency** — every screen uses the same rarity language and icons
- [ ] **P7.10 Touch/controller QA** — no hover-only information and no rarity meaning conveyed by color alone
- [ ] **P7.11 Regression coverage** — rarity order, class names, CSS/token use, filters, and all major item surfaces

## P8 — Combat Targeting & Class Arsenal Identity

### Target-before-action

- [ ] **P8.1 FIRE acquisition** — pressing FIRE resolves/focuses the best legal target before the shot is spawned
- [ ] **P8.2 Skill acquisition** — targeted skills focus their legal target before execution
- [ ] **P8.3 Ground/self skill exceptions** — mobility, self-buff, area-placement, and explicit manual-ground skills never force an enemy lock
- [ ] **P8.4 Target scoring** — screen-space aim intent, range, visibility, threat, mark state, boss/elite priority, and stickiness
- [ ] **P8.5 Lock persistence** — keep focus through short occlusion/movement windows; break cleanly on death, invalid range, or explicit retarget
- [ ] **P8.6 Manual aim authority** — deliberate stick/mouse aim can override assistance without fighting the player
- [ ] **P8.7 Feedback** — subtle focus reticle, audio tick, haptic confirmation, and accessibility options
- [ ] **P8.8 Deterministic targeting tests** — identical state/input resolves the same target

### Hard class weapon families — DECISION

- [ ] **P8.9 Vanguard = Breacher** — close-range authority, armor break, recoil-as-movement, stagger, and defensive firing windows
- [ ] **P8.10 Vector = Rail Lance** — precision, mobility, line control, penetration, charge timing, and high-value target deletion
- [ ] **P8.11 Systems = Carbine** — smart fire-control, relay/status propagation, sustained cadence, marks, Arc interactions, and battlefield control
- [ ] **P8.12 Remove cross-family runtime swapping** — retire 1/2/3 weapon-family swapping for class-locked operators
- [ ] **P8.13 One active class armament slot** — convert the current three weapon slots into one active family slot while preserving non-weapon suit/rig/implant slots
- [ ] **P8.14 Safe save migration** — incompatible equipped weapons move to storage and a valid class starter weapon is guaranteed
- [ ] **P8.15 Loot compatibility** — class-incompatible weapon drops are prevented or converted to useful salvage/reward choices
- [ ] **P8.16 UI compatibility language** — inventory/crafting/reward screens clearly explain class weapon ownership
- [ ] **P8.17 Class handling profiles** — unique stance, recoil, reload/vent cadence, muzzle behavior, movement penalties/bonuses, and camera response per family
- [ ] **P8.18 Class-specific weapon stat budgets** — balance families around their intended combat loops instead of shared DPS normalization
- [ ] **P8.19 Class weapon tutorials** — onboarding teaches one family deeply rather than three interchangeable guns

### Skill relationship — DECISION

- [ ] **P8.20 No per-item skill linking** — players never bind a skill to "this specific Breacher/Rail/Carbine"
- [ ] **P8.21 Class-kit ownership** — skills remain class abilities and may require the class weapon family when mechanically appropriate
- [ ] **P8.22 Weapon variants modify behavior indirectly** — frame identities, affixes, progression, and Singular traits alter skill interactions without changing which item owns the skill
- [ ] **P8.23 Skill UI rewrite** — show Class Skill → Weapon Family Interaction → Lens/Evolution → Specialization/Capstone
- [ ] **P8.24 Full migration/regression pass** — class selection, saves, equipment, skill execution, AI targeting, touch controls, and Chapter 3

**Decision rationale:** hard class weapon families + class-owned skills is preferred over PoE2-style skill-to-weapon-set binding. It preserves deep buildcraft inside each family while producing stronger class silhouettes, simpler mobile controls, fewer hidden auto-swaps, cleaner balance, and less menu bookkeeping.

## P9 — Progression 2.0 // Deep Operator Network

- [ ] **P9.1 Replace the small branch grid with a true graph** — target 120–180 authored nodes with only a subset reachable by one build
- [ ] **P9.2 Three class starting sectors** — Vanguard, Vector, Systems begin from visibly different regions and early decisions
- [ ] **P9.3 Shared outer network** — classes can travel toward utility/defense/off-class mechanics at meaningful opportunity cost
- [ ] **P9.4 Node hierarchy** — travel nodes, standard passives, Notables, Masteries, Keystones, and Capstones
- [ ] **P9.5 Weapon-family sectors** — Breacher, Rail Lance, and Carbine branches reinforce each class arsenal without weapon-set swapping
- [ ] **P9.6 Core combat sectors** — damage, penetration, heat, reload/vent, recoil, capacitor, movement, armor, pressure, recovery
- [ ] **P9.7 Systems sectors** — mark, disruption, Arc, drone, hazard interaction, machinery, environmental control
- [ ] **P9.8 Defensive identities** — armor, evasion/mobility, capacitor shielding, pressure resistance, recovery, stagger resistance
- [ ] **P9.9 Build-defining Keystones** — large mechanical upside paired with a real constraint/tradeoff
- [ ] **P9.10 Mastery choices** — completing a cluster unlocks one of several mutually exclusive micro-specializations
- [ ] **P9.11 Specialization integration** — LV15 doctrines branch into dedicated subgraphs rather than living as isolated cards
- [ ] **P9.12 LV16+ evolution integration** — evolved skills and capstone interactions unlock/transform nearby progression routes
- [ ] **P9.13 Campaign/boss progression rewards** — major encounters grant special progression unlocks in addition to level points
- [ ] **P9.14 Cross-system hooks** — crafted gear, faction equipment, Singulars, and ship systems can unlock/alter specific node interactions
- [ ] **P9.15 Search** — name, mechanic, status, weapon family, class, defense, resource, and keyword filters
- [ ] **P9.16 Path preview** — tap a distant node to preview required route, point cost, and resulting stat/mechanic deltas
- [ ] **P9.17 Build planner mode** — plan future allocations without spending points; save at least three local plans
- [ ] **P9.18 Refund/respec economy** — easy early experimentation, increasingly meaningful high-level rebuild cost, campaign-granted respec packages
- [ ] **P9.19 Before/after math** — node inspector shows the important real combat changes, not only raw percentages
- [ ] **P9.20 Mobile graph navigation** — pinch/zoom/pan, snap-to-node controller navigation, minimap, breadcrumbs, readable labels
- [ ] **P9.21 Visual language** — class sectors, notable types, prerequisites, planned paths, allocated routes, and locked milestones are obvious at a glance
- [ ] **P9.22 Save migration** — map existing allocations into equivalent starter routes and refund anything that cannot map safely
- [ ] **P9.23 Deterministic build regression** — representative Vanguard/Vector/Systems trees through LV1, LV15, LV18, and endgame
- [ ] **P9.24 Build diversity playtest** — same-class builds must produce meaningfully different moment-to-moment combat

## P10 — Crafting 2.0 // Reconstruction Economy

- [ ] **P10.1 Preserve the physical-item model** — frame identity, quality, recovery level, modifier grades, augments, factions, Singulars
- [ ] **P10.2 Formal modifier structure** — clear Core / Systems affix slots, maximum counts by rarity, tier/grade ranges, and compatibility rules
- [ ] **P10.3 Inspectable affix pools** — show which modifiers can legally roll before resources are spent
- [ ] **P10.4 Distinct crafting verbs** — improve, add, remove, reroute, replace, lock, elevate, socket, extract, and risky overclock each have distinct resources/actions
- [ ] **P10.5 Tiered crafting materials** — common salvage handles routine work; boss/Directive/chase materials enable precise high-end control
- [ ] **P10.6 Deterministic expensive control** — players can guarantee a family/tier/outcome when they pay a sufficiently rare cost
- [ ] **P10.7 Controlled-risk crafting** — optional high-upside actions can damage stability, lock future actions, downgrade a modifier, or permanently alter the item
- [ ] **P10.8 Crafting stability/readiness** — surface how many invasive operations a frame can safely tolerate before a risky step
- [ ] **P10.9 Base/frame chasing** — the right weapon/frame base matters before modifiers, so loot remains valuable even when crafting is strong
- [ ] **P10.10 Quality overhaul** — quality meaningfully affects the physical frame and interacts with high-end crafting
- [ ] **P10.11 Modifier elevation** — late-game path from a good modifier to a rare top-grade version with escalating cost
- [ ] **P10.12 Family locking** — protect one valuable Core/Systems family while rerolling the other at premium cost
- [ ] **P10.13 Targeted addition/removal** — separate low-control cheap actions from rare high-control actions
- [ ] **P10.14 Augment extraction/install depth** — sockets, upgradeable augments, compatibility tags, and salvage consequences
- [ ] **P10.15 Class weapon crafting pools** — Breacher/Rail/Carbine crafting strongly reinforces class identity
- [ ] **P10.16 Specialization recipes** — endgame recipes that deliberately target specialization gear links
- [ ] **P10.17 Singular rules** — named effects remain identity-locked while quality/augment/special Singular upgrade paths stay available
- [ ] **P10.18 Crafting preview** — show cost, guaranteed effects, possible outcomes, exclusions, risk, and before/after item panel
- [ ] **P10.19 Crafting history** — compact per-item reconstruction log for debugging and player trust
- [ ] **P10.20 Salvage loop** — dismantling unwanted gear feeds crafting without making raw drops irrelevant
- [ ] **P10.21 Economy simulation** — validate material income/sinks from campaign through T12
- [ ] **P10.22 Touch/controller crafting QA** — complex crafting remains usable without precision mouse interaction

## P11 — Ship Systems 2.0 // Long-Term Power Infrastructure

Current two-tier systems are a prototype. The redesign target is an order-of-magnitude harder to finish and substantially more transformative.

- [ ] **P11.1 Expand every ship system from 2 tiers to a long progression track** — target 6 major tiers with sub-milestones
- [ ] **P11.2 Cost curve overhaul** — late tiers require dramatically more total value than current T2 and cannot be purchased after only a few normal contracts
- [ ] **P11.3 Milestone gating** — campaign completion, faction reputation, boss components, Directive tier, and Quarantined Trace requirements
- [ ] **P11.4 Dependency graph** — advanced systems require supporting ship infrastructure rather than eight independent upgrade buttons
- [ ] **P11.5 Major benefit cadence** — every tier provides a noticeable gameplay/system unlock, not a tiny invisible percentage
- [ ] **P11.6 Reactor Bus** — capacitor ceiling → regen architecture → combat overdrive → emergency power routing
- [ ] **P11.7 Vector Drive** — mobility → low-g authority → dodge recovery → advanced inertia control
- [ ] **P11.8 Armor Locker** — deployment armor → plate recovery → breach resistance → emergency auto-seal
- [ ] **P11.9 Cargo Recovery Grid** — salvage yield → protected recoveries → deeper extraction capacity → high-value recovery insurance
- [ ] **P11.10 Long-Baseline Sensors** — projectile solutions → target-focus quality → Tactical Forecast detail → elite/boss weakness telemetry
- [ ] **P11.11 Microforge** — unlock the full P10 crafting ladder and its precision controls
- [ ] **P11.12 Trauma Bay** — max HP → stabilization → post-failure mitigation → limited high-tier emergency recovery
- [ ] **P11.13 Support Drone Rack** — relay helper → configurable combat role → advanced drone behavior → specialization synergy
- [ ] **P11.14 System specialization choice** — at high tier choose one of two mutually exclusive advanced packages per system
- [ ] **P11.15 Physical ship presentation** — upgraded hardware visibly appears in the hub with stronger animation/audio/state
- [ ] **P11.16 Upgrade ceremony** — major tier purchases get authored feedback rather than a text-only number change
- [ ] **P11.17 Benefit preview** — exact next-tier effect, prerequisites, downstream unlocks, and resource deficit
- [ ] **P11.18 Existing-save migration** — current T1/T2 investments convert fairly into the new progression
- [ ] **P11.19 Economy pacing test** — systems remain aspirational through campaign and deep endgame
- [ ] **P11.20 Balance guard** — high-tier systems feel powerful without trivializing boss mechanics or class weaknesses

## P12 — AAA Combat Feel // Audio, Animation, Camera & Haptics

### Combat audio

- [ ] **P12.1 Replace synthetic/generic weapon cues with layered authored combat sound**
- [ ] **P12.2 Per-weapon-family firing stack** — mechanical action, primary discharge, muzzle pressure, tail, and low-frequency body
- [ ] **P12.3 Distance layers** — near / mid / far report with believable attenuation
- [ ] **P12.4 Environment response** — interior reflections, open-volume tails, pressure/vacuum filtering, machinery-space resonance
- [ ] **P12.5 Impact material sets** — armor, flesh/soft target, machinery, ice, steel, glass/composite, shield/field
- [ ] **P12.6 Reload/vent/mechanical Foley** — magazines, chambers, capacitors, latches, actuators, heat dump
- [ ] **P12.7 Class skill audio identities** — Vanguard mass/impact, Vector precision/velocity, Systems relay/electrical
- [ ] **P12.8 Enemy/boss attack tells** — danger can be recognized by sound without staring at HUD
- [ ] **P12.9 Dynamic mix** — prioritize player fire, incoming lethal cues, boss tells, and dialogue over low-value ambience
- [ ] **P12.10 Variation system** — pitch/timing/sample variation prevents repeated-fire fatigue without losing weapon identity

### Combat animation

- [ ] **P12.11 Class-specific locomotion stance**
- [ ] **P12.12 Aim offsets / upper-body tracking**
- [ ] **P12.13 Weapon-family recoil profiles**
- [ ] **P12.14 Authored reload / charge / vent / overheat cycles**
- [ ] **P12.15 Skill anticipation, action, recovery, and cancel windows**
- [ ] **P12.16 Dodge start/loop/recovery with class-specific weight**
- [ ] **P12.17 Hit reactions by impact direction and severity**
- [ ] **P12.18 Stagger/armor-break reactions**
- [ ] **P12.19 Enemy locomotion and attack anticipation pass**
- [ ] **P12.20 Boss phase transition animation pass**
- [ ] **P12.21 Additive animation layers** — status/modifier reactions can overlay locomotion and attacks
- [ ] **P12.22 Camera response** — directional impulse, recoil kick, boss impact response, accessibility scaling
- [ ] **P12.23 Haptic synchronization** — fire, heavy impacts, reload lock, skill confirmation, damage, boss events
- [ ] **P12.24 Animation/audio frame-budget profiling** — scale secondary layers before deleting authored behavior

## P13 — Enemy Modifier & Status Visual Language

Players should be able to understand important monster state by looking at the monster, not reading tags.

- [ ] **P13.1 Modifier presentation framework** — one additive animation/material/VFX/audio layer can be composed with the base enemy rig
- [ ] **P13.2 Reinforced Core** — visible bracing/plate tension and heavier impact response
- [ ] **P13.3 Ablative Mantle** — layered armor shell that visibly strips/sheds under damage
- [ ] **P13.4 Hunter Servo** — aggressive actuator cadence, faster stride posture, servo audio
- [ ] **P13.5 Redline Bus** — hot cabling, venting, thermal glow, unstable firing cadence
- [ ] **P13.6 Countermass Rig** — stabilizer deployment and visible inertia-control pulses
- [ ] **P13.7 Relay Reflex** — rapid sensor/relay movement, signal pulse, quick reaction animation
- [ ] **P13.8 Elite protocol presentation** — every protocol gets a readable physical/animated tell
- [ ] **P13.9 Enhanced variant presentation** — enhanced protocols visibly intensify/change the base protocol, not just add a label
- [ ] **P13.10 Player-applied status layers** — mark, armor break, Arc/disruption, thermal, vacuum/pressure, stagger
- [ ] **P13.11 Boss phase mutation presentation** — phase mechanics get transformation/transition cues
- [ ] **P13.12 Spawn/readiness cues** — dangerous modifier combinations announce before becoming lethal
- [ ] **P13.13 Death/disable persistence** — effects terminate or fail physically instead of simply vanishing
- [ ] **P13.14 Mobile readability** — preserve silhouette and animation cues at LOD2/coarse rendering
- [ ] **P13.15 HUD reduction pass** — remove redundant tags once world-state cues are proven readable
- [ ] **P13.16 Screenshot/video QA** — every modifier/status recognizable in representative combat captures

## P14 — Class Arsenal Expansion

Weapon variety now expands **inside** the hard class weapon-family identities from P8.

### Systems // Carbine

- [ ] **P14.1 Burst Carbine** — controlled burst timing, relay/status reliability, medium-range lane control
- [ ] **P14.2 Precision Carbine** — lower cadence, stronger weak-point/mark interaction, disciplined sustained fire

### Vanguard // Breacher

- [ ] **P14.3 Slug Breacher** — massive single discharge, armor/stagger authority, recoil movement
- [ ] **P14.4 Rapid Breacher** — shorter cycle, close-range pressure, heat/reload management

### Vector // Rail Lance

- [ ] **P14.5 Charge Rail** — deliberate charge timing, extreme penetration, mobility commitment
- [ ] **P14.6 Repeater Rail** — faster precision follow-up, lower per-shot authority, movement-friendly cadence

### Arsenal integration

- [ ] **P14.7 Unique silhouettes and authored animations**
- [ ] **P14.8 Unique layered audio identities**
- [ ] **P14.9 Dedicated progression clusters**
- [ ] **P14.10 Crafting/affix compatibility**
- [ ] **P14.11 Skill/class interaction tuning**
- [ ] **P14.12 Singular compatibility and new chase variants**
- [ ] **P14.13 Loot tables respect class ownership**
- [ ] **P14.14 Mobile/thermal testing under sustained fire**
- [ ] **P14.15 Variety playtest** — both variants in one family must support meaningfully different builds
- [ ] **P14.16 Only add a fourth weapon family with a future class or a clearly distinct new combat role**

## P15 — AAA UI / World / Cinematic Polish

- [ ] **P15.1 Unified design-system audit** — spacing, typography, iconography, focus states, rarity tokens, buttons, panels, tooltips
- [ ] **P15.2 Premium menu transitions** — fast, restrained, interruptible, no input-blocking flourish
- [ ] **P15.3 Class selection final presentation** — playable fantasy, weapon identity, skills, difficulty/role, preview animation
- [ ] **P15.4 3D equipment inspection** — high-value gear can be rotated/inspected without blocking fast comparison
- [ ] **P15.5 Mission launch sequence** — contract → loadout readiness → deployment with biome-specific transition
- [ ] **P15.6 Boss introductions/transitions** — short in-engine presentation that never compromises replay pacing
- [ ] **P15.7 Debrief overhaul** — combat highlights, loot hierarchy, progression gains, system/crafting materials, next unlock
- [ ] **P15.8 World interaction polish** — consoles, doors, machinery, pickups, hazards get authored state animation/audio
- [ ] **P15.9 Lighting/material pass** — preserve hard-sci-fi readability while increasing depth, surface response, and atmosphere
- [ ] **P15.10 Accessibility pass** — scalable text, contrast, reduced motion, shake/effect controls, audio cues, target-assist controls
- [ ] **P15.11 Mobile safe-area/orientation pass**
- [ ] **P15.12 Screenshot-quality review** — every major biome/menu/combat state must survive a no-explanation screenshot test

## P16 — Performance Without Compromise

- [ ] **P16.1 Establish device tiers** — flagship, performance Android, mid-range baseline, emulator reference
- [ ] **P16.2 Frame-time budgets** — CPU simulation, render submission, GPU, UI, animation, audio, and GC measured separately
- [ ] **P16.3 Dynamic resolution / render scale**
- [ ] **P16.4 GPU instancing for repeated enemies/props/effects where applicable**
- [ ] **P16.5 Effect pooling** — projectiles, impacts, particles, temporary lights, decals
- [ ] **P16.6 Animation LOD** — preserve gameplay tells while reducing distant bone/update cost
- [ ] **P16.7 Asset streaming/preload strategy** — avoid combat-time decode/upload spikes
- [ ] **P16.8 Texture/material memory audit**
- [ ] **P16.9 Audio voice budget / virtualization**
- [ ] **P16.10 Boot architecture review** — split feature/presentation data and revise the boot-size gate only when architecture justifies it
- [ ] **P16.11 Sustained 30-minute thermal soak tests**
- [ ] **P16.12 Worst-case T12 stress scene** — boss + elites + mutations + hazards + max player VFX
- [ ] **P16.13 Frame-pacing capture** — not just average FPS
- [ ] **P16.14 Memory/leak soak**
- [ ] **P16.15 Adaptive-quality priority order** — lower secondary particles/shadows/reflections/resolution before reducing enemy mechanics
- [ ] **P16.16 Flagship quality mode** — allow modern high-end phones to run the richer target presentation
- [ ] **P16.17 Performance mode** — preserve controls/telegraphs/simulation while scaling presentation
- [ ] **P16.18 Final Android hands-on playthrough across device tiers**

## P17 — External Beta / Delivery

- [ ] **P17.1 Permanent signing credentials**
- [ ] **P17.2 Persistent release-signed APK**
- [ ] **P17.3 Verify upgrade path**
- [ ] **P17.4 GitHub Release workflow**
- [ ] **P17.5 Non-expiring releases**
- [ ] **P17.6 Release notes/changelog**
- [ ] **P17.7 Beta save policy**
- [ ] **P17.8 Clean-install QA**
- [ ] **P17.9 Upgrade-install QA**
- [ ] **P17.10 External beta candidate**

## Current Execution Order

**P6 → P7 → P8 → P9 → P10 → P11 → P12 → P13 → P14 → P15 → P16 → P17**

The structural order is intentional: finish the current T9–T12 content layer, standardize loot presentation, lock targeting/class weapon architecture, then deepen progression/crafting/ship systems before the full audio-animation-modifier presentation pass and expanded class arsenals. Final visual polish and performance architecture happen before external beta.

## Immediate Queue

P1–P5 are complete. **P6.1 — Exclusive protocol combinations**, **P6.2 — Enhanced protocol variants**, and **P6.3 — T9+ mutations** are complete. Continue with **P6.4 — Boss phase mutations** through the remaining P6 high-tier content, then begin **P7 — Loot Rarity & Equipment Presentation**. The class/weapon architecture in P8 is now a locked design direction: Vanguard/Breacher, Vector/Rail Lance, Systems/Carbine; no cross-family runtime swapping and no per-item skill linking.

**P6.3 delivered:** T9+ elite-led encounters now add a deterministic whole-enemy mutation layer on top of protocol packages without consuming the separate boss/Command Target mutation work. Six authored mutations are available across T9–T12: **Reinforced Core**, **Ablative Mantle**, **Hunter Servo**, **Redline Bus**, **Countermass Rig**, and **Relay Reflex**. Mutations consume an explicit reserved threat budget that scales from 2 points at T9 to 8 at T12, remain restricted to elite/enhanced non-boss enemies, and materially change durability, armor, mobility, firing cadence, or hazard/protocol cadence. Tactical Forecast discloses the legal mutation pool before deployment, the combat HUD shows compact mutation tags, and deterministic regression covers the T8 gate, T9/T11 budget caps, boss exclusion, repeatable assignment, runtime stat/cadence effects, and UI visibility. PR Browser E2E run `35553253160` passed desktop/mobile-landscape full regression, production build, the 349.9 KiB boot-bundle gate, player-journey QA, and the Chapter 3 browser playthrough. Merged-main Browser E2E run `35553418993` and Level 15 beta smoke run `35553418968` passed; Android beta.204 run `35553418964` passed the full web regression/build, package/version/SDK/signature verification, native emulator install/launch/resume smoke, and the two-route Chapter 3 Android touch playthrough. Artifact `10619296967` is debug-signed with APK SHA-256 `5c47a13db9815fddee05e9e1744f7403cdc3e44f3146f181624d11bce8e2b5f9`. **P6.4 — Boss phase mutations is next.**

**P6.2 delivered:** T10+ elite protocols now resolve every enhanced roll into one of 15 deterministic, authored variants instead of a generic stronger flag: **Ablative Bloom**, **Cutline Pair**, **Twin-Well Lock**, **Anchor Singularity**, **Wake Anchor**, **Cascade Grid**, **Overlink Mesh**, **Dual Rack**, **Cross-Shutter**, **Capacitor Scramble**, **Coolant Redline**, **Tech Bus Sync**, **Cross-Fan Volley**, **Mass Theft**, and **Hard Lock Grid**. Each variant preserves the existing high-tier mechanical upgrade and +1 threat/reward premium, remains locked below T10, uses the existing 24% T10–T11 / 42% T12 enhanced cadence, and coexists with P6.1 exclusive protocol packages. Combat labels now show compact variant identities, Tactical Forecast names legal variants before deployment, and presentation metadata is lazy-loaded so the existing client boot-size budget remains intact. Deterministic regression covers the T9 gate, T10/T12 cadence, variant/protocol integrity, retained threat/reward accounting, representative runtime mechanics, and UI visibility. PR Browser E2E run `35551169484` passed desktop/mobile-landscape full regression, production build, boot-bundle budget, and player-journey QA. **P6.3 — T9+ mutations is next.**

**P6.1 delivered:** T9+ elite packaging now uses seven deterministic, named high-tier combinations instead of only protocol-by-protocol assembly: **Breach Lock**, **Mass Pursuit**, **Fortress Mesh**, **Recovery Lockdown**, **Kill Corridor**, **Arc Blackout**, and **Vacuum Hunt**. Packages obey existing location/objective eligibility and Directive protocol bias, remain atomic under the threat budget, and can intentionally authorize combinations that normal family de-duplication forbids (notably Recovery Lockdown's Salvage Interdictor + Recovery Denial pairing). Contract Tactical Forecast shows legal package names before deployment, combat labels show the compact package identity above the enemy, and deterministic regression covers the T9 gate, package selection, same-family authorization, forecast visibility, and all-or-nothing threat-budget acceptance. PR Browser E2E run `35549802656` and merged-main Browser E2E run `35549914024` passed desktop/mobile-landscape full regression, production build, and player-journey QA; Level 15 beta smoke run `35549914124` passed; Android beta.202 run `35549914181` passed web regression/build, package/version/SDK/signature verification, native emulator install/launch/resume smoke, Android touch/runtime QA, and the Chapter 3 two-route touch playthrough. **P6.2 — Enhanced protocol variants is next.**

**P5.11–P5.13 delivered:** the LV16+ class capstones now have distinct world-space combat language instead of sharing generic ability pulses. **Vanguard** capstones use a warm, braced shock-ring cue; **Vector** capstones use an elongated blue vector-sweep cue; **Systems** capstones use a violet rotating mesh pulse. The cues are emitted directly from all nine authored capstone interactions — Void Ram, Breach Cascade, Counterfort, Inertial Dividend, Reference Solution, Redline Needle, Induction Sink, Recursive Bus, and Mesh Reflux — without changing balance values or save data. Deterministic gameplay regression verifies all nine trigger paths, graphics regression locks the class-coded renderer contract and QA telemetry, PR Browser E2E run `35549019565` passed desktop/mobile-landscape full regression, production build, and player-journey QA, merged-main Browser E2E run `35549143093` passed both targets, and Level 15 beta smoke run `35549143109` passed. Android beta.201 run `35549143095` passed web regression/build, package/version/SDK/signature verification, native emulator install/launch/resume smoke, Android touch/runtime QA, and the Chapter 3 two-route touch playthrough; artifact `10617593551` was verified as debug-signed with APK SHA-256 `ab92800ca26af249bcba803b5c3e9b8f465c7c7ed3af4c16c4c121f85971e984`. **P5 is complete; P6.1 — Exclusive protocol combinations is next.**

**P5.10 delivered:** every LV15 specialization now has one explicit gear link that activates from **Tier I class resonance plus a matching existing affix**, so specialization identity changes what recovered gear is worth without adding a parallel loot currency or class-locked equipment. Vanguard links are **Pressure Recirculator** (Pressure Diver + Layered vacuum seal), **Breach Stack** (Breach Vanguard + Tungsten penetrator stack), and **Counterfort Bracing** (Bulkhead Warden + Countermass buffer). Vector links are **Reaction Ledger** (Momentum Broker + Vector servo weave), **Survey Ballistics** (Survey Deadeye + Shear-map optics), and **Thermal Slip** (Redline Pilot + Kinetic heat shunt). Systems links are **Mesh Orchestra** (Grid Weaver + Relay microdrone), **Bus Harmonics** (Capacitor Conductor + Capacitor recycler), and **Heat Exchange** (Thermal Shunter + Cryogenic return loop). Each link produces a specialization-specific combat/stat effect, participates in build identity, appears in the specialization panel and Stats, and marks linked candidate gear in the Equipment Bay. Deterministic regression covers activation for all nine links plus representative Vanguard/Vector/Systems mechanical effects. PR Browser E2E run `35547738454` and merged-main Browser E2E run `35547831993` passed desktop/mobile full regression, production build, and player-journey QA; Level 15 beta smoke run `35547832057` passed; Android beta.200 run `35547832105` passed web regression/build, package/version/SDK/signature verification, native emulator install/launch/resume smoke, Android touch/runtime QA, and the Chapter 3 two-route touch playthrough. **P5.11 — Visual combat feedback** is next.

**P5.9 delivered:** LV16+ Vector branches now form three explicit specialization/evolution doctrines so same-class builds have different resource loops, firing priorities, and recovery cadence instead of only different labels. **Inertial Dividend** links Momentum Broker + Slingshot Shift: the extended Slipstream converts recoil into a deeper Vector Shift/dodge recovery dividend plus extra capacitor return. **Reference Solution** links Survey Deadeye + Triangulation Lock: the lock holds a longer firing solution, opens a deeper Armor Breach, recycles Splitshot harder, and the marked Slipstream shot gains extra velocity, damage, penetration, and follow-up recovery. **Redline Needle** links Redline Pilot + Needle Fan: a 75%+ hot weapon bus overdrives the three-lane fan to higher velocity, damage, penetration, and armor pressure while venting heat and advancing dodge recovery. Build identity, Skills, and Stats surface the active doctrine through the shared capstone model, and deterministic gameplay/UI regressions cover all three pairings. PR Browser E2E run `35545564468` and merged-main Browser E2E run `35545672419` passed desktop/mobile full regression, production build, and player-journey QA; Level 15 beta smoke run `35545672492` passed; Android beta.199 run `35545672495` passed web regression/build, package/version/SDK/signature verification, native emulator install/launch/resume smoke, Android touch/runtime QA, and the Chapter 3 two-route touch playthrough. **P5.10 — Specialization gear synergies** is next.

**P5.8 delivered:** Systems specialization/evolution pairs now form three explicit LV16+ capstone loops. **Induction Sink** links Thermal Shunter + Anchor Lattice so a hot multi-node Polarity Well routes additional heat into a longer overcharged crossfire bank; the next shot gains extra velocity, damage, penetration, capacitor return, and overclock recovery beyond standard Thermal Crossfire. **Recursive Bus** links Capacitor Conductor + Recursive Intrusion so propagated hack relays return capacitor directly and the overclock cools the active weapon as the intrusion spreads. **Mesh Reflux** links Grid Weaver + Return Current so machinery-routed remote marks become conductive return nodes and recycle Relay Hack recovery. Skills/Stats surface the active capstone links, and deterministic gameplay/UI regressions cover all three paired behaviors. PR Browser E2E run `35543600968` and merged-main Browser E2E run `35543698281` passed desktop/mobile full regression, production build, and player-journey QA; Level 15 beta smoke run `35543698279` passed; Android beta.198 run `35543698272` passed web regression/build, package/version/SDK/signature verification, native emulator install/launch/resume smoke, Android touch/runtime QA, and the Chapter 3 two-route touch playthrough. **P5.9 — Same-class builds feel different at LV16+** is next.

**P5.7 delivered:** Systems now has three LV16 class skill evolutions in the existing Skill Lens slots. **Anchor Lattice** turns Polarity Well into a conductive clustering tool that recycles Relay Hack recovery per caught node, balanced by +18% Polarity Well cooldown. **Recursive Intrusion** extends Relay Hack through one additional hostile, leaves propagated relays conductive, and advances Cascade Arc recovery, balanced by +18% Relay Hack capacitor cost. **Return Current** converts Cascade Arc network contacts into capped capacitor return and Polarity Well recovery, balanced by +20% Cascade Arc cooldown. Class/LV16 gating, class-switch cleanup, tradeoffs, network propagation, recovery routing, capacitor return, build-stat visibility, and explicit combat feedback are covered by deterministic regression. PR desktop/mobile Browser E2E and merged-main desktop/mobile Browser E2E both passed full regression, production build, and player-journey QA; merged-main Level 15 beta smoke passed; Android beta.197 passed package/version/SDK/signature verification, native emulator smoke, touch/runtime QA, and the Chapter 3 two-route touch playthrough. **P5.8 — Systems capstone interactions** is next.

**P5.6 delivered:** Systems now has a third LV15 specialization, **Thermal Shunter**, alongside Grid Weaver and Capacitor Conductor. Thermal Shunter creates a weapon/ability weaving loop: casting a Systems ability with at least 35% active-weapon heat shunts 8% heat (10% with the LV16 overclock) into a short crossfire bank; the next weapon shot gains 12% projectile velocity, 10% damage, +10 penetration, and returns 4 capacitor. The LV16 overclock extends the bank to 3 seconds, advances the ability that armed it by 0.5 seconds on discharge, and sheds another 5% weapon heat, balanced by +10% weapon heat per shot. The base specialization trades 10 maximum armor. Deterministic gameplay regression covers hot-vs-cold arming, heat routing, projectile bonuses, capacitor return, one-shot bank consumption, cooldown recycling, combat feedback, and both tradeoffs; UI regression verifies the third Systems path is sourced through the shared specialization metadata. Merged-main desktop/mobile Browser E2E, Level 15 beta smoke, Android beta.196 package/version/SDK/signature verification, native emulator install/launch/resume smoke, Android touch/runtime smoke, and Chapter 3 touch playthrough all passed. **P5.7 — Systems skill evolution** is next.

**P5.5 delivered:** Vector now has three LV16 class skill evolutions in the existing Skill Lens slots. **Slingshot Shift** turns Vector Shift into a longer route with an extended Slipstream bank and partial dodge recovery, balanced by +18% capacitor cost. **Triangulation Lock** opens a short Armor Breach firing window and advances Splitshot recovery, balanced by +18% Deadeye Lock cooldown. **Needle Fan** compresses Splitshot into a tighter 1,700-speed fan with +20 penetration and a reinforced center lane, balanced by +20% Splitshot cooldown. Class/LV16 gating, class-switch cleanup, build-stat visibility, tradeoffs, ballistic behavior, recovery routing, and explicit combat feedback are covered by deterministic regression. PR full regression/production build and browser player journey passed on both desktop and mobile-landscape in Browser E2E run `35539490995`. Merged-main desktop/mobile Browser E2E, Level 15 beta smoke, Android beta.195 package/version/SDK/signature verification, native emulator install/launch/resume smoke, Android touch/runtime smoke, and the Chapter 3 touch playthrough all passed. **P5.6 — Systems third specialization** is next.

**P5.4 delivered:** Vector specializations now branch into three materially different combat loops instead of sharing the same Slipstream cadence. **Momentum Broker** turns a Slipstream shot's recovered recoil into Vector Shift and dodge cooldown recycling while retaining its capped capacitor return. **Survey Deadeye** now converts a marked Rail precision trace into a fresh Slipstream follow-through window, with the LV16 overclock pulling Deadeye Lock toward a 1.6 second recovery target. **Redline Pilot** now cashes 75%+ weapon heat into a hot Slipstream shot with extra projectile velocity, damage, and penetration; the overclock also vents a small amount of heat and recycles dodge recovery after the shot. Specialization copy now explains these loops, and deterministic gameplay regression covers each branch's distinct state/recovery/ballistic behavior and combat feedback. PR full regression/production build passed on both Browser E2E runners; a transient desktop Solar Yard telemetry miss passed on the targeted retry. Merged-main desktop/mobile Browser E2E, Level 15 beta smoke, Android beta.194 package/version/SDK/signature verification, native emulator install/launch/resume smoke, Android touch/runtime smoke, and Chapter 3 touch playthrough all passed. **P5.5 — Vector skill evolutions** is next.

**P5.3 delivered:** Vanguard specializations now form three explicit LV16+ capstone loops with the new skill evolutions. **Void Ram** links Pressure Diver + Siege Ram: ram contacts gain vacuum pressure, seed a player-owned vacuum wake at the breach line, and shed vacuum exposure. **Breach Cascade** links Breach Vanguard + Faultline Tag: both fracture targets take deeper armor stripping, armor breaks feed Breach Guard, and the LV16 overclock repairs armor from those breaks. **Counterfort** links Bulkhead Warden + Reprisal Pulse: reprisal contacts reinforce Breach Guard, add extra armor repair, and the LV16 overclock recycles capacitor. The Skills screen calls out active capstone links, the stats summary surfaces the active capstone, and deterministic gameplay/UI regressions prove the paired behavior rather than merely checking that both components are equipped. PR desktop/mobile Browser E2E, merged-main desktop/mobile Browser E2E, Level 15 beta smoke, Android beta.193 package/version/SDK/signature verification, native emulator install/launch smoke, and Android touch/runtime smoke all passed. **P5.4 — Deepen Vector specializations** is next.

**P5.2 delivered:** Vanguard now has three LV16 class skill evolutions in the existing Skill Lens slots. **Siege Ram** turns Breach Rush into an armor-cracking ram line that opens Armor Breach and feeds Breach Guard time, balanced by +20% Breach Rush cooldown. **Faultline Tag** relays Fracture Tag into a nearby secondary hostile to create a two-target Breacher lane, balanced by +18% Fracture Tag capacitor cost. **Reprisal Pulse** re-strikes already-breached Bulwark Pulse contacts and advances Breach Rush recovery per reprisal contact, balanced by +18% Bulwark Pulse cooldown. Evolutions are Vanguard-only, remain locked before LV16, share the existing per-skill selection slots with common Lenses, and are cleared safely when switching to an incompatible class while shared Lenses remain intact. Build UI exposes only class-compatible evolutions with unlock state, and player stats now report the actual class skill kit rather than generic MAG/MARK/ARC values. Deterministic gameplay regression covers level/class gating, all three tradeoffs, armor/guard/relay/recovery behavior, combat feedback, and class-switch cleanup. PR desktop/mobile Browser E2E, merged-main desktop/mobile Browser E2E, Level 15 beta smoke, Android beta.192 package/version/SDK/signature verification, native emulator install/launch smoke, and Android touch/runtime smoke all passed. **P5.3 — Vanguard capstone interactions** is next.

**P5.1 delivered:** Vanguard now has a third LV15 specialization, **Bulkhead Warden**, alongside Pressure Diver and Breach Vanguard. Bulkhead Warden turns Breach Guard into a defensive impact-recycling loop: guarded blockable damage receives additional mitigation and advances Bulwark Pulse recovery, while the LV16 overclock also returns capped capacitor from the absorbed impact. Bulwark Pulse repairs armor for each nearby contact and extends the Warden guard window, with an 8% direct weapon-output tradeoff and a +10% overclocked Bulwark capacitor-cost tradeoff. Deterministic gameplay regression covers mitigation, cooldown recycling, capacitor return, armor repair, extended guard duration, combat feedback, and both tradeoffs. PR desktop/mobile Browser E2E, merged-main desktop/mobile Browser E2E, Level 15 beta smoke, Android beta.191 package/version/SDK/signature verification, native emulator install/launch smoke, and Android touch smoke all passed.

**P4.18 delivered:** Megastructure mobile rendering now batches repeated Perseid ribs/guide lights, K-91 rails/inertial datum, Orpheline rock/utility continuity, and Hecate truss/clamp/cutter continuity through shared Three.js instanced draws instead of one mesh per repeated element. The existing mobile/performance profiles still preserve each capstone silhouette while trimming repeated density, and capstone overlays now stop receiving structural shadows whenever those profiles disable structural shadowing. Runtime QA exposes `instanced-continuity` batching plus per-family continuity draw-call ceilings (2 draws for Perseid/K-91, 4 for Orpheline, 5 for Hecate), and render-performance regression keeps both the visible mobile instance counts and the batching contract deterministic. P4 is complete; the next roadmap slice is P5.1 Vanguard third specialization.

**P4.17 delivered:** Megastructure debriefs now resolve the expedition as an authored after-action report instead of a single generic banked-progress sentence. Perseid, K-91, Orpheline, and Hecate show the secured/unreached four-space route, optional-recovery total, safe/deep extraction state, finale disposition, and the environmental continuity consequences observed along the secured path. The report distinguishes partial extraction, full safe traversal with an optional command zone left sealed, K-91’s bossless Ballast Vault resolution, and deep command-target defeat without adding new save state. The route recap collapses cleanly on narrow mobile surfaces, and deterministic gameplay regression covers all outcome classes plus the responsive presentation contract. The next capstone work is P4.18 Mobile performance.\n\n**P4.16 delivered:** Megastructure spaces now inherit authored physical consequences from the connected space instead of resetting every environment at the handoff. Perseid carries pressure debt, gravity trim loss, and cryogenic visibility deeper through the ship; K-91 carries capture debris, inertial drift, and lift-bus grid damage; Orpheline carries bore dust, improvised-grid faults, and ring momentum loss; Hecate carries clamp-release gravity instability, crusher-grid damage, and wreck-chain atmosphere loss. Inherited conditions are merged without duplication into the existing mission condition system, so the normal pressure, gravity, damaged-grid, visibility, and director hazard behavior remains the single source of gameplay truth. Contract previews expose the continuity explanation, and a dedicated regression validates condition inheritance plus live pressure/gravity/arc effects across all four capstones. The next capstone work is P4.17 Debrief improvements.

**P4.15 delivered:** Megastructure stage changes no longer jump instantly from one reused biome to the next. Every Perseid, K-91, Orpheline, and Hecate handoff now carries authored physical-route metadata, a continuity explanation, and a destination-specific arrival cue. Choosing Transit Deeper opens a dedicated internal-transit briefing that shows the secured/next-space route, current recovery tags, carried suit health/armor, the +12 capacitor service and 35% heat bleed already applied by expedition transit, plus the arrival cue before the next combat space is instantiated. The combat state remains frozen at the checkpoint until the player commits the transit, and mobile/coarse-pointer layouts collapse the route/carry grids into a scroll-safe two-column presentation. Gameplay regressions cover representative transition routes across all four capstones plus the staged GameCanvas handoff. The next capstone work is P4.16 Environmental continuity.

**P4.12–P4.14 delivered:** Abandoned Shipbreaking Yard Hecate now reads as one continuous dismantling complex instead of four unrelated reused biomes. A dedicated shipbreaking-yard capstone profile carries a black salvage-truss spine, red clamp arms, and yellow cutter datum through Sunward Clamp Field, Crusher Causeway, Wreck Transit, and Yard Control Crown while layering autonomous hull cradles, crusher jaws, stripped wreck frames, and master control pylons. Each space overrides generic sector naming and carries Hecate-specific shipbreak events with physical clamp-vector, crusher-mass, open-hull vacuum, and cutter-grid hazards; stage two fields the Hecate Crusher Foreman. Yard Control Crown culminates in Hecate Yardmaster Null, whose clamp-lock, thermal-cutter, and wreck-purge patterns turn the final gantry into a dedicated shipbreaking finale. Full/Balanced/mobile/Performance profiles trim repeated salvage trusses, cutter datum markers, stage props, and structural shadows without losing the yard silhouette. Gameplay and render regressions cover all four spaces, Yardmaster identity/phase behavior, stage events, continuity telemetry, and mobile performance profile. The next capstone work is P4.15 Stage transitions.

**P4.9–P4.11 delivered:** Unregistered Asteroid Habitat Orpheline now reads as one buried settlement instead of four unrelated reused biomes. A dedicated hidden-habitat capstone profile carries a rock-cut spine, violet utility trunk, and white occupancy marks through Ice Access Bore, Industrial Commons, Residential Spin Ring, and Buried Control Vault while layering concealment shutters, improvised fabrication stalls, hab-pod stacks, and founding-archive walls. Each space overrides generic sector naming and carries Orpheline-specific habitat event language with physical venting, grid, and gravity hazards; stage two fields the Orpheline Commons Custodian. The Buried Control Vault culminates in a dedicated Orpheline Habitat Warden whose shelter-purge, spin-authority, and partition-fire patterns turn the founding archive into a distinct finale. Full/Balanced/mobile/Performance profiles trim repeated rock ribs, utility markers, stage props, and structural shadows without losing the habitat silhouette. Gameplay and render regressions cover all four spaces, the Warden identity, stage events, continuity telemetry, and mobile performance profile. The next capstone slice is P4.12–P4.14 Hecate.

**P4.5–P4.8 delivered:** Orbital Elevator Counterweight K-91 now reads as one continuous tumbling mass instead of four unrelated reused biomes. A dedicated counterweight capstone profile carries the same load spine, paired countermass rails, and amber inertial datum through Capture Collar, Mass Transit Spine, Power Transfer Gallery, and Ballast Vault while layering stage-specific capture jaws, mass carriages, lift-bus hardware, and ballast restraints. Each space now overrides generic sector naming and carries K-91 inertial event language with physical vector/gravity/grid hazards; stage two fields the K-91 Mass-Transit Warden. The finale deliberately remains bossless: the Ballast Vault ends on a high-pressure ballast-shift survival/recovery beat, matching the site premise that the value is surviving the full traverse rather than hunting a command target. Full/Balanced/mobile/Performance profiles trim repeated rails, datum lights, props, and structural shadows without losing the counterweight silhouette. Gameplay and render regressions cover all four spaces, the bossless final contract, inertial events, runtime continuity telemetry, and mobile performance profile. The next capstone slice is P4.9–P4.11 Orpheline.

**P4.1–P4.4 delivered:** Generation Ship Perseid now reads as one continuous derelict instead of four unrelated reused biomes. A dedicated capstone profile overlays the same keel spine, pressure ribs, and green transit datum across Docking Spine, Agricultural Drum, Cryogenic Service Deck, and Reactor Choir while adding stage-specific docking, agriculture, cryogenic, and harmonic-reactor dressing. Each space now overrides generic sector naming, carries its own Perseid event language and local hazard beat, preserves the stage-two guaranteed elite as the Perseid Drum Warder, and culminates in a dedicated Perseid Steward Core boss variant with pressure, gravity, and reactor-choir phase mechanics. The continuity layer has Full/Balanced/mobile/Performance budgets that trim repeated ribs, guide lights, props, and structural shadows without removing stage identity. Gameplay and render regressions cover the four-stage route, optional recovery, elite, Steward Core, ship events, runtime continuity telemetry, and mobile performance profile. The next capstone slice is P4.5–P4.8 K-91.

**P3.13 delivered:** Solar Yard now has a dedicated adaptive render profile instead of relying on LOD selection alone. Full desktop retains the complete authored yard, while Balanced/mobile trim secondary decks, trusses, radiators, fabrication machines, and transfer rails; mobile preserves all three reflector pylons, both moving gantry cranes, the gameplay-bound thermal shutter, and HELIOS-9 while forcing LOD2. Solar Yard structural shadow casters are disabled outside the Full profile, sun/shade overlays drop from 3+3 to 2+2 on mobile and 1+1 in Performance, and the procedural fallback follows the same panel/overlay/shadow budget. Deterministic render-profile regression plus desktop/mobile-landscape browser QA cover the authored instance budget, shadow policy, overlay density, transport motion, thermal shutter linkage, and boss LOD. P3 is complete; P4 begins with Perseid.

**P3.12 delivered:** HELIOS-9 Yardmind now has a Solar Yard-specific authored boss presentation instead of the shared generic boss silhouette. Adaptive LOD1/LOD2 assets give the yardmind a broad sunshield crown, paired reflector wings, and fabrication/thermal core hardware in the existing ceramic / solar-gold / heat-amber language, shifting to overheat-red pressure cues in phase two while preserving the shared boss telegraph system. Runtime routing is restricted to Solar Yard contracts whose deep target is HELIOS-9 Yardmind; deterministic telemetry exposes boss identity, asset, silhouette, palette, and live phase presentation, while mobile-landscape selects the dedicated LOD2 asset. Generated-content, static graphics, and browser runtime regressions cover the new presentation. The dedicated Solar Yard mobile optimization pass remains P3.13.

**P3.11 delivered:** Solar Yard now has an authored material-transfer system instead of a static fabrication floor: three paired transfer-rail spans cross the fabrication spine and two overhead gantry cranes carry independently phased trolley assemblies. Both transport families ship adaptive LOD1/LOD2 GLBs in the existing ceramic / scorched-steel / solar-gold / heat-amber language. The trolleys move deterministically from live simulation time rather than decorative randomness, and runtime telemetry exposes rail/crane counts, motion mode, and live trolley offsets. Generated-content/static regressions and desktop/mobile-landscape Browser E2E verify the authored families, mobile LOD reduction, runtime loading, and actual trolley movement. HELIOS-9 presentation and the dedicated Solar Yard mobile optimization pass remain P3.12–P3.13.

**P3.10 delivered:** Solar Yard now has authored local thermal-shutter hardware tied directly to the existing `solar-shutter` gameplay control. The shutter family ships adaptive LOD1/LOD2 GLBs with ceramic thermal panels, scorched structural rails/posts, solar-gold actuation hardware, amber status lighting, and full-detail heat-rejection ribs. Runtime placement is anchored to the live encounter control, open/closed panel state follows the control's real `exposed` state, and the existing solar-surge logic remains the source of radiant-load protection rather than being duplicated in the renderer. Deterministic telemetry exposes authored shutter state, radiant-load protection, and the state-link contract; generated-content/static regressions and desktop/mobile-landscape Browser E2E verify the new asset family, mobile LOD reduction, authored loading, and live open-state linkage. Cranes/rails/motion, HELIOS-9 presentation, and the dedicated mobile optimization pass remain P3.11–P3.13.

**P3.9 delivered:** Solar Yard now has a stable biome-specific luminance identity instead of relying on the shared player-following key light. A fixed sunward directional key creates consistent long shadows across the yard, a lower-intensity cool fill preserves readable shaded combat space, and three bounded sun patches / three cool shade masses reinforce the authored shade-deck → fabrication-spine → sunward-yard composition without adding heavy geometry. The existing live solar-shutter timing can still drive a short solar-surge state, but the authored shutter hardware remains reserved for P3.10. Runtime telemetry exposes the sun direction, hard-sun/cool-shade language, patch counts, active sun mode, tone treatment, and adaptive shadow budget; static graphics regression and desktop/mobile-landscape Browser E2E cover the identity. Thermal shutters, cranes/rails/motion, HELIOS-9 presentation, and the dedicated mobile optimization pass remain P3.10–P3.13.

**P3.8 delivered:** Solar Yard fabrication is now represented by three authored machine families instead of generic service props: sinter forges, printer spindles, and feedstock presses. Seven machines are distributed across the shade deck, fabrication spine, and sunward work yard; the P3.7 ceramic decks, truss frames, radiator towers, and reflector pylons now load with them as one authored Solar Yard scene. Every family ships adaptive LOD1/LOD2 GLBs, the runtime preserves procedural fallback, coarse/mobile forces LOD2, and deterministic telemetry exposes the exact fabrication-machine budget for browser QA. Generated-content, static graphics, and desktop/mobile-landscape Browser E2E cover the complete P3.7–P3.8 yard foundation. Sun/shadow identity remains P3.9; thermal shutters, cranes/rails/motion, HELIOS-9 presentation, and the dedicated mobile optimization pass remain P3.10–P3.13.

**P3.7 delivered:** Solar Yard now has a reusable authored static environment foundation with ceramic fabrication decks, scorched structural truss frames, black radiator towers, and gold reflector pylons. All four families generate adaptive LOD1/LOD2 GLBs, retain a ceramic / scorched-steel / black-radiator / solar-gold / heat-amber material language, and expose deterministic silhouette markers for asset QA. Generated-content and static asset-pipeline regressions verify the authored kit and mobile LOD reduction. Active fabrication machinery remains P3.8; sun/shadow identity, thermal shutters, cranes/rails/motion, HELIOS-9 presentation, and the dedicated mobile optimization pass remain P3.9–P3.13.

**P3.6 delivered:** Salvage Captain Rhea Kade now has an Ice Mine-specific authored boss presentation instead of the shared generic boss silhouette. Adaptive LOD1/LOD2 assets give her a bore-cowl, cryogenic backpack hardware, a fracture-ram profile, and a mine-steel/frost-cyan palette that shifts to fracture-amber pressure in phase two while retaining the shared boss telegraph language. Runtime routing is restricted to Ice Mine contracts whose deep target is Rhea Kade; generated-content, static graphics, and browser QA cover the silhouette contract, mobile LOD2 selection, and phase telemetry. Ice Mine P3.1–P3.6 is complete; Solar Yard begins at P3.7.

**P3.5 delivered:** Ice Mine support failure now reads as a real physical collapse instead of an authored frame simply disappearing. Damaged brittle gates expose animated fracture rings, support failure triggers a deterministic frost pulse plus ballistic ice/steel shard burst, and settled rubble remains at the opened firing lane. The effect is driven directly by live support HP/active transitions, timed ice shear now zeroes support durability as well as collision state, and coarse/mobile rendering cuts the effect from eight shards/three crack bands to four shards/two crack bands. Runtime telemetry exposes fracture identity, state, detail tier, and per-support collapse state; static graphics and browser smoke coverage verify the VFX contract. Rhea Kade presentation remains P3.6.\n\n**P3.4 delivered:** Ice Mine now carries a dedicated authored cryogenic machinery run instead of relying on generic service props: two cryo pumps, three coolant manifolds, and two freeze compressors span the reinforced extraction tunnel into the Subglacial Vault. Each machinery family ships adaptive LOD1/LOD2 GLBs, keeps cold-cyan operational markers and frost detail, participates in the same authored-load/procedural-fallback path, and exposes deterministic machinery telemetry for browser QA. Generated-content checks validate silhouette/material retention, while desktop/mobile-landscape browser coverage verifies the full seven-machine layout and mobile LOD2 selection. Collapse/fracture effects remain P3.5 and Rhea Kade presentation remains P3.6.\n\n**P3.3 delivered:** Ice Mine brittle supports are now gameplay-bound rather than decorative: the two light support gates remain destructible by player fire, the authored 14-second ice shear collapses whatever is still standing, and each live support drives a matching authored tunnel-frame root. The renderer suppresses the generic collision-box visual only after authored geometry is ready, preserving fallback behavior, and exposes intact/damaged/partial/cleared support telemetry for runtime QA. Gameplay regression covers both player-opened and timed-opened firing lanes, while static graphics plus desktop/mobile browser QA verify the authored support binding and live support-state telemetry without depending on encounter survival time. Cryogenic machinery remains P3.4; collapse/fracture effects and Rhea Kade presentation remain P3.5–P3.6.\n\n**P3.2 delivered:** Ice Mine now composes the P3.1 kit into a runtime three-zone mine silhouette: a frost-cut Access Bore, a steel-supported Extraction Tunnel with cyan service decking, and a pillar-dense Subglacial Vault. Authored runtime loading retains procedural crystal scenery as fallback, exposes deterministic zone/composition telemetry, and forces LOD2 on coarse/mobile surfaces. Static renderer regression plus dedicated desktop/mobile-landscape browser QA now cover the authored sequence. Brittle support destruction remains P3.3; cryogenic machinery, collapse/fracture effects, and Rhea Kade presentation remain P3.4–P3.6.\n\n**P3.1 delivered:** Ice Mine now has a reusable authored static environment asset kit with frost walls, structural support frames, service decks, and ice pillars. All four families generate adaptive LOD1/LOD2 GLBs with cold-rock, support-steel, frost-ice, and cyan-readability material identities plus deterministic silhouette markers. Generated-content and static asset-pipeline regressions verify the kit and mobile LOD reduction, and the PR full regression/production build is green. Bore/tunnel runtime composition remains P3.2; brittle support destruction, cryogenic machinery, collapse/fracture effects, and Rhea Kade presentation remain P3.3–P3.6.

**P2.16 delivered:** Jovian Harvester now has a dedicated adaptive biome render profile instead of inheriting the generic scene budget unchanged. Full desktop preserves the 19-piece authored structural composition; Balanced, coarse/mobile, and Performance profiles trim non-landmark deck/bridge/ballast placements to 13 pieces while preserving all five skimmer towers. Coarse/mobile forces authored environment LOD2, non-Full profiles disable structural shadow casters, and the procedural fallback follows the same shadow policy. Existing P2.12 storm-pressure and P2.15 atmosphere density reductions remain layered on top. Deterministic render-profile regressions and desktop/mobile-landscape browser runtime QA now assert the active LOD, structural instance budget, and shadow budget. P2 is complete; the next implementation target is P3.1 Ice Mine assets.

**P2.15 delivered:** Jovian Harvester now has a persistent atmospheric layer distinct from the reactive P2.12 storm/pressure effects: broad upper-atmosphere pressure-cloud filaments, slow charged particulate, and skimmer-spine haze. Ambient motion uses low-frequency crosswind drift / pressure breathing / charged drift and is subtly modulated by live storm charge and pressure shear without becoming event-only VFX. Density scales through the existing render budget (2/3/5 cloud bands and 20/36/56 motes) with deterministic coarse/mobile reduction. Static graphics and render-budget regressions, the full production build, PR and merged-main desktop + mobile-landscape Browser E2E, Level 15 beta smoke, Android beta.167 package/version/SDK/signature verification, native emulator runtime smoke, and Chapter 3 touch playthrough are green. P2.16 remains the dedicated Jovian mobile LOD/performance pass.

**P2.14 delivered:** Stormline Foreman Ilex now has a dedicated Jovian Harvester boss presentation with adaptive LOD1/LOD2 assets, a pressure-work silhouette built around a storm cowl, pressure crown, relief stacks, and manifold pack, contract-scoped runtime routing, and a storm-orange / pressure-cyan / vent-red phase language. Static/generated-content regressions, the full production build, PR and merged-main desktop + mobile-landscape Browser E2E, Level 15 beta smoke, Android beta.166 package/version/SDK/signature verification, and Android emulator runtime + Chapter 3 touch smoke are green. Runtime QA confirms `stormline-foreman-ilex` with the dedicated `jovian-harvester-stormline-foreman-lod2` asset in both browser viewports. Atmospheric effects and the dedicated mobile performance pass remain scoped to P2.15–P2.16.

**P2.13 delivered:** Jovian Harvester pressure gameplay now has biome-specific authored hardware instead of shared generic controls: a storm-rated pressure-lock family for live pressure doors/interlocks and a relief-manifold family for breach/seal controls. Both ship adaptive LOD1/LOD2 GLBs with distinct wheel/valve silhouettes, full-detail equalization/gauge/riser props, status emitters, and objective-beacon mounts. Runtime status color/intensity follows the real pressure-door link and service/boss breach state, while QA telemetry exposes the pressure kit, source, live pressure state, and door state. Generated-content and static graphics regressions, full production build, desktop + mobile-landscape Browser E2E on PR and merged `main`, Level 15 beta smoke, Android beta.165 package/version/SDK/signature verification, and Android emulator runtime + Chapter 3 touch smoke are green on implementation head `fd5840bf877b48fd490ae6d4991cb886724b725d`. Stormline Foreman presentation, atmospheric effects, and the dedicated mobile performance pass remain scoped to P2.14–P2.16.

**P2.12 delivered:** Jovian Harvester now has a gameplay-driven storm/pressure visual language layered over both authored and fallback environment geometry: electrostatic storm-charge sweeps, unequal-pressure shear bands, and a storm-relief manifold pulse. Visual state is derived from live sector pressures/pressure states, the service-breach state, and contract pressure/grid conditions rather than decorative randomness; venting shifts the language toward warning-red relief cues, while normal unequal-pressure operation retains the storm-orange/pressure-cyan identity. The effect scales through the existing transparency/VFX budget and trims secondary sweeps/bands for coarse pointers or Performance-tier rendering. Deterministic helper regression, static graphics assertions, full production regression/build, Level 15 beta smoke, desktop + mobile-landscape Browser E2E with live storm/shear telemetry, Android beta.164 package/version/SDK/signature verification, and native emulator runtime smoke are green on implementation head `971da635740eaf16d7302eb17b563d8432fc5ac7`. Pressure props/interactables, Stormline Foreman presentation, atmospheric effects, and the dedicated mobile performance pass remain scoped to P2.13–P2.16.

**P2.11 delivered:** Jovian Harvester gameplay machinery now has four biome-local authored families bound to the existing mission systems: storm-bus isolators for live grid branches, deck mass-trim hardware for gravity calibration, and skimmer-compressor / separator-package recovery machines for machinery-recovery objectives. Every family ships adaptive LOD1/LOD2 GLBs with distinct silhouettes, state-readable status emitters, objective-beacon mounts on full-detail assets, runtime authored/fallback routing, and deterministic QA telemetry. Generated-content regression validates scale, silhouette markers, and mobile payload reduction; the full production regression/build, Level 15 beta smoke, desktop + mobile-landscape Browser E2E, Android beta.163 package/version/SDK/signature verification, and Android emulator runtime smoke are green on implementation head `8a9275289ce2f22689000574e158c8f711609bde`. Storm/pressure visual language, pressure interactables, Stormline Foreman presentation, atmospheric effects, and the dedicated mobile performance pass remain scoped to P2.12–P2.16.

**P2.10 delivered:** Jovian Harvester now has a reusable authored structural environment foundation with weathered elevated deck spans, a five-skimmer-tower silhouette, dark transfer bridges, and suspended ballast pods. All four families generate adaptive LOD1/LOD2 GLBs, route through runtime authored placement with procedural fallback, expose deterministic screenshot/readability telemetry, and are covered by generated-content, static pipeline, and desktop/mobile-landscape browser runtime QA. Storm/pressure visual language, pressure interactables, Stormline Foreman presentation, atmospheric effects, and the dedicated mobile performance pass remain scoped to P2.12–P2.16.

**P2.9 delivered:** Spin Habitat now has a biome-specific adaptive render profile: coarse/mobile play forces authored environment LOD2, trims the rotating environment from 15 to 11 authored placements while preserving all four spokes and the stationary axis, disables rotating environment shadow casters outside the full desktop profile, lowers procedural rim tessellation, and uses the three-arc spindown presentation on mobile. Runtime telemetry exposes profile, instance budget, and shadow-caster mode. Full production regression/build, Level 15 beta smoke, desktop + mobile-landscape Browser E2E (including live mobile LOD2 / 11-instance / axis-only assertions), Android beta.156 package/version/SDK/signature verification, and Android emulator runtime smoke are green.

**P2.8 delivered:** Spin Habitat now has a bounded ambient-effects layer that makes the biome read even when no emergency event is active: gravity-coupled cyan/green rim-light sweeps, counter-drifting habitat particulate, and a stationary-axis haze pulse. The effects follow the real habitat rotation state, scale their light-band count, mote count, opacity, and pulse intensity through the existing adaptive VFX/transparency budget, and expose deterministic runtime QA telemetry without folding the dedicated performance/LOD pass forward from P2.9. Full production regression/build, desktop + mobile-landscape Browser E2E, Level 15 beta smoke, Android beta.155 package/version/signature verification, and Android emulator runtime smoke are green.

**P2.7 delivered:** Recovery Commander Sable Voss now has a Spin Habitat-specific authored boss presentation instead of the shared generic boss silhouette. Her adaptive LOD1/LOD2 model adds a broad counter-spin mantle, command visor, governor hardware, and a recovery-green/cyan command palette that shifts to amber pressure cues in phase two while preserving the shared boss telegraph language. Runtime routing is scoped to Spin Habitat contracts whose deep target is Sable Voss, with explicit authored/fallback QA telemetry. Generated-content regression validates the silhouette marker and mobile payload reduction; full production regression/build, desktop + mobile-landscape Browser E2E, APK package/version/signature verification, and Android emulator smoke are green on the final P2.7 head.

**P2.6 delivered:** Spin Habitat combat now has four biome-local authored enemy identities tied to the existing tactical variants: Spoke Marksman, Spin-Trim Specialist, Ring Drone Carrier, and Axis Shield Boarder. Each identity ships adaptive LOD1/LOD2 GLBs with preserved articulated enemy rig sockets, a distinct silhouette marker and cool green/cyan habitat palette; renderer routing is restricted to Spin Habitat and deliberately leaves Recovery Commander Sable Voss on the generic boss path for P2.7. Generated-content tests validate every local LOD pair and mobile payload reduction, runtime QA exposes the local kit/assets and fallback state, desktop + mobile-landscape Browser E2E verify all four authored identities in live Spin Habitat combat, and Android beta.152 re-verifies package metadata/signature plus native emulator runtime/touch smoke.

**P2.5 delivered:** Spin Habitat gameplay machinery now has five authored, mobile-LOD-aware families tied to the real mission objects: spin-bus isolators, rim/spoke gravity trims, bearing-control recovery hardware, attitude flywheels, and pressure locks. The renderer selects these families by biome, object kind, and machinery-recovery objective identity while preserving generic salvage/cache visuals where appropriate. Runtime QA exposes the active habitat interactable kit and loaded assets, generated-GLB tests validate every LOD pair and silhouette marker, desktop and mobile-landscape Browser E2E verify authored habitat machinery without procedural fallback, and Android beta.151 re-verifies the packaged runtime, touch flow, Chapter 3 playthrough, package metadata, signature, and emulator smoke.

**P2.4 delivered:** Spin Habitat emergency spindown now has gameplay-driven VFX tied to the real Sector B transfer-gravity state: lowering transfer gravity toward 0.05G activates amber rim brake arcs and a stationary-axis warning pulse while preserving the existing Sector A gravity-coupled architecture rotation. The effect exposes runtime QA state/intensity/source/detail, scales transparency through the adaptive render budget, drops secondary arcs in the performance VFX tier, and retains deterministic nominal/emergency regression coverage. Desktop and mobile-landscape Browser E2E verify the runtime VFX contract, and Android beta.150 re-verifies the packaged runtime, touch flow, Chapter 3 playthrough, package metadata, and emulator smoke.

**P2.3 delivered:** Spin Habitat now separates its three navigation zones by both silhouette and material language: the rim uses broad green-plated deck mass and wayfinding, spokes use slimmer skeletal dark trusses with cyan status lighting, and the stationary axis uses a brighter cool-metal tower silhouette with service rings, beacon, and vertical fins. The procedural fallback preserves the same rim/spoke/axis hierarchy, runtime QA exposes the zone-identity contract, generated-GLB tests validate the assigned materials, retained desktop/mobile-landscape screenshots confirm the differentiation in combat, and Android beta.142 re-verifies the packaged runtime. Spindown VFX, machinery/interactables, local enemy presentation, Sable Voss, ambient effects, and the dedicated mobile performance pass remain in P2.4–P2.9.

**P2.2 delivered:** Spin Habitat ring segments, spoke trusses, and service bays now share a gravity-coupled rotating structural frame while the central axis hub remains stationary. The procedural fallback rotates with an asymmetric witness marker, runtime QA exposes spin mode/RPM/phase/source, spin overspeed naturally accelerates the visual frame through sector-A gravity, and desktop/mobile browser QA verifies that the rendered phase advances.

**P2.1 delivered:** Spin Habitat now has an authored reusable environment kit with ring segments, spoke trusses, an axis hub, and service bays; every family ships adaptive LOD1/LOD2 assets, runtime authored placement, procedural fallback, and graphics-content regression coverage.

**P1.22 delivered:** Chapter 3 now uses a smoother authored pressure curve, stronger late/finale material premiums, separate opening-vs-closing boss durability budgets, preserved no-side-grind LV15–18 XP gates, and dedicated regression coverage for the tuned values. Android beta.134 re-verified the packaged combat/touch/lifecycle and native Chapter 3 touch flow.

**P1.21 delivered:** Packaged Android beta.133 now verifies Chapter 3 in the native WebView with touch-driven Intel/contract/route-decision interaction, LV15–18 checkpoint coverage, both completion branches, zero horizontal overflow at the Android emulator viewport, retained screenshot/report evidence, and the existing Android combat/lifecycle smoke.

**P1.20 delivered:** Dedicated Chapter 3 QA now plays all 12 operations through normal settlement/XP progression on both route branches, verifies LV16/LV17/LV18 gates, and exercises the Chapter 3 Intel/Contract Board flow at desktop and mobile-landscape browser viewports.

**P1.18 delivered:** Parallax Debt now has a dedicated LV15–18 phase timeline, evidence bank, route-decision/branch presentation, unresolved-evidence boundary, responsive mobile-landscape treatment, and regression coverage.

Sera Nox tuning is now phase-aware: Blind Meridian uses the lighter opening-finale budget while Chapter 3 closing bosses retain the higher end-of-chapter durability budget.

## Latest Verified Delivery

- Android beta: **0.0.1-beta.204**
- Package: `app.ironshade.vector`
- Verified: **P6.3 — T9+ mutations is complete.** Six deterministic T9–T12 elite/enhanced mutations are integrated with threat budgeting, Tactical Forecast, in-combat labels, real durability/mobility/fire/hazard cadence effects, and regression coverage. PR and merged-main desktop + mobile-landscape Browser E2E, Level 15 beta smoke, Android package/version/SDK/signature verification, native emulator install/launch/resume, touch/runtime QA, and the two-route Chapter 3 Android playthrough passed.
- Signing: current beta is debug-signed; permanent release signing is now **P17**
- P6.3 merged main / APK source: `ce02335ad307b2e4bae9897083080acc02482140`
- Final Browser E2E run: `35553418993`
- Level 15 beta smoke run: `35553418968`
- Android beta.204 run: `35553418964`
- Android beta.204 artifact ID: `10619296967`
- APK SHA-256: `5c47a13db9815fddee05e9e1744f7403cdc3e44f3146f181624d11bce8e2b5f9`
- Next implementation slice: **P6.4 — Boss phase mutations**
