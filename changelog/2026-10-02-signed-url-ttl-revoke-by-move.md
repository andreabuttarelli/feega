# Firme della tela a 24 h, rimozione per spostamento

**Perché.** Dopo `storage-egress` le firme della tela duravano 2 h e venivano riusate per 1 h:
ogni ora un nuovo URL, una nuova cache mancata. A 24 h lo stesso file tiene lo stesso URL per
12 h. Il prezzo: un URL firmato non si revoca, e vivendo un giorno chi l'ha ricevuto lo usa per
un giorno. Da qui la seconda metà.

**Durate** (`SIGNED_URL_TTL_S` in `asset-storage.ts`, una tabella):
- `canvas` 86.400 s: upload (`canvas-assets`) e generati della tela (`brand-knowledge`, via
  `signAssetPaths`). Riuso a metà vita (12 h), invariato.
- Il 302 di `/p/.../assets/<id>`: `private, max-age=21600` (un quarto del TTL). Il test lega
  riuso + max-age < TTL: un redirect in cache punta sempre a un URL ancora vivo.
- Fornitori AI e anteprime per agenti restano a 300 s.
- Non toccati: `signKnowledgePaths` fuori dalla tela (default 2 h), `influencers` (300 s),
  `/a/<code>`: non li governa la tabella.

**Rimozione = spostamento.** `decideReport` con esito di rimozione sposta gli oggetti dei file
del nodo nel bucket privato `quarantine` (`<orgId>/<reportId>/<path originale>`, nessuna policy:
solo service role) e aggiorna `assets.url`. Gli URL già firmati puntano a un oggetto che non c'è
più: 404 subito, non fra 24 h. La cache di firma per quel path viene svuotata
(`forgetSignedUrls`). Le prove restano in quarantena. Il ripristino (contro-notifica o admin)
li riporta al bucket d'origine, scelto da `assets.source` come in lettura.

Vale anche per gli asset uncensored: stessa strada, nessun caso a parte.

**Scartato.**
- Spostare i file alla revoca di una condivisione: la revoca toglie l'accesso alla pagina;
  gli URL già distribuiti scadono col TTL (≤ 24 h). Ruotare costerebbe una copia per file per
  revoca.
- Colonna `quarantined_from` su `assets`: il bucket d'origine si ricava da `source`, il path dal
  prefisso. Niente migration di schema.

**Cancellazione account.** Già rimuove `canvas-assets`, `influencers` per org e
`brand-knowledge`, `media` per utente. Le prove in `quarantine` restano (obbligo di
conservazione DSA/DMCA).
