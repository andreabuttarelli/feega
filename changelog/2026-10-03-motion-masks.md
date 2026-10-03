# Motion editor: maschere e track matte

Ticket 2 del piano timeline pro (prima: keyframe e 3D; poi: multi-edit, gruppi, blend).

**Schema v3.** Ogni clip ha `mask` (o `null`) e `matte` (`none` | `alpha` | `luma`). Tipi di
maschera in una tabella sola, `MASK_KINDS` in `mask.ts`: rect, ellipse, polygon (punti 0..1 nel
box), image (alpha di un asset), luma (luminanza di un asset), text, linear/radial gradient. Props:
centro e dimensioni in frazioni del frame, rotazione, feather e expansion in px, opacity, invert.
I doc v2 salgono a v3 con `mask: null, matte: 'none'` (`MIGRATIONS`). Le props animabili stanno in
`ANIMATABLE` con `Source.Mask` (`maskX`…`maskOpacity`); keyare una prop di maschera senza maschera
è un errore, e togliere la maschera porta via i suoi keyframe.

**Track matte.** La sorgente è il clip sulla traccia subito sopra che si sovrappone di più nel
tempo (`matteSource`); si traduce in una maschera con la tabella `MATTE` in `matte.ts` (testi →
text, Shape → rect/ellipse, Image/Logo → image o luma) e viene nascosta (`display:none`, il timing
resta). Scartato: usare l'HTML del clip sopra dentro la `<mask>` via `foreignObject` — Chrome non lo
disegna dentro una maschera. Conseguenza: la matte segue box, rotazione e opacità del clip sopra,
non i suoi keyframe né le sue animazioni di testo.

**Generatore.** Una `<mask>` SVG inline per clip, referenziata da un solo wrapper: `km` dentro i
wrapper di trasformazione (la maschera si muove col layer), `kt` per la matte in spazio frame. Ogni
prop possiede un attributo di un elemento suo (`translate x`, `translate y`, `rotate`, `scale x`,
`scale y`, `opacity`, `stdDeviation`, `radius` di dilate/erode): i keyframe diventano tween GSAP
`attr` senza che due prop scrivano la stessa cosa. Scartati CSS `mask-image` con gradienti e
`clip-path`: niente feather animabile, niente rotazione, niente testo.

**Frame dell'agente.** `html-to-image` copia lo stile calcolato, e `url(#mk-id)` calcolato punta al
documento srcdoc: i frame catturati mostravano tutto senza maschera. Prima della cattura ogni
maschera viene serializzata al frame corrente in un'immagine SVG autonoma (immagini inline,
luminanza → alpha × copertura) e ripristinata dopo. Il testo della maschera in quell'immagine usa
il font di sistema.

**UI.** Sezione Mask nell'inspector (tipo, track matte, invert, testo, immagine, props con ◆),
overlay sull'anteprima (sposta, ridimensiona lungo gli assi ruotati, trascina i punti del
poligono), corsie keyframe raggruppate sotto una riga «Mask», etichette mask/matte sulle barre.

**Agente.** `set_mask`, `remove_mask`, `set_track_matte`; il prompt descrive reveal, testo su video
e dissolvenze a gradiente.

**Verifica.** Utente usa-e-getta: reveal ellittico animato, testo come matte su video, gradiente;
drag di maniglie e punti salvati come revisioni; turno agente (radial + keyframe, `view_frames`
riuscito) $0.0015. MP4 135 frame: reveal monotono, seek in ordine casuale identico.

**Difetto preesistente trovato.** Un doc con un clip Video fa fallire `view_frames`: il `<video>`
non ha `crossorigin`, il canvas di `html-to-image` si sporca. Non toccato qui.
