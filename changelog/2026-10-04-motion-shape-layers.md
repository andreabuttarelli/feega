# Motion: shape layer v2 — tracciati, morph, modificatori

Prima: `Shape` era un `div` con `background` e, per il cerchio, `clip-path`. Tre forme (rect,
circle, line), un colore pieno, niente tratto, niente tracciati.

**Modello.** Restano le props della clip (nessun campo nuovo sul doc, quindi la parità agente
non cambia tabella): `shape` aggiunge `ellipse`, `polygon`, `star`, `path`; `path` è SVG path data
in coordinate 0..1 del box (M L H V C S Q T Z, assolute o relative; tutto il resto — markup,
`url()`, archi `A` — è rifiutato da `parsePath`, che è anche la sanificazione); parametri
`roundness` / `sides` / `points` / `innerRadius`; riempimento `fillKind` solid/linear/radial/none
con `fill`, `fill2`, `gradientAngle`, `fillRule`; tratto `strokeKind` none/solid/gradient,
`stroke`, `strokeWidth` / `dash` / `gap` in frazioni del lato corto, `cap`, `join`.

**Morph.** `morphs: string[]` e `morph` 0..n: la forma attraversa base → target 1 → target 2 al
crescere di `morph`, quindi il multi-key è un normale keyframe. Corrispondenza nostra
(`shape/morph.ts`), non flubber: ricampionamento a 120 punti per lunghezza d'arco, poi la rotazione
(e il verso) che minimizza la somma dei quadrati delle distanze — niente torsione a metà. Un
contorno in più nasce da un punto (il baricentro dell'altro). `morphStart` ruota l'inizio a mano.

**Modificatori** (`shape/modifiers.ts`, una tabella `MODIFIERS`): trim, repeater (lineare o
radiale: la rotazione è attorno al centro del box), offset, wiggle (rumore a hash con seme, mai
`Math.random`), zig zag, round corners, merge con `polygon-clipping` (MIT). Impilabili, ogni
parametro animabile come `mod.<id>.<param>` (nuova `Source.Modifier`, una riga in ognuna delle
quattro tabelle per sorgente).

**Render.** SVG inline. Se la geometria si muove (chiavi su parametri, modificatori, `morph`, o
un wiggle con velocità) `hyperframes/shapes.ts` cuoce un markup per frame, deduplicato, e uno
script lo applica al seek (`seekDriver` + `hf-seek`, stesso schema della camera): deterministico
sotto seek, uguale in anteprima, export dal browser e render su server. Niente GSAP dentro.
I colori animati passano ancora dalle variabili `--kc-*`.

**Matte.** Una forma star/polygon/path come track matte diventa una maschera `polygon` col suo
contorno (primo contorno, massimo 64 punti); rect/ellipse restano maschere box.

**Editor.** Sezione Shape nell'inspector (converti in tracciato, target di morph, pila di
modificatori con parametri animabili) e `PenOverlay` sulla preview per i tracciati: clic aggiunge
un punto, trascinare crea le maniglie (Alt le spezza), Alt+clic cancella, chiudi/apri.
Limite: l'overlay usa il box della clip senza rotazione/scala/keyframe di trasformazione.

**Agente.** `add_shape`, `set_path`, `morph_to` (path o tipo parametrico, con start/end chiave
il morph da sé), `add_modifier` / `set_modifier` / `remove_modifier`.

Scartato: flubber (dipendenza in più per ciò che fanno 80 righe), paper.js (pesante, e serve solo
per le booleane), animare `d` con GSAP (sta per sparire).
