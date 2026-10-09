# Scrub embeds follow their own travel, not the page

A hosted scrub embed (Saturn, `/e/c76b6d3b…`) never moved: the host snippet sent the
whole-document scroll fraction, so a short page or a page with only the embed sent a constant,
and the `/e/` page opened alone had `overflow:hidden` and no host at all. Messages and seeks did
work: on a long page the hosted player redrew.

- `host.ts`: `hostMain` (toString'd into `embedSnippet`) sends `progress` = 0 when the embed's top
  meets the viewport bottom → 1 when its bottom leaves the top. A `[data-scroll="N"]` ancestor
  becomes N viewports tall, the iframe sticks, and progress runs while it sticks. `scroll` is still
  sent, so players published before this keep working unchanged.
- `readHost` prefers `progress`, falls back to `scroll`: new players read old snippets.
- `selfScroll`: a scrub player with no host message in `STANDALONE_MS` (500) adds `self-scroll`
  to `<html>` (4 viewports tall, sticky stage) and scrubs on its own scroll; the first host message
  hands control back.
- The last progress is applied on `ready`, so the load-time message is no longer lost.
- `/e/` serves every stored embed through the current player (`upgradePlayer` lifts the stored
  config out of the page and rebuilds it), so embeds already pasted get the fix without a
  republish. Discarded: asking users to republish — the snippet would still talk to the old player.
