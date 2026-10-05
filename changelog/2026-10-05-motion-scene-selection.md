# Selezione nella scena del motion editor

**Perché.** La clip selezionata si vedeva solo nella timeline e nell'inspector: nella preview
niente riquadro, niente maniglie. Per spostare un titolo si scriveva un numero in Offset X.

**Cosa.** `SelectionOverlay.svelte` sopra la preview, accanto a Mask/Pen/MotionPath overlay.

- **Riquadro dall'elemento reale.** La pagina composta risponde a `feega:measure`
  (`hyperframes/measure.ts`): per ogni `[data-clip]` toglie per un istante i transform
  (`.kp/.kf/.ks/.fx/.layer/#world`), misura l'unione delle foglie disegnate (testo per inchiostro,
  non per blocco) e li rimette, tutto sincrono, quindi nessun frame dipinto cambia. Rotazione,
  scala e parent li applica `worldAt` del doc (`scene-select.ts`), al frame corrente.
- **Gesti.** Clic = clip più in alto sotto il puntatore (traccia 0 in cima, nella traccia
  l'ultima clip); Alt+clic scorre quelle sotto, anche sopra una maniglia; clic sul vuoto
  deseleziona. Trascinare sposta (nello spazio del parent), angoli e lati scalano (Shift
  uniforme), le zone fuori dagli angoli ruotano (Shift a passi di 15°), il mirino sposta
  l'ancora compensando x/y perché l'elemento resti fermo.
- **Snapping** a bordi e centro della composizione e delle altre clip visibili, soglia 8 px
  schermo, con le guide.
- **Scrittura.** `writePatch`: se la proprietà ha keyframe, keyframe al playhead in tempo clip;
  altrimenti valore statico. Durante il drag il doc va solo in `previewDoc`; al rilascio una sola
  `edit()` = un solo undo. La lettura mostra i valori con `units.ts` (px, %, °).
- **Touch.** Pointer events con capture, `touch-action: none`, bersagli 44 px.
- **Fonte unica.** La selezione è `selection` della pagina, la stessa di timeline e inspector.

**Agente.** Nessun tool nuovo: il drag scrive solo `transform`/keyframe, già coperti da
`set_transform` e `set_keyframes`.

**Scartato.** Leggere il quad già trasformato dall'iframe con sonde DOM: avrebbe incluso
transizioni e camera, ma il drag deve ragionare nello spazio del doc, e due geometrie diverse
avrebbero fatto saltare il riquadro al rilascio.

**Noto, fuori da qui.** Patch a caldo in rapida successione (un drag) possono far sparire un
Title fino al ricaricamento: riproducibile anche senza overlay, è della patch a caldo.
