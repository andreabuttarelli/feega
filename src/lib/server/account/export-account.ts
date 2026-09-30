import type { SupabaseClient } from '@supabase/supabase-js';

type Row = Record<string, unknown>;

export type AccountExport = {
  exportedAt: string;
  profile: Row | null;
  memberships: Row[];
  orgs: Row[];
  projects: Row[];
  chatMessages: Row[];
  creditLedger: Row[];
};

const OWNER = 'owner';

async function rows(query: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Row[]> {
  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return (data as Row[] | null) ?? [];
}

export async function exportAccount(db: SupabaseClient, userId: string): Promise<AccountExport> {
  const [profile] = await rows(db.from('profiles').select('*').eq('id', userId));
  const memberships = await rows(db.from('orgs_members').select('org_id, role, created_at').eq('user_id', userId));
  const orgIds = memberships.map((m) => String(m.org_id));
  const ownedOrgIds = memberships.filter((m) => m.role === OWNER).map((m) => String(m.org_id));

  return {
    exportedAt: new Date().toISOString(),
    profile: profile ?? null,
    memberships,
    orgs: await rows(db.from('orgs').select('id, name, slug, created_at').in('id', orgIds)),
    projects: await rows(db.from('projects').select('id, org_id, name, slug, created_at').in('org_id', orgIds)),
    chatMessages: await rows(db.from('chat_messages').select('*').eq('actor_id', userId)),
    creditLedger: await rows(db.from('credit_ledger').select('*').in('org_id', ownedOrgIds))
  };
}
