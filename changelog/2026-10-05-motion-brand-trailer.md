# Trailer di brand dal motion agent

**Perché.** «Fai un trailer di allbirds.com» produceva un video con colori feega e testi
inventati: i tool del motion agent non leggevano né un URL né un brand, e non potevano portare
un'immagine esterna nel progetto.

**Cosa.** Tre tool, iniettati come porte opzionali di `MotionToolDeps` e collegati nella route
`api/v1/projects/[projectId]/motion/[nodeId]/agent` via `brandSources`:

- `analyze_site(url)` → `motion/site-brief.ts`. Pagina con `safeFetchUrl` (guardia SSRF per
  ogni hop, 2 MB, 10 s), parsing con `@feega/site-analysis/crawl` (metadata, loghi, social,
  Shopify/WooCommerce). Loghi: svg/html prima, poi favicon, apple-touch-icon, og:image. Palette:
  theme-color, colori del logo (hex dell'SVG o node-vibrant), variabili CSS, CSS. Font mappati sul
  catalogo Google (`google: true` = usabile con `set_font`). Immagini og/hero/prodotto sondate con
  `safeFetchBytes` + sharp (8 MB, 6 s, lato minimo 300 px). Tetto totale 30 s. Nessun LLM.
- `use_brand(name?)` → `motion/brand-brief.ts`: brand del progetto o brand dell'org per nome o
  slug; palette e font da `brands.content` (`paletteFrom`, `fontsFrom`), prodotti con il nuovo
  `listBrandProducts`.
- `import_asset(url)` → `motion/asset-import.ts`: https-only, 12 MB, tipo dai magic byte (PNG,
  JPEG, WebP, GIF, AVIF, SVG) e non dall'header; file in `canvas-assets` sotto
  `${orgId}/${projectId}/imports/`, riga `assets` `source: imported`, URL firmato. L'asset entra
  in `deps.assets`, quindi `add_clip` lo accetta nello stesso turno.

Prompt: ricetta «brand trailer» (leggi, importa logo e 3–6 immagini, palette e font, 15–30 s
hook/prodotto/prova/CTA, Logo3D/Device3D/morph/particelle, beat se c'è audio, `view_frames`).

**Scartato.** `runBrandAnalysis`: chiama un LLM e salva in cache per il wizard; qui servono dati
grezzi e veloci. Il catalogo prodotti di `media-import.ts`: scrive nella libreria brand del
vecchio prodotto, non negli asset di progetto. Nessun tool di generazione immagini nel motion
agent: se manca un'immagine buona l'agente usa quelle che ha.
