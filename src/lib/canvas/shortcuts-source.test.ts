import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ITALIAN = /\b(della|sposta|selezione|tela|tasto|cancellazione|scorciatoie)\b/i;

describe('canvas shortcuts source', () => {
  it('has no Italian text', () => {
    const source = readFileSync(new URL('./shortcuts.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(ITALIAN);
  });
});
