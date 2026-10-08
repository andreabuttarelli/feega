# Un render sul server fermo lo dice

Prima: nel test Dub il render è rimasto a "Rendering frames… 0/450" per 30 minuti. In locale con
`DEV_CRONS` spento il tick `/api/v1/canvas/runs/tick` non gira, quindi nessuno raccoglie i pezzi
del farm; ma anche in produzione un farm bloccato mostrava lo stesso 0/N per sempre. Il progresso
avanza a chunk, quindi un video di un solo chunk resta a 0 fino alla fine anche quando va bene.

Ora `ExportDialog` segue il segno del progresso (`watchProgress`: stato, fase, chunk fatti) e
`renderStall` decide con una tabella per coda: `RenderQueue.Stopped` (dev senza `DEV_CRONS`, da
`renderQueue()` nel load) è fermo subito; `RenderQueue.Ticking` è lento dopo `STALL_AFTER_MS`
(5 min) senza movimento, ben oltre i 90 s di budget per chunk. L'avviso offre "Render in this
browser" (annulla il run, la riserva di crediti torna, e passa all'export nel browser) accanto a
"Cancel render".

Scartato: un timeout lato server che fallisce il run da solo. Il reconcile esiste già per i pezzi
scaduti; qui mancava solo che l'utente lo vedesse.
