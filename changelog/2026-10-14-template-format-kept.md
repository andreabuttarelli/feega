# A template keeps the format picked in its detail sheet

`ComponentDetail` passed its draft to `onadd` only when a field was edited (`touched`). Picking
9:16 on a card and pressing "Add to canvas" dropped the draft, so the frame landed in the format
the library opened on (16:9). `draftToAdd` sends the draft when it was edited or its format
differs from the opening one.
