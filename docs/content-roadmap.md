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
- The **first unchecked item below is the next executable task**.

Only active/future executable work lives here. Completed and verified work belongs in [content-roadmap-archive.md](./content-roadmap-archive.md). Stable product rules live in [product-constraints.md](./product-constraints.md).

## Execution contract

- Execute top to bottom. The **first unchecked top-level item is next** unless the user explicitly changes priority.
- One checkbox should fit one realistic **implement → test → build → APK verification** cycle.
- Split an item before coding if it spans independent systems or verification cycles; combine tiny changes only when they touch the same system and can be verified together.
- Keep gameplay simulation authoritative. Babylon presentation may consume state but must not change combat timing, collision, mission logic, or save semantics.
- Preserve combat readability: telegraphs, hazards, objectives, status/protocol cues, target feedback, and touch/controller behavior must remain clear even when effects are visually richer.
- Do not add or preserve a graphics cap merely because it is "mobile safe." A hard limit needs measured evidence from the target high-performance phone class or a concrete engine/Android failure mode.
- Each visual task must add/update deterministic Flagship captures, pass targeted regressions, complete the production build, and pass the repository's required Android/APK gate. GPU-heavy changes should also be exercised on real high-performance Android phone hardware when available; emulator-only success is not visual-performance proof.
- Lower quality tiers may remain as emergency recovery paths, but P28 does not require visual parity with them. They must only remain functional enough to avoid crashes and preserve gameplay-critical cues.
- After verified completion, move completion detail/evidence to the archive and remove the item from this file.

## Active queue

### P28 — Babylon flagship visual-quality overhaul

#### A. Flagship renderer policy, lighting, grounding, and image quality

- [x] **P28-A0 — Remove legacy low-end quality ceilings from the production render policy** — Rework the existing render-quality/runtime-scalability policy so supported high-performance phones start at the richest available Babylon settings instead of being pre-emptively constrained by coarse-device baselines or legacy mobile tier assumptions. Keep downgrade/recovery only for real sustained runtime pressure. **Done when:** the production default on the target phone class uses full pixel ratio/detail/shadows/IBL/reflections/VFX/transparency/anisotropy available to the current renderer, no phone is downgraded solely by a conservative device-class heuristic, telemetry shows why any runtime downgrade occurs, gameplay cues remain full strength, and standard build/APK gates pass.

- [x] **P28-A1 — Replace the refinery placeholder IBL with an authored prefiltered environment** — Replace the 8×8 procedural `RawCubeTexture` lighting source with a committed Babylon-compatible prefiltered environment texture; keep the procedural cube only as a deterministic load-failure fallback. Calibrate environment intensity against the existing furnace-amber/cyan lighting profile. **Done when:** refinery metals receive visibly structured reflections, the environment loads from local packaged assets without network access, before/after Flagship captures show materially stronger shape definition without washing out gameplay cues, and standard build/APK gates pass.

- [ ] **P28-A2 — Upgrade dynamic actor grounding** — Add high-quality Babylon contact/projected shadow treatment for the player and active nearby enemies so characters consistently feel attached to the floor, supplementing the existing key-light shadowing as needed. **Done when:** the player and nearby enemies are visibly grounded throughout the Deep Salvage route, actor shadows integrate with the real scene instead of reading as detached blobs, telegraphs/objective glyphs remain dominant, and standard build/APK gates pass.
- [ ] **P28-A3 — Add Babylon SSAO2 to the production refinery renderer** — Add `SSAO2RenderingPipeline` for refinery world geometry and integrate it with the existing post stack instead of relying on proxy contact-depth cards as the primary depth solution. **Done when:** wall/floor/prop intersections and large machinery gain convincing screen-space depth in Flagship captures, gameplay cue meshes remain visually dominant, pipeline enable/disable/re-entry is deterministic, and frame/regression plus standard build/APK gates pass.

- [ ] **P28-A4 — Upgrade refinery key-light shadow quality** — Improve Babylon shadow resolution/filtering, bias/normal-bias, caster coverage, and camera-relative stability as needed for the flagship visual target instead of preserving the old map/caster ceilings. **Done when:** captures show soft stable contacts with no obvious acne, peter-panning, missing important casters, or large-map swimming; changes are measured on target phone hardware; and standard build/APK gates pass.

