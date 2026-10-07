# Clip 3D: gli errori di range parlano in pixel

`add_clip`/`set_props` ricevono x, y, width, height in px e li convertono in frazioni (units.ts)
prima della validazione Zod. Un valore fuori range tornava quindi come "expected <=1": l'agente
leggeva che lo schema voleva 0–1, ripassava 0.5 e il device finiva a mezzo pixel dal bordo.
Ora il range si controlla nelle unità dell'agente prima della conversione (`shownProblem`), per
ogni componente con unità. Il test `motion-3d-units` verifica per tutti i componenti 3D che il
massimo del catalogo arrivi al bordo del frame e che l'errore citi quel massimo.
