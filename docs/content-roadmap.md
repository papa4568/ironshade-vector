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

## P2 — Authored Biomes Pack I

### Spin Habitat
- [x] P2.1 Unique environment kit
- [x] P2.2 Rotating habitat architecture
- [x] P2.3 Rim / spoke / axis visual differences
- [x] P2.4 Spindown VFX
- [x] P2.5 Machinery/interactables
- [x] P2.6 Local enemy visual identity
- [ ] P2.7 Sable Voss presentation
- [ ] P2.8 Biome ambient effects
- [ ] P2.9 Mobile LOD/performance

### Jovian Harvester
- [ ] P2.10 Environment kit
- [ ] P2.11 Gas-harvester machinery
- [ ] P2.12 Storm/pressure visual language
- [ ] P2.13 Pressure props/interactables
- [ ] P2.14 Stormline Foreman presentation
- [ ] P2.15 Atmospheric effects
- [ ] P2.16 Mobile LOD/performance

**Gate:** recognizable from screenshots without HUD text.

## P3 — Authored Biomes Pack II

### Ice Mine
- [ ] P3.1 Assets
- [ ] P3.2 Bore/tunnel geometry
- [ ] P3.3 Brittle support destruction
- [ ] P3.4 Cryogenic machinery
- [ ] P3.5 Collapse/fracture effects
- [ ] P3.6 Rhea Kade presentation

### Solar Yard
- [ ] P3.7 Assets
- [ ] P3.8 Fabrication machinery
- [ ] P3.9 Sun/shadow identity
- [ ] P3.10 Thermal shutters
- [ ] P3.11 Cranes/rails/motion
- [ ] P3.12 HELIOS-9 presentation
- [ ] P3.13 Mobile optimization

## P4 — Megastructure Capstone Pass

- [ ] P4.1–P4.4 Perseid
- [ ] P4.5–P4.8 K-91
- [ ] P4.9–P4.11 Orpheline
- [ ] P4.12–P4.14 Hecate
- [ ] P4.15 Stage transitions
- [ ] P4.16 Environmental continuity
- [ ] P4.17 Debrief improvements
- [ ] P4.18 Mobile performance

## P5 — Class Capstones

- [ ] P5.1 Vanguard third specialization
- [ ] P5.2 Vanguard skill evolution
- [ ] P5.3 Vanguard capstone interactions
- [ ] P5.4 Deepen Vector specializations
- [ ] P5.5 Vector skill evolutions
- [ ] P5.6 Systems third specialization
- [ ] P5.7 Systems skill evolution
- [ ] P5.8 Systems capstone interactions
- [ ] P5.9 Same-class builds feel different at LV16+
- [ ] P5.10 Specialization gear synergies
- [ ] P5.11 Visual combat feedback
- [ ] P5.12 Regression coverage
- [ ] P5.13 Mobile playtesting

## P6 — T9–T12 Directive Expansion

- [ ] P6.1 Exclusive protocol combinations
- [ ] P6.2 Enhanced protocol variants
- [ ] P6.3 T9+ mutations
- [ ] P6.4 Boss phase mutations
- [ ] P6.5 Command Target mutations
- [ ] P6.6 Dangerous environmental combinations
- [ ] P6.7 Exclusive Singular pool
- [ ] P6.8 Risk/reward modifiers
- [ ] P6.9 Reward previews
- [ ] P6.10 Deterministic simulations
- [ ] P6.11 Mobile worst-case stress testing

## P7 — Weapon Variety

- [ ] P7.1 Burst Carbine
- [ ] P7.2 Precision Carbine
- [ ] P7.3 Slug Breacher
- [ ] P7.4 Rapid Breacher
- [ ] P7.5 Charge Rail
- [ ] P7.6 Repeater Rail
- [ ] P7.7 Unique silhouettes
- [ ] P7.8 Affix compatibility
- [ ] P7.9 Class interactions
- [ ] P7.10 Singular compatibility
- [ ] P7.11 Mobile testing
- [ ] P7.12 Variety playtest
- [ ] P7.13 Decide whether weapon family #4 is actually needed

## P8 — External Beta / Delivery

- [ ] P8.1 Permanent signing credentials
- [ ] P8.2 Persistent release-signed APK
- [ ] P8.3 Verify upgrade path
- [ ] P8.4 GitHub Release workflow
- [ ] P8.5 Non-expiring releases
- [ ] P8.6 Release notes/changelog
- [ ] P8.7 Beta save policy
- [ ] P8.8 Clean-install QA
- [ ] P8.9 Upgrade-install QA
- [ ] P8.10 External beta candidate

## Current Execution Order

**P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8**

## Immediate Queue

P1 is complete and **P2.6 is now delivered**. Continue in roadmap order with **P2.7 — Sable Voss presentation**, keeping ambient effects and the dedicated mobile optimization pass in their later P2 slots.

**P2.6 delivered:** Spin Habitat combat now has four biome-local authored enemy identities tied to the existing tactical variants: Spoke Marksman, Spin-Trim Specialist, Ring Drone Carrier, and Axis Shield Boarder. Each identity ships adaptive LOD1/LOD2 GLBs with preserved articulated enemy rig sockets, a distinct silhouette marker and cool green/cyan habitat palette; renderer routing is restricted to Spin Habitat and deliberately leaves Recovery Commander Sable Voss on the generic boss path for P2.7. Generated-content tests validate every local LOD pair and mobile payload reduction, runtime QA exposes the local kit/assets and fallback state, desktop + mobile-landscape Browser E2E verify all four authored identities in live Spin Habitat combat, and Android beta.152 re-verifies package metadata/signature plus native emulator runtime/touch smoke.\n\n**P2.5 delivered:** Spin Habitat gameplay machinery now has five authored, mobile-LOD-aware families tied to the real mission objects: spin-bus isolators, rim/spoke gravity trims, bearing-control recovery hardware, attitude flywheels, and pressure locks. The renderer selects these families by biome, object kind, and machinery-recovery objective identity while preserving generic salvage/cache visuals where appropriate. Runtime QA exposes the active habitat interactable kit and loaded assets, generated-GLB tests validate every LOD pair and silhouette marker, desktop and mobile-landscape Browser E2E verify authored habitat machinery without procedural fallback, and Android beta.151 re-verifies the packaged runtime, touch flow, Chapter 3 playthrough, package metadata, signature, and emulator smoke.

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

- Android beta: **0.0.1-beta.152**
- Package: `app.ironshade.vector`
- Verified: P2.6 authored Spin Habitat local enemy visual identity with four gameplay-variant-specific adaptive LOD1/LOD2 families, preserved enemy rig/sockets and local palette, generated GLB content/silhouette/mobile-payload coverage, full production regression/build, desktop + mobile-landscape Browser E2E with live four-enemy authored/no-fallback assertions, Level 15 beta smoke, Android APK package/version/signature checks, Android emulator runtime/touch smoke, and retained browser/Android QA artifacts
- Signing: current beta is debug-signed; permanent release signing remains **P8**
- P2.6 runtime delivery commit: `656e42c872bca8d6c72cf886c311061749e7559d`
- Browser E2E run: `35474569834`
- Level 15 beta smoke run: `35474569883`
- Android beta.152 run: `35474569915`
- Android beta.152 artifact ID: `10593268282`
- Android beta.152 artifact head: `656e42c872bca8d6c72cf886c311061749e7559d`
