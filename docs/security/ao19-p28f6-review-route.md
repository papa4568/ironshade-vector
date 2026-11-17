# AO-19 — review one-shot P28-F6 hotfix route (preparation)

## Evidence and limitation

Draft PR #449 head 064220da79b6841669a69a9b0866f1748105f42c
passed full build, browser desktop/mobile, exact-APK API 35 real post-resume
FIRE, API 36 and EV-9 trusted observation. Its only failed technical
candidate step is the missing independent hotfix review. P28-G9 remains
the current unfinished product item, which existing reviewer fallback
incorrectly selects for this earlier P28-F6 regression repair.

The new pinned review contract rejects any other PR, source repo, branch,
changed path list, Git object SHA/mode, closed PR or unrelated product
task. The actual independent P28-F6 review must inspect the unchanged
original five reviewed game/test file Git objects and mandatory Android
post-HOME FIRE, renderer and cache-regression evidence; it must not
approve unfinished P28-G9 visuals.

## Protected-source preparation, not promotion

No protected agent/tools path changes in the preparation PR. These
reviewable source files stage the future four protected Git blobs:

- tools/ao19-p28f6-contract.staged.mjs
- tools/ao19-p28f6-route-patches.mjs
- tools/ao19-p28f6-route-bootstrap.mjs

Focused negative tests and the dedicated nonprivileged CI workflow
validate this frozen source proposal.

This exact PR is a **proposed AO-19 verified closeout candidate**. Its status
does not constitute completion until all exact-head technical and trusted
independent security gates pass. The closeout transition is essential: it
ensures AO-19 does not remain active on main and shadow P28-F6 routing.

After an actual independent AO-19 security PASS, the repository owner must
separately authorize merging this exact reviewed commit. The privileged
bootstrap independently verifies an immutable, owner-authored, unedited
PR #450 comment placed AFTER the trusted independent PASS and BEFORE merge:

    /ao19-authorize-merge 450 <exact-reviewed-AO19-PR-head-sha>

The owner must then separately approve and execute the merge. Only after
that can a fresh owner-authored comment on the merged PR trigger the
trusted-main one-use bootstrap:

    /ao19-promote-p28f6-review 450 <exact-approved-AO19-PR-head-sha>

The trusted-main helper independently revalidates exact-head CI,
actual Copilot PASS and run provenance, EV-9, reviewed source blob pins,
and current main SHA, then atomically updates precisely four protected
agent files while deleting itself in the same non-force commit.
The helper never executes candidate code with privileged GitHub access.
The workflow file remains inert after helper deletion.

Only after that separately authorized promotion should PR #449 be
rebased on trusted main, rebuilt, reviewed as P28-F6 and considered
for *separate* owner-authorized merge. No P28-G9 roadmap change,
merger, deployment, signing, or waiver occurs here.

The standalone owner-promotion gate fails if either browser matrix job is absent; it verifies the trusted independent source job and publication log as well as the real pull_request_target EV-9 observer, and checks the patch-module Git blob before dynamic import. An owner-authored approval after review is not a merge by itself.
