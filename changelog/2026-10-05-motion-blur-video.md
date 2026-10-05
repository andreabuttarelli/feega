# Motion blur con Video e schermi dei device

**Perché.** `farmProblem` rifiutava il motion blur appena l'HTML conteneva `<video`, anche come
schermo di un Device3D: il video showcase è uscito senza blur. Il rifiuto era vero: il producer
lancia `[MotionBlur] sub-frame motion blur cannot run with injected video frames` appena trova
un `<video>` (estrae i frame per frame d'uscita, non per campione).

**Cosa.**

- Con il blur acceso la pagina del farm non contiene più `<video>`: `stripVideos`
  (`video-strips.ts`) li sostituisce con `<span data-strip>` che portano tempi e stile, e un
  runtime che a ogni `hf-seek` (anche ai tempi dei campioni) mette nel `<img class=
  "__render_frame__">` accanto il frame giusto, `strips/<k>/<n>.jpg`, e attende la decodifica con
  `waitUntil`. Poi chiama `__feegaThreeRedraw`, così lo schermo di un device ridisegna lo stesso
  tempo con il nuovo frame (`drawOnce` ridisegna quando cambia la sorgente).
- Il worker estrae prima del render il tratto riprodotto di ogni video con ffmpeg a 60 fps
  (`stripSteps`: `-ss mediaStart -t durata×rate`), larghezza massima 1920.
- Senza blur nulla cambia: il producer continua a iniettare i suoi frame.
- Tetto del blur riscritto sul costo: la parte piatta resta 51 ms a campione per i pixel del
  frame, i frame 3D aggiungono il costo stimato di `render-cost.ts` (misurato sul farm: 30 frame di
  laptop con video × 4 campioni in 188 s, ~1,4 s a campione). Budget: 80% dei 120 min del worker
  intero, il render gira in background (#125). 30 s 1080p con un device sempre in scena: 3
  campioni sì, 8 no; con device per metà del tempo ~6. Senza 3D il tetto resta sopra
  `MAX_SAMPLES` (32).
- Descrizione di `set_motion_blur` aggiornata.

**Scartato.** Seek nativo del `<video>` nella pagina (il tempo virtuale del producer non fa
avanzare la decodifica); blur sulla strada a chunk (il producer distribuito non ha
`motionBlur`).
