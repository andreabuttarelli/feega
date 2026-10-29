import { describe, expect, it } from 'vitest';
import { PageAction, pageOp, restoreShell, type Shell } from './page-ops';

const row = (id: string, name: string) => ({ id, name, href: `/p/p1/c/${id}` });
const shell = (over: Partial<Shell> = {}): Shell => ({ pages: [row('a', 'Untitled canvas 1'), row('b', 'Moodboard')], share: null, ...over });

describe('page ops: pages and sharing change before the server answers', () => {
  it('a new page appears at the end with the name the server will give it, under the client id', () => {
    const before = shell();
    const op = pageOp(PageAction.New, { id: 'n1', from: 'a', projectId: 'p1' });

    expect(op.apply(before).pages.at(-1)).toEqual({ id: 'n1', name: 'Untitled canvas 2', href: '/p/p1/c/n1' });
    expect(op.fields).toEqual({ id: 'n1' });
    expect(op.canvasId).toBe('a');
  });

  it('a rename shows the trimmed name on that page only', () => {
    const before = shell();
    const op = pageOp(PageAction.Rename, { id: 'b', name: '  Ideas ' });

    expect(op.apply(before).pages.map((p) => p.name)).toEqual(['Untitled canvas 1', 'Ideas']);
    expect(op.canvasId).toBe('b');
  });

  it('a delete takes the page out of the list', () => {
    const before = shell();

    expect(pageOp(PageAction.Delete, { id: 'a' }).apply(before).pages.map((p) => p.id)).toEqual(['b']);
  });

  it('sharing shows the link the client minted, and stopping it clears the link', () => {
    const before = shell();
    const on = pageOp(PageAction.Share, { canvasId: 'a', token: 'T'.repeat(32) });
    const off = pageOp(PageAction.Share, { canvasId: 'a', token: null });

    expect(on.apply(before).share).toEqual({ canvasId: 'a', token: 'T'.repeat(32) });
    expect(on.fields).toEqual({ state: 'on', token: 'T'.repeat(32) });
    expect(off.fields).toEqual({ state: 'off' });
  });

  it('a refusal puts back only what the op touched', () => {
    const before = shell({ share: { canvasId: 'a', token: null } });
    const op = pageOp(PageAction.Rename, { id: 'b', name: 'Ideas' });
    const meanwhile = { ...op.apply(before), share: { canvasId: 'a', token: 'x' } };

    expect(restoreShell(meanwhile, before, op.touched)).toEqual({ pages: before.pages, share: { canvasId: 'a', token: 'x' } });
  });
});
