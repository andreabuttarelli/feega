# Forme senza lampeggio, un elemento solo, strumento Frame

Prima una forma disegnata sulla tela libera spariva per ~430 ms (il fantasma del drag se ne andava
al rilascio, il nodo arrivava solo con la risposta di `drawElement`), poi mostrava lo scheletro
grigio per ~1,1 s finché l'editor inline non dipingeva. Dentro un frame il fantasma spariva un
fotogramma prima che il player disegnasse il clip. Traccia per fotogramma in
`tests/e2e/canvas-insert-flicker.spec.ts`: 74 fotogrammi vuoti su 176 prima, zero dopo.

Ora:
- `drawElement` è ottimista: id client (`node_id`, il server lo rispetta), tile da `drawnTile` con
  un poster SVG del disegno, sostituita da `settle` con la riga salvata; il poster finto si toglie
  quando l'editor inline arriva a `Paint.Swapped`. Lo strumento torna su Select solo dopo che la
  tile è dipinta, e `DrawOverlay` tiene il fantasma fino allo smontaggio.
- In Layers un elemento libero è una riga sola, senza la freccia di un frame; la riga resta scelta
  mentre il suo clip è selezionato dentro.
- Strumento Frame (`DrawTool.Frame`, solo contesto tela): clic = frame 16:9 di default, drag =
  frame della misura trascinata (action `drawFrame`, ottimista come gli altri; MCP: `create_node`).

Scartato: scorciatoia `F` — `src/lib/canvas/shortcuts.ts` vieta le lettere nude sulla tela per la
collisione con il prefisso `g`. Scartato anche il comporre l'elemento vero nel browser per il
primo fotogramma: il poster del disegno basta a coprire il salvataggio.
