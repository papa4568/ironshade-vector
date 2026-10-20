# Ironshade Vector — Active Production Roadmap

## New-chat handoff — resume here first

- The P27 Babylon.js renderer migration and Three.js retirement are complete. Babylon.js is the sole production combat renderer.
- P28 is a **flagship-phone visual-quality overhaul inside Babylon**, not another engine migration.
- The product target is current high-performance / flagship-class phones. Flagship quality is the art-direction and visual-acceptance baseline; low/mid-range compatibility is not allowed to flatten the game.
- Existing adaptive tiers, LODs, cache limits, effect scales, and other legacy mobile safeguards are engineering recovery mechanisms only. They are not product-level visual ceilings and may be raised, removed, or replaced when target-device measurements justify it.
- Do not impose arbitrary limits on texture resolution, geometry density, shadows, reflections, AO, post-processing, particles, decals, material complexity, or scene density before profiling the actual result on target high-performance phones.
- The current renderer already has strong foundations to reuse: authored GLB/KTX2/Meshopt loading, PBR materials, ACES tone mapping, selective bloom/fog, location presentation modules, optional adaptive recovery, and deterministic browser/Android QA.
- A physical-device report now shows that some detailed routes, including Deep Salvage / Asteroid Refinery, can collapse to apparent single-digit FPS. Treat that as an engineering defect before adding more flagship rendering cost.
- Catastrophic-frame adaptive recovery now measures sustained 90–250 ms active frames, ignores true suspend/background gaps, and can drive High → Balanced → Performance while preserving healthy recovery back to High. Avoidable refinery per-frame shadow-list and material-light rebuilds are cached behind topology/anchor/tier work keys, and P28-P2 now exposes one comparable route-cost signature across all 11 currently ported locations with severe-pressure recovery coverage.
- Physical-device captures also show missions becoming playable while major environment geometry is still absent, then popping in much later. The current refinery path preloads unique families with concurrency 2, then awaits every placement instantiation serially under one disabled root and enables the whole authored shell only after the final placement; mapped world objects also resolve asynchronously afterward. P28-PLOAD must establish a real visual-readiness contract and remove this serialized load bottleneck before further visual escalation.
- The current visual ceiling is largely content/presentation quality: the refinery still uses a tiny procedural cubemap for IBL, generic world objects can fall back to simple boxes, contact-depth uses proxy cards rather than true SSAO, and hero/operator/enemy families currently stop at LOD1/LOD2.
- The authored-asset build path is itself a major visual blocker: `scripts/prepare-graphics-assets.mjs` currently emits GLBs from a single cube vertex/index primitive and assembles many operators, enemies, and environment assets from scaled box nodes with factor-only materials. P28 must upgrade that source/build path before treating new LOD0 assets as premium art.
- P28 includes an explicit **heavy asset production phase** before campaign-wide rollout. Renderer-only improvements, placeholder-scale GLBs, or synthetic padding do not satisfy it: the shipped APK must contain materially richer authored texture and geometry payloads, with exact per-family size/quality telemetry proving the growth comes from real art content.
- P28-G2 archived the cross-map floor-marking and generic shared-world-object visual debt; later G/H locations must keep enforcing the campaign visual acceptance contract.
- The **first unchecked executable item below is the next engineering task**. Hardware/manual-only validation lives in [external-qa.md](./external-qa.md) and does not participate in queue ordering.

Only active/future executable engineering work lives here. Completed and verified work belongs in [content-roadmap-archive.md](./content-roadmap-archive.md). Stable product rules live in [product-constraints.md](./product-constraints.md). External-only validation lives in [external-qa.md](./external-qa.md).

## Execution contract

- Execute top to bottom. The **first unchecked executable top-level item is next** unless the user explicitly changes priority.
- One checkbox should fit one realistic **implement → targeted test → final build/CI/APK verification** cycle.
- Split an item before coding if it spans independent systems or verification cycles; combine tiny changes only when they touch the same system and can be verified together.
- Keep gameplay simulation authoritative. Babylon presentation may consume state but must not change combat timing, collision, mission logic, or save semantics.
- Preserve combat readability: telegraphs, hazards, objectives, status/protocol cues, target feedback, and touch/controller behavior must remain clear even when effects are visually richer.
- Do not add or preserve a graphics cap merely because it is "mobile safe." A hard limit needs measured evidence from the target high-performance phone class or a concrete engine/Android failure mode.
- Each visual task must add/update deterministic Flagship captures, pass targeted regressions, complete the production build, and pass the repository's required Android/APK gate.
- A P28-G/H visual task is not done until an independent reviewer inspects actual high-tier normal/action gameplay-frame content at the correct map ID and checks visible world/route mesh provenance, texture readiness and fallbacks. Loaded texture flags, mesh counts or valid PNGs alone do not prove premium scene quality; apply the campaign visual acceptance contract. GPU-heavy changes should also be exercised on real high-performance Android phone hardware when available; external physical-device acceptance is tracked separately in `docs/external-qa.md`.
- Lower quality tiers may remain as emergency recovery paths, but P28 does not require visual parity with them. They must only remain functional enough to avoid crashes and preserve gameplay-critical cues.
- After verified completion, move completion detail/evidence to the archive and remove the item from this file.

## Active queue

### P28 — Babylon flagship visual-quality overhaul

#### E. Refinery ambience and local visual richness

