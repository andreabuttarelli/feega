# Musica di default nei video di lancio

Il test supasito.com ha consegnato un launch film muto: il progetto non aveva audio e l'agente
non aveva modo di procurarsene. Il gate `silent` scattava solo con musica nel progetto non usata.

- Tool `add_music` (mood, bpm): mette una traccia su una clip Audio da 0 alla fine e marca i beat.
- Sorgente decisa da una tabella (`musicSource` in `src/lib/motion/music-library.ts`):
  ElevenLabs se configurato (compose), altrimenti la libreria interna.
- Libreria: tre tracce CC0 sintetizzate in casa da `scripts/music/build-library.sh`
  (ffmpeg, nessun campione di terzi), licenza registrata nella tabella `MUSIC_LIBRARY`.
  Caricate in `canvas-assets` come asset `upload` del progetto, firmate come gli altri.
- Gate: uno stile con colonna sonora obbligatoria (`SCORED`, oggi solo launch-film) senza clip
  Audio è `silent` anche senza audio nel progetto.

Scartato: URL statico pubblico per le tracce (in dev punterebbe alla produzione) e librerie CC0
esterne (licenza da verificare traccia per traccia). Le tracce sintetiche sono funzionali, non
belle: con ElevenLabs configurato si usa la generazione.
