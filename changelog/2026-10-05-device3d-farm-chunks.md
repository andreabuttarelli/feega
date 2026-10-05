# Device3D sul farm: chunk dal costo, timeout spezzati

**Perché.** Un mockup Device3D a 1080p costa ~1,6–2,5 s per frame sul farm, contro ~60 ms di un
frame piatto. I chunk erano di 120 frame a prescindere dal contenuto: un chunk pieno di device
superava la vita del worker e moriva senza un messaggio utile.

**Misure (sandbox Vercel, 4 vCPU, 90–120 frame di laptop a 1080p).**

- Il WebGL del farm è SwiftShader con JIT **Subzero**: lo stesso frame in locale (SwiftShader
  LLVM) costa 70 ms, sul farm ~1,6 s. Il producer distribuito esige SwiftShader per i retry
  identici al pixel, e la sandbox non ha GPU: la strada GPU non esiste.
- Dove va il tempo: l'ambiente PMREM pesa ~65% del frame (senza: 49 s invece di 142 s su 90
  frame); dimezzare la risoluzione della tela 3D −53%; clearcoat, riflesso dello schermo,
  `MeshStandardMaterial` −22% ciascuno; antialias e risoluzione della texture schermo nel rumore.
  Nessuno di questi tagli è stato applicato: cambierebbero l'immagine in preview ed export.
- Sprechi tolti: la scena veniva ridisegnata più volte per frame (seek del producer, `onUpdate`
  della timeline, reseek dopo l'iniezione del frame video) e la texture dello schermo ricaricata
  a ogni draw. Ora `drawOnce` disegna una volta per (tempo, sorgenti degli schermi) e
  `screenKey` ricarica la texture solo se cambia immagine, frame video o scroll. 120 frame:
  239 s → 142 s su 90 (≈1,8 → 1,3 s/frame).

**Cosa.**

- `render-cost.ts`: tabella del costo per frame per componente 3D, scalato sui pixel del frame.
  Il `FarmJob` porta `cost`, `chunkPlan` restringe i chunk finché il più pesante sta in 2 min
  di lavoro stimato, fino a 16 worker (prima 8). Le dimensioni sono pari.
- Pezzi come `Slice {index, size}` sulla griglia del producer (`chunkSize`): un worker sparito
  (timeout o crash) spezza il suo chunk in due metà sulla griglia di metà dimensione, su worker
  nuovi; i file si chiamano col primo frame (`c360.mp4`), l'assemblaggio li concatena in ordine.
- Errori: «frames 360–479 failed after 2 attempts: …» e, sotto i 20 frame, «did not finish …
  too heavy for the farm» con cosa abbassare. Ogni step scrive nel log tempo ed esito.

**Scartato.** Pixel ratio < 1 sulla tela 3D (sfoca), togliere l'ambiente sul farm soltanto
(preview ed export diversi), GPU (assente e vietata dal producer distribuito).
