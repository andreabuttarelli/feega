# Timeline: marker, work area, hide/lock/solo/shy, ricerca, disposizione

**Perché.** Mancavano gli strumenti di After Effects per orientarsi e lavorare su molti layer.

**Cosa.** `organize.ts` (puro, testato). Doc: `markers` (video) e `clip.markers` (tempo della
clip), etichetta unica per proprietario, punti di snap, risolti per nome (`markerFrame`);
`workArea` {from,to} con loop in anteprima (B/N in/out, M marker). `hidden`/`locked` su
tracce e clip: il compositore toglie i nascosti (`withoutHidden` prima di `bakePaths`), il
lock blocca trascinamenti e `arrange`. Solo e shy sono solo stato dell'editor
(`shownTracks`), come la ricerca layer. Selezione multipla: nudge ([ ] e ⇧[ ⇧]), sequence,
stagger, align start/end, distribute.

Campi tutti opzionali: i doc esistenti restano validi senza migrazione.

**Agente.** `set_marker`, `remove_marker`, `set_work_area`, `set_visibility`,
`arrange_clips`; `move_clip` accetta `marker`; `get_motion_doc` e tabella di parità aggiornate.
