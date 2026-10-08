# Pubblicazione social dietro il flag `social_publishing`

feega si specializza nella motion. Post, calendario, autopublish e integrazione Zernio (account
social, scheduled posts, publishing) diventano secondari: NASCOSTI, non cancellati. Nessun dato
toccato, nessuna migration distruttiva; le tabelle restano. Fase 2 (rimozione del codice) parte
dall'elenco qui sotto.

- **Il flag**: riga `social_publishing` in `feature_flags` (la stessa tabella di `uncensored_mode`),
  spenta. Migration `20261008130000_social_publishing_flag.sql` (riga + lettura anon, perché cron
  e MCP non hanno sessione), NON applicata dal deploy. Riga assente o lettura fallita = spento.
  Lettore unico `src/lib/server/social-publishing.ts`, cache 30 s per istanza.
- **Il registro**: `SOCIAL_PUBLISHING_SURFACE` in `src/lib/social-publishing.ts` dice in un posto
  solo cosa sparisce: rotte, azioni, voci della rail, nodi aggiungibili, sezioni settings, tab di
  Promote, strumenti WebMCP. Una superficie nuova è una riga lì.
- **Il cancello**: `refuseSocialPublishing` in `src/hooks.server.ts` risponde 404 `not_available`
  su ogni rotta/azione del registro (pagine, API, cron `health/accounts/tick`). Legge il flag solo
  quando la rotta è nel registro.
- **MCP**: `cli/mcp/features.ts` legge `GET /api/v1/features`; con il flag spento
  `list_posts`/`create_post`/`set_post_status` non vengono registrati e spariscono dalle
  istruzioni. `docs/mcp-tools.md`, skill e plugin aggiornati; rimossi dalla skill anche i comandi
  CLI `content/approve/post/calendar`, che non esistevano più.
- **Settings**: la sezione di partenza diventa `project` (era `connected-accounts`) anche con il
  flag acceso — unica differenza rispetto a prima. Il ritorno OAuth (`/settings?connected=…`) segue
  il flag.
- **Scartato**: un flag per utente/org (la decisione è di prodotto, globale); cancellare il codice
  adesso (va fatto in Fase 2, meccanicamente, da questo elenco).
- **E2E**: il foglio Calendar si prova solo con `E2E_SOCIAL_PUBLISHING=1`; lo smoke della shell
  apre Ads.
