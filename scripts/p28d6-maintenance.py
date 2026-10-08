from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    assert count == 1, f'{label} match count: {count}'
    file.write_text(text.replace(old, new))


replace_once(
    'scripts/prepare-premium-pbr-reference.mjs',
    "  const { writeSuppressorEnemyLod0 } = await import('./prepare-suppressor-enemy-lod0.mjs');\n  await writeSuppressorEnemyLod0();\n  const { writePremiumPbrSurfaceLibrary } = await import('./prepare-premium-pbr-library.mjs');",
    "  const { writeSuppressorEnemyLod0 } = await import('./prepare-suppressor-enemy-lod0.mjs');\n  await writeSuppressorEnemyLod0();\n  const { writeTechnicianEnemyLod0 } = await import('./prepare-technician-enemy-lod0.mjs');\n  await writeTechnicianEnemyLod0();\n  const { writePremiumPbrSurfaceLibrary } = await import('./prepare-premium-pbr-library.mjs');",
    'premium preparation',
)
replace_once(
    'src/game/graphicsAssetManifest.ts',
    "  technician: {\n    id: 'enemy-technician',\n    lods: {\n      1: createGraphicsAssetSpec('enemy-technician-lod1', 'enemy', '/assets/models/enemies/enemy-technician-lod1.glb', 1),",
    "  technician: {\n    id: 'enemy-technician',\n    lods: {\n      0: createGraphicsAssetSpec('enemy-technician-lod0', 'enemy', '/assets/models/enemies/enemy-technician-lod0.glb', 0),\n      1: createGraphicsAssetSpec('enemy-technician-lod1', 'enemy', '/assets/models/enemies/enemy-technician-lod1.glb', 1),",
    'technician manifest',
)
replace_once(
    'scripts/browser-runtime-smoke.mjs',
    "    (role === 'assault' || role === 'suppressor') && state.renderTier === 'high' ? 0 : expectedSharedLod,",
    "    (role === 'assault' || role === 'suppressor' || role === 'technician') && state.renderTier === 'high' ? 0 : expectedSharedLod,",
    'browser runtime LOD expectation',
)

capture = Path('scripts/p28a5-image-grade-capture.mjs')
capture_text = capture.read_text()
replacements = [
    ("visualDetail: 'p28-d4-assault-enemy-lod0'", "visualDetail: 'p28-d4-assault-enemy-lod0'; visualDetail: 'p28-d5-suppressor-enemy-lod0'", 'historical D5 visual marker'),
    ("      && catalog.split(',').includes('enemy-suppressor-lod0');\n  })()`, 'normal Flagship refinery grade with suppressor enemy LOD0', 90_000);", "      && catalog.split(',').includes('enemy-suppressor-lod0')\n      && catalog.split(',').includes('enemy-technician-lod0');\n  })()`, 'normal Flagship refinery grade with technician enemy LOD0', 90_000);", 'Flagship technician wait proof'),
    ("  const expectedCatalog = 'enemy-assault-lod0,enemy-suppressor-lod0,enemy-technician-lod1,enemy-elite-lod1';", "  const expectedCatalog = 'enemy-assault-lod0,enemy-suppressor-lod0,enemy-technician-lod0,enemy-elite-lod1';", 'Flagship technician catalog'),
    ('P28-D5 normal Flagship suppressor LOD0 proof', 'P28-D6 normal Flagship technician LOD0 proof', 'normal proof label'),
    ('P28-D5 low-visibility suppressor LOD0 telemetry', 'P28-D6 low-visibility technician LOD0 telemetry', 'low visibility label'),
    ("visualDetail: 'p28-d5-suppressor-enemy-lod0',", "visualDetail: 'p28-d6-technician-enemy-lod0',", 'visual detail payload'),
    ('detail=p28-d5-suppressor-enemy-lod0', 'detail=p28-d6-technician-enemy-lod0', 'visual detail console marker'),
]
for old, new, label in replacements:
    count = capture_text.count(old)
    assert count == 1, f'{label} match count: {count}'
    capture_text = capture_text.replace(old, new)
d5_capture_count = capture_text.count('P28-D5 capture.')
assert d5_capture_count == 3, f'P28-D5 capture label match count: {d5_capture_count}'
capture_text = capture_text.replace('P28-D5 capture.', 'P28-D6 capture.')
capture.write_text(capture_text)
