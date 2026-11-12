# API — 10 · Billing (link di pagamento per gli agenti)

Tre endpoint che **mintano una URL Stripe e la restituiscono**. Sono i tool MCP
`create_billing_portal_link`, `create_checkout_link` e `create_one_time_checkout_link`, e nascono da una richiesta precisa: un
agente esterno deve poter *avviare* un pagamento e passare il link all'umano.

Il confine di sicurezza è nel codice, non solo nella descrizione: **l'agente non paga e non
cambia mai un piano.** Ottiene una URL; chi la apre e completa l'azione sulla pagina ospitata da
Stripe è la persona. Nessuno dei due endpoint addebita una carta, cambia un abbonamento, applica
un coupon o disdice qualcosa — `applyRetentionCoupon`, `cancelSubscriptionAtPeriodEnd` e
`ensureSubscriptionCanceled` non sono raggiungibili da qui, e un test lo verifica.

## La URL è una credenziale

Una URL del portale (o del checkout) Stripe dà accesso alla fatturazione di quel cliente a
**chiunque la possieda**, senza altra autenticazione. Quindi: non viene mai loggata, non viene
mai salvata, e compare **una sola volta** nella risposta. Chi la riceve la consegna al
proprietario dell'account e non ne tiene copia.

## Fatturazione dell'org, registry di brand

Il registry degli endpoint (`packages/api-contracts`) è scoped sul brand
(`/api/v1/brands/:slug/…`), mentre la fatturazione appartiene all'**organizzazione**. Questi due
endpoint stanno **dentro** il registry e risolvono l'org lato server con `orgBillingForBrand` —
la stessa funzione che legge la pagina `/app/billing`. Lo slug è solo la maniglia che l'agente
ha già in mano: ogni comando CLI/MCP è brand-scoped, e c'è **un solo posto** che decide quale
org fattura un brand.

## Chi è autorizzato

Accedere a un brand **non** è avere autorità sulla fatturazione dell'org. Sul web la guardia è
`isBrandOwner` (RLS); qui la RLS non prova niente, perché il path con API key gira come service
role. Quindi la condizione è scritta a mano: `isOrgOwner(supabase, brand.org_id, user.id)`.

Un collaboratore di un brand condiviso (0077) prende `not_org_owner` (403) — esattamente come il
browser gli risponderebbe "Owner only".

## Niente gate sui crediti

**Nessuno chiama `gateAiAction` e nessuno guarda i crediti.** Sarebbe circolare: chi ha
finito i crediti è precisamente la persona che deve arrivare al checkout. Nessuno dei due chiama
un modello.

Una API key **read-only** viene comunque rifiutata (403): il link porta anche a un bottone di
disdetta.

---

## `POST /api/v1/brands/:slug/billing/portal`

Portale di fatturazione Stripe dell'org: fatture, metodo di pagamento, disdetta. Nessun cambio piano: il piano è uno.

**Body**: nessun campo. Un campo non dichiarato viene rifiutato (`invalid_input`, 400).

**Response** `200`:

```json
{
  "ok": true,
  "url": "https://billing.stripe.com/p/session/live_xyz"
}
```

```bash
curl -sS -X POST https://feega.app/api/v1/brands/demo/billing/portal \
  -H "Authorization: Bearer $FEEGA_TOKEN" \
  -H 'content-type: application/json' -d '{}'
```

## `POST /api/v1/brands/:slug/billing/checkout`

Checkout Session Stripe sull'unico piano: €9 / editor / mese, 500 crediti, 100 crediti = €1. Il
price id non è nel codice: lo trova `subscriptionPriceId()` per `lookup_key` `feega_monthly_9`.

**Body**:

| Campo | Tipo | Note |
|---|---|---|
| `credits` | number, opzionale | Se presente deve essere `500`; ogni altro valore è `unknown_plan` |

**Response** `200`:

```json
{
  "ok": true,
  "url": "https://checkout.stripe.com/c/pay/cs_live_xyz",
  "plans": [{ "credits": 500, "label": "€9 / editor / month" }]
}
```

```bash
curl -sS -X POST https://feega.app/api/v1/brands/demo/billing/checkout \
  -H "Authorization: Bearer $FEEGA_TOKEN" \
  -H 'content-type: application/json' -d '{}'
```

## `POST /api/v1/brands/:slug/billing/checkout/one-time`

Ricarica una tantum, mai un abbonamento. **Body**: `{ "credits": 1000 | 2000 | 5000 }` (€10 /
€20 / €50). I crediti non scadono. Funziona anche senza abbonamento.

## Errori

Ogni fallimento è dichiarato nel contratto e lo status arriva da `statusForFailure`, non da una
catena di `||`. Un guasto di Stripe è **502**: è nostro, non di chi chiama.

| `error` | Status | Endpoint | Significato |
|---|---|---|---|
| `invalid_input` | 400 | entrambi | Il body non passa lo schema (campo sconosciuto incluso) |
| `unknown_plan` | 400 | checkout, one-time | Crediti diversi dal piano o da una ricarica. Il checkout risponde con `plans` |
| `not_org_owner` | 403 | entrambi | Il chiamante raggiunge il brand ma non possiede l'org che paga |
| `API key is read-only` | 403 | entrambi | Chiave senza scope `write` |
| `Brand not found` | 404 | entrambi | Slug inesistente o non del chiamante (`loadBrandForUser`) |
| `no_customer` | 409 | portal | L'org non ha mai pagato: non esiste un cliente Stripe da aprire |
| `already_subscribed` | 409 | checkout | L'org è già abbonata. La risposta porta `app_billing_url` |
| `subscriptions_not_configured` | 409 | checkout | Il Price `feega_monthly_9` non esiste ancora su Stripe |
| `no_org_billing` | 500 | entrambi | Non siamo riusciti a risolvere l'org che fattura il brand — nostro |
| `stripe_unavailable` | 502 | entrambi | Stripe ha risposto male — nostro, non di chi chiama |

`no_customer` e `already_subscribed` non sono errori di sintassi: la risposta porta
`app_billing_url`, la pagina in-app dove la persona gestisce il piano e compra ricariche.

Errori di auth comuni (401, 403 accesso non ancora abilitato): vedi
[01-overview](01-overview.md).
