from pathlib import Path

path = Path('agent/tools/proof-cache-calibration-evidence.mjs')
script_path = Path('agent/ev17-fix-ignored-prefix-probe.py')
workflow_path = Path('.github/workflows/ev17-ignored-prefix-probe-fix.yml')
text = path.read_text()
old = """    git(['add', '--', ...probe.mutations.map(entry => entry.targetPath)]);\n    git(['-c', 'user.name=EV-17 Calibration', '-c', 'user.email=ev17@example.invalid', 'commit', '-m', `EV-17 disposable probe ${probe.id}`]);\n"""
new = """    const existingTargets = probe.mutations.filter(entry => typeof entry.createContent !== 'string').map(entry => entry.targetPath);\n    const createdTargets = probe.mutations.filter(entry => typeof entry.createContent === 'string').map(entry => entry.targetPath);\n    if (existingTargets.length > 0) git(['add', '--', ...existingTargets]);\n    if (createdTargets.length > 0) git(['add', '-f', '--', ...createdTargets]);\n    git(['-c', 'user.name=EV-17 Calibration', '-c', 'user.email=ev17@example.invalid', 'commit', '-m', `EV-17 disposable probe ${probe.id}`]);\n"""
if text.count(old) != 1:
    raise SystemExit(f'expected one git-add anchor, found {text.count(old)}')
text = text.replace(old, new, 1)
path.write_text(text)
script_path.unlink()
workflow_path.unlink()
