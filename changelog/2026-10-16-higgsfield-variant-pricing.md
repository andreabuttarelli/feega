# Higgsfield prices per duration × resolution

Seedance 2.5 and Genjutsu price by duration and resolution together; the
catalogue priced one key per model (`priceBy: Variant`). `priceBy` is now a list
of variants: every combination gets its own `/estimate` call and price line,
and both the picker (`taskChoice` → `creditsForRun`) and the bill (`jobQuote`)
match the line on both keys. A model with one missing estimate is still left
out of the catalogue. `higgsfieldModelRows` takes the model list as a parameter
so a test can price a model before it ships.

No public entry: existing models keep one key; nothing visible changes.
