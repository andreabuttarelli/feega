import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { VarType } from '@feega/motion-core/motion/variables-model';
import { variableLibrary } from '$lib/canvas/variable-library.svelte';
import ColourTokensSection from './ColourTokensSection.svelte';

describe('the colour tokens in the styles panel', () => {
  afterEach(() => {
    variableLibrary.collections = {};
  });

  it('lists every colour token of the project with its colour', () => {
    variableLibrary.collections = {
      Vercel: { modes: ['Default'], vars: { Surface: { type: VarType.Colour, values: { Default: '#ffffff' } }, Gap: { type: VarType.Number, values: { Default: 8 } } } }
    };
    const body = render(ColourTokensSection).body;

    expect(body).toContain('data-testid="colour-token-Vercel/Surface"');
    expect(body).toContain('#ffffff');
    expect(body).not.toContain('Vercel/Gap');
  });

  it('is absent while the project has no colour token', () => {
    expect(render(ColourTokensSection).body).not.toContain('data-testid="colour-tokens"');
  });
});
