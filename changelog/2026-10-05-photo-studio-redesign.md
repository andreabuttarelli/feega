# Photo studio: tre passi per chi ha un negozio, non un catalogo

**Perché.** Il Photo studio chiedeva prima un nodo Products con lo store importato: chi ha solo
una foto del prodotto non poteva nemmeno cominciare. Poi quattro sezioni di parametri (prodotti,
modelli, ambienti, inquadrature, varianti, modello AI, nome) su una pagina, "Estimate" separato
da "Preview", saldo in crediti interi accanto al saldo in dollari della barra. Il risultato era una
griglia di stati grezzi (`queued`, `source_not_found`) e bottoni Approve/Reject/Regenerate.

**Cosa.** `/app/studio` è un percorso a tre passi, un'azione principale per schermata:

1. **Foto.** Trascina, incolla (⌘V) o scatta dal telefono (`capture=environment`, visibile solo
   su `pointer: coarse`). `photoQuality` (tabella `QUALITY_RULES` in `src/lib/studio/photo-quality.ts`)
   blocca file non immagine, oltre 4 MB o sotto 500 px, avvisa sotto 1000 px e su proporzioni
   estreme; ogni regola dice il problema e cosa fare. Il file va dritto in `canvas-assets` dal
   browser; l'azione `upload` → `addPhotoProduct` (`studio-upload.ts`) → `registerUploadedAsset`
   → un nodo `list` immagini sulla tela "Photo studio" del progetto (`studio_uploads: true`).
2. **Stile.** Card con anteprima reale (`static/studio/styles/*.webp`, otto render veri fatti
   con questo flusso su Seedream 5 Lite), multi-scelta. Inquadrature, modelli sintetici,
   riferimenti di stile e nome stanno in "More options".
3. **Genera.** Versioni 1–4, qualità (Draft = modello più economico, Best = `FIDELITY_MODEL`,
   mostrata solo se diversi), costo totale e per foto dall'azione `quote` prima del clic. Crediti
   insufficienti: pannello con quanto serve, quanto c'è e "Add credits" (402 dal server con
   `shortfall`). L'azione `generate` → `startBatch` accoda subito tutte le varianti sul modello
   scelto.

`/app/studio/[batchId]`: barra di avanzamento sui conteggi reali, tap su una foto = scelta,
confronto a schermo intero con la foto originale (frecce, Esc), errori spiegati da
`FAILURE_TEXT` (tabella accanto a `failureKind`), barra fissa con download per Amazon
(2000², bianco), Shopify (2048²), Instagram (1080×1350) o originale — `zip?format=` converte con
sharp (`toMarketplace`, tabella `MARKETPLACES`) — e "Add to calendar": `sendToCalendar` crea un
post in bozza del brand scelto, con le celle come `post_sources`.

**Difetto trovato.** Un'immagine caricata (percorso `org/progetto/...` in `canvas-assets`) come
primo riferimento di un nodo immagine finiva in `baseMediaId`, che sa leggere solo
`brand-knowledge/<userId>/...`: `source_not_found`. `imageInputs` ora la firma come riferimento
quando il percorso è dell'org. Test in `generate.test.ts`.

**Scartato.**
- Prodotti caricati come righe `products` con `platform = 'upload'`: il CHECK
  `products_platform_check` in produzione accetta solo shopify/woocommerce, e il nodo `products`
  vuole `data.type` fra quei due. Una migration non applicata dal deploy avrebbe rotto
  l'upload in silenzio. Il nodo `list` esiste già, risolve gli asset a run time e si itera come
  `products` (`iterateSelection`).
- Anteprima obbligatoria sul modello economico prima del batch: due passaggi e due addebiti per
  chi vuole tre foto. Resta "Make the full set" per i batch di anteprima già esistenti.
  `startPreview`, l'azione `preview` e `previewItems` sono rimossi.

**Verifica.** Test delle azioni reali (`page.server.test.ts` delle due route, `zip/server.test.ts`),
e2e `tests/e2e/photo-studio.spec.ts` con provider immagini finto (`E2E_FAKE_IMAGES=1`,
`fixtures/mock-images.ts` su `LLM_BASE_URL`). Generazione vera: 8 foto Seedream 5 Lite,
56 crediti addebitati, 0,28 $ di costo provider.
