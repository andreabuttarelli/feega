# API — 02 · Brand core

Endpoint per listare brand, leggere il dettaglio e i media importati.
Errori comuni di auth: vedi [01-overview](01-overview.md).

## `GET /api/v1/brands`

Elenco di tutti i brand accessibili all'utente autenticato (per API key: limitato allo scope `brand_ids` della chiave).

**Query params**: nessuno

**Response** `200` (array, vuoto `[]` se nessun brand):

```json
[
  {
    "id": "6f2c…",
    "name": "Mio Brand",
    "slug": "mio-brand"
  }
]
```

**Esempio**:

```bash
curl -s "https://feega.app/api/v1/brands" -H "Authorization: Bearer $TOKEN"
```

---
## `GET /api/v1/brands/:slug`

Dettaglio del brand: la riga `brands` e gli aggregati calcolati da `getBrandDetail` (prodotti, logo).

**Response** `200`:

```json
{
  "brand": {
    "id": "6f2c…",
    "org_id": "019e…",
    "name": "Mio Brand",
    "slug": "mio-brand",
    "status": "active"
  },
  "productCount": 4,
  "logoUrl": "https://…/logo.png"
}
```

Note: `logoUrl` è `null` senza logo.

**Esempio**:

```bash
curl -s "https://feega.app/api/v1/brands/mio-brand" -H "Authorization: Bearer $TOKEN"
```

---
## `GET /api/v1/brands/:slug/media`

Elenca la libreria media del brand, dalla più recente, con una URL firmata per l'anteprima.
Ogni elemento porta l'id dell'asset che un nodo della tela può mostrare.

**Query params**

| Param | Tipo | Obbligatorio | Descrizione |
|---|---|---|---|
| `query` | string | No | Filtro libero su titolo, descrizione e tag |
| `limit` | number | No | 1–200, default 100 |

**Response** `200`:

```json
{
  "media": [
    {
      "id": "a1b2c3d4-…",
      "kind": "image",
      "mime": "image/png",
      "width": 1080,
      "height": 1350,
      "title": "Foto prodotto",
      "description": "…",
      "tags": ["prodotto"],
      "url": "https://feega.app/a/K7BX2MQ4",
      "created_at": "2026-08-13T10:00:00.000Z"
    }
  ]
}
```

**Esempio**:

```bash
curl -s "https://feega.app/api/v1/brands/mio-brand/media?query=logo&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

---

## `POST /api/v1/brands/:slug/media`

Copia un'immagine o un video pubblicati altrove dentro la libreria del brand, e restituisce
l'id dell'asset. Nessun modello viene chiamato e nessun credito
viene speso: il file viene copiato, non generato.

**Body**

| Campo | Tipo | Obbligatorio | Descrizione |
|---|---|---|---|
| `url` | string | Sì | URL pubblico **https** dell'immagine o del video |
| `title` | string | No | Il nome con cui l'asset compare in libreria |

**Cosa viene rifiutato** — la richiesta si ferma prima che un solo byte raggiunga lo Storage:

| Errore | Status | Quando |
|---|---|---|
| `not_https` | `400` | L'URL non è https |
| `blocked_host` | `400` | Host privato/loopback/link-local, un nome che risolve su uno di quelli, un redirect che ci finisce dentro, un redirect che scende a http, o un host che non risolve |
| `fetch_failed` | `400` | Timeout, connessione fallita, troppi redirect, risposta non 2xx |
| `unsupported_type` | `415` | Content-type fuori da `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `video/mp4`, `video/quicktime`, `video/webm` |
| `too_large` | `413` | Immagine oltre 12MB o video oltre 64MB — sia dichiarati nel `content-length` sia misurati mentre il corpo arriva |
| `empty` | `400` | Corpo vuoto |
| `store_failed` | `502` | Lo Storage o la riga di libreria non si sono scritti |

**Response** `200`:

```json
{
  "ok": true,
  "id": "a1b2c3d4-…",
  "kind": "image",
  "mime": "image/png",
  "bytes": 481920,
  "width": 1080,
  "height": 1350,
  "source_url": "https://cdn.example.com/render/final.png",
  "url": "https://feega.app/a/K7BX2MQ4"
}
```

`source_url` è l'ultimo URL della catena di redirect: è quello da cui il file è arrivato davvero,
ed è il valore conservato come provenienza sulla riga di libreria.

**Esempio**:

```bash
curl -s -X POST "https://feega.app/api/v1/brands/mio-brand/media" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://cdn.example.com/render/final.png","title":"Chiusura campagna"}'
```
