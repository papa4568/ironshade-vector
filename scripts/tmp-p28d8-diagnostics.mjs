import { readFile, writeFile } from 'node:fs/promises';

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`P28-D8 diagnostics missing ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`P28-D8 diagnostics duplicate ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

const path = 'scripts/p28d8-boss-capture.mjs';
let source = await readFile(path, 'utf8');
source = replaceOnce(
  source,
  `  return {\n    tier: canvas.dataset.renderTier ?? '',\n`,
  `  return {\n    href: location.href,\n    search: location.search,\n    babylonInit: canvas.dataset.babylonInit ?? '',\n    backendLoaded: canvas.dataset.babylonBackendLoaded ?? '',\n    bossRequest: canvas.dataset.babylonBossRequest ?? '',\n    bossFallbackReason: canvas.dataset.babylonBossFallbackReason ?? '',\n    tier: canvas.dataset.renderTier ?? '',\n`,
  'state diagnostics fields',
);
source = replaceOnce(
  source,
  `  await waitFor(\`(() => {\n    const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery-babylon');\n    return canvas?.dataset.babylonBossQaPreview === 'enabled'\n      && canvas?.dataset.babylonBossQaQuality === 'flagship-asset-lock'\n      && canvas?.dataset.babylonBossPresentation === 'authored:enemy-boss-lod0'\n      && canvas?.dataset.babylonBossAsset === 'enemy-boss-lod0'\n      && canvas?.dataset.babylonBossRig === 'articulated+phase-anchors'\n      && canvas?.dataset.babylonBossPhaseCue === 'qa-preview:phase-2'\n      && canvas?.dataset.babylonBossCueTiming === 'enemyBossAnimation:unchanged'\n      && canvas?.dataset.babylonBossDetailScale === '1.00';\n  })()\`, 'authored Flagship refinery boss LOD0 preview', 90_000);\n\n  const boss = await evaluate(readBossStateExpression);\n`,
  `  const bossDeadline = Date.now() + 90_000;\n  let boss = null;\n  while (Date.now() < bossDeadline) {\n    boss = await evaluate(readBossStateExpression);\n    if (boss\n      && boss.bossQaPreview === 'enabled'\n      && boss.bossQaQuality === 'flagship-asset-lock'\n      && boss.bossPresentation === 'authored:enemy-boss-lod0'\n      && boss.bossAsset === 'enemy-boss-lod0'\n      && boss.bossRig === 'articulated+phase-anchors'\n      && boss.bossPhaseCue === 'qa-preview:phase-2'\n      && boss.bossCueTiming === 'enemyBossAnimation:unchanged'\n      && boss.bossDetailScale === '1.00') break;\n    await sleep(100);\n  }\n  if (!boss\n    || boss.bossQaPreview !== 'enabled'\n    || boss.bossQaQuality !== 'flagship-asset-lock'\n    || boss.bossPresentation !== 'authored:enemy-boss-lod0'\n    || boss.bossAsset !== 'enemy-boss-lod0'\n    || boss.bossRig !== 'articulated+phase-anchors'\n    || boss.bossPhaseCue !== 'qa-preview:phase-2'\n    || boss.bossCueTiming !== 'enemyBossAnimation:unchanged'\n    || boss.bossDetailScale !== '1.00') {\n    throw new Error(\`Timed out waiting for authored Flagship refinery boss LOD0 preview: ${'${'}JSON.stringify(boss)}\`);\n  }\n`,
  'boss polling diagnostics',
);
await writeFile(path, source);

const corePath = 'src/game/combatGraphicsBackendCore.ts';
let core = await readFile(corePath, 'utf8');
core = replaceOnce(
  core,
  `    const bossPresentationRequested = mission.location === 'asteroid-refinery'\n      && (state.enemies.some(enemy => enemy.role === 'boss' && enemy.active)\n        || (typeof location !== 'undefined' && new URLSearchParams(location.search).get('p28d8BossQa') === '1'));\n`,
  `    const bossPresentationRequested = mission.location === 'asteroid-refinery'\n      && (state.enemies.some(enemy => enemy.role === 'boss' && enemy.active)\n        || (typeof location !== 'undefined' && new URLSearchParams(location.search).get('p28d8BossQa') === '1'));\n    this.canvas.dataset.babylonBossRequest = bossPresentationRequested\n      ? (state.enemies.some(enemy => enemy.role === 'boss' && enemy.active) ? 'active-boss' : 'qa-preview')\n      : 'inactive';\n`,
  'boss request telemetry',
);
await writeFile(corePath, core);
console.log('P28_D8_DIAGNOSTICS_PASS timeout=stateful request=telemetry');
