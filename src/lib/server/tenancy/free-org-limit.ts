import type { Db } from '$lib/server/db/client';
import { FREE_ORGS_PER_USER } from '$lib/credit-ladder';

/**
 * `credit_ledger` (20260922_org_billing.sql) non è nei tipi generati — `database.types.ts` non è
 * stato rigenerato da quando la migration è stata applicata (verificato dal vivo: la tabella
 * esiste, `npm run db:types` no in questo ambiente). `Db` è tipizzato stretto apposta
 * (client.ts), quindi qui la tabella si raggiunge passando da `unknown` al bordo — non un
 * `select *` libero, una forma dichiarata riga per riga, come `AiCallInsert` fa in ai-log.ts per
 * lo stesso motivo.
 */
type LedgerDb = {
  from(table: 'credit_ledger'): {
    select(cols: string): {
      eq(col: string, val: string): PromiseLike<{ data: { source: string }[] | null; error: { message: string } | null }>;
      in(col: string, vals: string[]): PromiseLike<{
        data: { org_id: string; source: string }[] | null;
        error: { message: string } | null;
      }>;
    };
  };
  from(table: 'orgs_members'): {
    select(cols: string): {
      eq(col: string, val: string): PromiseLike<{ data: { org_id: string }[] | null; error: { message: string } | null }>;
    };
  };
};

const ledgerDb = (db: Db): LedgerDb => db as unknown as LedgerDb;

/**
 * "GRATUITA" = un'org che non ha MAI incassato un pagamento vero — nessuna riga `credit_ledger`
 * con `source` in `subscription_renewal`/`one_time_purchase`. Il benvenuto stesso (`source`
 * `promo`) non basta a far uscire un'org da questo insieme, o nessuna org gratuita resterebbe
 * tale dopo il suo unico grant.
 */
const PAID_SOURCES = ['subscription_renewal', 'one_time_purchase'] as const;

const isPaidSource = (source: unknown): boolean => (PAID_SOURCES as readonly unknown[]).includes(source);

export async function isOrgFree(db: Db, orgId: string): Promise<boolean> {
  const { data, error } = await ledgerDb(db).from('credit_ledger').select('source').eq('org_id', orgId);
  if (error) throw error;
  return !(data ?? []).some((row) => isPaidSource(row.source));
}

/**
 * Quante org gratuite l'utente porta già — come MEMBRO, non solo come owner: un invito accettato
 * in un'org gratuita altrui conta uguale a un'org creata da sé (CLAUDE.md, decisione dell'utente).
 */
export async function freeOrgCount(db: Db, userId: string): Promise<number> {
  const { data: memberships, error } = await ledgerDb(db).from('orgs_members').select('org_id').eq('user_id', userId);
  if (error) throw error;
  const orgIds = (memberships ?? []).map((m) => m.org_id);
  if (!orgIds.length) return 0;

  const { data: paidRows, error: paidError } = await ledgerDb(db)
    .from('credit_ledger')
    .select('org_id, source')
    .in('org_id', orgIds);
  if (paidError) throw paidError;
  const paidOrgIds = new Set((paidRows ?? []).filter((r) => isPaidSource(r.source)).map((r) => r.org_id));

  return orgIds.filter((id) => !paidOrgIds.has(id)).length;
}

export class FreeOrgLimitReachedError extends Error {
  constructor() {
    super(`free_org_limit_reached: at most ${FREE_ORGS_PER_USER} free workspaces per user`);
    this.name = 'FreeOrgLimitReachedError';
  }
}

/**
 * La regola, chiamata da UN posto in ciascuno dei due momenti in cui un'appartenenza nasce
 * (bootstrap.ts: createFirstOrgWith, acceptInviteWith) — mai duplicata. Rifiuta PRIMA di scrivere
 * la riga in orgs_members quando l'org che si sta per raggiungere è gratuita e l'utente ne ha già
 * `FREE_ORGS_PER_USER`; un'org già pagante non è mai bloccata, a prescindere da quante altre
 * gratuite l'utente porti.
 */
export async function assertFreeOrgLimit(db: Db, input: { userId: string; joiningOrgId: string }): Promise<void> {
  if (!(await isOrgFree(db, input.joiningOrgId))) return;
  if ((await freeOrgCount(db, input.userId)) >= FREE_ORGS_PER_USER) {
    throw new FreeOrgLimitReachedError();
  }
}
