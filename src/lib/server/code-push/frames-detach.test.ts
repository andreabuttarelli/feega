import { describe, expect, it } from 'vitest';
import { EntryKind, linkSchema, type CodeLink } from './link';
import type { LinkStore } from './link-store';
import { frameDetach, FramesRefusal } from './frames-push';

const memoryLinks = (seed: Record<string, CodeLink>) => {
  const saved = new Map(Object.entries(seed));
  const links: LinkStore = { read: async (id) => saved.get(id) ?? null, save: async (id, l) => Boolean(saved.set(id, l)), remove: async (id) => saved.delete(id) };
  return { saved, links };
};

const link = linkSchema.parse({ repo: 'acme/app', entryKind: EntryKind.Page, entry: 'app/page.tsx', baseBranch: 'main', baseSha: 'c1' });

describe('staccare un frame da GitHub', () => {
  it('il link sparisce, il frame resta', async () => {
    const { saved, links } = memoryLinks({ a: link });

    expect(await frameDetach({ links }, 'a')).toEqual({ ok: true });
    expect(saved.has('a')).toBe(false);
  });

  it('un frame senza link risponde not_linked', async () => {
    const { links } = memoryLinks({});

    expect(await frameDetach({ links }, 'a')).toEqual({ ok: false, refusal: FramesRefusal.NotLinked });
  });
});
