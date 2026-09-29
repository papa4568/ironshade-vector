# Ironshade Vector — Active Production Roadmap

## New-chat handoff — resume here first

- **P23 is complete and archived.** Full Android verification now builds the APK once, fans out repeatable-family, Settings, Chapter 3, and remaining runtime/persistence/authored-asset coverage in parallel, then aggregates evidence behind one required gate. Normal `main` pushes remain fast-only.
- **P22 is complete and archived.** The full playable-UI audit closed the remaining fixed-pixel outliers and verified the reduced baseline across management, contract preparation, combat, dialogs, and compact landscape.
- **P21-A1 is complete and archived.** Combat rendering now enters through an explicit WebGL2 backend boundary with targeted create/render/resize/pointer/dispose coverage and verified Android touch/lifecycle behavior.
- **P21-A2 is complete and archived.** The existing deterministic Asteroid Refinery QA route now supports opt-in graphics-path selection and loaded-path/performance telemetry while production Android remains WebGL2.
- **P21-B is complete and archived.** The Asteroid Refinery WebGL2 recipe now includes a bounded PMREM IBL contribution with deterministic off/on visual evidence and verified Android lifecycle/resource cleanup.
- **P21-C is complete and archived.** The Asteroid Refinery WebGL2 slice now uses selective, refinery-scoped emissive bloom with deterministic off/on evidence, protected gameplay-cue groups, a 0–1 runtime cost control, and verified Android lifecycle behavior.
- **P21-D1 is complete and archived.** The Asteroid Refinery now has one bounded, scene-only soft contact-grounding pass with deterministic off/on evidence and verified Android lifecycle behavior.
- **P21-D2 is complete and archived.** The Asteroid Refinery now uses a restrained, location-aware linear depth atmosphere/color treatment with independent QA disablement, protected gameplay-cue verification, and Android lifecycle coverage.
- **P21-E is complete and archived.** The new refinery IBL, selective bloom, contact depth, and atmosphere now scale through the existing High/Balanced/Performance render budget while gameplay-critical cues remain full-strength; Browser and Android verification passed.
- **P21-F1 is complete and archived.** The isolated QA-only WebGPU/TSL refinery backend now lazy-loads behind the P21-A boundary, reuses the authored asset pipeline, preserves camera/input/lifecycle parity, and falls back reproducibly to production WebGL2 on current Browser/Android CI.
- **P21-F2 is complete and archived.** The QA-only WebGPU/TSL refinery slice now reproduces the proven P21-B–E effect contracts for direct comparison, records renderer/CI parity gaps explicitly, and preserves production WebGL2 plus Android fallback.
- **Resume P21-F3 next — Measure WebGPU Android compatibility and delivery cost.**
- **P20-E is closed and archived.** When global roadmap order later returns to P20, resume that sequence at **P20-F1 — Define and settle distinct repeatable-contract incentive profiles**.

Only active/future executable work lives here. Completed and verified work belongs in [content-roadmap-archive.md](./content-roadmap-archive.md). Stable product rules live in [product-constraints.md](./product-constraints.md).

## Execution contract

- Execute top to bottom. The **first unchecked top-level item is next** unless the user explicitly changes priority.
- One checkbox should fit one realistic **implement → test → build → APK verification** cycle.
- Split an item before coding if it spans independent systems or verification cycles; combine tiny changes when they touch the same system and can be verified together.
- An item is complete only when its requested behavior works, relevant regression checks pass, the production build succeeds, and the Android deliverable is verified as required by the repository workflow.
- After verified completion, move the completion detail/evidence to the archive and remove the item from this file.
- If repository evidence shows an active item is already complete, verify that evidence before archiving it. If only part is complete, rewrite the item around the remaining work.


## P23 — Android CI Feedback Loop

- **P23-A complete / archived** — Independent fast Android emulator smoke now covers startup, real-touch management + combat controls, ACT, pause/resume, crash/logcat checks, and screenshot evidence. Verified in Android beta.507 with the fast gate completing in 127 seconds; see the completion archive for evidence.

- **P23-B complete / archived** — Normal `main` pushes now build and verify the APK once, run only the fast Android emulator gate, retain Browser E2E/production-build requirements, and preserve the extended suites for full-regression work. Representative Android pushes completed in 8m02s / 131s smoke and 6m23s / 98s smoke; final Android beta.512 passed in 6m48s / 120s smoke.

