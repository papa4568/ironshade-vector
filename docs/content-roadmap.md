# Ironshade Vector — Active Production Roadmap

## New-chat handoff — resume here first

- The P27 Babylon.js renderer migration and Three.js retirement are complete. Babylon.js remains the sole production combat renderer; the TypeScript simulation, React UI, save/runtime contracts, and Capacitor Android delivery remain outside renderer ownership.
- P28 is a **visual-quality overhaul inside the existing Babylon renderer**, not another engine migration. Target Babylon WebGL2 first so the same work ships on Android; optional backend differences must not become a visual requirement.
- The current renderer already has useful foundations to reuse: authored GLB/KTX2/Meshopt loading, adaptive quality tiers, PBR materials, ACES tone mapping, selective bloom/fog, location presentation modules, and deterministic browser/Android QA.
- The current visual ceiling is largely content/presentation quality rather than missing engine infrastructure: the refinery still uses a tiny procedural cubemap for IBL, generic combat-world objects can fall back to simple boxes, the post stack uses proxy contact-depth cards instead of real screen-space occlusion, and hero/operator/enemy families currently ship LOD1/LOD2 without hero LOD0 assets.
- The goal is premium hard-sci-fi depth and material richness while preserving readable tells and a safe mobile quality floor. Secondary visual richness may scale down before gameplay-critical cues, exactly as required by `docs/product-constraints.md`.
- The **first unchecked item below is the next executable task**.

Only active/future executable work lives here. Completed and verified work belongs in [content-roadmap-archive.md](./content-roadmap-archive.md). Stable product rules live in [product-constraints.md](./product-constraints.md).

## Execution contract

- Execute top to bottom. The **first unchecked top-level item is next** unless the user explicitly changes priority.
- One checkbox should fit one realistic **implement → test → build → APK verification** cycle.
- Split an item before coding if it spans independent systems or verification cycles; combine tiny changes only when they touch the same system and can be verified together.
- Keep gameplay simulation authoritative. Babylon presentation may consume state but must not change combat timing, collision, mission logic, or save semantics.
- Preserve the existing readability contract: telegraphs, hazards, objectives, status/protocol cues, target feedback, and touch/controller behavior must remain readable at Performance tier.
- Each visual task must add or update deterministic browser captures for the affected scene and quality tier, pass targeted regressions, complete the production build, and pass the repository's required Android/APK gate before it can be archived.
- After verified completion, move completion detail/evidence to the archive and remove the item from this file.

## Active queue

### P28 — Babylon premium visual-quality overhaul

#### A. Asteroid Refinery lighting, grounding, and image quality

- [ ] **P28-A1 — Replace the refinery placeholder IBL with an authored prefiltered environment** — Replace the 8×8 procedural `RawCubeTexture` lighting source with a committed Babylon-compatible prefiltered environment texture, keeping the procedural cube only as a deterministic load-failure fallback. Calibrate environment intensity against the existing furnace-amber/cyan lighting profile. **Done when:** refinery metals receive visibly structured reflections on High/Balanced, the environment loads from local packaged assets without network access, Performance still has a bounded fallback path, before/after captures show materially stronger shape definition without washing out gameplay cues, and the standard build/APK gates pass.

- [ ] **P28-A2 — Guarantee dynamic actor grounding at every quality tier** — Keep the current bounded key-light shadow map for High/Balanced, but add a cheap Babylon projected/blob contact-shadow path for the player and active nearby enemies when Performance disables dynamic shadows. **Done when:** the player and nearby enemies never appear visually detached from the floor on any tier, Performance adds no full-scene shadow map, actor shadows cannot cover telegraphs/objective glyphs, and targeted quality/readability plus standard build/APK gates pass.

- [ ] **P28-A3 — Add Babylon SSAO2 to the refinery High/Balanced tiers** — Add a bounded `SSAO2RenderingPipeline` for world geometry on High/Balanced while retaining the existing cheap contact-depth fallback on Performance. **Done when:** wall/floor/prop intersections and large machinery gain real screen-space depth on High/Balanced, Performance remains on the cheap fallback, gameplay cue meshes are excluded or remain visually dominant, adaptive degrade/recover is deterministic, and frame/regression plus standard build/APK gates pass.

