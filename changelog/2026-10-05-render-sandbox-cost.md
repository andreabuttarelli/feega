# Render motion: meno sandbox accese, prezzo dal costo

**Perché.** Fattura Vercel Sandbox: Active CPU $4.89, Provisioned Memory $4.05. Dall'API
(`/v1/sandboxes`, sola lettura) nessun render è stato addebitato a un utente (`ai_calls`
`motion_render` = 0): la spesa è nostra. Del periodo motion (dal 3/10) l'87% viene da bench e
test degli agenti (timeout 5/12/14/40/120 min, non quelli del codice), il 13% dal percorso di
produzione. Il 5/10 quattro worker di un render sono rimasti accesi 20 min per ~60 s di CPU:
nessuno li fermava se il tick non li vedeva.

**Cosa.**
- Reaper nel tick (`reconcileRenders` → `reapOrphans`): lista i worker accesi del farm
  (`RenderFarm.running`, `Sandbox.list` con `namePrefix`) e ferma quelli che nessun render
  `running`/`finishing` possiede, dopo 3 min di grazia. I fork si chiamano
  `feega-motion-w-<VERCEL_ENV>-<uuid>`: il reaper di production non vede quelli di preview o
  locali.
- `launchPiece` ferma il worker se la scrittura del job fallisce.
- Un retry che non parte consuma il tentativo (prima ritentava a ogni tick senza salvare nulla).
- Primo worker sparito prima dell'assemblaggio: il chunk 0 torna `failed` e si ritenta, invece
  di lasciare il render bloccato fino a `RENDER_DEADLINE_MS`.
- Timeout per chunk calcolato dal lavoro (2 min + 500 ms per frame 1080p, primo worker +5 min),
  tetti invariati (20 min chunk, 120 min whole).
- Chunk da 120 a 450 frame. Bench 30 s 1080p, 4 vCPU, stop immediato: 8 chunk $0.031,
  2 chunk $0.0073, stesso tempo (~26 s dal lancio). Il minimo fatturato è 1 min di memoria per
  sandbox: con chunk da ~15 s si pagava soprattutto quel minimo.
- Prezzo in crediti dal costo (`renderCostUsd`): prezzi Vercel, consumo misurato per secondo a
  1080p30, ~3.5 min di worker in attesa, margine ×3 per contenuti pesanti, poi listino
  (`CREDITS_PER_USD_SUBSCRIPTION_LIST`, già ×2). 30 s 1080p: da 6 a 9 crediti; 4K e motion blur
  scendono (prima sovrastimati).

**Scartato.**
- 2 vCPU: 30 s 1080p in 1 chunk $0.0048 ma 58 s di lavoro; 4 vCPU × 2 chunk $0.0073 in 20 s.
  Differenza sotto il centesimo, si tiene la velocità.
- Snapshot pre-scaldato: c'è già (`FARM_BASE` persistente, fork per chunk); avvio ~10 s.
- Frame e check dell'agente nel browser: lo sono già (`FrameUpload`), nessuna sandbox.
