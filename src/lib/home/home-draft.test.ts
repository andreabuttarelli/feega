import { describe, expect, it } from 'vitest';
import { saveDraft, takeDraft, type DraftStore } from '$lib/home/home-draft';
import { PromptKind } from '$lib/home/prompt-kinds';
import { PromptSource } from '$lib/home/prompt-sources';

function memory(): DraftStore {
  const items = new Map<string, string>();
  return { getItem: (k) => items.get(k) ?? null, setItem: (k, v) => void items.set(k, v), removeItem: (k) => void items.delete(k) };
}

describe('a prompt typed signed out survives sign-in', () => {
  it('words, chip and images come back once, then the draft is gone', async () => {
    globalThis.document ??= { cookie: '' } as Document;
    const store = memory();
    const image = new File([new Uint8Array([1, 2, 3])], 'logo.png', { type: 'image/png' });

    await saveDraft(store, { text: 'A launch film', kind: PromptKind.Website, files: [image], pick: null });
    const back = await takeDraft(store);

    expect(back?.text).toBe('A launch film');
    expect(back?.kind).toBe(PromptKind.Website);
    expect(back?.files[0]?.name).toBe('logo.png');
    expect([...new Uint8Array(await back!.files[0]!.arrayBuffer())]).toEqual([1, 2, 3]);
    expect(await takeDraft(store)).toBeNull();
  });

  it('a GitHub or Figma pick comes back whole', async () => {
    const store = memory();
    await saveDraft(store, { text: 'x', kind: PromptKind.Motion, files: [], pick: { source: PromptSource.Figma, value: 'https://www.figma.com/design/abc' } });

    expect((await takeDraft(store))?.pick).toEqual({ source: PromptSource.Figma, value: 'https://www.figma.com/design/abc' });
  });

  it('a folder cannot be stored: it comes back as a source to pick again', async () => {
    const store = memory();
    await saveDraft(store, { text: 'x', kind: PromptKind.Motion, files: [], pick: { source: PromptSource.Folder, value: '/Users/me/app' } });

    const back = await takeDraft(store);
    expect(back?.pick).toBeNull();
    expect(back?.pickAgain).toBe(PromptSource.Folder);
  });
});
