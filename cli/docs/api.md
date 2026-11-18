# API Reference

Tutti gli endpoint sono sotto `/api/v1/` e richiedono autenticazione Bearer token. Questa pagina
copre le rotte che il CLI chiama — la fallback quando MCP
non è connesso. Un agente MCP non passa da qui: legge e scrive con `query`/`insert_row`/
`update_row`/`delete_row`/`run_node_generation`, org-scoped — vedi
[`skills/feega/references/tools.md`](../skills/feega/references/tools.md).

## Autenticazione

```
Authorization: Bearer <jwt_token>
```

Il token viene ottenuto tramite il flow OAuth della CLI. Viene salvato in `~/.config/feega/session.json` e rinnovato automaticamente.

## Billing (org)

Solo il proprietario dell'org.

### POST /api/v1/org/billing/checkout

Checkout Stripe dell'unico piano: €9 / editor / mese, 500 crediti (100 crediti = €1). `{ "credits": 500 }` opzionale, ogni altro valore è `unknown_plan`. Con un abbonamento attivo risponde `already_subscribed` (409) con `app_billing_url`.

### POST /api/v1/org/billing/checkout/one-time

Ricarica una tantum (`{ "credits": 1000|2000|5000 }` = €10 / €20 / €50), crediti che non scadono.

### POST /api/v1/org/billing/portal

Apre il portale di billing Stripe (fatture, carta, cancellazione).

## Errori

Tutti gli endpoint restituiscono errori in questo formato:

```json
{ "error": "Messaggio di errore" }
```

Codici HTTP:
- `401` — Token mancante o invalido
- `404` — Risorsa non trovata
- `500` — Errore interno del server
