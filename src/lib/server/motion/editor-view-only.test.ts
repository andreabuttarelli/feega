import { describe, expect, it } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import { assertEditor } from '$lib/server/motion/editor-scope';

const membership = (role: string) => [{ org: { id: 'org-1', name: 'o', slug: 'o' }, role }] as never;

describe("l'editor di un viewer", () => {
  it('rimanda alla tela, che in sola lettura si guarda', () => {
    try {
      assertEditor(membership('viewer'), 'org-1', '/p/p1/c/c1');
      expect.unreachable();
    } catch (e) {
      expect(isRedirect(e) && e.location).toBe('/p/p1/c/c1');
    }
  });

  it('un member entra', () => {
    expect(() => assertEditor(membership('member'), 'org-1', '/p/p1/c/c1')).not.toThrow();
  });
});
