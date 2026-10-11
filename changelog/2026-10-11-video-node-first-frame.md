# Video node: a wired image on a frame-only model is the first frame

**Why.** Production, 2026-10-11: a video node on `x-ai/grok-imagine-video-1.5-lite` with a cat
image wired to its `images` port failed every time with a bare `render_failed`. Vercel logs:
`input_references is not supported for this model.` OpenRouter lists Grok Imagine (all three)
with `supported_frame_images: ["first_frame"]` and no reference support.

**Before.** `listCapacity` gave the video `images` connector `Math.max(caps.images, 1)`, so a
model with zero reference capacity still took one image — as `input_references`, which the
provider refuses. The canvas video branch also dropped the provider's `reason`, so the node
showed `render_failed` with nothing to act on.

**What.**

- `upstream-inputs.ts`: on a video model with no reference capacity
  (`videoRefCapacity(...).images === 0`), images on the `images` port become the first frame
  when that slot is free; extras are rejected with a reason. Seedance is unchanged.
- `canvas/generate.ts`: the video refusal carries `error: reason`, as the image branch already did.

**Verified.** Same model on OpenRouter: image as `input_references` → 400; as `frame_images`
`first_frame` → completed, 585 KB mp4, $0.03.

