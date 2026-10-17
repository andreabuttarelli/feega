# Feed and catalogue photos reach the image node

**Before:** `social_account_feed` and `products` wired straight into a generation node (no
`select`, no loop) resolved in `upstream.ts::toUpstreamNode` as `medium: 'text'` with no text and
no URLs. Nothing reached the provider; the prompt "use these photos" ran without references.

**Now:** the fixed wire gives every item's default image field (`DEFAULT_FIELDS` in
`select-sources.ts`: `media` for a feed, `images` for products), flattened in row order —
posts by `posted_at desc`. `resolveUpstreamInputs` caps them to the model's `maxRefs`. Only
stills: the `media` field takes a video slide's cover and skips a video without one, so no
video URL reaches an image input.

**Second defect:** an archived image slide kept its raw Instagram CDN `url` (expiring `oe=`
signature) while only `thumbnailUrl` was swapped for the signed `canvas-assets` copy.
`social-posts.ts::resolveItem` now replaces `url` with the signed copy for every non-video slide.

People screening (`screenRunReferences`) already covers every reference URL; unchanged.
