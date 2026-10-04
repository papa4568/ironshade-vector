from pathlib import Path
import re


def replace(path, old, new):
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'missing expected text in {path}: {old[:120]!r}')
    file.write_text(text.replace(old, new))

# Shared enemy presentation regressions now validate the shipped Babylon presentation owners.
replace('tests/enemy-t9-visuals-i.ts', "const rendererSource = readFileSync(resolve(process.cwd(), 'src/game/threeCombatRenderer.ts'), 'utf8');", "const rendererSource = readFileSync(resolve(process.cwd(), 'src/game/babylonProtocolStatusVisuals.ts'), 'utf8');")
replace('tests/enemy-t9-visuals-i.ts', "assert(rendererSource.includes(token), `Three.js renderer must consume ${token}`);", "assert(rendererSource.includes(token), `Babylon protocol/status visuals must consume ${token}`);")
replace('tests/enemy-t9-visuals-i.ts', "assert(rendererSource.includes('syncEnemyMutationPresentation'), 'Three.js renderer must run the shared P13-B mutation presentation path');", "assert(rendererSource.includes('private syncMutations('), 'Babylon protocol/status visuals must run the shared P13-B mutation presentation path');")
replace('tests/enemy-t9-visuals-i.ts', "assert(rendererSource.includes('enemyMutationPresentation'), 'Three.js runtime QA telemetry must expose active mutation presentation');", "assert(rendererSource.includes('dataset.babylonEnemyMutations'), 'Babylon runtime QA telemetry must expose active mutation presentation');")

replace('tests/enemy-t9-visuals-ii.ts', "const rendererSource = readFileSync(resolve(process.cwd(), 'src/game/threeCombatRenderer.ts'), 'utf8');", "const rendererSource = readFileSync(resolve(process.cwd(), 'src/game/babylonProtocolStatusVisuals.ts'), 'utf8');")
replace('tests/enemy-t9-visuals-ii.ts', "assert(rendererSource.includes(token), `Three.js renderer must consume ${token}`);", "assert(rendererSource.includes(token), `Babylon protocol/status visuals must consume ${token}`);")
replace('tests/enemy-t9-visuals-ii.ts', "assert(rendererSource.includes(hardware), `Three.js renderer must author ${hardware}`);", "assert(rendererSource.includes(hardware), `Babylon protocol/status visuals must author ${hardware}`);")
replace('tests/enemy-t9-visuals-ii.ts', "assert(rendererSource.includes('reducedEffects ? 0 : state.time * 0.45'), 'Countermass secondary orbit motion must stop in reduced-effects mode');", "assert(rendererSource.includes(\"mutation.root.rotation.y = !reduced && id === 'countermass-rig' ? state.time * 0.45 : 0\"), 'Countermass secondary orbit motion must stop in reduced-effects mode');")
replace('tests/enemy-t9-visuals-ii.ts', "assert(rendererSource.includes('snap.visible = !reducedEffects || side > 0'), 'Relay secondary snap VFX must reduce in reduced-effects mode');", "assert(rendererSource.includes('const enabled = !reduced || secondaryIndex === 0'), 'Mutation secondary VFX must reduce in reduced-effects mode');")

