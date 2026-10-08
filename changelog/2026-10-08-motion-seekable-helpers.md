# drawPath, morph, scramble, flip sul motore

Quattro aiuti seekable scritti da zero sul motore (`engine.ts`), specificati dai nostri bisogni:
GSAP è stato rimosso (v. `docs/legal-review-checklist.md`) e i suoi plugin non sono stati letti
né portati.

Ognuno restituisce una **maniglia**: un oggetto con un numero (setter) che si anima su `tl`. Il
frame è funzione pura di quel numero, quindi ogni seek è esatto.

- `motion.drawPath(path)` → `draw`/`start` (0–1). Usa `pathLength="1"`: niente misure, vale per
  path, cerchi, rettangoli, linee.
- `motion.morph(path, d, { points })` → `morph`. Ricampiona entrambe le forme a N punti con
  `getPointAtLength` su una sonda temporanea; per forme chiuse sceglie verso e punto d'inizio che
  minimizzano lo spostamento. Il risultato è un poligono (`M…L…Z`): con 96 punti le curve reggono.
- `motion.scramble(el, testo, { seed, chars })` → `reveal`. Hash intero sul (seed, indice, passo):
  niente `Math.random`; gli spazi restano.
- `motion.flip(els, cambio)` → `flip`. Misura, applica il cambio, rimisura; scrive `transform` con
  origine `0 0` sugli elementi, quindi non va combinato con `x`/`scale` sugli stessi.
- Verificato: test sul motore (jsdom, geometria SVG simulata solo per `morph`), demo con
  `write_component`, 7 frame da Chromium locale, visite ripetute identiche al byte
  (`~/Documents/feega-videos/css-libs/helpers/`).
