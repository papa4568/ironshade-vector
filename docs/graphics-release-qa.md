# Graphics release QA

This document records the graphics release gate after completion of the P27 Babylon.js renderer migration.

## Shipped graphics QA architecture

Babylon.js owns the production combat renderer. Babylon WebGL2 is the required production baseline; optional Babylon WebGPU may be selected only where supported and must fall back within the Babylon backend. The retired Three.js production renderer and P21 Three WebGPU/TSL QA implementation are no longer live runtime or QA paths.

Graphics QA therefore verifies one shipped renderer architecture rather than maintaining a second dormant renderer for comparison. Historical Three measurements remain useful as migration/rollback evidence, but release acceptance is based on current Babylon behavior.

## Automated release gate

Every graphics release candidate must pass:

- TypeScript checks and the complete production regression suite through `npm run build`.
- Renderer-neutral graphics asset validation: GLB naming/LOD contracts, authored-content bounds/triangle/texture checks, manifest coverage, and mobile payload budgets.
- Babylon asset-runtime checks covering deferred glTF loading, local KTX2/Meshopt decoder configuration, scene-owned cache/instancing behavior, lease-aware eviction, and deterministic disposal.
- Bundle architecture checks proving the boot graph remains split, Babylon glTF/WebGPU code remains deferred as intended, and no Three.js dependency/import/runtime chunk is reintroduced.
- Production runtime-asset checks proving the local Babylon decoder payload is present and the retired `/assets/codecs/basis/` Three transcoder directory is absent.
- Render-performance regressions covering adaptive High / Balanced / Performance tier behavior, protected gameplay cues, degradation/recovery behavior, resource budgets, and representative scene telemetry.
- Browser E2E on desktop and 844×390 mobile-landscape emulation, including deterministic Babylon backend telemetry and authored-asset assertions.
- Browser coverage for representative operator, enemy/boss, weapon, location, status/protocol, post-processing, and campaign/capstone presentation paths.
- Android APK package/version/SDK/signature verification.
- Android API-35 Pixel 7 Pro launch, real touch combat, authored-asset assertions, mobile layout/safe touch-target checks, pause/background/resume, mission/renderer re-entry, and crash/logcat scanning.
- Android API-36 large-screen/resizable verification for adaptive portrait/resize behavior and screenshot evidence.
- APK artifact upload from the same verified revision.

## Current decoder and dependency assertions

The production build must remain Babylon-only at runtime:

- `three` and `@types/three` must be absent from `package.json` and the lockfile's active dependency graph.
- Source and test architecture guards reject imports from `three`, `three/examples`, `three/webgpu`, and `three/tsl`.
- Vite must not emit retired `three-core`, `three-webgl`, `three.webgpu`, or `three.tsl` chunks.
- `scripts/prepare-graphics-codecs.mjs` packages Babylon KTX2/UASTC/MSC/ZSTD and Meshopt decoder assets locally.
- `tests/graphics-runtime-assets.mjs` rejects any shipped Three Basis codec directory and enforces the Babylon decoder payload budget.

## Current device coverage

The standard Android runtime gate uses an API 35 Google APIs x86_64 Pixel 7 Pro emulator. It is useful for package, WebView, touch, lifecycle, layout, deterministic graphics assertions, and Babylon renderer recreation. The large-screen gate uses API 36 coverage for adaptive Android 16 window behavior.

Emulator evidence is not a substitute for thermal, battery, or vendor-driver profiling on representative physical devices. Absolute SwiftShader frame timing is treated as regression signal, not physical-device performance acceptance.

## Sustained-runtime evidence

P27-D6 added Babylon-specific sustained-resource verification on API 35. The verified soak completed repeated renderer lifecycle recreation with stable scene/cache envelopes, stable frame-p95, bounded retained heap after GC, stable process identity, and Android PSS growth within the leak gate. That evidence closes the renderer-migration resource-stability requirement while retaining physical-device profiling as a broader product-performance practice.

Earlier P16-E emulator stress evidence remains useful for long-session gameplay and memory baselines, but Babylon release acceptance is now governed by the current P27 runtime/resource tests and main-branch Android workflows.

## Known limitations requiring physical-device evidence

- Sustained thermals, battery impact, hardware GPU frame timing, texture-memory pressure, and vendor-driver-specific behavior require representative physical Android hardware.
- Adaptive quality thresholds are guarded by deterministic tests, but final product tuning should still use physical-device frame/power traces.
- Persistent release signing is exercised only when repository signing secrets are configured; otherwise CI produces a verified installable debug-signed APK and records the signing mode in the artifact.
- Historical pre-migration screenshots and Three-specific measurements are comparison evidence only. They are not required runtime dependencies and must not be restored solely to preserve old QA paths.

## Release rule

An APK is not considered current until its own verified revision passes the production build, Babylon graphics/bundle/runtime-asset gates, browser E2E, Android package/signature checks, runtime touch/lifecycle smoke, large-screen coverage, crash scanning, and APK artifact upload.

For a completed roadmap item, the checklist may be marked done only after those required gates pass and a runnable APK from the verified revision is available.