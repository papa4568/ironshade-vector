from pathlib import Path

ROADMAP = Path('docs/content-roadmap.md')
ARCHIVE = Path('docs/content-roadmap-archive.md')

roadmap = ROADMAP.read_text()
active_entry = "- [ ] **P28-D6 — Ship technician enemy LOD0** — Add a full-detail LOD0 for the technician family with readable tool/hardware silhouette detail. **Done when:** rig/overlay alignment, combat readability, visual improvement, and standard build/APK gates pass.\n\n"
count = roadmap.count(active_entry)
assert count == 1, f'P28-D6 active roadmap entry match count: {count}'
roadmap = roadmap.replace(active_entry, '', 1)
assert '**P28-D7 — Ship elite enemy LOD0**' in roadmap, 'P28-D7 must remain the next active task'
ROADMAP.write_text(roadmap)

archive = ARCHIVE.read_text()
anchor = '## P28 — Babylon flagship visual-quality overhaul\n\n'
assert archive.count(anchor) == 1, f'P28 archive anchor match count: {archive.count(anchor)}'
entry = """- [x] **P28-D6 — Ship technician enemy LOD0** — Completed 2026-10-08 with a deterministic authored technician LOD0 that gives the support enemy a readable tool/hardware silhouette while preserving the shared enemy rig/socket contract, simulation-owned hitboxes/gameplay bounds, and combat-presentation ownership boundaries.
  - Added `enemy-technician-lod0.glb` plus `scripts/prepare-technician-enemy-lod0.mjs`; the production build generates a 117,008-byte textured metallic/roughness PBR GLB with 53 authored nodes, 592 source triangles, 1,820 instantiated mesh-node triangles, embedded base-color/normal/packed-ORM/emissive channels, and no embedded weapon.
  - Preserved `enemy-rig`, hip/torso/helmet/arm/leg/backpack transforms and `weapon-socket`; Flagship/high detail now selects `enemy-technician-lod0` while balanced/performance retain technician LOD1/LOD2 recovery. The role silhouette is geometry-led rather than hue-only: offset tool harness, sensor shoulder/scanner, elongated positive-Z field tool, external tool rack with power cells/canisters, established `technician-mast`, work light, and a clear negative-Z external weapon lane.
  - Added deterministic generation/detail/PBR/rig/socket/bounds/Babylon-loading/LOD-selection regressions plus repository-wide technician family/content validation. The initial exact candidate exposed the established `technician-mast` naming contract; the generator/test were corrected without changing the authored geometry, and the superseded failed heads are not used as completion proof.
  - Exact implementation head `8cf646c849482b0cdb4ee919d7131fd5fc5e1f0e` on PR #336 passed PR Candidate Verification run `37817307640`: the single full repository verification/production build, desktop and mobile-landscape browser journeys, APK delivery/signature checks, API 35 product smoke, Android 16/API 36 large-screen smoke, aggregate Android verification, and exact-candidate evidence all passed. Candidate artifact `ironshade-vector-pr-candidate-8cf646c849482b0cdb4ee919d7131fd5fc5e1f0e` is `11568290174` (digest `sha256:d5be605800653f130ded4db12386afb2d7d93bf02174212ccbdd783527b7f71c`); candidate evidence artifact `11568765803` records the exact implementation proof ledger.
  - Deterministic Flagship evidence is tagged `p28-d6-technician-enemy-lod0`; P28 Image Grade run `37817307582` passed with artifact `p28a5-mobile-combat-image-grade` (`11568395638`, digest `sha256:77acc29fc6720500dd65943cd90450766219c3c602172729adc5db19463f1146`). Browser evidence artifacts are desktop `11568488688` and mobile-landscape `11568718727`.
  - Verified implementation APK artifact `ironshade-vector-pr-android-apk` (`11568372261`, artifact digest `sha256:1c33bf9b1a73ebfdc7b59f1bbebfe6eaa9fdff3dbbd4ef1e8806c2fc97252424`) contains `ironshade-vector-pr-debug.apk` (10,571,099 bytes; package `app.ironshade.vector`; version `0.0.1-pr.92 (92)`; min SDK 24; target SDK 36; APK SHA-256 `58a6842940b6485687096952fd9f8d11bc0095b237c3c624c6a03d6b10995c81`; APK Signature Scheme v2 verified). API 35 artifact `11568746880` and API 36 artifact `11568734728` preserve emulator evidence for the same implementation candidate.
  - **Next: P28-D7 — Ship elite enemy LOD0.**

"""
assert 'P28-D6 — Ship technician enemy LOD0' not in archive, 'P28-D6 is already archived'
archive = archive.replace(anchor, anchor + entry, 1)
ARCHIVE.write_text(archive)
