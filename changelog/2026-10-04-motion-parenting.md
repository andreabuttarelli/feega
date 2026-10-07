# Motion editor: null e parenting

Richiesta insieme alla camera virtuale: muovere più layer insieme come in After Effects.

**Schema v5.** Ogni clip ha `parent` (id di un clip visivo o `null`) e `parentOpacity`
(`inherit` | `ignore`). `parentProblem` (in `parent.ts`) rifiuta loop, auto-parent, parent mancanti
o audio sia sugli edit sia al parse di un doc salvato. `Null` è un componente che non disegna niente:
props `x`/`y` (il pivot) e tutte le chiavi di trasformazione animabili. Togliere un parent libera i
figli (`removeClips`).

**Regola del tempo.** Il parent guida il figlio a ogni frame, anche fuori dal proprio intervallo:
prima del suo primo keyframe vale il primo, dopo l'ultimo vale l'ultimo (è lo stesso campionamento
dei keyframe, e il generatore lo ottiene dai tween GSAP con i valori iniziali e i `hold`).

**Generatore.** Il figlio è avvolto, dentro `.fx` e fuori dai propri wrapper, da una copia dei
wrapper `kp/kf/ks` di ogni antenato animato (dal più esterno), con classi `kpc-/kc-/ksc-<id>`; i
tween e i `gsap.set` dell'antenato puntano `#kf-<id>,.kc-<id>`. L'opacità vive anche lei su `kf`,
quindi ha una classe sua (`ko-<id>`) che solo i figli con `inherit` ricevono. Senza parent l'HTML
resta identico. Funziona con la camera: la copia sta dentro il `.layer` del figlio, quindi
profondità e spazio (world/screen) restano quelli del figlio.

**Posizione mantenuta.** `worldAt` compone le matrici 2D (pivot, traslazione, rotateZ, scala) degli
antenati; `setParent` ricava il nuovo locale `P⁻¹·W` e lo scompone in x/y/rotateZ/scaleX/scaleY,
spostando i keyframe esistenti della stessa quantità (somma per posizione e rotazione, rapporto per
la scala). È esatto per traslazioni, rotazioni nel piano e scale; rotateX/Y e z degli antenati non
vengono compensati (scartato: scomporre matrici 3D con prospettiva per un caso raro).

**UI e agente.** Inspector: Parent (scelta fra clip visivi che non discendono dal clip) e
"Inherit the parent opacity". Timeline: pick-whip `@` su ogni barra (trascina su un altro clip),
etichetta indentata con `↳ parent`. Toolbar: "Create null from selection" (null al centro dei box,
lungo quanto la selezione, figli riparentati senza muoversi). Tool: `add_null`, `set_parent`,
`parent_clips`.

**Trovato strada facendo.** Nel render su Vercel Sandbox ogni Image usciva come icona rotta: il
producer HyperFrames scarica le `<img>`/`<video>`/`<audio>` remote e le serve dalla propria
origine, e la CSP permetteva le immagini solo dall'host degli asset. `img-src` e `media-src` ora
includono `'self'` (in LESSONS).
