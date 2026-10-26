# Cmd-drag marquee inside a frame

Shift-drag on empty frame area already boxed elements, but a group was picked as one clip.
Cmd/Ctrl-drag now boxes the drawn leaves: `leafRectsAt` (`motion/gpu/pick.ts`) lists the last
owner of every drawn layer with its rect, so nested elements are picked and the group that holds
them is not. Wired in `GpuFlow.extendPick`; a Cmd-press on an element still deep-clicks it.
Real browser: `tests/e2e/canvas-cmd-marquee.spec.ts`.
