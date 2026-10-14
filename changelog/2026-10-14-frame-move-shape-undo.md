# Frame nuovo dalla forma dell'elemento; ⌘Z dopo uno spostamento fra frame

Due difetti rimasti da #512.

- **Letterbox.** Un elemento lasciato sulla tela vuota diventava un Frame col doc della forma
  dell'elemento, ma il nodo nasceva con `newMotionData(formatOf(doc))`: un aspetto non standard
  cadeva su 16:9 e il nodo, senza `width/height`, prendeva la misura del formato. Ora
  `frameNodeOf(doc)` dà dati e misura (`frameNodeSize`) e `frameStore.create` scrive anche la misura
  (`resizeNode`). Resta aperto: un ridimensionamento a mano del nodo chiuso (`frameFit`) usa ancora
  `FORMATS[format]`, perché il nodo non porta l'aspetto del doc.
- **⌘Z nell'editor aperto.** Dopo uno spostamento fra frame l'undo locale rimetteva solo il frame
  di partenza. L'editor ora chiede alla tela se il prossimo passo di undo è suo (`CanvasUndo.owns`:
  il gesto in cima allo stack ha scritto questo nodo a questa versione, `writesFrameAt`); se sì,
  e non ci sono modifiche locali in attesa, il ⌘Z va al gesto combinato della tela, che rimette
  entrambi i frame, e l'editor riprende la testa. La scelta è una tabella (`UNDO` per `UndoRoute`).

Test: unit (`frameNodeOf`, `writesFrameAt`, `nextUndo`), e2e in `canvas-move-elements.spec.ts`
(rossi prima, verdi dopo).
