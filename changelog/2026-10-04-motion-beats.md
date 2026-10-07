# Motion editor: beat sul righello, snap e «Cut to beat»

I beat dell'analisi audio (PR precedente) diventano frame di timeline con `hitFrames`, dalla sola
*base musicale* (`musicBed`: la clip Audio più lunga con un tempo analizzato — anche un voice-over
ha un «BPM», e i suoi beat sporcavano la griglia): `frame = from + t·fps − trimStart`, tenuti
solo quelli dentro la clip.

- **Righello**: un trattino per beat.
- **Snap**: `snapped` accetta `beats` come bersagli in più; spostare o tagliare una clip si
  aggancia al beat come già a secondi, bordi e keyframe.
- **Cut to beat** (`cutToBeat`): le clip selezionate, in ordine di tempo; la prima parte dal
  beat più vicino al suo inizio, ognuna finisce sul beat più vicino alla sua durata (almeno un
  beat dopo l'inizio), la successiva parte lì. I tagli cadono sui beat, la durata cambia il
  meno possibile.
- **Agente**: `beat_times` (beat o onset in secondi di timeline) e `cut_to_beat`.

**Marker.** «Mark beats» (`markHits`) mette un marker di composizione per beat (`beat N`) o
per onset (`hit N`) nel modello di marker della timeline; rifarlo sostituisce i propri marker e
lascia gli altri; si ferma a `MAX_MARKERS`. Agente: `mark_beats`.
