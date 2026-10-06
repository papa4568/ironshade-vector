# Graphics asset pipeline

This document defines the shipped runtime contract for authored hard-sci-fi 3D content after the P27 Babylon.js migration and the P28 flagship-phone quality direction.

## Runtime ownership

Babylon.js owns production 3D rendering and authored-asset loading. The gameplay simulation, React UI, save/runtime contracts, and Capacitor Android packaging remain renderer-independent.

- `src/game/graphicsAssets.ts` defines the renderer-neutral asset specification, URL validation, and LOD selection policy.
- `src/game/graphicsAssetManifest.ts` owns stable asset families and LOD URLs.
- `src/game/babylonGraphicsAssets.ts` owns Babylon scene-local caching, preload, instantiation, leases, and disposal.
- `src/game/babylonGltfLoader.ts` defers Babylon's glTF 2.0 plugin until authored content is requested.
- The retired Three.js loader/cache and renderer paths are not production dependencies.

## Runtime format and coordinates

- Runtime models: binary glTF (`.glb`).
- World scale: 1 authored unit = 1 meter before the combat presentation applies its world scale.
- Up axis: `+Y`.
- Character/weapon forward axis: `+X`.
- Pivots: characters at ground contact between the feet; weapons at their gameplay attachment origin; modular environment pieces on stable snapping corners/centers.
- Do not bake gameplay collision or mission logic into authored meshes.

## Naming

Use lowercase kebab-case and stable semantic names. Runtime filenames include their LOD suffix and the declared LOD must match the filename, for example:

- `operator-field-suit-lod0.glb`
- `enemy-technician-lod1.glb`
- `weapon-rail-lod0.glb`
- `refinery-pipe-straight-a-lod1.glb`

## PBR material contract

Use metallic/roughness PBR materials. Prefer these channels:

- Base color: sRGB.
- Normal: linear.
- Metallic/roughness: linear and packed according to glTF conventions.
- Ambient occlusion: linear; reuse packed textures where practical.
- Emissive: sRGB, reserved for authored lights, machinery, equipment, and gameplay/readability accents.

Material sharing, atlases, and instances are preferred when they preserve visual quality. They are batching tools, not reasons to flatten material variation that materially improves the scene.

## Texture and codec contract

There is **no global product-level texture-resolution ceiling** for authored graphics. Choose resolution from visible screen-space need on the flagship-phone target, then compress and profile the result.

- Hero operators, bosses, focal weapons, and hero machinery may use 2K/4K or other justified source/runtime texture sizes when the extra detail is visible at gameplay zoom.
- Environment surfaces may use higher-resolution unique maps, trims, decals, or atlases when needed to avoid flat or blurry presentation.
- Use mipmaps and appropriate texture sampling so high-resolution assets remain stable under camera motion and distance.
- Do not down-res an asset solely to satisfy a legacy mobile rule; change it only when target-device measurements or visible redundancy justify the reduction.

KTX2/Basis Universal remains the preferred mobile runtime texture format. `scripts/prepare-graphics-codecs.mjs` packages Babylon's KTX2 decoder module, MSC/UASTC/ZSTD WASM payloads, and Meshopt decoder under `/assets/codecs/babylon/`. The runtime configures those local URLs before the deferred glTF loader is registered, so authored content does not depend on a decoder CDN.

`scripts/prepare-premium-pbr-reference.mjs` is the deterministic textured-PBR reference path used by `npm run prepare:graphics-assets`. It rebuilds `environments/refinery-wall-service-panel-pbr-reference-lod0.glb` with UV0, tangents, embedded base-color and normal maps, a glTF-packed ORM map shared by metallic/roughness and occlusion, and an emissive map. The tiny committed PNG payloads are deterministic reference inputs rather than a production texture-size recommendation; the glTF texture bindings are format-agnostic so production KTX2 sources can use the same material contract while Babylon continues to decode KTX2 from the locally packaged codec payload.