#### F. Heavy authored-asset production and shipping gate

This phase is deliberately asset-heavy. It converts the earlier renderer/material/LOD foundations into substantial production art payloads before campaign-wide rollout. It must increase install content through useful authored art rather than padding, duplicate files, intentionally poor compression, or dead assets.



#### G. Campaign-location rollout of the shared visual stack

Each rollout below reuses the P28 lighting/material/grounding/detail systems and existing location modules; it is a location-integration/tuning batch only, not a new hero-asset or gameplay-design batch.

All remaining P28-G/H work must meet the [campaign visual acceptance contract](./product-constraints.md#campaign-visual-acceptance-contract); screenshots must be inspected for image content rather than accepted by metadata or PNG validation alone.


- [ ] **P28-G4 — Refresh Jovian Harvester visuals** — Adopt the shared P28 stack in Jovian Harvester and tune its industrial/atmospheric profile. **Done when:** the route gains premium authored depth and identity while storm/hazard tells remain dominant, and standard build/APK gates pass; the campaign visual acceptance contract passes on real normal/action screenshots, with no unexplained bare placeholders, oversized route-band visuals, or missing material bindings.

- [ ] **P28-G5 — Refresh Ice Mine visuals** — Adopt the shared P28 stack in Ice Mine and tune ice/metal roughness, occlusion, refraction/reflection, and cold-light parameters while preserving fracture/hazard readability. **Done when:** ice and machinery no longer read as flat-color geometry on the flagship target and standard build/APK gates pass; the campaign visual acceptance contract passes on real normal/action screenshots, with no unexplained bare placeholders, oversized route-band visuals, or missing material bindings.

- [ ] **P28-G6 — Refresh Lattice Annex visuals** — Adopt the shared P28 stack in Lattice Annex and tune its reference-pylon/survey visual profile. **Done when:** the route is visually distinct and grounded on the flagship target with unchanged gameplay cues, and standard build/APK gates pass; the campaign visual acceptance contract passes on real normal/action screenshots, with no unexplained bare placeholders, oversized route-band visuals, or missing material bindings.

- [ ] **P28-G7 — Refresh Momentum Exchange visuals** — Adopt the shared P28 stack in Momentum Exchange and tune its flywheel/transfer machinery visual profile. **Done when:** the route has premium mechanical layering without masking motion/hazard cues, and standard build/APK gates pass; the campaign visual acceptance contract passes on real normal/action screenshots, with no unexplained bare placeholders, oversized route-band visuals, or missing material bindings.

- [ ] **P28-G8 — Refresh Cryo Reserve visuals** — Adopt the shared P28 stack in Cryo Reserve and tune its thermal/cryogenic material-light-atmosphere profile. **Done when:** cryogenic identity is visible through presentation rather than HUD alone, boiloff/thermal cues stay readable, and standard build/APK gates pass; the campaign visual acceptance contract passes on real normal/action screenshots, with no unexplained bare placeholders, oversized route-band visuals, or missing material bindings.

- [ ] **P28-G9 — Refresh Parallax Array visuals** — Adopt the shared P28 stack in Parallax Array and tune its metrology/reference hardware profile. **Done when:** the route gains premium authored material/depth treatment while reference/gameplay cues remain distinct, and standard build/APK gates pass; the campaign visual acceptance contract passes on real normal/action screenshots, with no unexplained bare placeholders, oversized route-band visuals, or missing material bindings.

#### H. Capstone visual refreshes

- [ ] **P28-H1 — Refresh Perseid capstone visuals** — Adopt the shared P28 visual stack in the Perseid capstone without changing stage mechanics. **Done when:** the capstone has premium material/light/grounding treatment on the flagship target, boss/hazard cues remain dominant, and standard build/APK gates pass; the campaign visual acceptance contract passes on real normal/action screenshots, with no unexplained bare placeholders, oversized route-band visuals, or missing material bindings.

- [ ] **P28-H2 — Refresh K-91 capstone visuals** — Adopt the shared P28 stack in K-91 without changing stage mechanics. **Done when:** the capstone has premium material/light/grounding treatment on the flagship target, boss/hazard cues remain dominant, and standard build/APK gates pass; the campaign visual acceptance contract passes on real normal/action screenshots, with no unexplained bare placeholders, oversized route-band visuals, or missing material bindings.

- [ ] **P28-H3 — Refresh Orpheline capstone visuals** — Adopt the shared P28 stack in Orpheline without changing stage mechanics. **Done when:** the capstone has premium material/light/grounding treatment on the flagship target, boss/hazard cues remain dominant, and standard build/APK gates pass; the campaign visual acceptance contract passes on real normal/action screenshots, with no unexplained bare placeholders, oversized route-band visuals, or missing material bindings.

- [ ] **P28-H4 — Refresh Hecate capstone visuals** — Adopt the shared P28 visual stack in Hecate without changing stage mechanics. **Done when:** the capstone has premium material/light/grounding treatment on the flagship target, boss/hazard cues remain dominant, and standard build/APK gates pass; the campaign visual acceptance contract passes on real normal/action screenshots, with no unexplained bare placeholders, oversized route-band visuals, or missing material bindings.

Physical-device P28 acceptance and sustained Flagship validation are tracked in [external-qa.md](./external-qa.md) so they can block release acceptance without deadlocking the executable engineering queue.