# Frames build side by side

`frameBuilder` sent every frame to one worker, so six landing pages built one after another.
It now keeps up to `hardwareConcurrency - 1` workers (at most 4). A build goes to an idle
worker, otherwise to the least busy one. One dead worker still fails the builds it holds and
turns the builder off; the main thread then builds as before.

The landings bench gains about 0.6 s at 1x and 1.6 s at 4x on a cold open (see the PR). Each
worker loads its own fonts, so the gain is smaller than the worker count suggests.
