from pathlib import Path

path = Path('tests/gameplay-regressions.ts')
text = path.read_text()

old = """const capstoneRendererSource = readFileSync('src/game/threeCombatRenderer.ts', 'utf8');
assert.match(capstoneRendererSource, /effect\\.kind === 'vanguard'[\\s\\S]*0xbd8a64/, 'Vanguard capstone feedback should retain its authored warm class color.');
assert.match(capstoneRendererSource, /effect\\.kind === 'vector'[\\s\\S]*0x74a6c7/, 'Vector capstone feedback should retain its authored blue class color.');
assert.match(capstoneRendererSource, /effect\\.kind === 'systems'[\\s\\S]*0x9b87bd/, 'Systems capstone feedback should retain its authored violet class color.');
assert.match(capstoneRendererSource, /dataset\\.capstoneFx = lastCapstoneFx \\|\\| 'idle'/, 'Renderer QA telemetry should expose the active class capstone effect.');
assert.match(capstoneRendererSource, /class-capstones/, 'Combat VFX telemetry should advertise class-capstone feedback support.');"""
new = """const capstoneRendererSource = readFileSync('src/game/babylonAbilityVfx.ts', 'utf8');
assert.match(capstoneRendererSource, /vanguard: \\{ color: 0xbd8a64/, 'Vanguard capstone feedback should retain its authored warm class color.');
assert.match(capstoneRendererSource, /vector: \\{ color: 0x74a6c7/, 'Vector capstone feedback should retain its authored blue class color.');
assert.match(capstoneRendererSource, /systems: \\{ color: 0x9b87bd/, 'Systems capstone feedback should retain its authored violet class color.');
assert.match(capstoneRendererSource, /dataset\\.babylonAbilityVfx = 'skill\\+mobility\\+effects\\+shared-player-fields'/, 'Babylon combat VFX telemetry should expose the active shared player-field presentation path.');"""
if old not in text:
    raise SystemExit('capstone Three source oracle block not found')
text = text.replace(old, new)

old = "const targetingRendererSource = readFileSync('src/game/threeCombatRenderer.ts', 'utf8');"
new = "const targetingRendererSource = readFileSync('src/game/babylonEnemyLifecycleVisuals.ts', 'utf8');"
if old not in text:
    raise SystemExit('targeting Three source oracle not found')
text = text.replace(old, new)

old = "assert.match(targetingRendererSource, /reducedTargetMotion \\? 1 : 1 \\+ Math\\.sin\\(state\\.time \\* 8\\) \\* 0\\.08/, 'reduced effects must freeze the 3D target-ring scale while full effects retain restrained motion');"
new = "assert.match(targetingRendererSource, /const pulse = reducedTargetMotion \\? 1 : 1 \\+ Math\\.sin\\(state\\.time \\* 8\\) \\* 0\\.08/, 'reduced effects must freeze the Babylon 3D target-ring scale while full effects retain restrained motion');"
if old not in text:
    raise SystemExit('targeting Three motion assertion not found')
text = text.replace(old, new)

path.write_text(text)
print('P27_D9_GAMEPLAY_REGRESSION_MIGRATED')
