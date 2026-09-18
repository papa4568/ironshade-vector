# Graphics release QA

This document records the release gate for the graphics-overhaul work tracked in issue #10.

## Automated release gate

Every graphics release candidate must pass:

- TypeScript checks and the complete existing test suite through `npm run build`.
- Render-performance regressions, including adaptive High / Balanced / Performance tier behavior.
- Client bundle and runtime graphics-asset budget checks.
- Browser E2E on desktop and 844×390 mobile-landscape emulation.
- Browser authored-asset assertions for the operator, enemy roles/boss, weapons, and Asteroid Refinery.
- Android APK package/version/SDK/signature verification.
- Android Pixel 7 Pro emulator launch, touch-input smoke, authored-asset assertions, mobile layout/safe touch-target checks, and background/resume validation.
- Android runtime crash scan and screenshot artifact capture.

## Current device coverage

The automated Android gate uses an API 35 Google APIs x86_64 Pixel 7 Pro emulator in sensor-landscape mode. It is useful for package, WebView, touch, lifecycle, layout, and deterministic authored-graphics assertions, but it is not a substitute for thermal/GPU profiling on physical devices.

## Known limitations requiring physical-device evidence

- Sustained thermals, battery impact, GPU frame timing, texture-memory pressure, and driver-specific behavior still require representative physical Android hardware.
- AdaptiveRenderBudget thresholds are guarded by deterministic regression tests, but final threshold tuning should use physical-device frame-time traces.
- Memory-growth validation across repeated long mission enter/exit cycles should be repeated with Android Studio/Perfetto on physical hardware.
- The pre-overhaul Phase 0 screenshot/video baseline was not captured in the current repository history, so final visual comparison can only use the retained acceptance targets and current QA screenshots unless an older external baseline is supplied.
- Persistent release signing is only exercised when the repository signing secrets are configured; otherwise CI produces a verified installable debug-signed APK and records the signing mode in the artifact.

## Release rule

An APK is not considered current until its own main-branch workflow run passes package/signature checks, emulator runtime, touch smoke, lifecycle resume, authored graphics assertions, and QA artifact upload.
