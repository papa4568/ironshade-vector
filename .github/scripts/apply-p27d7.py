from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one occurrence, found {count}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


backend = "src/game/combatGraphicsBackend.ts"
replace_once(
    backend,
    "export const productionCombatGraphicsBackendId: CombatGraphicsBackendId = 'webgl2';",
    "export const productionCombatGraphicsBackendId: CombatGraphicsBackendId = 'babylon';",
)
replace_once(
    backend,
    "    babylonBackendRequested: null,\n  };\n}",
    "    babylonBackendRequested: 'webgl2',\n  };\n}",
)
replace_once(
    backend,
    "  if (selected) return selected;\n  if (selectedId !== productionCombatGraphicsBackendId) {\n    return factories.find(factory => factory.id === productionCombatGraphicsBackendId && factory.isSupported()) ?? null;\n  }",
    "  if (selected) return selected;\n  // Keep the legacy P21 WebGPU comparison fallback pinned to Three WebGL2 for the\n  // P27-D7 verification cycle. D8 retires both legacy Three paths after cutover.\n  if (selectedId === 'webgpu') {\n    return factories.find(factory => factory.id === 'webgl2' && factory.isSupported()) ?? null;\n  }\n  if (selectedId !== productionCombatGraphicsBackendId) {\n    return factories.find(factory => factory.id === productionCombatGraphicsBackendId && factory.isSupported()) ?? null;\n  }",
)

