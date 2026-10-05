import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { ComponentProps } from 'svelte';
import NumberField from './NumberField.svelte';
import { FieldFill } from '$lib/motion/number-field';
import { KeyMark } from '$lib/motion/timeline-layers';

const html = (props: Partial<ComponentProps<typeof NumberField>> = {}) =>
  render(NumberField, { props: { label: 'α', name: 'Opacity', value: 0.5, range: { min: 0, max: 1, step: 0.01 }, onchange: () => {}, ...props } }).body;

describe('number field', () => {
  it('is one field: a scrub label, the value in mono, the unit', () => {
    const body = html({ unit: '%' });

    expect(body).toContain('aria-label="Opacity"');
    expect(body).toContain('value="0.50"');
    expect(body).toContain('>α</span>');
    expect(body).toContain('>%</span>');
  });

  it('fills a known range inside the field instead of a separate slider', () => {
    expect(html({ fill: FieldFill.Range })).toContain('--fill: 50%');
    expect(html()).not.toContain('--fill');
    expect(html()).not.toContain('type="range"');
  });

  it('shows the keyframe toggle only for an animatable value', () => {
    expect(html({ mark: KeyMark.Here })).toContain('data-mark="here"');
    expect(html()).not.toContain('data-mark');
  });
});