replace('tests/enemy-protocol-visuals.ts', "const rendererSource = readFileSync(resolve(process.cwd(), 'src/game/threeCombatRenderer.ts'), 'utf8');", "const rendererSource = readFileSync(resolve(process.cwd(), 'src/game/babylonProtocolStatusVisuals.ts'), 'utf8');")
for old, new in [
    ("assert(rendererSource.includes('createEnemyProtocolVisuals'), 'Three.js must author physical protocol hardware');", "assert(rendererSource.includes('private createProtocolSlot('), 'Babylon must author physical protocol hardware');"),
    ("assert(rendererSource.includes('syncEnemyProtocolPresentation'), 'Three.js must animate protocol hardware');", "assert(rendererSource.includes('private syncProtocols('), 'Babylon must animate protocol hardware');"),
    ("assert(rendererSource.includes('protocol-enhanced-ring'), 'Three.js must expose enhanced protocol accents');", "assert(rendererSource.includes('protocol-enhanced-ring'), 'Babylon must expose enhanced protocol accents');"),
    ("assert(rendererSource.includes('dataset.enemyProtocolPresentation'), 'Three.js must expose protocol QA telemetry');", "assert(rendererSource.includes('dataset.babylonEnemyProtocols'), 'Babylon must expose protocol QA telemetry');"),
    ("assert(rendererSource.includes('reducedTargetMotion ? 0 : state.time'), 'generic protocol ring motion must stop in reduced-effects mode');", "assert(rendererSource.includes('const motion = reduced ? 0 : state.time'), 'generic protocol ring motion must stop in reduced-effects mode');"),
    ("assert(rendererSource.includes('const spokeCount = reducedEffects ? Math.min(2, variant.spokes) : variant.spokes'), 'enhanced protocol secondary detail must reduce under reduced effects');", "assert(rendererSource.includes('const spokeCount = reduced ? Math.min(2, variant.spokes) : variant.spokes'), 'enhanced protocol secondary detail must reduce under reduced effects');"),
]:
    replace('tests/enemy-protocol-visuals.ts', old, new)

replace('tests/status-visuals.ts', "const rendererSource = readFileSync(resolve(process.cwd(), 'src/game/threeCombatRenderer.ts'), 'utf8');", "const rendererSource = readFileSync(resolve(process.cwd(), 'src/game/babylonProtocolStatusVisuals.ts'), 'utf8');")
for old, new in [
    ("assert(rendererSource.includes('createEnemyStatusVisuals'), 'Three.js must build enemy status geometry');", "assert(rendererSource.includes('private createEnemyStatusVisual('), 'Babylon must build enemy status geometry');"),
    ("assert(rendererSource.includes('syncEnemyStatusPresentation'), 'Three.js must animate enemy status presentation');", "assert(rendererSource.includes('private syncEnemyStatuses('), 'Babylon must animate enemy status presentation');"),
    ("assert(rendererSource.includes('createPlayerStatusVisuals'), 'Three.js must build operator status geometry');", "assert(rendererSource.includes('private createPlayerStatusVisual('), 'Babylon must build operator status geometry');"),
    ("assert(rendererSource.includes('syncPlayerStatusPresentation'), 'Three.js must animate operator thermal/environment states');", "assert(rendererSource.includes('private syncPlayerStatuses('), 'Babylon must animate operator thermal/environment states');"),
    ("assert(rendererSource.includes('dataset.enemyStatusPresentation'), 'Three.js must expose enemy status QA telemetry');", "assert(rendererSource.includes('dataset.babylonEnemyStatuses'), 'Babylon must expose enemy status QA telemetry');"),
    ("assert(rendererSource.includes('dataset.playerStatusDominant'), 'Three.js must expose operator status QA telemetry');", "assert(rendererSource.includes('dataset.babylonPlayerStatusDominant'), 'Babylon must expose operator status QA telemetry');"),
    ("assert(rendererSource.includes(\"enemy.telegraph > 0 ? 0x7a3327 : dominantStatusSpec?.accent\"), 'attack telegraph material must stay authoritative over status emissive');", "assert(rendererSource.includes('if (enemy.telegraph > 0) readability *= spec.priority >= 4 ? 0.72 : 0.42'), 'attack telegraph material must stay authoritative over status emissive');"),
    ("assert(rendererSource.includes('const markerCount = reducedEffects ? 2'), 'operator secondary status detail must reduce in reduced-effects mode');", "assert(rendererSource.includes('const markerCount = reduced ? 2'), 'operator secondary status detail must reduce in reduced-effects mode');"),
    ("assert(rendererSource.includes('const nodeCount = reducedEffects ? Math.min(3, spec.nodeCount)'), 'enemy secondary status detail must reduce in reduced-effects mode');", "assert(rendererSource.includes('const nodeCount = reduced ? Math.min(3, spec.nodeCount)'), 'enemy secondary status detail must reduce in reduced-effects mode');"),
]:
    replace('tests/status-visuals.ts', old, new)

