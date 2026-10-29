# Text being edited keeps its slot in auto layout

While the caret was open, `hideText` emptied the clip's `text` so the GPU
frame would not draw glyphs under the DOM editor. Auto layout measures a
hugging text from its `text`, so the paragraph collapsed and the siblings
below slid up behind the editor.

The live doc now hides the clip with `opacity: 0`: the text, and so its
measured box, stay as they are. Discarded: `hidden` — layout skips hidden
children, same collapse.
