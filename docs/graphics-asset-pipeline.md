# Graphics asset pipeline

This document defines the runtime contract for the premium stylized hard-sci-fi 3D overhaul tracked in #10.

## Runtime format

- Runtime models: binary glTF (`.glb`).
- World scale: 1 authored unit = 1 meter before the existing combat renderer applies its world scale.
- Up axis: `+Y`.
- Character/weapon forward axis: `+X`, matching the existing combat visual convention.
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

## Texture limits

- Operator/boss hero texture dimension: 2048px maximum by default.
- Standard enemies: 1024px maximum by default.
- Weapons: 1024px maximum by default.
- Environment modules: 1024px maximum by default; prefer atlases.
- UI-independent authored art must remain readable with lower mip levels on small screens.

KTX2/Basis Universal is the mobile texture target. `scripts/prepare-graphics-codecs.mjs` copies the Basis transcoder JS/WASM from the locked Three.js package into generated public assets so the Android package does not depend on a CDN. The runtime loader keeps KTX2 code deferred until an authored asset is actually requested. A live WebGL renderer must be registered with `configureGraphicsAssetRenderer()` before KTX2 content is loaded so Three.js can select the supported GPU texture format.

## Geometry and LOD

- Preserve strong silhouette before adding micro-detail.
- LOD0 is the close/hero version, not an excuse for desktop-scale geometry.
- LOD1 should target roughly 55–70% of LOD0 rendered triangles.
- LOD2 should target roughly 25–40% of LOD0 rendered triangles.
- Repeated static props should be compatible with `InstancedMesh` where feasible.
- Skinning influence counts and bone counts should stay minimal for mobile.

Meshopt is the geometry-compression target. Its decoder is dynamically imported with the GLTF loader, so existing app boot chunks remain unaffected until authored 3D content is requested.

`graphicsAssetLodForDetailScale()` maps the existing adaptive renderer detail scale to LOD0/1/2. Missing preferred LODs fall toward a cheaper model first, protecting mobile performance rather than silently escalating to the heaviest asset.

## Loading and ownership contract

`src/game/graphicsAssets.ts` owns the GLB load/cache boundary.

- `GLTFLoader`, Meshopt, KTX2, and `SkeletonUtils` are dynamically imported.
- Validated asset URLs live under `/assets/models/`, end in `.glb`, and include `-lodN` matching their declared LOD.
- Successful source GLBs are cached by URL.
- Failed loads are removed from cache so a later request can retry.
- `instantiateGraphicsAsset()` clones rigged scenes with `SkeletonUtils.clone()` so bones are correctly rebound while geometry/material data remains shareable.
- Mounted instances hold a cache lease. Eviction waits for mounted clones to release before disposing shared geometry, materials, textures, image bitmaps, and skeleton GPU resources.
- Instance release detaches the clone and disposes clone-specific skeleton resources without destroying shared cached geometry/materials.
- The current procedural renderer remains the required fallback until each authored asset family is production-ready.

## Current compression status

- GLB: supported.
- Mesh compression: Meshopt runtime decoding supported.
- KTX2/Basis textures: transcoder packaging and runtime loader support implemented; renderer registration is required before compressed content is mounted.
- Animation clips: carried through instantiated GLBs; animation-state integration remains Phase 2.

## First asset slots

`src/game/graphicsAssetManifest.ts` reserves stable LOD0/1/2 URLs for the operator field suit and the Asteroid Refinery showcase processing module. These are contracts only until the corresponding authored GLBs are added.

## Validation

- `npm run test:graphics` validates the source-level asset contract, LOD behavior, deferred decoder imports, and ownership/disposal safeguards.
- `npm run test:graphics:dist` verifies the production build contains the local Basis JS/WASM transcoder and enforces a codec payload budget.
- Both run as part of `npm run build`.
- Content-specific triangle, texture, animation, and payload inspection will expand when the first authored GLB is committed.
