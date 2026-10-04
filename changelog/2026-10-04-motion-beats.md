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

**Marker.** I marker della timeline sono in una PR parallela non ancora unita: qui non si
aggiunge un secondo modello di marker. I beat restano nell'analisi e sono esposti (righello,
`beat_times`); «aggiungi marker sui beat» si collega al modello di quella PR quando entra.
