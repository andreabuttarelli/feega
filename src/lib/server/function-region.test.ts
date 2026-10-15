import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const DATABASE_REGION_NEIGHBOUR = 'lhr1';

describe('function region', () => {
  it('le funzioni girano accanto al database (eu-west-2), non oltre l’Atlantico', () => {
    const config = readFileSync('svelte.config.js', 'utf8');

    expect(config).toMatch(new RegExp(`regions:\\s*\\[\\s*'${DATABASE_REGION_NEIGHBOUR}'\\s*\\]`));
  });
});
