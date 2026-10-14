import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import ColorField from './ColorField.svelte';
import NumberField from './NumberField.svelte';
import SegmentedField from './SegmentedField.svelte';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { MIXED } from '$lib/motion/mixed';
import { segmentsOf } from '$lib/motion/segments';

describe('colour field', () => {
  it('a hex value: a swatch of that colour and the hex in capitals', () => {
    const html = render(ColorField, { props: { id: 'f-ink', name: 'Ink', value: '#ff00aa', tokens: FEEGA_TOKENS, onchange: () => {} } }).body;

    expect(html).toContain('--c: #ff00aa');
    expect(html).toContain('value="FF00AA"');
    expect(html).toContain('id="f-ink"');
  });

  it('a brand token: the brand colour in the swatch and the token by name', () => {
    const html = render(ColorField, { props: { name: 'Colour', value: 'brand.text', tokens: FEEGA_TOKENS, onchange: () => {} } }).body;

    expect(html).toContain(`--c: ${FEEGA_TOKENS.colors['brand.text']}`);
    expect(html).toContain('value="Brand text"');
  });

  it('keeps the picker closed until the swatch is pressed', () => {
    const html = render(ColorField, { props: { name: 'Colour', value: '#000000', tokens: FEEGA_TOKENS, onchange: () => {} } }).body;

    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('data-testid="colour-popover"');
  });
});

describe('colour field opacity', () => {
  it('shows an opacity percentage only where the caller stores one', () => {
    const plain = render(ColorField, { props: { name: 'Ink', value: '#000000', tokens: FEEGA_TOKENS, onchange: () => {} } }).body;
    const layered = render(ColorField, { props: { name: 'Fill', value: '#000000', alpha: 0.4, tokens: FEEGA_TOKENS, onchange: () => {}, onalpha: () => {} } }).body;

    expect(plain).not.toContain('aria-label="Ink opacity"');
    expect(layered).toMatch(/aria-label="Fill opacity"[^>]*value="40%"/);
  });
});

describe('number field', () => {
  const range = { min: 0, max: 100, step: 1 };

  it('the label is the scrub handle: drag it to change the value', () => {
    const html = render(NumberField, { props: { label: 'Opacity', name: 'Opacity', value: 40, range, unit: '%', onchange: () => {} } }).body;

    expect(html).toMatch(/class="label[^"]*" title="Opacity · drag to scrub/);
    expect(html).toContain('value="40"');
  });

  it('a mixed value is empty with Mixed as placeholder, not a number nobody chose', () => {
    const html = render(NumberField, { props: { label: 'X', name: 'Offset X', value: MIXED, range, onchange: () => {} } }).body;

    expect(html).toContain('placeholder="Mixed"');
    expect(html).toContain('value=""');
  });
});

describe('segmented field', () => {
  it('draws one toggle per option and marks the current one', () => {
    const html = render(SegmentedField, { props: { name: 'Align', options: segmentsOf('align', ['left', 'center', 'right']), value: 'center', onchange: () => {} } }).body;

    expect(html.match(/role="radio"/g)).toHaveLength(3);
    expect(html).toMatch(/aria-checked="true"[^>]*aria-label="Align centre"/);
  });
});
