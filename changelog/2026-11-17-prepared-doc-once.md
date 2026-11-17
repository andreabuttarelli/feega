# A doc is prepared for drawing once per edit, not once per reader

`preparedDoc` memoised only its first two steps (`bound`, `laidOut`); flattening comps,
baking paths, expressions and physics ran again for every caller. After one edit on the
user canvas copy five readers asked for the same doc (text fitting, text measuring,
selection outlines, the frame picker, the patch), ~15 ms per edit at 4× CPU.

The last two steps are now `perDoc` too, keyed on the doc they start from with `only` and
`analyses` as the second key, the same way the first two already were.
