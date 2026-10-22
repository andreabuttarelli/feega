# Canvas frame gaps after #1098

- **Template instance drew black.** `stillFrame` (`canvas/core/frame-source.ts`) rested at 40% of `durationInFrames`; the instance doc lasts 450 frames, its precomp 150, so the still landed on an empty frame. It now rests at 40% of `min(durationInFrames, contentEnd)`. Server posters (`posterSecond`) are unchanged.
- **Publish preview black.** `CompositionPlayer` had no size container, so `MotionPreview` sized its stage from the viewport (`100cqw`, 1440×810) and the 240px box showed its empty top-left. `.composition-player` is now `container-type: size`; gallery and composition-node players get the same.
- **Batch row preview.** `FrameDialogs` forwards `TemplateDialog.onpreview` to `GpuFlow`, which swaps the frame's live doc (`liveDocs`) for the filled row; "Template" and closing the dialog restore the session doc.
- **`canvas-frame-dialogs.spec.ts` images export.** Not a product defect: locally the server renderer loads libs from `PUBLIC_APP_URL` (production), which lags the branch, and times out. Green with `PUBLIC_APP_URL=http://localhost:<port>`; lesson in `LESSONS.md`.
