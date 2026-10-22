# API — 08 · Prodotti e API key

Catalogo prodotti, API key.
Errori comuni di auth: vedi [01-overview](01-overview.md).

## `GET /api/v1/brands/:slug/products`

Elenca tutti i prodotti del catalogo (ordinati per data di creazione).

**Response** `200`:

```json
{
  "products": [
    {
      "id": "uuid",
      "title": "Kit Completo",
      "kind": "product",
      "pricing": "€89",
      "imageCount": 3,
      "featured": true
    }
  ]
}
```

**Esempio**:

```bash
curl -s "https://feega.app/api/v1/brands/mio-brand/products" -H "Authorization: Bearer $TOKEN"
```

---

## `POST /api/v1/brands/:slug/products`

Ri-sincronizza l'intero catalogo dal sito e-commerce del brand (Shopify / WooCommerce): elimina i prodotti esistenti e reinserisce quelli rilevati. Per aggiungere **una** offerta senza cancellare le altre c'è [`POST /studio/products`](04-studio.md).

**Body**: nessuno

**Response** `200`:

```json
{ "ok": true, "platform": "Shopify", "synced": 14 }
```

**Errori specifici**

| Status | Body |
|---|---|
| `400` | `{"error":"No website URL set for this brand."}` |
| `400` | `{"error":"No e-commerce platform detected on the site."}` |
| `400` | `{"error":"No products found on the site."}` |
| `500` | `{"error":"Sync failed: <dettaglio>"}` |

**Esempio**:

```bash
curl -s -X POST "https://feega.app/api/v1/brands/mio-brand/products" \
  -H "Authorization: Bearer $TOKEN"
```

---

## `PUT /api/v1/brands/:slug/products/:id`

Aggiorna i campi di un singolo prodotto. Solo i campi presenti nel body cambiano: le altre colonne restano identiche. Un campo non dichiarato viene **rifiutato**, non ignorato. Tool MCP: `update_product`.

**Body**

| Campo | Tipo | Obbligatorio | Descrizione |
|---|---|---|---|
| `title` | string | No | Nuovo titolo |
| `description` | string | No | Nuova descrizione |
| `pricing` | string | No | Nuovo prezzo (testo libero) |
| `url` | string | No | Dove sta l'offerta |
| `featured` | boolean | No | Evidenziato sì/no |

**Response** `200`:

```json
{ "ok": true }
```

**Errori specifici**

| Status | Body |
|---|---|
| `400` | `{"error":"invalid_input","details":[…]}` — campo sconosciuto o tipo sbagliato |
| `400` | `{"error":"no_fields"}` — nessun campo da cambiare |
| `404` | `{"error":"not_found"}` — l'id non esiste **o** è di un altro brand: la risposta è la stessa |
| `500` | `{"error":"<messaggio Supabase>"}` |

**Esempio**:

```bash
curl -s -X PUT "https://feega.app/api/v1/brands/mio-brand/products/PRODUCT_ID" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"featured":true,"pricing":"€99"}'
```

---

## `DELETE /api/v1/brands/:slug/products/:id`

Elimina un prodotto del brand. Tool MCP: `delete_product`.

**Response** `200`:

```json
{ "ok": true }
```

**Errori specifici**

| Status | Body |
|---|---|
| `404` | `{"error":"not_found"}` — l'id non esiste **o** è di un altro brand |
| `500` | `{"error":"<messaggio Supabase>"}` |

**Esempio**:

```bash
curl -s -X DELETE "https://feega.app/api/v1/brands/mio-brand/products/PRODUCT_ID" \
  -H "Authorization: Bearer $TOKEN"
```

---

## `GET /api/v1/brands/:slug/api-keys`

Elenca le API key dell'utente che hanno accesso a questo brand (mai le chiavi raw).

**Response** `200`:

```json
{
  "keys": [
    {
      "id": "uuid",
      "name": "CI deploy",
      "key_prefix": "feega_live_a1",
      "permissions": { "brand_ids": ["BRAND_ID"], "scopes": ["read", "write"] },
      "created_at": "2026-06-01T10:00:00Z",
      "last_used_at": "2026-08-12T09:00:00Z"
    }
  ]
}
```

**Errori specifici**

| Status | Body |
|---|---|
| `403` | `{"error":"API key does not have access to this brand"}` |
| `500` | `{"error":"<messaggio Supabase>"}` |

**Esempio**:

```bash
curl -s "https://feega.app/api/v1/brands/mio-brand/api-keys" -H "Authorization: Bearer $TOKEN"
```

---

## `POST /api/v1/brands/:slug/api-keys`

Crea una nuova API key. Richiede JWT (le API key non possono crearne altre). La chiave raw viene restituita **una sola volta**.

**Body**

| Campo | Tipo | Obbligatorio | Descrizione |
|---|---|---|---|
| `name` | string | No | Default `"API Key"` |
| `scopes` | string[] | No | Default `["read"]`; valori validi `read`/`write` (invalidi scartati, `read` sempre forzato) |
| `all_brands` | boolean | No | Se `true`, key per tutti i brand (`brand_ids: "*"`); default: solo questo brand |

**Response** `201`:

```json
{
  "key": {
    "id": "uuid",
    "name": "CI deploy",
    "key_prefix": "feega_live_a1",
    "permissions": { "brand_ids": ["BRAND_ID"], "scopes": ["read", "write"] },
    "created_at": "2026-08-13T10:00:00Z",
    "raw": "feega_live_<48 hex>"
  },
  "message": "Copy this key now — you will not be able to see it again."
}
```

**Errori specifici**

| Status | Body |
|---|---|
| `403` | `{"error":"API keys cannot create API keys — sign in with the CLI"}` |
| `500` | `{"error":"<messaggio Supabase>"}` |

**Esempio**:

```bash
curl -s -X POST "https://feega.app/api/v1/brands/mio-brand/api-keys" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"CI deploy","scopes":["read","write"]}'
```

---

## `DELETE /api/v1/brands/:slug/api-keys/:id`

Revoca una API key. La key deve appartenere all'utente autenticato ed essere scopedata su questo brand.

**Response** `200`:

```json
{ "deleted": true }
```

**Errori specifici**

| Status | Body |
|---|---|
| `404` | `{"error":"API key not found"}` |
| `500` | `{"error":"<messaggio Supabase>"}` |

**Esempio**:

```bash
curl -s -X DELETE "https://feega.app/api/v1/brands/mio-brand/api-keys/KEY_ID" \
  -H "Authorization: Bearer $TOKEN"
```
