# Motion editor: l'agente vede i frame, e il giro di correzioni dal test dal vivo

**Testo che "si resetta".** Causa: le righe di un Title dopo la prima avevano un tween
`fromTo(..., immediateRender:false)` che parte sfalsato: fra l'inizio del clip e l'inizio del
proprio reveal la riga stava nel suo stato naturale (visibile), poi saltava a nascosta e
rientrava. Ora `compose.ts` scrive un `tl.set` allo stato iniziale all'inizio del clip per ogni
tween di template che parte dopo. Secondo difetto, solo pixel: lo stato di elementi nascosti
dipendeva dalla storia dei seek e cambiava la composizione dei layer (rumore sui puntini dello
sfondo). `.fx`/`.li` hanno `will-change` fisso: stessi pixel in avanti, indietro, a caso
(verificato nel browser).

**Title.** Va a capo per parole e, se non entra, rimpicciolisce UNA volta, in `compose`
(`fit.ts`), dentro il box ristretto alla safe area 5%. Niente fit per-frame: il render resta
deterministico. Stima per larghezza media dei glifi, scelta contro una misura a runtime che
avrebbe reso il layout dipendente dai font caricati.

**Timeline.** Clip sovrapposti nella stessa traccia si impilano in righe (`stackRows`): il Kicker
del trailer stava interamente sotto il Title e non si poteva prendere. I grip di trim sono un
layer sopra le barre; su un bordo condiviso vince il clip selezionato.

**Anteprima.** Lo stage usa unità container (`cqw/cqh`) per tenere l'aspect esatto: prima un
`height:100%` forzato rompeva l'aspect-ratio e il player faceva letterbox dentro il box.

**Inspector.** Secondi arrotondati a 0,01 con il punto, parse che accetta virgola o punto.

**set_props.** L'errore elenca le props del componente e manda le chiavi di tempo a
`set_timing`; un clip inesistente elenca quelli che esistono. Il fallimento visto dal vivo era
`duration` passato come prop a un BrandBackground.

**view_frames.** Il server, dentro il tool, scrive nel flusso un data part
`data-motion-frames` con tempi e doc di lavoro dell'agente (le modifiche del turno non sono
ancora salvate); la pagina compone quel doc, lo carica nel player, fa seek e scatta dentro
l'iframe sandbox (`html-to-image` da jsDelivr; `modern-screenshot` scartato: tocca il parent e
fallisce con origin opaca), poi posta JPEG ≤200KB, ≤6, a `/agent/frames`; viaggiano in
`canvas-assets/<org>/<project>/motion-frames/...` e si cancellano appena letti. Senza anteprima
aperta il tool risponde dopo 25 s con un errore che dice di proseguire.

Solo il passo subito dopo `view_frames` va sul modello vision (`llmVisionModel` = il reviewer
Gemini Flash), con i frame in un messaggio utente; i passi dopo tornano al modello testo e le
immagini vengono sostituite da un segnaposto. Prima di mostrare frame a un modello passa la
moderazione sul testo visibile del doc. `ai_calls` riceve una riga per modello: `step.model` di
`streamText` riporta sempre il modello esterno, quindi il modello di ogni passo lo registra
`prepareStep`.

**Self-check.** Dopo un turno che ha modificato il video senza guardarlo dopo l'ultima modifica,
un secondo giro forza `view_frames` sui punti medi delle scene (max 4) e consente una correzione
(max 6 passi, budget 3 viste per turno).

**Mobile.** Sotto 760px: anteprima sopra, transport e timeline scorrevoli sotto, proprietà e agente
come bottom sheet dietro una tab bar.
