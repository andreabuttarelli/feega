# gpu-full loads the font subsets of the text it actually draws

Frames on the canvas reported `Kicker:glyph` ("€ 129", "LINK IN BIO") in the browser while Node,
fetching whole TTFs, drew them. The loader picked unicode-range subsets from the raw doc, but the
painter draws the prepared doc: text bound to a variable, comps flattened, expressions baked. A
Kicker showing a bound "€ 129" asked only for the subsets of its placeholder. The loader now picks
subsets (and families) from the same `preparedDoc` the painter uses, so it takes the doc's tokens.
