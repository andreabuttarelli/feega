# Motion editor: effetti di livello

Richiesta cliente: una pila di effetti per clip, ordinata, accendibile, con ogni parametro
animabile.

**Modello.** `clip.effects: { id, kind, enabled, params }[]` (max 12). Il registro
`effects/registry.ts` è una tabella sola: per ogni tipo i parametri (range, default, colore o
numero) e `render(values, frame, filterId) → { filter, nodes }`, funzione pura dei valori. Le
chiavi animabili sono `fx.<effectId>.<param>`: `withParams` aggiunge le loro `AnimProp`
(`Source.Effect`), quindi keyframe, espressioni, inspector e validazione le trattano come ogni
altra proprietà senza codice dedicato. Togliere un effetto toglie anche i suoi keyframe e le sue
espressioni.

**Render.** Un wrapper `.ef#ef-<clip>` dentro i wrapper di trasformazione (come in After
Effects, ombra e glow ruotano col livello) porta `filter:` con la catena in ordine; gli effetti
SVG sono `<filter>` dentro il wrapper e entrano nella catena come `url(#…)`. Effetti CSS:
brightness/contrast, hue/saturation, black & white, blur, drop shadow, glow. Effetti SVG: tint
(una sola feColorMatrix calcolata dai due colori), curves (feComponentTransfer a tre punti),
directional blur (9 feOffset mediati), stroke (feMorphology), grana (feTurbulence col seme
per frame), aberrazione cromatica (canali spostati e fusi in screen), vignette (feDiffuseLighting
con una luce puntiforme al centro: la caduta radiale senza immagini esterne), wave
(feTurbulence spostata da feOffset, la regione allargata di quanto si sposta).

**Animazione.** Un parametro animato non diventa un tween per attributo: molti attributi
dipendono da più parametri (dx di un'ombra da distanza e angolo). Si campiona `render` a ogni
frame del clip e si emette un `tl.set` solo per ciò che cambia (filtro CSS o attributi della
primitiva), mezzo frame prima del frame, così il seek in qualunque ordine atterra sul valore
giusto. Un clip con effetti fermi non aggiunge niente al timeline. Scartato: variabili CSS (gli
attributi SVG non le leggono).

**UI e agente.** Sezione Effects nell'inspector: aggiungi, trascina o frecce per l'ordine,
checkbox, rimuovi, parametri con diamante e `=`. Tool `add_effect` (ritorna id e chiavi da
animare), `set_effect`, `remove_effect`; riga di parità.
