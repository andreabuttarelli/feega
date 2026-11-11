# The GPU canvas attaches once on WebKit

Signal: every WebKit load (iPhone emulation, dev and prod) logged
`[core] gpu lost, attaching again device lost` about 3 s in.

Cause, traced with `$inspect.trace`: the attach effect in `CoreFrames.svelte`
ran twice for the same canvas element, size and backend (the bound `canvas`
was set again). Two `WebCore.attach` calls were in flight on one canvas; the
first resolved after its effect was cleaned up and was freed, and freeing it
lost the device of the second. The core then attached a third time.

Fix: attaches are serialized. A new attach starts only after the previous one
settled and was released. The surface size is a `$derived` number, so a new
`area` object of the same size no longer re-runs the effect. Two component
tests cover both.

Measured after: three WebKit iPhone loads with no device loss, one attach.
