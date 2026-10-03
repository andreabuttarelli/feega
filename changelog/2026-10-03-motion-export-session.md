# Motion: l'export non cattura più il documento precedente

Segnalato: il terzo export di una sessione conteneva clip del trailer v2 dentro il video UGC.

**Causa.** `MotionPreview` cambia `srcdoc` per catturare (export, `view_frames`) e aspettava il
primo evento `ready` del player. Un `ready` del caricamento precedente, ancora in coda, risolveva
l'attesa prima che il nuovo documento entrasse nell'iframe: `contentWindow` era ancora il vecchio
documento, che rispondeva con i suoi frame. Due catture sovrapposte (export e self-check
dell'agente) si scambiavano anche il `srcdoc` a vicenda.

**Fix** (`hyperframes/preview-driver.ts`):

- ogni composizione porta uno `stamp` (hash del contenuto) nel runtime di cattura; la risposta lo
  ripete, e il driver scarta e ripete le risposte con lo stamp sbagliato;
- le catture prese in prestito passano da `exclusive`, una alla volta.

Test: `preview-driver.test.ts` riproduce il `ready` stantio con un player finto lento (rosso prima
del fix: catturava `trailer-v2`).
