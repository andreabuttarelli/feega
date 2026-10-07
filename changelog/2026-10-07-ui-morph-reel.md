# UI morph reel

Perché: un prompt di riferimento per reel motion "da Dribbble" chiede una sola forma che fa
morph tra stati UI, spring ovunque, cursore che guida ogni cambio, loop perfetto.

- `src/lib/motion/spring.ts`: spring in forma chiusa (sotto/critico/sovra-smorzata). Un valore
  che cambia target è la somma di una risposta a gradino per cambio: funzione pura del tempo,
  quindi seek, sub-frame del motion blur e loop vedono lo stesso valore. Versione periodica
  (somma sui cicli precedenti) per i loop; coppia di bordi con spring diverse (il bordo davanti
  si allunga). `spring(keys, t, k?, c?)` nelle espressioni.
- `src/lib/motion/ui-morph/`: planner puro (`reelMath`) e componente Custom `UiMorphReel`.
  `reelMath`/`springMath` sono autocontenute e serializzate con `toString()` nel componente,
  così browser, test e gate eseguono lo stesso codice (un test lo verifica).
- Manipolazione diretta: durante il drag il valore viene dal cursore, al rilascio parte una
  spring da posizione e velocità correnti (risposta libera sommata ai gradini).
- Gate `loop-seam` nello stile nuovo `ui-morph`: valori e velocità di ogni canale uguali ai due
  lati della giunzione, clip che copre tutto il video.
- Tool `ui_morph_reel`, template builtin `ui-morph-reel`.

v2 (feedback "troppo veloce"): un cambio ogni 2 beat (`pace`, default 2) con tenuta dopo ogni
morph; loop di 28 s a 120 BPM. Gate `too-dense` (eventi più vicini di `pace.minGap` della tabella
stile, 0,9 s per ui-morph). Cursore più lento su curve (Y in ritardo su X), mai parcheggiato fuori
dalla UI. Stagger per elemento nello scambio dei contenuti. Testo più grande in chart e palette,
toggle a riposo più contrastato. Formato `1:1 1440` (unica eccezione al lato corto 1080).
Param di stile allineati al kit UI (`font`, `ink`, `paper`, `accent`, `line`).

Scartato: camera "fit to state" come operazione generica del doc (vive dentro il reel);
incorporare i pezzi del kit UI come stati (hanno timeline proprie, non si possono pilotare da
molle esterne): il reel ne condivide solo i param di stile.