- [ ] **P28-A5 — Re-grade exposure, contrast, and dark-value separation** — Recalibrate ACES/image processing after the new IBL/AO/shadow stack so dark materials retain visible form instead of collapsing into near-black while emissives and gameplay cues do not clip. **Done when:** deterministic Flagship captures retain readable floor/wall/character separation in dark and low-visibility rooms, emissive highlights remain controlled, and standard build/APK gates pass.

#### B. Shared premium PBR materials and refinery surface detail

- [ ] **P28-B0 — Add textured PBR support to the deterministic GLB build path** — Extend the current generated-asset pipeline (or replace its source boundary) so premium assets can carry UV0/tangents plus local base-color, normal, packed ORM, and emissive textures through glTF/Babylon instead of being limited to factor-only cube materials. Keep generation/rebuild deterministic and compatible with local KTX2 packaging. **Done when:** a committed reference asset generated through the production preparation path loads in Babylon with verified normal/ORM/emissive texture response, rebuilds do not discard the premium source, content/codec tests cover the path, and standard build/APK gates pass.

- [ ] **P28-B1 — Build a reusable premium PBR surface library** — Add a shared set of authored hard-sci-fi materials (painted metal, bare metal, deck plate, polymer/rubber, emissive fixture) using glTF/Babylon metallic-roughness conventions with normal + packed ORM detail and local KTX2 compression. Select texture resolution from visible need rather than legacy mobile caps. **Done when:** the material set is visibly rich at gameplay zoom, shared where useful, supports mipmapped/KTX2 delivery, content/codec tests cover the new assets, and standard build/APK gates pass.

- [ ] **P28-B2 — Apply P28 materials to refinery floors and bulkheads** — Replace flat-color floor/bulkhead/wall treatment with the shared PBR materials while keeping collision and mission geometry unchanged. **Done when:** the deterministic Deep Salvage route shows visible normal/roughness/metalness response across floor and wall surfaces, no gameplay bounds change, and standard build/APK gates pass.

- [ ] **P28-B3 — Apply P28 materials to refinery cover and crates** — Move cover and crate visuals off generic flat material treatment while preserving simulation dimensions and readability. **Done when:** cover/crates have intentional painted/bare-metal/polymer material separation at gameplay zoom and standard build/APK gates pass.

- [ ] **P28-B4 — Apply P28 materials to refinery machinery** — Move processors, terminals, pipe racks, conduits, cable trays, and gantries onto the shared PBR surface language where their authored assets permit it. **Done when:** representative machinery has distinct roughness/metalness/normal response, emissive intent remains compatible with selective bloom, and standard build/APK gates pass.

- [ ] **P28-B5 — Add a refinery decal/trim atlas** — Add a rich detail layer for panel seams, hazard stripes, service labels, grime, heat staining, and repair marks using an atlas plus instanced/merged decal cards or another Babylon-friendly batching method. **Done when:** the refinery gains convincing medium-scale breakup, decals do not z-fight or obscure combat telegraphs, and standard build/APK gates pass.

- [ ] **P28-B6 — Art-direct Deep Salvage decal placement** — Place the shared detail atlas through the Deep Salvage/refinery showcase route to break up large blank planes and reinforce navigation/focal machinery while preserving the existing route layout. **Done when:** major floor/wall expanses no longer read as untextured slabs, focal/interactable areas gain intentional visual hierarchy, repeated marks are not obviously tiled at gameplay zoom, and standard build/APK gates pass.

#### C. Refinery authored geometry and silhouette upgrade

- [ ] **P28-C0 — Add reusable non-box hard-surface geometry support to asset authoring** — Extend the deterministic asset source/build path with reusable beveled/chamfered solids, cylinders/pipes, wedges/extrusions, inset-panel geometry, and correct normals/UVs/tangents so new refinery LOD0 assets are not assemblies of the existing single cube primitive. **Done when:** a reference refinery GLB built through the production preparation path contains visibly rounded/beveled/non-orthogonal geometry with stable pivots and valid material mapping, content tests verify its bounds/attributes, and standard build/APK gates pass.

- [ ] **P28-C1 — Add LOD0 refinery floor modules** — Author and register full-detail LOD0 variants for the refinery floor panel and service grate families. Keep LOD1/LOD2 only as optional recovery assets. **Done when:** Flagship selects the LOD0 assets, panel/bevel/grate depth is visibly improved, asset bounds/loading/compression tests pass, and standard build/APK gates pass.

