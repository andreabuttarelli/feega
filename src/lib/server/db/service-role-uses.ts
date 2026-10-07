/**
 * IL REGISTRO DI CHI SCAVALCA LA RLS.
 *
 * `service_role` ha `bypassrls`: un client costruito con quella chiave legge e scrive ogni org di
 * ogni cliente. La RLS è la difesa, e questo file elenca i punti in cui è spenta — uno per riga,
 * con il motivo accanto, perché un'eccezione dichiarata in cinque posti diversi diverge alla prima
 * modifica e diverge in silenzio.
 *
 * Una voce nuova è una riga qui. Un percorso che non è qui non ottiene il client: `createServiceRoleDb`
 * esige la voce, quindi il default è la chiave anon e la RLS accesa.
 *
 * ⚠️ Nessuna voce vale per una richiesta che porta un `org_id` scelto da chi chiama. Il criterio
 * è uno: la service role serve quando NON c'è un utente a cui chiedere i permessi — un cron, un
 * webhook, la ricerca di una chiave API prima di sapere chi è. Se un utente c'è, il suo JWT basta.
 */
export type ServiceRoleUse = {
  /** Dove vive il codice che lo usa. */
  path: string;
  /** Perché non può esistere un JWT utente su quel percorso. */
  why: string;
  /** Le tabelle che tocca: il perimetro da riguardare quando il registro cresce. */
  tables: readonly string[];
};

