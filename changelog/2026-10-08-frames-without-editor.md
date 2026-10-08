# view_frames non fallisce più quando il browser non c'è

**Prima.** `view_frames` chiede i frame al browser attraverso lo stream della chat e aspetta 25 s
che li carichi su Storage. Quando il client non ascolta (stream tagliato, telefono in background,
tab chiusa) ogni chiamata aspettava 25 s e tornava `ok: false` «no editor preview answered»: per
l'utente un errore a ogni sguardo, per l'agente fino a tre attese inutili per turno.

**Diagnosi.** In produzione (8/10) le chiamate fallite non hanno lasciato alcun jpg in
`canvas-assets/…/motion-frames/`: il browser non ha mai ricevuto la richiesta. Con lo stream
attaccato il percorso funziona: la spec e2e nuova manda due richieste, anche col doc reale di un
turno fallito (LiquidBlob), e i frame arrivano in meno di 3 s.

**Ora.**
- `turn.ts` avvolge lo stream: quando il client lo cancella il turno lo sa (`Client.Gone`) e
  `frames` torna `null` subito, senza aspettare.
- `view_frames` con `null` risponde `ok: true, seen: false` e una nota «frames unavailable: the
  editor is not open»: l'agente prosegue, `checkedAt` non avanza (il cambiamento resta non visto).
- Il check dei componenti custom era già differito: resta `Unchecked` e lo fa l'editor quando si
  apre.

**Scartato.** Render dei frame lato server: nelle funzioni Vercel non c'è Chromium; l'unico
browser headless è il farm (Vercel Sandbox): avvio sandbox + Chromium + asset ≈ 30–60 s per
sguardo, minimo fatturato 1 min di memoria per sandbox, e non si può provare nei test. Più lento
della finestra di 25 s che sostituirebbe, per un controllo che l'editor fa gratis quando si apre.
