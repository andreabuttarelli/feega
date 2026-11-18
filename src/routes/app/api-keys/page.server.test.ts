import { describe, expect, it } from 'vitest';

const { load } = await import('./+page.server');

describe('/app/api-keys', () => {
  it('sends the user to the api keys of the dashboard settings', () => {
    expect(() => load({} as never)).toThrowError(expect.objectContaining({ status: 303, location: '/app/settings/api-keys' }));
  });
});
