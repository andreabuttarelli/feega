import { describe, expect, it } from 'vitest';
import { load } from './+page.server';

type LoadEvent = Parameters<typeof load>[0];

function eventFor(search: string): LoadEvent {
  return { params: { projectId: 'p1' }, url: new URL(`http://x/p/p1/settings${search}`) } as unknown as LoadEvent;
}

describe('/settings', () => {
  it('senza parametri è l\'indice delle sezioni: su mobile è la lista da cui si entra nel dettaglio', async () => {
    await expect(load(eventFor(''))).resolves.toEqual({});
  });

  it('il ritorno da un OAuth (?connected) va ancora agli account collegati, parametri inclusi', async () => {
    await expect(load(eventFor('?connected=instagram'))).rejects.toMatchObject({
      status: 303,
      location: '/p/p1/settings/connected-accounts?connected=instagram'
    });
  });
});
