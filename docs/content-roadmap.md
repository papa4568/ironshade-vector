# Ironshade Vector — Active Production Roadmap

## New-chat handoff — resume here first

- All previously completed P20–P23 work plus P24-A–P24-D, verified P25 work, verified P26-A–P26-B work, and verified P27-A1–P27-B7 work is preserved in [content-roadmap-archive.md](./content-roadmap-archive.md).
- On 2026-09-29 the product direction changed explicitly: migrate the combat graphics engine from Three.js to **Babylon.js** while preserving the TypeScript simulation, React UI, Capacitor Android delivery, save/runtime contracts, and gameplay behavior.
- The previous P21-G decision to keep Three.js as the long-term production renderer is now superseded; its measurements remain the migration baseline and rollback evidence in [graphics-engine-decision.md](./graphics-engine-decision.md).
- The migration is incremental. Three.js WebGL2 remains the production renderer until Babylon passes the roadmap's visual, gameplay, performance, lifecycle, bundle, and Android gates. Babylon Lite is not the migration target because the required Android baseline still needs a WebGL2-capable path.
- The **first unchecked item below is the next executable task**.

Only active/future executable work lives here. Completed and verified work belongs in [content-roadmap-archive.md](./content-roadmap-archive.md). Stable product rules live in [product-constraints.md](./product-constraints.md).

## Execution contract

- Execute top to bottom. The **first unchecked top-level item is next** unless the user explicitly changes priority.
- One checkbox should fit one realistic **implement → test → build → APK verification** cycle.
- Split an item before coding if it spans independent systems or verification cycles; combine tiny changes only when they touch the same system and can be verified together.
- An item is complete only when its requested behavior works, relevant regression checks pass, the production build succeeds, and the Android deliverable is verified as required by the repository workflow.
- After verified completion, move the completion detail/evidence to the archive and remove the item from this file.
- If repository evidence shows an active item is already complete, verify that evidence before archiving it. If only part is complete, rewrite the item around the remaining work.

## Active queue

### P27 — Babylon.js renderer migration

#### Asteroid Refinery vertical-slice parity

- [x] **P27-B8 — Port enemy telegraphs and boss phase cues to Babylon** — Reproduce enemy attack telegraphs, aim/range shapes, boss attack-pattern warnings, and boss phase-transition cues with the same timing and gameplay meaning as the current renderer. **Done when:** representative normal, elite, and refinery-boss attacks are readable at normal phone zoom before damage resolves, timing matches simulation state, and the required build/APK gates pass.
- [x] **P27-B9 — Port protocol, mutation, and status visuals to Babylon** — Reproduce enhanced-protocol/mutation hardware/fields plus player and enemy status-state visuals using the existing protocol/status presentation data. **Done when:** representative protocol, mutation, and status combinations remain distinguishable without hue-only dependence at Performance tier, targeted status/protocol regressions pass, and the required build/APK gates pass.
- [x] **P27-B12 — Build Babylon post-processing and atmosphere parity** — Completed and verified; implementation and delivery evidence are archived in `docs/content-roadmap-archive.md`.

#### Campaign location parity

- [x] **P27-C1 — Port Orbital Station environment parity** — Completed and verified; implementation, browser playability, Android runtime, and APK evidence are archived in `docs/content-roadmap-archive.md`.
- [x] **P27-C2 — Port Damaged Vessel environment parity** — Completed and verified; implementation, browser playability, Android runtime, and APK evidence are archived in `docs/content-roadmap-archive.md`.
- [x] **P27-C3 — Port Spin Habitat environment parity** — Completed and verified; implementation, browser playability, Android runtime, and APK evidence are archived in `docs/content-roadmap-archive.md`.
- [x] **P27-C4 — Port Jovian Harvester environment parity** — Completed and verified; implementation, browser playability, Android runtime, and APK evidence are archived in `docs/content-roadmap-archive.md`.
- [x] **P27-C5 — Port Ice Mine environment parity** — Completed and verified; implementation, browser playability, Android runtime, fracture/hazard parity, and APK evidence are archived in `docs/content-roadmap-archive.md`.
- [x] **P27-C7 — Port Lattice Annex environment parity** — Move Lattice Annex reference-pylon architecture, survey material language, props, interactables, hazards, and location-specific gameplay cues to Babylon. **Done when:** its deterministic route is fully playable and visually identifiable on Babylon with no Three-only required world cue, and the required build/APK gates pass.
- [x] **P27-C8 — Port Momentum Exchange environment parity** — Move Momentum Exchange flywheel/transfer architecture, magnetic-machinery treatment, props, interactables, hazards, and location-specific gameplay cues to Babylon. **Done when:** its deterministic route is fully playable and visually identifiable on Babylon with no Three-only required world cue, and the required build/APK gates pass.
- [x] **P27-C9 — Port Cryo Reserve environment parity** — Completed and verified; implementation, browser playability, Android runtime, boiloff/thermal-routing parity, and APK evidence are archived in `docs/content-roadmap-archive.md`.
- [x] **P27-C10 — Port Parallax Array environment parity** — Move Parallax Array baseline-pylon architecture, metrology/reference treatment, props, interactables, hazards, and location-specific gameplay cues to Babylon. **Done when:** its deterministic route is fully playable and visually identifiable on Babylon with no Three-only required world cue, and the required build/APK gates pass.
- [x] **P27-C11 — Port Perseid capstone renderer parity** — Move Perseid-specific stage identity, world presentation, hazards/interactables, boss/capstone cues, and remaining Three-only visual branches to Babylon. **Done when:** the Perseid capstone route is fully playable/readable on Babylon with no required Three-only presentation branch, targeted capstone regressions pass, and the required build/APK gates pass.
- [x] **P27-C12 — Port K91 capstone renderer parity** — Completed and verified; implementation, browser playability, Android runtime, K-91 stage/cue parity, and APK evidence are archived in `docs/content-roadmap-archive.md`.
- [x] **P27-C13 — Port Orpheline capstone renderer parity** — Move Orpheline-specific stage identity, world presentation, hazards/interactables, boss/capstone cues, and remaining Three-only visual branches to Babylon. **Done when:** the Orpheline capstone route is fully playable/readable on Babylon with no required Three-only presentation branch, targeted capstone regressions pass, and the required build/APK gates pass.
- [x] **P27-C14 — Port Hecate capstone renderer parity** — Move Hecate-specific stage identity, world presentation, hazards/interactables, boss/capstone cues, and remaining Three-only visual branches to Babylon. **Done when:** the Hecate capstone route is fully playable/readable on Babylon with no required Three-only presentation branch, targeted capstone regressions pass, and the required build/APK gates pass.

