# Editor icons: tooltip, captions, Keyboard & gestures guide

User: "many of the icons — I don't know what they are". Icon buttons were labelled only by a
native `title` (hover-only, slow, invisible on touch, no shortcut on most).

- `src/lib/motion/actions.ts`: one table, `ACTIONS`, keyed by every `Command` plus `Tool`
  (buttons without a key): name, icon, guide group, where to tap. The shortcut is read from
  `SHORTCUTS`, never restated.
- `src/lib/motion/tooltip.ts`: the `tip` action. Hover 400 ms; keyboard focus at once (a mouse
  click's focus does not); touch long-press 500 ms shows it and swallows the click that follows.
  `placeTip` keeps it on screen and flips it above at the bottom edge.
- `IconButton.svelte`: the only icon-only button in the editor; `aria-label` and tooltip are the
  same text. A perfect circle (rule "cerchi o rettangoli"). `Caption.Wide` adds the name next to
  the icon from 1440 px: null, precompose, snap.
- `ShortcutHelp.svelte` became the Keyboard & gestures guide (Playback, Edit, Timeline, View):
  icon, name, keys, touch gesture. Reached with `?`, from the toolbar and from the `⋯` menu (now
  icon + text).
- `actions.test.ts` scans the editor's Svelte files: a `<button>` holding only an icon fails.

Discarded: the bits-ui Tooltip (no long-press, needs a provider); a second dialog next to the
shortcuts one.
