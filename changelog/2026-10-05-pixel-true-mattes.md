# Track matte pixel-true e maschere combinate

**Perché.** `matte.ts` ricostruiva la matte dalle props del clip sopra (testo, shape, immagine):
video, 3D, Custom e keyframe della sorgente non contavano. Il caso tipico, un testo animato che
rivela un video, usciva sbagliato.

**Cosa.** La matte ora è il render reale della sorgente. `hyperframes/mattes.ts` aggiunge alla
pagina un runtime che, a ogni seek (`hf-seek` con `waitUntil`, così il producer e la cattura
aspettano) e a ogni update della timeline, rasterizza il layer sorgente con html-to-image
(lo stesso motore dell'export dal browser), converte i pixel in alpha con `matteAlpha` (tabella
`MATTE_READ`, una riga per matte) e lo applica come `mask` al wrapper `.kt` del bersaglio. La
sorgente resta in pagina con `opacity:0` (con `display:none` non avrebbe layout) e fuori da
`#world`. Matte nuove: `alpha-inverted`, `luma-inverted`. `setTrackMatte` accetta qualsiasi clip.

Maschere: `mask.mode` (add/subtract/intersect/difference, default add) e `clip.maskStack`
(fino a 7 maschere dopo la prima, non animabili). La semantica sta in `combineMasks`; il
compositore la traduce in strati CSS `mask` + `mask-composite` (`stackLayers`), e un test
verifica che i due diano lo stesso valore. `freezeMasks` congela ogni strato.

**Agente.** `set_track_matte` descrive i quattro modi e qualsiasi sorgente; nuovo
`set_mask_stack`; `set_mask` accetta `mode`; `remove_mask` toglie anche lo stack; parità
aggiornata (`maskStack`).

**Verifica.** Doc di demo (testo animato scala+rotazione su video, badge con 3 maschere):
anteprima vs export browser 56–66 dB PSNR, anteprima vs riseek in ordine inverso identici,
anteprima vs render sul farm 37–43 dB (H.264).

**Scartato.** SVG `<mask>` con `<foreignObject>`: Chrome non lo disegna. `element()`: solo Firefox.

**Patch a caldo.** Lo script delle matte è uno script `data-hot`: la patch della preview lo
riesegue, e il runtime nuovo ferma il vecchio (`stop` sul listener `hf-seek`) invece di
sommarsi; il tween di refresh rinasce sulla timeline svuotata. Verificato: la preview dopo la
patch è identica a un caricamento da zero dello stesso doc. Costo misurato: una matte 1080p
costa ~82 ms per aggiornamento (Chrome headless, M-series), quindi in riproduzione la matte si
aggiorna a ~12 fps mentre il resto va a 60; seek, export e render aspettano e restano esatti.
