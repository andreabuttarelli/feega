# Text editing: undo by word, autolist, strikethrough

From the round-2 text/shortcut audit (#7, #15).

- **Undo by word.** `CoreTextEdit` recorded an undo snapshot on every `beforeinput`, so ⌘Z took
  back one letter. `TypingBurst` opens a step on the first key, after a pause of a second, on a
  space after a word, and on a switch between typing and deleting; paste and undo/redo end the
  burst.
- **Autolist.** `- `, `* ` or `1. ` at the start of a paragraph of a styled text removes the
  marker and sets the list (`autoList`), one undo step.
- **⌘⇧X** toggles strikethrough on the range. ⌘⇧ combos no longer fall through to ⌘B/⌘I/⌘U.

Not done: Shift+Enter as a soft break. The text model has one line separator; a soft break
inside a list item needs a second one in `text-lists`, renderer and editor.
