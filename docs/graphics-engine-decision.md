# Graphics engine decision

Date: 2026-09-28
Finalized: 2026-10-04
Status: Babylon.js is the shipped combat graphics engine; the former Three.js production and P21 WebGPU/TSL paths are retired.

## Current shipped decision — P27 Babylon.js migration complete

Ironshade Vector now ships the combat renderer on **Babylon.js** while preserving the TypeScript simulation, React UI, Capacitor Android packaging, save/runtime contracts, and deterministic release QA.

The migration completed in stages rather than as a flag-day rewrite. P27 first introduced Babylon behind the renderer-neutral `CombatGraphicsBackend` contract, reached gameplay/visual parity, proved browser and Android behavior, cut production over to Babylon, retired the old runtime selectors, and finally removed the remaining Three.js-only dependencies and loader/codec plumbing.

The shipped graphics architecture is now:

- **Babylon.js WebGL2 is the required production baseline.** This is the verified Android-compatible path.
- **Babylon WebGPU is optional when supported** and falls back to Babylon WebGL2 through the Babylon backend rather than through a second renderer implementation.
- **Three.js and `@types/three` are not runtime or development dependencies.** No normal or QA route loads Three chunks, GLTF/KTX2 helpers, TSL, or the former P21 WebGPU comparison renderer.
- **GLB/KTX2/Meshopt remains the authored-asset contract.** The renderer-neutral asset spec/LOD/budget contract lives in `src/game/graphicsAssets.ts`; Babylon owns runtime loading, caching, instancing, decoder configuration, and scene-resource disposal.
- **Decoder payloads are local.** Babylon KTX2, UASTC/MSC/ZSTD, and Meshopt decoder assets are packaged under `/assets/codecs/babylon/`; the retired Three Basis directory is explicitly rejected by release tests.
- **Gameplay ownership remains outside the renderer.** Simulation coordinates, combat rules, mission state, input semantics, React HUD, save data, and deterministic test contracts remain engine-independent.
- **Rollback is release/history based.** The old Three renderer is no longer a live selector. A rollback would use a prior verified release/commit, not dormant Three code in the shipping bundle.

Babylon.js is deliberately pinned and upgraded only through normal dependency, build, browser, Android, and APK verification.

## Why Babylon became the production renderer

The original P21 decision below was correct for the evidence available on 2026-09-28: Three.js WebGL2 was the only full-combat, Android-proven implementation and the P21 Three WebGPU/TSL path was only a QA slice. On 2026-09-29 product direction changed explicitly to migrate to Babylon.js. P27 then supplied the evidence the earlier decision said was missing: full combat/location parity, adaptive-quality parity, Android touch/lifecycle behavior, sustained resource stability, bundle/APK budgeting, browser coverage, and a verified production cutover.

By P27-D7 the Babylon renderer was the production default with browser and Android acceptance passing. P27-D8 removed the legacy Three production and P21 WebGPU/TSL runtime paths. P27-D9 removed the remaining Three dependencies, Three-specific loader/codec plumbing, dead helpers, and obsolete bundle rules. The historical P21 measurements are retained below as baseline and rollback evidence only.

## Historical P21-G decision — superseded

The prior P21-G decision was to keep **Three.js WebGL2 as the production combat renderer** for that roadmap, retain the P21 WebGPU/TSL renderer as a **QA-only comparison harness**, and avoid a Godot/Unity-class replatform.

That decision was based on the completed P21-A through P21-F evidence available at the time. It was not a claim that Three.js must remain permanent; it recorded the lowest-risk path before Babylon parity existed.

## Historical measured comparison

