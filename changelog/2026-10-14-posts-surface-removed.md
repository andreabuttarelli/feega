# Fase 2 di `social_publishing`: via la superficie dei post dalla tela, dall'API e dall'MCP

Post e calendario erano nascosti dal 2026-10-08 (`2026-10-08-social-publishing-flag.md`). La
mappa di parità UI→MCP (#533) li teneva come cinque gap congelati; per la regola app → CLI → MCP
non si espone ciò che sta uscendo, si toglie insieme.

- **Tolto**: le azioni della tela `create_post`, `calendar_posts`, `plan_post`, `schedule_post`
  e il loro filo nella pagina (stato e polling del nodo calendario, drop di nodi su un giorno,
  `askToPlan` dopo un collegamento); `CalendarNode.svelte`, `calendar-posts.ts`,
  `dayUnderPointer`; il bottone "Promote" della barra di selezione (non era dietro il flag e
  apriva un foglio che rispondeva 404) e il suggerimento `create-post` che lo chiamava;
  `/api/v1/org/posts` (+ `deliveries`); i tool MCP `list_posts`/`create_post`/`set_post_status`
  e la lettura del flag lato MCP (`cli/mcp/features.ts`, il preload dei test); `cli/docs/post.md`
  e le righe della quickref su comandi CLI che non esistevano più.
- **Tenuto, di proposito**: il tipo di nodo `calendar` in `node-data` — le righe esistenti
  restano valide e si disegnano come nodo vuoto, come già col flag spento.
- **Resta da togliere (prossimo passo)**: il resto di `SOCIAL_PUBLISHING_SURFACE` — rotte
  `/p/[id]/calendar`, `/promote` (tab organic, `OrganicPostForm`), `/posts`, impostazioni degli
  account connessi, `/api/v1/brands/[slug]/publishing|social`, cron `health/accounts/tick`,
  Zernio (`$lib/server/publishing`), repo `post-planning`, `schedule-planned`,
  `create-post-from-nodes`, la voce `calendar` di `CANVAS_POLLS`, il tipo nodo `calendar`, il
  Promote della barra in alto. Nessuna tabella né migration toccata.
