# write_script accetta un brand fittizio, dichiarato

Un video demo con un brand inventato (Ondrafo) non poteva salvare il copione: `write_script`
esigeva `analyze_site` e citazioni parola per parola da un sito che non esiste, e il gate restava
con il warning `no-script`.

Ora lo script porta `brand: real | fictional` (default `real`). La tabella `SOURCING` in
`motion-tools.ts` dice per ogni tipo cosa serve: `real` legge il sito e verifica ogni citazione
come prima; `fictional` non legge nulla e prende le fonti come copy del brand stesso. Il brief si
apre con "Fictional brand", così chi lo legge in chat non lo scambia per un brand vero. La
descrizione del tool vieta di usarlo per un brand reale.

Scartato: saltare il gate `no-script` per i video senza sito (nasconderebbe proprio il caso in
cui l'agente non ha scritto il copione).
