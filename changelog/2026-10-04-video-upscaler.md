# AI Video Upscaler: strumento `/app/upscale` e upscale vero sulla tela

**Perché.** Search Console porta "ai video upscaler" (92 impressioni, pos. 13.5) e "video
upscaler" (42, pos. 18.8). La landing `/ai-video-upscaler` mandava sul template `hd-clip`, che
genera una clip nuova: non ingrandisce niente. FLUX Video Upscale era nel catalogo ma non poteva
girare da nessuna parte.

**Cosa non funzionava, tutto insieme.** `videoRefCapacity` dava 0 video al modello; il sync di
`ai_models` gli negava la modalità `video` (la rotta `/videos/models` non ha `architecture`, e
nessun campo dichiarava l'ingresso video); il giro chiedeva un prompt (`prompt_required`); il
trasporto mandava `duration`/`resolution`/`aspect_ratio` e un brief di regia; e un video
CARICATO non arrivava mai a valle, perché `upstream.ts` leggeva solo `data.refId` mentre un
upload scrive `data.assetId` (difetto più largo dell'upscale: valeva per ogni media caricato).

**Decisioni.**
- I limiti stanno sullo spec del modello (`FLUX_UPSCALE_LIMITS`, `video-models.ts`): 20 s,
  50 MB, mp4, ingresso fino a 2560×1440, uscita ≤ 14.4 MP, fattore 1.5–3×. Fonte: docs BFL
  (`docs.bfl.ai/flux_tools/flux_video_upscale`); il registro diceva 30 s, era sbagliato.
- `upscale.ts` è puro: `planUpscale` (2× o 4K = lato lungo 3840, tagliato a 3× e al tetto MP) e
  `quoteUpscale` (MP in uscita × secondi × `cents_per_megapixel_second_{precise,creative}` letti
  da `ai_models.pricing`, mai un listino a mano).
- `upscale_factor`/`creativity` entrano in `param_schema` come range dal sync: la barra della tela
  li mostra senza codice nuovo, e `extraParamsOf` li spedisce. Serve un sync dopo il deploy (il
  cron giornaliero lo fa).
- Lo strumento non ha un motore suo: `startUpscale` crea sulla tela "Upscale" del progetto un nodo
  sorgente e un nodo video FLUX collegato su `videos`, e chiama `runGenNode`. Così crediti,
  `logAiCall`, `node_runs`, riconciliatore, marcatura AI, asset e purge del provider sono quelli
  già in produzione.
- Campagna: `ai-video-upscaler` → template `video-upscale` (clip d'esempio Seedance Mini 480p
  collegata all'upscaler) e atterraggio su `/app/upscale`, dichiarato dalla riga del registro
  strumenti (`campaign`), non da un `if` in `entry.ts`.

**Verificato.** Giro reale dal browser (utente usa-e-getta): 854×480 2 s → 1708×960, preventivo
49 crediti, addebito reale 46 crediti ($0.23), asset `ai_marked`, metadato IPTC
`trainedAlgorithmicMedia`. Gli esempi in `static/upscaler/` sono quell'output (Big Buck Bunny,
CC BY 3.0).

**Scartato.** Un percorso di upscale separato (`upscaleOnOpenrouter` sincrono, 60 s): non regge
la durata di un render e duplicherebbe la fatturazione. Rifiutare 4K sopra 1440p: impossibile,
l'ingresso è già limitato a 1440p e 1.5× porta a 3840.

**Aperto.** `node_runs.cost_usd` resta null su questo giro (lo era già per ogni video del
riconciliatore); `ai_calls` porta il costo vero.
