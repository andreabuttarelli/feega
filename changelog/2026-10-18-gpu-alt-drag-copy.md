# GPU canvas: ⌥-drag leaves the original in place

The GPU canvas dragged the original under the pointer and snapped it
back on drop while the copy was created, which the fluidity scorecard
counts as a revert. A dashed ghost now follows the pointer; the
original never moves and the copy lands where the ghost was. Releasing
⌥ mid-drag turns the gesture back into a move.
