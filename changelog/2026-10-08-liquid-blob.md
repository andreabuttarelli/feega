# LiquidBlob: una goccia 3D vera, rifrazione nello shader

Componente nuovo `LiquidBlob` e tool `add_liquid_blob`. Il `LiquidGlass` di ieri (filtro SVG con
mappa di spostamento radiale) è stato giudicato «poco liquid e poco glass»: un disco piatto che
ingrandisce, senza volume, senza luce vera, con i gradini della mappa a 8 bit.

- **Come**: gruppo come LiquidGlass (`firstLayer: 0`). Le tracce sotto finiscono in `#lbw-<id>`;
  sopra c'è un `<canvas>` WebGL 1 a piena risoluzione. Un fragment shader per pixel: campo SDF di
  1–4 sfere schiacciate (`FLAT`) unite con smooth-min, superficie trovata per bisezione su z
  (16 passi, niente sphere tracing: il campo deformato non è Lipschitz), normali per differenze
  centrali. Rifrazione a due interfacce (aria→vetro sulla calotta, vetro→aria sul fondo piatto,
  poi un salto `DEPTH` fino al piano): ingrandisce al centro, capovolge al bordo, e dove c'è
  riflessione totale interna nasce l'anello scuro dei vetri veri. Dispersione = tre rifrazioni
  con IOR ± `dispersion`. Fresnel di Schlick su un ambiente da studio procedurale, due speculari
  stretti, bordo luminoso sottile, ombra morbida e caustica sul piano, frost a 12 tap di Vogel.
- **Il contenuto rifratto** non passa da html-to-image: `paintPlan` legge il DOM sotto
  (percorsi SVG con `getScreenCTM` e gradienti, testo per righe con `Range`, box pieni,
  immagini e canvas) e `paintOps` lo ridisegna in Canvas 2D a piena risoluzione; la texture è
  lineare e si ricarica solo quando il piano cambia (chiave JSON degli op). Limite dichiarato
  nella descrizione: filtri ed effetti CSS sotto non vengono rifratti (la grana del fondo è
  rifatta nello shader).
- **Liquido, deterministico**: le posizioni arrivano dalle `spring()` del motore (bake delle
  espressioni). `blobStrains` integra da frame 0 una deformazione di taglio (traccia zero, area
  costante) che insegue un bersaglio: allungamento lungo la velocità, schiacciamento lungo
  l'accelerazione; la `viscosity` sceglie frequenza e smorzamento del rimbalzo. Una riga per
  frame (`ROW`), interpolata linearmente per i sotto-campioni del motion blur. Il wobble è una
  somma di seni con seed sul tempo locale. Split: `drops` sfere lungo `splitAngle`, raggio
  ridotto per conservare il volume, fuse da `blend`.
- **Parità**: export dal browser (html-to-image, ANGLE Metal) contro producer locale
  (SwiftShader, motion blur 8 campioni, H.264): 37,5 / 38,3 / 36,4 dB a 2,8 / 4,3 / 7,2 s, la
  stessa fascia del LiquidGlass.
- **Costo**: seek con la goccia 4–6 ms su Metal, 25–55 ms su SwiftShader (il primo 390–410 ms:
  compilazione e upload della texture 1080p). Lo screenshot della pagina costa 0,5–0,7 s con o
  senza goccia (il filtro grana a tutto schermo pesa più del vetro). Producer locale, 4 worker,
  8 campioni: ~3,7 s per frame in uscita.
- **Scartato**: icosfera con displacement nel vertex shader (le gocce che si dividono e si
  fondono richiedono un campo implicito), three.js (un quad e due shader non giustificano il
  modulo), html-to-image per frame (lento, e torna a 8 bit sfocati).
- `addLiquidGlass` diventa `addLens(doc, Lens, …)`: stessi passi per i due componenti.