- [ ] **P28-A4 — Stabilize and soften refinery key-light shadows** — Tune Babylon shadow filtering, bias/normal-bias, caster prioritization, and camera-relative bounds for the existing key light without increasing the established caster/map budgets. **Done when:** High/Balanced captures show softer contact definition with no obvious acne, peter-panning, or large-map swimming; caster counts remain bounded; Performance behavior is unchanged; and standard build/APK gates pass.

- [ ] **P28-A5 — Re-grade refinery exposure, contrast, and dark-value separation** — Recalibrate the existing ACES/image-processing profile after the new IBL/AO/shadow stack so dark materials retain visible form instead of collapsing into near-black while emissives and HUD-independent gameplay cues do not clip. **Done when:** deterministic High/Balanced/Performance captures retain readable floor/wall/character separation in dark rooms, emissive highlights remain controlled, the same profile survives low-visibility gameplay, and standard build/APK gates pass.

#### B. Shared PBR materials and refinery surface detail

- [ ] **P28-B1 — Build a reusable mobile PBR surface library** — Add a small shared set of authored hard-sci-fi surface materials (painted metal, bare metal, deck plate, polymer/rubber, emissive fixture) using glTF/Babylon metallic-roughness conventions with normal + packed ORM detail and local KTX2 compression. **Done when:** materials share texture atlases/instances instead of proliferating unique materials, texture limits match the graphics asset contract, LOD/mip behavior stays readable on phone zoom, content/codec tests cover the new assets, and standard build/APK gates pass.

- [ ] **P28-B2 — Apply P28 materials to refinery floors and bulkheads** — Replace flat-color refinery floor/bulkhead/wall surface treatment with the shared PBR materials while keeping collision and mission geometry unchanged. **Done when:** the deterministic Deep Salvage route shows visible normal/roughness/metalness response across floor and wall surfaces on High/Balanced, Performance keeps readable mip-level detail, no gameplay bounds change, and standard build/APK gates pass.

- [ ] **P28-B3 — Apply P28 materials to refinery cover and crates** — Move cover and crate visuals off generic flat material treatment while preserving their simulation dimensions and readability. **Done when:** cover/crates have intentional painted/bare-metal/polymer material separation at gameplay zoom, material reuse stays bounded, and standard build/APK gates pass.

- [ ] **P28-B4 — Apply P28 materials to refinery machinery** — Move processors, terminals, pipe racks, conduits, cable trays, and gantries onto the shared PBR surface language where their authored assets permit it. **Done when:** representative machinery has distinct roughness/metalness/normal response without one-off material proliferation, emissive intent remains compatible with selective bloom, and standard build/APK gates pass.

- [ ] **P28-B5 — Add an instanced refinery decal/trim atlas** — Add a mobile-bounded detail layer for panel seams, hazard stripes, service labels, grime, heat staining, and repair marks using an atlas plus instanced/merged decal cards or equivalent Babylon-friendly batching. **Done when:** the refinery gains visible medium-scale breakup without one material/draw call per decal, decals do not z-fight or obscure combat telegraphs, adaptive detail can shed secondary decals before cues, and standard build/APK gates pass.

- [ ] **P28-B6 — Art-direct Deep Salvage decal placement** — Place the shared detail atlas through the Deep Salvage/refinery showcase route to break up large blank planes and reinforce navigation/focal machinery while preserving the existing route layout. **Done when:** major floor/wall expanses no longer read as untextured slabs, focal/interactable areas gain intentional visual hierarchy, repeated marks are not obviously tiled at gameplay zoom, and standard build/APK gates pass.

#### C. Refinery authored geometry and silhouette upgrade

- [ ] **P28-C1 — Add LOD0 refinery floor modules** — Author and register hero LOD0 variants for the refinery floor panel and service grate families; retain LOD1/LOD2 for adaptive fallback. **Done when:** Flagship/High selects the new floor LOD0 assets, Balanced/Performance select cheaper valid LODs, panel/bevel/grate depth is visibly improved, asset bounds/compression tests pass, and standard build/APK gates pass.

