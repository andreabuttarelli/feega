# API Reference

Tutti gli endpoint sono sotto `/api/v1/` e richiedono autenticazione Bearer token. Questa pagina
copre le rotte brand-scoped (`/api/v1/brands/:slug/*`) che il CLI chiama — la fallback quando MCP
non è connesso. Un agente MCP non passa da qui: legge e scrive con `query`/`insert_row`/
`update_row`/`delete_row`/`run_node_generation`, org-scoped, non brand-scoped — vedi
[`skills/feega/references/tools.md`](../skills/feega/references/tools.md).

## Autenticazione

```
Authorization: Bearer <jwt_token>
```

Il token viene ottenuto tramite il flow OAuth della CLI. Viene salvato in `~/.config/feega/session.json` e rinnovato automaticamente.

## Brand

### GET /api/v1/brands

Lista tutti i brand dell'utente.

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "My Brand",
    "slug": "my-brand",
    "pendingCount": 3
  }
]
```

### GET /api/v1/brands/:slug

Dettaglio completo di un brand.

**Response:**
```json
{
  "brand": { ... },
  "pendingCount": 3,
  "productCount": 12,
  "accountCount": 3,
  "logoUrl": "https://..."
}
```

## Prodotti

### GET /api/v1/brands/:slug/products

Lista prodotti del catalogo.

### POST /api/v1/brands/:slug/products

Re-importa il catalogo dallo store collegato (Shopify/Woo).

**Response:**
```json
{ "ok": true, "platform": "shopify", "synced": 24, "rejected": [] }
```

## Billing

### POST /api/v1/brands/:slug/billing/checkout

Checkout Stripe per un piano mensile (`{ "credits": 8|16|32|64|128|256 }`, 1 credito = €1). Con un abbonamento attivo apre il portale per cambiare piano.

### POST /api/v1/brands/:slug/billing/checkout/one-time

Ricarica una tantum (`{ "credits": 8|16|32|64|128|256 }`), crediti che non scadono.

### POST /api/v1/brands/:slug/billing/portal

Apre il portale di billing Stripe (fatture, carta, cambio piano, cancellazione).

## Errori

Tutti gli endpoint restituiscono errori in questo formato:

```json
{ "error": "Messaggio di errore" }
```

Codici HTTP:
- `401` — Token mancante o invalido
- `404` — Brand o risorsa non trovata
- `500` — Errore interno del server
