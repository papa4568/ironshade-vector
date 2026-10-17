import { readFile, writeFile } from 'node:fs/promises';

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${label}: expected source block was not found`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${label}: source block is not unique`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

const roadmapPath = 'docs/content-roadmap.md';
const archivePath = 'docs/content-roadmap-archive.md';
const metadataPath = 'agent/roadmap-metadata.json';

const roadmap = await readFile(roadmapPath, 'utf8');
const d8Block = `#### D. Hero operators and enemy presentation\n\n- [ ] **P28-D8 — Ship refinery boss LOD0** — Add a boss-quality LOD0 with stronger phase-readable hard-surface detail and emissive anchors while keeping boss mechanics and cue timing unchanged. **Done when:** Flagship uses the boss LOD0, phase cues align with the authored model, visual quality is materially above the current asset, and standard build/APK gates pass.\n\n`;
if (roadmap.includes('**P28-D8 — Ship refinery boss LOD0**') && !roadmap.includes(d8Block)) {
  throw new Error('active roadmap P28-D8 text drifted from the verified implementation candidate');
}
const nextRoadmap = replaceOnce(roadmap, d8Block, '', 'active roadmap closeout');
if (!nextRoadmap.includes('- [ ] **P28-E1 — Add a shared flagship ambient-particle system**')) {
  throw new Error('P28-E1 is not the next active executable item after D8');
}
await writeFile(roadmapPath, nextRoadmap, 'utf8');

const archive = await readFile(archivePath, 'utf8');
if (archive.includes('**P28-D8 — Ship refinery boss LOD0**')) {
  throw new Error('P28-D8 is already present in the completed roadmap archive');
}
const archiveMarker = '## P28 — Babylon flagship visual-quality overhaul\n\n';
const archiveEntry = `- [x] **P28-D8 — Ship refinery boss LOD0** — Completed 2026-10-17 with a deterministic premium refinery boss LOD0, presentation-only Babylon integration, and phase-readable authored hard-surface/emissive anchors driven by the existing \`enemyBossAnimation\` timing.\n  - \`scripts/prepare-refinery-boss-lod0.mjs\` deterministically produces \`bosses/enemy-boss-lod0.glb\` (117,476 bytes) with a materially richer node/payload budget than LOD1, premium PBR suit/armor/equipment/emissive materials, embedded texture maps, shared articulated rig/socket nodes, and four geometric, hue-independent phase anchors. \`tests/refinery-boss-lod0.mjs\` locks generator equality, production markers, LOD continuity, node/material/texture contracts, and phase-duration/rise/telegraph alignment with \`enemyBossAnimation\`.\n  - \`BabylonRefineryBossPresentation\` mounts on the exact active renderer scene, consumes simulation-owned boss state read-only, retains runtime LOD1/LOD2 recovery, and selects LOD0 at Flagship detail. The deterministic QA-only asset lock keeps the boss visual proof at LOD0 under hosted GPU pressure without changing production adaptive behavior. P28 Image Grade Visual run \`39049487678\` passed with \`BROWSER_P28D8_BOSS_PASS hostTier=high qaQuality=flagship-asset-lock asset=enemy-boss-lod0 rig=articulated+phase-anchors phase=qa-preview:phase-2 timing=enemyBossAnimation:unchanged detail=1.00\` and a 146,662-byte capture; visual evidence artifact \`12107127781\` has digest \`sha256:74fb845378835eabada939a9e138aa1576c3e0c56e0ecd7bc4cea4aa5bcc9fc6\`. The visual proof is a deterministic QA preview rather than a live boss fight; production boss mechanics and cue timing remain simulation-owned.\n  - Exact implementation head \`b617fbbb2128342941478aef22444a0e7c3f599c\` on PR #338 passed PR Candidate Verification run \`39049487651\`, including authoritative full repository verification/production build, desktop and mobile-landscape browser journeys, Android APK build/delivery, API 35 product smoke, Android 16/API 36 large-screen smoke, aggregate Android verification, architecture invariants, and complete exact-candidate evidence. The initial API 36 post-resize CDP timeout passed on a same-SHA retry without product or harness changes, confirming transient emulator/CDP noise. Trusted independent review run \`39055343727\` passed the exact SHA (comment \`6237993492\`) with one minor non-blocking observation and no major/blocking findings.\n  - Candidate web artifact \`ironshade-vector-pr-candidate-web-b617fbbb2128342941478aef22444a0e7c3f599c\` is \`12107261935\` (digest \`sha256:166fab6349898b79386466ea4ab84fa6039b38d47c7180f58e7d5826cd61bdc4\`). Browser evidence artifacts are desktop \`12107536195\` (digest \`sha256:745b918cd03b647449b17a1f9292b4c8ada174ca60a2eb69358966bef3c49671\`) and mobile-landscape \`12107931001\` (digest \`sha256:9f60ed378b9403c165493d39f9a85d5199acafe725def9dc4d7effd343482786\`). Complete candidate evidence artifact \`12109441799\` has digest \`sha256:90f41d6605cdcd0fdc34c4545e215fffa215d24d4c90df8c5d825543fd07c2ad\`.\n  - Verified implementation APK artifact \`ironshade-vector-pr-android-apk\` is \`12107760451\` (artifact digest \`sha256:5617954b6558c7099fd68373af83f3ac30731cc9925442cb51e36857f8418547\`). API 35 evidence artifact \`12107651563\` has digest \`sha256:02b7308c923ceed07b976ad84dc06d6a9bc3c2d6258dde7b65ed88a90178e200\`; successful API 36 evidence artifact \`12108603648\` has digest \`sha256:27339d663276ce71e1e2346b50dac3d2f475a8fe0d2a04f5d4c9ae9103ee94f1\`. The final closeout head reruns the repository exact-candidate gates before merge.\n  - **Next: P28-E1 — Add a shared flagship ambient-particle system.**\n\n`;
const nextArchive = replaceOnce(archive, archiveMarker, archiveMarker + archiveEntry, 'completed roadmap archive insertion');
await writeFile(archivePath, nextArchive, 'utf8');

const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
if (!Array.isArray(metadata.roadmapIds) || metadata.roadmapIds[0] !== 'P28-D8') {
  throw new Error(`roadmap metadata expected P28-D8 first, got ${JSON.stringify(metadata.roadmapIds?.slice?.(0, 3))}`);
}
metadata.roadmapIds = metadata.roadmapIds.slice(1);
if (metadata.roadmapIds[0] !== 'P28-E1') throw new Error('roadmap metadata did not advance to P28-E1');
await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

console.log('P28_D8_CLOSEOUT_READY next=P28-E1 roadmap=removed archive=inserted metadata=advanced');
