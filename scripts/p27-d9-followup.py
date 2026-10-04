from pathlib import Path

root = Path('.')

def replace(path, old, new):
    p = root / path
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'missing expected text in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new))

replace(
    'package.json',
    'node --check scripts/measure-webgpu-delivery-cost.mjs && node --check scripts/measure-babylon-delivery-cost.mjs',
    'node --check scripts/verify-no-three-delivery.mjs && node --check scripts/measure-babylon-delivery-cost.mjs',
)

replace(
    '.github/workflows/android-apk.yml',
    "          find android/app/src/main/assets/public/assets -name 'three-core-*.js' -print -quit | grep -q .\n          find android/app/src/main/assets/public/assets -name 'three-webgl-*.js' -print -quit | grep -q .\n",
    "          ! find android/app/src/main/assets/public/assets -name 'three-*.js' -print -quit | grep -q .\n          test ! -d android/app/src/main/assets/public/assets/codecs/basis\n          test -f android/app/src/main/assets/public/assets/codecs/babylon/manifest.json\n",
)
replace(
    '.github/workflows/android-apk.yml',
    "      - name: Measure P21-F3 WebGPU delivery cost\n        env:\n          P21F3_APK_PATH: Ironshade-Vector-Android-Debug.apk\n          P21F3_REPORT_PATH: p21f3-webgpu-delivery.json\n        run: node scripts/measure-webgpu-delivery-cost.mjs\n",
    "      - name: Verify no Three runtime delivery\n        env:\n          P27D9_APK_PATH: Ironshade-Vector-Android-Debug.apk\n          P27D9_REPORT_PATH: p27d9-no-three-delivery.json\n        run: node scripts/verify-no-three-delivery.mjs\n",
)
replace('.github/workflows/android-apk.yml', 'android-p21f3-webgpu.json', 'android-babylon-webgpu.json')
replace('.github/workflows/android-apk.yml', 'p21f3-webgpu-delivery.json', 'p27d9-no-three-delivery.json')

replace('scripts/android-runtime-smoke.mjs', "schema: 'p21-f3-webgpu-android-v1'", "schema: 'babylon-webgpu-android-v1'")
replace('scripts/android-runtime-smoke.mjs', "process.env.ANDROID_P21F3_REPORT ?? 'android-p21f3-webgpu.json'", "process.env.ANDROID_BABYLON_WEBGPU_REPORT ?? 'android-babylon-webgpu.json'")
replace('scripts/android-runtime-smoke.mjs', 'ANDROID_P21F3_WEBGPU_COMPAT_PASS', 'ANDROID_BABYLON_WEBGPU_COMPAT_PASS')
replace('scripts/android-runtime-smoke.mjs', 'P21-F3 Android production WebGL2 fallback refinery', 'Babylon Android production WebGL2 fallback refinery')
replace('scripts/android-runtime-smoke.mjs', 'P21-F3 Android loaded an unexpected graphics path', 'Babylon Android loaded an unexpected graphics path')

replace(
    'tests/android-fast-smoke-contract.mjs',
    "const p21f3Delivery = fs.readFileSync(new URL('../scripts/measure-webgpu-delivery-cost.mjs', import.meta.url), 'utf8');",
    "const p27d9Delivery = fs.readFileSync(new URL('../scripts/verify-no-three-delivery.mjs', import.meta.url), 'utf8');",
)
replace('tests/android-fast-smoke-contract.mjs', 'node scripts/measure-webgpu-delivery-cost.mjs', 'node scripts/verify-no-three-delivery.mjs')
replace('tests/android-fast-smoke-contract.mjs', 'p21f3-webgpu-delivery.json', 'p27d9-no-three-delivery.json')
replace('tests/android-fast-smoke-contract.mjs', 'android-p21f3-webgpu.json', 'android-babylon-webgpu.json')
old = """for (const marker of [
  'P21F3_WEBGPU_DELIVERY_PASS',
  'three.webgpu-',
  'three.tsl-',
  'webGpuRefineryRenderer-',
  'incrementalCompressedBytes',
  'compressedPercentOfApk',
]) requireText(p21f3Delivery, marker, 'P21-F3 delivery measurement');"""
new = """for (const marker of [
  'P27D9_NO_THREE_DELIVERY_PASS',
  'FORBIDDEN_THREE_PATTERNS',
  'assets/codecs/basis',
  'webGpuRefineryRenderer-',
  'node_modules/three',
  'package-lock.json',
]) requireText(p27d9Delivery, marker, 'P27-D9 no-Three delivery verification');"""
replace('tests/android-fast-smoke-contract.mjs', old, new)

print('P27_D9_DELIVERY_CLEANUP_APPLIED')
