import { describe, expect, it } from 'vitest';
import { EntryKind, ComponentRole, linkSchema } from './link';
import { linkOf, rowOf } from './link-store';

describe('frame_code_links', () => {
  it('una riga torna il link da cui è nata', () => {
    const link = linkSchema.parse({ repo: 'acme/app', appRoot: 'apps/web', entryKind: EntryKind.Component, role: ComponentRole.Main, entry: 'ui/Button.tsx', baseBranch: 'main', baseSha: 'c1', pushBranch: 'feega/x', pushSha: 'c2', pullNumber: 3 });

    expect(linkOf(rowOf(link))).toEqual(link);
  });

  it('un link senza ripristino non nomina la colonna restored, uno con ripristino sì', () => {
    const link = linkSchema.parse({ repo: 'acme/app', entryKind: EntryKind.Page, entry: 'a.tsx', baseBranch: 'main', baseSha: 'c1' });
    const restored = { ...link, restored: [{ path: 'a.tsx', content: 'x' }] };

    expect('restored' in rowOf(link)).toBe(false);
    expect(linkOf(rowOf(restored))).toEqual(restored);
  });

  it('una riga che non rispetta lo schema è null, non un link a metà', () => {
    expect(linkOf({ repo: 'acme/app' })).toBeNull();
  });
});
