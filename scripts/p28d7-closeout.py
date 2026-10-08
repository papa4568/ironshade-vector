from pathlib import Path
import json

roadmap = Path('docs/content-roadmap.md')
roadmap_text = roadmap.read_text()
item = "- [ ] **P28-D7 — Ship elite enemy LOD0** — Add a hero LOD0 for the elite family that reads as higher threat through silhouette/material detail before HUD labels. **Done when:** elite identity is distinguishable at gameplay zoom without hue-only dependence, lifecycle/telegraph alignment remains correct, and standard build/APK gates pass.\n\n"
assert roadmap_text.count(item) == 1, f'P28-D7 active roadmap item count={roadmap_text.count(item)}'
roadmap.write_text(roadmap_text.replace(item, '', 1))

metadata_path = Path('agent/roadmap-metadata.json')
metadata = json.loads(metadata_path.read_text())
assert metadata['roadmapIds'][0] == 'P28-D7', f"unexpected first roadmap id: {metadata['roadmapIds'][0]}"
metadata['roadmapIds'].remove('P28-D7')
assert metadata['roadmapIds'][0] == 'P28-D8'
metadata_path.write_text(json.dumps(metadata, indent=2) + '\n')

archive = Path('docs/content-roadmap-archive.md')
archive_text = archive.read_text()
marker = '## P28 — Babylon flagship visual-quality overhaul\n\n'
assert archive_text.count(marker) == 1, f'P28 archive marker count={archive_text.count(marker)}'
assert '**P28-D7 — Ship elite enemy LOD0**' not in archive_text, 'P28-D7 is already archived'
entry = '''- [x] **P28-D7 — Ship elite enemy LOD0** — Completed 2026-10-08 with a deterministic authored elite LOD0 whose command silhouette reads as higher threat through geometry/material breakup rather than hue alone, while preserving the shared enemy rig/socket contract, simulation-owned hitboxes/gameplay bounds, and combat-presentation ownership boundaries.
  - Added `enemy-elite-lod0.glb` plus `scripts/prepare-elite-enemy-lod0.mjs`; the production build generates a 99,276-byte textured metallic/roughness PBR GLB with 54 authored nodes, 1,792 source triangles, 9,780 instantiated mesh-node triangles, embedded base-color/normal/packed-ORM/emissive channels, and no embedded weapon.
  - Preserved `enemy-rig`, hip/torso/helmet/arm/leg/backpack transforms and `weapon-socket`; Flagship/high detail selects `enemy-elite-lod0` while balanced/performance retain elite LOD1/LOD2 recovery. The established elite crest and paired-fin identity now expands into a broader command cuirass, tall crest, symmetric command fins, reinforced forearms/greaves, command pack/cells/guards, temple guards, and emissive hardware anchors, with explicit hue-independent threat-readability metadata.
  - Added deterministic generation/detail/PBR/rig/socket/bounds/Babylon-loading/LOD-selection regressions and updated browser/image-grade telemetry so Flagship requires assault, suppressor, technician, and elite LOD0 together. Lifecycle, telegraph, protocol/status, hitbox, and gameplay-bounds ownership remain simulation-side/read-only from presentation.
  - Exact implementation head `e429c148df669729e7af833fc66ea96264f8aa41` on PR #337 passed PR Candidate Verification run `37830209655`: the single full repository verification/production build, desktop and mobile-landscape browser journeys, APK build/delivery/signature checks, Android 16/API 36 large-screen smoke, aggregate Android verification, and AO-5 exact-candidate evidence all passed. The first API 35 emulator attempt reached production Babylon/control/HUD validation but twice missed the existing touch-navigation ACT timing budget; the repository-supported single-job retry on a fresh runner passed the unchanged exact candidate and APK, confirming emulator timing noise rather than a D7 product regression. Candidate web artifact `ironshade-vector-pr-candidate-web-e429c148df669729e7af833fc66ea96264f8aa41` is `11573550815` (digest `sha256:13edf5382004f06b892d841e65abb087604bdc3dfef33b2e84e2aed4db127c65`); exact-candidate evidence artifact `11573344119` (digest `sha256:05d330050ad3e7fb9bdbfc926b304f35ff54e17d85cc453a79901375c256ad14`) records the proof ledger.
  - Deterministic Flagship evidence is tagged `p28-d7-elite-enemy-lod0`; P28 Image Grade Visual run `37830209318` passed with artifact `ironshade-vector-p28a5-image-grade` (`11572972816`, digest `sha256:182455414213e1d7112c67099b81a30f84fa8819ea4a13b4dba68b725151fe6c`). Browser evidence artifacts are desktop `11572909160` (digest `sha256:56838c778759b621f637dd14265bd197d8c7a96997fa34650cd460d0aed7e923`) and mobile-landscape `11572958952` (digest `sha256:11396741b4a17b28a579f44e5d1c5b5c76f8671d6529813498fd4f626ebfc1dd`).
  - Verified implementation APK artifact `ironshade-vector-pr-android-apk` (`11573666695`, artifact digest `sha256:3b51e14b71766389a2b824763f2707011d2202f9c0f0cd4e62d9a9b936cf36d9`) contains `Ironshade-Vector-Android-Debug.apk` (10,590,037 bytes; package `app.ironshade.vector`; version `0.0.1-pr.104 (104)`; min SDK 24; target SDK 36; APK SHA-256 `57af66b22e3798adf4ceee3207d815d4917f597a734d18ec32d536d4a75b05de`; APK Signature Scheme v2 verified). Passing API 35 evidence artifact `11573124330` (digest `sha256:fad15a2c9e36b7e00b2f07bf22195555471bffd0b956737d7ea089224cee5fee`) and API 36 artifact `11573157962` (digest `sha256:27999d0737e67600c050a99740c936a1714227ff515abc89de2ecab4393984a2`) preserve emulator evidence for the same implementation candidate.
  - **Next: P28-D8 — Ship refinery boss LOD0.**

'''
archive.write_text(archive_text.replace(marker, marker + entry, 1))

assert 'P28-D7' not in roadmap.read_text()
assert json.loads(metadata_path.read_text())['roadmapIds'][0] == 'P28-D8'
assert archive.read_text().count('**P28-D7 — Ship elite enemy LOD0**') == 1
