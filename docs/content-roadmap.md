# Ironshade Vector — Active Production Roadmap

## New-chat handoff — resume here first

- The P27 Babylon.js renderer migration and Three.js retirement are complete. Babylon.js is the sole production combat renderer.
- P28 is a **flagship-phone visual-quality overhaul inside Babylon**, not another engine migration.
- The product target is current high-performance / flagship-class phones. Flagship quality is the art-direction and visual-acceptance baseline; low/mid-range compatibility is not allowed to flatten the game.
- Existing adaptive tiers, LODs, cache limits, effect scales, and other legacy mobile safeguards are engineering recovery mechanisms only. They are not product-level visual ceilings and may be raised, removed, or replaced when target-device measurements justify it.
- Do not impose arbitrary limits on texture resolution, geometry density, shadows, reflections, AO, post-processing, particles, decals, material complexity, or scene density before profiling the actual result on target high-performance phones.
- The current renderer already has strong foundations to reuse: authored GLB/KTX2/Meshopt loading, PBR materials, ACES tone mapping, selective bloom/fog, location presentation modules, optional adaptive recovery, and deterministic browser/Android QA.
- The current visual ceiling is largely content/presentation quality: the refinery still uses a tiny procedural cubemap for IBL, generic world objects can fall back to simple boxes, contact-depth uses proxy cards rather than true SSAO, and hero/operator/enemy families currently stop at LOD1/LOD2.
- The authored-asset build path is itself a major visual blocker: `scripts/prepare-graphics-assets.mjs` currently emits GLBs from a single cube vertex/index primitive and assembles many operators, enemies, and environment assets from scaled box nodes with factor-only materials. P28 must upgrade that source/build path before treating new LOD0 assets as premium art.
- P28 includes an explicit **heavy asset production phase** before campaign-wide rollout. Renderer-only improvements, placeholder-scale GLBs, or synthetic padding do not satisfy it: the shipped APK must contain materially richer authored texture and geometry payloads, with exact per-family size/quality telemetry proving the growth comes from real art content.
- The **first unchecked executable item below is the next engineering task**. Hardware/manual-only validation lives in [external-qa.md](./external-qa.md) and does not participate in queue ordering.

Only active/future executable engineering work lives here. Completed and verified work belongs in [content-roadmap-archive.md](./content-roadmap-archive.md). Stable product rules live in [product-constraints.md](./product-constraints.md). External-only validation lives in [external-qa.md](./external-qa.md).

## Execution contract

- Execute top to bottom. The **first unchecked executable top-level item is next** unless the user explicitly changes priority.
- One checkbox should fit one realistic **implement → targeted test → final build/CI/APK verification** cycle.
- Split an item before coding if it spans independent systems or verification cycles; combine tiny changes only when they touch the same system and can be verified together.
- Keep gameplay simulation authoritative. Babylon presentation may consume state but must not change combat timing, collision, mission logic, or save semantics.
- Preserve combat readability: telegraphs, hazards, objectives, status/protocol cues, target feedback, and touch/controller behavior must remain clear even when effects are visually richer.
- Do not add or preserve a graphics cap merely because it is "mobile safe." A hard limit needs measured evidence from the target high-performance phone class or a concrete engine/Android failure mode.
- Each visual task must add/update deterministic Flagship captures, pass targeted regressions, complete the production build, and pass the repository's required Android/APK gate. GPU-heavy changes should also be exercised on real high-performance Android phone hardware when available; external physical-device acceptance is tracked separately in `docs/external-qa.md`.
- Lower quality tiers may remain as emergency recovery paths, but P28 does not require visual parity with them. They must only remain functional enough to avoid crashes and preserve gameplay-critical cues.
- After verified completion, move completion detail/evidence to the archive and remove the item from this file.

## Active queue

### P28 — Babylon flagship visual-quality overhaul

#### D. Hero operators and enemy presentation

- [ ] **P28-D4 — Ship assault enemy LOD0** — Add a hero-near-camera LOD0 for the common assault enemy family without changing hitboxes, targeting, or lifecycle cues. **Done when:** Flagship uses the LOD0 where appropriate, telegraphs/status/lifecycle overlays still align, and standard build/APK gates pass.

