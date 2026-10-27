# Follow a teammate, local fonts

Follow was already built (`PeerAvatars` -> `following` -> `followed()` ->
`GpuFlow` `follow` prop, `onUserPan` clears it); the gap audit missed it. This
change adds the demo and the docs page, no behaviour change.

Local fonts, new:

- `FontSource.Local` in the doc schema. `registerLocal` adds a face with all
  weights and italic, since a name is all we know about an installed font.
- `readLocalFonts` wraps `queryLocalFonts`: unsupported, denied (the prompt
  refused) and ready are three states, never a throw.
- `FontPicker` shows an "Installed on this computer" group behind a button, so
  the permission prompt comes from a click. `onpick` now carries a
  `FontOrigin`; `withPicked` is the one table that turns origin into doc ops.
- Export dialog lists local fonts: `localFontNote`. Outline lookup returns null
  for local faces (no file to read).
- Agent: `register_font` takes `origin`, `list_fonts` returns `inVideo` with a
  `local` flag. The agent cannot enumerate the user's machine.

Discarded: embedding the local font file in the doc (licence, size);
a separate `register_local_font` tool (one more tool for one enum value).