boundary_test = "tests/graphics-backend-boundary.ts"
replace_once(
    boundary_test,
    "assert(productionCombatGraphicsBackendId === 'webgl2', 'P21-A1 production graphics backend must remain WebGL2.');",
    "assert(productionCombatGraphicsBackendId === 'babylon', 'P27-D7 production graphics backend must be Babylon.');",
)
replace_once(
    boundary_test,
    "productionPath.mode === 'production-default' && productionPath.requestedId === null && productionPath.selectedId === 'webgl2'",
    "productionPath.mode === 'production-default' && productionPath.requestedId === null && productionPath.selectedId === 'babylon'",
)
replace_once(
    boundary_test,
    "productionPath.babylonBackendRequested === null,\n  'P27-D1 production selection must not request Babylon WebGPU.',",
    "productionPath.babylonBackendRequested === 'webgl2',\n  'P27-D7 production selection must deterministically request Babylon WebGL2.',",
)
replace_once(
    boundary_test,
    "unknownPath.mode === 'production-default' && unknownPath.requestedId === null && unknownPath.selectedId === 'webgl2',\n  'P21-A2 unknown comparison paths must fall back to the production WebGL2 selection instead of changing runtime behavior.',",
    "unknownPath.mode === 'production-default' && unknownPath.requestedId === null && unknownPath.selectedId === 'babylon',\n  'P27-D7 unknown comparison paths must fall back to the production Babylon selection instead of changing runtime behavior.',",
)
replace_once(
    boundary_test,
    "selectCombatGraphicsBackendFactory([unsupportedFactory, supportedFactory]) === supportedFactory,\n  'P21-A1 backend selection must choose the first supported production WebGL2 factory.',",
    "selectCombatGraphicsBackendFactory([unsupportedFactory, supportedFactory], explicitPath.selectedId) === supportedFactory,\n  'P27-D7 explicit Three rollback selection must choose the supported WebGL2 factory.',",
)
replace_once(
    boundary_test,
    "createCombatGraphicsBackend({} as HTMLCanvasElement, false, [unsupportedFactory]) === null,\n  'P21-A1 backend creation must preserve the Canvas 2D fallback when WebGL2 is unsupported.',",
    "createCombatGraphicsBackend({} as HTMLCanvasElement, false, [unsupportedFactory], explicitPath.selectedId) === null,\n  'P27-D7 explicit Three rollback must preserve the Canvas 2D fallback when WebGL2 is unsupported.',",
)
replace_once(
    boundary_test,
    "createCombatGraphicsBackend({} as HTMLCanvasElement, false, [unsupportedFactory, supportedFactory]) === fakeBackend && createCount === 1,\n  'P21-A1 backend creation must instantiate the selected renderer exactly once.',",
    "createCombatGraphicsBackend({} as HTMLCanvasElement, false, [unsupportedFactory, supportedFactory], explicitPath.selectedId) === fakeBackend && createCount === 1,\n  'P27-D7 explicit Three rollback must instantiate the selected renderer exactly once.',",
)
marker = "const supportedBabylonFactory = {\n  id: 'babylon',\n  isSupported: () => true,\n  create: (_canvas, _coarse, options) => {\n    capturedBabylonBackend = options?.babylonBackend ?? null;\n    return fakeBabylonBackend;\n  },\n} as CombatGraphicsBackendFactory;\n"
insertion = marker + "\nassert(\n  selectCombatGraphicsBackendFactory([supportedFactory, supportedBabylonFactory]) === supportedBabylonFactory,\n  'P27-D7 default backend selection must choose Babylon in production.',\n);\nassert(\n  createCombatGraphicsBackend(\n    {} as HTMLCanvasElement,\n    false,\n    [supportedFactory, supportedBabylonFactory],\n    productionPath.selectedId,\n    { babylonBackend: productionPath.babylonBackendRequested ?? undefined },\n  ) === fakeBabylonBackend && capturedBabylonBackend === 'webgl2',\n  'P27-D7 production creation must select Babylon WebGL2 without QA flags.',\n);\n"
replace_once(boundary_test, marker, insertion)
replace_once(
    boundary_test,
    "selectCombatGraphicsBackendFactory([supportedFactory, unsupportedBabylonFactory], babylonPath.selectedId) === supportedFactory,\n  'P27-A2 unsupported Babylon must fall back to the supported production WebGL2 factory.',",
    "selectCombatGraphicsBackendFactory([supportedFactory, unsupportedBabylonFactory], babylonPath.selectedId) === null,\n  'P27-D7 unsupported production Babylon must not silently cross into the Three rollback renderer.',",
)
replace_once(
    boundary_test,
    "createCombatGraphicsBackend({} as HTMLCanvasElement, false, [supportedFactory, unsupportedBabylonFactory], babylonPath.selectedId) === fakeBackend,\n  'P27-A2 Babylon creation must preserve safe production WebGL2 fallback when unavailable.',",
    "createCombatGraphicsBackend({} as HTMLCanvasElement, false, [supportedFactory, unsupportedBabylonFactory], babylonPath.selectedId) === null,\n  'P27-D7 unavailable production Babylon must fail closed instead of silently selecting Three.',",
)
replace_once(
    boundary_test,
    "boundarySource.includes(\"productionCombatGraphicsBackendId: CombatGraphicsBackendId = 'webgl2'\")",
    "boundarySource.includes(\"productionCombatGraphicsBackendId: CombatGraphicsBackendId = 'babylon'\")",
)
replace_once(
    boundary_test,
    "androidSmokeSource.includes('ANDROID_P21A2_GRAPHICS_PATH_PASS selection=production-default requested=none loaded=webgl2')\n    && androidSmokeSource.includes(\"p21a2GraphicsPath.selection !== 'production-default'\")\n    && androidSmokeSource.includes(\"p21a2GraphicsPath.loaded !== 'webgl2'\"),\n  'P21-A2 Android smoke must verify that production still loads WebGL2 without the QA selector.',",
    "androidSmokeSource.includes('ANDROID_P27D7_PRODUCTION_BABYLON_PASS selection=production-default requested=none loaded=babylon backend=webgl2')\n    && androidSmokeSource.includes(\"p21a2GraphicsPath.selection !== 'production-default'\")\n    && androidSmokeSource.includes(\"p21a2GraphicsPath.loaded !== 'babylon'\"),\n  'P27-D7 Android smoke must verify that production loads Babylon WebGL2 without a QA selector.',",
)
replace_once(
    boundary_test,
    "console.log('P21_A1_GRAPHICS_BACKEND_PASS default=webgl2 create=boundary render=delegated resize=preserved pointer=preserved dispose=preserved fallback=canvas2d');",
    "console.log('P21_A1_GRAPHICS_BACKEND_PASS rollback=webgl2 create=boundary render=delegated resize=preserved pointer=preserved dispose=preserved fallback=canvas2d');\nconsole.log('P27_D7_PRODUCTION_CUTOVER_PASS production=babylon backend=webgl2 rollback=webgl2 selector=graphicsCompare+graphicsPath');",
)

