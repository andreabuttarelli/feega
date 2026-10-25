# Esperimento A: Electron con canvas gpu-core nativo (Metal)

Branch `spike/electron-native-canvas`, codice in `spikes/electron-native-canvas/`. Metodo: `../METHOD.md`.
Documento: `../scene.json`, 53 MB. Contiene 44 frame: 16 landing, 12 UI di app, 10 poster e 6 frame motion con 84 sprite animati. In tutto 4.743 nodi e 120 immagini JPEG vere. Il testo è vero, convertito in contorni dei glifi (Arial e Georgia).

## Come è costruito
- **Addon N-API in Rust** (`native/`, napi-rs 2). Crea un `NSView` figlio della content view di Electron, posizionato **dietro** le web contents, e wgpu ci crea sopra un `CAMetalLayer`. La pagina è trasparente nella zona del canvas, quindi tutto l'input (wheel, drag, selezione) resta nel DOM e non serve inoltrare eventi nativi.
- Un thread di render Rust usa `Compositor`, `Library` ed `Engine` di gpu-core, cioè lo stesso percorso di `web.rs` (il `GpuPainter` è copiato). La camera passa via IPC renderer → main → Mutex. Present in modalità Fifo.
- La UI (toolbar, layers, properties, selezione) è una pagina HTML minimale, **non** l'app Svelte di feega. Lo stesso `app.js` gira anche in modalità web (`WebCore` wasm), quindi entrambi i motori sono misurati sulla stessa pagina.

## Numeri (Apple Silicon, Retina 2x, canvas 992x849 pt, display 120 Hz)
**Load average della macchina tra 27 e 46 durante tutte le misure**: in parallelo giravano l'esperimento Flutter e altre build. Il confronto vale solo tra esecuzioni back-to-back.

| fase | native Metal (Electron) | wasm WebGPU (Electron 38) | wasm (Chrome 155) |
|---|---|---|---|
| overview (riempimento cache) | 1 fps | 8 fps | 0.5 fps |
| pan zoom 0.25, 10 s | 73 fps, p95 52 ms, max 307 | 99.5 fps, p95 15 ms | 82.5 fps, p95 26 ms |
| zoom 0.05→4→0.05, 10 s | 85.5 fps, p95 13 ms, max 953 | 118 fps, p95 10 ms | 108 fps, p95 10 ms |
| motion, 84 sprite, 5 s | 50 fps, p95 47 ms (27% >16.7 ms) | 80.6 fps, p95 23 ms (7.5%) | 56 fps, p95 58 ms |
| primo frame | 3.4–3.7 s | 3.1–3.9 s | 5.3 s |
| memoria a regime (`footprint`, tutti i processi) | **~1.38 GB** (main 1.30 GB, di cui 584 MB grafica) | **~2.48 GB** (GPU 1.6 GB + renderer 650 MB + main 212 MB) | n/m |
| uso GPU (ioreg, pan/zoom) | 74–76% | 67–71% | n/m |
| CPU (appMetrics) | 4–6% | 4–7% | n/m |

Nella prima esecuzione (con `ioreg` sincrono che bloccava il main process) il nativo faceva 43.6 / 56.7 / 84.2 fps in pan / zoom / motion. Il rumore tra due esecuzioni è dello stesso ordine della differenza tra i due motori.

**Nitidezza del testo**: `zoom-0.25/1/4.png` (nativo) e `web-baseline/` (wasm) sono identici a occhio, perché il motore è lo stesso (vello, tile cache, reproject da Rough a Sharp). A zoom 4 il testo è nitido. Gli spigoli sulle curve vengono dal generatore, che appiattisce ogni curva in 5 segmenti. Durante lo zoom entrambi i motori sfocano, e tornano nitidi a camera ferma.

**Motion**: si muove in tutti e tre i casi, ma nessuno tiene 120 fps stabili. Il nativo ha più scatti.

## Video e screenshot
`pan-zoom.mp4` (nativo) e `web-baseline/pan-zoom-web.mp4` hanno 180 frame a 30 fps. **Non sono registrazioni in tempo reale**: senza il permesso di registrazione schermo, ogni frame viene letto dalla GPU (`snapshot()` dell'addon) e composto sotto la cattura della UI (`shots.py`). Mostrano contenuto e qualità, non la fluidità. `ui.png` mostra l'app con l'intero documento.

## Cosa non funziona e difficoltà
1. **Il nativo non è più veloce.** Lo stesso gpu-core su wgpu/Metal va come o peggio del wasm su Dawn. Il lavoro pesante (raster vello in compute) resta sulla GPU in entrambi i casi. Possibili cause, non verificate: un thread a priorità normale contro il processo GPU di Chromium a priorità alta, una `layer_texture` allocata a ogni paint senza pool, il polling di wgpu.
2. Bug trovati nello spike. Le immagini passate come `ImageData` CPU venivano ricaricate nell'atlas di vello a ogni frame: vanno caricate in una texture registrata, come fa il web. Senza `device.poll()` nel loop il canvas restava a 2 fps.
3. La camera attraversa due passaggi IPC. Se il main process si blocca, il canvas si ferma mentre la UI continua.
4. L'overlay DOM e il layer Metal sono composti separatamente, quindi in un pan veloce possono sfasarsi di un frame.
5. Non coperti: gpu-text nativo, video nei nodi, filtri e lens, multi-monitor e cambio di DPI, firma e notarizzazione, Windows.
6. `capturePage` non vede il layer nativo: per screenshot e video serve la readback dall'addon.

## Stima per la produzione
6–10 settimane-persona per la sola versione macOS: pool di texture e priorità del thread, immagini e video nativi, gpu-text, sincronizzazione dell'overlay, multi-monitor, firma e notarizzazione, CI. Windows (D3D12) richiede lavoro in più. **Raccomandazione: no**, finché un profiling non dimostra che il nativo batte il wasm. Oggi la stessa app Electron con il canvas wasm (`--web`) ha fps pari o migliori senza codice nativo. L'unico vantaggio misurato del nativo è la memoria (~1.4 GB contro ~2.5 GB).

## Rilancio
- Doppio clic su `~/Desktop/feega-electron-spike.app` (legge `scene.json` dalla scratchpad).
- Dal worktree: `cd spikes/electron-native-canvas && npm i && npm run build:native && npx electron .` (con `--web` usa il motore wasm, `--bench` lancia il benchmark, `--shots` produce screenshot e video).
- Chrome: `node server.cjs`, poi aprire `http://127.0.0.1:5199/?bench=1&label=chrome-web`.
