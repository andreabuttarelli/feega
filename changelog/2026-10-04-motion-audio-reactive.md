# Motion editor: espressioni audio-reattive

Il linguaggio delle espressioni ha un namespace `audio`: `audio.amp(ref?, smoothing?)`,
`audio.beat(ref?)`, `audio.onset(ref?)`. Leggono l'analisi salvata (PR dell'analisi) al frame
corrente via `AudioPort` (`expression/audio-port.ts`): niente analyser dal vivo, quindi lo stesso
frame dà sempre lo stesso numero in anteprima, export nel browser e render sul farm. `ref` è l'id
di una clip audio, il suo indice fra le clip audio o l'id di una traccia; senza `ref`, `amp` prende
l'audio più forte che suona e `beat`/`onset` la base musicale (`musicBed`).

Le analisi entrano in `composeHtml` (`ComposeInput.analyses`) e nel bake; il render server le
calcola prima di comporre. Senza analisi l'audio vale 0, non è un errore.

Preset «Pulse with the music» (`pulse.ts`, tabella per prop): scala e opacità seguono l'ampiezza
(media su 3 frame), il blur lampeggia sui beat. Inspector: sezione «Pulse with the music»; agente:
`pulse_with_music`.

Demo (render sul farm, 10 s): tagli con `cutToBeat` a 6, 36, 81, 126, 171, 216, 261 (griglia a
120 BPM, primo beat a 0.19 s), musica abbassata a 0.225 fra i frame 91 e 191 sotto il voice-over,
un cerchio che pulsa con l'ampiezza.