- [ ] **P28-C2 — Add LOD0 refinery wall modules** — Author and register full-detail LOD0 variants for the refinery bulkhead and wall service panel families. **Done when:** Flagship selects the new assets, wall silhouettes/insets are visibly richer without changing gameplay bounds, and standard build/APK gates pass.

- [ ] **P28-C3 — Add LOD0 refinery pipe and cable modules** — Author and register full-detail LOD0 variants for pipe rack and cable tray families with stronger mechanical layering while retaining stable pivots for repeated placement. **Done when:** Flagship uses the new assets, repeated placement remains stable, and standard build/APK gates pass.

- [ ] **P28-C4 — Add LOD0 refinery conduit and gantry modules** — Author and register full-detail LOD0 variants for service conduit and smelter gantry families. **Done when:** Flagship uses the new assets, silhouettes and structural depth improve without changing route clearance, and standard build/APK gates pass.

- [ ] **P28-C5 — Add LOD0 refinery processor** — Author and register a processor LOD0 prioritizing bevels, inset panels, material separation, and readable emissive fixtures. **Done when:** Flagship selects the processor LOD0, authored emissives participate in the selective glow policy, interaction/gameplay coordinates remain unchanged, and standard build/APK gates pass.

- [ ] **P28-C6 — Add LOD0 refinery terminal** — Author and register a terminal LOD0 with readable screen/fixture depth and material separation while preserving its interaction origin. **Done when:** Flagship selects the terminal LOD0, interaction/cue alignment is unchanged, and standard build/APK gates pass.

- [ ] **P28-C7 — Add LOD0 refinery crate** — Author and register a crate LOD0 with stronger bevels, seams, handles/structural breakup, and premium PBR materials. **Done when:** Flagship selects the crate LOD0, crate collision/gameplay dimensions are unchanged, and standard build/APK gates pass.
- [ ] **P28-C8 — Replace refinery generic world boxes with authored family mappings** — In `BabylonRefineryWorldPresentation`, map eligible cover/industrial/interactable `CombatObject` visuals to refinery authored families and keep `MeshBuilder.CreateBox` only as the explicit load-failure/unmapped fallback. **Done when:** the Deep Salvage route no longer relies on generic boxes for mapped objects, dimensions/interaction centers remain simulation-owned, failure fallback is deterministic, and standard build/APK gates pass.

- [ ] **P28-C9 — Consolidate repeated refinery geometry without reducing visible quality** — Use Babylon instances/thin instances or existing asset-runtime reuse for repeated static modules where it preserves the full-detail result. **Done when:** repeated LOD0 modules reuse resources correctly, scene re-entry/disposal is stable, no visible module is simplified solely to hit an arbitrary draw/triangle cap, target-phone telemetry is recorded, and standard build/APK gates pass.

#### D. Hero operators and enemy presentation

- [ ] **P28-D0 — Upgrade the character asset source path beyond box-node bodies** — Add a premium character-mesh source path that preserves the existing named operator/enemy rig nodes, animation hooks, sockets, hitbox ownership, and cue attachment contracts while allowing non-box body/armor/tool meshes and textured PBR materials. **Done when:** one representative generated/committed character runs through the production asset preparation path with a clearly non-box silhouette, existing animation/socket/cue tests still align, rebuilds remain deterministic, and standard build/APK gates pass.

- [ ] **P28-D1 — Ship Vanguard operator LOD0** — Add a hero-quality Vanguard LOD0 model/material set using the proven operator rig/socket contract while preserving current animation and gameplay bounds. **Done when:** Flagship selects Vanguard LOD0, all required animation/socket states remain valid, the model is clearly more detailed at gameplay zoom, and standard build/APK gates pass.

- [ ] **P28-D2 — Ship Vector operator LOD0** — Add the Vector hero LOD0 on the same validated rig/socket/material contract with class-specific silhouette detail. **Done when:** Flagship selection, animation/socket compatibility, class readability, and standard build/APK gates pass.

- [ ] **P28-D3 — Ship Systems operator LOD0** — Add the Systems hero LOD0 on the same validated rig/socket/material contract with class-specific silhouette detail. **Done when:** Flagship selection, animation/socket compatibility, class readability, and standard build/APK gates pass.

