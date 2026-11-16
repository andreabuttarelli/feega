import { describe, expect, it } from 'vitest';
import { fixture } from '../../../../tests/fixtures/design-tokens/read';
import { coverageOfDesign, designOf } from './design-system';

const covered = async (name: string) => coverageOfDesign((await designOf(fixture(name)))!, 'app');

describe('coverageOfDesign', () => {
  it('conta per genere i token che il repo dichiara e quelli importati', async () => {
    const coverage = await covered('shadcn');

    expect(coverage.colour.declared).toBeGreaterThan(0);
    expect(coverage.colour.imported).toBe(coverage.colour.declared);
    expect(coverage.radius.declared).toBeGreaterThan(coverage.radius.imported);
  });

  it('un token rifiutato resta nei dichiarati: nulla sparisce in silenzio', async () => {
    const coverage = await covered('plain');

    const declared = Object.values(coverage).reduce((n, c) => n + c.declared, 0);
    const imported = Object.values(coverage).reduce((n, c) => n + c.imported, 0);
    expect(declared).toBeGreaterThan(imported);
  });
});
