# Hyperlinks on text ranges

Rich text v2, part 1. A text range can carry an address, as Figma's link does.

- `link` joins the run style (`text-runs.ts`): http, https or mailto only, so a pasted
  `javascript:` address is refused by the schema, not by each renderer. `linkOf` turns what a
  person types into an address (bare `feega.app` gets https, empty removes the link).
- The HTML export wraps a linked range in `<a target="_blank" rel="noopener noreferrer">`, so it
  is clickable in exports, embeds and the share viewer. The GPU painter underlines it; the canvas
  does not follow it, because a click there selects.
- Editing: Text · selection has a Link field; the range bar has a Link button and opens it with
  shift-cmd-U. MCP uses the existing `text_style` (`style.link`, null removes).
- Not done: the inline editor's textarea does not paint the underline while editing (it never
  painted bold or italic either; only gradients are mirrored).
