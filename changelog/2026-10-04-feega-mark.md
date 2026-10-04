# Marchio feega nell'intestazione

**Perché.** `BrandMark.svelte` disegnava ancora le lettere di «dazero» ruotate; accanto alla
parola «feega» nell'intestazione della dashboard e dei docs il marchio era quello vecchio.

**Cosa.** Il marchio diventa il segno della favicon (`static/icon-192.png`): orizzonte con
la cupola e l'anello sotto, un solo tracciato a 24px, angoli squadrati.

**Indagato e non riprodotto su main** (dopo #105), con l'harness usa-e-getta: preview nera
al frame 0 (immagine, video e forma a frame 0 si vedono al caricamento e dopo uno scrub) e
spazio vuoto fra righello e prima traccia. Il nero visto prima veniva da un `BrandBackground`
(fill `#0a0a0a`) in una traccia sopra il footage: la traccia in alto copre quelle sotto.