- [ ] **P28-D5 — Ship suppressor enemy LOD0** — Add a full-detail LOD0 for the suppressor family with stronger weapon/armor silhouette separation. **Done when:** rig/overlay alignment, combat readability, visual improvement, and standard build/APK gates pass.

- [ ] **P28-D6 — Ship technician enemy LOD0** — Add a full-detail LOD0 for the technician family with readable tool/hardware silhouette detail. **Done when:** rig/overlay alignment, combat readability, visual improvement, and standard build/APK gates pass.

- [ ] **P28-D7 — Ship elite enemy LOD0** — Add a hero LOD0 for the elite family that reads as higher threat through silhouette/material detail before HUD labels. **Done when:** elite identity is distinguishable at gameplay zoom without hue-only dependence, lifecycle/telegraph alignment remains correct, and standard build/APK gates pass.

- [ ] **P28-D8 — Ship refinery boss LOD0** — Add a boss-quality LOD0 with stronger phase-readable hard-surface detail and emissive anchors while keeping boss mechanics and cue timing unchanged. **Done when:** Flagship uses the boss LOD0, phase cues align with the authored model, visual quality is materially above the current asset, and standard build/APK gates pass.

#### E. Refinery ambience and local visual richness

- [ ] **P28-E1 — Add a shared flagship ambient-particle system** — Add a Babylon ambient-effects layer with pooled dust, sparks, vapor/steam, and drifting debris primitives. Art-direct density for the flagship target first; optional runtime reduction may react to real measured pressure rather than fixed pre-selected caps. **Done when:** the system supports rich ambience, never suppresses gameplay VFX/cues, releases resources on renderer/location teardown, and targeted resource/performance plus standard build/APK gates pass.

- [ ] **P28-E2 — Art-direct refinery ambient particles** — Place the shared ambience around refinery machinery, vents, damaged service areas, and open industrial spaces without adding gameplay state. **Done when:** Deep Salvage gains visible depth/motion, particles never mask telegraphs/targets, and standard build/APK gates pass.

- [ ] **P28-E3 — Upgrade refinery practical/emissive fixtures** — Give furnace ports, terminals, warning fixtures, and selected machinery authored emissive surfaces that visually correspond to existing practical lights and selective bloom sources. **Done when:** bright fixtures appear to emit the light already present in the scene, bloom remains controlled, dark-area navigation improves without extra HUD, and standard build/APK gates pass.

- [ ] **P28-E4 — Add local reflection probes for refinery hero machinery and spaces** — Add Babylon reflection probes wherever they materially improve focal metal machinery/space reflections instead of enforcing a fixed probe-count ceiling. **Done when:** hero metal gains convincing localized reflection variation, probe placement/update behavior is deterministic, repository-visible performance/resource telemetry is available, and standard build/APK gates pass. Physical target-phone acceptance is tracked in `docs/external-qa.md`.

#### F. Heavy authored-asset production and shipping gate

This phase is deliberately asset-heavy. It converts the earlier renderer/material/LOD foundations into substantial production art payloads before campaign-wide rollout. It must increase install content through useful authored art rather than padding, duplicate files, intentionally poor compression, or dead assets.

- [ ] **P28-F0 — Add a heavyweight asset manifest and anti-placeholder quality gate** — Extend repository-visible asset telemetry so every premium texture/mesh family reports source dimensions, mip coverage, KTX2/GLB compressed and uncompressed bytes, material channels, vertex/triangle counts, and final APK contribution. Flag production LOD0 assets that still resolve to box-derived placeholder-scale geometry or omit required texture channels. **Done when:** CI produces a deterministic heavy-asset manifest for refinery, operator, enemy, boss, decal, and VFX families; real premium assets are distinguishable from recovery placeholders by measurable content; synthetic padding/duplicate bytes cannot satisfy the gate; and standard build/APK gates pass.

- [ ] **P28-F1 — Ship the high-resolution refinery texture payload** — Expand the P28 material library into final authored refinery texture sets with source resolution selected from visible need, including base-color, normal, packed ORM, emissive, decals/trim, grime/heat variation, and mipmapped local KTX2 delivery. Use 2K/4K-class sources where gameplay framing benefits from them instead of preserving legacy low-resolution ceilings. **Done when:** representative floors, bulkheads, cover, crates, processors, terminals, pipes, conduits, gantries, and focal machinery use real packaged texture maps; the asset manifest records substantial non-placeholder texture payload; Flagship captures show the additional frequency/detail; and standard build/APK gates pass.

