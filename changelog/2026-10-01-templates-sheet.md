# Templates open in a centred sheet with previews

**Why.** The templates menu was a 3×220px popup above the add bar: tiny
SVG squares for nodes, cramped text, cut off on small screens.

**What.** `CanvasTemplateGallery.svelte` is now a dialog (`ui/dialog`):
category filters (All, Image, Video, Audio, Social), cards with a preview
thumbnail, name, one-line outcome and node-type chips. Arrow keys / Home /
End move between cards, Enter inserts, Esc closes. Full-screen under 768px.
The `onpick(id)` contract is unchanged, so insertion (`CanvasAddBar` →
`ontemplate` → `planTemplate`) is untouched.

**Model.** `CanvasTemplate.category`, `TEMPLATE_CATEGORIES`, `templatesIn`,
`templateThumbnail`, `templateNodeTypes` in `src/lib/canvas/templates.ts`.
A unit test fails if a template lacks a category or its
`static/templates/<id>.webp`.

**Thumbnails.** Generated once with `openai/gpt-image-2.5-flare` on
OpenRouter (cheapest in the catalogue), 11 renders, $0.083 total; resized to
600×400 WebP (q78, ~6–26 KB each). A new template needs a new thumbnail.

**CSS.** Tailwind utilities here are `!important` and layered, so the
dialog overrides sit in `@layer utilities` with `!important` and higher
specificity, like `CanvasSheet`.