replace('tests/enemy-lifecycle-visuals.ts', "const rendererSource = readFileSync(resolve(process.cwd(), 'src/game/threeCombatRenderer.ts'), 'utf8');", "const rendererSource = readFileSync(resolve(process.cwd(), 'src/game/babylonEnemyLifecycleVisuals.ts'), 'utf8');")
for old, new in [
    ("assert(rendererSource.includes('syncEnemyLifecyclePresentation'), 'Three.js must render lifecycle hardware/VFX');", "assert(rendererSource.includes('resolveEnemyLifecyclePresentation(enemy, {'), 'Babylon must render lifecycle hardware/VFX');"),
    ("assert(rendererSource.includes('enemy-lifecycle-presentation'), 'Three.js must keep lifecycle presentation on the shared enemy root for authored and procedural rigs');", "assert(rendererSource.includes('p27-b10-lifecycle-root-'), 'Babylon must keep lifecycle presentation on a shared enemy lifecycle root');"),
    ("assert(rendererSource.includes('dataset.enemyLifecyclePresentation'), 'Three.js must expose lifecycle QA telemetry');", "assert(rendererSource.includes('dataset.babylonEnemyLifecyclePresentation'), 'Babylon must expose lifecycle QA telemetry');"),
    ("assert(rendererSource.includes(\"reducedTargetMotion ? 'preserved' : 'full'\"), 'Three.js must preserve lifecycle identity in reduced-effects mode');", "assert(rendererSource.includes(\"dataset.babylonEnemyLifecycleReducedEffects = reducedMotion ? 'preserved' : 'full'\"), 'Babylon must preserve lifecycle identity in reduced-effects mode');"),
    ("assert(rendererSource.includes('const lifecycle = resolveEnemyLifecyclePresentation(enemy, {') && rendererSource.includes('syncAuthoredEnemyAnimation(visual, enemy, state, motion)'), 'authored enemy animation must consume lifecycle signals without breaking the established integration contract');", "assert(rendererSource.includes('resolveEnemyLifecyclePresentation(enemy, {') && rendererSource.includes('signals.phaseTransition'), 'Babylon lifecycle visuals must consume shared lifecycle signals without mutating simulation');"),
]:
    replace('tests/enemy-lifecycle-visuals.ts', old, new)

replace('tests/enemy-mobile-readability.ts', "const renderer = readFileSync(resolve(process.cwd(), 'src/game/threeCombatRenderer.ts'), 'utf8');", "const renderer = readFileSync(resolve(process.cwd(), 'src/game/babylonEnemyLifecycleVisuals.ts'), 'utf8');\nconst babylonProtocolStatus = readFileSync(resolve(process.cwd(), 'src/game/babylonProtocolStatusVisuals.ts'), 'utf8');")
replace('tests/enemy-mobile-readability.ts', """assert(renderer.includes('resolveEnemyHudReadability(enemy, this.coarse, enemy.id === mobileTargetId)'), 'Three.js enemy bars must consume the shared P13-G mobile policy.');
for (const tell of ['syncEnemyLifecyclePresentation', 'syncEnemyProtocolPresentation', 'syncEnemyMutationPresentation', 'syncEnemyStatusPresentation']) {
  assert(renderer.includes(tell), `Three.js must preserve ${tell} at mobile LOD2.`);
}
assert(renderer.includes("selectGraphicsAssetSpec(family, this.coarse ? 0.55 : 1)"), 'coarse hostile assets must keep the established authored mobile LOD selection.');""", """assert(renderer.includes('resolveEnemyHudReadability(enemy, this.coarse, focused)'), 'Babylon enemy bars must consume the shared P13-G mobile policy.');
for (const tell of ['syncProtocols', 'syncMutations', 'syncEnemyStatuses']) {
  assert(babylonProtocolStatus.includes(tell), `Babylon must preserve ${tell} at mobile LOD2.`);
}
assert(renderer.includes('babylonEnemyLifecycleEffectsMode(detailScale, this.coarse)'), 'coarse hostile visuals must retain the reduced-effects mobile policy.');""")

