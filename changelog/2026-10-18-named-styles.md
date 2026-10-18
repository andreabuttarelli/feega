# Named text and colour styles in motion docs

`doc.styles` (optional, so old docs parse unchanged) maps a name to a text style
(font, size, weight, tracking, leading, color) or a colour style. A clip links to
one with `styleRef`. Applying writes the style into the clip props; redefining a
style rewrites the props of every linked clip, so renderers need no change.

A colour style paints `color` where the component has it, else the fill stack.
Only top-level clips are linked; clips inside compositions are not yet.

Inspector "Style" section picks, detaches or saves the selected clip's look.
Agent parity: one `named_style` tool (define/apply/detach/remove/list), one name
because the canvas chat prompt lists every editor tool name within a budget.
