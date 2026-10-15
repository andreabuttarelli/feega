# Generate icons apart from draw tools

With the draw tools always in the canvas bar, the Text tool and Generate text both showed lucide
`Type`. `ADDABLE_ICON` (the one icon table) now maps the generation mediums to composed icons
(`components/canvas/icons/Generate*.svelte`: a base glyph plus a `+` badge, `GenerateBadge`):
text → `Pilcrow`+, image → `Image`+, video → `Video`+. Draw tools keep their `ACTIONS` icons.
A unit test holds that no generation medium shares a draw-tool icon.
