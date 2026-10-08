# Galleria: icone di formato e tipo, slider della durata, rifiniture

- Durata: i tre bottoni a fasce lasciano il posto a `DurationRange`, due `input range` sovrapposti
  (tastiera e touch nativi, `aria-valuetext`), 0–30 s con estremo aperto "30+". La query porta
  `min`/`max` in secondi (`gte`/`lte` su `duration_s`); un intervallo rovesciato si raddrizza nello
  schema. `duration` a fasce resta per API, chat e MCP.
- `FormatGlyph`: rettangolo nelle proporzioni vere (`glyphSize`, lato lungo 14 px). `KindGlyph`:
  claquette per motion, cubi per composizione. Filtri, card e pagina item.
- Il formato "1:1 1440" sparisce dai filtri: è una risoluzione, non un formato diverso.
- Contatore dei risultati, reset filtri, stato vuoto con reset, skeleton finché il poster non è
  dipinto, dissolvenze di 120–240 ms (spente con `prefers-reduced-motion`), focus visibile su
  ogni elemento, tooltip sulle icone.
- `fakeDb` ora registra `gte`/`lte` come filtri, per poterli verificare.
