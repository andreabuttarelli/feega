import { describe, expect, it, vi } from 'vitest';

const reread = vi.hoisted(() => ({ done: () => {} }));
const nav = vi.hoisted(() => ({ path: '/p/p1/c/a', cancelled: 1, asked: [] as string[] }));

vi.mock('$app/navigation', () => ({
  invalidate: () => new Promise<void>((resolve) => (reread.done = resolve)),
  goto: async (href: string) => {
    nav.asked.push(href);
    if (nav.cancelled-- > 0) {
      return;
    }
    nav.path = href;
  }
}));
vi.mock('$app/state', () => ({ page: { get url() { return new URL(`https://feega.test${nav.path}`); } } }));
vi.mock('./canvas-api', () => ({ postCanvasAction: async () => ({ type: 'redirect', status: 303, location: '/p/p1/c/n1' }) }));

const { canvasPages } = await import('./canvas-pages.svelte');
const { PageAction } = await import('./page-ops');
const { OpOutcome } = await import('./optimistic-ops');

describe('canvas pages: a landed page op', () => {
  it('answers only once the list is re-read, so opening the new page is not cancelled by that re-read', async () => {
    let answered = false;
    const ran = canvasPages.run(PageAction.New, { id: 'n1', from: 'a', projectId: 'p1' }, [{ id: 'a', name: 'A', href: '/p/p1/c/a' }], '/p/p1/c/a').then((outcome) => {
      answered = true;
      return outcome;
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(answered).toBe(false);

    reread.done();
    expect(await ran).toBe(OpOutcome.Landed);
  });

  it('opens a page again when a re-read elsewhere cancelled the first navigation', async () => {
    await canvasPages.open('/p/p1/c/n1');

    expect(nav.asked).toEqual(['/p/p1/c/n1', '/p/p1/c/n1']);
    expect(nav.path).toBe('/p/p1/c/n1');
  });
});
