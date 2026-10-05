# Export interattivo con input dal vivo

**Perché.** Un mp4 non reagisce. Serviva un export che segue cursore, inclinazione del telefono e
scroll della pagina ospite, senza rompere il determinismo dei render video.

**Cosa.**
- `expression/inputs.ts`: tabella unica degli input (`pointer.x/y`, `pointer.down`, `hover`,
  `tilt.x/y`, `scroll`, `time`) con default e regola d'attraversamento (`Crossing.Local` per
  pointer/hover, `Global` per gli altri); `input.smooth(v, secondi)`.
- Il bake usa sempre i default: mp4, render server e preview normale non cambiano.
- `expression/evaluator.ts`: l'`Evaluator` legge le corsie da una porta `LaneBook`; il bake usa
  quella del doc, il player quella dei dati spediti (stesso codice → stesso valore ai default).
- `interactive/spec.ts` (lato compose) trasforma il doc in `LiveSpec`: corsie, target DOM, e per
  ogni host la mappatura fotogramma per fotogramma (trasformazione della precomp, o slot della
  cella bento) con il rettangolo della cella. `interactive/live.ts` gira nel player. Vale a
  qualunque profondità; fuori dalla cella `outside` = `fallback` o `hold`.
- Dal vivo: transform del clip e prop numeriche del componente (tracking, weight…). Espressioni
  che leggono anche `audio` restano baked.
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

**Peso.** Runtime 710 KB → 18 KB minificato (180 → 8 KB gzip): fuori doc, zod e acorn. Un test
(`scripts/motion-live-runtime.test.ts`) lo tiene sotto 40 KB. Bundle demo 849 → 112 KB.

**Limiti noti.** Camera dal vivo non fatta: lo stage calcola la camera da tracce baked con
`cameraMath` dentro lo script dello stage; renderla viva vuol dire spedire `cameraMath` e
riscrivere lo stage a ogni frame, non una riga di tabella. Parametri di Shape, effetti, maschere
restano baked per la stessa ragione (ognuno ha il suo script).
