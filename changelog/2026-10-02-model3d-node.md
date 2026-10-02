# 3D model node

**Why.** A product photo should become a 3D object you can spin, download and re-render.

**What exists now.**
- Node type `model3d` (DB check widened with asset type `model3d` and `ai_models.catalogue = 'model3d'`;
  migration `20261002_model3d_node.sql`, applied).
- Models: Wiro category `3d-generation`, synced by `fetchWiroCatalogue`. Prices from Wiro on 2026-10-02:
  TRELLIS.2 $0.25 (512) / $0.30 (1024) / $0.35 (1536) — default; Hunyuan3D-2.1 $0.30 untextured / $0.90
  textured; Pixal3D $0.30 / $0.42. All image-to-3D only: no Wiro tool takes a prompt, OpenRouter has no
  3D output. Text → 3D is text → image → 3D on the canvas.
- These three ids are reviewed (`REVIEWED_MODEL3D_MODELS`) and run in standard projects too; every other
  `wiro/` model stays uncensored-only. In uncensored projects the likeness guard applies to 3D
  references (no uploaded photos or catalogue faces).
- Run: `runModel3dNode` → `runWiroNode` (moderation screen, `wiro:` job) → `reconcileWiroNodeRuns` picks
  the GLB output (`PRIMARY_OUTPUT`), keeps an image output as `posterRefId`, deposits to `brand-knowledge`.
- AI marking: GLB has no XMP slot, so `markGenerated` writes a `KHR_xmp_json_ld` packet (IPTC
  DigitalSourceType, AISystemUsed, credit) referenced from `asset.extensions`; binary chunk untouched.
- Viewer: `Model3dViewer.svelte`, three.js (already a dependency) loaded only when the node is on
  screen; poster first, orbit/zoom/auto-rotate, GLB download, share page too.
- Render views: four snapshots (front/right/back/left) rendered client-side from the viewer, uploaded
  as image nodes. No extra model call, no cost. The node has no output port.
- Template `product-3d` (category 3D).

**Discarded.** `<model-viewer>`: a second 3D runtime when three.js is already bundled.
