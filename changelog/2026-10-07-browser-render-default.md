# Render nel browser come default, farm solo su richiesta

Obiettivo: costi server a zero. Prima l'ExportDialog apriva su "On our servers" quando il farm era
configurato, il batch CSV andava solo sul farm, e un agente MCP non aveva modo di renderizzare.

## Regola browser/farm (`src/lib/motion/render-place.ts`)

Una tabella sola, prima regola che scatta vince, con il motivo mostrato all'utente:

| motivo | quando |
|---|---|
| `background` | l'utente spunta "Render in the background: you can close this tab" |
| `format` | il formato non è MP4 H.264 (ProRes, HEVC, WebM alpha, GIF, PNG) |
| `no_encoder` | niente WebCodecs o niente H.264 |
| `device` | risoluzione oltre l'encoder o oltre `DEVICE_LIMITS`, durata oltre `DEVICE_LIMITS` |
| `no_audio` | c'è audio da mixare e il browser non codifica AAC |

`DEVICE_LIMITS`: desktop 1080p/600 s, telefono 1080p/180 s, telefono debole (`deviceMemory` < 3 GB)
720p/60 s. `BROWSER_RENDER_CREDITS = 0`. La usano ExportDialog (editor e Compositions), il batch CSV
in TemplateDialog (righe una dopo l'altra nella tab) e la pagina `/render/[token]`.

## Pipeline nel browser (`export/browser-render.ts`)

Era già in streaming dopo #89: un frame alla volta → `CanvasSource` → muxer, in memoria resta solo
l'MP4 compresso. Aggiunti Wake Lock e pausa quando la tab va in background (`stay-awake.ts`): il
frame successivo aspetta `visibilitychange`, il video non si rompe. Le ottimizzazioni del farm
(#170: filtri limitati all'area dipinta, matte vettoriali) vivono in `composeHtml` e nel runtime
delle matte, quindi il browser le ha già: nessun port necessario.

Scartato `hardwareAcceleration: 'prefer-hardware'`: rifiutato da Chromium headless e dai
dispositivi senza encoder hardware anche quando `canEncodeVideo` dice sì (LESSONS.md).

Non fatto: cattura diretta dal canvas per WebGL/3D/particelle/video al posto di html-to-image, e il
test di parità PSNR browser/farm. La cattura passa ancora da html-to-image per frame.

## Link di render (`/render/[token]`)

`POST /api/v1/motion/{nodeId}/render` (default `mode: browser`) crea un `node_runs`
`browser-render:<rev>` e restituisce `render_url`. Token = `<runId>.<segreto 32 byte>`; sul run
solo lo sha256. Scade in 30 minuti se nessuno lo apre; la prima apertura lo reclama con un cookie
httpOnly per quel dispositivo, un altro dispositivo riceve `opened_elsewhere`; quando il run si
chiude (`done`/`failed`) il link è usato. Il run scade dopo 2 h (`browser_render` in
`JOB_TIMEOUTS_MS`) ed è escluso dal riconciliatore video.

Senza login, di proposito: il link arriva da un agente e si apre spesso sul telefono, dove la
sessione può mancare. Il token concede solo: leggere quella revisione, gli asset firmati del suo
progetto, caricare un file nel percorso fisso del run (`createSignedUploadUrl`), registrare
l'asset e chiudere il run. Voce in `service-role-uses.ts`.

`mode: server` passa dal cancello crediti e chiama lo stesso `startFarmRender` dell'editor.
`GET /api/v1/motion/renders/{runId}` dà stato e `file_url` firmato. MCP `render_video` /
`get_render`, CLI `feega motion render [--server]` / `render-status`, tool chat `render_video`.

## Tempi (desktop, Chromium headless locale, 1080p30)

Vedi tabella nel report della PR; farm dai bench del 05/10.

## Verifica

e2e `tests/e2e/render-link.spec.ts` (@real): desktop Chrome, Pixel 7 (Chromium), iPhone 13
(WebKit) aprono il link, renderizzano, salvano l'asset, chiudono il run; ricarica e secondo
dispositivo sono rifiutati. Emulazione: non prova Safari iOS vero, la memoria reale, lo schermo
che si spegne, Web Share.
