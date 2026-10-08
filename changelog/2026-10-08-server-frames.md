# Frame motion lato server: Chromium headless in una funzione Vercel

Prima solo l'editor aperto in un browser disegnava i frame: `view_frames` dell'agente rispondeva
"frames unavailable" nei turni MCP/API (`ask_motion_agent`), canvas e a client chiuso, e un agente
esterno non aveva modo di vedere un video.

Ora `drawFrames` (`server-frames.ts`) compone l'HTML (`composeHtml`, scala 1), lo apre in una
pagina e per ogni tempo chiama `__player.renderSeek` del runtime hyperframes, aspetta
`__hfWaitForSeekCompletion`, i video e due rAF, poi screenshot JPEG q80. La riduzione a ≤960px è
`deviceScaleFactor`, non `composeHtml({ scale })`: con lo zoom il layout restava a 1920 e usciva
solo il quarto in alto a sinistra. Il browser è una porta (`BrowserPort`); l'adattatore
`chromium-frames.ts` usa `puppeteer-core` + `@sparticuz/chromium-min` (WebGL via SwiftShader).

- Ordine in `turn.ts`: moderazione, poi editor → server → `null` (= "frames unavailable",
  `firstFrames`). La moderazione resta prima di tutto: un rifiuto non cade sul server.
- `Browser.Absent` dà vision solo se `serverFramesOpen()` (su Vercel o con `CHROMIUM_PATH`):
  in locale e nei test nulla cambia.
- `POST /api/v1/motion/{id}/frames` `{ times ≤6, width ≤960 }` → JPEG base64 inline + `quality`
  / `blocking` (stesso `docProblems` + `frameProblems` di `view_frames`). Funzione a parte:
  `maxDuration 60`, `memory 2048`. Chiave read-only ammessa.
- Niente crediti: ~3 s × 2 GB ≈ $0.0001 a chiamata. Limite 10/min per org, in memoria per
  istanza (non globale): basta contro un loop, non contro un abuso distribuito.
- Bundle: la funzione pesa 41 MB scompattata (puppeteer-core 2 MB); il binario (pack 70 MB) si
  scarica da GitHub in `/tmp` al cold start, quindi fuori dal limite di 250 MB. `CHROMIUM_PACK_URL`
  lo sposta altrove.
- CLI `feega motion frames <id> --at 1,2.5,4`, tool MCP `view_motion_frames` (immagini MCP).

Verificato in locale (macOS, chrome-headless-shell, SwiftShader) con `scripts/server-frames.ts`
sul fixture liquid glass: la goccia WebGL rifrange il titolo; 3 frame cold 2.5 s, warm 1.2 s.
Non verificato su Lambda Linux: cold start reale e memoria vanno misurati sul primo deploy.
