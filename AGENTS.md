# Ironshade Vector — Agent Map

Keep always-on context small. Read only the documents relevant to the current task.

## Sources of truth

- `docs/content-roadmap.md` — active/future executable work. Unless the user gives a different task, the first unchecked top-level item is next.
- `docs/content-roadmap-archive.md` — completed work and verification history. Do not execute work from this file.
- `docs/product-constraints.md` — stable product, design, platform, and performance constraints.
- `docs/design-system.md` — shared UI rules for presentation work.
- `docs/android-release-signing.md` — release-signing guidance when Android signing/distribution is relevant.
- `package.json` — authoritative build and test scripts.

## Execution

- User instructions override roadmap selection.
- One roadmap checkbox should fit one focused implementation → test → build → APK verification cycle.
- Inspect only the code, tests, docs, dependencies, and git state needed for the selected task.
- Preserve unrelated changes and existing user data.
- Prefer established project patterns over new abstractions or dependencies.
- Use relevant targeted checks during iteration; run the repository's required production/build gates before calling work complete.
- Do not mark or archive a roadmap item until implementation and required verification evidence exist.
- If an active item appears already implemented, verify it from code/tests/commit/CI evidence before archiving it.
- If an item is partially complete, keep it active and narrow it to the remaining work rather than marking it done.
- Never treat cancelled, obsolete, or superseded work as completed.

## Roadmap hygiene

- The active roadmap contains only unchecked executable work.
- Checklist order is authoritative; do not maintain a duplicate "next task" section.
- Move verified completion detail to the archive and remove it from the active roadmap.
- Keep permanent rules in `docs/product-constraints.md`, not in the active queue.
