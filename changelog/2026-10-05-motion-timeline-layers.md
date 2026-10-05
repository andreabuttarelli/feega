# Motion editor: timeline a layer

Secondo passo della spec di redesign (timeline, P0).

- Prima una traccia era N sottorighe impacchettate (`stackRows`) con il nome solo sulla prima:
  nel trailer le clip a t=0 finivano sotto 1500px di scroll. Ora una riga per clip (28px)
  raggruppata sotto la traccia (gruppo 28px, collassabile, con il riassunto delle clip quando è
  chiuso). Le righe vengono da `layerRows` in `timeline-layers.ts`, una tabella `ROW_PX` per tipo.
- Nome del layer `Componente · id` (`layerName`): diciotto clip non si chiamano più «Shape». La
  barra tiene kicker e testo su una riga sola.
- Twirl del layer: una riga 24px per proprietà animata con indicatore ◆ (pieno se c'è una chiave
  al frame, mezzo se animata altrove; clic aggiunge/toglie la chiave) e valore al playhead.
  Il valore si trascina (1 step/px, Shift ×10, Alt ×0.1) o si scrive con un clic, nelle unità di
  `units.ts` (px, %, °): scrive con `editAt`/`cameraEditAt`, quindi su una proprietà animata crea
  o aggiorna la chiave al frame. Logica dello scrub in `number-field.ts`.
  Chiavi 9px con forma dall'interpolazione in uscita (◆ bezier, ■ hold, ● linear). Layer chiuso:
  chiavi riassunte in basso nella barra.
- Ruler a passi tondi scelti dallo zoom (1f, 5f, 10f, 1s, 2s, 5s…), etichette solo sui maggiori.
  Playhead rosso `--playhead` con testa nel ruler; work area come banda 4px; marker a triangolo.
- Occhio e lucchetto per layer (`setClipFlags`, già esistente ma senza UI); pick-whip come icona
  in hover sull'header. Riga camera solo se c'è una camera o una clip 3D.
- Tinte: 14% light, 22% dark; tonalità aggiornate (video blu, non più rosso come il playhead).

- Touch: con puntatore grossolano righe 44px e maniglie più larghe; pinch a due dita sulla
  timeline per lo zoom (`pinched`); senza hover le azioni del layer restano visibili sulla riga
  selezionata e sulle righe di gruppo.

Scartato per ora: riordino a trascinamento (restano le frecce in hover), nomi layer editabili
(il doc non ha `clip.name`: serve una migrazione dello schema).
