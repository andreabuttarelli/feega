# Render sul farm: matte vettoriali, worker da 1 vCPU, piano a 32 worker

Caso: masking-loop v3 (270 frame 1080p30, 3 matte, forme liquide con stroke e ombra, blur ×6),
27 worker da 10 frame.

## Misure (farm, 6/10)

| | tempo | costo farm | PSNR vs prima |
|---|---|---|---|
| prima (4 vCPU, matte PNG), dato di partenza | 326 s | ~$0,65 | — |
| prima, rifatto oggi | 795 s (un worker morto; ultimo chunk vivo a 298 s) | $0,52 | — |
| dopo, tre run | 232 / 266 / 297 s | $0,20 / $0,27 / $0,25 | 56,5 dB (min 54,1) |

Costo "come in produzione": CPU fatturata + memoria di ogni worker fino al suo pezzo + idle.

## Perché i worker in parallelo andavano più lenti

Non il numero. Due sandbox identiche, aperte insieme, fanno lo stesso chunk a 7,9 e 17,2 s/frame
e la CPU fatturata segue il tempo. Un loop di CPU puro su 27 sandbox in parallelo rallenta al
massimo 1,45× (boot_id diversi: VM diverse). Il dato di partenza (8,7 isolato contro 32 in
parallelo) confrontava una sandbox veloce con una lenta.

Curva intera (worker da 1 vCPU, matte vettoriali):

| worker | frame/worker | tempo | costo | CPU/frame |
|---|---|---|---|---|
| 4 | 68 | 3 su 4 oltre i 20 min del worker | — | — |
| 8 | 34 | 724 s | $0,23 | 18,0 s |
| 16 | 17 | 559 s | $0,24 | 18,6 s |
| 27 | 10 | 232–297 s | $0,20–0,27 | 14,5–19,9 s |
| 54 | 5 | 203 s | $0,32 | 23,1 s |

Il costo per frame resta piatto fino a 27 e sale a 54; il tempo scende poco dopo 27. Regola in
`chunkPlan` (`SPLIT`): si divide per velocità fino a 32 worker, oltre solo finché un chunk
supererebbe la vita del worker (fino a 64).

## Cosa cambia

- **Matte vettoriali.** Il passo esatto della matte usa `toSvg` di html-to-image invece di
  canvas → PNG → decode: `before` passa da ~0,8 s a ~0 per campione, lo screenshot sale di
  ~0,14 s. Il passo bozza (anteprima che suona) resta raster ridotto.
- **Worker 2D da 1 vCPU.** Il frame 2D è seriale: pinnato a un core va 1,26× più lento e fattura
  meno CPU, e 1 vCPU porta 2 GB invece di 8. Il 3D resta a 4 (SwiftShader 2,4× più veloce).
  `CHUNK_VCPUS` per classe di render; `FarmJob.renderClass` viene dal doc.
- **CARD_COPY_MS 70 → 5.** Ring da 6 e 12 carte: 280 ms/frame su un worker, 60 dei quali lo
  stage vuoto.
- **Stima.** 2 GB per vCPU; costanti per frame 2D e per effetti rifatte su run da 1 vCPU
  (righe `BENCH_2026_10_06_ONE_VCPU`, ±50%).

## Scartato

- **Blur adattivo per layer.** In questo doc si muovono tutti i layer costosi (corpi con stroke
  e ombra, inchiostri sotto matte che seguono i corpi); statici solo il foglio e il testo base,
  che costano quanto uno stage vuoto. Comporre i campioni nella pagina richiederebbe di
  rasterizzare il DOM in JS: è ciò che le matte vettoriali hanno appena tolto.
- **Cattura più veloce.** `optimizeForSpeed` sul PNG: 0–8%, nel rumore su 1 vCPU. JPEG senza blur
  contro PNG: lo screenshot è raster dei filtri, non codifica. beginFrame non è disponibile (il
  producer sceglie screenshot dal probe). Nessun guadagno vero, nessuna patch.
- **Regione stretta per i filtri dei precomp (tint).** Nessuna differenza misurabile.

## Obiettivo

Sotto 3 minuti e sotto $0,20: non garantito. Il costo medio è sceso di ~2,5×, il tempo resta
dominato dalla sandbox più lenta (fino a 2,2× la più veloce).
