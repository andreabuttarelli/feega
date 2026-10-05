# Motion editor: telefono pieghevole

Richiesta: aggiungere il pieghevole Apple appena annunciato ("iPhone Duo") ai device mockup,
dentro la sostituzione dei device procedurali con modelli scaricati.

**Procedurale, non scaricato.** Nessun modello CC0 o public domain del pieghevole esiste
(Sketchfab al 05/10/2026: solo CC-BY, concept o ricostruzioni di settembre 2026).
Costruito da `apple.com/iphone-duo/specs/`: aperto 164,6 × 117,8 × 5,2 mm, chiuso
84,1 × 117,8 × 11,3 mm, schermo interno 7,6″ 2670 × 1878. Nome generico "Foldable Phone 7.6″".

**Cerniera.** Due metà con il bordo interno dritto (`halfRect`); lo schermo interno è una sola
`CanvasTexture` divisa per UV tra le due metà. La metà sinistra ruota attorno al bordo frontale
della cerniera: a 0° gli schermi si chiudono faccia a faccia, a 180° il device è piatto.
Il dorso sinistro porta le fotocamere, il destro è il vetro dello schermo esterno (nero: lo
schermo esterno non riceve l'immagine).

**Animazione.** Nuova chiave `fold` (0–180, default 180 = aperto) e preset `fold-open`, solo
per i pieghevoli. `lid` resta dei laptop: riusarla avrebbe dato al pieghevole un default mezzo
aperto.

**Rimandato.** I modelli realistici scaricati per gli altri device: il download Sketchfab
richiede un token dell'account, non disponibile in questa sessione. Candidati e licenze in
`docs/legal-review-checklist.md`.
