import { describe, expect, it } from 'vitest';
import { GET } from './+server';
import { BRAND_REMIX_PROMPT } from '$lib/gallery/model';

const params = { projectId: 'p1', canvasId: 'c1', nodeId: 'n1' };

async function target(search: string): Promise<URL> {
  try {
    await GET({ params, url: new URL(`http://x/p/p1/c/c1/motion/n1${search}`) } as never);
  } catch (thrown) {
    return new URL((thrown as { location: string }).location, 'http://x');
  }
  throw new Error('no redirect');
}

describe('old motion editor link', () => {
  it('opens the frame on its canvas', async () => {
    const to = await target('');

    expect(to.pathname).toBe('/p/p1/c/c1');
    expect(to.searchParams.get('frame')).toBe('n1');
  });

  it('carries the brand remix into the canvas chat', async () => {
    const to = await target('?brand=1');

    expect(to.searchParams.get('frame')).toBe('n1');
    expect(to.searchParams.get('prompt')).toBe(BRAND_REMIX_PROMPT);
  });
});
