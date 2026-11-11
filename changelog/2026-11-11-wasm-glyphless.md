# Perf: drop vello's glyph path from the engine wasm (2.76 MB → 2.07 MB)

The browser engine never builds a vello glyph run: text reaches it as paths (on native,
`gpu-text` outlines it; `Item::Text`/`Item::Glyphs` are skipped by the wasm scene). Yet
`vello_encoding::Resolver::resolve` statically reaches skrifa (outlines, TrueType hinting
interpreter, CFF, autohint), so LTO kept ~0.7 MB of font code that could never run.

The vendored `vello_encoding` gets a `glyphless` feature (forwarded by vendored `vello`) that
turns the `Patch::GlyphRun` arm into a `continue`. Only the wasm build enables it; native keeps
the glyph path. A negative feature because `vello_shaders/cpu` pulls `vello_encoding` with
default features, so an opt-in `glyphs` default could never be switched off.

Corrects the note in `2026-11-11-wasm-size.md`: the fonts twiggy showed are not needed by
canvases with text on the web.
