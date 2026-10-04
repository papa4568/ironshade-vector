from pathlib import Path

source = Path('.github/workflows/android-apk.yml').read_text()

replacements = [
    (
        "          find android/app/src/main/assets/public/assets -name 'three-core-*.js' -print -quit | grep -q .\n          find android/app/src/main/assets/public/assets -name 'three-webgl-*.js' -print -quit | grep -q .\n",
        "          ! find android/app/src/main/assets/public/assets -name 'three-*.js' -print -quit | grep -q .\n          test ! -d android/app/src/main/assets/public/assets/codecs/basis\n          test -f android/app/src/main/assets/public/assets/codecs/babylon/manifest.json\n",
    ),
    (
        "      - name: Measure P21-F3 WebGPU delivery cost\n        env:\n          P21F3_APK_PATH: Ironshade-Vector-Android-Debug.apk\n          P21F3_REPORT_PATH: p21f3-webgpu-delivery.json\n        run: node scripts/measure-webgpu-delivery-cost.mjs\n",
        "      - name: Verify no Three runtime delivery\n        env:\n          P27D9_APK_PATH: Ironshade-Vector-Android-Debug.apk\n          P27D9_REPORT_PATH: p27d9-no-three-delivery.json\n        run: node scripts/verify-no-three-delivery.mjs\n",
    ),
    ('android-p21f3-webgpu.json', 'android-babylon-webgpu.json'),
    ('p21f3-webgpu-delivery.json', 'p27d9-no-three-delivery.json'),
]

for old, new in replacements:
    if old not in source:
        raise SystemExit(f'missing expected Android workflow text: {old[:120]!r}')
    source = source.replace(old, new)

Path('p27-d9-android-apk.staged.yml').write_text(source)
print('P27_D9_ANDROID_WORKFLOW_STAGED')
