# Graphics Engine Decision — P21-G

Date: 2026-09-28
Status: accepted for the current production roadmap

## Decision

Keep **Three.js WebGL2 as the production combat renderer** for the current roadmap. Retain the P21 WebGPU/TSL renderer as a **QA-only comparison harness** and do not start a Godot/Unity-class replatform.

This decision is based on the completed P21-A through P21-F evidence, including the captured Asteroid Refinery screenshots, runtime diagnostics, Android compatibility probes, delivery-size measurement, and current release QA behavior. It is not a claim that WebGPU or a native engine can never become the better choice; it records which path is justified by the evidence available now.

## Measured comparison

| Area | Production WebGL2 | QA WebGPU/TSL | Decision impact |
| --- | --- | --- | --- |
| Visual result | Full authored Asteroid Refinery combat is covered: operator/enemies, HUD, touch controls, objectives, authored assets, PMREM IBL, selective bloom, contact grounding, atmosphere, and adaptive quality. The deterministic captures show the complete playable scene with gameplay cues preserved. | The stack-off/stack-on captures prove the TSL/WebGPU effects change renderer output, but the comparison remains an isolated refinery slice rather than the full combat renderer. PMREM is represented by a bounded light proxy and full combat VFX are intentionally absent. | WebGPU demonstrates feasibility, not production parity. |
| Draw calls / triangles / frame evidence | P21-A2 recorded desktop High at **16.67 ms, 455 draw calls P95, 14,444 triangles P95** and mobile-landscape Performance at **40.05 ms, 224 draw calls P95, 9,052 triangles P95** on the deterministic refinery route. | No apples-to-apples full-combat WebGPU frame/draw/triangle result exists because the WebGPU path is still the isolated comparison slice. Android beta.608 recorded **19.18 ms, 215 draw calls P95, 7,648 triangles P95 only after falling back to WebGL2**, so it is explicitly not a WebGPU performance result. | There is no measured production workload win that justifies switching renderers. |
| Adaptive quality | High/Balanced/Performance budgets are integrated into the real renderer. New P21 effects scale to **1.00/1.00/1.00/1.00**, **0.70/0.68/0.68/0.68**, and **0.38/0.42/0.42/0.42**, while gameplay-critical cues remain at 1.00. Browser and Android degrade/recover coverage passes. | Reuses the same budget contract inside the QA slice, but not across the complete combat scene. | Existing production scaling is already proven on the shipping path. |
| Android compatibility | Production-default WebGL2 repeatedly passes APK build, install, real-touch combat, pause/resume, and clean crash/logcat verification. | On Android beta.608, WebView Chrome 124 exposed `navigator.gpu=true` but `requestAdapter()` returned no adapter. The QA request spent **12,970 ms** initializing before safely falling back to WebGL2. | WebGPU cannot replace the current Android production path on the verified target environment. |
| Delivery cost | Current production boot graph stays WebGPU-free. | The three lazy QA chunks (`three.tsl`, `three.webgpu`, `webGpuRefineryRenderer`) add **254,269 compressed APK bytes**, **757,432 uncompressed APK bytes**, or **4.183%** of the measured 6,078,104-byte APK. | The prototype has a measurable shipped cost without a production benefit yet. |
| Implementation complexity | One mature combat renderer already owns authored assets, camera/input, full combat VFX, PMREM, post-processing, adaptive quality, lifecycle, and Android verification. | Requires a separate WebGPU renderer, TSL material/pipeline setup, MRT bloom path, compatibility/fallback logic, renderer-specific readback handling, and explicit parity-gap tracking. | Keeping two production renderers would add duplicated ownership before parity or platform support is established. |
| Renderer-specific defects / gaps | No P21 renderer-specific blocker remains on the verified production path. | Desktop Lavapipe has the recorded `lavapipe-xvfb-black-canvas` presentation defect; mobile-landscape SwiftShader has the Three r186 `three-r186-render-target-descriptor` readback defect. Intentional parity gaps remain `ibl-pmrem-generator-webgl-only:bounded-light-proxy` and `combat-vfx-full-scene:not-in-f1-prototype`. | The QA path is valuable for continued measurement, but it is not the lower-risk production choice today. |

## Screenshot evidence

The verified WebGL2 captures show the P21 treatment in the actual playable refinery scene: authored machinery and floor, operator/enemy silhouettes, objective/HUD layers, touch controls, and gameplay cues all coexist with the lighting/post stack.

The verified WebGPU renderer-owned captures show a much smaller comparison scene. The stack-on image is visibly brighter and adds the intended lighting/effect response relative to stack-off, matching the recorded non-identical hashes and readback means. That proves the TSL/WebGPU stack is rendering meaningful output, but it does not erase the full-combat parity and Android-support gaps above.

## What a future Godot/Unity-class replatform would have to replace or bridge

A native-engine migration is not a renderer swap. It would need an explicit plan for all of these existing production systems:

- **TypeScript simulation and game systems** — deterministic combat/mission/state/economy logic currently exercised directly by the TypeScript regression suites would need to be ported, embedded, or separated behind a stable engine boundary.
- **React UI and interaction layer** — management screens, combat HUD, dialogs, accessibility behavior, touch/controller interaction, responsive layout, and the design-system contracts would need either a new native UI implementation or a maintained bridge.
- **Capacitor Android integration** — app lifecycle, WebView/native packaging, Android project generation, signing/versioning, install behavior, and release automation would need equivalent native-engine ownership.
- **Deterministic tests and QA harnesses** — the current SSR regression suite, Browser E2E routes, deterministic screenshots, runtime telemetry, graphics-path probes, and Android adb/UiAutomator smoke/full-regression gates would need replacements with equivalent signal and reproducibility.
- **Save/runtime contracts** — existing persisted state, migrations, recovery rules, campaign/runtime assumptions, and release rollback compatibility would need a versioned migration boundary rather than a reset.
- **Graphics asset pipeline** — authored GLB/KTX2/Meshopt assets, loaders/caches, material intent, effect profiles, quality budgets, and authored-scene verification would need importer/runtime parity and regenerated visual baselines.
- **Release QA and artifact delivery** — APK package/version/signature checks, emulator lifecycle/touch coverage, evidence artifacts, CI fan-out, and final gate behavior would need to exist before a native replatform could replace the current release path.

Because those systems are already integrated and verified, a future replatform should be treated as a product/architecture project with explicit migration criteria, not as a graphics-only optimization.

## Roadmap consequence

P21 closes on the existing production architecture:

1. Continue shipping WebGL2 as the production combat path.
2. Keep the WebGPU/TSL implementation QA-only so future browser/Android support can be measured without production risk.
3. Do not add replatform work to the active queue.
4. Return roadmap priority to the existing product work at **P20-F1 — Define and settle distinct repeatable-contract incentive profiles**.

## Revisit triggers

Reopen the renderer decision only when new evidence materially changes the tradeoff, such as:

- the supported Android/WebView target matrix reliably provides a WebGPU adapter;
- the WebGPU path reaches full-combat parity rather than an isolated slice;
- an apples-to-apples production workload shows a meaningful frame-time, power, memory, or visual-quality advantage after delivery cost;
- renderer-specific CI/presentation/readback defects are resolved or can be removed from required QA; or
- product requirements become blocked by the current WebGL2/React/Capacitor architecture strongly enough to justify the broader migration cost.

Until one of those conditions is demonstrated, production WebGL2 remains the measured, lower-risk path.
