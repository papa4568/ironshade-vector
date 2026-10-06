# Premium PBR Surface Library

P28-B1 adds the shared hard-sci-fi surface set generated under `public/assets/materials/premium-pbr/` for Babylon-authored refinery content. The baseline library contains painted metal, bare metal, deck plate, polymer/rubber, and emissive fixture surfaces.

Each surface uses a 512×512 authored base level with a complete 10-level mip pyramid. Base-color and emissive maps are sRGB RGBA8; normal and ORM maps are linear RGBA8. Runtime delivery is KTX2 with per-mip Zstandard supercompression, decoded through the repository-local Babylon KTX2 decoder stack. Resolution is chosen for the repeated gameplay surfaces in this library rather than treated as a global cap for later hero assets.

The packed ORM convention is glTF/Babylon metallic-roughness compatible: red is ambient occlusion, green is roughness, blue is metallic, and alpha is unused. The Babylon helper `src/game/babylonPremiumPbrMaterials.ts` configures those channel flags, tangent-space normal response, trilinear mip sampling, repeat wrapping, per-surface UV scale, and scene-scoped material reuse. The emissive fixture adds a separate sRGB emissive map so later refinery placement can participate in selective bloom without baking light into base color.

`scripts/prepare-premium-pbr-materials.mjs` deterministically rebuilds the KTX2 payloads during the existing graphics-preparation path. `tests/premium-pbr-materials.mjs` verifies the five-surface contract, byte-reproducible independent rebuilds, KTX2 headers/DFD, Zstd inflation, full mip chains, sRGB/linear intent, ORM semantics, and minimum authored detail range. `tests/graphics-runtime-assets.mjs` verifies the production build copied every KTX2 plus the local Babylon decoder stack.
