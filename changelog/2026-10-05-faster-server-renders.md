# Render sul farm più veloci: blur a chunk, filtri limitati, matte senza pass sui pixel

Caso: masking-loop v3 (270 frame 1080p30, 3 matte, forme liquide con stroke e ombra, blur ×6).
Prima: un worker solo (il producer distribuito non accettava `motionBlur`), >24 min per 141 frame.

## Dove andava il tempo (farm, 4 vCPU, ms per frame senza blur)

| componente | prima | dopo |
|---|---|---|
| refresh matte (`before`) | 5.350 | ~540 (locale) |
| screenshot | 980 | ~250 (locale) |
| totale | 6.440 | 1.800 (farm), 810 (locale) |

La causa non era html-to-image: erano i filtri SVG calcolati su regioni enormi.
- `.ef` è `inset:0`: un filtro con regione `-25%/150%` copre 2880×1620 px anche per una forma di
  600×250. `feMorphology` (Stroke) costa O(regione × raggio) in software.
- Il filtro goo delle forme aveva regione 7× il box.
- La matte rasterizza la sorgente con gli stessi filtri, poi passava ogni pixel in JS.

## Cosa cambia

- **Blur a chunk.** Il chunk script patcha a runtime `distributed.js` del producer (3 ancore
  in `PRODUCER_BLUR_PATCHES`: PNG, `motionBlur` nelle capture options, screenshot forzato); se
  un'ancora manca il chunk fallisce con `producer patch anchor missing`. Il costo dei chunk
  moltiplica i campioni: v3 blur → 27 worker da 10 frame.
- **Regione dei filtri dove si disegna.** Le forme conoscono la propria estensione (unione dei
  frame cotti + portata dei modificatori + stroke): `paintArea` la passa agli effetti, che usano
  `userSpaceOnUse`. Drop shadow, glow e blur su un'area nota diventano SVG (`boxed`) limitati.
  Le altre clip restano a `-25%/150%`.
- **Matte senza pass JS:** `mask-mode` alpha/luminance e `mask-composite: exclude` per gli
  inversi; niente `getImageData`.
- **Costo per frame** (`render-cost`): effetti, matte, precomp annidate, ring (card × fette).
- **Worker fermo:** il log del chunk scrive i frame catturati ogni 20 s; se la coda del log non
  cambia per 6 min il pezzo è trattato come morto, fermato e diviso. L'ultimo log finisce nel
  messaggio d'errore.
- **Prezzo:** stima blur sul percorso a chunk, componente effetti calibrata sul bench v3.

## Scartato / non fatto

- Blur adattivo per layer, cattura beginFrame/raw: non fatti. Il producer ha già il dedup dei
  frame statici; la cattura è il 25% del frame dopo i fix.
- vCPU 8: stesso tempo di 4 (raster Chrome); 2 vCPU: +35%.

## Numeri farm (stesso giorno)

| caso | prima | dopo |
|---|---|---|
| v3 blur ×6 | >24 min (141/270 frame) | 326 s, 27 worker |
| 2D 30 s | ~40 s (bench 10/05, 2 chunk) | 16 s |
| Text3D 120 frame | 58 s | 38 s |
| Device3D 120 frame | 147 s | 57 s, 3 chunk |

v3 blur resta sopra l'obiettivo di 3 min: in parallelo i worker vanno ~3× più lenti che da soli
(32 s/frame contro 8,7 s misurati su un worker isolato). Da indagare.
