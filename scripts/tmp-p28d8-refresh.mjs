import { readFile, writeFile } from 'node:fs/promises';

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`P28-D8 refresh missing ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`P28-D8 refresh found duplicate ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

const corePath = 'src/game/combatGraphicsBackendCore.ts';
let core = await readFile(corePath, 'utf8');

core = replaceOnce(
  core,
  'class BabylonCombatGraphicsBackend implements CombatGraphicsBackend {',
  `type BabylonRefineryBossPresentationHandle = {\n  sync(state: SimState, qualityMode: GraphicsQualityMode): void;\n  dispose(): void;\n};\n\nclass BabylonCombatGraphicsBackend implements CombatGraphicsBackend {`,
  'boss presentation handle insertion',
);

core = replaceOnce(
  core,
  '  private readonly backendLoadStartedAt = performance.now();\n',
  `  private readonly backendLoadStartedAt = performance.now();\n  private bossPresentation: BabylonRefineryBossPresentationHandle | null = null;\n  private bossPresentationInitialization: Promise<void> | null = null;\n`,
  'boss presentation fields insertion',
);

core = replaceOnce(
  core,
  `    if (!this.delegate) return;\n    const normalizedArgs: CombatGraphicsRenderArgs = [...args];`,
  `    if (!this.delegate) return;\n    const state = args[0];\n    const mission = args[5];\n    const bossPresentationRequested = mission.location === 'asteroid-refinery'\n      && (state.enemies.some(enemy => enemy.role === 'boss' && enemy.active)\n        || (typeof location !== 'undefined' && new URLSearchParams(location.search).get('p28d8BossQa') === '1'));\n    if (bossPresentationRequested || this.bossPresentation) {\n      if (bossPresentationRequested && !this.bossPresentation && !this.bossPresentationInitialization) {\n        const renderer = this.delegate;\n        const initialization = this.initializeBossPresentation(renderer)\n          .catch(error => {\n            if (this.disposed || this.delegate !== renderer) return;\n            this.canvas.dataset.babylonBossPresentation = 'error';\n            this.canvas.dataset.babylonBossFallbackReason = error instanceof Error ? error.message : String(error);\n            console.warn('P28-D8 refinery boss presentation initialization failed; retaining existing enemy rendering.', error);\n          })\n          .finally(() => {\n            if (this.bossPresentationInitialization === initialization) this.bossPresentationInitialization = null;\n          });\n        this.bossPresentationInitialization = initialization;\n      }\n      this.bossPresentation?.sync(state, qualityMode);\n    }\n    const normalizedArgs: CombatGraphicsRenderArgs = [...args];`,
  'boss render integration',
);

core = replaceOnce(
  core,
  `    this.disposed = true;\n    this.delegate?.dispose();`,
  `    this.disposed = true;\n    this.bossPresentation?.dispose();\n    this.bossPresentation = null;\n    this.bossPresentationInitialization = null;\n    this.delegate?.dispose();`,
  'boss dispose integration',
);

core = replaceOnce(
  core,
  `    const failedRenderer = this.delegate;\n    this.delegate = null;`,
  `    this.bossPresentation?.dispose();\n    this.bossPresentation = null;\n    this.bossPresentationInitialization = null;\n    const failedRenderer = this.delegate;\n    this.delegate = null;`,
  'boss WebGPU fallback cleanup',
);

core = replaceOnce(
  core,
  '  private async initialize() {\n',
  `  private async initializeBossPresentation(renderer: CombatGraphicsBackend) {\n    const { BabylonRefineryBossPresentation } = await import('./babylonRefineryBossPresentation');\n    if (this.disposed || this.delegate !== renderer) return;\n    const scene = (renderer as CombatGraphicsBackend & {\n      scene?: ConstructorParameters<typeof BabylonRefineryBossPresentation>[0];\n    }).scene;\n    if (!scene || scene.isDisposed) throw new Error('Babylon refinery boss presentation requires the exact active renderer scene.');\n    this.bossPresentation = new BabylonRefineryBossPresentation(scene, this.canvas);\n  }\n\n  private async initialize() {\n`,
  'boss initializer method',
);

await writeFile(corePath, core);

const testPath = 'tests/graphics-asset-pipeline.ts';
let test = await readFile(testPath, 'utf8');
test = replaceOnce(
  test,
  `const backendSource=readFileSync(resolve(process.cwd(),'src/game/combatGraphicsBackend.ts'),'utf8');\n`,
  `const backendCoreSource=readFileSync(resolve(process.cwd(),'src/game/combatGraphicsBackendCore.ts'),'utf8');\nconst backendFacadeSource=readFileSync(resolve(process.cwd(),'src/game/combatGraphicsBackend.ts'),'utf8');\n`,
  'backend source split assertion setup',
);
test = replaceOnce(
  test,
  `assert(backendSource.includes("state.enemies.some(enemy => enemy.role === 'boss' && enemy.active)") && backendSource.includes("import('./babylonRefineryBossPresentation')") && backendSource.includes('this.bossPresentation?.sync(state, qualityMode)'),'Babylon backend must lazily attach and synchronize the refinery boss presentation only when a real boss or explicit D8 QA preview needs it');\nassert(backendSource.includes("renderer as unknown as { scene?: Scene }") && !backendSource.includes('EngineStore.LastCreatedScene'),'Refinery boss presentation must bind to the exact renderer scene and never a global Babylon scene');\n`,
  `assert(backendCoreSource.includes("state.enemies.some(enemy => enemy.role === 'boss' && enemy.active)") && backendCoreSource.includes("import('./babylonRefineryBossPresentation')") && backendCoreSource.includes('this.bossPresentation?.sync(state, qualityMode)'),'Babylon backend core must lazily attach and synchronize the refinery boss presentation only when a real refinery boss or explicit D8 QA preview needs it');\nassert(backendCoreSource.includes("scene?: ConstructorParameters<typeof BabylonRefineryBossPresentation>[0]") && !backendCoreSource.includes('EngineStore.LastCreatedScene'),'Refinery boss presentation must bind to the exact renderer scene and never a global Babylon scene');\nassert(!backendFacadeSource.includes('babylonRefineryBossPresentation') && !backendFacadeSource.includes('@babylonjs/'),'Public combat graphics facade must preserve the AO-6 backend-core boundary');\n`,
  'backend integration assertions',
);
await writeFile(testPath, test);

console.log('P28_D8_REFRESH_PASS backend-core=true facade-preserved=true');
