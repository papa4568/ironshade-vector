# Ironshade Vector — Active Production Roadmap

## New-chat handoff — resume here first

- All previously completed P20–P23 work is already preserved in [content-roadmap-archive.md](./content-roadmap-archive.md) and has been removed from the active queue.
- The 2026-09-29 full-code audit is now queued as progressive remediation work. Broad findings are split into bounded implementation/verification cycles so one checkbox does not require a large multi-system rewrite.
- **Next executable item: P24-A — Separate input capability detection from responsive combat layout.**

Only active/future executable work lives here. Completed and verified work belongs in [content-roadmap-archive.md](./content-roadmap-archive.md). Stable product rules live in [product-constraints.md](./product-constraints.md).

## Execution contract

- Execute top to bottom. The **first unchecked top-level item is next** unless the user explicitly changes priority.
- One checkbox should fit one realistic **implement → test → build → APK verification** cycle.
- Split an item before coding if it spans independent systems or verification cycles; combine tiny changes only when they touch the same system and can be verified together.
- An item is complete only when its requested behavior works, relevant regression checks pass, the production build succeeds, and the Android deliverable is verified as required by the repository workflow.
- After verified completion, move the completion detail/evidence to the archive and remove the item from this file.
- If repository evidence shows an active item is already complete, verify that evidence before archiving it. If only part is complete, rewrite the item around the remaining work.

## P24 — Runtime Correctness and Data Integrity

- [ ] **P24-A — Separate input capability detection from responsive combat layout** — Stop treating every viewport at or below 900 px as touch-only/coarse input. Preserve compact/touch layout behavior, but allow WASD and other hardware-keyboard movement on narrow desktop windows, tablets, foldables, and hybrid devices. Add regression coverage for narrow fine-pointer + keyboard and coarse-pointer layouts.

- [ ] **P24-B — Prevent stale legacy saves from resurrecting after atomic-save recovery** — When pre-boot recovery quarantines/removes an unsafe atomic save, ensure valid old profile/campaign keys cannot silently replace newer progression. Add a migration/recovery regression covering an invalid atomic save plus older valid legacy keys, and verify recovery messaging matches the actual resulting state.

- [ ] **P24-C1 — Make healthy Operations metrics reads independent of total telemetry-ledger size** — Remove the unconditional full accepted-run ledger enumeration from normal `/api/operations` reads. Keep the current aggregate as the fast path and add a bounded consistency signal/version mechanism so healthy reads remain effectively O(1) as telemetry grows.

- [ ] **P24-C2 — Bound telemetry-ledger reconciliation work** — Rework stale-metrics repair so reconciliation is explicitly paginated/batched instead of serially reading the entire ledger in one request. Add deterministic service coverage for a multi-page/large-ledger case, contention recovery, and no double-counting.

- [ ] **P24-D — Harden the trust boundary for global balance telemetry** — Reduce arbitrary public submission poisoning without introducing a full account system: require a server-verifiable short-lived submission/session credential or equivalent bounded ingest control, retain idempotency/replay protection, cap abuse within the chosen trust model, and label aggregate data as unverified anywhere gameplay authenticity cannot actually be proven. Add forged/replayed/expired submission tests.

- [ ] **P24-E — Enforce the telemetry payload byte limit while reading the body** — Do not rely only on `Content-Length`. Reject oversized chunked/missing-length requests using an actual bounded body read/stream strategy while preserving the existing 512 KB contract and 413 behavior. Add service tests for missing, false, and oversized content-length cases.

- [ ] **P24-F — Validate Operations API response schemas at the client boundary** — Replace unchecked generic JSON casts for Operations snapshots and run traces with runtime validation/normalization. Malformed-but-valid JSON should become a controlled `invalid-response` failure instead of leaking bad shapes into UI/runtime state. Cover both snapshot and trace responses.

## P25 — CI, Release, and Platform Hardening

- [ ] **P25-A — Extend strict TypeScript checking to service and build/config code** — Add a bounded server/tooling typecheck configuration that covers `netlify/functions/api.ts`, Vite/Capacitor config, and directly relevant test/service entry points without weakening the existing strict `src` settings. Make the production/CI gate fail on server-side type regressions.

- [ ] **P25-B — Run service regressions on service-only pull requests** — Update PR path filters/gates so changes to `netlify/functions/**`, `vite.service.config.ts`, service mocks, or service/network tests execute the relevant typecheck and `test:service`/`test:network` coverage before merge. Keep unrelated PRs from paying unnecessary Android cost.

- [ ] **P25-C — Align the declared and CI npm toolchain** — Resolve the `npm@10.9.8` package/engine declaration versus workflows forcing `npm@11.19.1`. Choose one supported pinned version, use it consistently in local metadata and every workflow, and verify `npm ci` plus the production build under that exact version.

- [ ] **P25-D — Make Android artifact signing identity unambiguous** — Keep debug APKs available for CI/smoke work, but do not present an ephemeral debug-signed artifact under the same release-like beta identity as a persistent release-signed artifact. Encode signing mode in artifact metadata/name, require persistent signing for release-distribution runs, and retain upgrade-signature verification for release mode.

- [ ] **P25-E — Make Android 16 large-screen orientation behavior explicit and tested** — For target SDK 36, decide the intended tablet/foldable behavior, add the appropriate Android game/category/orientation configuration if justified, and add at least one ≥600dp portrait/resize verification path. Preserve phone landscape behavior and ensure portrait fallback remains usable where orientation locking is not honored.

- [ ] **P25-F — Trigger soak coverage when performance-sensitive runtime code changes** — Expand the P16-E soak workflow trigger beyond its own scripts to the combat/render/simulation/performance/assets/dependency files that can actually introduce sustained-runtime regressions. Keep routine docs/UI-only changes out of the soak trigger.

