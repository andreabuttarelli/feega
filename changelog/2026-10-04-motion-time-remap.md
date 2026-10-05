# Motion editor: time remap e speed ramp sui Video

Richiesta: velocità costante, curva di time remap a keyframe, freeze frame, reverse; identici in
preview, export dal browser e render sul server.

**Modello.** Il Video prende `speed` (0.1..10) e `reverse`; i keyframe su `time` (nuova
`Source.Remap`, valore in secondi della sorgente) vincono su entrambi. `sourceSeconds(clip,
frame)` in `time-remap.ts` è la sola funzione che dice quale secondo del file si vede: pura.

**Perché a segmenti.** Il runtime HyperFrames e il producer sul server leggono un `<video>` con
`data-start`/`data-media-start`/`data-playback-rate` e il producer estrae i frame con ffmpeg:
impostare `currentTime` a mano funziona in preview ma il server lo ignora. Quindi
`mediaSegments` traduce la mappatura in elementi che i tre percorsi capiscono già: un tratto a
passo costante e rate in 0.1..10 diventa un elemento solo; reverse e freeze (rate negativo o
zero, che il runtime non accetta) diventano un elemento per frame, ciascuno esatto. Scartata la
corsia `rate` di `data-automation`: niente reverse né zero.

**Audio.** Un video rimappato è muto (`audio-plan` lo salta, gli elementi sono `muted`): il suono
non seguirebbe l'immagine. Musica e voce su clip Audio.

**Verifica.** Harness Playwright sul HTML composto: a reverse, t=0.5 s mostra il secondo 2.467
della sorgente, la cattura html-to-image (export dal browser) coincide; render demo sul farm.

**Agente.** `set_time_remap` (speed, reverse, keyframe tempo→sorgente, clear) e `freeze_frame`.
Inspector: pannello Time remap (keyframe di remap, freeze al playhead, clear); speed e reverse
nel gruppo Motion.
