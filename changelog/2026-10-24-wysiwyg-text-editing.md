# Inline text editor is WYSIWYG

**Before:** `CoreTextEdit` was a textarea with two mirror layers (gradient paint, list
markers). Per-range weight, size, font, colour, underline, links, paragraph spacing and indent
were invisible until commit.

**Now:** a contenteditable whose content is `textBody` from `motion/hyperframes/text-body.ts`,
the same markup the export uses (`TextBodyFor.Editor` only forces one block per paragraph and
makes markers non-editable). `editBody` in `frame-text-edit.ts` binds it to the clip's tokens
and fonts. Every input is read back as plain text (`editable-text.ts`: DOM ↔ model offsets,
empty-line ZWSP skipped), applied to the model (`textRange.retype`), and the DOM is repainted
with the caret restored.

**Decisions:** Enter, paste (plain text) and drop are applied to the model directly; other
edits run natively then are read back; IME repaints only on `compositionend`. Undo is a local
snapshot stack (⌘Z/⇧⌘Z, history inputs), since repainting breaks native undo. Mirror layers
and `gradientSpans` removed.

**Tests:** `canvas-text-edit-rich-wysiwyg` (per-row ink boxes ±4px before/during/after, nested
marker indented). `canvas-text-autowidth-typing` already fails on `dev` before this change
(the free text is never saved as an element node).
