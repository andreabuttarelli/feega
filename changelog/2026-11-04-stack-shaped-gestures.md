# Stack gestures measure text the way the canvas draws it

Resize, drop line, gap readout and the corner overlay laid stacks out with the
estimated text measure (`withAutoLayout(doc)`), while the canvas draws and picks
with the shaped typeset. A hug stack of text, which is what "wrap with stack"
makes, then had two boxes: the drawn one and the estimated one. Resizing started
from the estimate, so the handle lagged the cursor by the text error (680 px
drawn, 623 px estimated in mono), the corner overlay sat inside the drawn box,
and the drop line ended at the estimated edge.

The picker now exposes its shaped measure (`textMeasure()`), and
`sizeStackAround`, `laidClip`, `stackLineAt`, `joinStackAt`, the group gesture
and `FrameTools` take it. The estimate stays the default where no fonts exist
(server, tests).

The properties panel (W/H of a stack and of its children) and the padding
handles (`layoutStrips`) read the same measure: GpuFlow publishes it on
`frameProperties.measure`, refreshed when the typeset lands.

Resizing the width of a vertical stack now makes its auto-width texts wrap,
as in Figma: `sizeStackAround` turns each hugging text child into fill width,
auto height (`sizing: auto-height`), with its text alignment taken from the
stack's cross alignment so the lines start where the box used to. The stack's
height keeps hugging, so it grows to hold the wrapped lines. Before, the text
kept a single line and overflowed the narrower stack. Horizontal stacks are
left alone: splitting a row of words into equal wrapped columns surprised more
than it helped.

Checked, not changed: the dragged child covering its
neighbour during a reorder is the drag preview; the drop line marks the slot.