- [ ] **P28-C2 — Add LOD0 refinery wall modules** — Author and register hero LOD0 variants for the refinery bulkhead and wall service panel families. **Done when:** High selects the new wall LOD0 assets, lower tiers fall back correctly, wall silhouettes/insets are visibly richer without changing gameplay bounds, and standard build/APK gates pass.

- [ ] **P28-C3 — Add LOD0 refinery pipe and cable modules** — Author and register LOD0 variants for pipe rack and cable tray families with stronger mechanical layering while retaining instancing-friendly pivots. **Done when:** High uses the new assets, lower tiers fall back correctly, repeated placement remains stable/instancing-friendly, and standard build/APK gates pass.

- [ ] **P28-C4 — Add LOD0 refinery conduit and gantry modules** — Author and register LOD0 variants for service conduit and smelter gantry families. **Done when:** High uses the new assets, lower tiers fall back correctly, silhouettes and structural depth improve without changing route clearance, and standard build/APK gates pass.

- [ ] **P28-C5 — Add LOD0 refinery processor** — Author and register a processor LOD0 prioritizing bevels, inset panels, material separation, and readable emissive fixtures. **Done when:** High selects the processor LOD0, lower tiers retain valid fallbacks, authored emissives participate in the selective glow policy, and standard build/APK gates pass.

- [ ] **P28-C6 — Add LOD0 refinery terminal** — Author and register a terminal LOD0 with readable screen/fixture depth and material separation while preserving its interaction origin. **Done when:** High selects the terminal LOD0, lower tiers retain valid fallbacks, interaction/cue alignment is unchanged, and standard build/APK gates pass.

- [ ] **P28-C7 — Add LOD0 refinery crate** — Author and register a crate LOD0 with stronger bevels, seams, handles/structural breakup, and shared PBR materials. **Done when:** High selects the crate LOD0, lower tiers retain valid fallbacks, crate collision/gameplay dimensions are unchanged, and standard build/APK gates pass.

- [ ] **P28-C8 — Replace refinery generic world boxes with authored family mappings** — In `BabylonRefineryWorldPresentation`, map eligible cover/industrial/interactable `CombatObject` visuals to existing/new refinery authored families and keep `MeshBuilder.CreateBox` only as the explicit fallback for unmapped/load-failed content. **Done when:** the Deep Salvage route no longer relies on generic boxes for mapped refinery objects, object dimensions/interaction centers remain simulation-owned, failure fallback is deterministic, and standard build/APK gates pass.

- [ ] **P28-C9 — Re-budget refinery instancing after the geometry upgrade** — Consolidate repeated static refinery modules through Babylon instances/thin instances or existing asset-runtime reuse so the new LOD0 art does not erase current frame/cache headroom. **Done when:** deterministic High/Balanced/Performance captures report bounded draw calls, triangles, materials, textures, and cache residency; no visible module disappears during tier changes; and render-performance plus standard build/APK gates pass.

#### D. Hero operators and enemy presentation

- [ ] **P28-D1 — Ship Vanguard operator LOD0** — Add a hero-quality Vanguard LOD0 model/material set using the proven operator rig/socket contract while preserving current animation and gameplay bounds. **Done when:** Flagship/High selects Vanguard LOD0, Balanced/Performance fall back to LOD1/LOD2, all required animation/socket states remain valid, the model is clearly more detailed at gameplay zoom, and standard build/APK gates pass.

- [ ] **P28-D2 — Ship Vector operator LOD0** — Add the Vector hero LOD0 on the same validated rig/socket/material contract with class-specific silhouette detail. **Done when:** quality-tier selection, animation/socket compatibility, class readability, content budgets, and standard build/APK gates pass.

- [ ] **P28-D3 — Ship Systems operator LOD0** — Add the Systems hero LOD0 on the same validated rig/socket/material contract with class-specific silhouette detail. **Done when:** quality-tier selection, animation/socket compatibility, class readability, content budgets, and standard build/APK gates pass.

- [ ] **P28-D4 — Ship assault enemy LOD0** — Add a hero-near-camera LOD0 for the common assault enemy family without changing hitboxes, targeting, or lifecycle cues. **Done when:** High can select LOD0 for near assault enemies, lower tiers remain on LOD1/LOD2, telegraphs/status/lifecycle overlays still align, and standard build/APK gates pass.

