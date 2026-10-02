# Egress Supabase: una firma stabile per file

**Perché.** Il progetto è stato bloccato (402) per quota di egress superata, con ~5 utenti.
Edge logs delle 24 ore precedenti, per byte:

| Fonte | Richieste | MB |
|---|---|---|
| `GET object/sign/brand-knowledge` (video mp4 fino a 33 MB, range Safari) | 143 | 235 |
| `GET render/image/sign` (miniature trasformate) | 273 | 136 |
| `GET object/sign/canvas-assets` (stesse ~20 immagini, ~46 volte l'una) | 858 | 119 |
| `POST object/sign/canvas-assets` (risposte di firma a lotto) | 1064 | 84 |
| tutto PostgREST insieme | ~45.000 | < 1 |

~575 MB/giorno, ~17 GB/mese. Il database pesa ~100 KB: le letture REST (cron, snapshot) sono
tante ma quasi vuote. L'egress è Storage.

**Causa.** Ogni lettura firmava di nuovo ogni file: nuovo token, nuovo URL, cache del browser e
della CDN mancata (`cf_cache_status` HIT ≈ 0). `/c/<id>/assets/<id>` rispondeva 302 `no-store`,
quindi ogni montaggio di un nodo (pan, snapshot) riscaricava il file: un solo asset è stato
chiesto 1.199 volte in un giorno. Le firme della tela duravano 300 s.

**Cosa cambia.**
- `signThumbnailUrls` ricorda l'URL firmato per (bucket, ttl, preset, path) e lo riusa fino a
  metà della sua vita: stesso file, stesso URL, cache che funziona. In memoria, per istanza.
- Firme della tela a 2 h (`SIGNED_URL_TTL_S.canvas`); i fornitori restano a 300 s.
- Il 302 dell'asset ha `private, max-age=1800` (un quarto del TTL: l'URL tenuto in cache vale
  sempre ancora almeno 30 min).
- `<video>` sulla tela con `preload="metadata"`.
- Calendario ogni 5 min invece di 1 (resta il refresh al focus); il budget di letture a tela
  ferma vive in `src/lib/canvas/idle-reads.ts`, con test.

**Scartato.** Proxy delle immagini via Vercel (sposta l'egress, non lo toglie); firmare i JWT a
mano con scadenza arrotondata (URL stabili fra istanze, ma dipende dal formato interno del token
Storage). Non toccati: realtime `replica identity full` (righe `nodes` < 5 KB) e i cron su
`node_runs` (risposte vuote).
