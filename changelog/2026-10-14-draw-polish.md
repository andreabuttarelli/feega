# Disegno nel frame: angoli, punti, frecce, guide, allineamenti

Rifiniture agli strumenti di disegno del frame (#510), alla pari con quello che uno si aspetta da un
editor di design.

- **Raggio per angolo.** `Shape` ha `corners` (`[tl, tr, br, bl]`, 0..0.5 del lato corto); un
  angolo non impostato segue `roundness`, quindi i documenti vecchi (`corners` assente → `[]`) non
  cambiano. Scartato: quattro prop `radiusTL…` con default, che avrebbero sovrascritto `roundness`
  sui documenti esistenti. Properties ha quattro campi (`Control.Corners`), la tela un pallino per
  angolo (`CornerOverlay`, Shift = tutti). `rectOutline` accetta un raggio o quattro.
- **Pen.** Click su un segmento in modifica aggiunge un punto (`segmentHit` + `insertPoint`, split
  di de Casteljau: la curva non cambia forma); Backspace/Delete toglie il punto selezionato invece
  della clip.
- **Frecce.** Una sola tabella (`SHORTCUTS`) con `mode`: in Design spostano la selezione di 1 px
  (Shift 10), in Motion restano i passi di frame. In Design una posizione animata si sposta tutta
  (ogni keyframe), in Motion si keya al playhead (`space.ts`, `WRITE`).
- **Guide.** Lo snap valeva solo nello spostamento: ora anche nel ridimensionamento (`snapHandle`).
  Etichette di distanza verso il vicino più prossimo per lato o il bordo del frame (`spacing`).
- **Allinea/distribuisci nello spazio.** `alignSpace`/`distributeSpace` in `space.ts`; barra in
  Properties e voci nel menu ⋯. Una clip sola si allinea al frame. Per l'agente `arrange_space`
  (motion-tools, quindi anche `motion_tool` via MCP), con box dai props invece che misurati.
