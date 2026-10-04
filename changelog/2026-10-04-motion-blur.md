# Motion editor: motion blur vero

`doc.motionBlur` `{ enabled, shutterAngle (180), shutterPhase (-90), samples (8) }`, i default
di After Effects, e `clip.motionBlur` (default `true`) per tenere nitida una clip.

**Metodo scelto: l'accumulo sub-frame dell'engine di HyperFrames.** Per ogni frame l'engine
cerca la timeline a `f + phase/360 + (k+0.5)/N · angle/360` (in frame) e media gli N PNG,
deterministico. Scartati: `tmix` di ffmpeg su un render a fps×N (il producer distribuito accetta
solo 24/30/60, e a 180° metà dei campioni cadrebbe fuori dall'otturatore) e una dilatazione del
tempo della composizione (camera, three.js, componenti custom e video leggono il tempo per conto
loro). Il producer distribuito non porta `motionBlur`, quindi il blur va sulla rotta intera:
una sandbox da 8 vCPU con `workers: 6` (senza, l'engine usa un solo browser).

**Costo misurato (Vercel Sandbox, 1080p60, 4 s, 8 campioni):** 99 s contro 28 s senza blur,
~51 ms per campione. Il render gira in `waitUntil` dentro i 300 s dell'unica funzione dell'app,
quindi `BLUR_BUDGET` = 4000 campioni a 1080p (frame × campioni × pixel/1080p): 1080p60 a 8
campioni regge ~8 s, 1080p30 ~16 s. Oltre, il render è rifiutato prima di partire dicendo cosa
abbassare. Per blur più lunghi serve un orchestratore che non viva nella richiesta (la testa del
farm che carica da sola su Storage + riconciliazione da cron), non un numero più alto. Il preventivo moltiplica i crediti per
i campioni. Due render dello stesso doc: 152 frame su 240 identici, gli altri ≥ 43 dB di PSNR.

**Clip nitida.** `holdStill` (`hyperframes/blur.ts`) gira sulla timeline GSAP: ogni tween i cui
bersagli stanno tutti dentro un layer `data-blur="off"` riceve un'ease che porta il tempo al
frame del campione (`round(t·fps − centro dell'otturatore)`), quindi tutti i campioni di un
frame vedono la clip nello stesso stato. Vale per transizioni, movimenti, keyframe ed effetti
(tutti sulla timeline principale); i componenti custom, il 3D e la camera seguono il blur del
video. Con clip Video il blur è rifiutato: l'engine estrae un frame video per frame di uscita.

**Export dal browser:** 2 campioni per frame (`BROWSER_SAMPLES`), media progressiva sul canvas
(`globalAlpha = 1/(k+1)`); l'anteprima dell'editor non sfoca. L'agente usa `set_motion_blur`.