- [ ] **P25-G — Separate routine advisory outages from release security gates** — Routine CI may warn/retry when the npm advisory service is unavailable, but release-producing verification must not silently succeed without a completed high-severity runtime dependency audit. Add an explicit release gate/status that distinguishes “clean”, “failed”, and “audit service unavailable”.

## P26 — Performance and Verification Quality

- [ ] **P26-A — Add production bundle byte budgets** — Keep the existing intentional code splitting, but replace the effectively unlimited chunk warning policy with measured budgets for boot, App, GameCanvas, Three WebGL, and QA-only WebGPU delivery. Fail or clearly gate regressions beyond an explicit tolerance while allowing intentional reviewed increases.

- [ ] **P26-B1 — Replace graphics-backend source-string assertions with executable behavior checks** — Start with `graphics-backend-boundary`, refinery effect gates, and world-material/runtime wiring. Preserve only static checks that are genuinely architecture contracts; move renderer creation, fallback, lifecycle, and effect behavior to executable assertions.

- [ ] **P26-B2 — Replace UI/accessibility source-string assertions with rendered behavior checks** — Convert the highest-value assertions in `ui-readability`, `menu-presentation`, `mission-presentation`, and `accessibility-mobile-gate` to DOM/browser behavior or deterministic presentation helpers. Keep each converted family small enough to diagnose independently.

- [ ] **P26-B3 — Replace combat/enemy source-string wiring checks with runtime contracts** — Convert source-inspection assertions around combat camera feedback, status/lifecycle presentation, protocol/mutation visuals, and mobile enemy readability into exported deterministic behavior checks or browser/runtime assertions where practical.

- [ ] **P26-B4 — Audit remaining source-inspection tests and keep only intentional static contracts** — Inventory residual `readFileSync(...).includes/match` checks after P26-B1–B3. Remove redundant implementation-text assertions, document the few remaining architecture/static-file contracts, and ensure every player-facing behavior has at least one executable verification path.

## P27 — Maintainability and Low-Risk Cleanup

- [ ] **P27-A1 — Extract GameCanvas input orchestration without changing gameplay** — Move global keyboard/gamepad/touch input state and event lifecycle out of the monolithic component into a focused helper/hook boundary. Preserve existing controls, assisted targeting, tutorial advancement, pause/visibility clearing, and test behavior.

- [ ] **P27-A2 — Extract GameCanvas performance/diagnostics publishing** — Move frame-budget sampling, dataset diagnostics publication, and performance-report bookkeeping behind a focused runtime helper while keeping the render/simulation loop behavior and telemetry fields unchanged.

- [ ] **P27-A3 — Extract GameCanvas HUD derivation/presentation selectors** — Move pure HUD/status derivation and presentation-selection helpers out of `GameCanvas.tsx` without changing rendered output. Verify the component shrinks while existing gameplay/browser/Android checks remain green.

- [ ] **P27-B1 — Extract Asteroid Refinery renderer responsibilities from the monolithic Three renderer** — Move refinery-specific authored environment loading/state/effect plumbing into a focused module while preserving renderer ownership, disposal, adaptive quality, and existing refinery QA telemetry.

- [ ] **P27-B2 — Extract damaged-vessel and Parallax environment renderer responsibilities** — Move those location-specific asset/load/state paths out of `threeCombatRenderer.ts` with no visual/gameplay changes and retain deterministic asset/runtime verification.

- [ ] **P27-B3 — Extract Jovian Harvester and Ice Mine environment renderer responsibilities** — Isolate those location-specific authored environment paths, preserving existing LOD, performance, state animation, and Android/browser verification.

- [ ] **P27-B4 — Extract Solar Yard and Spin Habitat environment renderer responsibilities** — Isolate those location-specific authored environment paths, preserving lighting/state/LOD behavior and current deterministic/runtime checks.

- [ ] **P27-B5 — Isolate shared transient renderer lifecycle and disposal helpers** — Move repeated projectile/enemy/transient VFX resource ownership/disposal mechanics behind focused helpers after the location extractions, preserving bounded pools and leak/lifecycle behavior.

- [ ] **P27-C1 — Inventory and assign ownership for combat-HUD CSS specificity overrides** — Map the `!important` clusters in combat HUD/readability/mobile styles to their intended cascade owner and remove only redundant overrides. No visual redesign in this item; lock current screenshots/layout measurements before changing specificity.

- [ ] **P27-C2 — Reduce remaining combat-HUD specificity debt** — Refactor the highest-pressure remaining override clusters in `combatHudGlance.css`, `combatHudLayout.css`, `mobileCombatReadability.css`, `readability.css`, and `spaceCombat.css` using explicit layer/order/selectors instead of escalating `!important`. Preserve compact/mobile accessibility and P22 geometry.

- [ ] **P27-D — Stop aim-assist setting changes from rebuilding the graphics backend** — Decouple the main renderer lifecycle effect from callbacks whose identity changes with `profileSettings.aimAssist`. Verify changing aim assist updates targeting behavior without disposing/recreating the graphics backend or restarting the animation loop.

- [ ] **P27-E — React to pointer-capability changes without requiring a resize** — Subscribe to `matchMedia('(pointer: coarse)')` changes in addition to viewport resizing so attaching/removing mouse/touch input updates the combat layout/input mode immediately. Cover hybrid-device transitions.

- [ ] **P27-F — Remove the WebGPU renderer `any` escape hatches** — Replace the TSL/render-pipeline `any` fields in `webGpuRefineryRenderer.ts` with stable local structural types or upstream Three.js types where available. Keep the QA-only WebGPU lazy boundary/fallback behavior unchanged.
