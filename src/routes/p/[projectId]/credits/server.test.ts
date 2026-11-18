import { describe, expect, it } from 'vitest';
import { GET } from './+server';

const signedIn = { safeGetSession: async () => ({ session: { user: { id: 'u1' } } }) };

function projectDb() {
  const q = {
    select: () => q,
    eq: () => q,
    is: () => q,
    maybeSingle: async () => ({ data: { org_id: 'org-1' } })
  };
  return { from: () => q };
}

describe('/p/[projectId]/credits', () => {
  it('manda alla pagina crediti del workspace dal progetto', async () => {
    const event = { params: { projectId: 'p1' }, locals: { ...signedIn, supabase: projectDb() } };

    await expect(Promise.resolve().then(() => (GET as (e: unknown) => Promise<Response>)(event as never))).rejects.toMatchObject({
      status: 303,
      location: '/app/credits'
    });
  });
});
