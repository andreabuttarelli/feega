# The motion agent keeps seeing its frames; particles count as content

Two production defects in one turn (thread `d6bd8501`, a particles-only video):

1. **Frames vanished after one step.** `visionStep` appended the frames as a user message through
   `prepareStep`, which lasts one step. The fix rounds and the summary round rebuilt the
   conversation without them, while the `view_frames` result still said "the frames follow in
   the next message": the agent reported it never saw them. Now the frames ride inside the tool
   result (`withFrames` in `frames.ts`, applied to every motion tool that stores frames:
   `view_frames`, `write_component`/`patch_component` on a failed determinism check), so they
   stay for the whole turn. `visionStep` only acts when the step model cannot see: it hands
   unseen frames to the vision model once, then strips them. A draw that returns no bytes is
   reported `seen: false`, never `ok` with images to follow.
2. **"The content ends at 0s".** `contentEnd` treated `Particles` (and `Shape`) as scenery, so a
   video made of particles had no content at all. The scenery list is now one exhaustive table
   (`ROLE: Record<ComponentId, Role>` in `fit-duration.ts`): a new component cannot be added
   without declaring whether it is content. `Particles` is content; full-frame `Shape`,
   `BrandBackground`, `Adjustment`, `Null` stay scenery.

Web pictures, audited on the wire (tests assert `input_image` in the request body):
`view_images`, `screenshot_page`, `browse` already sent pixels. `import_image` and
`import_products` returned only ids: they now attach a low-detail view of what they saved (first
picture per product). `view_images` on a page link (a Pinterest pin) follows the page's
`og:image` instead of refusing `text/html`. A chat attachment whose file cannot be loaded now says
so instead of claiming a picture.

Verified live against `anthropic/claude-opus-5.5` on OpenRouter: an image inside a tool result is
described correctly in the next round of the same conversation.

Discarded: keeping the user-message injection and re-sending it every step (pays the images on
every step and still breaks across rounds); provider-specific tables (the gateway Responses API
carries images in `function_call_output` for Anthropic models).
