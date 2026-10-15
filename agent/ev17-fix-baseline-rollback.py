from pathlib import Path

path = Path('agent/tools/proof-cache-calibration-evidence.mjs')
workflow = Path('.github/workflows/ev17-baseline-rollback-fix.yml')
script = Path('agent/ev17-fix-baseline-rollback.py')
text = path.read_text()
old = """    if (executeProofs) {\n      const baselineExecution = run(proofEntry.expectedCommand, { expectedOutcome: 'success' });\n      trialRows.push({\n"""
new = """    if (executeProofs) {\n      const baselineExecution = run(proofEntry.expectedCommand, { expectedOutcome: 'success' });\n      const baselineGeneratedTrackedState = git(['status', '--porcelain', '--untracked-files=no']);\n      git(['reset', '--hard', candidateSha]);\n      assert(git(['rev-parse', 'HEAD']) === candidateSha, `${proofEntry.proofId} baseline rollback did not restore exact candidate HEAD`);\n      assert(git(['status', '--porcelain', '--untracked-files=no']) === '', `${proofEntry.proofId} baseline rollback did not restore clean tracked state`);\n      trialRows.push({\n"""
if text.count(old) != 1:
    raise SystemExit(f'expected one baseline execution anchor, found {text.count(old)}')
text = text.replace(old, new, 1)
old2 = """        rollback: { sourceRestored: true, headRestored: true },\n"""
new2 = """        rollback: {\n          sourceRestored: true,\n          headRestored: true,\n          trackedStateRestored: true,\n          generatedTrackedStateObserved: baselineGeneratedTrackedState.length > 0,\n          generatedTrackedStateDigest: sha256(baselineGeneratedTrackedState),\n        },\n"""
if text.count(old2) != 1:
    raise SystemExit(f'expected one baseline rollback anchor, found {text.count(old2)}')
text = text.replace(old2, new2, 1)
path.write_text(text)
script.unlink()
workflow.unlink()
