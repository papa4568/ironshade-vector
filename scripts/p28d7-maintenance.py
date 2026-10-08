from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    assert count == 1, f'{label} match count: {count}'
    file.write_text(text.replace(old, new))


replace_once(
    'scripts/prepare-premium-pbr-reference.mjs',
    "  const { writeTechnicianEnemyLod0 } = await import('./prepare-technician-enemy-lod0.mjs');\n  await writeTechnicianEnemyLod0();\n  const { writePremiumPbrSurfaceLibrary } = await import('./prepare-premium-pbr-library.mjs');",
    "  const { writeTechnicianEnemyLod0 } = await import('./prepare-technician-enemy-lod0.mjs');\n  await writeTechnicianEnemyLod0();\n  const { writeEliteEnemyLod0 } = await import('./prepare-elite-enemy-lod0.mjs');\n  await writeEliteEnemyLod0();\n  const { writePremiumPbrSurfaceLibrary } = await import('./prepare-premium-pbr-library.mjs');",
    'premium elite preparation',
)
replace_once(
    'src/game/graphicsAssetManifest.ts',
    "  elite: {\n    id: 'enemy-elite',\n    lods: {\n      1: createGraphicsAssetSpec('enemy-elite-lod1', 'enemy', '/assets/models/enemies/enemy-elite-lod1.glb', 1),",
    "  elite: {\n    id: 'enemy-elite',\n    lods: {\n      0: createGraphicsAssetSpec('enemy-elite-lod0', 'enemy', '/assets/models/enemies/enemy-elite-lod0.glb', 0),\n      1: createGraphicsAssetSpec('enemy-elite-lod1', 'enemy', '/assets/models/enemies/enemy-elite-lod1.glb', 1),",
    'elite manifest',
)
replace_once(
    'scripts/browser-runtime-smoke.mjs',
    "    (role === 'assault' || role === 'suppressor' || role === 'technician') && state.renderTier === 'high' ? 0 : expectedSharedLod,",
    "    (role === 'assault' || role === 'suppressor' || role === 'technician' || role === 'elite') && state.renderTier === 'high' ? 0 : expectedSharedLod,",
    'browser runtime elite LOD expectation',
)
replace_once(
    'tests/premium-pbr-reference.mjs',
    "import './technician-enemy-lod0.mjs';\nimport { readFile } from 'node:fs/promises';",
    "import './technician-enemy-lod0.mjs';\nimport './elite-enemy-lod0.mjs';\nimport { readFile } from 'node:fs/promises';",
    'premium elite verification import',
)
replace_once(
    'tests/graphics-asset-pipeline.ts',
    "assert(selectGraphicsAssetSpec(ENEMY_ASSET_FAMILIES.elite,1)?.id==='enemy-elite-lod1','Unpromoted elite family must retain its proven Flagship fallback until P28-D7');",
    "const eliteFamily=ENEMY_ASSET_FAMILIES.elite;\nassert(selectGraphicsAssetSpec(eliteFamily,1)?.id==='enemy-elite-lod0','Flagship detail must select the authored elite enemy LOD0 asset');\nassert(selectGraphicsAssetSpec(eliteFamily,0.78)?.id==='enemy-elite-lod1' && selectGraphicsAssetSpec(eliteFamily,0.5)?.id==='enemy-elite-lod2','Elite balanced/performance LOD selection must remain budgeted');",
    'graphics elite selection verification',
)
replace_once(
    'tests/graphics-asset-pipeline.ts',
    "console.log('GRAPHICS_ASSET_PIPELINE_PASS contract=renderer-neutral runtime=babylon codecs=local lod=adaptive cache=bounded fallbacks=preserved assault-lod0=flagship suppressor-lod0=flagship technician-lod0=flagship');",
    "console.log('GRAPHICS_ASSET_PIPELINE_PASS contract=renderer-neutral runtime=babylon codecs=local lod=adaptive cache=bounded fallbacks=preserved assault-lod0=flagship suppressor-lod0=flagship technician-lod0=flagship elite-lod0=flagship');",
    'graphics elite pass marker',
)

capture = Path('scripts/p28a5-image-grade-capture.mjs')
capture_text = capture.read_text()
replacements = [
    (
        "visualDetail: 'p28-d5-suppressor-enemy-lod0'",
        "visualDetail: 'p28-d5-suppressor-enemy-lod0'; visualDetail: 'p28-d6-technician-enemy-lod0'",
        'historical D6 visual marker',
    ),
    (
        "      && catalog.split(',').includes('enemy-technician-lod0');\n  })()`, 'normal Flagship refinery grade with technician enemy LOD0', 90_000);",
        "      && catalog.split(',').includes('enemy-technician-lod0')\n      && catalog.split(',').includes('enemy-elite-lod0');\n  })()`, 'normal Flagship refinery grade with elite enemy LOD0', 90_000);",
        'Flagship elite wait proof',
    ),
    (
        "  const expectedCatalog = 'enemy-assault-lod0,enemy-suppressor-lod0,enemy-technician-lod0,enemy-elite-lod1';",
        "  const expectedCatalog = 'enemy-assault-lod0,enemy-suppressor-lod0,enemy-technician-lod0,enemy-elite-lod0';",
        'Flagship elite catalog',
    ),
    ('P28-D6 normal Flagship technician LOD0 proof', 'P28-D7 normal Flagship elite LOD0 proof', 'normal proof label'),
    ('P28-D6 low-visibility technician LOD0 telemetry', 'P28-D7 low-visibility elite LOD0 telemetry', 'low visibility label'),
    ("visualDetail: 'p28-d6-technician-enemy-lod0',", "visualDetail: 'p28-d7-elite-enemy-lod0',", 'visual detail payload'),
    ('detail=p28-d6-technician-enemy-lod0', 'detail=p28-d7-elite-enemy-lod0', 'visual detail console marker'),
]
for old, new, label in replacements:
    count = capture_text.count(old)
    assert count == 1, f'{label} match count: {count}'
    capture_text = capture_text.replace(old, new)
catalog_lod_count = capture_text.count("enemyCatalogLod !== '0,1'")
assert catalog_lod_count == 2, f'Flagship elite catalog LOD assertion match count: {catalog_lod_count}'
capture_text = capture_text.replace("enemyCatalogLod !== '0,1'", "enemyCatalogLod !== '0'")
d6_capture_count = capture_text.count('P28-D6 capture.')
assert d6_capture_count == 3, f'P28-D6 capture label match count: {d6_capture_count}'
capture_text = capture_text.replace('P28-D6 capture.', 'P28-D7 capture.')
capture.write_text(capture_text)
