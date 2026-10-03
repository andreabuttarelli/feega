# Motion editor: keyframe e trasformazioni 3D

Ticket 1 del piano timeline pro (poi: maschere; multi-edit, gruppi, blend; extra UX).

**Schema v2.** Ogni clip ha `transform` (valori base, solo quelli impostati) e
`keyframes: { prop: [{frame relativo al clip, value, ease}] }`; ease = tabella design o
cubic-bezier `[x1,y1,x2,y2]`, ed è la curva del segmento che *lascia* il keyframe. I doc v1
salvati salgono a v2 al caricamento (`upgradeDoc`, tabella `MIGRATIONS`, pura). Una versione più
nuova del codice viene rifiutata. Cosa si anima è una tabella sola, `ANIMATABLE` in
`keyframes.ts`: transform per ogni componente visivo (non le ancore), colori per componente,
oggetto e camera per Model3D/Shape3D.

**Generatore.** Un clip animato annida `kp` (perspective) › `kf` (translate/rotate/skew/scaleX/Y,
opacity, blur) › `ks` (scale uniforme, variabili CSS dei colori) dentro `fx` (transizioni): mai
due sorgenti sulla stessa coppia elemento/proprietà (`scale` e `scaleX` di GSAP scrivono lo
stesso componente, per questo `ks`). Valori base con `gsap.set` prima della timeline, `tl.set`
del primo valore all'inizio del clip, un `fromTo` per segmento con durate non arrotondate. Le
bezier si registrano come ease GSAP usando lo stesso `sampleTrack` serializzato; lo stesso
sampler guida three.js (orbit sostituisce la formula start/end angle solo se ha keyframe).
Colori: il template legge `var(--kc-<prop>)`. GSAP è devDependency solo per i test che
confrontano le ease e provano seek in ordine casuale.

**UI.** Corsie keyframe sotto i clip selezionati (◆ sulla barra le chiude), drag con snap,
selezione multipla, ⌘C/⌘V, Del, J/K, ease picker con anteprima curva. Inspector: valore al
playhead, ◆ per proprietà, dial, ancora 3×3; modificare una proprietà con keyframe crea/aggiorna
il keyframe al playhead.

**Difetti trovati dal vivo.** (1) Il player emetteva `timeupdate` a 0 dopo ogni ricarica della
composizione e riportava indietro il playhead: i keyframe finivano al frame sbagliato. Ora
`timeupdate` conta solo in riproduzione. (2) Le props di layout `x/y/scale/opacity` hanno lo
stesso nome delle chiavi transform: l'inspector le instradava sul transform. Solo le props
`Source.Prop` (colori) passano per i keyframe (`keyedField`).

**Agente.** `set_keyframes`, `remove_keyframes`, `set_transform` in secondi dal clip.
Verifica: card su 3 assi + Duck GLB in orbita, seek deterministici, MP4 120 frame senza salti,
turno agente $0.0012.
