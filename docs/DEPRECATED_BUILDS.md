# Deprecated Bloom Android builds

## Do not distribute these APKs

The three historical APKs below are retired troubleshooting or superseded
preview artifacts. None is the approved Bloom Beta installer. Do not send them
to testers, attach them to launch email, or use them as a rollback target.

Every row below is **DO NOT DISTRIBUTE**. No EAS download URL is recorded here,
and no final build link has been selected.

| Full EAS build ID | Local artifact | Size | SHA-256 | Status and reason |
| --- | --- | ---: | --- | --- |
| `44a0c081-0281-46ed-a3ec-06967f6268af` | `Bloom-preview-44a0c081.apk` | 65.58 MiB | `6AEFB5EAAB897DDF70C3D87E655D4B1A256C11D6104ADA3E29733E3FF4A33257` | **DO NOT DISTRIBUTE.** Version 1.0.0/code 1 is superseded and predates current startup hardening. |
| `87a97dbe-76e0-4f84-8bc8-1f4bafd2b39b` | `Bloom-preview-87a97dbe.apk` | 66.17 MiB | `7CBC40614D992B29E78FE3D3A852560707A09E8361A619F7DD3AE9F1BBC6F3B2` | **DO NOT DISTRIBUTE.** Version 1.0.1/code 2 does not contain the current configured Meg preview endpoint. |
| `93a6a190-445f-4cec-9263-f492e58fc046` | `Bloom-diagnostic-preview-93a6a190.apk` | 66.17 MiB | `5C0014002FEA10450794FB562CE40393ACC50514B3C0038962CD7DCA174F740A` | **DO NOT DISTRIBUTE.** Version 1.0.2/code 3 is a diagnostic artifact, not the final 1.1.0 Beta. |
| `bd638598-2d1b-44d9-9622-c9b6ee02bd64` | No artifact | N/A | N/A | **DO NOT DISTRIBUTE.** This preview build ended in `ERRORED` state and produced no installable artifact. |

The APK files are ignored by Git and are not part of the tracked source
baseline. The sizes and hashes above describe only the local files inspected on
2026-07-30.

## Why “it installs” is not approval

An APK is eligible for Beta distribution only after all of the following refer
to the same build:

- package, app version, version code, signing identity, commit, and build
  environment are recorded;
- Firebase public configuration and the public HTTPS Meg endpoint are present;
- typecheck, tests, Expo Doctor, public Expo config, and Android export gates
  are reviewed;
- the native APK build completes;
- a physical Android phone passes launch, authentication, cycle logging, daily
  check-in, Meg, keyboard, safe-area, and cold-restart checks;
- its EAS link and SHA-256 are entered in
  [BETA_INSTALLATION.md](./BETA_INSTALLATION.md).

Local responsive web checks, an Expo JavaScript export, a successful APK
download, or an install command alone do not satisfy these requirements.

## Handling retired artifacts

- Do not rename a deprecated APK to make it appear current.
- Do not overwrite its build record or checksum.
- Ask anyone who received one of these files to delete it.
- Keep any retained local copy access-controlled and clearly labelled
  deprecated.
- If an EAS project page still exposes the build, label it as superseded when
  the service supports that workflow; do not reuse its link.
- Add a new build to this file whenever it is replaced or fails an acceptance
  gate.

The next approved build must receive a new EAS build ID. Its link belongs only
in the approved-build record after physical-device acceptance; it must not
replace or reuse any identifier above.