- [ ] **P28-D5 — Ship suppressor enemy LOD0** — Add a hero-near-camera LOD0 for the suppressor family with stronger weapon/armor silhouette separation. **Done when:** tier selection, rig/overlay alignment, combat readability, content budgets, and standard build/APK gates pass.

- [ ] **P28-D6 — Ship technician enemy LOD0** — Add a hero-near-camera LOD0 for the technician family with readable tool/hardware silhouette detail. **Done when:** tier selection, rig/overlay alignment, combat readability, content budgets, and standard build/APK gates pass.

- [ ] **P28-D7 — Ship elite enemy LOD0** — Add a hero LOD0 for the elite family that reads as higher threat through silhouette/material detail before HUD labels. **Done when:** elite identity is distinguishable at gameplay zoom without hue-only dependence, tier selection and lifecycle/telegraph alignment remain correct, and standard build/APK gates pass.

- [ ] **P28-D8 — Ship refinery boss LOD0** — Add a boss-quality LOD0 with stronger phase-readable hard-surface detail and emissive anchors while keeping boss mechanics and cue timing unchanged. **Done when:** High uses the boss LOD0, phase cues align with the authored model, lower tiers preserve the existing readable fallback, content budgets pass, and standard build/APK gates pass.

#### E. Refinery ambience and local visual richness

- [ ] **P28-E1 — Add a shared adaptive ambient-particle budget** — Add a Babylon ambient-effects layer with pooled/bounded dust, sparks, vapor/steam, and drifting debris primitives whose density follows `vfxDensity`/secondary-effect budgets. **Done when:** the system has explicit High/Balanced/Performance caps, sheds ambience before gameplay VFX, releases resources on renderer/location teardown, and targeted resource/performance plus standard build/APK gates pass.

- [ ] **P28-E2 — Art-direct refinery ambient particles** — Place the shared ambience around refinery machinery, vents, damaged service areas, and open industrial spaces without adding gameplay state. **Done when:** Deep Salvage gains visible depth/motion on High/Balanced, Performance keeps only the cheapest ambient subset, particles never mask telegraphs/targets, and standard build/APK gates pass.

- [ ] **P28-E3 — Upgrade refinery practical/emissive fixtures** — Give furnace ports, terminals, warning fixtures, and selected machinery authored emissive surfaces that visually correspond to existing practical lights and selective bloom sources. **Done when:** bright fixtures appear to emit the light already present in the scene, bloom remains selective/bounded, dark-area navigation improves without extra HUD, and standard build/APK gates pass.

- [ ] **P28-E4 — Add High-tier local reflection probes for refinery hero machinery** — Add a tightly bounded Babylon reflection-probe path only for a small set of focal metal machinery after material/geometry upgrades, with lower tiers using the shared environment reflection. **Done when:** hero metal gains localized reflection variation on High, probe count/update policy is fixed and measurable, Balanced/Performance incur no probe cost, and standard build/APK gates pass.

#### F. Campaign-location rollout of the shared visual stack

Each rollout below reuses the P28 lighting/material/grounding/detail systems and existing location modules; it is a location-integration/tuning batch only, not a new hero-asset or gameplay-design batch.

- [ ] **P28-F1 — Refresh Orbital Station visuals** — Adopt the shared P28 visual stack in the existing Babylon Orbital Station presentation and tune its location profile. **Done when:** its deterministic route has authored surface depth, grounded characters/props, controlled emissives/atmosphere, preserved cue readability, and standard build/APK gates pass.

- [ ] **P28-F2 — Refresh Damaged Vessel visuals** — Adopt the shared P28 stack in Damaged Vessel and tune damaged-hull surface/lighting parameters while preserving breach/salvage gameplay cues. **Done when:** the deterministic route is materially richer and spatially deeper without cue loss or collision changes, and standard build/APK gates pass.

- [ ] **P28-F3 — Refresh Spin Habitat visuals** — Adopt the shared P28 stack in Spin Habitat and tune ring/spoke surfaces and lighting to reinforce rotational architecture without changing mechanics. **Done when:** the route reads as a distinct high-quality location at gameplay zoom across tiers and standard build/APK gates pass.

