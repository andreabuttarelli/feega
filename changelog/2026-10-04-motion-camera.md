# Motion editor: camera virtuale e profondità di campo

Richiesta di un cliente: movimenti di camera 3D e depth of field nel motion editor.

**Schema v4.** `doc.camera` è `null` (nessuna camera: il generatore produce esattamente l'HTML di
prima) o `{ base, dof, keyframes }`. I valori (`x`, `y` in frazioni del frame, `z` dolly in px,
`rotateX/Y/Z`, `fov`, `focusDistance`, `aperture`) e i loro intervalli stanno in una tabella sola,
`CAMERA` in `camera.ts`; i keyframe sono quelli dei clip (eases e bezier), in frame del video. Ogni
clip ha `depth` (px dietro il piano 0) e `space` (`world` | `screen`). I doc v3 salgono con
`camera: null, depth: 0, space: 'world'`.

**Matematica.** `cameraMath(sample)` è una fabbrica autosufficiente: i test la chiamano e la pagina
ne inietta il `toString()`, quindi preview, export e test eseguono lo stesso codice (un helper
esterno verrebbe rinominato dal minificatore). La camera sta a `P0 - z` dal piano 0, con `P0` la
prospettiva del fov di base: il fov cambia la prospettiva senza spostare la camera (zoom), il dolly
sposta la camera. Il mondo riceve l'inversa: `translateZ(P) · Rz⁻¹ Rx⁻¹ Ry⁻¹ · T(-C)` come
`matrix3d`. Un layer a profondità `d` è scalato `(P0+d)/P0`: a riposo resta identico al layout
piatto, la parallasse nasce solo quando la camera si muove.

**DOF.** Blur per layer = `aperture · |d − focus| / 100`, massimo 40 px, zero sotto 0,5 px, solo
sul wrapper `.layer` (il blur dei keyframe resta su `kf`, quello delle transizioni su `fx`: i tre
si sommano, ognuno ha un solo proprietario). Al massimo 8 layer partecipano, dal fondo.

**Generatore.** Con la camera, i clip `world` stanno in `#world` (preserve-3d) e quelli `screen`
sopra, piatti. Uno script campiona la camera per frame da un plugin GSAP di render + `hf-seek`:
il runtime fa seek con i callback soppressi (vedi LESSONS), e lo stesso guaio aveva il 3D: la
scena three.js si ridisegnava con un `onUpdate` mai chiamato, quindi nei render e in `view_frames`
un Model3D restava fermo al frame 0. Ora usa lo stesso driver (`seekDriver`).

**Model3D/Shape3D.** Il layer è un billboard alla sua profondità (guarda la camera), e la camera
three.js orbita nella direzione camera→oggetto a distanza fissa (la dimensione la fa la prospettiva
CSS, non due volte). Il bokeh è un pass su depth texture che conserva l'alpha: `BokehPass` di three
scrive `alpha = 1` e avrebbe annerito lo sfondo trasparente.

**Preset.** `PRESETS` in `camera-ops.ts`: dolly in/out, truck, pan (due chiavi con l'ease
scelto), orbit, crane, dolly zoom (16 segmenti lineari sulla curva vera: orbit tiene il target al
centro entro 1 px, dolly zoom tiene la dimensione del piano a fuoco), rack focus (fuoco dalla
profondità di un clip all'altro, accende il DOF). Partono dai valori della camera all'istante di
inizio e tengono le chiavi fuori dall'intervallo: si concatenano.

**UI e agente.** Riga Camera in cima alla timeline con le sue corsie (chiavi spostate, ease e
cancellate dal percorso dei clip, `CAMERA_LANE`); inspector camera con mappa dall'alto, dial,
contagocce "focus on clip", preset; campo Depth e toggle screen space sui clip. Tool:
`set_camera`, `set_camera_keyframes`, `apply_camera_preset`, `set_clip_depth`.

**Costo del render (Vercel Sandbox, demo 14 s 1080p con DOF, rack focus, orbit su GLB con
bokeh).** Senza camera 83 s, con camera 183 s; poi 128 s togliendo tre sprechi: la scena three.js
si ridisegnava (e passava dal bokeh) anche fuori dal suo clip, il bokeh campionava ogni pixel
(ora salta quelli a fuoco e lo sfondo senza oggetti vicini, 24 tap), e uno sfondo pieno veniva
sfocato a tutto schermo (`LOOKS_THE_SAME_BLURRED`). In locale, SwiftShader: 751 → 373 ms/frame nel
tratto con blur CSS, 467 → 277 nell'orbita (senza camera 171/183).

**Verifiche.** html-to-image (`view_frames`, export nel browser) cattura trasformazioni 3D e filtri
come lo schermo. Scartato: tween GSAP per ogni valore della camera (il dolly zoom lega fov e
posizione, un campionamento per frame è più semplice e deterministico).
