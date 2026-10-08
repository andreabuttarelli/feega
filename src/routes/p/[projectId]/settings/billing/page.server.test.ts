import { describe, expect, it } from 'vitest';
import { load } from './+page.server';

describe('/p/[projectId]/settings/billing', () => {
  it('manda alla pagina crediti del workspace, portando con sé l’esito del checkout', async () => {
    const url = new URL('https://feega.test/p/p1/settings/billing?checkout=canceled');

    await expect(Promise.resolve().then(() => (load as (e: unknown) => unknown)({ url }))).rejects.toMatchObject({
      status: 303,
      location: '/app/credits?checkout=canceled'
    });
  });
});
