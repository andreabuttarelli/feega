# recreate_ui: UI vettoriale da una cattura del sito

**Perché.** Il kit di #196 copre i pezzi di dub (shortener, funnel, payouts…). Su un prodotto
diverso (supasito) l'agente non trovava il pezzo e ripiegava sugli screenshot: testo morbido,
video da "montaggio di catture".

**Cosa.** Tool `recreate_ui` nel motion agent: legge una cattura (o una regione, in frazioni)
con il modello vision (`ui-read.ts`, porta `readUi` iniettata da `turn.ts`), valida la
struttura con `UI_STRUCTURE` (layout, blocchi con testi reali, colori hex, font, raggio) e la
trasforma con `recreatedUi` (funzione pura in `ui-kit/kit.ts`) in un componente Custom HTML/SVG:
ingresso a cascata, input che si digita, numeri che contano, cursore che clicca il bottone.
Passa da `writeComponent` + check di determinismo come `write_component` (spende una scrittura
di codice). Con `start` piazza anche la clip con colori e raggio del sito; il font solo se è
registrato nel video.

**Regia.** Il prompt LaunchFilm chiede che lo storyboard nomini, per ogni atto, la UI da
ricreare: pezzo del kit se c'è, altrimenti `recreate_ui`; le catture sono materia prima.

**Scartato.** Ritaglio reale della regione (serve elaborazione immagine): la regione va al
modello come istruzione. Clone pixel per pixel: non è nitido né animabile.
