# MCP `describe` answers in families, not in one 63 KB dump

**Before:** `describe {}` (MCP tool and `edit` op) returned every one of ~300 ops with its
first sentence: 57 KB of JSON, sent twice on the wire (text + `structuredContent`), and the
server instructions told agents to call it. An external Opus agent burned 134 KB on one call.
`list_shots`, `get_motion_doc` and every other frame read were tagged `write`; `recreate_ui`
looked like it might spend, when over MCP it is refused (no browser on that path).

**Now:** bare describe gives three families with counts per access (825 B); `{family}` gives
op names, access and a summary capped at 80 chars (frame 24 KB, canvas 8 KB, editor 3 KB);
`{op}`/`{ops}` unchanged. Access is one table in `tool-run.ts` (`frameToolAccess`): `read`,
`write`, `spend`, `editor` (needs a chat turn in the app). Describe and find_tools answer text
only. Instructions point at `describe {op}` and `find_tools`. `query` docs say `where`, its
real field.

**Discarded:** names in the bare answer: 302 names alone are 5 KB, over the 3 KB budget.
