# Replace a font in the whole video

Roadmap W1-D, TX-16. `replaceFont(doc, from, to)` in `fonts/ops.ts` registers `to`, rewrites
`font` on every clip, styled range and composition clip, then drops `from` from the registry.
A family no longer in the registry (missing) is replaced the same way.

Properties: next to the font of a non-built-in family, "Replace all" (or "Missing · Replace"
when the family is not in the video) arms the picker; the next pick replaces instead of setting
one clip. MCP: `replace_font { from, to }` (uploaded fonts by name too).
e2e `text-font-replace.spec.ts`.
