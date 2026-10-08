import { describe, expect, it, vi } from 'vitest';

let flag = 'off';
vi.mock('$lib/server/social-publishing', () => ({ socialPublishing: async () => flag }));

const { GET } = await import('./+server');

describe('GET /api/v1/features', () => {
  it('dice ai client che la pubblicazione social è spenta', async () => {
    flag = 'off';
    expect(await (await GET()).json()).toEqual({ social_publishing: false });
  });

  it('e accesa quando il flag lo è', async () => {
    flag = 'on';
    expect(await (await GET()).json()).toEqual({ social_publishing: true });
  });
});
