# Motion editor: l'agente vede e cambia tutto il doc

Regola dell'utente: ogni parte modificabile di un video motion deve essere leggibile da
`get_motion_doc` e scrivibile da un tool dell'agente.

**Il test che la tiene.** `motion-agent-parity.test.ts` ha una tabella per livello (doc, traccia,
clip, camera): per ogni campo dello schema zod, i tool che lo scrivono e la chiave con cui
`get_motion_doc` lo mostra, oppure `fixed` con la ragione (versione, fps). Il test confronta le
chiavi della tabella con quelle dello schema: un campo nuovo senza riga, o una riga per un campo
sparito, è rosso. Poi verifica che i tool nominati esistano e che il riassunto mostri la chiave.

**Buchi chiusi.** Il riassunto ora porta `trimStart`, la durata delle transizioni
(`in`/`out` sono `{ kind, duration }`), il nome delle tracce e `assets`. Tool nuovi:
`set_track` (nome, posizione), `remove_track` (toglie anche i clip, passando da `removeClips`
così i figli si sganciano), `remove_asset` (rifiutato finché un clip o una maschera lo usa).
