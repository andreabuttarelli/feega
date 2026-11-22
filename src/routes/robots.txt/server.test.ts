import { describe, expect, it } from 'vitest';
import { GET } from './+server';

describe('robots.txt', () => {
  it('keeps crawlers out of the account app', async () => {
    const body = await (await GET({} as never)).text();

    expect(body).toContain('Disallow: /');
  });
});
