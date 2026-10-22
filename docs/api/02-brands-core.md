# API — 02 · Brand core

Endpoint per listare brand, leggere il dettaglio e i media importati.
Errori comuni di auth: vedi [01-overview](01-overview.md).

## `GET /api/v1/brands`

Elenco di tutti i brand accessibili all'utente autenticato (per API key: limitato allo scope `brand_ids` della chiave), con il conteggio dei post in attesa di approvazione.

**Query params**: nessuno

**Response** `200` (array, vuoto `[]` se nessun brand):

```json
[
  {
    "id": "6f2c…",
    "name": "Mio Brand",
    "slug": "mio-brand",
    "plan": "pro",
    "status": "active",
    "autopilot_enabled": true,
    "autopilot_failure_count": 0,
    "last_autopilot_run_at": "2026-08-12T08:30:00Z",
    "timezone": "Europe/Rome",
    "pendingCount": 3
  }
]
```

**Esempio**:

```bash
curl -s "https://feega.app/api/v1/brands" -H "Authorization: Bearer $TOKEN"
```

---
## `GET /api/v1/brands/:slug`

Dettaglio completo del brand: riga `brands` completa unita agli aggregati calcolati da `getBrandDetail` (conteggi, ultimi run autopilot, piano editoriale attivo, kit).

**Response** `200`:

```json
{
  "id": "6f2c…",
  "org_id": "019e…",
  "name": "Mio Brand",
  "slug": "mio-brand",
  "status": "active",
  "plan": "pro",
  "timezone": "Europe/Rome",
  "target_platforms": ["instagram", "tiktok"],
  "launched_at": "2026-05-01T00:00:00Z",
  "content_prefs": { "…": "…" },
  "setup_step": null,
  "setup_completed_at": "2026-05-01T10:00:00Z",
  "autopilot_enabled": true,
  "autopilot_failure_count": 0,
  "last_autopilot_run_at": "2026-08-12T08:30:00Z",
  "zernio_profile_id": "zp_…",
  "ads_settings": { "…": "…" },
  "pendingCount": 3,
  "runs": [
    { "status": "success", "posts_created": 5, "created_at": "2026-08-12T08:30:00Z", "error": null }
  ],
  "plan": {
    "id": "…",
    "status": "active",
    "cadence": "3/week",
    "weeks": [ { "…": "contenuti generati da AI" } ]
  },
  "productCount": 4,
  "accountCount": 2,
  "scheduledCount": 6,
  "publishedCount": 120,
  "hasGtm": true,
  "hasContentPlans": true,
  "hasHistory": true,
  "kit": { "about": "…", "brand_colors": ["#7c5cff", "#ffffff"] },
  "logoUrl": "https://…/logo.png"
}
```

Note: `plan` è `null` senza piano attivo; `kit` è `null` senza riga `brand_kit`; `runs` contiene al massimo gli ultimi 3 run; `content_prefs`, `ads_settings` e `plan.weeks` contengono dati dinamici.

**Esempio**:

```bash
curl -s "https://feega.app/api/v1/brands/mio-brand" -H "Authorization: Bearer $TOKEN"
```

---
## `GET /api/v1/brands/:slug/media`

Elenca la libreria media del brand, dalla più recente, con una URL firmata per l'anteprima.
Gli id restituiti sono quelli che `POST /posts` accetta in `media_ids`.

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
l'id che `POST /posts` accetta in `media_ids`. Nessun modello viene chiamato e nessun credito
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
