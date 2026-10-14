# A new frame shows its picture on the canvas

A frame added from a template showed a black clapperboard forever. `MotionNode` captures the
first frame as soon as `MotionPreview` mounts, but the hyperframes player loads async: `shoot`
posted to an iframe that did not exist yet, failed with "preview not ready", and the empty
still was cached as the poster. Reloading repeated the race.

`previewDriver.whenLive()` resolves on the player's first `ready`; `still` waits for it inside
the exclusive queue. Measured in the browser: the tile showed no poster in 2/2 runs before,
showed it after.
