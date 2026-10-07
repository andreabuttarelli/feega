# Gate `empty-frames`: buchi vuoti e flash, bloccanti

**Perché.** Il test supasito v1 aveva ~0,5–1 s di quasi nero a 11,5 s (la precomp del logo
partiva con i soli sfondi) e salti bianco→nero a 2 s e 9 s. Nessun controllo li vedeva:
`blank-frame` guarda solo i frame campionati, e solo se piatti.

**Cosa cambia.**
- `Quality.EmptyFrames` in `direction.ts`, da due fonti:
  - dal doc: i tratti oltre 0,3 s in cui si vedono solo sfondi (`BrandBackground`,
    `Adjustment`, `Particles`, `Null`, `Shape`), scendendo nelle `Precomp`;
  - dai frame: un salto di luminanza media ≥ 200 fra due campioni consecutivi (flash).
- `FrameStat` porta `luma` (media).
- Tabella `QUALITY_SEVERITY: Record<Quality, Severity>`: `empty-frames` e `blank-frame`
  bloccanti, il resto avviso. `view_frames` restituisce `blocking` accanto a `quality`.

**Scartato.** Contare le `Shape` come contenuto: nella v1 erano solo fondi e flash.
Il blocco della consegna sui `blocking` è nella PR sorella del gate.

Test: il doc reale di supasito v1 (`supasito-v1.fixture.json`) dà un solo buco a 11,5 s.
