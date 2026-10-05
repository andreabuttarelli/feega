# Pre-comp, precompose e adjustment layer nel motion editor

Primi due gap dell'analisi After Effects.

- `doc.comps`: registro piatto di composizioni (nome, durata, tracce video). La clip `Precomp`
  (`props.comp`, `loop`) le riproduce; `trimStart` sposta il tempo locale. Cicli e riferimenti
  mancanti rifiutati in `parseMotionDoc`, `addClip`, `setProps`.
- Render: `flattenComps` (`motion/precomp.ts`) appiattisce le precomp prima di `composeHtml` e
  di `audioPlan`. Preview, export browser e render server passano tutti da lì: stesso HTML,
  nessun iframe. Ogni passata del loop diventa clip con id `<precomp>__<k>__<id>`; tagli e
  keyframe traslati.
- La precomp diventa un gruppo DOM sulle sue tracce: transform, transizioni, effetti e blend
  agiscono sull'insieme. L'adjustment layer avvolge tutti i layer sotto; filtro e blend sono
  accesi solo nel suo intervallo con `tl.set` (deterministico al seek, testato).
- Editor: la vista di una composizione è un `MotionDoc` (`viewOf`/`mergeView`), quindi ogni op
  esistente funziona dentro; undo unico. Doppio clic o "Open" nell'inspector entrano, la
  breadcrumb esce.
- Agente: `precompose`, `edit_comp` (esegue altri tool dentro la composizione),
  `add_adjustment_layer`; test di parità aggiornato.

Scartati: iframe annidati (html-to-image non li cattura), `backdrop-filter` (filtri SVG non
affidabili). Limiti: l'adjustment non avvolge i layer nel mondo 3D della camera.
