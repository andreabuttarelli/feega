# Motion editor: render su Vercel Sandbox

Prima l'unica esportazione era quella nel browser (WebCodecs): veloce quanto la macchina
dell'utente, e con la scheda aperta fino alla fine. C'era una porta `MotionRenderer` con un
adattatore Lambda (`@hyperframes/aws-lambda`) mai configurato né chiamato dalla UI: rimossa,
l'utente ha scelto lo stesso fornitore (Vercel), niente AWS.

**Architettura.** `render-farm.ts` è la porta (worker: write/run/read/stop). `vercel-farm.ts`
l'implementa: una sandbox base con nome `feega-motion-render-<versione HF>-r<n>` viene creata una
volta (apt ffmpeg + librerie Chrome, `@hyperframes/producer` fissato a 0.8.114, `hyperframes
browser ensure`) e fermata; ogni worker è un `Sandbox.fork` della base (~10 s). Nessuno snapshot
id da configurare: la base vive nel progetto delle credenziali e si ricrea da sola quando cambia
la versione di HyperFrames. `farm-render.ts` è il caso d'uso: `chunkPlan` divide i frame in blocchi
da ~120 (max 8 worker da 4 vCPU), ogni worker esegue `plan()` + `renderChunk(i)` del producer
distribuito di HyperFrames (lo stesso piano su ogni worker: l'hash coincide), il primo worker
mixa l'audio con ffmpeg (trim, volume, fade, `adelay`, `amix`, `apad/atrim` alla durata) mentre
renderizza, poi riceve i blocchi e li unisce con il concat demuxer `-c copy` + mux AAC,
`+faststart`. H.264 yuv420p, fps del doc.

**Prodotto.** Azione `render` (versione salvata, non il doc del client: un render diverso dal
salvato sarebbe un render di qualcosa che non esiste) → `node_runs` con `external_job_id`
`motion-render:<versione>` e params `revision/format/quote/progress` → `runInBackground`.
L'avanzamento (blocchi finiti) va su `node_runs.params.progress`; il dialog lo legge con
`renderStatus` ogni 2 s e la persona può chiudere la scheda. A fine render: upload nella cartella
export del nodo, poi `saveExport` (content credentials, asset, `lastRenderAssetId`), addebito,
push. Addebito SOLO al successo, uguale al preventivo (`renderQuote`): `logAiCall` con
`flatCostUsd = crediti / 200`, quindi `billed_credits` = crediti del preventivo. Un fallimento non
addebita niente: non c'è nulla da rimborsare. `expireStuckRuns` ha una riga `motion_render`
(8 minuti) e il riconciliatore video ignora il prefisso.

**Sicurezza.** I worker non hanno env dell'app; la rete è `allow` sui soli host degli asset
firmati (TTL 15 minuti), del logo, `cdn.jsdelivr.net` e Google Fonts. Timeout della sandbox
5 minuti; ogni worker viene fermato in `finally`. Il cancello del determinismo è lo stesso
dell'export nel browser (`unverified`).

**Credenziali.** Su Vercel l'SDK usa l'OIDC del deployment; altrove servono
`VERCEL_TOKEN` (o `SANDBOX_VERCEL_TOKEN`) + `VERCEL_TEAM_ID` + `VERCEL_PROJECT_ID`. Senza, il
dialog offre solo il browser.

**Misure (trailer 28 s, 1080p, 4 componenti, musica).** Una sandbox da 8 vCPU con
`hyperframes render`: 71 s di render + ~10 s di avvio. 4×8 vCPU: 44 s. 8×4 vCPU: 46 s.
7×4 vCPU (scelto) dal codice vero: ~38 s a caldo, ~90 s la prima volta (creazione della base).

Scartati: snapshot id in env (va ricostruito a mano e appartiene a un progetto preciso: uno
snapshot creato con il token locale non è visibile all'OIDC del progetto app); passare i blocchi
via Storage (il coordinatore li sposta in pochi secondi); `assemble()` del producer al posto di
ffmpeg (non porta il nostro mix).