- [ ] **P28-F4 — Refresh Jovian Harvester visuals** — Adopt the shared P28 stack in Jovian Harvester and tune its industrial/atmospheric profile. **Done when:** the route gains authored depth and identity across tiers while storm/hazard tells remain dominant, and standard build/APK gates pass.

- [ ] **P28-F5 — Refresh Ice Mine visuals** — Adopt the shared P28 stack in Ice Mine and tune ice/metal roughness, occlusion, and cold-light parameters while preserving fracture/hazard readability. **Done when:** ice and machinery no longer read as flat-color geometry, tier degradation is safe, and standard build/APK gates pass.

- [ ] **P28-F6 — Refresh Lattice Annex visuals** — Adopt the shared P28 stack in Lattice Annex and tune its reference-pylon/survey visual profile. **Done when:** the route is visually distinct and grounded across tiers with unchanged gameplay cues, and standard build/APK gates pass.

- [ ] **P28-F7 — Refresh Momentum Exchange visuals** — Adopt the shared P28 stack in Momentum Exchange and tune its flywheel/transfer machinery visual profile. **Done when:** the route has premium mechanical layering across tiers without masking motion/hazard cues, and standard build/APK gates pass.

- [ ] **P28-F8 — Refresh Cryo Reserve visuals** — Adopt the shared P28 stack in Cryo Reserve and tune its thermal/cryogenic material-light-atmosphere profile. **Done when:** cryogenic identity is visible through presentation rather than HUD alone, boiloff/thermal cues stay readable, and standard build/APK gates pass.

- [ ] **P28-F9 — Refresh Parallax Array visuals** — Adopt the shared P28 stack in Parallax Array and tune its metrology/reference hardware profile. **Done when:** the route gains authored material/depth treatment while reference/gameplay cues remain distinct across tiers, and standard build/APK gates pass.

#### G. Capstone visual refreshes

- [ ] **P28-G1 — Refresh Perseid capstone visuals** — Adopt the shared P28 visual stack in the Perseid capstone without changing stage mechanics. **Done when:** the capstone has premium material/light/grounding treatment, boss/hazard cues remain dominant at Performance tier, and standard build/APK gates pass.

- [ ] **P28-G2 — Refresh K-91 capstone visuals** — Adopt the shared P28 visual stack in K-91 without changing stage mechanics. **Done when:** the capstone has premium material/light/grounding treatment, boss/hazard cues remain dominant at Performance tier, and standard build/APK gates pass.

- [ ] **P28-G3 — Refresh Orpheline capstone visuals** — Adopt the shared P28 visual stack in Orpheline without changing stage mechanics. **Done when:** the capstone has premium material/light/grounding treatment, boss/hazard cues remain dominant at Performance tier, and standard build/APK gates pass.

- [ ] **P28-G4 — Refresh Hecate capstone visuals** — Adopt the shared P28 visual stack in Hecate without changing stage mechanics. **Done when:** the capstone has premium material/light/grounding treatment, boss/hazard cues remain dominant at Performance tier, and standard build/APK gates pass.

#### H. Cross-game visual acceptance

- [ ] **P28-H1 — Verify representative High/Balanced/Performance visual captures on Android** — Capture the same deterministic representative combat moments for refinery plus at least one campaign and one capstone route on API-35/36 hardware/emulators at all three quality tiers, recording frame/resource telemetry alongside screenshots. **Done when:** High is visibly richer than Balanced, Performance preserves grounding/material identity/gameplay cues rather than reverting to flat placeholders, no tier has broken/missing authored assets, and the standard build/APK gates pass.

- [ ] **P28-H2 — Close the P28 sustained performance and memory budget** — Run the repository's sustained combat/lifecycle soak with the finished P28 art stack and tune only secondary visual budgets/residency where needed. **Done when:** frame pacing, renderer recreation, cache residency, retained heap/PSS, thermal-safe adaptive degradation, touch/controller behavior, and APK delivery remain within the repository's accepted gates without removing the P28 visual-quality floor.