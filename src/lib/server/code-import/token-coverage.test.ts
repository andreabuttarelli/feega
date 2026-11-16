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

  it('un tema da 242 colori li importa tutti; i generi senza variabile restano dichiarati e non importati', async () => {
    const coverage = await covered('big-theme');

    expect(coverage.colour).toEqual({ declared: 242, imported: 242 });
    expect(coverage['font weight']).toEqual({ declared: 3, imported: 0 });
    expect(coverage['shadow part']).toEqual({ declared: 3, imported: 0 });
  });

  it('una config Tailwind 3 e le variabili SCSS contano tra i dichiarati del repo', async () => {
    const config = await covered('tailwind3-config');
    const sass = await covered('scss-less');

    expect(config.colour).toEqual({ declared: 6, imported: 6 });
    expect(config.spacing).toEqual({ declared: 2, imported: 2 });
    expect(sass.radius).toEqual({ declared: 2, imported: 2 });
  });
});
