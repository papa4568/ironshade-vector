# Graphics asset pipeline

This document defines the first runtime contract for the premium stylized hard-sci-fi 3D overhaul tracked in #10.

## Runtime format

- Runtime models: binary glTF (`.glb`).
- World scale: 1 authored unit = 1 meter before the existing combat renderer applies its world scale.
- Up axis: `+Y`.
- Character/weapon forward axis: `+X`, matching the existing combat visual convention.
- Pivots: characters at ground contact between the feet; weapons at their gameplay attachment origin; modular environment pieces on stable snapping corners/centers.
- Do not bake gameplay collision or mission logic into authored meshes.

## Naming

Use lowercase kebab-case and stable semantic names:

`operator-meridian-lod0.glb`

`enemy-technician-lod1.glb`

`weapon-rail-lod0.glb`

`refinery-pipe-straight-a-lod1.glb`

LOD suffixes are mandatory for assets that have multiple detail levels.

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

KTX2/Basis texture compression is the intended mobile target. It is not enabled in the loader yet; enabling it is a tracked Phase 1 task and must be verified on Android before compressed textures become required content.

## Geometry and LOD

- Preserve strong silhouette before adding micro-detail.
- LOD0 is the close/hero version, not an excuse for desktop-scale geometry.
- LOD1 should target roughly 55–70% of LOD0 rendered triangles.
- LOD2 should target roughly 25–40% of LOD0 rendered triangles.
- Repeated static props should be compatible with `InstancedMesh` where feasible.
- Skinning influence counts and bone counts should stay minimal for mobile.

Mesh compression will be added only after its decoder cost and Android compatibility are measured. Until then the loader accepts standard GLB content and keeps compression opt-in rather than silently adding boot/runtime cost.

## Loading contract

`src/game/graphicsAssets.ts` owns the initial GLB load/cache boundary.

- `GLTFLoader` is dynamically imported only when an authored asset is requested.
- Validated asset URLs live under `/assets/models/` and end in `.glb`.
- Successful loads are cached by URL.
- Failed loads are removed from cache so a later request can retry.
- The current procedural renderer remains the required fallback until each authored asset family is production-ready.
- Clearing the load cache does not dispose resources already mounted in scenes; renderer owners remain responsible for geometry/material/texture disposal when they stop owning an instantiated asset.

## Current compression status

- GLB: supported by the loader boundary.
- Mesh compression: not enabled yet.
- KTX2/Basis textures: not enabled yet.
- Animation clips: supported by GLB/GLTFLoader; animation-system integration is Phase 2.

## Validation

`npm run test:graphics` validates the source-level asset contract and is part of `npm run build`. Content-specific geometry/texture inspection will be expanded when the first authored GLB is committed.