- [ ] **P28-D4 — Ship assault enemy LOD0** — Add a hero-near-camera LOD0 for the common assault enemy family without changing hitboxes, targeting, or lifecycle cues. **Done when:** Flagship uses the LOD0 where appropriate, telegraphs/status/lifecycle overlays still align, and standard build/APK gates pass.

- [ ] **P28-D5 — Ship suppressor enemy LOD0** — Add a full-detail LOD0 for the suppressor family with stronger weapon/armor silhouette separation. **Done when:** rig/overlay alignment, combat readability, visual improvement, and standard build/APK gates pass.

- [ ] **P28-D6 — Ship technician enemy LOD0** — Add a full-detail LOD0 for the technician family with readable tool/hardware silhouette detail. **Done when:** rig/overlay alignment, combat readability, visual improvement, and standard build/APK gates pass.

- [ ] **P28-D7 — Ship elite enemy LOD0** — Add a hero LOD0 for the elite family that reads as higher threat through silhouette/material detail before HUD labels. **Done when:** elite identity is distinguishable at gameplay zoom without hue-only dependence, lifecycle/telegraph alignment remains correct, and standard build/APK gates pass.

- [ ] **P28-D8 — Ship refinery boss LOD0** — Add a boss-quality LOD0 with stronger phase-readable hard-surface detail and emissive anchors while keeping boss mechanics and cue timing unchanged. **Done when:** Flagship uses the boss LOD0, phase cues align with the authored model, visual quality is materially above the current asset, and standard build/APK gates pass.

#### E. Refinery ambience and local visual richness

- [ ] **P28-E1 — Add a shared flagship ambient-particle system** — Add a Babylon ambient-effects layer with pooled dust, sparks, vapor/steam, and drifting debris primitives. Art-direct density for the flagship target first; optional runtime reduction may react to real measured pressure rather than fixed pre-selected caps. **Done when:** the system supports rich ambience, never suppresses gameplay VFX/cues, releases resources on renderer/location teardown, and targeted resource/performance plus standard build/APK gates pass.

- [ ] **P28-E2 — Art-direct refinery ambient particles** — Place the shared ambience around refinery machinery, vents, damaged service areas, and open industrial spaces without adding gameplay state. **Done when:** Deep Salvage gains visible depth/motion, particles never mask telegraphs/targets, and standard build/APK gates pass.

- [ ] **P28-E3 — Upgrade refinery practical/emissive fixtures** — Give furnace ports, terminals, warning fixtures, and selected machinery authored emissive surfaces that visually correspond to existing practical lights and selective bloom sources. **Done when:** bright fixtures appear to emit the light already present in the scene, bloom remains controlled, dark-area navigation improves without extra HUD, and standard build/APK gates pass.

- [ ] **P28-E4 — Add local reflection probes for refinery hero machinery and spaces** — Add Babylon reflection probes wherever they materially improve focal metal machinery/space reflections instead of enforcing a fixed probe-count ceiling. **Done when:** hero metal gains convincing localized reflection variation, probe placement/update behavior is deterministic and measured on target phone hardware, and standard build/APK gates pass.

#### F. Campaign-location rollout of the shared visual stack

Each rollout below reuses the P28 lighting/material/grounding/detail systems and existing location modules; it is a location-integration/tuning batch only, not a new hero-asset or gameplay-design batch.

- [ ] **P28-F1 — Refresh Orbital Station visuals** — Adopt the shared P28 visual stack in the existing Babylon Orbital Station presentation and tune its location profile. **Done when:** its deterministic route has premium authored surface depth, grounded characters/props, controlled emissives/atmosphere, preserved cue readability, Flagship Android captures, and standard build/APK gates pass.
- [ ] **P28-F2 — Refresh Damaged Vessel visuals** — Adopt the shared P28 stack in Damaged Vessel and tune damaged-hull surface/lighting parameters while preserving breach/salvage gameplay cues. **Done when:** the deterministic route is materially richer and spatially deeper without cue loss or collision changes, Flagship Android captures pass review, and standard build/APK gates pass.

