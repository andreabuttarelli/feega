# Graph editor: grafico valori e velocità, maniglie, preset

**Perché.** Le curve si sceglievano solo da un elenco o scrivendo quattro numeri. Mancava il
modo di After Effects: vedere la curva e tirare le maniglie.

**Cosa.** Bottone «Graph editor» nella barra della timeline: sostituisce le corsie con il
grafico della proprietà scelta (dai keyframe selezionati, o tutte le corsie numeriche delle
clip selezionate — `graphLanes`). Valore o velocità (unità/s); maniglie trascinabili su ogni
segmento bezier: nel grafico valori muovono i punti di controllo, in quello di velocità
influenza (orizzontale) e velocità (verticale). La matematica sta in `graph.ts` (pura,
testata): `easeHandles`/`withHandles`/`dragHandle`, `fitView`, `curvePoints` sullo stesso
`sampleTrack`. Preset in una tabella (`EASE_PRESETS`): easy ease F9 / ⇧F9 / ⌘⇧F9 attorno al
keyframe (metà uscente sua, metà entrante del segmento prima), curve Apple (CSS/Core Animation)
sul segmento uscente. Copia/incolla dell'ease con l'interpolazione. Fit to view.

`EASE_BEZIER` dà le maniglie degli ease con nome; un test tiene allineata la copia dentro
`sampleTrack` (che deve restare autosufficiente).

**Agente.** `apply_ease_preset`, `set_ease_handles` (influenza in %, velocità in unità/s).
