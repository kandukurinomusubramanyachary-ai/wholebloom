# Bloom branding audit

## Scope and verification level

This audit covers the branding state on 2026-07-30 at baseline commit
`6bf04b5`, plus the uncommitted branding migration observed during the audit.
It inspects the canonical source, every generated PNG, Expo references, the
generator, and every in-app logo-like implementation. No binary asset or
source/generator file was changed by this audit.

Verification used file-type checks, SHA-256, PNG IHDR parsing, decoded RGBA
pixel counts, alpha/artwork bounds, colour sampling, static source inspection,
and a reference search excluding dependency and build-output directories. The
release engineer also regenerated and visually checked the icon, adaptive icon,
and splash from the approved exact-hash source during the audit. Android mask
behaviour, OEM launch screens, and the transition from native splash to the
React splash remain **NOT VERIFIED ON A PHYSICAL DEVICE**.

## Canonical-source finding and provenance

At the start of the audit, `assets/bloom-logo-approved.png` was an **empty
directory** with zero direct or recursive children. A directory whose name ends
in `.png` is not a PNG and could not be read by the generator or an Expo asset
consumer.

During the audit, another release task replaced that empty directory with a
regular PNG file and later removed the transitional final copy. No change was
made by this audit. Before that removal, the approved file,
`assets/bloom-logo-final.png`, and the original user-supplied
`C:\Users\Kandukuri Subramanya\Downloads\bloom-logo-cropped-transparent.png`
are byte-for-byte identical:

- size: 167,783 bytes each
- SHA-256: `DA9D34D38A5139F1E5FA456856A4D8C6846AA80EF9EA11E29FE71EE0928E9A28`
- decoded size: 926 x 558 pixels each

This proves provenance without relying on a visual similarity judgment. The
approved path is now the sole repository master; the removed final file was a
transitional duplicate, not a different design.

## Asset register

All six repository images are non-interlaced, 8-bit RGBA PNGs (PNG colour type
6). Coordinates below are zero-based and bounds are `x,y width x height`.
"Artwork bounds" exclude the exact corner background for opaque derivatives;
for transparent sources they use alpha greater than zero.

### `assets/bloom-logo-approved.png`

- **Type/status:** regular PNG now; initially observed as an empty directory.
- **Role/reference:** current canonical source at
  `scripts/generate-logo-assets.js:7`; not referenced directly by `app.json` or
  React Native source.
- **Provenance:** byte-identical to the original user-supplied download and the
  transitional final file.
- **Dimensions/size:** 926 x 558; 167,783 bytes.
- **Alpha:** 441,512 transparent pixels, 75,196 opaque pixels, zero partial-alpha
  pixels. Alpha artwork bounds are `40,40 846 x 478`, centred at
  `(462.5,278.5)`, exactly the canvas centre.
- **Lotus bounds:** the generator independently asserts `269,40 388 x 304`
  inside its approved crop and rejects dark wordmark pixels in that crop.
- **Colours:** transparent canvas; sampled rose pixels have mean `#EE4D61` and
  median `#F54257`; sampled dark wordmark pixels have mean `#252625` and median
  `#262727`. These are measurements of a varied raster, not replacement palette
  tokens.
- **SHA-256:**
  `DA9D34D38A5139F1E5FA456856A4D8C6846AA80EF9EA11E29FE71EE0928E9A28`.
- **Audit outcome:** valid canonical source after the concurrent filesystem
  correction.

### `assets/bloom-logo-final.png`

- **Type/status:** baseline regular PNG, measured before its concurrent deletion;
  it was a transitional duplicate of the approved source.
- **Role/reference:** baseline generator source and baseline README entry; no
  current app-config or runtime image reference. The uncommitted generator now
  points to the approved path.
- **Dimensions/size, alpha, bounds, colours and SHA-256:** exactly identical to
  `bloom-logo-approved.png` above.
- **Audit outcome:** its current removal eliminates canonical-source ambiguity.
  Git retains the measured baseline as the recovery path.

