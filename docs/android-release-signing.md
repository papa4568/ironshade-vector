# Android release signing

Ironshade Vector's Android workflow supports a persistent release-signing key without storing the private key or passwords in the repository.

## Required GitHub Actions secrets

Set all four repository secrets together:

- `ANDROID_KEYSTORE_BASE64` — base64-encoded contents of the release keystore (`.jks` or `.keystore`)
- `ANDROID_SIGNING_STORE_PASSWORD` — keystore password
- `ANDROID_SIGNING_KEY_ALIAS` — alias of the signing key inside the keystore
- `ANDROID_SIGNING_KEY_PASSWORD` — password for that key alias

If none are configured, the workflow deliberately falls back to the existing ephemeral debug APK so CI remains usable. If only some are configured, the workflow fails rather than producing an ambiguously signed build.

## Create the permanent key once

Generate one long-lived key and keep an offline backup of the keystore and credentials. Example:

```bash
keytool -genkeypair -v \
  -keystore ironshade-vector-release.jks \
  -alias ironshade-vector \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000
```

Encode the keystore as a single base64 value before storing it in `ANDROID_KEYSTORE_BASE64`. Do not commit the keystore, its base64 representation, or any signing password.

## Update continuity

Once the first APK is installed with the permanent release key, every later APK signed by that same key can update the existing `app.ironshade.vector` installation in place, preserving app data and saves.

The APKs produced before persistent signing was configured were debug-signed on disposable GitHub runners. A new release key cannot update an already installed APK that was signed by a different debug certificate. Treat the first permanent-signed build as a signing migration: do not uninstall a save-bearing debug installation until its save data has been backed up or a verified migration path exists.

## Release-candidate enforcement

Normal push CI may continue to produce the verified debug-signed fallback when no persistent signing secrets are configured. This keeps emulator, lifecycle, graphics, and packaging validation available before production credentials exist.

For a distributable release candidate, run **Build Android APK** manually and enable `require_release_signing`. That run fails during signing-mode resolution unless all four persistent signing secrets are present and the configured keystore/alias can be opened. This prevents a release-candidate run from succeeding with an ephemeral debug signer.

## Automated upgrade proof

When persistent release signing is configured, the workflow now creates a release-signed baseline with the immediately preceding version code and the release candidate with the current version code. It verifies both APKs use the same signer certificate, then uses a root-capable Android emulator to:

1. clean-install the signed baseline,
2. launch it and write a sentinel into the app's private data directory,
3. install the candidate with Android's in-place upgrade path,
4. verify the package UID, data directory, first-install timestamp, and sentinel are unchanged, and
5. launch the upgraded candidate and reject runtime crashes.

This upgrade probe is intentionally separate from the debug WebView smoke test. The candidate APK remains a normal non-debuggable release build; the emulator uses root only to inspect private data for CI evidence.

## Workflow verification

Every Android build now records:

- package ID, minimum SDK and target SDK via `aapt`
- APK signature verification and signer certificate SHA-256 digest via `apksigner`
- whether the artifact was `release` or fallback `debug` signed
- release-only baseline/candidate signer continuity and in-place private-data preservation evidence
- APK SHA-256 checksum

The workflow uploads these reports beside `Ironshade-Vector-Android-Beta.apk` so the signer can be compared across releases.
