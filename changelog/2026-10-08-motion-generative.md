# Utilità generative (`gen`) nei componenti custom

Un componente custom ora riceve `gen`, un insieme di librerie pure per l'arte generativa. A
differenza di d3/p5/Pixi/matter **non arrivano da CDN**: esbuild le fonde in un IIFE
(`generative-entry.ts`, modulo virtuale `virtual:motion-generative`) che `composeHtml` inlinea
nella pagina, solo se un componente usato scrive `gen.`. Quindi funzionano offline in render,
export interattivo, frame server ed embed, senza voci nuove nella CSP. Peso inline: 171 KB
minificati (test: < 200 KB), di cui clipper-lib 100 KB.

| Libreria | Versione | Licenza | min | In `gen` |
|---|---|---|---|---|
| simplex-noise | 4.0.3 | MIT | 4 KB | `noise2D/3D/4D()` seminati |
| poisson-disk-sampling | 2.3.1 | MIT | 10 KB | `poisson(options)` seminato |
| d3-delaunay | 6.0.4 | ISC | 20 KB | `Delaunay` (Voronoi con `.voronoi()`) |
| simplify-js | 1.2.4 | BSD-2 | 1 KB | `simplify` |
| isect | 3.0.3 | MIT | 18 KB | `isect.bush/sweep/brute` |
| rbush | 4.0.1 | MIT | 6 KB | `RBush` |
| kdbush | 4.1.0 | ISC | 4 KB | `KDBush` |
| robust-point-in-polygon | 1.0.3 | MIT | 9 KB | `inside` |
| clipper-lib | 6.4.2 | BSL-1.0 | 100 KB | `ClipperLib` |

- Seed: ogni `noise*()`/`poisson()` riceve un generatore `seeded(seed del clip + n)`, n che sale
  a ogni chiamata — due campi diversi nello stesso clip, identici a ogni render. I costruttori
  grezzi (che cadrebbero su `Math.random`) non sono esposti.
- Commit di solo riordino prima: il plugin Vite del runtime live è diventato una tabella
  modulo virtuale → entry (`scripts/motion-bundles.ts`).
- Scartati: `streamlines` (@anvaka, 1.6.0): API solo asincrona (`run()` a colpi di
  `setTimeout`) e seed di default da `Math.random`, incompatibile col boot sincrono;
  `js-angusj-clipper` (WASM) a favore di clipper-lib in JS puro; `voronoi` a favore di
  d3-delaunay; `seedrandom` (c'è già `rand()`).
- Licenze tutte permissive. BSL-1.0 (Boost) chiede la nota di copyright nelle copie del
  sorgente; esbuild la toglie (non è un commento `/*!`), quindi l'entry la porta come stringa
  in `gen.notices`, che la minificazione non tocca.
- Verificato: Voronoi da punti Poisson mossi da simplex, doc costruito con `write_component`,
  7 frame con `drawFrames` (Chromium locale), le visite ripetute identiche al byte.
