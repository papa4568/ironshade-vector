import { readFile, writeFile } from 'node:fs/promises';

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`P28-D8 QA fix missing ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`P28-D8 QA fix found duplicate ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

const presentationPath = 'src/game/babylonRefineryBossPresentation.ts';
let presentation = await readFile(presentationPath, 'utf8');
presentation = replaceOnce(
  presentation,
  `export function refineryBossQaPreviewEnabled(search: string) {\n`,
  `export function refineryBossPresentationDetailScale(\n  qualityMode: GraphicsQualityMode,\n  runtimeTier: RefineryBossPresentationTier,\n  qaPreview: boolean,\n) {\n  return qaPreview ? 1 : refineryBossDetailScale(qualityMode, runtimeTier);\n}\n\nexport function refineryBossQaPreviewEnabled(search: string) {\n`,
  'QA detail-scale helper insertion',
);
presentation = replaceOnce(
  presentation,
  `    this.canvas.dataset.babylonBossQaPreview = this.qaPreview ? 'enabled' : 'disabled';\n`,
  `    this.canvas.dataset.babylonBossQaPreview = this.qaPreview ? 'enabled' : 'disabled';\n    this.canvas.dataset.babylonBossQaQuality = this.qaPreview ? 'flagship-asset-lock' : 'runtime-adaptive';\n`,
  'QA quality telemetry insertion',
);
presentation = replaceOnce(
  presentation,
  `    const detailScale = refineryBossDetailScale(qualityMode, runtimeTier);\n`,
  `    const detailScale = refineryBossPresentationDetailScale(qualityMode, runtimeTier, this.qaPreview);\n`,
  'QA detail-scale selection',
);
await writeFile(presentationPath, presentation);

const capturePath = 'scripts/p28d8-boss-capture.mjs';
let capture = await readFile(capturePath, 'utf8');
capture = replaceOnce(
  capture,
  `    bossQaPreview: canvas.dataset.babylonBossQaPreview ?? '',\n`,
  `    bossQaPreview: canvas.dataset.babylonBossQaPreview ?? '',\n    bossQaQuality: canvas.dataset.babylonBossQaQuality ?? '',\n`,
  'capture QA quality telemetry',
);
capture = replaceOnce(
  capture,
  `    return canvas?.dataset.renderTier === 'high'\n      && canvas?.dataset.babylonBossQaPreview === 'enabled'\n`,
  `    return canvas?.dataset.babylonBossQaPreview === 'enabled'\n      && canvas?.dataset.babylonBossQaQuality === 'flagship-asset-lock'\n`,
  'capture tier-independent QA wait',
);
capture = replaceOnce(
  capture,
  `  if (!boss\n    || boss.tier !== 'high'\n    || !boss.qualityInput.includes('effective:1.00')\n`,
  `  if (!boss\n    || !['high', 'balanced', 'performance'].includes(boss.tier)\n    || !boss.qualityInput.includes('effective:1.00')\n`,
  'capture host tier validation',
);
capture = replaceOnce(
  capture,
  `    || boss.bossQaPreview !== 'enabled'\n    || boss.bossPhaseCue !== 'qa-preview:phase-2'\n`,
  `    || boss.bossQaPreview !== 'enabled'\n    || boss.bossQaQuality !== 'flagship-asset-lock'\n    || boss.bossPhaseCue !== 'qa-preview:phase-2'\n`,
  'capture QA quality assertion',
);
capture = replaceOnce(
  capture,
  `    visualDetail: 'p28-d8-refinery-boss-lod0',\n    boss,\n`,
  `    visualDetail: 'p28-d8-refinery-boss-lod0',\n    captureMode: 'flagship-boss-asset-lock-with-host-adaptive-tier',\n    boss,\n`,
  'capture mode reporting',
);
capture = replaceOnce(
  capture,
  `  console.log(\`BROWSER_P28D8_BOSS_PASS tier=${'${'}boss.tier} asset=${'${'}boss.bossAsset} rig=${'${'}boss.bossRig} phase=${'${'}boss.bossPhaseCue} timing=${'${'}boss.bossCueTiming} detail=${'${'}boss.bossDetailScale} screenshot=${'${'}screenshotPath} bytes=${'${'}png.length}\`);\n`,
  `  console.log(\`BROWSER_P28D8_BOSS_PASS hostTier=${'${'}boss.tier} qaQuality=${'${'}boss.bossQaQuality} asset=${'${'}boss.bossAsset} rig=${'${'}boss.bossRig} phase=${'${'}boss.bossPhaseCue} timing=${'${'}boss.bossCueTiming} detail=${'${'}boss.bossDetailScale} screenshot=${'${'}screenshotPath} bytes=${'${'}png.length}\`);\n`,
  'capture console reporting',
);
await writeFile(capturePath, capture);

const testPath = 'tests/refinery-boss-lod0.mjs';
let test = await readFile(testPath, 'utf8');
test = replaceOnce(
  test,
  `const animationSource = await readFile(resolve(process.cwd(), 'src/game/enemyBossAnimation.ts'), 'utf8');\n`,
  `const presentationSource = await readFile(resolve(process.cwd(), 'src/game/babylonRefineryBossPresentation.ts'), 'utf8');\nassert(presentationSource.includes('return qaPreview ? 1 : refineryBossDetailScale(qualityMode, runtimeTier);'), 'D8 visual QA must lock only the boss presentation asset to Flagship detail while production remains runtime-adaptive');\nassert(presentationSource.includes("babylonBossQaQuality = this.qaPreview ? 'flagship-asset-lock' : 'runtime-adaptive'"), 'D8 visual QA must expose the QA-only flagship asset lock separately from production adaptive recovery');\n\nconst animationSource = await readFile(resolve(process.cwd(), 'src/game/enemyBossAnimation.ts'), 'utf8');\n`,
  'QA lock regression assertions',
);
await writeFile(testPath, test);

console.log('P28_D8_QA_PREVIEW_FIX_PASS bossQa=flagship-asset-lock production=runtime-adaptive host-tier=reported');
