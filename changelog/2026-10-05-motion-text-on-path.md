# Testo su tracciato nel motion editor

**Cosa.** Come Path Options di After Effects: `clip.textPath` su Title/Text/Kicker/Caption.
Sorgente preset (circle, ellipse, arc, wave, line; raggio px e arco °) o un clip Shape (pen,
morph e modificatori compresi), centrato nel box del testo. Proprietà: first/last margin (% della
lunghezza), align, reverse, perpendicular, forceAlign, radius, arc. Tutte keyframabili ed
esprimibili come `tp.<campo>` (`Source.TextPath`; booleani 0/1, align 0/0.5/1).

**Come.** Posizionamento per glifo, non SVG textPath: textPath non accetta i transform per
carattere degli animatori. Il compose cuoce per frame la curva (deduplicata) e i parametri; il
runtime misura l'avanzamento di ogni glifo (`getComputedStyle().width`: indipendente da transform
e zoom, include il tracking degli animatori) e chiama `placeGlyphs`, funzione pura iniettata con
`toString()` — la stessa in preview, export dal browser e producer. Dipende solo dal tempo, quindi
ogni frame è un seek. Gli animatori restano sullo `.tu` dentro il glifo e agiscono nel suo
riferimento ruotato.

**Vincoli.** Sul path gli animatori devono essere per carattere (rifiutato in entrambe le
direzioni). Una riga sola; Caption perde lo sfondo sul path. Shape sorgente cancellata → linea.

**UI.** Sezione «Path» (`TextPathSection.svelte`) nell'inspector del testo, senza toccare il
layout; `TextPathOverlay` disegna il tracciato nella preview quando il testo è selezionato.

**Agente.** `set_text_path`, `remove_text_path`, `textPath` in `get_motion_doc`, riga di parità.

**Verifica.** Demo 120 frame 1080² (cerchio che ruota, onda che scorre con un animatore, testo su
una Shape che morpha cerchio → quadrato → triangolo) renderizzata col producer hyperframes.

**Scartato.** Margini in px: in % lo scorrimento su un path chiuso non dipende dalla dimensione.
Seguire anche il transform della Shape: il path si prende nella forma, non nella posizione.
