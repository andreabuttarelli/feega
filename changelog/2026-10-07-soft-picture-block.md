# Un'immagine ingrandita oltre i suoi pixel viene rifiutata, non solo segnalata

Nel test reale supasito.com l'agente motion ha mostrato catture 2880×1800 a zoom 1,9–2,4 in pieno quadro: fino a 1,6× oltre la risoluzione nativa, testo morbido a 2–4 s e 7–9 s. `soft-picture` esisteva già con soglia 1,25×, ma era una riga nel `quality` di `view_frames`: l'agente la leggeva e consegnava lo stesso.

Ora ogni modifica che passa da `apply` in `motion-tools.ts` (add_clip, set_props, keyframe, template…) ricalcola `softPictures` e rifiuta la modifica se introduce un'immagine sopra 1,25×: il doc resta com'era e l'errore dice la scala massima nitida. Un'immagine già morbida da turni precedenti non blocca modifiche estranee (confronto per dettaglio), ma non può peggiorare.

Scartato: limitare lo zoom in automatico. Riscrivere keyframe e zoom di nascosto cambia l'inquadratura scelta dall'agente senza che lo sappia; il rifiuto gli lascia la scelta (cattura più nitida o immagine più piccola).