### `assets/icon.png`

- **Type/status:** generated opaque general/legacy launcher icon.
- **Role/reference:** `app.json:7`.
- **Generator input:** approved lotus crop, scaled to a nominal 600-pixel visible
  width on an opaque canvas.
- **Dimensions/size:** 1024 x 1024; 143,485 bytes.
- **Alpha:** fully opaque; 1,048,576 opaque pixels.
- **Artwork bounds/centering:** `212,276 601 x 472`; centre `(512,511.5)`, within
  0.5 pixel of canvas centre.
- **Colours:** background `#FFFDFE`; no dark-wordmark pixels; sampled rose mean
  `#EE5064`, median `#F44258`.
- **SHA-256:**
  `E3D02188AD363C90D70FBEA806A2506F79C90B91ABF07A6A21CEFAB7529FCBE7`.
- **Audit outcome:** dimensions, opacity and centring are suitable for the Expo
  general icon reference.

### `assets/adaptive-icon.png`

- **Type/status:** generated transparent Android adaptive foreground.
- **Role/reference:** `app.json:37`, paired with `#FFFDFE` at `app.json:38`.
- **Dimensions/size:** 1024 x 1024; 155,911 bytes.
- **Alpha:** 980,318 transparent, 11,829 partial-alpha and 56,429 opaque pixels.
- **Artwork bounds/centering:** `212,276 601 x 472`; centre `(512,511.5)`.
- **Adaptive safety:** measured maximum visible radius is 300.59 pixels. The
  generator limit is 312.89 pixels (`1024 * 33 / 108`), leaving 12.30 pixels of
  radial margin.
- **Colours:** transparent outside the lotus; no wordmark; sampled rose mean
  `#EE5265`, median `#F44258`.
- **SHA-256:**
  `6C5A5EE7C40B8518822DF84B1A383874B13B994329C40A69397C402DE0D938DB`.
- **Audit outcome:** transparent, centred and inside the generator's Android
  safe-radius assertion. OEM mask rendering still needs device verification.

### `assets/favicon.png`

- **Type/status:** generated opaque web favicon.
- **Role/reference:** `app.json:50`.
- **Dimensions/size:** 64 x 64; 2,209 bytes.
- **Alpha:** fully opaque; 4,096 opaque pixels.
- **Artwork bounds/centering:** `8,13 48 x 37`; centre `(31.5,31)`, within 0.5
  pixel of canvas centre.
- **Colours:** background `#FFFDFE`; sampled rose mean `#EE4E62`, median
  `#F54257`.
- **SHA-256:**
  `6495A755A6BE4FB6F0BA0288B2E4AFB2BAB95BAF2C64DD286A90CCBBDB99A7A5`.
- **Audit outcome:** valid and correctly referenced.

### `assets/splash.png`

- **Type/status:** generated opaque native splash artwork.
- **Role/reference:** `app.json:10`, with `contain` resize and `#FFFDFE`
  background at `app.json:12`.
- **Generator input:** the full approved lockup drawn at 720 pixels wide.
- **Dimensions/size:** 1242 x 2436; 114,160 bytes.
- **Alpha:** fully opaque; 3,025,512 opaque pixels.
- **Artwork bounds/centering:** `292,1032 658 x 372`; centre
  `(620.5,1217.5)`, exactly the canvas centre.
- **Colours:** background `#FFFDFE`; sampled rose mean `#EE5063`, median
  `#F44258`; sampled dark ink mean `#262726`, median `#262727`.
- **SHA-256:**
  `F03200A02BC4F63E790894C966B7C769C793E5A12FF8381041E11F3E4A0A7FC3`.
- **Audit outcome:** dimensions, opacity, background and centring match the
  generator and Expo configuration. Native-to-React logo continuity remains a
  separate issue because the React splash uses a different vector mark.

## Generator audit

