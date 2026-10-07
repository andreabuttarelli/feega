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

Scartato: camera "fit to state" come operazione generica del doc (vive dentro il reel);
risoluzione 1440 nel doc (il limite resta 1080; il render a 1440 passa dal device scale).
