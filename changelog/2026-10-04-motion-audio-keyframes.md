# Motion editor: volume e pan a keyframe, fade come maniglie, ducking

**Un inviluppo solo.** `audioPlan` non porta più `volume/fadeIn/fadeOut` ma due curve per canale
(`left`, `right`: punti `{time, value}` in secondi di timeline), campionate a ogni frame da
volume e pan (keyframe o valore fisso) moltiplicati per i fade, poi semplificate togliendo i punti
collineari. Il pan è un *balance*: il lato verso cui si va resta a 1, l'altro scende
(`L = min(1, 1 - pan)`, `R = min(1, 1 + pan)`). Volume e pan sono `Source.Sound`: si animano con
keyframe (`set_keyframes`) e diamanti nell'inspector; nessuna corsia GSAP.

**Tre consumatori, stessa curva.**
- Export nel browser e anteprima: `audio-graph.ts/scheduleEntry` — upmix a stereo, split, un
  `GainNode` per canale automatizzato con rampe lineari sui punti, merge. L'anteprima
  (`preview-audio.ts`) usa lo stesso grafo su un `AudioContext` vivo, partendo dal frame della
  testina.
- Export server (render farm): `audioMixArgs` fa `channelsplit` → `volume` per canale con
  un'espressione a tratti in `t` (tempo della clip, `eval=frame` su blocchi da 64 campioni) →
  `join` → `adelay`. Verificato con ffmpeg reale: rampa, tenuta, ducking a -12 dB, canale destro
  muto con pan -1.

**L'audio esce dalla composizione HyperFrames.** `<audio>` non viene più emesso e i `<video>` sono
sempre `muted`: il runtime HyperFrames ha un suo mixer (`data-volume`, `data-automation`) che non
conosce il pan, e due mixer davano due suoni diversi fra anteprima ed export. Scartato
`data-automation`: niente pan, e un terzo formato di curva da tenere allineato.

**Fade come maniglie.** Sulla clip selezionata audio/video due quadratini a `fadeIn`/`fadeOut`
dal bordo, trascinabili (`fade-handles.ts`), con la rampa disegnata sopra la forma d'onda.

**Ducking.** `duckUnder(doc, music, voice, regions)` scrive keyframe di volume sulla musica:
scende a `depth` × volume (default 0.25) con attack 0.2 s e release 0.4 s per ogni regione di
parlato; pause più corte di attack+release restano abbassate. Senza regioni (l'analisi arriva in
una PR successiva) usa l'intera clip del voice-over. UI: sezione «Ducking» nell'inspector della
musica; agente: tool `duck_audio`.
