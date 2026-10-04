# Graphics asset pipeline

This document defines the shipped runtime contract for authored hard-sci-fi 3D content after the P27 Babylon.js migration.

## Runtime ownership

Babylon.js owns production 3D rendering and authored-asset loading. The gameplay simulation, React UI, save/runtime contracts, and Capacitor Android packaging remain renderer-independent.

- `src/game/graphicsAssets.ts` defines the renderer-neutral asset specification, budgets, URL validation, and LOD selection policy.
- `src/game/graphicsAssetManifest.ts` owns stable asset families and LOD URLs.
- `src/game/babylonGraphicsAssets.ts` owns Babylon scene-local caching, bounded preload, instantiation, leases, and disposal.
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
- Emissive: sRGB, reserved for gameplay/readability accents and practical lights.

Avoid material proliferation. Repeated environment pieces should share atlases and material instances whenever practical.

## Texture and codec contract

- Operator/boss hero texture dimension: 2048px maximum by default.
- Standard enemies: 1024px maximum by default.
- Weapons: 1024px maximum by default.
- Environment modules: 1024px maximum by default; prefer atlases.
- UI-independent authored art must remain readable with lower mip levels on small screens.

KTX2/Basis Universal is the mobile texture target. `scripts/prepare-graphics-codecs.mjs` packages Babylon's KTX2 decoder module, MSC/UASTC/ZSTD WASM payloads, and Meshopt decoder under `/assets/codecs/babylon/`. The runtime configures those local URLs before the deferred glTF loader is registered, so authored content does not depend on a decoder CDN. The retired Three.js `/assets/codecs/basis/` package is intentionally absent from browser and APK output.

## Geometry and LOD

- Preserve strong silhouette before adding micro-detail.
- LOD0 is the close/hero version, not an excuse for desktop-scale geometry.
- LOD1 should target roughly 55–70% of LOD0 rendered triangles.
- LOD2 should target roughly 25–40% of LOD0 rendered triangles.
- Repeated static props should remain instancing-friendly where feasible.
- Skinning influence counts and bone counts should stay minimal for mobile.

Meshopt is the geometry-compression target. Babylon's glTF loader uses the packaged local Meshopt decoder, and loader registration remains deferred so authored-asset decoding is not added to the synchronous application boot graph.

`graphicsAssetLodForDetailScale()` maps adaptive renderer detail scale to LOD0/1/2. Missing preferred LODs fall toward a cheaper model first, protecting mobile performance rather than silently escalating to the heaviest asset.

## Loading, cache, and ownership contract

- Validated asset URLs live under `/assets/models/`, end in `.glb`, and include `-lodN` matching their declared LOD.
- Source `AssetContainer`s are cached by URL inside the owning Babylon `Scene`; resources never cross scene/engine ownership.
- Preload concurrency and cache entry/byte budgets are bounded by the current runtime scalability/render-quality profile.
- Failed loads are removed from cache so a later request can retry.
- `BabylonGraphicsAssetRuntime.instantiate()` uses `AssetContainer.instantiateModelsToScene(..., cloneMaterials=false)` so cloned nodes, skeletons, and animation groups receive instance ownership while source materials/textures remain cache-owned.
- Mounted instances hold a cache lease. Eviction skips entries with active instances and disposes only idle source containers.
- Releasing an instance disposes clone-owned nodes/skeletons/animation groups; the cached source remains reusable until LRU/runtime disposal.
- Every authored family retains a procedural or presentation fallback so an asset load failure does not remove gameplay readability.

## Current compression status

- GLB: supported and shipped.
- Mesh compression: local Meshopt runtime decoding supported.
- KTX2/Basis textures: Babylon local decoder module/WASM packaging supported.
- Animation clips: carried through instantiated GLBs and consumed by the Babylon presentation/rig paths where authored.

## Validation

- `npm run test:graphics` validates the renderer-neutral asset contract, LOD behavior, Babylon loader/cache ownership, fallbacks, and local decoder configuration.
- `npm run test:graphics:content` loads and instantiates committed GLBs through Babylon to validate content/runtime compatibility and authored bounds.
- `npm run test:graphics:dist` verifies production output contains the Babylon codec payload and does not restore the retired Three Basis codec directory.
- `scripts/verify-no-three-delivery.mjs` rejects unintended Three packages, imports, chunks, or retired codec assets in browser/APK delivery.
- These checks run through the normal production build and Android release gates.

## Migration history

P27 initially kept the existing Three.js renderer as a rollback path while Babylon reached gameplay, visual, lifecycle, performance, and Android parity. After the P27-D7/D8 cutover and verification, the Three production/rollback renderer, its WebGPU comparison renderer, loader/cache implementation, codec bundle, and renderer-only helpers were retired. Historical P21 measurements remain useful evidence in the engine-decision record, but they no longer describe shipped runtime ownership.
