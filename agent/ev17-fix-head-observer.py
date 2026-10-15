from pathlib import Path

path = Path('agent/tools/pr-candidate-head-observer.mjs')
text = path.read_text()

def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    text = text.replace(old, new, 1)

replace_once(
    "const SOURCE_BOUND_BUILD_ACTIVE_SHA256 = 'f3566aeed8d4bcbfa84ddf9c779047e30405d9c49a9a22f66704961a421703c5';",
    "const SOURCE_BOUND_BUILD_ACTIVE_SHA256 = 'a22db47859c1d97e6e4a7a137f9501b2c9a426f367f770142bf628447b61193f';",
    'shared proof delegation digest',
)
replace_once(
    "check('candidate-build-source-bound-snapshot', 'Full verification builds only the exact PR-head Git archive in a Git-less, networkless snapshot.', sourceBoundBuildContract(producer), 'full-verification active shell body must exactly match the reviewed ordered source-bound build contract after comments are removed'),",
    "check('candidate-build-source-bound-snapshot', 'Full verification delegates the exact PR-head identity to the reviewed shared source-bound proof profile.', sourceBoundBuildContract(producer), 'full-verification must unconditionally execute the reviewed shared proof script with CANDIDATE_SHA bound to the PR head'),",
    'observer check description',
)
replace_once(
    "      workflowText: replaceOnce(workflowText, 'git archive --format=tar \"$CANDIDATE_SHA\"', `git archive --format=tar \"${SYNTHETIC_EVENT_SHA}\"`, 'source-bound archive'),",
    "      workflowText: replaceOnce(workflowText, '        run: bash scripts/run-full-repository-build-proof.sh', `        run: CANDIDATE_SHA=${SYNTHETIC_EVENT_SHA} bash scripts/run-full-repository-build-proof.sh`, 'source-bound proof delegation'),",
    'synthetic SHA attack',
)
replace_once(
    "      workflowText: replaceOnce(workflowText, '          git archive --format=tar \"$CANDIDATE_SHA\" | tar -xf - -C \"$snapshot\"', '          # git archive --format=tar \"$CANDIDATE_SHA\" | tar -xf - -C \"$snapshot\"\\n          echo \"source-bound archive command removed\"', 'source-bound archive comment spoof'),",
    "      workflowText: replaceOnce(workflowText, '        run: bash scripts/run-full-repository-build-proof.sh', '        run: |\\n          # bash scripts/run-full-repository-build-proof.sh\\n          echo \"source-bound proof delegation removed\"', 'source-bound proof comment spoof'),",
    'comment spoof attack',
)
replace_once(
    "      workflowText: replaceOnce(workflowText, '          git archive --format=tar \"$CANDIDATE_SHA\" | tar -xf - -C \"$snapshot\"', '          printf \\'%s\\\\n\\' \\'git archive --format=tar \"$CANDIDATE_SHA\" | tar -xf - -C \"$snapshot\"\\'', 'source-bound archive quoted-string spoof'),",
    "      workflowText: replaceOnce(workflowText, '        run: bash scripts/run-full-repository-build-proof.sh', \"        run: echo 'bash scripts/run-full-repository-build-proof.sh'\", 'source-bound proof quoted-string spoof'),",
    'quoted string spoof attack',
)
path.write_text(text)