- **P23-C complete / archived** — Stabilization, Salvage, and Boarding representative gameplay now runs in a dedicated full-regression Android job against the shared built debug APK. Full-regression run #520 passed all family/play/regression markers and clean logcat; normal `main` push smoke remains fast-only. See the completion archive for evidence.

- **P23-D complete / archived** — The black-box Settings matrix now runs in a dedicated full-regression Android job against the shared built debug APK, preserving adb/UiAutomator-only input, cold-relaunch persistence, accessibility assertions, and screenshot evidence. Full-regression run #521 passed the Settings job in parallel with P23-C; normal `main` push smoke remains fast-only. See the completion archive for evidence.

- **P23-E complete / archived** — Chapter 3 now runs in a dedicated full-regression Android job against the shared built APK, with fresh-save initialization, touch-driven route selection, both branch assertions, screenshot/report evidence, and clean-logcat verification. Normal `main` push smoke remains fast-only; see the completion archive for evidence.

- **P23-F complete / archived** — Manual/full and scheduled Android verification now reuse one shared APK, fan out repeatable-family, Settings, Chapter 3, and the remaining persistence/authored-asset runtime coverage in parallel, and aggregate their evidence behind one required full-verification gate. Normal `main` pushes remain on the fast Android path. Final full-regression run #534 passed all fan-out jobs and the aggregate gate; see the completion archive for evidence.

## P22 — Global UI Footprint Reduction

- **P22-A complete / archived** — Shared non-combat Interface Size geometry now uses a 70% Default baseline with ordered Compact/Default/Large presets, compact-phone readability/touch floors, and preserved combat-control geometry. Final verification: Level 15 beta smoke #792, Browser E2E #932, Android beta.503; see the completion archive for measured evidence and artifact details.

- **P22-B1 complete / archived** — Visible joystick, FIRE, DODGE, class-skill, and ACT bodies now use a 70% combat-control visual baseline while transparent hit extensions preserve the prior acquisition footprint and the persisted Standard/Large/Left-Handed/custom cluster transforms remain authoritative. Level 15 beta smoke #822, Browser E2E #953, and Android beta.535 passed; see the completion archive for measured geometry and APK evidence.

- **P22-B2 complete / archived** — Combat informational HUD chrome now uses a 70% visual baseline across health/resources, objectives, target/boss/status, loot, class-state, and transient information while retaining compact-phone readability floors, safe-area validity, and P22-B1 control hit geometry. Final verification: Level 15 beta smoke #830, Browser E2E #960, normal Android beta.546, and full Android beta.547; see the completion archive for measured live-combat, objective, pickup, and APK evidence.

- **P22-C complete / archived** — Full playable-UI verification closed the remaining fixed-pixel class-intake, contract-preparation, Armory-dialog, and combat-overlay outliers; measured management/contract geometry at 0.700, the Armory dialog at 0.738 in compact landscape, retained 12px-class phone readability floors, and passed main Browser E2E #969 plus Android beta.551. See the completion archive for screenshots, bounds, runtime evidence, and APK details.

## P21 — Graphics Engine Modernization

- **P21-A1 complete / archived** — Production WebGL2 now sits behind the explicit combat graphics-backend boundary; targeted lifecycle/pointer coverage plus Browser E2E, production build, and Android beta.558 touch/lifecycle verification passed. See the completion archive for evidence.

- **P21-A2 complete / archived** — The existing Asteroid Refinery QA journey now provides an opt-in graphics-path comparison selector with loaded-path, draw-call, triangle, frame, and adaptive-tier evidence; Browser E2E and production build passed, and Android beta.563 verified the untouched production-default WebGL2 path. See the completion archive for evidence.

- **P21-B complete / archived** — The existing WebGL2 key/rim/contact/practical + bounded-PBR/ACES refinery recipe now adds a reusable 64px PMREM environment contribution with warm furnace, cool service, and neutral fill response; deterministic QA captures, desktop/mobile Browser E2E, production build, and Android beta.564 lifecycle/resource verification passed. See the completion archive for evidence.

- **P21-C complete / archived** — Selective refinery bloom now targets authored terminal/processor emissives, practical-light glow proxies, and important muzzle VFX on an isolated layer; HUD/UI and gameplay-critical cue groups stay outside bloom, the runtime cost control can reduce or bypass the pass, and desktop/mobile Browser E2E plus Android beta.567 passed. See the completion archive for evidence.

