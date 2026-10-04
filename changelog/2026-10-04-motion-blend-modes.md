# Motion editor: blend mode per clip

Richiesta cliente: i sedici metodi di fusione di After Effects / CSS.

**Modello.** `clip.blend` (enum, default `normal`; zod mette il default ai doc salvati).
`setBlendMode` rifiuta i clip audio. Sta in `blend-ops.ts` e non in `blend.ts` perché `doc.ts`
importa l'enum: tenerli insieme farebbe un ciclo d'import.

**Render.** `mix-blend-mode` sul `.layer` del clip, il wrapper più esterno: la fusione avviene
dopo maschera, effetti, trasformazione e opacità, come per un livello di After Effects. `#root`
ha `isolation:isolate`, così la fusione si ferma al fotogramma e non legge la pagina che lo
ospita (preview, export dal browser, render su server vedono lo stesso gruppo). `normal` non
scrive niente.

**Con parent e camera.** Il modo non si eredita: i figli portano le copie dei wrapper del padre
dentro il proprio `.layer`, il `mix-blend-mode` del padre resta sul suo. Con la camera c'è un
problema vero: un figlio di `#world` (`preserve-3d`) con `mix-blend-mode` fa appiattire a Chrome
l'intero contesto 3D. Misurato: render su server e export dal browser divergevano (PSNR 10 dB),
e il render durava il doppio. Soluzione: un clip world con un modo diverso da `normal` esce da
`#world` (`Composite.Projected` nello `StageLayer`) e porta lui stesso `matrix3d(world)` seguito
dalla sua trasformazione di profondità, sotto la stessa `perspective` di `#root`: finisce dove
sarebbe finito nel mondo, e si fonde con il mondo già composto. Il prezzo, scritto qui perché si
vede: un clip proiettato si dipinge sopra i livelli world (ordine per traccia, non per
profondità). Dopo: server e browser a 27 dB, render 69 s per 9 s come senza fusioni.

**UI e agente.** Menu "Blend mode" nell'inspector; tool `set_blend_mode`; riga di parità.
