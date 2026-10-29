# A small free stack keeps following its content

A free Stack element ("New in Feega" badge) rendered clipped ("Feeg") after
padding was added. `freeStackFit` computed the right stage (318×73), but
`hostFit` refused to resize the node: it rejects a node whose aspect differs
from the stage by more than 1%, assuming the user reshaped it. The first fit
had set the node to 137×26.5 → rounded to 137×27, a 1.9% aspect drift at that
size. From then on every fit was refused and the stage stayed 274×53.

The shape check now tolerates one pixel of rounding on top of the 1% slack.
Test: `text-autosize.test.ts`, "a small node rounded to whole pixels off its
stage shape still resizes".

Already clipped elements fix themselves on their next edit.