export const SERVICE_ROLE_USES: readonly ServiceRoleUse[] = [
  {
    path: 'src/lib/server/canvas/canvas-share.ts — readSharedCanvas + signSharedMedia (rotta pubblica /s/[token])',
    why: "Chi apre un link condiviso non ha sessione: il token È l'autorizzazione. La riga si trova solo per canvases.share_token; l'org_id si LEGGE da quella riga e limita ogni lettura successiva (nodi non cancellati, connessioni, asset di quei nodi, prodotti e post scaricati da quei nodi). Gli influencer non hanno sempre un org_id: si legge quello referenziato dal nodo e passa solo se è del catalogo (org_id null) o della stessa org — mai il volto di un'altra. Un progetto uncensored non si condivide mai: `projects.mode` si legge solo per rifiutarlo. Sola lettura, e fuori esce solo il contenuto dei nodi con i file firmati — mai org, progetto, prompt, parametri o utenti.",
    tables: ['canvases', 'projects', 'nodes', 'nodes_connections', 'assets', 'products', 'social_posts', 'influencers', 'influencer_views']
  },
  {
    path: 'src/lib/server/cli-auth.ts — authenticateApiKey',
    why: "La chiave API va risolta in un utente PRIMA di sapere chi è: non esiste ancora un JWT su cui far girare la RLS. La lettura è su key_hash e non accetta nulla da chi chiama oltre la chiave stessa; dopo la risoluzione il lavoro continua con il client dell'utente.",
    tables: ['api_keys']
  },
  {
    path: 'src/routes/api/v1/canvas/runs/tick/+server.ts — expireStuckRuns + reconcileRenders + reconcileVideoNodeRuns + reconcileAudioNodeRuns + reconcileWiroNodeRuns + drainLoopQueue + drainStudio + pruneOldCanvasEvents + renewAccountSeats + sweepVoices',
    why: "Un cron non ha una sessione: nessun utente ha cliccato. Prende le righe già scadute o in coda (run rimasti in corso, video da riconciliare, biglietti di loop da drenare, eventi canvas_events più vecchi di 356 giorni) attraverso tutte le org per costruzione, e l'org_id lo LEGGE dalla riga che ha preso — non lo riceve mai da fuori. `drainLoopQueue` gira `runGenNode` per un biglietto reclamato, con la stessa identità di servizio con cui il video già deposita il suo asset — `assets`/`ai_calls` sono scritture di quella funzione, non di questa rotta. La potatura di canvas_events è l'unica eccezione dichiarata: pota per età, su ogni org insieme, non per riga scoperta da un org_id letto — vedi retention.ts. `renewAccountSeats` (account-billing.ts) scorre ogni social_accounts attivo attraverso tutte le org per lo stesso motivo — un rinnovo mensile non ha un utente che lo clicca — e scrive solo credit_ledger/social_accounts della riga che sta processando. Un giro Wiro drenato da un loop legge il consenso dell'org e la provenienza dei riferimenti e registra la moderazione della stessa org letta dalla riga. `drainStudio` (studio/studio-drain.ts) reclama le righe `product_batch_items` in coda di ogni org e le gira con `runGenNode` sotto l'org e l'utente letti dalla riga del lotto, mai ricevuti da fuori. `reconcileRenders` (motion/render-run.ts) finalizza i render motion partiti da una richiesta e finiti nelle sandbox: org, progetto, nodo e utente li legge dai params della riga reclamata. `sweepVoices` (voices/custom-voices.ts) legge `custom_voices` di ogni org per cancellare da ElevenLabs i campioni dei cloni e le voci il cui org non esiste più: una voce va tolta dal fornitore anche quando l'org che la possedeva è sparita, e nessun utente resta a cliccare.",
    tables: ['node_runs', 'nodes', 'canvas_events', 'assets', 'ai_calls', 'social_accounts', 'credit_ledger', 'orgs', 'org_uncensored_optins', 'influencers', 'moderation_checks', 'product_batches', 'product_batch_items']
  },
  {
    path: 'le callback dei provider, src/routes/api/v1/webhooks/** (non ancora scritte: fase 3 e 5)',
    why: 'Zernio e i provider di generazione chiamano senza una sessione utente. La riga da aggiornare si trova dal loro id esterno, che è già legato a una org; la firma della richiesta è ciò che autentica, non un JWT. Programmazione e stato di pubblicazione si leggono da Zernio, non da una tabella nostra (scheduled_posts è stata rimossa, 2026-09-22): un eventuale webhook scriverebbe solo posts.zernio_post_ids.',
    tables: ['posts', 'node_runs', 'ai_calls']
  },
  {
    path: 'src/lib/server/tenancy/bootstrap.ts — createFirstOrg',
    why: "Alla creazione non esiste ancora una riga in orgs_members, quindi auth_org_ids() è vuoto e la policy rifiuterebbe l'insert della org e del suo primo membro. È l'unico punto in cui la RLS non può funzionare per costruzione: l'appartenenza sta nascendo. Non accetta un org_id da chi chiama — lo crea, e il membro è sempre l'utente della sessione. Legge/scrive anche credit_ledger (assertFreeOrgLimit, grantWelcomeCredits): il limite di org gratuite e il benvenuto sono decisi qui, non altrove.",
    tables: ['orgs', 'orgs_members', 'credit_ledger']
  },
  {
    path: 'src/lib/server/tenancy/bootstrap.ts — acceptInvite',
    why: "Chi accetta non è ancora membro di quell'org: auth_org_ids() non la contiene, e la policy org_isolation su orgs_invites nasconderebbe l'invito proprio a chi lo sta usando. L'org_id non arriva da fuori, si LEGGE dalla riga trovata per impronta del token; il token in chiaro non è mai salvato e scaduto, inesistente o già speso rispondono tutti allo stesso modo. Legge anche credit_ledger (assertFreeOrgLimit): lo stesso limite di org gratuite di createFirstOrg si applica anche a un invito accettato.",
    tables: ['orgs_invites', 'orgs_members', 'credit_ledger']
  },
  {
    path: 'src/lib/server/org-data/auth.ts — resolveApiKey (MCP e CLI su /api/v1/org/**)',
    why: "Una chiave API `feega_…` va risolta in un utente e un'org PRIMA di sapere chi è: non esiste un JWT su cui far girare auth_org_ids(). Dopo la risoluzione l'org_id NON arriva più da chi chiama: è quello della riga trovata per key_hash, imposto su ogni lettura e scrittura successiva da org-data/query-tool.ts e write-tool.ts — mai un filtro facoltativo.",
    tables: ['api_keys']
  },
  {
    path: 'src/lib/server/canvas/sign-media.ts — signAssetPaths, e ogni rotta che la chiama (assets/[id], p/[projectId]/assets, agent/assets, api/v1/org/media)',
    why: "brand-knowledge tiene una cartella per utente (`<userId>/media/...`), e la sua unica policy di lettura confronta il primo segmento del path con auth.uid(): il client dell'utente firma solo i file che ha generato lui, non quelli generati da un altro membro della stessa org. La visibilità che conta è quella della riga `assets`, già provata da un SELECT con il client dell'utente (RLS su org_id) prima di chiamare questa funzione — la firma è un passo separato, e qui usa la service role solo dopo quella prova, mai su un path scelto da chi chiama.",
    tables: ['assets']
  },
  {
    path: 'scripts/import-anomalia-talents.ts',
    why: "Uno script una tantum, senza sessione utente: scrive il catalogo globale (`influencers.org_id = null`), che la RLS vieta a qualunque JWT per costruzione — le policy di scrittura richiedono `org_id is not null`. Legge anche dal progetto Supabase VECCHIO (`OLD_FEEGA_*`), un database diverso su cui questa distinzione non si applica.",
    tables: ['influencers', 'influencer_views']
  },
  {
    path: 'scripts/seed-reference-images.ts',
    why: "Uno script una tantum, senza sessione utente: semina il catalogo globale delle foto di riferimento (`reference_images.org_id = null`, bucket `reference-images` sotto `catalogue/`), che nessuna policy lascia scrivere a un JWT — il catalogo si legge da ogni org e non lo scrive nessuna.",
    tables: ['reference_images']
  },
  {
    path: 'src/lib/server/account/account-server.ts — deleteAccount',
    why: "Cancellare il proprio account (GDPR art. 17) tocca righe che la RLS non lascia toccare a nessun JWT: auth.users, i riferimenti actor_id in org condivise, lo storage `${userId}/` e quello delle org di cui l'utente era l'unico membro. Lo user_id è sempre quello della sessione, verificata di recente e confermata a mano; nessun org_id arriva da chi chiama. La funzione SQL delete_account rifiuta se un'org resterebbe senza proprietario, cancella solo le org senza altri membri, e scrive in account_deletions un conteggio senza dati personali.",
    tables: ['orgs_members', 'orgs', 'account_deletions', 'profiles', 'chat_threads', 'nodes', 'posts', 'chat_messages']
  },
  {
    path: 'src/lib/server/uncensored-workspace/age-verification.ts — recordAdult',
    why: "Un esito di verifica dell'età lo scrive il provider certificato, non l'utente: `user_age_verifications` non ha policy di scrittura, così nessuno può dichiararsi maggiorenne da solo. Lo user_id è quello della sessione che ha avviato la verifica, mai un valore scelto da chi chiama; si salva solo l'esito 18+, nessun documento.",
    tables: ['user_age_verifications']
  },
  {
    path: 'scripts/backfill-signed-url-nodes.ts',
    why: 'Uno script una tantum, senza sessione utente: attraversa `nodes` di ogni org per trovare le righe con un url firmato scritto per errore in `data` (bug risolto in codice), cosa che nessun JWT di una singola org potrebbe fare.',
    tables: ['nodes']
  },
  {
    path: 'src/lib/server/reports/report-deps.ts — segnalazioni DSA/DMCA (rotte /report, /report/counter/[id], /admin/reports, tick)',
    why: "Chi segnala da un link condiviso non ha sessione, e content_reports/account_strikes non hanno policy per nessun JWT: le legge e le scrive solo questo percorso. L'invio risolve org e autore dal token di condivisione o dall'id del nodo, senza restituire nulla a chi chiama. Le decisioni passano solo dopo isInternalEmail sulla sessione (/admin/reports) o dal cron (restauro dopo una contro-notifica); agiscono sulla riga del report, non su un org_id scelto da fuori. La sospensione usa auth.admin (ban) sull'utente letto dal report. La contro-notifica è autorizzata dall'impronta del token mandato all'autore. Una rimozione sposta i file del nodo (assets della sua org, letti da nodes.data e node_runs) nel bucket privato quarantine sotto <orgId>/<reportId>/, così gli URL già firmati muoiono subito; il ripristino li riporta indietro.",
    tables: ['content_reports', 'account_strikes', 'canvases', 'nodes', 'node_runs', 'assets', 'orgs_members', 'profiles', 'auth.users', 'storage.objects']
  }
] as const;