`package.json:17` exposes `npm run generate:brand-assets`. The generator now
reads `assets/bloom-logo-approved.png`, pins the canonical SHA-256, asserts the
926 x 558 source dimensions, verifies the lotus crop and wordmark exclusion,
uses premultiplied bilinear sampling, and validates dimensions, opacity,
centring, and adaptive safe radius before writing four derivatives.

The generator does not run during install or app startup. It writes the four
outputs directly and has no check-only or temporary-output mode, so it should
be run only in a clean, reviewable worktree. The hashes recorded above are the
expected no-change outputs for the approved source. Any different source hash,
dimensions, crop bounds, or unexpected derivative hash is a stop condition,
not a reason to weaken the assertions.

## Reference and mark inventory

No React Native source imports or renders a repository PNG. Raster assets are
consumed only through Expo configuration; the source masters are generator
inputs only.

| Mark/reference | Locations | Classification | Required action |
| --- | --- | --- | --- |
| Expo general icon | `app.json:7` | Generated approved raster derivative | Keep. |
| Expo native splash | `app.json:10-12` | Generated approved full lockup | Keep; device-check transition. |
| Android adaptive foreground | `app.json:37-38` | Generated approved lotus derivative | Keep; device-check common masks. |
| Web favicon | `app.json:50` | Generated approved lotus derivative | Keep. |
| `LotusMark` | `src/components/BrandMark.js:13-49` | Hand-authored outline SVG paths, not generated from or hash-linked to the approved raster | Treat as an unverified legacy approximation until an approved symbol export exists. |
| `BloomWordmark` | `src/components/BrandMark.js:53-87` | Hand-authored stroked SVG wordmark, not generated from the approved raster | Treat as an unverified legacy approximation. |
| `BrandMark` composition | `src/components/BrandMark.js:91-123` | Combines the two inline vectors in horizontal or stacked layouts | Preserve API until approved internals can replace it. |
| Full `BrandMark` uses | `SplashScreen.js:96`, `AuthScreen.js:183`, `BetaAccessScreen.js:87`, `TodayScreen.js:287`, `AppLockModal.js:78` | Current in-app visual identity | Migration targets; no redesign of surrounding layout. |
| Symbol-only `LotusMark` uses | `MainTabNavigator.js:43`, `MegScreen.js:254,293,642,760` | Current tab and Meg identity | Requires an approved symbol-only export before replacement. |
| Generic profile flower | `ProfileScreen.js:86-87` | Ionicons `flower-outline` labelled "Bloom flower mark" | Confirmed placeholder branding; replace after an approved symbol export exists. |
| Startup text `Bloom` | `StartupDiagnosticScreen.js:92` | Textual fallback, intentionally outside `BrandMark` dependencies | Keep as a resilience fallback unless a replacement is proven startup-safe; do not call it the canonical logo. |
| Beta-result flower | `BetaAccessScreen.js:159` | Semantic eligibility decoration, not labelled as a Bloom mark | No branding migration required. |
| Other flower/leaf icons and textual Bloom mentions | Symptoms, preferences, care content, headings and body copy | Semantic icons or product copy, not marks | No action. |
| `bloom-mark.svg` | Baseline `assets/README.txt` only | Stale textual reference; no SVG exists in the repository or current Git tree | Its concurrent README removal is accurate. |

## Approved master versus in-app `BrandMark`

The raster and inline vector share a lotus-plus-lowercase-wordmark concept, but
there is no evidence that the SVG paths are approved exports of the supplied
master:

- The approved visible lockup is 846 x 478 (aspect 1.77). The stacked splash
  vector preset is approximately 250 x 181 (aspect 1.38).
- The approved raster places a 388-pixel-wide lotus over an 846-pixel-wide
  lockup and has overlapping vertical bounds; `BrandMark` uses separate SVGs
  with a fixed 10-point gap.
- The inline lotus is seven no-fill paths in a 132 x 112 viewBox with a 3.5
  stroke. The wordmark is five no-fill path groups in a 202 x 48 viewBox with a
  3.6 stroke. Neither geometry comes from the generator.
