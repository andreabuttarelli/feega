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
    path: 'src/lib/server/telemetry/usage-db.ts — dbSink (rotta POST /api/v1/telemetry)',
    why: "L'estensione e `npx feega` mandano l'uso prima e senza alcun login: non esiste un utente né un JWT, e la tabella non concede nulla ad anon/authenticated. Solo insert di righe validate da zod (evento, id anonimi dell'installazione e della sessione, versione, editor, OS, dispositivo, contatori, paese/regione/città dagli header Vercel), mai IP, utente, percorsi o contenuto; non legge nulla.",
    tables: ['usage_events']
  },
  {
    path: 'src/lib/server/cloud-emails/send-once.ts — dbStore (sendOnce)',
    why: "An email goes out from a webhook, a cron or another user's action (an invite, a share, a failed payment), so the recipient has no session, and user_emails grants nothing to anon/authenticated: only the server writes it. user_id is the recipient the caller resolved, never a value chosen by a request. It inserts one (user_id, kind, ref_id) row to claim the send, deletes that same row if the send fails, and reads nothing.",
    tables: ['user_emails']
  },
  {
    path: 'src/lib/server/product-events/track.ts — track',
    why: "Il funnel nasce prima del login (un visitatore anonimo che arriva dalla landing) e la tabella non concede nulla ad anon/authenticated: solo il server scrive. Inserisce una riga con evento, id e props senza testo dei prompt; non legge nulla.",
    tables: ['product_events']
  },
  {
    path: 'src/lib/server/core-usage.ts — profileIsInternal',
    why: "Un evento di prodotto nasce anche fuori da una richiesta con sessione (un render che finisce, una chiave API): per escludere il team come fa il browser serve l'email dell'utente che ha agito. Legge solo profiles.email per quell'id, e fuori esce solo il booleano interno/no, mai l'email.",
    tables: ['profiles']
  },
  {
    path: 'src/lib/server/library/storage-store.ts — storageStore (route /api/v1/library/pro/[id])',
    why: "The Pro template source lives in the private bucket `library-pro`, which grants nothing to anon/authenticated: only the server reads it, and only after the route resolved the caller's org and the org's Cloud subscription was confirmed. The path read is <id>/latest.json or <id>/<version>/<framework>/<file>, where id is validated against a slug pattern and framework against a fixed list, never a free path from the caller. Read-only; it writes nothing and touches no table.",
    tables: ['storage.objects']
  },
  {
    path: 'src/lib/server/cli-auth.ts — authenticateApiKey',
    why: "La chiave API va risolta in un utente PRIMA di sapere chi è: non esiste ancora un JWT su cui far girare la RLS. La lettura è su key_hash e non accetta nulla da chi chiama oltre la chiave stessa; dopo la risoluzione il lavoro continua con il client dell'utente.",
    tables: ['api_keys']
  },
  {
    path: 'src/lib/server/tenancy/bootstrap.ts — createFirstOrg (also every org made with "New organisation", team/orgs.ts createOrg)',
    why: "Alla creazione non esiste ancora una riga in orgs_members, quindi auth_org_ids() è vuoto e la policy rifiuterebbe l'insert della org e del suo primo membro. È l'unico punto in cui la RLS non può funzionare per costruzione: l'appartenenza sta nascendo. Non accetta un org_id da chi chiama — lo crea, e il membro è sempre l'utente della sessione. Legge/scrive anche credit_ledger (assertFreeOrgLimit): il limite di org gratuite è deciso qui, non altrove.",
    tables: ['orgs', 'orgs_members', 'credit_ledger']
  },
  {
    path: 'src/lib/server/tenancy/rename-org.ts — renameOrg',
    why: "The database refuses UPDATE on orgs to authenticated (20261114_orgs_read_only.sql), so a session cannot rename its own org. The onboarding action calls it only after listMemberships, with the user's own client (RLS), confirmed the caller is an owner of that org and its name is still the auto-created one; the org_id comes from that membership, never from the form. Writes only orgs.name and updated_at.",
    tables: ['orgs']
  },
  {
    path: 'src/routes/api/v1/orgs/[orgId]/team/+server.ts — TeamCtx.writer (setRole, invite, resend, invite link)',
    why: "A role change or an editor invite can add a paid seat, so no session may write orgs_members.role or orgs_invites: the database refuses both to authenticated (20261114_tenancy_writes_server_only.sql). The org_id comes from the URL, but runTeamOp reaches a write only after memberRole read the caller's role in that org with the caller's own client (RLS) and can() allowed the op, and after the seat check: the service role writes the one row that check approved, never a row chosen without it. Removing a member, leaving and revoking an invite stay on the caller's session.",
    tables: ['orgs_members', 'orgs_invites']
  },
  {
    path: 'src/lib/server/tenancy/bootstrap.ts — acceptInvite',
    why: "Chi accetta non è ancora membro di quell'org: auth_org_ids() non la contiene, e la policy org_isolation su orgs_invites nasconderebbe l'invito proprio a chi lo sta usando. L'org_id non arriva da fuori, si LEGGE dalla riga trovata per impronta del token; il token in chiaro non è mai salvato e scaduto, inesistente o già speso rispondono tutti allo stesso modo. Legge anche credit_ledger (assertFreeOrgLimit): lo stesso limite di org gratuite di createFirstOrg si applica anche a un invito accettato. Accepting an editor reads orgs (the seat state) and, when a seat is charged, the owner's email in profiles to tell them.",
    tables: ['orgs_invites', 'orgs_members', 'credit_ledger', 'orgs', 'profiles']
  },
  {
    path: 'src/routes/api/v1/billing/seats/reconcile — the hourly seat reconcile cron',
    why: "A cron has no user. It lists the orgs that have a subscription, oldest checked first, and sets each Stripe item quantity to that org's count of editors. It reads orgs.stripe_subscription_id and orgs_members.role, writes orgs.seats_checked_at (its cursor) and, through recordPaidSeats, orgs.seats_paid/seats_paid_until.",
    tables: ['orgs', 'orgs_members']
  },
  {
    path: 'src/lib/server/team/seat-billing.ts — recordPaidSeats',
    why: "orgs.seats_paid decides whether re-adding an editor this period is free, and orgs.seats_sync_until serialises seat changes per team, so no session may write either: a member who could set them would get free seats or block billing. syncSeats calls only the service-role RPCs claim_seat_sync, record_paid_seats (raises seats_paid within a period, in SQL) and release_seat_sync.",
    tables: ['orgs']
  },
  {
    path: 'src/lib/server/account/account-server.ts — deleteAccount',
    why: "Cancellare il proprio account (GDPR art. 17) tocca righe che la RLS non lascia toccare a nessun JWT: auth.users, i riferimenti actor_id in org condivise, lo storage `${userId}/` e quello delle org di cui l'utente era l'unico membro. Lo user_id è sempre quello della sessione, verificata di recente e confermata a mano; nessun org_id arriva da chi chiama. La funzione SQL delete_account rifiuta se un'org resterebbe senza proprietario, cancella solo le org senza altri membri, e scrive in account_deletions un conteggio senza dati personali.",
    tables: ['orgs_members', 'orgs', 'account_deletions', 'profiles', 'chat_threads', 'nodes', 'chat_messages']
  }
] as const;
