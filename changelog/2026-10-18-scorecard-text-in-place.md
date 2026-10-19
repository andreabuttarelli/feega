# Scorecard: text step types in place

Since text is edited in place (`text-in-place`), a new text no longer focuses a textarea in
Properties, so the step failed on `toBeFocused` in every run, both browsers. It now waits for a
`[contenteditable]` in any frame (the preview is a srcdoc iframe) before typing, and draws the
text box by dragging: a click-created text is 1920×440 world px, which made the next fit-all
zoom to 5% and starved the frame steps.