android = "scripts/android-runtime-smoke.mjs"
replace_once(
    android,
    "      tier: document.querySelector('canvas')?.dataset.renderTier ?? '',\n      quality: document.querySelector('canvas')?.dataset.graphicsQuality ?? '',",
    "      graphicsLoaded: document.querySelector('canvas')?.dataset.graphicsPathLoaded ?? '',\n      babylonInit: document.querySelector('canvas')?.dataset.babylonInit ?? '',\n      babylonBackend: document.querySelector('canvas')?.dataset.babylonBackendLoaded ?? document.querySelector('canvas')?.dataset.babylonBackend ?? '',\n      tier: document.querySelector('canvas')?.dataset.renderTier ?? '',\n      quality: document.querySelector('canvas')?.dataset.graphicsQuality ?? '',",
)
replace_once(
    android,
    "  const resumedP21Budget = parseP21EffectBudget(fastResumed.p21Budget);",
    "  if (fastResumed.graphicsLoaded === 'babylon') {\n    if (fastResumed.babylonInit !== 'ready' || fastResumed.babylonBackend !== 'webgl2'\n      || fastResumed.tier !== 'performance' || fastResumed.quality !== 'performance') {\n      throw new Error(`Fast Android P27-D7 Babylon production resume is invalid: ${JSON.stringify(fastResumed)}`);\n    }\n    console.log(`ANDROID_P27D7_BABYLON_RESUME_PASS loaded=${fastResumed.graphicsLoaded} backend=${fastResumed.babylonBackend} tier=${fastResumed.tier}`);\n    console.log(`ANDROID_FAST_LIFECYCLE_RESUME_PASS canvases=${fastResumed.canvases} tutorialStep=${fastResumed.tutorialStep} location=${JSON.stringify(fastResumed.location)}`);\n    session.close();\n    await sleep(100);\n    process.exit(0);\n  }\n  const resumedP21Budget = parseP21EffectBudget(fastResumed.p21Budget);",
)
replace_once(
    android,
    "  const p21a2GraphicsPath = await evaluate(`(() => {\n    const canvas = document.querySelector('canvas');",
    "  await waitFor(`(() => {\n    const canvas = document.querySelector('canvas');\n    return canvas?.dataset.graphicsPathSelection === 'production-default'\n      && canvas?.dataset.graphicsPathLoaded === 'babylon'\n      && canvas?.dataset.babylonInit === 'ready'\n      && (canvas?.dataset.babylonBackendLoaded ?? canvas?.dataset.babylonBackend) === 'webgl2';\n  })()`, 'P27-D7 production Babylon WebGL2 path', 45_000);\n\n  const p21a2GraphicsPath = await evaluate(`(() => {\n    const canvas = document.querySelector('canvas');",
)
replace_once(
    android,
    "      loaded: canvas.dataset.graphicsPathLoaded ?? '',\n    };\n  })()`);\n  if (!p21a2GraphicsPath\n    || p21a2GraphicsPath.selection !== 'production-default'\n    || p21a2GraphicsPath.requested !== ''\n    || p21a2GraphicsPath.loaded !== 'webgl2') {\n    throw new Error(`Android P21-A2 production graphics path changed unexpectedly: ${JSON.stringify(p21a2GraphicsPath)}`);\n  }\n  console.log('ANDROID_P21A2_GRAPHICS_PATH_PASS selection=production-default requested=none loaded=webgl2');\n\n  await waitFor(`(() => {",
    "      loaded: canvas.dataset.graphicsPathLoaded ?? '',\n      babylonInit: canvas.dataset.babylonInit ?? '',\n      babylonBackend: canvas.dataset.babylonBackendLoaded ?? canvas.dataset.babylonBackend ?? '',\n    };\n  })()`);\n  if (!p21a2GraphicsPath\n    || p21a2GraphicsPath.selection !== 'production-default'\n    || p21a2GraphicsPath.requested !== ''\n    || p21a2GraphicsPath.loaded !== 'babylon'\n    || p21a2GraphicsPath.babylonInit !== 'ready'\n    || p21a2GraphicsPath.babylonBackend !== 'webgl2') {\n    throw new Error(`Android P27-D7 production graphics path is invalid: ${JSON.stringify(p21a2GraphicsPath)}`);\n  }\n  console.log('ANDROID_P27D7_PRODUCTION_BABYLON_PASS selection=production-default requested=none loaded=babylon backend=webgl2');\n\n  if (p21a2GraphicsPath.loaded === 'webgl2') {\n  await waitFor(`(() => {",
)
replace_once(
    android,
    "  const p22b1Geometry = await evaluate(`(() => {",
    "  }\n\n  const p22b1Geometry = await evaluate(`(() => {",
)
