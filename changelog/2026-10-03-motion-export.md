# Motion editor: export MP4 nel browser, template ads, audio

Prima: il bottone "Render" chiamava `MotionRenderer`, che senza le env Lambda risponde
`rendering_not_configured` — in produzione non si esportava niente.

**Export nel browser.** La porta `MotionRenderer` resta (il render server-side via Vercel Sandbox
arriverà dietro la stessa porta); il bottone ora è "Export" e lavora nella scheda:

```
ExportDialog ─ capabilities() → exportSupport()      (tabella: WebCodecs / H.264 1080p / 720p / AAC)
     │  mixAudio(audioPlan(doc))  OfflineAudioContext 48 kHz, volume + fade per clip, trim
     │  encodeMp4 ─ MotionPreview.render(times) ─ seek → iframe: fonts, 2 rAF, video "seeked", 2 rAF
     │                                           → html-to-image toCanvas → ImageBitmap (transfer)
     │             mediabunny CanvasSource(avc) + AudioBufferSource(aac), fastStart in-memory (moov first)
     └ saveExport: upload diretto su canvas-assets/<org>/<project>/motion/<node>/<uuid>.mp4
                   → ?/exported → saveExport (server): content credentials (ffmpeg, faststart),
                     <uuid>-cc.mp4, asset video, nodes.data.lastRenderAssetId
```

- Libreria: `mediabunny` (successore mantenuto di `mp4-muxer`, stesso autore), gestisce encoder e
  muxer. Scartato muxare a mano su `VideoEncoder`: stesso risultato con più codice nostro.
- Il file non passa dal corpo dell'azione (limite Vercel ~4.5 MB): va dritto nello storage, come
  gli upload della tela. Il bucket non ha una policy `update`: il file marcato va su un path nuovo
  (`-cc.mp4`) e l'originale si cancella.
- `source: 'upload'`: `source` decide il bucket in `/assets/<id>`, e il file sta su
  `canvas-assets`. `ai_marked` dice se il marchio è riuscito.
- Costo: zero crediti, nessun provider chiamato. Il dialogo lo dice.
- La cattura (agente e export) è un unico runtime in `hyperframes/capture.ts`, con una tabella
  per formato (`jpeg` per l'agente, `bitmap` per l'export).

**CORS dei media.** `<video>`/`<audio>` ora hanno `crossorigin="anonymous"`: senza, il canvas di
cattura si sporcava e `view_frames` falliva con una clip video (vedi LESSONS.md). Gli URL firmati
di Supabase rispondono già con `Access-Control-Allow-Origin`.

**Template ads.** `ad-templates.ts`: una tabella (`AD_TEMPLATES`) con formato, durata e builder;
`template-kit.ts` assembla i beat in un doc validato. Prodotto hero 9:16, UGC con voice-over 9:16,
kinetic promo 1:1, lancio 3D 16:9, before/after + offerta 9:16, più il trailer feega v2 16:9 e
9:16 (`trailer-v2.ts`, layout per formato in una tabella). `templateAssets` sceglie i placeholder:
la traccia audio più lunga è la musica, la più corta la voce.

**Audio.** `fadeIn`/`fadeOut` su Audio e Video (default 0, nessuna migrazione: lo schema li
riempie). Il preview non applica i fade (il runtime HyperFrames possiede il volume); l'export sì.
Waveform sulla timeline (`waveform.ts`, 20 picchi/s, slice per trim). Voice-over e musica si
generano dall'editor (`?/sound` → `generateSound`, tabella `SOUNDS`), con il cancello crediti.

**Eval.** `scripts/eval/motion-export.ts`: utente usa-e-getta, asset seminati, template, edit
nell'inspector, un turno di chat, export reale in Chrome, MP4 scaricato. Lancia con
`MOTION_EVAL_URL`, `MOTION_EVAL_FIXTURES`, `MOTION_EVAL_SCENARIOS`.