#### Backend expansion, acceptance, and cutover

- [x] **P27-D1 — Add optional Babylon WebGPU with Babylon WebGL2 fallback** — Completed and verified; implementation, desktop WebGPU/device-loss fallback, deterministic backend telemetry, Android WebGL2 compatibility, and APK evidence are archived in `docs/content-roadmap-archive.md`.
- [x] **P27-D2 — Re-establish client bundle and APK delivery budgets for Babylon** — Completed and verified; deferred Babylon bundle architecture, unused-module guards, delivery-size measurement, browser QA, Android runtime/lifecycle, large-screen QA, and APK evidence are archived in `docs/content-roadmap-archive.md`.
- [x] **P27-D3 — Map Babylon geometry and resource quality budgets** — Completed and verified; adaptive Babylon hardware/detail scaling, authored LODs, static instancing, bounded cache residency, animation stride, measured draw/triangle/cache telemetry, browser QA, Android runtime/lifecycle/large-screen QA, and APK evidence are archived in `docs/content-roadmap-archive.md`.
- [x] **P27-D4 — Map Babylon effects quality budgets** — Completed and verified; adaptive Babylon shadows/post/IBL/transparency/VFX budgets, protected full-strength combat cues, measured desktop/mobile frame evidence, degrade/recover coverage, browser QA, Android runtime/lifecycle/large-screen QA, and APK evidence are archived in `docs/content-roadmap-archive.md`.
- [x] **P27-D5 — Prove Babylon Android interaction and lifecycle compatibility** — Exercise install/launch, real touch combat, pause/resume, mission enter/exit, large-screen/resizable behavior, renderer re-entry, and required Babylon WebGL2 fallback on the repository's Android verification targets. **Done when:** touch/controller behavior, pause/resume, orientation/window behavior, and renderer recreation pass the Android smoke/regression gates without Babylon-specific crashes or lost input.
- [x] **P27-D6 — Prove Babylon sustained-runtime resource stability** — Completed and verified on the API-35 sustained Babylon soak: 7/7 renderer lifecycle recreations, stable 50 ms frame-p95, identical scene/cache resource envelopes across re-entry, post-GC retained heap within the leak gate, and Android PSS +9 MB with a stable PID. Evidence: workflow run `37126872929`, artifact `11275957176`.
- [ ] **P27-D7 — Cut production combat rendering over to Babylon** — Change the production default from Three WebGL2 to Babylon only after all prior parity/performance/Android gates pass; keep an explicit temporary Three rollback selector for the cutover verification cycle and regenerate deterministic browser/Android visual baselines where the intended renderer changes output. **Done when:** ordinary production startup selects Babylon, full gameplay/regression/build/APK gates pass without QA flags, rollback remains functional, and the cutover evidence is recorded.
- [ ] **P27-D8 — Retire the Three production and P21 WebGPU QA backends** — After the Babylon production cutover is verified, remove the old Three combat renderer and obsolete Three WebGPU/TSL comparison backend from runtime selection while preserving any still-useful renderer-neutral QA measurements. **Done when:** no normal or QA runtime path requires either old backend, graphics-path tests reflect the Babylon architecture, and the required build/APK gates pass.
- [ ] **P27-D9 — Remove Three-only runtime dependencies and finalize graphics documentation** — Remove remaining Three.js/@types/three dependencies, Three-specific loader/codec plumbing, bundle rules, dead renderer helpers, and obsolete P21 implementation notes only after code search proves they are unused; update the graphics asset/engine/QA docs to describe Babylon ownership and rollback history. **Done when:** production builds contain no unintended Three runtime chunks/imports, graphics asset preparation still works locally and in APK builds, documentation matches the shipped architecture, and the required build/APK gates pass.
