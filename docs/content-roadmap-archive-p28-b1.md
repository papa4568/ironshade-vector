# P28-B1 — Reusable premium PBR surface library

Completed and verified on 2026-10-06. This focused completion record supplements `docs/content-roadmap-archive.md` while preserving the historical archive byte-for-byte.

- Added a shared authored hard-sci-fi material library for painted metal, bare metal, deck plate, polymer/rubber, and emissive fixtures using Babylon/glTF metallic-roughness conventions, tangent-space normals, packed ORM, full mip pyramids, and local KTX2 delivery.
- `scripts/prepare-premium-pbr-materials.mjs` deterministically generates 16 local 512×512 RGBA8 KTX2 maps across the five reusable surfaces with complete 10-level mip chains, role-correct sRGB/linear transfer intent, gamma-aware color downsampling, renormalized normal mips, and per-mip Zstandard supercompression.
- Packed ORM uses red=ambient occlusion, green=roughness, blue=metallic, alpha=unused. The production payload is 3,418,114 bytes across 16 KTX2 textures; the deterministic content test reports a 0.153 compressed/raw mip-payload ratio.
- `src/game/babylonPremiumPbrMaterials.ts` provides scene-scoped shared Babylon `PBRMaterial` instances with trilinear mip sampling, repeat wrapping, authored UV scales/normal strength, correct ORM channel flags, and a separate emissive fixture texture compatible with selective bloom.
- `tests/premium-pbr-materials.mjs` and runtime-asset coverage verify independent byte-identical rebuilds, KTX2 headers/DFD, Vulkan format/transfer intent, Zstd inflation, every mip payload, authored channel variation, ORM semantics, and production `dist` packaging.
- The material contract is documented in `docs/premium-pbr-surface-library.md`; generated KTX2 payloads remain derived build outputs under `public/assets/materials/premium-pbr/` and are rebuilt by the existing graphics-preparation entry point.
- Exact implementation revision `4a714a52f40f14b27395125a05d03210ddcf0951` passed Browser E2E run `37442874470` on desktop and mobile-landscape and PR Android APK run `37442874365`, including full repository verification, native APK build/sign/delivery checks, API 35 product smoke, API 36 large-screen smoke, and aggregate Android verification.
- Verified implementation PR debug APK SHA-256: `bcbf58d5533706d954557c83f22cac7657a02e78530a982af113356f038b9149`.
- **Next: P28-B2 — Apply P28 materials to refinery floors and bulkheads.**
