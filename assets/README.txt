Bloom brand assets

- bloom-logo-approved.png: canonical user-supplied Bloom logo and wordmark
- bloom-lockup.png: generated exact in-app lockup crop
- lotus-mark.png: generated exact in-app lotus crop
- icon.png: generated general and legacy launcher icon
- adaptive-icon.png: generated transparent Android adaptive foreground
- splash.png: generated native opening screen artwork
- favicon.png: generated web icon
Run `npm run generate:brand-assets` to regenerate the derived PNG files from
the canonical supplied logo. The generator preserves the source pixels and
fails if the approved source file changes unexpectedly.
