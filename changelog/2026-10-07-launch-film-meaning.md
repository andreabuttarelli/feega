# Il launch film parte da una ricerca con fonti, e i cursori cliccano sui bottoni veri

Supasito v2 era pulito ma vuoto: UI con contenuti generici, nessun problema riconoscibile, e cursori che cliccavano accanto ai bottoni.

**Ricerca e script.** `analyze_site` legge la home e fino a 4 pagine dello stesso sito scelte per parole chiave (pricing, how it works, FAQ, clienti), in sezioni tipizzate (`site-copy.ts`). Il nuovo tool `write_script` salva sul doc (`doc.script`) ricerca e quattro atti; rifiuta ogni benefit, numero, prova o promessa la cui citazione non compare parola per parola nella pagina indicata. Restituisce il brief da mostrare in chat. Il gate segnala `no-script` (warning) su un launch film senza script: bloccante avrebbe fermato anche le modifiche minime a video esistenti.

**UI piene.** Gate `empty-ui` (bloccante): un pezzo del kit lasciato sul testo di esempio, testo generico (lorem, "Item 1", ...) o la stessa riga ripetuta su quasi tutte le card. Il caso v2 ("Up to date" su cinque card) è un test.

**Anchor e click-miss.** I pezzi del kit marcano i loro elementi cliccabili e il loro cursore interno mira all'elemento misurato nel DOM, non a coordinate fisse: in v2 il cursore del prompt box cadeva 40 px a sinistra del tasto send, quello dell'hero sotto il bottone. Lato server `ui-kit/anchors.ts` modella la posizione di ogni anchor dal layout del pezzo e dai suoi testi (verificato contro il browser su 16 casi, tolleranza 10 px); `clicks.ts` la porta a schermo attraverso trasformazioni del clip, parent, precomp e camera. `click_ui` posa un `UiCursor` che clicca sugli anchor; `UiCursor` ora usa coordinate del box del clip (prima erano di un riquadro 1600×900 al centro) e tempi espliciti. Il gate `click-miss` (bloccante) controlla ogni click del cursore contro il suo bersaglio, e ogni pressione del reel UI morph contro la forma. Il reel lasciava il cursore fermo sotto il toast: ora entra nella forma all'ingresso di ogni stato.

**Linguaggio UI morph ovunque.** Press, hover e switch del kit girano su spring in forma chiusa invece che su rampe con easing. Regole di stile e prompt chiedono morph tra UI, swap con blur, camera sullo stato attivo, cursore solo su anchor. Warning `no-micro-motion` per una UI che si muove solo in blocco.

Merge di #211 nel branch: aggiunte le severità mancanti di `loop-seam` (bloccante) e `too-dense` (warning) e lo stile UI morph nella tabella della musica.

Scartato: misurare gli anchor nel browser al momento del gate (il gate gira sul server, senza DOM).
