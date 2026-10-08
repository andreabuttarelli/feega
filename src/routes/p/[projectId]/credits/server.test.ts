import { describe, expect, it } from 'vitest';
import { GET } from './+server';

const signedIn = { safeGetSession: async () => ({ session: { user: { id: 'u1' } } }) };

function brandlessProjectDb() {
  const q = {
    select: () => q,
    eq: () => q,
    is: () => q,
    maybeSingle: async () => ({ data: { brand_id: null, org_id: 'org-1' } })
  };
  return { from: () => q };
}

describe('/p/[projectId]/credits', () => {
  it('manda alla pagina crediti del workspace anche se il progetto non ha un brand', async () => {
    const event = { params: { projectId: 'p1' }, locals: { ...signedIn, supabase: brandlessProjectDb() } };

    await expect(Promise.resolve().then(() => (GET as (e: unknown) => Promise<Response>)(event as never))).rejects.toMatchObject({
      status: 303,
      location: '/app/credits'
    });
  });
});
