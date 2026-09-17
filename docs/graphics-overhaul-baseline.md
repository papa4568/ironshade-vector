# Graphics overhaul baseline

Tracking: #10 — Premium Stylized Hard-Sci-Fi 3D.

## Vertical-slice target

The first showcase location is **Asteroid Refinery**. The vertical slice will prove the authored-asset pipeline with one operator, the core enemy roles, all three current weapons, one complete Asteroid Refinery mission, and the final lighting/VFX recipe before the art system is rolled across the campaign.

## Verified baseline — 2026-09-17

Baseline commit: `7b382ca198252c97849a149069717b11678e9e60`.

The Android CI build for this commit passed the full web regression suite, production Vite build, APK build, package/signature checks, and the Pixel 7 Pro Android emulator runtime/touch smoke test.

### Production client

| Metric | Baseline |
| --- | ---: |
| Boot entry | 279.0 KiB raw / 83.9 KiB gzip |
| Three.js deferred runtime | 529.6 KiB raw / 134.2 KiB gzip |
| Largest Three.js chunk | 350.0 KiB raw |
| GameCanvas chunk | 159.2 KiB raw / 47.0 KiB gzip |
| JS chunks | 9 |

Existing hard gates remain authoritative: boot entry < 360,000 bytes raw and < 110,000 bytes gzip; combined deferred Three.js < 550,000 bytes raw and < 140,000 bytes gzip; largest Three.js chunk < 500,000 bytes.

### Android package

| Metric | Baseline |
| --- | --- |
| Version | `0.0.1-beta.64` (`versionCode 64`) |
| Package | `app.ironshade.vector` |
| minSdk | 24 |
| targetSdk | 36 |
| APK size | 4.5 MiB reported by CI |
| CI signing | Debug/ephemeral |
| Runtime smoke profile | Pixel 7 Pro, API 35, x86_64, 1440×3120, 60 Hz |
| Runtime smoke | PASS: ship → contracts → combat; move/aim/fire/ability/dodge/weapon touch paths |

The emulator smoke is a functional baseline, not a real-device GPU performance measurement. Real-device frame-time, thermal and memory baselines remain required before the vertical slice is approved.

## Existing adaptive rendering baseline

The current `AdaptiveRenderBudget` has three tiers:

| Tier | Pixel-ratio scale | Detail scale | Dynamic shadows |
| --- | ---: | ---: | --- |
| High (0) | 1.00 | 1.00 | Enabled when requested quality allows |
| Balanced (1) | 0.84 | 0.78 | Enabled when requested quality allows |
| Performance (2) | 0.68 | 0.50 | Disabled |

Coarse/mobile pointers currently begin at Balanced. Sustained frame times above ~21.5 ms drive quality downward; sustained healthy frame times below ~17.4 ms allow recovery.

## Mobile acceptance gates for the new art

These are the working gates for the vertical slice. They may be tightened after real-device profiling, but should not be relaxed without documenting the device evidence.

### Performance

- Modern target Android hardware: target 60 FPS during normal combat.
- High tier: no sustained automatic downgrade during representative combat; target p95 frame time ≤ 20 ms.
- Balanced tier: target p95 frame time ≤ 25 ms.
- Performance tier: maintain responsive play at ≥30 FPS under worst practical combat load.
- No persistent memory increase greater than 20 MiB after five mission enter/exit cycles.
- No renderer/resource corruption after Android pause/resume.
- Existing JS bundle hard gates must continue to pass.

### Runtime art budgets

Initial per-asset budgets are deliberately conservative for the isometric mobile camera:

- Operator LOD0: ≤ 45k rendered triangles, ≤ 2.5 MiB compressed GLB payload, max 2048px hero texture dimension.
- Standard enemy LOD0: ≤ 30k triangles, ≤ 1.5 MiB compressed GLB payload, max 1024px texture dimension.
- Boss LOD0: ≤ 60k triangles unless profiling approves a specific exception.
- Weapon LOD0: ≤ 12k triangles, ≤ 0.8 MiB compressed GLB payload, max 1024px texture dimension.
- Repeated environment module: ≤ 20k triangles and ≤ 1.2 MiB compressed GLB payload before instancing/LOD.
- Prefer shared material atlases for repeated environment props.
- Repeated props should use instancing where their material/geometry layout permits it.
- Collision and gameplay geometry remain independent from authored render meshes.

### Readability

- Player and enemy roles remain recognizable by silhouette at normal phone combat zoom.
- Role identity cannot depend on hue alone.
- Objectives and interactables must visually dominate non-interactive decoration.
- Muzzle, projectile, impact and hazard effects remain legible at the Performance/reduced-effects tier.
- New visuals may not move gameplay coordinates, targeting origins, collision, navigation or simulation timing.

## Baseline tasks still requiring hardware evidence

- Capture the canonical before screenshots/video on representative phone aspect ratios.
- Measure real-device frame time/FPS, draw calls, triangles, texture memory, shadow cost and JS heap where available.
- Run sustained thermal testing on at least one representative Android phone.

Those measurements should be added here rather than replacing the CI baseline above.
