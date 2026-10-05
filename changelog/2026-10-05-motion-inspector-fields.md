# Motion editor: inspector a sezioni e campo numerico unico

Terzo passo della spec di redesign (inspector e campi numerici, P0/P1).

- `NumberField.svelte`: un campo 24px al posto di slider nativo + input. Etichetta che si
  trascina per lo scrub (1 step/px, Shift ×10, Alt ×0.1), ↑↓ per uno step, Invio/Esc, valore
  mono tabulare, unità, ◇/◆ per la chiave al frame. Riempimento accent solo dove il range conta
  (opacità, volume). Espressione dal tasto destro. Logica pura in `number-field.ts`.
- Ordine fisso per tutte le famiglie: Content → Style → Layout → Timing → (Path) → Animate →
  Effects & blend → 3D → Parent & mask (`inspector-sections.ts`). Prima un titolo apriva con 15
  proprietà 3D e il testo arrivava dopo 2000px.
- Sezioni collassabili, stato ricordato per famiglia in localStorage; 3D aperta solo sulle
  clip 3D. Tabelle: `GROUP_SECTION` (gruppo di campi → sezione), trasformazioni 2D in Layout e
  profondità/tilt in 3D, `fieldLook` (etichetta corta, unità, riempimento), `shows` (ducking
  solo audio, transizioni e pulse non su audio).
- Campi a griglia due colonne (X/Y, W/H, ↻/α); Timing in `ss:ff` come il timecode (accetta
  `3:06`, `45f`, `1.5`).
- Camera e Look usano lo stesso campo. `.cell` era già una classe globale del calendario con
  `min-height: 116px`: le celle si chiamano `grid-cell`.
