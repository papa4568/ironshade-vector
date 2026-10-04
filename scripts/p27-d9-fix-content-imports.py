from pathlib import Path

path = Path('tests/graphics-content-assets.mjs')
text = path.read_text()
replacements = {
    "@babylonjs/core/Engines/nullEngine'": "@babylonjs/core/Engines/nullEngine.js'",
    "@babylonjs/core/Loading/sceneLoader'": "@babylonjs/core/Loading/sceneLoader.js'",
    "@babylonjs/core/scene'": "@babylonjs/core/scene.js'",
    "@babylonjs/loaders/glTF/2.0/glTFLoader'": "@babylonjs/loaders/glTF/2.0/glTFLoader.js'",
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f'missing expected import {old}')
    text = text.replace(old, new)
path.write_text(text)
print('P27_D9_CONTENT_NODE_IMPORTS_FIXED')
