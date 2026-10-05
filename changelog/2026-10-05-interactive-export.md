# Export interattivo con input dal vivo

**Perché.** Un mp4 non reagisce. Serviva un export che segue cursore, inclinazione del telefono e
scroll della pagina ospite, senza rompere il determinismo dei render video.

**Cosa.**
- `expression/inputs.ts`: tabella unica degli input (`pointer.x/y`, `pointer.down`, `hover`,
  `tilt.x/y`, `scroll`, `time`) con default e regola d'attraversamento (`Crossing.Local` per
  pointer/hover, `Global` per gli altri); `input.smooth(v, secondi)`.
- Il bake usa sempre i default: mp4, render server e preview normale non cambiano.
- `interactive/live.ts`: valuta dal vivo solo le corsie transform che leggono `input`, con lo
  stesso `Evaluator` del bake (stesso codice → stesso valore ai default). Dentro una precomp il
  cursore passa per l'inversa della trasformazione dell'host (posizione, scala, rotazione; 3D
  proiettato in 2D), a qualunque profondità. Fuori dal box: `outside` = `fallback` o `hold`.
- Runtime nel bundle: `scripts/motion-live-runtime.ts` (plugin Vite) compila
  `interactive/live-entry.ts` con esbuild in un modulo virtuale; `composeHtml` lo include solo con
  `liveness: Live` e solo se qualche corsia legge input.
- `interactive/bundle.ts`: un HTML autonomo (player Hyperframes + composizione in `srcdoc`), asset
  inlinati come data URI, snippet `<iframe>` + `<script>` che manda lo scroll dell'host.
- Doc: `interactive` opzionale (playback autoplay/in-view/scrub/paused, loop, outside).
- Editor: "Interactive preview" (cursore sulla preview, slider di inclinazione, 4 preset).
  ExportDialog: modalità "Interactive (web)" con peso mostrato prima del download.
- Agente: `apply_interactive_preset`, `set_interactive`, `export_interactive`; guida input in
  `set_expression`.

**Scartato.**
- Bucket pubblico `media` o pagina pubblica con token: la migration del bucket non è applicata e
  una pagina servita richiede una tabella di condivisione. Asset inlinati: il file non contiene URL
  firmati né dipende dalla sessione; costa peso (~850 KB senza media, mostrato prima).
- Griglia di valori pre-calcolati per input: non regge 6 dimensioni. Linearizzazione: sbagliata per
  espressioni non lineari.
- Camera e proprietà non-transform restano baked ai default.

**Limiti noti.** Il runtime pesa ~700 KB minificato (zod e acorn arrivano dal grafo di `doc.ts`).
Espressioni che mescolano audio e input usano l'analisi audio passata al compose.
