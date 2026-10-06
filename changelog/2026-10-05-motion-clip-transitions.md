# Transizioni tra clip (giunzioni)

**Perché.** Esistevano solo transizioni in/out per clip: tra due scene c'era sempre un
fotogramma quasi nero (blackdetect sullo showcase: 0,1–0,2 s a 0, 12,5 e 18 s). In `transitions`
non c'era nulla da completare: il modello è nuovo.

**Cosa.**

- `junction-model.ts`: una tabella `JUNCTION` (cross dissolve, dip to black, push left/right,
  wipe, zoom through, blur dissolve). Ogni riga dice come si muove la clip che esce e quella che
  entra, su tutta la durata o su una metà, con l'ease; `incomingBelow` per i tipi che richiedono
  la clip entrante sopra (dissolve, wipe) quando sta sotto.
- Il dato sta sulla clip che entra: `clip.junction {kind, durationInFrames}`. La clip che esce è
  quella che finisce esattamente dove l'altra comincia (prima sulla stessa traccia).
- `withJunctions` (in `composeHtml`, prima di flatten/bake): sovrappone le due clip centrando la
  transizione sul taglio (metà prima, metà dopo), sposta keyframe e `trimStart` della entrante,
  azzera l'out della uscente e l'in della entrante. Preview, export e farm usano la stessa pagina.
- Agente: `set_clip_transition`; `get_motion_doc` mostra `junction` con la clip di origine.
  Tabella di parità aggiornata.

**Non fatto.** UI nella timeline/inspector: quei file sono in rifacimento da un'altra PR; la
funzione oggi si usa dall'agente. Espressioni e fisica della clip entrante non vengono spostate.
