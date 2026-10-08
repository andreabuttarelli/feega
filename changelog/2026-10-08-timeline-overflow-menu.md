# Toolbar della timeline: sei controlli e un ⋯

Ticket T2 di `touch-editor/SPEC.md`. La toolbar aveva 16 controlli in una riga; su telefono e
tablet scorreva di lato e Undo poteva finire fuori schermo. Ora: Add, Split, Duplicate, Delete,
Snap, `⋯`. Undo/redo stanno nella barra in alto, in ogni taglia.

Il `⋯` apre `OverflowMenu`, costruito dalla tabella `ACTIONS`: un'azione con `menu:
MenuSection.X` sta nel menu (Layer, Time, Keyframes, View), con la sua scorciatoia a destra.
Arrange compare in testa quando ci sono più clip selezionate. `placeOf(id)` dice dove si tocca
un'azione; un test fallisce se un `Command` non ha una superficie toccabile (un gesto da solo
non basta).

Spostati nel menu: Null parent, Precompose, marker, work area, Clips/Graph (ora "Graph
editor"), zoom, Mark beats / Cut to beat, la guida. Tolto lo slider dello zoom: resta pinch,
`+`/`−` e il menu. Il menu misura lo spazio sopra il bottone e non esce dallo schermo; su
telefono è un foglio dal basso.