- [ ] **P28-F2 — Ship a dense refinery hero-geometry payload** — Take the LOD0 refinery families established in P28-C and add the second-order hard-surface geometry that should remain geometric at flagship gameplay zoom: bevel networks, recessed panels, fasteners, braces, handles, vents, pipe fittings, cable hardware, layered housings, and focal machinery breakup. Preserve simulation-owned dimensions and use LOD1/LOD2 only for recovery. **Done when:** the shipped LOD0 refinery pack is materially denser than the legacy cube assemblies in measured vertex/triangle and byte payload, silhouettes and close gameplay views visibly benefit, no arbitrary triangle ceiling forces simplification, and standard build/APK gates pass.

- [ ] **P28-F3 — Ship heavyweight operator, enemy, and boss art payloads** — Finish the P28-D hero families with substantial unique mesh and texture data for Vanguard, Vector, Systems, assault, suppressor, technician, elite, and the refinery boss rather than thin variants of shared box-node bodies. Preserve rig names, animation hooks, sockets, hitboxes, and cue alignment. **Done when:** each family has a production LOD0 with unique authored geometry plus textured PBR material data, hero/boss assets are no longer kilobyte-scale placeholder assemblies, the manifest records their individual and aggregate APK contribution, and standard animation/combat/build/APK gates pass.

- [ ] **P28-F4 — Ship a secondary environment-prop and dressing pack** — Add authored non-gameplay refinery dressing that makes spaces feel built rather than procedurally sparse: valves, junction boxes, brackets, vents, hoses, maintenance carts, tool cabinets, canisters, cable bundles, guard structures, signage hardware, broken parts, and other repeated industrial props. Reuse instancing where appropriate without collapsing all props to one generic mesh. **Done when:** Deep Salvage gains meaningful authored object density and silhouette variety at gameplay zoom, prop families have real geometry/material payload in the manifest, combat paths and cue visibility stay unchanged, and standard build/APK gates pass.

- [ ] **P28-F5 — Ship heavyweight decal, trim, and local-effects atlases** — Expand the earlier decal/ambient work into production-resolution atlases and effect textures for labels, hazard markings, wear, leaks, scorch/heat damage, sparks, vapor, debris, soft masks, and other local breakup needed by the flagship presentation. Package all assets locally with mipmaps/compression appropriate to Babylon. **Done when:** the refinery no longer relies on tiny procedural/simple-color substitutes for these layers, atlas/effect payload is visible in the asset manifest and APK, repeated placement avoids obvious tiling, telegraphs remain dominant, and standard build/APK gates pass.

- [ ] **P28-F6 — Harden loading, caching, and APK packaging for the heavy asset set** — Verify that the enlarged production art set is packaged inside the Android app, resolves without network access, uses the intended KTX2/Meshopt paths, streams/loads without duplicate decode work, respects teardown/cache ownership, and does not regress save/gameplay state. **Done when:** cold and warm deterministic routes load every heavy asset family locally, asset/cache telemetry shows stable ownership with no missing/fallback substitutions, Android lifecycle/re-entry remains clean, exact compressed/uncompressed art bytes and total APK size are recorded, and standard build/APK gates pass.

- [ ] **P28-F7 — Pass the P28 heavy-asset acceptance gate before broad rollout** — Perform a final deterministic refinery acceptance pass proving the APK now contains a materially larger real-art payload than the pre-heavy baseline and that the additional bytes correspond to used premium textures, meshes, decals, and effects. Do not require or reward an arbitrary APK size, and do not count padding, duplicate data, dead assets, or intentionally degraded compression as progress. **Done when:** before/after asset manifests and APK reports show meaningful real-art growth by family; Flagship captures visibly justify that payload at gameplay zoom; no mapped hero/refinery production LOD0 remains a box-derived placeholder; all technically available browser/Android/APK gates pass; and only then may campaign-location rollout proceed.

#### G. Campaign-location rollout of the shared visual stack

Each rollout below reuses the P28 lighting/material/grounding/detail systems and existing location modules; it is a location-integration/tuning batch only, not a new hero-asset or gameplay-design batch.

