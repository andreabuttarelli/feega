import { describe, expect, it } from 'vitest';
import { createTestSupabase } from '$lib/testkit/supabase';
import { exportAccount } from './export-account';

const ME = 'user-me';

describe('Scarica i miei dati', () => {
  it('porta profilo, org, progetti, messaggi scritti da me e crediti delle org che possiedo', async () => {
    const kit = createTestSupabase({
      profiles: [{ id: ME, email: 'me@x.co' }, { id: 'other', email: 'o@x.co' }],
      orgs_members: [
        { org_id: 'mine', user_id: ME, role: 'owner' },
        { org_id: 'team', user_id: ME, role: 'member' }
      ],
      orgs: [{ id: 'mine', name: 'Mine' }, { id: 'team', name: 'Team' }],
      projects: [{ id: 'p1', org_id: 'mine', name: 'P1' }, { id: 'p9', org_id: 'elsewhere', name: 'X' }],
      chat_messages: [
        { id: 'm1', actor_id: ME, content: 'hi' },
        { id: 'm2', actor_id: 'other', content: 'no' }
      ],
      credit_ledger: [
        { id: 'c1', org_id: 'mine', amount: 10 },
        { id: 'c2', org_id: 'team', amount: 5 }
      ]
    });

    const data = await exportAccount(kit.client, ME);

    expect(data.profile).toMatchObject({ id: ME });
    expect(data.memberships.map((m) => m.org_id)).toEqual(['mine', 'team']);
    expect(data.projects.map((p) => p.id)).toEqual(['p1']);
    expect(data.chatMessages.map((m) => m.id)).toEqual(['m1']);
    expect(data.creditLedger.map((c) => c.id)).toEqual(['c1']);
  });
});
