import { describe, expect, it } from 'vitest';
import { ClassScope, rulesOf } from './class-rules';

const named = (rules: ReturnType<typeof rulesOf>, name: string) => rules.filter((r) => r.name === name);

describe('rulesOf', () => {
  it('reads the own rule of a class with its line and declarations', () => {
    const rules = rulesOf('src/app.css', '.a { color: red; }\n\n.card {\n  padding: 8px;\n  margin: 0;\n}\n');
    const [card] = named(rules, 'card');

    expect(card).toMatchObject({ file: 'src/app.css', line: 3, own: true, state: '', media: '', scope: ClassScope.Global });
    expect(card.declarations).toEqual({ padding: '8px', margin: '0' });
  });

  it('keeps the state and the media of a rule', () => {
    const rules = named(rulesOf('a.css', '.card:hover { color: red; }\n@media (max-width: 600px) {\n  .card { padding: 4px; }\n}\n'), 'card');

    expect(rules.map((r) => [r.state, r.media, r.own])).toEqual([
      [':hover', '', true],
      ['', '(max-width: 600px)', true]
    ]);
  });

  it('lists a class inside a combinator as context, not as an own rule', () => {
    const rules = rulesOf('a.css', '.list .item, .item + .item { gap: 2px; }\n');

    expect(rules.filter((r) => r.name === 'item').every((r) => !r.own)).toBe(true);
    expect(rules.some((r) => r.name === 'list' && !r.own)).toBe(true);
  });

  it('splits a selector list into one rule per class', () => {
    const rules = rulesOf('a.css', '.a, .b { color: red; }\n');

    expect(rules.map((r) => [r.name, r.own])).toEqual([
      ['a', true],
      ['b', true]
    ]);
  });

  it('ignores keyframes and survives broken css', () => {
    expect(rulesOf('a.css', '@keyframes spin { from { opacity: 0 } }\n')).toEqual([]);
    expect(rulesOf('a.css', '.a { color: ')).toEqual([]);
  });

  it('puts a css module in the module scope', () => {
    expect(rulesOf('src/Hero.module.css', '.hero { color: red; }\n')[0].scope).toBe(ClassScope.Module);
  });

  it('reads the style block of a svelte file with the file line', () => {
    const text = '<div class="card"></div>\n\n<style>\n  .card {\n    color: red;\n  }\n</style>\n';

    expect(rulesOf('src/Card.svelte', text)[0]).toMatchObject({ name: 'card', line: 4, scope: ClassScope.Component, own: true });
  });

  it('a :global class in a svelte style block is global', () => {
    const text = '<style>\n  :global(.btn) { color: red; }\n</style>\n';

    expect(rulesOf('src/Card.svelte', text)[0]).toMatchObject({ name: 'btn', scope: ClassScope.Global, own: true });
  });

  it('a vue style is component only when scoped', () => {
    const scoped = rulesOf('src/A.vue', '<template><i/></template>\n<style scoped>\n.a { color: red; }\n</style>\n');
    const open = rulesOf('src/A.vue', '<style>\n.a { color: red; }\n</style>\n');

    expect(scoped[0].scope).toBe(ClassScope.Component);
    expect(open[0].scope).toBe(ClassScope.Global);
  });

  it('reads the style of an astro file as component scope', () => {
    expect(rulesOf('src/A.astro', '---\n---\n<p class="a"/>\n<style>\n.a { color: red; }\n</style>\n')[0]).toMatchObject({ scope: ClassScope.Component, line: 5 });
  });

  it('ignores a file kind it has no style table for', () => {
    expect(rulesOf('src/a.ts', '.a { color: red; }')).toEqual([]);
  });
});