| Area | P21 Three WebGL2 production path | P21 Three WebGPU/TSL QA path | Historical conclusion |
| --- | --- | --- | --- |
| Visual result | Full authored Asteroid Refinery combat covered operator/enemies, HUD, touch controls, objectives, authored assets, PMREM IBL, selective bloom, contact grounding, atmosphere, and adaptive quality. | The stack-off/stack-on captures proved the TSL/WebGPU effects changed renderer output, but the comparison remained an isolated refinery slice rather than the full combat renderer. | WebGPU demonstrated feasibility, not production parity. |
| Draw calls / triangles / frame evidence | P21-A2 recorded desktop High at **16.67 ms, 455 draw calls P95, 14,444 triangles P95** and mobile-landscape Performance at **40.05 ms, 224 draw calls P95, 9,052 triangles P95** on the deterministic refinery route. | No apples-to-apples full-combat WebGPU result existed. Android beta.608 recorded **19.18 ms, 215 draw calls P95, 7,648 triangles P95 only after falling back to WebGL2**, so it was not a WebGPU performance result. | There was no measured production-workload win yet. |
| Adaptive quality | High/Balanced/Performance budgets were integrated into the real renderer and covered by browser/Android degrade-recover checks. | Reused the same budget contract only inside the QA slice. | The shipping path had the only proven full-scene scaling. |
| Android compatibility | Three WebGL2 repeatedly passed APK build, install, real-touch combat, pause/resume, and crash/logcat verification. | On Android beta.608, WebView Chrome 124 exposed `navigator.gpu=true` but `requestAdapter()` returned no adapter; the QA request then fell back to WebGL2. | Three WebGPU could not replace the Android baseline. |
| Delivery cost | Production boot stayed WebGPU-free. | The lazy Three TSL/WebGPU comparison chunks added measurable APK payload without a production benefit. | The prototype cost was not justified as a shipping renderer. |
| Implementation complexity | One mature renderer owned full combat presentation and Android verification. | A second Three WebGPU/TSL implementation duplicated renderer-specific ownership and parity tracking. | Keeping both as production paths would increase risk. |
| Renderer-specific defects / gaps | No P21 renderer-specific blocker remained on the verified WebGL2 production path. | Desktop Lavapipe and mobile SwiftShader/readback defects remained, with intentional full-combat parity gaps. | The QA path was useful evidence but not production-ready. |

## Historical screenshot evidence

The verified P21 WebGL2 captures showed the complete playable refinery scene with authored machinery, operator/enemy silhouettes, HUD/touch layers, and gameplay cues coexisting with the lighting/post stack.

The P21 Three WebGPU renderer-owned captures showed a much smaller comparison scene. They proved meaningful TSL/WebGPU output, but not complete combat parity or verified Android support. P27 replaced that experimental branch with Babylon's production renderer and optional Babylon WebGPU capability.

## Native-engine replatform boundary

A future Godot/Unity-class replatform would still be substantially larger than a renderer swap. It would need an explicit migration plan for:

- **TypeScript simulation and game systems** — deterministic combat/mission/state/economy logic currently exercised by the TypeScript regression suites.
- **React UI and interaction layer** — management screens, combat HUD, dialogs, accessibility behavior, touch/controller interaction, responsive layout, and design-system contracts.
- **Capacitor Android integration** — lifecycle, WebView/native packaging, Android project generation, signing/versioning, install behavior, and release automation.
- **Deterministic tests and QA harnesses** — SSR regressions, Browser E2E routes, screenshots, runtime telemetry, graphics probes, and Android adb/UiAutomator gates.
- **Save/runtime contracts** — persisted state, migrations, recovery rules, campaign/runtime assumptions, and rollback compatibility.
- **Graphics asset pipeline** — GLB/KTX2/Meshopt assets, Babylon loaders/caches, material intent, effects profiles, quality budgets, and authored-scene verification.
- **Release QA and artifact delivery** — APK package/version/signature checks, emulator lifecycle/touch coverage, evidence artifacts, CI fan-out, and final-gate behavior.

Any future native-engine move should therefore be treated as a product/architecture migration with explicit acceptance criteria, not as a graphics-only optimization.

## Revisit triggers

Reopen the graphics-engine decision only when new product or platform evidence materially changes the tradeoff, such as:

- the supported Android/WebView matrix changes enough to require a different production graphics baseline;
- Babylon cannot meet a required graphics, stability, accessibility, power, memory, or delivery constraint after normal optimization;
- a new renderer or native engine demonstrates full gameplay/UI/release parity with a meaningful measured benefit; or
- product requirements become blocked by the current Babylon/React/Capacitor architecture strongly enough to justify the broader migration cost.

The current production decision is Babylon.js with Babylon WebGL2 as the required baseline, optional Babylon WebGPU where supported, and no shipped Three.js runtime.