## Geometry and LOD

- Preserve strong silhouette, believable hard-surface depth, and readable material boundaries before optimizing mesh density.
- LOD0 is the full intended hero/flagship presentation. Do not constrain LOD0 to an arbitrary mobile triangle target.
- LOD1/LOD2 are optional optimization/recovery assets. Their reductions should be driven by perceptual equivalence and measured target-device need, not fixed percentage rules.
- Repeated static props should remain instancing-friendly where practical, but visible quality takes priority over forcing every asset into a shared instancing shape.
- Skinning, bone counts, morph targets, and material slots may be as complex as the visual result requires, then simplified only where profiling shows a meaningful target-device cost.

Meshopt remains the geometry-compression target where it preserves asset fidelity. Babylon's glTF loader uses the packaged local Meshopt decoder, and loader registration remains deferred so authored-asset decoding is not added to the synchronous application boot graph.

`graphicsAssetLodForDetailScale()` remains available for runtime fallback/recovery. Flagship/high quality should prefer the authored LOD0 whenever one exists and the target device is not under real measured pressure.

## Loading, cache, and ownership contract

- Validated asset URLs live under `/assets/models/`, end in `.glb`, and include `-lodN` matching their declared LOD.
- Source `AssetContainer`s are cached by URL inside the owning Babylon `Scene`; resources never cross scene/engine ownership.
- Legacy fixed preload/cache limits are implementation safeguards, not authoring constraints. P28 may raise, remove, or replace them based on measured memory behavior on the target high-performance phones.
- Failed loads are removed from cache so a later request can retry.
- `BabylonGraphicsAssetRuntime.instantiate()` uses `AssetContainer.instantiateModelsToScene(..., cloneMaterials=false)` so cloned nodes, skeletons, and animation groups receive instance ownership while source materials/textures remain cache-owned.
- Mounted instances hold a cache lease. Eviction skips entries with active instances and disposes only idle source containers.
- Releasing an instance disposes clone-owned nodes/skeletons/animation groups; the cached source remains reusable until runtime disposal or measured memory pressure requires eviction.
- Every authored family retains a procedural or presentation fallback so an asset load failure does not remove gameplay readability.

## Current compression status

- GLB: supported and shipped.
- Mesh compression: local Meshopt runtime decoding supported.
- KTX2/Basis textures: Babylon local decoder module/WASM packaging supported.
- Animation clips: carried through instantiated GLBs and consumed by the Babylon presentation/rig paths where authored.

## Validation

- `npm run test:graphics` validates the renderer-neutral asset contract, LOD behavior, Babylon loader/cache ownership, fallbacks, and local decoder configuration.
- `npm run test:graphics:content` loads and instantiates committed GLBs through Babylon, verifies the deterministic premium-PBR reference rebuild plus UV0/tangent/material texture bindings, and validates content/runtime compatibility and authored bounds.
- P28-B0 pins the committed premium-PBR reference at `4,288` deterministic bytes; the content test verifies regeneration stability rather than treating that reference size as an art-quality target.
- `npm run test:graphics:dist` verifies production output contains the Babylon codec payload and does not restore the retired Three Basis codec directory.
- `scripts/verify-no-three-delivery.mjs` rejects unintended Three packages, imports, chunks, or retired codec assets in browser/APK delivery.
- Visual acceptance is judged primarily on the flagship/high-performance phone target. Profiling remains required, but profiling is used to find real bottlenecks rather than to enforce arbitrary pre-selected art limits.

## Migration history

P27 initially kept the existing Three.js renderer as a rollback path while Babylon reached gameplay, visual, lifecycle, performance, and Android parity. After the P27-D7/D8 cutover and verification, the Three production/rollback renderer, its WebGPU comparison renderer, loader/cache implementation, codec bundle, and renderer-only helpers were retired. Historical P21 measurements remain useful evidence in the engine-decision record, but they no longer describe shipped runtime ownership.
