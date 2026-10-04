# Motion editor: frame rate per video

Prima `fps` era `z.literal(30)` e `FPS` una costante letta da anteprima, timeline, inspector,
tool dell'agente e bake delle Composition. Ora `doc.fps` è uno di 24/25/30/50/60
(`FRAME_RATES` in `design.ts`), con default 30: i doc salvati non cambiano.

**La regola del tempo: si salvano frame, e cambiare fps li riscala.** Scartato «tempo in secondi»:
timeline, snap, identità dei keyframe, tool dell'agente e il contratto a frame interi di
HyperFrames (i blocchi del render distribuito sono intervalli di frame) parlano tutti in frame;
passare ai secondi avrebbe toccato ogni op e la tabella di parità per un evento raro. Cambiare fps
è una sola op (`setFrameRate` in `frame-rate.ts`): ogni campo-frame (inizio, durata, trim,
transizioni, keyframe delle clip e della camera, durata del doc) diventa
`round(frame × nuovo / vecchio)`. Andata e ritorno verso un fps più alto è esatta; verso uno più
basso arrotonda al frame più vicino e due keyframe che cadono sullo stesso frame si fondono
(vince l'ultimo, come `byFrame`). La durata massima resta in secondi (`maxFrames(fps)`).

**Render.** Il producer distribuito di HyperFrames accetta solo 24/30/60: 25 e 50 vanno sulla
rotta `whole` (un worker, `createRenderJob`/`executeRenderJob` in-process). La scelta della rotta è
una tabella (`WHOLE_ONLY` in `farm-render.ts`); il worker riceve la config come `spec.json`, non
come argv posizionali. Un render intero può durare più di uno a blocchi: timeout worker 12 min,
`maxDuration` 800 s sull'editor (il lavoro gira in `waitUntil`), scadenza `motion_render` a 14 min.
Provato su Vercel Sandbox: 2 s a 25 fps, 20 s dall'avvio al file.

L'agente lo imposta con `set_canvas { fps }` e lo legge in `get_motion_doc`; i suoi tempi restano in
secondi a qualunque fps.
