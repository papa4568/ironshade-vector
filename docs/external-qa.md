# Ironshade Vector — External QA

This file tracks validation that cannot be completed by the normal repository/tool execution environment because it requires physical hardware, manual visual inspection, credentials, permissions, or another external dependency.

Do not select work from this file as the normal coding queue. External QA can block release acceptance, but it does not block later independent engineering work unless an explicit dependency says otherwise.

If an external validation run reveals an actionable engineering defect, add a focused unchecked item to `docs/content-roadmap.md` rather than turning the validation entry itself into an open-ended coding task.

## Pending

### P28-P2 — Validate representative route FPS and thermal behavior on target phone hardware

**Status:** WAITING_FOR_HARDWARE  
**Depends on:** completed P28-P2 repository frame-cost telemetry and recovery regression coverage  
**Does not block:** later independent P28 implementation work

Run the same deterministic Deep Salvage/refinery and representative campaign-route moments on a current high-performance Android phone while recording the P28-P2 location cost signature alongside physical frame-pacing and thermal measurements. Repository, browser, CI, emulator, and hosted Android timing is diagnostic evidence only and must not be reported as physical target-phone FPS.

**Accept when:**
- sustained physical target-phone FPS and frame pacing are measured on the shipped Flagship path for the representative route set;
- thermal behavior remains acceptable through sustained combat rather than only a cold-start capture;
- the location cost signature provides enough render-resolution, geometry, effect, asset-instance, and tier-transition context to explain any measured hotspot or downgrade;
- any future quality reduction is justified by measured phone evidence rather than by emulator or CI timing alone.

### P28-A4 — Validate upgraded refinery key-light shadows on target phone hardware

**Status:** WAITING_FOR_HARDWARE  
**Depends on:** implemented P28-A4 shadow/QA harness  
**Does not block:** P28-A5 or later independent P28 implementation work

Run `scripts/android-p28a4-shadow-qa.sh` on a current high-performance Android phone and inspect the generated waypoint evidence.

**Accept when:**
- the physical-device run remains High with 2048 high-PCF shadows across multiple snapped anchor regions;
- captures show soft, stable contacts with no obvious acne, peter-panning, missing important casters, or large-map swimming;
- the closing candidate still passes the standard build/APK gates.

### P28-C9 — Measure repeated-geometry consolidation on target phone hardware

**Status:** WAITING_FOR_HARDWARE  
**Depends on:** completed P28-C9 implementation

Record target-phone telemetry for the finalized shared-runtime/native-instancing strategy and confirm that resource reuse improves or preserves runtime behavior without reducing visible quality.

### P28-E4 — Measure refinery reflection probes on target phone hardware

**Status:** WAITING_FOR_IMPLEMENTATION  
**Depends on:** P28-E4 implementation

Measure the finalized reflection-probe configuration on a target high-performance phone and confirm that the visual improvement does not introduce unacceptable frame pacing, resource churn, or thermal behavior.

### P28-H1 — Representative Flagship visual acceptance on physical phones

**Status:** WAITING_FOR_IMPLEMENTATION  
**Depends on:** representative P28 visual rollout being complete

Capture the same deterministic representative combat moments for the refinery plus at least one campaign route and one capstone route on real high-performance Android phones, with screenshots and frame/resource telemetry.

**Accept when:** the shipped Flagship path consistently presents the intended P28 lighting/material/geometry/effects stack, authored assets are intact, and touch/controller combat remains readable and responsive.

### P28-H2 — Sustained Flagship stability on physical phones

**Status:** WAITING_FOR_IMPLEMENTATION  
**Depends on:** P28-H1 and the completed P28 visual stack

Run sustained combat, lifecycle, renderer re-entry, and thermal/resource testing on the target high-performance phone class.

**Accept when:** sustained play is stable, renderer recreation and cache ownership remain correct, touch/controller behavior remains reliable, and any quality reduction is justified by measured target-device evidence rather than precautionary global caps.
