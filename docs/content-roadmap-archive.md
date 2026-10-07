# Ironshade Vector — Completed Roadmap Archive

This file is the current index for completed production work. The active execution checklist lives in `docs/content-roadmap.md`.

**Archive rule:** once a roadmap batch is verified and completed, move its detailed checklist and delivery evidence here. Historical entries completed before P28-C4 are preserved byte-for-byte in [content-roadmap-archive-legacy.md](./content-roadmap-archive-legacy.md).

## P28 — Babylon flagship visual-quality overhaul

- [x] **P28-C4 — Add LOD0 refinery conduit and gantry modules** — Completed 2026-10-07 with deterministic full-detail service-conduit and smelter-gantry LOD0 authoring built from the shared hard-surface toolkit while preserving presentation-only ownership, stable repeated-placement pivots, legacy visual envelopes, and route clearance.
  - Added `scripts/prepare-refinery-conduit-gantry-lod0.mjs` and wired it into the standard graphics-asset preparation path. Service-conduit LOD0 adds rounded trunk/upper/auxiliary runs, couplings, chamfered supports, valve hardware, recessed junction depth, and emissive/status fixtures. Gantry LOD0 adds chamfered uprights, layered post ribs/caps, crown beam, service rail, carriage rollers, preserved drop line, feet, hazard strip, and status fixture.
  - Registered `refinery-service-conduit-lod0` and `refinery-smelter-gantry-lod0` in `src/game/graphicsAssetManifest.ts`; Flagship/high detail selects LOD0 while existing LOD1/LOD2 assets remain the deterministic recovery path.
  - Added `tests/refinery-conduit-gantry-lod0.mjs` and integrated it with the existing refinery machinery graphics-content gate. Coverage locks byte-for-byte deterministic generation, the legacy conduit/gantry visual envelopes, route-clearance preservation, identity `environment-root` pivots, anchored transforms, premium PBR material slots, hard-surface feature presence, indexed POSITION/NORMAL/TANGENT/TEXCOORD_0 payloads, Flagship manifest selection, and LOD0→LOD1/LOD2 recovery.
  - Corrected the authored Y placement after verification showed the shared chamfered-box primitive is floor-anchored rather than center-anchored; final conduit supports and gantry structure remain within the intended visual envelopes instead of being lifted by legacy cube-center assumptions.
  - Deterministic Flagship image-grade evidence is tagged `p28-c4-refinery-conduit-gantry-lod0`. Exact implementation head `b80ed2cd3a7e2eae1a1aaf2589e916990a021d3a` passed Browser E2E run `37604261522` on desktop and mobile-landscape, P28 Image Grade Visual run `37604261658`, and PR Android APK run `37604261499` including full repository verification, production/native builds, APK delivery/signature checks, API 35 product smoke, API 36 Android 16 large-screen smoke, and aggregate Android verification.
  - Android 16/API 36 initially exposed a QA-harness timing defect after Babylon WebGL2 was already active and rendering: the per-call CDP response cap was fixed at 10 seconds under software-rendered Flagship geometry. `scripts/android-large-screen-smoke.mjs` now makes that per-call timeout configurable with a bounded 20-second default while retaining the overall 45-second smoke deadline; the exact patched implementation head then passed both Android emulator profiles.
  - Verified PR artifact `ironshade-vector-pr-android-apk` (artifact `11473919175`, artifact digest `sha256:87cc523962df1dd84ae2bc5499a225785bd998cb409ad6fd61116cb71bd7dc1c`) contains `Ironshade-Vector-Android-Debug.apk` (10,408,103 bytes; package `app.ironshade.vector`; version `0.0.1-pr.130 (130)`; min SDK 24; compile/target SDK 36; APK Signature Scheme v2 verified; signer SHA-256 `c5741b8d3343c59d2ad2066c5794059bcf648bcfde16c30539321f30bdf04f0c`; APK SHA-256 `6431690235f89419c4dfcbb9cf45ee87fef060d0d4c7a369421b3ec12d367529`).
  - **Next: P28-C5 — Add LOD0 refinery processor.**

## Historical completed roadmap

All completion evidence from P28-C3 and earlier remains preserved without rewriting in [content-roadmap-archive-legacy.md](./content-roadmap-archive-legacy.md).
