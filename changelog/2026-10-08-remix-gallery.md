# Galleria pubblica e remix gratuito

Prima i video motion e le composizioni restavano dentro l'org che li faceva: l'unico modo di
riusarli era un template della propria libreria (`motion_templates`) o un link di condivisione
della tela. Ora c'è una galleria pubblica (`/gallery`, senza login) e chiunque ne fa un remix gratis.

- **Modello**: `gallery_items` (snapshot del doc, copia pubblica dei file, autore, tag, formato,
  durata, `remixed_from`, `remix_count`, stato `published`/`unlisted`/`removed`) e
  `gallery_remixes` (remix → item, un nodo una riga). Migration
  `20261008120000_gallery_items.sql`, NON applicata dal deploy: va lanciata a mano. RLS: lettura
  anonima di `published`/`unlisted`, scrittura solo dell'org che possiede la riga, e per colonna
  (`remix_count`, `org_id`, `user_id` non si aggiornano). Il contatore lo tiene un trigger
  `security definer`. Nessuna delete: il ritiro è `status = 'removed'`, la catena resta.
- **File**: pubblicare copia ogni asset del doc in `media/gallery/<itemId>/` e riscrive gli id;
  il remix ricopia in `canvas-assets` sotto `remix/`. Così il remix non dipende dai permessi
  dell'autore e il ritiro (che cancella la cartella pubblica) non rompe le copie. ADR 0006.
- **Esclusioni**, una tabella sola in `src/lib/gallery/refusals.ts`: progetto uncensored,
  `script.brand = real`, `Logo`/`Logo3D` vuoto (= logo del brand del progetto), asset `imported`
  fuori da `remix/` (= logo o foto presi da un sito con analyze_site/use_brand/import_asset).
  Moderazione: testo (titolo, descrizione, tag, testi del doc) con `screenModelInput` profilo
  standard; media (immagini, video, poster, preview) con un giudice visivo nuovo
  (`gallery-media.ts`), che rifiuta quando non sa rispondere.
- **Remix**: nuovo nodo motion (o composizione, che si apre nel compose editor) con i campi
  principali esposti come in un template (`exposeMainFields`: fino a 4 testi, 1 logo, 2 foto,
  1 lista media, 2 colori) — si cambiano in Properties senza selezionare nulla (`DocFields`, che
  riusa il form dei template spostato in `FieldForm`). Banner "Remix of …" nell'editor con
  "apply my brand", che apre la chat dell'agente con il prompt già scritto.
- **Superfici**: azioni `publishGallery`/`withdrawGallery` nell'editor motion e nel compose
  editor; API `/api/v1/gallery` (search, item, remix, publish, withdraw); tool chat
  `search_gallery`, `remix_gallery_item`, `publish_to_gallery` con parità MCP (test); CLI
  `feega gallery`, `gallery remix`, `gallery publish`, `gallery withdraw`.
- **Seed Feega**: `scripts/seed-gallery.ts` crea utente e org "Feega" con la service role
  (dichiarata) e pubblica i demo di `~/Documents/feega-videos` più i template builtin launch,
  composizioni e UI morph, riempiti con fotogrammi dei demo. Idempotente: id derivati dalla
  chiave. Esclusi supasito, dub, allbirds.
- **Login che torna all'item**: `takeOAuthReturn` accetta anche `/gallery/…`, così "Sign in to
  remix" riporta sulla pagina dell'item.

Scartato: link pubblici ai file privati firmati a lunga scadenza (dipendenza dai permessi
dell'autore e URL che scadono); una colonna `remixed_from` sui nodi (la tabella `gallery_remixes`
tiene la RLS e il trigger del contatore in un posto solo).
