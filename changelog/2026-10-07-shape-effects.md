# Effetti Shape mosaic e Shape cutout

Due righe nuove nella tabella `EFFECTS` (`src/lib/canvas/effects/index.ts`), stesso percorso
degli altri: anteprima nel browser con `applyStack`, render server in `applyEffectsNode`, schema
per gli agenti derivato dalla tabella (`describe_node_types`, `apply_effects` via MCP).

- **shape-mosaic** (`shape-mosaic.ts`): quadtree adattivo — una cella si divide finché la
  deviazione standard della luminanza supera la soglia data da `detail` e resta sopra `minSize`.
  Ogni cella diventa una forma (mix seminato da `seed`), con `gap`, `radius`, `jitter` (riduce e
  sposta la forma DENTRO la cella: niente sovrapposizioni né uscite). Colore = media dell'area
  della forma. Sfondo: media dell'immagine, colore, trasparente. `mosaicSvg` esporta la stessa
  disposizione in vettoriale; l'editor mostra "Download SVG" solo se il mosaico è l'ultimo passo
  attivo (un passo raster dopo renderebbe l'SVG falso).
- **shape-cutout** (`shape-cutout.ts`): disposizione per rifiuto con spaziatura, dipende solo da
  larghezza/altezza/parametri, quindi A (`side: shapes`, forme piene o contorno sopra
  l'immagine) e B (`side: holes`, pieno con fori) hanno la stessa geometria per costruzione.

**Due uscite su un nodo: scartato.** Il nodo `effects` ha un'uscita sola (`OutputRule.Media`) e
ogni consumatore legge `refId`; una seconda porta toccava porte, connettori, upstream e share.
Scelto: un nodo = un lato. "Make A/B pair" sul nodo crea il gemello con `side` invertito
(`counterpart`), lo collega alla stessa immagine e lo applica (`create` → `connect` →
`apply_effects`). Un agente fa lo stesso con due nodi.

Primitive condivise in `shapes.ts` (copertura 2×2 per l'antialias, colore medio, SVG).
