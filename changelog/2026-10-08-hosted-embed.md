# Embed interattivo ospitato

Prima l'export web interattivo scaricava un HTML autosufficiente e dava un iframe verso quel file
locale: l'utente doveva ospitarlo. Ora "Publish embed" lo ospita feega.

- **Disegno**: iframe verso `/e/<nodeId>` + lo script host già esistente (scroll e visibilità via
  `postMessage`). Scartato un web component `<feega-motion>`: un secondo runtime da mantenere per
  lo stesso risultato. L'iframe riempie la larghezza (`aspect-ratio` del doc), tiene pointer, tilt
  (`allow="accelerometer; gyroscope"`) e scroll; i link si aprono in una nuova scheda (#242).
- **Storage**: bucket pubblico `embeds`, un file per nodo `<nodeId>.html`, upsert. Ripubblicare
  riscrive lo stesso file: il sito dell'utente si aggiorna senza ricopiare lo snippet (cache 60 s).
  Storage serve l'HTML come `text/plain`, quindi `/e/[id]` lo rilegge e lo serve `text/html`.
  Nessuna tabella e nessuna service role: l'id È il nodo.
- **RLS**: scrittura/cancellazione solo se il nodo esiste, non è cancellato ed è di un'org in
  `auth_org_ids()` (`embed_node_writable`). Migration `20261008160000_embeds_bucket.sql`, NON
  applicata.
- **Upload**: l'editor non manda il bundle al server (limite body di Vercel, i bundle con asset
  inline superano i MB): chiede uno slot firmato (`POST …/motion/<id>/embed`) e fa PUT diretto.
- **Agente**: tool `publish_embed` (`publish`/`unpublish`) costruisce il bundle lato server dal
  doc della sessione e restituisce lo snippet. Senza analisi audio: le clip audio-reattive
  dell'agente possono differire da quelle pubblicate dall'editor.
- **Non fatto**: rifiuto dei progetti uncensored (la galleria li rifiuta, qui no).
