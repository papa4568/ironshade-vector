import { readFile, writeFile } from 'node:fs/promises';

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`P28-D8 phase telemetry fix missing ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`P28-D8 phase telemetry fix found duplicate ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

const presentationPath = 'src/game/babylonRefineryBossPresentation.ts';
let presentation = await readFile(presentationPath, 'utf8');
const cueWrites = (presentation.match(/babylonBossPhaseCue/g) ?? []).length;
if (cueWrites !== 4) throw new Error(`Expected exactly 4 D8 boss phase cue references, found ${cueWrites}`);
presentation = presentation.replaceAll('babylonBossPhaseCue', 'babylonBossPresentationPhaseCue');
await writeFile(presentationPath, presentation);

const capturePath = 'scripts/p28d8-boss-capture.mjs';
let capture = await readFile(capturePath, 'utf8');
capture = replaceOnce(
  capture,
  `    bossPhaseCue: canvas.dataset.babylonBossPhaseCue ?? '',\n`,
  `    bossPresentationPhaseCue: canvas.dataset.babylonBossPresentationPhaseCue ?? '',\n    bossTelegraphPhaseCue: canvas.dataset.babylonBossPhaseCue ?? '',\n`,
  'capture phase telemetry fields',
);
capture = capture.replaceAll("boss.bossPhaseCue === 'qa-preview:phase-2'", "boss.bossPresentationPhaseCue === 'qa-preview:phase-2'");
capture = capture.replaceAll("boss.bossPhaseCue !== 'qa-preview:phase-2'", "boss.bossPresentationPhaseCue !== 'qa-preview:phase-2'");
capture = capture.replaceAll('phase=${boss.bossPhaseCue}', 'phase=${boss.bossPresentationPhaseCue}');
await writeFile(capturePath, capture);

const testPath = 'tests/refinery-boss-lod0.mjs';
let test = await readFile(testPath, 'utf8');
test = replaceOnce(
  test,
  `assert(presentationSource.includes("babylonBossQaQuality = this.qaPreview ? 'flagship-asset-lock' : 'runtime-adaptive'"), 'D8 visual QA must expose the QA-only flagship asset lock separately from production adaptive recovery');\n`,
  `assert(presentationSource.includes("babylonBossQaQuality = this.qaPreview ? 'flagship-asset-lock' : 'runtime-adaptive'"), 'D8 visual QA must expose the QA-only flagship asset lock separately from production adaptive recovery');\nassert(presentationSource.includes('babylonBossPresentationPhaseCue'), 'D8 boss model phase telemetry must use a presentation-owned channel');\nassert(!presentationSource.includes('dataset.babylonBossPhaseCue'), 'D8 boss presentation must not overwrite the canonical simulation-owned telegraph phase channel');\n`,
  'presentation telemetry ownership regression',
);
await writeFile(testPath, test);

console.log('P28_D8_PHASE_TELEMETRY_FIX_PASS canonical=telegraphs presentation=model');
