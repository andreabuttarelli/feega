import { describe, expect, it, vi } from 'vitest';

const loaded = vi.hoisted(() => ({ markitdown: false }));
vi.mock('markitdown-ts', () => {
  loaded.markitdown = true;
  return { MarkItDown: class {} };
});

describe('importare il convertitore non carica il lettore PDF', () => {
  it('markitdown-ts (e pdfjs, che in Node non ha DOMMatrix) si carica solo quando si converte', async () => {
    await import('./file-to-markdown');
    expect(loaded.markitdown).toBe(false);
  });
});
