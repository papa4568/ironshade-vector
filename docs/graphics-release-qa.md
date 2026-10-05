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

## P28-A4 physical shadow-quality evidence

Run `scripts/android-p28a4-shadow-qa.sh` with a current APK on an unlocked physical high-performance Android phone connected through ADB. Set `ANDROID_P28A4_APK` when the APK is not at the default debug-build path and `ANDROID_SERIAL` when more than one ADB device is attached.

The wrapper rejects emulator/QEMU devices before launch. It records Android model/build/SOC metadata, installs and launches the APK, attaches to the production WebView, enters Asteroid Refinery, verifies the High-tier 2048 high-PCF key-shadow profile and tuned bias/normal-bias telemetry, moves across multiple snapped shadow-anchor regions, samples frame cadence, captures four renderer screenshots, records WebGL vendor/renderer identity, stores `gfxinfo`, and fails on Android crash signatures. Evidence is written to `p28a4-physical-qa/` by default.

P28-A4 can close only after the generated screenshots are inspected on the target phone class and show soft stable contacts with no obvious acne, peter-panning, missing important casters, or large-map swimming. The JSON evidence must also show at least two shadow-anchor regions while remaining on High quality with 2048 shadows.

## P16-E sustained emulator stress evidence

GitHub Actions run `35898430306` (`P16-E Android Soak Stress`) passed a 30-minute API 35 Pixel 7 Pro emulator T12 soak using a prepared six-modifier Command Target Directive on Solar Fabrication Yard.

- The WebView stress loop ran for exactly 1,800 seconds with 345 telemetry samples and 819 sustained combat input bursts. The app process survived unchanged and the crash/ANR scan was clean.
- Performance-diagnostics JS heap p95 remained 12.112 MB from baseline to final sample. Android process PSS moved from a 105.2 MB baseline median to 112.4 MB final median (+7.2 MB), below the 128 MB leak-growth gate.
- The relative sustained-frame gate did not degrade during the run: frame p95 was 50 ms at both baseline and final sampling windows.
- Absolute emulator frame timing is not acceptance evidence for device performance. SwiftShader reported the workload over budget and `gfxinfo` reported 100% janky frames; the emulator thermal HAL also exposed a fixed test sensor at 30.8 °C before and after the soak. Physical-device thermal/GPU evidence therefore remains required before P16-E can close.
- Artifact `10768934719` contains the exercised APK and soak evidence. APK SHA-256: `5f304c03f8e07b77dc79fdae0f20340f8d49f0aae0767abad9ca5eacd32e59fa`.

## Known limitations requiring physical-device evidence

- Sustained thermals, battery impact, GPU frame timing, texture-memory pressure, and driver-specific behavior still require representative physical Android hardware.
- AdaptiveRenderBudget thresholds are guarded by deterministic regression tests, but final threshold tuning should use physical-device frame-time traces.
- Memory-growth validation across repeated long mission enter/exit cycles should be repeated with Android Studio/Perfetto on physical hardware.
- The pre-overhaul Phase 0 screenshot/video baseline was not captured in the current repository history, so final visual comparison can only use the retained acceptance targets and current QA screenshots unless an older external baseline is supplied.
- Persistent release signing is only exercised when the repository signing secrets are configured; otherwise CI produces a verified installable debug-signed APK and records the signing mode in the artifact.

## Release rule

An APK is not considered current until its own main-branch workflow run passes package/signature checks, emulator runtime, touch smoke, lifecycle resume, authored graphics assertions, and QA artifact upload.
