Bloom brand assets

- bloom-logo-final.png: canonical user-supplied Bloom logo and wordmark
- icon.png: generated general and legacy launcher icon
- adaptive-icon.png: generated transparent Android adaptive foreground
- splash.png: generated native opening screen artwork
- favicon.png: generated web icon
- bloom-mark.svg: legacy vector reference; not used by the app or generator

Run `npm run generate:brand-assets` to regenerate the derived PNG files from
the canonical supplied logo. The generator preserves the source pixels and
fails if the approved source file changes unexpectedly.
