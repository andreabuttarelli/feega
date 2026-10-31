# Components page, round two

- Sets are free elements (transparent, no backdrop), 20 px padding and gap
  (`SET_PAD_PX`, `SET_GAP_PX`). "+" used to go through the frame resize, which
  refits content: variants landed glued; it now only stores the wider node size
  (`onNodeSize`).
- stripe.com import: the Browserless renderer crashed under the
  `everythingInView` IntersectionObserver stub; every later call waited for the
  session and the tree read failed ("detached Frame"). The stub tells each
  target once and hands over to the native observer after 2000; the first look
  no longer finishes animations or forces content-visibility; a page still
  unreadable is read again with the native observer (`Sight`); session 120 s
  (the plan refuses 180 s). A stripe import takes ~4 min: the first try waits
  for the session to end.
- Undo of an import includes its set nodes.
- Agent `component create` (tool-run) homes the main like the app.
- Instance panel: variant chips when a set has one property or at most 6
  variants. Player: top-level instances swap to their `State=Hover/Pressed`
  variant on hover/press.
