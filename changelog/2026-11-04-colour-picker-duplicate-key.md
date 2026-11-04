# Colour picker closed on drag

Regression from the Styles row (`3de7dfb60`..`581151d00`): swatches were keyed by
`label`, and `colourLabel` upper-cases hex, so `#ff0000` and `#FF0000` collided.
Svelte threw `each_key_duplicate`, which tore the picker down as soon as it
rendered with such a palette. Swatches are now keyed by position.
