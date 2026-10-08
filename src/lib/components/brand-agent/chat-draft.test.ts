import { describe, it, expect } from 'vitest';
import { keptDraft, keepDraft } from './chat-draft';

function memory(): Storage {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k) } as Storage;
}

const denied = () => {
  throw new Error('denied');
};

describe('the composer draft', () => {
  it('survives a reload of the same chat', () => {
    const store = memory();

    keepDraft('/a', 'half a thought', store);

    expect(keptDraft('/a', store)).toBe('half a thought');
    expect(keptDraft('/b', store)).toBe('');
  });

  it('an emptied composer forgets the draft', () => {
    const store = memory();
    keepDraft('/a', 'sent', store);

    keepDraft('/a', '', store);

    expect(keptDraft('/a', store)).toBe('');
  });

  it('a browser that refuses storage still has a composer', () => {
    const refusing = { getItem: denied, setItem: denied, removeItem: denied } as unknown as Storage;

    expect(() => keepDraft('/a', 'x', refusing)).not.toThrow();
    expect(keptDraft('/a', refusing)).toBe('');
  });
});