- [ ] **P28-F3 — Refresh Spin Habitat visuals** — Adopt the shared P28 stack in Spin Habitat and tune ring/spoke surfaces and lighting to reinforce rotational architecture without changing mechanics. **Done when:** the route reads as a distinct premium location at gameplay zoom on the flagship target and standard build/APK gates pass.

- [ ] **P28-F4 — Refresh Jovian Harvester visuals** — Adopt the shared P28 stack in Jovian Harvester and tune its industrial/atmospheric profile. **Done when:** the route gains premium authored depth and identity while storm/hazard tells remain dominant, and standard build/APK gates pass.

- [ ] **P28-F5 — Refresh Ice Mine visuals** — Adopt the shared P28 stack in Ice Mine and tune ice/metal roughness, occlusion, refraction/reflection, and cold-light parameters while preserving fracture/hazard readability. **Done when:** ice and machinery no longer read as flat-color geometry on the flagship target and standard build/APK gates pass.

- [ ] **P28-F6 — Refresh Lattice Annex visuals** — Adopt the shared P28 stack in Lattice Annex and tune its reference-pylon/survey visual profile. **Done when:** the route is visually distinct and grounded on the flagship target with unchanged gameplay cues, and standard build/APK gates pass.

- [ ] **P28-F7 — Refresh Momentum Exchange visuals** — Adopt the shared P28 stack in Momentum Exchange and tune its flywheel/transfer machinery visual profile. **Done when:** the route has premium mechanical layering without masking motion/hazard cues, and standard build/APK gates pass.

- [ ] **P28-F8 — Refresh Cryo Reserve visuals** — Adopt the shared P28 stack in Cryo Reserve and tune its thermal/cryogenic material-light-atmosphere profile. **Done when:** cryogenic identity is visible through presentation rather than HUD alone, boiloff/thermal cues stay readable, and standard build/APK gates pass.

- [ ] **P28-F9 — Refresh Parallax Array visuals** — Adopt the shared P28 stack in Parallax Array and tune its metrology/reference hardware profile. **Done when:** the route gains premium authored material/depth treatment while reference/gameplay cues remain distinct, and standard build/APK gates pass.

#### G. Capstone visual refreshes

- [ ] **P28-G1 — Refresh Perseid capstone visuals** — Adopt the shared P28 visual stack in the Perseid capstone without changing stage mechanics. **Done when:** the capstone has premium material/light/grounding treatment on the flagship target, boss/hazard cues remain dominant, and standard build/APK gates pass.

- [ ] **P28-G2 — Refresh K-91 capstone visuals** — Adopt the shared P28 visual stack in K-91 without changing stage mechanics. **Done when:** the capstone has premium material/light/grounding treatment on the flagship target, boss/hazard cues remain dominant, and standard build/APK gates pass.

- [ ] **P28-G3 — Refresh Orpheline capstone visuals** — Adopt the shared P28 visual stack in Orpheline without changing stage mechanics. **Done when:** the capstone has premium material/light/grounding treatment on the flagship target, boss/hazard cues remain dominant, and standard build/APK gates pass.

- [ ] **P28-G4 — Refresh Hecate capstone visuals** — Adopt the shared P28 visual stack in Hecate without changing stage mechanics. **Done when:** the capstone has premium material/light/grounding treatment on the flagship target, boss/hazard cues remain dominant, and standard build/APK gates pass.

#### H. Flagship-phone visual acceptance

- [ ] **P28-H1 — Verify representative Flagship visuals on real high-performance Android phones** — Capture the same deterministic representative combat moments for the refinery plus at least one campaign and one capstone route on real high-performance Android phone hardware, recording screenshots and frame/resource telemetry. **Done when:** the shipped Flagship path consistently presents the full P28 lighting/material/geometry/effects stack, no authored assets are missing/broken, touch/controller combat remains readable and responsive, and standard build/APK gates pass.

- [ ] **P28-H2 — Prove sustained Flagship stability without restoring arbitrary art budgets** — Run sustained combat/lifecycle/renderer-reentry testing with the finished full-quality P28 stack on the target high-performance phone class. Fix observed stalls, leaks, resource churn, or thermal collapse with targeted engineering rather than pre-emptive global visual caps. **Done when:** sustained play is stable, renderer recreation and cache ownership remain correct, touch/controller behavior remains reliable, and any quality reduction is backed by a measured target-device failure that could not be solved more locally.