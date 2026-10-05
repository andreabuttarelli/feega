# Render motion pagati sul tempo misurato, chat ×4

**Perché.** Il preventivo del render era una stima addebitata così com'era: un render 3D o un
Device3D costava molto più del prezzo, e una sandbox lasciata accesa non toccava il prezzo.
La chat addebitava il costo dei token ×2 (200 crediti per $1, crediti venduti a 100 per €1).

**Cosa.**
- A fine render si leggono CPU attiva, memoria e tempo da avvio a stop di **ogni** worker usato,
  compresi quelli sostituiti da un retry (`RenderFarm.usage` → `Sandbox.get`), dopo averli
  fermati. Costo = `sandboxCostUsd` (prezzi Vercel, minimo 1 min di memoria per sandbox).
  Crediti = costo × `RENDER_MULTIPLIER` (5) × 100, una costante in `render-quote.ts`;
  `MULTIPLIER_FLOOR` = 4 in `credit-ladder.ts`, un test fallisce sotto.
- Hold: all'avvio `holdCredits` scrive un debit pari a preventivo × `HOLD_BUFFER` (1,5) e rifiuta
  con `credits_exhausted` se il saldo non basta. A fine render un grant `refund` restituisce
  l'hold e `logAiCall` scrive il debito reale. Nessuna tabella nuova: `credit_ledger` con
  sorgenti esistenti (`ai_usage`, `refund`).
- Tetto: il reale si addebita fino all'hold (preventivo × 1,5), mai oltre; l'eccesso resta a
  noi e si vede (`console.warn`, `ai_calls.cost_usd` contro `billed_credits`). Motivo: l'utente
  ha approvato un numero; addebitare oltre quello che ha visto riservare è una sorpresa, e uno
  scarto oltre il 50% è un errore della nostra stima, non una sua scelta.
- Fallimenti e cancel: zero, hold restituito. Cancel a zero per semplicità: un render annullato
  costa centesimi.
- Preventivo per classe (`renderClass`: piatto, 3D, Device3D) dai bench del 5/10 sul farm, per
  frame 1080p: piatto 0,08 s CPU / 0,04 s, Text3D 1,8 / 0,46, Device3D laptop 4,6 / 1,2; 4K ×2,5;
  blur × campioni su 16 GB; attesa del tick 30 s per worker + 90 s sul primo. Ogni classe sta
  entro il 4% del bench (test con le misure come fixture).
- Il timeout dei worker usa lo stesso costo per frame (`FarmJob.frameSeconds`, ×2): con #152 un
  chunk 3D da 450 frame aveva 5,75 min per ~9 min di lavoro.
- Chat: una regola in `ai-log.ts` (`MULTIPLIERS`) prezza le chiamate LLM di un agente in un
  thread a `CHAT_MULTIPLIER` (4) invece di 2. Le altre chiamate restano ×2.

**Scartato.** Addebitare il cancel sul tempo consumato; un tetto più alto dell'hold; una tabella
`credit_holds` (il ledger basta).

**Limite.** Un render chiuso da `expireStuckRuns` (scadenza 6 h) non rilascia l'hold.
