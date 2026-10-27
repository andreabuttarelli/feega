# Connection dot padding in the top bar pill

**Before.** The dot had a fixed 6px margin, so it hugged the pill's rounded left edge while the
icons on the right sat further in.

**Now.** Its margin is `(--ui-control-h - dot width) / 2`: the dot is centred in a control-sized
slot, like the chat toggle on the other end. No new magic number; follows the control height.

**Discarded.** Padding on `.top-group`: it would shift every other control in the pill.
