# Motori di gioco nei componenti live

Un componente live ora riceve `LittleJS` e `kaplay`, pinnati su jsDelivr e caricati solo se un
componente usato li nomina. Il lint li rifiuta in un componente deterministico ("declare the
component live"): girano col loro loop.

| Libreria | Versione | Licenza | File | Peso (br) |
|---|---|---|---|---|
| LittleJS | 1.26.1 | MIT | `littlejs.esm.min.js` (modulo, importato prima del boot) | 579 KB (167 KB) |
| KAPLAY | 3001.0.19 | MIT | `kaplay.js` (globale) | 189 KB (69 KB) |

- **LittleJS**: `engineInit` forzato sulla radice del componente con `setCanvasFixedSize` alla sua
  misura. Pausa/ripresa con `setEngineManualStep`, smontaggio con manual step + rimozione dei
  canvas. Nel video: manual step e un solo `engineStep(1)` dopo l'init. Un solo LittleJS per
  pagina (è un singleton).
- **KAPLAY**: `kaplay(opts)` forzato con `global: false`, `root`, `width`/`height` della radice.
  Pausa con `debug.paused`, smontaggio con `quit()`. Nel video: `randSeed(seed)` e pausa al primo
  frame.
- **p5 live**: `p5(sketch)` monta l'istanza nella radice e la ferma (`noLoop`/`loop`) fuori schermo,
  `remove()` allo smontaggio. Nel video il p5 live disegna un frame solo.
- **Input**: LittleJS svuota l'input quando il documento non ha il focus, KAPLAY ascolta i tasti
  sul canvas. Quindi il player dell'embed dà il focus all'iframe al tocco (e impedisce al
  `mousedown` del pad di riprenderselo), e il runtime dà il focus all'elemento su cui cade un
  tocco inoltrato, come farebbe un tocco vero.
- **Scartato p5play**: la 3.x è sotto "p5play Personal License" (le 3.20–3.2x erano AGPL-3.0),
  incompatibile con embed distribuiti ai clienti senza licenza commerciale.
- Refactor separato: l'import a modulo di THREE vive nella sua riga di `LIBRARY_TAGS` (`module`),
  così LittleJS è una riga in più.
- Verificato in Chromium (Playwright) sul bundle esportato: tasti e tocco muovono il gioco, due
  caricamenti danno due pezzi diversi; lo still del video è identico tra due render e tra visite.
- KAPLAY 3001.0.19 ha un bug di interpolazione in `body()` + `move()` (`Cannot read properties of
  null (reading 'x')`): è della libreria, non del runtime.