- [ ] **P28-G1 — Refresh Orbital Station visuals** — Adopt the shared P28 visual stack in the existing Babylon Orbital Station presentation and tune its location profile. **Done when:** its deterministic route has premium authored surface depth, grounded characters/props, controlled emissives/atmosphere, preserved cue readability, Flagship Android captures, and standard build/APK gates pass.
- [ ] **P28-G2 — Refresh Damaged Vessel visuals** — Adopt the shared P28 stack in Damaged Vessel and tune damaged-hull surface/lighting parameters while preserving breach/salvage gameplay cues. **Done when:** the deterministic route is materially richer and spatially deeper without cue loss or collision changes, Flagship Android captures pass review, and standard build/APK gates pass.

- [ ] **P28-G3 — Refresh Spin Habitat visuals** — Adopt the shared P28 stack in Spin Habitat and tune ring/spoke surfaces and lighting to reinforce rotational architecture without changing mechanics. **Done when:** the route reads as a distinct premium location at gameplay zoom on the flagship target and standard build/APK gates pass.

- [ ] **P28-G4 — Refresh Jovian Harvester visuals** — Adopt the shared P28 stack in Jovian Harvester and tune its industrial/atmospheric profile. **Done when:** the route gains premium authored depth and identity while storm/hazard tells remain dominant, and standard build/APK gates pass.

- [ ] **P28-G5 — Refresh Ice Mine visuals** — Adopt the shared P28 stack in Ice Mine and tune ice/metal roughness, occlusion, refraction/reflection, and cold-light parameters while preserving fracture/hazard readability. **Done when:** ice and machinery no longer read as flat-color geometry on the flagship target and standard build/APK gates pass.

- [ ] **P28-G6 — Refresh Lattice Annex visuals** — Adopt the shared P28 stack in Lattice Annex and tune its reference-pylon/survey visual profile. **Done when:** the route is visually distinct and grounded on the flagship target with unchanged gameplay cues, and standard build/APK gates pass.

- [ ] **P28-G7 — Refresh Momentum Exchange visuals** — Adopt the shared P28 stack in Momentum Exchange and tune its flywheel/transfer machinery visual profile. **Done when:** the route has premium mechanical layering without masking motion/hazard cues, and standard build/APK gates pass.

- [ ] **P28-G8 — Refresh Cryo Reserve visuals** — Adopt the shared P28 stack in Cryo Reserve and tune its thermal/cryogenic material-light-atmosphere profile. **Done when:** cryogenic identity is visible through presentation rather than HUD alone, boiloff/thermal cues stay readable, and standard build/APK gates pass.

- [ ] **P28-G9 — Refresh Parallax Array visuals** — Adopt the shared P28 stack in Parallax Array and tune its metrology/reference hardware profile. **Done when:** the route gains premium authored material/depth treatment while reference/gameplay cues remain distinct, and standard build/APK gates pass.

#### H. Capstone visual refreshes

- [ ] **P28-H1 — Refresh Perseid capstone visuals** — Adopt the shared P28 visual stack in the Perseid capstone without changing stage mechanics. **Done when:** the capstone has premium material/light/grounding treatment on the flagship target, boss/hazard cues remain dominant, and standard build/APK gates pass.

- [ ] **P28-H2 — Refresh K-91 capstone visuals** — Adopt the shared P28 visual stack in K-91 without changing stage mechanics. **Done when:** the capstone has premium material/light/grounding treatment on the flagship target, boss/hazard cues remain dominant, and standard build/APK gates pass.

- [ ] **P28-H3 — Refresh Orpheline capstone visuals** — Adopt the shared P28 visual stack in Orpheline without changing stage mechanics. **Done when:** the capstone has premium material/light/grounding treatment on the flagship target, boss/hazard cues remain dominant, and standard build/APK gates pass.

- [ ] **P28-H4 — Refresh Hecate capstone visuals** — Adopt the shared P28 visual stack in Hecate without changing stage mechanics. **Done when:** the capstone has premium material/light/grounding treatment on the flagship target, boss/hazard cues remain dominant, and standard build/APK gates pass.

Physical-device P28 acceptance and sustained Flagship validation are tracked in [external-qa.md](./external-qa.md) so they can block release acceptance without deadlocking the executable engineering queue.