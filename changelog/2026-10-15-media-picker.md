# One media picker for every picture/video slot

Complaint: in compositions and templates a media slot was a text field, "Image or video (id or
link)". Before: Split headline and Scroll story exposed plain string props; asset props, template
asset fields, media lists and the fill image layer were bare grids of canvas assets with no upload.

- `MediaPicker.svelte`: preview (video: first frame + duration), Replace/Remove, and Upload (file
  or drop, with progress), Link (validate, preview, set) and Library (search) tabs.
- Stored values are unchanged. `src/lib/motion/media/pick.ts` reads/writes them: an asset id,
  `video:<id>`, or a link. Slots that only hold asset ids (Image/Video clips, media lists) import
  a pasted link by fetching it and uploading it (`LinkUse.Import`); a CORS refusal says so.
- New prop format `media-item` (single id-or-link string) for Split headline `media` and Scroll
  story images; it renders through untouched. Media lists (`media`) now render in Properties
  (they had no control before).
- Upload: `canvas-assets` via a signed upload URL (XHR for progress), then the canvas page
  `?/upload` action with `into=library` (`register_upload` parity row). Not `brand-knowledge`:
  that bucket holds generated output.
- Canvas frame templates: Customise edits were dropped on insert (the action only took the
  template id). `frame_template` and `add_frame_from_template` now take `values`, the changed
  fields only (`raw-values.ts`), so parity stays one-to-one.
- The uploader is passed as a prop, not Svelte context: component tests mount through a second
  svelte instance where `getContext` throws.
