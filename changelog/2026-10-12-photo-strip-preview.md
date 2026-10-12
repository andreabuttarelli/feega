# Photo strip: picked photos actually show, library card has real photos

- `strip_media` was a runtime variable. Its text default shadowed the media-picker array at
  runtime, so photos chosen in Properties never appeared. Floating media had already dropped its
  media var for this reason; photo strip now does too (test: no `strip_media` var).
- `scripts/component-previews.ts` sample table gains `builtin:photo-strip` (9 Unsplash samples,
  4 added to `static/component-previews/samples/` with credits, captions via an optional
  `values` map); preview regenerated.
