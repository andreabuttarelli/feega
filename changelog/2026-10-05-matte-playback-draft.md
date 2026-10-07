# Matte in riproduzione: bozza a 1/4, piena a fermo

**Perché.** Una matte 1080p costava ~50–80 ms per aggiornamento: in riproduzione la preview la
aggiornava a ~20 fps, in ritardo sul resto.

**Cosa.** Il player guida la riproduzione con un `hf-seek` per frame. Se `__player.isPlaying()`
è vero, il runtime delle matte rasterizza a `MATTE_DRAFT_SCALE` (1/4) senza bloccare il seek; se
è falso (pausa, seek dell'editor, export dal browser, producer sul server) rasterizza a piena
risoluzione e il seek aspetta. Dopo l'ultimo frame giocato, `MATTE_SETTLE_MS` (150 ms) riporta la
matte a piena risoluzione. Una richiesta piena vince sempre su una bozza in coda.

**Misure** (Chrome headless, Mac M-series, layer 1080p, testo animato su video): matte in
riproduzione da 19,7 a 37,9 aggiornamenti/s; dopo la pausa la maschera torna a 1920 px.

**Scartato.** Cache per frame: in riproduzione lineare ogni frame è nuovo, quindi nessun colpo;
servirebbe solo a loop e scrub, al prezzo di una PNG 1080p per frame in memoria. Il costo
residuo è il clone/serializzazione di html-to-image, non i pixel.
