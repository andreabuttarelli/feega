import { describe, expect, it } from 'vitest';
import { ChipIcon, chipOf, chipView } from './ai-chip';

const context = (selector: string) => ['Feega selection', 'source: src/Hero.svelte:12:3', `selector: ${selector}`, 'page: /'].join('\n');

describe('the selection chip title', () => {
  it('keeps the file, line and selector for the hover', () => {
    expect(chipOf(context('h1.title'))).toBe('src/Hero.svelte:12 h1.title');
  });

  it('shows the count when several elements are selected', () => {
    expect(chipOf('Feega selection: 3 elements\npage: /')).toBe('3 elements');
  });

  it('has no chip without a selection', () => {
    expect(chipOf(null)).toBeNull();
    expect(chipView(null)).toBeNull();
  });
});

describe('the readable chip', () => {
  it('names a heading by its level and mutes the place', () => {
    expect(chipView(context('h1._title_1qmmg_34'))).toEqual({ icon: ChipIcon.Heading, name: 'Heading 1', place: 'Hero.svelte:12', title: 'src/Hero.svelte:12 h1._title_1qmmg_34' });
  });

  it('names a button', () => {
    expect(chipView(context('button.cta'))).toMatchObject({ icon: ChipIcon.Button, name: 'Button' });
  });

  it('falls back to a generic element for unknown tags', () => {
    expect(chipView(context('div.card'))).toMatchObject({ icon: ChipIcon.Box, name: 'Element' });
  });

  it('counts several elements', () => {
    expect(chipView('Feega selection: 3 elements\npage: /')).toEqual({ icon: ChipIcon.Many, name: '3 elements', place: '', title: '3 elements' });
  });
});
