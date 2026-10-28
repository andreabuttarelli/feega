// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { mountDomReader } from './reader';

const SIZE = { width: 10, height: 10 };
const PROMPT_MS = 1000;

describe('mountDomReader', () => {
  it('a read still waiting when the reader is disposed settles at once, so the player is not stuck for a minute', async () => {
    const reader = await mountDomReader(document.body, () => '<html><body></body></html>', ['c'], new Set(['c']), SIZE);
    const pending = reader.readAt(0);

    reader.dispose();

    const settled = await Promise.race([pending.then(() => 'resolved', () => 'rejected'), new Promise((r) => setTimeout(() => r('waiting'), PROMPT_MS))]);
    expect(settled).toBe('rejected');
  });

  it('reads on a page that is not a secure context, where crypto.randomUUID does not exist', async () => {
    vi.stubGlobal('crypto', {});
    const reader = await mountDomReader(document.body, () => '<html><body></body></html>', ['c'], new Set(['c']), SIZE);
    const pending = reader.readAt(0);

    reader.dispose();

    await expect(pending).rejects.toThrow('reader disposed');
    vi.unstubAllGlobals();
  });
});
