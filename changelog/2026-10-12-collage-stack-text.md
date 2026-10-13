# Collage stack: free background text

Feedback: the background lettering had to accept any text and use a normal
font. The `word` prop (24 chars, italic 900, outline) becomes `text` (300
chars), set upright in Inter Tight with a selectable weight, solid by default
(outline still available). `fitLetters` wraps the text into up to eight
lines and picks the size that fills the short side without a line copy
exceeding 1.6x the long side; each line repeats and drifts, alternating
direction. `letterSize` is now the largest size, not a fixed one. Instrument
Serif removed from the font choices.
