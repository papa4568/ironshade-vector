from pathlib import Path
import re

path = Path('agent/tools/ev9-trusted-pr-candidate-observer-v2.mjs')
text = path.read_text()

start = "const FULL_VERIFICATION_SCRIPT = ["
end = "];\nconst BROWSER_RESOLVER_SCRIPT = ["
start_index = text.find(start)
end_index = text.find(end, start_index)
if start_index < 0 or end_index < 0:
    raise SystemExit('full verification script block not found')
replacement = "const FULL_VERIFICATION_SCRIPT = [\n  'bash scripts/run-full-repository-build-proof.sh',\n"
text = text[:start_index] + replacement + text[end_index:]

old_evidence = "'full verification must use the reviewed Git-less exact-SHA snapshot build and complete before candidate identity is published'"
new_evidence = "'full verification must delegate the exact PR-head identity to the reviewed shared source-bound proof profile before candidate identity is published'"
if text.count(old_evidence) != 1:
    raise SystemExit(f'expected one snapshot evidence string, found {text.count(old_evidence)}')
text = text.replace(old_evidence, new_evidence, 1)

old_attack = "[{ ...baseline, workflowText: replaceOnce(baseline.workflowText, 'git archive --format=tar \"$CANDIDATE_SHA\" | tar -xf - -C \"$snapshot\"', 'git archive --format=tar HEAD | tar -xf - -C \"$snapshot\"') }, 'candidate-build-exact-snapshot'],"
new_attack = "[{ ...baseline, workflowText: replaceOnce(baseline.workflowText, 'bash scripts/run-full-repository-build-proof.sh', 'CANDIDATE_SHA=${{ github.sha }} bash scripts/run-full-repository-build-proof.sh') }, 'candidate-build-exact-snapshot'],"
if text.count(old_attack) != 1:
    raise SystemExit(f'expected one snapshot attack, found {text.count(old_attack)}')
text = text.replace(old_attack, new_attack, 1)

path.write_text(text)
