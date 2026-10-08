# Lenti liquide vive nell'export interattivo

Prima: `set_expression` con `input.*` su `centerX` di una LiquidGlass/LiquidBlob era accettato e
poi congelato. `liveTarget()` non aveva una destinazione per `Source.Param`, `liveLanes()` tornava
`[]` e il runtime live non entrava nemmeno nella pagina. La blob c'era, ferma al centro.

Ora:

- **Una tabella sola** decide cosa può essere vivo: `SOURCE_PAINT` in
  `interactive/live-props.ts` (Style per transform e prop, Lens per i param delle lenti, null per
  il resto). `setExpression` rifiuta `input.*` dove la tabella dice null: niente più congelamenti
  silenziosi.
- **Le lenti si ridisegnano nel browser.** La forma pura è uscita in `glass/shape.ts` e
  `blob/shape.ts` (il runtime non può portarsi `keyframes.ts`, test di dimensione). La spec live
  porta per ogni lente i valori base per frame (`LensSpec`, costanti compresse a un valore);
  `lens-paint.ts` sovrascrive le corsie vive, ricalcola la posa e scrive gli attributi SVG del
  filtro (glass) o una riga di uniform in `window.__feegaBlobLive` che `drawBlob` preferisce a
  quella cotta (blob), poi chiede il ridisegno.
- **La blob si stira anche dal vivo**: lo strain viene dalla velocità del centro tra un tick e
  l'altro, integrato con `jellyStep` (estratto da `jellyStrains`, stesso calcolo).

Scartato: valutare i keyframe nel browser (porta il modello del documento nel runtime) e
congelare solo i param non lente con un `if` in `liveTarget`.
