from pathlib import Path

v2_path = Path('agent/tools/ev9-trusted-pr-candidate-observer-v2.mjs')
v2 = v2_path.read_text()

start = "const FULL_VERIFICATION_SCRIPT = ["
end = "];\nconst BROWSER_RESOLVER_SCRIPT = ["
start_index = v2.find(start)
end_index = v2.find(end, start_index)
if start_index < 0 or end_index < 0:
    raise SystemExit('full verification script block not found')
replacement = "const FULL_VERIFICATION_SCRIPT = [\n  'bash scripts/run-full-repository-build-proof.sh',\n"
v2 = v2[:start_index] + replacement + v2[end_index:]

old_evidence = "'full verification must use the reviewed Git-less exact-SHA snapshot build and complete before candidate identity is published'"
new_evidence = "'full verification must delegate the exact PR-head identity to the reviewed shared source-bound proof profile before candidate identity is published'"
if v2.count(old_evidence) != 1:
    raise SystemExit(f'expected one snapshot evidence string, found {v2.count(old_evidence)}')
v2 = v2.replace(old_evidence, new_evidence, 1)

old_attack = "[{ ...baseline, workflowText: replaceOnce(baseline.workflowText, 'git archive --format=tar \"$CANDIDATE_SHA\" | tar -xf - -C \"$snapshot\"', 'git archive --format=tar HEAD | tar -xf - -C \"$snapshot\"') }, 'candidate-build-exact-snapshot'],"
new_attack = "[{ ...baseline, workflowText: replaceOnce(baseline.workflowText, 'bash scripts/run-full-repository-build-proof.sh', 'CANDIDATE_SHA=${{ github.sha }} bash scripts/run-full-repository-build-proof.sh') }, 'candidate-build-exact-snapshot'],"
if v2.count(old_attack) != 1:
    raise SystemExit(f'expected one snapshot attack, found {v2.count(old_attack)}')
v2 = v2.replace(old_attack, new_attack, 1)
v2_path.write_text(v2)

v8_path = Path('agent/tools/ev9-trusted-pr-candidate-observer-v8.mjs')
v8 = v8_path.read_text()
old_header_tail = "    ...extraLines,\n    '        run: |',\n  ].join('\\n');\n}"
new_header_tail = "    ...extraLines,\n    '        run: bash scripts/run-full-repository-build-proof.sh',\n  ].join('\\n');\n}"
if v8.count(old_header_tail) != 1:
    raise SystemExit(f'expected one v8 full-verification header tail, found {v8.count(old_header_tail)}')
v8 = v8.replace(old_header_tail, new_header_tail, 1)
v8_path.write_text(v8)
