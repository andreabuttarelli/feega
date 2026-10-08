# Coda vuota: gate `trailing-empty` e "fit duration to content"

La demo dei telefoni durava 15 s con il contenuto finito a 6 s: nove secondi di nero. Il doc
era rimasto ai 15 s di default di `newMotionDoc` e nessuno lo accorciava.

- **Gate**: nuovo `Quality.TrailingEmpty` (bloccante) in `direction.ts`. Una coda oltre 0,5 s
  dopo l'ultimo contenuto blocca; `empty-frames` resta per i buchi interni. Il contenuto ora
  finisce anche dove l'opacità resta a 0 (dissolvenza al nero con il clip lasciato acceso), che
  prima contava come pieno.
- **`fit-duration.ts`**: `contentEnd` (qui è stato spostato `shownSpans`) e `fitDuration` =
  fine dell'ultimo contenuto + `pace.hold` dello stile. La tenuta è il clip finale allungato
  (frame fermo, non vuoto); sfondi e audio oltre la fine vengono tagliati.
- **Default**: `remove_clip`, `trim_clip`, `set_timing` adattano la durata quando il contenuto
  finisce prima. A fine turno `fitNewVideo` adatta un video partito vuoto se l'agente non ha
  scelto la durata con `set_canvas`.
- **Parità**: tool `fit_duration`; nell'editor "Fit length to content" nelle impostazioni
  della composizione.

Scartato: derivare sempre `durationInFrames` dal contenuto — toglierebbe una durata scelta
dall'utente (musica, slot pubblicitari).
