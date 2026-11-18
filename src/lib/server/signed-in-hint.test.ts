import { describe, expect, it } from 'vitest';
import { SIGNED_IN_HINT, Session, syncSignedInHint } from './signed-in-hint';

type Written = { value: string; opts: Record<string, unknown> };

function jar(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const writes: Written[] = [];
  const deletes: Record<string, unknown>[] = [];
  return {
    get: (name: string) => values.get(name),
    set: (name: string, value: string, opts: Record<string, unknown>) => {
      values.set(name, value);
      writes.push({ value, opts });
    },
    delete: (name: string, opts: Record<string, unknown>) => {
      values.delete(name);
      deletes.push(opts);
    },
    writes,
    deletes
  };
}

describe('the signed-in hint the landing reads', () => {
  it('is shared with every feega.app subdomain when a session exists', () => {
    const cookies = jar();
    syncSignedInHint(cookies, 'oh.feega.app', Session.Present);
    expect(cookies.get(SIGNED_IN_HINT)).toBe('1');
    expect(cookies.writes[0].opts).toMatchObject({ domain: 'feega.app', path: '/', httpOnly: false, sameSite: 'lax' });
  });

  it('carries no token, only a flag', () => {
    const cookies = jar();
    syncSignedInHint(cookies, 'oh.feega.app', Session.Present);
    expect(cookies.writes.map((w) => w.value)).toEqual(['1']);
  });

  it('is host-only off the feega.app domain', () => {
    const cookies = jar();
    syncSignedInHint(cookies, 'localhost', Session.Present);
    expect(cookies.writes[0].opts.domain).toBeUndefined();
  });

  it('is not rewritten on every request', () => {
    const cookies = jar({ [SIGNED_IN_HINT]: '1' });
    syncSignedInHint(cookies, 'oh.feega.app', Session.Present);
    expect(cookies.writes).toEqual([]);
  });

  it('is cleared, on the same domain, once the session is gone', () => {
    const cookies = jar({ [SIGNED_IN_HINT]: '1' });
    syncSignedInHint(cookies, 'oh.feega.app', Session.Absent);
    expect(cookies.get(SIGNED_IN_HINT)).toBeUndefined();
    expect(cookies.deletes[0]).toMatchObject({ domain: 'feega.app', path: '/' });
  });

  it('touches nothing for a signed-out visitor without the hint', () => {
    const cookies = jar();
    syncSignedInHint(cookies, 'oh.feega.app', Session.Absent);
    expect(cookies.writes).toEqual([]);
    expect(cookies.deletes).toEqual([]);
  });
});
