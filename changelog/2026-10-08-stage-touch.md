# Preview a dito: tocca di nuovo per il livello sotto, tocca mentre suona

Ticket T5 di `touch-editor/SPEC.md`, senza pinch/pan della preview (già in #259).

- Un secondo tocco nello stesso punto (entro 12px) seleziona il livello sotto, come Alt-clic:
  `pickModeAt` in `scene-select.ts` decide Top/Beneath, testato.
- Mentre il video suona l'overlay di selezione non c'è; ora un velo (`play-catch`) prende il
  tocco, mette in pausa e passa il punto a `SelectionOverlay` (`pickAt`), che seleziona il clip
  lì sotto appena ha misurato i box.
- Punti di maschera, pen e motion path: disegnati piccoli, bersaglio 44px su `pointer: coarse`
  (`data-drawn-small` + `::before`); la regola 44px di T1 li esclude, se no li ingrandiva.

Scartato: modificatori Alt dei grip come toggle nella clip bar.
