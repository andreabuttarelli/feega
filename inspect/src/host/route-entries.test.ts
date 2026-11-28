import { describe, expect, it } from 'vitest';
import { UNRESOLVED, valueOfExpression, valueAt, type Lookup } from './expression-value';
import { entriesOf, hasGenerator } from './route-entries';

const lookupIn =
  (script: string): Lookup =>
  (name) => {
    const found = new RegExp(`const\\s+${name}\\b[^=]*=\\s*`).exec(script);

    return found ? valueAt(script, found.index + found[0].length, lookupIn(script)) : UNRESOLVED;
  };

const entries = (script: string) => entriesOf(script, lookupIn(script));

describe('entriesOf', () => {
  it.each([
    ['sveltekit arrow', "export const entries = () => [{ slug: 'a' }, { slug: 'b' }];", [{ slug: 'a' }, { slug: 'b' }]],
    ['typed arrow', "export const entries: EntryGenerator = () => [{ slug: 'a' }];", [{ slug: 'a' }]],
    ['function return', "export function entries() {\n  return [{ id: 'x' }];\n}", [{ id: 'x' }]],
    ['next static params', "export async function generateStaticParams() {\n  return [{ slug: 'a' }];\n}", [{ slug: 'a' }]],
    ['astro static paths', "export function getStaticPaths() {\n  return [{ params: { slug: 'a' } }];\n}", [{ slug: 'a' }]],
    ['number value', 'export const entries = () => [{ id: 7 }];', [{ id: '7' }]],
    ['catch all array', "export const entries = () => [{ slug: ['a', 'b'] }];", [{ slug: 'a/b' }]]
  ])('%s', (_name, script, expected) => {
    expect(entries(script)).toEqual(expected);
  });

  it('maps over a local list', () => {
    const script = "const POSTS = [{ slug: 'a', title: 'A' }, { slug: 'b', title: 'B' }];\nexport const entries = () => POSTS.map((p) => ({ slug: p.slug }));";

    expect(entries(script)).toEqual([{ slug: 'a' }, { slug: 'b' }]);
  });

  it('maps with a destructured parameter', () => {
    const script = "const POSTS = [{ slug: 'a' }];\nexport function generateStaticParams() {\n  return POSTS.map(({ slug }) => ({ slug }));\n}";

    expect(entries(script)).toEqual([{ slug: 'a' }]);
  });

  it('maps over the keys of a record', () => {
    const script = 'const BY_SLUG = { figma: {}, canva: {} };\nexport const entries = () => Object.keys(BY_SLUG).map((slug) => ({ slug }));';

    expect(entries(script)).toEqual([{ slug: 'figma' }, { slug: 'canva' }]);
  });

  it('gives nothing for a call it cannot resolve', () => {
    expect(entries('export const entries = () => getAll().map((p) => ({ slug: p.slug }));')).toEqual([]);
  });

  it('gives nothing without a generator', () => {
    expect(entries("export const load = () => ({ slug: 'a' });")).toEqual([]);
  });

  it('ignores a name that merely contains entries', () => {
    expect(entries("const myentries = () => [{ slug: 'a' }];")).toEqual([]);
  });
});

describe('hasGenerator', () => {
  it('tells a page with a generator from one without', () => {
    expect(hasGenerator("export const entries = () => [{ slug: 'a' }];")).toBe(true);
    expect(hasGenerator("export const load = () => ({ slug: 'a' });")).toBe(false);
  });
});