replace('tests/combat-camera-feedback.ts', "const rendererSource = readFileSync(resolve(process.cwd(), 'src/game/threeCombatRenderer.ts'), 'utf8');", "const rendererSource = readFileSync(resolve(process.cwd(), 'src/game/babylonCombatRenderer.ts'), 'utf8');")
replace('tests/combat-camera-feedback.ts', "'Three.js renderer must receive the shared combat-camera response'", "'Babylon renderer must receive the shared combat-camera response'")
replace('tests/combat-camera-feedback.ts', "'Three.js camera must consume and expose shared combat feedback'", "'Babylon camera must consume and expose shared combat feedback'")

replace('tests/client-bundle-architecture.mjs', "assert(threeChunks.length === 2, `Expected exactly two production Three.js runtime chunks; found ${threeChunks.length}.`);\n", '')

# Dedicated Babylon regressions no longer use retired Three source as a live parity oracle.
location_files = [
    'tests/babylon-cryo-reserve.ts', 'tests/babylon-damaged-vessel.ts', 'tests/babylon-ice-mine.ts',
    'tests/babylon-jovian-harvester.ts', 'tests/babylon-lattice-annex.ts', 'tests/babylon-momentum-exchange.ts',
    'tests/babylon-orbital-station.ts', 'tests/babylon-parallax-array.ts', 'tests/babylon-solar-yard.ts',
    'tests/babylon-spin-habitat.ts',
]
for path in location_files:
    text = Path(path).read_text()
    text = re.sub(r"^const three = read(?:FileSync)?\([^\n]*(?:threeCombatRenderer|hardSciFiVisuals)[^\n]*\);\n", '', text, flags=re.M)
    text = re.sub(r"^const threeRenderer = read\([^\n]*threeCombatRenderer[^\n]*\);\n", '', text, flags=re.M)
    # Remove only assertions whose sole purpose was comparing Babylon against retired Three implementation text.
    text = re.sub(r"assert(?:\.ok)?\(\n?\s*(?:three|threeRenderer)\.includes\([\s\S]*?\n?\s*\);\n", '', text)
    Path(path).write_text(text)

for path in [
    'tests/babylon-hecate-capstone.ts', 'tests/babylon-k91-capstone.ts',
    'tests/babylon-orpheline-capstone.ts', 'tests/babylon-perseid-capstone.ts',
]:
    text = Path(path).read_text()
    text = re.sub(r"^const three = readFileSync\([^\n]*threeCombatRenderer[^\n]*\);\n", '', text, flags=re.M)
    text = re.sub(r"for \(const marker of \[\n[\s\S]*?\n\]\) assert\.ok\(three\.includes\(marker\), 'missing Three [^\n]*\);\n\n", '', text)
    Path(path).write_text(text)

replace('tests/babylon-refinery-lighting.ts', "const iblSource = readFileSync('src/game/refineryIbl.ts', 'utf8');", "const iblSource = readFileSync('src/game/refineryLightingProfile.ts', 'utf8');")
replace('tests/babylon-refinery-lighting.ts', "assert.match(iblSource, /from '.\\/refineryLightingProfile'/, 'Three and Babylon refinery IBL must share the authored environment profile.');", "assert.match(iblSource, /REFINERY_IBL_PROFILE/, 'Babylon refinery IBL must use the engine-neutral authored environment profile.');")
replace('tests/babylon-refinery-post-processing.ts', "const bloomSource = readFileSync('src/game/refineryBloom.ts', 'utf8');", "const bloomSource = readFileSync('src/game/refineryBloomProfile.ts', 'utf8');")
replace('tests/babylon-refinery-post-processing.ts', "assert.match(bloomSource, /from '\\.\\/refineryBloomProfile'/, 'Three and Babylon bloom must share the engine-neutral bloom profile.');", "assert.match(bloomSource, /REFINERY_BLOOM_PROFILE/, 'Babylon bloom must use the engine-neutral bloom profile.');")

print('P27_D9_GRAPHICS_REGRESSIONS_MIGRATED')
