import { describe, expect, it } from 'vitest';
import { CheckState, ComponentMode, modeOf, PropFormat, Strictness, checkState, customValues, parseComponent, sourceHash, type CustomComponent } from './component';

const counter: CustomComponent = {
  source: { html: '<div class="n"></div>', css: '.n{font-size:120px}', js: 'tl.to(root.querySelector(".n"),{x:100,duration:1});' },
  propsSchema: {
    type: 'object',
    properties: {
      label: { type: 'string', title: 'Label', default: 'Posts' },
      count: { type: 'number', title: 'Count', default: 12, minimum: 0, maximum: 1000 },
      accent: { type: 'string', format: PropFormat.Color, default: 'brand.accent' },
      layout: { type: 'string', enum: ['row', 'stack'], default: 'row' },
      glow: { type: 'boolean', default: true }
    }
  },
  version: 1,
  check: null
};

describe('a custom component', () => {
  it('fills the values a clip does not give from the props schema defaults', () => {
    expect(customValues(counter, {}, Strictness.Strict)).toEqual({ ok: true, values: { label: 'Posts', count: 12, accent: 'brand.accent', layout: 'row', glow: true } });
  });

  it('refuses a value outside the schema when written', () => {
    const verdict = customValues(counter, { count: 5000 }, Strictness.Strict);

    expect(verdict.ok).toBe(false);
    expect(!verdict.ok && verdict.error).toContain('count');
  });

  it('falls back to the default when the schema changed under a saved clip', () => {
    expect(customValues(counter, { count: 'many', gone: 1 }, Strictness.Lenient)).toEqual({ ok: true, values: expect.objectContaining({ count: 12 }) });
  });

  it('refuses a colour that is not hex, transparent or a brand colour', () => {
    expect(customValues(counter, { accent: 'red' }, Strictness.Strict).ok).toBe(false);
  });

  it('has a hash that changes with its source and its props schema', () => {
    const edited = { ...counter, source: { ...counter.source, css: '.n{font-size:100px}' } };

    expect(sourceHash(edited)).not.toBe(sourceHash(counter));
    const checked: CustomComponent = { ...counter, check: { hash: 'x', state: CheckState.Passed, problems: [] } };
    expect(sourceHash(checked)).toBe(sourceHash(counter));
  });

  it('counts as unchecked once the code changed after a passing check', () => {
    const passed = { ...counter, check: { hash: sourceHash(counter), state: CheckState.Passed, problems: [] } };
    const edited = { ...passed, source: { ...counter.source, js: '' } };

    expect(checkState(passed)).toBe(CheckState.Passed);
    expect(checkState(edited)).toBe(CheckState.Unchecked);
  });

  it('rejects a props schema key that is not an identifier', () => {
    const bad = { ...counter, propsSchema: { type: 'object', properties: { 'a-b': { type: 'string' } } } };

    expect(parseComponent(bad).ok).toBe(false);
  });
});

describe('the mode of a component', () => {
  it('is deterministic unless declared live', () => {
    const parsed = parseComponent(counter);
    const live = parseComponent({ ...counter, mode: ComponentMode.Live });

    expect(parsed.ok && modeOf(parsed.component)).toBe(ComponentMode.Deterministic);
    expect(live.ok && modeOf(live.component)).toBe(ComponentMode.Live);
  });

  it('changes the check stamp when it turns live, not before', () => {
    expect(sourceHash({ ...counter, mode: ComponentMode.Deterministic })).toBe(sourceHash(counter));
    expect(sourceHash({ ...counter, mode: ComponentMode.Live })).not.toBe(sourceHash(counter));
  });
});

