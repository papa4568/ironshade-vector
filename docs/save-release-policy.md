# Ironshade Vector — Save / Release Compatibility Policy

This document defines the supported save, migration, recovery, and rollback behavior for external Android releases.

## Compatibility contract

- `GAME_STATE_VERSION` is the compatibility boundary for the atomic player + campaign save stored at `ironshade-vector-state-v1`.
- The current release writes game-state version **3** and can read versions **1, 2, and 3**. Versions 1 and 2 are migrated to version 3 on load.
- Any persisted data change that an already-shipped build cannot safely read must increment `GAME_STATE_VERSION` and add an explicit migration plus regression coverage.
- Subsystem schema markers such as Gear and Operator Network remain part of the compatibility check. A release must not silently accept a schema it does not understand.
- The package id remains `app.ironshade.vector`; release continuity also depends on the signing identity described in [android-release-signing.md](./android-release-signing.md).

## Migration guarantees

Startup validates saves before the application module loads.

For a valid supported older atomic save:

1. preserve the **exact raw save bytes** as a verified recovery record,
2. leave the primary save untouched until that backup succeeds,
3. block startup if a verified pre-migration backup cannot be created,
4. migrate and normalize the save only after protection succeeds, and
5. keep the pre-migration snapshot after the upgraded save is written.

A migration is not complete merely because the current build can read the result. The pre-migration bytes must remain available for diagnosis or recovery.

## Recovery behavior

Corrupt or structurally unsafe known-format saves use quarantine recovery:

- preserve the exact raw bytes in IndexedDB when available, otherwise verified localStorage,
- detach the unsafe primary key only after that copy is verified,
- allow a clean save to start only after detachment succeeds, and
- block startup instead of overwriting data when backup or detachment cannot be verified.

This is intentionally different from compatibility failure.

## Incompatible or newer saves

A build that sees an atomic save version or subsystem schema it does not understand must **not** detach, rewrite, normalize, or replace that save.

Startup is blocked and the primary save remains untouched. When storage permits, an additional exact recovery copy is also preserved. The supported recovery path is to install a release that understands that save.

This rule protects users who temporarily install an older build from allowing that build to overwrite progress created by a newer save schema.

## Rollback policy

Android release rollback is performed by shipping a new APK with a **higher versionCode** that contains the previous known-good application code. Do not publish a lower versionCode as the rollback vehicle.

Save rollback has two cases:

- **Same save compatibility boundary:** rollback is supported when the rollback build can read the current `GAME_STATE_VERSION` and subsystem schemas. Normal in-place Android upgrade/data-preservation rules apply.
- **Across a save compatibility boundary:** in-place save downgrade is not supported. The older build must block on the newer save rather than overwrite it. Return to a compatible/newer release; use the retained pre-migration snapshot only through an explicit, tested recovery procedure.

Do not delete a compatibility reader or historical migration merely to simplify a release. Removing support for an already-shipped save version requires an explicit roadmap decision and a replacement recovery path.

## Release verification

Every release that touches persisted state must pass:

- `npm run test:save-migration`,
- the full `npm run build` production/regression gate, and
- the Android APK workflow, including package/signature/runtime verification.

The save-migration suite must cover:

- every supported historical game-state version,
- exact pre-migration backup preservation,
- migration-backup failure locking startup,
- incompatible/newer-save locking without primary-save mutation,
- corrupt-save quarantine and exact-byte recovery preservation, and
- current-version round-trip persistence.

The Android signing/upgrade workflow verifies that app-private data survives a same-signer in-place release update. That OS-level continuity complements, but does not replace, the save-schema checks above.
