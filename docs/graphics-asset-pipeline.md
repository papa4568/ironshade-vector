# Graphics asset pipeline

This document defines the shipped runtime contract for Ironshade Vector's premium stylized hard-sci-fi 3D assets after the P27 Babylon.js migration.

## Runtime format

- Runtime models: binary glTF (`.glb`).
- World scale: 1 authored unit = 1 meter before the combat renderer applies its world scale.
- Up axis: `+Y`.
- Character/weapon forward axis: `+X`, matching the combat visual convention.
- Pivots: characters at ground contact between the feet; weapons at their gameplay attachment origin; modular environment pieces on stable snapping corners/centers.
- Do not bake gameplay collision or mission logic into authored meshes.

## Naming

Use lowercase kebab-case and stable semantic names. Runtime filenames include their LOD suffix and the declared LOD must match the filename:

`operator-field-suit-lod0.glb`

`enemy-technician-lod1.glb`

`weapon-rail-lod0.glb`

`refinery-pipe-straight-a-lod1.glb`

## PBR material contract

Use metallic/roughness PBR materials. Prefer these channels:

- Base color: sRGB.
- Normal: linear.
- Metallic/roughness: linear; packed according to glTF conventions.
- Ambient occlusion: linear; reuse packed textures where practical.
- Emissive: sRGB, reserved for gameplay/readability accents and practical lights.

Avoid material proliferation. Repeated environment pieces should share atlases and material instances whenever practical.

## Texture limits and codecs

- Operator/boss hero texture dimension: 2048px maximum by default.
- Standard enemies: 1024px maximum by default.
- Weapons: 1024px maximum by default.
- Environment modules: 1024px maximum by default; prefer atlases.
- UI-independent authored art must remain readable with lower mip levels on small screens.

KTX2/Basis Universal is the mobile texture target. `scripts/prepare-graphics-codecs.mjs` packages the Babylon decoder stack locally under `/assets/codecs/babylon/`: the Babylon KTX2 decoder module, MSC/UASTC/ZSTD WASM payloads, and Meshopt decoder. Decoder URLs are configured before the deferred Babylon glTF loader is registered, so authored assets do not require a decoder CDN.

The retired Three.js Basis directory `/assets/codecs/basis/` is deliberately removed during codec preparation and is rejected by the production runtime-asset regression.

## Geometry and LOD

- Preserve strong silhouette before adding micro-detail.
- LOD0 is the close/hero version, not an excuse for desktop-scale geometry.
- LOD1 should target roughly 55–70% of LOD0 rendered triangles.
- LOD2 should target roughly 25–40% of LOD0 rendered triangles.
- Repeated static props should be compatible with Babylon native instancing where feasible.
- Skinning influence counts and bone counts should stay minimal for mobile.

Meshopt is the geometry-compression target. Babylon registers its glTF loader only when authored content is first requested and points `MeshoptCompression` at the packaged local `meshopt_decoder.js`, keeping authored-asset decoding out of the synchronous app boot graph.

`graphicsAssetLodForDetailScale()` maps the adaptive renderer detail scale to LOD0/1/2. Missing preferred LODs fall toward a cheaper model first, protecting mobile performance rather than silently escalating to the heaviest asset.

## Loading and ownership contract

`src/game/graphicsAssets.ts` is now the renderer-neutral source of truth for asset classes, specs, budgets, validation, and adaptive LOD selection. It contains no Three.js runtime imports.

`src/game/babylonGraphicsAssets.ts` owns the shipped GLB runtime:

- The Babylon glTF plugin is deferred behind first authored-asset use.
- Meshopt/KTX2 decoder URLs are local.
- Source `AssetContainer`s are cached per Babylon `Scene`; resources never cross scene/engine ownership.
- Validated asset URLs live under `/assets/models/`, end in `.glb`, and include `-lodN` matching their declared LOD.
- Successful source GLBs are cached by URL within the owning Babylon runtime.
- Failed loads are removed from cache so a later request can retry.
- `BabylonGraphicsAssetRuntime.instantiate()` uses `AssetContainer.instantiateModelsToScene(..., cloneMaterials=false)` so clone-owned nodes/rig state have instance ownership while shared source materials/textures stay cache-owned.
- Mounted instances hold a cache lease. Eviction waits for mounted clones to release before disposing shared source resources.
- Instance release disposes clone-owned nodes/skeletons/animation groups; the cached source remains usable until explicit/LRU/runtime disposal.
- Renderer teardown drops runtime cache ownership deterministically and lets Babylon scene disposal release scene-owned resources.

The old Three.js GLTF/KTX2/Meshopt/SkeletonUtils runtime and its renderer-specific cache are retired. Rollback to the former renderer is release/history based, not a live runtime asset path.

## Current compression status

- GLB: supported.
- Mesh compression: Meshopt runtime decoding supported through the packaged Babylon decoder.
- KTX2/Basis textures: local Babylon decoder module/WASM payloads are packaged and verified; no Three.js transcoder payload ships.
- Animation clips: carried through instantiated GLBs and consumed by the Babylon presentation layers where integrated.

## Validation

- `npm run test:graphics` validates the renderer-neutral asset contract, LOD behavior, manifest coverage, and Babylon runtime ownership boundary.
- `npm run test:graphics:babylon` validates local decoder configuration, scene-owned caching/instancing, eviction, teardown, and representative authored GLBs.
- `npm run test:graphics:dist` verifies the production build contains the local Babylon decoder stack, rejects the retired Three Basis directory, and enforces the codec payload budget.
- `npm run test:bundle:architecture` rejects Three dependencies/imports/runtime chunks and guards Babylon's deferred renderer, glTF-loader, and optional WebGPU boundaries.
- Content-specific triangle, texture, bounds, animation, and payload checks run through the authored-content verification suite.
- These checks run as part of `npm run build` and therefore gate Android APK generation.
