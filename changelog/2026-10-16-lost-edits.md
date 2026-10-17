# Edits kept when a frame is reopened

Report (prod 1f19d915): after editing a free box's colour, working on it again showed the colour
from before and later edits did not stick; deselected shapes looked bluish.

Causes, traced with `tests/e2e/canvas-edits-kept.spec.ts` (real stack, 700 ms server lag):

- **Stale session on reopen.** `InlineMotionEditor` mounts from the `earlyFetch` cache (#669).
  Opening a frame fires two `/session` loads (take + selection/warm prefetch); the second stayed
  cached for 15 s. Reopening inside that window mounted the doc from before the edits, at its old
  version: the colour reverted and the next saves started from a stale base. Measured: the reopen
  issued no `/session` and showed `00FF00` while the head held `0000ff`.
  Fix: `earlyFetch.hold(url)` while the editor is open — no prefetch lands, and closing drops the
  cache. `MotionEditorShell` sends a pending debounced save on teardown instead of after it.
- **Poster labelled with the wrong revision.** The editor's poster job read `version` after the
  async shot, so a picture of revision N could be stored as N+1 and shown as fresh on the
  deselected tile (old colour). `posterJob` now reads the revision before shooting.

Checked and not guilty: canvas realtime echo / `adoptFrameHead`, snapshot resync on focus, the
generative-node save scheduler (10 s of continuous typing and the two-tab case pass under lag).

Known: a deselected element with no poster for its revision shows the capture player for ~1 s
before the poster lands (blank, never a wrong colour).
