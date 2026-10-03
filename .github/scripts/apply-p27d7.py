from pathlib import Path


path = Path("scripts/browser-runtime-smoke.mjs")
text = path.read_text()
old = "const requestedGraphicsPath = (process.env.BROWSER_E2E_GRAPHICS_PATH ?? '').trim();"
new = "const requestedGraphicsPath = (process.env.BROWSER_E2E_GRAPHICS_PATH ?? 'webgl2').trim();"
count = text.count(old)
if count != 1:
    raise SystemExit(f"{path}: expected exactly one browser graphics-path default, found {count}")
path.write_text(text.replace(old, new, 1))

print("P27_D7_BROWSER_CUTOVER_APPLIED defaultQaPath=webgl2 explicitBabylon=preserved productionDefault=android-smoke")
