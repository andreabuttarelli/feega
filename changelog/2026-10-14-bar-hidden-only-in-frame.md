# The bar hides for frame dialogs only while a frame is open

Follow-up to #561. Escape on a frame's export dialog leaves the frame; the inline editor stays
mounted for a fast reopen and keeps its `exporting` state, so `frameBar.covered` stayed true and
the canvas bar stayed hidden on the canvas: no Frame templates, no Image/Video buttons. The rule
now lives in the bar's context table (`yieldsToDialogs`): only the Frame context hides for a
frame dialog; the Canvas context never does.
