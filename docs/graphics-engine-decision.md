# Graphics Engine Decision — P27 closeout

Date: 2026-10-04
Status: active production decision

## Decision

Ironshade Vector ships **Babylon.js as the sole production 3D combat renderer**. The TypeScript simulation, React UI, Capacitor Android packaging, save/runtime contracts, and release QA remain outside renderer ownership.

The P27 migration is complete enough to retire the former Three.js production/rollback path and the P21 Three WebGPU/TSL comparison renderer. Production delivery must not contain unintended Three runtime packages, imports, chunks, or the retired `/assets/codecs/basis/` payload.

Babylon.js remains deliberately pinned and is updated only through normal dependency, build, browser, Android, and APK verification.

## Shipped architecture

- `CombatGraphicsBackend` remains the engine-neutral integration boundary used by the React/gameplay layer.
- `BabylonCombatRenderer` owns the production Babylon scene, camera projection, authored operator/enemy presentation, runtime quality telemetry, and integration of renderer-owned visual systems.
- Dedicated Babylon presentation modules own weapons/abilities, telegraphs, protocols/statuses, enemy lifecycle, authored locations/capstones, refinery lighting/post-processing, and world presentation.
- `graphicsAssets.ts` is renderer-neutral; `babylonGraphicsAssets.ts` and `babylonGltfLoader.ts` own scene-local authored GLB loading/caching/instantiation.
- KTX2/Basis Universal, Meshopt, and supporting WASM/JS decoders are packaged locally under `/assets/codecs/babylon/`.
- Gameplay state and mechanics remain in the TypeScript simulation. Renderer modules consume state for presentation and must not become gameplay authorities.
- WebGL2 remains the required Android baseline. No separate Three/WebGPU fallback renderer is shipped.

## Why the Three rollback path was retired

P27 used a staged migration rather than a flag-day replatform. Three remained available while Babylon accumulated parity evidence across combat presentation, authored locations, effects, resource quality, lifecycle/re-entry, Android resume behavior, and mobile/performance budgets. Once the Babylon cutover and retention gates were established, keeping the old renderer became a liability rather than useful rollback protection:

- two rendering stacks duplicated presentation ownership and regression expectations;
- the old loader/cache and codec path kept otherwise-unused Three packages in production dependency/delivery graphs;
- legacy source-oracle tests continued to validate retired implementation details instead of shipped behavior;
- the P21 WebGPU comparison chunks carried delivery cost without serving the production architecture.

P27-D9 therefore removes those runtime dependencies and converts regression ownership to Babylon or renderer-neutral contracts. Rollback is now release/version rollback, not a second live renderer inside the application.

## Current quality and release contract

A graphics change is not considered ready solely because it compiles. The release path retains:

- TypeScript/gameplay regression suites;
- Babylon graphics regressions and authored-content validation;
- production browser build and bundle architecture checks;
- deterministic browser/runtime graphics smoke coverage;
- Android lifecycle, touch, renderer re-entry, resume, large-screen, and runtime telemetry checks;
- APK package inspection that rejects retired Three delivery artifacts and requires Babylon codecs/assets.

Adaptive quality continues to protect mobile execution by scaling secondary effects, asset/cache budgets, animation LOD, and presentation density while preserving gameplay-critical cues.

## Historical P21 decision and measurements

P21-G, recorded on 2026-09-28, selected Three.js WebGL2 over the then-experimental Three WebGPU/TSL path. That was the correct decision for the evidence available at the time and is retained as historical rollback/migration context.

The P21 comparison found that:

- the Three WebGL2 path had full-combat ownership while the WebGPU/TSL path was an isolated refinery slice;
- the verified Android target exposed `navigator.gpu` but did not provide a usable adapter in that test environment, causing safe fallback to WebGL2;
- the WebGPU comparison path had renderer/readback defects and known parity gaps;
- its lazy comparison chunks added measurable APK payload without a demonstrated production workload advantage.

Those measurements explain why the project did **not** switch to Three WebGPU in P21. They do not describe the current P27 Babylon architecture and should not be used as present-tense ownership or delivery requirements.

## What did not change during the renderer migration

The migration intentionally preserved the surrounding product architecture:

- deterministic TypeScript combat/mission/economy systems;
- React management screens, combat HUD, accessibility, touch/controller interaction, and responsive layout;
- Capacitor Android lifecycle/package/signing/release flows;
- persisted state, save migrations, and recovery behavior;
- GLB/KTX2/Meshopt asset standards and adaptive LOD intent;
- deterministic regression, browser, and Android release evidence.

A future Godot/Unity-class replatform would still be a broader product/architecture project because it would need an explicit replacement or bridge for all of those systems, not merely a different renderer.

## Revisit triggers

Reopen the engine decision only if new evidence materially changes the tradeoff, for example:

- Babylon can no longer meet required Android/WebGL2 compatibility, lifecycle, memory, or performance targets;
- a different engine demonstrates a measured production advantage large enough to justify migration cost across simulation/UI/save/QA/release systems;
- product requirements are blocked by the current React/Capacitor/Babylon architecture; or
- platform requirements force a rendering/runtime capability Babylon cannot provide within the supported matrix.

Until then, Babylon.js is the single shipped renderer and release QA should defend that architecture rather than preserve retired Three implementation paths.
