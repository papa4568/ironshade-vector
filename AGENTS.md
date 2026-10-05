# Ironshade Vector — Agent Map

Keep always-on context small. Read only the documents relevant to the current task.

## Sources of truth

- `docs/content-roadmap.md` — active/future executable work. Unless the user gives a different task, the first unchecked executable item is next.
- `docs/external-qa.md` — validation that requires unavailable physical hardware, manual inspection, credentials, permissions, or other external access. Do not execute this file as the normal coding queue.
- `docs/content-roadmap-archive.md` — completed work and verification history. Do not execute work from this file.
- `docs/product-constraints.md` — stable product, design, platform, and performance constraints.
- `docs/design-system.md` — shared UI rules for presentation work.
- `docs/android-release-signing.md` — release-signing guidance when Android signing/distribution is relevant.
- `docs/save-release-policy.md` — save compatibility, migration, recovery, and rollback rules for external releases.
- `package.json` — authoritative build and test scripts.

## Execution

- User instructions override roadmap selection.
- Work on one roadmap item at a time.
- One roadmap checkbox should fit one focused implementation → targeted test → final verification → APK cycle.
- Split an item before coding when it contains independent implementation or verification cycles.
- Inspect only the code, tests, docs, dependencies, git state, CI evidence, and artifacts needed for the selected task.
- Preserve unrelated changes and existing user data.
- Prefer established project patterns over new abstractions or dependencies.
- Use the narrowest relevant checks while iterating. Run the required final production/CI/Android gates only after the implementation is a credible completion candidate.
- A technical failure is work, not a blocker while a concrete next technical action exists. Diagnose from evidence, make the smallest reasonable correction, and change the hypothesis if a fix does not work.
- Do not mark or archive a roadmap item until implementation and all technically available required verification evidence exist.
- If an active item appears already implemented, verify it from code/tests/commit/CI evidence before archiving it.
- If an item is partially complete, keep it active and narrow it to the remaining work rather than marking it done.
- Never treat cancelled, obsolete, superseded, or externally waiting work as completed.

## Git workflow

- One roadmap item normally uses one implementation branch and one pull request.
- Keep implementation fixes, test fixes, CI fixes, and verification corrections on that same branch/PR rather than creating competing implementations or temporary QA PRs.
- The PR head revision is the candidate revision for final verification.
- Do not push unfinished implementation directly to `main`.
- Merge only after the required checks for that item pass.
- Create additional branches/PRs only when work is genuinely independent or the existing branch cannot safely represent the change.

## External QA

- Work that cannot be completed with repository/tool access belongs in `docs/external-qa.md`, not in the executable queue.
- External QA may block release acceptance, but it does not block later independent engineering work unless an explicit dependency says otherwise.
- If external QA reveals a code defect or optimization need, create a focused executable roadmap item for that engineering work.

## Roadmap hygiene

- The active roadmap contains only unchecked executable engineering work.
- Checklist order is authoritative; do not maintain a duplicate "next task" section.
- Move verified completion detail to the archive and remove it from the active roadmap.
- Move hardware/manual/external-only acceptance work to `docs/external-qa.md`.
- Keep permanent rules in `docs/product-constraints.md`, not in the active queue.
