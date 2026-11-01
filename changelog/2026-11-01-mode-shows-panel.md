# Picking a mode brings its panel to the front

Code and Play show their inspectors inside the Properties tab. With the Chat (or Guides) tab in
front, picking Code or Play in the bottom bar changed nothing visible: the panel was there,
behind the chat. Seen on production and dev in the release QA sweep.

GpuFlow now selects the Properties tab whenever the editor mode changes (same move `CodeFrame`
already makes when a code frame is selected). The first value is not a change, so opening a
canvas keeps the tab the person left. `mode-panel-from-chat.spec.ts` covers Code and Play.
