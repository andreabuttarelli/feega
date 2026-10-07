# Bento e motion come ingresso della composizione

## Bento

Layout `bento` del clip Composition (`src/lib/canvas/composition/bento.ts`), renderizzato in
HTML come il ring (`hyperframes/bento.ts`), non in WebGL: le celle devono poter contenere DOM
vero (precomp).

- Griglia righe × colonne (1–4), celle con span (`columns`/`rows` sulla card) collocate in
  ordine nel primo posto libero; ciò che non entra cade, i posti vuoti restano celle col colore
  di fondo.
- Un solo `gap`, in px a 1080p scalato sul lato corto, vale fra celle e verso il bordo:
  `bentoCells` lo garantisce, `bento.test.ts` lo verifica su 1×1…4×3 e con gli span.
- `cornerRadius` default 24, keyframabile (stessa chiave del ring, già animabile).
- Per cella: `fit`, `focusX/Y`, `background`, `timing` (loop/hold per le comp).
- Ingresso a cascata (`enter`, `stagger`, `enterSeconds`) calcolato dal solo frame
  (`bentoAt`): seek deterministico.
- Ring e bento stanno in una tabella di layout a card (`CARD_LAYOUTS` in compose,
  `CARD_EXPANDERS` in precomp, `COMP_CARD_LAYOUTS`) al posto degli `isRing` sparsi.
- Precomp: nuovo `hold` — le clip vive sull'ultimo frame restano fino alla fine della clip.

## Motion come ingresso

- Porta `motions` (connettore e medium `motion`): motion → composition sì, composition →
  motion no (il motion non ha ingressi), quindi composition → motion → composition non si
  chiude; `upstreamCards` scarta comunque una sorgente che la composizione alimenta.
- Nessun pre-render: `GET …/motion/[nodeId]/source` dà la revisione di testa;
  `embedMotion` la annida come comp `m<nodeId>` con le sue comp rinominate sotto il proprio
  prefisso (niente del doc ospite è raggiungibile da dentro), asset e font uniti. Le espressioni
  restano sulle clip.
- Live: `docHeadRevision` arriva via realtime, `staleMotions` ricarica solo ciò che è cambiato.
- Fallback: sorgente illeggibile → poster frame; layout senza comp → poster.
- Export: `openCanvasComposition` annida le stesse teste nel doc che apre in Compositions.
- `bentoSlotAt`/`slotLocal`: box della cella e mappa frame → spazio locale della comp al frame
  t, per gli input runtime (pointer) delle espressioni.

## Limiti noti

- La comp è disposta nel frame dell'ospite: un motion verticale in una composizione orizzontale
  mantiene le frazioni di posizione, non il proprio aspetto.
- fps diversi fra sorgente e ospite non sono convertiti.
- Pannello minimo sul nodo (`BentoPanel.svelte`): righe, colonne, gap, radius e span per cella,
  scritti con `write(id, patch)` tramite `bentoGridPatch`/`cellSpanPatch`. Fit, crop, colore e
  timing restano all'agente.
