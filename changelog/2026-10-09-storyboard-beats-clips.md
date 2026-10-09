# Storyboard: drawn flow, beats tied to clips, CLI and MCP

- Flow lines were saved but never drawn: a `doc` declares no input ports, so `CanvasTile`
  rendered an empty list of typed handles and no plain one, and xyflow dropped every edge into a
  card (`targetHandle: 'text'` named a handle that did not exist). A tile with no typed inputs now
  draws the plain input; storyboard edges land on it (`targetHandle: null`). The same fix lets a
  user draw a "groups with" line into any no-input tile, as `connect-rules.ts` always intended.
- `link_storyboard_beat` stores `beat: { editor, clipIds }` on a card; `read_storyboard` returns
  `clip_ids`. The card shows "Play in video" → `?clip=<id>`; the editor seeks to that clip's start
  on load (`clipSeek`). The brief card is shown before anything is built, so it links the board,
  not a beat.
- `GET/POST/PATCH /api/v1/motion/[nodeId]/storyboard` (`storyboard-api.ts`), CLI
  `feega motion storyboard`, MCP `get_storyboard`, `write_storyboard`, `edit_storyboard_card`.
  Media validation moved to `boardMedia` so the tool and the endpoint share it.