- **P21-D1 complete / archived** — Refinery machinery/floor intersections now use a single bounded instanced soft-contact grounding pass (10 instances / 20 triangles / 1 draw call / 32px alpha footprint), with QA-only disablement, protected gameplay/UI cue telemetry, deterministic desktop/mobile captures, and Android beta.569 combat/lifecycle verification. See the completion archive for evidence.

- **P21-E complete / archived** — The refinery IBL, selective bloom, contact-depth, and atmosphere contributions now scale through the existing High/Balanced/Performance render budget; critical cues remain at 1.00, sustained degrade/recover still passes, and Browser E2E plus Android beta.573 verified coherent play across all three tiers. See the completion archive for evidence.

- **P21-F2 complete / archived** — The QA-only WebGPU/TSL refinery slice now reproduces the proven P21-B–E visual contracts, captures a renderer-owned stack-off/stack-on WebGPU comparison, records the remaining PMREM/full-combat plus CI presentation/readback gaps explicitly, and preserves production WebGL2 with Android fallback. Final verification: Level 15 beta smoke #896, Browser E2E #1040, Android beta.604. See the completion archive for evidence.

- [ ] **P21-F3 — Measure WebGPU Android compatibility and delivery cost** — Measure renderer initialization/fallback behavior, frame diagnostics, bundle/APK delta, and Android WebView compatibility for the completed WebGPU prototype without changing production defaults. **Done when:** reproducible browser and Android evidence records supported/unsupported behavior, bundle/APK impact, initialization differences, and renderer-specific defects; production WebGL2 remains intact; Browser E2E and production build pass; and the Android artifact is verified.

- [ ] **P21-G — Make the engine decision from measured refinery evidence** — Compare the verified WebGL2 and WebGPU/TSL slices using captured screenshots plus existing diagnostics: visual result, draw calls/triangles, frame-time/adaptive-tier behavior, bundle/APK impact, Android compatibility, implementation complexity, and renderer-specific defects. Document the concrete systems a future Godot/Unity-class replatform would have to replace or bridge—TypeScript simulation, React UI, Capacitor Android integration, deterministic tests, save/runtime contracts, graphics assets, and release QA—then record one next-path decision and reorder the roadmap around it without starting a replatform. **Done when:** comparison evidence and the engine decision are committed; the active roadmap contains only follow-on work for the chosen path; Browser E2E and production build still pass; and the current production Android APK is reverified after the decision/documentation changes.

## P20 — Build Usability, Skill Integrity & Repeatable Contract Identity

- [ ] **P20-F1 — Define and settle distinct repeatable-contract incentive profiles** — Give Salvage, Boarding, and Stabilization separate reward/chase profiles using the existing economy, faction/reputation, gear-source, optional-objective, and recovery systems rather than adding a new currency. Implement the profile definitions and settlement/generation behavior only; preserve campaign-only reward boundaries and meaningful safe-vs-deep tradeoffs. **Done when:** deterministic generation/settlement tests prove each family grants its authored incentive, deep variants preserve the intended tradeoff, campaign-only rewards cannot leak, Browser E2E regression gates and production build pass, and the Android APK completes a representative settlement smoke without reward corruption.

- [ ] **P20-F2 — Surface repeatable-contract incentives before deployment** — Present each family’s distinctive expected payoff on the existing contract card/prepared briefing surfaces using the P20-F1 profile data, without duplicating reward logic in UI code. **Done when:** all three family cards/briefings communicate materially different incentive profiles and safe/deep implications before launch; targeted UI/mission-presentation tests, Browser E2E, and production build pass; and Android verifies readable reward presentation on all three choices.

- [ ] **P20-F3 — Balance and verify repeatable-contract incentives across progression** — Run a deterministic early/mid/late balance matrix against the completed incentive profiles, tune only the profile values needed so no family is the strictly best answer for every progression need, and verify end-to-end settlement for all three families. **Done when:** the matrix shows each family remains useful while serving a distinct progression need; settlement/regression tests pass after tuning; Browser E2E and production build pass; and the verified Android APK confirms reward presentation plus post-contract settlement for Salvage, Boarding, and Stabilization.