- Runtime vectors use flat `COLORS.logo` (`#ED3F5B`) and `COLORS.logoInk`
  (`#1D1D1B`); the approved raster contains varied rose and ink values measured
  above. Token colours are close abstractions, not byte/shape equivalence.

The practical result is a possible visible morph from the approved native
splash to the unverified React splash. This should be fixed through approved
exports, not by tracing, redrawing, or substituting another generic flower.

## Safe asset migration plan

1. **Canonical file correction - completed concurrently.** Replace only the
   empty approved-path directory with the exact supplied PNG; verify regular
   file type, 167,783-byte size, 926 x 558 dimensions, and canonical SHA-256.
2. **Generator ownership - completed concurrently.** Point `SOURCE_PATH` to the
   approved file, retain its pinned hash and all assertions, and update the asset
   README. Commit the source-path change and approved file together.
3. **Deterministic derivatives - verified during this audit.** Run the generator
   in a clean tree and require the four derivative hashes above to remain
   unchanged. An exact-source rename must not alter the outputs.
4. **Retire the transitional master - completed concurrently.** The exact-hash
   duplicate was removed after generator and visual verification. Git retains
   the baseline recovery copy; add no new references to the retired path.
5. **Obtain approved runtime variants.** Request brand-owner exports for the
   lotus-only symbol, wordmark-only art, horizontal and stacked lockups, and
   reversed use. Prefer supplied SVGs; otherwise create deterministic
   transparent PNG derivatives from the approved source. Do not auto-trace or
   hand-redraw the logo.
6. **Migrate without changing layouts.** Preserve the public `BrandMark` and
   `LotusMark` API, size presets, accessibility contract, layouts, and surrounding
   spacing. Replace only rendering internals after approved variants exist, then
   compare every use listed above at its current size.
7. **Remove confirmed placeholder branding.** Replace the profile avatar's
   generic flower with the approved symbol. Leave Beta and symptom/care icons
   unchanged because they are semantic, not branded.
8. **Protect the diagnostic path.** Keep its lightweight textual label unless an
   approved asset can load without expanding the failure-prone startup graph.
9. **Validate the retired state.** Confirm the generator and live asset docs no
   longer reference `bloom-logo-final`, resolve Expo config, export Android, and
   verify launcher masks plus both splash stages. If rollback is required,
   restore the baseline file from Git instead of creating another master name.
10. **Stop conditions.** Stop if the approved hash changes, a generated hash
    differs unexpectedly, adaptive art leaves its asserted radius, a source
    resolves to a directory/missing file, or approved runtime variants are
    unavailable. Never fill these gaps with a fabricated logo.

## Current conclusion

The native Expo assets now have verified provenance, valid dimensions, correct
alpha treatment, centred bounds, and deterministic hashes. The original
empty-directory blocker was corrected during this release pass.

## Post-audit runtime resolution

After the inventory above established that the handcrafted runtime SVG was not
the approved geometry, the release pass used the audit's permitted deterministic
PNG route. The hash-pinned generator now emits two additional transparent crops
without tracing, recolouring, rearranging, or redrawing any artwork:

- `assets/lotus-mark.png`: 406 x 324, SHA-256
  `C7184E38461032B38B143646E76F6691E1B7432944448E5294B56270558A06E5`;
- `assets/bloom-lockup.png`: 846 x 478, SHA-256
  `042072D9E5873ED1238F1B836DA8E7BE4500EC0A75669637F06B826F8E5CB1E5`.

`BrandMark` and `LotusMark` retain their component names, sizing presets, and
accessibility contract, but now render those exact crops. The React splash,
authentication surfaces, app lock, Today header, Meg avatar, bottom navigation,
and Profile mark therefore use the approved pixels. The generic Profile flower
was removed. Physical-device launcher masks and native-to-React splash
continuity still require the final device matrix.
