import { describe, expect, it } from 'vitest';
import { attributesOf, Delimiter } from './open-tag';

const OPEN = (source: string) => attributesOf(source, 0);

describe('attributesOf', () => {
  it('reads quoted, braced, bare and shorthand attributes', () => {
    const found = OPEN(`<a href="/x" target='_blank' onClick={() => go('/y')} data-n=3 {id} {...rest} disabled>`);

    expect(found.map((a) => [a.name, a.value, a.delimiter])).toEqual([
      ['href', '/x', Delimiter.Double],
      ['target', '_blank', Delimiter.Single],
      ['onClick', `() => go('/y')`, Delimiter.Brace],
      ['data-n', '3', Delimiter.None],
      ['id', null, Delimiter.Shorthand],
      ['...rest', null, Delimiter.Shorthand],
      ['disabled', null, Delimiter.None]
    ]);
  });

  it('keeps a greater-than sign inside a value', () => {
    const found = OPEN(`<button onClick={() => a > b} class="x">`);

    expect(found.map((a) => a.name)).toEqual(['onClick', 'class']);
  });

  it('reads framework attribute names', () => {
    const found = OPEN(`<button @click.prevent="go" :to="'/a'" on:click|once={go} v-on:click="go">`);

    expect(found.map((a) => a.name)).toEqual(['@click.prevent', ':to', 'on:click|once', 'v-on:click']);
  });

  it('gives offsets that slice the value back out', () => {
    const source = `<a href="/x" class="y">`;
    const [href] = OPEN(source);

    expect(source.slice(href.valueStart, href.valueEnd)).toBe('/x');
    expect(source.slice(href.start, href.end)).toBe('href="/x"');
  });
});
